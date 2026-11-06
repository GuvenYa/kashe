-- =============================================================================
-- ASAMA 31 - Duzeltme 12 kontrolu (YAPI + bilgi, salt okuma) - dal ve uretim
--
-- Migration 20261106160000_duzeltme_12_teklif_rezervasyon.sql sonrasi:
--   K1  quotes: event_date, start_time, end_time, location, request_no
--   K2  conversations.request_count
--   K3  bookings: completion_requested_at, completion_requested_by
--   K4  dort tetikleyici (teklif ekleme, kabul bildirimi, tamamlama
--       bildirimi, sohbet ekleme)
--   K5  bookings yazma yetkisi: completion_requested_at acik, _by kapali
--   K6  saglayici_dolu_gunler: definer + search_path, girissize acik
--   K7  fn_duz12_talep_yanitlandi: girissize kapali, uyelere acik
--   K8  rezervasyon gecis tetikleyicisi tamamlanma onayini taniyor
--   K9  yorum uygunlugu satici iptalini taniyor
--   K10 sistem_mesaji_ekle yeni turleri taniyor
--   K11-K12 BILGI: ikinci talep teklifleri / onay bekleyen rezervasyon sayisi
-- K1-K10 ESIT olmali. Davranis testi: asama31b (YALNIZ dal).
-- =============================================================================

WITH k AS (
  SELECT 'K1 quotes yeni sutunlar' AS kontrol,
         (SELECT count(*) FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'quotes'
             AND column_name IN ('event_date', 'start_time', 'end_time', 'location', 'request_no')) AS deger,
         5::bigint AS beklenen
  UNION ALL
  SELECT 'K2 conversations.request_count',
         (SELECT count(*) FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'request_count'), 1
  UNION ALL
  SELECT 'K3 bookings tamamlanma sutunlari',
         (SELECT count(*) FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'bookings'
             AND column_name IN ('completion_requested_at', 'completion_requested_by')), 2
  UNION ALL
  SELECT 'K4 duz12 tetikleyicileri',
         (SELECT count(*) FROM pg_trigger
           WHERE (tgrelid = 'public.quotes'::regclass AND tgname IN ('trg_duz12_teklif_ekleme', 'trg_duz12_kabul_bildirimi'))
              OR (tgrelid = 'public.bookings'::regclass AND tgname = 'trg_duz12_tamamlama_bildirimi')
              OR (tgrelid = 'public.conversations'::regclass AND tgname = 'trg_duz12_sohbet_ekleme')), 4
  UNION ALL
  SELECT 'K5 tamamlanma istegi yazma yetkisi',
         (SELECT (has_column_privilege('authenticated', 'public.bookings', 'completion_requested_at', 'UPDATE')
                  AND NOT has_column_privilege('authenticated', 'public.bookings', 'completion_requested_by', 'UPDATE'))::int), 1
  UNION ALL
  SELECT 'K6 dolu gun RPC (girissiz)',
         (SELECT count(*) FROM pg_proc
           WHERE proname = 'saglayici_dolu_gunler' AND prosecdef
             AND proconfig::text LIKE '%search_path=public%'
             AND has_function_privilege('anon', oid, 'EXECUTE')), 1
  UNION ALL
  SELECT 'K7 talep yanitlandi fonksiyonu',
         (SELECT count(*) FROM pg_proc
           WHERE proname = 'fn_duz12_talep_yanitlandi' AND prosecdef
             AND NOT has_function_privilege('anon', oid, 'EXECUTE')
             AND has_function_privilege('authenticated', oid, 'EXECUTE')), 1
  UNION ALL
  SELECT 'K8 gecis tetikleyicisi tamamlanma onayi',
         (SELECT count(*) FROM pg_proc
           WHERE proname = 'fn_guv01_rezervasyon_gecis' AND prosrc LIKE '%completion_requested_at%'), 1
  UNION ALL
  SELECT 'K9 yorum uygunlugu satici iptali',
         (SELECT count(*) FROM pg_proc
           WHERE proname = 'fn_duz03_tamamlanmis_rezervasyon_var' AND prosrc LIKE '%cancelled_by%'), 1
  UNION ALL
  SELECT 'K10 sistem satiri yeni turler',
         (SELECT count(*) FROM pg_proc
           WHERE proname = 'sistem_mesaji_ekle' AND prosrc LIKE '%yeni_talep%'
             AND prosrc LIKE '%teklif_topla%' AND prosrc LIKE '%tamamlama_talebi%'), 1
)
SELECT kontrol, deger, beklenen,
       CASE WHEN deger = beklenen THEN 'ESIT' ELSE 'FARKLI' END AS sonuc
  FROM k
UNION ALL
SELECT 'K11 BILGI: ikinci+ talep teklifi', count(*), count(*), 'BILGI'
  FROM public.quotes WHERE request_no > 1
UNION ALL
SELECT 'K12 BILGI: onay bekleyen rezervasyon', count(*), count(*), 'BILGI'
  FROM public.bookings WHERE status = 'confirmed' AND completion_requested_at IS NOT NULL;
