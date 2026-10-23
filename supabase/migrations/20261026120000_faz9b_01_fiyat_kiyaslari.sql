-- =============================================================================
-- FAZ 9b / DB 01 — Fiyat kiyaslari (`price_benchmarks`)
-- Kaynak: docs/envanter/34-faz9-zeka-katmani.md bolum 1 (kararlar 4, 7) ve bolum 3.
--
-- Ne yapar:
--   price_benchmarks                 — rol x sehir x etkinlik turu hucresi; kayan 90 gun; p25/medyan/p75/ortalama; yayin esigi 15
--                                      (is_published). Uc satir ailesi: (rol, sehir, tur) · (rol, sehir, NULL) · (rol, NULL, NULL).
--                                      Gun basina bir satir (UNIQUE NULLS NOT DISTINCT). Eski gunler SILINMEZ (ekle-yalniz; ayni gun
--                                      yeniden hesap satiri gunceller).
--   fn_faz9b_yayin_esigi()           — 15 (tek kaynak; hesap + ozet buradan okur)
--   fn_faz9b_gozlemler(start, end)   — kaynak gozlemler (service_role): MUSTERIYE DONUK fiyatlar; `internal.*` YOK
--       1) teklif kalemleri: teklifin SON GONDERILMIS surumu (revizyon cift sayilmaz), etkinlige bagli, role_id dolu,
--          is_visible_to_client, unit_client_price > 0, TRY; sehir/tur = events
--       2) pazaryeri pro teklifleri: quotes.status = accepted, TRY; rol = saglayicinin birincil rolu (yoksa TEK rolu; birden fazla
--          rol ve birincil yoksa ATLANIR), sehir = providers.city_id, tur = events (conversations.event_id) yoksa conversations.event_type
--          (event_types anahtari degilse NULL)
--       Rezervasyonlar AYRI KAYNAK DEGIL: bookings_shape_check geregi her rezervasyon ya teklif surumune (1'de sayildi) ya da quote'a
--       (2'de sayildi) baglidir. Liste fiyatlari (services/provider_services price_min/max) ISLEM DEGIL — girmez.
--   price_benchmarks_compute(as_of)  — gunluk hesap (service_role + pg_cron 00:30 UTC = 03:30 Istanbul); percentile_cont
--   price_benchmark_lookup(rol, sehir, tur) / price_benchmark_lookup_many(roller, sehir, tur)
--                                    — anon + authenticated; son hesaptaki YAYINLANMIS en dar satir + granularity
--                                      (role_city_type | role_city | role); yayinli yoksa bos
--   price_benchmarks_summary()       — admin ozeti (son hesap: hucre toplam / yayinlanan / aile kirilimi / yayinli hucreler / esige yakinlar)
-- RLS: tablo SELECT yalniz is_admin (authenticated); anon yok; INSERT/UPDATE/DELETE yalniz fonksiyon (SECURITY DEFINER).
-- Idempotan. Sapkali harf yok; yorumlar ASCII.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Tablo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_benchmarks (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id           integer NOT NULL REFERENCES public.service_roles(id) ON DELETE CASCADE,
  city_id           integer REFERENCES public.turkish_cities(id) ON DELETE CASCADE,
  event_type        text REFERENCES public.event_types(key) ON DELETE CASCADE,
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  sample_size       integer NOT NULL CHECK (sample_size > 0),
  p25               numeric(12,2),
  median            numeric(12,2),
  p75               numeric(12,2),
  average           numeric(12,2),
  currency          char(3) NOT NULL DEFAULT 'TRY',
  is_published      boolean NOT NULL DEFAULT false,
  algorithm_version text NOT NULL DEFAULT 'bench-v0',
  computed_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_benchmarks_period_check CHECK (period_end >= period_start),
  CONSTRAINT price_benchmarks_family_check CHECK (NOT (city_id IS NULL AND event_type IS NOT NULL)),
  CONSTRAINT price_benchmarks_cell_day_key UNIQUE NULLS NOT DISTINCT (role_id, city_id, event_type, period_end)
);
COMMENT ON TABLE public.price_benchmarks IS
  'FAZ 9b: rol x sehir x etkinlik turu fiyat kiyasi (kayan 90 gun, p25/medyan/p75, yayin esigi fn_faz9b_yayin_esigi). Ekle-yalniz; uygulama yazmaz, price_benchmarks_compute yazar. Okuma yalniz price_benchmark_lookup (yayinli satir).';
COMMENT ON COLUMN public.price_benchmarks.city_id IS 'NULL = tum sehirler (kaba satir).';
COMMENT ON COLUMN public.price_benchmarks.event_type IS 'NULL = tum turler (kaba satir); city_id NULL iken daima NULL (aile kurali).';
COMMENT ON COLUMN public.price_benchmarks.is_published IS 'sample_size >= yayin esigi. Yayinli olmayan satir UI''da HICBIR yerde gorunmez.';

CREATE INDEX IF NOT EXISTS price_benchmarks_role_end_idx ON public.price_benchmarks (role_id, period_end DESC) WHERE is_published;
CREATE INDEX IF NOT EXISTS price_benchmarks_end_idx ON public.price_benchmarks (period_end DESC);

ALTER TABLE public.price_benchmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS price_benchmarks_admin_select ON public.price_benchmarks;
CREATE POLICY price_benchmarks_admin_select ON public.price_benchmarks
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
REVOKE ALL ON public.price_benchmarks FROM PUBLIC, anon, authenticated;   -- varsayilan ayricaliklar (ALL) geri alinir
GRANT SELECT ON public.price_benchmarks TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2) Yayin esigi (tek kaynak)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz9b_yayin_esigi()
RETURNS integer LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT 15 $$;
COMMENT ON FUNCTION public.fn_faz9b_yayin_esigi() IS 'FAZ 9b: hucre yayin esigi (en az islem). Degisirse yalniz burasi degisir.';
REVOKE ALL ON FUNCTION public.fn_faz9b_yayin_esigi() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_faz9b_yayin_esigi() TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) Kaynak gozlemler
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz9b_gozlemler(p_start date, p_end date)
RETURNS TABLE (source text, source_id uuid, role_id integer, city_id integer, event_type text, amount numeric, observed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH son_surum AS (
    -- teklifin son gonderilmis surumu: revizyonlar ayni kalemi iki kez saymasin
    SELECT DISTINCT ON (pv.proposal_id) pv.id, pv.proposal_id, pv.sent_at, pv.currency
      FROM public.proposal_versions pv
     WHERE pv.sent_at IS NOT NULL
     ORDER BY pv.proposal_id, pv.version_no DESC
  ),
  saglayici_rol AS (
    -- birincil rol; birincil yoksa ve tek rol varsa o; aksi halde NULL (atlanir)
    SELECT vr.provider_id,
           CASE WHEN bool_or(vr.is_primary) THEN (array_agg(vr.role_id ORDER BY vr.is_primary DESC, vr.role_id))[1]
                WHEN count(*) = 1 THEN min(vr.role_id) END AS role_id
      FROM public.v_provider_roles vr
     WHERE vr.role_is_active
     GROUP BY vr.provider_id
  )
  SELECT 'proposal_item'::text, pi.id, pi.role_id, e.city_id,
         CASE WHEN EXISTS (SELECT 1 FROM public.event_types t WHERE t.key = e.event_type) THEN e.event_type END,
         pi.unit_client_price, s.sent_at
    FROM son_surum s
    JOIN public.proposals p ON p.id = s.proposal_id
    LEFT JOIN public.rfps r ON r.id = p.rfp_id
    JOIN public.events e ON e.id = COALESCE(p.event_id, r.event_id)
    JOIN public.proposal_items pi ON pi.proposal_version_id = s.id
   WHERE pi.role_id IS NOT NULL
     AND pi.is_visible_to_client
     AND pi.unit_client_price > 0
     AND s.currency = 'TRY'
     AND (s.sent_at AT TIME ZONE 'Europe/Istanbul')::date BETWEEN p_start AND p_end
  UNION ALL
  SELECT 'quote'::text, q.id, sr.role_id, pr.city_id,
         CASE WHEN EXISTS (SELECT 1 FROM public.event_types t WHERE t.key = COALESCE(e.event_type, c.event_type))
              THEN COALESCE(e.event_type, c.event_type) END,
         q.total_amount, COALESCE(q.responded_at, q.created_at)
    FROM public.quotes q
    JOIN public.conversations c ON c.id = q.conversation_id
    LEFT JOIN public.events e ON e.id = c.event_id
    JOIN public.providers pr ON pr.id = q.sender_id
    JOIN saglayici_rol sr ON sr.provider_id = q.sender_id AND sr.role_id IS NOT NULL
   WHERE q.status = 'accepted'
     AND q.currency = 'TRY'
     AND q.total_amount > 0
     AND (COALESCE(q.responded_at, q.created_at) AT TIME ZONE 'Europe/Istanbul')::date BETWEEN p_start AND p_end
$$;
COMMENT ON FUNCTION public.fn_faz9b_gozlemler(date, date) IS
  'FAZ 9b: kiyas gozlemleri (musteriye donuk fiyat; internal.* YOK): son gonderilmis teklif surumunun gorunur rol kalemleri + kabul edilmis pro teklifleri. Yalniz service_role / hesap fonksiyonu.';
REVOKE ALL ON FUNCTION public.fn_faz9b_gozlemler(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_faz9b_gozlemler(date, date) TO service_role;

-- -----------------------------------------------------------------------------
-- 4) Gunluk hesap
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.price_benchmarks_compute(p_as_of date DEFAULT current_date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_start date := p_as_of - 89;   -- 90 gun dahil
  v_esik integer := public.fn_faz9b_yayin_esigi();
  v_n integer := 0;
BEGIN
  WITH g AS (
    SELECT * FROM public.fn_faz9b_gozlemler(v_start, p_as_of)
  ),
  aile AS (
    -- (rol, sehir, tur)
    SELECT g.role_id, g.city_id, g.event_type, count(*)::int AS n,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY g.amount) AS p25,
           percentile_cont(0.5)  WITHIN GROUP (ORDER BY g.amount) AS med,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY g.amount) AS p75,
           avg(g.amount) AS ort
      FROM g WHERE g.city_id IS NOT NULL AND g.event_type IS NOT NULL
     GROUP BY g.role_id, g.city_id, g.event_type
    UNION ALL
    -- (rol, sehir, NULL)
    SELECT g.role_id, g.city_id, NULL, count(*)::int,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY g.amount),
           percentile_cont(0.5)  WITHIN GROUP (ORDER BY g.amount),
           percentile_cont(0.75) WITHIN GROUP (ORDER BY g.amount),
           avg(g.amount)
      FROM g WHERE g.city_id IS NOT NULL
     GROUP BY g.role_id, g.city_id
    UNION ALL
    -- (rol, NULL, NULL)
    SELECT g.role_id, NULL, NULL, count(*)::int,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY g.amount),
           percentile_cont(0.5)  WITHIN GROUP (ORDER BY g.amount),
           percentile_cont(0.75) WITHIN GROUP (ORDER BY g.amount),
           avg(g.amount)
      FROM g
     GROUP BY g.role_id
  )
  INSERT INTO public.price_benchmarks
    (role_id, city_id, event_type, period_start, period_end, sample_size, p25, median, p75, average, currency, is_published, algorithm_version, computed_at)
  SELECT a.role_id, a.city_id, a.event_type, v_start, p_as_of, a.n,
         round(a.p25::numeric, 2), round(a.med::numeric, 2), round(a.p75::numeric, 2), round(a.ort::numeric, 2),
         'TRY', a.n >= v_esik, 'bench-v0', now()
    FROM aile a
  ON CONFLICT (role_id, city_id, event_type, period_end) DO UPDATE
    SET period_start = EXCLUDED.period_start,
        sample_size = EXCLUDED.sample_size,
        p25 = EXCLUDED.p25, median = EXCLUDED.median, p75 = EXCLUDED.p75, average = EXCLUDED.average,
        is_published = EXCLUDED.is_published,
        algorithm_version = EXCLUDED.algorithm_version,
        computed_at = now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
