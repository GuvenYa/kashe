-- =============================================================================
-- FAZ 7b / 01 — RFP (teklif talebi): rfps, rfp_items, rfp_invites + alici kurulus teklif erisimi (01 bolum 7, 04 madde 34b; 19 bolum 12)
--
-- KARARLAR (Guven, 8 Ekim 2026):
--   * RFP'yi etkinligi olan HER kurulus acar (kurum veya ajans; `events.manage` + FAZ 4a etkinligi). Satici yine yalniz ajans kurulusu
--     (7a kurali: 'organization' saglayicisi olan kurulus).
--   * KAPALI RFP: yalniz davetli ajanslar gorur ve yanitlar (`rfp_invites.provider_id`). E-posta daveti (Kashe disi ajans) 7b'de YOK
--     (`invited_email` sutunu ayrilmis, kullanilmaz).
--   * Butce ipucu (`rfp_items.budget_hint_min/max`) saticiya GORUNMEZ: sutun SELECT yetkisi yok; alici `rfp_detail` RPC'sinden okur.
--   * Secim (`rfp_award`): secilen teklif `approved` (onaylayan = alici kullanicinin adi), RFP `awarded`; diger yanitlarin TEKLIF durumu
--     degismez, davetleri `not_selected` olur.
--
-- DESEN (7a ile ayni): INSERT'ler yalniz RPC (bayrak `kashe.faz7_rpc`); durum yalniz RPC; RLS satir bazli; SECURITY DEFINER RPC'ler
-- `internal.assert_org_permission` + `internal.log_access`. RFP yaniti = `proposals` satiri (`rfp_id`, `source_type = rfp_response`,
-- `buyer_organization_id`); portal baglantisi ACILMAZ (alici Kashe icinde okur/onaylar). Alici kurulus teklifleri RLS ile okur
-- (yeni 5 parametreli `can_access_proposal_row`; eski 4 parametreli fonksiyon yerinde kalir — asama15 K5).
--
-- Idempotan (iki kez kosulabilir). Sapkali harf yok. VERI YAZMAZ.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Enum'lar
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfp_status') THEN
    CREATE TYPE public.rfp_status AS ENUM ('draft', 'sent', 'collecting', 'evaluating', 'awarded', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfp_invite_status') THEN
    CREATE TYPE public.rfp_invite_status AS ENUM ('sent', 'viewed', 'responded', 'declined', 'not_selected');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Tablolar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rfps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id            uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text,
  status              public.rfp_status NOT NULL DEFAULT 'draft',
  deadline            timestamptz,
  awarded_proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rfps_title_check CHECK (char_length(trim(title)) BETWEEN 2 AND 200)
);
COMMENT ON TABLE public.rfps IS 'FAZ 7b: teklif talebi (ALICI tarafi: kurum veya ajans). INSERT yalniz rfp_create; durum yalniz RPC.';
CREATE INDEX IF NOT EXISTS rfps_organization_id_idx ON public.rfps (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rfps_event_id_idx ON public.rfps (event_id);

CREATE TABLE IF NOT EXISTS public.rfp_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id           uuid NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  role_id          integer NOT NULL REFERENCES public.service_roles(id) ON DELETE RESTRICT,
  quantity         numeric(10,2) NOT NULL DEFAULT 1,
  is_required      boolean NOT NULL DEFAULT true,
  budget_hint_min  numeric(12,2),
  budget_hint_max  numeric(12,2),
  notes            text,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rfp_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT rfp_items_budget_check CHECK (budget_hint_min IS NULL OR budget_hint_max IS NULL OR budget_hint_min <= budget_hint_max)
);
COMMENT ON TABLE public.rfp_items IS 'FAZ 7b: RFP kalemi (rol, adet, zorunlu, butce ipucu — ipucu saticiya KAPALI sutun). Yalniz taslakta yazilir.';
CREATE INDEX IF NOT EXISTS rfp_items_rfp_id_idx ON public.rfp_items (rfp_id, sort_order);

