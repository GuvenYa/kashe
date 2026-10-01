-- =============================================================================
-- FAZ 6 / 01 — Eslestirme ve ekip: match_runs, match_candidates, crews, crew_members,
--               internal.crew_member_commercials + Match V0.1 (kural tabanli, DB'de) + RPC'ler
--
-- Plan: docs/envanter/18-faz6-eslestirme-ekip.md (kararlar bolum 2, model bolum 3).
-- Kaynak: 01-veri-modeli bolum 5-6-8, 02-guvenlik (gerekce kodlari, sunucu tarafi kurallar), 04 madde 31-33.
--
-- Kurallar:
--   * Skor DB'de hesaplanir (run_event_match); uygulama match_* tablolarina YAZMAZ (yalniz RPC). Ekle-yalniz:
--     kosu ve adaylar degistirilmez; was_shown / was_clicked yalniz false -> true (RPC).
--   * Aday kaynagi: bireysel profesyoneller (rol basina) + ajanslar (etkinlik basina, coverage_ratio).
--     Ajans kapsami YALNIZ acik verilerden (kendi provider_services + Ekibim uyelerinin provider_services);
--     ozel havuz (organization_talent_records) kapsam hesabina GIRMEZ.
--   * Zorunlu rol kapsanmayan ajans "tam hizmet" degildir (full_service_eligible = false, coverage_full kodu yok).
--   * Ekip: etkinlik sahibi kurar; organization_id doluysa kurulusta crew.view okur / crew.manage yazar.
--     Zorunlu roller onaylanmis uyelerle kapsanmadan ekip 'confirmed' olamaz (tetikleyici).
--   * Ic ticari goruntu (internal.crew_member_commercials) yalniz kurulus ekibinde ve yalniz RPC ile
--     (commercial.view okur, commercial.manage yazar); bireysel ekipte yok.
--   * public semasinda varsayilan yetkiler her seyi anon/authenticated'a verir -> once REVOKE, sonra sutun bazli GRANT.
--
-- Idempotan (iki kez uygulanabilir). Sapkali harf yok. VERI YAZMAZ (tablolar bos baslar).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Enum'lar (7)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_strategy' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.match_strategy AS ENUM ('individual', 'full_service', 'hybrid');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crew_source_policy' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.crew_source_policy AS ENUM ('private_first', 'private_plus_marketplace', 'marketplace_only');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crew_objective' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.crew_objective AS ENUM ('best_fit', 'most_economical', 'highest_margin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crew_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.crew_status AS ENUM ('draft', 'proposed', 'confirmed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crew_member_pool_origin' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.crew_member_pool_origin AS ENUM ('private', 'marketplace', 'external');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crew_member_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.crew_member_status AS ENUM ('proposed', 'contacted', 'confirmed', 'declined', 'replaced');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crew_rate_source' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.crew_rate_source AS ENUM ('default', 'manual_override', 'marketplace_quote');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) match_runs / match_candidates (yalniz RPC yazar)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requirement_id    uuid REFERENCES public.event_requirements(id) ON DELETE SET NULL,   -- tek rol icin kosu ise (V0: NULL)
  strategy          public.match_strategy NOT NULL DEFAULT 'hybrid',
  algorithm_version text NOT NULL,
  params            jsonb NOT NULL DEFAULT '{}'::jsonb,
  candidate_count   integer NOT NULL DEFAULT 0,
  latency_ms        integer,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_runs_event_idx ON public.match_runs (event_id, created_at DESC);
COMMENT ON TABLE public.match_runs IS 'FAZ 6: eslestirme kosusu (ekle-yalniz). Yalniz run_event_match yazar. params: agirliklar + limitler.';

CREATE TABLE IF NOT EXISTS public.match_candidates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_run_id          uuid NOT NULL REFERENCES public.match_runs(id) ON DELETE CASCADE,
  provider_id           uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  role_id               integer REFERENCES public.service_roles(id) ON DELETE RESTRICT,   -- profesyonel aday: dolu; ajans aday: NULL
  match_score           numeric(5,2) NOT NULL,
  trust_score           numeric,
  coverage_ratio        numeric(4,3),                     -- yalniz ajans adayinda
  availability_conf     numeric(3,2) NOT NULL DEFAULT 0.50,
  acceptance_prob       numeric,                          -- FAZ 9; V0 NULL
  full_service_eligible boolean,                          -- yalniz ajans adayinda
  final_rank            integer NOT NULL,
  reason_codes          text[] NOT NULL DEFAULT '{}'::text[],
  was_shown             boolean NOT NULL DEFAULT false,
  was_clicked           boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mc_score_check     CHECK (match_score BETWEEN 0 AND 100),
  CONSTRAINT mc_coverage_check  CHECK (coverage_ratio IS NULL OR coverage_ratio BETWEEN 0 AND 1),
  CONSTRAINT mc_avail_check     CHECK (availability_conf BETWEEN 0 AND 1),
  CONSTRAINT mc_rank_check      CHECK (final_rank >= 1),
  CONSTRAINT mc_kind_check      CHECK ((role_id IS NOT NULL AND coverage_ratio IS NULL AND full_service_eligible IS NULL)
                                    OR (role_id IS NULL AND coverage_ratio IS NOT NULL AND full_service_eligible IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS mc_run_provider_role_key ON public.match_candidates (match_run_id, provider_id, role_id) WHERE role_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mc_run_provider_org_key  ON public.match_candidates (match_run_id, provider_id) WHERE role_id IS NULL;
CREATE INDEX IF NOT EXISTS mc_provider_idx ON public.match_candidates (provider_id);
COMMENT ON TABLE public.match_candidates IS 'FAZ 6: kosunun adaylari (gosterilen ama secilmeyenler dahil; was_shown). Yalniz RPC yazar.';

-- -----------------------------------------------------------------------------
-- 3) crews / crew_members
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organization_id   uuid REFERENCES public.organizations(id) ON DELETE SET NULL,   -- ajans kuruyorsa
  name              text NOT NULL DEFAULT 'Ekip',
  strategy          public.match_strategy NOT NULL DEFAULT 'hybrid',
  algorithm_version text,
  source_policy     public.crew_source_policy NOT NULL DEFAULT 'marketplace_only',
  objective         public.crew_objective NOT NULL DEFAULT 'best_fit',
  status            public.crew_status NOT NULL DEFAULT 'draft',
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crews_name_check CHECK (char_length(trim(name)) BETWEEN 1 AND 120)
);
CREATE INDEX IF NOT EXISTS crews_event_idx ON public.crews (event_id);
CREATE INDEX IF NOT EXISTS crews_org_idx   ON public.crews (organization_id) WHERE organization_id IS NOT NULL;
COMMENT ON TABLE public.crews IS 'FAZ 6: etkinlik icin ekip. Sahip kurar; organization_id doluysa kurulus crew.view/crew.manage ile okur/yazar.';

CREATE TABLE IF NOT EXISTS public.crew_members (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id            uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  role_id            integer NOT NULL REFERENCES public.service_roles(id) ON DELETE RESTRICT,
  talent_record_id   uuid REFERENCES public.organization_talent_records(id) ON DELETE SET NULL,
  provider_id        uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  pool_origin        public.crew_member_pool_origin NOT NULL DEFAULT 'marketplace',
  status             public.crew_member_status NOT NULL DEFAULT 'proposed',
  is_locked          boolean NOT NULL DEFAULT false,
  sort_order         integer NOT NULL DEFAULT 0,
  note               text,
  match_candidate_id uuid REFERENCES public.match_candidates(id) ON DELETE SET NULL,   -- izlenebilirlik
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crew_members_note_check CHECK (note IS NULL OR char_length(note) <= 2000)
);
-- Kaynak kisiti (talent_record_id veya provider_id) INSERT tetikleyicisinde: FK'ler ON DELETE SET NULL oldugundan
-- tablo CHECK'i kaynak silinince ust satirin silinmesini engellerdi (havuz Sil / hesap silme). Iki kaynagi da
-- silinmis uye "kaynagi silinmis" olarak kalir (asama14 K7 bilgi).
CREATE INDEX IF NOT EXISTS crew_members_crew_idx   ON public.crew_members (crew_id, sort_order);
CREATE INDEX IF NOT EXISTS crew_members_record_idx ON public.crew_members (talent_record_id) WHERE talent_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crew_members_prov_idx   ON public.crew_members (provider_id) WHERE provider_id IS NOT NULL;
COMMENT ON TABLE public.crew_members IS 'FAZ 6: ekip uyesi (rol x kisi). Kaynak: havuz kaydi ve/veya pazaryeri saglayicisi; pool_origin tetikleyici turetir.';

-- updated_at
DROP TRIGGER IF EXISTS on_crews_updated ON public.crews;
CREATE TRIGGER on_crews_updated BEFORE UPDATE ON public.crews FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_crew_members_updated ON public.crew_members;
CREATE TRIGGER on_crew_members_updated BEFORE UPDATE ON public.crew_members FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- crews: INSERT (created_by, kurulus yetkisi) + UPDATE guard (event_id sabit, organization_id NULL -> deger bir kez, confirmed kapsam kontrolu)
CREATE OR REPLACE FUNCTION public.fn_faz6_crew_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  NEW.name := trim(NEW.name);
  IF NEW.organization_id IS NOT NULL AND NEW.source_policy = 'marketplace_only' THEN
    NEW.source_policy := 'private_first';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz6_crew_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE eksik text;
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    RAISE EXCEPTION 'ekibin etkinligi degistirilemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF OLD.organization_id IS NOT NULL AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'ekibin kurulusu degistirilemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NEW.status = 'confirmed' AND OLD.status <> 'confirmed' THEN
    -- zorunlu her rol, onaylanmis uyelerle en az quantity kadar kapsanmali
    SELECT string_agg(sr.slug, ', ' ORDER BY r.sort_order) INTO eksik
      FROM public.event_requirements r
      JOIN public.service_roles sr ON sr.id = r.role_id
     WHERE r.event_id = NEW.event_id AND r.is_required
       AND (SELECT count(*) FROM public.crew_members m
             WHERE m.crew_id = NEW.id AND m.role_id = r.role_id AND m.status = 'confirmed') < r.quantity;
    IF eksik IS NOT NULL THEN
      RAISE EXCEPTION 'zorunlu rol kapsanmadi: %', eksik USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;
  NEW.name := trim(NEW.name);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz6_crew_before_insert ON public.crews;
CREATE TRIGGER trg_faz6_crew_before_insert BEFORE INSERT ON public.crews FOR EACH ROW EXECUTE FUNCTION public.fn_faz6_crew_before_insert();
DROP TRIGGER IF EXISTS trg_faz6_crew_guard ON public.crews;
CREATE TRIGGER trg_faz6_crew_guard BEFORE UPDATE ON public.crews FOR EACH ROW EXECUTE FUNCTION public.fn_faz6_crew_guard();

-- crew_members: INSERT (kaynak zorunlu, kurulus tutarliligi, pool_origin turetimi) + UPDATE guard (crew_id sabit)
CREATE OR REPLACE FUNCTION public.fn_faz6_member_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; r record;
BEGIN
  IF NEW.talent_record_id IS NULL AND NEW.provider_id IS NULL THEN
    RAISE EXCEPTION 'ekip uyesi icin havuz kaydi veya saglayici gerekir' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT id, organization_id INTO c FROM public.crews WHERE id = NEW.crew_id;
  IF NEW.talent_record_id IS NOT NULL THEN
    SELECT organization_id, talent_id INTO r FROM public.organization_talent_records WHERE id = NEW.talent_record_id;
    IF r.organization_id IS NULL THEN
      RAISE EXCEPTION 'havuz kaydi yok' USING ERRCODE = 'no_data_found';
    END IF;
    IF c.organization_id IS NULL OR c.organization_id <> r.organization_id THEN
      RAISE EXCEPTION 'havuz kaydi ekibin kurulusuna ait degil' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    -- havuz kaydi Kashe uyesine bagliysa provider_id de turetilir (providers.talent_id)
    IF NEW.provider_id IS NULL AND r.talent_id IS NOT NULL THEN
      SELECT id INTO NEW.provider_id FROM public.providers WHERE talent_id = r.talent_id AND provider_type = 'professional' LIMIT 1;
    END IF;
    NEW.pool_origin := CASE WHEN r.talent_id IS NULL THEN 'external' ELSE 'private' END;
  ELSE
    NEW.pool_origin := 'marketplace';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz6_member_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.crew_id IS DISTINCT FROM OLD.crew_id THEN
    RAISE EXCEPTION 'uyenin ekibi degistirilemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- kaynak degisimi yok: yeni kisi = yeni uye (eskisi 'replaced'); FK SET NULL (kaynak silindi) serbest
  IF NEW.talent_record_id IS NOT NULL AND OLD.talent_record_id IS NOT NULL AND NEW.talent_record_id <> OLD.talent_record_id THEN
    RAISE EXCEPTION 'uyenin havuz kaydi degistirilemez; yeni uye ekle' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NEW.provider_id IS NOT NULL AND OLD.provider_id IS NOT NULL AND NEW.provider_id <> OLD.provider_id THEN
    RAISE EXCEPTION 'uyenin saglayicisi degistirilemez; yeni uye ekle' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  NEW.pool_origin := OLD.pool_origin;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz6_member_before_insert ON public.crew_members;
CREATE TRIGGER trg_faz6_member_before_insert BEFORE INSERT ON public.crew_members FOR EACH ROW EXECUTE FUNCTION public.fn_faz6_member_before_insert();
DROP TRIGGER IF EXISTS trg_faz6_member_guard ON public.crew_members;
CREATE TRIGGER trg_faz6_member_guard BEFORE UPDATE ON public.crew_members FOR EACH ROW EXECUTE FUNCTION public.fn_faz6_member_guard();

REVOKE ALL ON FUNCTION public.fn_faz6_crew_before_insert()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz6_crew_guard()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz6_member_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz6_member_guard()         FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4) internal.crew_member_commercials (islem ani ic goruntu; yalniz RPC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internal.crew_member_commercials (
  crew_member_id   uuid PRIMARY KEY REFERENCES public.crew_members(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agreed_cost      numeric NOT NULL CHECK (agreed_cost >= 0),
  cost_basis       public.talent_cost_basis NOT NULL DEFAULT 'per_job',
  currency         char(3) NOT NULL DEFAULT 'TRY',
  client_price     numeric CHECK (client_price IS NULL OR client_price >= 0),
  markup_amount    numeric GENERATED ALWAYS AS (client_price - agreed_cost) STORED,
  margin_rate      numeric GENERATED ALWAYS AS (CASE WHEN client_price > 0 THEN round((client_price - agreed_cost) / client_price, 4) END) STORED,
  rate_source      public.crew_rate_source NOT NULL,
  source_rate_id   uuid,                               -- internal.organization_talent_rates.id (bilgi; FK yok)
  snapshot_at      timestamptz NOT NULL DEFAULT now(),
  private_note     text,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cmc_org_idx ON internal.crew_member_commercials (organization_id);
COMMENT ON TABLE internal.crew_member_commercials IS 'FAZ 6: ekip uyesi ic maliyet anlik goruntusu. Yalniz RPC; kurulus ekibi; varsayilan oran degisse bu degismez.';

CREATE OR REPLACE FUNCTION internal.fn_faz6_cmc_org_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE v_org uuid;
BEGIN
  SELECT c.organization_id INTO v_org FROM public.crew_members m JOIN public.crews c ON c.id = m.crew_id WHERE m.id = NEW.crew_member_id;
  IF v_org IS NULL OR v_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'ic goruntu yalniz kurulus ekibinin uyesi icin ve ayni kurulusla yazilir' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz6_cmc_org_check ON internal.crew_member_commercials;
CREATE TRIGGER trg_faz6_cmc_org_check BEFORE INSERT OR UPDATE ON internal.crew_member_commercials FOR EACH ROW EXECUTE FUNCTION internal.fn_faz6_cmc_org_check();
DROP TRIGGER IF EXISTS on_crew_member_commercials_updated ON internal.crew_member_commercials;
CREATE TRIGGER on_crew_member_commercials_updated BEFORE UPDATE ON internal.crew_member_commercials FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
REVOKE ALL ON FUNCTION internal.fn_faz6_cmc_org_check() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE internal.crew_member_commercials FROM PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5) Yetkiler (public varsayilanlari geri al; sutun bazli ver)
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.match_runs, public.match_candidates, public.crews, public.crew_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.match_runs, public.match_candidates, public.crews, public.crew_members TO authenticated;
GRANT INSERT (event_id, organization_id, name, strategy, source_policy, objective, status),
      UPDATE (name, strategy, source_policy, objective, status),
      DELETE ON TABLE public.crews TO authenticated;
GRANT INSERT (crew_id, role_id, talent_record_id, provider_id, status, is_locked, sort_order, note, match_candidate_id),
      UPDATE (status, is_locked, sort_order, note),
      DELETE ON TABLE public.crew_members TO authenticated;

-- -----------------------------------------------------------------------------
-- 6) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.match_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal.crew_member_commercials ENABLE ROW LEVEL SECURITY;   -- politika yok = kimse (RPC SECURITY DEFINER okur)

-- Ekip gorunurlugu: etkinlik sahibi VEYA ekibin kurulusunda ilgili yetki VEYA admin.
-- Satir sutunlariyla calisan surum (crews politikalari): INSERT ... RETURNING'de SELECT politikasi yeni satira uygulanir;
-- satiri id ile yeniden okuyan STABLE bir fonksiyon o satiri henuz goremez (ayni komut anlik goruntusu) -> yanlis red.
CREATE OR REPLACE FUNCTION public.can_access_crew_row(p_event_id uuid, p_org_id uuid, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND e.owner_user_id = auth.uid())
      OR (p_org_id IS NOT NULL AND public.has_org_permission(p_org_id, p_permission))
      OR public.is_admin(auth.uid());
$$;
-- Ekip id'siyle calisan surum (crew_members politikalari; ekip satiri onceki komutta var)
CREATE OR REPLACE FUNCTION public.can_access_crew(p_crew_id uuid, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.crews c WHERE c.id = p_crew_id
                   AND public.can_access_crew_row(c.event_id, c.organization_id, p_permission));
$$;
REVOKE ALL ON FUNCTION public.can_access_crew_row(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_crew(uuid, text)           FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_crew_row(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_crew(uuid, text)           TO authenticated, service_role;

DROP POLICY IF EXISTS match_runs_select ON public.match_runs;
CREATE POLICY match_runs_select ON public.match_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id
                   AND public.can_access_event_scope(e.owner_user_id, e.organization_id, 'events.view')));

DROP POLICY IF EXISTS match_candidates_select ON public.match_candidates;
CREATE POLICY match_candidates_select ON public.match_candidates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.match_runs r JOIN public.events e ON e.id = r.event_id
                  WHERE r.id = match_run_id
                    AND public.can_access_event_scope(e.owner_user_id, e.organization_id, 'events.view')));