COMMENT ON FUNCTION public.price_benchmarks_compute(date) IS
  'FAZ 9b: p_as_of gununun kayan 90 gun kiyasini yazar (uc aile; ayni gun yeniden kosarsa gunceller). pg_cron gunluk 00:30 UTC. Yalniz service_role.';
REVOKE ALL ON FUNCTION public.price_benchmarks_compute(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_benchmarks_compute(date) TO service_role;

-- -----------------------------------------------------------------------------
-- 5) Okuma: yayinli en dar satir (anon + authenticated)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.price_benchmark_lookup(p_role_id integer, p_city_id integer DEFAULT NULL, p_event_type text DEFAULT NULL)
RETURNS TABLE (median numeric, p25 numeric, p75 numeric, sample_size integer, period_end date, granularity text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH son AS (SELECT max(b.period_end) AS pe FROM public.price_benchmarks b)   -- son hesap gunu; eski gunden satir DONMEZ
  SELECT b.median, b.p25, b.p75, b.sample_size, b.period_end,
         CASE WHEN b.city_id IS NOT NULL AND b.event_type IS NOT NULL THEN 'role_city_type'
              WHEN b.city_id IS NOT NULL THEN 'role_city'
              ELSE 'role' END
    FROM public.price_benchmarks b, son
   WHERE b.role_id = p_role_id
     AND b.is_published
     AND b.period_end = son.pe
     AND (b.city_id IS NULL OR b.city_id = p_city_id)
     AND (b.event_type IS NULL OR b.event_type = p_event_type)
   ORDER BY (b.city_id IS NOT NULL)::int + (b.event_type IS NOT NULL)::int DESC
   LIMIT 1
$$;
COMMENT ON FUNCTION public.price_benchmark_lookup(integer, integer, text) IS
  'FAZ 9b: son hesapta YAYINLANMIS en dar satir (rol+sehir+tur > rol+sehir > rol) + granularity. Yayinli yoksa bos. anon + authenticated.';
REVOKE ALL ON FUNCTION public.price_benchmark_lookup(integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.price_benchmark_lookup(integer, integer, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.price_benchmark_lookup_many(p_role_ids integer[], p_city_id integer DEFAULT NULL, p_event_type text DEFAULT NULL)
RETURNS TABLE (role_id integer, median numeric, p25 numeric, p75 numeric, sample_size integer, period_end date, granularity text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.role_id, l.median, l.p25, l.p75, l.sample_size, l.period_end, l.granularity
    FROM unnest(COALESCE(p_role_ids, '{}'::integer[])) AS r(role_id)
    CROSS JOIN LATERAL public.price_benchmark_lookup(r.role_id, p_city_id, p_event_type) l
$$;
COMMENT ON FUNCTION public.price_benchmark_lookup_many(integer[], integer, text) IS
  'FAZ 9b: birden fazla rol icin lookup (sihirbaz butce kutusu). Yayinli olmayan rol satir DONDURMEZ.';
REVOKE ALL ON FUNCTION public.price_benchmark_lookup_many(integer[], integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.price_benchmark_lookup_many(integer[], integer, text) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6) Admin ozeti
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.price_benchmarks_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_end date;
  v_esik integer := public.fn_faz9b_yayin_esigi();
  v_aile jsonb; v_yayinli jsonb; v_yakin jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'yetkisiz erisim: price_benchmarks_summary icin admin gerekir' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT max(period_end) INTO v_end FROM public.price_benchmarks;
  IF v_end IS NULL THEN
    RETURN jsonb_build_object('period_end', NULL, 'threshold', v_esik, 'cells_total', 0, 'cells_published', 0,
                              'by_granularity', '{}'::jsonb, 'published_cells', '[]'::jsonb, 'near_threshold', '[]'::jsonb);
  END IF;

  WITH b AS (
    SELECT *, CASE WHEN city_id IS NOT NULL AND event_type IS NOT NULL THEN 'role_city_type'
                   WHEN city_id IS NOT NULL THEN 'role_city' ELSE 'role' END AS gran
      FROM public.price_benchmarks WHERE period_end = v_end
  )
  SELECT COALESCE(jsonb_object_agg(gran, jsonb_build_object('total', n, 'published', y)), '{}'::jsonb) INTO v_aile
    FROM (SELECT gran, count(*) AS n, count(*) FILTER (WHERE is_published) AS y FROM b GROUP BY gran) t;

  WITH b AS (
    SELECT *, CASE WHEN city_id IS NOT NULL AND event_type IS NOT NULL THEN 'role_city_type'
                   WHEN city_id IS NOT NULL THEN 'role_city' ELSE 'role' END AS gran
      FROM public.price_benchmarks WHERE period_end = v_end
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'role_id', b.role_id, 'role_name', sr.name_tr,
           'city_id', b.city_id, 'city_name', tc.name,
           'event_type', b.event_type, 'event_type_name', et.name_tr,
           'granularity', b.gran, 'sample_size', b.sample_size,
           'p25', b.p25, 'median', b.median, 'p75', b.p75, 'average', b.average)
         ORDER BY b.sample_size DESC, sr.name_tr, tc.name NULLS FIRST, et.name_tr NULLS FIRST), '[]'::jsonb) INTO v_yayinli
    FROM (SELECT * FROM b WHERE is_published ORDER BY sample_size DESC LIMIT 50) b
    JOIN public.service_roles sr ON sr.id = b.role_id
    LEFT JOIN public.turkish_cities tc ON tc.id = b.city_id
    LEFT JOIN public.event_types et ON et.key = b.event_type;

  WITH b AS (
    SELECT *, CASE WHEN city_id IS NOT NULL AND event_type IS NOT NULL THEN 'role_city_type'
                   WHEN city_id IS NOT NULL THEN 'role_city' ELSE 'role' END AS gran
      FROM public.price_benchmarks WHERE period_end = v_end
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'role_id', b.role_id, 'role_name', sr.name_tr,
           'city_id', b.city_id, 'city_name', tc.name,
           'event_type', b.event_type, 'event_type_name', et.name_tr,
           'granularity', b.gran, 'sample_size', b.sample_size, 'missing', v_esik - b.sample_size)
         ORDER BY b.sample_size DESC, sr.name_tr), '[]'::jsonb) INTO v_yakin
    FROM (SELECT * FROM b WHERE NOT is_published AND sample_size >= GREATEST(1, v_esik - 7) ORDER BY sample_size DESC LIMIT 20) b
    JOIN public.service_roles sr ON sr.id = b.role_id
    LEFT JOIN public.turkish_cities tc ON tc.id = b.city_id
    LEFT JOIN public.event_types et ON et.key = b.event_type;

  RETURN jsonb_build_object(
    'period_end', v_end,
    'period_start', (SELECT min(period_start) FROM public.price_benchmarks WHERE period_end = v_end),
    'threshold', v_esik,
    'cells_total', (SELECT count(*) FROM public.price_benchmarks WHERE period_end = v_end),
    'cells_published', (SELECT count(*) FROM public.price_benchmarks WHERE period_end = v_end AND is_published),
    'observations_total', (SELECT COALESCE(sum(sample_size), 0) FROM public.price_benchmarks WHERE period_end = v_end AND city_id IS NULL AND event_type IS NULL),
    'by_granularity', v_aile,
    'published_cells', v_yayinli,
    'near_threshold', v_yakin);
END;
$$;
COMMENT ON FUNCTION public.price_benchmarks_summary() IS
  'FAZ 9b: admin ozeti — son hesap gunu, hucre toplam/yayinli, aile kirilimi, yayinli hucreler (50), esige yakin hucreler (20). Admin degilse 42501.';
REVOKE ALL ON FUNCTION public.price_benchmarks_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.price_benchmarks_summary() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7) pg_cron (yalniz uzanti varsa — harness'ta yok, dalda ve uretimde var)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE 'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = ''price-benchmarks-daily''';
    EXECUTE 'SELECT cron.schedule(''price-benchmarks-daily'', ''30 0 * * *'', ''SELECT public.price_benchmarks_compute();'')';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 8) Ilk hesap (bugun): hucreler olussun; esik alti olanlar yayinlanmaz, UI hicbir sey gostermez
-- -----------------------------------------------------------------------------
SELECT public.price_benchmarks_compute();

COMMIT;
