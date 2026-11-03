-- =============================================================================
-- Duzeltme 03-B / Asama 21 — tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE)
-- Kaynak: 20261103150000_duzeltme_03b_01_bildirim_ve_kilitler.sql + 20261103150100_duzeltme_03b_02_dolum.sql
--   K1 notifications.type CHECK 'booking' icerir (1) + e-posta kuyrugu indeksi 'booking' ICERMEZ (0) -> (1)
--   K2 fn_faz7b_notify_org: yeni imza (uuid,text,text,text,text,uuid) var (1) - eski 4 parametreli imza (0)
--      + yeni imzada anon/authenticated EXECUTE (0) -> (1); 03-B oncesi -1 cikar
--   K3 nesneler: trg_duz03_booking_notify (bookings, INSERT+UPDATE) + fn_duz03_booking_notify + quotes_expire_stale
--      + fn_duz03_tamamlanmis_rezervasyon_var -> (4)
--   K4 govdeler: portal_proposal_approve 'buyer_user_id' + fn_faz7b_notify_org; portal_proposal_request_revision
--      fn_faz7b_notify_org; proposal_send 'v_rev'; rfp_award 'revision_requested'; rfp_request_revision ''proposal'' -> (5)
--   K5 yorum politikasi: INSERT politikasi fn_duz03_tamamlanmis_rezervasyon_var cagirir (1) + helper authenticated
--      EXECUTE var (1) + anon yok (0) -> (2)
--   K6 sohbet teklifi sure sonu: suresi gecmis 'pending' teklif (0) [gunluk is 00:20 UTC; migration ilk kosuyu yapti]
--   K7 bilgi: pg_cron eklentisi yuklu (1); isin kendisi ayri sorguyla: SELECT jobname, schedule FROM cron.job WHERE jobname = 'quotes-expire-daily'
--   K8 bilgi: dolum kalani — onayli dogrudan teklif, buyer_user_id bos, e-postasi bir hesapla esleşen (0 beklenir)
--   K9 bilgi: son 7 gunde yazilan 'booking' / 'proposal' bildirimi sayisi
-- Beklenen: K1-K6 ESIT; K7-K9 BILGI.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 notifications.type ''booking'' var (1) + e-posta kuyrugu indeksinde yok (0) -> (1)' AS kontrol,
         ((SELECT count(*) FROM pg_constraint WHERE conname = 'notifications_type_check' AND pg_get_constraintdef(oid) LIKE '%''booking''%')
          + (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'notifications_email_pending_idx' AND indexdef LIKE '%''booking''%'))::bigint AS eski,
         1::bigint AS yeni
),
k2 AS (
  SELECT 'K2 fn_faz7b_notify_org yeni imza (1) - eski imza (0) + anon/authenticated EXECUTE (0) -> (1)' AS kontrol,
         ((to_regprocedure('public.fn_faz7b_notify_org(uuid, text, text, text, text, uuid)') IS NOT NULL)::int
          - (to_regprocedure('public.fn_faz7b_notify_org(uuid, text, text, text)') IS NOT NULL)::int
          + (SELECT count(*) FROM information_schema.routine_privileges
              WHERE specific_schema = 'public' AND routine_name = 'fn_faz7b_notify_org'
                AND grantee IN ('anon', 'authenticated') AND privilege_type = 'EXECUTE'))::bigint,
         1::bigint
),
k3 AS (
  SELECT 'K3 03-B nesneleri: tetikleyici + 3 fonksiyon (4)' AS kontrol,
         ((SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
            WHERE NOT t.tgisinternal AND c.relname = 'bookings' AND t.tgname = 'trg_duz03_booking_notify')
          + (to_regprocedure('public.fn_duz03_booking_notify()') IS NOT NULL)::int
          + (to_regprocedure('public.quotes_expire_stale()') IS NOT NULL)::int
          + (to_regprocedure('public.fn_duz03_tamamlanmis_rezervasyon_var(uuid, uuid)') IS NOT NULL)::int)::bigint,
         4::bigint
),
k4 AS (
  SELECT 'K4 govdeler: portal onay/revizyon bildirim + hesap bagi, proposal_send v_rev, rfp_award revision_requested, rfp_request_revision proposal (5)' AS kontrol,
         ((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'portal_proposal_approve'
              AND p.prosrc LIKE '%buyer_user_id%' AND p.prosrc LIKE '%fn_faz7b_notify_org%')
          + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'portal_proposal_request_revision' AND p.prosrc LIKE '%fn_faz7b_notify_org%')
          + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'proposal_send' AND p.prosrc LIKE '%v_rev%')
          + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'rfp_award' AND p.prosrc LIKE '%''revision_requested''%')
          + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'rfp_request_revision' AND p.prosrc LIKE '%''proposal'')%'))::bigint,
         5::bigint
),
k5 AS (
  SELECT 'K5 yorum politikasi helper cagirir (1) + helper authenticated EXECUTE (1) + anon yok (0) -> (2)' AS kontrol,
         ((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reviews' AND cmd = 'INSERT'
            AND with_check LIKE '%fn_duz03_tamamlanmis_rezervasyon_var%')
          + (SELECT count(*) FROM information_schema.routine_privileges
              WHERE specific_schema = 'public' AND routine_name = 'fn_duz03_tamamlanmis_rezervasyon_var'
                AND grantee = 'authenticated' AND privilege_type = 'EXECUTE')
          + (SELECT count(*) FROM information_schema.routine_privileges
              WHERE specific_schema = 'public' AND routine_name = 'fn_duz03_tamamlanmis_rezervasyon_var'
                AND grantee = 'anon' AND privilege_type = 'EXECUTE'))::bigint,
         2::bigint
),
k6 AS (
  SELECT 'K6 suresi gecmis bekleyen sohbet teklifi (0)' AS kontrol,
         (SELECT count(*) FROM public.quotes WHERE status = 'pending' AND expires_at < now())::bigint,
         0::bigint
),
k7 AS (
  SELECT 'K7 pg_cron eklentisi yuklu (bilgi: dalda/uretimde 1; is listesi: SELECT jobname, schedule FROM cron.job)' AS kontrol,
         (SELECT count(*) FROM pg_extension WHERE extname = 'pg_cron')::bigint,
         1::bigint
),
k8 AS (
  SELECT 'K8 dolum kalani: onayli dogrudan teklif, hesap esi var ama buyer_user_id bos (bilgi: 0)' AS kontrol,
         (SELECT count(*) FROM public.proposals p
            JOIN public.profiles pf ON lower(pf.email) = p.client_email
            LEFT JOIN public.organizations o ON o.id = p.seller_organization_id
           WHERE p.status = 'approved' AND p.rfp_id IS NULL AND p.buyer_user_id IS NULL
             AND pf.id IS DISTINCT FROM o.legacy_profile_id)::bigint,
         0::bigint
),
k9 AS (
  SELECT 'K9 son 7 gun ''booking'' (eski) / ''proposal'' (yeni) bildirimi (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.notifications WHERE type = 'booking' AND created_at >= now() - interval '7 days')::bigint,
         (SELECT count(*) FROM public.notifications WHERE type = 'proposal' AND created_at >= now() - interval '7 days')::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4 UNION ALL SELECT * FROM k5
  UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8 UNION ALL SELECT * FROM k9
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K7 %' OR kontrol LIKE 'K8 %' OR kontrol LIKE 'K9 %' THEN 'BILGI'
            WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
