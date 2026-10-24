-- =============================================================================
-- FAZ 9b / DB 03 — hesap gunu ISTANBUL gunu (UTC degil)
-- Kaynak: docs/envanter/34-faz9-zeka-katmani.md bolum 3 (uygulama notlari).
--
-- Sorun: `price_benchmarks_compute(p_as_of date DEFAULT current_date)` — `current_date` oturum saat dilimine (Supabase: UTC) gore gun;
-- gozlemler ise Istanbul gunune gore kovalaniyor (`AT TIME ZONE 'Europe/Istanbul'`). 21:00-24:00 UTC arasinda (Istanbul'da gece
-- yarisindan sonra) elle kosulan hesap, o saatlerde yapilan islemleri "yarin" sayip disarida birakiyordu (tur hazirliginda goruldu;
-- cron 00:30 UTC'de kostugu icin gece kosusu etkilenmiyordu). Cozum: varsayilan `p_as_of` = Istanbul gunu. Govde 02 ile ayni.
-- Idempotan. Sapkali harf yok; yorumlar ASCII.
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.price_benchmarks_compute(p_as_of date DEFAULT (now() AT TIME ZONE 'Europe/Istanbul')::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_start date := p_as_of - 89;   -- 90 gun dahil
  v_esik integer := public.fn_faz9b_yayin_esigi();
  v_basladi timestamptz := clock_timestamp();   -- now() DEGIL: ayni islemde yazilan satirlar bundan SONRA damgalanmali
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
         'TRY', a.n >= v_esik, 'bench-v0', clock_timestamp()
    FROM aile a
  ON CONFLICT (role_id, city_id, event_type, period_end) DO UPDATE
    SET period_start = EXCLUDED.period_start,
        sample_size = EXCLUDED.sample_size,
        p25 = EXCLUDED.p25, median = EXCLUDED.median, p75 = EXCLUDED.p75, average = EXCLUDED.average,
        is_published = EXCLUDED.is_published,
        algorithm_version = EXCLUDED.algorithm_version,
        computed_at = clock_timestamp();
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- bu kosuda dokunulmayan (gozlemi kalmamis) ayni gun hucreleri: eskidi, silinir
  DELETE FROM public.price_benchmarks b
   WHERE b.period_end = p_as_of AND b.computed_at < v_basladi;

  RETURN v_n;
END;
$$;
COMMENT ON FUNCTION public.price_benchmarks_compute(date) IS
  'FAZ 9b: p_as_of (varsayilan ISTANBUL gunu) icin kayan 90 gun kiyasini yazar (uc aile; ayni gun yeniden kosarsa gunceller, gozlemi kalmayan ayni gun hucresini siler). pg_cron gunluk 00:30 UTC. Yalniz service_role.';

COMMIT;
