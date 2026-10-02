-- =============================================================================
-- FAZ 7a / 01 — Teklif dosyasi + musteri portali: proposals, proposal_versions, proposal_items,
--                internal.proposal_internal_items, portal_access_links + RPC'ler
--
-- Plan: docs/envanter/19-faz7-ticari-katman.md (kararlar bolum 2, model bolum 3).
-- Kaynak: 01 bolum 7-9, 02 bolum 2-3-6 (ic maliyet uc katman, portal ayri yuzey), 05 (onay kapisi), 04 madde 34-35.
--
-- Kurallar:
--   * Satici YALNIZ kurulus (seller_organization_id NOT NULL); seller_provider_id kurulusun 'organization' saglayicisi.
--   * Surum ekle-yalniz: draft iken kalemler duzenlenir; proposal_send surumu dondurur (sent_at); revizyon = proposal_new_version.
--     Dondurulmus surumun kalemi / ic kalemi / tax_rate-valid_until-notes degismez (tetikleyici 22023).
--   * Toplamlar tetikleyiciyle: subtotal = gorunur (is_visible_to_client) kalemlerin toplami; gizli kalem toplama GIRMEZ.
--     tax_amount = round(subtotal * tax_rate, 2); total = subtotal + tax.
--   * proposals.status / current_version_id ve proposals / proposal_versions / portal_access_links INSERT'i yalniz RPC.
--   * Ic kalemler (internal.proposal_internal_items) yalniz internal_proposal_items_list (commercial.view) /
--     internal_proposal_item_upsert (commercial.manage); marj liste RPC'sinde hesaplanir.
--   * Portal: 3 anon RPC (view / approve / request_revision); token sunucuda sha256 ile eslenir (token_hash sutunu
--     authenticated'a kapali); donus yalniz musteriye gorunen alanlar; kurulus/kullanici kimligi DONMEZ; internal'a dokunmaz.
--   * public varsayilan yetkiler -> once REVOKE, sonra sutun bazli GRANT.
--
-- Idempotan. Sapkali harf yok. VERI YAZMAZ.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Enum'lar (4)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proposal_source_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.proposal_source_type AS ENUM ('direct', 'rfp_response', 'marketplace_request');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proposal_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.proposal_status AS ENUM ('draft', 'sent', 'viewed', 'approved', 'revision_requested', 'declined', 'expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'portal_resource_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.portal_resource_type AS ENUM ('proposal', 'event', 'document_set');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'internal_item_source' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.internal_item_source AS ENUM ('crew_snapshot', 'manual');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Tablolar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proposals (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  seller_provider_id     uuid NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
  buyer_user_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  buyer_organization_id  uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  buyer_contact_id       uuid,                                              -- FAZ 8 CRM (FK sonra)
  event_id               uuid REFERENCES public.events(id) ON DELETE SET NULL,
  crew_id                uuid REFERENCES public.crews(id) ON DELETE SET NULL,
  rfp_id                 uuid,                                              -- 7b (FK sonra)
  source_type            public.proposal_source_type NOT NULL DEFAULT 'direct',
  status                 public.proposal_status NOT NULL DEFAULT 'draft',
  title                  text NOT NULL,
  client_name            text,
  client_email           text,
  current_version_id     uuid,                                              -- FK asagida (dairesel)
  created_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposals_title_check       CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  CONSTRAINT proposals_client_name_check CHECK (client_name IS NULL OR char_length(client_name) <= 200)
);
CREATE INDEX IF NOT EXISTS proposals_seller_idx ON public.proposals (seller_organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS proposals_buyer_idx  ON public.proposals (buyer_user_id) WHERE buyer_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS proposals_event_idx  ON public.proposals (event_id) WHERE event_id IS NOT NULL;
COMMENT ON TABLE public.proposals IS 'FAZ 7a: kurulusun teklif dosyasi (satici -> alici). status/current_version_id yalniz RPC yazar.';

CREATE TABLE IF NOT EXISTS public.proposal_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id       uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  version_no        integer NOT NULL,
  subtotal          numeric NOT NULL DEFAULT 0,
  tax_rate          numeric NOT NULL DEFAULT 0.20,
  tax_amount        numeric NOT NULL DEFAULT 0,
  total_amount      numeric NOT NULL DEFAULT 0,
  currency          char(3) NOT NULL DEFAULT 'TRY',
  valid_until       timestamptz,
  notes             text,
  client_note       text,
  sent_at           timestamptz,                                            -- dondurma isareti
  approved_by_name  text,
  approved_at       timestamptz,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pv_version_key    UNIQUE (proposal_id, version_no),
  CONSTRAINT pv_tax_rate_check CHECK (tax_rate >= 0 AND tax_rate <= 1),
  CONSTRAINT pv_notes_check    CHECK (notes IS NULL OR char_length(notes) <= 4000),
  CONSTRAINT pv_client_note_check CHECK (client_note IS NULL OR char_length(client_note) <= 4000),
  CONSTRAINT pv_approved_name_check CHECK (approved_by_name IS NULL OR char_length(approved_by_name) BETWEEN 2 AND 120)
);
COMMENT ON TABLE public.proposal_versions IS 'FAZ 7a: teklif surumu (ekle-yalniz; sent_at dolu = dondurulmus). Toplamlar tetikleyiciyle.';

ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_current_version_fkey;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_current_version_fkey
  FOREIGN KEY (current_version_id) REFERENCES public.proposal_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.proposal_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_version_id  uuid NOT NULL REFERENCES public.proposal_versions(id) ON DELETE CASCADE,
  role_id              integer REFERENCES public.service_roles(id) ON DELETE RESTRICT,
  crew_member_id       uuid REFERENCES public.crew_members(id) ON DELETE SET NULL,
  description          text NOT NULL,
  quantity             numeric NOT NULL DEFAULT 1,
  unit_client_price    numeric NOT NULL DEFAULT 0,
  total_client_price   numeric GENERATED ALWAYS AS (round(quantity * unit_client_price, 2)) STORED,
  is_visible_to_client boolean NOT NULL DEFAULT true,
  sort_order           integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pi_description_check CHECK (char_length(trim(description)) BETWEEN 1 AND 500),
  CONSTRAINT pi_quantity_check    CHECK (quantity > 0),
  CONSTRAINT pi_price_check       CHECK (unit_client_price >= 0)
);
CREATE INDEX IF NOT EXISTS pi_version_idx ON public.proposal_items (proposal_version_id, sort_order);
COMMENT ON TABLE public.proposal_items IS 'FAZ 7a: musteriye gorunen kalemler. Gizli kalem (is_visible_to_client=false) toplama girmez.';

