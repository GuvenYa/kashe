-- =============================================================================
-- ASAMA 33 - Guvenlik 08 kontrolu (salt okuma) - YALNIZ URETIM
--
-- Migration 20261110120000_guvenlik_08_bildirim_cron_anahtari.sql sonrasi:
--   K1  bildirim isi yeni basligi (x-kashe-cron, Vault) kullaniyor, eski
--       Bearer / JWT anahtari komutta yok
--   K2  Vault'ta bildirim_cron_anahtari var (DEGER OKUNMAZ)
--   K3  is aktif
--   K4  BILGI: isin son 3 kosusu (zaman, durum)
--   K5  BILGI: son 3 HTTP yaniti (kod, yanitin basi). Beklenen 200 ve
--       {"processed":..}; 401 {"error":"yetkisiz"} fonksiyon sirri ile Vault
--       anahtarinin farkli oldugunu gosterir.
--   K6  BILGI: e-posta bekleyen mesaj (okunmamis, 5 dk'dan eski, gonderilmemis)
--   K7  BILGI: e-posta bekleyen bildirim (rfp / proposal / task / crm, 2 dk'dan eski)
--       K6 / K7 sifirdan buyukken K5 hep processed 0 diyorsa fonksiyon satirlari
--       goremiyor demektir (anahtar yetkisi) - bakilmali.
-- K1-K3 ESIT olmali. Dalda is olmadigi icin K1-K3 0 doner (beklenen; dalda
-- calistirmak gerekmez).
-- =============================================================================

WITH k AS (
  SELECT 'K1 bildirim isi yeni basligi kullaniyor' AS kontrol,
         (SELECT count(*) FROM cron.job
           WHERE jobname = 'send-message-notifications'
             AND command LIKE '%x-kashe-cron%'
             AND command LIKE '%vault.decrypted_secrets%'
             AND command NOT ILIKE '%bearer%'
             AND command NOT LIKE '%eyJ%') AS deger,
         1::bigint AS beklenen
  UNION ALL
  SELECT 'K2 Vault anahtari var (deger okunmaz)',
         (SELECT count(*) FROM vault.secrets WHERE name = 'bildirim_cron_anahtari'), 1
  UNION ALL
  SELECT 'K3 is aktif',
         (SELECT count(*) FROM cron.job
           WHERE jobname = 'send-message-notifications' AND active), 1
),
kosular AS (
  SELECT 'K4 BILGI: kosu ' || to_char(d.start_time AT TIME ZONE 'Europe/Istanbul', 'DD.MM HH24:MI:SS') AS kontrol,
         0::bigint AS deger, 0::bigint AS beklenen, d.status AS sonuc, d.start_time AS zaman
    FROM cron.job_run_details d
    JOIN cron.job j ON j.jobid = d.jobid
   WHERE j.jobname = 'send-message-notifications'
   ORDER BY d.start_time DESC
   LIMIT 3
),
yanitlar AS (
  SELECT 'K5 BILGI: http ' || to_char(r.created AT TIME ZONE 'Europe/Istanbul', 'DD.MM HH24:MI:SS') AS kontrol,
         r.status_code::bigint AS deger, r.status_code::bigint AS beklenen,
         left(coalesce(r.content, r.error_msg, ''), 80) AS sonuc, r.created AS zaman
    FROM net._http_response r
   ORDER BY r.created DESC
   LIMIT 3
)
SELECT kontrol, deger, beklenen,
       CASE WHEN deger = beklenen THEN 'ESIT' ELSE 'FARKLI' END AS sonuc
  FROM k
UNION ALL
SELECT kontrol, deger, beklenen, sonuc FROM (SELECT * FROM kosular ORDER BY zaman DESC) a
UNION ALL
SELECT kontrol, deger, beklenen, sonuc FROM (SELECT * FROM yanitlar ORDER BY zaman DESC) b
UNION ALL
SELECT 'K6 BILGI: e-posta bekleyen mesaj',
       (SELECT count(*) FROM public.messages
         WHERE read_at IS NULL AND email_notified_at IS NULL
           AND created_at < now() - interval '5 minutes'), 0, 'BILGI'
UNION ALL
SELECT 'K7 BILGI: e-posta bekleyen bildirim',
       (SELECT count(*) FROM public.notifications
         WHERE type IN ('rfp', 'proposal', 'task', 'crm') AND email_notified_at IS NULL
           AND created_at < now() - interval '2 minutes'), 0, 'BILGI';
