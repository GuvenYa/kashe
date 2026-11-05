-- =============================================================================
-- GUVENLIK 01 - alan duzeyi yazma yetkisi ve durum gecisleri (bulgu 86)
--
-- Bulgu (5 Kasim 2026, yerel test veritabani, uretim semasiyla ayni): birkac
-- tabloda RLS "kim yazabilir" diyor ama "hangi alani / hangi gecisi" demiyordu.
-- Uygulama bu alanlara dokunmadigi icin normal kullanimda gorunmuyor; oturum
-- acmis herkes PostgREST'e dogrudan istekle yapabiliyordu:
--   1. quotes        musteri bekleyen teklifin tutarini degistirip kabul ediyor
--                    (3.000 TL -> 1 TL, rezervasyon 1 TL acildi); profesyonel
--                    kabul edilmis teklifi degistirebiliyor; teklif 'accepted'
--                    olarak eklenebiliyor.
--   2. bookings      musteri kendi rezervasyonunu 'completed' yapiyor (yorum
--                    hakki acilir); bitmis / iptal rezervasyon geri aciliyor.
--   3. messages      alici, karsi tarafin mesajinin metnini / gondericisini /
--                    ekini degistirebiliyor (sahte "teklifi kabul ediyorum").
--   4. conversations taraflardan biri sohbetin musterisini / profesyonelini
--                    degistirip sohbeti baska birine tasiyabiliyor.
--   5. reviews       musteri yorumunu baska bir profesyonele tasiyabiliyor
--                    (rezervasyonu olmayan rakibe 1 yildiz).
--   6. review_replies yanit baska bir yoruma tasinabiliyor.
--   7. applications  basvuran kendi basvurusunu 'accepted' yapabiliyor, baska
--                    ilana tasiyabiliyor; ilan sahibi basvurunun metnini / teklif
--                    tutarini degistirebiliyor.
--
-- Cozum: (a) UPDATE yetkisi yalniz uygulamanin gercekten yazdigi sutunlara
-- daraltilir (GRANT sutun listesi); (b) durum gecisleri BEFORE tetikleyicide
-- dogrulanir. Sistem (auth.uid() bos: cron, servis anahtari, SQL) ve yonetici
-- (is_admin) serbesttir. Uygulamanin mesru akislari DEGISMEZ (kabul / ret /
-- geri cekme / iptal / tamamlama / okundu / brief guncelleme / yorum duzenleme /
-- basvuru durumlari) - bkz. docs/envanter/asama25-guvenlik01-kontrol.sql.
--
-- Kapsam disi (ayri is, bulgu 86 notu): listings durum / one cikarma alanlari
-- (ilan sahibi onay beklemeden 'published' yapabiliyor) - ilan onay akisi ile
-- birlikte ele alinacak.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) QUOTES - yalniz durum yazilir; gecisler dogrulanir; ekleme 'pending'
-- -----------------------------------------------------------------------------
REVOKE UPDATE ON public.quotes FROM anon, authenticated;
GRANT UPDATE (status) ON public.quotes TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_guv01_teklif_gecis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_musteri uuid;
  v_pro uuid;
BEGIN
  -- Sistem (cron / servis anahtari / SQL) ve yonetici serbest.
  IF v_uid IS NULL OR public.is_admin(v_uid) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Yeni teklif her zaman bekleyen olarak dogar.
    NEW.status := 'pending';
    NEW.responded_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Teklif "%" durumunda; durumu degistirilemez.', OLD.status
      USING ERRCODE = '42501';
  END IF;

  SELECT c.customer_id, c.professional_id INTO v_musteri, v_pro
    FROM public.conversations c WHERE c.id = OLD.conversation_id;

  IF NEW.status IN ('accepted', 'declined') THEN
    IF NOT (v_uid IS NOT DISTINCT FROM v_musteri
            OR (v_musteri IS NOT NULL AND public.has_business_role(v_musteri, 'manager'))) THEN
      RAISE EXCEPTION 'Teklifi yalniz musteri kabul eder ya da reddeder.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'accepted' AND OLD.expires_at IS NOT NULL AND OLD.expires_at <= now() THEN
      RAISE EXCEPTION 'Teklifin suresi dolmus; kabul edilemez.'
        USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.status = 'withdrawn' THEN
    IF NOT (v_uid IS NOT DISTINCT FROM v_pro
            OR v_uid IS NOT DISTINCT FROM OLD.sender_id
            OR public.is_assignee(OLD.conversation_id, v_uid)) THEN
      RAISE EXCEPTION 'Teklifi yalniz gonderen taraf geri ceker.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.status = 'expired' THEN
    IF OLD.expires_at IS NULL OR OLD.expires_at > now() THEN
      RAISE EXCEPTION 'Suresi dolmamis teklif "expired" yapilamaz.'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Gecersiz teklif durumu: %', NEW.status
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guv01_teklif_gecis ON public.quotes;
CREATE TRIGGER trg_guv01_teklif_gecis
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.fn_guv01_teklif_gecis();

-- -----------------------------------------------------------------------------
-- 2) BOOKINGS - sutun yetkisi zaten dar (status + iptal / tamamlama alanlari);
--    gecisler dogrulanir: yalniz 'confirmed' degisir; tamamlamayi yalniz
--    satici taraf yapar; iptali iki taraf yapar ve iptal eden damgalanir.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guv01_rezervasyon_gecis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_satici boolean := false;
  v_alici boolean := false;
  v_org uuid;
