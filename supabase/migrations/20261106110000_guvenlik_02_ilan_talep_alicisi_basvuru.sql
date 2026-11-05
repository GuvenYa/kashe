-- =============================================================================
-- GUVENLIK 02 - ilan onay akisi, teklif topla alicisi, basvuru ekleme (bulgu 87)
--
-- Bulgu (5 Kasim 2026, Guvenlik 01 sonrasi tarama, yerel test veritabani):
--   1. listings   ilan sahibi PostgREST'e dogrudan istekle onay beklemeden
--                 ilanini 'published' yapabiliyor ya da dogrudan 'published'
--                 ekleyebiliyordu (admin onayi atlanir); yayin tarihini ileri
--                 atip listede hep ustte kalabiliyor, one cikarma alanlarini
--                 (acil / kategori / ana sayfa) sinirsiz sureyle, onaysiz ilanda
--                 bile acabiliyor, goruntulenme sayisini yazabiliyordu.
--                 Ayrica: ziyaretci goruntulenmesi HIC sayilmiyordu (RLS yalniz
--                 sahibe guncelleme izni veriyor; sahibin kendi ziyareti zaten
--                 sayilmiyor) - artik RPC ile sayilir.
--   2. quote_request_recipients  profesyonel kendi alici satirini BASKA bir
--                 talebe tasiyip o talebi (brief, butce, ek) okuyabiliyor;
--                 teklif vermeden 'quoted' isaretleyip sohbet bagini baska bir
--                 sohbete cevirebiliyordu.
--   3. applications  basvuran basvuruyu dogrudan 'accepted' / 'shortlisted'
--                 olarak ekleyebiliyordu (Guvenlik 01 yalniz guncellemeyi
--                 kapatmisti).
--
-- Cozum: Guvenlik 01 ile ayni kalip - yazma yetkisi yalniz uygulamanin yazdigi
-- sutunlara daraltilir, durum gecisleri BEFORE tetikleyicide dogrulanir.
-- Sistem (auth.uid() bos) ve yonetici (is_admin) serbesttir. Uygulamanin
-- mesru akislari DEGISMEZ: taslak / onaya gonder / duzenle / kapat / iptal /
-- geri al / basvuru kabul (dolu) / yeniden ac / one cikarma simulasyonu
-- (7 gun) / admin onay-ret-revizyon; teklif topla: goruldu / reddet / teklif.
-- Kontrol: docs/envanter/asama26-guvenlik02-kontrol.sql (yapi),
-- asama26b-guvenlik02-davranis.sql (davranis, YALNIZ dal).
--
-- Bilincli olarak DISARIDA (urun karari, bulgu 87 notu): yayindaki ilanin
-- icerik duzenlemesi yeniden onaya dusmuyor (uygulamanin bugunku tasarimi).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) LISTINGS - yazma sutunlari
-- -----------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON public.listings FROM anon;
REVOKE INSERT, UPDATE ON public.listings FROM authenticated;

-- createListing'in yazdigi sutunlar (diger sutunlar varsayilanla dolar)
GRANT INSERT (creator_id, created_by, category_id, title, description, requirements,
              project_details, work_conditions, event_date, event_type, location,
              city_id, guest_count, budget_min, budget_max, currency,
              application_deadline, allowed_applicant_roles, status, event_id)
  ON public.listings TO authenticated;

-- updateListing + durum eylemleri + one cikarma + admin onay (published_at)
GRANT UPDATE (title, description, requirements, project_details, work_conditions,
              event_date, event_type, location, city_id, guest_count, budget_min,
              budget_max, application_deadline, allowed_applicant_roles,
              category_id, status, approval_note, published_at, is_urgent,
              urgent_until, featured_category_until, featured_home_until)
  ON public.listings TO authenticated;

-- -----------------------------------------------------------------------------
-- 2) LISTINGS - durum ve alan kurallari
--
-- "Onayli" durumlar (published / closed / filled) yalniz birbirinden ya da
-- yonetici onayindan gelir; onaysiz durumlardan (draft / pending_approval /
-- revision / rejected / cancelled) onayliya sahibin gecisi YOK.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guv02_ilan_gecis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  -- one cikarma simulasyonu en fazla 14 gun (daysFromNow 3 / 7 / 14) + pay
  v_ust timestamptz := now() + interval '14 days 1 hour';
  v_acilis boolean;
