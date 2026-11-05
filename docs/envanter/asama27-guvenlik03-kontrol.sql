-- =============================================================================
-- ASAMA 27 - Guvenlik 03 kontrolu (YAPI + iz, salt okuma) - dal ve uretim
--
-- Migration 20261106120000_guvenlik_03_rpc_ve_kalan_yazma.sql sonrasi:
--   K1  hicbir admin_* fonksiyonu girissize acik degil
--   K2  public'teki her admin_* fonksiyonu yonetici kontrolu yapiyor
--   K3  20 eski fonksiyon internal semasinda, uyelere / girissize kapali
--   K4  bildirim + abonelik fonksiyonlari girissize kapali (3)
--   K5  proposals: alici / etkinlik / ekip sutunlarina UPDATE yetkisi yok
--   K6  alti tetikleyici var ve etkin
--   K7  fn_guv03_* fonksiyonlari SECURITY DEFINER + search_path
--   K8-K11 IZ (bilgi; gecmiste kullanilmis mi): 0 beklenir
-- K1-K7 ESIT olmali. Davranis testi ayri: asama27b (YALNIZ dal).
-- =============================================================================

WITH adm AS (
  SELECT p.oid, p.proname, n.nspname, p.prosrc
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN ('public', 'internal') AND p.proname LIKE 'admin\_%'
),
tetik AS (
  SELECT t.tgname, t.tgrelid::regclass::text AS tablo, t.tgenabled
    FROM pg_trigger t
   WHERE NOT t.tgisinternal
     AND t.tgname IN ('trg_guv03_eklenti_hizmeti', 'trg_guv03_sohbet_atama', 'trg_guv03_ek_yolu', 'trg_guv03_premium')
),
fn AS (
  SELECT p.proname, p.prosecdef, p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname LIKE 'fn\_guv03\_%'
),
k AS (
  SELECT 'K1 girissize acik admin_*' AS kontrol,
         (SELECT count(*) FROM adm WHERE nspname = 'public' AND has_function_privilege('anon', oid, 'EXECUTE')) AS deger,
         0::bigint AS beklenen,
         (SELECT string_agg(proname, ', ') FROM adm WHERE nspname = 'public' AND has_function_privilege('anon', oid, 'EXECUTE')) AS ayrinti
  UNION ALL
  SELECT 'K2 yonetici kontrolsuz admin_* (public)',
         (SELECT count(*) FROM adm WHERE nspname = 'public' AND prosrc !~* 'is_admin'), 0,
         (SELECT string_agg(proname, ', ') FROM adm WHERE nspname = 'public' AND prosrc !~* 'is_admin')
  UNION ALL
  SELECT 'K3 internal.admin_* (uyelere kapali)',
         (SELECT count(*) FROM adm WHERE nspname = 'internal'
             AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')
             AND NOT has_function_privilege('anon', oid, 'EXECUTE')), 20, NULL
  UNION ALL
  SELECT 'K4 bildirim / abonelik girissize acik',
         (CASE WHEN has_function_privilege('anon', 'public.notify_quote_request_recipients(uuid[], text)', 'EXECUTE') THEN 1 ELSE 0 END
        + CASE WHEN has_function_privilege('anon', 'public.get_push_subscriptions_for_user(uuid)', 'EXECUTE') THEN 1 ELSE 0 END
        + CASE WHEN has_function_privilege('anon', 'public.delete_push_subscription_by_endpoint(text)', 'EXECUTE') THEN 1 ELSE 0 END)::bigint,
         0, NULL
  UNION ALL
  SELECT 'K5 proposals alici / etkinlik / ekip UPDATE',
         (SELECT count(*) FROM information_schema.column_privileges
           WHERE table_schema = 'public' AND table_name = 'proposals'
             AND grantee IN ('anon', 'authenticated') AND privilege_type = 'UPDATE'
             AND column_name IN ('buyer_organization_id', 'buyer_user_id', 'event_id', 'crew_id')), 0, NULL
  UNION ALL
  SELECT 'K6 tetikleyiciler (etkin)', (SELECT count(*) FROM tetik WHERE tgenabled = 'O'), 6,
         (SELECT string_agg(tgname || '@' || tablo, ', ') FROM tetik)
  UNION ALL
  SELECT 'K7 fn_guv03 SECURITY DEFINER + search_path',
         (SELECT count(*) FROM fn WHERE prosecdef AND proconfig::text LIKE '%search_path=public%'), 5, NULL
)
SELECT kontrol, deger, beklenen,
       CASE WHEN deger = beklenen THEN 'ESIT' ELSE 'FARKLI' END AS sonuc, ayrinti
  FROM k
UNION ALL
SELECT 'K8 IZ: baskasinin hizmetine bagli eklenti (bilgi)', count(*), 0,
       CASE WHEN count(*) = 0 THEN 'ESIT' ELSE 'BILGI' END, string_agg(a.id::text, ', ')
  FROM public.service_addons a JOIN public.services s ON s.id = a.service_id
 WHERE s.profile_id <> a.profile_id
UNION ALL
SELECT 'K9 IZ: ekip disi sohbet atamasi (bilgi)', count(*), 0,
       CASE WHEN count(*) = 0 THEN 'ESIT' ELSE 'BILGI' END, string_agg(ca.id::text, ', ')
  FROM public.conversation_assignees ca JOIN public.conversations c ON c.id = ca.conversation_id
 WHERE NOT EXISTS (
         SELECT 1 FROM public.organizations o
           JOIN public.organization_memberships om ON om.organization_id = o.id
          WHERE o.legacy_profile_id = c.professional_id AND om.user_id = ca.professional_id
            AND om.status = 'active' AND COALESCE(om.legacy_source, '') <> 'owner_seed')
UNION ALL
SELECT 'K10 IZ: role uymayan / 13 ayi asan premium (bilgi)', count(*), 0,
       CASE WHEN count(*) = 0 THEN 'ESIT' ELSE 'BILGI' END, string_agg(id::text, ', ')
  FROM public.profiles
 WHERE COALESCE(premium_tier, 'none') <> 'none'
   AND (premium_until > now() + interval '13 months'
        OR NOT ((role = 'professional' AND premium_tier IN ('premium', 'plus'))
                OR (role = 'agency' AND premium_tier = 'agency')))
UNION ALL
SELECT 'K11 IZ: baskasinin klasorunu gosteren ek (bilgi)', x.n, 0,
       CASE WHEN x.n = 0 THEN 'ESIT' ELSE 'BILGI' END, NULL
  FROM (SELECT (SELECT count(*) FROM public.messages m
                 WHERE m.attachment_path IS NOT NULL AND split_part(m.attachment_path, '/', 1) <> m.sender_id::text)
             + (SELECT count(*) FROM public.applications a
                 WHERE a.attachment_path IS NOT NULL AND split_part(a.attachment_path, '/', 1) <> a.applicant_id::text)
             + (SELECT count(*) FROM public.quote_requests q
                 WHERE q.attachment_path IS NOT NULL
                   AND split_part(q.attachment_path, '/', 1) <> COALESCE(q.created_by, q.customer_id)::text) AS n) x;
