-- PROFİL REDESIGN FAZ-1 / ADIM 1 — veri katmanı
-- public /p/[id] redesign altyapısı: kategori-bazlı esnek alanlar (JSONB) +
-- deneyim/eğitim/ödül tablosu.
--
-- MANUEL uygulanır (Supabase Dashboard SQL Editor). `db push` KULLANMA.
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
-- DROP POLICY IF EXISTS + CREATE / DROP TRIGGER IF EXISTS + CREATE.
BEGIN;

-- =============================================================================
-- a) profiles.category_attributes — kategoriye özel esnek alanlar (JSONB)
--    Şema config-driven (lib/category-fields.ts) — migration'sız alan eklenebilir.
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS category_attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.category_attributes IS
  'Kategoriye özel esnek profil alanları (quickInfo, modül verileri, service_region, experience_label, logistics, seviyeli yetenekler, bölüm tagline''ları). Şema: lib/category-fields.ts.';

-- ⚠️ protect_sensitive_profile_fields() BEFORE UPDATE trigger'ı:
-- Bu fonksiyon repo migration'larında YOK (drift — Dashboard'da oluşturulmuş).
-- Gövdesi repodan okunamadığı için whitelist/blacklist mantığı BURADAN doğrulanamadı.
-- Uygulamadan ÖNCE Dashboard'da fonksiyonu incele:
--   • BLACKLIST (yalnız role/is_admin/approval_status gibi alanları koruyorsa) → dokunma; category_attributes zaten sahibi tarafından güncellenebilir.
--   • WHITELIST (yalnız izinli alanların değişmesine izin verip diğerlerini OLD'a resetliyorsa) → category_attributes'u izinli listeye ekle, yoksa sahip güncelleyemez.
-- Fonksiyon repoda olmadığından güvenli tarafta kalmak için buradan DEĞİŞTİRİLMEDİ (rapora bakınız).

-- =============================================================================
-- b) profile_experiences — deneyim / eğitim / ödül satırları
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profile_experiences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('work', 'education', 'award')),
  group_key    text,                 -- experienceGroups anahtarı (ör. 'festival')
  title        text NOT NULL,
  subtitle     text,                 -- rol/alt satır, ör. "Rezidan DJ · haftalık set"
  organization text,                 -- firma/mekan, ör. "Klein Garten, İstanbul"
  location     text,
  period_label text,                 -- serbest metin: "2022 – halen", "Mayıs 2026"
  description  text,                 -- opsiyonel açılır anlatım
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_experiences_profile_kind_sort
  ON public.profile_experiences (profile_id, kind, sort_order);

-- updated_at — projedeki mevcut kalıp (services ile aynı fonksiyon)
DROP TRIGGER IF EXISTS update_profile_experiences_updated_at ON public.profile_experiences;
CREATE TRIGGER update_profile_experiences_updated_at
  BEFORE UPDATE ON public.profile_experiences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- c) RLS — portfolio_items / services kalıbının BİREBİR aynısı:
--    yayında profilin verisi herkese SELECT; sahibi tam CRUD; ayrı admin policy YOK.
--    (Yardımcı fonksiyon kullanılmıyor — yalnız auth.uid() + is_published EXISTS.)
-- =============================================================================
ALTER TABLE public.profile_experiences ENABLE ROW LEVEL SECURITY;

-- Sahibi kendi (yayında olmayan dahil) satırlarını okur
DROP POLICY IF EXISTS profile_experiences_read_own ON public.profile_experiences;
CREATE POLICY profile_experiences_read_own ON public.profile_experiences
  FOR SELECT USING (auth.uid() = profile_id);

-- Yayında profilin deneyimleri herkese açık
DROP POLICY IF EXISTS profile_experiences_read_published ON public.profile_experiences;
CREATE POLICY profile_experiences_read_published ON public.profile_experiences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_experiences.profile_id
        AND profiles.is_published = true
    )
  );

-- Sahibi ekler / günceller / siler
DROP POLICY IF EXISTS profile_experiences_insert_own ON public.profile_experiences;
CREATE POLICY profile_experiences_insert_own ON public.profile_experiences
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS profile_experiences_update_own ON public.profile_experiences;
CREATE POLICY profile_experiences_update_own ON public.profile_experiences
  FOR UPDATE USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS profile_experiences_delete_own ON public.profile_experiences;
CREATE POLICY profile_experiences_delete_own ON public.profile_experiences
  FOR DELETE USING (auth.uid() = profile_id);

COMMIT;

-- =============================================================================
-- d) DOĞRULAMA SORGULARI (uygulama SONRASI SQL Editor'de çalıştır)
-- =============================================================================
-- select column_name from information_schema.columns where table_name='profiles' and column_name='category_attributes';
-- select policyname, cmd from pg_policies where tablename='profile_experiences';
-- select kind, count(*) from public.profile_experiences group by kind;
