-- =============================================================================
-- FAZ 9c / DB 01 — Trust Score V0 (kural tabanli, aciklanabilir, gunluk; dokum + itiraz)
-- Kaynak: docs/envanter/34-faz9-zeka-katmani.md bolum 1 (kararlar 3, 5, 6) ve bolum 4.
--
-- Ne yapar:
--   trust_score_snapshots           — ekle-yalniz gunluk dokum: score 0-100 + components jsonb (alti bilesen, puan + ham deger)
--   trust_appeals                   — saglayicinin kendi dokumune itirazi; admin inceler (status open/reviewed/closed + admin_note);
--                                     saglayici basina tek ACIK itiraz (kismi tekil indeks); saglayici dogrudan INSERT (RLS), admin RPC ile karar
--   fn_faz9c_provider_yetkisi(pid)  — oturum sahibi bu saglayicinin kendisi mi ya da ajans kurulusunda settings.manage mi
--   fn_faz9c_hesapla(providers)     — tek saglayicinin bilesenleri + skoru (saf hesap; yazmaz)
--   trust_score_compute(p_provider) — gorunur saglayicilari hesaplar, snapshot yazar, providers.trust_score/trust_computed_at gunceller
--                                     (koruma tetikleyicisi kapisi kashe.sync_bypass); gorunur olmayanlarin skoru NULL'a cekilir.
--                                     service_role + pg_cron 00:45 UTC (03:45 Istanbul)
--   my_trust_breakdown(p_provider)  — kendi (ya da yetkili oldugu ajansin) son dokumu + son itiraz (authenticated; yetkisiz 42501)
--   trust_appeal_review(id, status, note) — admin karari (reviewed/closed + not); 42501 admin degilse
--   trust_score_summary()           — admin ozeti: dagilim (0-39/40-69/70+), ortalama, hesaplanmayan, itiraz kuyrugu, bilesen ortalamalari
-- Bilesenler (toplam 100; GREATEST(0, LEAST(100, ...))): dogrulama 0-25, profil 0-15, tamamlanan is 0-25, iptal -15..0,
--   degerlendirme 0-20 (cnt<3 notr 8), yanit suresi 0-15 (veri yok notr 7). algorithm_version 'trust-v0.1'.
-- Musteri yuzeyinde skor YOK; Kesfet siralamasi DEGISMEZ; Match V0.2 high_trust (trust_score >= 70) kendiliginden dolar.
-- Idempotan. Sapkali harf yok; yorumlar ASCII.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Tablolar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trust_score_snapshots (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_id       uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  computed_at       timestamptz NOT NULL DEFAULT now(),
  algorithm_version text NOT NULL DEFAULT 'trust-v0.1',
  score             numeric(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  components        jsonb NOT NULL DEFAULT '{}'::jsonb
);
COMMENT ON TABLE public.trust_score_snapshots IS
  'FAZ 9c: Trust Score V0 gunluk dokumu (ekle-yalniz). components: verification/profile/completed/cancel/reviews/response {points, ham deger}. Yalniz trust_score_compute yazar.';
CREATE INDEX IF NOT EXISTS trust_score_snapshots_provider_idx ON public.trust_score_snapshots (provider_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS public.trust_appeals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  snapshot_id  bigint REFERENCES public.trust_score_snapshots(id) ON DELETE SET NULL,
  message      text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 20 AND 2000),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'closed')),
  admin_note   text CHECK (admin_note IS NULL OR char_length(admin_note) <= 2000),
  reviewed_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at  timestamptz,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.trust_appeals IS
  'FAZ 9c: saglayicinin guven dokumune itirazi (KVKK insan incelemesi izi). Saglayici acar (RLS), admin trust_appeal_review ile karar yazar. Saglayici basina tek acik itiraz.';
