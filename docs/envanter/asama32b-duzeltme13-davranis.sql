-- =============================================================================
-- ASAMA 32b - Duzeltme 13 DAVRANIS testi - YALNIZ DAL (Sahne verisi gerekir)
--
-- Tek islem, sonda ROLLBACK: hicbir sey kalici yazilmaz. URETIMDE CALISTIRILMAZ.
-- Sinanan: ajans rol kapsami RPC'si (13-C), ajansin ekibe rol uyesi olarak
-- eklenmesi (13-C), rol ihtiyac sayisinin guncellenmesi (13-B).
-- Kosu SABIT DEGIL: dalda ajans adayi en cok olan kurulus etkinligi kosusu
-- secilir (onceki turlarin yeni kosulari sonucu bozmasin).
-- Sonuc tablosunda hepsi GECTI olmali (9 test).
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '5a4e0000-0000-4000-8000-000000090001') THEN
    RAISE EXCEPTION 'Sahne verisi yok - bu test yalniz dalda calisir';
  END IF;
END $$;

CREATE TEMP TABLE sonuc (sira int, test text, beklenen text, gercek text) ON COMMIT DROP;
GRANT ALL ON sonuc TO anon, authenticated;
CREATE TEMP TABLE fx (ad text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON fx TO anon, authenticated;

CREATE FUNCTION pg_temp.kimlik(p uuid) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  IF p IS NULL THEN
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
  ELSE
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', p::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
  END IF;
END $f$;

CREATE FUNCTION pg_temp.anonim() RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'SET LOCAL ROLE anon';
END $f$;

CREATE FUNCTION pg_temp.fx(p text) RETURNS uuid LANGUAGE sql AS $f$ SELECT id FROM fx WHERE ad = p $f$;

-- Bakan olarak kapsam satir sayisi (ENGEL: hata)
CREATE FUNCTION pg_temp.kapsam(p_bakan uuid, p_run uuid) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  n int;
  r text;
BEGIN
  IF p_bakan IS NULL THEN
    PERFORM pg_temp.anonim();
  ELSE
    PERFORM pg_temp.kimlik(p_bakan);
  END IF;
  BEGIN
    EXECUTE 'SELECT count(*) FROM public.fn_duz13_ajans_rol_kapsami($1)' INTO n USING p_run;
    r := n::text;
  EXCEPTION WHEN OTHERS THEN r := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  RETURN r;
END $f$;

-- Bakan olarak yazma denemesi: OK (satir etkilendi) / YOK (0 satir) / ENGEL (hata)
CREATE FUNCTION pg_temp.dene(p_bakan uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  n int;
  r text;
BEGIN
  PERFORM pg_temp.kimlik(p_bakan);
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := CASE WHEN n > 0 THEN 'OK' ELSE 'YOK' END;
  EXCEPTION WHEN OTHERS THEN r := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  RETURN r;
END $f$;

-- ---------------------------------------------------------------- fikstur
DO $$
DECLARE
  v_run uuid;
  v_event uuid;
  v_sahip uuid;
  v_yabanci uuid;
  v_ajans uuid;
  v_rol int;
BEGIN
  -- Ajans adayi en cok olan, kurulus etkinligine ait, sahibi o kurulusta
  -- crew.manage yetkili kosu
  SELECT mr.id, e.id, e.owner_user_id INTO v_run, v_event, v_sahip
    FROM public.match_runs mr
    JOIN public.events e ON e.id = mr.event_id
   WHERE e.organization_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.match_candidates mc WHERE mc.match_run_id = mr.id AND mc.role_id IS NULL)
     AND public.user_has_org_permission(e.owner_user_id, e.organization_id, 'crew.manage')
   ORDER BY (SELECT count(*) FROM public.match_candidates mc WHERE mc.match_run_id = mr.id AND mc.role_id IS NULL) DESC,
            mr.created_at DESC
   LIMIT 1;
  -- Etkinlige hicbir bagi olmayan Sahne musterisi (Fahri'nin rehber musterileri haric)
  SELECT x.id INTO v_yabanci FROM public.profiles x
   WHERE x.role = 'client' AND x.id::text LIKE '5a4e0000-0000-4000-8000-00000004%'
     AND x.id NOT IN ('5a4e0000-0000-4000-8000-000000040004',
                      '5a4e0000-0000-4000-8000-000000040008',
                      '5a4e0000-0000-4000-8000-000000040014')
     AND NOT EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.user_id = x.id)
   ORDER BY x.id LIMIT 1;
  INSERT INTO fx VALUES ('kosu', v_run), ('etkinlik', v_event), ('sahip', v_sahip), ('yabanci', v_yabanci);

  -- Kapsami olan bir ajans + rol (yonetici olarak hesaplanir)
  SELECT k.provider_id, k.role_id INTO v_ajans, v_rol
    FROM public.match_candidates mc
    JOIN LATERAL (
      SELECT mc.provider_id, rq.role_id
        FROM public.event_requirements rq
       WHERE rq.event_id = v_event
         AND EXISTS (SELECT 1 FROM public.provider_services ps
                      WHERE ps.provider_id = mc.provider_id AND ps.role_id = rq.role_id)
       LIMIT 1) k ON true
   WHERE mc.match_run_id = v_run AND mc.role_id IS NULL
   LIMIT 1;
  INSERT INTO fx VALUES ('ajans', v_ajans);
  CREATE TEMP TABLE fx_rol (rol int) ON COMMIT DROP;
  INSERT INTO fx_rol VALUES (v_rol);
  GRANT ALL ON fx_rol TO authenticated;

  IF (SELECT count(*) FROM fx WHERE id IS NOT NULL) < 5 OR v_rol IS NULL THEN
    RAISE EXCEPTION 'Fikstur eksik: %', (SELECT string_agg(ad, ', ') FROM fx WHERE id IS NULL);
  END IF;
END $$;

-- ---------------------------------------------------------------- 13-C kapsam RPC
DO $$
DECLARE
  v_run uuid := pg_temp.fx('kosu');
  v_event uuid := pg_temp.fx('etkinlik');
  v text;
BEGIN
  -- T1 etkinlik sahibi kapsami gorur
  v := pg_temp.kapsam(pg_temp.fx('sahip'), v_run);
  INSERT INTO sonuc VALUES (1, 'sahip ajans rol kapsamini gorur', 'VAR',
    CASE WHEN v ~ '^[0-9]+$' AND v::int > 0 THEN 'VAR' ELSE v END);

  -- T2 donen her cift: rol etkinligin ihtiyaci, saglayici kosunun ajans adayi
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  SELECT count(*)::text INTO v
    FROM public.fn_duz13_ajans_rol_kapsami(v_run) k
   WHERE NOT EXISTS (SELECT 1 FROM public.event_requirements rq WHERE rq.event_id = v_event AND rq.role_id = k.role_id)
      OR NOT EXISTS (SELECT 1 FROM public.match_candidates mc
                      WHERE mc.match_run_id = v_run AND mc.provider_id = k.provider_id AND mc.role_id IS NULL);
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (2, 'donen ciftler ihtiyac ve adayla tutarli', '0', v);

  -- T3 kapsami > 0 olan her ajansin en az bir rolu doner (eslestirme kurali ile ayni)
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  CREATE TEMP TABLE kapsam_sahip ON COMMIT DROP AS
    SELECT * FROM public.fn_duz13_ajans_rol_kapsami(v_run);
  PERFORM pg_temp.kimlik(NULL);
  SELECT count(*)::text INTO v
    FROM public.match_candidates mc
   WHERE mc.match_run_id = v_run AND mc.role_id IS NULL
     AND COALESCE(mc.coverage_ratio, 0) > 0
     AND NOT EXISTS (SELECT 1 FROM kapsam_sahip k WHERE k.provider_id = mc.provider_id);
  INSERT INTO sonuc VALUES (3, 'kapsami olan her ajansin rolu var', '0', v);

  -- T4 iliskisiz kullanici bos gorur
  INSERT INTO sonuc VALUES (4, 'iliskisiz kullanici bos', '0', pg_temp.kapsam(pg_temp.fx('yabanci'), v_run));

  -- T5 girissiz cagiramaz
  INSERT INTO sonuc VALUES (5, 'girissiz cagiramaz', 'ENGEL', pg_temp.kapsam(NULL, v_run));
END $$;

-- ---------------------------------------------------------------- 13-C ajans ekipte rol uyesi
DO $$
DECLARE
  v_event uuid := pg_temp.fx('etkinlik');
  v_crew uuid;
  v_rol int := (SELECT rol FROM fx_rol);
  v text;
BEGIN
  SELECT id INTO v_crew FROM public.crews WHERE event_id = v_event ORDER BY created_at LIMIT 1;
  IF v_crew IS NULL THEN
    PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
    INSERT INTO public.crews (event_id, organization_id, name)
    SELECT v_event, e.organization_id, 'Duz13 test ekibi' FROM public.events e WHERE e.id = v_event
    RETURNING id INTO v_crew;
    PERFORM pg_temp.kimlik(NULL);
  END IF;

  -- T6 sahip ajansi rol uyesi olarak ekler (pazaryeri kaynagi)
  v := pg_temp.dene(pg_temp.fx('sahip'), format(
    'INSERT INTO public.crew_members (crew_id, role_id, provider_id, status, sort_order) VALUES (%L, %s, %L, ''proposed'', 99)',
    v_crew, v_rol, pg_temp.fx('ajans')));
  INSERT INTO sonuc VALUES (6, 'ajans ekibe rol uyesi olarak eklenir', 'OK|marketplace',
    v || '|' || COALESCE((SELECT pool_origin::text FROM public.crew_members
                           WHERE crew_id = v_crew AND provider_id = pg_temp.fx('ajans') AND sort_order = 99 LIMIT 1), 'YOK'));

  -- T7 iliskisiz kullanici ekleyemez
  INSERT INTO sonuc VALUES (7, 'iliskisiz kullanici ekibe ekleyemez', 'ENGEL',
    pg_temp.dene(pg_temp.fx('yabanci'), format(
      'INSERT INTO public.crew_members (crew_id, role_id, provider_id, status) VALUES (%L, %s, %L, ''proposed'')',
      v_crew, v_rol, pg_temp.fx('ajans'))));
END $$;

-- ---------------------------------------------------------------- 13-B rol ihtiyac sayisi
DO $$
DECLARE
  v_event uuid := pg_temp.fx('etkinlik');
  v_rol int := (SELECT rol FROM fx_rol);
  v text;
BEGIN
  -- T8 sahip "bu rolden kac kisi" sayisini degistirir
  v := pg_temp.dene(pg_temp.fx('sahip'), format(
    'UPDATE public.event_requirements SET quantity = 5 WHERE event_id = %L AND role_id = %s', v_event, v_rol));
  INSERT INTO sonuc VALUES (8, 'sahip ihtiyac sayisini gunceller', 'OK|5',
    v || '|' || (SELECT quantity::text FROM public.event_requirements WHERE event_id = v_event AND role_id = v_rol));

  -- T9 iliskisiz kullanici degistiremez (satir gorunmez)
  INSERT INTO sonuc VALUES (9, 'iliskisiz kullanici ihtiyaci degistiremez', 'YOK',
    pg_temp.dene(pg_temp.fx('yabanci'), format(
      'UPDATE public.event_requirements SET quantity = 9 WHERE event_id = %L AND role_id = %s', v_event, v_rol)));
END $$;

-- ---------------------------------------------------------------- sonuc
SELECT sira, test, beklenen, gercek,
       CASE WHEN gercek = beklenen THEN 'GECTI' ELSE 'KALDI' END AS durum
  FROM sonuc
UNION ALL
SELECT 99, 'OZET', '9 GECTI / 9',
       (SELECT count(*) FILTER (WHERE gercek = beklenen) || ' GECTI / ' || count(*) FROM sonuc), ''
 ORDER BY 1;

ROLLBACK;
