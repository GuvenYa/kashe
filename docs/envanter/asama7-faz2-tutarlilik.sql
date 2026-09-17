-- =============================================================================
-- FAZ 2a / Asama 7 — Saglayici defteri tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE)
--
-- profiles (kaynak) ile talents / providers / professional_profiles / organization_profiles arasindaki
-- farki sayar. Beklenen: her satir ESIT (K9 BILGI), K10 sync_log = 0.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 professional profil = providers(professional)' AS kontrol,
         (SELECT count(*) FROM public.profiles WHERE role = 'professional')::bigint AS eski,
         (SELECT count(*) FROM public.providers WHERE provider_type = 'professional')::bigint AS yeni
),
k2 AS (
  SELECT 'K2 professional profil = talents(claimed, user_id dolu)' AS kontrol,
         (SELECT count(*) FROM public.profiles WHERE role = 'professional')::bigint,
         (SELECT count(*) FROM public.talents WHERE claim_status = 'claimed' AND user_id IS NOT NULL)::bigint
),
k3 AS (
  SELECT 'K3 providers(professional) = professional_profiles' AS kontrol,
         (SELECT count(*) FROM public.providers WHERE provider_type = 'professional')::bigint,
         (SELECT count(*) FROM public.professional_profiles)::bigint
),
k4 AS (
  SELECT 'K4 agency profil = providers(organization)' AS kontrol,
         (SELECT count(*) FROM public.profiles WHERE role = 'agency')::bigint,
         (SELECT count(*) FROM public.providers WHERE provider_type = 'organization')::bigint
),
k5 AS (
  SELECT 'K5 providers(organization) = organization_profiles' AS kontrol,
         (SELECT count(*) FROM public.providers WHERE provider_type = 'organization')::bigint,
         (SELECT count(*) FROM public.organization_profiles)::bigint
),
k6 AS (
  SELECT 'K6 profilsiz saglayici / yanlis rol' AS kontrol,
         (SELECT count(*) FROM public.providers pr LEFT JOIN public.profiles p ON p.id = pr.id
           WHERE p.id IS NULL
              OR (pr.provider_type = 'professional' AND p.role <> 'professional')
              OR (pr.provider_type = 'organization' AND p.role <> 'agency'))::bigint,
         0::bigint
),
k7 AS (
  SELECT 'K7 alan farki: onay/askiya/is_published/ad/sehir (profiles vs providers)' AS kontrol,
         (SELECT count(*) FROM public.providers pr JOIN public.profiles p ON p.id = pr.id
           WHERE pr.approval_status   IS DISTINCT FROM p.approval_status
              OR pr.approval_note     IS DISTINCT FROM p.approval_note
              OR pr.approved_at       IS DISTINCT FROM p.approved_at
              OR pr.suspended_at      IS DISTINCT FROM p.suspended_at
              OR pr.suspension_reason IS DISTINCT FROM p.suspension_reason
              OR pr.suspended_by      IS DISTINCT FROM p.suspended_by
              OR pr.is_published      IS DISTINCT FROM p.is_published
              OR pr.city_id           IS DISTINCT FROM p.city_id
              OR pr.display_name      IS DISTINCT FROM CASE WHEN p.role = 'professional'
                                                             THEN NULLIF(p.full_name, '')
                                                             ELSE COALESCE(NULLIF(p.company_name, ''), NULLIF(p.full_name, '')) END)::bigint,
         0::bigint
),
k8 AS (
  SELECT 'K8 bio farki (professional_profiles.bio / organization_profiles.about)' AS kontrol,
         (SELECT count(*) FROM public.professional_profiles pp JOIN public.profiles p ON p.id = pp.provider_id
           WHERE pp.bio IS DISTINCT FROM p.bio)::bigint
         + (SELECT count(*) FROM public.organization_profiles op JOIN public.profiles p ON p.id = op.provider_id
           WHERE op.about IS DISTINCT FROM p.bio)::bigint,
         0::bigint
),
k8b AS (
  SELECT 'K8b ajans saglayicisi FAZ 0 kurulusuna bagli mi' AS kontrol,
         (SELECT count(*) FROM public.providers pr
           WHERE pr.provider_type = 'organization'
             AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = pr.organization_id AND o.legacy_profile_id = pr.id))::bigint,
         0::bigint
),
k9 AS (
  SELECT 'K9 talents iletisim sutunlari bos (bilgi; FAZ 5 oncesi 0 beklenir)' AS kontrol,
         (SELECT count(*) FROM public.talents WHERE canonical_email IS NOT NULL OR canonical_phone IS NOT NULL)::bigint,
         0::bigint
),
k10 AS (
  SELECT 'K10 sync_log FAZ 2 kayitlari' AS kontrol,
         (SELECT count(*) FROM public.organization_sync_log WHERE source ILIKE '%faz2%' OR source ILIKE '%provider%')::bigint,
         0::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4
  UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8
  UNION ALL SELECT * FROM k8b UNION ALL SELECT * FROM k9 UNION ALL SELECT * FROM k10
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K9%' THEN 'BILGI' WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
