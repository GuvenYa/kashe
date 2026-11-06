-- =============================================================================
-- ASAMA 30 - Guvenlik 07 kontrolu (YAPI + bilgi, salt okuma) - dal ve uretim
--
-- Migration 20261106150000_guvenlik_07_sohbet_kanali_ve_kendi_dosyasi.sql sonrasi:
--   K1  realtime.messages uzerinde iki sohbet kanali kurali var
--   K2  ozel kovalarda "kendi klasorunu oku" kurali var
--   K3  fn_guv07_sohbet_kanali: SECURITY DEFINER + search_path, girissize
--       kapali, uyelere acik
--   K4-K6 BILGI: ozel kovalarda hicbir satira bagli olmayan (sahipsiz) dosya
--       sayisi (bulgu 110e; temizlik ayri karar)
-- K1-K3 ESIT olmali. Davranis testi: asama30b (YALNIZ dal).
-- =============================================================================

WITH k AS (
  SELECT 'K1 sohbet kanali kurallari' AS kontrol,
         (SELECT count(*) FROM pg_policy
           WHERE polrelid = 'realtime.messages'::regclass
             AND polname IN ('sohbet_kanali_okuma_guv07', 'sohbet_kanali_yazma_guv07')) AS deger,
         2::bigint AS beklenen
  UNION ALL
  SELECT 'K2 kendi eki okuma kurali',
         (SELECT count(*) FROM pg_policy
           WHERE polrelid = 'storage.objects'::regclass AND polname = 'kendi_eki_okuma_guv07'), 1
  UNION ALL
  SELECT 'K3 kanal fonksiyonu yetkileri',
         (SELECT count(*) FROM pg_proc
           WHERE proname = 'fn_guv07_sohbet_kanali' AND prosecdef
             AND proconfig::text LIKE '%search_path=public%'
             AND NOT has_function_privilege('anon', oid, 'EXECUTE')
             AND has_function_privilege('authenticated', oid, 'EXECUTE')), 1
)
SELECT kontrol, deger, beklenen,
       CASE WHEN deger = beklenen THEN 'ESIT' ELSE 'FARKLI' END AS sonuc
  FROM k
UNION ALL
SELECT 'K4 BILGI: sahipsiz mesaj eki', count(*), count(*), 'BILGI'
  FROM storage.objects o
 WHERE o.bucket_id = 'message-attachments'
   AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.attachment_path = o.name)
UNION ALL
SELECT 'K5 BILGI: sahipsiz teklif talebi eki', count(*), count(*), 'BILGI'
  FROM storage.objects o
 WHERE o.bucket_id = 'quote-attachments'
   AND NOT EXISTS (SELECT 1 FROM public.quote_requests q WHERE q.attachment_path = o.name)
UNION ALL
SELECT 'K6 BILGI: sahipsiz basvuru eki', count(*), count(*), 'BILGI'
  FROM storage.objects o
 WHERE o.bucket_id = 'application-attachments'
   AND NOT EXISTS (SELECT 1 FROM public.applications a WHERE a.attachment_path = o.name);
