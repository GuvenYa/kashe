-- =============================================================================
-- DUZELTME 12 - teklif ve rezervasyon akisi (Fahri satir 18-25, 28; bulgu 114-120)
-- Plan: docs/sahne/duzeltme-12-14-plan.md
--
--   12-A Teklif kendi tarih / saat / yerini tasir; rezervasyon once teklifin
--        tarihini alir; kamu profilde dolu gunler (kimliksiz RPC).
--   12-B Ayni profesyonelle ikinci is: sohbette talep numarasi
--        (`conversations.request_count`, `quotes.request_no`) + "Yeni talep"
--        sistem karti (musteri brief'i, rezervasyon talebi, teklif topla);
--        kabul yalniz ayni talebin tekliflerini reddeder (uygulama).
--   12-E Kabulde musteriye de bildirim (tetikleyici); e-posta uygulamada.
--   12-F Tarihten once "tamamlandi": satici onay ister
--        (`bookings.completion_requested_at`), alici onaylar.
--   12-G Satici iptalinde musteri yorum birakabilir (uygunluk fonksiyonu).
-- Sistem (auth.uid() bos) ve yonetici serbest. Idempotan.
-- Kontrol: docs/envanter/asama31-duzeltme12-kontrol.sql (yapi),
-- asama31b-duzeltme12-davranis.sql (davranis, YALNIZ dal).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Sutunlar
-- -----------------------------------------------------------------------------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS request_no integer NOT NULL DEFAULT 1;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS request_count integer NOT NULL DEFAULT 1;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS completion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Satici "tamamlanma onayi iste" yazabilir (gecis kurali tetikleyicide).
GRANT UPDATE (completion_requested_at) ON public.bookings TO authenticated;

-- Saat sirasi kisitlanmaz: gece yarisini asan isler (22:00 - 03:00) olagan,
-- sohbet tablosunda da kisit yok.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_location_len') THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_location_len
      CHECK (location IS NULL OR char_length(location) <= 200);
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2) Teklif eklenirken talep numarasi ve tarih kurali (12-A / 12-B)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_duz12_teklif_ekleme()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sayac integer;
BEGIN
  SELECT c.request_count INTO v_sayac FROM public.conversations c WHERE c.id = NEW.conversation_id;
  NEW.request_no := COALESCE(v_sayac, 1);

  -- Istemci gecmis tarihe teklif yazamaz (sistem / yonetici serbest)
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid())
     AND NEW.event_date IS NOT NULL
     AND NEW.event_date < (now() AT TIME ZONE 'Europe/Istanbul')::date THEN
    RAISE EXCEPTION 'Teklif tarihi gecmiste olamaz.' USING ERRCODE = '22023';
  END IF;
  IF NEW.location IS NOT NULL THEN
    NEW.location := NULLIF(btrim(NEW.location), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_duz12_teklif_ekleme ON public.quotes;
CREATE TRIGGER trg_duz12_teklif_ekleme
  BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.fn_duz12_teklif_ekleme();

-- Yeni sohbet her zaman 1. talepten baslar (istemci sayaci yazamaz).
CREATE OR REPLACE FUNCTION public.fn_duz12_sohbet_ekleme()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    NEW.request_count := 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_duz12_sohbet_ekleme ON public.conversations;
CREATE TRIGGER trg_duz12_sohbet_ekleme
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.fn_duz12_sohbet_ekleme();

-- -----------------------------------------------------------------------------
-- 3) Kabulde rezervasyon: once teklifin tarihi, yoksa sohbetinki (12-A)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_quote_accepted_create_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv record;
BEGIN
  IF old.status = 'pending' AND new.status = 'accepted' THEN
    new.responded_at := now();

    SELECT customer_id, professional_id, event_date, event_type,
           location, guest_count, start_time, end_time
      INTO conv
      FROM public.conversations
     WHERE id = new.conversation_id;

    INSERT INTO public.bookings (
      quote_id, conversation_id,
      customer_id, professional_id,
      event_date, event_type, location, guest_count,
      start_time, end_time,
      total_amount, platform_fee, currency,
      status
    ) VALUES (
      new.id, new.conversation_id,
      conv.customer_id, conv.professional_id,
      COALESCE(new.event_date, conv.event_date), conv.event_type,
      COALESCE(new.location, conv.location), conv.guest_count,
      COALESCE(new.start_time, conv.start_time),
      COALESCE(new.end_time, conv.end_time),
      new.total_amount, 0, new.currency,
      'confirmed'
    );
  END IF;

  IF old.status = 'pending' AND new.status IN ('declined', 'withdrawn', 'expired') THEN
    new.responded_at := now();
  END IF;

  RETURN new;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4) Kabulde musteriye bildirim (12-E)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_duz12_kabul_bildirimi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_musteri uuid;
  v_rez uuid;
  v_ad text;
