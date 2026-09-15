-- =============================================================================
-- FAZ 0 / 01 — Kiraci temeli: tablolar, enum'lar, indeksler, yetkiler, RLS
--
-- Kaynak: docs/architecture/01-veri-modeli.md bolum 1, 02-guvenlik-modeli.md bolum 4-5,
--         04-goc-plani.md "FAZ 0". Plan ve kararlar: docs/envanter/08-faz0-kiraci-temeli.md
--
-- NE YAPAR: organizations, organization_memberships, organization_invitations,
--   organization_modules ve organization_sync_log tablolarini olusturur. Yalniz EKLEME;
--   mevcut hicbir tabloya, fonksiyona veya politikaya dokunmaz. Eski akislar
--   (agency_members, business_members, davetler) aynen calismaya devam eder.
--
-- FAZ 0 KARARLARI (15 Eylul, Guven onayi):
--   * organizations.subscription_tier tipi mevcut premium_tier enum'udur (none/premium/
--     plus/agency); deger kayipsiz kopyalanir, paket adlari netlesince yeniden adlandirilir.
--   * organizations.legacy_profile_id: bu kurulusun turetildigi agency/business profili.
--     FAZ 0'da kurulus = profil; aynalama ve uyumluluk gorunumleri bu alanla eslesir.
--     owner_user_id ileride devredilebilir, legacy_profile_id degismez.
--   * organization_memberships.id ve organization_invitations.id, eski tablodaki satirin
--     id'siyle AYNIDIR (aynalama anahtari). Kurucu uyeligi (owner_seed) yeni id alir.
--   * Yetki: anon bu tablolara HIC erisemez. authenticated yalniz SELECT alir; organizations
--     uzerinde sutun listesiyle (tax_number, billing_email disarida — profiles PII dersi).
--     Istemciden yazma yolu YOK: yazma yalniz SECURITY DEFINER aynalama tetikleyicileri ve
--     dolum dosyasi uzerinden. Uygulama yazma yolu FAZ 8'de acilir.
--   * 09_platform_katmani'nin ALTER DEFAULT PRIVILEGES'i yeni tablolara otomatik GRANT ALL
--     verir; bu yuzden REVOKE'lar burada ACIKCA yazilir.
--
-- KALICI KURAL: organizations'a yeni sutun eklenirse ayni migration'da
--   GRANT SELECT (yeni_sutun) ON public.organizations TO authenticated  yazilir
--   (hassas sutunsa yazilmaz, RPC ile verilir).
--
-- Idempotan: IF NOT EXISTS / DROP POLICY IF EXISTS. Sapkali harf yok.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Enum'lar
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_account_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.organization_account_type AS ENUM ('business', 'agency');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_member_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.organization_member_role AS ENUM
      ('owner', 'admin', 'sales', 'project_manager', 'crew_coordinator', 'finance', 'viewer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_member_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.organization_member_status AS ENUM ('invited', 'active', 'suspended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_invitation_status' AND typnamespace = 'public'::regnamespace) THEN
    -- agency_invitation_status / business_invitation_status ile ayni degerler
    CREATE TYPE public.organization_invitation_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled', 'expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_subscription_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.organization_subscription_status AS ENUM ('active', 'past_due', 'canceled');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) organizations — kiraci
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL,
  account_type        public.organization_account_type NOT NULL,
  legal_name          text,
  display_name        text,
  tax_number          text,                                     -- HASSAS: authenticated GRANT disinda
  billing_email       text,                                     -- HASSAS: authenticated GRANT disinda
  city_id             integer REFERENCES public.turkish_cities(id) ON DELETE SET NULL,
  owner_user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_tier   public.premium_tier NOT NULL DEFAULT 'none',
  subscription_status public.organization_subscription_status NOT NULL DEFAULT 'active',
  subscription_until  timestamptz,                              -- profiles.premium_until kopyasi
  seat_limit          integer,
  active_event_limit  integer,
  storage_limit_mb    integer,
  ai_credit_limit     integer,
  settings            jsonb NOT NULL DEFAULT '{}'::jsonb,
  legacy_profile_id   uuid REFERENCES public.profiles(id) ON DELETE CASCADE,  -- FAZ 0 kokeni (agency/business profili)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_key UNIQUE (slug),
  CONSTRAINT organizations_legacy_profile_id_key UNIQUE (legacy_profile_id),
  CONSTRAINT organizations_slug_check CHECK (char_length(slug) BETWEEN 3 AND 120),
  CONSTRAINT organizations_limits_check CHECK (
    (seat_limit IS NULL OR seat_limit >= 0) AND (active_event_limit IS NULL OR active_event_limit >= 0)
    AND (storage_limit_mb IS NULL OR storage_limit_mb >= 0) AND (ai_credit_limit IS NULL OR ai_credit_limit >= 0))
);

CREATE INDEX IF NOT EXISTS organizations_owner_user_id_idx ON public.organizations (owner_user_id);
CREATE INDEX IF NOT EXISTS organizations_account_type_idx ON public.organizations (account_type);
CREATE INDEX IF NOT EXISTS organizations_city_id_idx ON public.organizations (city_id) WHERE city_id IS NOT NULL;

DROP TRIGGER IF EXISTS on_organizations_updated ON public.organizations;
CREATE TRIGGER on_organizations_updated
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 3) organization_memberships — uyelik
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- eski tablodan aynalanan satirda = eski id
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role            public.organization_member_role NOT NULL DEFAULT 'viewer',
  permissions     jsonb NOT NULL DEFAULT '{}'::jsonb,            -- ince ayar: {"commercial.view": true/false}
  status          public.organization_member_status NOT NULL DEFAULT 'active',
  invited_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  legacy_source   text,                                          -- 'agency_members' | 'business_members' | 'owner_seed'
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_memberships_org_user_key UNIQUE (organization_id, user_id),
  CONSTRAINT organization_memberships_legacy_source_check
    CHECK (legacy_source IS NULL OR legacy_source IN ('agency_members', 'business_members', 'owner_seed'))
);

