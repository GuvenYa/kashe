-- HOŞGELDİN E-POSTASI — idempotency damgası.
--
-- profiles.welcome_email_sent_at: hoşgeldin e-postası bir kez gönderilsin diye damga.
-- null → henüz gönderilmedi; dolu → gönderildi (tekrar gönderme).
--
-- MANUEL uygulanır (Supabase Dashboard SQL Editor). `db push` KULLANMA.
-- Idempotent: ADD COLUMN IF NOT EXISTS. Tekrar çalıştırılabilir.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;

COMMENT ON COLUMN public.profiles.welcome_email_sent_at IS
  'Hoşgeldin e-postası gönderim damgası (idempotency). null = gönderilmedi.';

-- =============================================================================
-- DOĞRULAMA (uygulama SONRASI SQL Editor'de çalıştır)
-- =============================================================================
-- select column_name, data_type from information_schema.columns
--   where table_name='profiles' and column_name='welcome_email_sent_at';
-- select count(*) filter (where welcome_email_sent_at is not null) as gonderildi,
--        count(*) filter (where welcome_email_sent_at is null) as bekliyor
--   from public.profiles;