CREATE TABLE IF NOT EXISTS internal.proposal_internal_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_version_id   uuid NOT NULL REFERENCES public.proposal_versions(id) ON DELETE CASCADE,
  proposal_item_id      uuid NOT NULL UNIQUE REFERENCES public.proposal_items(id) ON DELETE CASCADE,
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  internal_cost         numeric NOT NULL CHECK (internal_cost >= 0),
  source                public.internal_item_source NOT NULL DEFAULT 'manual',
  source_crew_member_id uuid,
  private_note          text,
  created_by            uuid,
  snapshot_at           timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pii_version_idx ON internal.proposal_internal_items (proposal_version_id);
COMMENT ON TABLE internal.proposal_internal_items IS 'FAZ 7a: kalem basina ic maliyet (surum anlik goruntusu). Yalniz RPC.';
REVOKE ALL ON TABLE internal.proposal_internal_items FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.portal_access_links (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_type    public.portal_resource_type NOT NULL,
  resource_id      uuid NOT NULL,
  token_hash       text NOT NULL UNIQUE,
  scope            text[] NOT NULL DEFAULT ARRAY['view', 'approve', 'request_revision'],
  recipient_email  text,
  expires_at       timestamptz NOT NULL DEFAULT now() + interval '30 days',
  max_views        integer,
  view_count       integer NOT NULL DEFAULT 0,
  first_viewed_at  timestamptz,
  last_viewed_at   timestamptz,
  revoked_at       timestamptz,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pal_max_views_check CHECK (max_views IS NULL OR max_views >= 1)
);
CREATE INDEX IF NOT EXISTS pal_resource_idx ON public.portal_access_links (resource_type, resource_id);
COMMENT ON TABLE public.portal_access_links IS 'FAZ 7a: imzali misafir portali baglantisi. Ham jeton saklanmaz (sha256). Yalniz RPC yazar.';

-- updated_at
DROP TRIGGER IF EXISTS on_proposals_updated ON public.proposals;
CREATE TRIGGER on_proposals_updated BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_proposal_versions_updated ON public.proposal_versions;
CREATE TRIGGER on_proposal_versions_updated BEFORE UPDATE ON public.proposal_versions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_proposal_items_updated ON public.proposal_items;
CREATE TRIGGER on_proposal_items_updated BEFORE UPDATE ON public.proposal_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_proposal_internal_items_updated ON internal.proposal_internal_items;
CREATE TRIGGER on_proposal_internal_items_updated BEFORE UPDATE ON internal.proposal_internal_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 3) Tetikleyiciler: guard'lar, surum numarasi, toplamlar, dondurma
-- -----------------------------------------------------------------------------
-- RPC yazim bayragi: status / current_version_id yalniz RPC icinde degisir
CREATE OR REPLACE FUNCTION public.fn_faz7_rpc_flag()
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('kashe.faz7_rpc', true) = '1' $$;
REVOKE ALL ON FUNCTION public.fn_faz7_rpc_flag() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_faz7_proposal_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.title := trim(NEW.title);
  NEW.client_email := public.norm_email(NEW.client_email);
  NEW.client_name := NULLIF(trim(NEW.client_name), '');
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    IF NOT public.fn_faz7_rpc_flag() THEN
      RAISE EXCEPTION 'teklif yalniz proposal_create ile acilir' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.seller_organization_id IS DISTINCT FROM OLD.seller_organization_id OR NEW.seller_provider_id IS DISTINCT FROM OLD.seller_provider_id THEN
    RAISE EXCEPTION 'teklifin saticisi degistirilemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF (NEW.status IS DISTINCT FROM OLD.status OR NEW.current_version_id IS DISTINCT FROM OLD.current_version_id) AND NOT public.fn_faz7_rpc_flag() THEN
    RAISE EXCEPTION 'durum ve gecerli surum yalniz RPC ile degisir' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz7_proposal_before_write ON public.proposals;
CREATE TRIGGER trg_faz7_proposal_before_write BEFORE INSERT OR UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.fn_faz7_proposal_before_write();

