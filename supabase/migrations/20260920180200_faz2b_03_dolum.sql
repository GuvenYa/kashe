-- =============================================================================
-- FAZ 2b / 03 — DOLUM: (a) 5 eski tabloda provider_id = profile_id / professional_id,
--                      (b) her saglayici icin provider_services (recompute) + professional_profiles fiyat ozeti
--
-- DIKKAT — BU DOSYA VERI YAZAR (FAZ 0/2a dolum karariyla ayni: ayri, idempotan dosya; dal ve uretim ayni
--   dosyayi kosar; bos dalda sifir satir). Eski tablolarda YALNIZ yeni provider_id sutunu yazilir; baska hic
--   bir sutun degismez. updated_at tetikleyicileri (services, profile_experiences, reviews) dolum suresince
--   GECICI olarak kapatilir ki "guncellendi" damgalari oynamasin (reviews'ta "duzenlendi" gorunumu, services'ta
--   siralama). Dosya sonunda yeniden acilir; hata olursa BEGIN/COMMIT hepsini geri alir (tetikleyici durumu dahil).
--
-- ON KONTROL (uretimde, salt okunur; 12-faz3a bolum 5 kurali: DEGERLER gosterilir):
--   docs/envanter/13-faz2b-saglayici-hizmetleri.md bolum 5 adim 2 sorgusu — price_unit degerleri, on_request /
--   starting sayilari, ayni kategoride birden fazla aktif hizmet, rolsuz kategoriye bagli hizmet (0 olmali),
--   updated_at tetikleyici adlari.
--
-- DOGRULAMA: docs/envanter/asama9-faz2b-tutarlilik.sql (salt okunur; dal ve uretim)
-- GERI ALMA: UPDATE ... SET provider_id = NULL (5 tablo; yine tetikleyiciler kapatilarak);
--            DELETE FROM public.provider_services WHERE origin = 'legacy_sync';
--            UPDATE public.professional_profiles SET pricing_mode = NULL, price_min = NULL, price_max = NULL, price_unit = NULL;
-- =============================================================================

BEGIN;

DO $$
DECLARE
  t record;
  kapatilan text[] := '{}';
  n_svc int; n_pf int; n_exp int; n_rev int; n_fav int;
  n_prov int := 0; n_rows int := 0; n_err int := 0;
  r record;
BEGIN
  -- (a1) updated_at tetikleyicilerini gecici kapat (ad kalibi: *updated_at*; ic tetikleyiciler haric)
  FOR t IN
    SELECT c.oid::regclass AS rel, g.tgname
      FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public'
       AND c.relname IN ('services', 'profile_experiences', 'reviews', 'portfolio_items', 'favorites')
       AND NOT g.tgisinternal
       AND g.tgname ILIKE '%updated_at%'
       AND g.tgenabled <> 'D'
  LOOP
    EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %I', t.rel, t.tgname);
    kapatilan := kapatilan || (t.rel::text || '.' || t.tgname);
  END LOOP;
  RAISE NOTICE 'faz2b dolum: gecici kapatilan updated_at tetikleyicileri: %', array_to_string(kapatilan, ', ');

  -- (a2) provider_id dolumu (yalniz bos olanlar; saglayici satiri olan sahipler)
  UPDATE public.services s SET provider_id = s.profile_id
   WHERE s.provider_id IS DISTINCT FROM s.profile_id
     AND EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = s.profile_id);
  GET DIAGNOSTICS n_svc = ROW_COUNT;

  UPDATE public.portfolio_items x SET provider_id = x.profile_id
   WHERE x.provider_id IS DISTINCT FROM x.profile_id
     AND EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = x.profile_id);
  GET DIAGNOSTICS n_pf = ROW_COUNT;

  UPDATE public.profile_experiences x SET provider_id = x.profile_id
   WHERE x.provider_id IS DISTINCT FROM x.profile_id
     AND EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = x.profile_id);
  GET DIAGNOSTICS n_exp = ROW_COUNT;

  UPDATE public.reviews x SET provider_id = x.professional_id
   WHERE x.provider_id IS DISTINCT FROM x.professional_id
     AND EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = x.professional_id);
  GET DIAGNOSTICS n_rev = ROW_COUNT;

  UPDATE public.favorites x SET provider_id = x.professional_id
   WHERE x.provider_id IS DISTINCT FROM x.professional_id
     AND EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = x.professional_id);
  GET DIAGNOSTICS n_fav = ROW_COUNT;

  RAISE NOTICE 'faz2b dolum: provider_id yazildi — services %, portfolio_items %, profile_experiences %, reviews %, favorites %',
    n_svc, n_pf, n_exp, n_rev, n_fav;

  -- (a3) tetikleyicileri geri ac
  FOR t IN
    SELECT c.oid::regclass AS rel, g.tgname
      FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public'
       AND (c.oid::regclass::text || '.' || g.tgname) = ANY (kapatilan)
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE TRIGGER %I', t.rel, t.tgname);
  END LOOP;

  -- (b) provider_services: her saglayici icin yeniden hesapla (idempotan; ikinci kosuda degisiklik yok)
  FOR r IN SELECT id FROM public.providers ORDER BY created_at LOOP
    BEGIN
      n_rows := n_rows + public.recompute_provider_services(r.id);
      n_prov := n_prov + 1;
    EXCEPTION WHEN OTHERS THEN
      n_err := n_err + 1;
      PERFORM public.log_org_sync_error('faz2b_03_dolum.provider_services', 'BACKFILL', r.id, SQLERRM);
    END;
  END LOOP;
  RAISE NOTICE 'faz2b dolum: % saglayici hesaplandi, provider_services toplam % satir, hata %', n_prov, n_rows, n_err;
END $$;

-- Guvence: kapatilan tetikleyici kalmadi (dosya icinde hata olursa zaten hepsi geri alinir)
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public'
     AND c.relname IN ('services', 'profile_experiences', 'reviews', 'portfolio_items', 'favorites')
     AND NOT g.tgisinternal AND g.tgenabled = 'D';
  IF n > 0 THEN
    RAISE EXCEPTION 'faz2b dolum: % tetikleyici kapali kaldi — dosya geri aliniyor', n;
  END IF;
END $$;

COMMIT;
