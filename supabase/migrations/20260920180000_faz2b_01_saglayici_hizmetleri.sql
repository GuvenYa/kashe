-- =============================================================================
-- FAZ 2b / 01 — provider_services tablosu + 5 eski tabloya provider_id sutunu + v_provider_roles
--
-- Kaynak: 01-veri-modeli.md bolum 2 (provider_services "coverage hesabinin temeli"),
--         04-goc-plani.md FAZ 2 madde 15-16 ve tablo "eski -> yeni sutun" (services, reviews,
--         portfolio_items, profile_experiences, favorites -> provider_id).
-- Plan: docs/envanter/13-faz2b-saglayici-hizmetleri.md
--
-- NE YAPAR (yalniz sema; veri yazmaz):
--   provider_services: saglayici basina rol basina TEK satir (UNIQUE provider_id, role_id).
--     role_id -> service_roles (FAZ 3a). Cift alan doneminde satirlar services +
--     profiles.primary_category_id'den TURETILIR (02 dosyasi); origin = 'legacy_sync'.
--     2c'de uygulama dogrudan yazmaya basladiginda origin = 'provider' satirlari aynalama ELLEMEZ.
--   provider_id sutunu (NULL olabilir; = mevcut profile_id / professional_id; FK providers ON DELETE
--     SET NULL): services, portfolio_items, profile_experiences, reviews, favorites. 02'deki BEFORE
--     tetikleyici degeri her yazimda profile_id/professional_id'den turetir; istemcinin verdigi deger
--     EZILIR (kurcalanamaz). NOT NULL ve CASCADE, profile_id kaldirilirken (FAZ 10) gelir.
--   v_provider_roles: provider_services + providers + service_roles birlesimi (security_invoker;
--     RLS ve sutun yetkileri cagirana gore uygulanir).
--
-- YETKI: provider_services herkese okunur (RLS: saglayici yayinda VEYA kendi VEYA admin — bugunku
--   services_read_published ile ayni sinir); istemciden YAZMA YOLU YOK (2c'ye kadar). Hassas sutun yok.
--   Eski 5 tabloda tablo duzeyi GRANT var; yeni sutun otomatik kapsanir, RLS satir sinirini korur.
--
-- Idempotan. Sapkali harf yok.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) provider_services
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_services (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  role_id           integer NOT NULL REFERENCES public.service_roles(id) ON DELETE RESTRICT,
  is_primary        boolean NOT NULL DEFAULT false,
  capacity          integer,                                   -- ayni tarihte kac kisi/ekip (kaynak yok; 2c doldurur)
  pricing_mode      public.pricing_mode,                       -- fixed / range / on_request; kaynak yoksa NULL
  price_min         numeric,
  price_max         numeric,
  price_unit        public.provider_price_unit,                -- per_job / per_hour / per_half_day / per_day
  lead_time_days    integer,                                   -- kaynak yok; 2c doldurur
  origin            text NOT NULL DEFAULT 'legacy_sync',       -- legacy_sync: services'tan turetildi; provider: 2c'de dogrudan yazildi
  legacy_service_id uuid,                                      -- fiyatin alindigi services.id (bilgi; FK yok, aynalama gunceller)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_services_provider_role_key UNIQUE (provider_id, role_id),
  CONSTRAINT provider_services_origin_check CHECK (origin IN ('legacy_sync', 'provider')),
  CONSTRAINT provider_services_capacity_check CHECK (capacity IS NULL OR capacity >= 1),
  CONSTRAINT provider_services_lead_time_check CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  CONSTRAINT provider_services_price_check CHECK (
    (price_min IS NULL OR price_min >= 0) AND (price_max IS NULL OR price_max >= 0)
    AND (price_min IS NULL OR price_max IS NULL OR price_min <= price_max))
);

COMMENT ON TABLE  public.provider_services IS 'FAZ 2b: saglayicinin verdigi roller (coverage temeli). Cift alan doneminde services + profiles.primary_category_id''den turetilir (origin legacy_sync).';
COMMENT ON COLUMN public.provider_services.origin IS 'legacy_sync: aynalama yonetir (siler/gunceller); provider: 2c''de uygulama yazdi, aynalama dokunmaz.';
COMMENT ON COLUMN public.provider_services.legacy_service_id IS 'Fiyatin alindigi temsilci services satiri (aktif, en dusuk sort_order). Bilgi amacli; FK yok.';

