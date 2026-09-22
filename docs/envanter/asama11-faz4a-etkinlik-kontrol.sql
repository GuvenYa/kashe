-- =============================================================================
-- FAZ 4a / Asama 11 — Etkinlik semasi kontrolu (SALT OKUNUR; dalda ve URETIMDE)
--
-- 4a veri yazmaz (event_types referansi haric); kontrol sema/yetki/degismezlik odaklidir. Beklenen: hepsi ESIT.
--   K1 event_types anahtarlari = conversations.event_type CHECK listesi (uygulama EVENT_TYPES ile ayni kume)
--   K2 brief basina tam bir is_current (surumu olan brief sayisi = is_current sayisi)
--   K3 surum numarasi tekrari/boslugu yok (brief basina max(version_no) = count)
--   K4 event_requirements'ta pasif role bagli satir (bilgi degil: 4a'da 0)
--   K5 5 tabloda RLS acik (5)
--   K6 anon'un 4 veri tablosunda hicbir yetkisi yok (0)
--   K7 authenticated'in event_spec_versions'ta UPDATE/DELETE yetkisi yok (0)  — ekle-yalniz
--   K8 conversations.event_id sutunu + FK var (2)
--   K9 satir sayilari (bilgi): briefs / versions / events / requirements
-- =============================================================================

WITH
check_list AS (
  SELECT DISTINCT m[1] AS key
    FROM pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''::text', 'g') AS m
   WHERE c.conrelid = 'public.conversations'::regclass AND c.conname = 'conversations_event_type_check'
),
k1 AS (
  SELECT 'K1 event_types = conversations.event_type CHECK listesi (EXCEPT iki yon)' AS kontrol,
         (SELECT count(*) FROM (SELECT key FROM check_list EXCEPT SELECT key FROM public.event_types) x)::bigint AS eski,
         (SELECT count(*) FROM (SELECT key FROM public.event_types EXCEPT SELECT key FROM check_list) x)::bigint AS yeni
),
k2 AS (
  SELECT 'K2 surumu olan brief = is_current satiri' AS kontrol,
         (SELECT count(DISTINCT brief_id) FROM public.event_spec_versions)::bigint,
         (SELECT count(*) FROM public.event_spec_versions WHERE is_current)::bigint
),
k3 AS (
  SELECT 'K3 surum numarasinda bosluk/tekrar olan brief' AS kontrol,
         (SELECT count(*) FROM (SELECT brief_id FROM public.event_spec_versions GROUP BY 1 HAVING max(version_no) <> count(*)) x)::bigint,
         0::bigint
),
k4 AS (
  SELECT 'K4 pasif role bagli gereksinim' AS kontrol,
         (SELECT count(*) FROM public.event_requirements r JOIN public.service_roles sr ON sr.id = r.role_id WHERE NOT sr.is_active)::bigint,
         0::bigint
),
k5 AS (
  SELECT 'K5 RLS acik tablo sayisi (5)' AS kontrol,
         (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relrowsecurity
            AND relname IN ('event_types', 'event_briefs', 'event_spec_versions', 'events', 'event_requirements'))::bigint,
         5::bigint
),
k6 AS (
  SELECT 'K6 anon yetkisi (4 veri tablosu) — 0' AS kontrol,
         (SELECT count(*) FROM information_schema.role_table_grants
           WHERE table_schema = 'public' AND grantee = 'anon'
             AND table_name IN ('event_briefs', 'event_spec_versions', 'events', 'event_requirements'))::bigint,
         0::bigint
),
k7 AS (
  SELECT 'K7 authenticated event_spec_versions UPDATE/DELETE yetkisi (ekle-yalniz) — 0' AS kontrol,
         (SELECT count(*) FROM information_schema.role_table_grants
           WHERE table_schema = 'public' AND grantee = 'authenticated' AND table_name = 'event_spec_versions'
             AND privilege_type IN ('UPDATE', 'DELETE'))::bigint,
         0::bigint
),
k8 AS (
  SELECT 'K8 conversations.event_id sutunu + FK (2)' AS kontrol,
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'event_id')::bigint
         + (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.conversations'::regclass AND contype = 'f'
              AND pg_get_constraintdef(oid) LIKE '%(event_id) REFERENCES events(id)%')::bigint,
         2::bigint
),
k9 AS (
  SELECT 'K9 satir sayilari briefs*1e6 + versions*1e4 + events*100 + requirements (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.event_briefs)::bigint * 1000000
         + (SELECT count(*) FROM public.event_spec_versions)::bigint * 10000
         + (SELECT count(*) FROM public.events)::bigint * 100
         + (SELECT count(*) FROM public.event_requirements)::bigint,
         0::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4
  UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8
  UNION ALL SELECT * FROM k9
)
SELECT kontrol, eski, yeni,
       CASE WHEN kontrol LIKE 'K1%' THEN eski + yeni ELSE abs(eski - yeni) END AS fark,
       CASE WHEN kontrol LIKE 'K9%' THEN 'BILGI'
            WHEN (CASE WHEN kontrol LIKE 'K1%' THEN eski + yeni ELSE abs(eski - yeni) END) = 0 THEN 'ESIT'
            ELSE 'FARK' END AS durum
  FROM hepsi;
