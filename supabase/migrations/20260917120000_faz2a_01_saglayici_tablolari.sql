-- =============================================================================
-- FAZ 2a / 01 — Saglayici kayit defteri: talents, providers, professional_profiles,
--                organization_profiles (tablolar, enum'lar, yetkiler, RLS, koruma tetikleyicisi)
--
-- Kaynak: docs/architecture/01-veri-modeli.md bolum 2-3, 04-goc-plani.md FAZ 2 (11e-11h, 12-14),
--         02-guvenlik-modeli.md. Plan ve kararlar: docs/envanter/11-faz2-saglayici-defteri.md
--
-- NE YAPAR: yalniz EKLEME. Hicbir okuma yolu, politika, mevcut tablo degismez. profiles hala kaynaktir;
--   yeni tablolar 02 dosyasindaki tetikleyicilerle profiles'tan beslenir (cift alan donemi).
--
-- KARARLAR (17 Eylul, Guven onayi):
--   * AYNI ID: providers.id = profiles.id (profesyonel ve ajans), talents.id = profiles.id (profesyonel).
--     services.profile_id, reviews.professional_id, favorites.professional_id ve /p/[id] URL'leri zaten
--     saglayici kimligini tasir; FAZ 2b'de eklenecek provider_id sutunlari ayni degeri alir.
--     Hesapsiz harici yetenekler (FAZ 5) yeni uuid alir.
--   * providers.approval_status tipi mevcut profile_approval_status enum'udur (degerler ayni).
--   * talents.canonical_email / canonical_phone dolumda BOS kalir (PII ikinci yere yayilmaz);
--     FAZ 5'te yalniz hesapsiz yetenekler icin dolar.
--   * business rollu profil saglayici DEGILDIR (kurumsal alici); yalniz professional ve agency.
--
-- GORUNURLUK (01 bolum 2): yonetici alanlari (approval_*, suspended_*, is_verified, verification_level,
--   trust_score) ile kullanici alani (is_published) AYRI; koruma tetikleyicisi yonetici alanlarini
--   admin disinda sessizce eski degerine dondurur (profiles'taki protect_sensitive_profile_fields ile
--   ayni yontem). is_published korunmaz — bilincli. Gorunurluk turetilir:
--   is_published AND approval_status = 'approved' AND suspended_at IS NULL.
--
-- YETKI: providers / professional_profiles / organization_profiles herkese okunur (profiles gibi, qual
--   true) ama providers'ta approval_note, suspension_reason, suspended_by sutunlari anon/authenticated'a
--   KAPALI (profiles PII kurali). talents: anon hic; authenticated yalniz kendi satiri (+admin), iletisim
--   sutunlari kapali. Istemciden YAZMA yolu yok (FAZ 2c'de acilir); yazma yalniz aynalama ve dolum.
--
-- KALICI KURAL: providers'a yeni sutun = ayni migration'da GRANT SELECT (sutun) ... TO anon, authenticated
--   (hassas ise verilmez); yonetici alani ise protect_sensitive_provider_fields kara listesine eklenir.
--
-- Idempotan. Sapkali harf yok.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Enum'lar
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.provider_type AS ENUM ('professional', 'organization');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_level' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.verification_level AS ENUM ('none', 'email', 'document', 'full');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_origin' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.talent_origin AS ENUM ('marketplace_signup', 'agency_added', 'imported');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_claim_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.talent_claim_status AS ENUM ('unclaimed', 'invited', 'claimed', 'merged');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pricing_mode' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.pricing_mode AS ENUM ('fixed', 'range', 'on_request');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_price_unit' AND typnamespace = 'public'::regnamespace) THEN
    -- services.price_unit (text: total/hourly/half_day/full_day) ile esleme FAZ 2b'de:
    -- total->per_job, hourly->per_hour, half_day->per_half_day, full_day->per_day
    CREATE TYPE public.provider_price_unit AS ENUM ('per_job', 'per_hour', 'per_half_day', 'per_day');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) talents — canonical Kashe kimligi (01 bolum 3)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.talents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- hesapli yetenekte = profiles.id
  user_id         uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  canonical_email text,                                        -- KAPALI; FAZ 5'te hesapsiz yetenek icin
  canonical_phone text,                                        -- KAPALI
  full_name       text,
  origin          public.talent_origin NOT NULL DEFAULT 'marketplace_signup',
  claim_status    public.talent_claim_status NOT NULL DEFAULT 'unclaimed',
  merged_into     uuid REFERENCES public.talents(id) ON DELETE SET NULL,
  claimed_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT talents_claimed_has_user CHECK (claim_status <> 'claimed' OR user_id IS NOT NULL),
  CONSTRAINT talents_merged_has_target CHECK (claim_status <> 'merged' OR merged_into IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS talents_user_id_key ON public.talents (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS talents_claim_status_idx ON public.talents (claim_status);

DROP TRIGGER IF EXISTS on_talents_updated ON public.talents;
CREATE TRIGGER on_talents_updated BEFORE UPDATE ON public.talents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 3) providers — pazaryerinde listelenen her varlik (01 bolum 2)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.providers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- FAZ 2: = profiles.id
  provider_type      public.provider_type NOT NULL,
  talent_id          uuid REFERENCES public.talents(id) ON DELETE CASCADE,
  organization_id    uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  display_name       text,
  slug               text NOT NULL,
  city_id            integer REFERENCES public.turkish_cities(id) ON DELETE SET NULL,
  district           text,
  service_radius_km  integer,
  base_currency      char(3) NOT NULL DEFAULT 'TRY',
  -- YONETICI alanlari (koruma tetikleyicisi kara listesi)
  approval_status    public.profile_approval_status NOT NULL DEFAULT 'pending',
  approval_note      text,                                        -- KAPALI sutun
  approved_at        timestamptz,
  suspended_at       timestamptz,
  suspension_reason  text,                                        -- KAPALI sutun
  suspended_by       uuid,                                        -- KAPALI sutun
  is_verified        boolean NOT NULL DEFAULT false,
  verification_level public.verification_level NOT NULL DEFAULT 'none',
  trust_score        numeric,                                     -- IP2 ciktisi; sistem yazar
  trust_computed_at  timestamptz,
  -- KULLANICI alani
  is_published       boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT providers_slug_key UNIQUE (slug),
  CONSTRAINT providers_slug_check CHECK (char_length(slug) BETWEEN 3 AND 120),
  CONSTRAINT providers_exactly_one_owner CHECK (
       (provider_type = 'professional'  AND talent_id IS NOT NULL AND organization_id IS NULL)
    OR (provider_type = 'organization'  AND organization_id IS NOT NULL AND talent_id IS NULL)),
  CONSTRAINT providers_radius_check CHECK (service_radius_km IS NULL OR service_radius_km >= 0),
  CONSTRAINT providers_trust_score_check CHECK (trust_score IS NULL OR (trust_score >= 0 AND trust_score <= 100))
);
CREATE UNIQUE INDEX IF NOT EXISTS providers_talent_id_key ON public.providers (talent_id) WHERE talent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS providers_organization_id_key ON public.providers (organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS providers_type_idx ON public.providers (provider_type);
CREATE INDEX IF NOT EXISTS providers_city_id_idx ON public.providers (city_id) WHERE city_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS providers_visible_idx ON public.providers (approval_status, is_published)
  WHERE suspended_at IS NULL;

DROP TRIGGER IF EXISTS on_providers_updated ON public.providers;
CREATE TRIGGER on_providers_updated BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 4) Alt profiller
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professional_profiles (
  provider_id      uuid PRIMARY KEY REFERENCES public.providers(id) ON DELETE CASCADE,
  headline         text,
  bio              text,                     -- profiles.bio aynasi (cift alan donemi)
  experience_years integer,
  languages        text[],
  equipment        jsonb,
  pricing_mode     public.pricing_mode,
  price_min        numeric,
  price_max        numeric,
  price_unit       public.provider_price_unit,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professional_profiles_experience_check CHECK (experience_years IS NULL OR experience_years BETWEEN 0 AND 80),
  CONSTRAINT professional_profiles_price_check CHECK (
    (price_min IS NULL OR price_min >= 0) AND (price_max IS NULL OR price_max >= 0)
    AND (price_min IS NULL OR price_max IS NULL OR price_min <= price_max))
);
DROP TRIGGER IF EXISTS on_professional_profiles_updated ON public.professional_profiles;
CREATE TRIGGER on_professional_profiles_updated BEFORE UPDATE ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.organization_profiles (
  provider_id        uuid PRIMARY KEY REFERENCES public.providers(id) ON DELETE CASCADE,
  about              text,                   -- profiles.bio aynasi
  team_size_range    text,
  can_full_service   boolean,
  subcontracts       boolean,
  min_project_budget numeric,
  portfolio_scale    jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_profiles_budget_check CHECK (min_project_budget IS NULL OR min_project_budget >= 0)
);
DROP TRIGGER IF EXISTS on_organization_profiles_updated ON public.organization_profiles;
CREATE TRIGGER on_organization_profiles_updated BEFORE UPDATE ON public.organization_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 5) Koruma tetikleyicisi (04-goc-plani 11f) — profiles'taki ile ayni yontem: kara liste, sessiz geri alma.
--    Aynalama (02 dosyasi) SECURITY DEFINER icinde kashe.sync_bypass = 'on' ayarlar; o zaman atlanir
--    (aksi halde admin olmayan bir kullanicinin profil guncellemesi tetikledigi aynalama geri alinirdi).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_sensitive_provider_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('kashe.sync_bypass', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.approval_status    := OLD.approval_status;
  NEW.approval_note      := OLD.approval_note;
  NEW.approved_at        := OLD.approved_at;
  NEW.suspended_at       := OLD.suspended_at;
  NEW.suspension_reason  := OLD.suspension_reason;
  NEW.suspended_by       := OLD.suspended_by;
  NEW.is_verified        := OLD.is_verified;
  NEW.verification_level := OLD.verification_level;
  NEW.trust_score        := OLD.trust_score;
  NEW.trust_computed_at  := OLD.trust_computed_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_provider_fields ON public.providers;
CREATE TRIGGER protect_provider_fields
  BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.protect_sensitive_provider_fields();

-- -----------------------------------------------------------------------------
-- 6) Yetkiler
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.talents, public.providers, public.professional_profiles, public.organization_profiles
  FROM anon, authenticated;

