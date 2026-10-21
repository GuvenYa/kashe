-- =============================================================================
-- FAZ 8b / DB 01 — CRM: kisiler (contacts) + firsatlar (crm_leads)
-- Kaynak: docs/envanter/20-faz8-event-os-modulleri.md bolum 4; kararlar (Guven, 21 Ekim 2026):
--   5 asama (new, contacted, proposal_sent, won, lost); yeni yetki anahtarlari crm.view / crm.manage;
--   modul 'crm' yalniz ajansta, varsayilan ACIK (business'ta kapali; sahip org_module_set ile acabilir).
--
-- Nesneler:
--   enum crm_lead_stage      (new, contacted, proposal_sent, won, lost)
--   org_role_permissions     + 'crm.view' / 'crm.manage' (owner, admin, sales: ikisi; project_manager, finance: view;
--                            crew_coordinator, viewer: yok) — permissions jsonb ince ayari ayni mekanizmayla calisir
--   contacts                 — kurulusun kisi/firma kaydi; e-posta/telefon KURULUS ICI (RLS crm.view; baska kurulus okuyamaz);
--                            e-posta kurulus icinde tekil (lower); istege bagli Kashe kullanicisi / kurulus baglantisi
--   crm_leads                — firsat: kisi, baslik, asama, tahmini deger, beklenen tarih, sahip (uye), sonraki adim,
--                            etkinlik / teklif bagi (ayni kurulus); won_at / lost_at asamayla
--   proposals.buyer_contact_id — FAZ 7a'da ayrilmisti ("FK sonra"): FK contacts (SET NULL) + ayni kurulus kurali;
--                            firsat teklife baglaninca teklifin bos buyer_contact_id'si kisiyle dolar
--   crm_contact_suggestions  — gorunum (security_invoker): seller kurulusun teklifindeki client_email'e karsilik kisi yoksa
--                            oneri satiri ("kisi olarak ekle"); proposals RLS'i gecerli
--   tetikleyiciler           — modul kapisi (crm kapaliysa INSERT 22023), kurulus sabit, kisi/etkinlik/teklif/sahip ayni kurulus,
--                            e-posta normalizasyonu, won_at/lost_at, updated_at, aktivite (entity_type contact/lead) + bildirim
--                            (sahibe atama -> notifications tip 'crm')
--   RLS                      — SELECT crm.view (admin dahil), INSERT/UPDATE/DELETE crm.manage; dogrudan CRUD (RPC yok)
--   activity_logs            — entity_type CHECK + 'contact', 'lead'
--   notifications            — type CHECK + 'crm'; e-posta kuyrugu indeksi 'crm' dahil
-- Idempotan (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS). Sapkali harf yok; yorumlar ASCII;
-- kullaniciya giden metinler Turkce karakterli.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Enum
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                  WHERE n.nspname = 'public' AND t.typname = 'crm_lead_stage') THEN
    CREATE TYPE public.crm_lead_stage AS ENUM ('new', 'contacted', 'proposal_sent', 'won', 'lost');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Yetki anahtarlari: crm.view / crm.manage (FAZ 0 matrisi genisler; diger anahtarlar AYNEN)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_role_permissions(p_role public.organization_member_role)
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'owner' THEN ARRAY[
      'events.view','events.manage','crew.view','crew.manage','talent.view','talent.manage',
      'commercial.view','commercial.manage','proposals.view','proposals.manage',
      'finance.view','finance.manage','settings.manage','members.manage','billing.manage',
      'crm.view','crm.manage']
    WHEN 'admin' THEN ARRAY[
      'events.view','events.manage','crew.view','crew.manage','talent.view','talent.manage',
      'commercial.view','commercial.manage','proposals.view','proposals.manage',
      'finance.view','finance.manage','settings.manage','members.manage',
      'crm.view','crm.manage']
    WHEN 'sales' THEN ARRAY[
      'events.view','events.manage','crew.view','talent.view','proposals.view','proposals.manage',
      'crm.view','crm.manage']
    WHEN 'project_manager' THEN ARRAY[
      'events.view','events.manage','crew.view','crew.manage','talent.view','talent.manage','proposals.view',
      'crm.view']
    WHEN 'crew_coordinator' THEN ARRAY[
      'events.view','crew.view','crew.manage','talent.view','talent.manage']
    WHEN 'finance' THEN ARRAY[
      'events.view','crew.view','talent.view','commercial.view','commercial.manage',
      'proposals.view','finance.view','finance.manage',
      'crm.view']
    WHEN 'viewer' THEN ARRAY['events.view','crew.view']
    ELSE ARRAY[]::text[]
  END
