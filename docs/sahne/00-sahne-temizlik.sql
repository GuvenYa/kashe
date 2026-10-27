-- SAHNE 00 — temizlik: tum Sahne verisini siler (fixture'lar ve sema etkilenmez). YALNIZ DALDA. Storage nesneleri: node scripts/sahne/foto-yukle.mjs --sil

DO $$
DECLARE n_cron int := 0; n_prof int;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM cron.job WHERE jobname = ''send-message-notifications''' INTO n_cron;
  END IF;
  SELECT count(*) INTO n_prof FROM public.profiles WHERE email NOT LIKE 'faz1test+%' AND email NOT LIKE 'sahne+%';
  IF n_cron > 0 OR n_prof > 10 THEN
    RAISE EXCEPTION 'URETIM KORUMASI: bu veritabani uretim gibi gorunuyor (cron=%, test disi profil=%). Sahne yalniz dalda (ukqhgspaallzjscjodbb) kurulur. Hicbir sey yazilmadi.', n_cron, n_prof;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.sahne_temizle() RETURNS text LANGUAGE plpgsql AS $$
DECLARE ids uuid[]; orgs uuid[]; n_u int; n_o int;
BEGIN
  SELECT COALESCE(array_agg(id), '{}') INTO ids FROM (
    SELECT id FROM public.profiles WHERE email LIKE 'sahne+%' UNION SELECT id FROM auth.users WHERE email LIKE 'sahne+%'
    UNION SELECT id FROM public.profiles WHERE id::text LIKE '5a4e0000-%') s;
  SELECT COALESCE(array_agg(id), '{}') INTO orgs FROM public.organizations WHERE legacy_profile_id = ANY(ids);
  n_u := coalesce(array_length(ids, 1), 0); n_o := coalesce(array_length(orgs, 1), 0);
  -- rezervasyon (teklif surumune RESTRICT) -> teklif -> etkinlik
  DELETE FROM public.bookings WHERE customer_id = ANY(ids) OR professional_id = ANY(ids) OR seller_provider_id = ANY(ids)
     OR buyer_organization_id = ANY(orgs) OR cancelled_by = ANY(ids) OR id::text LIKE '5a4e0013-%';
  IF to_regclass('public.proposals') IS NOT NULL THEN
    DELETE FROM public.proposals WHERE seller_organization_id = ANY(orgs) OR buyer_user_id = ANY(ids) OR buyer_organization_id = ANY(orgs) OR id::text LIKE '5a4e0003-%';
  END IF;
  IF to_regclass('public.rfps') IS NOT NULL THEN DELETE FROM public.rfps WHERE organization_id = ANY(orgs); END IF;
  IF to_regclass('public.event_suppliers') IS NOT NULL THEN
    DELETE FROM public.event_suppliers WHERE organization_id = ANY(orgs);
    DELETE FROM public.supplier_shortlists WHERE organization_id = ANY(orgs);
    DELETE FROM public.suppliers WHERE organization_id = ANY(orgs);
  END IF;
  IF to_regclass('public.crm_leads') IS NOT NULL THEN
    DELETE FROM public.crm_leads WHERE organization_id = ANY(orgs);
    DELETE FROM public.contacts WHERE organization_id = ANY(orgs) OR linked_user_id = ANY(ids);
  END IF;
  IF to_regclass('public.tasks') IS NOT NULL THEN
    UPDATE public.tasks SET status = 'cancelled' WHERE organization_id = ANY(orgs) AND status NOT IN ('todo', 'cancelled');
    DELETE FROM public.tasks WHERE organization_id = ANY(orgs);
    DELETE FROM public.activity_logs WHERE organization_id = ANY(orgs) OR actor_user_id = ANY(ids);
  END IF;
  IF to_regclass('public.events') IS NOT NULL THEN
    DELETE FROM public.events WHERE owner_user_id = ANY(ids) OR organization_id = ANY(orgs) OR id::text LIKE '5a4e0002-%';
    DELETE FROM public.event_briefs WHERE created_by_user_id = ANY(ids);
  END IF;
  IF to_regclass('public.organization_talent_records') IS NOT NULL THEN
    DELETE FROM public.organization_talent_records WHERE organization_id = ANY(orgs) OR talent_id = ANY(ids) OR created_by = ANY(ids);
  END IF;
  DELETE FROM public.review_replies WHERE review_id IN (SELECT id FROM public.reviews WHERE customer_id = ANY(ids) OR professional_id = ANY(ids));
  DELETE FROM public.reviews WHERE customer_id = ANY(ids) OR professional_id = ANY(ids);
  DELETE FROM public.messages WHERE conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = ANY(ids) OR professional_id = ANY(ids)) OR sender_id = ANY(ids);
  DELETE FROM public.quotes WHERE conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = ANY(ids) OR professional_id = ANY(ids));
  DELETE FROM public.conversation_assignees WHERE conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = ANY(ids) OR professional_id = ANY(ids)) OR professional_id = ANY(ids);
  DELETE FROM public.conversations WHERE customer_id = ANY(ids) OR professional_id = ANY(ids);
  IF to_regclass('public.quote_requests') IS NOT NULL THEN
    DELETE FROM public.quote_request_recipients WHERE professional_id = ANY(ids) OR request_id IN (SELECT id FROM public.quote_requests WHERE customer_id = ANY(ids));
    DELETE FROM public.quote_requests WHERE customer_id = ANY(ids);
  END IF;
  DELETE FROM public.applications WHERE applicant_id = ANY(ids) OR listing_id IN (SELECT id FROM public.listings WHERE creator_id = ANY(ids));
  DELETE FROM public.listing_invitations WHERE listing_id IN (SELECT id FROM public.listings WHERE creator_id = ANY(ids));
  DELETE FROM public.listings WHERE creator_id = ANY(ids);
  DELETE FROM public.favorites WHERE user_id = ANY(ids) OR professional_id = ANY(ids);
  DELETE FROM public.availability_blocks WHERE profile_id = ANY(ids);
  DELETE FROM public.portfolio_items WHERE profile_id = ANY(ids);
  DELETE FROM public.profile_experiences WHERE profile_id = ANY(ids);
  DELETE FROM public.services WHERE profile_id = ANY(ids);
  IF to_regclass('public.provider_services') IS NOT NULL THEN DELETE FROM public.provider_services WHERE provider_id = ANY(ids); END IF;
  DELETE FROM public.agency_members WHERE agency_id = ANY(ids) OR professional_id = ANY(ids);
  DELETE FROM public.agency_invitations WHERE agency_id = ANY(ids) OR invited_by_id = ANY(ids) OR invited_user_id = ANY(ids);
  IF to_regclass('public.business_members') IS NOT NULL THEN
    DELETE FROM public.business_members WHERE business_id = ANY(ids) OR member_user_id = ANY(ids);
    DELETE FROM public.business_invitations WHERE business_id = ANY(ids) OR invited_by_id = ANY(ids) OR invited_user_id = ANY(ids);
  END IF;
  IF to_regclass('public.organization_memberships') IS NOT NULL THEN
    DELETE FROM public.organization_memberships WHERE organization_id = ANY(orgs) OR user_id = ANY(ids);
    DELETE FROM public.organization_invitations WHERE organization_id = ANY(orgs) OR invited_by_id = ANY(ids) OR invited_user_id = ANY(ids);
  END IF;
  IF to_regclass('public.trust_appeals') IS NOT NULL THEN
    DELETE FROM public.trust_appeals WHERE provider_id = ANY(ids);
    DELETE FROM public.trust_score_snapshots WHERE provider_id = ANY(ids);
  END IF;
  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    DELETE FROM public.analytics_events WHERE actor_user_id = ANY(ids) OR provider_id = ANY(ids) OR organization_id = ANY(orgs) OR entity_id::text LIKE '5a4e%';
  END IF;
  IF to_regclass('internal.access_audit') IS NOT NULL THEN DELETE FROM internal.access_audit WHERE actor_user_id = ANY(ids); END IF;
  DELETE FROM public.notifications WHERE user_id = ANY(ids);
  DELETE FROM public.push_subscriptions WHERE user_id = ANY(ids);
  DELETE FROM public.admin_audit_log WHERE admin_id = ANY(ids) OR target_id = ANY(ids);
  DELETE FROM public.reports WHERE reporter_id = ANY(ids) OR target_id = ANY(ids);
  DELETE FROM public.organizations WHERE id = ANY(orgs);
  IF to_regclass('public.providers') IS NOT NULL THEN DELETE FROM public.providers WHERE id = ANY(ids); END IF;
  IF to_regclass('public.talents') IS NOT NULL THEN DELETE FROM public.talents WHERE user_id = ANY(ids) OR id = ANY(ids); END IF;
  DELETE FROM public.profiles WHERE id = ANY(ids);
  DELETE FROM auth.users WHERE id = ANY(ids);
  RETURN format('%s hesap, %s kurulus silindi', n_u, n_o);
END $$;

SELECT pg_temp.sahne_temizle() AS sonuc;
