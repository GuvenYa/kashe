-- KEŞFET ETKİNLİK TÜRÜ FİLTRESİ — category_attributes containment için GIN index.
--
-- Keşfet, ortak "etkinlik_turleri" alanına göre server-side filtreler:
--   category_attributes @> '{"etkinlik_turleri":["wedding"]}'
-- jsonb_path_ops GIN index @> (containment) sorgusunu hızlandırır.
--
-- MANUEL uygulanır (Supabase Dashboard SQL Editor). `db push` KULLANMA.
-- Idempotent: CREATE INDEX IF NOT EXISTS. Tekrar çalıştırılabilir.
-- Not: CONCURRENTLY kullanılmadı (küçük tablo + transaction içi çalışsın diye);
--      prod'da tablo büyükse CONCURRENTLY ile (transaction dışı) uygulanabilir.

CREATE INDEX IF NOT EXISTS idx_profiles_category_attributes_gin
  ON public.profiles USING gin (category_attributes jsonb_path_ops);

-- =============================================================================
-- DOĞRULAMA (uygulama SONRASI SQL Editor'de çalıştır)
-- =============================================================================
-- select indexname from pg_indexes
--   where tablename='profiles' and indexname='idx_profiles_category_attributes_gin';
-- explain analyze
--   select id from public.profiles
--   where category_attributes @> '{"etkinlik_turleri":["wedding"]}';