$$;

-- -----------------------------------------------------------------------------
-- 3. contacts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contacts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind                   text NOT NULL DEFAULT 'person',
  full_name              text NOT NULL,
  company_name           text,
  email                  text,
  phone                  text,
  notes                  text,
  linked_user_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  linked_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contacts_kind_check         CHECK (kind IN ('person', 'company')),
  CONSTRAINT contacts_full_name_check    CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 200),
  CONSTRAINT contacts_company_name_check CHECK (company_name IS NULL OR char_length(company_name) <= 200),
  CONSTRAINT contacts_email_check        CHECK (email IS NULL OR (char_length(email) <= 254 AND email LIKE '%@%')),
  CONSTRAINT contacts_phone_check        CHECK (phone IS NULL OR char_length(phone) <= 40),
  CONSTRAINT contacts_notes_check        CHECK (notes IS NULL OR char_length(notes) <= 4000)
);
COMMENT ON TABLE public.contacts IS
  'FAZ 8b: kurulusun kisi/firma kaydi (CRM). E-posta/telefon kurulus ici; baska kurulus okuyamaz (RLS crm.view). E-posta kurulus icinde tekil. Yazma dogrudan (RLS crm.manage), kurallar tetikleyicide.';

CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_email_uidx ON public.contacts (organization_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_org_name_idx       ON public.contacts (organization_id, lower(full_name));
CREATE INDEX IF NOT EXISTS contacts_linked_user_idx    ON public.contacts (linked_user_id) WHERE linked_user_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. crm_leads
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id       uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  title            text NOT NULL,
  stage            public.crm_lead_stage NOT NULL DEFAULT 'new',
  estimated_value  numeric(12,2),
  currency         text NOT NULL DEFAULT 'TRY',
  expected_date    date,
  owner_user_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  next_step        text,
  next_step_at     timestamptz,
  event_id         uuid REFERENCES public.events(id) ON DELETE SET NULL,
  proposal_id      uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  lost_reason      text,
  won_at           timestamptz,
  lost_at          timestamptz,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_leads_title_check       CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
  CONSTRAINT crm_leads_value_check       CHECK (estimated_value IS NULL OR estimated_value >= 0),
  CONSTRAINT crm_leads_currency_check    CHECK (currency = 'TRY'),
  CONSTRAINT crm_leads_next_step_check   CHECK (next_step IS NULL OR char_length(next_step) <= 500),
  CONSTRAINT crm_leads_lost_reason_check CHECK (lost_reason IS NULL OR char_length(lost_reason) <= 500)
);
COMMENT ON TABLE public.crm_leads IS
  'FAZ 8b: firsat. Kisiye bagli; asama new/contacted/proposal_sent/won/lost; sahip kurulus uyesi; etkinlik/teklif bagi ayni kurulus. won_at/lost_at asamayla dolar.';

CREATE INDEX IF NOT EXISTS crm_leads_org_stage_idx   ON public.crm_leads (organization_id, stage);
CREATE INDEX IF NOT EXISTS crm_leads_contact_idx     ON public.crm_leads (contact_id);
CREATE INDEX IF NOT EXISTS crm_leads_owner_open_idx  ON public.crm_leads (owner_user_id)
  WHERE owner_user_id IS NOT NULL AND stage NOT IN ('won', 'lost');
