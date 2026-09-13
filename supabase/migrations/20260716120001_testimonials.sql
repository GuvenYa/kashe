-- Platform görüşleri (testimonials) — ana sayfa "Kullanıcılar ne diyor?" bölümü için
-- admin panelden yönetilen curated yorumlar. Blog altyapısıyla (blog_posts) aynı minik kalıp.
--
-- MANUEL uygulanır (Supabase Dashboard SQL Editor). `db push` KULLANMA.
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS/CREATE. Tekrar çalıştırılabilir.
--
-- Admin gate: bu repoda RLS için `is_admin()` SQL fonksiyonu YOK (admin kontrolü app
-- katmanında profiles.is_admin okunarak yapılıyor). Bu yüzden politikalar kendine yeterli
-- şekilde profiles.is_admin sütununu inline EXISTS ile kontrol eder (helper bağımlılığı yok).
BEGIN;

CREATE TABLE IF NOT EXISTS public.testimonials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name  text NOT NULL,                              -- görünen ad ("Selin A.")
  author_role  text,                                       -- "Müşteri · İstanbul", "DJ · Ankara"
  body         text NOT NULL,                              -- görüş metni
  rating       smallint NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  is_published boolean NOT NULL DEFAULT false,
  sort_order   int NOT NULL DEFAULT 0,
  source_note  text,                                       -- iç not: kaynak/izin (kamuya kapalı)
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Ana sayfa sorgusu (is_published + sort_order) için kısmi indeks
CREATE INDEX IF NOT EXISTS idx_testimonials_published_sort
  ON public.testimonials (sort_order)
  WHERE is_published = true;

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Herkes YALNIZCA yayındaki satırları okuyabilir
DROP POLICY IF EXISTS testimonials_public_read ON public.testimonials;
CREATE POLICY testimonials_public_read ON public.testimonials
  FOR SELECT
  USING (is_published = true);

-- Admin: tüm satırları okur + tüm yazma (INSERT/UPDATE/DELETE)
-- (Permissive politikalar OR'lanır → admin, public_read ile yayındakileri + admin_all ile
--  taslakları da görür; yazma yalnız admin.)
DROP POLICY IF EXISTS testimonials_admin_all ON public.testimonials;
CREATE POLICY testimonials_admin_all ON public.testimonials
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

COMMIT;
