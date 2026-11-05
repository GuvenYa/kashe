-- =============================================================================
-- FAZ 10 / Asama 20 — Temizlik tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE)
-- Bolum A (10a uyelik tek tablo; 20261028120000_faz10a_01):
--   K1 eski tablolar salt okunur: agency_members/business_members/agency_invitations/business_invitations icin
--      anon+authenticated yazma yetkisi (INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) 0 + SELECT disi RLS politikasi 0
--      + tetikleyici 0 -> toplam (0)
--   K2 bilgi: eski tablolarin satir toplami (eski) / organization_memberships + organization_invitations (yeni) — kesim aninda
--      esitti (migration basi RAISE ile dogruladi); sonra yeni tablo buyur, eski sabit kalir (asama5 K3-K6 bu dosyayla EMEKLI)
--   K3 eski tabloya referans veren fonksiyon (public + internal govdesinde tablo adi gecen) sayisi (0)
--   K4 yeni nesneler: trg_faz10_invitation_notify + trg_faz10_member_notify + trg_faz10_remove_assignments_on_leave (3)
--      + RPC'ler org_invitation_create/cancel/respond, org_member_remove/leave (5) + ensure_talent_record_for_membership(p_membership_id)
--      + organization_team_public gorunumu + notifications.type CHECK 'team' + kaldirilan 14 fonksiyon yok (1) -> toplam (12)
--   K5 yetki: 5 RPC authenticated EXECUTE var (5) + anon yok (0 -> 5 esit) + organization_team_public anon SELECT var (1)
--      + organization_memberships/organization_invitations authenticated yalniz SELECT (yazma 0) -> toplam (6)
--   K6 bilgi: bekleyen davet (eski) / son 30 gun davetle acilan uyelik (yeni; legacy_source bos)
-- Bolum B (10b etkinlik turu; 20261104120000_faz10b_01):
--   K7 event_type tek kaynak: conversations/listings/bookings/quote_requests -> event_types(key) FK (4) - eski CHECK (0)
--      - anahtar disi deger (0) -> (4). 10b uygulanmamissa (FK yok) BEKLIYOR yazar; 10b sonrasi ESIT; asama11 K1 EMEKLI.
-- Bolum C (10c-1 saglayici yazma yolu; 20261105120000_faz10c_01 + 20261105120100_faz10c_02):
--   K8 yapi: providers 3 yeni sutun (3) + GIN (1) + authenticated UPDATE sutunlari providers 12 / professional_profiles 5 /
--      organization_profiles 6 (23) + 4 UPDATE politikasi (4) + 3 ters ayna tetikleyicisi (3) + provider_set_primary_category
--      authenticated EXECUTE (1) - anon (0) + fn_faz10c_ayna_kaymasi (1) + gorunum attributes'i saglayicidan, primary_category_id'yi
--      profiles'tan okur (1; PostgREST gomme ipucu profiles_primary_category_id_fkey bu kaynaga bagli - 02b) -> (37)
--   K8b ayna kaymasi: profiles kopyalari ile providers / alt profil / birincil rol farki toplami (0)
--   10c-1 uygulanmamissa K8/K8b BEKLIYOR.
-- Bolum C2 (10c-1/03 profiles kilidi; 20261105130000_faz10c_03):
--   K9 kilit: trg_faz10c_protect_moved_fields etkin (1) + protect_profiles_moved_fields anon/authenticated/PUBLIC EXECUTE yok (1)
--      + trg_faz2b_sync_primary_role ve fn_faz2b_sync_primary_role yok (1) + ileri ayna tetikleyicisi yalniz role/full_name/company_name
--      (1) + ileri ayna govdesinde city_id yok (1) + kilit fonksiyonu 13 tasinmis alani eski degerine dondurur (13) -> (18)
--   03 uygulanmamissa K9 BEKLIYOR. Kayma olcumu K8b (03 sonrasi da 0).
-- Bolum D (10c-2 provider_id kesimi; 20261105160000_faz10c_04):
--   K10 yapi: 5 tabloda provider_id NOT NULL (5) + providers'a ON DELETE CASCADE anahtar (5) + favorites (user_id, provider_id)
--      TEKIL (1) + reviews (provider_id, created_at) ve profile_experiences (provider_id, kind, sort_order) indeksleri (2)
--      + profiles.category_attributes GIN yok (1) + iki yonlu tetikleyici govdeleri (2) -> (16)
--   04 uygulanmamissa K10 BEKLIYOR.
-- Bolum E (10d; 20261105170000_faz10d_01):
--   K11 bookings: eski bes politika (Assigned pros read team bookings, Bookings visible to participants, Customers read own
--      bookings, Parties update own bookings, Professionals read own bookings) authenticated (5) + bookings'te rolsuz (public)
--      politika yok (1) -> (6). 10d/01 uygulanmamissa (bes politika hala public) BEKLIYOR.
-- Beklenen: K1, K3, K4, K5, K7, K8, K8b, K9, K10, K11 ESIT; K2, K6 BILGI.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 eski tablolar salt okunur: yazma yetkisi + yazma politikasi + tetikleyici (0)' AS kontrol,
         ((SELECT count(*) FROM information_schema.role_table_grants
            WHERE table_schema = 'public'
              AND table_name IN ('agency_members', 'business_members', 'agency_invitations', 'business_invitations')
              AND grantee IN ('anon', 'authenticated') AND privilege_type <> 'SELECT')
          + (SELECT count(*) FROM pg_policies
              WHERE schemaname = 'public'
                AND tablename IN ('agency_members', 'business_members', 'agency_invitations', 'business_invitations')
                AND cmd <> 'SELECT')
          + (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE NOT t.tgisinternal AND n.nspname = 'public'
                AND c.relname IN ('agency_members', 'business_members', 'agency_invitations', 'business_invitations')))::bigint AS eski,
         0::bigint AS yeni
),
k2 AS (
  SELECT 'K2 eski tablolar satir toplami (eski) / yeni tablolar (yeni) (bilgi)' AS kontrol,
         ((SELECT count(*) FROM public.agency_members) + (SELECT count(*) FROM public.business_members)
          + (SELECT count(*) FROM public.agency_invitations) + (SELECT count(*) FROM public.business_invitations))::bigint,
         ((SELECT count(*) FROM public.organization_memberships WHERE legacy_source IS DISTINCT FROM 'owner_seed')
          + (SELECT count(*) FROM public.organization_invitations))::bigint
),
k3 AS (
  SELECT 'K3 eski tabloya referans veren fonksiyon (0)' AS kontrol,
         (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname IN ('public', 'internal') AND p.prokind = 'f'
             AND p.prosrc ~ '(agency_members|business_members|agency_invitations|business_invitations)')::bigint,
         0::bigint
),
k4 AS (
  SELECT 'K4 10a nesneleri (12)' AS kontrol,
         ((SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
            WHERE NOT t.tgisinternal
              AND ((c.relname = 'organization_invitations' AND t.tgname = 'trg_faz10_invitation_notify')
                   OR (c.relname = 'organization_memberships' AND t.tgname IN ('trg_faz10_member_notify', 'trg_faz10_remove_assignments_on_leave'))))
          + (to_regprocedure('public.org_invitation_create(uuid, text, public.organization_member_role, text)') IS NOT NULL)::int
          + (to_regprocedure('public.org_invitation_cancel(uuid)') IS NOT NULL)::int
          + (to_regprocedure('public.org_invitation_respond(uuid, boolean)') IS NOT NULL)::int
          + (to_regprocedure('public.org_member_remove(uuid, uuid)') IS NOT NULL)::int
          + (to_regprocedure('public.org_member_leave(uuid)') IS NOT NULL)::int
          + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'ensure_talent_record_for_membership'
                AND p.proargnames = ARRAY['p_membership_id'])
          + (to_regclass('public.organization_team_public') IS NOT NULL)::int
          + (SELECT count(*) FROM pg_constraint
              WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_type_check'
                AND pg_get_constraintdef(oid) LIKE '%''team''%')
          + (SELECT (count(*) = 0)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
                AND p.proname IN ('fn_sync_agency_member', 'fn_sync_business_member', 'fn_sync_agency_invitation',
                                  'fn_sync_business_invitation', 'on_agency_invitation_accepted_add_member',
                                  'on_business_invitation_accepted_add_member', 'on_agency_invitation_insert_notify',
                                  'on_business_invitation_insert_notify', 'on_agency_member_insert_notify_agency',
                                  'on_business_member_insert_notify_business', 'validate_agency_membership_roles',
                                  'validate_business_membership_roles', 'fn_remove_assignments_on_leave',
                                  'faz5_backfill_agency_members')))::bigint,
         12::bigint
),
k5 AS (
  SELECT 'K5 yetki: 5 RPC authenticated var / anon yok + organization_team_public anon SELECT + yeni tablolar yalniz SELECT (6)' AS kontrol,
         ((SELECT count(*) FROM information_schema.routine_privileges
            WHERE specific_schema = 'public' AND grantee = 'authenticated' AND privilege_type = 'EXECUTE'
              AND routine_name IN ('org_invitation_create', 'org_invitation_cancel', 'org_invitation_respond', 'org_member_remove', 'org_member_leave'))
          - (SELECT count(*) FROM information_schema.routine_privileges
              WHERE specific_schema = 'public' AND grantee = 'anon' AND privilege_type = 'EXECUTE'
                AND routine_name IN ('org_invitation_create', 'org_invitation_cancel', 'org_invitation_respond', 'org_member_remove', 'org_member_leave'))
          + (SELECT count(*) FROM information_schema.role_table_grants
              WHERE table_schema = 'public' AND table_name = 'organization_team_public' AND grantee = 'anon' AND privilege_type = 'SELECT')
          - (SELECT count(*) FROM information_schema.role_table_grants
              WHERE table_schema = 'public' AND table_name IN ('organization_memberships', 'organization_invitations')
                AND grantee IN ('anon', 'authenticated') AND privilege_type <> 'SELECT'))::bigint,
         6::bigint
),
k6 AS (
  SELECT 'K6 bekleyen davet (eski) / son 30 gun davetle acilan uyelik (yeni) (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.organization_invitations WHERE status = 'pending')::bigint,
         (SELECT count(*) FROM public.organization_memberships
           WHERE legacy_source IS NULL AND invited_by IS NOT NULL AND joined_at >= now() - interval '30 days')::bigint
),
k7 AS (
  SELECT 'K7 event_type tek kaynak: 4 FK - eski CHECK - anahtar disi deger (4)' AS kontrol,
         ((SELECT count(*) FROM pg_constraint WHERE contype = 'f'
            AND conname IN ('conversations_event_type_fkey', 'listings_event_type_fkey', 'bookings_event_type_fkey', 'quote_requests_event_type_fkey'))
          - (SELECT count(*) FROM pg_constraint WHERE contype = 'c'
              AND conname IN ('conversations_event_type_check', 'listings_event_type_check', 'bookings_event_type_check'))
          - ((SELECT count(*) FROM public.conversations c WHERE c.event_type IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.event_types e WHERE e.key = c.event_type))
             + (SELECT count(*) FROM public.listings l WHERE l.event_type IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.event_types e WHERE e.key = l.event_type))
             + (SELECT count(*) FROM public.bookings b WHERE b.event_type IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.event_types e WHERE e.key = b.event_type))
             + (SELECT count(*) FROM public.quote_requests q WHERE q.event_type IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.event_types e WHERE e.key = q.event_type))))::bigint,
         4::bigint
),
k8 AS (
  SELECT 'K8 10c-1 yapi: sutun 3 + GIN 1 + UPDATE sutunlari 23 + politika 4 + ters ayna 3 + RPC 1 + kayma olcer 1 + gorunum 1 (37)' AS kontrol,
         ((SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'providers'
            AND column_name IN ('attributes', 'category_attributes', 'views_count'))
          + (to_regclass('public.idx_providers_category_attributes_gin') IS NOT NULL)::int
          + (SELECT count(*) FROM information_schema.column_privileges
              WHERE table_schema = 'public' AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
                AND ((table_name = 'providers' AND column_name IN ('city_id', 'district', 'service_radius_km', 'is_published', 'attributes',
                       'category_attributes', 'approval_status', 'approval_note', 'approved_at', 'suspended_at', 'suspension_reason', 'suspended_by'))
                  OR (table_name = 'professional_profiles' AND column_name IN ('headline', 'bio', 'experience_years', 'languages', 'equipment'))
                  OR (table_name = 'organization_profiles' AND column_name IN ('about', 'team_size_range', 'can_full_service', 'subcontracts',
                       'min_project_budget', 'portfolio_scale'))))
          + (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND cmd = 'UPDATE'
              AND policyname IN ('providers_update_own', 'providers_update_admin', 'professional_profiles_update_own', 'organization_profiles_update_own'))
          + (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE NOT t.tgisinternal AND t.tgenabled <> 'D'
              AND ((c.relname = 'providers' AND t.tgname = 'trg_faz10c_sync_provider_to_profile')
                OR (c.relname = 'professional_profiles' AND t.tgname = 'trg_faz10c_sync_professional_bio')
                OR (c.relname = 'organization_profiles' AND t.tgname = 'trg_faz10c_sync_organization_about')))
          + (SELECT count(*) FROM information_schema.routine_privileges WHERE specific_schema = 'public'
              AND routine_name = 'provider_set_primary_category' AND grantee = 'authenticated' AND privilege_type = 'EXECUTE')
          - (SELECT count(*) FROM information_schema.routine_privileges WHERE specific_schema = 'public'
              AND routine_name = 'provider_set_primary_category' AND grantee IN ('anon', 'PUBLIC') AND privilege_type = 'EXECUTE')
          + (to_regprocedure('public.fn_faz10c_ayna_kaymasi()') IS NOT NULL)::int
          + (pg_get_viewdef('public.v_providers_public'::regclass) LIKE '%pr.category_attributes%'
             AND pg_get_viewdef('public.v_providers_public'::regclass) LIKE '%p.primary_category_id,%')::int)::bigint,
         37::bigint
),
k8b AS (
  -- fn_faz10c_ayna_kaymasi 10c-1 oncesi yok: cagri query_to_xml icinde, yalniz fonksiyon varsa calisir (yoksa NULL -> BEKLIYOR)
  SELECT 'K8b 10c-1 ayna kaymasi: profiles kopyasi ile saglayici tarafi farki (0)' AS kontrol,
         (CASE WHEN to_regprocedure('public.fn_faz10c_ayna_kaymasi()') IS NULL THEN NULL
               ELSE (xpath('/row/n/text()', query_to_xml('SELECT COALESCE(sum(satir), 0) AS n FROM public.fn_faz10c_ayna_kaymasi()', false, true, '')))[1]::text::bigint
          END)::bigint,
         0::bigint
),
k9 AS (
  SELECT 'K9 10c-1/03 kilit: tetikleyici 1 + yetki 1 + birincil rol aynasi yok 1 + ileri ayna sutun 1 + govde 1 + kilitli alan 13 (18)' AS kontrol,
         ((SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND tgname = 'trg_faz10c_protect_moved_fields'
            AND tgenabled <> 'D')
          + (to_regprocedure('public.protect_profiles_moved_fields()') IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM information_schema.routine_privileges WHERE specific_schema = 'public'
                              AND routine_name = 'protect_profiles_moved_fields' AND grantee IN ('anon', 'authenticated', 'PUBLIC')
                              AND privilege_type = 'EXECUTE'))::int
          + (NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_faz2b_sync_primary_role')
             AND to_regprocedure('public.fn_faz2b_sync_primary_role()') IS NULL)::int
          + ((SELECT string_agg(a.attname, ',' ORDER BY a.attname)
                FROM pg_trigger t JOIN pg_attribute a ON a.attrelid = t.tgrelid AND a.attnum = ANY(t.tgattr::int2[])
               WHERE t.tgrelid = 'public.profiles'::regclass AND t.tgname = 'trg_faz2_sync_profile_to_provider')
             IS NOT DISTINCT FROM 'company_name,full_name,role')::int
          + COALESCE((SELECT (prosrc NOT LIKE '%city_id%')::int FROM pg_proc WHERE oid = to_regprocedure('public.fn_sync_profile_to_provider()')), 0)
          + COALESCE((SELECT count(*) FROM pg_proc pr, unnest(ARRAY['city_id', 'bio', 'primary_category_id', 'attributes', 'category_attributes',
                        'views_count', 'is_published', 'approval_status', 'approval_note', 'approved_at', 'suspended_at', 'suspension_reason',
                        'suspended_by']) AS f(alan)
                       WHERE pr.oid = to_regprocedure('public.protect_profiles_moved_fields()')
                         AND pr.prosrc ~ ('NEW\.' || f.alan || '\s*:=\s*OLD\.' || f.alan || '\s*;')), 0))::bigint,
         18::bigint
),
k10 AS (
  SELECT 'K10 10c-2 yapi: NOT NULL 5 + CASCADE 5 + favori tekil 1 + indeks 2 + eski GIN yok 1 + iki yonlu tetikleyici 2 (16)' AS kontrol,
         ((SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name = 'provider_id' AND is_nullable = 'NO'
              AND table_name IN ('services', 'portfolio_items', 'profile_experiences', 'reviews', 'favorites'))
          + (SELECT count(*) FROM pg_constraint
              WHERE contype = 'f' AND confdeltype = 'c' AND confrelid = 'public.providers'::regclass
                AND conname IN ('services_provider_id_fkey', 'portfolio_items_provider_id_fkey', 'profile_experiences_provider_id_fkey',
                                'reviews_provider_id_fkey', 'favorites_provider_id_fkey'))
          + COALESCE((SELECT indisunique::int FROM pg_index WHERE indexrelid = to_regclass('public.favorites_user_id_provider_id_key')), 0)
          + (to_regclass('public.idx_reviews_provider_created') IS NOT NULL)::int
          + (to_regclass('public.idx_profile_experiences_provider_kind_sort') IS NOT NULL)::int
          + (to_regclass('public.idx_profiles_category_attributes_gin') IS NULL)::int
          + COALESCE((SELECT (prosrc LIKE '%NEW.profile_id := NEW.provider_id%')::int FROM pg_proc
                       WHERE oid = to_regprocedure('public.fn_faz2b_set_provider_id_from_profile()')), 0)
          + COALESCE((SELECT (prosrc LIKE '%NEW.professional_id := NEW.provider_id%')::int FROM pg_proc
                       WHERE oid = to_regprocedure('public.fn_faz2b_set_provider_id_from_professional()')), 0))::bigint,
         16::bigint
),
k11 AS (
  SELECT 'K11 10d bookings: eski 5 politika authenticated 5 + rolsuz politika yok 1 (6)' AS kontrol,
         ((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings' AND roles = '{authenticated}'
             AND policyname IN ('Assigned pros read team bookings', 'Bookings visible to participants', 'Customers read own bookings',
                                'Parties update own bookings', 'Professionals read own bookings'))
          + (NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings' AND roles = '{public}'))::int)::bigint,
         6::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4 UNION ALL SELECT * FROM k5
  UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8 UNION ALL SELECT * FROM k8b UNION ALL SELECT * FROM k9
  UNION ALL SELECT * FROM k10 UNION ALL SELECT * FROM k11
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K2 %' OR kontrol LIKE 'K6 %' THEN 'BILGI'
            WHEN kontrol LIKE 'K7 %' AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_event_type_fkey') THEN 'BEKLIYOR'
            WHEN (kontrol LIKE 'K8 %' OR kontrol LIKE 'K8b %') AND to_regprocedure('public.provider_set_primary_category(integer)') IS NULL THEN 'BEKLIYOR'
            WHEN kontrol LIKE 'K9 %' AND to_regprocedure('public.protect_profiles_moved_fields()') IS NULL THEN 'BEKLIYOR'
            WHEN kontrol LIKE 'K10 %' AND (SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public'
                   AND table_name = 'portfolio_items' AND column_name = 'provider_id') = 'YES' THEN 'BEKLIYOR'
            WHEN kontrol LIKE 'K11 %' AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings'
                   AND roles = '{public}' AND policyname = 'Bookings visible to participants') = 1 THEN 'BEKLIYOR'
            WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
