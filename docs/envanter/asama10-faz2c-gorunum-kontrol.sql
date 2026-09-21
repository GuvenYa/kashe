-- =============================================================================
-- FAZ 2c / Asama 10 — v_providers_public sozlesme kontrolu (SALT OKUNUR; dalda ve URETIMDE)
--
-- Gorunumun profiles'in yerine "birebir" gecebildigini olcer: ayni adli sutunlar (19) her saglayici icin
-- profiles ile ayni degeri vermeli (K2 EXCEPT iki yon 0). Beklenen: hepsi ESIT.
-- =============================================================================

WITH
gorunum AS (
  SELECT id, role, full_name, company_name, avatar_url, bio, city_id, primary_category_id, attributes, category_attributes,
         premium_tier, premium_until, is_published, approval_status, approved_at, suspended_at, last_seen_at, created_at, updated_at
    FROM public.v_providers_public
),
eski AS (
  SELECT p.id, p.role, p.full_name, p.company_name, p.avatar_url, p.bio, p.city_id, p.primary_category_id, p.attributes, p.category_attributes,
         p.premium_tier, p.premium_until, p.is_published, p.approval_status, p.approved_at, p.suspended_at, p.last_seen_at, p.created_at, p.updated_at
    FROM public.profiles p
   WHERE p.role IN ('professional', 'agency')
),
k1 AS (
  SELECT 'K1 satir sayisi: profiles(professional+agency) = v_providers_public' AS kontrol,
         (SELECT count(*) FROM eski)::bigint AS eski, (SELECT count(*) FROM gorunum)::bigint AS yeni
),
k2 AS (
  SELECT 'K2 19 ortak sutun birebir (EXCEPT iki yon)' AS kontrol,
         (SELECT count(*) FROM (SELECT * FROM eski EXCEPT SELECT * FROM gorunum) x)::bigint,
         (SELECT count(*) FROM (SELECT * FROM gorunum EXCEPT SELECT * FROM eski) x)::bigint
),
k3 AS (
  SELECT 'K3 is_visible sayisi = yayinda+onayli+askida degil' AS kontrol,
         (SELECT count(*) FROM public.profiles WHERE role IN ('professional', 'agency') AND is_published AND approval_status = 'approved' AND suspended_at IS NULL)::bigint,
         (SELECT count(*) FROM public.v_providers_public WHERE is_visible)::bigint
),
k4 AS (
  SELECT 'K4 birincil rol dolu = birincil kategorisi rolu olan profil' AS kontrol,
         (SELECT count(*) FROM public.profiles p WHERE p.role IN ('professional', 'agency')
            AND EXISTS (SELECT 1 FROM public.service_roles sr WHERE sr.legacy_category_id = p.primary_category_id))::bigint,
         (SELECT count(*) FROM public.v_providers_public WHERE primary_role_id IS NOT NULL)::bigint
),
k5 AS (
  SELECT 'K5 gorunumde kapali sutun (email/phone/kvkk/approval_note/suspension_reason/suspended_by/welcome) — 0' AS kontrol,
         (SELECT count(*) FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'v_providers_public'
             AND column_name IN ('email', 'phone', 'kvkk_approved_at', 'approval_note', 'suspension_reason', 'suspended_by', 'welcome_email_sent_at'))::bigint,
         0::bigint
),
k6 AS (
  SELECT 'K6 security_invoker acik ve anon/authenticated SELECT var (3 = OK)' AS kontrol,
         (SELECT count(*) FROM pg_class c WHERE c.oid = 'public.v_providers_public'::regclass
            AND 'security_invoker=true' = ANY (c.reloptions))::bigint
         + (SELECT count(DISTINCT grantee) FROM information_schema.role_table_grants
             WHERE table_schema = 'public' AND table_name = 'v_providers_public' AND privilege_type = 'SELECT'
               AND grantee IN ('anon', 'authenticated'))::bigint,
         3::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4
  UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k6
)
SELECT kontrol, eski, yeni,
       CASE WHEN kontrol LIKE 'K2%' THEN eski + yeni ELSE abs(eski - yeni) END AS fark,
       CASE WHEN (CASE WHEN kontrol LIKE 'K2%' THEN eski + yeni ELSE abs(eski - yeni) END) = 0 THEN 'ESIT'
            ELSE 'FARK' END AS durum
  FROM hepsi;