CREATE INDEX IF NOT EXISTS organization_memberships_user_id_idx ON public.organization_memberships (user_id);
CREATE INDEX IF NOT EXISTS organization_memberships_org_role_idx ON public.organization_memberships (organization_id, role);

DROP TRIGGER IF EXISTS on_organization_memberships_updated ON public.organization_memberships;
CREATE TRIGGER on_organization_memberships_updated
  BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 4) organization_invitations — davet
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- eski davetten aynalanan satirda = eski id
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_email      text NOT NULL,
  invited_user_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_by_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role               public.organization_member_role NOT NULL DEFAULT 'viewer',
  status             public.organization_invitation_status NOT NULL DEFAULT 'pending',
  invitation_message text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  responded_at       timestamptz,
  expires_at         timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  legacy_source      text,                                       -- 'agency_invitations' | 'business_invitations'
  CONSTRAINT organization_invitations_invited_email_check
    CHECK (invited_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT organization_invitations_invitation_message_check
    CHECK (invitation_message IS NULL OR char_length(invitation_message) <= 1000),
  CONSTRAINT organization_invitations_legacy_source_check
    CHECK (legacy_source IS NULL OR legacy_source IN ('agency_invitations', 'business_invitations')),
  CONSTRAINT organization_invitations_no_duplicate_pending
    EXCLUDE USING btree (organization_id WITH =, invited_email WITH =) WHERE (status = 'pending')
);

CREATE INDEX IF NOT EXISTS organization_invitations_organization_id_idx ON public.organization_invitations (organization_id);
CREATE INDEX IF NOT EXISTS organization_invitations_invited_email_idx ON public.organization_invitations (invited_email);
CREATE INDEX IF NOT EXISTS organization_invitations_invited_user_id_idx ON public.organization_invitations (invited_user_id) WHERE invited_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS organization_invitations_pending_expires_idx ON public.organization_invitations (expires_at) WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- 5) organization_modules — modul erisimi (FAZ 0'da satir yok; Event OS ile dolar)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_modules (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key      text NOT NULL,
  is_enabled      boolean NOT NULL DEFAULT false,
  enabled_at      timestamptz,
  enabled_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (organization_id, module_key),
  CONSTRAINT organization_modules_module_key_check CHECK (module_key IN (
    'crm', 'events', 'crew', 'talent_pool', 'suppliers', 'commercial', 'proposals', 'tasks',
    'run_of_show', 'finance', 'reporting', 'rfp', 'supplier_search', 'proposal_compare',
    'budget', 'approvals', 'contracts'))
);

-- -----------------------------------------------------------------------------
-- 6) organization_sync_log — aynalama tetikleyicilerinin hata gunlugu
--    (04-goc-plani FAZ 0 madde 9: "sessiz fonksiyonlara sayac"; hata eski akisi kesmez, buraya duser)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_sync_log (
  id          bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source      text NOT NULL,        -- tetikleyici fonksiyon adi
  operation   text NOT NULL,        -- INSERT | UPDATE | DELETE | BACKFILL
  legacy_id   uuid,                 -- eski tablodaki satir / profil id'si
  detail      text NOT NULL         -- SQLERRM
);

CREATE INDEX IF NOT EXISTS organization_sync_log_occurred_at_idx ON public.organization_sync_log (occurred_at DESC);

-- -----------------------------------------------------------------------------
-- 7) Yetkiler — anon: hic; authenticated: yalniz SELECT (organizations sutun listeli);
--    service_role: tam (09 varsayilanlari)
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.organizations, public.organization_memberships, public.organization_invitations,
              public.organization_modules, public.organization_sync_log FROM anon;
REVOKE ALL ON public.organizations, public.organization_memberships, public.organization_invitations,
              public.organization_modules, public.organization_sync_log FROM authenticated;
REVOKE ALL ON SEQUENCE public.organization_sync_log_id_seq FROM anon, authenticated;

GRANT SELECT (
  id, slug, account_type, legal_name, display_name, city_id, owner_user_id,
  subscription_tier, subscription_status, subscription_until,
  seat_limit, active_event_limit, storage_limit_mb, ai_credit_limit,
  settings, legacy_profile_id, created_at, updated_at
) ON public.organizations TO authenticated;
GRANT SELECT ON public.organization_memberships TO authenticated;
GRANT SELECT ON public.organization_invitations TO authenticated;
GRANT SELECT ON public.organization_modules TO authenticated;
GRANT SELECT ON public.organization_sync_log TO authenticated;   -- satir filtresi: yalniz admin (RLS)

GRANT ALL ON public.organizations, public.organization_memberships, public.organization_invitations,
             public.organization_modules, public.organization_sync_log TO service_role;
GRANT ALL ON SEQUENCE public.organization_sync_log_id_seq TO service_role;

-- -----------------------------------------------------------------------------
-- 8) RLS — yalniz SELECT politikalari; istemciden yazma yolu yok (FAZ 8'e kadar)
--    Politikalar 02'deki yardimci fonksiyonlari cagirir; fonksiyonlar bu dosyada
--    olmadigi icin politikalar 02'de yazilir. Burada yalniz RLS acilir.
-- -----------------------------------------------------------------------------
ALTER TABLE public.organizations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_modules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_sync_log     ENABLE ROW LEVEL SECURITY;

COMMIT;
