-- SAHNE 04 — eslestirme gecmisi (FAZ 6 run_event_match + mark_match_candidates_shown / mark_match_candidate_clicked); YALNIZ DALDA; 02'den sonra.

-- Onayli/eslesme durumundaki 18 etkinlik icin sahip JWT'siyle kosu; adaylar gercek Sahne verisinden (uydurma aday yok).

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


CREATE OR REPLACE FUNCTION pg_temp.t(h numeric) RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT now() - (h * interval '1 hour') $$;
CREATE OR REPLACE FUNCTION pg_temp.d(n int) RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Europe/Istanbul')::date + n $$;
CREATE OR REPLACE FUNCTION pg_temp.kat(s text) RETURNS int LANGUAGE sql STABLE AS $$ SELECT id FROM public.service_categories WHERE slug = s $$;
CREATE OR REPLACE FUNCTION pg_temp.rol(s text) RETURNS int LANGUAGE sql STABLE AS $$ SELECT id FROM public.service_roles WHERE slug = s $$;
CREATE OR REPLACE FUNCTION pg_temp.sehir(s text) RETURNS int LANGUAGE sql STABLE AS $$ SELECT id FROM public.turkish_cities WHERE name = s ORDER BY id LIMIT 1 $$;
CREATE OR REPLACE FUNCTION pg_temp.org(p uuid) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.organizations WHERE legacy_profile_id = p $$;


DO $$
DECLARE r record; run uuid; ids uuid[]; aday record; k int;
BEGIN
  FOR r IN SELECT * FROM (VALUES
('5a4e0002-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000020001', 'hybrid', pg_temp.t(509.52), 10, 0),
('5a4e0002-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000020003', 'hybrid', pg_temp.t(663.13), 9, 3),
('5a4e0002-0000-4000-8000-000000000012', '5a4e0000-0000-4000-8000-000000020003', 'hybrid', pg_temp.t(1549.10), 8, 0),
('5a4e0002-0000-4000-8000-000000000013', '5a4e0000-0000-4000-8000-000000020004', 'individual', pg_temp.t(866.67), 6, 1),
('5a4e0002-0000-4000-8000-000000000015', '5a4e0000-0000-4000-8000-000000020004', 'hybrid', pg_temp.t(191.37), 9, 2),
('5a4e0002-0000-4000-8000-000000000017', '5a4e0000-0000-4000-8000-000000020005', 'hybrid', pg_temp.t(1369.09), 10, 3),
('5a4e0002-0000-4000-8000-000000000023', '5a4e0000-0000-4000-8000-000000020006', 'hybrid', pg_temp.t(1352.66), 9, 2),
('5a4e0002-0000-4000-8000-000000000032', '5a4e0000-0000-4000-8000-000000020008', 'hybrid', pg_temp.t(168.47), 9, 3),
('5a4e0002-0000-4000-8000-000000000035', '5a4e0000-0000-4000-8000-000000020009', 'individual', pg_temp.t(982.15), 10, 2),
('5a4e0002-0000-4000-8000-000000000037', '5a4e0000-0000-4000-8000-000000020009', 'hybrid', pg_temp.t(1428.96), 10, 2),
('5a4e0002-0000-4000-8000-000000000038', '5a4e0000-0000-4000-8000-000000020010', 'hybrid', pg_temp.t(177.90), 7, 1),
('5a4e0002-0000-4000-8000-000000000039', '5a4e0000-0000-4000-8000-000000020010', 'hybrid', pg_temp.t(1776.60), 7, 1),
('5a4e0002-0000-4000-8000-000000000041', '5a4e0000-0000-4000-8000-000000020010', 'hybrid', pg_temp.t(203.09), 6, 1),
('5a4e0002-0000-4000-8000-000000000044', '5a4e0000-0000-4000-8000-000000020011', 'hybrid', pg_temp.t(1405.87), 7, 1),
('5a4e0002-0000-4000-8000-000000000045', '5a4e0000-0000-4000-8000-000000020011', 'hybrid', pg_temp.t(477.92), 10, 0),
('5a4e0002-0000-4000-8000-000000000051', '5a4e0000-0000-4000-8000-000000030001', 'hybrid', pg_temp.t(213.67), 7, 0),
('5a4e0002-0000-4000-8000-000000000054', '5a4e0000-0000-4000-8000-000000030002', 'hybrid', pg_temp.t(714.56), 6, 3),
('5a4e0002-0000-4000-8000-000000000059', '5a4e0000-0000-4000-8000-000000030004', 'hybrid', pg_temp.t(841.10), 9, 3)
  ) AS v(etkinlik, sahip, strateji, kosu, goster, tikla) LOOP
    DELETE FROM public.match_runs WHERE event_id = r.etkinlik::uuid;   -- tekrar kosuda eski Sahne kosusu gider
    PERFORM set_config('request.jwt.claim.sub', r.sahip, true);
    run := public.run_event_match(r.etkinlik::uuid, r.strateji::public.match_strategy);
    -- gosterilenler: rol basina ilk N aday; tiklananlar: gosterilenlerden ilk M (deterministik sira)
    SELECT array_agg(id) INTO ids FROM public.match_candidates WHERE match_run_id = run AND final_rank <= r.goster;
    IF ids IS NOT NULL THEN PERFORM public.mark_match_candidates_shown(run, ids); END IF;
    k := 0;
    FOR aday IN SELECT id FROM public.match_candidates WHERE match_run_id = run AND was_shown ORDER BY final_rank, provider_id LOOP
      EXIT WHEN k >= r.tikla;
      PERFORM public.mark_match_candidate_clicked(aday.id);
      k := k + 1;
    END LOOP;
    -- zaman: kosu, adaylar ve olaylar etkinlik olusturmasindan sonraki gune cekilir (tetikleyiciler now() yazdi)
    UPDATE public.match_runs SET created_at = r.kosu WHERE id = run;
    UPDATE public.match_candidates SET created_at = r.kosu WHERE match_run_id = run;
    UPDATE public.analytics_events SET occurred_at = r.kosu WHERE entity_type = 'match_run' AND entity_id = run;
    UPDATE public.analytics_events a SET occurred_at = r.kosu + (CASE a.event_name WHEN 'match_shown' THEN interval '2 minutes' ELSE interval '9 minutes' END)
      FROM public.match_candidates mc WHERE a.entity_type = 'match_candidate' AND a.entity_id = mc.id AND mc.match_run_id = run;
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;

