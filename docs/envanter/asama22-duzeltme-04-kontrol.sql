-- =============================================================================
-- Duzeltme 04 / Asama 22 - FAZ 7 RPC bayragi kontrolu (SALT OKUNUR; dalda ve URETIMDE)
-- Kaynak: 20261104130000_duzeltme_04_faz7_bayrak.sql
--   K1 fn_faz7_rpc_flag govdesi COALESCE icerir (1); duzeltme oncesi 0
--   K2 bu oturumda fn_faz7_rpc_flag() NULL DEGIL (1). SQL Editor'un taze oturumunda duzeltme oncesi 0 cikar
--      (acigin kendisi: ayar tanimsiz -> NULL -> dondurma kilidi atlanir)
--   K3 anon / authenticated EXECUTE yetkisi (0)
--   K4 bilgi: gonderilmis surumlerde gonderimden 5 sn SONRA eklenmis ya da degismis kalem (uretimde 0 beklenir;
--      0 degilse satirlar birlikte incelenir: acik kullanilmis olabilir)
--   K5 bilgi: gonderilmis surumlerde gonderimden 5 sn SONRA degismis surum satiri (vergi / gecerlilik / not; 0 beklenir)
--   (K4/K5 Sahne tekliflerini - id '5a4e...' - saymaz: uretec gecmis tarihli sent_at yazar, kalemler sonra eklenir)
-- Beklenen: K1-K3 ESIT; K4-K5 BILGI.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 fn_faz7_rpc_flag govdesi COALESCE icerir (1)' AS kontrol,
         (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'fn_faz7_rpc_flag' AND p.prosrc ILIKE '%coalesce%')::bigint AS eski,
         1::bigint AS yeni
),
k2 AS (
  SELECT 'K2 bu oturumda fn_faz7_rpc_flag() NULL degil (1; duzeltme oncesi taze oturumda 0)' AS kontrol,
         (public.fn_faz7_rpc_flag() IS NOT NULL)::int::bigint,
         1::bigint
),
k3 AS (
  SELECT 'K3 fn_faz7_rpc_flag anon/authenticated EXECUTE (0)' AS kontrol,
         (SELECT count(*) FROM information_schema.routine_privileges
           WHERE specific_schema = 'public' AND routine_name = 'fn_faz7_rpc_flag'
             AND grantee IN ('anon', 'authenticated', 'PUBLIC') AND privilege_type = 'EXECUTE')::bigint,
         0::bigint
),
k4 AS (
  SELECT 'K4 gonderimden sonra eklenmis/degismis kalem (bilgi: 0)' AS kontrol,
         (SELECT count(*) FROM public.proposal_items i JOIN public.proposal_versions v ON v.id = i.proposal_version_id
           WHERE v.sent_at IS NOT NULL AND v.proposal_id::text NOT LIKE '5a4e%'
             AND (i.created_at > v.sent_at + interval '5 seconds' OR i.updated_at > v.sent_at + interval '5 seconds'))::bigint,
         0::bigint
),
k5 AS (
  SELECT 'K5 gonderimden sonra degismis surum satiri (bilgi: 0)' AS kontrol,
         (SELECT count(*) FROM public.proposal_versions v
           WHERE v.sent_at IS NOT NULL AND v.proposal_id::text NOT LIKE '5a4e%' AND v.updated_at > v.sent_at + interval '5 seconds')::bigint,
         0::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4 UNION ALL SELECT * FROM k5
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K4 %' OR kontrol LIKE 'K5 %' THEN 'BILGI'
            WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
