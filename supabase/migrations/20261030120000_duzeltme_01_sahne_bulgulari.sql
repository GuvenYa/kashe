-- =============================================================================
-- DUZELTME 01 — Sahne senaryo turu bulgularinin DB tarafi (docs/sahne/bulgular.md #29, #14, #7, #23)
-- Plan: docs/envanter/39-sahne-sentetik-dunya.md bolum 11 madde 4; uygulama tarafi 41-claude-code-gorevi-duzeltme-01.md.
--
-- 1) #29 provider_public_stats(p_provider): saglayici basina tamamlanmis is / farkli musteri / tekrar eden musteri sayisi
--    (SECURITY DEFINER, anon + authenticated). /p/[id] "N TAMAMLANMIS IS" cipi ve "tekrar tercih" rozeti ziyaretcinin RLS
--    kapsamiyla bookings sayiyordu (anonim 0, musteri yalniz kendi rezervasyonlari). Yalniz SAYI doner, kimlik yok.
-- 2) #14 proposals_expire_stale(): gonderilmis surumun valid_until'i gecen sent/viewed teklifler expired olur (portal
--    goruntulemedeki kuralin aynisi: valid_until < now()); pg_cron 'proposals-expire-daily' (00:15) + ilk kosu burada.
--    Analytics olayi yok (sozluk 23 ad degismez; expired durumu analytics_summary'de ayrica sayilmaz).
-- 3) #7 analytics_summary: huniye 'linked' blogu — pencerede onaylanan etkinlikler uzerinden ZINCIRLI sayim
--    (etkinlik basina: eslestirme kosusu / secim (ekip ya da teklif) / onay / rezervasyon). Baslik KPI bu bloktan okunur,
--    %100'u asamaz; mevcut ham sayimlar (funnel.*) aynen durur.
-- 4) #23 ekip bildirimleri (type 'team', uygulama ici): crew_members INSERT -> uyenin kullanicisina "<kurulus|kisi> seni <etkinlik>
--    ekibine ekledi" (/profil; bireysel musteri ekibinde kisi adi); tekliften rezervasyon (bookings INSERT, proposal_version_id dolu)
--    -> teklifin ekibindeki kullanicilara "<etkinlik> icin is kesinlesti". Harici havuz kaydi (kullanicisiz), kurulusun kendi
--    hesabi ve ekibi acan kisi atlanir.
-- Test: asama4 T35. Tablo/sutun/enum degisikligi YOK. Idempotan (CREATE OR REPLACE).
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. #29 provider_public_stats
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provider_public_stats(p_provider uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH d AS (
    SELECT b.customer_id, count(*) AS n
      FROM public.bookings b
     WHERE (b.professional_id = p_provider OR b.seller_provider_id = p_provider)
       AND b.status = 'completed'
     GROUP BY b.customer_id
  )
  SELECT jsonb_build_object(
    'provider_id', p_provider,
    'completed_jobs', COALESCE((SELECT sum(n) FROM d), 0),
    'distinct_customers', (SELECT count(*) FROM d WHERE customer_id IS NOT NULL),
    'repeat_customers', (SELECT count(*) FROM d WHERE customer_id IS NOT NULL AND n > 1));
$$;
REVOKE ALL ON FUNCTION public.provider_public_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provider_public_stats(uuid) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.provider_public_stats(uuid) IS
  'Duzeltme 01 (#29): saglayicinin tamamlanmis is / farkli musteri / tekrar eden musteri SAYILARI (RLS''ten bagimsiz, kimlik yok). /p/[id] guven cipleri.';

-- -----------------------------------------------------------------------------
-- 2. #14 proposals_expire_stale + gunluk is
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proposals_expire_stale()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer := 0; p record; v record;
BEGIN
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  FOR p IN SELECT id FROM public.proposals WHERE status IN ('sent', 'viewed') LOOP
    v := public.fn_faz7_last_sent_version(p.id);
    IF v.id IS NOT NULL AND v.valid_until IS NOT NULL AND v.valid_until < now() THEN
      UPDATE public.proposals SET status = 'expired' WHERE id = p.id;
      n := n + 1;
    END IF;
  END LOOP;
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.proposals_expire_stale() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proposals_expire_stale() TO service_role;
COMMENT ON FUNCTION public.proposals_expire_stale() IS
  'Duzeltme 01 (#14): gonderilmis surumun valid_until''i gecen sent/viewed teklifleri expired yapar (portal kurali). pg_cron proposals-expire-daily.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE 'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = ''proposals-expire-daily''';
    EXECUTE 'SELECT cron.schedule(''proposals-expire-daily'', ''15 0 * * *'', ''SELECT public.proposals_expire_stale();'')';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. #7 analytics_summary: zincirli huni (govde FAZ 9a surumu + 'linked' blogu)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_summary(p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_from timestamptz := now() - make_interval(days => GREATEST(1, LEAST(p_days, 365)));
  v_daily jsonb; v_funnel jsonb; v_fair jsonb; v_names jsonb; v_linked jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'yetkisiz erisim: analytics_summary icin admin gerekir' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- gunluk sayilar (olay basina)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day, 'event_name', d.event_name, 'count', d.n) ORDER BY d.day, d.event_name), '[]'::jsonb)
    INTO v_daily
    FROM (SELECT (occurred_at AT TIME ZONE 'Europe/Istanbul')::date AS day, event_name, count(*) AS n
            FROM public.analytics_events WHERE occurred_at >= v_from GROUP BY 1, 2) d;

  -- toplamlar (olay basina)
  SELECT COALESCE(jsonb_object_agg(event_name, n), '{}'::jsonb) INTO v_names
    FROM (SELECT event_name, count(*) AS n FROM public.analytics_events WHERE occurred_at >= v_from GROUP BY 1) t;

  -- huni (benzersiz varlik) — ham sayimlar; adimlar ic ice DEGIL (bir rezervasyon brief'siz olabilir)
  SELECT jsonb_build_object(
    'brief_created',    (SELECT count(*) FROM public.analytics_events WHERE event_name = 'brief_created' AND occurred_at >= v_from),
    'event_confirmed',  (SELECT count(*) FROM public.analytics_events WHERE event_name = 'event_confirmed' AND occurred_at >= v_from),
    'match_run',        (SELECT count(DISTINCT payload->>'event_id') FROM public.analytics_events WHERE event_name = 'match_run' AND occurred_at >= v_from),
    'match_shown',      (SELECT count(DISTINCT payload->>'event_id') FROM public.analytics_events WHERE event_name = 'match_shown' AND occurred_at >= v_from),
    'match_clicked',    (SELECT count(DISTINCT payload->>'event_id') FROM public.analytics_events WHERE event_name = 'match_clicked' AND occurred_at >= v_from),
    'selection',        (SELECT count(DISTINCT COALESCE(payload->>'event_id', entity_id::text)) FROM public.analytics_events WHERE event_name IN ('crew_selected', 'proposal_sent', 'quote_created') AND occurred_at >= v_from),
    'approval',         (SELECT count(*) FROM public.analytics_events WHERE event_name IN ('proposal_approved', 'quote_accepted', 'rfp_awarded') AND occurred_at >= v_from),
    'booking_created',  (SELECT count(*) FROM public.analytics_events WHERE event_name = 'booking_created' AND occurred_at >= v_from),
    'booking_completed',(SELECT count(*) FROM public.analytics_events WHERE event_name = 'booking_completed' AND occurred_at >= v_from),
    'booking_cancelled',(SELECT count(*) FROM public.analytics_events WHERE event_name = 'booking_cancelled' AND occurred_at >= v_from))
    INTO v_funnel;

  -- zincirli huni (Duzeltme 01 #7): pencerede ONAYLANAN etkinlikler; her adim ayni etkinlik kimligiyle baglanir -> oranlar <= %100
  WITH ev AS (SELECT DISTINCT entity_id::text AS eid FROM public.analytics_events
               WHERE event_name = 'event_confirmed' AND occurred_at >= v_from),
       ad AS (SELECT DISTINCT payload->>'event_id' AS eid, event_name FROM public.analytics_events
               WHERE occurred_at >= v_from AND payload ? 'event_id'
                 AND event_name IN ('match_run', 'crew_selected', 'proposal_sent', 'proposal_approved', 'rfp_awarded', 'booking_created'))
  SELECT jsonb_build_object(
    'events',         (SELECT count(*) FROM ev),
    'with_match',     (SELECT count(*) FROM ev WHERE EXISTS (SELECT 1 FROM ad WHERE ad.eid = ev.eid AND ad.event_name = 'match_run')),
    'with_selection', (SELECT count(*) FROM ev WHERE EXISTS (SELECT 1 FROM ad WHERE ad.eid = ev.eid AND ad.event_name IN ('crew_selected', 'proposal_sent'))),
    'with_approval',  (SELECT count(*) FROM ev WHERE EXISTS (SELECT 1 FROM ad WHERE ad.eid = ev.eid AND ad.event_name IN ('proposal_approved', 'rfp_awarded'))),
    'with_booking',   (SELECT count(*) FROM ev WHERE EXISTS (SELECT 1 FROM ad WHERE ad.eid = ev.eid AND ad.event_name = 'booking_created')))
    INTO v_linked;
  v_funnel := v_funnel || jsonb_build_object('linked', v_linked);

  -- adalet: gosterimlerde yeni yetenek payi, ilk 3 sirada yeni yetenek payi, gosterim daginiminin Gini katsayisi
  WITH g AS (SELECT provider_id, (payload->>'is_new_talent')::boolean AS yeni, (payload->>'final_rank')::int AS rank
               FROM public.analytics_events WHERE event_name = 'match_shown' AND occurred_at >= v_from AND provider_id IS NOT NULL),
       per AS (SELECT provider_id, count(*) AS n FROM g GROUP BY 1),
       ranked AS (SELECT n, row_number() OVER (ORDER BY n) AS i, count(*) OVER () AS cnt, sum(n) OVER () AS total FROM per)
  SELECT jsonb_build_object(
    'shown_total', (SELECT count(*) FROM g),
    'shown_new_talent', (SELECT count(*) FROM g WHERE yeni),
    'new_talent_share', CASE WHEN (SELECT count(*) FROM g) > 0 THEN round((SELECT count(*) FROM g WHERE yeni)::numeric / (SELECT count(*) FROM g), 3) END,
    'top3_new_talent_share', CASE WHEN (SELECT count(*) FROM g WHERE rank <= 3) > 0
                                  THEN round((SELECT count(*) FROM g WHERE yeni AND rank <= 3)::numeric / (SELECT count(*) FROM g WHERE rank <= 3), 3) END,
    'providers_shown', (SELECT count(*) FROM per),
    'gini', (SELECT CASE WHEN max(cnt) > 1 AND max(total) > 0
                         THEN round((2 * sum(i * n) / (max(cnt) * max(total))) - (max(cnt) + 1)::numeric / max(cnt), 3) END FROM ranked))
    INTO v_fair;

  RETURN jsonb_build_object('from', v_from, 'days', p_days, 'totals', v_names, 'daily', v_daily, 'funnel', v_funnel, 'fairness', v_fair);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. #23 ekip bildirimleri
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_duz_crew_member_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; v_ad text; v_etkinlik text;
BEGIN
  IF NEW.provider_id IS NULL OR NEW.status NOT IN ('proposed', 'contacted', 'confirmed') THEN RETURN NEW; END IF;
  -- kurulus ekibi: kurulus adi; bireysel ekip (organization_id NULL, FAZ 6 musteri ekibi): ekibi acan kisinin adi
  SELECT cr.organization_id, cr.created_by, o.display_name, o.legacy_profile_id, e.title, pf.full_name AS acan_ad
    INTO c
    FROM public.crews cr
    LEFT JOIN public.organizations o ON o.id = cr.organization_id
    LEFT JOIN public.events e ON e.id = cr.event_id
    LEFT JOIN public.profiles pf ON pf.id = cr.created_by
   WHERE cr.id = NEW.crew_id;
  IF c.created_by IS NULL AND c.organization_id IS NULL THEN RETURN NEW; END IF;
  IF c.legacy_profile_id = NEW.provider_id OR c.created_by = NEW.provider_id THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.provider_id) THEN RETURN NEW; END IF;
  v_ad := COALESCE(NULLIF(c.display_name, ''), NULLIF(c.acan_ad, ''), 'Bir müşteri');
  v_etkinlik := COALESCE(NULLIF(c.title, ''), 'bir etkinlik');
  INSERT INTO public.notifications (user_id, type, body, link)
  VALUES (NEW.provider_id, 'team', v_ad || ' seni "' || v_etkinlik || '" ekibine ekledi', '/profil');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_duz_crew_member_notify ON public.crew_members;
CREATE TRIGGER trg_duz_crew_member_notify
  AFTER INSERT ON public.crew_members
  FOR EACH ROW EXECUTE FUNCTION public.fn_duz_crew_member_notify();

CREATE OR REPLACE FUNCTION public.fn_duz_booking_crew_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p record; m record; v_etkinlik text; v_tarih text;
BEGIN
  IF NEW.proposal_version_id IS NULL THEN RETURN NEW; END IF;
  SELECT pr.crew_id, pr.seller_provider_id, o.display_name, e.title
    INTO p
    FROM public.proposal_versions v
    JOIN public.proposals pr ON pr.id = v.proposal_id
    LEFT JOIN public.organizations o ON o.id = pr.seller_organization_id
    LEFT JOIN public.events e ON e.id = pr.event_id
   WHERE v.id = NEW.proposal_version_id;
  IF p.crew_id IS NULL THEN RETURN NEW; END IF;
  v_etkinlik := COALESCE(NULLIF(p.title, ''), 'Etkinlik');
  v_tarih := CASE WHEN NEW.event_date IS NOT NULL THEN ' (' || to_char(NEW.event_date, 'DD.MM.YYYY') || ')' ELSE '' END;
  FOR m IN SELECT DISTINCT cm.provider_id FROM public.crew_members cm
            WHERE cm.crew_id = p.crew_id AND cm.provider_id IS NOT NULL
              AND cm.status IN ('proposed', 'contacted', 'confirmed')
              AND cm.provider_id IS DISTINCT FROM p.seller_provider_id
              AND EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = cm.provider_id) LOOP
    INSERT INTO public.notifications (user_id, type, body, link)
    VALUES (m.provider_id, 'team', '"' || v_etkinlik || '" için iş kesinleşti' || v_tarih
              || COALESCE(' — ' || NULLIF(p.display_name, ''), ''), '/profil');
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_duz_booking_crew_notify ON public.bookings;
CREATE TRIGGER trg_duz_booking_crew_notify
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.fn_duz_booking_crew_notify();

-- -----------------------------------------------------------------------------
-- 5. ilk kosu: suresi gecmis teklifler (uretimde de bir kez; sonra gunluk is)
-- -----------------------------------------------------------------------------
SELECT public.proposals_expire_stale() AS suresi_dolan_teklif;

COMMIT;
