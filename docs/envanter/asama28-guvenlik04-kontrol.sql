-- =============================================================================
-- ASAMA 28 - Guvenlik 04 kontrolu (YAPI + bilgi, salt okuma) - dal ve uretim
--
-- Migration 20261106130000_guvenlik_04_okuma.sql sonrasi:
--   K1  profiles uzerinde kosulsuz (USING true) okuma politikasi yok
--   K2  profiles_okuma_guv04 politikasi var
--   K3  profile_completeness girissize / uyelere kapali
--   K4  availability_blocks.note girissize / uyelere kapali
--   K5  quote_requests butce sutunlari girissize / uyelere kapali
--   K6  ekranlarin okudugu sutunlar acik (blocked_date, share_budget, status ...)
--   K7  fn_guv04_profil_gorunur + teklif_talebi_butceleri SECURITY DEFINER + search_path
--   K8  butce RPC'si girissize kapali, uyelere acik; gorunurluk fonksiyonu ikisine acik
--   K9  BILGI: girissiz gorulebilen musteri / kurum profili (ilan sahibi + yorum yazari)
--   K10 BILGI: girissize kapanan musteri / kurum profili
-- K1-K8 ESIT olmali. Davranis testi ayri: asama28b (YALNIZ dal).
-- K9-K10 sayi bilgisidir (SQL Editor'de oturum yok = girissiz bakis).
-- =============================================================================

WITH fn AS (
  SELECT p.proname, p.prosecdef, p.proconfig, p.oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('fn_guv04_profil_gorunur', 'teklif_talebi_butceleri')
),
k AS (
  SELECT 'K1 profiles kosulsuz okuma politikasi' AS kontrol,
         (SELECT count(*) FROM pg_policy
           WHERE polrelid = 'public.profiles'::regclass AND polcmd IN ('r', '*')
             AND pg_get_expr(polqual, polrelid) = 'true') AS deger,
         0::bigint AS beklenen
  UNION ALL
  SELECT 'K2 profiles_okuma_guv04 politikasi',
         (SELECT count(*) FROM pg_policy
           WHERE polrelid = 'public.profiles'::regclass AND polname = 'profiles_okuma_guv04'), 1
  UNION ALL
  SELECT 'K3 profile_completeness okunabilir',
         (CASE WHEN has_table_privilege('anon', 'public.profile_completeness', 'SELECT') THEN 1 ELSE 0 END
        + CASE WHEN has_table_privilege('authenticated', 'public.profile_completeness', 'SELECT') THEN 1 ELSE 0 END)::bigint, 0
  UNION ALL
  SELECT 'K4 takvim notu okunabilir',
         (CASE WHEN has_column_privilege('anon', 'public.availability_blocks', 'note', 'SELECT') THEN 1 ELSE 0 END
        + CASE WHEN has_column_privilege('authenticated', 'public.availability_blocks', 'note', 'SELECT') THEN 1 ELSE 0 END)::bigint, 0
  UNION ALL
  SELECT 'K5 talep butcesi okunabilir',
         (SELECT count(*) FROM (VALUES ('anon'), ('authenticated')) r(rol)
            CROSS JOIN (VALUES ('budget_min'), ('budget_max')) s(sutun)
           WHERE has_column_privilege(r.rol, 'public.quote_requests', s.sutun, 'SELECT')), 0
  UNION ALL
  SELECT 'K6 ekran sutunlari acik',
         (SELECT count(*) FROM (VALUES
              ('anon', 'availability_blocks', 'blocked_date'),
              ('anon', 'availability_blocks', 'profile_id'),
              ('authenticated', 'availability_blocks', 'blocked_date'),
              ('authenticated', 'quote_requests', 'id'),
              ('authenticated', 'quote_requests', 'customer_id'),
              ('authenticated', 'quote_requests', 'share_budget'),
              ('authenticated', 'quote_requests', 'status'),
              ('authenticated', 'quote_requests', 'brief_data'),
              ('authenticated', 'quote_requests', 'attachment_path'),
              ('authenticated', 'quote_requests', 'event_id')) v(rol, tablo, sutun)
           WHERE has_column_privilege(v.rol, 'public.' || v.tablo, v.sutun, 'SELECT')), 10
  UNION ALL
  SELECT 'K7 fonksiyonlar SECURITY DEFINER + search_path',
         (SELECT count(*) FROM fn WHERE prosecdef AND proconfig::text LIKE '%search_path=public%'), 2
  UNION ALL
  SELECT 'K8 calistirma yetkileri',
         (CASE WHEN NOT has_function_privilege('anon', 'public.teklif_talebi_butceleri(uuid[])', 'EXECUTE') THEN 1 ELSE 0 END
        + CASE WHEN has_function_privilege('authenticated', 'public.teklif_talebi_butceleri(uuid[])', 'EXECUTE') THEN 1 ELSE 0 END
        + CASE WHEN has_function_privilege('anon', 'public.fn_guv04_profil_gorunur(uuid)', 'EXECUTE') THEN 1 ELSE 0 END
        + CASE WHEN has_function_privilege('authenticated', 'public.fn_guv04_profil_gorunur(uuid)', 'EXECUTE') THEN 1 ELSE 0 END)::bigint, 4
)
SELECT kontrol, deger, beklenen,
       CASE WHEN deger = beklenen THEN 'ESIT' ELSE 'FARKLI' END AS sonuc
  FROM k
UNION ALL
SELECT 'K9 BILGI: girissize acik musteri / kurum profili', count(*), count(*), 'BILGI'
  FROM public.profiles x
 WHERE x.role IN ('client', 'business') AND public.fn_guv04_profil_gorunur(x.id)
UNION ALL
SELECT 'K10 BILGI: girissize kapanan musteri / kurum profili', count(*), count(*), 'BILGI'
  FROM public.profiles x
 WHERE x.role IN ('client', 'business') AND NOT public.fn_guv04_profil_gorunur(x.id);
