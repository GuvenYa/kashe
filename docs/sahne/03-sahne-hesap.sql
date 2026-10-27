-- SAHNE 03 — zeka katmani hesaplari: fiyat kiyaslari + guven puani (YALNIZ DALDA; 02'den sonra)
DO $$
DECLARE n_cron int := 0; n_prof int;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM cron.job WHERE jobname = ''send-message-notifications''' INTO n_cron;
  END IF;
  SELECT count(*) INTO n_prof FROM public.profiles WHERE email NOT LIKE 'faz1test+%' AND email NOT LIKE 'sahne+%';
  IF n_cron > 0 OR n_prof > 10 THEN
    RAISE EXCEPTION 'URETIM KORUMASI: bu veritabani uretim gibi gorunuyor (cron=%, test disi profil=%). Sahne yalniz dalda (ukqhgspaallzjscjodbb) kurulur. Hicbir sey yazilmadi.', n_cron, n_prof;
  END IF;
END $$;

SELECT public.price_benchmarks_compute() AS kiyas_satiri;
SELECT public.trust_score_compute() AS guven_satiri;
-- ozet 1: fiyat kiyasi hucreleri (yayinli / esik alti)
SELECT count(*) AS hucre, count(*) FILTER (WHERE is_published) AS yayinli,
       count(*) FILTER (WHERE is_published AND city_id IS NOT NULL AND event_type IS NOT NULL) AS yayinli_rol_sehir_tur,
       count(*) FILTER (WHERE is_published AND city_id IS NOT NULL AND event_type IS NULL) AS yayinli_rol_sehir,
       count(*) FILTER (WHERE is_published AND city_id IS NULL) AS yayinli_rol
  FROM public.price_benchmarks WHERE period_end = (now() AT TIME ZONE 'Europe/Istanbul')::date;
-- ozet 2: guven dagilimi (Sahne saglayicilari)
SELECT width_bucket(pr.trust_score, 0, 100, 5) AS dilim, count(*) AS saglayici, round(avg(pr.trust_score), 1) AS ortalama
  FROM public.providers pr JOIN public.profiles p ON p.id = pr.id WHERE p.email LIKE 'sahne+%' AND pr.trust_score IS NOT NULL GROUP BY 1 ORDER BY 1;
-- ozet 3: kategori basina gorunur profil / tamamlanan is / yorum
SELECT c.slug, count(DISTINCT v.id) FILTER (WHERE v.is_visible) AS gorunur,
       (SELECT count(*) FROM public.bookings b JOIN public.profiles pp ON pp.id = COALESCE(b.professional_id, b.seller_provider_id) WHERE pp.primary_category_id = c.id AND b.status = 'completed' AND pp.email LIKE 'sahne+%') AS tamamlanan,
       (SELECT count(*) FROM public.reviews r JOIN public.profiles pp ON pp.id = r.professional_id WHERE pp.primary_category_id = c.id AND pp.email LIKE 'sahne+%') AS yorum
  FROM public.service_categories c JOIN public.v_providers_public v ON v.primary_category_id = c.id JOIN public.profiles p ON p.id = v.id AND p.email LIKE 'sahne+%'
 GROUP BY c.id, c.slug ORDER BY gorunur DESC;