-- surum: version_no otomatik; INSERT yalniz RPC; dondurulmus surumde duzenlenebilir alanlar degismez; tax_rate degisince hesap
CREATE OR REPLACE FUNCTION public.fn_faz7_version_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.fn_faz7_rpc_flag() THEN
      RAISE EXCEPTION 'surum yalniz RPC ile acilir' USING ERRCODE = 'insufficient_privilege';
    END IF;
    SELECT COALESCE(max(version_no), 0) + 1 INTO NEW.version_no FROM public.proposal_versions WHERE proposal_id = NEW.proposal_id;
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    NEW.tax_amount := round(NEW.subtotal * NEW.tax_rate, 2);
    NEW.total_amount := NEW.subtotal + NEW.tax_amount;
    RETURN NEW;
  END IF;
  IF NEW.proposal_id IS DISTINCT FROM OLD.proposal_id OR NEW.version_no IS DISTINCT FROM OLD.version_no THEN
    RAISE EXCEPTION 'surumun teklifi/numarasi degistirilemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF OLD.sent_at IS NOT NULL AND NOT public.fn_faz7_rpc_flag()
     AND (NEW.tax_rate IS DISTINCT FROM OLD.tax_rate OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
          OR NEW.notes IS DISTINCT FROM OLD.notes OR NEW.subtotal IS DISTINCT FROM OLD.subtotal OR NEW.currency IS DISTINCT FROM OLD.currency) THEN
    RAISE EXCEPTION 'surum dondurulmus; yeni surum ac' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF OLD.sent_at IS NOT NULL AND NEW.sent_at IS DISTINCT FROM OLD.sent_at THEN
    RAISE EXCEPTION 'gonderim zamani degistirilemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  NEW.tax_amount := round(NEW.subtotal * NEW.tax_rate, 2);
  NEW.total_amount := NEW.subtotal + NEW.tax_amount;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz7_version_before_write ON public.proposal_versions;
CREATE TRIGGER trg_faz7_version_before_write BEFORE INSERT OR UPDATE ON public.proposal_versions FOR EACH ROW EXECUTE FUNCTION public.fn_faz7_version_before_write();