DROP POLICY IF EXISTS crews_select ON public.crews;
CREATE POLICY crews_select ON public.crews FOR SELECT TO authenticated
  USING (public.can_access_crew_row(event_id, organization_id, 'crew.view'));
DROP POLICY IF EXISTS crews_insert ON public.crews;
CREATE POLICY crews_insert ON public.crews FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_user_id = auth.uid())
              AND (organization_id IS NULL OR public.has_org_permission(organization_id, 'crew.manage')));
DROP POLICY IF EXISTS crews_update ON public.crews;
CREATE POLICY crews_update ON public.crews FOR UPDATE TO authenticated
  USING (public.can_access_crew_row(event_id, organization_id, 'crew.manage'))
  WITH CHECK (public.can_access_crew_row(event_id, organization_id, 'crew.manage'));
DROP POLICY IF EXISTS crews_delete ON public.crews;
CREATE POLICY crews_delete ON public.crews FOR DELETE TO authenticated
  USING (public.can_access_crew_row(event_id, organization_id, 'crew.manage'));

DROP POLICY IF EXISTS crew_members_select ON public.crew_members;
CREATE POLICY crew_members_select ON public.crew_members FOR SELECT TO authenticated
  USING (public.can_access_crew(crew_id, 'crew.view'));
DROP POLICY IF EXISTS crew_members_insert ON public.crew_members;
CREATE POLICY crew_members_insert ON public.crew_members FOR INSERT TO authenticated
  WITH CHECK (public.can_access_crew(crew_id, 'crew.manage'));