CREATE INDEX IF NOT EXISTS crm_leads_next_step_idx   ON public.crm_leads (organization_id, next_step_at) WHERE next_step_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_leads_proposal_idx    ON public.crm_leads (proposal_id) WHERE proposal_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. proposals.buyer_contact_id — FK (FAZ 7a'da ayrilan sutun) + sutun yazma izni
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposals_buyer_contact_id_fkey') THEN
    ALTER TABLE public.proposals
      ADD CONSTRAINT proposals_buyer_contact_id_fkey FOREIGN KEY (buyer_contact_id)
      REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS proposals_buyer_contact_idx ON public.proposals (buyer_contact_id) WHERE buyer_contact_id IS NOT NULL;
GRANT UPDATE (buyer_contact_id) ON TABLE public.proposals TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Tetikleyiciler — kurallar
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz8b_contact_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.org_module_enabled(NEW.organization_id, 'crm') THEN
      RAISE EXCEPTION 'crm modulu bu kurulusta kapali' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  ELSE
    IF NEW.organization_id <> OLD.organization_id THEN
      RAISE EXCEPTION 'kisinin kurulusu degistirilemez' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;
  -- normalizasyon: e-posta kucuk harf + kirpilmis; bos metinler NULL
  NEW.full_name    := btrim(NEW.full_name);
  NEW.email        := NULLIF(lower(btrim(COALESCE(NEW.email, ''))), '');
  NEW.phone        := NULLIF(btrim(COALESCE(NEW.phone, '')), '');
  NEW.company_name := NULLIF(btrim(COALESCE(NEW.company_name, '')), '');
  -- kendi kurulusu kendi musterisi olamaz
  IF NEW.linked_organization_id IS NOT NULL AND NEW.linked_organization_id = NEW.organization_id THEN
    RAISE EXCEPTION 'kisi kendi kurulusuna baglanamaz' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz8b_lead_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_org uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.org_module_enabled(NEW.organization_id, 'crm') THEN
      RAISE EXCEPTION 'crm modulu bu kurulusta kapali' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  ELSE
    IF NEW.organization_id <> OLD.organization_id THEN
      RAISE EXCEPTION 'firsatin kurulusu degistirilemez' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;
  NEW.title := btrim(NEW.title);
  -- kisi ayni kurulusun olmali
  SELECT organization_id INTO v_org FROM public.contacts WHERE id = NEW.contact_id;
  IF v_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'kisi bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- etkinlik ayni kurulusun olmali
  IF NEW.event_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.events WHERE id = NEW.event_id;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'etkinlik bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;
  -- teklif: satici bu kurulus olmali
  IF NEW.proposal_id IS NOT NULL THEN
    SELECT seller_organization_id INTO v_org FROM public.proposals WHERE id = NEW.proposal_id;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'teklif bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;
  -- sahip: kurulusun aktif uyesi
  IF NEW.owner_user_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.organization_memberships om
        WHERE om.organization_id = NEW.organization_id AND om.user_id = NEW.owner_user_id AND om.status = 'active') THEN
    RAISE EXCEPTION 'sahip kurulusun aktif uyesi degil' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- won_at / lost_at asamayla
  IF NEW.stage = 'won' THEN
    IF TG_OP = 'INSERT' OR OLD.stage <> 'won' OR NEW.won_at IS NULL THEN NEW.won_at := COALESCE(NEW.won_at, now()); END IF;
    NEW.lost_at := NULL;
  ELSIF NEW.stage = 'lost' THEN
    IF TG_OP = 'INSERT' OR OLD.stage <> 'lost' OR NEW.lost_at IS NULL THEN NEW.lost_at := COALESCE(NEW.lost_at, now()); END IF;
    NEW.won_at := NULL;
  ELSE
    NEW.won_at := NULL;
    NEW.lost_at := NULL;
    NEW.lost_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- proposals.buyer_contact_id ayni kurulus kurali (satici kurulus = kisinin kurulusu)