BEGIN
  IF OLD.status <> 'pending' OR NEW.status <> 'accepted' THEN
    RETURN NEW;
  END IF;
  SELECT c.customer_id INTO v_musteri FROM public.conversations c WHERE c.id = NEW.conversation_id;
  SELECT b.id INTO v_rez FROM public.bookings b WHERE b.quote_id = NEW.id ORDER BY b.created_at DESC LIMIT 1;
  SELECT CASE WHEN p.role IN ('agency', 'business') AND p.company_name IS NOT NULL
              THEN p.company_name ELSE p.full_name END
    INTO v_ad
    FROM public.profiles p WHERE p.id = NEW.sender_id;

  IF v_musteri IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, body, link)
    VALUES (v_musteri, 'message',
            'Teklifi onayladın — ' || COALESCE(v_ad, 'profesyonel') || ' ile rezervasyon oluştu',
            CASE WHEN v_rez IS NOT NULL THEN '/rezervasyon/' || v_rez
                 ELSE '/mesajlar/' || NEW.conversation_id END);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_duz12_kabul_bildirimi ON public.quotes;
CREATE TRIGGER trg_duz12_kabul_bildirimi
  AFTER UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.fn_duz12_kabul_bildirimi();

-- -----------------------------------------------------------------------------
-- 5) Rezervasyon gecisleri: tamamlanma onayi (12-F)
--    G01 tetikleyicisi yeniden yazildi; eski kurallar aynen korunur.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guv01_rezervasyon_gecis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_satici boolean;
  v_alici boolean;
  v_org uuid;
  v_bugun date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
  IF v_uid IS NULL OR public.is_admin(v_uid) THEN
    RETURN NEW;
  END IF;

  -- Satici taraf: profesyonel / saglayici ya da satici kurulusta proposals.manage
  v_satici := v_uid IS NOT DISTINCT FROM OLD.professional_id
           OR v_uid IS NOT DISTINCT FROM OLD.seller_provider_id;
  IF NOT v_satici AND OLD.seller_provider_id IS NOT NULL THEN
    SELECT pr.organization_id INTO v_org FROM public.providers pr WHERE pr.id = OLD.seller_provider_id;
    v_satici := v_org IS NOT NULL AND public.has_org_permission(v_org, 'proposals.manage');
  END IF;
  IF NOT v_satici AND OLD.proposal_version_id IS NOT NULL THEN
    SELECT p.seller_organization_id INTO v_org
      FROM public.proposal_versions pv JOIN public.proposals p ON p.id = pv.proposal_id
     WHERE pv.id = OLD.proposal_version_id;
    v_satici := v_org IS NOT NULL AND public.has_org_permission(v_org, 'proposals.manage');
  END IF;

  -- Alici taraf: musteri ya da alici kurulusta events.manage
  v_alici := v_uid IS NOT DISTINCT FROM OLD.customer_id
          OR (OLD.buyer_organization_id IS NOT NULL
              AND public.has_org_permission(OLD.buyer_organization_id, 'events.manage'));

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    -- Durum degismeden iptal / tamamlama damgalari elle oynanmaz.
    IF NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
       OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
       OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
      RAISE EXCEPTION 'Iptal / tamamlama bilgisi durum degismeden degistirilemez.'
        USING ERRCODE = '42501';
    END IF;
    -- Tamamlanma onayi istegi: yalniz satici, yalniz onayli rezervasyonda, bir kez.
    IF NEW.completion_requested_at IS DISTINCT FROM OLD.completion_requested_at THEN
      IF NOT v_satici OR OLD.status <> 'confirmed' OR OLD.completion_requested_at IS NOT NULL
         OR NEW.completion_requested_at IS NULL THEN
        RAISE EXCEPTION 'Tamamlanma onayini yalniz hizmet veren taraf, onayli rezervasyonda bir kez ister.'
          USING ERRCODE = '42501';
      END IF;
      NEW.completion_requested_at := now();
      NEW.completion_requested_by := v_uid;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Rezervasyon "%" durumunda; durumu degistirilemez.', OLD.status
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'completed' THEN
    IF v_alici AND OLD.completion_requested_at IS NOT NULL THEN
      -- Alici, saticinin istegini onayliyor.
      NULL;
    ELSIF v_satici THEN
      IF OLD.event_date IS NULL OR OLD.event_date > v_bugun THEN
        RAISE EXCEPTION 'Etkinlik tarihi gelmeden tamamlamak icin musteri onayi gerekir.'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      RAISE EXCEPTION 'Rezervasyonu yalniz hizmet veren taraf tamamlar.'
        USING ERRCODE = '42501';
    END IF;
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSIF NEW.status = 'cancelled' THEN
    IF NOT (v_satici OR v_alici) THEN
      RAISE EXCEPTION 'Bu rezervasyonu iptal etme yetkin yok.'
        USING ERRCODE = '42501';
    END IF;
    NEW.cancelled_by := v_uid;
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  ELSE
    RAISE EXCEPTION 'Gecersiz rezervasyon durumu: %', NEW.status
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5b) Tamamlanma istegi / onayi bildirimleri (12-F)
--     Istek: aliciya (musteri + alici kurulus). Onay: saticiya.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_duz12_tamamlama_bildirimi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_satici_org uuid;
  v_satici_ad text;
  v_baslik text;
  v_link text := '/rezervasyon/' || NEW.id::text;
  v_body text;
  v_uid uuid := auth.uid();
