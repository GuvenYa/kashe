-- =============================================================================
-- FAZ 8c / DB 01 — Tedarikciler (suppliers + event_suppliers + ic maliyet) ve alici kisa listesi (supplier_shortlists)
-- Kaynak: docs/envanter/20-faz8-event-os-modulleri.md bolum 5; kararlar (Guven, 21 Ekim 2026):
--   kapsam: ajans tedarikci defteri + etkinlige tedarikci atama + alici kisa listesi (procurement_requests FAZ 9+);
--   tedarikci serbest kayit + istege bagli Kashe saglayici bagi; anlasilan tutar IC MALIYET (internal sema, commercial.*);
--   yeni yetki anahtarlari suppliers.view / suppliers.manage (owner, admin, project_manager, crew_coordinator: ikisi;
--   sales, finance: view; viewer: yok); kisa liste alicida events.view / events.manage.
--
-- Nesneler:
--   org_role_permissions         + 'suppliers.view' / 'suppliers.manage'
--   suppliers                    — kurulusun tedarikci kaydi (ad, kategori, iletisim KURULUS ICI, sehir, puan 1-5, not,
--                                istege bagli providers bagi — kendi saglayicisi olamaz; is_active arsiv)
--   event_suppliers              — etkinlige tedarikci atama (hizmet, durum planned/confirmed/cancelled, not, sira);
--                                etkinlik + tedarikci ayni kurulus; etkinlik basina tedarikci tekil; arsivdeki tedarikci atanamaz
--   internal.event_supplier_costs — anlasilan tutar (ic maliyet). YALNIZ RPC: internal_event_supplier_costs_list (commercial.view),
--                                internal_event_supplier_cost_set (commercial.manage; tutar NULL -> satir silinir); log_access
--   supplier_shortlists / supplier_shortlist_items — alici kisa listesi (adli liste, istege bagli etkinlik bagi; kalem = providers
--                                satiri + not); modul 'supplier_search'; kendi saglayicisi eklenemez
--   tetikleyiciler               — modul kapisi (22023), kurulus sabit, ayni kurulus kurallari, normalizasyon, confirmed_at,
--                                aktivite (entity_type supplier / event_supplier / shortlist; e-posta/telefon diff'e YAZILMAZ)
--   RLS                          — suppliers/event_suppliers: SELECT suppliers.view (admin dahil), yazma suppliers.manage;
--                                kisa liste: SELECT events.view (admin dahil), yazma events.manage
--   activity_logs                — entity_type CHECK + 'supplier', 'event_supplier', 'shortlist'
--   moduller                     — ajansta 'suppliers', business'ta 'supplier_search' varsayilan ACIK (dolum + yeni kurulus
--                                tetikleyicisi); org_module_set listesine 'supplier_search'
--   8b-P2 kurali                 — user_has_org_permission(uid, org, perm) + firsat sahibi crm.view tasimali (fn_faz8b_lead_validate)
-- Bildirim yok (8c'de). Idempotan (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS). Sapkali harf yok; yorumlar ASCII;
-- kullaniciya giden metinler Turkce karakterli.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Yetki anahtarlari: suppliers.view / suppliers.manage (diger anahtarlar AYNEN)
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
      'crm.view','crm.manage','suppliers.view','suppliers.manage']
    WHEN 'admin' THEN ARRAY[
      'events.view','events.manage','crew.view','crew.manage','talent.view','talent.manage',
      'commercial.view','commercial.manage','proposals.view','proposals.manage',
      'finance.view','finance.manage','settings.manage','members.manage',
      'crm.view','crm.manage','suppliers.view','suppliers.manage']
    WHEN 'sales' THEN ARRAY[
      'events.view','events.manage','crew.view','talent.view','proposals.view','proposals.manage',
      'crm.view','crm.manage','suppliers.view']
    WHEN 'project_manager' THEN ARRAY[
      'events.view','events.manage','crew.view','crew.manage','talent.view','talent.manage','proposals.view',
      'crm.view','suppliers.view','suppliers.manage']
    WHEN 'crew_coordinator' THEN ARRAY[
      'events.view','crew.view','crew.manage','talent.view','talent.manage',
      'suppliers.view','suppliers.manage']
    WHEN 'finance' THEN ARRAY[
      'events.view','crew.view','talent.view','commercial.view','commercial.manage',
      'proposals.view','finance.view','finance.manage',
      'crm.view','suppliers.view']
    WHEN 'viewer' THEN ARRAY['events.view','crew.view']
    ELSE ARRAY[]::text[]
  END
