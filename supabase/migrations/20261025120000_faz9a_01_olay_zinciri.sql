-- =============================================================================
-- FAZ 9a / DB 01 — Olay zinciri: analytics_events (ekle-yalniz) + kaynak tetikleyicileri + dolum + admin ozeti
-- Kaynak: docs/envanter/34-faz9-zeka-katmani.md bolum 2; kararlar (Guven, 23 Ekim 2026): olaylari DB tetikleyicileri yazar,
--   uygulama yazmaz; gecmis mevcut satirlardan dolar; saklama sinirsiz; yalniz admin okur.
--
-- Nesneler:
--   analytics_events                 — ekle-yalniz olay tablosu (event_name CHECK sozlugu; payload jsonb, PII YOK)
--   fn_faz9_olay_yaz(...)            — tek yazma noktasi (SECURITY DEFINER; tetikleyiciler cagirir)
--   tetikleyiciler trg_faz9_*        — event_briefs, events, match_runs, match_candidates, crew_members, proposal_versions,
--                                      proposals, quotes, rfps, bookings (10 tablo, 10 tetikleyici)
--   dolum                            — mevcut satirlardan, occurred_at = kaynak zaman, payload.backfill = true; idempotan
--   analytics_summary(p_days)        — admin ozeti (gunluk sayilar, huni, adalet gostergesi) tek JSON
--   RLS                              — SELECT yalniz is_admin; authenticated yazamaz (grant yok); service_role SELECT
-- PII: payload'a ad, e-posta, telefon, not, serbest metin YAZILMAZ — yalniz sayi, enum, kimlik, boolean.
-- Idempotan. Sapkali harf yok; yorumlar ASCII.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Tablo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name        text NOT NULL,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  actor_user_id     uuid,
  organization_id   uuid,
  provider_id       uuid,
  entity_type       text NOT NULL,
  entity_id         uuid NOT NULL,
  algorithm_version text,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_events_name_check CHECK (event_name IN (
    'brief_created',
    'event_confirmed', 'event_cancelled', 'event_completed',
    'match_run', 'match_shown', 'match_clicked',
    'crew_selected', 'crew_confirmed', 'crew_declined',
    'proposal_sent', 'proposal_approved', 'proposal_declined', 'proposal_revision',
    'quote_created', 'quote_accepted', 'quote_declined',
    'rfp_sent', 'rfp_awarded', 'rfp_cancelled',
    'booking_created', 'booking_cancelled', 'booking_completed')),
  CONSTRAINT analytics_events_entity_check CHECK (entity_type IN (
    'brief', 'event', 'match_run', 'match_candidate', 'crew_member', 'proposal', 'quote', 'rfp', 'booking')),
  CONSTRAINT analytics_events_payload_check CHECK (jsonb_typeof(payload) = 'object')
);
COMMENT ON TABLE public.analytics_events IS
  'FAZ 9a: olay zinciri (ekle-yalniz). Yalniz tetikleyici yazar (fn_faz9_olay_yaz); uygulama yazmaz. payload PII tasimaz. Yalniz admin okur. Saklama sinirsiz.';