BEGIN
  IF NEW.seller_provider_id IS NOT NULL THEN
    SELECT pv.organization_id, pv.display_name INTO v_satici_org, v_satici_ad
      FROM public.providers pv WHERE pv.id = NEW.seller_provider_id;
  END IF;
  IF v_satici_ad IS NULL AND NEW.professional_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(trim(pf.company_name), ''), NULLIF(trim(pf.full_name), ''))
      INTO v_satici_ad FROM public.profiles pf WHERE pf.id = NEW.professional_id;
  END IF;
  v_satici_ad := COALESCE(v_satici_ad, 'Hizmet sağlayıcı');
  IF NEW.event_type IS NOT NULL THEN
    SELECT et.name_tr INTO v_baslik FROM public.event_types et WHERE et.key = NEW.event_type;
  END IF;
  v_baslik := COALESCE(NULLIF(trim(v_baslik), ''), 'Rezervasyon')
              || CASE WHEN NEW.event_date IS NOT NULL THEN ' (' || to_char(NEW.event_date, 'DD.MM.YYYY') || ')' ELSE '' END;

  -- Istek: satici tarihten once "tamamlandi" dedi
  IF OLD.completion_requested_at IS NULL AND NEW.completion_requested_at IS NOT NULL
     AND NEW.status = 'confirmed' THEN
    v_body := v_satici_ad || ' işin tamamlandığını bildirdi — onayın bekleniyor: ' || v_baslik;
    IF NEW.customer_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM v_uid THEN
      INSERT INTO public.notifications (user_id, type, link, body)
      VALUES (NEW.customer_id, 'booking', v_link, v_body);
    END IF;
    IF NEW.buyer_organization_id IS NOT NULL THEN
      PERFORM public.fn_faz7b_notify_org(NEW.buyer_organization_id, 'events.view', v_link, v_body, 'booking',
                                         COALESCE(NEW.customer_id, v_uid));
    END IF;
    RETURN NEW;
  END IF;

  -- Onay: alici, saticinin istegini onayladi
  IF OLD.status = 'confirmed' AND NEW.status = 'completed'
     AND OLD.completion_requested_at IS NOT NULL
     AND v_uid IS NOT NULL
     AND v_uid IS DISTINCT FROM NEW.professional_id
     AND v_uid IS DISTINCT FROM NEW.seller_provider_id THEN
    v_body := 'Müşteri işin tamamlandığını onayladı: ' || v_baslik;
    IF v_satici_org IS NOT NULL THEN
      PERFORM public.fn_faz7b_notify_org(v_satici_org, 'proposals.view', v_link, v_body, 'booking', v_uid);
    ELSIF NEW.professional_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, link, body)
      VALUES (NEW.professional_id, 'booking', v_link, v_body);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_duz12_tamamlama_bildirimi ON public.bookings;
