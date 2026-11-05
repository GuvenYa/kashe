-- =============================================================================
-- ASAMA 25 - Guvenlik 01 kontrolu (YAPI, salt okuma) - dal ve uretim
--
-- Migration 20261106100000_guvenlik_01_yazma_alanlari_ve_gecisler.sql sonrasi:
--   K1  quotes / messages / conversations / reviews / review_replies /
--       applications: anon + authenticated icin UPDATE yetkisi YALNIZ beklenen
--       sutunlarda (fazla 0)
--   K2  ayni tablolarda beklenen sutunlarin hepsi yazilabilir (eksik 0 - uygulama
--       akislari kirilmasin)
--   K3  bookings UPDATE sutunlari degismedi (status + iptal / tamamlama alanlari)
--   K4  uc gecis tetikleyicisi var ve etkin
--   K5  tetikleyici fonksiyonlari SECURITY DEFINER + search_path sabit
-- Hepsi ESIT olmali. Davranis testi ayri: asama25b (YALNIZ dal).
-- =============================================================================

WITH beklenen(tablo, sutun) AS (
  VALUES ('quotes', 'status'),
         ('messages', 'read_at'),
         ('conversations', 'event_date'), ('conversations', 'event_type'), ('conversations', 'location'),
         ('conversations', 'guest_count'), ('conversations', 'budget_range'), ('conversations', 'brief_data'),
         ('conversations', 'start_time'), ('conversations', 'end_time'), ('conversations', 'request_type'),
         ('conversations', 'event_id'),
         ('reviews', 'rating'), ('reviews', 'body'), ('reviews', 'created_by'),
         ('review_replies', 'body'),
         ('applications', 'status')
),
mevcut AS (
  SELECT DISTINCT table_name AS tablo, column_name AS sutun
    FROM information_schema.column_privileges
   WHERE table_schema = 'public' AND privilege_type = 'UPDATE'
     AND grantee IN ('anon', 'authenticated')
     AND table_name IN ('quotes', 'messages', 'conversations', 'reviews', 'review_replies', 'applications')
),
anon_mevcut AS (
  SELECT DISTINCT table_name AS tablo, column_name AS sutun
    FROM information_schema.column_privileges
   WHERE table_schema = 'public' AND privilege_type = 'UPDATE' AND grantee = 'anon'
     AND table_name IN ('quotes', 'messages', 'conversations', 'reviews', 'review_replies', 'applications', 'bookings')
),
rez AS (
  SELECT string_agg(column_name, ',' ORDER BY column_name) AS sutunlar
    FROM information_schema.column_privileges
   WHERE table_schema = 'public' AND table_name = 'bookings'
     AND privilege_type = 'UPDATE' AND grantee = 'authenticated'
),
tetik AS (
  SELECT t.tgname, t.tgenabled, p.prosecdef, p.proconfig
    FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE NOT t.tgisinternal
     AND t.tgname IN ('trg_guv01_teklif_gecis', 'trg_guv01_rezervasyon_gecis', 'trg_guv01_basvuru_gecis')
)
SELECT 'K1 fazla UPDATE yetkisi' AS kontrol,
       (SELECT count(*) FROM mevcut m WHERE (m.tablo, m.sutun) NOT IN (SELECT tablo, sutun FROM beklenen))
       + (SELECT count(*) FROM anon_mevcut) AS deger,
       0::bigint AS beklenen,
       CASE WHEN (SELECT count(*) FROM mevcut m WHERE (m.tablo, m.sutun) NOT IN (SELECT tablo, sutun FROM beklenen))
                 + (SELECT count(*) FROM anon_mevcut) = 0 THEN 'ESIT' ELSE 'FARKLI' END AS sonuc,
       concat_ws(' | ',
         (SELECT string_agg(m.tablo || '.' || m.sutun, ', ') FROM mevcut m
           WHERE (m.tablo, m.sutun) NOT IN (SELECT tablo, sutun FROM beklenen)),
         (SELECT 'anon: ' || string_agg(a.tablo || '.' || a.sutun, ', ') FROM anon_mevcut a)) AS ayrinti
UNION ALL
SELECT 'K2 eksik UPDATE yetkisi',
       (SELECT count(*) FROM beklenen b WHERE (b.tablo, b.sutun) NOT IN (SELECT tablo, sutun FROM mevcut)),
       0,
       CASE WHEN (SELECT count(*) FROM beklenen b WHERE (b.tablo, b.sutun) NOT IN (SELECT tablo, sutun FROM mevcut)) = 0
            THEN 'ESIT' ELSE 'FARKLI' END,
       (SELECT string_agg(b.tablo || '.' || b.sutun, ', ') FROM beklenen b
         WHERE (b.tablo, b.sutun) NOT IN (SELECT tablo, sutun FROM mevcut))
UNION ALL
SELECT 'K3 bookings UPDATE sutunlari',
       CASE WHEN (SELECT sutunlar FROM rez) = 'cancellation_reason,cancelled_at,cancelled_by,completed_at,status' THEN 0 ELSE 1 END,
       0,
       CASE WHEN (SELECT sutunlar FROM rez) = 'cancellation_reason,cancelled_at,cancelled_by,completed_at,status' THEN 'ESIT' ELSE 'FARKLI' END,
       (SELECT sutunlar FROM rez)
UNION ALL
SELECT 'K4 gecis tetikleyicileri (etkin)',
       (SELECT count(*) FROM tetik WHERE tgenabled = 'O'),
       3,
       CASE WHEN (SELECT count(*) FROM tetik WHERE tgenabled = 'O') = 3 THEN 'ESIT' ELSE 'FARKLI' END,
       (SELECT string_agg(tgname, ', ') FROM tetik)
UNION ALL
SELECT 'K5 SECURITY DEFINER + search_path',
       (SELECT count(*) FROM tetik WHERE prosecdef AND proconfig::text LIKE '%search_path=public%'),
       3,
       CASE WHEN (SELECT count(*) FROM tetik WHERE prosecdef AND proconfig::text LIKE '%search_path=public%') = 3
            THEN 'ESIT' ELSE 'FARKLI' END,
       NULL;