BEGIN
  IF v_uid IS NULL OR public.is_admin(v_uid) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    -- Durum degismeden iptal / tamamlama damgalari elle oynanmaz.
    IF NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
       OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
       OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
      RAISE EXCEPTION 'Iptal / tamamlama bilgisi durum degismeden degistirilemez.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Rezervasyon "%" durumunda; durumu degistirilemez.', OLD.status
      USING ERRCODE = '42501';
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

  IF NEW.status = 'completed' THEN
    IF NOT v_satici THEN
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

DROP TRIGGER IF EXISTS trg_guv01_rezervasyon_gecis ON public.bookings;
CREATE TRIGGER trg_guv01_rezervasyon_gecis
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.fn_guv01_rezervasyon_gecis();

-- -----------------------------------------------------------------------------
-- 3) MESSAGES - alici yalniz "okundu" yazar
-- -----------------------------------------------------------------------------
REVOKE UPDATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) CONVERSATIONS - taraflar yalniz talep / brief alanlarini gunceller
--    (kimlik, taraflar, olusma zamani ve son mesaj zamani DEGISMEZ;
--    son mesaj zamanini SECURITY DEFINER tetikleyici yazar)
-- -----------------------------------------------------------------------------
REVOKE UPDATE ON public.conversations FROM anon, authenticated;
GRANT UPDATE (event_date, event_type, location, guest_count, budget_range,
              brief_data, start_time, end_time, request_type, event_id)
  ON public.conversations TO authenticated;

-- -----------------------------------------------------------------------------
-- 5) REVIEWS - musteri yalniz puan / metin duzenler (yorum tasinmaz)
-- -----------------------------------------------------------------------------
REVOKE UPDATE ON public.reviews FROM anon, authenticated;
GRANT UPDATE (rating, body, created_by) ON public.reviews TO authenticated;

-- -----------------------------------------------------------------------------
-- 6) REVIEW_REPLIES - profesyonel yalniz yanit metnini duzenler
-- -----------------------------------------------------------------------------
REVOKE UPDATE ON public.review_replies FROM anon, authenticated;
GRANT UPDATE (body) ON public.review_replies TO authenticated;

-- -----------------------------------------------------------------------------
-- 7) APPLICATIONS - yalniz durum yazilir; basvuran yalniz geri ceker,
--    ilan sahibi (ya da kurum yoneticisi) degerlendirir
-- -----------------------------------------------------------------------------
REVOKE UPDATE ON public.applications FROM anon, authenticated;
GRANT UPDATE (status) ON public.applications TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_guv01_basvuru_gecis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sahip boolean;
BEGIN
  IF v_uid IS NULL OR public.is_admin(v_uid) THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.listings l
     WHERE l.id = OLD.listing_id
       AND (l.creator_id = v_uid OR public.has_business_role(l.creator_id, 'manager'))
  ) INTO v_sahip;

  IF NEW.status = 'withdrawn' THEN
    IF NOT (OLD.applicant_id = v_uid AND OLD.status IN ('pending', 'shortlisted')) THEN
      RAISE EXCEPTION 'Basvuruyu yalniz basvuran, degerlendirme bitmeden geri ceker.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.status IN ('pending', 'shortlisted', 'accepted', 'rejected') THEN
    IF NOT v_sahip OR OLD.status = 'withdrawn' THEN
      RAISE EXCEPTION 'Basvuruyu yalniz ilan sahibi degerlendirir.'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Gecersiz basvuru durumu: %', NEW.status
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guv01_basvuru_gecis ON public.applications;
CREATE TRIGGER trg_guv01_basvuru_gecis
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.fn_guv01_basvuru_gecis();

-- -----------------------------------------------------------------------------
-- Dogrulama (migration icinde): yetki listesi beklenen sekilde mi?
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_fazla text;
BEGIN
  SELECT string_agg(table_name || '.' || column_name, ', ' ORDER BY table_name, column_name)
    INTO v_fazla
    FROM information_schema.column_privileges
   WHERE table_schema = 'public'
     AND grantee IN ('anon', 'authenticated')
     AND privilege_type = 'UPDATE'
     AND (table_name, column_name) NOT IN (
       ('quotes', 'status'),
       ('messages', 'read_at'),
       ('conversations', 'event_date'), ('conversations', 'event_type'), ('conversations', 'location'),
       ('conversations', 'guest_count'), ('conversations', 'budget_range'), ('conversations', 'brief_data'),
       ('conversations', 'start_time'), ('conversations', 'end_time'), ('conversations', 'request_type'),
       ('conversations', 'event_id'),
       ('reviews', 'rating'), ('reviews', 'body'), ('reviews', 'created_by'),
       ('review_replies', 'body'),
       ('applications', 'status'))
     AND table_name IN ('quotes', 'messages', 'conversations', 'reviews', 'review_replies', 'applications');
  IF v_fazla IS NOT NULL THEN
    RAISE EXCEPTION 'Guvenlik 01: beklenmeyen UPDATE yetkisi kaldi: %', v_fazla;
  END IF;
END $$;
