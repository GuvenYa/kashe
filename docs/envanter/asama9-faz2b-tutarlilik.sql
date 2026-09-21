-- =============================================================================
-- FAZ 2b / Asama 9 — Saglayici hizmetleri tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE)
--
-- (1) 5 eski tabloda provider_id = sahip (saglayici olan sahipler icin), (2) provider_services legacy_sync
-- satirlari = derive_provider_services ciktisi (fiyat/birim/birincil dahil), (3) professional_profiles fiyat
-- ozeti = derive_provider_price_summary, (4) tek birincil, (5) rolsuz kategoriye bagli hizmet yok, (6) sync_log
-- FAZ 2b bos. Beklenen: her satir ESIT (K10/K11 BILGI).
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 services: sahibi saglayici olan satir = provider_id dolu ve esit' AS kontrol,
         (SELECT count(*) FROM public.services s WHERE EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = s.profile_id))::bigint AS eski,
         (SELECT count(*) FROM public.services s WHERE s.provider_id = s.profile_id)::bigint AS yeni
),
k2 AS (
  SELECT 'K2 portfolio_items: sahibi saglayici = provider_id esit' AS kontrol,
         (SELECT count(*) FROM public.portfolio_items x WHERE EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = x.profile_id))::bigint,
         (SELECT count(*) FROM public.portfolio_items x WHERE x.provider_id = x.profile_id)::bigint
),
k3 AS (
  SELECT 'K3 profile_experiences: sahibi saglayici = provider_id esit' AS kontrol,
         (SELECT count(*) FROM public.profile_experiences x WHERE EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = x.profile_id))::bigint,
         (SELECT count(*) FROM public.profile_experiences x WHERE x.provider_id = x.profile_id)::bigint
),
k4 AS (
  SELECT 'K4 reviews: professional_id saglayici = provider_id esit' AS kontrol,
         (SELECT count(*) FROM public.reviews x WHERE EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = x.professional_id))::bigint,
         (SELECT count(*) FROM public.reviews x WHERE x.provider_id = x.professional_id)::bigint
),
k5 AS (
  SELECT 'K5 favorites: professional_id saglayici = provider_id esit' AS kontrol,
         (SELECT count(*) FROM public.favorites x WHERE EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = x.professional_id))::bigint,
         (SELECT count(*) FROM public.favorites x WHERE x.provider_id = x.professional_id)::bigint
),
k5b AS (
  SELECT 'K5b 5 tabloda provider_id dolu ama sahibinden farkli (kurcalama/yanlis) — 0' AS kontrol,
         (SELECT count(*) FROM public.services            WHERE provider_id IS NOT NULL AND provider_id <> profile_id)::bigint
         + (SELECT count(*) FROM public.portfolio_items     WHERE provider_id IS NOT NULL AND provider_id <> profile_id)::bigint
         + (SELECT count(*) FROM public.profile_experiences WHERE provider_id IS NOT NULL AND provider_id <> profile_id)::bigint
         + (SELECT count(*) FROM public.reviews             WHERE provider_id IS NOT NULL AND provider_id <> professional_id)::bigint
         + (SELECT count(*) FROM public.favorites           WHERE provider_id IS NOT NULL AND provider_id <> professional_id)::bigint,
         0::bigint
),
turetilen AS (
  SELECT pr.id AS provider_id, d.role_id, d.is_primary, d.pricing_mode, d.price_min, d.price_max, d.price_unit, d.legacy_service_id
    FROM public.providers pr CROSS JOIN LATERAL public.derive_provider_services(pr.id) d
),
kayitli AS (
  SELECT ps.provider_id, ps.role_id, ps.is_primary, ps.pricing_mode, ps.price_min, ps.price_max, ps.price_unit, ps.legacy_service_id
    FROM public.provider_services ps WHERE ps.origin = 'legacy_sync'
),
k6 AS (
  SELECT 'K6 provider_services(legacy_sync) = turetilen kume (EXCEPT iki yon; fiyat/birim/birincil dahil)' AS kontrol,
         (SELECT count(*) FROM (SELECT * FROM turetilen EXCEPT SELECT * FROM kayitli) x)::bigint,
         (SELECT count(*) FROM (SELECT * FROM kayitli EXCEPT SELECT * FROM turetilen) x)::bigint
),
k7 AS (
  SELECT 'K7 professional_profiles fiyat ozeti = derive_provider_price_summary (fark)' AS kontrol,
         (SELECT count(*) FROM public.professional_profiles pp
            LEFT JOIN LATERAL public.derive_provider_price_summary(pp.provider_id) s ON true
           WHERE pp.pricing_mode IS DISTINCT FROM s.pricing_mode
              OR pp.price_min    IS DISTINCT FROM s.price_min
              OR pp.price_max    IS DISTINCT FROM s.price_max
              OR pp.price_unit   IS DISTINCT FROM s.price_unit)::bigint,
         0::bigint
),
k8 AS (
  SELECT 'K8 birden fazla birincil rolu olan saglayici' AS kontrol,
         (SELECT count(*) FROM (SELECT provider_id FROM public.provider_services WHERE is_primary GROUP BY 1 HAVING count(*) > 1) x)::bigint,
         0::bigint
),
k9 AS (
  SELECT 'K9 rolu olmayan kategoriye bagli hizmet (turetme bunu atlar; 0 olmali)' AS kontrol,
         (SELECT count(*) FROM public.services s
           WHERE NOT EXISTS (SELECT 1 FROM public.service_roles sr WHERE sr.legacy_category_id = s.category_id))::bigint
         + (SELECT count(*) FROM public.profiles p
             WHERE p.primary_category_id IS NOT NULL AND p.role IN ('professional', 'agency')
               AND NOT EXISTS (SELECT 1 FROM public.service_roles sr WHERE sr.legacy_category_id = p.primary_category_id))::bigint,
         0::bigint
),
k10 AS (
  SELECT 'K10 provider_services satir / birincil satir (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.provider_services)::bigint,
         (SELECT count(*) FROM public.provider_services WHERE is_primary)::bigint
),
k11 AS (
  SELECT 'K11 origin = provider satir (bilgi; 2c oncesi 0)' AS kontrol,
         (SELECT count(*) FROM public.provider_services WHERE origin = 'provider')::bigint,
         0::bigint
),
k12 AS (
  SELECT 'K12 sync_log FAZ 2b kayitlari' AS kontrol,
         (SELECT count(*) FROM public.organization_sync_log WHERE source ILIKE '%faz2b%')::bigint,
         0::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4
  UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k5b UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7
  UNION ALL SELECT * FROM k8 UNION ALL SELECT * FROM k9 UNION ALL SELECT * FROM k10 UNION ALL SELECT * FROM k11
  UNION ALL SELECT * FROM k12
)
SELECT kontrol, eski, yeni,
       CASE WHEN kontrol LIKE 'K6%' THEN eski + yeni ELSE abs(eski - yeni) END AS fark,
       CASE WHEN kontrol LIKE 'K10%' OR kontrol LIKE 'K11%' THEN 'BILGI'
            WHEN (CASE WHEN kontrol LIKE 'K6%' THEN eski + yeni ELSE abs(eski - yeni) END) = 0 THEN 'ESIT'
            ELSE 'FARK' END AS durum
  FROM hepsi;
