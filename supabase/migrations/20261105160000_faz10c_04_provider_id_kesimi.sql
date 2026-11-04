-- =============================================================================
-- FAZ 10c-2 / 04 - provider_id kesimi (5 Kasim 2026). 10c-1 (01 + 02 + 02b + 03) uretimde iken.
-- Kaynak: docs/envanter/38-faz10-temizlik.md bolum 10c (10c-2 / DB/02).
--   Bes tabloda sahip kimligi iki sutunda: eski (services / portfolio_items / profile_experiences: profile_id; reviews /
--   favorites: professional_id) ve yeni provider_id (FAZ 2b, BEFORE tetikleyiciyle eskiden turetilir). Bu dosya:
--   1) Tetikleyici IKI YONLU olur: istemci yalniz provider_id gonderirse eski sutun ondan dolar (P2 sonrasi uygulama);
--      eski sutun gonderilirse provider_id bugunku gibi ondan turetilir (eski uygulama). Kimlikler birebir ayni (FAZ 2a:
--      providers.id = profiles.id). Tek gercek eski sutun kalir - istemcinin verdigi farkli provider_id EZILIR; RLS (eski
--      sutun = auth.uid()) tetikleyiciden SONRA denetlendigi icin baskasi adina satir acilamaz. Sahip saglayici degilse
--      (musteri / isletme) acik hata 42501 (eskiden provider_id bos kalirdi; uretimde boyle satir 0 - faz10c2-on-kontrol).
--   2) provider_id NOT NULL (once bos / uyusmaz / saglayici olmayan sahip 0 dogrulanir, RAISE); yabanci anahtar
--      ON DELETE SET NULL -> CASCADE (eski sahip anahtariyla ayni davranis).
--   3) Yeni sutunla sorgular icin indeksler: favorites (user_id, provider_id) TEKIL (upsert hedefi), reviews (provider_id,
--      created_at DESC), profile_experiences (provider_id, kind, sort_order). Eski indeksler eski sutunlar durdukca kalir.
--   4) profiles.category_attributes GIN indeksi duser (kopya; containment sorgulari v_providers_public -> providers'tan).
--   Deploy: eski uygulama aynen calisir (eski sutunu gonderiyor) -> uretime P2'den ONCE gidebilir. Eski sutunlar ve RLS
--   politikalari FAZ 11'e kadar kalir.
--   Geri alma: fn_faz2b_set_provider_id_from_* govdeleri (20260920180200_faz2b_03), DROP NOT NULL, FK SET NULL, yeni indeksler.
-- Kontrol: asama20 K10. Test: asama4 T40.
-- =============================================================================

DO $$
DECLARE r record; v_sorun text := '';
BEGIN
  FOR r IN
    WITH t AS (
      SELECT 'services' AS tablo, provider_id, profile_id AS sahip FROM public.services
      UNION ALL SELECT 'portfolio_items', provider_id, profile_id FROM public.portfolio_items
      UNION ALL SELECT 'profile_experiences', provider_id, profile_id FROM public.profile_experiences
      UNION ALL SELECT 'reviews', provider_id, professional_id FROM public.reviews
      UNION ALL SELECT 'favorites', provider_id, professional_id FROM public.favorites
    )
    SELECT tablo,
           count(*) FILTER (WHERE provider_id IS NULL) AS bos,
           count(*) FILTER (WHERE provider_id IS NOT NULL AND provider_id <> sahip) AS uyusmaz,
           count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = t.sahip)) AS saglayici_degil
      FROM t GROUP BY tablo
  LOOP
    IF r.bos + r.uyusmaz + r.saglayici_degil > 0 THEN
      v_sorun := v_sorun || format(' %s: bos=%s uyusmaz=%s saglayici_degil=%s;', r.tablo, r.bos, r.uyusmaz, r.saglayici_degil);
    END IF;
  END LOOP;
  IF v_sorun <> '' THEN
    RAISE EXCEPTION 'FAZ 10c-2/04: provider_id kesimi oncesi veri sorunu:%', v_sorun;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1) Iki yonlu tetikleyiciler
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz2b_set_provider_id_from_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Yeni uygulama yalniz provider_id gonderir: eski sahip sutunu ondan dolar (kimlikler ayni).
  IF NEW.profile_id IS NULL AND NEW.provider_id IS NOT NULL THEN
    NEW.profile_id := NEW.provider_id;
  END IF;
  -- Tek gercek eski sutun: provider_id ondan turetilir, istemcinin verdigi farkli deger ezilir.
  IF NEW.profile_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = NEW.profile_id) THEN
    NEW.provider_id := NEW.profile_id;
  ELSIF NEW.profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'Bu kayit yalniz saglayici hesaplarinda acilabilir (%).', TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz2b_set_provider_id_from_professional()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.professional_id IS NULL AND NEW.provider_id IS NOT NULL THEN
    NEW.professional_id := NEW.provider_id;
  END IF;
  IF NEW.professional_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = NEW.professional_id) THEN
    NEW.provider_id := NEW.professional_id;
  ELSIF NEW.professional_id IS NOT NULL THEN
    RAISE EXCEPTION 'Bu kayit yalniz saglayici hesaplari icin acilabilir (%).', TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_faz2b_set_provider_id_from_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz2b_set_provider_id_from_professional() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2) NOT NULL + CASCADE
