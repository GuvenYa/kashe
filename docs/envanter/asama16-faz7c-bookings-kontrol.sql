-- =============================================================================
-- FAZ 7c / Asama 16 — bookings genislemesi tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE)
--
--   K1  yeni sutunlar: buyer_organization_id, seller_provider_id, event_id, crew_member_id, proposal_version_id (5)
--   K2  eski dort sutun artik NULLABLE: quote_id, conversation_id, customer_id, professional_id (4)
--   K3  sekil kisiti bookings_shape_check + surum basina tekil indeks bookings_proposal_version_id_key (2)
--   K4  sekil ihlali: ne eski (4 dolu) ne teklif (proposal_version + seller_provider) sekline uyan satir (0 — CHECK garanti eder)
--   K5  yetki: bookings INSERT/DELETE tablo yetkisi anon+authenticated (0) + authenticated UPDATE sutun yetkisi (5) -> 5
--   K6  RPC/erisim: booking_from_proposal ve can_access_booking_row authenticated var + anon yok (4)
--   K7  RLS politikasi bookings: eski 6 + bookings_select_org + bookings_update_org (8)
--   K8  teklif rezervasyonu tutari surum toplamindan farkli (0)
--   K9  eski tetikleyici yerinde: quotes BEFORE UPDATE on_quote_status_change_create_booking + fonksiyon govdesi bookings'e INSERT eder,
--       proposal icermez (1)
--   K10 bilgi: eski sekil rezervasyon*1000 + teklif rezervasyonu
--   K11 bilgi: onayli teklif olup rezervasyonu olmayan (uygulama "Rezervasyon oluştur" ile kapatir)
--   K12 portal_proposal_view donusunde has_booking (1)
-- Beklenen: K1-K9, K12 ESIT; K10-K11 BILGI.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 yeni sutunlar (5)' AS kontrol,
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings'
           AND column_name IN ('buyer_organization_id','seller_provider_id','event_id','crew_member_id','proposal_version_id'))::bigint AS eski,
         5::bigint AS yeni
),
k2 AS (
  SELECT 'K2 eski sutunlar NULLABLE (4)' AS kontrol,
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings'
           AND column_name IN ('quote_id','conversation_id','customer_id','professional_id') AND is_nullable = 'YES')::bigint,
         4::bigint
),
k3 AS (
  SELECT 'K3 sekil kisiti + tekil indeks (2)' AS kontrol,
         (SELECT count(*) FROM pg_constraint WHERE conname = 'bookings_shape_check' AND conrelid = 'public.bookings'::regclass)::bigint
         + (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'bookings' AND indexname = 'bookings_proposal_version_id_key')::bigint,
         2::bigint
),
k4 AS (
  SELECT 'K4 sekil ihlali (0)' AS kontrol,
         (SELECT count(*) FROM public.bookings b
           WHERE NOT ((b.quote_id IS NOT NULL AND b.conversation_id IS NOT NULL AND b.customer_id IS NOT NULL AND b.professional_id IS NOT NULL)
                   OR (b.proposal_version_id IS NOT NULL AND b.seller_provider_id IS NOT NULL)))::bigint,
         0::bigint
),
k5 AS (
  SELECT 'K5 yetki: INSERT/DELETE 0 + UPDATE sutun 5 = 5' AS kontrol,
         (SELECT count(*) FROM information_schema.role_table_grants
           WHERE table_schema = 'public' AND table_name = 'bookings' AND grantee IN ('anon','authenticated') AND privilege_type IN ('INSERT','DELETE'))::bigint
         + (SELECT count(*) FROM information_schema.column_privileges
             WHERE table_schema = 'public' AND table_name = 'bookings' AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
               AND column_name IN ('status','cancelled_at','cancelled_by','cancellation_reason','completed_at'))::bigint,
         5::bigint
),
k6 AS (
  SELECT 'K6 RPC/erisim yetkileri (4)' AS kontrol,
         (SELECT sum((has_function_privilege('authenticated', f, 'EXECUTE'))::int + (NOT has_function_privilege('anon', f, 'EXECUTE'))::int)
            FROM unnest(ARRAY['public.booking_from_proposal(uuid)', 'public.can_access_booking_row(uuid,uuid,text)']) AS f)::bigint,
         4::bigint
),
k7 AS (
  SELECT 'K7 RLS politikasi bookings (8)' AS kontrol,
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings')::bigint,
         8::bigint
),
k8 AS (
  SELECT 'K8 teklif rezervasyonu tutari surumden farkli (0)' AS kontrol,
         (SELECT count(*) FROM public.bookings b JOIN public.proposal_versions v ON v.id = b.proposal_version_id
           WHERE b.total_amount <> v.total_amount)::bigint,
         0::bigint
),
k9 AS (
  SELECT 'K9 eski quote tetikleyicisi yerinde (1)' AS kontrol,
         (SELECT count(*) FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
           WHERE t.tgrelid = 'public.quotes'::regclass AND t.tgname = 'on_quote_status_change_create_booking'
             AND p.proname = 'on_quote_accepted_create_booking'
             AND p.prosrc ILIKE '%insert into bookings%' AND p.prosrc NOT ILIKE '%proposal%')::bigint,
         1::bigint
),
k10 AS (
  SELECT 'K10 eski*1000 + teklif rezervasyonu (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.bookings WHERE quote_id IS NOT NULL)::bigint * 1000
         + (SELECT count(*) FROM public.bookings WHERE proposal_version_id IS NOT NULL)::bigint,
         0::bigint
),
k11 AS (
  SELECT 'K11 onayli teklif, rezervasyonu yok (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.proposals p
           WHERE p.status = 'approved'
             AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.proposal_version_id = p.current_version_id))::bigint,
         0::bigint
),
k12 AS (
  SELECT 'K12 portal_proposal_view has_booking (1)' AS kontrol,
         (SELECT count(*) FROM pg_proc WHERE proname = 'portal_proposal_view' AND pronamespace = 'public'::regnamespace AND prosrc LIKE '%has_booking%')::bigint,
         1::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4
  UNION ALL SELECT * FROM k5 UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8
  UNION ALL SELECT * FROM k9 UNION ALL SELECT * FROM k10 UNION ALL SELECT * FROM k11 UNION ALL SELECT * FROM k12
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K10 %' OR kontrol LIKE 'K11 %' THEN 'BILGI'
            WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
