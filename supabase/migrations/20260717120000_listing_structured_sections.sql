-- İlan detay redesign DİLİM 1 — listings'e yapılandırılmış bölüm kolonları.
-- Genel açıklama (description) KALIR; bunlar opsiyonel ek bölümler.
-- MANUEL uygulanır (Dashboard SQL Editor). `db push` KULLANMA. Idempotent.
--
-- NOT: `requirements` kolonu ZATEN VAR (mevcut form "Gereksinimler" + detay sayfası
-- kullanıyor). Brief'teki "üç kolon" için buraya idempotent (IF NOT EXISTS) eklendi —
-- mevcut olduğu için no-op. Gerçekte yeni eklenen: project_details + work_conditions.
BEGIN;

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS project_details text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS requirements text; -- zaten var → no-op
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS work_conditions text;

-- Uzunluk CHECK'leri (mevcut requirements kolonuyla parity; form maxLength ile aynı).
-- ADD CONSTRAINT idempotent değil → duplicate_object yakalanarak tekrar çalıştırılabilir.
DO $$ BEGIN
  ALTER TABLE public.listings ADD CONSTRAINT listings_project_details_len
    CHECK (project_details IS NULL OR char_length(project_details) <= 3000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.listings ADD CONSTRAINT listings_work_conditions_len
    CHECK (work_conditions IS NULL OR char_length(work_conditions) <= 2000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.listings.project_details IS 'İlan yapılandırılmış bölüm: Proje detayları (opsiyonel, satır=madde).';
COMMENT ON COLUMN public.listings.requirements IS 'İlan yapılandırılmış bölüm: Aranan nitelikler (opsiyonel, satır=madde).';
COMMENT ON COLUMN public.listings.work_conditions IS 'İlan yapılandırılmış bölüm: Çalışma koşulları (opsiyonel, satır=madde).';

COMMIT;
