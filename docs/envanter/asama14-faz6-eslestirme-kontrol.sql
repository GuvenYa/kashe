-- =============================================================================
-- FAZ 6 / Asama 14 — Eslestirme ve ekip tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE)
--
--   K1  tablolar (4 public + 1 internal) + 7 enum (12)
--   K2  match_runs / match_candidates: anon + authenticated INSERT/UPDATE/DELETE yetkisi (0 — yalniz RPC yazar)
--   K3  internal.crew_member_commercials tablo yetkisi anon/authenticated/service_role (0)
--   K4  6 RPC + 2 erisim fonksiyonu: authenticated EXECUTE var + anon yok (16)
--   K5  RLS politikasi: match_runs 1 + match_candidates 1 + crews 4 + crew_members 4 (10)
--   K6  match_candidates satir turu tutarsiz: role_id dolu+coverage dolu / role_id NULL+coverage NULL (0 — CHECK var)
--   K7  bilgi: kaynagi silinmis ekip uyesi (talent_record_id ve provider_id ikisi de NULL)
--   K8  events.status = matching ama kosusu yok (0)
--   K9  kosu basina rol basina limit ustu aday (profesyonel > limit_per_role, ajans > limit_orgs) (0)
--   K10 bilgi: kosu sayisi * 100 + ekip sayisi
--   K11 coverage_ratio dolu ama saglayici organization degil; role_id dolu ama saglayici professional degil (0)
--   K12 confirmed ekipte zorunlu rol onaylanmis uyeyle kapsanmamis (0 — tetikleyici var; kalici kontrol)
--   K13 ic goruntu satiri kurulusu ekibin kurulusundan farkli (0)
-- Beklenen: K1-K6, K8, K9, K11-K13 ESIT; K7, K10 BILGI.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 tablolar (5) + enum (7)' AS kontrol,
         (SELECT count(*) FROM pg_tables WHERE (schemaname = 'public' AND tablename IN ('match_runs','match_candidates','crews','crew_members'))
                                            OR (schemaname = 'internal' AND tablename = 'crew_member_commercials'))::bigint
         + (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
             WHERE n.nspname = 'public' AND t.typtype = 'e'
               AND t.typname IN ('match_strategy','crew_source_policy','crew_objective','crew_status',
                                 'crew_member_pool_origin','crew_member_status','crew_rate_source'))::bigint AS eski,
         12::bigint AS yeni
),
k2 AS (
  SELECT 'K2 match_* yazma yetkisi anon+authenticated (0)' AS kontrol,
         (SELECT count(*) FROM information_schema.role_table_grants
           WHERE table_schema = 'public' AND table_name IN ('match_runs','match_candidates')
             AND grantee IN ('anon','authenticated') AND privilege_type IN ('INSERT','UPDATE','DELETE'))::bigint
         + (SELECT count(*) FROM information_schema.column_privileges
             WHERE table_schema = 'public' AND table_name IN ('match_runs','match_candidates')
               AND grantee IN ('anon','authenticated') AND privilege_type IN ('INSERT','UPDATE'))::bigint,
         0::bigint
),
k3 AS (
  SELECT 'K3 internal.crew_member_commercials tablo yetkisi (0)' AS kontrol,
         (SELECT count(*) FROM information_schema.role_table_grants
           WHERE table_schema = 'internal' AND table_name = 'crew_member_commercials'
             AND grantee IN ('anon','authenticated','service_role'))::bigint,
         0::bigint
),
k4 AS (
  SELECT 'K4 6 RPC + 2 erisim fonksiyonu: authenticated var + anon yok (16)' AS kontrol,
         (SELECT sum((has_function_privilege('authenticated', f, 'EXECUTE'))::int
                   + (NOT has_function_privilege('anon', f, 'EXECUTE'))::int)
            FROM unnest(ARRAY[
              'public.run_event_match(uuid,public.match_strategy)',
              'public.mark_match_candidates_shown(uuid,uuid[])',
              'public.mark_match_candidate_clicked(uuid)',
              'public.crew_member_commercial_snapshot(uuid)',
              'public.internal_crew_commercials_list(uuid)',
              'public.internal_crew_commercial_upsert(uuid,numeric,text,character,numeric,text)',
              'public.can_access_crew_row(uuid,uuid,text)',
              'public.can_access_crew(uuid,text)']) AS f)::bigint,
         16::bigint
),
k5 AS (
  SELECT 'K5 RLS politikasi (10)' AS kontrol,
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
           AND tablename IN ('match_runs','match_candidates','crews','crew_members'))::bigint,
         10::bigint
),
k6 AS (
  SELECT 'K6 aday satir turu tutarsiz (0)' AS kontrol,
         (SELECT count(*) FROM public.match_candidates
           WHERE NOT ((role_id IS NOT NULL AND coverage_ratio IS NULL AND full_service_eligible IS NULL)
                   OR (role_id IS NULL AND coverage_ratio IS NOT NULL AND full_service_eligible IS NOT NULL)))::bigint,
         0::bigint
),
k7 AS (
  SELECT 'K7 kaynagi silinmis ekip uyesi (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.crew_members WHERE talent_record_id IS NULL AND provider_id IS NULL)::bigint,
         0::bigint
),
k8 AS (
  SELECT 'K8 matching durumunda kosusuz etkinlik (0)' AS kontrol,
         (SELECT count(*) FROM public.events e WHERE e.status = 'matching'
             AND NOT EXISTS (SELECT 1 FROM public.match_runs r WHERE r.event_id = e.id))::bigint,
         0::bigint
),
k9 AS (
  SELECT 'K9 kosu basina limit ustu aday (0)' AS kontrol,
         (SELECT count(*) FROM (
            SELECT c.match_run_id, c.role_id, count(*) AS n, max(COALESCE((r.params->>'limit_per_role')::int, 20)) AS lim_role,
                   max(COALESCE((r.params->>'limit_orgs')::int, 10)) AS lim_org
              FROM public.match_candidates c JOIN public.match_runs r ON r.id = c.match_run_id
             GROUP BY c.match_run_id, c.role_id) x
           WHERE (x.role_id IS NOT NULL AND x.n > x.lim_role) OR (x.role_id IS NULL AND x.n > x.lim_org))::bigint,
         0::bigint
),
k10 AS (
  SELECT 'K10 kosu sayisi*100 + ekip sayisi (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.match_runs)::bigint * 100 + (SELECT count(*) FROM public.crews)::bigint,
         0::bigint
),
k11 AS (
  SELECT 'K11 aday turu ile saglayici turu uyumsuz (0)' AS kontrol,
         (SELECT count(*) FROM public.match_candidates c JOIN public.providers p ON p.id = c.provider_id
           WHERE (c.role_id IS NULL AND p.provider_type <> 'organization')
              OR (c.role_id IS NOT NULL AND p.provider_type <> 'professional'))::bigint,
         0::bigint
),
k12 AS (
  SELECT 'K12 confirmed ekipte kapsanmamis zorunlu rol (0)' AS kontrol,
         (SELECT count(*) FROM public.crews c
            JOIN public.event_requirements rq ON rq.event_id = c.event_id AND rq.is_required
           WHERE c.status = 'confirmed'
             AND (SELECT count(*) FROM public.crew_members m WHERE m.crew_id = c.id AND m.role_id = rq.role_id AND m.status = 'confirmed') < rq.quantity)::bigint,
         0::bigint
),
k13 AS (
  SELECT 'K13 ic goruntu kurulusu ekipten farkli (0)' AS kontrol,
         (SELECT count(*) FROM internal.crew_member_commercials x
            JOIN public.crew_members m ON m.id = x.crew_member_id
            JOIN public.crews c ON c.id = m.crew_id
           WHERE c.organization_id IS DISTINCT FROM x.organization_id)::bigint,
         0::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4
  UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8
  UNION ALL SELECT * FROM k9 UNION ALL SELECT * FROM k10 UNION ALL SELECT * FROM k11 UNION ALL SELECT * FROM k12
  UNION ALL SELECT * FROM k13
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K7 %' OR kontrol LIKE 'K10 %' THEN 'BILGI'
            WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
