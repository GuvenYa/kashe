-- =============================================================================
-- FAZ 8 / Asama 18 — Event OS modulleri tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE)
-- Bolum A (8-U uyelik rolu):
--   K1  org_member_set_role yetkisi: authenticated var + anon yok (2)
--   K2  ayna fonksiyonlari ince rolu koruyan CASE'i tasir (fn_sync_agency_member, fn_sync_business_member) (2)
--   K3  org rolu <-> eski tablo rolu tutarsizligi (agency_members / business_members kaynakli uyelikler;
--       map_org_role_to_legacy(org.role) <> eski member_role) (0)
--   K4  bilgi: ince rollu aktif uyelik (sales, project_manager, crew_coordinator, finance)
--   K5  bilgi: owner_seed olmayan owner uyelik
-- Bolum B (8a gorevler + aktivite, hijyen_03):
--   K6  tablolar: tasks + activity_logs + organizations_public gorunumu (3)
--   K7  task_status enum 5 deger (5)
--   K8  politikalar: tasks 4 (select/insert/update/delete) + activity_logs 1 (5)
--   K9  yetki: anon tasks SELECT yok, authenticated activity_logs INSERT yok, authenticated organizations_public SELECT var (3)
--   K10 tetikleyiciler: tasks uzerinde 3 (validate, before_delete, activity) (3)
--   K11 tutarsizlik: done gorevde completed_at bos ya da done olmayan gorevde dolu (0)
--   K12 tutarsizlik: atanan uye kurulusun aktif uyesi degil (0)
--   K13 tutarsizlik: etkinlige bagli gorevin etkinligi baska kurulusta (0)
--   K14 modul: tasks modulu KAPALI ajans kurulusu (0)
--   K15 bildirim: notifications_type_check 'task' icerir + e-posta kuyrugu indeksi 'task' icerir (2)
--   K16 bilgi: ASCII kalan eski bildirim metni (gonderdi/icin/baska) — hijyen_03 sonrasi 0 beklenir
--   K17 bilgi: gorev sayisi (eski) ve aktivite satiri (yeni)
--   K18 bilgi: sahibi bir kurulusun sahibi olan ama kurulussuz (organization_id NULL) etkinlik — 8a-DB/02 dolumu oncesi/sonrasi
-- Bolum C (8b CRM):
--   K19 nesneler: contacts + crm_leads tablolari + crm_contact_suggestions gorunumu + crm_lead_stage enum 5 deger (8)
--   K20 yetki matrisi: owner/admin/sales crm.manage, project_manager/finance crm.view, crew_coordinator/viewer crm yok (7)
--   K21 politikalar + tetikleyiciler: contacts 4 + crm_leads 4 politika; contacts 2 + crm_leads 2 + proposals 1 tetikleyici (13)
--   K22 tutarsizlik: firsatin kisisi/etkinligi/teklifi baska kurulusta; sahip aktif uye degil; won/lost zaman damgasi asamayla
--       uyumsuz; teklifin buyer_contact_id kisisi satici kurulusta degil (0)
--   K23 modul + bildirim: crm modulu KAPALI ajans (0) + notifications_type_check 'crm' + e-posta kuyrugu indeksi 'crm' (2) -> (2)
--   K24 bilgi: kisi / firsat sayisi
-- Bolum D (8c tedarikciler + kisa liste):
--   K25 nesneler: suppliers, event_suppliers, supplier_shortlists, supplier_shortlist_items, internal.event_supplier_costs,
--       RPC internal_event_supplier_costs_list / internal_event_supplier_cost_set, user_has_org_permission (8)
--   K26 yetki matrisi: owner/admin/project_manager/crew_coordinator suppliers.manage, sales/finance yalniz view, viewer yok (7)
--   K27 politikalar + tetikleyiciler: 4 tablo x 4 politika (16) + trg_faz8c_% tetikleyici (public 8 + internal 1) (25)
--   K28 tutarsizlik: atamanin etkinligi/tedarikcisi baska kurulusta; confirmed_at durumla uyumsuz; arsivdeki tedarikci acik
--       atamada (planned/confirmed); kisa listenin etkinligi baska kurulusta; kalem kurulusu listeden farkli; kalem kendi
--       saglayicisi; tedarikci kendi saglayicisina bagli; ic maliyet kurulusu atamadan farkli (0)
--   K29 modul + RPC yetkisi: suppliers KAPALI ajans (0) + supplier_search KAPALI business (0) + 2 RPC authenticated var,
--       anon yok (4) -> (4)
--   K30 bilgi: tedarikci / kisa liste sayisi
--   K31 bilgi: crm.view tasimayan sahibi olan acik firsat (8c kurali oncesi kayitlar; 0 beklenir)
-- Bolum E (hijyen_04 bildirim temizligi):
--   K32 nesneler: fn_hijyen04_lead/task_notif_cleanup + crm_leads/tasks uzerinde 2 tetikleyici (4)
--   K33 tutarsizlik: hedefi olmayan crm (firsat=) / task (gorev=) bildirimi (0)
-- Beklenen: K1-K3, K6-K15, K19-K23, K25-K29, K32-K33 ESIT; K4-K5, K16-K18, K24, K30-K31 BILGI.
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
k6 AS (
  SELECT 'K6 tasks + activity_logs + organizations_public (3)' AS kontrol,
         ((to_regclass('public.tasks') IS NOT NULL)::int + (to_regclass('public.activity_logs') IS NOT NULL)::int
          + (to_regclass('public.organizations_public') IS NOT NULL)::int)::bigint,
         3::bigint
),
k7 AS (
  SELECT 'K7 task_status enum (5)' AS kontrol,
         (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname = 'public' AND t.typname = 'task_status')::bigint,
         5::bigint
),
k8 AS (
  SELECT 'K8 politikalar tasks 4 + activity_logs 1 (5)' AS kontrol,
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('tasks', 'activity_logs'))::bigint,
         5::bigint
),
k9 AS (
  SELECT 'K9 yetki: anon tasks yok, auth activity INSERT yok, auth organizations_public var (3)' AS kontrol,
         ((NOT has_table_privilege('anon', 'public.tasks', 'SELECT'))::int
          + (NOT has_table_privilege('authenticated', 'public.activity_logs', 'INSERT'))::int
          + (has_table_privilege('authenticated', 'public.organizations_public', 'SELECT'))::int)::bigint,
         3::bigint
),
k10 AS (
  SELECT 'K10 tasks tetikleyicileri (3)' AS kontrol,
         (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.tasks'::regclass AND NOT tgisinternal
           AND tgname IN ('trg_faz8a_task_validate', 'trg_faz8a_task_before_delete', 'trg_faz8a_task_activity'))::bigint,
         3::bigint
),
k11 AS (
  SELECT 'K11 done <-> completed_at tutarsizligi (0)' AS kontrol,
         (SELECT count(*) FROM public.tasks
           WHERE (status = 'done' AND completed_at IS NULL) OR (status <> 'done' AND completed_at IS NOT NULL))::bigint,
         0::bigint
),
k12 AS (
  SELECT 'K12 atanan uye kurulus disi (0)' AS kontrol,
         (SELECT count(*) FROM public.tasks t
           WHERE t.assignee_user_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM public.organization_memberships om
              WHERE om.organization_id = t.organization_id AND om.user_id = t.assignee_user_id AND om.status = 'active'))::bigint,
         0::bigint
),
k13 AS (
  SELECT 'K13 gorev etkinligi baska kurulusta (0)' AS kontrol,
         (SELECT count(*) FROM public.tasks t JOIN public.events e ON e.id = t.event_id
           WHERE e.organization_id IS DISTINCT FROM t.organization_id)::bigint,
         0::bigint
),
k14 AS (
  SELECT 'K14 tasks modulu kapali ajans (0)' AS kontrol,
         (SELECT count(*) FROM public.organizations o
           WHERE o.account_type = 'agency' AND NOT public.org_module_enabled(o.id, 'tasks'))::bigint,
         0::bigint
),
k15 AS (
  SELECT 'K15 bildirim tipi task + e-posta indeksi (2)' AS kontrol,
         ((SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass
            AND conname = 'notifications_type_check' AND pg_get_constraintdef(oid) LIKE '%''task''%')
          + (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'
              AND indexname = 'notifications_email_pending_idx' AND indexdef LIKE '%task%'))::bigint,
         2::bigint
),
k16 AS (
  SELECT 'K16 ASCII kalan eski bildirim metni (bilgi; 0 beklenir)' AS kontrol,
         (SELECT count(*) FROM public.notifications WHERE type IN ('rfp', 'proposal')
           AND (body LIKE '% teklif gonderdi: %' OR body LIKE 'Teklifin icin revizyon%' OR body LIKE 'Teklif talebi baska%'))::bigint,
         0::bigint
),
k17 AS (
  SELECT 'K17 gorev (eski) / aktivite (yeni) sayisi (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.tasks)::bigint,
         (SELECT count(*) FROM public.activity_logs)::bigint
),
k18 AS (
  SELECT 'K18 kurulus sahibinin kurulussuz etkinligi (bilgi; DB/02 sonrasi 0)' AS kontrol,
         (SELECT count(*) FROM public.events e
           WHERE e.organization_id IS NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.owner_user_id = e.owner_user_id))::bigint,
         0::bigint
),
k19 AS (
  SELECT 'K19 CRM nesneleri (8)' AS kontrol,
         ((to_regclass('public.contacts') IS NOT NULL)::int
          + (to_regclass('public.crm_leads') IS NOT NULL)::int
          + (to_regclass('public.crm_contact_suggestions') IS NOT NULL)::int
          + (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'crm_lead_stage'))::bigint,
         8::bigint
),
k20 AS (
  SELECT 'K20 crm yetki matrisi (7)' AS kontrol,
         (('crm.manage' = ANY (public.org_role_permissions('owner')))::int
          + ('crm.manage' = ANY (public.org_role_permissions('admin')))::int
          + ('crm.manage' = ANY (public.org_role_permissions('sales')))::int
          + ('crm.view' = ANY (public.org_role_permissions('project_manager')) AND NOT 'crm.manage' = ANY (public.org_role_permissions('project_manager')))::int
          + ('crm.view' = ANY (public.org_role_permissions('finance')) AND NOT 'crm.manage' = ANY (public.org_role_permissions('finance')))::int
          + (NOT 'crm.view' = ANY (public.org_role_permissions('crew_coordinator')))::int
          + (NOT 'crm.view' = ANY (public.org_role_permissions('viewer')))::int)::bigint,
         7::bigint
),
k21 AS (
  SELECT 'K21 crm politika + tetikleyici (13)' AS kontrol,
         ((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('contacts', 'crm_leads'))
          + (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
              WHERE NOT t.tgisinternal AND c.relname IN ('contacts', 'crm_leads', 'proposals') AND t.tgname LIKE 'trg_faz8b_%'))::bigint,
         13::bigint
),
k22 AS (
  SELECT 'K22 crm tutarsizlik (0)' AS kontrol,
         ((SELECT count(*) FROM public.crm_leads l JOIN public.contacts c ON c.id = l.contact_id WHERE c.organization_id <> l.organization_id)
          + (SELECT count(*) FROM public.crm_leads l JOIN public.events e ON e.id = l.event_id WHERE e.organization_id IS DISTINCT FROM l.organization_id)
          + (SELECT count(*) FROM public.crm_leads l JOIN public.proposals p ON p.id = l.proposal_id WHERE p.seller_organization_id <> l.organization_id)
          + (SELECT count(*) FROM public.crm_leads l WHERE l.owner_user_id IS NOT NULL AND NOT EXISTS (
               SELECT 1 FROM public.organization_memberships om WHERE om.organization_id = l.organization_id AND om.user_id = l.owner_user_id AND om.status = 'active'))
          + (SELECT count(*) FROM public.crm_leads WHERE (stage = 'won') <> (won_at IS NOT NULL) OR (stage = 'lost') <> (lost_at IS NOT NULL))
          + (SELECT count(*) FROM public.proposals p JOIN public.contacts c ON c.id = p.buyer_contact_id WHERE c.organization_id <> p.seller_organization_id))::bigint,
         0::bigint
),
k23 AS (
  SELECT 'K23 crm modul (ajans kapali 0) + bildirim tipi/indeks (2)' AS kontrol,
         ((SELECT count(*) FROM public.organizations o WHERE o.account_type = 'agency' AND NOT public.org_module_enabled(o.id, 'crm'))
          + (SELECT count(*) FROM pg_constraint WHERE conname = 'notifications_type_check' AND pg_get_constraintdef(oid) LIKE '%''crm''%')
          + (SELECT count(*) FROM pg_indexes WHERE indexname = 'notifications_email_pending_idx' AND indexdef LIKE '%crm%'))::bigint,
         2::bigint
),
k24 AS (
  SELECT 'K24 kisi (eski) / firsat (yeni) sayisi (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.contacts)::bigint,
         (SELECT count(*) FROM public.crm_leads)::bigint
),
k25 AS (
  SELECT 'K25 tedarikci nesneleri (8)' AS kontrol,
         ((to_regclass('public.suppliers') IS NOT NULL)::int
          + (to_regclass('public.event_suppliers') IS NOT NULL)::int
          + (to_regclass('public.supplier_shortlists') IS NOT NULL)::int
          + (to_regclass('public.supplier_shortlist_items') IS NOT NULL)::int
          + (to_regclass('internal.event_supplier_costs') IS NOT NULL)::int
          + (to_regprocedure('public.internal_event_supplier_costs_list(uuid)') IS NOT NULL)::int
          + (to_regprocedure('public.internal_event_supplier_cost_set(uuid, numeric, text)') IS NOT NULL)::int
          + (to_regprocedure('public.user_has_org_permission(uuid, uuid, text)') IS NOT NULL)::int)::bigint,
         8::bigint
),
k26 AS (
  SELECT 'K26 suppliers yetki matrisi (7)' AS kontrol,
         (('suppliers.manage' = ANY (public.org_role_permissions('owner')))::int
          + ('suppliers.manage' = ANY (public.org_role_permissions('admin')))::int
          + ('suppliers.manage' = ANY (public.org_role_permissions('project_manager')))::int
          + ('suppliers.manage' = ANY (public.org_role_permissions('crew_coordinator')))::int
          + ('suppliers.view' = ANY (public.org_role_permissions('sales')) AND NOT 'suppliers.manage' = ANY (public.org_role_permissions('sales')))::int
          + ('suppliers.view' = ANY (public.org_role_permissions('finance')) AND NOT 'suppliers.manage' = ANY (public.org_role_permissions('finance')))::int
          + (NOT 'suppliers.view' = ANY (public.org_role_permissions('viewer')))::int)::bigint,
         7::bigint
),
k27 AS (
  SELECT 'K27 tedarikci politika + tetikleyici (25)' AS kontrol,
         ((SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
            AND tablename IN ('suppliers', 'event_suppliers', 'supplier_shortlists', 'supplier_shortlist_items'))
          + (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE NOT t.tgisinternal AND t.tgname LIKE 'trg_faz8c_%'
                AND ((n.nspname = 'public' AND c.relname IN ('suppliers', 'event_suppliers', 'supplier_shortlists', 'supplier_shortlist_items'))
                     OR (n.nspname = 'internal' AND c.relname = 'event_supplier_costs'))))::bigint,
         25::bigint
),
k28 AS (
  SELECT 'K28 tedarikci tutarsizlik (0)' AS kontrol,
         ((SELECT count(*) FROM public.event_suppliers es JOIN public.events e ON e.id = es.event_id WHERE e.organization_id IS DISTINCT FROM es.organization_id)
          + (SELECT count(*) FROM public.event_suppliers es JOIN public.suppliers s ON s.id = es.supplier_id WHERE s.organization_id <> es.organization_id)
          + (SELECT count(*) FROM public.event_suppliers WHERE (status = 'confirmed') <> (confirmed_at IS NOT NULL))
          + (SELECT count(*) FROM public.event_suppliers es JOIN public.suppliers s ON s.id = es.supplier_id WHERE NOT s.is_active AND es.status <> 'cancelled')
          + (SELECT count(*) FROM public.supplier_shortlists l JOIN public.events e ON e.id = l.event_id WHERE e.organization_id IS DISTINCT FROM l.organization_id)
          + (SELECT count(*) FROM public.supplier_shortlist_items i JOIN public.supplier_shortlists l ON l.id = i.shortlist_id WHERE l.organization_id <> i.organization_id)
          + (SELECT count(*) FROM public.supplier_shortlist_items i JOIN public.providers p ON p.id = i.provider_id WHERE p.organization_id = i.organization_id)
          + (SELECT count(*) FROM public.suppliers s JOIN public.providers p ON p.id = s.linked_provider_id WHERE p.organization_id = s.organization_id)
          + (SELECT count(*) FROM internal.event_supplier_costs x JOIN public.event_suppliers es ON es.id = x.event_supplier_id WHERE es.organization_id <> x.organization_id))::bigint,
         0::bigint
),
k29 AS (
  SELECT 'K29 modul (ajans suppliers / business supplier_search kapali 0) + RPC yetkisi (4)' AS kontrol,
         ((SELECT count(*) FROM public.organizations o WHERE o.account_type = 'agency' AND NOT public.org_module_enabled(o.id, 'suppliers'))
          + (SELECT count(*) FROM public.organizations o WHERE o.account_type = 'business' AND NOT public.org_module_enabled(o.id, 'supplier_search'))
          + (has_function_privilege('authenticated', 'public.internal_event_supplier_costs_list(uuid)', 'EXECUTE'))::int
          + (has_function_privilege('authenticated', 'public.internal_event_supplier_cost_set(uuid, numeric, text)', 'EXECUTE'))::int
          + (NOT has_function_privilege('anon', 'public.internal_event_supplier_costs_list(uuid)', 'EXECUTE'))::int
          + (NOT has_function_privilege('anon', 'public.internal_event_supplier_cost_set(uuid, numeric, text)', 'EXECUTE'))::int)::bigint,
         4::bigint
),
k30 AS (
  SELECT 'K30 tedarikci (eski) / kisa liste (yeni) sayisi (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.suppliers)::bigint,
         (SELECT count(*) FROM public.supplier_shortlists)::bigint
),
k31 AS (
  SELECT 'K31 crm.view tasimayan sahipli acik firsat (bilgi; 0 beklenir)' AS kontrol,
         (SELECT count(*) FROM public.crm_leads l WHERE l.owner_user_id IS NOT NULL AND l.stage NOT IN ('won', 'lost')
            AND NOT public.user_has_org_permission(l.owner_user_id, l.organization_id, 'crm.view'))::bigint,
         0::bigint
),
k32 AS (
  SELECT 'K32 hijyen_04 nesneleri (4)' AS kontrol,
         ((to_regprocedure('public.fn_hijyen04_lead_notif_cleanup()') IS NOT NULL)::int
          + (to_regprocedure('public.fn_hijyen04_task_notif_cleanup()') IS NOT NULL)::int
          + (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
              WHERE NOT t.tgisinternal AND c.relname IN ('crm_leads', 'tasks') AND t.tgname LIKE 'trg_hijyen04_%'))::bigint,
         4::bigint
),
k33 AS (
  SELECT 'K33 hedefsiz firsat/gorev bildirimi (0)' AS kontrol,
         ((SELECT count(*) FROM public.notifications n WHERE n.type = 'crm' AND n.link LIKE '/ajans/musteriler?firsat=%'
            AND NOT EXISTS (SELECT 1 FROM public.crm_leads l WHERE '/ajans/musteriler?firsat=' || l.id::text = n.link))
          + (SELECT count(*) FROM public.notifications n WHERE n.type = 'task' AND n.link LIKE '/kurulus/gorevler?gorev=%'
              AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE '/kurulus/gorevler?gorev=' || t.id::text = n.link)))::bigint,
         0::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4 UNION ALL SELECT * FROM k5
  UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8 UNION ALL SELECT * FROM k9 UNION ALL SELECT * FROM k10
  UNION ALL SELECT * FROM k11 UNION ALL SELECT * FROM k12 UNION ALL SELECT * FROM k13 UNION ALL SELECT * FROM k14 UNION ALL SELECT * FROM k15
  UNION ALL SELECT * FROM k16 UNION ALL SELECT * FROM k17 UNION ALL SELECT * FROM k18
  UNION ALL SELECT * FROM k19 UNION ALL SELECT * FROM k20 UNION ALL SELECT * FROM k21 UNION ALL SELECT * FROM k22 UNION ALL SELECT * FROM k23
  UNION ALL SELECT * FROM k24
  UNION ALL SELECT * FROM k25 UNION ALL SELECT * FROM k26 UNION ALL SELECT * FROM k27 UNION ALL SELECT * FROM k28 UNION ALL SELECT * FROM k29
  UNION ALL SELECT * FROM k30 UNION ALL SELECT * FROM k31 UNION ALL SELECT * FROM k32 UNION ALL SELECT * FROM k33
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K4 %' OR kontrol LIKE 'K5 %' OR kontrol LIKE 'K16 %' OR kontrol LIKE 'K17 %' OR kontrol LIKE 'K18 %' OR kontrol LIKE 'K24 %' OR kontrol LIKE 'K30 %' OR kontrol LIKE 'K31 %' THEN 'BILGI'
            WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