DROP POLICY IF EXISTS crew_members_update ON public.crew_members;
CREATE POLICY crew_members_update ON public.crew_members FOR UPDATE TO authenticated
  USING (public.can_access_crew(crew_id, 'crew.manage')) WITH CHECK (public.can_access_crew(crew_id, 'crew.manage'));
DROP POLICY IF EXISTS crew_members_delete ON public.crew_members;
CREATE POLICY crew_members_delete ON public.crew_members FOR DELETE TO authenticated
  USING (public.can_access_crew(crew_id, 'crew.manage'));

-- -----------------------------------------------------------------------------
-- 7) Match V0.1 — run_event_match
-- -----------------------------------------------------------------------------
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
    'version', 'v0.1', 'strategy', p_strategy::text,
    'pro', jsonb_build_object('same_city', 40, 'date_available', 25, 'date_unknown', 10, 'budget_fit', 20, 'budget_unknown', 10, 'high_trust', 15, 'new_talent', 5),
    'org', jsonb_build_object('coverage', 60, 'same_city', 20, 'date_available', 10, 'date_unknown', 5, 'high_trust', 10),
    'required_weight', 3, 'optional_weight', 1, 'limit_per_role', lim_role, 'limit_orgs', lim_org,
    'trust_threshold', 70, 'rating_threshold', 4.5, 'min_reviews', 3);

  INSERT INTO public.match_runs (event_id, strategy, algorithm_version, params, created_by)
  VALUES (p_event_id, p_strategy, 'v0.1', v_params, auth.uid()) RETURNING id INTO run_id;

  -- 7a) Bireysel profesyoneller: rol basina
  IF p_strategy IN ('individual', 'hybrid') THEN
    WITH aday AS (
      SELECT p.id AS provider_id, r.role_id, p.trust_score, p.created_at,
             (ev.city_id IS NOT NULL AND p.city_id = ev.city_id)                                    AS same_city,
             (d_from IS NOT NULL)                                                                  AS date_known,
             CASE WHEN ps.price_min IS NULL AND ps.price_max IS NULL THEN NULL                      -- fiyat yok: belirsiz
                  WHEN COALESCE(r.budget_hint_min, ev.budget_min) IS NULL AND COALESCE(r.budget_hint_max, ev.budget_max) IS NULL THEN NULL
                  WHEN COALESCE(ps.price_min, 0) <= COALESCE(r.budget_hint_max, ev.budget_max, 1e12)
                   AND COALESCE(ps.price_max, 1e12) >= COALESCE(r.budget_hint_min, ev.budget_min, 0) THEN true
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

-- Gosterim / tik isaretleri (yalniz false -> true; etkinlik sahibi)
CREATE OR REPLACE FUNCTION public.mark_match_candidates_shown(p_run_id uuid, p_candidate_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'giris gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.match_runs r JOIN public.events e ON e.id = r.event_id
                  WHERE r.id = p_run_id AND e.owner_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'yetkisiz erisim' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.match_candidates SET was_shown = true
   WHERE match_run_id = p_run_id AND id = ANY(p_candidate_ids) AND NOT was_shown;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_match_candidate_clicked(p_candidate_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'giris gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.match_candidates c JOIN public.match_runs r ON r.id = c.match_run_id
                   JOIN public.events e ON e.id = r.event_id
                  WHERE c.id = p_candidate_id AND e.owner_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'yetkisiz erisim' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.match_candidates SET was_clicked = true, was_shown = true WHERE id = p_candidate_id;
  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8) Ic ticari goruntu RPC'leri (kurulus ekibi; commercial.view / commercial.manage)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crew_member_commercial_snapshot(p_crew_member_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE m record; v_org uuid; rt record;
BEGIN
  SELECT cm.id, cm.role_id, cm.talent_record_id, c.organization_id INTO m
    FROM public.crew_members cm JOIN public.crews c ON c.id = cm.crew_id WHERE cm.id = p_crew_member_id;
  IF m.id IS NULL THEN RAISE EXCEPTION 'ekip uyesi yok' USING ERRCODE = 'no_data_found'; END IF;
  v_org := m.organization_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'bireysel ekipte ic goruntu yok' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  PERFORM internal.assert_org_permission(v_org, 'commercial.manage', 'crew_member_commercials', m.id);
  IF m.talent_record_id IS NULL THEN
    RAISE EXCEPTION 'havuz kaydi olmayan uye icin varsayilan oran yok; elle gir' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT id, default_cost, cost_basis, currency INTO rt
    FROM internal.organization_talent_rates
   WHERE organization_id = v_org AND talent_record_id = m.talent_record_id AND role_id = m.role_id
     AND valid_from <= current_date AND (valid_to IS NULL OR valid_to >= current_date)
   ORDER BY valid_from DESC LIMIT 1;
  IF rt.id IS NULL THEN
    RAISE EXCEPTION 'bu rol icin acik ic oran yok; elle gir' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO internal.crew_member_commercials (crew_member_id, organization_id, agreed_cost, cost_basis, currency, rate_source, source_rate_id, created_by)
  VALUES (m.id, v_org, rt.default_cost, rt.cost_basis, rt.currency, 'default', rt.id, auth.uid())
  ON CONFLICT (crew_member_id) DO UPDATE
    SET agreed_cost = EXCLUDED.agreed_cost, cost_basis = EXCLUDED.cost_basis, currency = EXCLUDED.currency,
        rate_source = 'default', source_rate_id = EXCLUDED.source_rate_id, snapshot_at = now();
  PERFORM internal.log_access(v_org, 'write', 'crew_member_commercials', m.id, jsonb_build_object('op', 'crew.snapshot', 'rate_id', rt.id));
  RETURN m.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_crew_commercials_list(p_crew_id uuid)
RETURNS TABLE (crew_member_id uuid, role_id integer, agreed_cost numeric, cost_basis public.talent_cost_basis, currency char(3),
               client_price numeric, markup_amount numeric, margin_rate numeric, rate_source public.crew_rate_source,
               snapshot_at timestamptz, private_note text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.crews WHERE id = p_crew_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'bireysel ekipte ic goruntu yok' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  PERFORM internal.assert_org_permission(v_org, 'commercial.view', 'crew_member_commercials', p_crew_id);
  PERFORM internal.log_access(v_org, 'read', 'crew_member_commercials', p_crew_id, '{}'::jsonb);
  RETURN QUERY
    SELECT x.crew_member_id, m.role_id, x.agreed_cost, x.cost_basis, x.currency, x.client_price, x.markup_amount, x.margin_rate,
           x.rate_source, x.snapshot_at, x.private_note
      FROM internal.crew_member_commercials x JOIN public.crew_members m ON m.id = x.crew_member_id
     WHERE m.crew_id = p_crew_id AND x.organization_id = v_org
     ORDER BY m.sort_order, m.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_crew_commercial_upsert(
  p_crew_member_id uuid, p_agreed_cost numeric, p_basis text DEFAULT 'per_job', p_currency char(3) DEFAULT 'TRY',
  p_client_price numeric DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE v_org uuid; v_basis public.talent_cost_basis;
BEGIN
  SELECT c.organization_id INTO v_org FROM public.crew_members cm JOIN public.crews c ON c.id = cm.crew_id WHERE cm.id = p_crew_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ekip uyesi yok' USING ERRCODE = 'no_data_found'; END IF;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'bireysel ekipte ic goruntu yok' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  PERFORM internal.assert_org_permission(v_org, 'commercial.manage', 'crew_member_commercials', p_crew_member_id);
  IF p_agreed_cost IS NULL OR p_agreed_cost < 0 THEN
    RAISE EXCEPTION 'maliyet 0 veya daha buyuk olmali' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_client_price IS NOT NULL AND p_client_price < 0 THEN
    RAISE EXCEPTION 'musteri fiyati 0 veya daha buyuk olmali' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  BEGIN
    v_basis := COALESCE(p_basis, 'per_job')::public.talent_cost_basis;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'birim gecersiz (per_job, per_hour, per_day)' USING ERRCODE = 'invalid_parameter_value';
  END;
  INSERT INTO internal.crew_member_commercials (crew_member_id, organization_id, agreed_cost, cost_basis, currency, client_price, rate_source, private_note, created_by)
  VALUES (p_crew_member_id, v_org, p_agreed_cost, v_basis, COALESCE(p_currency, 'TRY'), p_client_price, 'manual_override', p_note, auth.uid())
  ON CONFLICT (crew_member_id) DO UPDATE
    SET agreed_cost = EXCLUDED.agreed_cost, cost_basis = EXCLUDED.cost_basis, currency = EXCLUDED.currency,
        client_price = EXCLUDED.client_price, rate_source = 'manual_override', source_rate_id = NULL,
        private_note = EXCLUDED.private_note, snapshot_at = now();
  PERFORM internal.log_access(v_org, 'write', 'crew_member_commercials', p_crew_member_id, jsonb_build_object('op', 'crew.override'));
  RETURN p_crew_member_id;
END;
$$;

-- RPC yetkileri: authenticated + service_role; anon yok
REVOKE ALL ON FUNCTION public.run_event_match(uuid, public.match_strategy)                                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_match_candidates_shown(uuid, uuid[])                                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_match_candidate_clicked(uuid)                                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crew_member_commercial_snapshot(uuid)                                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.internal_crew_commercials_list(uuid)                                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.internal_crew_commercial_upsert(uuid, numeric, text, char, numeric, text)    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_event_match(uuid, public.match_strategy)                             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_match_candidates_shown(uuid, uuid[])                                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_match_candidate_clicked(uuid)                                       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crew_member_commercial_snapshot(uuid)                                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.internal_crew_commercials_list(uuid)                                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.internal_crew_commercial_upsert(uuid, numeric, text, char, numeric, text) TO authenticated, service_role;

COMMIT;