-- saglayici basina en fazla BIR birincil rol
CREATE UNIQUE INDEX IF NOT EXISTS provider_services_one_primary_idx
  ON public.provider_services (provider_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS provider_services_role_idx ON public.provider_services (role_id);

DROP TRIGGER IF EXISTS on_provider_services_updated ON public.provider_services;
CREATE TRIGGER on_provider_services_updated
  BEFORE UPDATE ON public.provider_services
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 2) Eski tablolara provider_id (NULL olabilir; FK providers ON DELETE SET NULL)
--    ADD COLUMN IF NOT EXISTS: sutun varsa REFERENCES dahil tum satir atlanir (ilk kosuda gelen FK kalir).
-- -----------------------------------------------------------------------------
ALTER TABLE public.services            ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL;
ALTER TABLE public.portfolio_items     ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL;
ALTER TABLE public.profile_experiences ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL;
ALTER TABLE public.reviews             ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL;
ALTER TABLE public.favorites           ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS services_provider_id_idx            ON public.services (provider_id);
CREATE INDEX IF NOT EXISTS portfolio_items_provider_id_idx     ON public.portfolio_items (provider_id);
CREATE INDEX IF NOT EXISTS profile_experiences_provider_id_idx ON public.profile_experiences (provider_id);
CREATE INDEX IF NOT EXISTS reviews_provider_id_idx             ON public.reviews (provider_id);
CREATE INDEX IF NOT EXISTS favorites_provider_id_idx           ON public.favorites (provider_id);

COMMENT ON COLUMN public.services.provider_id            IS 'FAZ 2b: = profile_id (saglayici varsa). Tetikleyici turetir; istemci degeri ezilir. FAZ 10''da profile_id yerine gecer.';
COMMENT ON COLUMN public.portfolio_items.provider_id     IS 'FAZ 2b: = profile_id (saglayici varsa). Tetikleyici turetir.';
COMMENT ON COLUMN public.profile_experiences.provider_id IS 'FAZ 2b: = profile_id (saglayici varsa). Tetikleyici turetir.';
COMMENT ON COLUMN public.reviews.provider_id             IS 'FAZ 2b: = professional_id (saglayici varsa). Tetikleyici turetir.';
COMMENT ON COLUMN public.favorites.provider_id           IS 'FAZ 2b: = professional_id (saglayici varsa). Tetikleyici turetir.';

-- -----------------------------------------------------------------------------
-- 3) v_provider_roles (security_invoker: RLS + sutun yetkileri cagirana gore)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_provider_roles
WITH (security_invoker = true) AS
SELECT ps.provider_id,
       pr.provider_type,
       pr.slug          AS provider_slug,
       pr.display_name,
       pr.city_id,
       (pr.is_published AND pr.approval_status = 'approved' AND pr.suspended_at IS NULL) AS is_visible,
       ps.role_id,
       sr.slug          AS role_slug,
       sr.name_tr       AS role_name_tr,
       sr.emoji         AS role_emoji,
       sr.archetype     AS role_archetype,
       sr.is_active     AS role_is_active,
       ps.is_primary,
       ps.pricing_mode,
       ps.price_min,
       ps.price_max,
       ps.price_unit,
       ps.capacity,
       ps.lead_time_days,
       ps.origin
  FROM public.provider_services ps
  JOIN public.providers     pr ON pr.id = ps.provider_id
  JOIN public.service_roles sr ON sr.id = ps.role_id;

COMMENT ON VIEW public.v_provider_roles IS 'FAZ 2b: saglayici x rol (fiyat, birincil, gorunurluk). security_invoker.';

-- -----------------------------------------------------------------------------
-- 4) Yetki: herkese okuma (hassas sutun yok), istemciden yazma yok; service_role tam
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.provider_services FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.provider_services TO anon, authenticated;
GRANT ALL    ON public.provider_services TO service_role;
GRANT SELECT ON public.v_provider_roles  TO anon, authenticated, service_role;

ALTER TABLE public.provider_services ENABLE ROW LEVEL SECURITY;

-- services_read_published ile ayni sinir: saglayici yayinda ise herkes; kendi satiri; admin
DROP POLICY IF EXISTS provider_services_select_visible ON public.provider_services;
CREATE POLICY provider_services_select_visible ON public.provider_services
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = provider_services.provider_id AND pr.is_published)
    OR provider_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

COMMIT;
