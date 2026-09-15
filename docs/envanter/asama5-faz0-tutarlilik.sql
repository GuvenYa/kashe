-- =============================================================================
-- FAZ 0 / Asama 5 — Tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE kosulabilir)
--
-- Eski tablolar (agency_members, business_members, agency_invitations, business_invitations,
-- agency/business rollu profiles) ile yeni tablolar (organizations, organization_memberships,
-- organization_invitations) arasindaki farki sayar. Beklenen: her satirda fark = 0 ve
-- sync_log = 0. 04_yetki_fonksiyon_gecisi dosyasi ancak bu tablo birkac gun boyunca
-- sifir gosterirse tasinir.
--
-- Kullanim: Dashboard SQL Editor'a yapistir, calistir; tek sonuc tablosu gelir.
-- Sutunlar: kontrol, eski, yeni, fark (eski-yeni mutlak / EXCEPT satir sayisi), durum
-- =============================================================================

WITH
k1 AS (  -- agency/business profili sayisi = kurulus sayisi
  SELECT 'K1 kurulus: agency+business profil = organizations' AS kontrol,
         (SELECT count(*) FROM public.profiles WHERE role IN ('agency','business'))::bigint AS eski,
         (SELECT count(*) FROM public.organizations)::bigint AS yeni
),
k1b AS ( -- kurulusu olmayan agency/business profili
  SELECT 'K1b kurulussuz agency/business profili' AS kontrol,
         (SELECT count(*) FROM public.profiles p WHERE p.role IN ('agency','business')
             AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.legacy_profile_id = p.id))::bigint AS eski,
         0::bigint AS yeni
),
k1c AS ( -- rolu artik agency/business olmayan profile bagli kurulus (bilgi; silinmez)
  SELECT 'K1c rolu degismis profile bagli kurulus (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.organizations o JOIN public.profiles p ON p.id = o.legacy_profile_id
             WHERE p.role NOT IN ('agency','business'))::bigint AS eski,
         0::bigint AS yeni
),
k2 AS (  -- her kurulusun kurucu (owner_seed) uyeligi
  SELECT 'K2 kurucu uyeligi olmayan kurulus' AS kontrol,
         (SELECT count(*) FROM public.organizations o
             WHERE NOT EXISTS (SELECT 1 FROM public.organization_memberships om
                                WHERE om.organization_id = o.id AND om.user_id = o.owner_user_id AND om.role = 'owner'))::bigint AS eski,
         0::bigint AS yeni
),
k3 AS (  -- agency_members <-> v_agency_members (id, agency_id, professional_id, member_role)
  SELECT 'K3 agency_members = v_agency_members' AS kontrol,
         (SELECT count(*) FROM public.agency_members)::bigint AS eski,
         (SELECT count(*) FROM public.v_agency_members)::bigint AS yeni
),
k3x AS (
  SELECT 'K3x agency_members EXCEPT satirlari (iki yon)' AS kontrol,
         (SELECT count(*) FROM (
            SELECT id, agency_id, professional_id, member_role FROM public.agency_members
            EXCEPT
            SELECT id, agency_id, professional_id, member_role FROM public.v_agency_members) x)::bigint AS eski,
         (SELECT count(*) FROM (
            SELECT id, agency_id, professional_id, member_role FROM public.v_agency_members
            EXCEPT
            SELECT id, agency_id, professional_id, member_role FROM public.agency_members) x)::bigint AS yeni
),
k4 AS (
  SELECT 'K4 business_members = v_business_members' AS kontrol,
         (SELECT count(*) FROM public.business_members)::bigint AS eski,
         (SELECT count(*) FROM public.v_business_members)::bigint AS yeni
),
k4x AS (
  SELECT 'K4x business_members EXCEPT satirlari (iki yon)' AS kontrol,
         (SELECT count(*) FROM (
            SELECT id, business_id, member_user_id, member_role FROM public.business_members
            EXCEPT
            SELECT id, business_id, member_user_id, member_role FROM public.v_business_members) x)::bigint AS eski,
         (SELECT count(*) FROM (
            SELECT id, business_id, member_user_id, member_role FROM public.v_business_members
            EXCEPT
            SELECT id, business_id, member_user_id, member_role FROM public.business_members) x)::bigint AS yeni
),
k5 AS (  -- davetler: id + durum esit
  SELECT 'K5 agency_invitations = organization_invitations(agency)' AS kontrol,
         (SELECT count(*) FROM public.agency_invitations)::bigint AS eski,
         (SELECT count(*) FROM public.organization_invitations oi JOIN public.organizations o ON o.id = oi.organization_id
             WHERE o.account_type = 'agency')::bigint AS yeni
),
k5x AS (
  SELECT 'K5x agency davet id/durum/email farki' AS kontrol,
         (SELECT count(*) FROM (
            SELECT ai.id, ai.agency_id, ai.invited_email, ai.status::text FROM public.agency_invitations ai
            EXCEPT
            SELECT oi.id, o.legacy_profile_id, oi.invited_email, oi.status::text
              FROM public.organization_invitations oi JOIN public.organizations o ON o.id = oi.organization_id) x)::bigint AS eski,
         0::bigint AS yeni
),
k6 AS (
  SELECT 'K6 business_invitations = organization_invitations(business)' AS kontrol,
         (SELECT count(*) FROM public.business_invitations)::bigint AS eski,
         (SELECT count(*) FROM public.organization_invitations oi JOIN public.organizations o ON o.id = oi.organization_id
             WHERE o.account_type = 'business')::bigint AS yeni
),
k6x AS (
  SELECT 'K6x business davet id/durum/email farki' AS kontrol,
         (SELECT count(*) FROM (
            SELECT bi.id, bi.business_id, bi.invited_email, bi.status::text FROM public.business_invitations bi
            EXCEPT
            SELECT oi.id, o.legacy_profile_id, oi.invited_email, oi.status::text
              FROM public.organization_invitations oi JOIN public.organizations o ON o.id = oi.organization_id) x)::bigint AS eski,
         0::bigint AS yeni
),
k7 AS (  -- abonelik kopyasi
  SELECT 'K7 subscription_tier/until profilden farkli kurulus' AS kontrol,
         (SELECT count(*) FROM public.organizations o JOIN public.profiles p ON p.id = o.legacy_profile_id
             WHERE o.subscription_tier IS DISTINCT FROM p.premium_tier
                OR o.subscription_until IS DISTINCT FROM p.premium_until
                OR o.account_type::text IS DISTINCT FROM p.role)::bigint AS eski,
         0::bigint AS yeni
),
k8 AS (  -- aynalama hatasi gunlugu
  SELECT 'K8 organization_sync_log kayit sayisi' AS kontrol,
         (SELECT count(*) FROM public.organization_sync_log)::bigint AS eski,
         0::bigint AS yeni
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k1b UNION ALL SELECT * FROM k1c UNION ALL SELECT * FROM k2
  UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k3x UNION ALL SELECT * FROM k4 UNION ALL SELECT * FROM k4x
  UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k5x UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k6x
  UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8
)
SELECT kontrol, eski, yeni,
       CASE WHEN kontrol LIKE 'K3x%' OR kontrol LIKE 'K4x%' THEN eski + yeni ELSE abs(eski - yeni) END AS fark,
       CASE WHEN kontrol LIKE 'K1c%' THEN 'BILGI'
            WHEN (CASE WHEN kontrol LIKE 'K3x%' OR kontrol LIKE 'K4x%' THEN eski + yeni ELSE abs(eski - yeni) END) = 0 THEN 'ESIT'
            ELSE 'FARK' END AS durum
  FROM hepsi;
