-- DENEYİM TARİH ALANLARI — profile_experiences'a yapılandırılmış tarih kolonları.
--
-- Eski serbest metin period_label yerine ay/yıl select'leri: başlangıç + bitiş +
-- "devam ediyor". period_label KORUNUR (okuma-yalnız miras; tarih kolonları boşsa
-- render'da hâlâ kullanılır). award: tek tarih (yalnız start_*).
--
-- MANUEL uygulanır (Supabase Dashboard SQL Editor). `db push` KULLANMA.
-- Idempotent: ADD COLUMN IF NOT EXISTS (+ inline CHECK ilk eklemede). Tekrar çalıştırılabilir.

ALTER TABLE public.profile_experiences
  ADD COLUMN IF NOT EXISTS start_year  int,
  ADD COLUMN IF NOT EXISTS start_month smallint CHECK (start_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS end_year    int,
  ADD COLUMN IF NOT EXISTS end_month   smallint CHECK (end_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS is_current  boolean NOT NULL DEFAULT false;

-- =============================================================================
-- DOĞRULAMA (uygulama SONRASI SQL Editor'de çalıştır)
-- =============================================================================
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_name='profile_experiences'
--     and column_name in ('start_year','start_month','end_year','end_month','is_current')
--   order by column_name;
-- CHECK kısıtları:
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.profile_experiences'::regclass and contype='c';
