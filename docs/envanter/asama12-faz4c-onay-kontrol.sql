-- =============================================================================
-- FAZ 4c / Asama 12 — Etkinlik onayi kontrolu (SALT OKUNUR; dalda ve URETIMDE)
--
--   K1 quote_requests.event_id sutunu + FK (2)
--   K2 listings.event_id sutunu + FK (2)
--   K3 spec surumunden olusan etkinliklerde surum valid degil (0)
--   K4 etkinlik gereksinim sayisi = surumdeki gecerli (aktif, tekil) slug sayisi (fark 0; yalniz spec_version_id dolu olanlar)
--   K5 create_event_from_spec: authenticated EXECUTE var, anon yok (2 = OK)
--   K6 ayni surumden birden fazla etkinlik (0)
--   K7 etkinlik sayilari status'a gore (bilgi): confirmed*1e4 + draft*100 + diger
--   K8 baglanan talep/ilan (bilgi): quote_requests.event_id dolu * 100 + listings.event_id dolu
-- Beklenen: K1-K6 ESIT, K7-K8 BILGI.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 quote_requests.event_id sutunu + FK (2)' AS kontrol,
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quote_requests' AND column_name = 'event_id')::bigint
         + (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.quote_requests'::regclass AND contype = 'f'
              AND pg_get_constraintdef(oid) LIKE '%(event_id) REFERENCES events(id)%')::bigint AS eski,
         2::bigint AS yeni
),
k2 AS (
  SELECT 'K2 listings.event_id sutunu + FK (2)' AS kontrol,
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'event_id')::bigint
         + (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.listings'::regclass AND contype = 'f'
              AND pg_get_constraintdef(oid) LIKE '%(event_id) REFERENCES events(id)%')::bigint,
         2::bigint
),
k3 AS (
  SELECT 'K3 surumden olusan etkinlikte surum valid degil' AS kontrol,
         (SELECT count(*) FROM public.events e JOIN public.event_spec_versions v ON v.id = e.spec_version_id
           WHERE v.validation_status <> 'valid')::bigint,
         0::bigint
),
k4 AS (
  SELECT 'K4 gereksinim sayisi = surumdeki gecerli tekil slug sayisi (fark)' AS kontrol,
         (SELECT count(*) FROM public.events e JOIN public.event_spec_versions v ON v.id = e.spec_version_id
           WHERE (SELECT count(*) FROM public.event_requirements r WHERE r.event_id = e.id)
              <> (SELECT count(DISTINCT x->>'slug')
                    FROM jsonb_array_elements(COALESCE(v.spec_jsonb->'suggested_roles', '[]'::jsonb)) x
                    JOIN public.service_roles sr ON sr.slug = x->>'slug' AND sr.is_active))::bigint,
         0::bigint
),
k5 AS (
  SELECT 'K5 create_event_from_spec yetkisi: authenticated var, anon yok (2 = OK)' AS kontrol,
         (has_function_privilege('authenticated', 'public.create_event_from_spec(uuid)', 'EXECUTE'))::int::bigint
         + (NOT has_function_privilege('anon', 'public.create_event_from_spec(uuid)', 'EXECUTE'))::int::bigint,
         2::bigint
),
k6 AS (
  SELECT 'K6 ayni surumden birden fazla etkinlik' AS kontrol,
         (SELECT count(*) FROM (SELECT spec_version_id FROM public.events WHERE spec_version_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1) x)::bigint,
         0::bigint
),
k7 AS (
  SELECT 'K7 etkinlik sayisi confirmed*1e4 + draft*100 + diger (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.events WHERE status = 'confirmed')::bigint * 10000
         + (SELECT count(*) FROM public.events WHERE status = 'draft')::bigint * 100
         + (SELECT count(*) FROM public.events WHERE status NOT IN ('confirmed', 'draft'))::bigint,
         0::bigint
),
k8 AS (
  SELECT 'K8 bagli talep*100 + bagli ilan (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.quote_requests WHERE event_id IS NOT NULL)::bigint * 100
         + (SELECT count(*) FROM public.listings WHERE event_id IS NOT NULL)::bigint,
         0::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4
  UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K7%' OR kontrol LIKE 'K8%' THEN 'BILGI'
            WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