-- -----------------------------------------------------------------------------
ALTER TABLE public.services            ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE public.portfolio_items     ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE public.profile_experiences ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE public.reviews             ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE public.favorites           ALTER COLUMN provider_id SET NOT NULL;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_provider_id_fkey;
ALTER TABLE public.services ADD CONSTRAINT services_provider_id_fkey
  FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;
ALTER TABLE public.portfolio_items DROP CONSTRAINT IF EXISTS portfolio_items_provider_id_fkey;
ALTER TABLE public.portfolio_items ADD CONSTRAINT portfolio_items_provider_id_fkey
  FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;
ALTER TABLE public.profile_experiences DROP CONSTRAINT IF EXISTS profile_experiences_provider_id_fkey;
ALTER TABLE public.profile_experiences ADD CONSTRAINT profile_experiences_provider_id_fkey
  FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_provider_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_provider_id_fkey
  FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;
ALTER TABLE public.favorites DROP CONSTRAINT IF EXISTS favorites_provider_id_fkey;
ALTER TABLE public.favorites ADD CONSTRAINT favorites_provider_id_fkey
  FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- 3) Yeni sutun indeksleri, 4) eski GIN
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_id_provider_id_key ON public.favorites (user_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_reviews_provider_created ON public.reviews (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_experiences_provider_kind_sort ON public.profile_experiences (provider_id, kind, sort_order);

DROP INDEX IF EXISTS public.idx_profiles_category_attributes_gin;

-- -----------------------------------------------------------------------------
-- 5) Dogrulama
-- -----------------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND column_name = 'provider_id' AND is_nullable = 'NO'
     AND table_name IN ('services', 'portfolio_items', 'profile_experiences', 'reviews', 'favorites');
  IF n <> 5 THEN RAISE EXCEPTION 'FAZ 10c-2/04: NOT NULL %/5', n; END IF;
  SELECT count(*) INTO n FROM pg_constraint
   WHERE contype = 'f' AND confdeltype = 'c' AND confrelid = 'public.providers'::regclass
     AND conname IN ('services_provider_id_fkey', 'portfolio_items_provider_id_fkey', 'profile_experiences_provider_id_fkey',
                     'reviews_provider_id_fkey', 'favorites_provider_id_fkey');
  IF n <> 5 THEN RAISE EXCEPTION 'FAZ 10c-2/04: CASCADE yabanci anahtar %/5', n; END IF;
  RAISE NOTICE 'FAZ 10c-2/04: provider_id 5 tabloda zorunlu, tetikleyici iki yonlu, eski GIN dustu';
END $$;

NOTIFY pgrst, 'reload schema';
