-- =============================================================================
-- FAZ 7a / Asama 15 — Teklif dosyasi + portal tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE)
--
--   K1  tablolar (4 public + 1 internal) + 4 enum (9)
--   K2  proposals / proposal_versions / portal_access_links INSERT yetkisi anon+authenticated, tablo + sutun (0 — yalniz RPC)
--   K3  portal_access_links.token_hash sutun SELECT yetkisi anon+authenticated (0 = kapali)
--   K4  internal.proposal_internal_items tablo yetkisi anon/authenticated/service_role (0)
--   K5  7 kurulus RPC + 4 erisim fonksiyonu: authenticated var + anon yok (22) ve 3 portal RPC: anon VE authenticated var (6) -> 28
--   K6  RLS politikasi: proposals 2 + versions 2 + items 4 + links 1 (9)
--   K7  surum toplamlari kalemlerle tutarsiz (subtotal = gorunur kalemler; tax = round(subtotal*rate,2); total = subtotal+tax) (0)
--   K8  current_version_id olmayan teklif (0)
--   K9  dondurma ihlali: sent_at dolu surumde sent_at sonrasi guncellenen kalem (0)
--   K10 bilgi: teklif sayisi*100 + portal baglantisi sayisi
--   K11 bilgi: gecerliligi gecmis ama hala sent/viewed olan teklif (portal acilinca expired olur)
--   K12 bilgi: ekip kaynakli (crew_member_id dolu) ama ic kalemi olmayan kalem
--   K13 durum/surum tutarsizligi: status = draft ile current surumun sent_at NULL olmasi farkli (0)
-- Beklenen: K1-K9, K13 ESIT; K10-K12 BILGI.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 tablolar (5) + enum (4)' AS kontrol,
         (SELECT count(*) FROM pg_tables WHERE (schemaname = 'public' AND tablename IN ('proposals','proposal_versions','proposal_items','portal_access_links'))
                                            OR (schemaname = 'internal' AND tablename = 'proposal_internal_items'))::bigint
         + (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
             WHERE n.nspname = 'public' AND t.typtype = 'e'
               AND t.typname IN ('proposal_source_type','proposal_status','portal_resource_type','internal_item_source'))::bigint AS eski,
         9::bigint AS yeni
),
k2 AS (
  SELECT 'K2 proposals/versions/links INSERT yetkisi anon+authenticated (0)' AS kontrol,
         (SELECT count(*) FROM information_schema.role_table_grants
           WHERE table_schema = 'public' AND table_name IN ('proposals','proposal_versions','portal_access_links')
             AND grantee IN ('anon','authenticated') AND privilege_type = 'INSERT')::bigint
         + (SELECT count(*) FROM information_schema.column_privileges
             WHERE table_schema = 'public' AND table_name IN ('proposals','proposal_versions','portal_access_links')
               AND grantee IN ('anon','authenticated') AND privilege_type = 'INSERT')::bigint,
         0::bigint
),
k3 AS (
  SELECT 'K3 portal_access_links.token_hash SELECT yetkisi (0 = kapali)' AS kontrol,
         (SELECT count(*) FROM information_schema.column_privileges
           WHERE table_schema = 'public' AND table_name = 'portal_access_links' AND column_name = 'token_hash'
             AND grantee IN ('anon','authenticated') AND privilege_type = 'SELECT')::bigint,
         0::bigint
),
k4 AS (
  SELECT 'K4 internal.proposal_internal_items tablo yetkisi (0)' AS kontrol,
         (SELECT count(*) FROM information_schema.role_table_grants
           WHERE table_schema = 'internal' AND table_name = 'proposal_internal_items'
             AND grantee IN ('anon','authenticated','service_role'))::bigint,
         0::bigint
),
k5 AS (
  SELECT 'K5 RPC yetkileri: 11 kurulus (22) + 3 portal anon+auth (6) = 28' AS kontrol,
         (SELECT sum((has_function_privilege('authenticated', f, 'EXECUTE'))::int
                   + (NOT has_function_privilege('anon', f, 'EXECUTE'))::int)
            FROM unnest(ARRAY[
              'public.proposal_create(uuid,text,uuid,uuid,text,text,uuid)',
              'public.proposal_new_version(uuid)',
              'public.proposal_send(uuid,integer)',
              'public.proposal_revoke_link(uuid)',
              'public.proposal_set_status(uuid,text)',
              'public.internal_proposal_items_list(uuid)',
              'public.internal_proposal_item_upsert(uuid,numeric,text)',
              'public.can_access_proposal_row(uuid,uuid,public.proposal_status,text)',
              'public.can_access_proposal(uuid,text)',
              'public.can_access_proposal_version(uuid,text)',
              'public.is_proposal_buyer(uuid)']) AS f)::bigint
         + (SELECT sum((has_function_privilege('authenticated', f, 'EXECUTE'))::int
                     + (has_function_privilege('anon', f, 'EXECUTE'))::int)
              FROM unnest(ARRAY[
                'public.portal_proposal_view(text)',
                'public.portal_proposal_approve(text,text)',
                'public.portal_proposal_request_revision(text,text)']) AS f)::bigint,
         28::bigint
),
k6 AS (
  SELECT 'K6 RLS politikasi (9)' AS kontrol,
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
           AND tablename IN ('proposals','proposal_versions','proposal_items','portal_access_links'))::bigint,
         9::bigint
),
k7 AS (
  SELECT 'K7 surum toplamlari kalemlerle tutarsiz (0)' AS kontrol,
         (SELECT count(*) FROM public.proposal_versions v
           WHERE v.subtotal <> COALESCE((SELECT sum(i.total_client_price) FROM public.proposal_items i
                                          WHERE i.proposal_version_id = v.id AND i.is_visible_to_client), 0)
              OR v.tax_amount <> round(v.subtotal * v.tax_rate, 2)
              OR v.total_amount <> v.subtotal + v.tax_amount)::bigint,
         0::bigint
),
k8 AS (
  SELECT 'K8 gecerli surumu olmayan teklif (0)' AS kontrol,
         (SELECT count(*) FROM public.proposals WHERE current_version_id IS NULL)::bigint,
         0::bigint
),
k9 AS (
  SELECT 'K9 dondurma ihlali: gonderimden sonra degisen kalem (0)' AS kontrol,
         (SELECT count(*) FROM public.proposal_items i JOIN public.proposal_versions v ON v.id = i.proposal_version_id
           WHERE v.sent_at IS NOT NULL AND i.updated_at > v.sent_at)::bigint,
         0::bigint
),
k10 AS (
  SELECT 'K10 teklif*100 + portal baglantisi (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.proposals)::bigint * 100 + (SELECT count(*) FROM public.portal_access_links)::bigint,
         0::bigint
),
k11 AS (
  SELECT 'K11 gecerliligi gecmis ama sent/viewed teklif (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.proposals p JOIN public.proposal_versions v ON v.id = p.current_version_id
           WHERE p.status IN ('sent','viewed') AND v.valid_until IS NOT NULL AND v.valid_until < now())::bigint,
         0::bigint
),
k12 AS (
  SELECT 'K12 ekip kaynakli ama ic kalemsiz kalem (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.proposal_items i
           WHERE i.crew_member_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM internal.proposal_internal_items x WHERE x.proposal_item_id = i.id))::bigint,
         0::bigint
),
k13 AS (
  SELECT 'K13 durum/surum tutarsizligi (0)' AS kontrol,
         (SELECT count(*) FROM public.proposals p JOIN public.proposal_versions v ON v.id = p.current_version_id
           WHERE (p.status = 'draft') <> (v.sent_at IS NULL))::bigint,
         0::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4
  UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8
  UNION ALL SELECT * FROM k9 UNION ALL SELECT * FROM k10 UNION ALL SELECT * FROM k11 UNION ALL SELECT * FROM k12
  UNION ALL SELECT * FROM k13
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K10 %' OR kontrol LIKE 'K11 %' OR kontrol LIKE 'K12 %' THEN 'BILGI'
            WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
