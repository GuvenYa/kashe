-- =============================================================================
-- FAZ 9 / Asama 19 — Zeka katmani tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE)
-- Bolum A (9a olay zinciri):
--   K1 nesneler: analytics_events tablosu + fn_faz9_olay_yaz + analytics_summary + fn_faz9_booking_payload + CHECK sozluk 23 ad (5)
--   K2 tetikleyiciler: trg_faz9_% 10 tabloda 10 (10)
--   K3 dolum tutarliligi: brief_created = event_briefs; match_run = match_runs; booking_created = bookings;
--      proposal_sent = gonderilmis surumler; quote_created = quotes; crew_selected = crew_members -> fark toplami (0)
--   K4 PII taramasi: payload anahtarlari arasinda yasakli alan (email, client_email, phone, full_name, client_name, name, body,
--      notes, raw_text, description, cancellation_reason, title) (0)
--   K5 yetki: SELECT politikasi 1 (is_admin) + authenticated INSERT/UPDATE/DELETE yok + anon SELECT yok + fn_faz9_olay_yaz
--      authenticated EXECUTE yok + analytics_summary authenticated var (5)
--   K6 bilgi: toplam olay / son 7 gun olay
-- Beklenen: K1-K5 ESIT; K6 BILGI.
-- =============================================================================

WITH
k1 AS (
  SELECT 'K1 9a nesneleri (5)' AS kontrol,
         ((to_regclass('public.analytics_events') IS NOT NULL)::int
          + (to_regprocedure('public.fn_faz9_olay_yaz(text, text, uuid, uuid, uuid, text, jsonb, timestamptz, uuid)') IS NOT NULL)::int
          + (to_regprocedure('public.analytics_summary(integer)') IS NOT NULL)::int
          + (to_regprocedure('public.fn_faz9_booking_payload(public.bookings)') IS NOT NULL)::int
          + (SELECT (array_length(regexp_split_to_array(pg_get_constraintdef(oid), ''''), 1) - 1) / 2 = 23 FROM pg_constraint
              WHERE conname = 'analytics_events_name_check')::int)::bigint AS eski,
         5::bigint AS yeni
),
k2 AS (
  SELECT 'K2 9a tetikleyicileri (10)' AS kontrol,
         (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
           WHERE NOT t.tgisinternal AND t.tgname LIKE 'trg_faz9_%'
             AND c.relname IN ('event_briefs', 'events', 'match_runs', 'match_candidates', 'crew_members', 'proposal_versions',
                               'proposals', 'quotes', 'rfps', 'bookings'))::bigint,
         10::bigint
),
k3 AS (
  SELECT 'K3 dolum tutarsizligi (0)' AS kontrol,
         (abs((SELECT count(*) FROM public.event_briefs) - (SELECT count(*) FROM public.analytics_events a WHERE a.event_name = 'brief_created' AND EXISTS (SELECT 1 FROM public.event_briefs b WHERE b.id = a.entity_id)))
          + abs((SELECT count(*) FROM public.match_runs) - (SELECT count(*) FROM public.analytics_events a WHERE a.event_name = 'match_run' AND EXISTS (SELECT 1 FROM public.match_runs m WHERE m.id = a.entity_id)))
          + abs((SELECT count(*) FROM public.bookings) - (SELECT count(*) FROM public.analytics_events a WHERE a.event_name = 'booking_created' AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = a.entity_id)))
          + abs((SELECT count(*) FROM public.proposal_versions WHERE sent_at IS NOT NULL) - (SELECT count(*) FROM public.analytics_events a WHERE a.event_name = 'proposal_sent' AND EXISTS (SELECT 1 FROM public.proposal_versions v WHERE v.id = a.entity_id)))
          + abs((SELECT count(*) FROM public.quotes) - (SELECT count(*) FROM public.analytics_events a WHERE a.event_name = 'quote_created' AND EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = a.entity_id)))
          + abs((SELECT count(*) FROM public.crew_members) - (SELECT count(*) FROM public.analytics_events a WHERE a.event_name = 'crew_selected' AND EXISTS (SELECT 1 FROM public.crew_members c WHERE c.id = a.entity_id))))::bigint,
         0::bigint
),
k4 AS (
  SELECT 'K4 payload PII anahtari (0)' AS kontrol,
         (SELECT count(*) FROM public.analytics_events, LATERAL jsonb_object_keys(payload) k
           WHERE k IN ('email', 'client_email', 'phone', 'full_name', 'client_name', 'name', 'body', 'notes', 'raw_text',
                       'description', 'cancellation_reason', 'title'))::bigint,
         0::bigint
),
k5 AS (
  SELECT 'K5 9a yetki (5)' AS kontrol,
         ((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'analytics_events' AND cmd = 'SELECT')
          + (NOT has_table_privilege('authenticated', 'public.analytics_events', 'INSERT')
             AND NOT has_table_privilege('authenticated', 'public.analytics_events', 'UPDATE')
             AND NOT has_table_privilege('authenticated', 'public.analytics_events', 'DELETE'))::int
          + (NOT has_table_privilege('anon', 'public.analytics_events', 'SELECT'))::int
          + (NOT has_function_privilege('authenticated', 'public.fn_faz9_olay_yaz(text, text, uuid, uuid, uuid, text, jsonb, timestamptz, uuid)', 'EXECUTE'))::int
          + (has_function_privilege('authenticated', 'public.analytics_summary(integer)', 'EXECUTE'))::int)::bigint,
         5::bigint
),
k6 AS (
  SELECT 'K6 toplam olay (eski) / son 7 gun (yeni) (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.analytics_events)::bigint,
         (SELECT count(*) FROM public.analytics_events WHERE occurred_at >= now() - interval '7 days')::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4 UNION ALL SELECT * FROM k5
  UNION ALL SELECT * FROM k6
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K6 %' THEN 'BILGI'
            WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
