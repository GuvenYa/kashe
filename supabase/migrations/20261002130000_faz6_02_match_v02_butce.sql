-- =============================================================================
-- FAZ 6 / 02 — Match V0.2: butce kurali duzeltmesi (kesisim -> "affordable")
--
-- Canli kalibrasyon (2 Ekim 2026, ilk gercek kosu): v0.1 `budget_fit` saglayicinin fiyat araligi ile butce araliginin KESISMESINI
-- istiyordu; butcenin altinda kalan (daha ucuz) saglayici "butceye uygun" sayilmiyordu (Istanbul fotografci, 20-30 bin butce).
-- v0.2: saglayicinin baslangic fiyati (price_min; yoksa price_max) rolun butce ipucu ust siniri, yoksa etkinligin ust butcesini
-- asmiyorsa uygun (+20). Fiyat yoksa veya ust butce yoksa belirsiz (+10). Diger bilesenler ve ajans kapsami AYNEN.
-- Kural (18 bolum 9): degisiklik = yeni algorithm_version; eski kosular ve adaylar DEGISMEZ (ekle-yalniz). params'a
-- `budget_rule: affordable` eklendi. Imza ayni; yetkiler 01'den kalir (CREATE OR REPLACE yetkileri korur).
--
-- Idempotan. Sapkali harf yok. VERI YAZMAZ.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.run_event_match(p_event_id uuid, p_strategy public.match_strategy DEFAULT 'hybrid')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev        record;
  t0        timestamptz := clock_timestamp();
  run_id    uuid;
  n_pro     integer := 0;
  n_org     integer := 0;
  lim_role  integer := 20;
  lim_org   integer := 10;
  d_from    date;
  d_to      date;
  v_params  jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'giris gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO ev FROM public.events WHERE id = p_event_id;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'etkinlik yok' USING ERRCODE = 'no_data_found'; END IF;
  IF ev.owner_user_id <> auth.uid() THEN RAISE EXCEPTION 'yetkisiz erisim' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF ev.status NOT IN ('confirmed', 'matching') THEN
    RAISE EXCEPTION 'etkinlik once onaylanmali (durum: %)', ev.status USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_requirements WHERE event_id = p_event_id) THEN
    RAISE EXCEPTION 'etkinligin gereksinimi yok' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  d_from := ev.start_date;
  d_to   := COALESCE(ev.end_date, ev.start_date);
  v_params := jsonb_build_object(
    'version', 'v0.2', 'strategy', p_strategy::text, 'budget_rule', 'affordable',
    'pro', jsonb_build_object('same_city', 40, 'date_available', 25, 'date_unknown', 10, 'budget_fit', 20, 'budget_unknown', 10, 'high_trust', 15, 'new_talent', 5),
    'org', jsonb_build_object('coverage', 60, 'same_city', 20, 'date_available', 10, 'date_unknown', 5, 'high_trust', 10),
    'required_weight', 3, 'optional_weight', 1, 'limit_per_role', lim_role, 'limit_orgs', lim_org,
    'trust_threshold', 70, 'rating_threshold', 4.5, 'min_reviews', 3);

  INSERT INTO public.match_runs (event_id, strategy, algorithm_version, params, created_by)
  VALUES (p_event_id, p_strategy, 'v0.2', v_params, auth.uid()) RETURNING id INTO run_id;

  -- 7a) Bireysel profesyoneller: rol basina
  IF p_strategy IN ('individual', 'hybrid') THEN
    WITH aday AS (
      SELECT p.id AS provider_id, r.role_id, p.trust_score, p.created_at,
             (ev.city_id IS NOT NULL AND p.city_id = ev.city_id)                                    AS same_city,
             (d_from IS NOT NULL)                                                                  AS date_known,
             -- v0.2 butce kurali "affordable": saglayicinin baslangic fiyati rolun (yoksa etkinligin) ust butcesini asmiyorsa uygun.
             -- v0.1 "kesisim" kurali butcenin altinda kalan (ucuz) saglayiciyi uygun saymiyordu (canli kalibrasyon, 2 Ekim 2026).
             CASE WHEN ps.price_min IS NULL AND ps.price_max IS NULL THEN NULL                      -- fiyat yok: belirsiz
                  WHEN COALESCE(r.budget_hint_max, ev.budget_max) IS NULL THEN NULL                 -- ust butce yok: belirsiz
                  WHEN COALESCE(ps.price_min, ps.price_max) <= COALESCE(r.budget_hint_max, ev.budget_max) THEN true
                  ELSE false END                                                                    AS budget_fit,
             (COALESCE(p.trust_score, 0) >= 70 OR (rv.avg_rating >= 4.5 AND rv.cnt >= 3))         AS high_trust,
             (COALESCE(rv.cnt, 0) < 3)                                                             AS new_talent
        FROM public.event_requirements r
        JOIN public.provider_services ps ON ps.role_id = r.role_id
        JOIN public.providers p ON p.id = ps.provider_id
       LEFT JOIN LATERAL (SELECT avg(rating)::numeric AS avg_rating, count(*) AS cnt FROM public.reviews WHERE provider_id = p.id) rv ON true
       WHERE r.event_id = p_event_id
         AND p.provider_type = 'professional' AND p.is_published AND p.approval_status = 'approved' AND p.suspended_at IS NULL
         AND p.id <> auth.uid()
         AND (d_from IS NULL OR NOT EXISTS (SELECT 1 FROM public.availability_blocks ab WHERE ab.profile_id = p.id AND ab.blocked_date BETWEEN d_from AND d_to))
         AND (d_from IS NULL OR NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.professional_id = p.id AND b.status = 'confirmed' AND b.event_date BETWEEN d_from AND d_to))
    ), puan AS (
      SELECT a.*,
             (CASE WHEN a.same_city THEN 40 ELSE 0 END
              + CASE WHEN a.date_known THEN 25 ELSE 10 END
              + CASE WHEN a.budget_fit IS NULL THEN 10 WHEN a.budget_fit THEN 20 ELSE 0 END
              + CASE WHEN a.high_trust THEN 15 ELSE 0 END
              + CASE WHEN a.new_talent THEN 5 ELSE 0 END)::numeric AS score,
             array_remove(ARRAY[CASE WHEN a.same_city THEN 'same_city' END,
                                CASE WHEN a.date_known THEN 'date_available' END,
                                CASE WHEN a.budget_fit THEN 'budget_fit' END,
                                CASE WHEN a.high_trust THEN 'high_trust' END,
                                CASE WHEN a.new_talent THEN 'new_talent' END], NULL) AS codes
        FROM aday a
    ), sirali AS (
      SELECT q.*, row_number() OVER (PARTITION BY q.role_id ORDER BY q.score DESC, q.trust_score DESC NULLS LAST, q.created_at, q.provider_id) AS rn
        FROM puan q
    )
    INSERT INTO public.match_candidates (match_run_id, provider_id, role_id, match_score, trust_score, availability_conf, final_rank, reason_codes)
    SELECT run_id, s.provider_id, s.role_id, LEAST(100, s.score), s.trust_score,
           CASE WHEN s.date_known THEN 0.90 ELSE 0.50 END, s.rn, s.codes
      FROM sirali s WHERE s.rn <= lim_role;
    GET DIAGNOSTICS n_pro = ROW_COUNT;
  END IF;

  -- 7b) Ajanslar: etkinlik basina, agirlikli kapsam (01 bolum 5). Kapsam yalniz ACIK verilerden.
  IF p_strategy IN ('full_service', 'hybrid') THEN
    WITH req AS (
      SELECT r.role_id, r.quantity, r.is_required, CASE WHEN r.is_required THEN 3 ELSE 1 END AS w
        FROM public.event_requirements r WHERE r.event_id = p_event_id
    ), org AS (
      SELECT p.id, p.city_id, p.trust_score, p.created_at
        FROM public.providers p
       WHERE p.provider_type = 'organization' AND p.is_published AND p.approval_status = 'approved' AND p.suspended_at IS NULL
         AND p.id <> auth.uid()
         AND (d_from IS NULL OR NOT EXISTS (SELECT 1 FROM public.availability_blocks ab WHERE ab.profile_id = p.id AND ab.blocked_date BETWEEN d_from AND d_to))
    ), kapsam AS (
      -- org x rol: kendi hizmeti (kapasite) + Ekibim uyelerinin ayni roldeki hizmet sayisi
      SELECT o.id AS org_id, rq.role_id, rq.w, rq.quantity,
             EXISTS (SELECT 1 FROM public.provider_services ps WHERE ps.provider_id = o.id AND ps.role_id = rq.role_id) AS own_has,
             (SELECT max(ps.capacity) FROM public.provider_services ps WHERE ps.provider_id = o.id AND ps.role_id = rq.role_id) AS own_cap,
             (SELECT count(DISTINCT am.professional_id) FROM public.agency_members am
                JOIN public.provider_services ps ON ps.provider_id = am.professional_id AND ps.role_id = rq.role_id
               WHERE am.agency_id = o.id) AS member_cnt
        FROM org o CROSS JOIN req rq
    ), covered AS (
      SELECT k.org_id, k.w, k.role_id,
             CASE WHEN NOT (k.own_has OR k.member_cnt > 0) THEN 0.0
                  WHEN k.quantity <= 1 OR COALESCE(k.own_cap, 0) >= k.quantity OR k.member_cnt >= k.quantity THEN 1.0
                  ELSE 0.5 END AS c
        FROM kapsam k
    ), toplam AS (
      SELECT c.org_id,
             round(sum(c.w * c.c) / sum(c.w), 3) AS coverage,
             bool_and(CASE WHEN rq.is_required THEN c.c > 0 ELSE true END) AS eligible
        FROM covered c JOIN req rq ON rq.role_id = c.role_id
       GROUP BY c.org_id
    ), puan AS (
      SELECT o.id AS provider_id, o.trust_score, o.created_at, t.coverage, t.eligible,
             (ev.city_id IS NOT NULL AND o.city_id = ev.city_id) AS same_city,
             (d_from IS NOT NULL) AS date_known,
             (COALESCE(o.trust_score, 0) >= 70 OR (rv.avg_rating >= 4.5 AND rv.cnt >= 3)) AS high_trust
        FROM org o JOIN toplam t ON t.org_id = o.id
       LEFT JOIN LATERAL (SELECT avg(rating)::numeric AS avg_rating, count(*) AS cnt FROM public.reviews WHERE provider_id = o.id) rv ON true
       WHERE t.coverage > 0 AND (p_strategy = 'hybrid' OR t.eligible)
    ), sirali AS (
      SELECT q.*,
             (round(60 * q.coverage) + CASE WHEN q.same_city THEN 20 ELSE 0 END + CASE WHEN q.date_known THEN 10 ELSE 5 END
              + CASE WHEN q.high_trust THEN 10 ELSE 0 END)::numeric AS score,
             array_remove(ARRAY[CASE WHEN q.eligible THEN 'coverage_full' END,
                                CASE WHEN q.same_city THEN 'same_city' END,
                                CASE WHEN q.date_known THEN 'date_available' END,
                                CASE WHEN q.high_trust THEN 'high_trust' END], NULL) AS codes
        FROM puan q
    ), rn AS (
      SELECT s.*, row_number() OVER (ORDER BY s.score DESC, s.coverage DESC, s.trust_score DESC NULLS LAST, s.created_at, s.provider_id) AS rnk
        FROM sirali s
    )
    INSERT INTO public.match_candidates (match_run_id, provider_id, role_id, match_score, trust_score, coverage_ratio, availability_conf,
                                         full_service_eligible, final_rank, reason_codes)
    SELECT run_id, r.provider_id, NULL, LEAST(100, r.score), r.trust_score, r.coverage,
           CASE WHEN r.date_known THEN 0.90 ELSE 0.50 END, r.eligible, r.rnk, r.codes
      FROM rn r WHERE r.rnk <= lim_org;
    GET DIAGNOSTICS n_org = ROW_COUNT;
  END IF;

  UPDATE public.match_runs
     SET candidate_count = n_pro + n_org,
         latency_ms = GREATEST(0, (extract(epoch FROM clock_timestamp() - t0) * 1000)::integer)
   WHERE id = run_id;

  UPDATE public.events SET status = 'matching' WHERE id = p_event_id AND status = 'confirmed';
  RETURN run_id;
END;
$$;

COMMIT;
