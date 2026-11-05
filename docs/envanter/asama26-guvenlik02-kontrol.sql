-- =============================================================================
-- ASAMA 26 - Guvenlik 02 kontrolu (YAPI + iz, salt okuma) - dal ve uretim
--
-- Migration 20261106110000_guvenlik_02_ilan_talep_alicisi_basvuru.sql sonrasi:
--   K1  listings + quote_request_recipients: anon / authenticated icin
--       beklenmeyen INSERT / UPDATE yetkisi yok (fazla 0)
--   K2  beklenen yazma sutunlarinin hepsi yerinde (eksik 0 - uygulama akislari)
--   K3  applications: anon INSERT yetkisi yok
--   K4  uc tetikleyici var ve etkin (ilan, talep alicisi, basvuru ekleme)
--   K5  tetikleyici fonksiyonlari + sayac RPC'si SECURITY DEFINER + search_path
--   K6  sayac RPC'si girissiz ve uyelere acik, PUBLIC'e kapali
--   K7  listings_set_updated_at sayac guncellemesinde calismiyor (WHEN)
--   K8  IZ: 14 gunu asan sahip kaynakli one cikarma (bilgi; yonetici verdiyse
--       olagan) - 0 beklenir
-- Hepsi ESIT olmali (K8 bilgi). Davranis testi ayri: asama26b (YALNIZ dal).
-- =============================================================================

WITH beklenen(yetki, tablo, sutun) AS (
  VALUES
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
    ('UPDATE', 'quote_request_recipients', 'responded_at')
),
mevcut AS (
  SELECT DISTINCT grantee, privilege_type AS yetki, table_name AS tablo, column_name AS sutun
    FROM information_schema.column_privileges
   WHERE table_schema = 'public'
     AND grantee IN ('anon', 'authenticated')
     AND privilege_type IN ('INSERT', 'UPDATE')
     AND table_name IN ('listings', 'quote_request_recipients')
),
fazla AS (
  SELECT m.* FROM mevcut m
   WHERE m.grantee = 'anon'
      OR (m.yetki, m.tablo, m.sutun) NOT IN (SELECT yetki, tablo, sutun FROM beklenen)
),
eksik AS (
  SELECT b.* FROM beklenen b
   WHERE (b.yetki, b.tablo, b.sutun) NOT IN
         (SELECT yetki, tablo, sutun FROM mevcut WHERE grantee = 'authenticated')
),
tetik AS (
  SELECT t.tgname, t.tgenabled, p.prosecdef, p.proconfig
    FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE NOT t.tgisinternal
     AND t.tgname IN ('trg_guv02_ilan_gecis', 'trg_guv02_talep_alici_gecis', 'trg_guv02_basvuru_ekleme')
),
rpc AS (
  SELECT p.oid, p.prosecdef, p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'ilan_goruntulenme_artir'
),
k AS (
  SELECT 'K1 fazla yazma yetkisi' AS kontrol,
         (SELECT count(*) FROM fazla) AS deger, 0::bigint AS beklenen,
         (SELECT string_agg(grantee || ':' || yetki || ':' || tablo || '.' || sutun, ', ') FROM fazla) AS ayrinti
  UNION ALL
  SELECT 'K2 eksik yazma yetkisi', (SELECT count(*) FROM eksik), 0,
         (SELECT string_agg(yetki || ':' || tablo || '.' || sutun, ', ') FROM eksik)
  UNION ALL
  SELECT 'K3 applications anon INSERT',
         (SELECT count(*) FROM information_schema.column_privileges
           WHERE table_schema = 'public' AND table_name = 'applications'
             AND grantee = 'anon' AND privilege_type = 'INSERT'), 0, NULL
  UNION ALL
  SELECT 'K4 tetikleyiciler (etkin)', (SELECT count(*) FROM tetik WHERE tgenabled = 'O'), 3,
         (SELECT string_agg(tgname, ', ') FROM tetik)
  UNION ALL
  SELECT 'K5 SECURITY DEFINER + search_path',
         (SELECT count(*) FROM tetik WHERE prosecdef AND proconfig::text LIKE '%search_path=public%')
         + (SELECT count(*) FROM rpc WHERE prosecdef AND proconfig::text LIKE '%search_path=public%'), 4, NULL
  UNION ALL
  SELECT 'K6 sayac RPC yetkisi (anon + authenticated, PUBLIC degil)',
         (SELECT (CASE WHEN has_function_privilege('anon', r.oid, 'EXECUTE') THEN 1 ELSE 0 END)
               + (CASE WHEN has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN 1 ELSE 0 END)
               + (CASE WHEN EXISTS (SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid = r.oid)) a
                                     WHERE a.grantee = 0) THEN 10 ELSE 0 END)
            FROM rpc r), 2, NULL
  UNION ALL
  SELECT 'K7 updated_at tetikleyicisi WHEN kosullu',
         (SELECT count(*) FROM pg_trigger t
           WHERE t.tgrelid = 'public.listings'::regclass AND t.tgname = 'listings_set_updated_at'
             AND pg_get_triggerdef(t.oid) LIKE '%WHEN%views_count%'), 1, NULL
)
SELECT kontrol, deger, beklenen,
       CASE WHEN deger = beklenen THEN 'ESIT' ELSE 'FARKLI' END AS sonuc, ayrinti
  FROM k
UNION ALL
SELECT 'K8 IZ: 14 gunu asan one cikarma (bilgi)',
       count(*), 0,
       CASE WHEN count(*) = 0 THEN 'ESIT' ELSE 'BILGI' END,
       string_agg(id::text, ', ')
  FROM public.listings
 WHERE urgent_until > now() + interval '15 days'
    OR featured_category_until > now() + interval '15 days'
    OR featured_home_until > now() + interval '15 days';
