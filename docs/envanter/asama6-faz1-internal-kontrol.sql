-- =============================================================================
-- FAZ 1 / Asama 6 — internal sema erisim kontrolu (SALT OKUNUR; dalda ve URETIMDE kosulabilir)
--
-- 02-guvenlik-modeli bolum 9'un yapisal karsiligi: internal semasi PostgREST'e acik mi,
-- anon/authenticated/service_role sema veya nesne yetkisi tasiyor mu, RPC yetkisi dogru mu.
-- Beklenen: her satirda durum = OK. Veri yazmaz; test kullanicisi kullanmaz.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 internal semasi var' AS kontrol,
         (to_regnamespace('internal') IS NOT NULL) AS ok,
         coalesce((SELECT nspacl::text FROM pg_namespace WHERE nspname = 'internal'), 'YOK') AS ayrinti
),
k2 AS (
  SELECT 'K2 PostgREST exposed schemas icinde internal YOK' AS kontrol,
         NOT coalesce(cfg ~* '\minternal\M', false) AS ok,
         coalesce(cfg, 'authenticator rolu / pgrst.db_schemas ayari bulunamadi (yerel ortam)') AS ayrinti
    FROM (SELECT string_agg(c, ' ') AS cfg FROM pg_roles pr, unnest(pr.rolconfig) c
           WHERE pr.rolname = 'authenticator' AND c LIKE 'pgrst.db_schemas%') s
),
k3 AS (
  SELECT 'K3 sema USAGE: anon/authenticated/service_role hicbiri' AS kontrol,
         NOT (has_schema_privilege('anon','internal','USAGE') OR has_schema_privilege('authenticated','internal','USAGE')
              OR has_schema_privilege('service_role','internal','USAGE')) AS ok,
         format('anon=%s authenticated=%s service_role=%s',
                has_schema_privilege('anon','internal','USAGE'), has_schema_privilege('authenticated','internal','USAGE'),
                has_schema_privilege('service_role','internal','USAGE')) AS ayrinti
),
k4 AS (
  SELECT 'K4 internal tablolarinda istemci GRANT yok' AS kontrol,
         count(*) = 0 AS ok,
         coalesce(string_agg(grantee || ':' || table_name || ':' || privilege_type, ', '), 'yok') AS ayrinti
    FROM information_schema.role_table_grants
   WHERE table_schema = 'internal' AND grantee IN ('anon','authenticated','service_role','PUBLIC')
),
k5 AS (
  SELECT 'K5 internal fonksiyonlarinda istemci EXECUTE yok' AS kontrol,
         count(*) = 0 AS ok,
         coalesce(string_agg(p.proname, ', '), 'yok') AS ayrinti
    FROM pg_proc p
   WHERE p.pronamespace = 'internal'::regnamespace
     AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
          OR has_function_privilege('service_role', p.oid, 'EXECUTE'))
),
k6 AS (
  SELECT 'K6 access_audit: RLS acik, UPDATE/DELETE kimseye yok' AS kontrol,
         c.relrowsecurity AND NOT EXISTS (
           SELECT 1 FROM information_schema.role_table_grants g
            WHERE g.table_schema = 'internal' AND g.table_name = 'access_audit'
              AND g.privilege_type IN ('UPDATE','DELETE') AND g.grantee <> 'postgres') AS ok,
         format('rls=%s acl=%s', c.relrowsecurity, c.relacl::text) AS ayrinti
    FROM pg_class c WHERE c.oid = 'internal.access_audit'::regclass
),
k7 AS (
  SELECT 'K7 public.internal_* RPC yetkisi: yalniz authenticated' AS kontrol,
         bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE')
                  AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                  AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')) AS ok,
         string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ') AS ayrinti
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'internal\_%'
),
k8 AS (
  SELECT 'K8 internal nesne envanteri' AS kontrol, true AS ok,
         format('tablo: %s | fonksiyon: %s | denetim satiri: %s',
           (SELECT coalesce(string_agg(relname, ', ' ORDER BY relname), 'yok') FROM pg_class WHERE relnamespace = 'internal'::regnamespace AND relkind = 'r'),
           (SELECT coalesce(string_agg(proname, ', ' ORDER BY proname), 'yok') FROM pg_proc WHERE pronamespace = 'internal'::regnamespace),
           (SELECT count(*) FROM internal.access_audit)) AS ayrinti
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4
  UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8
)
SELECT kontrol, CASE WHEN ok THEN 'OK' ELSE 'SORUN' END AS durum, ayrinti FROM hepsi;