CREATE TABLE IF NOT EXISTS public.rfp_invites (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id         uuid NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  provider_id    uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  invited_email  text,
  status         public.rfp_invite_status NOT NULL DEFAULT 'sent',
  proposal_id    uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  viewed_at      timestamptz,
  responded_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rfp_invites_rfp_provider_key UNIQUE (rfp_id, provider_id)
);
COMMENT ON TABLE public.rfp_invites IS 'FAZ 7b: davetli satici (ajans kurulusunun organization saglayicisi). INSERT yalniz rfp_invite; durum yalniz RPC. invited_email 7b''de kullanilmaz.';
CREATE INDEX IF NOT EXISTS rfp_invites_provider_id_idx ON public.rfp_invites (provider_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS rfp_invites_proposal_id_key ON public.rfp_invites (proposal_id) WHERE proposal_id IS NOT NULL;

-- proposals.rfp_id FK (sutun 7a'da acildi; rfps simdi var)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposals_rfp_id_fkey') THEN
    ALTER TABLE public.proposals ADD CONSTRAINT proposals_rfp_id_fkey FOREIGN KEY (rfp_id) REFERENCES public.rfps(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS proposals_rfp_id_idx ON public.proposals (rfp_id) WHERE rfp_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Tetikleyiciler (koruma): INSERT yalniz RPC; durum/baglar yalniz RPC; taslak disinda duzenleme yok
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz7b_rfp_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.title := trim(NEW.title);
  NEW.description := NULLIF(trim(NEW.description), '');
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    IF NOT public.fn_faz7_rpc_flag() THEN
      RAISE EXCEPTION 'teklif talebi yalniz rfp_create ile acilir' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    RAISE EXCEPTION 'teklif talebinin kurulusu ve etkinligi degistirilemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF public.fn_faz7_rpc_flag() THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.awarded_proposal_id IS DISTINCT FROM OLD.awarded_proposal_id THEN
    RAISE EXCEPTION 'durum yalniz RPC ile degisir' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'gonderilmis teklif talebi duzenlenemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_faz7b_rfp_before_write ON public.rfps;
CREATE TRIGGER trg_faz7b_rfp_before_write BEFORE INSERT OR UPDATE ON public.rfps
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz7b_rfp_before_write();

CREATE OR REPLACE FUNCTION public.fn_faz7b_rfp_status(p_rfp_id uuid)
RETURNS public.rfp_status LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT status FROM public.rfps WHERE id = p_rfp_id;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz7b_item_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rfp uuid := COALESCE(NEW.rfp_id, OLD.rfp_id);
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.rfp_id IS DISTINCT FROM OLD.rfp_id THEN
    RAISE EXCEPTION 'kalem baska talebe tasinamaz' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT public.fn_faz7_rpc_flag() AND public.fn_faz7b_rfp_status(v_rfp) <> 'draft' THEN
    RAISE EXCEPTION 'gonderilmis teklif talebinin kalemleri degismez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.notes := NULLIF(trim(NEW.notes), '');
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_faz7b_item_before_write ON public.rfp_items;
CREATE TRIGGER trg_faz7b_item_before_write BEFORE INSERT OR UPDATE OR DELETE ON public.rfp_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz7b_item_before_write();

CREATE OR REPLACE FUNCTION public.fn_faz7b_invite_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.fn_faz7_rpc_flag() THEN
    RAISE EXCEPTION 'davet yalniz RPC ile yazilir' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_faz7b_invite_before_write ON public.rfp_invites;
CREATE TRIGGER trg_faz7b_invite_before_write BEFORE INSERT OR UPDATE ON public.rfp_invites
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz7b_invite_before_write();

-- -----------------------------------------------------------------------------
-- 4. Erisim fonksiyonlari
-- -----------------------------------------------------------------------------
-- Cagiran kullanicinin, bu saglayicinin (ajans) kurulusunda izni var mi?
CREATE OR REPLACE FUNCTION public.fn_faz7b_provider_org_permission(p_provider_id uuid, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.providers pr
                  WHERE pr.id = p_provider_id AND pr.organization_id IS NOT NULL
                    AND public.has_org_permission(pr.organization_id, p_permission));
$$;

-- RFP satiri: alici kurulus (events.view/manage) | admin | davetli satici (taslak disinda, proposals.view)
CREATE OR REPLACE FUNCTION public.can_access_rfp_row(p_org_id uuid, p_rfp_id uuid, p_status public.rfp_status, p_mode text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_admin(auth.uid()) THEN true
    WHEN p_mode = 'manage' THEN public.has_org_permission(p_org_id, 'events.manage')
    WHEN public.has_org_permission(p_org_id, 'events.view') THEN true
    WHEN p_status <> 'draft' AND EXISTS (
           SELECT 1 FROM public.rfp_invites i WHERE i.rfp_id = p_rfp_id
              AND public.fn_faz7b_provider_org_permission(i.provider_id, 'proposals.view')) THEN true
    ELSE false
  END;
$$;
CREATE OR REPLACE FUNCTION public.can_access_rfp(p_rfp_id uuid, p_mode text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rfps r WHERE r.id = p_rfp_id
                   AND public.can_access_rfp_row(r.organization_id, r.id, r.status, p_mode));
$$;
-- Davet satiri: alici kurulus | admin | davetin saglayicisinin kurulusu (proposals.view)
CREATE OR REPLACE FUNCTION public.can_access_rfp_invite_row(p_rfp_id uuid, p_provider_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_admin(auth.uid()) THEN true
    WHEN EXISTS (SELECT 1 FROM public.rfps r WHERE r.id = p_rfp_id AND public.has_org_permission(r.organization_id, 'events.view')) THEN true
    WHEN public.fn_faz7b_provider_org_permission(p_provider_id, 'proposals.view') THEN true
    ELSE false
  END;
$$;

-- Teklif erisimi: 6 parametreli surum (alici kurulus eklendi; alici, EN AZ BIR SURUMU GONDERILMIS teklifi okur — satici yeni surum
-- taslagi acarken (status draft) alicinin gonderilmis surumu kaybolmaz; portal da ayni ilkeyle calisir). Eski 4 parametreli fonksiyon
-- YERINDE KALIR (asama15 K5; artik politikada kullanilmaz).
DROP POLICY IF EXISTS proposals_select ON public.proposals;   -- politika asagida yeniden kurulur (fonksiyon bagimliligi)
DROP FUNCTION IF EXISTS public.can_access_proposal_row(uuid, uuid, uuid, public.proposal_status, text);
CREATE OR REPLACE FUNCTION public.can_access_proposal_row(p_id uuid, p_seller_org uuid, p_buyer_user uuid, p_buyer_org uuid, p_status public.proposal_status, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_permission(p_seller_org, p_permission)
      OR (p_permission = 'proposals.view'
          AND ((p_buyer_user IS NOT NULL AND p_buyer_user = auth.uid())
            OR (p_buyer_org IS NOT NULL AND public.has_org_permission(p_buyer_org, 'events.view')))
          AND (p_status <> 'draft' OR EXISTS (SELECT 1 FROM public.proposal_versions v WHERE v.proposal_id = p_id AND v.sent_at IS NOT NULL)))
      OR public.is_admin(auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.can_access_proposal(p_proposal_id uuid, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = p_proposal_id
                   AND public.can_access_proposal_row(p.id, p.seller_organization_id, p.buyer_user_id, p.buyer_organization_id, p.status, p_permission));
$$;
CREATE OR REPLACE FUNCTION public.fn_faz7b_version_sent(p_version_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.proposal_versions v WHERE v.id = p_version_id AND v.sent_at IS NOT NULL);
$$;
-- Alici (kisi ya da kurulus) ve satici DEGIL: gizli kalemler ve gonderilmemis surumler gizlenir
CREATE OR REPLACE FUNCTION public.is_proposal_buyer(p_version_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.proposal_versions v JOIN public.proposals p ON p.id = v.proposal_id
                  WHERE v.id = p_version_id
                    AND ((p.buyer_user_id IS NOT NULL AND p.buyer_user_id = auth.uid())
                      OR (p.buyer_organization_id IS NOT NULL AND public.has_org_permission(p.buyer_organization_id, 'events.view')))
                    AND NOT public.has_org_permission(p.seller_organization_id, 'proposals.view') AND NOT public.is_admin(auth.uid()));
$$;

REVOKE ALL ON FUNCTION public.fn_faz7b_provider_org_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_rfp_row(uuid, uuid, public.rfp_status, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_rfp(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_rfp_invite_row(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_proposal_row(uuid, uuid, uuid, uuid, public.proposal_status, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_faz7b_version_sent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_faz7b_provider_org_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_rfp_row(uuid, uuid, public.rfp_status, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_rfp(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_rfp_invite_row(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_proposal_row(uuid, uuid, uuid, uuid, public.proposal_status, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_faz7b_version_sent(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Yetki + RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.rfps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfp_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfp_invites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rfps, public.rfp_items, public.rfp_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.rfps TO authenticated;
GRANT UPDATE (title, description, deadline) ON TABLE public.rfps TO authenticated;
GRANT SELECT (id, rfp_id, role_id, quantity, is_required, notes, sort_order, created_at, updated_at) ON TABLE public.rfp_items TO authenticated;
GRANT INSERT (rfp_id, role_id, quantity, is_required, budget_hint_min, budget_hint_max, notes, sort_order) ON TABLE public.rfp_items TO authenticated;
GRANT UPDATE (role_id, quantity, is_required, budget_hint_min, budget_hint_max, notes, sort_order) ON TABLE public.rfp_items TO authenticated;
GRANT DELETE ON TABLE public.rfp_items TO authenticated;
GRANT SELECT ON TABLE public.rfp_invites TO authenticated;

DROP POLICY IF EXISTS rfps_select ON public.rfps;
CREATE POLICY rfps_select ON public.rfps FOR SELECT TO authenticated
  USING (public.can_access_rfp_row(organization_id, id, status, 'view'));
DROP POLICY IF EXISTS rfps_update ON public.rfps;
CREATE POLICY rfps_update ON public.rfps FOR UPDATE TO authenticated
  USING (public.can_access_rfp_row(organization_id, id, status, 'manage'))
  WITH CHECK (public.can_access_rfp_row(organization_id, id, status, 'manage'));

DROP POLICY IF EXISTS rfp_items_select ON public.rfp_items;
CREATE POLICY rfp_items_select ON public.rfp_items FOR SELECT TO authenticated
  USING (public.can_access_rfp(rfp_id, 'view'));
DROP POLICY IF EXISTS rfp_items_insert ON public.rfp_items;
CREATE POLICY rfp_items_insert ON public.rfp_items FOR INSERT TO authenticated
  WITH CHECK (public.can_access_rfp(rfp_id, 'manage'));
DROP POLICY IF EXISTS rfp_items_update ON public.rfp_items;
CREATE POLICY rfp_items_update ON public.rfp_items FOR UPDATE TO authenticated
  USING (public.can_access_rfp(rfp_id, 'manage')) WITH CHECK (public.can_access_rfp(rfp_id, 'manage'));
DROP POLICY IF EXISTS rfp_items_delete ON public.rfp_items;
CREATE POLICY rfp_items_delete ON public.rfp_items FOR DELETE TO authenticated
  USING (public.can_access_rfp(rfp_id, 'manage'));

DROP POLICY IF EXISTS rfp_invites_select ON public.rfp_invites;
CREATE POLICY rfp_invites_select ON public.rfp_invites FOR SELECT TO authenticated
  USING (public.can_access_rfp_invite_row(rfp_id, provider_id));

-- Teklif politikalari: alici kurulus okur (6 parametreli); alici gonderilmemis surumu ve onun kalemlerini gormez, gizli kalemi gormez
DROP POLICY IF EXISTS proposals_select ON public.proposals;
CREATE POLICY proposals_select ON public.proposals FOR SELECT TO authenticated
  USING (public.can_access_proposal_row(id, seller_organization_id, buyer_user_id, buyer_organization_id, status, 'proposals.view'));
DROP POLICY IF EXISTS proposal_versions_select ON public.proposal_versions;
CREATE POLICY proposal_versions_select ON public.proposal_versions FOR SELECT TO authenticated
  USING (public.can_access_proposal(proposal_id, 'proposals.view') AND (sent_at IS NOT NULL OR NOT public.is_proposal_buyer(id)));
DROP POLICY IF EXISTS proposal_items_select ON public.proposal_items;
CREATE POLICY proposal_items_select ON public.proposal_items FOR SELECT TO authenticated
  USING (public.can_access_proposal_version(proposal_version_id, 'proposals.view')
         AND (NOT public.is_proposal_buyer(proposal_version_id)
              OR (is_visible_to_client AND public.fn_faz7b_version_sent(proposal_version_id))));

-- -----------------------------------------------------------------------------
-- 6. Bildirim yardimcisi (kurulusun izinli uyelerine)
--    notifications.type CHECK listesi 'rfp' ve 'proposal' ile genisletilir (eski degerler aynen; uygulama bilinmeyen tipi genel gosterir).
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['message'::text, 'review'::text, 'review_reply'::text, 'listing_invitation'::text, 'booking_request'::text, 'rfp'::text, 'proposal'::text]));

CREATE OR REPLACE FUNCTION public.fn_faz7b_notify_org(p_org_id uuid, p_permission text, p_link text, p_body text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; m record;
BEGIN
  FOR m IN
    SELECT om.user_id FROM public.organization_memberships om
     WHERE om.organization_id = p_org_id AND om.status = 'active'
       AND CASE WHEN om.permissions ? p_permission THEN (om.permissions ->> p_permission) = 'true'
                ELSE p_permission = ANY (public.org_role_permissions(om.role)) END
  LOOP
    INSERT INTO public.notifications (user_id, type, link, body) VALUES (m.user_id, 'rfp', p_link, p_body);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.fn_faz7b_notify_org(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- Cagiranin, bu RFP'ye davetli saglayicisi olan kurulusu (proposals.manage ya da view)
CREATE OR REPLACE FUNCTION public.fn_faz7b_my_invite(p_rfp_id uuid, p_permission text)
RETURNS public.rfp_invites LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.* FROM public.rfp_invites i
   WHERE i.rfp_id = p_rfp_id AND public.fn_faz7b_provider_org_permission(i.provider_id, p_permission)
   ORDER BY i.created_at LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.fn_faz7b_my_invite(uuid, text) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Alici RPC'leri
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rfp_create(p_org_id uuid, p_event_id uuid, p_title text, p_description text DEFAULT NULL, p_deadline timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE ev record; v_rfp uuid; n integer := 0;
BEGIN
  PERFORM internal.assert_org_permission(p_org_id, 'events.manage', 'rfps');
  SELECT id, organization_id, status INTO ev FROM public.events WHERE id = p_event_id;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'etkinlik yok' USING ERRCODE = 'no_data_found'; END IF;
  IF ev.organization_id IS DISTINCT FROM p_org_id THEN RAISE EXCEPTION 'etkinlik bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF ev.status = 'cancelled' THEN RAISE EXCEPTION 'iptal edilmis etkinlik icin talep acilamaz' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_title IS NULL OR char_length(trim(p_title)) NOT BETWEEN 2 AND 200 THEN RAISE EXCEPTION 'baslik 2-200 karakter olmali' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_deadline IS NOT NULL AND p_deadline <= now() THEN RAISE EXCEPTION 'son tarih gelecekte olmali' USING ERRCODE = 'invalid_parameter_value'; END IF;

  PERFORM set_config('kashe.faz7_rpc', '1', true);
  INSERT INTO public.rfps (organization_id, event_id, title, description, deadline)
  VALUES (p_org_id, p_event_id, p_title, p_description, p_deadline) RETURNING id INTO v_rfp;
  -- etkinlik gereksinimleri -> kalemler (butce ipuclari dahil)
  INSERT INTO public.rfp_items (rfp_id, role_id, quantity, is_required, budget_hint_min, budget_hint_max, notes, sort_order)
  SELECT v_rfp, r.role_id, GREATEST(COALESCE(r.quantity, 1), 1), COALESCE(r.is_required, true), r.budget_hint_min, r.budget_hint_max, r.notes,
         COALESCE(r.sort_order, 0)
    FROM public.event_requirements r WHERE r.event_id = p_event_id ORDER BY r.sort_order, r.created_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM internal.log_access(p_org_id, 'write', 'rfps', v_rfp, jsonb_build_object('op', 'rfp.create', 'items', n));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN v_rfp;
END $$;

CREATE OR REPLACE FUNCTION public.rfp_invite(p_rfp_id uuid, p_provider_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE r record; pr record; v_inv uuid;
BEGIN
  SELECT * INTO r FROM public.rfps WHERE id = p_rfp_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'teklif talebi yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(r.organization_id, 'events.manage', 'rfps', r.id);
  IF r.status NOT IN ('draft', 'sent', 'collecting') THEN RAISE EXCEPTION 'bu durumda davet eklenemez (%)', r.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT id, provider_type, organization_id INTO pr FROM public.providers WHERE id = p_provider_id;
  IF pr.id IS NULL THEN RAISE EXCEPTION 'saglayici yok' USING ERRCODE = 'no_data_found'; END IF;
  IF pr.provider_type <> 'organization' OR pr.organization_id IS NULL THEN RAISE EXCEPTION 'yalniz ajans kuruluslari davet edilir' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF pr.organization_id = r.organization_id THEN RAISE EXCEPTION 'kurulus kendini davet edemez' USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT id INTO v_inv FROM public.rfp_invites WHERE rfp_id = r.id AND provider_id = pr.id;
  IF v_inv IS NOT NULL THEN RETURN v_inv; END IF;   -- idempotan

  PERFORM set_config('kashe.faz7_rpc', '1', true);
  INSERT INTO public.rfp_invites (rfp_id, provider_id) VALUES (r.id, pr.id) RETURNING id INTO v_inv;
  IF r.status <> 'draft' THEN
    PERFORM public.fn_faz7b_notify_org(pr.organization_id, 'proposals.manage', '/ajans/rfp/' || r.id::text, 'Yeni teklif talebi: ' || r.title);
  END IF;
  PERFORM internal.log_access(r.organization_id, 'write', 'rfp_invites', v_inv, jsonb_build_object('op', 'rfp.invite', 'rfp_id', r.id, 'provider_id', pr.id));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN v_inv;
END $$;

CREATE OR REPLACE FUNCTION public.rfp_send(p_rfp_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE r record; n_items integer; n_inv integer; i record;
BEGIN
  SELECT * INTO r FROM public.rfps WHERE id = p_rfp_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'teklif talebi yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(r.organization_id, 'events.manage', 'rfps', r.id);
  IF r.status <> 'draft' THEN RAISE EXCEPTION 'yalniz taslak gonderilir (%)', r.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT count(*) INTO n_items FROM public.rfp_items WHERE rfp_id = r.id;
  SELECT count(*) INTO n_inv FROM public.rfp_invites WHERE rfp_id = r.id;
  IF n_items = 0 THEN RAISE EXCEPTION 'talepte kalem yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF n_inv = 0 THEN RAISE EXCEPTION 'davetli ajans yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF r.deadline IS NULL OR r.deadline <= now() THEN RAISE EXCEPTION 'son tarih gerekir ve gelecekte olmali' USING ERRCODE = 'invalid_parameter_value'; END IF;

  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.rfps SET status = 'sent' WHERE id = r.id;
  FOR i IN SELECT inv.id, pr.organization_id FROM public.rfp_invites inv JOIN public.providers pr ON pr.id = inv.provider_id WHERE inv.rfp_id = r.id LOOP
    PERFORM public.fn_faz7b_notify_org(i.organization_id, 'proposals.manage', '/ajans/rfp/' || r.id::text, 'Yeni teklif talebi: ' || r.title);
  END LOOP;
  PERFORM internal.log_access(r.organization_id, 'write', 'rfps', r.id, jsonb_build_object('op', 'rfp.send', 'invites', n_inv, 'items', n_items));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.rfp_close(p_rfp_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.rfps WHERE id = p_rfp_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'teklif talebi yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(r.organization_id, 'events.manage', 'rfps', r.id);
  IF r.status NOT IN ('sent', 'collecting') THEN RAISE EXCEPTION 'bu durumda degerlendirmeye alinamaz (%)', r.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.rfps SET status = 'evaluating' WHERE id = r.id;
  PERFORM internal.log_access(r.organization_id, 'write', 'rfps', r.id, jsonb_build_object('op', 'rfp.close'));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.rfp_cancel(p_rfp_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE r record; i record;
BEGIN
  SELECT * INTO r FROM public.rfps WHERE id = p_rfp_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'teklif talebi yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(r.organization_id, 'events.manage', 'rfps', r.id);
  IF r.status IN ('awarded', 'cancelled') THEN RAISE EXCEPTION 'bu durumda iptal edilemez (%)', r.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.rfps SET status = 'cancelled' WHERE id = r.id;
  UPDATE public.rfp_invites SET status = 'not_selected' WHERE rfp_id = r.id AND status IN ('sent', 'viewed', 'responded');
  IF r.status <> 'draft' THEN
    FOR i IN SELECT DISTINCT pr.organization_id FROM public.rfp_invites inv JOIN public.providers pr ON pr.id = inv.provider_id WHERE inv.rfp_id = r.id LOOP
      PERFORM public.fn_faz7b_notify_org(i.organization_id, 'proposals.manage', '/ajans/rfp/' || r.id::text, 'Teklif talebi iptal edildi: ' || r.title);
    END LOOP;
  END IF;
  PERFORM internal.log_access(r.organization_id, 'write', 'rfps', r.id, jsonb_build_object('op', 'rfp.cancel'));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.rfp_request_revision(p_proposal_id uuid, p_note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE p record; r record; v public.proposal_versions;
BEGIN
  SELECT * INTO p FROM public.proposals WHERE id = p_proposal_id;
  IF p.id IS NULL OR p.rfp_id IS NULL THEN RAISE EXCEPTION 'teklif talebi yaniti yok' USING ERRCODE = 'no_data_found'; END IF;
  SELECT * INTO r FROM public.rfps WHERE id = p.rfp_id;
  PERFORM internal.assert_org_permission(r.organization_id, 'events.manage', 'rfps', r.id);
  IF p_note IS NULL OR char_length(trim(p_note)) NOT BETWEEN 2 AND 4000 THEN RAISE EXCEPTION 'revizyon notu gerekir (2-4000 karakter)' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF r.status NOT IN ('sent', 'collecting', 'evaluating') THEN RAISE EXCEPTION 'talep bu durumda (%)', r.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  v := public.fn_faz7_last_sent_version(p.id);
  IF v.id IS NULL THEN RAISE EXCEPTION 'gonderilmis surum yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p.status NOT IN ('sent', 'viewed') THEN RAISE EXCEPTION 'teklif bu durumda revize istenemez (%)', p.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.proposal_versions SET client_note = trim(p_note) WHERE id = v.id;
  UPDATE public.proposals SET status = 'revision_requested' WHERE id = p.id;
  PERFORM public.fn_faz7b_notify_org(p.seller_organization_id, 'proposals.manage', '/ajans/teklifler/' || p.id::text, 'Teklifin icin revizyon istendi: ' || p.title);
  PERFORM internal.log_access(r.organization_id, 'write', 'proposals', p.id, jsonb_build_object('op', 'rfp.request_revision', 'rfp_id', r.id));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.rfp_award(p_rfp_id uuid, p_proposal_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE r record; p record; v public.proposal_versions; v_name text; i record;
BEGIN
  SELECT * INTO r FROM public.rfps WHERE id = p_rfp_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'teklif talebi yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(r.organization_id, 'events.manage', 'rfps', r.id);
  IF r.status NOT IN ('sent', 'collecting', 'evaluating') THEN RAISE EXCEPTION 'bu durumda secim yapilamaz (%)', r.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT * INTO p FROM public.proposals WHERE id = p_proposal_id;
  IF p.id IS NULL OR p.rfp_id IS DISTINCT FROM r.id THEN RAISE EXCEPTION 'teklif bu talebe ait degil' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p.status NOT IN ('sent', 'viewed') THEN RAISE EXCEPTION 'teklif bu durumda secilemez (%)', p.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  v := public.fn_faz7_last_sent_version(p.id);
  IF v.id IS NULL THEN RAISE EXCEPTION 'gonderilmis surum yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT NULLIF(trim(full_name), '') INTO v_name FROM public.profiles WHERE id = auth.uid();

  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.proposal_versions SET approved_by_name = COALESCE(v_name, 'Kurulus yetkilisi'), approved_at = now() WHERE id = v.id;
  UPDATE public.proposals SET status = 'approved' WHERE id = p.id;
  UPDATE public.rfps SET status = 'awarded', awarded_proposal_id = p.id WHERE id = r.id;
  UPDATE public.rfp_invites SET status = 'not_selected' WHERE rfp_id = r.id AND status IN ('sent', 'viewed', 'responded') AND (proposal_id IS DISTINCT FROM p.id);
  PERFORM public.fn_faz7b_notify_org(p.seller_organization_id, 'proposals.manage', '/ajans/teklifler/' || p.id::text, 'Teklifin kabul edildi: ' || p.title);
  FOR i IN SELECT DISTINCT pr.organization_id FROM public.rfp_invites inv JOIN public.providers pr ON pr.id = inv.provider_id
            WHERE inv.rfp_id = r.id AND inv.status = 'not_selected' AND pr.organization_id <> p.seller_organization_id LOOP
    PERFORM public.fn_faz7b_notify_org(i.organization_id, 'proposals.manage', '/ajans/rfp/' || r.id::text, 'Teklif talebi baska bir teklife verildi: ' || r.title);
  END LOOP;
  PERFORM internal.log_access(r.organization_id, 'write', 'rfps', r.id, jsonb_build_object('op', 'rfp.award', 'proposal_id', p.id, 'version_id', v.id));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN true;
END $$;

-- -----------------------------------------------------------------------------
-- 8. Satici RPC'leri
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rfp_mark_viewed(p_rfp_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.rfp_invites;
BEGIN
  inv := public.fn_faz7b_my_invite(p_rfp_id, 'proposals.view');
  IF inv.id IS NULL THEN RAISE EXCEPTION 'davet yok' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF inv.status = 'sent' THEN
    PERFORM set_config('kashe.faz7_rpc', '1', true);
    UPDATE public.rfp_invites SET status = 'viewed', viewed_at = now() WHERE id = inv.id;
    PERFORM set_config('kashe.faz7_rpc', '0', true);
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.rfp_invite_decline(p_rfp_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE inv public.rfp_invites; r record; pr record;
BEGIN
  inv := public.fn_faz7b_my_invite(p_rfp_id, 'proposals.manage');
  IF inv.id IS NULL THEN RAISE EXCEPTION 'davet yok' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF inv.status NOT IN ('sent', 'viewed') THEN RAISE EXCEPTION 'davet bu durumda reddedilemez (%)', inv.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT * INTO r FROM public.rfps WHERE id = inv.rfp_id;
  SELECT organization_id, display_name INTO pr FROM public.providers WHERE id = inv.provider_id;
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.rfp_invites SET status = 'declined', responded_at = now() WHERE id = inv.id;
  PERFORM public.fn_faz7b_notify_org(r.organization_id, 'events.manage', '/kurumsal/rfp/' || r.id::text, COALESCE(pr.display_name, 'Bir ajans') || ' daveti reddetti: ' || r.title);
  PERFORM internal.log_access(pr.organization_id, 'write', 'rfp_invites', inv.id, jsonb_build_object('op', 'rfp.decline', 'rfp_id', r.id));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.proposal_create_from_rfp(p_rfp_id uuid, p_org_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE r record; inv record; buyer_name text; v_prop uuid; v_ver uuid; it record; n integer := 0;
BEGIN
  SELECT * INTO r FROM public.rfps WHERE id = p_rfp_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'teklif talebi yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(p_org_id, 'proposals.manage', 'proposals');
  SELECT i.* INTO inv FROM public.rfp_invites i JOIN public.providers pr ON pr.id = i.provider_id
   WHERE i.rfp_id = r.id AND pr.organization_id = p_org_id;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'bu kurulus davetli degil' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF inv.proposal_id IS NOT NULL THEN RETURN inv.proposal_id; END IF;   -- idempotan: bir davete bir yanit
  IF inv.status NOT IN ('sent', 'viewed') THEN RAISE EXCEPTION 'davet bu durumda (%)', inv.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF r.status NOT IN ('sent', 'collecting') OR (r.deadline IS NOT NULL AND r.deadline <= now()) THEN
    RAISE EXCEPTION 'teklif talebi kapali' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT display_name INTO buyer_name FROM public.organizations WHERE id = r.organization_id;

  v_prop := public.proposal_create(p_org_id, r.title, r.event_id, NULL, buyer_name, NULL, NULL);
  SELECT current_version_id INTO v_ver FROM public.proposals WHERE id = v_prop;
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.proposals SET rfp_id = r.id, source_type = 'rfp_response', buyer_organization_id = r.organization_id WHERE id = v_prop;
  FOR it IN SELECT ri.role_id, sr.name_tr, ri.quantity, ri.sort_order FROM public.rfp_items ri JOIN public.service_roles sr ON sr.id = ri.role_id
             WHERE ri.rfp_id = r.id ORDER BY ri.sort_order, ri.created_at LOOP
    n := n + 1;
    INSERT INTO public.proposal_items (proposal_version_id, role_id, description, quantity, unit_client_price, sort_order)
    VALUES (v_ver, it.role_id, it.name_tr, it.quantity, 0, n);
  END LOOP;
  UPDATE public.rfp_invites SET proposal_id = v_prop, status = CASE WHEN status = 'sent' THEN 'viewed'::public.rfp_invite_status ELSE status END,
         viewed_at = COALESCE(viewed_at, now()) WHERE id = inv.id;
  PERFORM internal.log_access(p_org_id, 'write', 'proposals', v_prop, jsonb_build_object('op', 'proposal.create_from_rfp', 'rfp_id', r.id, 'items', n));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN v_prop;
END $$;

-- proposal_send: RFP yaniti dali (portal baglantisi YOK; davet responded; RFP collecting; alici bildirimi). Dogrudan teklif dali AYNEN 7a.
CREATE OR REPLACE FUNCTION public.proposal_send(p_proposal_id uuid, p_valid_days integer DEFAULT 14)
RETURNS TABLE(link_id uuid, token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal, extensions AS $$
DECLARE p record; v record; n_items integer; n_bad integer; v_token text; v_link uuid; v_exp timestamptz; r record; seller_name text;
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

  IF p.rfp_id IS NOT NULL THEN
    -- FAZ 7b: RFP yaniti — alici Kashe icinde okur; portal baglantisi acilmaz
    SELECT * INTO r FROM public.rfps WHERE id = p.rfp_id;
    IF r.id IS NULL OR r.status NOT IN ('sent', 'collecting') OR (r.deadline IS NOT NULL AND r.deadline <= now()) THEN
      RAISE EXCEPTION 'teklif talebi kapali' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    PERFORM set_config('kashe.faz7_rpc', '1', true);
    UPDATE public.proposal_versions
       SET sent_at = now(), valid_until = COALESCE(valid_until, now() + make_interval(days => p_valid_days))
     WHERE id = v.id;
    UPDATE public.proposals SET status = 'sent' WHERE id = p.id;
    UPDATE public.rfp_invites SET status = 'responded', responded_at = now(), proposal_id = p.id
     WHERE rfp_id = r.id AND provider_id = p.seller_provider_id;
    IF r.status = 'sent' THEN UPDATE public.rfps SET status = 'collecting' WHERE id = r.id; END IF;
    SELECT display_name INTO seller_name FROM public.providers WHERE id = p.seller_provider_id;
    PERFORM public.fn_faz7b_notify_org(r.organization_id, 'events.manage', '/kurumsal/rfp/' || r.id::text, COALESCE(seller_name, 'Bir ajans') || ' teklif gonderdi: ' || r.title);
    PERFORM internal.log_access(p.seller_organization_id, 'write', 'proposals', p.id, jsonb_build_object('op', 'proposal.send', 'version_id', v.id, 'rfp_id', r.id));
    PERFORM set_config('kashe.faz7_rpc', '0', true);
    RETURN QUERY SELECT NULL::uuid, NULL::text;
    RETURN;
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
END $$;

-- -----------------------------------------------------------------------------
-- 9. rfp_detail: role gore JSON (alici: butce ipuclari + davetler + yanit ozetleri; satici: ipucu yok + kendi daveti)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rfp_detail(p_rfp_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; is_buyer boolean; inv public.rfp_invites; ev jsonb; items jsonb; invites jsonb; buyer_name text; out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'oturum gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO r FROM public.rfps WHERE id = p_rfp_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'teklif talebi yok' USING ERRCODE = 'no_data_found'; END IF;
  is_buyer := public.has_org_permission(r.organization_id, 'events.view') OR public.is_admin(auth.uid());
  IF NOT is_buyer THEN
    inv := public.fn_faz7b_my_invite(r.id, 'proposals.view');
    IF inv.id IS NULL OR r.status = 'draft' THEN RAISE EXCEPTION 'erisim yok' USING ERRCODE = 'insufficient_privilege'; END IF;
  END IF;
  SELECT display_name INTO buyer_name FROM public.organizations WHERE id = r.organization_id;
  SELECT jsonb_build_object('id', e.id, 'title', e.title, 'event_type', et.name_tr, 'start_date', e.start_date, 'end_date', e.end_date,
                            'city', c.name, 'district', e.district, 'participant_count', e.participant_count)
    INTO ev FROM public.events e LEFT JOIN public.event_types et ON et.key = e.event_type LEFT JOIN public.turkish_cities c ON c.id = e.city_id
   WHERE e.id = r.event_id;
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object('id', i.id, 'role_id', i.role_id, 'role', sr.name_tr, 'quantity', i.quantity, 'is_required', i.is_required,
                              'notes', i.notes, 'sort_order', i.sort_order)
           || CASE WHEN is_buyer THEN jsonb_build_object('budget_hint_min', i.budget_hint_min, 'budget_hint_max', i.budget_hint_max) ELSE '{}'::jsonb END
           ORDER BY i.sort_order, i.created_at), '[]'::jsonb)
    INTO items FROM public.rfp_items i JOIN public.service_roles sr ON sr.id = i.role_id WHERE i.rfp_id = r.id;
  out := jsonb_build_object('id', r.id, 'title', r.title, 'description', r.description, 'status', r.status, 'deadline', r.deadline,
                            'organization_id', r.organization_id, 'buyer_name', buyer_name, 'event', ev, 'items', items,
                            'awarded_proposal_id', r.awarded_proposal_id, 'created_at', r.created_at, 'is_buyer', is_buyer);
  IF is_buyer THEN
    SELECT COALESCE(jsonb_agg(
             jsonb_build_object('id', x.id, 'provider_id', x.provider_id, 'seller_name', pr.display_name, 'status', x.status,
                                'proposal_id', x.proposal_id, 'viewed_at', x.viewed_at, 'responded_at', x.responded_at,
                                'proposal_status', p.status, 'version_no', v.version_no, 'subtotal', v.subtotal, 'tax_amount', v.tax_amount,
                                'total_amount', v.total_amount, 'valid_until', v.valid_until, 'sent_at', v.sent_at)
             ORDER BY x.created_at), '[]'::jsonb)
      INTO invites
      FROM public.rfp_invites x JOIN public.providers pr ON pr.id = x.provider_id
      LEFT JOIN public.proposals p ON p.id = x.proposal_id
      LEFT JOIN LATERAL (SELECT * FROM public.fn_faz7_last_sent_version(p.id)) v ON p.id IS NOT NULL
     WHERE x.rfp_id = r.id;
    out := out || jsonb_build_object('invites', invites);
  ELSE
    out := out || jsonb_build_object('my_invite', jsonb_build_object('id', inv.id, 'status', inv.status, 'proposal_id', inv.proposal_id,
                                                                     'viewed_at', inv.viewed_at, 'responded_at', inv.responded_at));
  END IF;
  RETURN out;
END $$;

-- -----------------------------------------------------------------------------
-- 10. RPC yetkileri
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.rfp_create(uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rfp_invite(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rfp_send(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rfp_close(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rfp_cancel(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rfp_request_revision(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rfp_award(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rfp_mark_viewed(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rfp_invite_decline(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.proposal_create_from_rfp(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rfp_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.proposal_send(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rfp_create(uuid, uuid, text, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rfp_invite(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rfp_send(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rfp_close(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rfp_cancel(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rfp_request_revision(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rfp_award(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rfp_mark_viewed(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rfp_invite_decline(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proposal_create_from_rfp(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rfp_detail(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proposal_send(uuid, integer) TO authenticated, service_role;

COMMIT;