-- kalem: dondurma + surum toplamlari
CREATE OR REPLACE FUNCTION public.fn_faz7_version_frozen(p_version_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.proposal_versions v WHERE v.id = p_version_id AND v.sent_at IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.fn_faz7_version_frozen(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_faz7_item_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE vid uuid := COALESCE(NEW.proposal_version_id, OLD.proposal_version_id);
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.proposal_version_id IS DISTINCT FROM OLD.proposal_version_id THEN
    RAISE EXCEPTION 'kalemin surumu degistirilemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF public.fn_faz7_version_frozen(vid) AND NOT public.fn_faz7_rpc_flag() THEN
    RAISE EXCEPTION 'surum dondurulmus; yeni surum ac' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.description := trim(NEW.description);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz7_item_before_write ON public.proposal_items;
CREATE TRIGGER trg_faz7_item_before_write BEFORE INSERT OR UPDATE OR DELETE ON public.proposal_items FOR EACH ROW EXECUTE FUNCTION public.fn_faz7_item_before_write();

CREATE OR REPLACE FUNCTION public.fn_faz7_recalc_version(p_version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- bayrak gerekmez: taslak surumde subtotal serbest; dondurulmus surumde kalem zaten degisemez
  UPDATE public.proposal_versions v
     SET subtotal = COALESCE((SELECT sum(i.total_client_price) FROM public.proposal_items i
                               WHERE i.proposal_version_id = v.id AND i.is_visible_to_client), 0)
   WHERE v.id = p_version_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_faz7_recalc_version(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_faz7_item_after_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.fn_faz7_recalc_version(COALESCE(NEW.proposal_version_id, OLD.proposal_version_id));
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz7_item_after_write ON public.proposal_items;
CREATE TRIGGER trg_faz7_item_after_write AFTER INSERT OR UPDATE OR DELETE ON public.proposal_items FOR EACH ROW EXECUTE FUNCTION public.fn_faz7_item_after_write();

-- ic kalem: kurulus tutarliligi + dondurma
CREATE OR REPLACE FUNCTION internal.fn_faz7_internal_item_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE v_org uuid; v_version uuid;
BEGIN
  SELECT p.seller_organization_id, i.proposal_version_id INTO v_org, v_version
    FROM public.proposal_items i JOIN public.proposal_versions v ON v.id = i.proposal_version_id JOIN public.proposals p ON p.id = v.proposal_id
   WHERE i.id = NEW.proposal_item_id;
  IF v_org IS NULL OR v_org <> NEW.organization_id OR v_version <> NEW.proposal_version_id THEN
    RAISE EXCEPTION 'ic kalem kalemin kurulusu ve surumuyle eslesmeli' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF public.fn_faz7_version_frozen(v_version) AND NOT public.fn_faz7_rpc_flag() THEN
    RAISE EXCEPTION 'surum dondurulmus; yeni surum ac' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz7_internal_item_check ON internal.proposal_internal_items;
CREATE TRIGGER trg_faz7_internal_item_check BEFORE INSERT OR UPDATE ON internal.proposal_internal_items FOR EACH ROW EXECUTE FUNCTION internal.fn_faz7_internal_item_check();

-- portal baglantisi: INSERT yalniz RPC; token_hash degismez
CREATE OR REPLACE FUNCTION public.fn_faz7_link_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.fn_faz7_rpc_flag() THEN
      RAISE EXCEPTION 'portal baglantisi yalniz RPC ile acilir' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    NEW.recipient_email := public.norm_email(NEW.recipient_email);
    RETURN NEW;
  END IF;
  IF NEW.token_hash IS DISTINCT FROM OLD.token_hash OR NEW.resource_id IS DISTINCT FROM OLD.resource_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'baglantinin jetonu/kaynagi degistirilemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz7_link_before_write ON public.portal_access_links;
CREATE TRIGGER trg_faz7_link_before_write BEFORE INSERT OR UPDATE ON public.portal_access_links FOR EACH ROW EXECUTE FUNCTION public.fn_faz7_link_before_write();

REVOKE ALL ON FUNCTION public.fn_faz7_proposal_before_write()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz7_version_before_write()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz7_item_before_write()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz7_item_after_write()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.fn_faz7_internal_item_check()      FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_faz7_link_before_write()          FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4) Yetkiler
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.proposals, public.proposal_versions, public.proposal_items, public.portal_access_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.proposals, public.proposal_versions, public.proposal_items TO authenticated;
GRANT SELECT (id, organization_id, resource_type, resource_id, scope, recipient_email, expires_at, max_views, view_count,
              first_viewed_at, last_viewed_at, revoked_at, created_by, created_at) ON TABLE public.portal_access_links TO authenticated;
GRANT UPDATE (title, client_name, client_email, buyer_user_id, buyer_organization_id, event_id, crew_id) ON TABLE public.proposals TO authenticated;
GRANT UPDATE (tax_rate, valid_until, notes) ON TABLE public.proposal_versions TO authenticated;
GRANT INSERT (proposal_version_id, role_id, crew_member_id, description, quantity, unit_client_price, is_visible_to_client, sort_order),
      UPDATE (role_id, crew_member_id, description, quantity, unit_client_price, is_visible_to_client, sort_order),
      DELETE ON TABLE public.proposal_items TO authenticated;

-- -----------------------------------------------------------------------------
-- 5) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.proposals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_access_links  ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal.proposal_internal_items ENABLE ROW LEVEL SECURITY;   -- politika yok

-- satir sutunlariyla (RETURNING guvenli): satici yetkisi / alici (draft disi) / admin
CREATE OR REPLACE FUNCTION public.can_access_proposal_row(p_seller_org uuid, p_buyer_user uuid, p_status public.proposal_status, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_permission(p_seller_org, p_permission)
      OR (p_permission = 'proposals.view' AND p_buyer_user IS NOT NULL AND p_buyer_user = auth.uid() AND p_status <> 'draft')
      OR public.is_admin(auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.can_access_proposal(p_proposal_id uuid, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = p_proposal_id
                   AND public.can_access_proposal_row(p.seller_organization_id, p.buyer_user_id, p.status, p_permission));
$$;
CREATE OR REPLACE FUNCTION public.can_access_proposal_version(p_version_id uuid, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.proposal_versions v WHERE v.id = p_version_id AND public.can_access_proposal(v.proposal_id, p_permission));
$$;
-- alici midir (kalemde gizli satir suzgeci icin)
CREATE OR REPLACE FUNCTION public.is_proposal_buyer(p_version_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.proposal_versions v JOIN public.proposals p ON p.id = v.proposal_id
                  WHERE v.id = p_version_id AND p.buyer_user_id = auth.uid()
                    AND NOT public.has_org_permission(p.seller_organization_id, 'proposals.view') AND NOT public.is_admin(auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.can_access_proposal_row(uuid, uuid, public.proposal_status, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_proposal(uuid, text)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_proposal_version(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_proposal_buyer(uuid)                 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_proposal_row(uuid, uuid, public.proposal_status, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_proposal(uuid, text)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_proposal_version(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_proposal_buyer(uuid)                 TO authenticated, service_role;

DROP POLICY IF EXISTS proposals_select ON public.proposals;
CREATE POLICY proposals_select ON public.proposals FOR SELECT TO authenticated
  USING (public.can_access_proposal_row(seller_organization_id, buyer_user_id, status, 'proposals.view'));
DROP POLICY IF EXISTS proposals_update ON public.proposals;
CREATE POLICY proposals_update ON public.proposals FOR UPDATE TO authenticated
  USING (public.has_org_permission(seller_organization_id, 'proposals.manage'))
  WITH CHECK (public.has_org_permission(seller_organization_id, 'proposals.manage'));

DROP POLICY IF EXISTS proposal_versions_select ON public.proposal_versions;
CREATE POLICY proposal_versions_select ON public.proposal_versions FOR SELECT TO authenticated
  USING (public.can_access_proposal(proposal_id, 'proposals.view'));
DROP POLICY IF EXISTS proposal_versions_update ON public.proposal_versions;
CREATE POLICY proposal_versions_update ON public.proposal_versions FOR UPDATE TO authenticated
  USING (public.can_access_proposal(proposal_id, 'proposals.manage')) WITH CHECK (public.can_access_proposal(proposal_id, 'proposals.manage'));

DROP POLICY IF EXISTS proposal_items_select ON public.proposal_items;
CREATE POLICY proposal_items_select ON public.proposal_items FOR SELECT TO authenticated
  USING (public.can_access_proposal_version(proposal_version_id, 'proposals.view')
         AND (is_visible_to_client OR NOT public.is_proposal_buyer(proposal_version_id)));
DROP POLICY IF EXISTS proposal_items_insert ON public.proposal_items;
CREATE POLICY proposal_items_insert ON public.proposal_items FOR INSERT TO authenticated
  WITH CHECK (public.can_access_proposal_version(proposal_version_id, 'proposals.manage'));
DROP POLICY IF EXISTS proposal_items_update ON public.proposal_items;
CREATE POLICY proposal_items_update ON public.proposal_items FOR UPDATE TO authenticated
  USING (public.can_access_proposal_version(proposal_version_id, 'proposals.manage'))
  WITH CHECK (public.can_access_proposal_version(proposal_version_id, 'proposals.manage'));
DROP POLICY IF EXISTS proposal_items_delete ON public.proposal_items;
CREATE POLICY proposal_items_delete ON public.proposal_items FOR DELETE TO authenticated
  USING (public.can_access_proposal_version(proposal_version_id, 'proposals.manage'));

DROP POLICY IF EXISTS portal_links_select ON public.portal_access_links;
CREATE POLICY portal_links_select ON public.portal_access_links FOR SELECT TO authenticated
  USING (public.has_org_permission(organization_id, 'proposals.view') OR public.is_admin(auth.uid()));

-- -----------------------------------------------------------------------------
-- 6) Kurulus RPC'leri
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proposal_create(
  p_org_id uuid, p_title text, p_event_id uuid DEFAULT NULL, p_crew_id uuid DEFAULT NULL,
  p_client_name text DEFAULT NULL, p_client_email text DEFAULT NULL, p_buyer_user_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE v_provider uuid; v_crew record; v_event uuid := p_event_id; v_prop uuid; v_ver uuid; m record; v_item uuid; n integer := 0;
BEGIN
  PERFORM internal.assert_org_permission(p_org_id, 'proposals.manage', 'proposals');
  SELECT id INTO v_provider FROM public.providers WHERE organization_id = p_org_id AND provider_type = 'organization' LIMIT 1;
  IF v_provider IS NULL THEN RAISE EXCEPTION 'kurulusun saglayici kaydi yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_title IS NULL OR char_length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'baslik gerekir' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_crew_id IS NOT NULL THEN
    SELECT id, organization_id, event_id INTO v_crew FROM public.crews WHERE id = p_crew_id;
    IF v_crew.id IS NULL THEN RAISE EXCEPTION 'ekip yok' USING ERRCODE = 'no_data_found'; END IF;
    IF v_crew.organization_id IS DISTINCT FROM p_org_id THEN
      RAISE EXCEPTION 'ekip bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_event := COALESCE(v_event, v_crew.event_id);
  END IF;

  PERFORM set_config('kashe.faz7_rpc', '1', true);
  INSERT INTO public.proposals (seller_organization_id, seller_provider_id, buyer_user_id, event_id, crew_id, title, client_name, client_email)
  VALUES (p_org_id, v_provider, p_buyer_user_id, v_event, p_crew_id, p_title, p_client_name, p_client_email)
  RETURNING id INTO v_prop;
  INSERT INTO public.proposal_versions (proposal_id) VALUES (v_prop) RETURNING id INTO v_ver;

  IF p_crew_id IS NOT NULL THEN
    FOR m IN
      SELECT cm.id, cm.role_id, sr.name_tr, cm.sort_order, x.client_price, x.agreed_cost
        FROM public.crew_members cm
        JOIN public.service_roles sr ON sr.id = cm.role_id
        LEFT JOIN internal.crew_member_commercials x ON x.crew_member_id = cm.id
       WHERE cm.crew_id = p_crew_id AND cm.status NOT IN ('declined', 'replaced')
       ORDER BY cm.sort_order, cm.created_at
    LOOP
      n := n + 1;
      INSERT INTO public.proposal_items (proposal_version_id, role_id, crew_member_id, description, quantity, unit_client_price, sort_order)
      VALUES (v_ver, m.role_id, m.id, m.name_tr, 1, COALESCE(m.client_price, 0), n) RETURNING id INTO v_item;
      IF m.agreed_cost IS NOT NULL THEN
        INSERT INTO internal.proposal_internal_items (proposal_version_id, proposal_item_id, organization_id, internal_cost, source, source_crew_member_id, created_by)
        VALUES (v_ver, v_item, p_org_id, m.agreed_cost, 'crew_snapshot', m.id, auth.uid());
      END IF;
    END LOOP;
  END IF;

  UPDATE public.proposals SET current_version_id = v_ver WHERE id = v_prop;
  PERFORM internal.log_access(p_org_id, 'write', 'proposals', v_prop, jsonb_build_object('op', 'proposal.create', 'items', n));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN v_prop;
END;
$$;

CREATE OR REPLACE FUNCTION public.proposal_new_version(p_proposal_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE p record; old_v record; v_ver uuid; it record; v_item uuid;
BEGIN
  SELECT * INTO p FROM public.proposals WHERE id = p_proposal_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'teklif yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(p.seller_organization_id, 'proposals.manage', 'proposals', p.id);
  SELECT * INTO old_v FROM public.proposal_versions WHERE id = p.current_version_id;
  IF old_v.id IS NULL THEN RAISE EXCEPTION 'gecerli surum yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF old_v.sent_at IS NULL THEN RAISE EXCEPTION 'mevcut surum zaten taslak' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p.status = 'approved' THEN RAISE EXCEPTION 'onaylanmis teklifte yeni surum acilamaz' USING ERRCODE = 'invalid_parameter_value'; END IF;

  PERFORM set_config('kashe.faz7_rpc', '1', true);
  INSERT INTO public.proposal_versions (proposal_id, tax_rate, currency, notes)
  VALUES (p.id, old_v.tax_rate, old_v.currency, old_v.notes) RETURNING id INTO v_ver;
  FOR it IN SELECT i.*, x.internal_cost, x.source, x.source_crew_member_id, x.private_note
              FROM public.proposal_items i LEFT JOIN internal.proposal_internal_items x ON x.proposal_item_id = i.id
             WHERE i.proposal_version_id = old_v.id ORDER BY i.sort_order, i.created_at
  LOOP
    INSERT INTO public.proposal_items (proposal_version_id, role_id, crew_member_id, description, quantity, unit_client_price, is_visible_to_client, sort_order)
    VALUES (v_ver, it.role_id, it.crew_member_id, it.description, it.quantity, it.unit_client_price, it.is_visible_to_client, it.sort_order)
    RETURNING id INTO v_item;
    IF it.internal_cost IS NOT NULL THEN
      INSERT INTO internal.proposal_internal_items (proposal_version_id, proposal_item_id, organization_id, internal_cost, source, source_crew_member_id, private_note, created_by)
      VALUES (v_ver, v_item, p.seller_organization_id, it.internal_cost, it.source, it.source_crew_member_id, it.private_note, auth.uid());
    END IF;
  END LOOP;
  UPDATE public.proposals SET current_version_id = v_ver, status = 'draft' WHERE id = p.id;
  PERFORM internal.log_access(p.seller_organization_id, 'write', 'proposals', p.id, jsonb_build_object('op', 'proposal.new_version', 'version_id', v_ver));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN v_ver;
END;
$$;

CREATE OR REPLACE FUNCTION public.proposal_send(p_proposal_id uuid, p_valid_days integer DEFAULT 14)
RETURNS TABLE (link_id uuid, token text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal, extensions
AS $$
DECLARE p record; v record; n_items integer; n_bad integer; v_token text; v_link uuid; v_exp timestamptz;
BEGIN
  SELECT * INTO p FROM public.proposals WHERE id = p_proposal_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'teklif yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(p.seller_organization_id, 'proposals.manage', 'proposals', p.id);
  SELECT * INTO v FROM public.proposal_versions WHERE id = p.current_version_id;
  IF v.id IS NULL OR v.sent_at IS NOT NULL OR p.status <> 'draft' THEN
    RAISE EXCEPTION 'gonderilecek taslak surum yok' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT count(*) FILTER (WHERE is_visible_to_client), count(*) FILTER (WHERE is_visible_to_client AND unit_client_price <= 0)
    INTO n_items, n_bad FROM public.proposal_items WHERE proposal_version_id = v.id;
  IF n_items = 0 THEN RAISE EXCEPTION 'teklifte musteriye gorunen kalem yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF n_bad > 0 THEN RAISE EXCEPTION 'fiyati girilmemis kalem var (%)', n_bad USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_valid_days IS NULL OR p_valid_days < 1 OR p_valid_days > 365 THEN
    RAISE EXCEPTION 'gecerlilik 1-365 gun olmali' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.proposal_versions
     SET sent_at = now(), valid_until = COALESCE(valid_until, now() + make_interval(days => p_valid_days))
   WHERE id = v.id;
  SELECT valid_until INTO v_exp FROM public.proposal_versions WHERE id = v.id;
  -- eski baglantilar iptal (ayni teklif)
  UPDATE public.portal_access_links SET revoked_at = now()
   WHERE resource_type = 'proposal' AND resource_id = p.id AND revoked_at IS NULL;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.portal_access_links (organization_id, resource_type, resource_id, token_hash, recipient_email, expires_at)
  VALUES (p.seller_organization_id, 'proposal', p.id, encode(extensions.digest(v_token, 'sha256'), 'hex'), p.client_email,
          GREATEST(v_exp + interval '7 days', now() + interval '30 days'))
  RETURNING id INTO v_link;
  UPDATE public.proposals SET status = 'sent' WHERE id = p.id;
  PERFORM internal.log_access(p.seller_organization_id, 'write', 'proposals', p.id, jsonb_build_object('op', 'proposal.send', 'version_id', v.id, 'link_id', v_link));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN QUERY SELECT v_link, v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.proposal_revoke_link(p_link_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE l record;
BEGIN
  SELECT * INTO l FROM public.portal_access_links WHERE id = p_link_id;
  IF l.id IS NULL THEN RAISE EXCEPTION 'baglanti yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(l.organization_id, 'proposals.manage', 'portal_access_links', l.id);
  UPDATE public.portal_access_links SET revoked_at = COALESCE(revoked_at, now()) WHERE id = l.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.proposal_set_status(p_proposal_id uuid, p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE p record;
BEGIN
  SELECT * INTO p FROM public.proposals WHERE id = p_proposal_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'teklif yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(p.seller_organization_id, 'proposals.manage', 'proposals', p.id);
  IF p_status <> 'declined' THEN
    RAISE EXCEPTION 'satici yalniz declined durumuna cekebilir' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p.status NOT IN ('sent', 'viewed', 'revision_requested', 'expired') THEN
    RAISE EXCEPTION 'bu durumda kapatilamaz (%)', p.status USING ERRCODE = 'invalid_parameter_value';
  END IF;
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.proposals SET status = 'declined' WHERE id = p.id;
  UPDATE public.portal_access_links SET revoked_at = COALESCE(revoked_at, now()) WHERE resource_type = 'proposal' AND resource_id = p.id;
  PERFORM internal.log_access(p.seller_organization_id, 'write', 'proposals', p.id, jsonb_build_object('op', 'proposal.decline'));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN true;
END;
$$;

-- Ic kalemler: liste (commercial.view) + yazma (commercial.manage)
CREATE OR REPLACE FUNCTION public.internal_proposal_items_list(p_version_id uuid)
RETURNS TABLE (item_id uuid, description text, quantity numeric, unit_client_price numeric, total_client_price numeric,
               is_visible_to_client boolean, internal_cost numeric, markup_amount numeric, margin_rate numeric,
               source public.internal_item_source, private_note text, snapshot_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE v_org uuid;
BEGIN
  SELECT p.seller_organization_id INTO v_org FROM public.proposal_versions v JOIN public.proposals p ON p.id = v.proposal_id WHERE v.id = p_version_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'surum yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(v_org, 'commercial.view', 'proposal_internal_items', p_version_id);
  PERFORM internal.log_access(v_org, 'read', 'proposal_internal_items', p_version_id, '{}'::jsonb);
  RETURN QUERY
    SELECT i.id, i.description, i.quantity, i.unit_client_price, i.total_client_price, i.is_visible_to_client,
           x.internal_cost,
           CASE WHEN x.internal_cost IS NULL THEN NULL ELSE i.total_client_price - x.internal_cost * i.quantity END,
           CASE WHEN x.internal_cost IS NULL OR i.total_client_price <= 0 THEN NULL
                ELSE round((i.total_client_price - x.internal_cost * i.quantity) / i.total_client_price, 4) END,
           x.source, x.private_note, x.snapshot_at
      FROM public.proposal_items i LEFT JOIN internal.proposal_internal_items x ON x.proposal_item_id = i.id
     WHERE i.proposal_version_id = p_version_id
     ORDER BY i.sort_order, i.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_proposal_item_upsert(p_item_id uuid, p_internal_cost numeric, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE v_org uuid; v_version uuid; v_id uuid;
BEGIN
  SELECT p.seller_organization_id, i.proposal_version_id INTO v_org, v_version
    FROM public.proposal_items i JOIN public.proposal_versions v ON v.id = i.proposal_version_id JOIN public.proposals p ON p.id = v.proposal_id
   WHERE i.id = p_item_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'kalem yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(v_org, 'commercial.manage', 'proposal_internal_items', p_item_id);
  IF p_internal_cost IS NULL OR p_internal_cost < 0 THEN RAISE EXCEPTION 'maliyet 0 veya daha buyuk olmali' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF public.fn_faz7_version_frozen(v_version) THEN RAISE EXCEPTION 'surum dondurulmus; yeni surum ac' USING ERRCODE = 'invalid_parameter_value'; END IF;
  INSERT INTO internal.proposal_internal_items (proposal_version_id, proposal_item_id, organization_id, internal_cost, source, private_note, created_by)
  VALUES (v_version, p_item_id, v_org, p_internal_cost, 'manual', p_note, auth.uid())
  ON CONFLICT (proposal_item_id) DO UPDATE
    SET internal_cost = EXCLUDED.internal_cost, source = 'manual', private_note = EXCLUDED.private_note, snapshot_at = now()
  RETURNING id INTO v_id;
  PERFORM internal.log_access(v_org, 'write', 'proposal_internal_items', p_item_id, jsonb_build_object('op', 'proposal.cost'));
  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7) Portal RPC'leri (anon). Token -> sha256 -> baglanti; donus yalniz musteriye gorunen alanlar.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz7_portal_link(p_token text)
RETURNS public.portal_access_links
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE l public.portal_access_links;
BEGIN
  IF p_token IS NULL OR char_length(p_token) <> 64 THEN RAISE EXCEPTION 'baglanti gecersiz' USING ERRCODE = 'no_data_found'; END IF;
  SELECT * INTO l FROM public.portal_access_links WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') AND resource_type = 'proposal';
  IF l.id IS NULL THEN RAISE EXCEPTION 'baglanti gecersiz' USING ERRCODE = 'no_data_found'; END IF;
  IF l.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'baglanti iptal edilmis' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF l.expires_at < now() THEN RAISE EXCEPTION 'baglantinin suresi dolmus' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF l.max_views IS NOT NULL AND l.view_count >= l.max_views THEN RAISE EXCEPTION 'baglantinin goruntuleme hakki bitmis' USING ERRCODE = 'invalid_parameter_value'; END IF;
  RETURN l;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_faz7_portal_link(text) FROM PUBLIC, anon, authenticated;

-- gonderilmis son surum
CREATE OR REPLACE FUNCTION public.fn_faz7_last_sent_version(p_proposal_id uuid)
RETURNS public.proposal_versions LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.* FROM public.proposal_versions v WHERE v.proposal_id = p_proposal_id AND v.sent_at IS NOT NULL ORDER BY v.version_no DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.fn_faz7_last_sent_version(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_proposal_view(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE l public.portal_access_links; p record; v public.proposal_versions; items jsonb; ev jsonb; seller text;
BEGIN
  l := public.fn_faz7_portal_link(p_token);
  SELECT * INTO p FROM public.proposals WHERE id = l.resource_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'baglanti gecersiz' USING ERRCODE = 'no_data_found'; END IF;
  v := public.fn_faz7_last_sent_version(p.id);
  IF v.id IS NULL THEN RAISE EXCEPTION 'gonderilmis surum yok' USING ERRCODE = 'invalid_parameter_value'; END IF;

  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.portal_access_links
     SET view_count = view_count + 1, first_viewed_at = COALESCE(first_viewed_at, now()), last_viewed_at = now()
   WHERE id = l.id;
  IF p.status IN ('sent', 'viewed') AND v.valid_until IS NOT NULL AND v.valid_until < now() THEN
    UPDATE public.proposals SET status = 'expired' WHERE id = p.id; p.status := 'expired';
  ELSIF p.status = 'sent' THEN
    UPDATE public.proposals SET status = 'viewed' WHERE id = p.id; p.status := 'viewed';
  END IF;

  SELECT display_name INTO seller FROM public.providers WHERE id = p.seller_provider_id;
  SELECT jsonb_build_object('title', e.title, 'event_type', et.name_tr, 'start_date', e.start_date, 'city', c.name, 'participant_count', e.participant_count)
    INTO ev
    FROM public.events e LEFT JOIN public.event_types et ON et.key = e.event_type LEFT JOIN public.turkish_cities c ON c.id = e.city_id
   WHERE e.id = p.event_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('description', i.description, 'quantity', i.quantity, 'unit_client_price', i.unit_client_price,
                                                'total_client_price', i.total_client_price, 'role', sr.name_tr) ORDER BY i.sort_order, i.created_at), '[]'::jsonb)
    INTO items
    FROM public.proposal_items i LEFT JOIN public.service_roles sr ON sr.id = i.role_id
   WHERE i.proposal_version_id = v.id AND i.is_visible_to_client;

  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN jsonb_build_object(
    'seller_name', seller, 'title', p.title, 'client_name', p.client_name, 'event', ev,
    'version_no', v.version_no, 'items', items, 'subtotal', v.subtotal, 'tax_rate', v.tax_rate, 'tax_amount', v.tax_amount,
    'total_amount', v.total_amount, 'currency', v.currency, 'valid_until', v.valid_until, 'notes', v.notes,
    'status', p.status, 'approved_by_name', v.approved_by_name, 'approved_at', v.approved_at, 'client_note', v.client_note,
    'scope', to_jsonb(l.scope), 'sent_at', v.sent_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_proposal_approve(p_token text, p_name text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE l public.portal_access_links; p record; v public.proposal_versions;
BEGIN
  l := public.fn_faz7_portal_link(p_token);
  IF NOT ('approve' = ANY(l.scope)) THEN RAISE EXCEPTION 'bu baglanti onay yetkisi tasimiyor' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_name IS NULL OR char_length(trim(p_name)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'onaylayan ad soyad gerekir (2-120 karakter)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT * INTO p FROM public.proposals WHERE id = l.resource_id;
  v := public.fn_faz7_last_sent_version(p.id);
  IF v.id IS NULL THEN RAISE EXCEPTION 'gonderilmis surum yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p.status = 'approved' THEN RAISE EXCEPTION 'teklif zaten onaylanmis' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p.status NOT IN ('sent', 'viewed') THEN RAISE EXCEPTION 'teklif bu durumda onaylanamaz (%)', p.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  IF v.valid_until IS NOT NULL AND v.valid_until < now() THEN
    -- durum isareti portal_proposal_view'da konur (RAISE bu fonksiyonun yazimini geri alirdi)
    RAISE EXCEPTION 'teklifin gecerlilik suresi dolmus' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  UPDATE public.proposal_versions SET approved_by_name = trim(p_name), approved_at = now() WHERE id = v.id;
  UPDATE public.proposals SET status = 'approved' WHERE id = p.id;
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_proposal_request_revision(p_token text, p_note text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE l public.portal_access_links; p record; v public.proposal_versions;
BEGIN
  l := public.fn_faz7_portal_link(p_token);
  IF NOT ('request_revision' = ANY(l.scope)) THEN RAISE EXCEPTION 'bu baglanti revizyon yetkisi tasimiyor' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_note IS NULL OR char_length(trim(p_note)) NOT BETWEEN 2 AND 4000 THEN
    RAISE EXCEPTION 'revizyon notu gerekir (2-4000 karakter)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT * INTO p FROM public.proposals WHERE id = l.resource_id;
  v := public.fn_faz7_last_sent_version(p.id);
  IF v.id IS NULL THEN RAISE EXCEPTION 'gonderilmis surum yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p.status NOT IN ('sent', 'viewed') THEN RAISE EXCEPTION 'teklif bu durumda revize istenemez (%)', p.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.proposal_versions SET client_note = trim(p_note) WHERE id = v.id;
  UPDATE public.proposals SET status = 'revision_requested' WHERE id = p.id;
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8) RPC yetkileri
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.proposal_create(uuid, text, uuid, uuid, text, text, uuid)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.proposal_new_version(uuid)                                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.proposal_send(uuid, integer)                                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.proposal_revoke_link(uuid)                                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.proposal_set_status(uuid, text)                             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.internal_proposal_items_list(uuid)                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.internal_proposal_item_upsert(uuid, numeric, text)          FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proposal_create(uuid, text, uuid, uuid, text, text, uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proposal_new_version(uuid)                                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proposal_send(uuid, integer)                               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proposal_revoke_link(uuid)                                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proposal_set_status(uuid, text)                            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.internal_proposal_items_list(uuid)                         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.internal_proposal_item_upsert(uuid, numeric, text)         TO authenticated, service_role;
-- portal: anon + authenticated
REVOKE ALL ON FUNCTION public.portal_proposal_view(text)                      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portal_proposal_approve(text, text)             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portal_proposal_request_revision(text, text)    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_proposal_view(text)                   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portal_proposal_approve(text, text)          TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portal_proposal_request_revision(text, text) TO anon, authenticated, service_role;

COMMIT;
