-- =============================================================================
-- ASAMA 29 - Guvenlik 05 kontrolu (YAPI + iz, salt okuma) - dal ve uretim
--
-- Migration 20261106140000_guvenlik_05_dosyalar_ve_sistem_mesaji.sql sonrasi:
--   K1  avatars / portfolio / blog kovalarinda kosulsuz okuma politikasi yok
--   K2  alti yeni dosya okuma politikasi var
--   K3  eski genis / dar okuma politikalari kaldirildi
--   K4  mesaj turu tetikleyicisi var ve etkin
--   K5  tetikleyici fonksiyonu cagiranin yetkisiyle calisiyor (SECURITY INVOKER)
--   K6  sistem_mesaji_ekle: SECURITY DEFINER + search_path, girissize kapali,
--       uyelere acik
--   K7  IZ (bilgi): bilinen kaliplara uymayan sistem satiri (gecmiste sahte
--       satir yazilmis mi): 0 beklenir
--   K8  IZ (bilgi): baska sohbetin teklifini gosteren ya da tekrarlanan
--       teklif mesaji: 0 beklenir
-- K1-K6 ESIT olmali. Davranis testi ayri: asama29b (YALNIZ dal).
-- =============================================================================

WITH pol AS (
  SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS q
    FROM pg_policy
   WHERE polrelid = 'storage.objects'::regclass
),
k AS (
  SELECT 'K1 kamu kovasi kosulsuz okuma' AS kontrol,
         (SELECT count(*) FROM pol
           WHERE polcmd IN ('r', '*')
             AND q IN ('(bucket_id = ''avatars''::text)',
                       '(bucket_id = ''portfolio''::text)',
                       '(bucket_id = ''blog''::text)')) AS deger,
         0::bigint AS beklenen
  UNION ALL
  SELECT 'K2 yeni dosya okuma politikalari',
         (SELECT count(*) FROM pol WHERE polname IN (
            'avatars_okuma_kendi_guv05', 'portfolio_okuma_kendi_guv05', 'blog_okuma_yonetici_guv05',
            'basvuru_eki_okuma_guv05', 'mesaj_eki_okuma_guv05', 'talep_eki_okuma_guv05')), 6
  UNION ALL
  SELECT 'K3 eski okuma politikalari',
         (SELECT count(*) FROM pol WHERE polname IN (
            'avatars_read_all', 'portfolio_read_all', 'blog_storage_public_read',
            'Applicant and listing owner read application attachments',
            'Conversation parties read message attachments',
            'Customer and recipients read quote attachments')), 0
  UNION ALL
  SELECT 'K4 mesaj turu tetikleyicisi (etkin)',
         (SELECT count(*) FROM pg_trigger
           WHERE tgrelid = 'public.messages'::regclass AND tgname = 'trg_guv05_mesaj_turu' AND tgenabled = 'O'), 1
  UNION ALL
  SELECT 'K5 tetikleyici SECURITY INVOKER',
         (SELECT count(*) FROM pg_proc WHERE proname = 'fn_guv05_mesaj_turu' AND NOT prosecdef), 1
  UNION ALL
  SELECT 'K6 sistem_mesaji_ekle yetkileri',
         (SELECT count(*) FROM pg_proc
           WHERE proname = 'sistem_mesaji_ekle' AND prosecdef
             AND proconfig::text LIKE '%search_path=public%'
             AND NOT has_function_privilege('anon', oid, 'EXECUTE')
             AND has_function_privilege('authenticated', oid, 'EXECUTE')), 1
)
SELECT kontrol, deger, beklenen,
       CASE WHEN deger = beklenen THEN 'ESIT' ELSE 'FARKLI' END AS sonuc,
       NULL::text AS ayrinti
  FROM k
UNION ALL
SELECT 'K7 IZ: kaliba uymayan sistem satiri (bilgi)', count(*), 0,
       CASE WHEN count(*) = 0 THEN 'ESIT' ELSE 'BILGI' END,
       string_agg(DISTINCT left(m.body, 60), ' | ')
  FROM public.messages m
 WHERE m.message_type = 'system'
   AND m.body NOT IN ('✓ Teklif onaylandı', '✗ Teklif reddedildi', '⏱ Teklif süresi doldu',
                      '↩ Teklif geri çekildi', 'Müşteri rezervasyonu iptal etti',
                      'Profesyonel rezervasyonu iptal etti', 'Profesyonel işi tamamlandı olarak işaretledi',
                      'Başvurun kabul edildi. Detayları buradan konuşabilirsiniz.',
                      'Talebiniz yeniden ajans tarafından yürütülecek.')
   AND m.body NOT LIKE '📅 Rezervasyon talebi — Tarih: %'
   AND m.body NOT LIKE '% talebinizle ilgilenmek üzere eklendi.'
UNION ALL
SELECT 'K8 IZ: yabanci / tekrar teklif mesaji (bilgi)', x.n, 0,
       CASE WHEN x.n = 0 THEN 'ESIT' ELSE 'BILGI' END, NULL
  FROM (SELECT (SELECT count(*) FROM public.messages m JOIN public.quotes q ON q.id = m.quote_id
                 WHERE m.message_type = 'quote' AND q.conversation_id <> m.conversation_id)
             + (SELECT count(*) FROM (SELECT quote_id FROM public.messages
                                       WHERE message_type = 'quote'
                                       GROUP BY quote_id HAVING count(*) > 1) d) AS n) x;
