-- =============================================================================
-- FAZ 8 / Asama 18 — Event OS modulleri tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE)
-- Bolum A (8-U uyelik rolu):
--   K1  org_member_set_role yetkisi: authenticated var + anon yok (2)
--   K2  ayna fonksiyonlari ince rolu koruyan CASE'i tasir (fn_sync_agency_member, fn_sync_business_member) (2)
--   K3  org rolu <-> eski tablo rolu tutarsizligi (agency_members / business_members kaynakli uyelikler;
--       map_org_role_to_legacy(org.role) <> eski member_role) (0)
--   K4  bilgi: ince rollu aktif uyelik (sales, project_manager, crew_coordinator, finance)
--   K5  bilgi: owner_seed olmayan owner uyelik
-- Bolum B (8a gorevler) bu dosyaya 8a-DB/01 ile eklenir (K6+).
-- Beklenen: K1-K3 ESIT; K4-K5 BILGI.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 org_member_set_role yetkisi (2)' AS kontrol,
         ((has_function_privilege('authenticated', 'public.org_member_set_role(uuid, public.organization_member_role)', 'EXECUTE'))::int
          + (NOT has_function_privilege('anon', 'public.org_member_set_role(uuid, public.organization_member_role)', 'EXECUTE'))::int)::bigint AS eski,
         2::bigint AS yeni
),
k2 AS (
  SELECT 'K2 ayna CASE (ince rol korunur) (2)' AS kontrol,
         (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('fn_sync_agency_member', 'fn_sync_business_member')
             AND pg_get_functiondef(p.oid) LIKE '%NEW.member_role IS NOT DISTINCT FROM OLD.member_role%')::bigint,
         2::bigint
),
k3 AS (
  SELECT 'K3 org rolu <-> eski rol tutarsizligi (0)' AS kontrol,
         ((SELECT count(*) FROM public.organization_memberships m JOIN public.agency_members a ON a.id = m.id
            WHERE m.legacy_source = 'agency_members' AND public.map_org_role_to_legacy(m.role) <> a.member_role::text)
          + (SELECT count(*) FROM public.organization_memberships m JOIN public.business_members b ON b.id = m.id
              WHERE m.legacy_source = 'business_members' AND public.map_org_role_to_legacy(m.role) <> b.member_role::text))::bigint,
         0::bigint
),
k4 AS (
  SELECT 'K4 ince rollu aktif uyelik (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.organization_memberships
           WHERE status = 'active' AND role IN ('sales', 'project_manager', 'crew_coordinator', 'finance'))::bigint,
         0::bigint
),
k5 AS (
  SELECT 'K5 owner_seed olmayan owner (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.organization_memberships
           WHERE role = 'owner' AND COALESCE(legacy_source, '') <> 'owner_seed')::bigint,
         0::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4 UNION ALL SELECT * FROM k5
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K4 %' OR kontrol LIKE 'K5 %' THEN 'BILGI'
            WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