-- providers: herkese okunur, 3 yonetici sutunu kapali
GRANT SELECT (
  id, provider_type, talent_id, organization_id, display_name, slug, city_id, district, service_radius_km,
  base_currency, approval_status, approved_at, suspended_at, is_verified, verification_level,
  trust_score, trust_computed_at, is_published, created_at, updated_at
) ON public.providers TO anon, authenticated;

GRANT SELECT ON public.professional_profiles, public.organization_profiles TO anon, authenticated;

-- talents: anon hic; authenticated iletisim sutunlari disinda (satir filtresi RLS'te)
GRANT SELECT (id, user_id, full_name, origin, claim_status, merged_into, claimed_at, created_at, updated_at)
  ON public.talents TO authenticated;

GRANT ALL ON public.talents, public.providers, public.professional_profiles, public.organization_profiles
  TO service_role;

-- -----------------------------------------------------------------------------
-- 7) RLS — yalniz SELECT
-- -----------------------------------------------------------------------------
ALTER TABLE public.talents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS providers_select_all ON public.providers;
CREATE POLICY providers_select_all ON public.providers
  FOR SELECT USING (true);                       -- profiles ile ayni: "viewable by everyone"

DROP POLICY IF EXISTS professional_profiles_select_all ON public.professional_profiles;
CREATE POLICY professional_profiles_select_all ON public.professional_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS organization_profiles_select_all ON public.organization_profiles;
CREATE POLICY organization_profiles_select_all ON public.organization_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS talents_select_own_or_admin ON public.talents;
CREATE POLICY talents_select_own_or_admin ON public.talents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

COMMIT;