CREATE UNIQUE INDEX IF NOT EXISTS trust_appeals_one_open_idx ON public.trust_appeals (provider_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS trust_appeals_status_idx ON public.trust_appeals (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_trust_appeals_updated_at ON public.trust_appeals;
CREATE TRIGGER trg_trust_appeals_updated_at BEFORE UPDATE ON public.trust_appeals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 2) Yetki yardimcisi: kendi saglayicisi ya da ajans kurulusunda settings.manage
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz9c_provider_yetkisi(p_provider uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    auth.uid() = p_provider
    OR EXISTS (SELECT 1 FROM public.providers p
                WHERE p.id = p_provider AND p.organization_id IS NOT NULL
                  AND public.has_org_permission(p.organization_id, 'settings.manage')))
$$;
COMMENT ON FUNCTION public.fn_faz9c_provider_yetkisi(uuid) IS
  'FAZ 9c: oturum sahibi bu saglayicinin kendisi mi ya da ajans kurulusunda settings.manage yetkili mi (dokum okuma + itiraz).';
REVOKE ALL ON FUNCTION public.fn_faz9c_provider_yetkisi(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_faz9c_provider_yetkisi(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.trust_score_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trust_score_snapshots_select ON public.trust_score_snapshots;
CREATE POLICY trust_score_snapshots_select ON public.trust_score_snapshots
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.fn_faz9c_provider_yetkisi(provider_id));
REVOKE ALL ON public.trust_score_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.trust_score_snapshots TO authenticated, service_role;

ALTER TABLE public.trust_appeals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trust_appeals_select ON public.trust_appeals;
CREATE POLICY trust_appeals_select ON public.trust_appeals
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.fn_faz9c_provider_yetkisi(provider_id));
DROP POLICY IF EXISTS trust_appeals_insert ON public.trust_appeals;
CREATE POLICY trust_appeals_insert ON public.trust_appeals
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_faz9c_provider_yetkisi(provider_id)
              AND status = 'open' AND admin_note IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL);
-- UPDATE/DELETE politikasi YOK: karar yalniz trust_appeal_review (admin RPC); saglayici itirazini degistiremez/silemez.
REVOKE ALL ON public.trust_appeals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.trust_appeals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trust_appeals TO service_role;

-- itiraz acilirken: created_by oturum, snapshot_id bos ise son dokum
CREATE OR REPLACE FUNCTION public.fn_faz9c_appeal_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  IF NEW.snapshot_id IS NULL THEN
    SELECT s.id INTO NEW.snapshot_id FROM public.trust_score_snapshots s
     WHERE s.provider_id = NEW.provider_id ORDER BY s.computed_at DESC, s.id DESC LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz9c_appeal_before_insert ON public.trust_appeals;
CREATE TRIGGER trg_faz9c_appeal_before_insert BEFORE INSERT ON public.trust_appeals
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz9c_appeal_before_insert();

-- -----------------------------------------------------------------------------
-- 4) Hesap (saf): bilesenler + skor
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz9c_hesapla(p public.providers)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_ver_p int; v_ver text;
  v_prof_p int := 0; v_bio text; v_bio_ok boolean; v_avatar boolean; v_rol boolean; v_portfoy int;
  v_done int; v_done_p int;
  v_toplam int; v_iptal int; v_oran numeric; v_iptal_p int;
  v_cnt int; v_avg numeric; v_rev_p int;
  v_median_h numeric; v_resp_p int;
  v_score numeric;
