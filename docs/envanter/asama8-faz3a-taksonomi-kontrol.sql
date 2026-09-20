-- =============================================================================
-- FAZ 3a / Asama 8 — Taksonomi tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE)
--
-- service_categories (legacy_role) ile service_roles arasindaki farki sayar; slug korunmus mu, arketip
-- eslesmis mi, 5 yapilandirma dosyasinin anahtari olan slug'lar degismemis mi. Beklenen: ESIT / OK,
-- K5 (arketipsiz rol) 0, K7 BILGI.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 legacy_role kategori = service_roles' AS kontrol,
         (SELECT count(*) FROM public.service_categories WHERE layer = 'legacy_role')::bigint AS eski,
         (SELECT count(*) FROM public.service_roles)::bigint AS yeni
),
k2 AS (
  SELECT 'K2 slug birebir (EXCEPT iki yon)' AS kontrol,
         (SELECT count(*) FROM (SELECT slug FROM public.service_categories WHERE layer = 'legacy_role'
                                EXCEPT SELECT slug FROM public.service_roles) x)::bigint,
         (SELECT count(*) FROM (SELECT slug FROM public.service_roles
                                EXCEPT SELECT slug FROM public.service_categories WHERE layer = 'legacy_role') x)::bigint
),
k3 AS (
  SELECT 'K3 legacy_category_id eslesmesi bozuk (slug/ad/emoji/sira/aktif farki)' AS kontrol,
         (SELECT count(*) FROM public.service_roles r JOIN public.service_categories sc ON sc.id = r.legacy_category_id
           WHERE r.slug <> sc.slug OR r.name_tr <> sc.name_tr OR r.emoji IS DISTINCT FROM sc.emoji
              OR r.sort_order <> sc.sort_order OR r.is_active <> sc.is_active)::bigint,
         0::bigint
),
k4 AS (
  SELECT 'K4 legacy_category_id bos rol (yalniz yeni-yapi rolleri olabilir; 3a''da 0)' AS kontrol,
         (SELECT count(*) FROM public.service_roles WHERE legacy_category_id IS NULL)::bigint, 0::bigint
),
k5 AS (
  SELECT 'K5 arketipsiz rol (category-fields.ts ile eslesmedi)' AS kontrol,
         (SELECT count(*) FROM public.service_roles WHERE archetype IS NULL)::bigint, 0::bigint
),
k6 AS (
  SELECT 'K6 ust katman (category) satiri sayisi (3a''da 0; 3b ile dolar)' AS kontrol,
         (SELECT count(*) FROM public.service_categories WHERE layer = 'category')::bigint, 0::bigint
),
k7 AS (
  SELECT 'K7 arketip dagilimi (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.service_roles WHERE archetype = 'sahne')::bigint * 1000000
         + (SELECT count(*) FROM public.service_roles WHERE archetype = 'cast')::bigint * 10000
         + (SELECT count(*) FROM public.service_roles WHERE archetype = 'produksiyon')::bigint * 100
         + (SELECT count(*) FROM public.service_roles WHERE archetype = 'uzmanlik')::bigint,
         0::bigint
),
k8 AS (
  SELECT 'K8 sync_log FAZ 3 kayitlari' AS kontrol,
         (SELECT count(*) FROM public.organization_sync_log WHERE source ILIKE '%faz3%' OR source ILIKE '%service_role%')::bigint, 0::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4
  UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8
)
SELECT kontrol, eski, yeni,
       CASE WHEN kontrol LIKE 'K2%' THEN eski + yeni ELSE abs(eski - yeni) END AS fark,
       CASE WHEN kontrol LIKE 'K7%' THEN 'BILGI (sahne*1e6 + cast*1e4 + produksiyon*100 + uzmanlik; beklenen 8/3/6/6 = 8030606)'
            WHEN (CASE WHEN kontrol LIKE 'K2%' THEN eski + yeni ELSE abs(eski - yeni) END) = 0 THEN 'ESIT'
            ELSE 'FARK' END AS durum
  FROM hepsi;
