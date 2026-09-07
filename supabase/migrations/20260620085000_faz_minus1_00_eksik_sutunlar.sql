-- =============================================================================
-- FAZ -1 / 00 — Mevcut tablolarin eksik sutunlari (37) + bagli kisitlar (5)
--
-- KAYNAK: docs/envanter/05-onarim-raporu.md bolum 3.6
-- VERI  : docs/envanter/uretim-dokum/tum-sutunlar.csv  (uretim sutun dokumu)
--         docs/envanter/uretim-dokum/tum-kisitlar.csv  (uretim kisit dokumu)
--
-- Bu dosya 04-sema-uzlastirma.md'de GORULMEYEN bir bosluk kategorisini kapatir:
-- eksik olan tablo, fonksiyon, politika ya da indeks degil — VAR OLAN bir
-- tablonun sonradan eklenmis sutunlari. Zincir bunlar olmadan 02'de duruyordu:
--   column "is_admin" does not exist
--
-- NEDEN EN BASTA: 01 ve 02 bu sutunlara bagimli. is_admin() govdesi
-- profiles.is_admin okuyor, dolayisiyla 02'den ONCE olusmali.
--
-- ZAMAN DAMGASI PENCERESI (hesaplandi, secilmedi):
--   ALT SINIR  20260520151810  etkilenen tablolarin en genci agency_members
--                              (20260520071330); hepsi bu damgadan once doguyor
--   UST SINIR  20260620090000  dosya 01
--
-- KURALLAR (bu dosyalarin tamaminda gecerli):
--   * VERI DEGISTIRILMEZ — hicbir INSERT/UPDATE/DELETE yoktur, yalniz DDL.
--   * CATISMADA URETIM KAZANIR — tip/varsayilan/null durumu dokumden birebir.
--   * IDEMPOTENT — dosya iki kez kosturulsa da hata vermez.
--   * GRUP D'ye (repoda da uretimde de ayni olan nesneler) DOKUNULMAZ.
--
-- UYGULAMA: Supabase Dashboard > SQL Editor. Terminale yapistirilmaz.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Iki enum tipi
-- Ikisi de uretimde VAR, repo zincirinde TANIMLI DEGIL. Degerler ve SIRA
-- pg_enum'dan (enumsortorder) alindi. Sira alfabetik DEGIL: premium_tier
-- kademe sirasiyla yazilidir.
--
-- Idempotanlik: CREATE TYPE IF NOT EXISTS yoktur; repo idyomu olan
-- EXCEPTION WHEN duplicate_object kullanildi (bkz. 20260630120000).
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE profile_approval_status AS ENUM (
    'draft', 'pending', 'approved', 'rejected', 'revision'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE premium_tier AS ENUM (
    'none', 'premium', 'plus', 'agency'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Eksik sutunlar (37)
-- ADD COLUMN IF NOT EXISTS ile idempotan. NOT NULL olan her sutunun varsayilani
-- vardir; dolu tabloda da guvenle eklenir.
-- -----------------------------------------------------------------------------

-- applications (3 sutun)
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS attachment_type text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS attachment_name text;

-- bookings (3 sutun)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_by uuid;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS start_time time without time zone;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS end_time time without time zone;

-- conversations (4 sutun)
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS brief_data jsonb;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'quote'::text NOT NULL;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS start_time time without time zone;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS end_time time without time zone;

-- listings (8 sutun)
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS approval_note text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS application_deadline timestamp with time zone;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS is_urgent boolean DEFAULT false NOT NULL;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS urgent_until timestamp with time zone;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS featured_category_until timestamp with time zone;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS featured_home_until timestamp with time zone;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS notified_at timestamp with time zone;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS allowed_applicant_roles text[];

-- messages (3 sutun)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_type text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_name text;

-- notifications (1 sutun)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS email_sent_at timestamp with time zone;

-- profiles (13 sutun)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kvkk_approved_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_status profile_approval_status DEFAULT 'pending'::profile_approval_status NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_note text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspension_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_by uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_tier premium_tier DEFAULT 'none'::premium_tier NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_until timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS views_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_allowed_applicant_roles text[] DEFAULT ARRAY['professional'::text, 'agency'::text] NOT NULL;

-- service_categories (2 sutun)
ALTER TABLE public.service_categories ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.service_categories ADD COLUMN IF NOT EXISTS seo_title text;

-- -----------------------------------------------------------------------------
-- 3) Bu sutunlara bagli kisitlar (5)
-- Besi de uretimde var, repo zincirinde yok. Sutunlar olmadan kurulamazlardi,
-- bu yuzden ayni dosyada ve sutunlardan SONRA geliyorlar.
--
-- ADD CONSTRAINT'in IF NOT EXISTS bicimi PostgreSQL'de yoktur; idempotanlik
-- pg_constraint kontroluyle saglanir.
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'profiles_suspended_by_fkey'
       AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_suspended_by_fkey FOREIGN KEY (suspended_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'bookings_cancelled_by_fkey'
       AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES profiles(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'default_allowed_roles_valid'
       AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT default_allowed_roles_valid CHECK (((default_allowed_applicant_roles <@ ARRAY['professional'::text, 'agency'::text]) AND (array_length(default_allowed_applicant_roles, 1) >= 1)));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'allowed_roles_valid'
       AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings ADD CONSTRAINT allowed_roles_valid CHECK (((allowed_applicant_roles IS NULL) OR ((allowed_applicant_roles <@ ARRAY['professional'::text, 'agency'::text]) AND (array_length(allowed_applicant_roles, 1) >= 1))));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'conversations_request_type_check'
       AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE public.conversations ADD CONSTRAINT conversations_request_type_check CHECK ((request_type = ANY (ARRAY['quote'::text, 'booking_request'::text])));
  END IF;
END $$;

COMMIT;
