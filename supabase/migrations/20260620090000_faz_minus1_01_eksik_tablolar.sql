-- =============================================================================
-- FAZ -1 / 01 — Eksik tablolar (13)
--
-- KAYNAK: docs/envanter/04-sema-uzlastirma.md (GRUP A = yalniz uretimde olan nesneler)
-- VERI  : docs/envanter/uretim-dokum/*.csv (uretim semasindan alinan dokum)
--
-- Uretimde 35 tablo var, repoda 22 CREATE TABLE. Bu dosya eksik 13 tabloyu ekler.
--
-- SIRA GEREKCESI:
--   * service_packages EN ONCE — 20260625120000_add_service_price_unit_and_starting.sql
--     bu tabloyu ALTER ediyor; tablo olmadan zincir orada durur.
--   * quote_requests, quote_request_recipients'ten ONCE (yabanci anahtar yonu).
--
-- SUTUNLAR : eksik-tablo-sutunlari.csv (information_schema.columns dokumu, 117 sutun)
-- KISITLAR : indeksler.csv'den TURETILDI — *_pkey -> PRIMARY KEY, *_key -> UNIQUE.
--            Ayri bir kisit dokumu ALINMADI.
--
-- !!! YABANCI ANAHTARLAR BU DOSYADA YOK !!!
--     FK tanimlari hicbir dokumde bulunmuyor. Uydurulmadi. Eksik FK listesi ve
--     dokum sorgusu docs/envanter/05-onarim-raporu.md bolum 3'te.
--
-- KURALLAR (bu dosyalarin tamaminda gecerli):
--   * VERI DEGISTIRILMEZ — hicbir INSERT/UPDATE/DELETE yoktur, yalniz DDL.
--   * CATISMADA URETIM KAZANIR — govdeler uretim dokumundan birebir alinmistir.
--   * IDEMPOTENT — dosya iki kez kosturulsa da hata vermez.
--   * GRUP D'ye (repoda da uretimde de ayni olan nesneler) DOKUNULMAZ.
--
-- UYGULAMA: Supabase Dashboard > SQL Editor. Terminale yapistirilmaz.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- ON KOSUL: uc enum tipi
-- Bu tipler uretimde VAR ama repo migration zincirinde TANIMLI DEGIL.
-- Degerleri hicbir dokumde yoktu; uretimden pg_enum ile cekilip buraya islendi.
-- Sira enumsortorder ile alinmistir.
--
-- Idempotanlik: CREATE TYPE IF NOT EXISTS yoktur; repo idyomu olan
-- EXCEPTION WHEN duplicate_object kullanildi (bkz. 20260630120000).
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE listing_invitation_status AS ENUM (
    'pending', 'accepted', 'declined', 'expired', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE quote_recipient_status AS ENUM (
    'sent', 'viewed', 'quoted', 'declined'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE quote_request_status AS ENUM (
    'active', 'closed', 'expired', 'fulfilled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- service_packages (13 sutun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  includes jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_min numeric,
  price_max numeric,
  price_on_request boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  price_starting boolean NOT NULL DEFAULT false,
  CONSTRAINT service_packages_pkey PRIMARY KEY (id)
);

ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- service_addons (9 sutun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_addons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT service_addons_pkey PRIMARY KEY (id)
);

ALTER TABLE public.service_addons ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- availability_blocks (5 sutun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  blocked_date date NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT availability_blocks_pkey PRIMARY KEY (id),
  CONSTRAINT availability_blocks_profile_id_blocked_date_key UNIQUE (profile_id, blocked_date)
);

ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- blog_posts (11 sutun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL DEFAULT ''::text,
  cover_image_url text,
  author_id uuid,
  status text NOT NULL DEFAULT 'draft'::text,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_pkey PRIMARY KEY (id),
  CONSTRAINT blog_posts_slug_key UNIQUE (slug)
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- category_requests (9 sutun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.category_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  category_name text NOT NULL,
  description text,
  event_context text,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  CONSTRAINT category_requests_pkey PRIMARY KEY (id)
);

ALTER TABLE public.category_requests ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- admin_audit_log (7 sutun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id)
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- message_violations (5 sutun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_violations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  violation_type text NOT NULL,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_violations_pkey PRIMARY KEY (id)
);

ALTER TABLE public.message_violations ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- push_subscriptions (7 sutun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- conversation_assignees (5 sutun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_by uuid,
  CONSTRAINT conversation_assignees_conversation_id_professional_id_key UNIQUE (conversation_id, professional_id),
  CONSTRAINT conversation_assignees_pkey PRIMARY KEY (id)
);

ALTER TABLE public.conversation_assignees ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- reports (11 sutun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending'::text,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  admin_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reports_pkey PRIMARY KEY (id)
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- quote_requests (18 sutun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  category_id integer NOT NULL,
  city_id integer,
  brief_data jsonb,
  event_date date,
  event_type text,
  budget_min numeric,
  budget_max numeric,
  share_budget boolean NOT NULL DEFAULT true,
  response_deadline timestamp with time zone,
  recipient_count integer NOT NULL DEFAULT 0,
  status quote_request_status NOT NULL DEFAULT 'active'::quote_request_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  attachment_path text,
  attachment_name text,
  attachment_type text,
  created_by uuid,
  CONSTRAINT quote_requests_pkey PRIMARY KEY (id)
);

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- quote_request_recipients (7 sutun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_request_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  status quote_recipient_status NOT NULL DEFAULT 'sent'::quote_recipient_status,
  conversation_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  CONSTRAINT quote_request_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT quote_request_recipients_request_id_professional_id_key UNIQUE (request_id, professional_id)
);

ALTER TABLE public.quote_request_recipients ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- listing_invitations (10 sutun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listing_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  inviter_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  invitation_message text,
  status listing_invitation_status NOT NULL DEFAULT 'pending'::listing_invitation_status,
  resulting_application_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '14 days'::interval),
  CONSTRAINT listing_invitations_pkey PRIMARY KEY (id)
);

ALTER TABLE public.listing_invitations ENABLE ROW LEVEL SECURITY;

COMMIT;
