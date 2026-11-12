-- =============================================================================
-- ASAMA 34 - Duzeltme 15-E kontrolu (YAPI, salt okuma) - dal ve uretim
--
-- Migration 20261112150000_duzeltme_15e_ajans_uzerinden_teklif.sql sonrasi:
--   K1  organization_memberships.offers_via_agency: NOT NULL, varsayilan false
--   K2  kisi basina tek ajans: kismi tekil indeks
--   K3  tutarlilik tetikleyicisi (INSERT / UPDATE OF offers_via_agency, status)
--   K4  org_member_set_offer_routing: SECURITY DEFINER + search_path;
--       girissize kapali, uyelere acik
--   K5  fn_duz15_teklif_yonlendirme: SECURITY DEFINER + STABLE + search_path;
--       girissize kapali, uyelere acik; acik ekip gorunumunu ve oturumu soruyor
--   K6  uyelik tablosu istemciye yazilamaz (tercih yalniz RPC ile)
--   K7  kurala aykiri acik tercih yok (ajans disi / aktif olmayan / kurulusun
--       kendi hesabi / profesyonel olmayan)
--   K8  BILGI: tercihi acik uyelik sayisi
-- K1-K7 ESIT olmali. Davranis testi: asama34b (YALNIZ dal).
-- =============================================================================

WITH k AS (
  SELECT 'K1 offers_via_agency sutunu' AS kontrol,
         (SELECT count(*) FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'organization_memberships'
             AND column_name = 'offers_via_agency' AND is_nullable = 'NO'
             AND column_default = 'false') AS deger,
         1::bigint AS beklenen
  UNION ALL
  SELECT 'K2 kisi basina tek ajans indeksi',
         (SELECT count(*) FROM pg_indexes
           WHERE schemaname = 'public'
             AND indexname = 'organization_memberships_offers_via_agency_key'
             AND indexdef LIKE 'CREATE UNIQUE INDEX%(user_id) WHERE offers_via_agency'), 1
  UNION ALL
  SELECT 'K3 tutarlilik tetikleyicisi',
         (SELECT count(*) FROM pg_trigger t
           WHERE t.tgrelid = 'public.organization_memberships'::regclass
             AND t.tgname = 'trg_duz15_uyelik_teklif_tercihi' AND NOT t.tgisinternal
             AND pg_get_triggerdef(t.oid) LIKE '%BEFORE INSERT OR UPDATE OF offers_via_agency, status%'), 1
  UNION ALL
  SELECT 'K4 tercih yazma fonksiyonu',
         (SELECT count(*) FROM pg_proc
           WHERE proname = 'org_member_set_offer_routing' AND prosecdef
             AND proconfig::text LIKE '%search_path=%public%'
             AND NOT has_function_privilege('anon', oid, 'EXECUTE')
             AND has_function_privilege('authenticated', oid, 'EXECUTE')), 1
  UNION ALL
  SELECT 'K5 yonlendirme okuma fonksiyonu',
         (SELECT count(*) FROM pg_proc
           WHERE proname = 'fn_duz15_teklif_yonlendirme' AND prosecdef AND provolatile = 's'
             AND proconfig::text LIKE '%search_path=public%'
             AND prosrc LIKE '%organization_team_public%' AND prosrc LIKE '%auth.uid() IS NOT NULL%'
             AND NOT has_function_privilege('anon', oid, 'EXECUTE')
             AND has_function_privilege('authenticated', oid, 'EXECUTE')), 1
  UNION ALL
  SELECT 'K6 uyelik tablosu istemciye yazilamaz',
         (CASE WHEN has_table_privilege('authenticated', 'public.organization_memberships', 'UPDATE')
                 OR has_table_privilege('authenticated', 'public.organization_memberships', 'INSERT')
                 OR has_column_privilege('authenticated', 'public.organization_memberships', 'offers_via_agency', 'UPDATE')
                 OR has_table_privilege('anon', 'public.organization_memberships', 'UPDATE')
               THEN 1 ELSE 0 END)::bigint, 0
  UNION ALL
  SELECT 'K7 kurala aykiri acik tercih',
         (SELECT count(*)
            FROM public.organization_memberships om
            JOIN public.organizations o ON o.id = om.organization_id
            JOIN public.profiles p ON p.id = om.user_id
           WHERE om.offers_via_agency
             AND (o.account_type::text <> 'agency'
                  OR om.status <> 'active'
                  OR om.user_id = o.legacy_profile_id
                  OR om.legacy_source IS NOT DISTINCT FROM 'owner_seed'
                  OR p.role::text <> 'professional')), 0
)
SELECT kontrol, deger, beklenen,
       CASE WHEN deger = beklenen THEN 'ESIT' ELSE 'FARKLI' END AS sonuc
  FROM k
UNION ALL
SELECT 'K8 BILGI: tercihi acik uyelik', count(*), count(*), 'BILGI'
  FROM public.organization_memberships
 WHERE offers_via_agency;
