-- =============================================================================
-- FAZ 7b / Asama 17 — RFP tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE)
--
--   K1  tablolar (rfps, rfp_items, rfp_invites) + enum (rfp_status, rfp_invite_status) (5)
--   K2  rfps / rfp_invites tablo INSERT yetkisi anon+authenticated (0) + rfp_items sutun INSERT yetkisi authenticated (8) -> 8
--   K3  rfp_items.budget_hint_min/max sutun SELECT yetkisi anon+authenticated (0 = saticiya kapali)
--   K4  RPC/erisim yetkileri: 11 RPC + 6 erisim fonksiyonu, authenticated var + anon yok (34)
--   K5  RLS politikasi: rfps 2 + rfp_items 4 + rfp_invites 1 (7)
--   K6  teklif politikalari 7b surumu: proposals_select alici kurulusu tasir + proposal_items_select gonderilmis surum kosulu (2)
--   K7  proposals.rfp_id FK (1) + notifications_type_check 'rfp' icerir (1) -> 2
--   K8  davet tutarsizligi: responded ama proposal_id bos / proposal_id baska talebe ait (0)
--   K9  RFP yanitina acilmis portal baglantisi (0)
--   K10 RFP yanitinda alici kurulus talebin kurulusu degil ya da source_type rfp_response degil (0)
--   K11 awarded RFP'de secilen teklif approved degil (0)
--   K12 bilgi: RFP*100 + davet
--   K13 bilgi: yanit bekleyen RFP (sent/collecting)
-- Beklenen: K1-K11 ESIT; K12-K13 BILGI.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 tablolar (3) + enum (2)' AS kontrol,
         (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('rfps','rfp_items','rfp_invites'))::bigint
         + (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
             WHERE n.nspname = 'public' AND t.typtype = 'e' AND t.typname IN ('rfp_status','rfp_invite_status'))::bigint AS eski,
         5::bigint AS yeni
),
k2 AS (
  SELECT 'K2 rfps/rfp_invites INSERT 0 + rfp_items sutun INSERT 8 = 8' AS kontrol,
         (SELECT count(*) FROM information_schema.role_table_grants
           WHERE table_schema = 'public' AND table_name IN ('rfps','rfp_invites') AND grantee IN ('anon','authenticated') AND privilege_type = 'INSERT')::bigint
         + (SELECT count(*) FROM information_schema.column_privileges
             WHERE table_schema = 'public' AND table_name = 'rfp_items' AND grantee = 'authenticated' AND privilege_type = 'INSERT')::bigint,
         8::bigint
),
k3 AS (
  SELECT 'K3 rfp_items butce ipucu SELECT yetkisi (0)' AS kontrol,
         (SELECT count(*) FROM information_schema.column_privileges
           WHERE table_schema = 'public' AND table_name = 'rfp_items' AND column_name IN ('budget_hint_min','budget_hint_max')
             AND grantee IN ('anon','authenticated') AND privilege_type = 'SELECT')::bigint,
         0::bigint
),
k4 AS (
  SELECT 'K4 RPC/erisim yetkileri (34)' AS kontrol,
         (SELECT sum((has_function_privilege('authenticated', f, 'EXECUTE'))::int + (NOT has_function_privilege('anon', f, 'EXECUTE'))::int)
            FROM unnest(ARRAY[
              'public.rfp_create(uuid,uuid,text,text,timestamptz)', 'public.rfp_invite(uuid,uuid)', 'public.rfp_send(uuid)',
              'public.rfp_close(uuid)', 'public.rfp_cancel(uuid)', 'public.rfp_request_revision(uuid,text)', 'public.rfp_award(uuid,uuid)',
              'public.rfp_mark_viewed(uuid)', 'public.rfp_invite_decline(uuid)', 'public.proposal_create_from_rfp(uuid,uuid)', 'public.rfp_detail(uuid)',
              'public.can_access_rfp_row(uuid,uuid,public.rfp_status,text)', 'public.can_access_rfp(uuid,text)', 'public.can_access_rfp_invite_row(uuid,uuid)',
              'public.can_access_proposal_row(uuid,uuid,uuid,uuid,public.proposal_status,text)', 'public.fn_faz7b_version_sent(uuid)',
              'public.fn_faz7b_provider_org_permission(uuid,text)']) AS f)::bigint,
         34::bigint
),
k5 AS (
  SELECT 'K5 RLS politikasi rfp tablolari (7)' AS kontrol,
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('rfps','rfp_items','rfp_invites'))::bigint,
         7::bigint
),
k6 AS (
  SELECT 'K6 teklif politikalari 7b surumu (2)' AS kontrol,
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'proposals' AND policyname = 'proposals_select' AND qual LIKE '%buyer_organization_id%')::bigint
         + (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'proposal_items' AND policyname = 'proposal_items_select' AND qual LIKE '%fn_faz7b_version_sent%')::bigint,
         2::bigint
),
k7 AS (
  SELECT 'K7 proposals.rfp_id FK + bildirim tipi rfp (2)' AS kontrol,
         (SELECT count(*) FROM pg_constraint WHERE conname = 'proposals_rfp_id_fkey')::bigint
         + (SELECT count(*) FROM pg_constraint WHERE conname = 'notifications_type_check' AND pg_get_constraintdef(oid) LIKE '%''rfp''%')::bigint,
         2::bigint
),
k8 AS (
  SELECT 'K8 davet tutarsizligi (0)' AS kontrol,
         (SELECT count(*) FROM public.rfp_invites i LEFT JOIN public.proposals p ON p.id = i.proposal_id
           WHERE (i.status = 'responded' AND i.proposal_id IS NULL)
              OR (i.proposal_id IS NOT NULL AND p.rfp_id IS DISTINCT FROM i.rfp_id))::bigint,
         0::bigint
),
k9 AS (
  SELECT 'K9 RFP yanitina portal baglantisi (0)' AS kontrol,
         (SELECT count(*) FROM public.portal_access_links l JOIN public.proposals p ON p.id = l.resource_id
           WHERE l.resource_type = 'proposal' AND p.rfp_id IS NOT NULL)::bigint,
         0::bigint
),
k10 AS (
  SELECT 'K10 RFP yaniti alici/kaynak tutarsizligi (0)' AS kontrol,
         (SELECT count(*) FROM public.proposals p JOIN public.rfps r ON r.id = p.rfp_id
           WHERE p.buyer_organization_id IS DISTINCT FROM r.organization_id OR p.source_type <> 'rfp_response')::bigint,
         0::bigint
),
k11 AS (
  SELECT 'K11 awarded RFP secilen teklif approved degil (0)' AS kontrol,
         (SELECT count(*) FROM public.rfps r LEFT JOIN public.proposals p ON p.id = r.awarded_proposal_id
           WHERE r.status = 'awarded' AND (p.id IS NULL OR p.status <> 'approved' OR p.rfp_id IS DISTINCT FROM r.id))::bigint,
         0::bigint
),
k12 AS (
  SELECT 'K12 RFP*100 + davet (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.rfps)::bigint * 100 + (SELECT count(*) FROM public.rfp_invites)::bigint,
         0::bigint
),
k13 AS (
  SELECT 'K13 yanit bekleyen RFP (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.rfps WHERE status IN ('sent','collecting'))::bigint,
         0::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4
  UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8
  UNION ALL SELECT * FROM k9 UNION ALL SELECT * FROM k10 UNION ALL SELECT * FROM k11 UNION ALL SELECT * FROM k12
  UNION ALL SELECT * FROM k13
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K12 %' OR kontrol LIKE 'K13 %' THEN 'BILGI'
            WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
