-- =============================================================================
-- FAZ 0 / 03 — DOLUM (backfill): mevcut agency/business profilleri -> organizations,
--               agency_members/business_members -> organization_memberships,
--               agency_invitations/business_invitations -> organization_invitations
--
-- DIKKAT — BU DOSYA VERI YAZAR. FAZ -1 kurali ("migration veri degistirmez") onarim
--   dosyalari icindi; FAZ 0 plani (04-goc-plani FAZ 0 madde 2-4) dolumu acikca icerir.
--   15 Eylul karari: dolum ayri, idempotan bir migration dosyasidir; dal ve uretim ayni
--   dosyayi kosar. Bos dalda sifir satir yazar.
--
-- IDEMPOTAN: her INSERT yalniz eksik satiri yazar (NOT EXISTS / ON CONFLICT DO NOTHING).
--   Ikinci kosu hicbir sey degistirmez. Eski tablolara DOKUNMAZ (yalniz okur).
--
-- ESLEME:
--   organizations.id           yeni uuid; legacy_profile_id = profil id; owner_user_id = profil id
--   account_type               profiles.role (agency|business)
--   display_name               company_name, bossa full_name (ikisi de bossa NULL — deger uydurulmaz)
--   slug                       profiles.slug; bossa/catisiyorsa 'org-' || uuid (tiresiz)
--   subscription_tier/until    profiles.premium_tier / premium_until (04-goc-plani: rol bazli goc;
--                              professional profillerin tier'i profilde kalir, kopyalanmaz)
--   memberships.id             = agency_members.id / business_members.id (aynalama anahtari)
--   memberships.role           owner->owner, manager->admin, member->viewer
--   kurucu                     her kurulus icin owner_seed satiri (eski tablolarda yok)
--   invitations.id             = eski davet id'si; status metin uzerinden ayni degere cast
--
-- DOGRULAMA: docs/envanter/asama5-faz0-tutarlilik.sql (salt okunur; dal ve uretimde kosulur)
-- GERI ALMA: yalniz yeni tablolardan silme (eski tablolar degismedi):
--   DELETE FROM public.organization_invitations; DELETE FROM public.organization_memberships;
--   DELETE FROM public.organizations;
-- =============================================================================

BEGIN;

-- 1) Kuruluslar + kurucu uyelikleri (ensure_organization_for_profile idempotan)
DO $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT p.id
      FROM public.profiles p
     WHERE p.role IN ('agency', 'business')
       AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.legacy_profile_id = p.id)
     ORDER BY p.created_at
  LOOP
    BEGIN
      PERFORM public.ensure_organization_for_profile(r.id);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_org_sync_error('faz0_03_dolum.organizations', 'BACKFILL', r.id, SQLERRM);
    END;
  END LOOP;
  RAISE NOTICE 'faz0 dolum: % kurulus olusturuldu', n;
END $$;

-- Var olan kuruluslarda kurucu uyeligi eksikse tamamla (ensure zaten yapar; guvence)
INSERT INTO public.organization_memberships (organization_id, user_id, role, status, joined_at, legacy_source)
SELECT o.id, o.owner_user_id, 'owner', 'active', o.created_at, 'owner_seed'
  FROM public.organizations o
 WHERE NOT EXISTS (SELECT 1 FROM public.organization_memberships om
                    WHERE om.organization_id = o.id AND om.user_id = o.owner_user_id)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 2) agency_members -> organization_memberships (ayni id)
INSERT INTO public.organization_memberships (id, organization_id, user_id, role, status, joined_at, legacy_source)
SELECT am.id, o.id, am.professional_id, public.map_legacy_member_role(am.member_role::text),
       'active', am.joined_at, 'agency_members'
  FROM public.agency_members am
  JOIN public.organizations o ON o.legacy_profile_id = am.agency_id
 WHERE NOT EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.id = am.id)
   AND NOT EXISTS (SELECT 1 FROM public.organization_memberships om
                    WHERE om.organization_id = o.id AND om.user_id = am.professional_id)
ON CONFLICT DO NOTHING;

-- 3) business_members -> organization_memberships (ayni id)
INSERT INTO public.organization_memberships (id, organization_id, user_id, role, status, joined_at, legacy_source)
SELECT bm.id, o.id, bm.member_user_id, public.map_legacy_member_role(bm.member_role::text),
       'active', bm.joined_at, 'business_members'
  FROM public.business_members bm
  JOIN public.organizations o ON o.legacy_profile_id = bm.business_id
 WHERE NOT EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.id = bm.id)
   AND NOT EXISTS (SELECT 1 FROM public.organization_memberships om
                    WHERE om.organization_id = o.id AND om.user_id = bm.member_user_id)
ON CONFLICT DO NOTHING;

-- 4) agency_invitations -> organization_invitations (ayni id)
INSERT INTO public.organization_invitations
  (id, organization_id, invited_email, invited_user_id, invited_by_id, role, status,
   invitation_message, created_at, responded_at, expires_at, legacy_source)
SELECT ai.id, o.id, ai.invited_email, ai.invited_user_id, ai.invited_by_id,
       public.map_legacy_member_role(ai.member_role::text),
       ai.status::text::public.organization_invitation_status,
       ai.invitation_message, ai.created_at, ai.responded_at, ai.expires_at, 'agency_invitations'
  FROM public.agency_invitations ai
  JOIN public.organizations o ON o.legacy_profile_id = ai.agency_id
 WHERE NOT EXISTS (SELECT 1 FROM public.organization_invitations oi WHERE oi.id = ai.id)
 ORDER BY ai.created_at
ON CONFLICT DO NOTHING;

-- 5) business_invitations -> organization_invitations (ayni id)
INSERT INTO public.organization_invitations
  (id, organization_id, invited_email, invited_user_id, invited_by_id, role, status,
   invitation_message, created_at, responded_at, expires_at, legacy_source)
SELECT bi.id, o.id, bi.invited_email, bi.invited_user_id, bi.invited_by_id,
       public.map_legacy_member_role(bi.member_role::text),
       bi.status::text::public.organization_invitation_status,
       bi.invitation_message, bi.created_at, bi.responded_at, bi.expires_at, 'business_invitations'
  FROM public.business_invitations bi
  JOIN public.organizations o ON o.legacy_profile_id = bi.business_id
 WHERE NOT EXISTS (SELECT 1 FROM public.organization_invitations oi WHERE oi.id = bi.id)
 ORDER BY bi.created_at
ON CONFLICT DO NOTHING;

COMMIT;