CREATE OR REPLACE FUNCTION public.fn_faz8b_proposal_contact_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.buyer_contact_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.buyer_contact_id IS DISTINCT FROM OLD.buyer_contact_id) THEN
    SELECT organization_id INTO v_org FROM public.contacts WHERE id = NEW.buyer_contact_id;
    IF v_org IS DISTINCT FROM NEW.seller_organization_id THEN
      RAISE EXCEPTION 'kisi teklifin satici kurulusuna ait degil' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Tetikleyiciler — aktivite + bildirim + teklif bagi
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz8b_contact_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_action text;
  v_diff jsonb := '{}'::jsonb;
  v_row public.contacts;
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_diff := jsonb_build_object('full_name', NEW.full_name, 'kind', NEW.kind, 'company_name', NEW.company_name);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_diff := jsonb_build_object('full_name', OLD.full_name);
  ELSE
    -- PII (e-posta/telefon) diff'e YAZILMAZ: yalniz "degisti" isareti
    IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
      v_diff := v_diff || jsonb_build_object('full_name', jsonb_build_object('from', OLD.full_name, 'to', NEW.full_name)); END IF;
    IF NEW.company_name IS DISTINCT FROM OLD.company_name THEN
      v_diff := v_diff || jsonb_build_object('company_name', jsonb_build_object('from', OLD.company_name, 'to', NEW.company_name)); END IF;
    IF NEW.kind IS DISTINCT FROM OLD.kind THEN
      v_diff := v_diff || jsonb_build_object('kind', jsonb_build_object('from', OLD.kind, 'to', NEW.kind)); END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN v_diff := v_diff || jsonb_build_object('email', true); END IF;
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN v_diff := v_diff || jsonb_build_object('phone', true); END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN v_diff := v_diff || jsonb_build_object('notes', true); END IF;
    IF NEW.linked_user_id IS DISTINCT FROM OLD.linked_user_id
       OR NEW.linked_organization_id IS DISTINCT FROM OLD.linked_organization_id THEN
      v_diff := v_diff || jsonb_build_object('linked', true); END IF;
    IF v_diff = '{}'::jsonb THEN RETURN NEW; END IF;
    v_action := 'updated';
  END IF;
  INSERT INTO public.activity_logs (organization_id, actor_user_id, entity_type, entity_id, action, diff)
  VALUES (v_row.organization_id, v_actor, 'contact', v_row.id, v_action, v_diff);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz8b_lead_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_action text;
  v_diff jsonb := '{}'::jsonb;
  v_link text;
  v_row public.crm_leads;
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_link := '/ajans/musteriler?firsat=' || v_row.id::text;

  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_diff := jsonb_build_object('title', NEW.title, 'stage', NEW.stage, 'contact_id', NEW.contact_id,
                                 'owner_user_id', NEW.owner_user_id, 'estimated_value', NEW.estimated_value,
                                 'expected_date', NEW.expected_date);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_diff := jsonb_build_object('title', OLD.title, 'stage', OLD.stage);
  ELSE
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN
      v_action := 'status_changed';
      v_diff := v_diff || jsonb_build_object('stage', jsonb_build_object('from', OLD.stage, 'to', NEW.stage));
      IF NEW.stage = 'lost' AND NEW.lost_reason IS NOT NULL THEN
        v_diff := v_diff || jsonb_build_object('lost_reason', NEW.lost_reason); END IF;
    END IF;
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      v_action := COALESCE(v_action, 'assigned');
      v_diff := v_diff || jsonb_build_object('owner_user_id', jsonb_build_object('from', OLD.owner_user_id, 'to', NEW.owner_user_id));
    END IF;
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      v_diff := v_diff || jsonb_build_object('title', jsonb_build_object('from', OLD.title, 'to', NEW.title)); END IF;
    IF NEW.estimated_value IS DISTINCT FROM OLD.estimated_value THEN
      v_diff := v_diff || jsonb_build_object('estimated_value', jsonb_build_object('from', OLD.estimated_value, 'to', NEW.estimated_value)); END IF;
    IF NEW.expected_date IS DISTINCT FROM OLD.expected_date THEN
      v_diff := v_diff || jsonb_build_object('expected_date', jsonb_build_object('from', OLD.expected_date, 'to', NEW.expected_date)); END IF;
    IF NEW.next_step IS DISTINCT FROM OLD.next_step OR NEW.next_step_at IS DISTINCT FROM OLD.next_step_at THEN
      v_diff := v_diff || jsonb_build_object('next_step', jsonb_build_object('to', NEW.next_step, 'at', NEW.next_step_at)); END IF;
    IF NEW.contact_id IS DISTINCT FROM OLD.contact_id THEN
      v_diff := v_diff || jsonb_build_object('contact_id', jsonb_build_object('from', OLD.contact_id, 'to', NEW.contact_id)); END IF;
    IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
      v_diff := v_diff || jsonb_build_object('event_id', jsonb_build_object('from', OLD.event_id, 'to', NEW.event_id)); END IF;
    IF NEW.proposal_id IS DISTINCT FROM OLD.proposal_id THEN
      v_diff := v_diff || jsonb_build_object('proposal_id', jsonb_build_object('from', OLD.proposal_id, 'to', NEW.proposal_id)); END IF;
    IF v_diff = '{}'::jsonb THEN RETURN NEW; END IF;
    v_action := COALESCE(v_action, 'updated');
  END IF;

  INSERT INTO public.activity_logs (organization_id, actor_user_id, entity_type, entity_id, action, diff)
  VALUES (v_row.organization_id, v_actor, 'lead', v_row.id, v_action, v_diff);

  -- bildirim: sahibe atama (kendine atama haric)
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.owner_user_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id)
     AND NEW.owner_user_id IS DISTINCT FROM v_actor THEN
    INSERT INTO public.notifications (user_id, type, link, body)
    VALUES (NEW.owner_user_id, 'crm', v_link, 'Sana fırsat atandı: ' || NEW.title);
  END IF;

  -- teklif bagi: teklifin bos buyer_contact_id'si firsatin kisisiyle dolar (ayni kurulus dogrulandi)
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.proposal_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.proposal_id IS DISTINCT FROM OLD.proposal_id) THEN
    UPDATE public.proposals SET buyer_contact_id = NEW.contact_id
     WHERE id = NEW.proposal_id AND buyer_contact_id IS NULL;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_faz8b_contact_validate ON public.contacts;