CREATE INDEX IF NOT EXISTS analytics_events_name_time_idx     ON public.analytics_events (event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_provider_time_idx ON public.analytics_events (provider_id, occurred_at DESC) WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_events_entity_idx        ON public.analytics_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS analytics_events_org_time_idx      ON public.analytics_events (organization_id, occurred_at DESC) WHERE organization_id IS NOT NULL;
-- dolum/idempotanlik: ayni olay ayni varlik icin bir kez (gecis olaylari zaten tek yonlu)
CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_once_uidx   ON public.analytics_events (event_name, entity_id);

-- -----------------------------------------------------------------------------
-- 2. Tek yazma noktasi
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz9_olay_yaz(
  p_name text, p_entity_type text, p_entity_id uuid,
  p_provider uuid DEFAULT NULL, p_org uuid DEFAULT NULL, p_alg text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb, p_occurred timestamptz DEFAULT now(), p_actor uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.analytics_events (event_name, occurred_at, actor_user_id, organization_id, provider_id,
                                       entity_type, entity_id, algorithm_version, payload)
  VALUES (p_name, COALESCE(p_occurred, now()), p_actor, p_org, p_provider, p_entity_type, p_entity_id, p_alg,
          COALESCE(p_payload, '{}'::jsonb))
  ON CONFLICT (event_name, entity_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_faz9_olay_yaz(text, text, uuid, uuid, uuid, text, jsonb, timestamptz, uuid) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Tetikleyiciler
-- -----------------------------------------------------------------------------
-- 3.1 event_briefs -> brief_created
CREATE OR REPLACE FUNCTION public.fn_faz9_brief()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.fn_faz9_olay_yaz('brief_created', 'brief', NEW.id, NULL, NEW.organization_id, NULL,
    jsonb_build_object('source', NEW.source, 'has_attachments', COALESCE(jsonb_array_length(NEW.attachments), 0) > 0),
    NEW.created_at, auth.uid());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz9_brief ON public.event_briefs;
CREATE TRIGGER trg_faz9_brief AFTER INSERT ON public.event_briefs FOR EACH ROW EXECUTE FUNCTION public.fn_faz9_brief();

-- 3.2 events -> event_confirmed / event_cancelled / event_completed
CREATE OR REPLACE FUNCTION public.fn_faz9_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text; v_payload jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_name := CASE NEW.status::text
              WHEN 'confirmed' THEN 'event_confirmed'
              WHEN 'cancelled' THEN 'event_cancelled'
              WHEN 'completed' THEN 'event_completed'
              ELSE NULL END;
  IF v_name IS NULL THEN RETURN NEW; END IF;
  v_payload := jsonb_build_object('event_type', NEW.event_type, 'city_id', NEW.city_id,
                                  'participant_count', NEW.participant_count,
                                  'budget_min', NEW.budget_min, 'budget_max', NEW.budget_max,
                                  'is_date_flexible', NEW.is_date_flexible, 'status', NEW.status);
  PERFORM public.fn_faz9_olay_yaz(v_name, 'event', NEW.id, NULL, NEW.organization_id, NULL, v_payload, now(), auth.uid());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz9_event ON public.events;
CREATE TRIGGER trg_faz9_event AFTER INSERT OR UPDATE OF status ON public.events FOR EACH ROW EXECUTE FUNCTION public.fn_faz9_event();

-- 3.3 match_runs -> match_run (run_event_match once INSERT eder, sonda candidate_count/latency_ms UPDATE eder; olay o anda)
CREATE OR REPLACE FUNCTION public.fn_faz9_match_run()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.events WHERE id = NEW.event_id;
  PERFORM public.fn_faz9_olay_yaz('match_run', 'match_run', NEW.id, NULL, v_org, NEW.algorithm_version,
    jsonb_build_object('event_id', NEW.event_id, 'strategy', NEW.strategy, 'params', NEW.params,
                       'candidate_count', NEW.candidate_count, 'latency_ms', NEW.latency_ms),
    NEW.created_at, auth.uid());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz9_match_run ON public.match_runs;
CREATE TRIGGER trg_faz9_match_run AFTER UPDATE OF candidate_count, latency_ms ON public.match_runs
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz9_match_run();

-- 3.4 match_candidates -> match_shown / match_clicked
CREATE OR REPLACE FUNCTION public.fn_faz9_match_candidate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_alg text; v_event uuid; v_org uuid; v_ptype text; v_payload jsonb;
BEGIN
  IF (NEW.was_shown AND NOT OLD.was_shown) OR (NEW.was_clicked AND NOT OLD.was_clicked) THEN
    SELECT r.algorithm_version, r.event_id, e.organization_id INTO v_alg, v_event, v_org
      FROM public.match_runs r LEFT JOIN public.events e ON e.id = r.event_id WHERE r.id = NEW.match_run_id;
    SELECT provider_type::text INTO v_ptype FROM public.providers WHERE id = NEW.provider_id;
    v_payload := jsonb_build_object('event_id', v_event, 'match_run_id', NEW.match_run_id, 'role_id', NEW.role_id,
                                    'final_rank', NEW.final_rank, 'match_score', NEW.match_score,
                                    'reason_codes', to_jsonb(NEW.reason_codes), 'provider_type', v_ptype,
                                    'is_new_talent', 'new_talent' = ANY (NEW.reason_codes));
    IF NEW.was_shown AND NOT OLD.was_shown THEN
      PERFORM public.fn_faz9_olay_yaz('match_shown', 'match_candidate', NEW.id, NEW.provider_id, v_org, v_alg, v_payload, now(), auth.uid());
    END IF;
    IF NEW.was_clicked AND NOT OLD.was_clicked THEN
      PERFORM public.fn_faz9_olay_yaz('match_clicked', 'match_candidate', NEW.id, NEW.provider_id, v_org, v_alg, v_payload, now(), auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz9_match_candidate ON public.match_candidates;
CREATE TRIGGER trg_faz9_match_candidate AFTER UPDATE OF was_shown, was_clicked ON public.match_candidates
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz9_match_candidate();

-- 3.5 crew_members -> crew_selected / crew_confirmed / crew_declined
CREATE OR REPLACE FUNCTION public.fn_faz9_crew_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid; v_event uuid; v_strategy text; v_payload jsonb; v_name text;
BEGIN
  SELECT c.organization_id, c.event_id, c.strategy::text INTO v_org, v_event, v_strategy FROM public.crews c WHERE c.id = NEW.crew_id;
  v_payload := jsonb_build_object('event_id', v_event, 'crew_id', NEW.crew_id, 'role_id', NEW.role_id,
                                  'pool_origin', NEW.pool_origin, 'from_match', NEW.match_candidate_id IS NOT NULL,
                                  'crew_strategy', v_strategy, 'status', NEW.status);
  IF TG_OP = 'INSERT' THEN
    PERFORM public.fn_faz9_olay_yaz('crew_selected', 'crew_member', NEW.id, NEW.provider_id, v_org, NULL, v_payload, NEW.created_at, auth.uid());
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_name := CASE NEW.status::text WHEN 'confirmed' THEN 'crew_confirmed' WHEN 'declined' THEN 'crew_declined' ELSE NULL END;
  IF v_name IS NOT NULL THEN
    PERFORM public.fn_faz9_olay_yaz(v_name, 'crew_member', NEW.id, NEW.provider_id, v_org, NULL, v_payload, now(), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz9_crew_member ON public.crew_members;
CREATE TRIGGER trg_faz9_crew_member AFTER INSERT OR UPDATE OF status ON public.crew_members
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz9_crew_member();

-- 3.6 proposal_versions -> proposal_sent (sent_at NULL -> dolu)
CREATE OR REPLACE FUNCTION public.fn_faz9_proposal_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_prov uuid; v_org uuid; v_rfp uuid; v_source text; v_event uuid; v_items integer;
BEGIN
  IF OLD.sent_at IS NOT NULL OR NEW.sent_at IS NULL THEN RETURN NEW; END IF;
  SELECT seller_provider_id, seller_organization_id, rfp_id, source_type::text, event_id
    INTO v_prov, v_org, v_rfp, v_source, v_event FROM public.proposals WHERE id = NEW.proposal_id;
  SELECT count(*) INTO v_items FROM public.proposal_items WHERE proposal_version_id = NEW.id;
  PERFORM public.fn_faz9_olay_yaz('proposal_sent', 'proposal', NEW.id, v_prov, v_org, NULL,
    jsonb_build_object('proposal_id', NEW.proposal_id, 'event_id', v_event, 'version_no', NEW.version_no,
                       'total_amount', NEW.total_amount, 'item_count', v_items, 'has_rfp', v_rfp IS NOT NULL,
                       'source_type', v_source),
    NEW.sent_at, auth.uid());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz9_proposal_version ON public.proposal_versions;
CREATE TRIGGER trg_faz9_proposal_version AFTER UPDATE OF sent_at ON public.proposal_versions
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz9_proposal_version();

-- 3.7 proposals -> proposal_approved / proposal_declined / proposal_revision
CREATE OR REPLACE FUNCTION public.fn_faz9_proposal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text; v_ver integer; v_total numeric; v_portal boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_name := CASE NEW.status::text
              WHEN 'approved' THEN 'proposal_approved'
              WHEN 'declined' THEN 'proposal_declined'
              WHEN 'revision_requested' THEN 'proposal_revision'
              ELSE NULL END;
  IF v_name IS NULL THEN RETURN NEW; END IF;
  SELECT version_no, total_amount, approved_by_name IS NOT NULL INTO v_ver, v_total, v_portal
    FROM public.proposal_versions WHERE id = NEW.current_version_id;
  -- entity_id = teklif; ayni teklif birden cok kez onaylanamaz (7a kurali), revizyon tekrar edebilir ama
  -- tekil indeks ilkini tutar (V0 kabul: ilk revizyon istegi).
  PERFORM public.fn_faz9_olay_yaz(v_name, 'proposal', NEW.id, NEW.seller_provider_id, NEW.seller_organization_id, NULL,
    jsonb_build_object('event_id', NEW.event_id, 'version_no', v_ver, 'total_amount', v_total,
                       'via_portal', COALESCE(v_portal, false), 'has_rfp', NEW.rfp_id IS NOT NULL,
                       'buyer_organization_id', NEW.buyer_organization_id),
    now(), auth.uid());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz9_proposal ON public.proposals;
CREATE TRIGGER trg_faz9_proposal AFTER UPDATE OF status ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.fn_faz9_proposal();

-- 3.8 quotes (pazaryeri pro teklifi) -> quote_created / quote_accepted / quote_declined
CREATE OR REPLACE FUNCTION public.fn_faz9_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_event_type text; v_event uuid; v_name text;
BEGIN
  SELECT event_type, event_id INTO v_event_type, v_event FROM public.conversations WHERE id = NEW.conversation_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.fn_faz9_olay_yaz('quote_created', 'quote', NEW.id, NEW.sender_id, NULL, NULL,
      jsonb_build_object('total_amount', NEW.total_amount, 'over_budget', NEW.over_budget, 'event_type', v_event_type,
                         'event_id', v_event, 'conversation_id', NEW.conversation_id),
      NEW.created_at, auth.uid());
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_name := CASE NEW.status::text WHEN 'accepted' THEN 'quote_accepted' WHEN 'declined' THEN 'quote_declined' ELSE NULL END;
  IF v_name IS NOT NULL THEN
    PERFORM public.fn_faz9_olay_yaz(v_name, 'quote', NEW.id, NEW.sender_id, NULL, NULL,
      jsonb_build_object('total_amount', NEW.total_amount, 'event_type', v_event_type, 'event_id', v_event),
      COALESCE(NEW.responded_at, now()), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz9_quote ON public.quotes;
CREATE TRIGGER trg_faz9_quote AFTER INSERT OR UPDATE OF status ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.fn_faz9_quote();

-- 3.9 rfps -> rfp_sent / rfp_awarded / rfp_cancelled
CREATE OR REPLACE FUNCTION public.fn_faz9_rfp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text; v_inv integer; v_resp integer;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_name := CASE NEW.status::text WHEN 'sent' THEN 'rfp_sent' WHEN 'awarded' THEN 'rfp_awarded' WHEN 'cancelled' THEN 'rfp_cancelled' ELSE NULL END;
  IF v_name IS NULL THEN RETURN NEW; END IF;
  SELECT count(*), count(*) FILTER (WHERE status = 'responded') INTO v_inv, v_resp FROM public.rfp_invites WHERE rfp_id = NEW.id;
  PERFORM public.fn_faz9_olay_yaz(v_name, 'rfp', NEW.id, NULL, NEW.organization_id, NULL,
    jsonb_build_object('event_id', NEW.event_id, 'invite_count', v_inv, 'response_count', v_resp,
                       'awarded', NEW.awarded_proposal_id IS NOT NULL),
    now(), auth.uid());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz9_rfp ON public.rfps;
CREATE TRIGGER trg_faz9_rfp AFTER UPDATE OF status ON public.rfps FOR EACH ROW EXECUTE FUNCTION public.fn_faz9_rfp();

-- 3.10 bookings -> booking_created / booking_cancelled / booking_completed
CREATE OR REPLACE FUNCTION public.fn_faz9_booking_payload(b public.bookings)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'total_amount', b.total_amount, 'event_type', b.event_type, 'event_date', b.event_date, 'event_id', b.event_id,
    'shape', CASE WHEN b.proposal_version_id IS NOT NULL THEN 'proposal'
                  WHEN b.crew_member_id IS NOT NULL THEN 'crew' ELSE 'quote' END,
    'has_buyer_org', b.buyer_organization_id IS NOT NULL, 'status', b.status)
$$;
CREATE OR REPLACE FUNCTION public.fn_faz9_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_prov uuid; v_payload jsonb; v_name text; v_side text;
BEGIN
  v_prov := COALESCE(NEW.seller_provider_id, NEW.professional_id);
  v_payload := public.fn_faz9_booking_payload(NEW);
  IF TG_OP = 'INSERT' THEN
    PERFORM public.fn_faz9_olay_yaz('booking_created', 'booking', NEW.id, v_prov, NEW.buyer_organization_id, NULL, v_payload, NEW.created_at, auth.uid());
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status::text = 'cancelled' THEN
    v_side := CASE WHEN NEW.cancelled_by IS NULL THEN NULL
                   WHEN NEW.cancelled_by = NEW.customer_id THEN 'buyer'
                   WHEN NEW.cancelled_by = NEW.professional_id OR NEW.cancelled_by = NEW.seller_provider_id THEN 'seller'
                   ELSE 'other' END;
    v_payload := v_payload || jsonb_build_object('cancelled_by_side', v_side,
                   'days_before_event', CASE WHEN NEW.event_date IS NOT NULL THEN (NEW.event_date - COALESCE(NEW.cancelled_at, now())::date) END);
    v_name := 'booking_cancelled';
  ELSIF NEW.status::text = 'completed' THEN
    v_name := 'booking_completed';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.fn_faz9_olay_yaz(v_name, 'booking', NEW.id, v_prov, NEW.buyer_organization_id, NULL, v_payload,
    COALESCE(CASE WHEN v_name = 'booking_cancelled' THEN NEW.cancelled_at ELSE NEW.completed_at END, now()), auth.uid());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz9_booking ON public.bookings;
CREATE TRIGGER trg_faz9_booking AFTER INSERT OR UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.fn_faz9_booking();

-- -----------------------------------------------------------------------------
-- 4. Dolum — mevcut satirlardan (idempotan: tekil indeks + ON CONFLICT DO NOTHING)
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record; b public.bookings;
BEGIN
  -- brief_created
  FOR r IN SELECT * FROM public.event_briefs LOOP
    PERFORM public.fn_faz9_olay_yaz('brief_created', 'brief', r.id, NULL, r.organization_id, NULL,
      jsonb_build_object('source', r.source, 'has_attachments', COALESCE(jsonb_array_length(r.attachments), 0) > 0, 'backfill', true), r.created_at, NULL);
  END LOOP;
  -- event_confirmed (confirmed_at dolu olanlar; cancelled/completed durumdakiler de confirmed gecmistir — confirmed_at ile)
  FOR r IN SELECT * FROM public.events WHERE confirmed_at IS NOT NULL OR status IN ('confirmed','matching','booked','running','completed') LOOP
    PERFORM public.fn_faz9_olay_yaz('event_confirmed', 'event', r.id, NULL, r.organization_id, NULL,
      jsonb_build_object('event_type', r.event_type, 'city_id', r.city_id, 'participant_count', r.participant_count,
                         'budget_min', r.budget_min, 'budget_max', r.budget_max, 'is_date_flexible', r.is_date_flexible,
                         'status', 'confirmed', 'backfill', true), COALESCE(r.confirmed_at, r.created_at), NULL);
  END LOOP;
  FOR r IN SELECT * FROM public.events WHERE status IN ('cancelled','completed') LOOP
    PERFORM public.fn_faz9_olay_yaz(CASE WHEN r.status = 'cancelled' THEN 'event_cancelled' ELSE 'event_completed' END, 'event', r.id, NULL, r.organization_id, NULL,
      jsonb_build_object('event_type', r.event_type, 'city_id', r.city_id, 'status', r.status, 'backfill', true), r.updated_at, NULL);
  END LOOP;
  -- match_run
  FOR r IN SELECT m.*, e.organization_id AS org FROM public.match_runs m LEFT JOIN public.events e ON e.id = m.event_id LOOP
    PERFORM public.fn_faz9_olay_yaz('match_run', 'match_run', r.id, NULL, r.org, r.algorithm_version,
      jsonb_build_object('event_id', r.event_id, 'strategy', r.strategy, 'params', r.params, 'candidate_count', r.candidate_count,
                         'latency_ms', r.latency_ms, 'backfill', true), r.created_at, NULL);
  END LOOP;
  -- match_shown / match_clicked (zaman: adayin created_at — gosterim ani kaydedilmemis)
  FOR r IN SELECT c.*, m.algorithm_version AS alg, m.event_id AS ev, e.organization_id AS org, p.provider_type::text AS ptype
             FROM public.match_candidates c JOIN public.match_runs m ON m.id = c.match_run_id
             LEFT JOIN public.events e ON e.id = m.event_id LEFT JOIN public.providers p ON p.id = c.provider_id
            WHERE c.was_shown OR c.was_clicked LOOP
    IF r.was_shown THEN
      PERFORM public.fn_faz9_olay_yaz('match_shown', 'match_candidate', r.id, r.provider_id, r.org, r.alg,
        jsonb_build_object('event_id', r.ev, 'match_run_id', r.match_run_id, 'role_id', r.role_id, 'final_rank', r.final_rank,
                           'match_score', r.match_score, 'reason_codes', to_jsonb(r.reason_codes), 'provider_type', r.ptype,
                           'is_new_talent', 'new_talent' = ANY (r.reason_codes), 'backfill', true), r.created_at, NULL);
    END IF;
    IF r.was_clicked THEN
      PERFORM public.fn_faz9_olay_yaz('match_clicked', 'match_candidate', r.id, r.provider_id, r.org, r.alg,
        jsonb_build_object('event_id', r.ev, 'match_run_id', r.match_run_id, 'role_id', r.role_id, 'final_rank', r.final_rank,
                           'match_score', r.match_score, 'reason_codes', to_jsonb(r.reason_codes), 'provider_type', r.ptype,
                           'is_new_talent', 'new_talent' = ANY (r.reason_codes), 'backfill', true), r.created_at, NULL);
    END IF;
  END LOOP;
  -- crew_selected / crew_confirmed / crew_declined
  FOR r IN SELECT cm.*, c.organization_id AS org, c.event_id AS ev, c.strategy::text AS strat FROM public.crew_members cm JOIN public.crews c ON c.id = cm.crew_id LOOP
    PERFORM public.fn_faz9_olay_yaz('crew_selected', 'crew_member', r.id, r.provider_id, r.org, NULL,
      jsonb_build_object('event_id', r.ev, 'crew_id', r.crew_id, 'role_id', r.role_id, 'pool_origin', r.pool_origin,
                         'from_match', r.match_candidate_id IS NOT NULL, 'crew_strategy', r.strat, 'status', 'proposed', 'backfill', true), r.created_at, NULL);
    IF r.status::text IN ('confirmed', 'declined') THEN
      PERFORM public.fn_faz9_olay_yaz(CASE WHEN r.status::text = 'confirmed' THEN 'crew_confirmed' ELSE 'crew_declined' END, 'crew_member', r.id, r.provider_id, r.org, NULL,
        jsonb_build_object('event_id', r.ev, 'crew_id', r.crew_id, 'role_id', r.role_id, 'pool_origin', r.pool_origin,
                           'from_match', r.match_candidate_id IS NOT NULL, 'crew_strategy', r.strat, 'status', r.status, 'backfill', true), r.updated_at, NULL);
    END IF;
  END LOOP;
  -- proposal_sent (gonderilmis surumler)
  FOR r IN SELECT v.*, p.seller_provider_id AS prov, p.seller_organization_id AS org, p.rfp_id, p.source_type::text AS src, p.event_id AS ev,
                  (SELECT count(*) FROM public.proposal_items i WHERE i.proposal_version_id = v.id) AS items
             FROM public.proposal_versions v JOIN public.proposals p ON p.id = v.proposal_id WHERE v.sent_at IS NOT NULL LOOP
    PERFORM public.fn_faz9_olay_yaz('proposal_sent', 'proposal', r.id, r.prov, r.org, NULL,
      jsonb_build_object('proposal_id', r.proposal_id, 'event_id', r.ev, 'version_no', r.version_no, 'total_amount', r.total_amount,
                         'item_count', r.items, 'has_rfp', r.rfp_id IS NOT NULL, 'source_type', r.src, 'backfill', true), r.sent_at, NULL);
  END LOOP;
  -- proposal_approved / declined / revision (mevcut durum)
  FOR r IN SELECT p.*, v.version_no, v.total_amount, v.approved_by_name, v.approved_at
             FROM public.proposals p LEFT JOIN public.proposal_versions v ON v.id = p.current_version_id
            WHERE p.status IN ('approved', 'declined', 'revision_requested') LOOP
    PERFORM public.fn_faz9_olay_yaz(CASE r.status::text WHEN 'approved' THEN 'proposal_approved' WHEN 'declined' THEN 'proposal_declined' ELSE 'proposal_revision' END,
      'proposal', r.id, r.seller_provider_id, r.seller_organization_id, NULL,
      jsonb_build_object('event_id', r.event_id, 'version_no', r.version_no, 'total_amount', r.total_amount,
                         'via_portal', r.approved_by_name IS NOT NULL, 'has_rfp', r.rfp_id IS NOT NULL,
                         'buyer_organization_id', r.buyer_organization_id, 'backfill', true),
      COALESCE(r.approved_at, r.updated_at), NULL);
  END LOOP;
  -- quotes
  FOR r IN SELECT q.*, c.event_type AS et, c.event_id AS ev FROM public.quotes q LEFT JOIN public.conversations c ON c.id = q.conversation_id LOOP
    PERFORM public.fn_faz9_olay_yaz('quote_created', 'quote', r.id, r.sender_id, NULL, NULL,
      jsonb_build_object('total_amount', r.total_amount, 'over_budget', r.over_budget, 'event_type', r.et, 'event_id', r.ev,
                         'conversation_id', r.conversation_id, 'backfill', true), r.created_at, NULL);
    IF r.status::text IN ('accepted', 'declined') THEN
      PERFORM public.fn_faz9_olay_yaz(CASE WHEN r.status::text = 'accepted' THEN 'quote_accepted' ELSE 'quote_declined' END, 'quote', r.id, r.sender_id, NULL, NULL,
        jsonb_build_object('total_amount', r.total_amount, 'event_type', r.et, 'event_id', r.ev, 'backfill', true), COALESCE(r.responded_at, r.created_at), NULL);
    END IF;
  END LOOP;
  -- rfps (sent gecmisi: sent/collecting/evaluating/awarded hepsi gonderilmis)
  FOR r IN SELECT f.*, (SELECT count(*) FROM public.rfp_invites i WHERE i.rfp_id = f.id) AS inv,
                  (SELECT count(*) FROM public.rfp_invites i WHERE i.rfp_id = f.id AND i.status = 'responded') AS resp
             FROM public.rfps f WHERE f.status <> 'draft' LOOP
    IF r.status::text IN ('sent', 'collecting', 'evaluating', 'awarded') THEN
      PERFORM public.fn_faz9_olay_yaz('rfp_sent', 'rfp', r.id, NULL, r.organization_id, NULL,
        jsonb_build_object('event_id', r.event_id, 'invite_count', r.inv, 'response_count', r.resp, 'awarded', false, 'backfill', true), r.created_at, NULL);
    END IF;
    IF r.status::text = 'awarded' THEN
      PERFORM public.fn_faz9_olay_yaz('rfp_awarded', 'rfp', r.id, NULL, r.organization_id, NULL,
        jsonb_build_object('event_id', r.event_id, 'invite_count', r.inv, 'response_count', r.resp, 'awarded', true, 'backfill', true), r.updated_at, NULL);
    ELSIF r.status::text = 'cancelled' THEN
      PERFORM public.fn_faz9_olay_yaz('rfp_cancelled', 'rfp', r.id, NULL, r.organization_id, NULL,
        jsonb_build_object('event_id', r.event_id, 'invite_count', r.inv, 'response_count', r.resp, 'awarded', false, 'backfill', true), r.updated_at, NULL);
    END IF;
  END LOOP;
  -- bookings
  FOR b IN SELECT * FROM public.bookings LOOP
    PERFORM public.fn_faz9_olay_yaz('booking_created', 'booking', b.id, COALESCE(b.seller_provider_id, b.professional_id), b.buyer_organization_id, NULL,
      public.fn_faz9_booking_payload(b) || jsonb_build_object('status', 'confirmed', 'backfill', true), b.created_at, NULL);
    IF b.status::text = 'cancelled' THEN
      PERFORM public.fn_faz9_olay_yaz('booking_cancelled', 'booking', b.id, COALESCE(b.seller_provider_id, b.professional_id), b.buyer_organization_id, NULL,
        public.fn_faz9_booking_payload(b) || jsonb_build_object(
          'cancelled_by_side', CASE WHEN b.cancelled_by IS NULL THEN NULL WHEN b.cancelled_by = b.customer_id THEN 'buyer'
                                    WHEN b.cancelled_by = b.professional_id OR b.cancelled_by = b.seller_provider_id THEN 'seller' ELSE 'other' END,
          'days_before_event', CASE WHEN b.event_date IS NOT NULL AND b.cancelled_at IS NOT NULL THEN (b.event_date - b.cancelled_at::date) END,
          'backfill', true), COALESCE(b.cancelled_at, b.created_at), NULL);
    ELSIF b.status::text = 'completed' THEN
      PERFORM public.fn_faz9_olay_yaz('booking_completed', 'booking', b.id, COALESCE(b.seller_provider_id, b.professional_id), b.buyer_organization_id, NULL,
        public.fn_faz9_booking_payload(b) || jsonb_build_object('backfill', true), COALESCE(b.completed_at, b.created_at), NULL);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 5. RLS + yetki
-- -----------------------------------------------------------------------------
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS analytics_events_admin_select ON public.analytics_events;
CREATE POLICY analytics_events_admin_select ON public.analytics_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
REVOKE ALL ON public.analytics_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated;    -- politika is_admin ile sinirlar
GRANT SELECT ON public.analytics_events TO service_role;      -- rapor/Edge; yazma yalniz tetikleyici (definer)

-- -----------------------------------------------------------------------------
-- 6. Admin ozeti — tek JSON (gunluk sayilar, huni, adalet gostergesi)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_summary(p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_from timestamptz := now() - make_interval(days => GREATEST(1, LEAST(p_days, 365)));
  v_daily jsonb; v_funnel jsonb; v_fair jsonb; v_names jsonb;
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

  -- huni (benzersiz varlik)
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
REVOKE ALL ON FUNCTION public.analytics_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analytics_summary(integer) TO authenticated, service_role;

COMMIT;
