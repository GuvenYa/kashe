-- =============================================================================
-- ASAMA 32 - Duzeltme 13 kontrolu (YAPI, salt okuma) - dal ve uretim
--
-- Migration 20261107100000_duzeltme_13_ajans_rol_kapsami.sql sonrasi:
--   K1  fn_duz13_ajans_rol_kapsami: SECURITY DEFINER + search_path, STABLE
--   K2  girissize kapali, uyelere acik
--   K3  etkinlik gorme yetkisini soruyor (can_access_event_scope)
--   K4  BILGI: ajans adayi olan eslestirme kosusu sayisi
-- K1-K3 ESIT olmali. Davranis testi: asama32b (YALNIZ dal).
-- =============================================================================

WITH k AS (
  SELECT 'K1 ajans rol kapsami fonksiyonu' AS kontrol,
         (SELECT count(*) FROM pg_proc
           WHERE proname = 'fn_duz13_ajans_rol_kapsami' AND prosecdef AND provolatile = 's'
             AND proconfig::text LIKE '%search_path=public%') AS deger,
         1::bigint AS beklenen
  UNION ALL
  SELECT 'K2 yetkiler (girissiz kapali, uye acik)',
         (SELECT count(*) FROM pg_proc
           WHERE proname = 'fn_duz13_ajans_rol_kapsami'
             AND NOT has_function_privilege('anon', oid, 'EXECUTE')
             AND has_function_privilege('authenticated', oid, 'EXECUTE')), 1
  UNION ALL
  SELECT 'K3 etkinlik gorme yetkisi soruluyor',
         (SELECT count(*) FROM pg_proc
           WHERE proname = 'fn_duz13_ajans_rol_kapsami'
             AND prosrc LIKE '%can_access_event_scope%events.view%'), 1
)
SELECT kontrol, deger, beklenen,
       CASE WHEN deger = beklenen THEN 'ESIT' ELSE 'FARKLI' END AS sonuc
  FROM k
UNION ALL
SELECT 'K4 BILGI: ajans adayli kosu', count(DISTINCT mc.match_run_id), count(DISTINCT mc.match_run_id), 'BILGI'
  FROM public.match_candidates mc
 WHERE mc.role_id IS NULL;