BEGIN
  -- 1) dogrulama 0-25
  v_ver := p.verification_level::text;
  v_ver_p := CASE v_ver WHEN 'full' THEN 25 WHEN 'document' THEN 20 WHEN 'email' THEN 10 ELSE 0 END;

  -- 2) profil onayi ve tamligi 0-15
  IF p.approval_status = 'approved' THEN v_prof_p := v_prof_p + 5; END IF;
  SELECT CASE WHEN p.provider_type = 'organization'
              THEN COALESCE((SELECT o.about FROM public.organization_profiles o WHERE o.provider_id = p.id), pr.bio)
              ELSE COALESCE((SELECT pp.bio FROM public.professional_profiles pp WHERE pp.provider_id = p.id), pr.bio) END,
         pr.avatar_url IS NOT NULL AND pr.avatar_url <> ''
    INTO v_bio, v_avatar
    FROM public.profiles pr WHERE pr.id = p.id;
  v_bio_ok := char_length(COALESCE(btrim(v_bio), '')) >= 120;
  IF v_bio_ok THEN v_prof_p := v_prof_p + 3; END IF;
  IF COALESCE(v_avatar, false) THEN v_prof_p := v_prof_p + 2; END IF;
  SELECT EXISTS (SELECT 1 FROM public.provider_services ps JOIN public.service_roles sr ON sr.id = ps.role_id
                  WHERE ps.provider_id = p.id AND sr.is_active) INTO v_rol;
  IF v_rol THEN v_prof_p := v_prof_p + 2; END IF;
  SELECT count(*) INTO v_portfoy FROM public.portfolio_items pi WHERE pi.provider_id = p.id OR pi.profile_id = p.id;
  IF v_portfoy >= 3 THEN v_prof_p := v_prof_p + 3; END IF;

  -- 3) tamamlanan is 0-25 (satici tarafi)
  SELECT count(*) INTO v_done FROM public.bookings b
   WHERE b.status = 'completed' AND (b.professional_id = p.id OR b.seller_provider_id = p.id);
  v_done_p := CASE WHEN v_done >= 10 THEN 25 WHEN v_done >= 3 THEN 18 WHEN v_done >= 1 THEN 10 ELSE 0 END;

  -- 4) iptal -15..0 (son 12 ay, satici kaynakli)
  SELECT count(*),
         count(*) FILTER (WHERE b.status = 'cancelled' AND b.cancelled_by IS NOT NULL
                            AND (b.cancelled_by = p.id
                                 OR (p.organization_id IS NOT NULL AND EXISTS (
                                      SELECT 1 FROM public.organization_memberships om
                                       WHERE om.organization_id = p.organization_id AND om.user_id = b.cancelled_by AND om.status = 'active'))))
    INTO v_toplam, v_iptal
    FROM public.bookings b
   WHERE (b.professional_id = p.id OR b.seller_provider_id = p.id)
     AND b.status IN ('confirmed', 'completed', 'cancelled')
     AND b.created_at >= now() - interval '12 months';
  v_oran := CASE WHEN v_toplam > 0 THEN round(v_iptal::numeric / v_toplam, 3) ELSE 0 END;
  v_iptal_p := CASE WHEN v_iptal = 0 THEN 0 WHEN v_oran < 0.10 THEN -5 WHEN v_oran < 0.25 THEN -10 ELSE -15 END;

  -- 5) degerlendirme 0-20 (cnt < 3 notr 8)
  SELECT count(*), round(avg(r.rating)::numeric, 2) INTO v_cnt, v_avg
    FROM public.reviews r WHERE r.provider_id = p.id OR r.professional_id = p.id;
  v_rev_p := CASE WHEN v_cnt < 3 THEN 8
                  WHEN v_avg >= 4.7 THEN 20 WHEN v_avg >= 4.3 THEN 15 WHEN v_avg >= 3.8 THEN 10 ELSE 4 END;

  -- 6) yanit suresi 0-15 (son 180 gun; musterinin ilk mesajina saticinin ilk yaniti; medyan saat; veri yok notr 7)
  WITH konusma AS (
    SELECT c.id, c.customer_id FROM public.conversations c
     WHERE c.professional_id = p.id AND c.created_at >= now() - interval '180 days'
  ), ilk AS (
    SELECT k.id, k.customer_id,
           (SELECT min(m.created_at) FROM public.messages m
             WHERE m.conversation_id = k.id AND m.sender_id = k.customer_id AND m.message_type <> 'system') AS t0
      FROM konusma k
  ), yanit AS (
    SELECT i.t0,
           (SELECT min(m.created_at) FROM public.messages m
             WHERE m.conversation_id = i.id AND m.message_type <> 'system' AND m.created_at > i.t0
               AND (m.sender_id = p.id
                    OR (p.organization_id IS NOT NULL AND EXISTS (
                         SELECT 1 FROM public.organization_memberships om
                          WHERE om.organization_id = p.organization_id AND om.user_id = m.sender_id AND om.status = 'active')))) AS t1
      FROM ilk i WHERE i.t0 IS NOT NULL
  )
  SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (y.t1 - y.t0)) / 3600.0))::numeric, 2)
    INTO v_median_h FROM yanit y WHERE y.t1 IS NOT NULL;
  v_resp_p := CASE WHEN v_median_h IS NULL THEN 7 WHEN v_median_h <= 2 THEN 15 WHEN v_median_h <= 24 THEN 10 WHEN v_median_h <= 72 THEN 5 ELSE 0 END;

  v_score := GREATEST(0, LEAST(100, v_ver_p + v_prof_p + v_done_p + v_iptal_p + v_rev_p + v_resp_p));

  RETURN jsonb_build_object(
    'score', v_score,
    'algorithm_version', 'trust-v0.1',
    'components', jsonb_build_object(
      'verification', jsonb_build_object('points', v_ver_p, 'level', v_ver),
      'profile', jsonb_build_object('points', v_prof_p, 'approved', p.approval_status = 'approved', 'bio_ok', v_bio_ok,
                                    'avatar', COALESCE(v_avatar, false), 'active_role', v_rol, 'portfolio_count', v_portfoy),
      'completed', jsonb_build_object('points', v_done_p, 'count', v_done),
      'cancel', jsonb_build_object('points', v_iptal_p, 'rate', v_oran, 'seller_cancelled', v_iptal, 'total_12m', v_toplam),
      'reviews', jsonb_build_object('points', v_rev_p, 'avg', v_avg, 'cnt', v_cnt),
      'response', jsonb_build_object('points', v_resp_p, 'median_h', v_median_h)));