CREATE TRIGGER trg_duz12_tamamlama_bildirimi
  AFTER UPDATE OF completion_requested_at, status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.fn_duz12_tamamlama_bildirimi();

-- -----------------------------------------------------------------------------
-- 6) Yorum uygunlugu: tamamlanan is VEYA saticinin iptal ettigi is (12-G)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_duz03_tamamlanmis_rezervasyon_var(p_customer uuid, p_provider uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
     WHERE (b.status = 'completed'
            OR (b.status = 'cancelled'
                AND b.cancelled_by IS NOT NULL
                AND (b.cancelled_by = b.professional_id
                     OR b.cancelled_by = b.seller_provider_id
                     OR (b.proposal_version_id IS NOT NULL AND EXISTS (
                           SELECT 1 FROM public.proposal_versions pv
                           JOIN public.proposals p ON p.id = pv.proposal_id
                          WHERE pv.id = b.proposal_version_id
                            AND public.user_has_org_permission(b.cancelled_by, p.seller_organization_id, 'proposals.manage'))))))
       AND (b.customer_id = p_customer
            OR (b.buyer_organization_id IS NOT NULL
                AND b.buyer_organization_id IN (SELECT o.id FROM public.organizations o WHERE o.legacy_profile_id = p_customer)))
       AND (b.professional_id = p_provider OR b.seller_provider_id = p_provider));
$$;

-- -----------------------------------------------------------------------------
-- 7) Kamu profil takvimi: dolu gunler, kimliksiz (12-A)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.saglayici_dolu_gunler(p_provider uuid)
RETURNS date[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT b.event_date ORDER BY b.event_date), ARRAY[]::date[])
    FROM public.bookings b
   WHERE EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = p_provider AND pr.is_published)
     AND (b.professional_id = p_provider OR b.seller_provider_id = p_provider)
     AND b.status IN ('confirmed', 'completed')
     AND b.event_date IS NOT NULL
     AND b.event_date >= (now() AT TIME ZONE 'Europe/Istanbul')::date;
$$;

COMMENT ON FUNCTION public.saglayici_dolu_gunler(uuid) IS
  'Duzeltme 12: yayindaki saglayicinin rezervasyonlu gunleri (yalniz tarih; kamu profil takvimi).';

REVOKE ALL ON FUNCTION public.saglayici_dolu_gunler(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.saglayici_dolu_gunler(uuid) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8) Sistem satiri RPC'si: yeni talep, tamamlanma istegi / onayi (12-B, 12-F)
--    Guvenlik 05 surumunun ustune; eski turler aynen.
--
--    Talep sayaci kurali: sohbetin GUNCEL talebine teklif verilmisse (geri
--    cekilen haric; bekleyen, kabul, red, suresi dolan) yeni brief /
--    rezervasyon talebi / teklif topla talebi YENI talep sayilir (sayac
--    artar). Teklif yoksa ayni talebin guncellemesidir (kart yazilmaz).
--    Boylece ikinci isin teklifi, birinci isin kabulunde reddedilmez.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_duz12_talep_yanitlandi(p_sohbet uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.conversations c ON c.id = q.conversation_id
   WHERE q.conversation_id = p_sohbet
     AND q.request_no = c.request_count
     AND q.status <> 'withdrawn');
$$;

