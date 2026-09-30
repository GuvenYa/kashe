-- =============================================================================
-- FAZ 5 / 01 — Yetenek havuzu: organization_talent_records, roller, gizli oranlar, modul kapisi,
--               kimlik aynasi + esleme, davet/claim RPC'leri, RLS
--
-- Kaynak: 01-veri-modeli.md bolum 3 (yetenek ve havuz, tekillestirme, claim) ve bolum 8 (internal oranlar),
--         02-guvenlik-modeli.md, 04-goc-plani.md FAZ 5 madde 27-30, 17-faz5-yetenek-havuzu.md (kararlar 30 Eylul).
--
-- NE YAPAR (sema + kucuk seed; agency_members DOLUMU 02'de):
--   enum x6                                  talent_record_source/visibility/relationship/status/invitation, talent_cost_basis
--   organization_talent_records              kurulusun yerel havuz kaydi (Kashe uyesi: talent_id dolu; harici: NULL)
--   organization_talent_record_roles         kayit x rol (service_roles), tek birincil
--   internal.organization_talent_rates       gizli ic oran (internal sema; yalniz RPC)
--   org_module_enabled()                     organization_modules kapisi; talent_pool yalniz agency (seed + tetikleyici)
--   talents.canonical_email/phone aynasi     profiles -> talents (kapali sutunlar; esleme yalniz RPC ile)
--   find_talent_by_contact()                 e-posta/telefon -> talent_id (PII donmez; denetlenir)
--   send_talent_record_invitation()          token uretir (token sutunu istemciye acik DEGIL)
--   claim_talent_record() / _by_id()         dogrulanmis e-posta ile kaydi sahiplenme; decline; claimable_..._for_me()
--   internal_talent_rates_list/upsert/close  assert -> log -> sorgu (commercial.view / commercial.manage)
--   RLS: talent.view okur (admin okur), talent.manage yazar; modul kapali ise hicbir sey; anon hic.
--
-- Idempotan. Sapkali harf yok. VERI: yalniz organization_modules seed'i (mevcut ajans kuruluslari icin talent_pool acik).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Enum'lar
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_record_source' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.talent_record_source AS ENUM ('marketplace_linked', 'invited', 'external_manual', 'imported');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_record_visibility' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.talent_record_visibility AS ENUM ('private', 'shared_to_marketplace');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_relationship_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.talent_relationship_type AS ENUM ('staff', 'regular_freelancer', 'occasional', 'subcontractor');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_record_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.talent_record_status AS ENUM ('active', 'passive', 'blocked');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_invitation_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.talent_invitation_status AS ENUM ('none', 'sent', 'accepted', 'declined');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_cost_basis' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.talent_cost_basis AS ENUM ('per_job', 'per_hour', 'per_day');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Yardimcilar: normallestirme + modul kapisi
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.norm_email(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(lower(trim(p)), '')
$$;

-- Telefon: yalniz rakamlar; son 10 hane (Turkiye: 5xx xxx xx xx). 10 haneden kisa ise NULL.
CREATE OR REPLACE FUNCTION public.norm_phone(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN length(d) >= 10 THEN right(d, 10) ELSE NULL END
    FROM (SELECT regexp_replace(COALESCE(p, ''), '[^0-9]', '', 'g') AS d) x
$$;

CREATE OR REPLACE FUNCTION public.org_module_enabled(p_org_id uuid, p_module_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_modules m
     WHERE m.organization_id = p_org_id AND m.module_key = p_module_key AND m.is_enabled
  )
$$;
REVOKE ALL ON FUNCTION public.org_module_enabled(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_module_enabled(uuid, text) TO authenticated, service_role;

-- talent_pool modulu: yalniz agency kuruluslarinda acik (business'a ASLA — 01 bolum 1 kurali)
INSERT INTO public.organization_modules (organization_id, module_key, is_enabled, enabled_at)
SELECT o.id, 'talent_pool', true, now()
  FROM public.organizations o
 WHERE o.account_type = 'agency'
ON CONFLICT (organization_id, module_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_faz5_default_modules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.account_type = 'agency' THEN
    INSERT INTO public.organization_modules (organization_id, module_key, is_enabled, enabled_at)
    VALUES (NEW.id, 'talent_pool', true, now())
    ON CONFLICT (organization_id, module_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz5_default_modules ON public.organizations;
CREATE TRIGGER trg_faz5_default_modules AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz5_default_modules();

-- -----------------------------------------------------------------------------
-- 3) organization_talent_records + roller
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_talent_records (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  talent_id               uuid REFERENCES public.talents(id) ON DELETE SET NULL,
  name                    text NOT NULL,
  email                   text,
  phone                   text,
  city_id                 integer REFERENCES public.turkish_cities(id) ON DELETE SET NULL,
  instagram               text,
  notes                   text,
  source                  public.talent_record_source NOT NULL DEFAULT 'external_manual',
  visibility              public.talent_record_visibility NOT NULL DEFAULT 'private',
  relationship_type       public.talent_relationship_type NOT NULL DEFAULT 'regular_freelancer',
  status                  public.talent_record_status NOT NULL DEFAULT 'active',
  invitation_status       public.talent_invitation_status NOT NULL DEFAULT 'none',
  invitation_sent_at      timestamptz,
  invitation_token        uuid,
  invitation_expires_at   timestamptz,
  linked_at               timestamptz,
  legacy_agency_member_id uuid,
  created_by              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT otr_name_check            CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  CONSTRAINT otr_external_no_talent    CHECK (NOT (source = 'external_manual' AND talent_id IS NOT NULL)),
  CONSTRAINT otr_token_only_when_sent  CHECK (invitation_token IS NULL OR invitation_status = 'sent'),
  CONSTRAINT otr_visibility_faz5_check CHECK (visibility = 'private'),   -- FAZ 8+: pazaryerine acma karari ile kaldirilir
  CONSTRAINT otr_instagram_check       CHECK (instagram IS NULL OR char_length(instagram) <= 100),
  CONSTRAINT otr_notes_check           CHECK (notes IS NULL OR char_length(notes) <= 4000)
);
CREATE UNIQUE INDEX IF NOT EXISTS otr_org_talent_key ON public.organization_talent_records (organization_id, talent_id) WHERE talent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS otr_invitation_token_key ON public.organization_talent_records (invitation_token) WHERE invitation_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS otr_legacy_agency_member_key ON public.organization_talent_records (legacy_agency_member_id) WHERE legacy_agency_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS otr_org_status_idx ON public.organization_talent_records (organization_id, status);
CREATE INDEX IF NOT EXISTS otr_email_norm_idx ON public.organization_talent_records (public.norm_email(email)) WHERE email IS NOT NULL;
COMMENT ON TABLE public.organization_talent_records IS 'FAZ 5: kurulusun yetenek havuzu kaydi. talent_id dolu = Kashe uyesi, NULL = harici kisi. Yalniz kurulusun talent.manage uyesi yazar.';
COMMENT ON COLUMN public.organization_talent_records.invitation_token IS 'Davet baglantisi tokeni; istemciye ACIK DEGIL (sutun yetkisi yok). Yalniz send_talent_record_invitation uretir, claim/decline tuketir.';

DROP TRIGGER IF EXISTS on_organization_talent_records_updated ON public.organization_talent_records;
CREATE TRIGGER on_organization_talent_records_updated BEFORE UPDATE ON public.organization_talent_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- BEFORE INSERT: created_by = cagiran; talent_id doluysa linked_at
CREATE OR REPLACE FUNCTION public.fn_faz5_record_before_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.created_by := auth.uid(); END IF;
  IF NEW.talent_id IS NOT NULL THEN
    NEW.linked_at := COALESCE(NEW.linked_at, now());
    IF NEW.source = 'external_manual' THEN NEW.source := 'marketplace_linked'; END IF;
  END IF;
  NEW.name := trim(NEW.name);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz5_record_before_insert ON public.organization_talent_records;
CREATE TRIGGER trg_faz5_record_before_insert BEFORE INSERT ON public.organization_talent_records
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz5_record_before_insert();

-- BEFORE UPDATE: kurulus ve dolum izi degismez; talent_id yalniz NULL -> deger (baglama), sonra sabit
CREATE OR REPLACE FUNCTION public.fn_faz5_record_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'havuz kaydinin kurulusu degistirilemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- dolum izi bir kez yazilir (NULL -> deger; dolum fonksiyonu), sonra degismez
  IF OLD.legacy_agency_member_id IS NOT NULL AND NEW.legacy_agency_member_id IS DISTINCT FROM OLD.legacy_agency_member_id THEN
    RAISE EXCEPTION 'legacy_agency_member_id degistirilemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF OLD.talent_id IS NOT NULL AND NEW.talent_id IS DISTINCT FROM OLD.talent_id THEN
    RAISE EXCEPTION 'bagli Kashe kimligi degistirilemez (birlestirme FAZ 8)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF OLD.talent_id IS NULL AND NEW.talent_id IS NOT NULL THEN
    NEW.linked_at := COALESCE(NEW.linked_at, now());
    IF NEW.source = 'external_manual' THEN NEW.source := 'marketplace_linked'; END IF;
  END IF;
  NEW.name := trim(NEW.name);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz5_record_guard ON public.organization_talent_records;
CREATE TRIGGER trg_faz5_record_guard BEFORE UPDATE ON public.organization_talent_records
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz5_record_guard();

CREATE TABLE IF NOT EXISTS public.organization_talent_record_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   uuid NOT NULL REFERENCES public.organization_talent_records(id) ON DELETE CASCADE,
  role_id     integer NOT NULL REFERENCES public.service_roles(id) ON DELETE RESTRICT,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT otrr_record_role_key UNIQUE (record_id, role_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS otrr_one_primary_idx ON public.organization_talent_record_roles (record_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS otrr_role_idx ON public.organization_talent_record_roles (role_id);
COMMENT ON TABLE public.organization_talent_record_roles IS 'FAZ 5: havuz kaydi x rol (service_roles). Kayit basina tek birincil.';

-- -----------------------------------------------------------------------------
-- 4) internal.organization_talent_rates (gizli ic oran; yalniz RPC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internal.organization_talent_rates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  talent_record_id  uuid NOT NULL REFERENCES public.organization_talent_records(id) ON DELETE CASCADE,
  role_id           integer NOT NULL REFERENCES public.service_roles(id) ON DELETE RESTRICT,
  default_cost      numeric NOT NULL CHECK (default_cost >= 0),
  cost_basis        public.talent_cost_basis NOT NULL DEFAULT 'per_job',
  currency          char(3) NOT NULL DEFAULT 'TRY',
  valid_from        date NOT NULL DEFAULT current_date,
  valid_to          date,
  private_note      text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT otrate_valid_range CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT otrate_record_role_from_key UNIQUE (talent_record_id, role_id, valid_from)
);
CREATE INDEX IF NOT EXISTS otrate_record_idx ON internal.organization_talent_rates (talent_record_id, role_id);
COMMENT ON TABLE internal.organization_talent_rates IS 'FAZ 5: kurulusun kisi x rol varsayilan ic maliyeti. PostgREST''e kapali; yalniz internal_talent_rate_* RPC''leri.';

DROP TRIGGER IF EXISTS on_organization_talent_rates_updated ON internal.organization_talent_rates;
CREATE TRIGGER on_organization_talent_rates_updated BEFORE UPDATE ON internal.organization_talent_rates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- oran satirinin kurulusu = kaydin kurulusu
CREATE OR REPLACE FUNCTION internal.fn_faz5_rate_org_check()
RETURNS trigger LANGUAGE plpgsql SET search_path = internal, public AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.organization_talent_records WHERE id = NEW.talent_record_id;
  IF v_org IS NULL OR v_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'oran kaydinin kurulusu havuz kaydiyla eslesmiyor' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz5_rate_org_check ON internal.organization_talent_rates;
CREATE TRIGGER trg_faz5_rate_org_check BEFORE INSERT OR UPDATE ON internal.organization_talent_rates
  FOR EACH ROW EXECUTE FUNCTION internal.fn_faz5_rate_org_check();

REVOKE ALL ON internal.organization_talent_rates FROM PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5) talents.canonical_email / canonical_phone aynasi (kapali sutunlar; dolum 02'de)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz5_sync_talent_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.talents t
     SET canonical_email = public.norm_email(NEW.email),
         canonical_phone = public.norm_phone(NEW.phone)
   WHERE t.user_id = NEW.id
     AND (t.canonical_email IS DISTINCT FROM public.norm_email(NEW.email)
          OR t.canonical_phone IS DISTINCT FROM public.norm_phone(NEW.phone));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz5_sync_talent_contact ON public.profiles;
CREATE TRIGGER trg_faz5_sync_talent_contact AFTER INSERT OR UPDATE OF email, phone ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz5_sync_talent_contact();

-- talents satiri profil tetikleyicisinden SONRA dogabilir: dogarken de doldur
CREATE OR REPLACE FUNCTION public.fn_faz5_talent_contact_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT public.norm_email(p.email), public.norm_phone(p.phone)
      INTO NEW.canonical_email, NEW.canonical_phone
      FROM public.profiles p WHERE p.id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_faz5_talent_contact_on_insert ON public.talents;
CREATE TRIGGER trg_faz5_talent_contact_on_insert BEFORE INSERT ON public.talents
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz5_talent_contact_on_insert();

-- -----------------------------------------------------------------------------
-- 6) Esleme RPC'si: e-posta/telefon -> talent_id (PII donmez; denetlenir)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_talent_by_contact(p_org_id uuid, p_email text, p_phone text)
RETURNS TABLE (talent_id uuid, match_kind text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE
  v_email text := public.norm_email(p_email);
  v_phone text := public.norm_phone(p_phone);
  v_id uuid; v_kind text;
BEGIN
  PERFORM internal.assert_org_permission(p_org_id, 'talent.manage', 'talents');
  IF NOT public.org_module_enabled(p_org_id, 'talent_pool') THEN
    RAISE EXCEPTION 'talent_pool modulu bu kurulusta acik degil' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_email IS NULL AND v_phone IS NULL THEN RETURN; END IF;

  IF v_email IS NOT NULL THEN
    SELECT t.id INTO v_id FROM public.talents t
     WHERE t.canonical_email = v_email AND t.user_id IS NOT NULL AND t.claim_status <> 'merged'
     ORDER BY t.created_at LIMIT 1;
    IF v_id IS NOT NULL THEN v_kind := 'email'; END IF;
  END IF;
  IF v_id IS NULL AND v_phone IS NOT NULL THEN
    SELECT t.id INTO v_id FROM public.talents t
     WHERE t.canonical_phone = v_phone AND t.user_id IS NOT NULL AND t.claim_status <> 'merged'
     ORDER BY t.created_at LIMIT 1;
    IF v_id IS NOT NULL THEN v_kind := 'phone'; END IF;
  END IF;

  -- access_audit.action yalniz read|write (FAZ 1 kisiti); islem turu detail.op'ta
  PERFORM internal.log_access(p_org_id, 'read', 'talents', v_id,
    jsonb_build_object('op', 'talent.lookup', 'by_email', v_email IS NOT NULL, 'by_phone', v_phone IS NOT NULL, 'found', v_id IS NOT NULL));
  IF v_id IS NOT NULL THEN
    talent_id := v_id; match_kind := v_kind; RETURN NEXT;
  END IF;
  RETURN;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7) Davet ve claim RPC'leri
-- -----------------------------------------------------------------------------
-- Token uretimi: token sutunu istemciye acik degil; uygulama bu RPC'nin dondurdugu token ile e-posta yollar.
CREATE OR REPLACE FUNCTION public.send_talent_record_invitation(p_record_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE r record; v_token uuid := gen_random_uuid();
BEGIN
  SELECT id, organization_id, talent_id, email, status INTO r
    FROM public.organization_talent_records WHERE id = p_record_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'havuz kaydi bulunamadi' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(r.organization_id, 'talent.manage', 'organization_talent_records', r.id);
  IF NOT public.org_module_enabled(r.organization_id, 'talent_pool') THEN
    RAISE EXCEPTION 'talent_pool modulu bu kurulusta acik degil' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF r.talent_id IS NOT NULL THEN
    RAISE EXCEPTION 'kayit zaten Kashe kimligine bagli' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF public.norm_email(r.email) IS NULL THEN
    RAISE EXCEPTION 'davet icin kayitta e-posta gerekir' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF r.status = 'blocked' THEN
    RAISE EXCEPTION 'engelli kayda davet gonderilemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.organization_talent_records
     SET invitation_status = 'sent', invitation_sent_at = now(), invitation_token = v_token,
         invitation_expires_at = now() + interval '14 days',
         source = CASE WHEN source = 'external_manual' THEN 'invited'::public.talent_record_source ELSE source END
   WHERE id = r.id;
  PERFORM internal.log_access(r.organization_id, 'write', 'organization_talent_records', r.id, jsonb_build_object('op', 'talent.invite'));
  RETURN v_token;
END;
$$;

-- Ortak claim govdesi: cagiranin dogrulanmis e-postasi kaydin e-postasiyla eslesmeli; talents satiri olmali.
CREATE OR REPLACE FUNCTION public.fn_faz5_claim_record(p_record_id uuid, p_via_token boolean)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE r record; v_uid uuid := auth.uid(); v_talent uuid; v_mail text := public.norm_email(auth.email());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'giris gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT id, organization_id, talent_id, email, status, invitation_status INTO r
    FROM public.organization_talent_records WHERE id = p_record_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'havuz kaydi bulunamadi' USING ERRCODE = 'no_data_found'; END IF;
  IF r.talent_id IS NOT NULL THEN
    RAISE EXCEPTION 'kayit zaten sahiplenilmis' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF r.status = 'blocked' THEN RAISE EXCEPTION 'kayit engelli' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF v_mail IS NULL OR public.norm_email(r.email) IS DISTINCT FROM v_mail THEN
    RAISE EXCEPTION 'kaydin e-postasi hesabinizla eslesmiyor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT id INTO v_talent FROM public.talents WHERE user_id = v_uid AND claim_status <> 'merged';
  IF v_talent IS NULL THEN
    RAISE EXCEPTION 'sahiplenmek icin profesyonel veya ajans profili gerekir' USING ERRCODE = 'no_data_found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organization_talent_records x
              WHERE x.organization_id = r.organization_id AND x.talent_id = v_talent AND x.id <> r.id) THEN
    RAISE EXCEPTION 'bu kurulusta zaten size bagli bir kayit var (birlestirme FAZ 8)' USING ERRCODE = 'unique_violation';
  END IF;

  UPDATE public.organization_talent_records
     SET talent_id = v_talent, source = 'marketplace_linked', linked_at = now(),
         invitation_status = CASE WHEN invitation_status IN ('sent','accepted') OR p_via_token THEN 'accepted'::public.talent_invitation_status ELSE invitation_status END,
         invitation_token = NULL, invitation_expires_at = NULL
   WHERE id = r.id;
  UPDATE public.talents SET claim_status = 'claimed', claimed_at = COALESCE(claimed_at, now())
   WHERE id = v_talent AND claim_status <> 'claimed';
  PERFORM internal.log_access(r.organization_id, 'write', 'organization_talent_records', r.id,
    jsonb_build_object('op', 'talent.claim', 'via_token', p_via_token));
  RETURN r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_faz5_claim_record(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_talent_record(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'giris gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT id, invitation_status, invitation_expires_at INTO r
    FROM public.organization_talent_records WHERE invitation_token = p_token;
  IF r.id IS NULL OR r.invitation_status <> 'sent' THEN
    RAISE EXCEPTION 'davet bulunamadi veya kullanilmis' USING ERRCODE = 'no_data_found';
  END IF;
  IF r.invitation_expires_at IS NOT NULL AND r.invitation_expires_at < now() THEN
    RAISE EXCEPTION 'davetin suresi dolmus' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN public.fn_faz5_claim_record(r.id, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_talent_record_by_id(p_record_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
BEGIN
  RETURN public.fn_faz5_claim_record(p_record_id, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_talent_record_invitation(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'giris gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT id, organization_id, email INTO r FROM public.organization_talent_records
   WHERE invitation_token = p_token AND invitation_status = 'sent';
  IF r.id IS NULL THEN RAISE EXCEPTION 'davet bulunamadi veya kullanilmis' USING ERRCODE = 'no_data_found'; END IF;
  IF public.norm_email(r.email) IS DISTINCT FROM public.norm_email(auth.email()) THEN
    RAISE EXCEPTION 'kaydin e-postasi hesabinizla eslesmiyor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.organization_talent_records
     SET invitation_status = 'declined', invitation_token = NULL, invitation_expires_at = NULL
   WHERE id = r.id;
  PERFORM internal.log_access(r.organization_id, 'write', 'organization_talent_records', r.id, jsonb_build_object('op', 'talent.decline'));
  RETURN r.id;
END;
$$;

-- Giris sonrasi "sizi havuzuna eklemis" bandi: e-postasi benimle eslesen, henuz bagli olmayan kayitlar
CREATE OR REPLACE FUNCTION public.claimable_talent_records_for_me()
RETURNS TABLE (record_id uuid, organization_id uuid, organization_name text, invitation_status text, invitation_sent_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.organization_id, o.display_name, r.invitation_status::text, r.invitation_sent_at
    FROM public.organization_talent_records r
    JOIN public.organizations o ON o.id = r.organization_id
   WHERE auth.uid() IS NOT NULL
     AND r.talent_id IS NULL
     AND r.status <> 'blocked'
     AND r.invitation_status <> 'declined'
     AND public.norm_email(r.email) IS NOT NULL
     AND public.norm_email(r.email) = public.norm_email(auth.email())
   ORDER BY r.invitation_sent_at DESC NULLS LAST, r.created_at DESC
$$;

-- -----------------------------------------------------------------------------
-- 8) Gizli oran RPC'leri (assert -> log -> sorgu; FAZ 1 deseni)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_talent_rates_list(p_org_id uuid, p_record_id uuid)
RETURNS TABLE (id uuid, role_id integer, role_slug text, role_name text, default_cost numeric, cost_basis text,
               currency char(3), valid_from date, valid_to date, private_note text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
BEGIN
  PERFORM internal.assert_org_permission(p_org_id, 'commercial.view', 'organization_talent_rates', p_record_id);
  IF NOT public.org_module_enabled(p_org_id, 'talent_pool') THEN
    RAISE EXCEPTION 'talent_pool modulu bu kurulusta acik degil' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_talent_records r WHERE r.id = p_record_id AND r.organization_id = p_org_id) THEN
    RAISE EXCEPTION 'havuz kaydi bu kurulusa ait degil' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM internal.log_access(p_org_id, 'read', 'organization_talent_rates', p_record_id, '{}'::jsonb);
  RETURN QUERY
    SELECT x.id, x.role_id, sr.slug, sr.name_tr, x.default_cost, x.cost_basis::text, x.currency,
           x.valid_from, x.valid_to, x.private_note, x.created_at
      FROM internal.organization_talent_rates x
      JOIN public.service_roles sr ON sr.id = x.role_id
     WHERE x.talent_record_id = p_record_id
     ORDER BY sr.sort_order, x.valid_from DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_talent_rate_upsert(
  p_org_id uuid, p_record_id uuid, p_role_id integer, p_cost numeric, p_basis text,
  p_currency char(3) DEFAULT 'TRY', p_valid_from date DEFAULT current_date, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE v_id uuid; v_basis public.talent_cost_basis;
BEGIN
  PERFORM internal.assert_org_permission(p_org_id, 'commercial.manage', 'organization_talent_rates', p_record_id);
  IF NOT public.org_module_enabled(p_org_id, 'talent_pool') THEN
    RAISE EXCEPTION 'talent_pool modulu bu kurulusta acik degil' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_talent_records r WHERE r.id = p_record_id AND r.organization_id = p_org_id) THEN
    RAISE EXCEPTION 'havuz kaydi bu kurulusa ait degil' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_roles sr WHERE sr.id = p_role_id AND sr.is_active) THEN
    RAISE EXCEPTION 'rol gecersiz veya pasif: %', p_role_id USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_cost IS NULL OR p_cost < 0 THEN
    RAISE EXCEPTION 'maliyet 0 veya daha buyuk olmali' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  BEGIN
    v_basis := p_basis::public.talent_cost_basis;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'cost_basis gecersiz: %', p_basis USING ERRCODE = 'invalid_parameter_value';
  END;
  IF p_valid_from IS NULL THEN
    RAISE EXCEPTION 'valid_from gerekir' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ayni gun baslayan acik oran varsa yerinde guncelle
  SELECT id INTO v_id FROM internal.organization_talent_rates
   WHERE talent_record_id = p_record_id AND role_id = p_role_id AND valid_from = p_valid_from;
  IF v_id IS NOT NULL THEN
    UPDATE internal.organization_talent_rates
       SET default_cost = p_cost, cost_basis = v_basis, currency = COALESCE(p_currency, 'TRY'),
           private_note = p_note, valid_to = NULL
     WHERE id = v_id;
  ELSE
    -- daha eski acik oranlari kapat (tarihce korunur)
    UPDATE internal.organization_talent_rates
       SET valid_to = p_valid_from - 1
     WHERE talent_record_id = p_record_id AND role_id = p_role_id
       AND valid_to IS NULL AND valid_from < p_valid_from;
    INSERT INTO internal.organization_talent_rates
      (organization_id, talent_record_id, role_id, default_cost, cost_basis, currency, valid_from, private_note, created_by)
    VALUES (p_org_id, p_record_id, p_role_id, p_cost, v_basis, COALESCE(p_currency, 'TRY'), p_valid_from, p_note, auth.uid())
    RETURNING id INTO v_id;
  END IF;
  PERFORM internal.log_access(p_org_id, 'write', 'organization_talent_rates', v_id,
    jsonb_build_object('record_id', p_record_id, 'role_id', p_role_id, 'valid_from', p_valid_from));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_talent_rate_close(p_org_id uuid, p_rate_id uuid, p_valid_to date DEFAULT current_date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE r record;
BEGIN
  PERFORM internal.assert_org_permission(p_org_id, 'commercial.manage', 'organization_talent_rates', p_rate_id);
  SELECT id, organization_id, valid_from INTO r FROM internal.organization_talent_rates WHERE id = p_rate_id;
  IF r.id IS NULL OR r.organization_id <> p_org_id THEN
    RAISE EXCEPTION 'oran kaydi bu kurulusa ait degil' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_valid_to IS NULL OR p_valid_to < r.valid_from THEN
    RAISE EXCEPTION 'valid_to baslangictan once olamaz' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  UPDATE internal.organization_talent_rates SET valid_to = p_valid_to WHERE id = r.id;
  PERFORM internal.log_access(p_org_id, 'write', 'organization_talent_rates', r.id, jsonb_build_object('close', p_valid_to));
END;
$$;

-- -----------------------------------------------------------------------------
-- 9) Yetkiler: RPC'ler authenticated + service_role; anon hic
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.find_talent_by_contact(uuid, text, text)                                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_talent_record_invitation(uuid)                                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_talent_record(uuid)                                                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_talent_record_by_id(uuid)                                            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decline_talent_record_invitation(uuid)                                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claimable_talent_records_for_me()                                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.internal_talent_rates_list(uuid, uuid)                                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.internal_talent_rate_upsert(uuid, uuid, integer, numeric, text, char, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.internal_talent_rate_close(uuid, uuid, date)                               FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_talent_by_contact(uuid, text, text)                                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_talent_record_invitation(uuid)                                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_talent_record(uuid)                                               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_talent_record_by_id(uuid)                                         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_talent_record_invitation(uuid)                                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claimable_talent_records_for_me()                                       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.internal_talent_rates_list(uuid, uuid)                                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.internal_talent_rate_upsert(uuid, uuid, integer, numeric, text, char, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.internal_talent_rate_close(uuid, uuid, date)                            TO authenticated, service_role;
-- tetikleyici/yardimci fonksiyonlar istemciden cagrilmaz
REVOKE ALL ON FUNCTION public.fn_faz5_default_modules()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz5_record_before_insert()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz5_record_guard()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz5_sync_talent_contact()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz5_talent_contact_on_insert() FROM PUBLIC, anon, authenticated;

-- Tablolar: varsayilan yetkiler (public semasi) her seyi acar -> once geri al, sonra sutun bazli ver
REVOKE ALL ON public.organization_talent_records, public.organization_talent_record_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, organization_id, talent_id, name, email, phone, city_id, instagram, notes, source, visibility,
              relationship_type, status, invitation_status, invitation_sent_at, invitation_expires_at, linked_at,
              legacy_agency_member_id, created_by, created_at, updated_at)
  ON public.organization_talent_records TO authenticated;
GRANT INSERT (organization_id, talent_id, name, email, phone, city_id, instagram, notes, source, visibility, relationship_type, status)
  ON public.organization_talent_records TO authenticated;
GRANT UPDATE (talent_id, name, email, phone, city_id, instagram, notes, source, relationship_type, status)
  ON public.organization_talent_records TO authenticated;
GRANT DELETE ON public.organization_talent_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_talent_record_roles TO authenticated;
GRANT ALL ON public.organization_talent_records, public.organization_talent_record_roles TO service_role;

-- -----------------------------------------------------------------------------
-- 10) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.organization_talent_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_talent_record_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal.organization_talent_rates      ENABLE ROW LEVEL SECURITY;   -- yetki zaten yok; ikinci kat

DROP POLICY IF EXISTS otr_select ON public.organization_talent_records;
CREATE POLICY otr_select ON public.organization_talent_records FOR SELECT TO authenticated
  USING (public.org_module_enabled(organization_id, 'talent_pool')
         AND (public.has_org_permission(organization_id, 'talent.view') OR public.is_admin(auth.uid())));
DROP POLICY IF EXISTS otr_insert ON public.organization_talent_records;
CREATE POLICY otr_insert ON public.organization_talent_records FOR INSERT TO authenticated
  WITH CHECK (public.org_module_enabled(organization_id, 'talent_pool')
              AND public.has_org_permission(organization_id, 'talent.manage'));
DROP POLICY IF EXISTS otr_update ON public.organization_talent_records;
CREATE POLICY otr_update ON public.organization_talent_records FOR UPDATE TO authenticated
  USING (public.org_module_enabled(organization_id, 'talent_pool')
         AND public.has_org_permission(organization_id, 'talent.manage'))
  WITH CHECK (public.org_module_enabled(organization_id, 'talent_pool')
              AND public.has_org_permission(organization_id, 'talent.manage'));
DROP POLICY IF EXISTS otr_delete ON public.organization_talent_records;
CREATE POLICY otr_delete ON public.organization_talent_records FOR DELETE TO authenticated
  USING (public.org_module_enabled(organization_id, 'talent_pool')
         AND public.has_org_permission(organization_id, 'talent.manage'));

DROP POLICY IF EXISTS otrr_select ON public.organization_talent_record_roles;
CREATE POLICY otrr_select ON public.organization_talent_record_roles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_talent_records r
                  WHERE r.id = organization_talent_record_roles.record_id
                    AND public.org_module_enabled(r.organization_id, 'talent_pool')
                    AND (public.has_org_permission(r.organization_id, 'talent.view') OR public.is_admin(auth.uid()))));
DROP POLICY IF EXISTS otrr_insert ON public.organization_talent_record_roles;
CREATE POLICY otrr_insert ON public.organization_talent_record_roles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_talent_records r
                       WHERE r.id = organization_talent_record_roles.record_id
                         AND public.org_module_enabled(r.organization_id, 'talent_pool')
                         AND public.has_org_permission(r.organization_id, 'talent.manage')));
DROP POLICY IF EXISTS otrr_update ON public.organization_talent_record_roles;
CREATE POLICY otrr_update ON public.organization_talent_record_roles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_talent_records r
                  WHERE r.id = organization_talent_record_roles.record_id
                    AND public.org_module_enabled(r.organization_id, 'talent_pool')
                    AND public.has_org_permission(r.organization_id, 'talent.manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_talent_records r
                       WHERE r.id = organization_talent_record_roles.record_id
                         AND public.org_module_enabled(r.organization_id, 'talent_pool')
                         AND public.has_org_permission(r.organization_id, 'talent.manage')));
DROP POLICY IF EXISTS otrr_delete ON public.organization_talent_record_roles;
CREATE POLICY otrr_delete ON public.organization_talent_record_roles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_talent_records r
                  WHERE r.id = organization_talent_record_roles.record_id
                    AND public.org_module_enabled(r.organization_id, 'talent_pool')
                    AND public.has_org_permission(r.organization_id, 'talent.manage')));

COMMIT;