END;
$$;
COMMENT ON FUNCTION public.fn_faz9c_hesapla(public.providers) IS
  'FAZ 9c: tek saglayicinin Trust Score V0 bilesenleri + skoru (saf; yazmaz). trust_score_compute ve testler cagirir.';
REVOKE ALL ON FUNCTION public.fn_faz9c_hesapla(public.providers) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_faz9c_hesapla(public.providers) TO service_role;

-- -----------------------------------------------------------------------------
-- 5) Gunluk hesap (yazar)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trust_score_compute(p_provider uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  p public.providers; r jsonb; v_n integer := 0; v_now timestamptz := clock_timestamp();   -- now() DEGIL: ayni islemde iki kosu ayrisabilsin
BEGIN
  -- koruma tetikleyicisi (protect_sensitive_provider_fields) kapisi; islem sonunda duser
  PERFORM set_config('kashe.sync_bypass', 'on', true);

  FOR p IN SELECT * FROM public.providers pr
            WHERE (p_provider IS NULL OR pr.id = p_provider)
              AND pr.is_published AND pr.approval_status = 'approved' AND pr.suspended_at IS NULL
            ORDER BY pr.id
  LOOP
    r := public.fn_faz9c_hesapla(p);
    INSERT INTO public.trust_score_snapshots (provider_id, computed_at, algorithm_version, score, components)
    VALUES (p.id, v_now, r->>'algorithm_version', (r->>'score')::numeric, r->'components');
    UPDATE public.providers SET trust_score = (r->>'score')::numeric, trust_computed_at = v_now WHERE id = p.id;
    v_n := v_n + 1;
  END LOOP;

  -- gorunur olmayan saglayici: skor NULL (eski skor eslestirmeye sizmasin); snapshot yazilmaz
  UPDATE public.providers pr SET trust_score = NULL, trust_computed_at = NULL
   WHERE (p_provider IS NULL OR pr.id = p_provider)
     AND NOT (pr.is_published AND pr.approval_status = 'approved' AND pr.suspended_at IS NULL)
     AND (pr.trust_score IS NOT NULL OR pr.trust_computed_at IS NOT NULL);

  PERFORM set_config('kashe.sync_bypass', 'off', true);
  RETURN v_n;
END;
$$;
COMMENT ON FUNCTION public.trust_score_compute(uuid) IS
  'FAZ 9c: gorunur saglayicilar icin Trust Score V0 hesaplar, snapshot yazar, providers.trust_score gunceller; gorunur olmayanin skoru NULL. pg_cron 00:45 UTC. Yalniz service_role.';
REVOKE ALL ON FUNCTION public.trust_score_compute(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trust_score_compute(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 6) Okuma: kendi dokumu
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_trust_breakdown(p_provider uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pid uuid := COALESCE(p_provider, auth.uid());
  v_snap record; v_appeal record; v_visible boolean;
BEGIN
  IF v_pid IS NULL OR NOT public.fn_faz9c_provider_yetkisi(v_pid) THEN
    RAISE EXCEPTION 'yetkisiz erisim: dokum yalniz saglayicinin kendisine acik' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT (pr.is_published AND pr.approval_status = 'approved' AND pr.suspended_at IS NULL) INTO v_visible
    FROM public.providers pr WHERE pr.id = v_pid;
  IF v_visible IS NULL THEN RETURN jsonb_build_object('provider_id', v_pid, 'snapshot', NULL, 'appeal', NULL, 'visible', false); END IF;

  SELECT s.id, s.score, s.computed_at, s.algorithm_version, s.components INTO v_snap
    FROM public.trust_score_snapshots s WHERE s.provider_id = v_pid ORDER BY s.computed_at DESC, s.id DESC LIMIT 1;
  SELECT a.id, a.status, a.message, a.admin_note, a.created_at, a.reviewed_at, a.snapshot_id INTO v_appeal
    FROM public.trust_appeals a WHERE a.provider_id = v_pid ORDER BY (a.status = 'open') DESC, a.created_at DESC LIMIT 1;   -- acik varsa o

  RETURN jsonb_build_object(
    'provider_id', v_pid,
    'visible', v_visible,
    'snapshot', CASE WHEN v_snap.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_snap.id, 'score', v_snap.score, 'computed_at', v_snap.computed_at,
      'algorithm_version', v_snap.algorithm_version, 'components', v_snap.components) END,
    'appeal', CASE WHEN v_appeal.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_appeal.id, 'status', v_appeal.status, 'message', v_appeal.message, 'admin_note', v_appeal.admin_note,
      'created_at', v_appeal.created_at, 'reviewed_at', v_appeal.reviewed_at, 'snapshot_id', v_appeal.snapshot_id) END);
END;
$$;
COMMENT ON FUNCTION public.my_trust_breakdown(uuid) IS
  'FAZ 9c: saglayicinin kendi (ya da settings.manage yetkili oldugu ajansin) son guven dokumu + son itiraz. Yetkisiz 42501.';
REVOKE ALL ON FUNCTION public.my_trust_breakdown(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_trust_breakdown(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7) Admin: itiraz karari + ozet
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trust_appeal_review(p_appeal uuid, p_status text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a public.trust_appeals;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'yetkisiz erisim: itiraz karari icin admin gerekir' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_status NOT IN ('reviewed', 'closed') THEN
    RAISE EXCEPTION 'durum reviewed ya da closed olmali' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 2000 THEN
    RAISE EXCEPTION 'not en fazla 2000 karakter' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  UPDATE public.trust_appeals
     SET status = p_status, admin_note = NULLIF(btrim(COALESCE(p_note, '')), ''), reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = p_appeal RETURNING * INTO a;
  IF a.id IS NULL THEN RAISE EXCEPTION 'itiraz yok' USING ERRCODE = 'no_data_found'; END IF;
  RETURN to_jsonb(a);
END;
$$;
COMMENT ON FUNCTION public.trust_appeal_review(uuid, text, text) IS
  'FAZ 9c: admin itiraz karari (reviewed/closed + not; reviewed_by/at dolar). Admin degilse 42501.';
REVOKE ALL ON FUNCTION public.trust_appeal_review(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trust_appeal_review(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trust_score_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_dagilim jsonb; v_itiraz jsonb; v_kuyruk jsonb; v_bilesen jsonb; v_son timestamptz;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'yetkisiz erisim: trust_score_summary icin admin gerekir' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT max(trust_computed_at) INTO v_son FROM public.providers;

  SELECT jsonb_build_object(
    'low',  count(*) FILTER (WHERE trust_score < 40),
    'mid',  count(*) FILTER (WHERE trust_score >= 40 AND trust_score < 70),
    'high', count(*) FILTER (WHERE trust_score >= 70),
    'scored', count(*) FILTER (WHERE trust_score IS NOT NULL),
    'avg', round(avg(trust_score)::numeric, 1),
    'not_computed', count(*) FILTER (WHERE trust_score IS NULL AND is_published AND approval_status = 'approved' AND suspended_at IS NULL),
    'invisible', count(*) FILTER (WHERE NOT (is_published AND approval_status = 'approved' AND suspended_at IS NULL)))
    INTO v_dagilim FROM public.providers;

  SELECT jsonb_build_object('open', count(*) FILTER (WHERE status = 'open'), 'reviewed', count(*) FILTER (WHERE status = 'reviewed'),
                            'closed', count(*) FILTER (WHERE status = 'closed'))
    INTO v_itiraz FROM public.trust_appeals;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', a.id, 'provider_id', a.provider_id, 'provider_name', pr.display_name, 'provider_type', pr.provider_type,
           'status', a.status, 'message', a.message, 'admin_note', a.admin_note, 'created_at', a.created_at, 'reviewed_at', a.reviewed_at,
           'snapshot_id', a.snapshot_id, 'snapshot_score', s.score, 'current_score', pr.trust_score)
         ORDER BY (a.status = 'open') DESC, a.created_at DESC), '[]'::jsonb)
    INTO v_kuyruk
    FROM (SELECT * FROM public.trust_appeals ORDER BY (status = 'open') DESC, created_at DESC LIMIT 50) a
    JOIN public.providers pr ON pr.id = a.provider_id
    LEFT JOIN public.trust_score_snapshots s ON s.id = a.snapshot_id;

  -- bilesen ortalamalari: her saglayicinin SON dokumu
  WITH son AS (
    SELECT DISTINCT ON (provider_id) provider_id, components FROM public.trust_score_snapshots ORDER BY provider_id, computed_at DESC, id DESC
  )
  SELECT jsonb_build_object(
    'verification', round(avg((components->'verification'->>'points')::numeric), 1),
    'profile',      round(avg((components->'profile'->>'points')::numeric), 1),
    'completed',    round(avg((components->'completed'->>'points')::numeric), 1),
    'cancel',       round(avg((components->'cancel'->>'points')::numeric), 1),
    'reviews',      round(avg((components->'reviews'->>'points')::numeric), 1),
    'response',     round(avg((components->'response'->>'points')::numeric), 1),
    'providers',    count(*))
    INTO v_bilesen FROM son;

  RETURN jsonb_build_object('last_computed_at', v_son, 'distribution', v_dagilim, 'appeals', v_itiraz,
                            'appeal_queue', v_kuyruk, 'component_avgs', v_bilesen, 'high_threshold', 70);
END;
$$;
COMMENT ON FUNCTION public.trust_score_summary() IS
  'FAZ 9c: admin ozeti — skor dagilimi (0-39/40-69/70+), ortalama, hesaplanmayan/gorunmeyen, itiraz sayilari + kuyruk (50), bilesen ortalamalari. Admin degilse 42501.';
REVOKE ALL ON FUNCTION public.trust_score_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trust_score_summary() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8) pg_cron (yalniz uzanti varsa) + ilk hesap
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE 'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = ''trust-score-daily''';
    EXECUTE 'SELECT cron.schedule(''trust-score-daily'', ''45 0 * * *'', ''SELECT public.trust_score_compute();'')';
  END IF;
END $$;

SELECT public.trust_score_compute();

COMMIT;
