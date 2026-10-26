-- =============================================================================
-- FAZ 9 / Asama 19 — Zeka katmani tutarlilik kontrolu (SALT OKUNUR; dalda ve URETIMDE) — 9a + 9b + 9c
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
-- Bolum B (9b fiyat kiyaslari):
--   K7 nesneler: price_benchmarks + fn_faz9b_yayin_esigi (=15) + fn_faz9b_gozlemler + price_benchmarks_compute + price_benchmark_lookup
--      + price_benchmark_lookup_many + price_benchmarks_summary + aile CHECK + NULLS NOT DISTINCT tekil (9)
--   K8 yetki: SELECT politikasi 1 (is_admin) + authenticated INSERT/UPDATE/DELETE yok + anon SELECT yok + compute/gozlemler
--      authenticated EXECUTE yok + lookup anon VE authenticated var + lookup_many anon var + summary authenticated var, anon yok (7)
--   K9 tutarlilik: yayinli satirda sample_size < esik / yayinsiz satirda >= esik / p25 > medyan / medyan > p75 / donem 90 gun degil /
--      (rol, NULL, tur) ailesi -> ihlal toplami (0) + pg_cron: uzanti varsa 'price-benchmarks-daily' isi 1 (uzanti yoksa 0) -> fark (0)
--   K10 bilgi: son hesap gunu hucre toplami (eski) / yayinlanan (yeni)
-- Bolum C (9c Trust Score V0):
--   K11 nesneler: trust_score_snapshots + trust_appeals + fn_faz9c_provider_yetkisi + fn_faz9c_hesapla + trust_score_compute
--      + my_trust_breakdown + trust_appeal_review + trust_score_summary + tek acik itiraz kismi tekil indeksi (9)
--   K12 yetki: snapshots SELECT politikasi 1 + authenticated yazamaz + anon iki tabloyu okuyamaz + appeals politikalari 2 (SELECT, INSERT)
--      + appeals authenticated INSERT var / UPDATE-DELETE yok + compute/hesapla authenticated EXECUTE yok
--      + breakdown/review/summary authenticated var, anon yok (7)
--   K13 tutarlilik: gorunur saglayici skorsuz / skor son snapshot'tan farkli / gorunmeyen saglayici skorlu / snapshot 0-100 disi /
--      saglayici basina >1 acik itiraz -> ihlal toplami (0) + pg_cron 'trust-score-daily' farki (0)
--   K14 bilgi: puanli saglayici (eski) / acik itiraz (yeni)
-- Beklenen: K1-K5, K7-K9, K11-K13 ESIT; K6, K10, K14 BILGI.
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
k7 AS (
  SELECT 'K7 9b nesneleri (9)' AS kontrol,
         ((to_regclass('public.price_benchmarks') IS NOT NULL)::int
          + (to_regprocedure('public.fn_faz9b_yayin_esigi()') IS NOT NULL AND public.fn_faz9b_yayin_esigi() = 15)::int
          + (to_regprocedure('public.fn_faz9b_gozlemler(date, date)') IS NOT NULL)::int
          + (to_regprocedure('public.price_benchmarks_compute(date)') IS NOT NULL)::int
          + (to_regprocedure('public.price_benchmark_lookup(integer, integer, text)') IS NOT NULL)::int
          + (to_regprocedure('public.price_benchmark_lookup_many(integer[], integer, text)') IS NOT NULL)::int
          + (to_regprocedure('public.price_benchmarks_summary()') IS NOT NULL)::int
          + (SELECT count(*) FROM pg_constraint WHERE conname = 'price_benchmarks_family_check')::int
          + (SELECT count(*) FROM pg_constraint c JOIN pg_index i ON i.indexrelid = c.conindid
              WHERE c.conname = 'price_benchmarks_cell_day_key' AND i.indnullsnotdistinct)::int)::bigint AS eski,
         9::bigint AS yeni
),
k8 AS (
  SELECT 'K8 9b yetki (7)' AS kontrol,
         ((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'price_benchmarks' AND cmd = 'SELECT')
          + (NOT has_table_privilege('authenticated', 'public.price_benchmarks', 'INSERT')
             AND NOT has_table_privilege('authenticated', 'public.price_benchmarks', 'UPDATE')
             AND NOT has_table_privilege('authenticated', 'public.price_benchmarks', 'DELETE'))::int
          + (NOT has_table_privilege('anon', 'public.price_benchmarks', 'SELECT'))::int
          + (NOT has_function_privilege('authenticated', 'public.price_benchmarks_compute(date)', 'EXECUTE')
             AND NOT has_function_privilege('authenticated', 'public.fn_faz9b_gozlemler(date, date)', 'EXECUTE'))::int
          + (has_function_privilege('anon', 'public.price_benchmark_lookup(integer, integer, text)', 'EXECUTE')
             AND has_function_privilege('authenticated', 'public.price_benchmark_lookup(integer, integer, text)', 'EXECUTE'))::int
          + (has_function_privilege('anon', 'public.price_benchmark_lookup_many(integer[], integer, text)', 'EXECUTE'))::int
          + (has_function_privilege('authenticated', 'public.price_benchmarks_summary()', 'EXECUTE')
             AND NOT has_function_privilege('anon', 'public.price_benchmarks_summary()', 'EXECUTE'))::int)::bigint,
         7::bigint
),
k9 AS (
  SELECT 'K9 9b tutarsizlik + cron farki (0)' AS kontrol,
         ((SELECT count(*) FROM public.price_benchmarks b
            WHERE (b.is_published AND b.sample_size < public.fn_faz9b_yayin_esigi())
               OR (NOT b.is_published AND b.sample_size >= public.fn_faz9b_yayin_esigi())
               OR b.p25 > b.median OR b.median > b.p75
               OR b.period_end - b.period_start <> 89
               OR (b.city_id IS NULL AND b.event_type IS NOT NULL))
          + abs((SELECT count(*) FROM pg_extension WHERE extname = 'pg_cron')
                - CASE WHEN to_regclass('cron.job') IS NULL THEN 0   -- cron.job yoksa dogrudan yazilamaz (ayristirma hatasi) -> query_to_xml
                       ELSE ((xpath('/row/n/text()', query_to_xml('SELECT count(*) AS n FROM cron.job WHERE jobname = ''price-benchmarks-daily''', false, true, '')))[1])::text::int END))::bigint,
         0::bigint
),
k10 AS (
  SELECT 'K10 son hesap hucre toplami (eski) / yayinlanan (yeni) (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.price_benchmarks WHERE period_end = (SELECT max(period_end) FROM public.price_benchmarks))::bigint,
         (SELECT count(*) FROM public.price_benchmarks WHERE is_published AND period_end = (SELECT max(period_end) FROM public.price_benchmarks))::bigint
),
k11 AS (
  SELECT 'K11 9c nesneleri (9)' AS kontrol,
         ((to_regclass('public.trust_score_snapshots') IS NOT NULL)::int
          + (to_regclass('public.trust_appeals') IS NOT NULL)::int
          + (to_regprocedure('public.fn_faz9c_provider_yetkisi(uuid)') IS NOT NULL)::int
          + (to_regprocedure('public.fn_faz9c_hesapla(public.providers)') IS NOT NULL)::int
          + (to_regprocedure('public.trust_score_compute(uuid)') IS NOT NULL)::int
          + (to_regprocedure('public.my_trust_breakdown(uuid)') IS NOT NULL)::int
          + (to_regprocedure('public.trust_appeal_review(uuid, text, text)') IS NOT NULL)::int
          + (to_regprocedure('public.trust_score_summary()') IS NOT NULL)::int
          + (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'trust_appeals_one_open_idx' AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%open%')::int)::bigint AS eski,
         9::bigint AS yeni
),
k12 AS (
  SELECT 'K12 9c yetki (7)' AS kontrol,
         ((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trust_score_snapshots' AND cmd = 'SELECT')
          + (NOT has_table_privilege('authenticated', 'public.trust_score_snapshots', 'INSERT')
             AND NOT has_table_privilege('authenticated', 'public.trust_score_snapshots', 'UPDATE')
             AND NOT has_table_privilege('authenticated', 'public.trust_score_snapshots', 'DELETE'))::int
          + (NOT has_table_privilege('anon', 'public.trust_score_snapshots', 'SELECT') AND NOT has_table_privilege('anon', 'public.trust_appeals', 'SELECT'))::int
          + (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trust_appeals' AND cmd IN ('SELECT', 'INSERT'))::int / 2
          + (has_table_privilege('authenticated', 'public.trust_appeals', 'INSERT')
             AND NOT has_table_privilege('authenticated', 'public.trust_appeals', 'UPDATE')
             AND NOT has_table_privilege('authenticated', 'public.trust_appeals', 'DELETE'))::int
          + (NOT has_function_privilege('authenticated', 'public.trust_score_compute(uuid)', 'EXECUTE')
             AND NOT has_function_privilege('authenticated', 'public.fn_faz9c_hesapla(public.providers)', 'EXECUTE'))::int
          + (has_function_privilege('authenticated', 'public.my_trust_breakdown(uuid)', 'EXECUTE')
             AND has_function_privilege('authenticated', 'public.trust_appeal_review(uuid, text, text)', 'EXECUTE')
             AND has_function_privilege('authenticated', 'public.trust_score_summary()', 'EXECUTE')
             AND NOT has_function_privilege('anon', 'public.my_trust_breakdown(uuid)', 'EXECUTE')
             AND NOT has_function_privilege('anon', 'public.trust_score_summary()', 'EXECUTE'))::int)::bigint,
         7::bigint
),
k13 AS (
  SELECT 'K13 9c tutarsizlik + cron farki (0)' AS kontrol,
         ((SELECT count(*) FROM public.providers p
            WHERE (p.is_published AND p.approval_status = 'approved' AND p.suspended_at IS NULL) AND p.trust_score IS NULL)
          + (SELECT count(*) FROM public.providers p
            WHERE NOT (p.is_published AND p.approval_status = 'approved' AND p.suspended_at IS NULL) AND p.trust_score IS NOT NULL)
          + (SELECT count(*) FROM public.providers p
             JOIN LATERAL (SELECT s.score FROM public.trust_score_snapshots s WHERE s.provider_id = p.id ORDER BY s.computed_at DESC, s.id DESC LIMIT 1) son ON true
            WHERE p.trust_score IS NOT NULL AND p.trust_score <> son.score)
          + (SELECT count(*) FROM public.trust_score_snapshots WHERE score < 0 OR score > 100)
          + (SELECT count(*) FROM (SELECT provider_id FROM public.trust_appeals WHERE status = 'open' GROUP BY provider_id HAVING count(*) > 1) x)
          + abs((SELECT count(*) FROM pg_extension WHERE extname = 'pg_cron')
                - CASE WHEN to_regclass('cron.job') IS NULL THEN 0
                       ELSE ((xpath('/row/n/text()', query_to_xml('SELECT count(*) AS n FROM cron.job WHERE jobname = ''trust-score-daily''', false, true, '')))[1])::text::int END))::bigint,
         0::bigint
),
k14 AS (
  SELECT 'K14 puanli saglayici (eski) / acik itiraz (yeni) (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.providers WHERE trust_score IS NOT NULL)::bigint,
         (SELECT count(*) FROM public.trust_appeals WHERE status = 'open')::bigint
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4 UNION ALL SELECT * FROM k5
  UNION ALL SELECT * FROM k6 UNION ALL SELECT * FROM k7 UNION ALL SELECT * FROM k8 UNION ALL SELECT * FROM k9 UNION ALL SELECT * FROM k10
  UNION ALL SELECT * FROM k11 UNION ALL SELECT * FROM k12 UNION ALL SELECT * FROM k13 UNION ALL SELECT * FROM k14
)
SELECT kontrol, eski, yeni, abs(eski - yeni) AS fark,
       CASE WHEN kontrol LIKE 'K6 %' OR kontrol LIKE 'K10 %' OR kontrol LIKE 'K14 %' THEN 'BILGI'
            WHEN eski = yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi;
