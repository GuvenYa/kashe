-- =============================================================================
-- Hijyen 01 (19 Ekim 2026) — bildirim e-postasi isareti
--
-- Amac: `notifications` satirlari (FAZ 7b: type 'rfp' / 'proposal') uygulama ici
-- bildirimle kaliyordu; e-posta yoktu. Uretimdeki pg_cron isi (*/5 dk) zaten
-- `send-message-notification` Edge Function'ini cagiriyor (mesajlar icin). Ayni
-- fonksiyon bu sutunu isaret olarak kullanip rfp/proposal bildirimlerini de
-- e-postalar (alici e-postasi service_role ile auth.admin'den; uygulama PII okumaz).
--
-- Idempotan: iki kez calistirilabilir. Veri degismez, politika/yetki degismez.
-- =============================================================================
BEGIN;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_notified_at timestamptz;

COMMENT ON COLUMN public.notifications.email_notified_at IS
  'Hijyen 01 (19 Ekim 2026): e-posta gonderim zamani; NULL = henuz gonderilmedi. Edge Function send-message-notification rfp/proposal tiplerini isler.';

-- Bekleyen e-postalar icin dar kismi indeks (cron her 5 dk tarar).
CREATE INDEX IF NOT EXISTS notifications_email_pending_idx
  ON public.notifications (created_at)
  WHERE email_notified_at IS NULL AND type IN ('rfp', 'proposal');

COMMIT;