CREATE TRIGGER trg_faz8b_contact_validate
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8b_contact_validate();
DROP TRIGGER IF EXISTS trg_faz8b_contact_activity ON public.contacts;
CREATE TRIGGER trg_faz8b_contact_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8b_contact_activity();

DROP TRIGGER IF EXISTS trg_faz8b_lead_validate ON public.crm_leads;
CREATE TRIGGER trg_faz8b_lead_validate
  BEFORE INSERT OR UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8b_lead_validate();
DROP TRIGGER IF EXISTS trg_faz8b_lead_activity ON public.crm_leads;
CREATE TRIGGER trg_faz8b_lead_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8b_lead_activity();

DROP TRIGGER IF EXISTS trg_faz8b_proposal_contact_validate ON public.proposals;
CREATE TRIGGER trg_faz8b_proposal_contact_validate
  BEFORE INSERT OR UPDATE OF buyer_contact_id ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8b_proposal_contact_validate();

-- -----------------------------------------------------------------------------
-- 8. activity_logs entity_type + notifications tip 'crm' + e-posta kuyrugu
-- -----------------------------------------------------------------------------
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_entity_type_check;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_entity_type_check
  CHECK (entity_type IN ('task', 'event', 'proposal', 'rfp', 'booking', 'membership', 'crew', 'contact', 'lead'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('message', 'review', 'review_reply', 'listing_invitation', 'booking_request', 'rfp', 'proposal', 'task', 'crm'));

DROP INDEX IF EXISTS public.notifications_email_pending_idx;
CREATE INDEX notifications_email_pending_idx ON public.notifications (created_at)
  WHERE email_notified_at IS NULL AND type IN ('rfp', 'proposal', 'task', 'crm');

-- -----------------------------------------------------------------------------
-- 9. Oneri gorunumu: teklif musterisi -> kisi (security_invoker; proposals RLS gecerli)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.crm_contact_suggestions
WITH (security_invoker = true) AS
SELECT p.seller_organization_id AS organization_id,
       p.id                     AS proposal_id,
       p.title                  AS proposal_title,
       p.client_name,
       lower(btrim(p.client_email)) AS client_email,
       p.created_at
  FROM public.proposals p
 WHERE p.client_email IS NOT NULL
   AND btrim(p.client_email) <> ''
   AND p.buyer_contact_id IS NULL
   AND NOT EXISTS (
         SELECT 1 FROM public.contacts c
          WHERE c.organization_id = p.seller_organization_id
            AND c.email = lower(btrim(p.client_email)));
COMMENT ON VIEW public.crm_contact_suggestions IS
  'FAZ 8b: satici kurulusun teklifinde e-postasi olan ama kisi kaydi olmayan musteriler ("kisi olarak ekle" onerisi). security_invoker: proposals/contacts RLS gecerli.';
REVOKE ALL ON public.crm_contact_suggestions FROM PUBLIC, anon;
GRANT SELECT ON public.crm_contact_suggestions TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10. RLS + yetki
-- -----------------------------------------------------------------------------
ALTER TABLE public.contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contacts_select ON public.contacts;
CREATE POLICY contacts_select ON public.contacts FOR SELECT TO authenticated
  USING (public.has_org_permission(organization_id, 'crm.view') OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS contacts_insert ON public.contacts;
CREATE POLICY contacts_insert ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (public.has_org_permission(organization_id, 'crm.manage'));
DROP POLICY IF EXISTS contacts_update ON public.contacts;
CREATE POLICY contacts_update ON public.contacts FOR UPDATE TO authenticated
  USING (public.has_org_permission(organization_id, 'crm.manage'))
  WITH CHECK (public.has_org_permission(organization_id, 'crm.manage'));
DROP POLICY IF EXISTS contacts_delete ON public.contacts;
CREATE POLICY contacts_delete ON public.contacts FOR DELETE TO authenticated
  USING (public.has_org_permission(organization_id, 'crm.manage'));

DROP POLICY IF EXISTS crm_leads_select ON public.crm_leads;
CREATE POLICY crm_leads_select ON public.crm_leads FOR SELECT TO authenticated
  USING (public.has_org_permission(organization_id, 'crm.view') OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS crm_leads_insert ON public.crm_leads;
CREATE POLICY crm_leads_insert ON public.crm_leads FOR INSERT TO authenticated
  WITH CHECK (public.has_org_permission(organization_id, 'crm.manage'));
DROP POLICY IF EXISTS crm_leads_update ON public.crm_leads;
CREATE POLICY crm_leads_update ON public.crm_leads FOR UPDATE TO authenticated
  USING (public.has_org_permission(organization_id, 'crm.manage'))
  WITH CHECK (public.has_org_permission(organization_id, 'crm.manage'));
DROP POLICY IF EXISTS crm_leads_delete ON public.crm_leads;
CREATE POLICY crm_leads_delete ON public.crm_leads FOR DELETE TO authenticated
  USING (public.has_org_permission(organization_id, 'crm.manage'));

REVOKE ALL ON public.contacts, public.crm_leads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts, public.crm_leads TO authenticated;
GRANT ALL ON public.contacts, public.crm_leads TO service_role;

-- -----------------------------------------------------------------------------
-- 11. Modul: ajansta 'crm' varsayilan acik (dolum + yeni ajans tetikleyicisi)
-- -----------------------------------------------------------------------------
INSERT INTO public.organization_modules (organization_id, module_key, is_enabled, enabled_at)
SELECT o.id, 'crm', true, now() FROM public.organizations o WHERE o.account_type = 'agency'
ON CONFLICT (organization_id, module_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_faz5_default_modules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.account_type = 'agency' THEN
    INSERT INTO public.organization_modules (organization_id, module_key, is_enabled, enabled_at)
    VALUES (NEW.id, 'talent_pool', true, now()), (NEW.id, 'tasks', true, now()), (NEW.id, 'crm', true, now())
    ON CONFLICT (organization_id, module_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
