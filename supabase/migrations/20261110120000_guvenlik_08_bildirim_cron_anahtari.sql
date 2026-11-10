-- =============================================================================
-- GUVENLIK 08 - bildirim fonksiyonunun zamanlanmis cagrisi (API anahtari gecisi)
-- Plan: docs/envanter/53-guvenlik-08-api-anahtari-gecisi.md
--
--   Uretimdeki pg_cron isi `send-message-notifications` (*/5 dk) Edge Function'i
--   eski anon JWT ile (`Authorization: Bearer ...`) cagiriyordu. Eski anahtarlar
--   kapatilinca bu cagri duser; yeni anahtarlar JWT degil. Yeni duzen:
--   fonksiyon `verify_jwt = false`, cagri Vault'taki `bildirim_cron_anahtari`
--   ile `x-kashe-cron` basliginda dogrulanir. Bu anahtar yalniz bu fonksiyonu
--   tetikler, veritabani yetkisi tasimaz (Supabase ornegindeki gibi secret
--   anahtari Vault'a ve pg_net kuyruguna koymaktan dar).
--
--   Is YALNIZ uretimde var (bkz. 20260727160000 bolum 5): dalda ve harness'ta
--   is yoksa hicbir sey yapilmaz. Is varsa Vault anahtari ZORUNLU; yoksa
--   migration durur (gorev anahtarsiz kalmasin). Anahtar degeri bu dosyada YOK,
--   her calismada Vault'tan okunur.
--
-- Kontrol: docs/envanter/asama33-guvenlik08-kontrol.sql (uretim, salt okuma).
-- =============================================================================

DO $$
DECLARE
  v_is bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'Guvenlik 08: pg_cron yok, atlandi';
    RETURN;
  END IF;

  SELECT jobid INTO v_is FROM cron.job WHERE jobname = 'send-message-notifications';
  IF v_is IS NULL THEN
    RAISE NOTICE 'Guvenlik 08: send-message-notifications isi yok (dal), atlandi';
    RETURN;
  END IF;

  IF to_regclass('vault.secrets') IS NULL THEN
    RAISE EXCEPTION 'Guvenlik 08: Vault yok; bildirim_cron_anahtari eklenemez';
  END IF;
  -- Ayri sorgu: Vault yokken tablo adi plan asamasinda hata vermesin.
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'bildirim_cron_anahtari') THEN
    RAISE EXCEPTION 'Guvenlik 08: Vault''ta bildirim_cron_anahtari yok; once Dashboard''dan ekleyin (plan adim B)';
  END IF;

  PERFORM cron.alter_job(
    job_id := v_is,
    command := $cmd$
SELECT net.http_post(
  url := 'https://qydsooqmflrrwtgawhsv.supabase.co/functions/v1/send-message-notification',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-kashe-cron', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bildirim_cron_anahtari')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 30000
);
$cmd$
  );
  RAISE NOTICE 'Guvenlik 08: send-message-notifications (%) yeni basliga gecti', v_is;
END;
$$;
