-- =============================================================================

-- SAHNE 02e (5/5) — 6 aylik gecmis: etkinlikler, konusmalar, mesajlar, teklifler, rezervasyonlar, yorumlar, ajans teklifleri (YALNIZ DALDA)

-- Uretildi: scripts/sahne/uret.py (tohum 2026, 2026-10-27). Sira: 01 -> 02a -> 02b -> ... (hepsi, atlamadan). 02a kendi gecmisini silip yeniden baslar.

-- =============================================================================

DO $$
DECLARE n_cron int := 0; n_prof int;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM cron.job WHERE jobname = ''send-message-notifications''' INTO n_cron;
  END IF;
  SELECT count(*) INTO n_prof FROM public.profiles WHERE email NOT LIKE 'faz1test+%' AND email NOT LIKE 'sahne+%';
  IF n_cron > 0 OR n_prof > 10 THEN
    RAISE EXCEPTION 'URETIM KORUMASI: bu veritabani uretim gibi gorunuyor (cron=%, test disi profil=%). Sahne yalniz dalda (ukqhgspaallzjscjodbb) kurulur. Hicbir sey yazilmadi.', n_cron, n_prof;
  END IF;
END $$;


CREATE OR REPLACE FUNCTION pg_temp.t(h numeric) RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT now() - (h * interval '1 hour') $$;
CREATE OR REPLACE FUNCTION pg_temp.d(n int) RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Europe/Istanbul')::date + n $$;
CREATE OR REPLACE FUNCTION pg_temp.kat(s text) RETURNS int LANGUAGE sql STABLE AS $$ SELECT id FROM public.service_categories WHERE slug = s $$;
CREATE OR REPLACE FUNCTION pg_temp.rol(s text) RETURNS int LANGUAGE sql STABLE AS $$ SELECT id FROM public.service_roles WHERE slug = s $$;
CREATE OR REPLACE FUNCTION pg_temp.sehir(s text) RETURNS int LANGUAGE sql STABLE AS $$ SELECT id FROM public.turkish_cities WHERE name = s ORDER BY id LIMIT 1 $$;
CREATE OR REPLACE FUNCTION pg_temp.org(p uuid) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.organizations WHERE legacy_profile_id = p $$;


DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM public.profiles WHERE email LIKE 'sahne+%'; IF n < 100 THEN RAISE EXCEPTION 'on kosul: 01-sahne-hesaplar.sql calistirilmamis (profil=%)', n; END IF; END $$;

DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM public.conversations WHERE id::text LIKE '5a4e0010-%'; IF n < 100 THEN RAISE EXCEPTION 'on kosul: once 02a..02d (konusma=%)', n; END IF; END $$;

INSERT INTO public.analytics_events (event_name, entity_type, entity_id, provider_id, payload, occurred_at, actor_user_id)
SELECT v.ad, v.tip, v.eid::uuid, v.prov::uuid, v.payload, v.ts, v.actor::uuid FROM (VALUES
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 42000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(760.66), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 36000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1582.34), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 45000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1517.87), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 39000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(666.62), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 15500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1441.33), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 13500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1629.88), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010113', '{"total_amount": 16000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2090.74), '5a4e0000-0000-4000-8000-000000040006'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010113', '{"total_amount": 21000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(3801.03), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 26000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(858.35), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000011', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 42500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(512.44), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000012', '5a4e0000-0000-4000-8000-000000010036', '{"total_amount": 24500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(3643.65), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000014', '5a4e0000-0000-4000-8000-000000010081', '{"total_amount": 17000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(3841.20), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000015', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 30500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(415.71), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000016', '5a4e0000-0000-4000-8000-000000010122', '{"total_amount": 16000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(1571.65), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000017', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 62000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1629.33), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000018', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 45500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1758.28), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000019', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 28000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1305.89), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000020', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 28500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1051.50), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000021', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 62500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(105.48), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000022', '5a4e0000-0000-4000-8000-000000010042', '{"total_amount": 269500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1147.11), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000023', '5a4e0000-0000-4000-8000-000000010072', '{"total_amount": 11000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2189.65), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000024', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 12500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1842.95), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000025', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 16500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1626.47), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000027', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 36500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(681.46), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000028', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 46000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1249.25), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000030', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 51000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1145.43), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000032', '5a4e0000-0000-4000-8000-000000010025', '{"total_amount": 15000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(830.92), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000033', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 35000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1711.38), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000035', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 27500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1011.72), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000036', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 47000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1789.12), '5a4e0000-0000-4000-8000-000000040009'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000037', '5a4e0000-0000-4000-8000-000000010062', '{"total_amount": 92000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(1237.96), '5a4e0000-0000-4000-8000-000000040017'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000038', '5a4e0000-0000-4000-8000-000000010001', '{"total_amount": 49000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(399.23), '5a4e0000-0000-4000-8000-000000040006'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000039', '5a4e0000-0000-4000-8000-000000010038', '{"total_amount": 20500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3424.05), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000040', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 34000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(869.72), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000041', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 62500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1720.55), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000042', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 48500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1605.28), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000043', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 24500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1544.25), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000044', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 27500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1691.87), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000045', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 60000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(61.42), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000046', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 32500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(796.79), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000047', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 33500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(474.42), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000048', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 33000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1763.38), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000050', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 11000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1014.07), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000051', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 18500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(542.38), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000052', '5a4e0000-0000-4000-8000-000000010106', '{"total_amount": 5000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(2853.55), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000053', '5a4e0000-0000-4000-8000-000000010062', '{"total_amount": 33500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(1175.66), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000054', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 35500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(711.43), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000055', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 36500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(350.45), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000057', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 29000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1142.56), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000058', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 17000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(980.65), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000059', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 31500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(69.41), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000060', '5a4e0000-0000-4000-8000-000000010039', '{"total_amount": 39000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2260.49), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000061', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 12500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1266.32), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000062', '5a4e0000-0000-4000-8000-000000010046', '{"total_amount": 267000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(3976.96), '5a4e0000-0000-4000-8000-000000040003'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000063', '5a4e0000-0000-4000-8000-000000010073', '{"total_amount": 14000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2430.46), '5a4e0000-0000-4000-8000-000000040016'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000064', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 29000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(443.26), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000065', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 26500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(339.26), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000066', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 32500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1289.94), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000067', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 25000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(232.93), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000068', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 32000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(433.85), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000069', '5a4e0000-0000-4000-8000-000000010008', '{"total_amount": 47000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(672.27), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000070', '5a4e0000-0000-4000-8000-000000010107', '{"total_amount": 53000, "event_type": "congress", "event_id": null}'::jsonb, pg_temp.t(890.76), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000071', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 42000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1012.80), '5a4e0000-0000-4000-8000-000000040011'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000072', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 33000, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(1482.87), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000073', '5a4e0000-0000-4000-8000-000000010087', '{"total_amount": 14000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1212.05), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000074', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 40000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1413.39), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000075', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 40000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(809.67), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000076', '5a4e0000-0000-4000-8000-000000010115', '{"total_amount": 34500, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(1761.87), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000077', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 30000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1011.18), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000078', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 15000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1033.91), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000079', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 12500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1743.69), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000080', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 42000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1490.11), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000081', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 16000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1382.35), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000082', '5a4e0000-0000-4000-8000-000000010094', '{"total_amount": 11000, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(1602.65), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000083', '5a4e0000-0000-4000-8000-000000010016', '{"total_amount": 13500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2016.55), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000084', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 33000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(420.31), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000085', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 23000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(717.46), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000086', '5a4e0000-0000-4000-8000-000000010005', '{"total_amount": 42500, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(2025.85), '5a4e0000-0000-4000-8000-000000040013'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000087', '5a4e0000-0000-4000-8000-000000010063', '{"total_amount": 57000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(3826.39), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000088', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 54000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(351.53), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000090', '5a4e0000-0000-4000-8000-000000010047', '{"total_amount": 4000, "event_type": "congress", "event_id": null}'::jsonb, pg_temp.t(3744.37), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000091', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 11000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(997.30), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000092', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 36500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(481.99), '5a4e0000-0000-4000-8000-000000040003'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000093', '5a4e0000-0000-4000-8000-000000010075', '{"total_amount": 13000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(3269.45), '5a4e0000-0000-4000-8000-000000040012'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000094', '5a4e0000-0000-4000-8000-000000010105', '{"total_amount": 7000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3174.67), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000095', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 22000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1262.32), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000096', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 34000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(484.85), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000097', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 14500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1741.37), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000099', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 35000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1357.41), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000100', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 43500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(101.50), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000102', '5a4e0000-0000-4000-8000-000000010080', '{"total_amount": 20000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(705.08), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000103', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 24500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(221.62), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000104', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 21500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1304.20), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000105', '5a4e0000-0000-4000-8000-000000010099', '{"total_amount": 12000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(1560.71), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000106', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 54000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(205.61), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000107', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 11500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1652.38), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000108', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 19500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1596.01), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000109', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 20000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(380.86), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000110', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 47500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1678.38), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000111', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 23500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(875.77), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000112', '5a4e0000-0000-4000-8000-000000010034', '{"total_amount": 57500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1354.56), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000114', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 45000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(235.46), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000115', '5a4e0000-0000-4000-8000-000000010113', '{"total_amount": 22000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(2943.40), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000116', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 13500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1442.75), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000117', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 24000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(519.87), '5a4e0000-0000-4000-8000-000000031003'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000118', '5a4e0000-0000-4000-8000-000000010077', '{"total_amount": 7500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(3764.36), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000120', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 30000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1017.05), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000121', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 12500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(509.03), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000122', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 60500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1038.14), '5a4e0000-0000-4000-8000-000000031001'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000123', '5a4e0000-0000-4000-8000-000000010005', '{"total_amount": 37500, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(3937.93), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000124', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 60000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1092.45), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000125', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 37000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1543.82), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000126', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 53000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(494.34), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000128', '5a4e0000-0000-4000-8000-000000010102', '{"total_amount": 28500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(2085.27), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000129', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 39500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1796.41), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000130', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 49000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(640.57), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000131', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 24500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(879.69), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000132', '5a4e0000-0000-4000-8000-000000010106', '{"total_amount": 11500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1236.88), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000133', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 49500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(361.63), '5a4e0000-0000-4000-8000-000000040014'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000134', '5a4e0000-0000-4000-8000-000000010039', '{"total_amount": 28000, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(4159.46), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000135', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 34000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(344.20), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000136', '5a4e0000-0000-4000-8000-000000010091', '{"total_amount": 21500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(2773.27), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000137', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 27500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1741.56), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000138', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 57000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(120.00), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000139', '5a4e0000-0000-4000-8000-000000010034', '{"total_amount": 59000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1288.26), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000140', '5a4e0000-0000-4000-8000-000000010121', '{"total_amount": 11000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(975.13), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000142', '5a4e0000-0000-4000-8000-000000010053', '{"total_amount": 22500, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(1934.37), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000143', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 15000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(597.97), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000144', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 15500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(522.33), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000145', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 37000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(596.39), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000146', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 17500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1745.26), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000148', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 20500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(637.88), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000149', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 44000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(998.87), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000150', '5a4e0000-0000-4000-8000-000000010070', '{"total_amount": 8500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1703.17), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000151', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 24500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1741.53), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000152', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 40000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1539.88), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000153', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 25500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1135.14), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000154', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 11000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(937.71), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000155', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 16000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(93.22), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000156', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 21500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(583.46), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000157', '5a4e0000-0000-4000-8000-000000010026', '{"total_amount": 43500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2999.22), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000158', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 19000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1509.13), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000159', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 9500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(592.98), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000162', '5a4e0000-0000-4000-8000-000000010053', '{"total_amount": 19500, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(3532.32), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000163', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 32000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1227.00), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000164', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 40000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1859.49), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000165', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 23000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(579.77), '5a4e0000-0000-4000-8000-000000040008'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000166', '5a4e0000-0000-4000-8000-000000010074', '{"total_amount": 16000, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(3985.44), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000167', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 10500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1231.78), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000168', '5a4e0000-0000-4000-8000-000000010047', '{"total_amount": 4000, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(3454.66), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000169', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 27500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1738.46), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000170', '5a4e0000-0000-4000-8000-000000010109', '{"total_amount": 54500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(3416.81), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000171', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 22500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(288.05), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000172', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 17000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(257.52), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000173', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 18500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(935.62), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000174', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 34500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(942.20), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000175', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 8500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1026.78), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000176', '5a4e0000-0000-4000-8000-000000010001', '{"total_amount": 45000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1531.30), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000177', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 45500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(529.33), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000178', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 15000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1762.40), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000179', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 34500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1566.35), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000180', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 29000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1242.17), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000181', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 30000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1239.32), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000182', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 14000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(317.19), '5a4e0000-0000-4000-8000-000000040014'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000184', '5a4e0000-0000-4000-8000-000000010087', '{"total_amount": 7500, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(3415.59), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000185', '5a4e0000-0000-4000-8000-000000010044', '{"total_amount": 202500, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(629.83), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000186', '5a4e0000-0000-4000-8000-000000010077', '{"total_amount": 10000, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(30.97), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000187', '5a4e0000-0000-4000-8000-000000010115', '{"total_amount": 58000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(587.53), '5a4e0000-0000-4000-8000-000000040007'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000188', '5a4e0000-0000-4000-8000-000000010029', '{"total_amount": 35000, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(980.36), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000189', '5a4e0000-0000-4000-8000-000000010053', '{"total_amount": 9500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3855.05), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000190', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 33000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1657.82), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000192', '5a4e0000-0000-4000-8000-000000010089', '{"total_amount": 14000, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(3159.44), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000193', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 40500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(120.48), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000194', '5a4e0000-0000-4000-8000-000000010114', '{"total_amount": 21000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(1862.14), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000195', '5a4e0000-0000-4000-8000-000000010080', '{"total_amount": 26000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1334.02), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000196', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 15000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1485.03), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000197', '5a4e0000-0000-4000-8000-000000010075', '{"total_amount": 14000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(680.06), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000198', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 12500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(797.14), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000199', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 12500, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(263.23), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000200', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 48000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(153.90), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000201', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 14000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1739.42), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000202', '5a4e0000-0000-4000-8000-000000010019', '{"total_amount": 27500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(370.43), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000203', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 19000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(950.25), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000204', '5a4e0000-0000-4000-8000-000000010061', '{"total_amount": 92000, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(577.70), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000205', '5a4e0000-0000-4000-8000-000000010108', '{"total_amount": 70500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(79.90), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000206', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 9000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(682.22), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000207', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 17000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1804.94), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000208', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 50000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(562.87), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000209', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 13000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1682.24), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000210', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 21000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(974.53), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000211', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 28000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1688.26), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000212', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 28500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1157.09), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000213', '5a4e0000-0000-4000-8000-000000010105', '{"total_amount": 6000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3699.67), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000214', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 26500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(98.87), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000216', '5a4e0000-0000-4000-8000-000000010052', '{"total_amount": 3500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(2246.45), '5a4e0000-0000-4000-8000-000000040005'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000217', '5a4e0000-0000-4000-8000-000000010002', '{"total_amount": 36500, "event_type": "baby_shower", "event_id": null}'::jsonb, pg_temp.t(2928.70), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000218', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 58500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1795.78), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000219', '5a4e0000-0000-4000-8000-000000010049', '{"total_amount": 3500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(3570.12), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000220', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 31000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1453.79), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000221', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 26500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1102.94), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000222', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 42500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1118.46), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000223', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 16500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(727.26), '5a4e0000-0000-4000-8000-000000030006'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000224', '5a4e0000-0000-4000-8000-000000010082', '{"total_amount": 24000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(4026.06), '5a4e0000-0000-4000-8000-000000030005'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000225', '5a4e0000-0000-4000-8000-000000010092', '{"total_amount": 46000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3435.14), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000226', '5a4e0000-0000-4000-8000-000000010113', '{"total_amount": 46000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(2834.63), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000227', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 25500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(728.15), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000228', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 35000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(855.24), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000230', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 29000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1167.54), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000231', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 14000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1135.60), '5a4e0000-0000-4000-8000-000000040019'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000232', '5a4e0000-0000-4000-8000-000000010038', '{"total_amount": 30500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2685.87), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000233', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 54500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(468.74), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000234', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 17000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1482.25), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000235', '5a4e0000-0000-4000-8000-000000010101', '{"total_amount": 27500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(1239.85), '5a4e0000-0000-4000-8000-000000040018'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000236', '5a4e0000-0000-4000-8000-000000010093', '{"total_amount": 32500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(1539.18), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000237', '5a4e0000-0000-4000-8000-000000010005', '{"total_amount": 37000, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(1043.63), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000238', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 24500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(168.98), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000239', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 34500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(679.53), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000240', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 40500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(729.41), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000241', '5a4e0000-0000-4000-8000-000000010043', '{"total_amount": 105000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1938.44), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000242', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 32500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(615.64), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000243', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 53500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(870.59), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000244', '5a4e0000-0000-4000-8000-000000010010', '{"total_amount": 13000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(447.28), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000245', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 17000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1017.02), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000246', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 33000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(568.77), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000247', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 48500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(851.04), '5a4e0000-0000-4000-8000-000000030003'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000248', '5a4e0000-0000-4000-8000-000000010087', '{"total_amount": 8500, "event_type": "congress", "event_id": null}'::jsonb, pg_temp.t(2560.45), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000249', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 33500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(618.56), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000250', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 63000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2958.06), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000251', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 53000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1268.03), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000252', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 52500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1457.28), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000253', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 23500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(61.63), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000254', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 27500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(897.57), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000255', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 10500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1366.49), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000256', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 34500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(991.42), '5a4e0000-0000-4000-8000-000000040012'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000257', '5a4e0000-0000-4000-8000-000000010062', '{"total_amount": 71000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2944.80), '5a4e0000-0000-4000-8000-000000040015'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000261', '5a4e0000-0000-4000-8000-000000010122', '{"total_amount": 15500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(3818.45), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000262', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 23500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(389.17), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000264', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 28500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(293.44), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000265', '5a4e0000-0000-4000-8000-000000010109', '{"total_amount": 48000, "event_type": "congress", "event_id": null}'::jsonb, pg_temp.t(101.13), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000266', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 18000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1643.04), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000267', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 23500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(569.93), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000268', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 34500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1430.20), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000269', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 39000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1530.60), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000270', '5a4e0000-0000-4000-8000-000000010073', '{"total_amount": 23500, "event_type": "other", "event_id": null}'::jsonb, pg_temp.t(2336.36), '5a4e0000-0000-4000-8000-000000030007'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000271', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 49500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(740.13), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000272', '5a4e0000-0000-4000-8000-000000010078', '{"total_amount": 18000, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(2737.77), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000273', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 17000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(465.39), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000274', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 8500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(60.34), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000275', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 22000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(697.93), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000276', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 26000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1630.62), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000277', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 28000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(407.46), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000278', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 20000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(448.14), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000279', '5a4e0000-0000-4000-8000-000000010077', '{"total_amount": 11500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(894.83), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000282', '5a4e0000-0000-4000-8000-000000010091', '{"total_amount": 16500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(381.71), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000283', '5a4e0000-0000-4000-8000-000000010094', '{"total_amount": 45000, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(230.40), '5a4e0000-0000-4000-8000-000000040020'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000284', '5a4e0000-0000-4000-8000-000000010099', '{"total_amount": 27500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(3973.19), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000285', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 28500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(866.77), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000286', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 46000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(401.93), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000287', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 29500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(155.28), '5a4e0000-0000-4000-8000-000000030003'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000288', '5a4e0000-0000-4000-8000-000000010051', '{"total_amount": 4000, "event_type": "congress", "event_id": null}'::jsonb, pg_temp.t(541.83), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000289', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 30000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(281.80), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000290', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 46000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(464.87), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000291', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 26500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1187.23), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000292', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 17500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1073.33), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000293', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 14000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2530.65), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000294', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 30500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(601.97), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000295', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 47000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(920.06), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000296', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 29500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1106.06), '5a4e0000-0000-4000-8000-000000031003'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000297', '5a4e0000-0000-4000-8000-000000010089', '{"total_amount": 14500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(2050.58), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000298', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 38500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(377.48), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000299', '5a4e0000-0000-4000-8000-000000010067', '{"total_amount": 18500, "event_type": "other", "event_id": null}'::jsonb, pg_temp.t(2875.27), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000300', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 20500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(285.27), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000301', '5a4e0000-0000-4000-8000-000000010118', '{"total_amount": 51000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1647.96), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000302', '5a4e0000-0000-4000-8000-000000010043', '{"total_amount": 132000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1921.59), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000303', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 24000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(922.59), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000305', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 21000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(222.44), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000306', '5a4e0000-0000-4000-8000-000000010072', '{"total_amount": 14000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1708.35), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000307', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 19000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(958.04), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000308', '5a4e0000-0000-4000-8000-000000010022', '{"total_amount": 51000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2804.16), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000309', '5a4e0000-0000-4000-8000-000000010084', '{"total_amount": 9000, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(3520.04), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000310', '5a4e0000-0000-4000-8000-000000010102', '{"total_amount": 16500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(1381.67), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000311', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 31000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(99.79), '5a4e0000-0000-4000-8000-000000040017'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000312', '5a4e0000-0000-4000-8000-000000010098', '{"total_amount": 10000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1469.24), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000314', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 53500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1759.22), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000315', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 32500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1396.49), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000317', '5a4e0000-0000-4000-8000-000000010061', '{"total_amount": 36000, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(2564.43), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000318', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 46000, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(136.98), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000320', '5a4e0000-0000-4000-8000-000000010010', '{"total_amount": 34500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3691.66), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000321', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 30500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(504.17), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000325', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 34000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1036.62), '5a4e0000-0000-4000-8000-000000040007'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000326', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 27000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(3792.08), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000329', '5a4e0000-0000-4000-8000-000000010046', '{"total_amount": 137500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(2496.84), '5a4e0000-0000-4000-8000-000000031005'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000331', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 48500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(1613.31), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000332', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 34000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1031.91), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000334', '5a4e0000-0000-4000-8000-000000010048', '{"total_amount": 3000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(1105.12), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000335', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 8500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1456.83), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000337', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 61000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1569.52), '5a4e0000-0000-4000-8000-000000030007'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000338', '5a4e0000-0000-4000-8000-000000010025', '{"total_amount": 37000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2360.86), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000339', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 22000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(457.82), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000340', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 46500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(108.01), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000341', '5a4e0000-0000-4000-8000-000000010030', '{"total_amount": 22500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2679.16), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000342', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 11500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(807.93), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000343', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 17000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(326.70), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000344', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 51500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(907.87), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000345', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 23500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(220.47), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000346', '5a4e0000-0000-4000-8000-000000010015', '{"total_amount": 13500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(205.49), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000347', '5a4e0000-0000-4000-8000-000000010107', '{"total_amount": 42500, "event_type": "congress", "event_id": null}'::jsonb, pg_temp.t(2611.59), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000348', '5a4e0000-0000-4000-8000-000000010038', '{"total_amount": 18000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2119.56), '5a4e0000-0000-4000-8000-000000031005'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000349', '5a4e0000-0000-4000-8000-000000010085', '{"total_amount": 5000, "event_type": "circumcision", "event_id": null}'::jsonb, pg_temp.t(1669.09), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000350', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 31000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(376.76), '5a4e0000-0000-4000-8000-000000040018'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000351', '5a4e0000-0000-4000-8000-000000010047', '{"total_amount": 3500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(4227.47), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000353', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 38500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(898.86), '5a4e0000-0000-4000-8000-000000031006')
) AS v(ad, tip, eid, prov, payload, ts, actor)
ON CONFLICT (event_name, entity_id) DO NOTHING;

-- C) teklif topla (quote_requests): kurum uyeleri ve musterilerden 1-2

INSERT INTO public.quote_requests (id, customer_id, category_id, city_id, brief_data, event_date, event_type, budget_min, budget_max, response_deadline, recipient_count, status, created_at, created_by)
VALUES
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000040001', pg_temp.kat('muzisyen'), pg_temp.sehir('Ankara'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(87), 'engagement', 10000, 35000, pg_temp.t(322.59), 4, 'active', pg_temp.t(442.59), '5a4e0000-0000-4000-8000-000000040001'),
('5a4e0030-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000040010', pg_temp.kat('karikaturist'), pg_temp.sehir('İstanbul'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(19), 'birthday', 4000, 9000, pg_temp.t(-53.09), 3, 'active', pg_temp.t(66.91), '5a4e0000-0000-4000-8000-000000040010'),
('5a4e0030-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000040012', pg_temp.kat('akrobat'), pg_temp.sehir('Bursa'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(57), 'concert', 8000, 20000, pg_temp.t(136.59), 4, 'active', pg_temp.t(256.59), '5a4e0000-0000-4000-8000-000000040012'),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000040018', pg_temp.kat('canli-yayin'), pg_temp.sehir('Antalya'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(75), 'conference', 12000, 35000, pg_temp.t(534.39), 4, 'active', pg_temp.t(654.39), '5a4e0000-0000-4000-8000-000000040018'),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000031007', pg_temp.kat('fotografci'), pg_temp.sehir('Ankara'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(21), 'wedding', 12000, 32500, pg_temp.t(514.84), 4, 'active', pg_temp.t(634.84), '5a4e0000-0000-4000-8000-000000031007'),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000040017', pg_temp.kat('canli-yayin'), pg_temp.sehir('Gaziantep'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(83), 'launch', 12000, 35000, pg_temp.t(710.90), 4, 'active', pg_temp.t(830.90), '5a4e0000-0000-4000-8000-000000040017'),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000040015', pg_temp.kat('fotografci'), pg_temp.sehir('İzmir'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(47), 'henna', 12000, 32500, pg_temp.t(643.58), 4, 'active', pg_temp.t(763.58), '5a4e0000-0000-4000-8000-000000040015'),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000040005', pg_temp.kat('karikaturist'), pg_temp.sehir('Ankara'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(20), 'birthday', 4000, 9000, pg_temp.t(670.01), 3, 'active', pg_temp.t(790.01), '5a4e0000-0000-4000-8000-000000040005'),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000031004', pg_temp.kat('akrobat'), pg_temp.sehir('İzmir'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(76), 'wedding', 8000, 20000, pg_temp.t(214.06), 4, 'active', pg_temp.t(334.06), '5a4e0000-0000-4000-8000-000000031004'),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000040003', pg_temp.kat('akrobat'), pg_temp.sehir('İzmir'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(15), 'gala', 8000, 20000, pg_temp.t(233.86), 4, 'active', pg_temp.t(353.86), '5a4e0000-0000-4000-8000-000000040003');

INSERT INTO public.quote_request_recipients (request_id, professional_id, status, created_at)
VALUES
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010020', 'sent', pg_temp.t(442.59)),
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010021', 'viewed', pg_temp.t(442.59)),
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010022', 'viewed', pg_temp.t(442.59)),
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010023', 'viewed', pg_temp.t(442.59)),
('5a4e0030-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000010096', 'sent', pg_temp.t(66.91)),
('5a4e0030-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000010097', 'viewed', pg_temp.t(66.91)),
('5a4e0030-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000010098', 'viewed', pg_temp.t(66.91)),
('5a4e0030-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000010099', 'viewed', pg_temp.t(256.59)),
('5a4e0030-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000010100', 'declined', pg_temp.t(256.59)),
('5a4e0030-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000010101', 'viewed', pg_temp.t(256.59)),
('5a4e0030-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000010102', 'declined', pg_temp.t(256.59)),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010111', 'declined', pg_temp.t(654.39)),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010112', 'declined', pg_temp.t(654.39)),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010113', 'viewed', pg_temp.t(654.39)),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010114', 'sent', pg_temp.t(654.39)),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010001', 'viewed', pg_temp.t(634.84)),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010002', 'sent', pg_temp.t(634.84)),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010003', 'sent', pg_temp.t(634.84)),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010004', 'sent', pg_temp.t(634.84)),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010111', 'declined', pg_temp.t(830.90)),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010112', 'viewed', pg_temp.t(830.90)),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010113', 'declined', pg_temp.t(830.90)),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010114', 'declined', pg_temp.t(830.90)),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010001', 'viewed', pg_temp.t(763.58)),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010002', 'sent', pg_temp.t(763.58)),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010003', 'sent', pg_temp.t(763.58)),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010004', 'sent', pg_temp.t(763.58)),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010096', 'declined', pg_temp.t(790.01)),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010097', 'declined', pg_temp.t(790.01)),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010098', 'sent', pg_temp.t(790.01)),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010099', 'viewed', pg_temp.t(334.06)),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010100', 'sent', pg_temp.t(334.06)),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010101', 'viewed', pg_temp.t(334.06)),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010102', 'sent', pg_temp.t(334.06)),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010099', 'sent', pg_temp.t(353.86)),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010100', 'sent', pg_temp.t(353.86)),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010101', 'viewed', pg_temp.t(353.86)),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010102', 'declined', pg_temp.t(353.86));

-- D) ajans teklifleri: proposals/versions/items (kashe.faz7_rpc bayragi), gonderim, onay/red, FAZ 7c rezervasyon

DO $$
BEGIN
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  INSERT INTO public.proposals (id, seller_organization_id, seller_provider_id, buyer_user_id, buyer_organization_id, event_id, title, client_name, client_email, source_type, created_by, created_at, updated_at)
  VALUES
('5a4e0003-0000-4000-8000-000000000001', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, NULL, '5a4e0002-0000-4000-8000-000000000001', 'Ece Kına Gecesi — Sahne ve müzik', 'Orhan Turan', 'orhan-turan@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(3290.02), pg_temp.t(3290.02)),
('5a4e0003-0000-4000-8000-000000000002', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', '5a4e0000-0000-4000-8000-000000040002', NULL, '5a4e0002-0000-4000-8000-000000000002', 'Yasemin Doğum Günü Partisi — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(5065.87), pg_temp.t(5065.87)),
('5a4e0003-0000-4000-8000-000000000003', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, NULL, '5a4e0002-0000-4000-8000-000000000002', 'Yasemin Doğum Günü Partisi — Sahne ve müzik', 'Burak Çelik', 'burak-celik@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(5078.73), pg_temp.t(5078.73)),
('5a4e0003-0000-4000-8000-000000000004', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', '5a4e0000-0000-4000-8000-000000040010', NULL, '5a4e0002-0000-4000-8000-000000000002', 'Yasemin Doğum Günü Partisi — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(5081.20), pg_temp.t(5081.20)),
('5a4e0003-0000-4000-8000-000000000005', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, NULL, '5a4e0002-0000-4000-8000-000000000003', 'Marmara Perakende Grubu Bayi Toplantısı — Tam kapsam teklifi', 'Selim Aydın', 'selim-aydin@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(1471.09), pg_temp.t(1471.09)),
('5a4e0003-0000-4000-8000-000000000006', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000003', 'Marmara Perakende Grubu Bayi Toplantısı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(1470.34), pg_temp.t(1470.34)),
('5a4e0003-0000-4000-8000-000000000007', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', '5a4e0000-0000-4000-8000-000000040016', NULL, '5a4e0002-0000-4000-8000-000000000005', 'Zeynep ve Yusuf Düğün Daveti — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(2626.66), pg_temp.t(2626.66)),
('5a4e0003-0000-4000-8000-000000000008', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', '5a4e0000-0000-4000-8000-000000040008', NULL, '5a4e0002-0000-4000-8000-000000000006', 'Hazal & Eren Düğünü — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2899.13), pg_temp.t(2899.13)),
('5a4e0003-0000-4000-8000-000000000009', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, NULL, '5a4e0002-0000-4000-8000-000000000007', 'Mavi Deniz Turizm Fuar Standı — Organizasyon teklifi', 'Murat Öztürk', 'murat-ozturk@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2124.63), pg_temp.t(2124.63)),
('5a4e0003-0000-4000-8000-000000000010', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, NULL, '5a4e0002-0000-4000-8000-000000000007', 'Mavi Deniz Turizm Fuar Standı — Teknik paket', 'Ece Uysal', 'ece-uysal@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2121.29), pg_temp.t(2121.29)),
('5a4e0003-0000-4000-8000-000000000011', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030008'), '5a4e0002-0000-4000-8000-000000000008', 'Boğaziçi Finans Yaz Konseri — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3586.99), pg_temp.t(3586.99)),
('5a4e0003-0000-4000-8000-000000000012', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000008', 'Boğaziçi Finans Yaz Konseri — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3607.92), pg_temp.t(3607.92)),
('5a4e0003-0000-4000-8000-000000000013', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', '5a4e0000-0000-4000-8000-000000040013', NULL, '5a4e0002-0000-4000-8000-000000000008', 'Boğaziçi Finans Yaz Konseri — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3578.37), pg_temp.t(3578.37)),
('5a4e0003-0000-4000-8000-000000000014', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', '5a4e0000-0000-4000-8000-000000040009', NULL, '5a4e0002-0000-4000-8000-000000000010', 'Sıla Doğum Günü Partisi — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(2419.21), pg_temp.t(2419.21)),
('5a4e0003-0000-4000-8000-000000000015', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', NULL, NULL, '5a4e0002-0000-4000-8000-000000000011', 'Selin ve Kaan Düğün Daveti — Tam kapsam teklifi', 'Lale Acar', 'lale-acar@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(2966.17), pg_temp.t(2966.17)),
('5a4e0003-0000-4000-8000-000000000016', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', '5a4e0000-0000-4000-8000-000000040013', NULL, '5a4e0002-0000-4000-8000-000000000014', 'Yasemin & Alp Nişanı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1064.64), pg_temp.t(1064.64)),
('5a4e0003-0000-4000-8000-000000000017', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', '5a4e0000-0000-4000-8000-000000040013', NULL, '5a4e0002-0000-4000-8000-000000000014', 'Yasemin & Alp Nişanı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1060.68), pg_temp.t(1060.68)),
('5a4e0003-0000-4000-8000-000000000018', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', '5a4e0000-0000-4000-8000-000000040005', NULL, '5a4e0002-0000-4000-8000-000000000014', 'Yasemin & Alp Nişanı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1079.18), pg_temp.t(1079.18)),
('5a4e0003-0000-4000-8000-000000000019', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', '5a4e0000-0000-4000-8000-000000040010', NULL, '5a4e0002-0000-4000-8000-000000000015', 'Eda ve Volkan Düğün Daveti — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(203.62), pg_temp.t(203.62)),
('5a4e0003-0000-4000-8000-000000000020', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', NULL, NULL, '5a4e0002-0000-4000-8000-000000000016', 'İrem ve Levent Düğün Daveti — Çekim ve içerik', 'Fulya Erdem', 'fulya-erdem@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(2174.46), pg_temp.t(2174.46)),
('5a4e0003-0000-4000-8000-000000000021', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', '5a4e0000-0000-4000-8000-000000040011', NULL, '5a4e0002-0000-4000-8000-000000000016', 'İrem ve Levent Düğün Daveti — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(2201.59), pg_temp.t(2201.59)),
('5a4e0003-0000-4000-8000-000000000022', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', '5a4e0000-0000-4000-8000-000000040020', NULL, '5a4e0002-0000-4000-8000-000000000016', 'İrem ve Levent Düğün Daveti — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(2183.23), pg_temp.t(2183.23)),
('5a4e0003-0000-4000-8000-000000000023', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', NULL, NULL, '5a4e0002-0000-4000-8000-000000000017', 'Fulya ve Tolga Düğün Daveti — Tam kapsam teklifi', 'Enes Aslan', 'enes-aslan@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(1426.94), pg_temp.t(1426.94)),
('5a4e0003-0000-4000-8000-000000000024', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', '5a4e0000-0000-4000-8000-000000040018', NULL, '5a4e0002-0000-4000-8000-000000000017', 'Fulya ve Tolga Düğün Daveti — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(1405.70), pg_temp.t(1405.70)),
('5a4e0003-0000-4000-8000-000000000025', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', NULL, NULL, '5a4e0002-0000-4000-8000-000000000017', 'Fulya ve Tolga Düğün Daveti — Tam kapsam teklifi', 'Melis Aksoy', 'melis-aksoy@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(1424.52), pg_temp.t(1424.52)),
('5a4e0003-0000-4000-8000-000000000026', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', NULL, NULL, '5a4e0002-0000-4000-8000-000000000018', 'Leyla ve Halil Düğün Daveti — Çekim ve içerik', 'Gizem Tekin', 'gizem-tekin@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3021.21), pg_temp.t(3021.21)),
('5a4e0003-0000-4000-8000-000000000027', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', '5a4e0000-0000-4000-8000-000000040020', NULL, '5a4e0002-0000-4000-8000-000000000019', 'Sevgi ve Burak Düğün Daveti — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3798.65), pg_temp.t(3798.65)),
('5a4e0003-0000-4000-8000-000000000028', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030004'), '5a4e0002-0000-4000-8000-000000000020', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(779.42), pg_temp.t(779.42)),
('5a4e0003-0000-4000-8000-000000000029', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000020', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(774.14), pg_temp.t(774.14)),
('5a4e0003-0000-4000-8000-000000000030', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000020', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(779.28), pg_temp.t(779.28)),
('5a4e0003-0000-4000-8000-000000000031', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', '5a4e0000-0000-4000-8000-000000040011', NULL, '5a4e0002-0000-4000-8000-000000000021', 'Ayşe & Koray Düğünü — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(193.43), pg_temp.t(193.43)),
('5a4e0003-0000-4000-8000-000000000032', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, NULL, '5a4e0002-0000-4000-8000-000000000022', 'Marmara Perakende Grubu Teknoloji Konferansı — Teknik paket', 'Dilara Avcı', 'dilara-avci@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(3458.84), pg_temp.t(3458.84)),
('5a4e0003-0000-4000-8000-000000000033', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, NULL, '5a4e0002-0000-4000-8000-000000000022', 'Marmara Perakende Grubu Teknoloji Konferansı — Teknik paket', 'Umut Ünal', 'umut-unal@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(3456.42), pg_temp.t(3456.42)),
('5a4e0003-0000-4000-8000-000000000034', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030008'), '5a4e0002-0000-4000-8000-000000000022', 'Marmara Perakende Grubu Teknoloji Konferansı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(3435.54), pg_temp.t(3435.54)),
('5a4e0003-0000-4000-8000-000000000035', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, NULL, '5a4e0002-0000-4000-8000-000000000023', 'Teknopark Yazılım A.Ş. Gala Yemeği — Çekim ve içerik', 'Feride Güneş', 'feride-gunes@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(1373.31), pg_temp.t(1373.31)),
('5a4e0003-0000-4000-8000-000000000036', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, NULL, '5a4e0002-0000-4000-8000-000000000024', 'Tuğçe ve Fatih Düğün Daveti — Organizasyon teklifi', 'Defne Tekin', 'defne-tekin@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3208.81), pg_temp.t(3208.81)),
('5a4e0003-0000-4000-8000-000000000037', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000025', 'Mavi Deniz Turizm Şirket Pikniği — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5746.99), pg_temp.t(5746.99)),
('5a4e0003-0000-4000-8000-000000000038', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030008'), '5a4e0002-0000-4000-8000-000000000025', 'Mavi Deniz Turizm Şirket Pikniği — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5747.69), pg_temp.t(5747.69)),
('5a4e0003-0000-4000-8000-000000000039', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, NULL, '5a4e0002-0000-4000-8000-000000000026', 'Başkent Eğitim Kurumları Bayi Toplantısı — Çekim ve içerik', 'Utku Soylu', 'utku-soylu@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3872.60), pg_temp.t(3872.60)),
('5a4e0003-0000-4000-8000-000000000040', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, NULL, '5a4e0002-0000-4000-8000-000000000027', 'Gizem Kına Gecesi — Tam kapsam teklifi', 'Pınar Toprak', 'pinar-toprak@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(2568.85), pg_temp.t(2568.85)),
('5a4e0003-0000-4000-8000-000000000041', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000028', 'Boğaziçi Finans Ürün Lansmanı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4174.08), pg_temp.t(4174.08)),
('5a4e0003-0000-4000-8000-000000000042', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, NULL, '5a4e0002-0000-4000-8000-000000000029', 'Ege Otomotiv Fuar Katılımı — Organizasyon teklifi', 'Koray Bulut', 'koray-bulut@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4730.99), pg_temp.t(4730.99)),
('5a4e0003-0000-4000-8000-000000000043', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000029', 'Ege Otomotiv Fuar Katılımı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4707.10), pg_temp.t(4707.10)),
('5a4e0003-0000-4000-8000-000000000044', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030004'), '5a4e0002-0000-4000-8000-000000000030', 'Marmara Perakende Grubu Fuar Katılımı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4488.72), pg_temp.t(4488.72)),
('5a4e0003-0000-4000-8000-000000000045', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000030', 'Marmara Perakende Grubu Fuar Katılımı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4516.35), pg_temp.t(4516.35)),
('5a4e0003-0000-4000-8000-000000000046', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000030', 'Marmara Perakende Grubu Fuar Katılımı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4531.81), pg_temp.t(4531.81)),
('5a4e0003-0000-4000-8000-000000000047', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000031', 'Boğaziçi Finans Fuar Standı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(209.10), pg_temp.t(209.10)),
('5a4e0003-0000-4000-8000-000000000048', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', '5a4e0000-0000-4000-8000-000000040002', NULL, '5a4e0002-0000-4000-8000-000000000032', 'Başkent Eğitim Kurumları Çalışan Buluşması — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(226.95), pg_temp.t(226.95)),
('5a4e0003-0000-4000-8000-000000000049', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030004'), '5a4e0002-0000-4000-8000-000000000032', 'Başkent Eğitim Kurumları Çalışan Buluşması — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(213.16), pg_temp.t(213.16)),
('5a4e0003-0000-4000-8000-000000000050', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000033', 'Teknopark Yazılım A.Ş. Ödül Gecesi — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3026.44), pg_temp.t(3026.44)),
('5a4e0003-0000-4000-8000-000000000051', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000034', 'Anadolu İlaç Fuar Standı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(2813.28), pg_temp.t(2813.28)),
('5a4e0003-0000-4000-8000-000000000052', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', '5a4e0000-0000-4000-8000-000000040016', NULL, '5a4e0002-0000-4000-8000-000000000034', 'Anadolu İlaç Fuar Standı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(2785.55), pg_temp.t(2785.55)),
('5a4e0003-0000-4000-8000-000000000053', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, NULL, '5a4e0002-0000-4000-8000-000000000035', 'Teknopark Yazılım A.Ş. Bayi Toplantısı — Çekim ve içerik', 'Görkem Toprak', 'gorkem-toprak@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1001.13), pg_temp.t(1001.13)),
('5a4e0003-0000-4000-8000-000000000054', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000035', 'Teknopark Yazılım A.Ş. Bayi Toplantısı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1015.24), pg_temp.t(1015.24)),
('5a4e0003-0000-4000-8000-000000000055', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000036', 'Anadolu İlaç Liderlik Zirvesi — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3685.91), pg_temp.t(3685.91)),
('5a4e0003-0000-4000-8000-000000000056', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000037', 'Ege Otomotiv Şirket Pikniği — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1472.99), pg_temp.t(1472.99)),
('5a4e0003-0000-4000-8000-000000000057', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', '5a4e0000-0000-4000-8000-000000040002', NULL, '5a4e0002-0000-4000-8000-000000000038', 'Boğaziçi Finans Yeni Sezon Lansmanı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(226.52), pg_temp.t(226.52)),
('5a4e0003-0000-4000-8000-000000000058', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000038', 'Boğaziçi Finans Yeni Sezon Lansmanı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(237.23), pg_temp.t(237.23)),
('5a4e0003-0000-4000-8000-000000000059', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000038', 'Boğaziçi Finans Yeni Sezon Lansmanı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(232.09), pg_temp.t(232.09)),
('5a4e0003-0000-4000-8000-000000000060', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, NULL, '5a4e0002-0000-4000-8000-000000000040', 'Anadolu İlaç Yıl Sonu Partisi — Teknik paket', 'Büşra Yıldız', 'busra-yildiz@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(764.37), pg_temp.t(764.37)),
('5a4e0003-0000-4000-8000-000000000061', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000040', 'Anadolu İlaç Yıl Sonu Partisi — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(744.69), pg_temp.t(744.69)),
('5a4e0003-0000-4000-8000-000000000062', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000040', 'Anadolu İlaç Yıl Sonu Partisi — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(742.73), pg_temp.t(742.73)),
('5a4e0003-0000-4000-8000-000000000063', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', '5a4e0000-0000-4000-8000-000000040013', NULL, '5a4e0002-0000-4000-8000-000000000041', 'Başkent Eğitim Kurumları Fuar Standı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(4474.91), pg_temp.t(4474.91)),
('5a4e0003-0000-4000-8000-000000000064', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', '5a4e0000-0000-4000-8000-000000040002', NULL, '5a4e0002-0000-4000-8000-000000000042', 'Anadolu İlaç Yeni Sezon Lansmanı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(4001.28), pg_temp.t(4001.28)),
('5a4e0003-0000-4000-8000-000000000065', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', NULL, NULL, '5a4e0002-0000-4000-8000-000000000043', 'Kübra Baby Shower — Tam kapsam teklifi', 'Yağmur Turan', 'yagmur-turan@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(777.16), pg_temp.t(777.16)),
('5a4e0003-0000-4000-8000-000000000066', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000044', 'Mavi Deniz Turizm Yeni Sezon Lansmanı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(193.26), pg_temp.t(193.26)),
('5a4e0003-0000-4000-8000-000000000067', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', NULL, NULL, '5a4e0002-0000-4000-8000-000000000044', 'Mavi Deniz Turizm Yeni Sezon Lansmanı — Tam kapsam teklifi', 'Mehmet Demir', 'mehmet-demir@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(210.94), pg_temp.t(210.94)),
('5a4e0003-0000-4000-8000-000000000068', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', '5a4e0000-0000-4000-8000-000000040001', NULL, '5a4e0002-0000-4000-8000-000000000044', 'Mavi Deniz Turizm Yeni Sezon Lansmanı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(214.94), pg_temp.t(214.94)),
('5a4e0003-0000-4000-8000-000000000069', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', '5a4e0000-0000-4000-8000-000000040014', NULL, '5a4e0002-0000-4000-8000-000000000046', 'Elif & Cem Nişanı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1647.82), pg_temp.t(1647.82)),
('5a4e0003-0000-4000-8000-000000000070', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000047', 'Marmara Perakende Grubu Yaz Konseri — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3227.28), pg_temp.t(3227.28)),
('5a4e0003-0000-4000-8000-000000000071', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000047', 'Marmara Perakende Grubu Yaz Konseri — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3224.59), pg_temp.t(3224.59)),
('5a4e0003-0000-4000-8000-000000000072', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', '5a4e0000-0000-4000-8000-000000040011', NULL, '5a4e0002-0000-4000-8000-000000000047', 'Marmara Perakende Grubu Yaz Konseri — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3221.75), pg_temp.t(3221.75)),
('5a4e0003-0000-4000-8000-000000000073', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', '5a4e0000-0000-4000-8000-000000040019', NULL, '5a4e0002-0000-4000-8000-000000000048', 'İrem & Kemal Düğünü — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2063.77), pg_temp.t(2063.77)),
('5a4e0003-0000-4000-8000-000000000074', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000049', 'Ege Otomotiv Şirket Pikniği — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2146.95), pg_temp.t(2146.95));
  INSERT INTO public.proposal_versions (id, proposal_id, version_no, tax_rate, notes, valid_until, created_by, created_at, updated_at)
  VALUES
('5a4e0004-0000-4000-8000-000000000001', '5a4e0003-0000-4000-8000-000000000001', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2939.35), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(3290.02), pg_temp.t(3290.02)),
('5a4e0004-0000-4000-8000-000000000002', '5a4e0003-0000-4000-8000-000000000002', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(4712.71), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(5065.87), pg_temp.t(5065.87)),
('5a4e0004-0000-4000-8000-000000000003', '5a4e0003-0000-4000-8000-000000000003', 1, 0.20, NULL, pg_temp.t(4699.70), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(5078.73), pg_temp.t(5078.73)),
('5a4e0004-0000-4000-8000-000000000004', '5a4e0003-0000-4000-8000-000000000004', 1, 0.20, NULL, pg_temp.t(4697.96), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(5081.20), pg_temp.t(5081.20)),
('5a4e0004-0000-4000-8000-000000000005', '5a4e0003-0000-4000-8000-000000000005', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1074.06), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(1471.09), pg_temp.t(1471.09)),
('5a4e0004-0000-4000-8000-000000000006', '5a4e0003-0000-4000-8000-000000000006', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1088.21), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(1470.34), pg_temp.t(1470.34)),
('5a4e0004-0000-4000-8000-000000000007', '5a4e0003-0000-4000-8000-000000000007', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2235.23), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(2626.66), pg_temp.t(2626.66)),
('5a4e0004-0000-4000-8000-000000000008', '5a4e0003-0000-4000-8000-000000000008', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2554.96), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2899.13), pg_temp.t(2899.13)),
('5a4e0004-0000-4000-8000-000000000009', '5a4e0003-0000-4000-8000-000000000009', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1777.73), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2124.63), pg_temp.t(2124.63)),
('5a4e0004-0000-4000-8000-000000000010', '5a4e0003-0000-4000-8000-000000000010', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1772.27), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2121.29), pg_temp.t(2121.29)),
('5a4e0004-0000-4000-8000-000000000011', '5a4e0003-0000-4000-8000-000000000011', 1, 0.20, NULL, pg_temp.t(3213.75), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3586.99), pg_temp.t(3586.99)),
('5a4e0004-0000-4000-8000-000000000012', '5a4e0003-0000-4000-8000-000000000012', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(3217.09), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3607.92), pg_temp.t(3607.92)),
('5a4e0004-0000-4000-8000-000000000013', '5a4e0003-0000-4000-8000-000000000013', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(3195.29), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3578.37), pg_temp.t(3578.37)),
('5a4e0004-0000-4000-8000-000000000014', '5a4e0003-0000-4000-8000-000000000014', 1, 0.20, NULL, pg_temp.t(2043.17), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(2419.21), pg_temp.t(2419.21)),
('5a4e0004-0000-4000-8000-000000000015', '5a4e0003-0000-4000-8000-000000000015', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2599.04), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(2966.17), pg_temp.t(2966.17)),
('5a4e0004-0000-4000-8000-000000000016', '5a4e0003-0000-4000-8000-000000000016', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(668.69), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1064.64), pg_temp.t(1064.64)),
('5a4e0004-0000-4000-8000-000000000017', '5a4e0003-0000-4000-8000-000000000017', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(654.09), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1060.68), pg_temp.t(1060.68)),
('5a4e0004-0000-4000-8000-000000000018', '5a4e0003-0000-4000-8000-000000000018', 1, 0.20, NULL, pg_temp.t(722.89), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1079.18), pg_temp.t(1079.18)),
('5a4e0004-0000-4000-8000-000000000019', '5a4e0003-0000-4000-8000-000000000019', 1, 0.20, NULL, pg_temp.t(-171.16), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(203.62), pg_temp.t(203.62)),
('5a4e0004-0000-4000-8000-000000000020', '5a4e0003-0000-4000-8000-000000000020', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1826.06), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(2174.46), pg_temp.t(2174.46)),
('5a4e0004-0000-4000-8000-000000000021', '5a4e0003-0000-4000-8000-000000000021', 1, 0.20, NULL, pg_temp.t(1828.26), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(2201.59), pg_temp.t(2201.59)),
('5a4e0004-0000-4000-8000-000000000022', '5a4e0003-0000-4000-8000-000000000022', 1, 0.20, NULL, pg_temp.t(1824.16), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(2183.23), pg_temp.t(2183.23)),
('5a4e0004-0000-4000-8000-000000000023', '5a4e0003-0000-4000-8000-000000000023', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1076.10), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(1426.94), pg_temp.t(1426.94)),
('5a4e0004-0000-4000-8000-000000000024', '5a4e0003-0000-4000-8000-000000000024', 1, 0.20, NULL, pg_temp.t(1051.59), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(1405.70), pg_temp.t(1405.70)),
('5a4e0004-0000-4000-8000-000000000025', '5a4e0003-0000-4000-8000-000000000025', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1064.00), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(1424.52), pg_temp.t(1424.52)),
('5a4e0004-0000-4000-8000-000000000026', '5a4e0003-0000-4000-8000-000000000026', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2682.65), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3021.21), pg_temp.t(3021.21)),
('5a4e0004-0000-4000-8000-000000000027', '5a4e0003-0000-4000-8000-000000000027', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3392.06), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3798.65), pg_temp.t(3798.65)),
('5a4e0004-0000-4000-8000-000000000028', '5a4e0003-0000-4000-8000-000000000028', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(419.78), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(779.42), pg_temp.t(779.42)),
('5a4e0004-0000-4000-8000-000000000029', '5a4e0003-0000-4000-8000-000000000029', 1, 0.20, NULL, pg_temp.t(429.24), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(774.14), pg_temp.t(774.14)),
('5a4e0004-0000-4000-8000-000000000030', '5a4e0003-0000-4000-8000-000000000030', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(410.61), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(779.28), pg_temp.t(779.28)),
('5a4e0004-0000-4000-8000-000000000031', '5a4e0003-0000-4000-8000-000000000031', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-180.95), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(193.43), pg_temp.t(193.43)),
('5a4e0004-0000-4000-8000-000000000032', '5a4e0003-0000-4000-8000-000000000032', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3114.97), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(3458.84), pg_temp.t(3458.84)),
('5a4e0004-0000-4000-8000-000000000033', '5a4e0003-0000-4000-8000-000000000033', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(3112.81), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(3456.42), pg_temp.t(3456.42)),
('5a4e0004-0000-4000-8000-000000000034', '5a4e0003-0000-4000-8000-000000000034', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3044.74), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(3435.54), pg_temp.t(3435.54)),
('5a4e0004-0000-4000-8000-000000000035', '5a4e0003-0000-4000-8000-000000000035', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(973.45), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(1373.31), pg_temp.t(1373.31)),
('5a4e0004-0000-4000-8000-000000000036', '5a4e0003-0000-4000-8000-000000000036', 1, 0.20, NULL, pg_temp.t(2864.73), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3208.81), pg_temp.t(3208.81)),
('5a4e0004-0000-4000-8000-000000000037', '5a4e0003-0000-4000-8000-000000000037', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(5372.69), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5746.99), pg_temp.t(5746.99)),
('5a4e0004-0000-4000-8000-000000000038', '5a4e0003-0000-4000-8000-000000000038', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(5389.55), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5747.69), pg_temp.t(5747.69)),
('5a4e0004-0000-4000-8000-000000000039', '5a4e0003-0000-4000-8000-000000000039', 1, 0.20, NULL, pg_temp.t(3523.99), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3872.60), pg_temp.t(3872.60)),
('5a4e0004-0000-4000-8000-000000000040', '5a4e0003-0000-4000-8000-000000000040', 1, 0.20, NULL, pg_temp.t(2222.85), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(2568.85), pg_temp.t(2568.85)),
('5a4e0004-0000-4000-8000-000000000041', '5a4e0003-0000-4000-8000-000000000041', 1, 0.20, NULL, pg_temp.t(3783.51), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4174.08), pg_temp.t(4174.08)),
('5a4e0004-0000-4000-8000-000000000042', '5a4e0003-0000-4000-8000-000000000042', 1, 0.20, NULL, pg_temp.t(4361.57), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4730.99), pg_temp.t(4730.99)),
('5a4e0004-0000-4000-8000-000000000043', '5a4e0003-0000-4000-8000-000000000043', 1, 0.20, NULL, pg_temp.t(4354.74), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4707.10), pg_temp.t(4707.10)),
('5a4e0004-0000-4000-8000-000000000044', '5a4e0003-0000-4000-8000-000000000044', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(4142.54), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4488.72), pg_temp.t(4488.72)),
('5a4e0004-0000-4000-8000-000000000045', '5a4e0003-0000-4000-8000-000000000045', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(4169.56), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4516.35), pg_temp.t(4516.35)),
('5a4e0004-0000-4000-8000-000000000046', '5a4e0003-0000-4000-8000-000000000046', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(4175.17), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4531.81), pg_temp.t(4531.81)),
('5a4e0004-0000-4000-8000-000000000047', '5a4e0003-0000-4000-8000-000000000047', 1, 0.20, NULL, pg_temp.t(-128.40), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(209.10), pg_temp.t(209.10)),
('5a4e0004-0000-4000-8000-000000000048', '5a4e0003-0000-4000-8000-000000000048', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(-160.72), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(226.95), pg_temp.t(226.95)),
('5a4e0004-0000-4000-8000-000000000049', '5a4e0003-0000-4000-8000-000000000049', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-147.82), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(213.16), pg_temp.t(213.16)),
('5a4e0004-0000-4000-8000-000000000050', '5a4e0003-0000-4000-8000-000000000050', 1, 0.20, NULL, pg_temp.t(2673.56), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3026.44), pg_temp.t(3026.44)),
('5a4e0004-0000-4000-8000-000000000051', '5a4e0003-0000-4000-8000-000000000051', 1, 0.20, NULL, pg_temp.t(2408.39), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(2813.28), pg_temp.t(2813.28)),
('5a4e0004-0000-4000-8000-000000000052', '5a4e0003-0000-4000-8000-000000000052', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2433.26), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(2785.55), pg_temp.t(2785.55)),
('5a4e0004-0000-4000-8000-000000000053', '5a4e0003-0000-4000-8000-000000000053', 1, 0.20, NULL, pg_temp.t(630.79), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1001.13), pg_temp.t(1001.13)),
('5a4e0004-0000-4000-8000-000000000054', '5a4e0003-0000-4000-8000-000000000054', 1, 0.20, NULL, pg_temp.t(626.65), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1015.24), pg_temp.t(1015.24)),
('5a4e0004-0000-4000-8000-000000000055', '5a4e0003-0000-4000-8000-000000000055', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3347.76), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3685.91), pg_temp.t(3685.91)),
('5a4e0004-0000-4000-8000-000000000056', '5a4e0003-0000-4000-8000-000000000056', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1100.90), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1472.99), pg_temp.t(1472.99)),
('5a4e0004-0000-4000-8000-000000000057', '5a4e0003-0000-4000-8000-000000000057', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-114.19), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(226.52), pg_temp.t(226.52)),
('5a4e0004-0000-4000-8000-000000000058', '5a4e0003-0000-4000-8000-000000000058', 1, 0.20, NULL, pg_temp.t(-117.76), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(237.23), pg_temp.t(237.23)),
('5a4e0004-0000-4000-8000-000000000059', '5a4e0003-0000-4000-8000-000000000059', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-151.95), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(232.09), pg_temp.t(232.09)),
('5a4e0004-0000-4000-8000-000000000060', '5a4e0003-0000-4000-8000-000000000060', 1, 0.20, NULL, pg_temp.t(379.55), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(764.37), pg_temp.t(764.37)),
('5a4e0004-0000-4000-8000-000000000061', '5a4e0003-0000-4000-8000-000000000061', 1, 0.20, NULL, pg_temp.t(341.33), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(744.69), pg_temp.t(744.69)),
('5a4e0004-0000-4000-8000-000000000062', '5a4e0003-0000-4000-8000-000000000062', 1, 0.20, NULL, pg_temp.t(337.32), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(742.73), pg_temp.t(742.73)),
('5a4e0004-0000-4000-8000-000000000063', '5a4e0003-0000-4000-8000-000000000063', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(4077.27), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(4474.91), pg_temp.t(4474.91)),
('5a4e0004-0000-4000-8000-000000000064', '5a4e0003-0000-4000-8000-000000000064', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(3647.67), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(4001.28), pg_temp.t(4001.28)),
('5a4e0004-0000-4000-8000-000000000065', '5a4e0003-0000-4000-8000-000000000065', 1, 0.20, NULL, pg_temp.t(423.71), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(777.16), pg_temp.t(777.16)),
('5a4e0004-0000-4000-8000-000000000066', '5a4e0003-0000-4000-8000-000000000066', 1, 0.20, NULL, pg_temp.t(-202.47), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(193.26), pg_temp.t(193.26)),
('5a4e0004-0000-4000-8000-000000000067', '5a4e0003-0000-4000-8000-000000000067', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-173.65), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(210.94), pg_temp.t(210.94)),
('5a4e0004-0000-4000-8000-000000000068', '5a4e0003-0000-4000-8000-000000000068', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-160.56), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(214.94), pg_temp.t(214.94)),
('5a4e0004-0000-4000-8000-000000000069', '5a4e0003-0000-4000-8000-000000000069', 1, 0.20, NULL, pg_temp.t(1285.59), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1647.82), pg_temp.t(1647.82)),
('5a4e0004-0000-4000-8000-000000000070', '5a4e0003-0000-4000-8000-000000000070', 1, 0.20, NULL, pg_temp.t(2834.90), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3227.28), pg_temp.t(3227.28)),
('5a4e0004-0000-4000-8000-000000000071', '5a4e0003-0000-4000-8000-000000000071', 1, 0.20, NULL, pg_temp.t(2820.68), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3224.59), pg_temp.t(3224.59)),
('5a4e0004-0000-4000-8000-000000000072', '5a4e0003-0000-4000-8000-000000000072', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2840.74), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3221.75), pg_temp.t(3221.75)),
('5a4e0004-0000-4000-8000-000000000073', '5a4e0003-0000-4000-8000-000000000073', 1, 0.20, NULL, pg_temp.t(1687.48), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2063.77), pg_temp.t(2063.77)),
('5a4e0004-0000-4000-8000-000000000074', '5a4e0003-0000-4000-8000-000000000074', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1774.96), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2146.95), pg_temp.t(2146.95));
  UPDATE public.proposals p SET current_version_id = v.id FROM public.proposal_versions v WHERE v.proposal_id = p.id AND p.id::text LIKE '5a4e0003-%';
  INSERT INTO public.proposal_items (id, proposal_version_id, role_id, description, quantity, unit_client_price, is_visible_to_client, sort_order)
  VALUES
('5a4e0005-0000-4000-8000-000000000001', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('hostes'), 'Hostes (kına gecesi)', 1, 5000, true, 0),
('5a4e0005-0000-4000-8000-000000000002', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('akrobat'), 'Akrobat (kına gecesi)', 1, 15000, true, 1),
('5a4e0005-0000-4000-8000-000000000003', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('videograf'), 'Videograf (kına gecesi)', 1, 18500, false, 2),
('5a4e0005-0000-4000-8000-000000000004', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('sunucu'), 'Sunucu (kına gecesi)', 1, 19000, true, 3),
('5a4e0005-0000-4000-8000-000000000005', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('fotografci'), 'Fotoğrafçı (kına gecesi)', 2, 34000, true, 4),
('5a4e0005-0000-4000-8000-000000000006', '5a4e0004-0000-4000-8000-000000000002', pg_temp.rol('canli-yayin'), 'Canlı Yayın (doğum günü)', 2, 47500, true, 0),
('5a4e0005-0000-4000-8000-000000000007', '5a4e0004-0000-4000-8000-000000000002', pg_temp.rol('akrobat'), 'Akrobat (doğum günü)', 1, 18000, true, 1),
('5a4e0005-0000-4000-8000-000000000008', '5a4e0004-0000-4000-8000-000000000002', pg_temp.rol('dj'), 'DJ (doğum günü)', 1, 13500, true, 2),
('5a4e0005-0000-4000-8000-000000000009', '5a4e0004-0000-4000-8000-000000000002', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (doğum günü)', 1, 8000, true, 3),
('5a4e0005-0000-4000-8000-000000000010', '5a4e0004-0000-4000-8000-000000000003', pg_temp.rol('canli-yayin'), 'Canlı Yayın (doğum günü)', 1, 53500, true, 0),
('5a4e0005-0000-4000-8000-000000000011', '5a4e0004-0000-4000-8000-000000000003', pg_temp.rol('akrobat'), 'Akrobat (doğum günü)', 1, 30500, true, 1),
('5a4e0005-0000-4000-8000-000000000012', '5a4e0004-0000-4000-8000-000000000003', pg_temp.rol('videograf'), 'Videograf (doğum günü)', 1, 39500, true, 2),
('5a4e0005-0000-4000-8000-000000000013', '5a4e0004-0000-4000-8000-000000000004', pg_temp.rol('canli-yayin'), 'Canlı Yayın (doğum günü)', 1, 23000, true, 0),
('5a4e0005-0000-4000-8000-000000000014', '5a4e0004-0000-4000-8000-000000000004', pg_temp.rol('akrobat'), 'Akrobat (doğum günü)', 1, 25000, true, 1),
('5a4e0005-0000-4000-8000-000000000015', '5a4e0004-0000-4000-8000-000000000004', pg_temp.rol('dj'), 'DJ (doğum günü)', 1, 18000, true, 2),
('5a4e0005-0000-4000-8000-000000000016', '5a4e0004-0000-4000-8000-000000000004', pg_temp.rol('fotografci'), 'Fotoğrafçı (doğum günü)', 1, 46000, false, 3),
('5a4e0005-0000-4000-8000-000000000017', '5a4e0004-0000-4000-8000-000000000005', pg_temp.rol('tercuman'), 'Tercüman (kurumsal)', 2, 13500, true, 0),
('5a4e0005-0000-4000-8000-000000000018', '5a4e0004-0000-4000-8000-000000000005', pg_temp.rol('ses-isik'), 'Ses & Işık (kurumsal)', 1, 68000, true, 1),
('5a4e0005-0000-4000-8000-000000000019', '5a4e0004-0000-4000-8000-000000000005', pg_temp.rol('muzisyen'), 'Müzisyen (kurumsal)', 2, 17500, true, 2),
('5a4e0005-0000-4000-8000-000000000020', '5a4e0004-0000-4000-8000-000000000005', pg_temp.rol('sunucu'), 'Sunucu (kurumsal)', 2, 26000, true, 3),
('5a4e0005-0000-4000-8000-000000000021', '5a4e0004-0000-4000-8000-000000000006', pg_temp.rol('tercuman'), 'Tercüman (kurumsal)', 1, 14500, true, 0),
('5a4e0005-0000-4000-8000-000000000022', '5a4e0004-0000-4000-8000-000000000006', pg_temp.rol('ses-isik'), 'Ses & Işık (kurumsal)', 1, 31500, true, 1),
('5a4e0005-0000-4000-8000-000000000023', '5a4e0004-0000-4000-8000-000000000006', pg_temp.rol('fotografci'), 'Fotoğrafçı (kurumsal)', 1, 43000, true, 2),
('5a4e0005-0000-4000-8000-000000000024', '5a4e0004-0000-4000-8000-000000000007', pg_temp.rol('konusmaci'), 'Konuşmacı (düğün)', 2, 62500, true, 0),
('5a4e0005-0000-4000-8000-000000000025', '5a4e0004-0000-4000-8000-000000000007', pg_temp.rol('dj'), 'DJ (düğün)', 1, 20500, true, 1),
('5a4e0005-0000-4000-8000-000000000026', '5a4e0004-0000-4000-8000-000000000008', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 17500, true, 0),
('5a4e0005-0000-4000-8000-000000000027', '5a4e0004-0000-4000-8000-000000000008', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 1, 25000, true, 1),
('5a4e0005-0000-4000-8000-000000000028', '5a4e0004-0000-4000-8000-000000000008', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (düğün)', 1, 15500, true, 2),
('5a4e0005-0000-4000-8000-000000000029', '5a4e0004-0000-4000-8000-000000000008', pg_temp.rol('ses-isik'), 'Ses & Işık (düğün)', 1, 56000, true, 3),
('5a4e0005-0000-4000-8000-000000000030', '5a4e0004-0000-4000-8000-000000000009', pg_temp.rol('konusmaci'), 'Konuşmacı (fuar)', 1, 39000, true, 0),
('5a4e0005-0000-4000-8000-000000000031', '5a4e0004-0000-4000-8000-000000000009', pg_temp.rol('muzisyen'), 'Müzisyen (fuar)', 1, 27000, true, 1),
('5a4e0005-0000-4000-8000-000000000032', '5a4e0004-0000-4000-8000-000000000010', pg_temp.rol('konusmaci'), 'Konuşmacı (fuar)', 1, 53500, true, 0),
('5a4e0005-0000-4000-8000-000000000033', '5a4e0004-0000-4000-8000-000000000010', pg_temp.rol('muzisyen'), 'Müzisyen (fuar)', 2, 44000, false, 1),
('5a4e0005-0000-4000-8000-000000000034', '5a4e0004-0000-4000-8000-000000000010', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (fuar)', 1, 8500, true, 2),
('5a4e0005-0000-4000-8000-000000000035', '5a4e0004-0000-4000-8000-000000000011', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (konser)', 1, 10000, true, 0),
('5a4e0005-0000-4000-8000-000000000036', '5a4e0004-0000-4000-8000-000000000011', pg_temp.rol('dj'), 'DJ (konser)', 1, 26500, true, 1),
('5a4e0005-0000-4000-8000-000000000037', '5a4e0004-0000-4000-8000-000000000011', pg_temp.rol('oyuncu'), 'Oyuncu (konser)', 2, 19500, true, 2),
('5a4e0005-0000-4000-8000-000000000038', '5a4e0004-0000-4000-8000-000000000011', pg_temp.rol('sunucu'), 'Sunucu (konser)', 1, 37500, true, 3),
('5a4e0005-0000-4000-8000-000000000039', '5a4e0004-0000-4000-8000-000000000011', pg_temp.rol('videograf'), 'Videograf (konser)', 2, 41500, true, 4),
('5a4e0005-0000-4000-8000-000000000040', '5a4e0004-0000-4000-8000-000000000012', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (konser)', 2, 11000, true, 0),
('5a4e0005-0000-4000-8000-000000000041', '5a4e0004-0000-4000-8000-000000000012', pg_temp.rol('dj'), 'DJ (konser)', 1, 21500, true, 1),
('5a4e0005-0000-4000-8000-000000000042', '5a4e0004-0000-4000-8000-000000000013', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (konser)', 1, 7000, true, 0),
('5a4e0005-0000-4000-8000-000000000043', '5a4e0004-0000-4000-8000-000000000013', pg_temp.rol('dj'), 'DJ (konser)', 1, 31500, true, 1),
('5a4e0005-0000-4000-8000-000000000044', '5a4e0004-0000-4000-8000-000000000013', pg_temp.rol('oyuncu'), 'Oyuncu (konser)', 1, 24500, true, 2),
('5a4e0005-0000-4000-8000-000000000045', '5a4e0004-0000-4000-8000-000000000014', pg_temp.rol('akrobat'), 'Akrobat (doğum günü)', 2, 9500, true, 0),
('5a4e0005-0000-4000-8000-000000000046', '5a4e0004-0000-4000-8000-000000000014', pg_temp.rol('dansci'), 'Dansçı (doğum günü)', 2, 12500, true, 1),
('5a4e0005-0000-4000-8000-000000000047', '5a4e0004-0000-4000-8000-000000000014', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (doğum günü)', 2, 17000, true, 2),
('5a4e0005-0000-4000-8000-000000000048', '5a4e0004-0000-4000-8000-000000000015', pg_temp.rol('karikaturist'), 'Karikatürist (düğün)', 2, 4000, true, 0),
('5a4e0005-0000-4000-8000-000000000049', '5a4e0004-0000-4000-8000-000000000015', pg_temp.rol('palyaco'), 'Palyaço (düğün)', 1, 6000, true, 1),
('5a4e0005-0000-4000-8000-000000000050', '5a4e0004-0000-4000-8000-000000000015', pg_temp.rol('sunucu'), 'Sunucu (düğün)', 2, 26500, false, 2),
('5a4e0005-0000-4000-8000-000000000051', '5a4e0004-0000-4000-8000-000000000015', pg_temp.rol('fotografci'), 'Fotoğrafçı (düğün)', 1, 27000, true, 3),
('5a4e0005-0000-4000-8000-000000000052', '5a4e0004-0000-4000-8000-000000000016', pg_temp.rol('model'), 'Model (nişan)', 2, 14000, true, 0),
('5a4e0005-0000-4000-8000-000000000053', '5a4e0004-0000-4000-8000-000000000016', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (nişan)', 1, 9000, true, 1),
('5a4e0005-0000-4000-8000-000000000054', '5a4e0004-0000-4000-8000-000000000016', pg_temp.rol('tercuman'), 'Tercüman (nişan)', 1, 14500, true, 2),
('5a4e0005-0000-4000-8000-000000000055', '5a4e0004-0000-4000-8000-000000000016', pg_temp.rol('videograf'), 'Videograf (nişan)', 1, 24000, true, 3),
('5a4e0005-0000-4000-8000-000000000056', '5a4e0004-0000-4000-8000-000000000016', pg_temp.rol('fotografci'), 'Fotoğrafçı (nişan)', 1, 27000, true, 4),
('5a4e0005-0000-4000-8000-000000000057', '5a4e0004-0000-4000-8000-000000000017', pg_temp.rol('model'), 'Model (nişan)', 1, 16500, true, 0),
('5a4e0005-0000-4000-8000-000000000058', '5a4e0004-0000-4000-8000-000000000017', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (nişan)', 2, 10500, false, 1),
('5a4e0005-0000-4000-8000-000000000059', '5a4e0004-0000-4000-8000-000000000017', pg_temp.rol('tercuman'), 'Tercüman (nişan)', 1, 14500, true, 2),
('5a4e0005-0000-4000-8000-000000000060', '5a4e0004-0000-4000-8000-000000000017', pg_temp.rol('videograf'), 'Videograf (nişan)', 1, 54000, true, 3),
('5a4e0005-0000-4000-8000-000000000061', '5a4e0004-0000-4000-8000-000000000017', pg_temp.rol('fotografci'), 'Fotoğrafçı (nişan)', 2, 47000, true, 4),
('5a4e0005-0000-4000-8000-000000000062', '5a4e0004-0000-4000-8000-000000000018', pg_temp.rol('model'), 'Model (nişan)', 1, 9500, true, 0),
('5a4e0005-0000-4000-8000-000000000063', '5a4e0004-0000-4000-8000-000000000018', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (nişan)', 1, 5000, true, 1),
('5a4e0005-0000-4000-8000-000000000064', '5a4e0004-0000-4000-8000-000000000018', pg_temp.rol('tercuman'), 'Tercüman (nişan)', 1, 13000, true, 2),
('5a4e0005-0000-4000-8000-000000000065', '5a4e0004-0000-4000-8000-000000000018', pg_temp.rol('videograf'), 'Videograf (nişan)', 2, 21500, true, 3),
('5a4e0005-0000-4000-8000-000000000066', '5a4e0004-0000-4000-8000-000000000019', pg_temp.rol('konusmaci'), 'Konuşmacı (düğün)', 1, 55500, true, 0),
('5a4e0005-0000-4000-8000-000000000067', '5a4e0004-0000-4000-8000-000000000019', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 2, 39500, true, 1),
('5a4e0005-0000-4000-8000-000000000068', '5a4e0004-0000-4000-8000-000000000019', pg_temp.rol('hostes'), 'Hostes (düğün)', 2, 3000, true, 2),
('5a4e0005-0000-4000-8000-000000000069', '5a4e0004-0000-4000-8000-000000000020', pg_temp.rol('ses-isik'), 'Ses & Işık (düğün)', 1, 46000, true, 0),
('5a4e0005-0000-4000-8000-000000000070', '5a4e0004-0000-4000-8000-000000000020', pg_temp.rol('oyuncu'), 'Oyuncu (düğün)', 2, 27500, true, 1),
('5a4e0005-0000-4000-8000-000000000071', '5a4e0004-0000-4000-8000-000000000020', pg_temp.rol('akrobat'), 'Akrobat (düğün)', 1, 29000, true, 2),
('5a4e0005-0000-4000-8000-000000000072', '5a4e0004-0000-4000-8000-000000000020', pg_temp.rol('dj'), 'DJ (düğün)', 2, 25500, true, 3),
('5a4e0005-0000-4000-8000-000000000073', '5a4e0004-0000-4000-8000-000000000021', pg_temp.rol('ses-isik'), 'Ses & Işık (düğün)', 1, 60000, true, 0),
('5a4e0005-0000-4000-8000-000000000074', '5a4e0004-0000-4000-8000-000000000021', pg_temp.rol('oyuncu'), 'Oyuncu (düğün)', 1, 14500, true, 1),
('5a4e0005-0000-4000-8000-000000000075', '5a4e0004-0000-4000-8000-000000000022', pg_temp.rol('ses-isik'), 'Ses & Işık (düğün)', 1, 86500, true, 0),
('5a4e0005-0000-4000-8000-000000000076', '5a4e0004-0000-4000-8000-000000000022', pg_temp.rol('oyuncu'), 'Oyuncu (düğün)', 2, 15500, true, 1),
('5a4e0005-0000-4000-8000-000000000077', '5a4e0004-0000-4000-8000-000000000022', pg_temp.rol('dansci'), 'Dansçı (düğün)', 2, 29500, true, 2),
('5a4e0005-0000-4000-8000-000000000078', '5a4e0004-0000-4000-8000-000000000023', pg_temp.rol('dj'), 'DJ (düğün)', 1, 22000, true, 0),
('5a4e0005-0000-4000-8000-000000000079', '5a4e0004-0000-4000-8000-000000000023', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 10500, true, 1),
('5a4e0005-0000-4000-8000-000000000080', '5a4e0004-0000-4000-8000-000000000023', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 1, 55500, true, 2),
('5a4e0005-0000-4000-8000-000000000081', '5a4e0004-0000-4000-8000-000000000024', pg_temp.rol('dj'), 'DJ (düğün)', 1, 25000, true, 0),
('5a4e0005-0000-4000-8000-000000000082', '5a4e0004-0000-4000-8000-000000000024', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 22500, true, 1),
('5a4e0005-0000-4000-8000-000000000083', '5a4e0004-0000-4000-8000-000000000024', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 2, 45500, true, 2),
('5a4e0005-0000-4000-8000-000000000084', '5a4e0004-0000-4000-8000-000000000025', pg_temp.rol('dj'), 'DJ (düğün)', 1, 26000, true, 0),
('5a4e0005-0000-4000-8000-000000000085', '5a4e0004-0000-4000-8000-000000000025', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 11000, true, 1),
('5a4e0005-0000-4000-8000-000000000086', '5a4e0004-0000-4000-8000-000000000025', pg_temp.rol('akrobat'), 'Akrobat (düğün)', 2, 32000, false, 2),
('5a4e0005-0000-4000-8000-000000000087', '5a4e0004-0000-4000-8000-000000000026', pg_temp.rol('dansci'), 'Dansçı (düğün)', 2, 29000, false, 0),
('5a4e0005-0000-4000-8000-000000000088', '5a4e0004-0000-4000-8000-000000000026', pg_temp.rol('oyuncu'), 'Oyuncu (düğün)', 1, 24000, true, 1),
('5a4e0005-0000-4000-8000-000000000089', '5a4e0004-0000-4000-8000-000000000026', pg_temp.rol('karikaturist'), 'Karikatürist (düğün)', 1, 11500, true, 2),
('5a4e0005-0000-4000-8000-000000000090', '5a4e0004-0000-4000-8000-000000000027', pg_temp.rol('model'), 'Model (düğün)', 1, 7500, true, 0),
('5a4e0005-0000-4000-8000-000000000091', '5a4e0004-0000-4000-8000-000000000027', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (düğün)', 2, 8000, true, 1),
('5a4e0005-0000-4000-8000-000000000092', '5a4e0004-0000-4000-8000-000000000028', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 34000, true, 0),
('5a4e0005-0000-4000-8000-000000000093', '5a4e0004-0000-4000-8000-000000000028', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 1, 20500, true, 1),
('5a4e0005-0000-4000-8000-000000000094', '5a4e0004-0000-4000-8000-000000000028', pg_temp.rol('dj'), 'DJ (lansman)', 2, 12000, true, 2),
('5a4e0005-0000-4000-8000-000000000095', '5a4e0004-0000-4000-8000-000000000028', pg_temp.rol('illuzyonist'), 'İllüzyonist (lansman)', 1, 29500, true, 3),
('5a4e0005-0000-4000-8000-000000000096', '5a4e0004-0000-4000-8000-000000000029', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 2, 39000, true, 0),
('5a4e0005-0000-4000-8000-000000000097', '5a4e0004-0000-4000-8000-000000000029', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 1, 38000, true, 1),
('5a4e0005-0000-4000-8000-000000000098', '5a4e0004-0000-4000-8000-000000000030', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 23500, true, 0),
('5a4e0005-0000-4000-8000-000000000099', '5a4e0004-0000-4000-8000-000000000030', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 1, 43500, false, 1),
('5a4e0005-0000-4000-8000-000000000100', '5a4e0004-0000-4000-8000-000000000030', pg_temp.rol('dj'), 'DJ (lansman)', 1, 33500, true, 2),
('5a4e0005-0000-4000-8000-000000000101', '5a4e0004-0000-4000-8000-000000000030', pg_temp.rol('illuzyonist'), 'İllüzyonist (lansman)', 1, 25500, true, 3),
('5a4e0005-0000-4000-8000-000000000102', '5a4e0004-0000-4000-8000-000000000031', pg_temp.rol('dj'), 'DJ (düğün)', 1, 21000, true, 0),
('5a4e0005-0000-4000-8000-000000000103', '5a4e0004-0000-4000-8000-000000000031', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (düğün)', 2, 8500, true, 1),
('5a4e0005-0000-4000-8000-000000000104', '5a4e0004-0000-4000-8000-000000000031', pg_temp.rol('organizasyon'), 'Organizasyon (düğün)', 1, 97500, true, 2),
('5a4e0005-0000-4000-8000-000000000105', '5a4e0004-0000-4000-8000-000000000031', pg_temp.rol('tercuman'), 'Tercüman (düğün)', 1, 9000, true, 3),
('5a4e0005-0000-4000-8000-000000000106', '5a4e0004-0000-4000-8000-000000000031', pg_temp.rol('konusmaci'), 'Konuşmacı (düğün)', 1, 22000, true, 4),
('5a4e0005-0000-4000-8000-000000000107', '5a4e0004-0000-4000-8000-000000000032', pg_temp.rol('fotografci'), 'Fotoğrafçı (konferans)', 1, 25000, true, 0),
('5a4e0005-0000-4000-8000-000000000108', '5a4e0004-0000-4000-8000-000000000032', pg_temp.rol('dj'), 'DJ (konferans)', 1, 14000, true, 1),
('5a4e0005-0000-4000-8000-000000000109', '5a4e0004-0000-4000-8000-000000000033', pg_temp.rol('fotografci'), 'Fotoğrafçı (konferans)', 1, 37500, true, 0),
('5a4e0005-0000-4000-8000-000000000110', '5a4e0004-0000-4000-8000-000000000033', pg_temp.rol('dj'), 'DJ (konferans)', 1, 13000, true, 1),
('5a4e0005-0000-4000-8000-000000000111', '5a4e0004-0000-4000-8000-000000000034', pg_temp.rol('fotografci'), 'Fotoğrafçı (konferans)', 1, 15000, true, 0),
('5a4e0005-0000-4000-8000-000000000112', '5a4e0004-0000-4000-8000-000000000034', pg_temp.rol('dj'), 'DJ (konferans)', 1, 21000, true, 1),
('5a4e0005-0000-4000-8000-000000000113', '5a4e0004-0000-4000-8000-000000000034', pg_temp.rol('akrobat'), 'Akrobat (konferans)', 1, 25000, true, 2),
('5a4e0005-0000-4000-8000-000000000114', '5a4e0004-0000-4000-8000-000000000034', pg_temp.rol('konusmaci'), 'Konuşmacı (konferans)', 1, 35500, true, 3),
('5a4e0005-0000-4000-8000-000000000115', '5a4e0004-0000-4000-8000-000000000034', pg_temp.rol('illuzyonist'), 'İllüzyonist (konferans)', 2, 27500, true, 4),
('5a4e0005-0000-4000-8000-000000000116', '5a4e0004-0000-4000-8000-000000000035', pg_temp.rol('oyuncu'), 'Oyuncu (gala)', 1, 26500, true, 0),
('5a4e0005-0000-4000-8000-000000000117', '5a4e0004-0000-4000-8000-000000000035', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (gala)', 1, 36000, true, 1),
('5a4e0005-0000-4000-8000-000000000118', '5a4e0004-0000-4000-8000-000000000035', pg_temp.rol('sunucu'), 'Sunucu (gala)', 1, 34000, true, 2),
('5a4e0005-0000-4000-8000-000000000119', '5a4e0004-0000-4000-8000-000000000035', pg_temp.rol('konusmaci'), 'Konuşmacı (gala)', 2, 57000, true, 3),
('5a4e0005-0000-4000-8000-000000000120', '5a4e0004-0000-4000-8000-000000000036', pg_temp.rol('karikaturist'), 'Karikatürist (düğün)', 1, 11500, true, 0),
('5a4e0005-0000-4000-8000-000000000121', '5a4e0004-0000-4000-8000-000000000036', pg_temp.rol('konusmaci'), 'Konuşmacı (düğün)', 2, 40500, false, 1),
('5a4e0005-0000-4000-8000-000000000122', '5a4e0004-0000-4000-8000-000000000036', pg_temp.rol('videograf'), 'Videograf (düğün)', 1, 49000, false, 2),
('5a4e0005-0000-4000-8000-000000000123', '5a4e0004-0000-4000-8000-000000000036', pg_temp.rol('dj'), 'DJ (düğün)', 1, 21000, false, 3),
('5a4e0005-0000-4000-8000-000000000124', '5a4e0004-0000-4000-8000-000000000037', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kurumsal)', 1, 10000, true, 0),
('5a4e0005-0000-4000-8000-000000000125', '5a4e0004-0000-4000-8000-000000000037', pg_temp.rol('konusmaci'), 'Konuşmacı (kurumsal)', 2, 54500, true, 1),
('5a4e0005-0000-4000-8000-000000000126', '5a4e0004-0000-4000-8000-000000000038', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kurumsal)', 2, 17000, true, 0),
('5a4e0005-0000-4000-8000-000000000127', '5a4e0004-0000-4000-8000-000000000038', pg_temp.rol('konusmaci'), 'Konuşmacı (kurumsal)', 2, 37000, true, 1),
('5a4e0005-0000-4000-8000-000000000128', '5a4e0004-0000-4000-8000-000000000038', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 2, 48000, true, 2),
('5a4e0005-0000-4000-8000-000000000129', '5a4e0004-0000-4000-8000-000000000039', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (kurumsal)', 1, 17500, true, 0),
('5a4e0005-0000-4000-8000-000000000130', '5a4e0004-0000-4000-8000-000000000039', pg_temp.rol('organizasyon'), 'Organizasyon (kurumsal)', 1, 131000, false, 1),
('5a4e0005-0000-4000-8000-000000000131', '5a4e0004-0000-4000-8000-000000000040', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kına gecesi)', 1, 13000, true, 0),
('5a4e0005-0000-4000-8000-000000000132', '5a4e0004-0000-4000-8000-000000000040', pg_temp.rol('model'), 'Model (kına gecesi)', 1, 10000, true, 1),
('5a4e0005-0000-4000-8000-000000000133', '5a4e0004-0000-4000-8000-000000000040', pg_temp.rol('ses-isik'), 'Ses & Işık (kına gecesi)', 1, 76500, true, 2),
('5a4e0005-0000-4000-8000-000000000134', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('tercuman'), 'Tercüman (lansman)', 1, 6000, true, 0),
('5a4e0005-0000-4000-8000-000000000135', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('organizasyon'), 'Organizasyon (lansman)', 1, 146500, true, 1),
('5a4e0005-0000-4000-8000-000000000136', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('model'), 'Model (lansman)', 1, 7000, true, 2),
('5a4e0005-0000-4000-8000-000000000137', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('dansci'), 'Dansçı (lansman)', 1, 10500, true, 3),
('5a4e0005-0000-4000-8000-000000000138', '5a4e0004-0000-4000-8000-000000000042', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 2, 17000, true, 0),
('5a4e0005-0000-4000-8000-000000000139', '5a4e0004-0000-4000-8000-000000000042', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (fuar)', 1, 45000, true, 1),
('5a4e0005-0000-4000-8000-000000000140', '5a4e0004-0000-4000-8000-000000000043', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 1, 23000, false, 0),
('5a4e0005-0000-4000-8000-000000000141', '5a4e0004-0000-4000-8000-000000000043', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (fuar)', 1, 44000, true, 1),
('5a4e0005-0000-4000-8000-000000000142', '5a4e0004-0000-4000-8000-000000000043', pg_temp.rol('ses-isik'), 'Ses & Işık (fuar)', 1, 68000, true, 2),
('5a4e0005-0000-4000-8000-000000000143', '5a4e0004-0000-4000-8000-000000000043', pg_temp.rol('influencer'), 'Influencer (fuar)', 1, 59000, false, 3),
('5a4e0005-0000-4000-8000-000000000144', '5a4e0004-0000-4000-8000-000000000043', pg_temp.rol('dansci'), 'Dansçı (fuar)', 1, 12000, true, 4),
('5a4e0005-0000-4000-8000-000000000145', '5a4e0004-0000-4000-8000-000000000044', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 1, 13500, true, 0),
('5a4e0005-0000-4000-8000-000000000146', '5a4e0004-0000-4000-8000-000000000044', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (fuar)', 1, 5000, true, 1),
('5a4e0005-0000-4000-8000-000000000147', '5a4e0004-0000-4000-8000-000000000044', pg_temp.rol('oyuncu'), 'Oyuncu (fuar)', 1, 15500, true, 2),
('5a4e0005-0000-4000-8000-000000000148', '5a4e0004-0000-4000-8000-000000000044', pg_temp.rol('dansci'), 'Dansçı (fuar)', 1, 25500, true, 3),
('5a4e0005-0000-4000-8000-000000000149', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 1, 8500, true, 0),
('5a4e0005-0000-4000-8000-000000000150', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (fuar)', 2, 9000, true, 1),
('5a4e0005-0000-4000-8000-000000000151', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('oyuncu'), 'Oyuncu (fuar)', 2, 11500, true, 2),
('5a4e0005-0000-4000-8000-000000000152', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('hostes'), 'Hostes (fuar)', 2, 3000, true, 3),
('5a4e0005-0000-4000-8000-000000000153', '5a4e0004-0000-4000-8000-000000000046', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 1, 20500, true, 0),
('5a4e0005-0000-4000-8000-000000000154', '5a4e0004-0000-4000-8000-000000000046', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (fuar)', 1, 4500, true, 1),
('5a4e0005-0000-4000-8000-000000000155', '5a4e0004-0000-4000-8000-000000000047', pg_temp.rol('influencer'), 'Influencer (fuar)', 1, 52000, true, 0),
('5a4e0005-0000-4000-8000-000000000156', '5a4e0004-0000-4000-8000-000000000047', pg_temp.rol('sunucu'), 'Sunucu (fuar)', 1, 16500, true, 1),
('5a4e0005-0000-4000-8000-000000000157', '5a4e0004-0000-4000-8000-000000000047', pg_temp.rol('canli-yayin'), 'Canlı Yayın (fuar)', 1, 46500, true, 2),
('5a4e0005-0000-4000-8000-000000000158', '5a4e0004-0000-4000-8000-000000000047', pg_temp.rol('oyuncu'), 'Oyuncu (fuar)', 1, 12500, true, 3),
('5a4e0005-0000-4000-8000-000000000159', '5a4e0004-0000-4000-8000-000000000047', pg_temp.rol('hostes'), 'Hostes (fuar)', 1, 3500, true, 4),
('5a4e0005-0000-4000-8000-000000000160', '5a4e0004-0000-4000-8000-000000000048', pg_temp.rol('muzisyen'), 'Müzisyen (diğer)', 2, 56000, true, 0),
('5a4e0005-0000-4000-8000-000000000161', '5a4e0004-0000-4000-8000-000000000048', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (diğer)', 1, 6000, false, 1),
('5a4e0005-0000-4000-8000-000000000162', '5a4e0004-0000-4000-8000-000000000048', pg_temp.rol('hostes'), 'Hostes (diğer)', 2, 3000, true, 2),
('5a4e0005-0000-4000-8000-000000000163', '5a4e0004-0000-4000-8000-000000000048', pg_temp.rol('oyuncu'), 'Oyuncu (diğer)', 1, 20000, true, 3),
('5a4e0005-0000-4000-8000-000000000164', '5a4e0004-0000-4000-8000-000000000049', pg_temp.rol('muzisyen'), 'Müzisyen (diğer)', 1, 55500, true, 0),
('5a4e0005-0000-4000-8000-000000000165', '5a4e0004-0000-4000-8000-000000000049', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (diğer)', 1, 11000, true, 1),
('5a4e0005-0000-4000-8000-000000000166', '5a4e0004-0000-4000-8000-000000000049', pg_temp.rol('model'), 'Model (diğer)', 2, 18000, true, 2),
('5a4e0005-0000-4000-8000-000000000167', '5a4e0004-0000-4000-8000-000000000049', pg_temp.rol('hostes'), 'Hostes (diğer)', 1, 4000, true, 3),
('5a4e0005-0000-4000-8000-000000000168', '5a4e0004-0000-4000-8000-000000000050', pg_temp.rol('muzisyen'), 'Müzisyen (gala)', 1, 43500, true, 0),
('5a4e0005-0000-4000-8000-000000000169', '5a4e0004-0000-4000-8000-000000000050', pg_temp.rol('illuzyonist'), 'İllüzyonist (gala)', 2, 10000, true, 1),
('5a4e0005-0000-4000-8000-000000000170', '5a4e0004-0000-4000-8000-000000000051', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 1, 20500, true, 0),
('5a4e0005-0000-4000-8000-000000000171', '5a4e0004-0000-4000-8000-000000000051', pg_temp.rol('hostes'), 'Hostes (fuar)', 1, 3000, true, 1),
('5a4e0005-0000-4000-8000-000000000172', '5a4e0004-0000-4000-8000-000000000051', pg_temp.rol('dj'), 'DJ (fuar)', 1, 18500, true, 2),
('5a4e0005-0000-4000-8000-000000000173', '5a4e0004-0000-4000-8000-000000000051', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (fuar)', 1, 5000, true, 3),
('5a4e0005-0000-4000-8000-000000000174', '5a4e0004-0000-4000-8000-000000000051', pg_temp.rol('fotografci'), 'Fotoğrafçı (fuar)', 1, 39000, true, 4),
('5a4e0005-0000-4000-8000-000000000175', '5a4e0004-0000-4000-8000-000000000052', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 1, 18000, true, 0),
('5a4e0005-0000-4000-8000-000000000176', '5a4e0004-0000-4000-8000-000000000052', pg_temp.rol('hostes'), 'Hostes (fuar)', 1, 3000, true, 1),
('5a4e0005-0000-4000-8000-000000000177', '5a4e0004-0000-4000-8000-000000000052', pg_temp.rol('dj'), 'DJ (fuar)', 1, 30000, true, 2),
('5a4e0005-0000-4000-8000-000000000178', '5a4e0004-0000-4000-8000-000000000052', pg_temp.rol('ses-isik'), 'Ses & Işık (fuar)', 2, 45000, true, 3),
('5a4e0005-0000-4000-8000-000000000179', '5a4e0004-0000-4000-8000-000000000052', pg_temp.rol('sunucu'), 'Sunucu (fuar)', 1, 25500, true, 4),
('5a4e0005-0000-4000-8000-000000000180', '5a4e0004-0000-4000-8000-000000000053', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kurumsal)', 1, 10500, true, 0),
('5a4e0005-0000-4000-8000-000000000181', '5a4e0004-0000-4000-8000-000000000053', pg_temp.rol('dj'), 'DJ (kurumsal)', 1, 24000, true, 1),
('5a4e0005-0000-4000-8000-000000000182', '5a4e0004-0000-4000-8000-000000000053', pg_temp.rol('fotografci'), 'Fotoğrafçı (kurumsal)', 1, 14000, true, 2),
('5a4e0005-0000-4000-8000-000000000183', '5a4e0004-0000-4000-8000-000000000053', pg_temp.rol('hostes'), 'Hostes (kurumsal)', 1, 2500, true, 3),
('5a4e0005-0000-4000-8000-000000000184', '5a4e0004-0000-4000-8000-000000000054', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kurumsal)', 1, 6500, true, 0),
('5a4e0005-0000-4000-8000-000000000185', '5a4e0004-0000-4000-8000-000000000054', pg_temp.rol('dj'), 'DJ (kurumsal)', 1, 17000, false, 1),
('5a4e0005-0000-4000-8000-000000000186', '5a4e0004-0000-4000-8000-000000000054', pg_temp.rol('hostes'), 'Hostes (kurumsal)', 1, 3000, true, 2),
('5a4e0005-0000-4000-8000-000000000187', '5a4e0004-0000-4000-8000-000000000055', pg_temp.rol('sunucu'), 'Sunucu (konferans)', 1, 13000, true, 0),
('5a4e0005-0000-4000-8000-000000000188', '5a4e0004-0000-4000-8000-000000000055', pg_temp.rol('model'), 'Model (konferans)', 2, 15500, true, 1),
('5a4e0005-0000-4000-8000-000000000189', '5a4e0004-0000-4000-8000-000000000055', pg_temp.rol('fotografci'), 'Fotoğrafçı (konferans)', 1, 26000, true, 2),
('5a4e0005-0000-4000-8000-000000000190', '5a4e0004-0000-4000-8000-000000000055', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (konferans)', 1, 7000, true, 3),
('5a4e0005-0000-4000-8000-000000000191', '5a4e0004-0000-4000-8000-000000000056', pg_temp.rol('fotografci'), 'Fotoğrafçı (kurumsal)', 1, 24000, true, 0),
('5a4e0005-0000-4000-8000-000000000192', '5a4e0004-0000-4000-8000-000000000056', pg_temp.rol('muzisyen'), 'Müzisyen (kurumsal)', 1, 16000, true, 1),
('5a4e0005-0000-4000-8000-000000000193', '5a4e0004-0000-4000-8000-000000000056', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (kurumsal)', 2, 7000, true, 2),
('5a4e0005-0000-4000-8000-000000000194', '5a4e0004-0000-4000-8000-000000000056', pg_temp.rol('konusmaci'), 'Konuşmacı (kurumsal)', 1, 62000, true, 3),
('5a4e0005-0000-4000-8000-000000000195', '5a4e0004-0000-4000-8000-000000000057', pg_temp.rol('organizasyon'), 'Organizasyon (lansman)', 1, 98000, true, 0),
('5a4e0005-0000-4000-8000-000000000196', '5a4e0004-0000-4000-8000-000000000057', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 19500, true, 1),
('5a4e0005-0000-4000-8000-000000000197', '5a4e0004-0000-4000-8000-000000000057', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 1, 34000, true, 2),
('5a4e0005-0000-4000-8000-000000000198', '5a4e0004-0000-4000-8000-000000000058', pg_temp.rol('organizasyon'), 'Organizasyon (lansman)', 1, 69500, false, 0),
('5a4e0005-0000-4000-8000-000000000199', '5a4e0004-0000-4000-8000-000000000058', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 31000, false, 1),
('5a4e0005-0000-4000-8000-000000000200', '5a4e0004-0000-4000-8000-000000000058', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (lansman)', 1, 23000, true, 2),
('5a4e0005-0000-4000-8000-000000000201', '5a4e0004-0000-4000-8000-000000000058', pg_temp.rol('videograf'), 'Videograf (lansman)', 1, 37500, true, 3),
('5a4e0005-0000-4000-8000-000000000202', '5a4e0004-0000-4000-8000-000000000059', pg_temp.rol('organizasyon'), 'Organizasyon (lansman)', 1, 74500, true, 0),
('5a4e0005-0000-4000-8000-000000000203', '5a4e0004-0000-4000-8000-000000000059', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 24000, true, 1),
('5a4e0005-0000-4000-8000-000000000204', '5a4e0004-0000-4000-8000-000000000059', pg_temp.rol('videograf'), 'Videograf (lansman)', 2, 46000, true, 2),
('5a4e0005-0000-4000-8000-000000000205', '5a4e0004-0000-4000-8000-000000000059', pg_temp.rol('fotografci'), 'Fotoğrafçı (lansman)', 2, 41000, true, 3),
('5a4e0005-0000-4000-8000-000000000206', '5a4e0004-0000-4000-8000-000000000060', pg_temp.rol('dansci'), 'Dansçı (kurumsal)', 1, 9500, true, 0),
('5a4e0005-0000-4000-8000-000000000207', '5a4e0004-0000-4000-8000-000000000060', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 2, 22500, true, 1),
('5a4e0005-0000-4000-8000-000000000208', '5a4e0004-0000-4000-8000-000000000061', pg_temp.rol('dansci'), 'Dansçı (kurumsal)', 1, 31500, true, 0),
('5a4e0005-0000-4000-8000-000000000209', '5a4e0004-0000-4000-8000-000000000061', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 2, 37500, true, 1),
('5a4e0005-0000-4000-8000-000000000210', '5a4e0004-0000-4000-8000-000000000062', pg_temp.rol('dansci'), 'Dansçı (kurumsal)', 1, 14500, true, 0),
('5a4e0005-0000-4000-8000-000000000211', '5a4e0004-0000-4000-8000-000000000062', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 1, 40500, true, 1),
('5a4e0005-0000-4000-8000-000000000212', '5a4e0004-0000-4000-8000-000000000062', pg_temp.rol('ses-isik'), 'Ses & Işık (kurumsal)', 1, 34000, true, 2),
('5a4e0005-0000-4000-8000-000000000213', '5a4e0004-0000-4000-8000-000000000062', pg_temp.rol('influencer'), 'Influencer (kurumsal)', 1, 39000, true, 3),
('5a4e0005-0000-4000-8000-000000000214', '5a4e0004-0000-4000-8000-000000000063', pg_temp.rol('dansci'), 'Dansçı (fuar)', 1, 30500, true, 0),
('5a4e0005-0000-4000-8000-000000000215', '5a4e0004-0000-4000-8000-000000000063', pg_temp.rol('fotografci'), 'Fotoğrafçı (fuar)', 1, 42000, true, 1),
('5a4e0005-0000-4000-8000-000000000216', '5a4e0004-0000-4000-8000-000000000063', pg_temp.rol('karikaturist'), 'Karikatürist (fuar)', 2, 10500, true, 2),
('5a4e0005-0000-4000-8000-000000000217', '5a4e0004-0000-4000-8000-000000000063', pg_temp.rol('hostes'), 'Hostes (fuar)', 1, 2500, true, 3),
('5a4e0005-0000-4000-8000-000000000218', '5a4e0004-0000-4000-8000-000000000063', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 2, 12000, true, 4),
('5a4e0005-0000-4000-8000-000000000219', '5a4e0004-0000-4000-8000-000000000064', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 2, 82000, false, 0),
('5a4e0005-0000-4000-8000-000000000220', '5a4e0004-0000-4000-8000-000000000064', pg_temp.rol('model'), 'Model (lansman)', 1, 10000, true, 1),
('5a4e0005-0000-4000-8000-000000000221', '5a4e0004-0000-4000-8000-000000000064', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (lansman)', 1, 19500, true, 2),
('5a4e0005-0000-4000-8000-000000000222', '5a4e0004-0000-4000-8000-000000000065', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (baby shower)', 2, 6000, true, 0),
('5a4e0005-0000-4000-8000-000000000223', '5a4e0004-0000-4000-8000-000000000065', pg_temp.rol('videograf'), 'Videograf (baby shower)', 1, 27500, true, 1),
('5a4e0005-0000-4000-8000-000000000224', '5a4e0004-0000-4000-8000-000000000065', pg_temp.rol('palyaco'), 'Palyaço (baby shower)', 2, 3500, true, 2),
('5a4e0005-0000-4000-8000-000000000225', '5a4e0004-0000-4000-8000-000000000066', pg_temp.rol('model'), 'Model (lansman)', 1, 15500, true, 0),
('5a4e0005-0000-4000-8000-000000000226', '5a4e0004-0000-4000-8000-000000000066', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (lansman)', 2, 6500, true, 1),
('5a4e0005-0000-4000-8000-000000000227', '5a4e0004-0000-4000-8000-000000000066', pg_temp.rol('palyaco'), 'Palyaço (lansman)', 1, 6500, true, 2),
('5a4e0005-0000-4000-8000-000000000228', '5a4e0004-0000-4000-8000-000000000067', pg_temp.rol('model'), 'Model (lansman)', 1, 16000, false, 0),
('5a4e0005-0000-4000-8000-000000000229', '5a4e0004-0000-4000-8000-000000000067', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (lansman)', 1, 8500, false, 1),
('5a4e0005-0000-4000-8000-000000000230', '5a4e0004-0000-4000-8000-000000000068', pg_temp.rol('model'), 'Model (lansman)', 1, 14000, true, 0),
('5a4e0005-0000-4000-8000-000000000231', '5a4e0004-0000-4000-8000-000000000068', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (lansman)', 1, 13500, true, 1),
('5a4e0005-0000-4000-8000-000000000232', '5a4e0004-0000-4000-8000-000000000068', pg_temp.rol('fotografci'), 'Fotoğrafçı (lansman)', 1, 37000, true, 2),
('5a4e0005-0000-4000-8000-000000000233', '5a4e0004-0000-4000-8000-000000000069', pg_temp.rol('ses-isik'), 'Ses & Işık (nişan)', 1, 39500, true, 0),
('5a4e0005-0000-4000-8000-000000000234', '5a4e0004-0000-4000-8000-000000000069', pg_temp.rol('karikaturist'), 'Karikatürist (nişan)', 1, 6000, false, 1),
('5a4e0005-0000-4000-8000-000000000235', '5a4e0004-0000-4000-8000-000000000069', pg_temp.rol('muzisyen'), 'Müzisyen (nişan)', 1, 21000, true, 2),
('5a4e0005-0000-4000-8000-000000000236', '5a4e0004-0000-4000-8000-000000000069', pg_temp.rol('palyaco'), 'Palyaço (nişan)', 2, 5500, true, 3),
('5a4e0005-0000-4000-8000-000000000237', '5a4e0004-0000-4000-8000-000000000070', pg_temp.rol('fotografci'), 'Fotoğrafçı (konser)', 2, 15000, true, 0),
('5a4e0005-0000-4000-8000-000000000238', '5a4e0004-0000-4000-8000-000000000070', pg_temp.rol('model'), 'Model (konser)', 2, 10500, true, 1),
('5a4e0005-0000-4000-8000-000000000239', '5a4e0004-0000-4000-8000-000000000070', pg_temp.rol('organizasyon'), 'Organizasyon (konser)', 2, 107500, true, 2),
('5a4e0005-0000-4000-8000-000000000240', '5a4e0004-0000-4000-8000-000000000070', pg_temp.rol('karikaturist'), 'Karikatürist (konser)', 1, 6500, true, 3),
('5a4e0005-0000-4000-8000-000000000241', '5a4e0004-0000-4000-8000-000000000071', pg_temp.rol('fotografci'), 'Fotoğrafçı (konser)', 1, 37000, true, 0),
('5a4e0005-0000-4000-8000-000000000242', '5a4e0004-0000-4000-8000-000000000071', pg_temp.rol('model'), 'Model (konser)', 1, 9000, true, 1),
('5a4e0005-0000-4000-8000-000000000243', '5a4e0004-0000-4000-8000-000000000071', pg_temp.rol('organizasyon'), 'Organizasyon (konser)', 2, 91500, true, 2),
('5a4e0005-0000-4000-8000-000000000244', '5a4e0004-0000-4000-8000-000000000072', pg_temp.rol('fotografci'), 'Fotoğrafçı (konser)', 1, 16500, true, 0),
('5a4e0005-0000-4000-8000-000000000245', '5a4e0004-0000-4000-8000-000000000072', pg_temp.rol('model'), 'Model (konser)', 1, 8000, false, 1),
('5a4e0005-0000-4000-8000-000000000246', '5a4e0004-0000-4000-8000-000000000072', pg_temp.rol('organizasyon'), 'Organizasyon (konser)', 1, 164500, true, 2),
('5a4e0005-0000-4000-8000-000000000247', '5a4e0004-0000-4000-8000-000000000073', pg_temp.rol('organizasyon'), 'Organizasyon (düğün)', 1, 48500, true, 0),
('5a4e0005-0000-4000-8000-000000000248', '5a4e0004-0000-4000-8000-000000000073', pg_temp.rol('oyuncu'), 'Oyuncu (düğün)', 1, 9000, true, 1),
('5a4e0005-0000-4000-8000-000000000249', '5a4e0004-0000-4000-8000-000000000074', pg_temp.rol('muzisyen'), 'Müzisyen (kurumsal)', 2, 54500, true, 0),
('5a4e0005-0000-4000-8000-000000000250', '5a4e0004-0000-4000-8000-000000000074', pg_temp.rol('konusmaci'), 'Konuşmacı (kurumsal)', 1, 43500, true, 1),
('5a4e0005-0000-4000-8000-000000000251', '5a4e0004-0000-4000-8000-000000000074', pg_temp.rol('videograf'), 'Videograf (kurumsal)', 1, 46000, false, 2),
('5a4e0005-0000-4000-8000-000000000252', '5a4e0004-0000-4000-8000-000000000074', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 1, 26000, true, 3);
  -- gonderim (sent_at ilk kez; tetikleyici proposal_sent olayini sent_at ile yazar)
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3275.35) WHERE id = '5a4e0004-0000-4000-8000-000000000001';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(5048.71) WHERE id = '5a4e0004-0000-4000-8000-000000000002';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(5035.70) WHERE id = '5a4e0004-0000-4000-8000-000000000003';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(5033.96) WHERE id = '5a4e0004-0000-4000-8000-000000000004';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1410.06) WHERE id = '5a4e0004-0000-4000-8000-000000000005';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1424.21) WHERE id = '5a4e0004-0000-4000-8000-000000000006';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2571.23) WHERE id = '5a4e0004-0000-4000-8000-000000000007';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2890.96) WHERE id = '5a4e0004-0000-4000-8000-000000000008';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2113.73) WHERE id = '5a4e0004-0000-4000-8000-000000000009';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2108.27) WHERE id = '5a4e0004-0000-4000-8000-000000000010';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3549.75) WHERE id = '5a4e0004-0000-4000-8000-000000000011';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3553.09) WHERE id = '5a4e0004-0000-4000-8000-000000000012';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3531.29) WHERE id = '5a4e0004-0000-4000-8000-000000000013';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2379.17) WHERE id = '5a4e0004-0000-4000-8000-000000000014';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2935.04) WHERE id = '5a4e0004-0000-4000-8000-000000000015';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1004.69) WHERE id = '5a4e0004-0000-4000-8000-000000000016';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(990.09) WHERE id = '5a4e0004-0000-4000-8000-000000000017';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1058.89) WHERE id = '5a4e0004-0000-4000-8000-000000000018';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(164.84) WHERE id = '5a4e0004-0000-4000-8000-000000000019';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2162.06) WHERE id = '5a4e0004-0000-4000-8000-000000000020';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2164.26) WHERE id = '5a4e0004-0000-4000-8000-000000000021';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2160.16) WHERE id = '5a4e0004-0000-4000-8000-000000000022';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1412.10) WHERE id = '5a4e0004-0000-4000-8000-000000000023';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1387.59) WHERE id = '5a4e0004-0000-4000-8000-000000000024';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1400.00) WHERE id = '5a4e0004-0000-4000-8000-000000000025';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3018.65) WHERE id = '5a4e0004-0000-4000-8000-000000000026';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3728.06) WHERE id = '5a4e0004-0000-4000-8000-000000000027';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(755.78) WHERE id = '5a4e0004-0000-4000-8000-000000000028';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(765.24) WHERE id = '5a4e0004-0000-4000-8000-000000000029';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(746.61) WHERE id = '5a4e0004-0000-4000-8000-000000000030';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(155.05) WHERE id = '5a4e0004-0000-4000-8000-000000000031';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3450.97) WHERE id = '5a4e0004-0000-4000-8000-000000000032';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3448.81) WHERE id = '5a4e0004-0000-4000-8000-000000000033';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3380.74) WHERE id = '5a4e0004-0000-4000-8000-000000000034';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1309.45) WHERE id = '5a4e0004-0000-4000-8000-000000000035';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3200.73) WHERE id = '5a4e0004-0000-4000-8000-000000000036';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(5708.69) WHERE id = '5a4e0004-0000-4000-8000-000000000037';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(5725.55) WHERE id = '5a4e0004-0000-4000-8000-000000000038';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3859.99) WHERE id = '5a4e0004-0000-4000-8000-000000000039';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2558.85) WHERE id = '5a4e0004-0000-4000-8000-000000000040';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4119.51) WHERE id = '5a4e0004-0000-4000-8000-000000000041';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4697.57) WHERE id = '5a4e0004-0000-4000-8000-000000000042';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4690.74) WHERE id = '5a4e0004-0000-4000-8000-000000000043';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4478.54) WHERE id = '5a4e0004-0000-4000-8000-000000000044';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4505.56) WHERE id = '5a4e0004-0000-4000-8000-000000000045';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4511.17) WHERE id = '5a4e0004-0000-4000-8000-000000000046';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(207.60) WHERE id = '5a4e0004-0000-4000-8000-000000000047';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(175.28) WHERE id = '5a4e0004-0000-4000-8000-000000000048';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(188.18) WHERE id = '5a4e0004-0000-4000-8000-000000000049';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3009.56) WHERE id = '5a4e0004-0000-4000-8000-000000000050';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2744.39) WHERE id = '5a4e0004-0000-4000-8000-000000000051';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2769.26) WHERE id = '5a4e0004-0000-4000-8000-000000000052';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(966.79) WHERE id = '5a4e0004-0000-4000-8000-000000000053';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(962.65) WHERE id = '5a4e0004-0000-4000-8000-000000000054';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3683.76) WHERE id = '5a4e0004-0000-4000-8000-000000000055';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1436.90) WHERE id = '5a4e0004-0000-4000-8000-000000000056';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(221.81) WHERE id = '5a4e0004-0000-4000-8000-000000000057';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(218.24) WHERE id = '5a4e0004-0000-4000-8000-000000000058';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(184.05) WHERE id = '5a4e0004-0000-4000-8000-000000000059';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(715.55) WHERE id = '5a4e0004-0000-4000-8000-000000000060';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(677.33) WHERE id = '5a4e0004-0000-4000-8000-000000000061';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(673.32) WHERE id = '5a4e0004-0000-4000-8000-000000000062';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4413.27) WHERE id = '5a4e0004-0000-4000-8000-000000000063';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3983.67) WHERE id = '5a4e0004-0000-4000-8000-000000000064';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(759.71) WHERE id = '5a4e0004-0000-4000-8000-000000000065';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(133.53) WHERE id = '5a4e0004-0000-4000-8000-000000000066';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(162.35) WHERE id = '5a4e0004-0000-4000-8000-000000000067';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(175.44) WHERE id = '5a4e0004-0000-4000-8000-000000000068';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1621.59) WHERE id = '5a4e0004-0000-4000-8000-000000000069';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3170.90) WHERE id = '5a4e0004-0000-4000-8000-000000000070';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3156.68) WHERE id = '5a4e0004-0000-4000-8000-000000000071';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3176.74) WHERE id = '5a4e0004-0000-4000-8000-000000000072';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2023.48) WHERE id = '5a4e0004-0000-4000-8000-000000000073';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2110.96) WHERE id = '5a4e0004-0000-4000-8000-000000000074';
  -- durumlar (proposal_* olaylari now() ile yazilir; asagida duzeltilir)
UPDATE public.proposal_versions SET approved_by_name = 'Orhan Turan', approved_at = pg_temp.t(3039.42) WHERE id = '5a4e0004-0000-4000-8000-000000000001';
UPDATE public.proposal_versions SET approved_by_name = 'Kaan Erol', approved_at = pg_temp.t(4983.66) WHERE id = '5a4e0004-0000-4000-8000-000000000002';
UPDATE public.proposal_versions SET approved_by_name = 'Selim Aydın', approved_at = pg_temp.t(1285.38) WHERE id = '5a4e0004-0000-4000-8000-000000000005';
UPDATE public.proposal_versions SET approved_by_name = 'Melike Aktaş', approved_at = pg_temp.t(2418.59) WHERE id = '5a4e0004-0000-4000-8000-000000000007';
UPDATE public.proposal_versions SET approved_by_name = 'İrem Güneş', approved_at = pg_temp.t(2882.68) WHERE id = '5a4e0004-0000-4000-8000-000000000008';
UPDATE public.proposal_versions SET approved_by_name = 'Murat Öztürk', approved_at = pg_temp.t(1960.12) WHERE id = '5a4e0004-0000-4000-8000-000000000009';
UPDATE public.proposal_versions SET approved_by_name = 'Berk Polat', approved_at = pg_temp.t(958.10) WHERE id = '5a4e0004-0000-4000-8000-000000000016';
UPDATE public.proposal_versions SET approved_by_name = 'Fulya Erdem', approved_at = pg_temp.t(2073.48) WHERE id = '5a4e0004-0000-4000-8000-000000000020';
UPDATE public.proposal_versions SET approved_by_name = 'Enes Aslan', approved_at = pg_temp.t(1260.27) WHERE id = '5a4e0004-0000-4000-8000-000000000023';
UPDATE public.proposal_versions SET approved_by_name = 'Burak Polat', approved_at = pg_temp.t(3536.16) WHERE id = '5a4e0004-0000-4000-8000-000000000027';
UPDATE public.proposal_versions SET approved_by_name = 'Emre Kurt', approved_at = pg_temp.t(738.94) WHERE id = '5a4e0004-0000-4000-8000-000000000028';
UPDATE public.proposal_versions SET approved_by_name = 'Dilara Avcı', approved_at = pg_temp.t(3294.35) WHERE id = '5a4e0004-0000-4000-8000-000000000032';
UPDATE public.proposal_versions SET approved_by_name = 'Merve Aksoy', approved_at = pg_temp.t(5574.27) WHERE id = '5a4e0004-0000-4000-8000-000000000037';
UPDATE public.proposal_versions SET approved_by_name = 'Utku Soylu', approved_at = pg_temp.t(3694.42) WHERE id = '5a4e0004-0000-4000-8000-000000000039';
UPDATE public.proposal_versions SET approved_by_name = 'Burcu Sarı', approved_at = pg_temp.t(3916.97) WHERE id = '5a4e0004-0000-4000-8000-000000000041';
UPDATE public.proposal_versions SET approved_by_name = 'Koray Bulut', approved_at = pg_temp.t(4640.17) WHERE id = '5a4e0004-0000-4000-8000-000000000042';
UPDATE public.proposal_versions SET approved_by_name = 'Emre Kurt', approved_at = pg_temp.t(4409.45) WHERE id = '5a4e0004-0000-4000-8000-000000000044';
UPDATE public.proposal_versions SET approved_by_name = 'Sevgi Erol', approved_at = pg_temp.t(97.45) WHERE id = '5a4e0004-0000-4000-8000-000000000047';
UPDATE public.proposal_versions SET approved_by_name = 'Tuğçe Şahin', approved_at = pg_temp.t(2805.09) WHERE id = '5a4e0004-0000-4000-8000-000000000050';
UPDATE public.proposal_versions SET approved_by_name = 'Doruk Erdoğan', approved_at = pg_temp.t(2671.43) WHERE id = '5a4e0004-0000-4000-8000-000000000051';
UPDATE public.proposal_versions SET approved_by_name = 'Görkem Toprak', approved_at = pg_temp.t(869.90) WHERE id = '5a4e0004-0000-4000-8000-000000000053';
UPDATE public.proposal_versions SET approved_by_name = 'Yağmur Turan', approved_at = pg_temp.t(522.32) WHERE id = '5a4e0004-0000-4000-8000-000000000065';
UPDATE public.proposal_versions SET approved_by_name = 'Caner Ateş', approved_at = pg_temp.t(1415.76) WHERE id = '5a4e0004-0000-4000-8000-000000000069';
UPDATE public.proposal_versions SET approved_by_name = 'Sevgi Erol', approved_at = pg_temp.t(3059.19) WHERE id = '5a4e0004-0000-4000-8000-000000000070';
UPDATE public.proposal_versions SET approved_by_name = 'Batuhan Kılıç', approved_at = pg_temp.t(2020.55) WHERE id = '5a4e0004-0000-4000-8000-000000000073';
UPDATE public.proposal_versions SET approved_by_name = 'Burcu Sarı', approved_at = pg_temp.t(2072.47) WHERE id = '5a4e0004-0000-4000-8000-000000000074';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000001';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000002';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000003';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000004';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000005';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000006';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000007';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000008';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000009';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000010';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000011';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000012';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000013';
UPDATE public.proposals SET status = 'expired' WHERE id = '5a4e0003-0000-4000-8000-000000000014';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000015';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000016';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000017';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000018';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000019';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000020';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000021';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000022';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000023';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000024';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000025';
UPDATE public.proposals SET status = 'expired' WHERE id = '5a4e0003-0000-4000-8000-000000000026';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000027';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000028';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000029';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000030';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000031';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000032';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000033';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000034';
UPDATE public.proposals SET status = 'revision_requested' WHERE id = '5a4e0003-0000-4000-8000-000000000035';
UPDATE public.proposals SET status = 'expired' WHERE id = '5a4e0003-0000-4000-8000-000000000036';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000037';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000038';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000039';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000040';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000041';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000042';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000043';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000044';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000045';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000046';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000047';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000048';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000049';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000050';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000051';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000052';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000053';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000054';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000055';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000056';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000057';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000058';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000059';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000060';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000061';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000062';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000063';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000064';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000065';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000066';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000067';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000068';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000069';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000070';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000071';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000072';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000073';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000074';
  PERFORM set_config('kashe.faz7_rpc', '0', true);
END $$;

INSERT INTO public.bookings (id, proposal_version_id, seller_provider_id, buyer_organization_id, customer_id, event_id, event_date, event_type, location, guest_count, total_amount, created_at)
VALUES
('5a4e0013-0000-4000-8000-000000000279', '5a4e0004-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000020001', NULL, NULL, '5a4e0002-0000-4000-8000-000000000001', pg_temp.d(-54), 'henna', 'İstanbul', 150, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000001'), pg_temp.t(3038.92)),
('5a4e0013-0000-4000-8000-000000000280', '5a4e0004-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000020001', NULL, '5a4e0000-0000-4000-8000-000000040002', '5a4e0002-0000-4000-8000-000000000002', pg_temp.d(-151), 'birthday', 'İstanbul', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000002'), pg_temp.t(4983.16)),
('5a4e0013-0000-4000-8000-000000000281', '5a4e0004-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000020001', NULL, NULL, '5a4e0002-0000-4000-8000-000000000003', pg_temp.d(-39), 'corporate', 'İstanbul', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000005'), pg_temp.t(1284.88)),
('5a4e0013-0000-4000-8000-000000000282', '5a4e0004-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000020001', NULL, '5a4e0000-0000-4000-8000-000000040016', '5a4e0002-0000-4000-8000-000000000005', pg_temp.d(-79), 'wedding', 'İstanbul', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000007'), pg_temp.t(2418.09)),
('5a4e0013-0000-4000-8000-000000000283', '5a4e0004-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000020002', NULL, '5a4e0000-0000-4000-8000-000000040008', '5a4e0002-0000-4000-8000-000000000006', pg_temp.d(-57), 'wedding', 'İstanbul', 80, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000008'), pg_temp.t(2882.18)),
('5a4e0013-0000-4000-8000-000000000284', '5a4e0004-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000020002', NULL, NULL, '5a4e0002-0000-4000-8000-000000000007', pg_temp.d(-7), 'fair', 'Antalya', 200, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000009'), pg_temp.t(1959.62)),
('5a4e0013-0000-4000-8000-000000000285', '5a4e0004-0000-4000-8000-000000000016', '5a4e0000-0000-4000-8000-000000020004', NULL, '5a4e0000-0000-4000-8000-000000040013', '5a4e0002-0000-4000-8000-000000000014', pg_temp.d(-10), 'engagement', 'İstanbul', 120, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000016'), pg_temp.t(957.60)),
('5a4e0013-0000-4000-8000-000000000286', '5a4e0004-0000-4000-8000-000000000020', '5a4e0000-0000-4000-8000-000000020005', NULL, NULL, '5a4e0002-0000-4000-8000-000000000016', pg_temp.d(-45), 'wedding', 'İstanbul', 150, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000020'), pg_temp.t(2072.98)),
('5a4e0013-0000-4000-8000-000000000287', '5a4e0004-0000-4000-8000-000000000023', '5a4e0000-0000-4000-8000-000000020005', NULL, NULL, '5a4e0002-0000-4000-8000-000000000017', pg_temp.d(10), 'wedding', 'İstanbul', 500, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000023'), pg_temp.t(1259.77)),
('5a4e0013-0000-4000-8000-000000000288', '5a4e0004-0000-4000-8000-000000000027', '5a4e0000-0000-4000-8000-000000020005', NULL, '5a4e0000-0000-4000-8000-000000040020', '5a4e0002-0000-4000-8000-000000000019', pg_temp.d(-137), 'wedding', 'İstanbul', 150, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000027'), pg_temp.t(3535.66)),
('5a4e0013-0000-4000-8000-000000000289', '5a4e0004-0000-4000-8000-000000000028', '5a4e0000-0000-4000-8000-000000020006', pg_temp.org('5a4e0000-0000-4000-8000-000000030004'), NULL, '5a4e0002-0000-4000-8000-000000000020', pg_temp.d(-6), 'launch', 'İstanbul', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000028'), pg_temp.t(738.44)),
('5a4e0013-0000-4000-8000-000000000290', '5a4e0004-0000-4000-8000-000000000032', '5a4e0000-0000-4000-8000-000000020006', NULL, NULL, '5a4e0002-0000-4000-8000-000000000022', pg_temp.d(-63), 'conference', 'İstanbul', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000032'), pg_temp.t(3293.85)),
('5a4e0013-0000-4000-8000-000000000291', '5a4e0004-0000-4000-8000-000000000037', '5a4e0000-0000-4000-8000-000000020007', pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), NULL, '5a4e0002-0000-4000-8000-000000000025', pg_temp.d(-162), 'corporate', 'Antalya', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000037'), pg_temp.t(5573.77)),
('5a4e0013-0000-4000-8000-000000000292', '5a4e0004-0000-4000-8000-000000000039', '5a4e0000-0000-4000-8000-000000020007', NULL, NULL, '5a4e0002-0000-4000-8000-000000000026', pg_temp.d(-94), 'corporate', 'Gaziantep', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000039'), pg_temp.t(3693.92)),
('5a4e0013-0000-4000-8000-000000000293', '5a4e0004-0000-4000-8000-000000000041', '5a4e0000-0000-4000-8000-000000020008', pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), NULL, '5a4e0002-0000-4000-8000-000000000028', pg_temp.d(-92), 'launch', 'İstanbul', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000041'), pg_temp.t(3916.47)),
('5a4e0013-0000-4000-8000-000000000294', '5a4e0004-0000-4000-8000-000000000042', '5a4e0000-0000-4000-8000-000000020008', NULL, NULL, '5a4e0002-0000-4000-8000-000000000029', pg_temp.d(-150), 'fair', 'İstanbul', 80, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000042'), pg_temp.t(4639.67)),
('5a4e0013-0000-4000-8000-000000000295', '5a4e0004-0000-4000-8000-000000000044', '5a4e0000-0000-4000-8000-000000020008', pg_temp.org('5a4e0000-0000-4000-8000-000000030004'), NULL, '5a4e0002-0000-4000-8000-000000000030', pg_temp.d(-148), 'fair', 'Ankara', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000044'), pg_temp.t(4408.95)),
('5a4e0013-0000-4000-8000-000000000296', '5a4e0004-0000-4000-8000-000000000047', '5a4e0000-0000-4000-8000-000000020008', pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), NULL, '5a4e0002-0000-4000-8000-000000000031', pg_temp.d(54), 'fair', 'İstanbul', 200, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000047'), pg_temp.t(96.95)),
('5a4e0013-0000-4000-8000-000000000297', '5a4e0004-0000-4000-8000-000000000050', '5a4e0000-0000-4000-8000-000000020009', pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), NULL, '5a4e0002-0000-4000-8000-000000000033', pg_temp.d(-45), 'gala', 'Bursa', 120, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000050'), pg_temp.t(2804.59)),
('5a4e0013-0000-4000-8000-000000000298', '5a4e0004-0000-4000-8000-000000000051', '5a4e0000-0000-4000-8000-000000020009', pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), NULL, '5a4e0002-0000-4000-8000-000000000034', pg_temp.d(-68), 'fair', 'Bursa', 150, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000051'), pg_temp.t(2670.93)),
('5a4e0013-0000-4000-8000-000000000299', '5a4e0004-0000-4000-8000-000000000053', '5a4e0000-0000-4000-8000-000000020009', NULL, NULL, '5a4e0002-0000-4000-8000-000000000035', pg_temp.d(21), 'corporate', 'Bursa', 50, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000053'), pg_temp.t(869.40)),
('5a4e0013-0000-4000-8000-000000000300', '5a4e0004-0000-4000-8000-000000000065', '5a4e0000-0000-4000-8000-000000020011', NULL, NULL, '5a4e0002-0000-4000-8000-000000000043', pg_temp.d(27), 'baby_shower', 'Ankara', 150, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000065'), pg_temp.t(521.82)),
('5a4e0013-0000-4000-8000-000000000301', '5a4e0004-0000-4000-8000-000000000069', '5a4e0000-0000-4000-8000-000000020011', NULL, '5a4e0000-0000-4000-8000-000000040014', '5a4e0002-0000-4000-8000-000000000046', pg_temp.d(-22), 'engagement', 'Gaziantep', 80, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000069'), pg_temp.t(1415.26)),
('5a4e0013-0000-4000-8000-000000000302', '5a4e0004-0000-4000-8000-000000000070', '5a4e0000-0000-4000-8000-000000020012', pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), NULL, '5a4e0002-0000-4000-8000-000000000047', pg_temp.d(-55), 'concert', 'Ankara', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000070'), pg_temp.t(3058.69)),
('5a4e0013-0000-4000-8000-000000000303', '5a4e0004-0000-4000-8000-000000000073', '5a4e0000-0000-4000-8000-000000020012', NULL, '5a4e0000-0000-4000-8000-000000040019', '5a4e0002-0000-4000-8000-000000000048', pg_temp.d(-3), 'wedding', 'Ankara', 500, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000073'), pg_temp.t(2020.05)),
('5a4e0013-0000-4000-8000-000000000304', '5a4e0004-0000-4000-8000-000000000074', '5a4e0000-0000-4000-8000-000000020012', pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), NULL, '5a4e0002-0000-4000-8000-000000000049', pg_temp.d(-15), 'corporate', 'İstanbul', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000074'), pg_temp.t(2071.97));

UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1272.00) WHERE id = '5a4e0013-0000-4000-8000-000000000279';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(3600.00) WHERE id = '5a4e0013-0000-4000-8000-000000000280';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(912.00) WHERE id = '5a4e0013-0000-4000-8000-000000000281';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1344.00) WHERE id = '5a4e0013-0000-4000-8000-000000000283';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(144.00) WHERE id = '5a4e0013-0000-4000-8000-000000000284';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(216.00) WHERE id = '5a4e0013-0000-4000-8000-000000000285';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1056.00) WHERE id = '5a4e0013-0000-4000-8000-000000000286';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(3264.00) WHERE id = '5a4e0013-0000-4000-8000-000000000288';
UPDATE public.bookings SET status = 'cancelled', cancelled_at = pg_temp.t(690.94), cancelled_by = '5a4e0000-0000-4000-8000-000000020006', cancellation_reason = 'Etkinlik ertelendi' WHERE id = '5a4e0013-0000-4000-8000-000000000289';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1488.00) WHERE id = '5a4e0013-0000-4000-8000-000000000290';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(2184.00) WHERE id = '5a4e0013-0000-4000-8000-000000000293';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(3576.00) WHERE id = '5a4e0013-0000-4000-8000-000000000294';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1056.00) WHERE id = '5a4e0013-0000-4000-8000-000000000297';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1296.00) WHERE id = '5a4e0013-0000-4000-8000-000000000302';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(48.00) WHERE id = '5a4e0013-0000-4000-8000-000000000303';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(336.00) WHERE id = '5a4e0013-0000-4000-8000-000000000304';

-- E) zaman duzeltmeleri: tetikleyicilerin now() yazdigi olaylar/bildirimler varlik zamanina cekilir
UPDATE public.analytics_events a SET occurred_at = b.created_at FROM public.bookings b WHERE a.entity_type = 'booking' AND a.event_name = 'booking_created' AND a.entity_id = b.id AND b.id::text LIKE '5a4e0013-%';
UPDATE public.analytics_events a SET occurred_at = LEAST(COALESCE(v.approved_at, v.sent_at + interval '3 days'), now()) FROM public.proposals p JOIN public.proposal_versions v ON v.id = p.current_version_id
 WHERE a.entity_type = 'proposal' AND a.entity_id = p.id AND p.id::text LIKE '5a4e0003-%' AND a.event_name IN ('proposal_approved', 'proposal_declined', 'proposal_revision');
UPDATE public.analytics_events a SET occurred_at = e.created_at FROM public.events e WHERE a.entity_type = 'event' AND a.entity_id = e.id AND e.id::text LIKE '5a4e0002-%';
UPDATE public.conversations c SET last_message_at = m.son FROM (SELECT conversation_id, max(created_at) AS son FROM public.messages WHERE conversation_id::text LIKE '5a4e0010-%' GROUP BY conversation_id) m WHERE m.conversation_id = c.id;
-- bildirimler: konusma bildirimleri son mesaj zamanina (±48 saat), yorum bildirimleri yorum zamanina; 14 gunden eskiler okunmus
UPDATE public.notifications n SET created_at = c.last_message_at - (random() * interval '48 hours'),
       read_at = CASE WHEN c.last_message_at < now() - interval '14 days' THEN c.last_message_at + interval '3 hours' END
  FROM public.conversations c WHERE n.link = '/mesajlar/' || c.id::text AND c.id::text LIKE '5a4e0010-%' AND n.user_id::text LIKE '5a4e0000-%' AND n.created_at > now() - interval '1 hour';
UPDATE public.notifications n SET created_at = r.created_at, read_at = CASE WHEN r.created_at < now() - interval '14 days' THEN r.created_at + interval '5 hours' END
  FROM public.reviews r WHERE n.type = 'review' AND n.user_id = r.professional_id AND r.id::text LIKE '5a4e0014-%' AND n.created_at > now() - interval '1 hour';
UPDATE public.notifications SET created_at = now() - interval '2 days' WHERE user_id::text LIKE '5a4e0000-%' AND created_at > now() - interval '1 hour';

-- ozet
SELECT (SELECT count(*) FROM public.events WHERE id::text LIKE '5a4e0002-%') AS etkinlik,
       (SELECT count(*) FROM public.conversations WHERE id::text LIKE '5a4e0010-%') AS konusma,
       (SELECT count(*) FROM public.messages WHERE conversation_id::text LIKE '5a4e0010-%') AS mesaj,
       (SELECT count(*) FROM public.quotes WHERE id::text LIKE '5a4e0012-%') AS teklif,
       (SELECT count(*) FROM public.quotes WHERE id::text LIKE '5a4e0012-%' AND status = 'accepted') AS kabul,
       (SELECT count(*) FROM public.bookings WHERE id::text LIKE '5a4e0013-%') AS rezervasyon,
       (SELECT count(*) FROM public.bookings WHERE id::text LIKE '5a4e0013-%' AND status = 'completed') AS tamamlanan,
       (SELECT count(*) FROM public.reviews WHERE id::text LIKE '5a4e0014-%') AS yorum,
       (SELECT count(*) FROM public.proposals WHERE id::text LIKE '5a4e0003-%') AS ajans_teklifi,
       (SELECT count(*) FROM public.proposals WHERE id::text LIKE '5a4e0003-%' AND status = 'approved') AS onayli,
       (SELECT count(*) FROM public.analytics_events WHERE entity_id::text LIKE '5a4e%') AS olay,
       (SELECT count(*) FROM public.notifications WHERE user_id::text LIKE '5a4e0000-%') AS bildirim;