-- ozet
SELECT (SELECT count(*) FROM public.match_runs r JOIN public.events e ON e.id = r.event_id WHERE e.id::text LIKE '5a4e0002-%') AS kosu,
       (SELECT count(*) FROM public.match_candidates c JOIN public.match_runs r ON r.id = c.match_run_id JOIN public.events e ON e.id = r.event_id WHERE e.id::text LIKE '5a4e0002-%') AS aday,
       (SELECT count(*) FROM public.match_candidates c JOIN public.match_runs r ON r.id = c.match_run_id JOIN public.events e ON e.id = r.event_id WHERE e.id::text LIKE '5a4e0002-%' AND c.was_shown) AS gosterilen,
       (SELECT count(*) FROM public.match_candidates c JOIN public.match_runs r ON r.id = c.match_run_id JOIN public.events e ON e.id = r.event_id WHERE e.id::text LIKE '5a4e0002-%' AND c.was_clicked) AS tiklanan,
       (SELECT count(DISTINCT c.provider_id) FROM public.match_candidates c JOIN public.match_runs r ON r.id = c.match_run_id JOIN public.events e ON e.id = r.event_id WHERE e.id::text LIKE '5a4e0002-%' AND c.was_shown) AS gosterilen_saglayici,
       (SELECT count(*) FROM public.analytics_events WHERE event_name IN ('match_run', 'match_shown', 'match_clicked') AND occurred_at > now() - interval '1 hour') AS simdiki_olay;