BEGIN
  IF v_uid IS NULL OR public.is_admin(v_uid) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'pending_approval') THEN
      RAISE EXCEPTION 'Yeni ilan yalniz taslak ya da onaya gonderilmis olarak eklenir.'
        USING ERRCODE = '42501';
    END IF;
    NEW.created_by := v_uid;
    NEW.is_urgent := false;
    NEW.urgent_until := NULL;
    NEW.featured_category_until := NULL;
    NEW.featured_home_until := NULL;
    NEW.views_count := 0;
    NEW.approval_note := NULL;
    NEW.published_at := NULL;
    NEW.expires_at := NULL;
    NEW.notified_at := NULL;
    RETURN NEW;
  END IF;

  -- ---- UPDATE
  IF NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Ilanin sahibi degistirilemez.' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
         (NEW.status = 'pending_approval' AND OLD.status IN ('draft', 'revision', 'rejected'))
      OR (NEW.status = 'draft'     AND OLD.status = 'cancelled')
      OR (NEW.status = 'cancelled')
      OR (NEW.status = 'closed'    AND OLD.status = 'published')
      OR (NEW.status = 'filled'    AND OLD.status IN ('published', 'closed'))
      OR (NEW.status = 'published' AND OLD.status = 'filled')
    ) THEN
      RAISE EXCEPTION 'Ilan durumu % -> % yalniz yonetici onayiyla degisir.', OLD.status, NEW.status
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Onay notunu yalniz yonetici yazar; sahip yeniden gonderirken temizler
  IF NEW.approval_note IS DISTINCT FROM OLD.approval_note AND NEW.approval_note IS NOT NULL THEN
    RAISE EXCEPTION 'Onay notunu yalniz yonetici yazar.' USING ERRCODE = '42501';
  END IF;

  -- Yayin tarihi yalniz yayina gecis aninda (set_listing_published_at) degisir
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    NEW.published_at := now();
  ELSIF NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'Yayin tarihi degistirilemez.' USING ERRCODE = '42501';
  END IF;

  -- One cikarma: kapatmak serbest; acmak / uzatmak yalniz yayindaki ilanda, en fazla 14 gun
  v_acilis :=
       (NEW.is_urgent AND (OLD.is_urgent IS NOT TRUE OR NEW.urgent_until IS DISTINCT FROM OLD.urgent_until))
    OR (NEW.featured_category_until IS NOT NULL AND NEW.featured_category_until IS DISTINCT FROM OLD.featured_category_until)
    OR (NEW.featured_home_until IS NOT NULL AND NEW.featured_home_until IS DISTINCT FROM OLD.featured_home_until);
  IF v_acilis THEN
    IF NEW.status NOT IN ('published', 'filled') THEN
      RAISE EXCEPTION 'Yalniz yayindaki ilan one cikarilir.' USING ERRCODE = '42501';
    END IF;
    IF (NEW.is_urgent AND (NEW.urgent_until IS NULL OR NEW.urgent_until > v_ust))
       OR NEW.featured_category_until > v_ust
       OR NEW.featured_home_until > v_ust THEN
      RAISE EXCEPTION 'One cikarma en fazla 14 gun.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guv02_ilan_gecis ON public.listings;
CREATE TRIGGER trg_guv02_ilan_gecis
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.fn_guv02_ilan_gecis();

-- -----------------------------------------------------------------------------
-- 3) LISTINGS - goruntulenme sayaci (RPC)
--
-- Ziyaretci (girissiz dahil) yalniz bu fonksiyonla +1 yazar; sahip ve kurum
-- uyesi sayilmaz; yalniz yayindaki / dolu / kapali ilan. Sayac guncellemesi
-- updated_at'i oynatmaz (/ilanlarim siralamasi "son guncellenen").
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ilan_goruntulenme_artir(p_ilan uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  UPDATE public.listings l
     SET views_count = COALESCE(l.views_count, 0) + 1
   WHERE l.id = p_ilan
     AND l.status IN ('published', 'filled', 'closed')
     AND (v_uid IS NULL
          OR (l.creator_id <> v_uid AND NOT public.has_business_role(l.creator_id, 'member')));
END;
$$;

REVOKE ALL ON FUNCTION public.ilan_goruntulenme_artir(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ilan_goruntulenme_artir(uuid) TO anon, authenticated;

DROP TRIGGER IF EXISTS listings_set_updated_at ON public.listings;
CREATE TRIGGER listings_set_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  WHEN (OLD.views_count IS NOT DISTINCT FROM NEW.views_count)
  EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4) QUOTE_REQUEST_RECIPIENTS - alici satiri
-- -----------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON public.quote_request_recipients FROM anon;
REVOKE INSERT, UPDATE ON public.quote_request_recipients FROM authenticated;
GRANT INSERT (request_id, professional_id, status) ON public.quote_request_recipients TO authenticated;
GRANT UPDATE (status, conversation_id, responded_at) ON public.quote_request_recipients TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_guv02_talep_alici_gecis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_musteri uuid;
BEGIN
  IF v_uid IS NULL OR public.is_admin(v_uid) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'sent';
    NEW.conversation_id := NULL;
    NEW.responded_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
    RAISE EXCEPTION 'Alici satiri baska talebe ya da kisiye tasinamaz.' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
         (OLD.status = 'sent' AND NEW.status = 'viewed')
      OR (OLD.status IN ('sent', 'viewed') AND NEW.status IN ('declined', 'quoted'))
    ) THEN
      RAISE EXCEPTION 'Talep durumu % -> % olamaz.', OLD.status, NEW.status USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR (NEW.status = 'quoted' AND OLD.status IS DISTINCT FROM 'quoted') THEN
    IF NEW.status <> 'quoted' OR NEW.conversation_id IS NULL THEN
      RAISE EXCEPTION 'Sohbet bagi yalniz teklifle kurulur.' USING ERRCODE = '42501';
    END IF;
    SELECT q.customer_id INTO v_musteri FROM public.quote_requests q WHERE q.id = OLD.request_id;
    IF NOT EXISTS (
         SELECT 1 FROM public.conversations c
          WHERE c.id = NEW.conversation_id
            AND c.professional_id = OLD.professional_id
            AND c.customer_id = v_musteri)
       OR NOT EXISTS (
         SELECT 1 FROM public.quotes qt
          WHERE qt.conversation_id = NEW.conversation_id
            AND qt.sender_id = OLD.professional_id) THEN
      RAISE EXCEPTION 'Teklif bu talebin musterisiyle olan sohbette olmali.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guv02_talep_alici_gecis ON public.quote_request_recipients;