REVOKE ALL ON FUNCTION public.fn_duz12_talep_yanitlandi(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_duz12_talep_yanitlandi(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sistem_mesaji_ekle(
  p_sohbet uuid,
  p_tur text,
  p_kayit uuid DEFAULT NULL,
  p_metin text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ben uuid := auth.uid();
  v_sohbet public.conversations%ROWTYPE;
  v_govde text;
  v_zaman timestamptz;
  v_id uuid;
  v_tur_adi text;
  v_sayac integer;
  b record;
BEGIN
  IF v_ben IS NULL THEN
    RAISE EXCEPTION 'Oturum gerekli' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sohbet FROM public.conversations WHERE id = p_sohbet;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sohbet bulunamadi' USING ERRCODE = '42501';
  END IF;

  -- Mesaj ekleme kuraliyla ayni: taraf ya da musteri kurumunun yoneticisi
  IF NOT (v_sohbet.customer_id = v_ben
          OR v_sohbet.professional_id = v_ben
          OR public.has_business_role(v_sohbet.customer_id, 'manager'::public.business_member_role)) THEN
    RAISE EXCEPTION 'Bu sohbete yazma yetkin yok' USING ERRCODE = '42501';
  END IF;

  IF p_tur = 'basvuru_kabul' THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.applications a
        JOIN public.listings l ON l.id = a.listing_id
       WHERE a.id = p_kayit
         AND a.status = 'accepted'
         AND l.creator_id = v_sohbet.customer_id
         AND a.applicant_id = v_sohbet.professional_id
         AND (l.creator_id = v_ben
              OR public.has_business_role(l.creator_id, 'manager'::public.business_member_role))
    ) THEN
      RAISE EXCEPTION 'Kabul edilmis basvuru bulunamadi' USING ERRCODE = '42501';
    END IF;
    v_govde := 'Başvurun kabul edildi. Detayları buradan konuşabilirsiniz.';
    v_zaman := NULL;

  ELSIF p_tur IN ('rezervasyon_iptal', 'rezervasyon_tamam', 'tamamlama_talebi') THEN
    SELECT id, status, customer_id, professional_id, cancelled_by, cancelled_at, completed_at,
           completion_requested_at, completion_requested_by
      INTO b
      FROM public.bookings
     WHERE id = p_kayit AND conversation_id = p_sohbet;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rezervasyon bulunamadi' USING ERRCODE = '42501';
    END IF;

    IF p_tur = 'rezervasyon_iptal' THEN
      IF b.status <> 'cancelled' OR b.cancelled_by IS DISTINCT FROM v_ben
         OR NOT (v_ben = b.customer_id OR v_ben = b.professional_id) THEN
        RAISE EXCEPTION 'Iptal kaydi dogrulanamadi' USING ERRCODE = '42501';
      END IF;
      v_govde := CASE WHEN v_ben = b.customer_id
                      THEN 'Müşteri rezervasyonu iptal etti'
                      ELSE 'Profesyonel rezervasyonu iptal etti' END;
      v_zaman := b.cancelled_at;
    ELSIF p_tur = 'tamamlama_talebi' THEN
      -- Satici, tarihten once tamamlanma onayi istedi.
      IF b.status <> 'confirmed' OR b.completion_requested_at IS NULL
         OR b.completion_requested_by IS DISTINCT FROM v_ben THEN
        RAISE EXCEPTION 'Tamamlanma istegi dogrulanamadi' USING ERRCODE = '42501';
      END IF;
      v_govde := 'Profesyonel işin tamamlandığını bildirdi — onayını bekliyor';
      v_zaman := b.completion_requested_at;
    ELSE
      -- rezervasyon_tamam: satici dogrudan ya da alici onayiyla
      IF b.status <> 'completed' THEN
        RAISE EXCEPTION 'Tamamlama kaydi dogrulanamadi' USING ERRCODE = '42501';
      END IF;
      IF b.professional_id IS NOT DISTINCT FROM v_ben THEN
        v_govde := 'Profesyonel işi tamamlandı olarak işaretledi';
      ELSIF b.customer_id IS NOT DISTINCT FROM v_ben AND b.completion_requested_at IS NOT NULL THEN
        v_govde := 'Müşteri işin tamamlandığını onayladı';
      ELSE
        RAISE EXCEPTION 'Tamamlama kaydi dogrulanamadi' USING ERRCODE = '42501';
      END IF;
      v_zaman := b.completed_at;
    END IF;

  ELSIF p_tur = 'rezervasyon_talebi' THEN
    IF NOT (v_sohbet.customer_id = v_ben
            OR public.has_business_role(v_sohbet.customer_id, 'manager'::public.business_member_role)) THEN
      RAISE EXCEPTION 'Rezervasyon talebini yalniz musteri tarafi yazar' USING ERRCODE = '42501';
    END IF;
    IF p_metin IS NULL
       OR left(p_metin, length('📅 Rezervasyon talebi — Tarih: ')) <> '📅 Rezervasyon talebi — Tarih: '
       OR length(p_metin) > 500 THEN
      RAISE EXCEPTION 'Gecersiz rezervasyon talebi metni' USING ERRCODE = '22023';
    END IF;
    -- Onceki talep teklif aldiysa bu yeni bir talep (sayac artar, kart ayni).
    IF public.fn_duz12_talep_yanitlandi(p_sohbet) THEN
      UPDATE public.conversations SET request_count = request_count + 1 WHERE id = p_sohbet;
    END IF;
    v_govde := p_metin;
    v_zaman := NULL;

  ELSIF p_tur IN ('yeni_talep', 'teklif_topla') THEN
    -- yeni_talep: musteri tarafi ayni sohbete yeni brief gonderdi.
    -- teklif_topla: profesyonel, musterinin teklif topla talebine (p_kayit =
    -- quote_requests.id) bu sohbetten yanit veriyor.
    -- Onceki talep teklif aldiysa sayac artar ve kart yazilir; yoksa ayni
    -- talebin guncellemesidir, kart yazilmaz (NULL doner).
    IF p_tur = 'yeni_talep' THEN
      IF NOT (v_sohbet.customer_id = v_ben
              OR public.has_business_role(v_sohbet.customer_id, 'manager'::public.business_member_role)) THEN
        RAISE EXCEPTION 'Yeni talebi yalniz musteri tarafi acar' USING ERRCODE = '42501';
      END IF;
    ELSE
      IF v_sohbet.professional_id IS DISTINCT FROM v_ben OR NOT EXISTS (
           SELECT 1
             FROM public.quote_request_recipients r
             JOIN public.quote_requests qr ON qr.id = r.request_id
            WHERE r.request_id = p_kayit
              AND r.professional_id = v_ben
              AND qr.customer_id = v_sohbet.customer_id) THEN
        RAISE EXCEPTION 'Teklif topla talebi dogrulanamadi' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF NOT public.fn_duz12_talep_yanitlandi(p_sohbet) THEN
      RETURN NULL;
    END IF;
    UPDATE public.conversations
       SET request_count = request_count + 1
     WHERE id = p_sohbet
     RETURNING request_count INTO v_sayac;
    SELECT et.name_tr INTO v_tur_adi FROM public.event_types et WHERE et.key = v_sohbet.event_type;
    v_govde := 'Yeni talep #' || v_sayac::text
               || CASE WHEN p_tur = 'teklif_topla' THEN ' · Teklif topla' ELSE '' END
               || COALESCE(' · ' || v_tur_adi, '')
               || CASE WHEN v_sohbet.event_date IS NOT NULL
                       THEN ' · ' || to_char(v_sohbet.event_date, 'DD.MM.YYYY')
                       ELSE ' · Tarih belli değil' END
               || COALESCE(' · ' || NULLIF(btrim(v_sohbet.location), ''), '');
    v_zaman := NULL;

  ELSE
    RAISE EXCEPTION 'Bilinmeyen sistem mesaji turu' USING ERRCODE = '22023';
  END IF;

  -- Ayni olay icin ikinci satir yazilmaz
  IF v_zaman IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.messages m
        WHERE m.conversation_id = p_sohbet
          AND m.message_type = 'system'
          AND m.body = v_govde
          AND m.created_at >= v_zaman - interval '1 minute') THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, body, message_type)
  VALUES (p_sohbet, v_ben, v_govde, 'system')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9) Son dogrulama
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'request_no') THEN
    RAISE EXCEPTION 'Duzeltme 12: quotes.request_no yok';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.quotes'::regclass AND tgname = 'trg_duz12_teklif_ekleme') THEN
    RAISE EXCEPTION 'Duzeltme 12: teklif ekleme tetikleyicisi yok';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.quotes'::regclass AND tgname = 'trg_duz12_kabul_bildirimi') THEN
    RAISE EXCEPTION 'Duzeltme 12: kabul bildirimi tetikleyicisi yok';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.conversations'::regclass AND tgname = 'trg_duz12_sohbet_ekleme') THEN
    RAISE EXCEPTION 'Duzeltme 12: sohbet ekleme tetikleyicisi yok';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.bookings'::regclass AND tgname = 'trg_duz12_tamamlama_bildirimi') THEN
    RAISE EXCEPTION 'Duzeltme 12: tamamlama bildirimi tetikleyicisi yok';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.bookings', 'completion_requested_at', 'UPDATE') THEN
    RAISE EXCEPTION 'Duzeltme 12: completion_requested_at yazma yetkisi yok';
  END IF;
  IF has_column_privilege('authenticated', 'public.bookings', 'completion_requested_by', 'UPDATE') THEN
    RAISE EXCEPTION 'Duzeltme 12: completion_requested_by istemciye acik olmamali';
  END IF;
  IF NOT has_function_privilege('anon', 'public.saglayici_dolu_gunler(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Duzeltme 12: dolu gun RPC girissize kapali';
  END IF;
END;
$$;
