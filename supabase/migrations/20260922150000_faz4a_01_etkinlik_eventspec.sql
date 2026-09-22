-- =============================================================================
-- FAZ 4a / 01 — Etkinlik ve EventSpec semasi: event_types, event_briefs, event_spec_versions, events,
--                event_requirements + conversations.event_id
--
-- Kaynak: 01-veri-modeli.md bolum 4 (dort tablo: ham girdi / AI ciktisi surumlu / onaylanmis canonical / roller),
--         04-goc-plani.md FAZ 4 madde 23-26. Plan: docs/envanter/15-faz4a-etkinlik-eventspec.md
--
-- NE YAPAR (yalniz sema; VERI YAZMAZ — tek istisna event_types referans satirlari, uygulamadaki EVENT_TYPES ile ayni):
--   event_types            15 etkinlik turu (key = bugunku conversations/listings.event_type CHECK degerleri, name_tr =
--                          app/mesajlar/data.ts EVENT_TYPES etiketleri, group_key sosyal/kurumsal/diger). events.event_type
--                          buna FK; eski tablolarin text + CHECK sutunlari DEGISMEZ (FAZ 10).
--   event_briefs           ham girdi (metin + ekler), sahibi + istege bagli kurulus, kaynak (client_web / business_workspace /
--                          agency_eventos / api / legacy_import).
--   event_spec_versions    AI ciktisi, SURUMLU ve EKLE-YALNIZ: spec_jsonb + provenance + schema/parser/model/prompt surumleri;
--                          brief basina version_no artan, tam bir is_current (tetikleyici + kismi tekil indeks).
--   events                 onaylanmis canonical etkinlik (kolon = sorgulanan alanlar, extra jsonb = esnek alanlar); hangi
--                          spec surumunden onaylandigi (spec_version_id) tutulur.
--   event_requirements     etkinlik x rol (service_roles FK; JSONB icinde zorlanamayan "gecerli rol" kurali burada zorlanir).
--   conversations.event_id yeni akisin sohbete bagi (NULL olabilir; eski akis dokunulmaz).
--
-- YETKI (karar: satir sahipligi RLS + kurulus yetkisi): sahip (created_by_user_id / owner_user_id = auth.uid()) VEYA
--   organization_id icin has_org_permission(org, 'events.view' | 'events.manage'); admin okur; anon HIC; service_role tam.
--   event_spec_versions istemciden UPDATE/DELETE alamaz (ekle-yalniz); gecerli surumu degistirmek icin
--   set_current_event_spec(uuid) RPC'si. Ticari sir yok -> internal semaya girmez (FAZ 6-7'de internal.* ayrica).
--
-- Idempotan. Sapkali harf yok.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Enum'lar
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_brief_source') THEN
    CREATE TYPE public.event_brief_source AS ENUM ('client_web', 'business_workspace', 'agency_eventos', 'api', 'legacy_import');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_spec_validation_status') THEN
    CREATE TYPE public.event_spec_validation_status AS ENUM ('valid', 'invalid', 'needs_input');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_venue_status') THEN
    CREATE TYPE public.event_venue_status AS ENUM ('confirmed', 'searching', 'not_needed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_urgency') THEN
    CREATE TYPE public.event_urgency AS ENUM ('normal', 'urgent', 'flexible');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE public.event_status AS ENUM ('draft', 'confirmed', 'matching', 'booked', 'running', 'completed', 'cancelled');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) event_types (referans; uygulama EVENT_TYPES ile birebir — asama11 K1 olcer)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_types (
  key        text PRIMARY KEY,
  name_tr    text NOT NULL,
  group_key  text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_types_key_check   CHECK (key ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  CONSTRAINT event_types_group_check CHECK (group_key IN ('sosyal', 'kurumsal', 'diger'))
);
COMMENT ON TABLE public.event_types IS 'FAZ 4a: etkinlik turleri (app/mesajlar/data.ts EVENT_TYPES ile ayni anahtarlar). Yeni tur = satir; eski tablolarin CHECK listesi FAZ 10''da FK''ye doner.';

INSERT INTO public.event_types (key, name_tr, group_key, sort_order) VALUES
  ('wedding',      'Düğün',       'sosyal',   10),
  ('engagement',   'Nişan',       'sosyal',   20),
  ('henna',        'Kına gecesi', 'sosyal',   30),
  ('birthday',     'Doğum günü',  'sosyal',   40),
  ('baby_shower',  'Baby shower', 'sosyal',   50),
  ('graduation',   'Mezuniyet',   'sosyal',   60),
  ('circumcision', 'Sünnet',      'sosyal',   70),
  ('corporate',    'Kurumsal',    'kurumsal', 110),
  ('launch',       'Lansman',     'kurumsal', 120),
  ('fair',         'Fuar',        'kurumsal', 130),
  ('conference',   'Konferans',   'kurumsal', 140),
  ('congress',     'Kongre',      'kurumsal', 150),
  ('gala',         'Gala',        'kurumsal', 160),
  ('concert',      'Konser',      'kurumsal', 170),
  ('other',        'Diğer',       'diger',    900)
ON CONFLICT (key) DO NOTHING;
-- name_tr gosterim metnidir (Turkce harf serbest; 03 bolum 6 yasak-karakter kurali yalniz key icin — 3a dersi).

-- -----------------------------------------------------------------------------
-- 3) event_briefs — ham girdi
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_briefs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id    uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  source             public.event_brief_source NOT NULL,
  raw_text           text NOT NULL,
  attachments        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_briefs_raw_text_check    CHECK (char_length(raw_text) BETWEEN 1 AND 20000),
  CONSTRAINT event_briefs_attachments_check CHECK (jsonb_typeof(attachments) = 'array')
);
CREATE INDEX IF NOT EXISTS event_briefs_user_idx ON public.event_briefs (created_by_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_briefs_org_idx  ON public.event_briefs (organization_id) WHERE organization_id IS NOT NULL;
COMMENT ON TABLE public.event_briefs IS 'FAZ 4a: etkinlik ham girdisi (dogal dil + ekler). AI ciktisi event_spec_versions''ta.';

DROP TRIGGER IF EXISTS on_event_briefs_updated ON public.event_briefs;
CREATE TRIGGER on_event_briefs_updated BEFORE UPDATE ON public.event_briefs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 4) event_spec_versions — AI ciktisi, surumlu, ekle-yalniz
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_spec_versions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id           uuid NOT NULL REFERENCES public.event_briefs(id) ON DELETE CASCADE,
  version_no         integer NOT NULL,
  spec_jsonb         jsonb NOT NULL,
  provenance         jsonb NOT NULL DEFAULT '{}'::jsonb,
  schema_version     text NOT NULL,
  parser_version     text NOT NULL,
  model_id           text,
  prompt_version     text,
  validation_status  public.event_spec_validation_status NOT NULL DEFAULT 'needs_input',
  is_current         boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_spec_versions_brief_version_key UNIQUE (brief_id, version_no),
  CONSTRAINT event_spec_versions_version_no_check  CHECK (version_no >= 1),
  CONSTRAINT event_spec_versions_spec_check        CHECK (jsonb_typeof(spec_jsonb) = 'object'),
  CONSTRAINT event_spec_versions_provenance_check  CHECK (jsonb_typeof(provenance) = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS event_spec_versions_one_current_idx
  ON public.event_spec_versions (brief_id) WHERE is_current;
COMMENT ON TABLE public.event_spec_versions IS 'FAZ 4a: EventSpec surumleri (AI ciktisi + provenance). Ekle-yalniz; brief basina tam bir is_current. schema_version = EventSpec sozlesmesi, parser_version = cikarim hatti (algorithm_version burada DEGIL — 01 bolum 4).';

-- Surum numarasi otomatik (verilmezse max+1) ve yeni surum gecerli olunca eskiler dusurulur
CREATE OR REPLACE FUNCTION public.fn_event_spec_version_before_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.version_no IS NULL THEN
    SELECT COALESCE(max(version_no), 0) + 1 INTO NEW.version_no
      FROM public.event_spec_versions WHERE brief_id = NEW.brief_id;
  END IF;
  IF NEW.created_by_user_id IS NULL THEN
    NEW.created_by_user_id := auth.uid();
  END IF;
  IF NEW.is_current THEN
    UPDATE public.event_spec_versions
       SET is_current = false
     WHERE brief_id = NEW.brief_id AND is_current;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_event_spec_version_before_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_faz4_event_spec_version_before_insert ON public.event_spec_versions;
CREATE TRIGGER trg_faz4_event_spec_version_before_insert
  BEFORE INSERT ON public.event_spec_versions
  FOR EACH ROW EXECUTE FUNCTION public.fn_event_spec_version_before_insert();

-- Gecerli surumu degistirme (tek yol; istemci UPDATE alamaz). Sahiplik: brief sahibi veya kurulus events.manage.
CREATE OR REPLACE FUNCTION public.set_current_event_spec(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brief uuid;
  v_owner uuid;
  v_org   uuid;
BEGIN
  SELECT v.brief_id, b.created_by_user_id, b.organization_id
    INTO v_brief, v_owner, v_org
    FROM public.event_spec_versions v JOIN public.event_briefs b ON b.id = v.brief_id
   WHERE v.id = p_version_id;
  IF v_brief IS NULL THEN
    RAISE EXCEPTION 'surum bulunamadi' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (v_owner = auth.uid()
          OR (v_org IS NOT NULL AND public.has_org_permission(v_org, 'events.manage'))
          OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'yetkisiz erisim' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.event_spec_versions SET is_current = false WHERE brief_id = v_brief AND is_current AND id <> p_version_id;
  UPDATE public.event_spec_versions SET is_current = true  WHERE id = p_version_id AND NOT is_current;
END;
$$;
REVOKE ALL ON FUNCTION public.set_current_event_spec(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_current_event_spec(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5) events — onaylanmis canonical
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id          uuid REFERENCES public.event_briefs(id) ON DELETE SET NULL,
  spec_version_id   uuid REFERENCES public.event_spec_versions(id) ON DELETE SET NULL,
  organization_id   uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  owner_user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title             text,
  event_type        text NOT NULL REFERENCES public.event_types(key) ON UPDATE CASCADE,
  start_date        date,
  end_date          date,
  start_time        time,
  end_time          time,
  is_date_flexible  boolean NOT NULL DEFAULT false,
  city_id           integer REFERENCES public.turkish_cities(id) ON DELETE SET NULL,
  district          text,
  venue_status      public.event_venue_status NOT NULL DEFAULT 'searching',
  participant_count integer,
  budget_min        numeric,
  budget_max        numeric,
  currency          char(3) NOT NULL DEFAULT 'TRY',
  urgency           public.event_urgency NOT NULL DEFAULT 'normal',
  extra             jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            public.event_status NOT NULL DEFAULT 'draft',
  confirmed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_title_check       CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT events_dates_check       CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date),
  CONSTRAINT events_participant_check CHECK (participant_count IS NULL OR participant_count BETWEEN 0 AND 1000000),
  CONSTRAINT events_budget_check      CHECK ((budget_min IS NULL OR budget_min >= 0) AND (budget_max IS NULL OR budget_max >= 0)
                                             AND (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max)),
  CONSTRAINT events_currency_check    CHECK (currency = 'TRY'),
  CONSTRAINT events_extra_check       CHECK (jsonb_typeof(extra) = 'object')
);
CREATE INDEX IF NOT EXISTS events_owner_idx  ON public.events (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_org_idx    ON public.events (organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_status_idx ON public.events (status, start_date);
CREATE INDEX IF NOT EXISTS events_brief_idx  ON public.events (brief_id) WHERE brief_id IS NOT NULL;
COMMENT ON TABLE public.events IS 'FAZ 4a: onaylanmis canonical etkinlik. Sorgulanan alanlar sutun, esnek alanlar extra (jsonb). Eslestirme/ekip/teklif tablolari (FAZ 5-7) buna baglanir.';

DROP TRIGGER IF EXISTS on_events_updated ON public.events;
CREATE TRIGGER on_events_updated BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 6) event_requirements — roller (service_roles FK)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_requirements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  role_id         integer NOT NULL REFERENCES public.service_roles(id) ON DELETE RESTRICT,
  quantity        integer NOT NULL DEFAULT 1,
  is_required     boolean NOT NULL DEFAULT true,
  budget_hint_min numeric,
  budget_hint_max numeric,
  duration_hours  numeric,
  notes           text,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_requirements_event_role_key UNIQUE (event_id, role_id),
  CONSTRAINT event_requirements_quantity_check CHECK (quantity BETWEEN 1 AND 1000),
  CONSTRAINT event_requirements_budget_check   CHECK ((budget_hint_min IS NULL OR budget_hint_min >= 0) AND (budget_hint_max IS NULL OR budget_hint_max >= 0)
                                                      AND (budget_hint_min IS NULL OR budget_hint_max IS NULL OR budget_hint_min <= budget_hint_max)),
  CONSTRAINT event_requirements_duration_check CHECK (duration_hours IS NULL OR (duration_hours > 0 AND duration_hours <= 720)),
  CONSTRAINT event_requirements_notes_check    CHECK (notes IS NULL OR char_length(notes) <= 2000)
);
CREATE INDEX IF NOT EXISTS event_requirements_role_idx ON public.event_requirements (role_id);
COMMENT ON TABLE public.event_requirements IS 'FAZ 4a: etkinligin ihtiyac duydugu roller (normalize). Coverage agirligi: is_required 3.0 / 1.0 (01 bolum 5).';

DROP TRIGGER IF EXISTS on_event_requirements_updated ON public.event_requirements;
CREATE TRIGGER on_event_requirements_updated BEFORE UPDATE ON public.event_requirements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 7) conversations.event_id (yeni akisin sohbete bagi; eski akis dokunulmaz)
-- -----------------------------------------------------------------------------
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS conversations_event_id_idx ON public.conversations (event_id) WHERE event_id IS NOT NULL;
COMMENT ON COLUMN public.conversations.event_id IS 'FAZ 4a: sohbetin bagli oldugu onaylanmis etkinlik (yeni akis). Eski akista NULL.';

-- -----------------------------------------------------------------------------
-- 8) Yetki: sahiplik yardimcisi + GRANT + RLS
-- -----------------------------------------------------------------------------
-- Brief/etkinlik uzerinde okuma veya yazma hakki: sahip, kurulus yetkisi (view/manage) veya admin
CREATE OR REPLACE FUNCTION public.can_access_event_scope(p_owner uuid, p_org uuid, p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_owner = auth.uid()
      OR (p_org IS NOT NULL AND public.has_org_permission(p_org, p_permission))
      OR public.is_admin(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.can_access_event_scope(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_event_scope(uuid, uuid, text) TO authenticated, service_role;

REVOKE ALL ON public.event_types, public.event_briefs, public.event_spec_versions, public.events, public.event_requirements
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_types TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_briefs        TO authenticated;
GRANT SELECT, INSERT                 ON public.event_spec_versions TO authenticated;   -- ekle-yalniz
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_requirements  TO authenticated;
GRANT ALL ON public.event_types, public.event_briefs, public.event_spec_versions, public.events, public.event_requirements
  TO service_role;

ALTER TABLE public.event_types         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_briefs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_spec_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_requirements  ENABLE ROW LEVEL SECURITY;

-- event_types: herkes okur; istemci yazamaz (grant yok) — yeni tur migration ile gelir (admin paneli karari 4c)
DROP POLICY IF EXISTS event_types_read_all ON public.event_types;
CREATE POLICY event_types_read_all ON public.event_types FOR SELECT USING (true);

-- event_briefs
DROP POLICY IF EXISTS event_briefs_select ON public.event_briefs;
CREATE POLICY event_briefs_select ON public.event_briefs FOR SELECT TO authenticated
  USING (public.can_access_event_scope(created_by_user_id, organization_id, 'events.view'));
DROP POLICY IF EXISTS event_briefs_insert ON public.event_briefs;
CREATE POLICY event_briefs_insert ON public.event_briefs FOR INSERT TO authenticated
  WITH CHECK (created_by_user_id = auth.uid()
              AND (organization_id IS NULL OR public.has_org_permission(organization_id, 'events.manage')));
DROP POLICY IF EXISTS event_briefs_update ON public.event_briefs;
CREATE POLICY event_briefs_update ON public.event_briefs FOR UPDATE TO authenticated
  USING (public.can_access_event_scope(created_by_user_id, organization_id, 'events.manage'))
  WITH CHECK (public.can_access_event_scope(created_by_user_id, organization_id, 'events.manage'));
DROP POLICY IF EXISTS event_briefs_delete ON public.event_briefs;
CREATE POLICY event_briefs_delete ON public.event_briefs FOR DELETE TO authenticated
  USING (created_by_user_id = auth.uid());

-- event_spec_versions: brief sahipligi uzerinden; UPDATE/DELETE politikasi YOK (ekle-yalniz)
DROP POLICY IF EXISTS event_spec_versions_select ON public.event_spec_versions;
CREATE POLICY event_spec_versions_select ON public.event_spec_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.event_briefs b WHERE b.id = event_spec_versions.brief_id
                    AND public.can_access_event_scope(b.created_by_user_id, b.organization_id, 'events.view')));
DROP POLICY IF EXISTS event_spec_versions_insert ON public.event_spec_versions;
CREATE POLICY event_spec_versions_insert ON public.event_spec_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.event_briefs b WHERE b.id = event_spec_versions.brief_id
                         AND public.can_access_event_scope(b.created_by_user_id, b.organization_id, 'events.manage')));