CREATE TRIGGER trg_guv02_talep_alici_gecis
  BEFORE INSERT OR UPDATE ON public.quote_request_recipients
  FOR EACH ROW EXECUTE FUNCTION public.fn_guv02_talep_alici_gecis();

-- -----------------------------------------------------------------------------
-- 5) APPLICATIONS - ekleme her zaman 'pending' (guncelleme Guvenlik 01'de)
-- -----------------------------------------------------------------------------
REVOKE INSERT ON public.applications FROM anon;

CREATE OR REPLACE FUNCTION public.fn_guv02_basvuru_ekleme()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR public.is_admin(v_uid) THEN
    RETURN NEW;
  END IF;
  NEW.status := 'pending';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guv02_basvuru_ekleme ON public.applications;
CREATE TRIGGER trg_guv02_basvuru_ekleme
  BEFORE INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.fn_guv02_basvuru_ekleme();

-- -----------------------------------------------------------------------------
-- 6) Dogrulama: beklenmeyen yazma yetkisi kalmadi
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_fazla text;
BEGIN
  SELECT string_agg(grantee || ':' || privilege_type || ':' || table_name || '.' || column_name, ', '
                    ORDER BY grantee, privilege_type, table_name, column_name)
    INTO v_fazla
    FROM information_schema.column_privileges
   WHERE table_schema = 'public'
     AND grantee IN ('anon', 'authenticated')
     AND privilege_type IN ('INSERT', 'UPDATE')
     AND table_name IN ('listings', 'quote_request_recipients')
     AND NOT (grantee = 'authenticated' AND (privilege_type, table_name, column_name) IN (
       ('INSERT', 'listings', 'creator_id'), ('INSERT', 'listings', 'created_by'),
       ('INSERT', 'listings', 'category_id'), ('INSERT', 'listings', 'title'),
       ('INSERT', 'listings', 'description'), ('INSERT', 'listings', 'requirements'),
       ('INSERT', 'listings', 'project_details'), ('INSERT', 'listings', 'work_conditions'),
       ('INSERT', 'listings', 'event_date'), ('INSERT', 'listings', 'event_type'),
       ('INSERT', 'listings', 'location'), ('INSERT', 'listings', 'city_id'),
       ('INSERT', 'listings', 'guest_count'), ('INSERT', 'listings', 'budget_min'),
       ('INSERT', 'listings', 'budget_max'), ('INSERT', 'listings', 'currency'),
       ('INSERT', 'listings', 'application_deadline'), ('INSERT', 'listings', 'allowed_applicant_roles'),
       ('INSERT', 'listings', 'status'), ('INSERT', 'listings', 'event_id'),
       ('UPDATE', 'listings', 'title'), ('UPDATE', 'listings', 'description'),
       ('UPDATE', 'listings', 'requirements'), ('UPDATE', 'listings', 'project_details'),
       ('UPDATE', 'listings', 'work_conditions'), ('UPDATE', 'listings', 'event_date'),
       ('UPDATE', 'listings', 'event_type'), ('UPDATE', 'listings', 'location'),
       ('UPDATE', 'listings', 'city_id'), ('UPDATE', 'listings', 'guest_count'),
       ('UPDATE', 'listings', 'budget_min'), ('UPDATE', 'listings', 'budget_max'),
       ('UPDATE', 'listings', 'application_deadline'), ('UPDATE', 'listings', 'allowed_applicant_roles'),
       ('UPDATE', 'listings', 'category_id'), ('UPDATE', 'listings', 'status'),
       ('UPDATE', 'listings', 'approval_note'), ('UPDATE', 'listings', 'published_at'),
       ('UPDATE', 'listings', 'is_urgent'), ('UPDATE', 'listings', 'urgent_until'),
       ('UPDATE', 'listings', 'featured_category_until'), ('UPDATE', 'listings', 'featured_home_until'),
       ('INSERT', 'quote_request_recipients', 'request_id'),
       ('INSERT', 'quote_request_recipients', 'professional_id'),
       ('INSERT', 'quote_request_recipients', 'status'),
       ('UPDATE', 'quote_request_recipients', 'status'),
       ('UPDATE', 'quote_request_recipients', 'conversation_id'),
       ('UPDATE', 'quote_request_recipients', 'responded_at')));
  IF v_fazla IS NOT NULL THEN
    RAISE EXCEPTION 'Guvenlik 02: beklenmeyen yazma yetkisi kaldi: %', v_fazla;
  END IF;
END $$;