$$;

-- Belirli bir kullanici icin yetki (has_org_permission'in auth.uid() disi surumu; tetikleyici kurallari icin)
CREATE OR REPLACE FUNCTION public.user_has_org_permission(p_user_id uuid, p_org_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships om
     WHERE om.organization_id = p_org_id
       AND om.user_id = p_user_id
       AND om.status = 'active'
       AND CASE
             WHEN om.permissions ? p_permission THEN (om.permissions ->> p_permission) = 'true'
             ELSE p_permission = ANY (public.org_role_permissions(om.role))
           END
  )
$$;
REVOKE ALL ON FUNCTION public.user_has_org_permission(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_org_permission(uuid, uuid, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. suppliers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name               text NOT NULL,
  category           text NOT NULL DEFAULT 'other',
  contact_name       text,
  email              text,
  phone              text,
  website            text,
  city_id            integer REFERENCES public.turkish_cities(id) ON DELETE SET NULL,
  rating             smallint,
  notes              text,
  linked_provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  is_active          boolean NOT NULL DEFAULT true,
  created_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_name_check         CHECK (char_length(btrim(name)) BETWEEN 2 AND 200),
  CONSTRAINT suppliers_category_check     CHECK (category IN ('sound_light', 'stage_technical', 'catering', 'venue', 'transport',
                                                              'print_promo', 'decor', 'security', 'talent', 'other')),
  CONSTRAINT suppliers_contact_name_check CHECK (contact_name IS NULL OR char_length(contact_name) <= 120),
  CONSTRAINT suppliers_email_check        CHECK (email IS NULL OR (char_length(email) <= 254 AND email LIKE '%@%')),
  CONSTRAINT suppliers_phone_check        CHECK (phone IS NULL OR char_length(phone) <= 40),
  CONSTRAINT suppliers_website_check      CHECK (website IS NULL OR char_length(website) <= 300),
  CONSTRAINT suppliers_rating_check       CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  CONSTRAINT suppliers_notes_check        CHECK (notes IS NULL OR char_length(notes) <= 4000)
);
COMMENT ON TABLE public.suppliers IS
  'FAZ 8c: kurulusun tedarikci defteri. Iletisim kurulus ici (RLS suppliers.view). Istege bagli providers bagi (kendi saglayicisi olamaz). is_active=false arsiv (etkinlige atanamaz). Yazma dogrudan (RLS suppliers.manage), kurallar tetikleyicide.';

CREATE INDEX IF NOT EXISTS suppliers_org_name_idx     ON public.suppliers (organization_id, lower(name));
CREATE INDEX IF NOT EXISTS suppliers_org_category_idx ON public.suppliers (organization_id, category);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_org_provider_uidx ON public.suppliers (organization_id, linked_provider_id)
  WHERE linked_provider_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. event_suppliers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  supplier_id     uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  service         text,
  status          text NOT NULL DEFAULT 'planned',
  notes           text,
  sort_order      integer NOT NULL DEFAULT 0,
  confirmed_at    timestamptz,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_suppliers_service_check CHECK (service IS NULL OR char_length(service) <= 200),
  CONSTRAINT event_suppliers_status_check  CHECK (status IN ('planned', 'confirmed', 'cancelled')),
  CONSTRAINT event_suppliers_notes_check   CHECK (notes IS NULL OR char_length(notes) <= 2000),
  CONSTRAINT event_suppliers_event_supplier_key UNIQUE (event_id, supplier_id)
);
COMMENT ON TABLE public.event_suppliers IS
  'FAZ 8c: etkinlige tedarikci atama (hizmet, durum, not). Etkinlik ve tedarikci ayni kurulus; etkinlik basina tedarikci tekil. Tutar internal.event_supplier_costs (RPC, commercial.*).';

CREATE INDEX IF NOT EXISTS event_suppliers_event_idx    ON public.event_suppliers (event_id, sort_order);
CREATE INDEX IF NOT EXISTS event_suppliers_supplier_idx ON public.event_suppliers (supplier_id);
CREATE INDEX IF NOT EXISTS event_suppliers_org_idx      ON public.event_suppliers (organization_id, status);

-- -----------------------------------------------------------------------------
-- 4. internal.event_supplier_costs — anlasilan tutar (ic maliyet; yalniz RPC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internal.event_supplier_costs (
  event_supplier_id uuid PRIMARY KEY REFERENCES public.event_suppliers(id) ON DELETE CASCADE,
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agreed_amount     numeric(12,2) NOT NULL,
  currency          char(3) NOT NULL DEFAULT 'TRY',
  private_note      text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT esc_amount_check   CHECK (agreed_amount >= 0),
  CONSTRAINT esc_currency_check CHECK (currency = 'TRY'),
  CONSTRAINT esc_note_check     CHECK (private_note IS NULL OR char_length(private_note) <= 1000)
);
COMMENT ON TABLE internal.event_supplier_costs IS 'FAZ 8c: etkinlik tedarikcisinin anlasilan tutari (ic maliyet). Yalniz RPC (commercial.view / commercial.manage).';
REVOKE ALL ON TABLE internal.event_supplier_costs FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE internal.event_supplier_costs ENABLE ROW LEVEL SECURITY;   -- politika yok: yalniz SECURITY DEFINER RPC
CREATE INDEX IF NOT EXISTS esc_org_idx ON internal.event_supplier_costs (organization_id);

CREATE OR REPLACE FUNCTION internal.fn_faz8c_esc_org_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'internal', 'public' AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.event_suppliers WHERE id = NEW.event_supplier_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'etkinlik tedarikcisi yok' USING ERRCODE = 'no_data_found';
  END IF;
  NEW.organization_id := v_org;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz8c_esc_org_check ON internal.event_supplier_costs;
CREATE TRIGGER trg_faz8c_esc_org_check BEFORE INSERT OR UPDATE ON internal.event_supplier_costs
  FOR EACH ROW EXECUTE FUNCTION internal.fn_faz8c_esc_org_check();

CREATE OR REPLACE FUNCTION public.internal_event_supplier_costs_list(p_event_id uuid)
RETURNS TABLE (event_supplier_id uuid, agreed_amount numeric, currency char(3), private_note text, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.events WHERE id = p_event_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'kurulussuz etkinlikte ic goruntu yok' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  PERFORM internal.assert_org_permission(v_org, 'commercial.view', 'event_supplier_costs', p_event_id);
  PERFORM internal.log_access(v_org, 'read', 'event_supplier_costs', p_event_id, '{}'::jsonb);
  RETURN QUERY
    SELECT x.event_supplier_id, x.agreed_amount, x.currency, x.private_note, x.updated_at
      FROM internal.event_supplier_costs x JOIN public.event_suppliers es ON es.id = x.event_supplier_id
     WHERE es.event_id = p_event_id AND x.organization_id = v_org
     ORDER BY es.sort_order, es.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_event_supplier_cost_set(p_event_supplier_id uuid, p_amount numeric, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.event_suppliers WHERE id = p_event_supplier_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'etkinlik tedarikcisi yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(v_org, 'commercial.manage', 'event_supplier_costs', p_event_supplier_id);
  IF p_amount IS NULL THEN
    DELETE FROM internal.event_supplier_costs WHERE event_supplier_id = p_event_supplier_id;
    PERFORM internal.log_access(v_org, 'write', 'event_supplier_costs', p_event_supplier_id, jsonb_build_object('op', 'supplier.cost_clear'));
    RETURN p_event_supplier_id;
  END IF;
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'tutar 0 veya daha buyuk olmali' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO internal.event_supplier_costs (event_supplier_id, organization_id, agreed_amount, private_note, created_by)
  VALUES (p_event_supplier_id, v_org, p_amount, NULLIF(btrim(COALESCE(p_note, '')), ''), auth.uid())
  ON CONFLICT (event_supplier_id) DO UPDATE
    SET agreed_amount = EXCLUDED.agreed_amount, private_note = EXCLUDED.private_note, updated_at = now();
  PERFORM internal.log_access(v_org, 'write', 'event_supplier_costs', p_event_supplier_id, jsonb_build_object('op', 'supplier.cost'));
  RETURN p_event_supplier_id;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_event_supplier_costs_list(uuid)                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.internal_event_supplier_cost_set(uuid, numeric, text)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_event_supplier_costs_list(uuid)              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.internal_event_supplier_cost_set(uuid, numeric, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. supplier_shortlists + supplier_shortlist_items (alici kisa listesi)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_shortlists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  event_id        uuid REFERENCES public.events(id) ON DELETE SET NULL,
  notes           text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_shortlists_name_check  CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  CONSTRAINT supplier_shortlists_notes_check CHECK (notes IS NULL OR char_length(notes) <= 2000)
);
COMMENT ON TABLE public.supplier_shortlists IS
  'FAZ 8c: alici kisa listesi (kurulus; istege bagli etkinlik bagi). Kalemler supplier_shortlist_items (providers). Modul supplier_search. RLS events.view / events.manage.';
CREATE INDEX IF NOT EXISTS supplier_shortlists_org_idx   ON public.supplier_shortlists (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS supplier_shortlists_event_idx ON public.supplier_shortlists (event_id) WHERE event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.supplier_shortlist_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlist_id    uuid NOT NULL REFERENCES public.supplier_shortlists(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_id     uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  note            text,
  added_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_shortlist_items_note_check CHECK (note IS NULL OR char_length(note) <= 500),
  CONSTRAINT supplier_shortlist_items_key UNIQUE (shortlist_id, provider_id)
);
COMMENT ON TABLE public.supplier_shortlist_items IS
  'FAZ 8c: kisa liste kalemi = pazaryeri saglayicisi (providers) + not. organization_id listeden kopyalanir (RLS). Kendi saglayicisi eklenemez.';
CREATE INDEX IF NOT EXISTS supplier_shortlist_items_provider_idx ON public.supplier_shortlist_items (provider_id);
CREATE INDEX IF NOT EXISTS supplier_shortlist_items_org_idx      ON public.supplier_shortlist_items (organization_id);

-- -----------------------------------------------------------------------------
-- 6. Tetikleyiciler — kurallar
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz8c_supplier_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.org_module_enabled(NEW.organization_id, 'suppliers') THEN
      RAISE EXCEPTION 'suppliers modulu bu kurulusta kapali' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  ELSE
    IF NEW.organization_id <> OLD.organization_id THEN
      RAISE EXCEPTION 'tedarikcinin kurulusu degistirilemez' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;
  NEW.name         := btrim(NEW.name);
  NEW.contact_name := NULLIF(btrim(COALESCE(NEW.contact_name, '')), '');
  NEW.email        := NULLIF(lower(btrim(COALESCE(NEW.email, ''))), '');
  NEW.phone        := NULLIF(btrim(COALESCE(NEW.phone, '')), '');
  NEW.website      := NULLIF(btrim(COALESCE(NEW.website, '')), '');
  -- kendi saglayicisi kendi tedarikcisi olamaz
  IF NEW.linked_provider_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.providers WHERE id = NEW.linked_provider_id;
    IF v_org IS NOT NULL AND v_org = NEW.organization_id THEN
      RAISE EXCEPTION 'tedarikci kendi kurulusunun saglayicisi olamaz' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz8c_event_supplier_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid; v_active boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.org_module_enabled(NEW.organization_id, 'suppliers') THEN
      RAISE EXCEPTION 'suppliers modulu bu kurulusta kapali' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  ELSE
    IF NEW.organization_id <> OLD.organization_id THEN
      RAISE EXCEPTION 'atamanin kurulusu degistirilemez' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;
  NEW.service := NULLIF(btrim(COALESCE(NEW.service, '')), '');
  -- etkinlik ayni kurulusun olmali
  SELECT organization_id INTO v_org FROM public.events WHERE id = NEW.event_id;
  IF v_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'etkinlik bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- tedarikci ayni kurulusun olmali; yeni atamada arsivde olmamali
  SELECT organization_id, is_active INTO v_org, v_active FROM public.suppliers WHERE id = NEW.supplier_id;
  IF v_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'tedarikci bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id) AND NOT v_active THEN
    RAISE EXCEPTION 'tedarikci arsivde' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- confirmed_at durumla
  IF NEW.status = 'confirmed' THEN
    IF TG_OP = 'INSERT' OR OLD.status <> 'confirmed' OR NEW.confirmed_at IS NULL THEN NEW.confirmed_at := COALESCE(NEW.confirmed_at, now()); END IF;
  ELSE
    NEW.confirmed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz8c_shortlist_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.org_module_enabled(NEW.organization_id, 'supplier_search') THEN
      RAISE EXCEPTION 'supplier_search modulu bu kurulusta kapali' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  ELSE
    IF NEW.organization_id <> OLD.organization_id THEN
      RAISE EXCEPTION 'kisa listenin kurulusu degistirilemez' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;
  NEW.name := btrim(NEW.name);
  IF NEW.event_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.events WHERE id = NEW.event_id;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'etkinlik bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz8c_shortlist_item_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid; v_prov_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.supplier_shortlists WHERE id = NEW.shortlist_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'kisa liste yok' USING ERRCODE = 'no_data_found';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.shortlist_id <> OLD.shortlist_id THEN
    RAISE EXCEPTION 'kalem baska listeye tasinamaz' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  NEW.organization_id := v_org;              -- listeden kopya (RLS icin)
  IF TG_OP = 'INSERT' AND NEW.added_by IS NULL THEN NEW.added_by := auth.uid(); END IF;
  NEW.note := NULLIF(btrim(COALESCE(NEW.note, '')), '');
  SELECT organization_id INTO v_prov_org FROM public.providers WHERE id = NEW.provider_id;
  IF v_prov_org IS NOT NULL AND v_prov_org = v_org THEN
    RAISE EXCEPTION 'kendi saglayicin kisa listeye eklenemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Tetikleyiciler — aktivite (e-posta/telefon diff'e YAZILMAZ)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz8c_supplier_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_action text;
  v_diff jsonb := '{}'::jsonb;
  v_row public.suppliers;
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_diff := jsonb_build_object('name', NEW.name, 'category', NEW.category);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_diff := jsonb_build_object('name', OLD.name);
  ELSE
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      v_diff := v_diff || jsonb_build_object('name', jsonb_build_object('from', OLD.name, 'to', NEW.name)); END IF;
    IF NEW.category IS DISTINCT FROM OLD.category THEN
      v_diff := v_diff || jsonb_build_object('category', jsonb_build_object('from', OLD.category, 'to', NEW.category)); END IF;
    IF NEW.rating IS DISTINCT FROM OLD.rating THEN
      v_diff := v_diff || jsonb_build_object('rating', jsonb_build_object('from', OLD.rating, 'to', NEW.rating)); END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      v_diff := v_diff || jsonb_build_object('is_active', jsonb_build_object('from', OLD.is_active, 'to', NEW.is_active)); END IF;
    IF NEW.city_id IS DISTINCT FROM OLD.city_id THEN
      v_diff := v_diff || jsonb_build_object('city_id', jsonb_build_object('from', OLD.city_id, 'to', NEW.city_id)); END IF;
    IF NEW.contact_name IS DISTINCT FROM OLD.contact_name THEN v_diff := v_diff || jsonb_build_object('contact_name', true); END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN v_diff := v_diff || jsonb_build_object('email', true); END IF;
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN v_diff := v_diff || jsonb_build_object('phone', true); END IF;
    IF NEW.website IS DISTINCT FROM OLD.website THEN v_diff := v_diff || jsonb_build_object('website', true); END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN v_diff := v_diff || jsonb_build_object('notes', true); END IF;
    IF NEW.linked_provider_id IS DISTINCT FROM OLD.linked_provider_id THEN v_diff := v_diff || jsonb_build_object('linked', true); END IF;
    IF v_diff = '{}'::jsonb THEN RETURN NEW; END IF;
    v_action := 'updated';
  END IF;
  INSERT INTO public.activity_logs (organization_id, actor_user_id, entity_type, entity_id, action, diff)
  VALUES (v_row.organization_id, v_actor, 'supplier', v_row.id, v_action, v_diff);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz8c_event_supplier_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_action text;
  v_diff jsonb;
  v_row public.event_suppliers;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  -- etkinlikle birlikte silinirken (CASCADE) yazma: etkinlik artik yok
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.events WHERE id = v_row.event_id) THEN RETURN OLD; END IF;
  -- event_id diff'te: etkinlik sayfasinin aktivite akisi buradan suzer
  v_diff := jsonb_build_object('event_id', v_row.event_id, 'supplier_id', v_row.supplier_id);
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_diff := v_diff || jsonb_build_object('service', NEW.service, 'status', NEW.status);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_diff := v_diff || jsonb_build_object('service', OLD.service, 'status', OLD.status);
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_action := 'status_changed';
      v_diff := v_diff || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    IF NEW.service IS DISTINCT FROM OLD.service THEN
      v_diff := v_diff || jsonb_build_object('service', jsonb_build_object('from', OLD.service, 'to', NEW.service)); END IF;
    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id THEN
      v_diff := v_diff || jsonb_build_object('supplier_id', jsonb_build_object('from', OLD.supplier_id, 'to', NEW.supplier_id)); END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN v_diff := v_diff || jsonb_build_object('notes', true); END IF;
    IF v_action IS NULL AND NEW.service IS NOT DISTINCT FROM OLD.service AND NEW.supplier_id IS NOT DISTINCT FROM OLD.supplier_id
       AND NEW.notes IS NOT DISTINCT FROM OLD.notes THEN
      RETURN NEW;   -- yalniz sira / zaman damgasi
    END IF;
    v_action := COALESCE(v_action, 'updated');
  END IF;
  INSERT INTO public.activity_logs (organization_id, actor_user_id, entity_type, entity_id, action, diff)
  VALUES (v_row.organization_id, v_actor, 'event_supplier', v_row.id, v_action, v_diff);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz8c_shortlist_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_action text;
  v_diff jsonb := '{}'::jsonb;
  v_row public.supplier_shortlists;
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_diff := jsonb_build_object('name', NEW.name, 'event_id', NEW.event_id);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_diff := jsonb_build_object('name', OLD.name);
  ELSE
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      v_diff := v_diff || jsonb_build_object('name', jsonb_build_object('from', OLD.name, 'to', NEW.name)); END IF;
    IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
      v_diff := v_diff || jsonb_build_object('event_id', jsonb_build_object('from', OLD.event_id, 'to', NEW.event_id)); END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN v_diff := v_diff || jsonb_build_object('notes', true); END IF;
    IF v_diff = '{}'::jsonb THEN RETURN NEW; END IF;
    v_action := 'updated';
  END IF;
  INSERT INTO public.activity_logs (organization_id, actor_user_id, entity_type, entity_id, action, diff)
  VALUES (v_row.organization_id, v_actor, 'shortlist', v_row.id, v_action, v_diff);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- kalem ekleme/cikarma listenin aktivitesine yazilir (entity = shortlist; action 'updated')
CREATE OR REPLACE FUNCTION public.fn_faz8c_shortlist_item_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_row public.supplier_shortlist_items;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  -- listeyle birlikte silinirken (CASCADE) yazma: liste artik yok. (pg_trigger_depth cascade'de 1 kalir; o yuzden varlik kontrolu.)
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.supplier_shortlists WHERE id = v_row.shortlist_id) THEN RETURN OLD; END IF;
  INSERT INTO public.activity_logs (organization_id, actor_user_id, entity_type, entity_id, action, diff)
  VALUES (v_row.organization_id, auth.uid(), 'shortlist', v_row.shortlist_id, 'updated',
          jsonb_build_object(CASE WHEN TG_OP = 'DELETE' THEN 'item_removed' ELSE 'item_added' END, v_row.provider_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_faz8c_supplier_validate ON public.suppliers;
CREATE TRIGGER trg_faz8c_supplier_validate BEFORE INSERT OR UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8c_supplier_validate();
DROP TRIGGER IF EXISTS trg_faz8c_supplier_activity ON public.suppliers;
CREATE TRIGGER trg_faz8c_supplier_activity AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8c_supplier_activity();

DROP TRIGGER IF EXISTS trg_faz8c_event_supplier_validate ON public.event_suppliers;
CREATE TRIGGER trg_faz8c_event_supplier_validate BEFORE INSERT OR UPDATE ON public.event_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8c_event_supplier_validate();
DROP TRIGGER IF EXISTS trg_faz8c_event_supplier_activity ON public.event_suppliers;
CREATE TRIGGER trg_faz8c_event_supplier_activity AFTER INSERT OR UPDATE OR DELETE ON public.event_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8c_event_supplier_activity();

DROP TRIGGER IF EXISTS trg_faz8c_shortlist_validate ON public.supplier_shortlists;
CREATE TRIGGER trg_faz8c_shortlist_validate BEFORE INSERT OR UPDATE ON public.supplier_shortlists
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8c_shortlist_validate();
DROP TRIGGER IF EXISTS trg_faz8c_shortlist_activity ON public.supplier_shortlists;
CREATE TRIGGER trg_faz8c_shortlist_activity AFTER INSERT OR UPDATE OR DELETE ON public.supplier_shortlists
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8c_shortlist_activity();

DROP TRIGGER IF EXISTS trg_faz8c_shortlist_item_validate ON public.supplier_shortlist_items;
CREATE TRIGGER trg_faz8c_shortlist_item_validate BEFORE INSERT OR UPDATE ON public.supplier_shortlist_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8c_shortlist_item_validate();
DROP TRIGGER IF EXISTS trg_faz8c_shortlist_item_activity ON public.supplier_shortlist_items;
CREATE TRIGGER trg_faz8c_shortlist_item_activity AFTER INSERT OR DELETE ON public.supplier_shortlist_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz8c_shortlist_item_activity();

-- -----------------------------------------------------------------------------
-- 8. activity_logs entity_type
-- -----------------------------------------------------------------------------
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_entity_type_check;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_entity_type_check
  CHECK (entity_type IN ('task', 'event', 'proposal', 'rfp', 'booking', 'membership', 'crew', 'contact', 'lead',
                         'supplier', 'event_supplier', 'shortlist'));

-- -----------------------------------------------------------------------------
-- 9. RLS + yetki
-- -----------------------------------------------------------------------------
ALTER TABLE public.suppliers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_suppliers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_shortlists     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_shortlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suppliers_select ON public.suppliers;
CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated
  USING (public.has_org_permission(organization_id, 'suppliers.view') OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS suppliers_insert ON public.suppliers;
CREATE POLICY suppliers_insert ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (public.has_org_permission(organization_id, 'suppliers.manage'));
DROP POLICY IF EXISTS suppliers_update ON public.suppliers;
CREATE POLICY suppliers_update ON public.suppliers FOR UPDATE TO authenticated
  USING (public.has_org_permission(organization_id, 'suppliers.manage'))
  WITH CHECK (public.has_org_permission(organization_id, 'suppliers.manage'));
DROP POLICY IF EXISTS suppliers_delete ON public.suppliers;
CREATE POLICY suppliers_delete ON public.suppliers FOR DELETE TO authenticated
  USING (public.has_org_permission(organization_id, 'suppliers.manage'));

DROP POLICY IF EXISTS event_suppliers_select ON public.event_suppliers;
CREATE POLICY event_suppliers_select ON public.event_suppliers FOR SELECT TO authenticated
  USING (public.has_org_permission(organization_id, 'suppliers.view') OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS event_suppliers_insert ON public.event_suppliers;
CREATE POLICY event_suppliers_insert ON public.event_suppliers FOR INSERT TO authenticated
  WITH CHECK (public.has_org_permission(organization_id, 'suppliers.manage'));
DROP POLICY IF EXISTS event_suppliers_update ON public.event_suppliers;
CREATE POLICY event_suppliers_update ON public.event_suppliers FOR UPDATE TO authenticated
  USING (public.has_org_permission(organization_id, 'suppliers.manage'))
  WITH CHECK (public.has_org_permission(organization_id, 'suppliers.manage'));
DROP POLICY IF EXISTS event_suppliers_delete ON public.event_suppliers;
CREATE POLICY event_suppliers_delete ON public.event_suppliers FOR DELETE TO authenticated
  USING (public.has_org_permission(organization_id, 'suppliers.manage'));

DROP POLICY IF EXISTS supplier_shortlists_select ON public.supplier_shortlists;
CREATE POLICY supplier_shortlists_select ON public.supplier_shortlists FOR SELECT TO authenticated
  USING (public.has_org_permission(organization_id, 'events.view') OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS supplier_shortlists_insert ON public.supplier_shortlists;
CREATE POLICY supplier_shortlists_insert ON public.supplier_shortlists FOR INSERT TO authenticated
  WITH CHECK (public.has_org_permission(organization_id, 'events.manage'));
DROP POLICY IF EXISTS supplier_shortlists_update ON public.supplier_shortlists;
CREATE POLICY supplier_shortlists_update ON public.supplier_shortlists FOR UPDATE TO authenticated
  USING (public.has_org_permission(organization_id, 'events.manage'))
  WITH CHECK (public.has_org_permission(organization_id, 'events.manage'));
DROP POLICY IF EXISTS supplier_shortlists_delete ON public.supplier_shortlists;
CREATE POLICY supplier_shortlists_delete ON public.supplier_shortlists FOR DELETE TO authenticated
  USING (public.has_org_permission(organization_id, 'events.manage'));

-- kalem: organization_id tetikleyicide listeden kopyalanir; INSERT'te istemcinin gonderdigi deger ezilir.
-- WITH CHECK listenin kurulusuna bakar (tetikleyici BEFORE calisir, NEW.organization_id dogrudur).
DROP POLICY IF EXISTS supplier_shortlist_items_select ON public.supplier_shortlist_items;
CREATE POLICY supplier_shortlist_items_select ON public.supplier_shortlist_items FOR SELECT TO authenticated
  USING (public.has_org_permission(organization_id, 'events.view') OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS supplier_shortlist_items_insert ON public.supplier_shortlist_items;
CREATE POLICY supplier_shortlist_items_insert ON public.supplier_shortlist_items FOR INSERT TO authenticated
  WITH CHECK (public.has_org_permission(organization_id, 'events.manage'));
DROP POLICY IF EXISTS supplier_shortlist_items_update ON public.supplier_shortlist_items;
CREATE POLICY supplier_shortlist_items_update ON public.supplier_shortlist_items FOR UPDATE TO authenticated
  USING (public.has_org_permission(organization_id, 'events.manage'))
  WITH CHECK (public.has_org_permission(organization_id, 'events.manage'));
DROP POLICY IF EXISTS supplier_shortlist_items_delete ON public.supplier_shortlist_items;
CREATE POLICY supplier_shortlist_items_delete ON public.supplier_shortlist_items FOR DELETE TO authenticated
  USING (public.has_org_permission(organization_id, 'events.manage'));

REVOKE ALL ON public.suppliers, public.event_suppliers, public.supplier_shortlists, public.supplier_shortlist_items
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers, public.event_suppliers, public.supplier_shortlists, public.supplier_shortlist_items
  TO authenticated;
GRANT ALL ON public.suppliers, public.event_suppliers, public.supplier_shortlists, public.supplier_shortlist_items TO service_role;

-- -----------------------------------------------------------------------------
-- 10. Moduller: ajansta 'suppliers', business'ta 'supplier_search' varsayilan ACIK; org_module_set listesi
-- -----------------------------------------------------------------------------
INSERT INTO public.organization_modules (organization_id, module_key, is_enabled, enabled_at)
SELECT o.id, 'suppliers', true, now() FROM public.organizations o WHERE o.account_type = 'agency'
ON CONFLICT (organization_id, module_key) DO NOTHING;
INSERT INTO public.organization_modules (organization_id, module_key, is_enabled, enabled_at)
SELECT o.id, 'supplier_search', true, now() FROM public.organizations o WHERE o.account_type = 'business'
ON CONFLICT (organization_id, module_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_faz5_default_modules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.account_type = 'agency' THEN
    INSERT INTO public.organization_modules (organization_id, module_key, is_enabled, enabled_at)
    VALUES (NEW.id, 'talent_pool', true, now()), (NEW.id, 'tasks', true, now()), (NEW.id, 'crm', true, now()),
           (NEW.id, 'suppliers', true, now())
    ON CONFLICT (organization_id, module_key) DO NOTHING;
  ELSIF NEW.account_type = 'business' THEN
    INSERT INTO public.organization_modules (organization_id, module_key, is_enabled, enabled_at)
    VALUES (NEW.id, 'supplier_search', true, now())
    ON CONFLICT (organization_id, module_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.org_module_set(p_org_id uuid, p_module_key text, p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'oturum gerekir' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM internal.assert_org_permission(p_org_id, 'settings.manage', 'organization_modules', p_org_id);
  IF p_module_key NOT IN ('tasks', 'crm', 'suppliers', 'supplier_search') THEN
    RAISE EXCEPTION 'bu modul buradan acilamaz: %', p_module_key USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO public.organization_modules (organization_id, module_key, is_enabled, enabled_at, enabled_by)
  VALUES (p_org_id, p_module_key, p_enabled, CASE WHEN p_enabled THEN now() END, auth.uid())
  ON CONFLICT (organization_id, module_key) DO UPDATE
    SET is_enabled = EXCLUDED.is_enabled,
        enabled_at = CASE WHEN EXCLUDED.is_enabled THEN now() ELSE organization_modules.enabled_at END,
        enabled_by = auth.uid();
  PERFORM internal.log_access(p_org_id, 'write', 'organization_modules', p_org_id,
                              jsonb_build_object('op', 'module.set', 'module', p_module_key, 'enabled', p_enabled));
  RETURN p_enabled;
END;
$$;
COMMENT ON FUNCTION public.org_module_set(uuid, text, boolean) IS
  'FAZ 8a/8c: kurulus modulunu ac/kapat (settings.manage). Yalniz tasks/crm/suppliers/supplier_search; talent_pool FAZ 5 kurali ile kalir.';

-- -----------------------------------------------------------------------------
-- 11. 8b-P2 kurali: firsat sahibi crm.view tasimali (bildirim alip 403 gormesin) — fn_faz8b_lead_validate AYNEN + 1 kural
-- -----------------------------------------------------------------------------
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
  SELECT organization_id INTO v_org FROM public.contacts WHERE id = NEW.contact_id;
  IF v_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'kisi bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NEW.event_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.events WHERE id = NEW.event_id;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'etkinlik bu kurulusa ait degil' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;
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
  -- sahip: crm.view tasimali (8c ile eklendi; sahip degisince kontrol — eski kayitlar dokunulmadan kalir)
  IF NEW.owner_user_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id)
     AND NOT public.user_has_org_permission(NEW.owner_user_id, NEW.organization_id, 'crm.view') THEN
    RAISE EXCEPTION 'sahibin crm yetkisi yok' USING ERRCODE = 'invalid_parameter_value';
  END IF;
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

COMMIT;