-- events
DROP POLICY IF EXISTS events_select ON public.events;
CREATE POLICY events_select ON public.events FOR SELECT TO authenticated
  USING (public.can_access_event_scope(owner_user_id, organization_id, 'events.view'));
DROP POLICY IF EXISTS events_insert ON public.events;
CREATE POLICY events_insert ON public.events FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid()
              AND (organization_id IS NULL OR public.has_org_permission(organization_id, 'events.manage')));
DROP POLICY IF EXISTS events_update ON public.events;
CREATE POLICY events_update ON public.events FOR UPDATE TO authenticated
  USING (public.can_access_event_scope(owner_user_id, organization_id, 'events.manage'))
  WITH CHECK (public.can_access_event_scope(owner_user_id, organization_id, 'events.manage'));
DROP POLICY IF EXISTS events_delete ON public.events;
CREATE POLICY events_delete ON public.events FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

-- event_requirements: etkinlik sahipligi uzerinden (view okur, manage yazar)
DROP POLICY IF EXISTS event_requirements_select ON public.event_requirements;
CREATE POLICY event_requirements_select ON public.event_requirements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_requirements.event_id
                    AND public.can_access_event_scope(e.owner_user_id, e.organization_id, 'events.view')));
DROP POLICY IF EXISTS event_requirements_write ON public.event_requirements;
CREATE POLICY event_requirements_write ON public.event_requirements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_requirements.event_id
                    AND public.can_access_event_scope(e.owner_user_id, e.organization_id, 'events.manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_requirements.event_id
                         AND public.can_access_event_scope(e.owner_user_id, e.organization_id, 'events.manage')));

COMMIT;
