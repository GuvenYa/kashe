-- =============================================================================
-- FAZ 5 / Asama 13 — Yetenek havuzu tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE)
--
--   K1  tablolar (2 public + 1 internal) + 6 enum (9)
--   K2  talent_pool acik modul sayisi = agency kurulus sayisi (fark 0)
--   K3  business kurulusunda talent_pool acik (0)
--   K4  dolum: legacy_agency_member_id dolu kayit = eslesebilen agency_members satiri (fark 0)
--   K5  havuz kaydi OLMAYAN agency_members satiri — kayma (0)
--   K6  talent_id dolu ama source external_manual (0)
--   K7  talents.canonical_email/phone sutun yetkisi anon + authenticated SELECT (0 = kapali)
--   K8  canonical_email dolu talents = e-postali profili olan talents (fark 0)
--   K9  internal.organization_talent_rates tablo yetkisi anon/authenticated/service_role (0)
--   K10 9 RPC: authenticated EXECUTE var + anon yok (18)
--   K11 records + roles RLS politikasi (8)
--   K12 kayit basina >1 birincil rol (0)
--   K13 invitation_token sutunu authenticated SELECT (0 = kapali)
--   K14 bilgi: kayit sayisi kaynaga gore marketplace_linked*1e4 + invited*100 + external_manual
-- Beklenen: K1-K13 ESIT, K14 BILGI.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 tablolar (3) + enum (6)' AS kontrol,
         (SELECT count(*) FROM pg_tables WHERE (schemaname = 'public' AND tablename IN ('organization_talent_records','organization_talent_record_roles'))
                                            OR (schemaname = 'internal' AND tablename = 'organization_talent_rates'))::bigint
         + (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
             WHERE n.nspname = 'public' AND t.typtype = 'e'
               AND t.typname IN ('talent_record_source','talent_record_visibility','talent_relationship_type',
                                 'talent_record_status','talent_invitation_status','talent_cost_basis'))::bigint AS eski,
         9::bigint AS yeni
),
k2 AS (
  SELECT 'K2 talent_pool acik modul = agency kurulus (fark)' AS kontrol,
         (SELECT count(*) FROM public.organization_modules m JOIN public.organizations o ON o.id = m.organization_id
           WHERE m.module_key = 'talent_pool' AND m.is_enabled AND o.account_type = 'agency')::bigint,
         (SELECT count(*) FROM public.organizations WHERE account_type = 'agency')::bigint
),
k3 AS (
  SELECT 'K3 business kurulusunda talent_pool acik' AS kontrol,
         (SELECT count(*) FROM public.organization_modules m JOIN public.organizations o ON o.id = m.organization_id
           WHERE m.module_key = 'talent_pool' AND m.is_enabled AND o.account_type <> 'agency')::bigint,
         0::bigint
),
k4 AS (
  SELECT 'K4 dolum izi = eslesebilen agency_members (fark)' AS kontrol,
         (SELECT count(*) FROM public.organization_talent_records WHERE legacy_agency_member_id IS NOT NULL)::bigint,
         (SELECT count(*) FROM public.agency_members a
           WHERE EXISTS (SELECT 1 FROM public.organizations o WHERE o.legacy_profile_id = a.agency_id)
             AND EXISTS (SELECT 1 FROM public.talents t WHERE t.user_id = a.professional_id AND t.claim_status <> 'merged'))::bigint
),
k5 AS (
  SELECT 'K5 havuz kaydi olmayan agency_members (kayma)' AS kontrol,
         (SELECT count(*) FROM public.agency_members a
           JOIN public.organizations o ON o.legacy_profile_id = a.agency_id
           JOIN public.talents t ON t.user_id = a.professional_id AND t.claim_status <> 'merged'
          WHERE NOT EXISTS (SELECT 1 FROM public.organization_talent_records r
                             WHERE r.organization_id = o.id AND r.talent_id = t.id))::bigint,
         0::bigint
),
k6 AS (
  SELECT 'K6 talent_id dolu ama source external_manual' AS kontrol,
         (SELECT count(*) FROM public.organization_talent_records WHERE talent_id IS NOT NULL AND source = 'external_manual')::bigint,
         0::bigint
),
k7 AS (
  SELECT 'K7 talents.canonical_* sutun yetkisi anon+authenticated (0 = kapali)' AS kontrol,
         (SELECT count(*) FROM information_schema.column_privileges
           WHERE table_schema = 'public' AND table_name = 'talents'
             AND column_name IN ('canonical_email','canonical_phone')
             AND grantee IN ('anon','authenticated') AND privilege_type = 'SELECT')::bigint,
         0::bigint
),
k8 AS (
  SELECT 'K8 canonical_email dolu talents = e-postali profil (fark)' AS kontrol,
         (SELECT count(*) FROM public.talents WHERE canonical_email IS NOT NULL)::bigint,
         (SELECT count(*) FROM public.talents t JOIN public.profiles p ON p.id = t.user_id
           WHERE public.norm_email(p.email) IS NOT NULL)::bigint
),
k9 AS (
  SELECT 'K9 internal.organization_talent_rates tablo yetkisi (0)' AS kontrol,
         (SELECT count(*) FROM information_schema.role_table_grants
           WHERE table_schema = 'internal' AND table_name = 'organization_talent_rates'
             AND grantee IN ('anon','authenticated','service_role'))::bigint,
         0::bigint
),
k10 AS (
  SELECT 'K10 9 RPC: authenticated var + anon yok (18)' AS kontrol,
         (SELECT sum((has_function_privilege('authenticated', f, 'EXECUTE'))::int
                   + (NOT has_function_privilege('anon', f, 'EXECUTE'))::int)
            FROM unnest(ARRAY[
              'public.find_talent_by_contact(uuid,text,text)',
              'public.send_talent_record_invitation(uuid)',
              'public.claim_talent_record(uuid)',
              'public.claim_talent_record_by_id(uuid)',
              'public.decline_talent_record_invitation(uuid)',
              'public.claimable_talent_records_for_me()',
              'public.internal_talent_rates_list(uuid,uuid)',
              'public.internal_talent_rate_upsert(uuid,uuid,integer,numeric,text,character,date,text)',
              'public.internal_talent_rate_close(uuid,uuid,date)']) AS f)::bigint,
         18::bigint
),
k11 AS (
  SELECT 'K11 records + roles RLS politikasi (8)' AS kontrol,
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
           AND tablename IN ('organization_talent_records','organization_talent_record_roles'))::bigint,
         8::bigint
),
k12 AS (
  SELECT 'K12 kayit basina >1 birincil rol' AS kontrol,
         (SELECT count(*) FROM (SELECT record_id FROM public.organization_talent_record_roles WHERE is_primary GROUP BY 1 HAVING count(*) > 1) x)::bigint,
         0::bigint
),
k13 AS (
  SELECT 'K13 invitation_token sutunu authenticated SELECT (0 = kapali)' AS kontrol,
         (SELECT count(*) FROM information_schema.column_privileges
           WHERE table_schema = 'public' AND table_name = 'organization_talent_records'
             AND column_name = 'invitation_token' AND grantee IN ('anon','authenticated'))::bigint,
         0::bigint
),
k14 AS (
  SELECT 'K14 kayit sayisi marketplace_linked*1e4 + invited*100 + external_manual (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.organization_talent_records WHERE source = 'marketplace_linked')::bigint * 10000
         + (SELECT count(*) FROM public.organization_talent_records WHERE source = 'invited')::bigint * 100
         + (SELECT count(*) FROM public.organization_talent_records WHERE source = 'external_manual')::bigint,
         0::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4
  UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8
  UNION ALL SELECT * FROM k9 UNION ALL SELECT * FROM k10 UNION ALL SELECT * FROM k11 UNION ALL SELECT * FROM k12
  UNION ALL SELECT * FROM k13 UNION ALL SELECT * FROM k14
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K14%' THEN 'BILGI'
            WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
