-- =============================================================================
-- SAHNE 02e (5/5) — 6 aylik gecmis: etkinlikler, konusmalar, mesajlar, teklifler, rezervasyonlar, yorumlar, ajans teklifleri (YALNIZ DALDA)
-- Uretildi: scripts/sahne/uret.py (tohum 2026, 2026-10-29). Sira: 02a-sahne-gecmis -> 02b-sahne-gecmis -> 02c-sahne-gecmis -> 02d-sahne-gecmis -> 02e-sahne-gecmis (hepsi, atlamadan). Ilk parca kendi verisini silip yeniden baslar.
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


DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM public.conversations WHERE id::text LIKE '5a4e0010-%'; IF n < 100 THEN RAISE EXCEPTION 'on kosul: once 02a..02d (konusma=%)', n; END IF; END $$;

INSERT INTO public.analytics_events (event_name, entity_type, entity_id, provider_id, payload, occurred_at, actor_user_id)
SELECT v.ad, v.tip, v.eid::uuid, v.prov::uuid, v.payload, v.ts, v.actor::uuid FROM (VALUES
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 32000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1251.06), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 10000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(764.04), '5a4e0000-0000-4000-8000-000000040006'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010101', '{"total_amount": 19000, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(3304.08), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010009', '{"total_amount": 18500, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(2610.86), '5a4e0000-0000-4000-8000-000000040018'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010118', '{"total_amount": 48500, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(751.81), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 43500, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(2296.72), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010009', '{"total_amount": 26000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(292.33), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 9500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(78.96), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 22000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(877.31), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000011', '5a4e0000-0000-4000-8000-000000010112', '{"total_amount": 43500, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(3020.13), '5a4e0000-0000-4000-8000-000000040013'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000012', '5a4e0000-0000-4000-8000-000000010109', '{"total_amount": 43500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3575.25), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000013', '5a4e0000-0000-4000-8000-000000010088', '{"total_amount": 13500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(2355.00), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000014', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 46000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1644.33), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000015', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 20500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1377.97), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000016', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 22000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1539.41), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000017', '5a4e0000-0000-4000-8000-000000010044', '{"total_amount": 54000, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(4119.13), '5a4e0000-0000-4000-8000-000000040009'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000018', '5a4e0000-0000-4000-8000-000000010115', '{"total_amount": 53000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(1702.45), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000019', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 16500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1195.59), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000020', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 12000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1510.85), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000021', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 36000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1151.02), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000022', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 46000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1774.85), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000023', '5a4e0000-0000-4000-8000-000000010028', '{"total_amount": 64000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(442.44), '5a4e0000-0000-4000-8000-000000031005'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000024', '5a4e0000-0000-4000-8000-000000010093', '{"total_amount": 28000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(1381.14), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000025', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 34000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(473.80), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000026', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 32500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(319.59), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000027', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 58500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1187.34), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000029', '5a4e0000-0000-4000-8000-000000010049', '{"total_amount": 4500, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(3799.69), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000030', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 34500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1471.93), '5a4e0000-0000-4000-8000-000000040010'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000031', '5a4e0000-0000-4000-8000-000000010045', '{"total_amount": 209000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(624.81), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000032', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 35000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(654.58), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000033', '5a4e0000-0000-4000-8000-000000010048', '{"total_amount": 4000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(1877.84), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000034', '5a4e0000-0000-4000-8000-000000010034', '{"total_amount": 34000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(4141.02), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000036', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 26500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1537.19), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000037', '5a4e0000-0000-4000-8000-000000010097', '{"total_amount": 11500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(2664.11), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000039', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 10500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1145.55), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000041', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 45500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1623.72), '5a4e0000-0000-4000-8000-000000040007'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000042', '5a4e0000-0000-4000-8000-000000010102', '{"total_amount": 30000, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(3915.86), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000043', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 26500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1230.04), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000044', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 48500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(137.60), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000045', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 8500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(606.32), '5a4e0000-0000-4000-8000-000000031001'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000046', '5a4e0000-0000-4000-8000-000000010113', '{"total_amount": 27000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(2479.84), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000047', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 24000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(761.09), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000048', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 41000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1660.17), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000049', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 19500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(472.61), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000050', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 55500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(312.12), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000051', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 34000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(560.20), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000052', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 27000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1240.28), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000053', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 42500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1508.37), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000054', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 58500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(578.46), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000055', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 15000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(174.13), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000056', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 21000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(193.36), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000057', '5a4e0000-0000-4000-8000-000000010074', '{"total_amount": 5500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3669.71), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000058', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 23000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1845.39), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000059', '5a4e0000-0000-4000-8000-000000010105', '{"total_amount": 9500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2992.06), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000060', '5a4e0000-0000-4000-8000-000000010122', '{"total_amount": 23000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3976.96), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000061', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 26500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(347.47), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000063', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 25500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1150.31), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000064', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 10000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1625.32), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000065', '5a4e0000-0000-4000-8000-000000010029', '{"total_amount": 44000, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(67.60), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000066', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 35500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1164.61), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000067', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 41500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(850.06), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000068', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 21000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(121.03), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000069', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 12500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(68.44), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000070', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 23500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(525.35), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000073', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 16000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(384.74), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000075', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 24500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1446.95), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000076', '5a4e0000-0000-4000-8000-000000010108', '{"total_amount": 48500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(119.09), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000077', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 19000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1175.91), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000078', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 34500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(205.05), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000079', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 40000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(202.95), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000080', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 15500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1604.79), '5a4e0000-0000-4000-8000-000000040009'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000082', '5a4e0000-0000-4000-8000-000000010041', '{"total_amount": 274000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3613.74), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000085', '5a4e0000-0000-4000-8000-000000010022', '{"total_amount": 48500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(736.28), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000086', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 11000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1238.22), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000087', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 53000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(461.58), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000088', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 44500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(143.50), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000089', '5a4e0000-0000-4000-8000-000000010109', '{"total_amount": 63500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1873.68), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000090', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 42500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(192.76), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000091', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 44000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1065.15), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000093', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 9500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(716.25), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000094', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 44500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(4095.79), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000095', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 21500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(693.76), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000096', '5a4e0000-0000-4000-8000-000000010005', '{"total_amount": 49000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(4164.38), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000097', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 55000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(134.34), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000099', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 46500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(475.10), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000100', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 59000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1672.73), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000101', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 30500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(186.00), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000102', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 34500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(854.37), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000103', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 36500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1361.02), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000105', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 17000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(92.36), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000106', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 17000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1252.11), '5a4e0000-0000-4000-8000-000000031002'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000108', '5a4e0000-0000-4000-8000-000000010007', '{"total_amount": 33000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(64.32), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000110', '5a4e0000-0000-4000-8000-000000010039', '{"total_amount": 37000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(43.98), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000111', '5a4e0000-0000-4000-8000-000000010019', '{"total_amount": 33500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(1877.61), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000113', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 30000, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(2560.78), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000114', '5a4e0000-0000-4000-8000-000000010077', '{"total_amount": 17500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3205.49), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000115', '5a4e0000-0000-4000-8000-000000010113', '{"total_amount": 42500, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(1921.50), '5a4e0000-0000-4000-8000-000000040012'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000116', '5a4e0000-0000-4000-8000-000000010122', '{"total_amount": 22500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2886.63), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000117', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 17000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(503.27), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000118', '5a4e0000-0000-4000-8000-000000010100', '{"total_amount": 28500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(1517.16), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000119', '5a4e0000-0000-4000-8000-000000010082', '{"total_amount": 9500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(273.49), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000120', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 43500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(633.32), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000121', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 22500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(177.58), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000122', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 32500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(86.34), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000123', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 46000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1153.77), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000124', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 50000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1553.93), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000125', '5a4e0000-0000-4000-8000-000000010026', '{"total_amount": 29500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(602.18), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000126', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 33500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1356.16), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000127', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 40500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(640.42), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000128', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 20500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(976.87), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000129', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 37500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(323.10), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000130', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 26500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1665.00), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000131', '5a4e0000-0000-4000-8000-000000010016', '{"total_amount": 13000, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(3237.37), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000132', '5a4e0000-0000-4000-8000-000000010102', '{"total_amount": 15500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3923.37), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000133', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 47500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1437.33), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000134', '5a4e0000-0000-4000-8000-000000010039', '{"total_amount": 15500, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(503.88), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000135', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 46000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1476.19), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000136', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 27500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(733.81), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000137', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 25000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1179.26), '5a4e0000-0000-4000-8000-000000040001'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000138', '5a4e0000-0000-4000-8000-000000010097', '{"total_amount": 4500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2033.36), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000139', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 34500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(124.70), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000140', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 18000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(96.05), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000141', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 41000, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(3939.56), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000143', '5a4e0000-0000-4000-8000-000000010110', '{"total_amount": 38500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(3132.80), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000144', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 20500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1756.07), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000145', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 28500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(986.99), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000146', '5a4e0000-0000-4000-8000-000000010047', '{"total_amount": 3500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2688.79), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000147', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 36000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(902.58), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000149', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 64000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1061.97), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000150', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 26500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1016.98), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000151', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 52000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1612.41), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000152', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 13000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1725.75), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000153', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 47500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(365.41), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000154', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 35500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1758.37), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000155', '5a4e0000-0000-4000-8000-000000010120', '{"total_amount": 9000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(705.70), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000156', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 46000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1130.33), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000157', '5a4e0000-0000-4000-8000-000000010117', '{"total_amount": 37000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1200.45), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000159', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 25000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(595.70), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000161', '5a4e0000-0000-4000-8000-000000010034', '{"total_amount": 24500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3405.33), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000162', '5a4e0000-0000-4000-8000-000000010092', '{"total_amount": 21500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3495.12), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000163', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 34500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1767.73), '5a4e0000-0000-4000-8000-000000040015'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000164', '5a4e0000-0000-4000-8000-000000010079', '{"total_amount": 24000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3287.80), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000165', '5a4e0000-0000-4000-8000-000000010068', '{"total_amount": 5500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1862.06), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000166', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 33500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(985.38), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000167', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 30500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1029.45), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000168', '5a4e0000-0000-4000-8000-000000010018', '{"total_amount": 19000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(773.29), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000169', '5a4e0000-0000-4000-8000-000000010059', '{"total_amount": 95000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(427.87), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000170', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 12000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1615.98), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000171', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 11000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(451.64), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000172', '5a4e0000-0000-4000-8000-000000010084', '{"total_amount": 4500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2842.03), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000173', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 26500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1359.69), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000174', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 35000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(680.55), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000175', '5a4e0000-0000-4000-8000-000000010078', '{"total_amount": 14500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3073.34), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000176', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 35000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(275.41), '5a4e0000-0000-4000-8000-000000040006'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000177', '5a4e0000-0000-4000-8000-000000010061', '{"total_amount": 25500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(413.12), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000178', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 39000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(855.98), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000180', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 35500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1540.14), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000181', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 22000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(744.81), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000182', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 25000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1239.33), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000183', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 12500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(700.09), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000184', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 24000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(723.97), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000185', '5a4e0000-0000-4000-8000-000000010092', '{"total_amount": 14500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3216.84), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000186', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 29500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1725.82), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000187', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 43000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1672.36), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000188', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 21000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1794.34), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000189', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 35000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1400.14), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000191', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 22000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(674.48), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000192', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 18500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1400.03), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000193', '5a4e0000-0000-4000-8000-000000010043', '{"total_amount": 171000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2481.51), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000194', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 25000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(447.64), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000195', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 12500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(766.21), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000196', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 43500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1599.00), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000197', '5a4e0000-0000-4000-8000-000000010046', '{"total_amount": 114000, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(1477.83), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000198', '5a4e0000-0000-4000-8000-000000010098', '{"total_amount": 11500, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(615.58), '5a4e0000-0000-4000-8000-000000040015'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000199', '5a4e0000-0000-4000-8000-000000010096', '{"total_amount": 8500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(4136.39), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000200', '5a4e0000-0000-4000-8000-000000010082', '{"total_amount": 10000, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(1611.36), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000201', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 22500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1525.16), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000202', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 22500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1403.29), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000203', '5a4e0000-0000-4000-8000-000000010038', '{"total_amount": 27000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2203.57), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000204', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 25000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(186.85), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000205', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 25500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(114.58), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000206', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 26500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(375.65), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000207', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 10000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1023.25), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000208', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 18000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1815.45), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000209', '5a4e0000-0000-4000-8000-000000010077', '{"total_amount": 7000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(746.74), '5a4e0000-0000-4000-8000-000000031003'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000210', '5a4e0000-0000-4000-8000-000000010005', '{"total_amount": 47500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(529.59), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000211', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 32500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1785.13), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000212', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 29500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(317.29), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000213', '5a4e0000-0000-4000-8000-000000010112', '{"total_amount": 51000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3224.66), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000214', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 57500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(992.99), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000215', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 51000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1063.29), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000216', '5a4e0000-0000-4000-8000-000000010009', '{"total_amount": 26500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2560.49), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000217', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 47500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1841.95), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000218', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 44500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(126.64), '5a4e0000-0000-4000-8000-000000040016'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000219', '5a4e0000-0000-4000-8000-000000010073', '{"total_amount": 22000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3079.00), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000220', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 26000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1047.38), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000221', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 40500, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(3719.99), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000222', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 37500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1369.49), '5a4e0000-0000-4000-8000-000000040001'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000223', '5a4e0000-0000-4000-8000-000000010104', '{"total_amount": 5500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(1628.89), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000224', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 20500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(88.73), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000225', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 12500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(380.73), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000226', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 24000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(116.47), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000227', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 33500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(715.17), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000228', '5a4e0000-0000-4000-8000-000000010048', '{"total_amount": 4500, "event_type": "congress", "event_id": null}'::jsonb, pg_temp.t(3445.36), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000229', '5a4e0000-0000-4000-8000-000000010081', '{"total_amount": 11500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2143.30), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000230', '5a4e0000-0000-4000-8000-000000010008', '{"total_amount": 20500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3389.02), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000232', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 28500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(107.98), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000233', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 39000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(823.59), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000234', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 23500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1466.73), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000235', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 25000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1471.29), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000236', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 18000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(51.81), '5a4e0000-0000-4000-8000-000000040002'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000237', '5a4e0000-0000-4000-8000-000000010061', '{"total_amount": 57500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(4135.25), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000238', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 33000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(299.28), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000239', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 23500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(555.06), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000240', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 41500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1557.69), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000241', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 26500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(225.77), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000242', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 51000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1214.27), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000243', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 8000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(893.53), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000244', '5a4e0000-0000-4000-8000-000000010002', '{"total_amount": 39500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3279.79), '5a4e0000-0000-4000-8000-000000031003'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000245', '5a4e0000-0000-4000-8000-000000010064', '{"total_amount": 16000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2305.39), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000246', '5a4e0000-0000-4000-8000-000000010044', '{"total_amount": 56000, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(1410.95), '5a4e0000-0000-4000-8000-000000040018'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000247', '5a4e0000-0000-4000-8000-000000010079', '{"total_amount": 22000, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(1628.23), '5a4e0000-0000-4000-8000-000000040012'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000248', '5a4e0000-0000-4000-8000-000000010082', '{"total_amount": 22500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3971.73), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000249', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 13500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(621.17), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000250', '5a4e0000-0000-4000-8000-000000010052', '{"total_amount": 4500, "event_type": "congress", "event_id": null}'::jsonb, pg_temp.t(1724.96), '5a4e0000-0000-4000-8000-000000040011'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000251', '5a4e0000-0000-4000-8000-000000010104', '{"total_amount": 10000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(1528.60), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000252', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 42000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1214.91), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000253', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 37500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1081.70), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000254', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 40000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1546.65), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000255', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 11500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1606.92), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000256', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 38000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1719.38), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000260', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 24500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(601.44), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000261', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 30500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1340.02), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000262', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 36000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(452.04), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000263', '5a4e0000-0000-4000-8000-000000010058', '{"total_amount": 29000, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(2496.15), '5a4e0000-0000-4000-8000-000000040009'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000264', '5a4e0000-0000-4000-8000-000000010091', '{"total_amount": 41500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(3465.32), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000265', '5a4e0000-0000-4000-8000-000000010044', '{"total_amount": 52500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(3103.11), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000266', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 33000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1043.18), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000267', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 18500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1077.60), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000268', '5a4e0000-0000-4000-8000-000000010064', '{"total_amount": 12000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2132.68), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000269', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 37000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(229.39), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000271', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 31000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(815.17), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000272', '5a4e0000-0000-4000-8000-000000010062', '{"total_amount": 15000, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(717.52), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000275', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 33000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(484.33), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000276', '5a4e0000-0000-4000-8000-000000010104', '{"total_amount": 11500, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(3068.76), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000277', '5a4e0000-0000-4000-8000-000000010081', '{"total_amount": 26500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(126.18), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000278', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 43000, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(3164.25), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000279', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 12000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1365.96), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000280', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 38500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1602.49), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000282', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 38000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(299.94), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000284', '5a4e0000-0000-4000-8000-000000010120', '{"total_amount": 21000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(4039.94), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000285', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 21000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1301.40), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000286', '5a4e0000-0000-4000-8000-000000010025', '{"total_amount": 45000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2514.19), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000287', '5a4e0000-0000-4000-8000-000000010096', '{"total_amount": 9000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(4086.69), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000288', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 30500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(552.55), '5a4e0000-0000-4000-8000-000000040012'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000289', '5a4e0000-0000-4000-8000-000000010115', '{"total_amount": 39500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3511.46), '5a4e0000-0000-4000-8000-000000031006'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000290', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 54500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(41.87), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000291', '5a4e0000-0000-4000-8000-000000010049', '{"total_amount": 4500, "event_type": "congress", "event_id": null}'::jsonb, pg_temp.t(578.03), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000292', '5a4e0000-0000-4000-8000-000000010020', '{"total_amount": 22500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2024.53), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000294', '5a4e0000-0000-4000-8000-000000010049', '{"total_amount": 4500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(2404.54), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000297', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 56000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1747.09), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000298', '5a4e0000-0000-4000-8000-000000010058', '{"total_amount": 21000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(436.64), '5a4e0000-0000-4000-8000-000000040004'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000299', '5a4e0000-0000-4000-8000-000000010026', '{"total_amount": 34000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(3604.03), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000300', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 41500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(414.45), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000301', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 29000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(406.86), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000302', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 37000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1723.05), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000303', '5a4e0000-0000-4000-8000-000000010122', '{"total_amount": 8000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(546.00), '5a4e0000-0000-4000-8000-000000040001'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000304', '5a4e0000-0000-4000-8000-000000010058', '{"total_amount": 15000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2818.85), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000307', '5a4e0000-0000-4000-8000-000000010063', '{"total_amount": 83000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(464.08), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000308', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 30000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(127.60), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000309', '5a4e0000-0000-4000-8000-000000010029', '{"total_amount": 46000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(95.44), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000310', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 31000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(430.34), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000312', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 23500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(405.57), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000313', '5a4e0000-0000-4000-8000-000000010112', '{"total_amount": 53000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(2486.42), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000314', '5a4e0000-0000-4000-8000-000000010015', '{"total_amount": 10000, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(959.36), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000315', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 13000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3897.96), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000318', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 23500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(393.68), '5a4e0000-0000-4000-8000-000000040017'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000319', '5a4e0000-0000-4000-8000-000000010067', '{"total_amount": 8500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2993.83), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000320', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 12000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(562.73), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000321', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 44500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(325.62), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000322', '5a4e0000-0000-4000-8000-000000010005', '{"total_amount": 48000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3580.37), '5a4e0000-0000-4000-8000-000000030001'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000323', '5a4e0000-0000-4000-8000-000000010042', '{"total_amount": 50000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2053.30), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000324', '5a4e0000-0000-4000-8000-000000010006', '{"total_amount": 46500, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(2471.41), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000325', '5a4e0000-0000-4000-8000-000000010060', '{"total_amount": 20500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(891.56), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000326', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 37000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(293.83), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000328', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 40500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1565.22), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000329', '5a4e0000-0000-4000-8000-000000010001', '{"total_amount": 48500, "event_type": "baby_shower", "event_id": null}'::jsonb, pg_temp.t(2786.92), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000331', '5a4e0000-0000-4000-8000-000000010114', '{"total_amount": 33500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(567.46), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000332', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 64000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1577.30), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000333', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 15500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1535.34), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000335', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 22000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(148.81), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000336', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 24000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1672.95), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000337', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 44000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(233.71), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000338', '5a4e0000-0000-4000-8000-000000010053', '{"total_amount": 11500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(548.60), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000339', '5a4e0000-0000-4000-8000-000000010116', '{"total_amount": 42500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(991.26), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000340', '5a4e0000-0000-4000-8000-000000010020', '{"total_amount": 19500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(596.96), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000341', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 62000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1802.79), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000342', '5a4e0000-0000-4000-8000-000000010105', '{"total_amount": 11500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(3734.82), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000343', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 20000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1164.36), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000344', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 18500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(378.35), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000346', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 20500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1590.48), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000348', '5a4e0000-0000-4000-8000-000000010074', '{"total_amount": 10500, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(720.22), '5a4e0000-0000-4000-8000-000000040008')
) AS v(ad, tip, eid, prov, payload, ts, actor)
ON CONFLICT (event_name, entity_id) DO NOTHING;

-- C) teklif topla (quote_requests): kurum uyeleri ve musterilerden 1-2

INSERT INTO public.quote_requests (id, customer_id, category_id, city_id, brief_data, event_date, event_type, budget_min, budget_max, response_deadline, recipient_count, status, created_at, created_by)
VALUES
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000031008', pg_temp.kat('illuzyonist'), pg_temp.sehir('Muğla'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(73), 'birthday', 8000, 20000, pg_temp.t(519.55), 4, 'active', pg_temp.t(639.55), '5a4e0000-0000-4000-8000-000000031008'),
('5a4e0030-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000031004', pg_temp.kat('dansci'), pg_temp.sehir('İzmir'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(11), 'gala', 8000, 22500, pg_temp.t(722.61), 4, 'active', pg_temp.t(842.61), '5a4e0000-0000-4000-8000-000000031004'),
('5a4e0030-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000040008', pg_temp.kat('oyuncu'), pg_temp.sehir('İstanbul'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(14), 'other', 6000, 17500, pg_temp.t(96.69), 3, 'active', pg_temp.t(216.69), '5a4e0000-0000-4000-8000-000000040008'),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000040006', pg_temp.kat('konusmaci'), pg_temp.sehir('Bursa'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(56), 'conference', 15000, 45000, pg_temp.t(556.21), 4, 'active', pg_temp.t(676.21), '5a4e0000-0000-4000-8000-000000040006'),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000040012', pg_temp.kat('illuzyonist'), pg_temp.sehir('Bursa'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(11), 'corporate', 8000, 20000, pg_temp.t(650.10), 4, 'active', pg_temp.t(770.10), '5a4e0000-0000-4000-8000-000000040012'),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000040013', pg_temp.kat('canli-yayin'), pg_temp.sehir('İzmir'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(35), 'corporate', 12000, 35000, pg_temp.t(420.85), 4, 'active', pg_temp.t(540.85), '5a4e0000-0000-4000-8000-000000040013'),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000040018', pg_temp.kat('fotografci'), pg_temp.sehir('Antalya'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(78), 'engagement', 12000, 32500, pg_temp.t(-55.10), 4, 'active', pg_temp.t(64.90), '5a4e0000-0000-4000-8000-000000040018'),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000031007', pg_temp.kat('konusmaci'), pg_temp.sehir('Ankara'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(34), 'congress', 15000, 45000, pg_temp.t(680.38), 4, 'active', pg_temp.t(800.38), '5a4e0000-0000-4000-8000-000000031007'),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000031006', pg_temp.kat('videograf'), pg_temp.sehir('Antalya'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(57), 'engagement', 15000, 40000, pg_temp.t(668.30), 4, 'active', pg_temp.t(788.30), '5a4e0000-0000-4000-8000-000000031006'),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000040001', pg_temp.kat('muzisyen'), pg_temp.sehir('Ankara'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(31), 'concert', 10000, 35000, pg_temp.t(147.73), 4, 'active', pg_temp.t(267.73), '5a4e0000-0000-4000-8000-000000040001');

INSERT INTO public.quote_request_recipients (request_id, professional_id, status, created_at)
VALUES
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010079', 'sent', pg_temp.t(639.55)),
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010080', 'declined', pg_temp.t(639.55)),
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010081', 'declined', pg_temp.t(639.55)),
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010082', 'viewed', pg_temp.t(639.55)),
('5a4e0030-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000010053', 'declined', pg_temp.t(842.61)),
('5a4e0030-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000010055', 'sent', pg_temp.t(842.61)),
('5a4e0030-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000010056', 'sent', pg_temp.t(842.61)),
('5a4e0030-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000010058', 'sent', pg_temp.t(842.61)),
('5a4e0030-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000010070', 'viewed', pg_temp.t(216.69)),
('5a4e0030-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000010072', 'declined', pg_temp.t(216.69)),
('5a4e0030-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000010073', 'viewed', pg_temp.t(216.69)),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010107', 'viewed', pg_temp.t(676.21)),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010108', 'viewed', pg_temp.t(676.21)),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010109', 'declined', pg_temp.t(676.21)),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010110', 'viewed', pg_temp.t(676.21)),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010079', 'sent', pg_temp.t(770.10)),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010080', 'viewed', pg_temp.t(770.10)),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010081', 'declined', pg_temp.t(770.10)),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010082', 'sent', pg_temp.t(770.10)),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010111', 'sent', pg_temp.t(540.85)),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010112', 'viewed', pg_temp.t(540.85)),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010113', 'sent', pg_temp.t(540.85)),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010114', 'viewed', pg_temp.t(540.85)),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010001', 'sent', pg_temp.t(64.90)),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010002', 'sent', pg_temp.t(64.90)),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010003', 'sent', pg_temp.t(64.90)),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010004', 'viewed', pg_temp.t(64.90)),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010107', 'viewed', pg_temp.t(800.38)),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010108', 'sent', pg_temp.t(800.38)),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010109', 'sent', pg_temp.t(800.38)),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010110', 'declined', pg_temp.t(800.38)),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010028', 'sent', pg_temp.t(788.30)),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010029', 'declined', pg_temp.t(788.30)),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010030', 'viewed', pg_temp.t(788.30)),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010031', 'viewed', pg_temp.t(788.30)),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010020', 'sent', pg_temp.t(267.73)),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010021', 'declined', pg_temp.t(267.73)),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010022', 'sent', pg_temp.t(267.73)),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010023', 'declined', pg_temp.t(267.73));

-- D) ajans teklifleri: proposals/versions/items (kashe.faz7_rpc bayragi), gonderim, onay/red, FAZ 7c rezervasyon

DO $$
BEGIN
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  INSERT INTO public.proposals (id, seller_organization_id, seller_provider_id, buyer_user_id, buyer_organization_id, event_id, title, client_name, client_email, source_type, created_by, created_at, updated_at)
  VALUES
('5a4e0003-0000-4000-8000-000000000001', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, NULL, '5a4e0002-0000-4000-8000-000000000001', 'Ece Kına Gecesi — Çekim ve içerik', 'Eda Turan', 'eda-turan@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(3330.30), pg_temp.t(3330.30)),
('5a4e0003-0000-4000-8000-000000000002', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', '5a4e0000-0000-4000-8000-000000040009', NULL, '5a4e0002-0000-4000-8000-000000000002', 'Yasemin Doğum Günü Partisi — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(5077.13), pg_temp.t(5077.13)),
('5a4e0003-0000-4000-8000-000000000003', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', '5a4e0000-0000-4000-8000-000000040013', NULL, '5a4e0002-0000-4000-8000-000000000002', 'Yasemin Doğum Günü Partisi — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(5089.06), pg_temp.t(5089.06)),
('5a4e0003-0000-4000-8000-000000000004', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, NULL, '5a4e0002-0000-4000-8000-000000000003', 'Marmara Perakende Grubu Bayi Toplantısı — Tam kapsam teklifi', 'Selim Aydın', 'selim-aydin@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(1471.09), pg_temp.t(1471.09)),
('5a4e0003-0000-4000-8000-000000000005', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000003', 'Marmara Perakende Grubu Bayi Toplantısı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(1470.34), pg_temp.t(1470.34)),
('5a4e0003-0000-4000-8000-000000000006', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', '5a4e0000-0000-4000-8000-000000040016', NULL, '5a4e0002-0000-4000-8000-000000000004', 'Melis ve Yusuf Düğün Daveti — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(514.66), pg_temp.t(514.66)),
('5a4e0003-0000-4000-8000-000000000007', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030004'), '5a4e0002-0000-4000-8000-000000000005', 'Akdeniz Gıda Yeni Sezon Lansmanı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(4483.13), pg_temp.t(4483.13)),
('5a4e0003-0000-4000-8000-000000000008', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, NULL, '5a4e0002-0000-4000-8000-000000000006', 'Hazal & Eren Düğünü — Çekim ve içerik', 'Çağrı Erdem', 'cagri-erdem@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2856.41), pg_temp.t(2856.41)),
('5a4e0003-0000-4000-8000-000000000009', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, NULL, '5a4e0002-0000-4000-8000-000000000006', 'Hazal & Eren Düğünü — Çekim ve içerik', 'Beren Demir', 'beren-demir@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2877.34), pg_temp.t(2877.34)),
('5a4e0003-0000-4000-8000-000000000010', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, NULL, '5a4e0002-0000-4000-8000-000000000007', 'Mavi Deniz Turizm Fuar Standı — Teknik paket', 'Batuhan Sarı', 'batuhan-sari@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2106.79), pg_temp.t(2106.79)),
('5a4e0003-0000-4000-8000-000000000011', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000007', 'Mavi Deniz Turizm Fuar Standı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2093.42), pg_temp.t(2093.42)),
('5a4e0003-0000-4000-8000-000000000012', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000007', 'Mavi Deniz Turizm Fuar Standı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2109.70), pg_temp.t(2109.70)),
('5a4e0003-0000-4000-8000-000000000013', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000008', 'Boğaziçi Finans Yaz Konseri — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3589.07), pg_temp.t(3589.07)),
('5a4e0003-0000-4000-8000-000000000014', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030008'), '5a4e0002-0000-4000-8000-000000000009', 'Teknopark Yazılım A.Ş. Ürün Lansmanı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(212.89), pg_temp.t(212.89)),
('5a4e0003-0000-4000-8000-000000000015', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000009', 'Teknopark Yazılım A.Ş. Ürün Lansmanı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(216.64), pg_temp.t(216.64)),
('5a4e0003-0000-4000-8000-000000000016', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', '5a4e0000-0000-4000-8000-000000040002', NULL, '5a4e0002-0000-4000-8000-000000000010', 'Gül & Mert Düğünü — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(712.82), pg_temp.t(712.82)),
('5a4e0003-0000-4000-8000-000000000017', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', NULL, NULL, '5a4e0002-0000-4000-8000-000000000011', 'Selin ve Kaan Düğün Daveti — Teknik paket', 'Eda Acar', 'eda-acar@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(2964.46), pg_temp.t(2964.46)),
('5a4e0003-0000-4000-8000-000000000018', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', '5a4e0000-0000-4000-8000-000000040011', NULL, '5a4e0002-0000-4000-8000-000000000011', 'Selin ve Kaan Düğün Daveti — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(2933.75), pg_temp.t(2933.75)),
('5a4e0003-0000-4000-8000-000000000019', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', '5a4e0000-0000-4000-8000-000000040010', NULL, '5a4e0002-0000-4000-8000-000000000012', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(1598.62), pg_temp.t(1598.62)),
('5a4e0003-0000-4000-8000-000000000020', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000012', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(1601.59), pg_temp.t(1601.59)),
('5a4e0003-0000-4000-8000-000000000021', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030008'), '5a4e0002-0000-4000-8000-000000000012', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(1570.92), pg_temp.t(1570.92)),
('5a4e0003-0000-4000-8000-000000000022', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000013', 'Boğaziçi Finans Bayi Toplantısı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(901.79), pg_temp.t(901.79)),
('5a4e0003-0000-4000-8000-000000000023', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', '5a4e0000-0000-4000-8000-000000040016', NULL, '5a4e0002-0000-4000-8000-000000000014', 'Yasemin & Alp Nişanı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1081.25), pg_temp.t(1081.25)),
('5a4e0003-0000-4000-8000-000000000024', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', '5a4e0000-0000-4000-8000-000000040014', NULL, '5a4e0002-0000-4000-8000-000000000014', 'Yasemin & Alp Nişanı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1073.04), pg_temp.t(1073.04)),
('5a4e0003-0000-4000-8000-000000000025', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', NULL, NULL, '5a4e0002-0000-4000-8000-000000000015', 'Eda ve Volkan Düğün Daveti — Tam kapsam teklifi', 'Şebnem Kara', 'sebnem-kara@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(236.36), pg_temp.t(236.36)),
('5a4e0003-0000-4000-8000-000000000026', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', '5a4e0000-0000-4000-8000-000000040014', NULL, '5a4e0002-0000-4000-8000-000000000016', 'İrem ve Levent Düğün Daveti — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(2168.29), pg_temp.t(2168.29)),
('5a4e0003-0000-4000-8000-000000000027', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', '5a4e0000-0000-4000-8000-000000040005', NULL, '5a4e0002-0000-4000-8000-000000000016', 'İrem ve Levent Düğün Daveti — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(2165.45), pg_temp.t(2165.45)),
('5a4e0003-0000-4000-8000-000000000028', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', '5a4e0000-0000-4000-8000-000000040011', NULL, '5a4e0002-0000-4000-8000-000000000017', 'Fulya ve Tolga Düğün Daveti — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(1400.55), pg_temp.t(1400.55)),
('5a4e0003-0000-4000-8000-000000000029', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', '5a4e0000-0000-4000-8000-000000040019', NULL, '5a4e0002-0000-4000-8000-000000000018', 'Leyla ve Halil Düğün Daveti — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3037.27), pg_temp.t(3037.27)),
('5a4e0003-0000-4000-8000-000000000030', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', NULL, NULL, '5a4e0002-0000-4000-8000-000000000019', 'Sevgi ve Burak Düğün Daveti — Sahne ve müzik', 'Selim Çakır', 'selim-cakir@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3802.73), pg_temp.t(3802.73)),
('5a4e0003-0000-4000-8000-000000000031', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', NULL, NULL, '5a4e0002-0000-4000-8000-000000000019', 'Sevgi ve Burak Düğün Daveti — Çekim ve içerik', 'Berk Sezer', 'berk-sezer@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3779.91), pg_temp.t(3779.91)),
('5a4e0003-0000-4000-8000-000000000032', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', '5a4e0000-0000-4000-8000-000000040020', NULL, '5a4e0002-0000-4000-8000-000000000019', 'Sevgi ve Burak Düğün Daveti — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3793.76), pg_temp.t(3793.76)),
('5a4e0003-0000-4000-8000-000000000033', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, NULL, '5a4e0002-0000-4000-8000-000000000020', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Tam kapsam teklifi', 'Yasemin Erdoğan', 'yasemin-erdogan@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(745.95), pg_temp.t(745.95)),
('5a4e0003-0000-4000-8000-000000000034', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000020', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(782.49), pg_temp.t(782.49)),
('5a4e0003-0000-4000-8000-000000000035', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000020', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(756.91), pg_temp.t(756.91)),
('5a4e0003-0000-4000-8000-000000000036', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, NULL, '5a4e0002-0000-4000-8000-000000000021', 'Ayşe & Koray Düğünü — Organizasyon teklifi', 'Levent Avcı', 'levent-avci@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(224.72), pg_temp.t(224.72)),
('5a4e0003-0000-4000-8000-000000000037', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, NULL, '5a4e0002-0000-4000-8000-000000000021', 'Ayşe & Koray Düğünü — Teknik paket', 'Emre Kılıç', 'emre-kilic@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(198.88), pg_temp.t(198.88)),
('5a4e0003-0000-4000-8000-000000000038', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000022', 'Marmara Perakende Grubu Teknoloji Konferansı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(3475.73), pg_temp.t(3475.73)),
('5a4e0003-0000-4000-8000-000000000039', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000023', 'Teknopark Yazılım A.Ş. Gala Yemeği — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(1411.31), pg_temp.t(1411.31)),
('5a4e0003-0000-4000-8000-000000000040', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, NULL, '5a4e0002-0000-4000-8000-000000000024', 'Tuğçe ve Fatih Düğün Daveti — Organizasyon teklifi', 'Halil Avcı', 'halil-avci@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3193.80), pg_temp.t(3193.80)),
('5a4e0003-0000-4000-8000-000000000041', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', '5a4e0000-0000-4000-8000-000000040005', NULL, '5a4e0002-0000-4000-8000-000000000024', 'Tuğçe ve Fatih Düğün Daveti — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3236.16), pg_temp.t(3236.16)),
('5a4e0003-0000-4000-8000-000000000042', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', '5a4e0000-0000-4000-8000-000000040012', NULL, '5a4e0002-0000-4000-8000-000000000025', 'Mavi Deniz Turizm Şirket Pikniği — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5734.62), pg_temp.t(5734.62)),
('5a4e0003-0000-4000-8000-000000000043', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000025', 'Mavi Deniz Turizm Şirket Pikniği — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5725.48), pg_temp.t(5725.48)),
('5a4e0003-0000-4000-8000-000000000044', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, NULL, '5a4e0002-0000-4000-8000-000000000026', 'Başkent Eğitim Kurumları Bayi Toplantısı — Çekim ve içerik', 'Uğur Erol', 'ugur-erol@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3868.04), pg_temp.t(3868.04)),
('5a4e0003-0000-4000-8000-000000000045', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', '5a4e0000-0000-4000-8000-000000040007', NULL, '5a4e0002-0000-4000-8000-000000000026', 'Başkent Eğitim Kurumları Bayi Toplantısı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3900.32), pg_temp.t(3900.32)),
('5a4e0003-0000-4000-8000-000000000046', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, NULL, '5a4e0002-0000-4000-8000-000000000027', 'Gizem Kına Gecesi — Tam kapsam teklifi', 'Ozan Yıldız', 'ozan-yildiz@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(2561.35), pg_temp.t(2561.35)),
('5a4e0003-0000-4000-8000-000000000047', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', '5a4e0000-0000-4000-8000-000000040001', NULL, '5a4e0002-0000-4000-8000-000000000027', 'Gizem Kına Gecesi — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(2562.02), pg_temp.t(2562.02)),
('5a4e0003-0000-4000-8000-000000000048', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, NULL, '5a4e0002-0000-4000-8000-000000000028', 'Boğaziçi Finans Ürün Lansmanı — Tam kapsam teklifi', 'Enes Koç', 'enes-koc@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4179.74), pg_temp.t(4179.74)),
('5a4e0003-0000-4000-8000-000000000049', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', '5a4e0000-0000-4000-8000-000000040005', NULL, '5a4e0002-0000-4000-8000-000000000029', 'Ege Otomotiv Fuar Katılımı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4712.63), pg_temp.t(4712.63)),
('5a4e0003-0000-4000-8000-000000000050', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000030', 'Marmara Perakende Grubu Fuar Katılımı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4503.39), pg_temp.t(4503.39)),
('5a4e0003-0000-4000-8000-000000000051', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000031', 'Boğaziçi Finans Fuar Standı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(236.68), pg_temp.t(236.68)),
('5a4e0003-0000-4000-8000-000000000052', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000032', 'Başkent Eğitim Kurumları Çalışan Buluşması — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(200.31), pg_temp.t(200.31)),
('5a4e0003-0000-4000-8000-000000000053', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000032', 'Başkent Eğitim Kurumları Çalışan Buluşması — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(193.10), pg_temp.t(193.10)),
('5a4e0003-0000-4000-8000-000000000054', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000032', 'Başkent Eğitim Kurumları Çalışan Buluşması — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(213.21), pg_temp.t(213.21)),
('5a4e0003-0000-4000-8000-000000000055', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', '5a4e0000-0000-4000-8000-000000040010', NULL, '5a4e0002-0000-4000-8000-000000000033', 'Teknopark Yazılım A.Ş. Ödül Gecesi — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3059.27), pg_temp.t(3059.27)),
('5a4e0003-0000-4000-8000-000000000056', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030008'), '5a4e0002-0000-4000-8000-000000000033', 'Teknopark Yazılım A.Ş. Ödül Gecesi — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3065.46), pg_temp.t(3065.46)),
('5a4e0003-0000-4000-8000-000000000057', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000033', 'Teknopark Yazılım A.Ş. Ödül Gecesi — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3069.23), pg_temp.t(3069.23)),
('5a4e0003-0000-4000-8000-000000000058', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, NULL, '5a4e0002-0000-4000-8000-000000000034', 'Anadolu İlaç Fuar Standı — Teknik paket', 'Esra Erdem', 'esra-erdem@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(2790.87), pg_temp.t(2790.87)),
('5a4e0003-0000-4000-8000-000000000059', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030008'), '5a4e0002-0000-4000-8000-000000000035', 'Teknopark Yazılım A.Ş. Bayi Toplantısı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(994.00), pg_temp.t(994.00)),
('5a4e0003-0000-4000-8000-000000000060', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000035', 'Teknopark Yazılım A.Ş. Bayi Toplantısı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(996.04), pg_temp.t(996.04)),
('5a4e0003-0000-4000-8000-000000000061', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', '5a4e0000-0000-4000-8000-000000040011', NULL, '5a4e0002-0000-4000-8000-000000000035', 'Teknopark Yazılım A.Ş. Bayi Toplantısı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1009.29), pg_temp.t(1009.29)),
('5a4e0003-0000-4000-8000-000000000062', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', '5a4e0000-0000-4000-8000-000000040013', NULL, '5a4e0002-0000-4000-8000-000000000036', 'Anadolu İlaç Liderlik Zirvesi — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3706.91), pg_temp.t(3706.91)),
('5a4e0003-0000-4000-8000-000000000063', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000037', 'Ege Otomotiv Şirket Pikniği — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1459.39), pg_temp.t(1459.39)),
('5a4e0003-0000-4000-8000-000000000064', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000038', 'Boğaziçi Finans Yeni Sezon Lansmanı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(200.38), pg_temp.t(200.38)),
('5a4e0003-0000-4000-8000-000000000065', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000038', 'Boğaziçi Finans Yeni Sezon Lansmanı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(227.47), pg_temp.t(227.47)),
('5a4e0003-0000-4000-8000-000000000066', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', '5a4e0000-0000-4000-8000-000000040016', NULL, '5a4e0002-0000-4000-8000-000000000038', 'Boğaziçi Finans Yeni Sezon Lansmanı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(199.37), pg_temp.t(199.37)),
('5a4e0003-0000-4000-8000-000000000067', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000039', 'Başkent Eğitim Kurumları Yeni Sezon Lansmanı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(1797.33), pg_temp.t(1797.33)),
('5a4e0003-0000-4000-8000-000000000068', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000040', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(3645.10), pg_temp.t(3645.10)),
('5a4e0003-0000-4000-8000-000000000069', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, NULL, '5a4e0002-0000-4000-8000-000000000041', 'Marmara Perakende Grubu Yıl Sonu Partisi — Tam kapsam teklifi', 'Utku Özkan', 'utku-ozkan@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(206.87), pg_temp.t(206.87)),
('5a4e0003-0000-4000-8000-000000000070', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000041', 'Marmara Perakende Grubu Yıl Sonu Partisi — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(216.80), pg_temp.t(216.80)),
('5a4e0003-0000-4000-8000-000000000071', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', '5a4e0000-0000-4000-8000-000000040011', NULL, '5a4e0002-0000-4000-8000-000000000041', 'Marmara Perakende Grubu Yıl Sonu Partisi — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(197.75), pg_temp.t(197.75)),
('5a4e0003-0000-4000-8000-000000000072', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030008'), '5a4e0002-0000-4000-8000-000000000042', 'Akdeniz Gıda Fuar Katılımı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(3422.77), pg_temp.t(3422.77)),
('5a4e0003-0000-4000-8000-000000000073', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', NULL, NULL, '5a4e0002-0000-4000-8000-000000000043', 'Selin ve Umut Düğün Daveti — Çekim ve içerik', 'Hakan Şahin', 'hakan-sahin@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(3522.62), pg_temp.t(3522.62)),
('5a4e0003-0000-4000-8000-000000000074', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', NULL, NULL, '5a4e0002-0000-4000-8000-000000000044', 'Melike & Utku Düğünü — Teknik paket', 'Furkan Çetin', 'furkan-cetin@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1428.47), pg_temp.t(1428.47)),
('5a4e0003-0000-4000-8000-000000000075', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', '5a4e0000-0000-4000-8000-000000040020', NULL, '5a4e0002-0000-4000-8000-000000000044', 'Melike & Utku Düğünü — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1421.40), pg_temp.t(1421.40)),
('5a4e0003-0000-4000-8000-000000000076', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', NULL, NULL, '5a4e0002-0000-4000-8000-000000000044', 'Melike & Utku Düğünü — Çekim ve içerik', 'Nur Kaya', 'nur-kaya@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1431.88), pg_temp.t(1431.88)),
('5a4e0003-0000-4000-8000-000000000077', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', NULL, NULL, '5a4e0002-0000-4000-8000-000000000045', 'Seda ve Alp Düğün Daveti — Çekim ve içerik', 'Gamze Duman', 'gamze-duman@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(482.71), pg_temp.t(482.71)),
('5a4e0003-0000-4000-8000-000000000078', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', '5a4e0000-0000-4000-8000-000000040005', NULL, '5a4e0002-0000-4000-8000-000000000045', 'Seda ve Alp Düğün Daveti — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(488.75), pg_temp.t(488.75)),
('5a4e0003-0000-4000-8000-000000000079', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', '5a4e0000-0000-4000-8000-000000040011', NULL, '5a4e0002-0000-4000-8000-000000000045', 'Seda ve Alp Düğün Daveti — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(485.07), pg_temp.t(485.07)),
('5a4e0003-0000-4000-8000-000000000080', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', '5a4e0000-0000-4000-8000-000000040011', NULL, '5a4e0002-0000-4000-8000-000000000046', 'Marmara Perakende Grubu Ürün Lansmanı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3051.03), pg_temp.t(3051.03)),
('5a4e0003-0000-4000-8000-000000000081', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000047', 'Anadolu İlaç Yeni Sezon Lansmanı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(237.92), pg_temp.t(237.92)),
('5a4e0003-0000-4000-8000-000000000082', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000048', 'Başkent Eğitim Kurumları Liderlik Zirvesi — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3904.69), pg_temp.t(3904.69)),
('5a4e0003-0000-4000-8000-000000000083', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000048', 'Başkent Eğitim Kurumları Liderlik Zirvesi — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3901.66), pg_temp.t(3901.66)),
('5a4e0003-0000-4000-8000-000000000084', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, NULL, '5a4e0002-0000-4000-8000-000000000048', 'Başkent Eğitim Kurumları Liderlik Zirvesi — Tam kapsam teklifi', 'Berk Ateş', 'berk-ates@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3912.69), pg_temp.t(3912.69)),
('5a4e0003-0000-4000-8000-000000000085', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000049', 'Ege Otomotiv Şirket Pikniği — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2136.39), pg_temp.t(2136.39)),
('5a4e0003-0000-4000-8000-000000000086', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', '5a4e0000-0000-4000-8000-000000040004', NULL, '5a4e0002-0000-4000-8000-000000000049', 'Ege Otomotiv Şirket Pikniği — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2157.42), pg_temp.t(2157.42)),
('5a4e0003-0000-4000-8000-000000000087', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000049', 'Ege Otomotiv Şirket Pikniği — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2137.85), pg_temp.t(2137.85)),
('5a4e0003-0000-4000-8000-000000000088', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', '5a4e0000-0000-4000-8000-000000040012', NULL, '5a4e0002-0000-4000-8000-000000000050', 'Ege Otomotiv Liderlik Zirvesi — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2742.76), pg_temp.t(2742.76)),
('5a4e0003-0000-4000-8000-000000000089', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000050', 'Ege Otomotiv Liderlik Zirvesi — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2734.67), pg_temp.t(2734.67));
  INSERT INTO public.proposal_versions (id, proposal_id, version_no, tax_rate, notes, valid_until, created_by, created_at, updated_at)
  VALUES
('5a4e0004-0000-4000-8000-000000000001', '5a4e0003-0000-4000-8000-000000000001', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2948.55), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(3330.30), pg_temp.t(3330.30)),
('5a4e0004-0000-4000-8000-000000000002', '5a4e0003-0000-4000-8000-000000000002', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(4697.46), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(5077.13), pg_temp.t(5077.13)),
('5a4e0004-0000-4000-8000-000000000003', '5a4e0003-0000-4000-8000-000000000003', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(4692.59), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(5089.06), pg_temp.t(5089.06)),
('5a4e0004-0000-4000-8000-000000000004', '5a4e0003-0000-4000-8000-000000000004', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1074.06), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(1471.09), pg_temp.t(1471.09)),
('5a4e0004-0000-4000-8000-000000000005', '5a4e0003-0000-4000-8000-000000000005', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1088.21), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(1470.34), pg_temp.t(1470.34)),
('5a4e0004-0000-4000-8000-000000000006', '5a4e0003-0000-4000-8000-000000000006', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(123.23), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(514.66), pg_temp.t(514.66)),
('5a4e0004-0000-4000-8000-000000000007', '5a4e0003-0000-4000-8000-000000000007', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(4138.96), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(4483.13), pg_temp.t(4483.13)),
('5a4e0004-0000-4000-8000-000000000008', '5a4e0003-0000-4000-8000-000000000008', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2510.84), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2856.41), pg_temp.t(2856.41)),
('5a4e0004-0000-4000-8000-000000000009', '5a4e0003-0000-4000-8000-000000000009', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2489.61), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2877.34), pg_temp.t(2877.34)),
('5a4e0004-0000-4000-8000-000000000010', '5a4e0003-0000-4000-8000-000000000010', 1, 0.20, NULL, pg_temp.t(1740.26), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2106.79), pg_temp.t(2106.79)),
('5a4e0004-0000-4000-8000-000000000011', '5a4e0003-0000-4000-8000-000000000011', 1, 0.20, NULL, pg_temp.t(1705.32), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2093.42), pg_temp.t(2093.42)),
('5a4e0004-0000-4000-8000-000000000012', '5a4e0003-0000-4000-8000-000000000012', 1, 0.20, NULL, pg_temp.t(1746.63), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2109.70), pg_temp.t(2109.70)),
('5a4e0004-0000-4000-8000-000000000013', '5a4e0003-0000-4000-8000-000000000013', 1, 0.20, NULL, pg_temp.t(3241.33), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3589.07), pg_temp.t(3589.07)),
('5a4e0004-0000-4000-8000-000000000014', '5a4e0003-0000-4000-8000-000000000014', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(-150.47), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(212.89), pg_temp.t(212.89)),
('5a4e0004-0000-4000-8000-000000000015', '5a4e0003-0000-4000-8000-000000000015', 1, 0.20, NULL, pg_temp.t(-161.77), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(216.64), pg_temp.t(216.64)),
('5a4e0004-0000-4000-8000-000000000016', '5a4e0003-0000-4000-8000-000000000016', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(309.83), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(712.82), pg_temp.t(712.82)),
('5a4e0004-0000-4000-8000-000000000017', '5a4e0003-0000-4000-8000-000000000017', 1, 0.20, NULL, pg_temp.t(2583.36), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(2964.46), pg_temp.t(2964.46)),
('5a4e0004-0000-4000-8000-000000000018', '5a4e0003-0000-4000-8000-000000000018', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2545.10), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(2933.75), pg_temp.t(2933.75)),
('5a4e0004-0000-4000-8000-000000000019', '5a4e0003-0000-4000-8000-000000000019', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1251.95), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(1598.62), pg_temp.t(1598.62)),
('5a4e0004-0000-4000-8000-000000000020', '5a4e0003-0000-4000-8000-000000000020', 1, 0.20, NULL, pg_temp.t(1228.26), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(1601.59), pg_temp.t(1601.59)),
('5a4e0004-0000-4000-8000-000000000021', '5a4e0003-0000-4000-8000-000000000021', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1175.90), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(1570.92), pg_temp.t(1570.92)),
('5a4e0004-0000-4000-8000-000000000022', '5a4e0003-0000-4000-8000-000000000022', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(496.05), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(901.79), pg_temp.t(901.79)),
('5a4e0004-0000-4000-8000-000000000023', '5a4e0003-0000-4000-8000-000000000023', 1, 0.20, NULL, pg_temp.t(684.50), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1081.25), pg_temp.t(1081.25)),
('5a4e0004-0000-4000-8000-000000000024', '5a4e0003-0000-4000-8000-000000000024', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(695.41), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1073.04), pg_temp.t(1073.04)),
('5a4e0004-0000-4000-8000-000000000025', '5a4e0003-0000-4000-8000-000000000025', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(-130.90), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(236.36), pg_temp.t(236.36)),
('5a4e0004-0000-4000-8000-000000000026', '5a4e0003-0000-4000-8000-000000000026', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1797.49), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(2168.29), pg_temp.t(2168.29)),
('5a4e0004-0000-4000-8000-000000000027', '5a4e0003-0000-4000-8000-000000000027', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1811.22), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(2165.45), pg_temp.t(2165.45)),
('5a4e0004-0000-4000-8000-000000000028', '5a4e0003-0000-4000-8000-000000000028', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1033.15), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(1400.55), pg_temp.t(1400.55)),
('5a4e0004-0000-4000-8000-000000000029', '5a4e0003-0000-4000-8000-000000000029', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2697.11), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3037.27), pg_temp.t(3037.27)),
('5a4e0004-0000-4000-8000-000000000030', '5a4e0003-0000-4000-8000-000000000030', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3423.73), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3802.73), pg_temp.t(3802.73)),
('5a4e0004-0000-4000-8000-000000000031', '5a4e0003-0000-4000-8000-000000000031', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(3389.90), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3779.91), pg_temp.t(3779.91)),
('5a4e0004-0000-4000-8000-000000000032', '5a4e0003-0000-4000-8000-000000000032', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3387.09), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3793.76), pg_temp.t(3793.76)),
('5a4e0004-0000-4000-8000-000000000033', '5a4e0003-0000-4000-8000-000000000033', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(348.83), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(745.95), pg_temp.t(745.95)),
('5a4e0004-0000-4000-8000-000000000034', '5a4e0003-0000-4000-8000-000000000034', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(383.13), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(782.49), pg_temp.t(782.49)),
('5a4e0004-0000-4000-8000-000000000035', '5a4e0003-0000-4000-8000-000000000035', 1, 0.20, NULL, pg_temp.t(373.64), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(756.91), pg_temp.t(756.91)),
('5a4e0004-0000-4000-8000-000000000036', '5a4e0003-0000-4000-8000-000000000036', 1, 0.20, NULL, pg_temp.t(-114.08), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(224.72), pg_temp.t(224.72)),
('5a4e0004-0000-4000-8000-000000000037', '5a4e0003-0000-4000-8000-000000000037', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(-160.67), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(198.88), pg_temp.t(198.88)),
('5a4e0004-0000-4000-8000-000000000038', '5a4e0003-0000-4000-8000-000000000038', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3111.00), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(3475.73), pg_temp.t(3475.73)),
('5a4e0004-0000-4000-8000-000000000039', '5a4e0003-0000-4000-8000-000000000039', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1008.17), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(1411.31), pg_temp.t(1411.31)),
('5a4e0004-0000-4000-8000-000000000040', '5a4e0003-0000-4000-8000-000000000040', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2830.73), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3193.80), pg_temp.t(3193.80)),
('5a4e0004-0000-4000-8000-000000000041', '5a4e0003-0000-4000-8000-000000000041', 1, 0.20, NULL, pg_temp.t(2863.53), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3236.16), pg_temp.t(3236.16)),
('5a4e0004-0000-4000-8000-000000000042', '5a4e0003-0000-4000-8000-000000000042', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(5394.33), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5734.62), pg_temp.t(5734.62)),
('5a4e0004-0000-4000-8000-000000000043', '5a4e0003-0000-4000-8000-000000000043', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(5371.35), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5725.48), pg_temp.t(5725.48)),
('5a4e0004-0000-4000-8000-000000000044', '5a4e0003-0000-4000-8000-000000000044', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3519.59), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3868.04), pg_temp.t(3868.04)),
('5a4e0004-0000-4000-8000-000000000045', '5a4e0003-0000-4000-8000-000000000045', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3517.01), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3900.32), pg_temp.t(3900.32)),
('5a4e0004-0000-4000-8000-000000000046', '5a4e0003-0000-4000-8000-000000000046', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2160.04), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(2561.35), pg_temp.t(2561.35)),
('5a4e0004-0000-4000-8000-000000000047', '5a4e0003-0000-4000-8000-000000000047', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2180.39), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(2562.02), pg_temp.t(2562.02)),
('5a4e0004-0000-4000-8000-000000000048', '5a4e0003-0000-4000-8000-000000000048', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(3782.80), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4179.74), pg_temp.t(4179.74)),
('5a4e0004-0000-4000-8000-000000000049', '5a4e0003-0000-4000-8000-000000000049', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(4349.78), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4712.63), pg_temp.t(4712.63)),
('5a4e0004-0000-4000-8000-000000000050', '5a4e0003-0000-4000-8000-000000000050', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(4106.00), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4503.39), pg_temp.t(4503.39)),
('5a4e0004-0000-4000-8000-000000000051', '5a4e0003-0000-4000-8000-000000000051', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(-166.75), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(236.68), pg_temp.t(236.68)),
('5a4e0004-0000-4000-8000-000000000052', '5a4e0003-0000-4000-8000-000000000052', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(-179.97), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(200.31), pg_temp.t(200.31)),
('5a4e0004-0000-4000-8000-000000000053', '5a4e0003-0000-4000-8000-000000000053', 1, 0.20, NULL, pg_temp.t(-170.94), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(193.10), pg_temp.t(193.10)),
('5a4e0004-0000-4000-8000-000000000054', '5a4e0003-0000-4000-8000-000000000054', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(-182.23), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(213.21), pg_temp.t(213.21)),
('5a4e0004-0000-4000-8000-000000000055', '5a4e0003-0000-4000-8000-000000000055', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2653.32), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3059.27), pg_temp.t(3059.27)),
('5a4e0004-0000-4000-8000-000000000056', '5a4e0003-0000-4000-8000-000000000056', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2700.09), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3065.46), pg_temp.t(3065.46)),
('5a4e0004-0000-4000-8000-000000000057', '5a4e0003-0000-4000-8000-000000000057', 1, 0.20, NULL, pg_temp.t(2714.24), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3069.23), pg_temp.t(3069.23)),
('5a4e0004-0000-4000-8000-000000000058', '5a4e0003-0000-4000-8000-000000000058', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2397.30), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(2790.87), pg_temp.t(2790.87)),
('5a4e0004-0000-4000-8000-000000000059', '5a4e0003-0000-4000-8000-000000000059', 1, 0.20, NULL, pg_temp.t(592.14), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(994.00), pg_temp.t(994.00)),
('5a4e0004-0000-4000-8000-000000000060', '5a4e0003-0000-4000-8000-000000000060', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(656.90), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(996.04), pg_temp.t(996.04)),
('5a4e0004-0000-4000-8000-000000000061', '5a4e0003-0000-4000-8000-000000000061', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(667.05), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1009.29), pg_temp.t(1009.29)),
('5a4e0004-0000-4000-8000-000000000062', '5a4e0003-0000-4000-8000-000000000062', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3309.27), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3706.91), pg_temp.t(3706.91)),
('5a4e0004-0000-4000-8000-000000000063', '5a4e0003-0000-4000-8000-000000000063', 1, 0.20, NULL, pg_temp.t(1108.60), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1459.39), pg_temp.t(1459.39)),
('5a4e0004-0000-4000-8000-000000000064', '5a4e0003-0000-4000-8000-000000000064', 1, 0.20, NULL, pg_temp.t(-184.79), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(200.38), pg_temp.t(200.38)),
('5a4e0004-0000-4000-8000-000000000065', '5a4e0003-0000-4000-8000-000000000065', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(-131.14), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(227.47), pg_temp.t(227.47)),
('5a4e0004-0000-4000-8000-000000000066', '5a4e0003-0000-4000-8000-000000000066', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(-195.01), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(199.37), pg_temp.t(199.37)),
('5a4e0004-0000-4000-8000-000000000067', '5a4e0003-0000-4000-8000-000000000067', 1, 0.20, NULL, pg_temp.t(1391.72), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(1797.33), pg_temp.t(1797.33)),
('5a4e0004-0000-4000-8000-000000000068', '5a4e0003-0000-4000-8000-000000000068', 1, 0.20, NULL, pg_temp.t(3251.99), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(3645.10), pg_temp.t(3645.10)),
('5a4e0004-0000-4000-8000-000000000069', '5a4e0003-0000-4000-8000-000000000069', 1, 0.20, NULL, pg_temp.t(-166.64), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(206.87), pg_temp.t(206.87)),
('5a4e0004-0000-4000-8000-000000000070', '5a4e0003-0000-4000-8000-000000000070', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-160.85), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(216.80), pg_temp.t(216.80)),
('5a4e0004-0000-4000-8000-000000000071', '5a4e0003-0000-4000-8000-000000000071', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-183.26), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(197.75), pg_temp.t(197.75)),
('5a4e0004-0000-4000-8000-000000000072', '5a4e0003-0000-4000-8000-000000000072', 1, 0.20, NULL, pg_temp.t(3032.94), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(3422.77), pg_temp.t(3422.77)),
('5a4e0004-0000-4000-8000-000000000073', '5a4e0003-0000-4000-8000-000000000073', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3148.79), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(3522.62), pg_temp.t(3522.62)),
('5a4e0004-0000-4000-8000-000000000074', '5a4e0003-0000-4000-8000-000000000074', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1045.75), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1428.47), pg_temp.t(1428.47)),
('5a4e0004-0000-4000-8000-000000000075', '5a4e0003-0000-4000-8000-000000000075', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1018.70), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1421.40), pg_temp.t(1421.40)),
('5a4e0004-0000-4000-8000-000000000076', '5a4e0003-0000-4000-8000-000000000076', 1, 0.20, NULL, pg_temp.t(1077.81), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1431.88), pg_temp.t(1431.88)),
('5a4e0004-0000-4000-8000-000000000077', '5a4e0003-0000-4000-8000-000000000077', 1, 0.20, NULL, pg_temp.t(109.14), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(482.71), pg_temp.t(482.71)),
('5a4e0004-0000-4000-8000-000000000078', '5a4e0003-0000-4000-8000-000000000078', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(134.73), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(488.75), pg_temp.t(488.75)),
('5a4e0004-0000-4000-8000-000000000079', '5a4e0003-0000-4000-8000-000000000079', 1, 0.20, NULL, pg_temp.t(146.14), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(485.07), pg_temp.t(485.07)),
('5a4e0004-0000-4000-8000-000000000080', '5a4e0003-0000-4000-8000-000000000080', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2653.68), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3051.03), pg_temp.t(3051.03)),
('5a4e0004-0000-4000-8000-000000000081', '5a4e0003-0000-4000-8000-000000000081', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-105.11), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(237.92), pg_temp.t(237.92)),
('5a4e0004-0000-4000-8000-000000000082', '5a4e0003-0000-4000-8000-000000000082', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3555.28), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3904.69), pg_temp.t(3904.69)),
('5a4e0004-0000-4000-8000-000000000083', '5a4e0003-0000-4000-8000-000000000083', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3548.79), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3901.66), pg_temp.t(3901.66)),
('5a4e0004-0000-4000-8000-000000000084', '5a4e0003-0000-4000-8000-000000000084', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(3555.15), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3912.69), pg_temp.t(3912.69)),
('5a4e0004-0000-4000-8000-000000000085', '5a4e0003-0000-4000-8000-000000000085', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1774.36), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2136.39), pg_temp.t(2136.39)),
('5a4e0004-0000-4000-8000-000000000086', '5a4e0003-0000-4000-8000-000000000086', 1, 0.20, NULL, pg_temp.t(1799.03), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2157.42), pg_temp.t(2157.42)),
('5a4e0004-0000-4000-8000-000000000087', '5a4e0003-0000-4000-8000-000000000087', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1739.36), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2137.85), pg_temp.t(2137.85)),
('5a4e0004-0000-4000-8000-000000000088', '5a4e0003-0000-4000-8000-000000000088', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2399.50), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2742.76), pg_temp.t(2742.76)),
('5a4e0004-0000-4000-8000-000000000089', '5a4e0003-0000-4000-8000-000000000089', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2365.09), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2734.67), pg_temp.t(2734.67));
  UPDATE public.proposals p SET current_version_id = v.id FROM public.proposal_versions v WHERE v.proposal_id = p.id AND p.id::text LIKE '5a4e0003-%';
  INSERT INTO public.proposal_items (id, proposal_version_id, role_id, description, quantity, unit_client_price, is_visible_to_client, sort_order)
  VALUES
('5a4e0005-0000-4000-8000-000000000001', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('hostes'), 'Hostes (kına gecesi)', 1, 3000, false, 0),
('5a4e0005-0000-4000-8000-000000000002', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('akrobat'), 'Akrobat (kına gecesi)', 1, 14500, true, 1),
('5a4e0005-0000-4000-8000-000000000003', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('videograf'), 'Videograf (kına gecesi)', 1, 36500, true, 2),
('5a4e0005-0000-4000-8000-000000000004', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('sunucu'), 'Sunucu (kına gecesi)', 2, 25500, true, 3),
('5a4e0005-0000-4000-8000-000000000005', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('fotografci'), 'Fotoğrafçı (kına gecesi)', 1, 18000, true, 4),
('5a4e0005-0000-4000-8000-000000000006', '5a4e0004-0000-4000-8000-000000000002', pg_temp.rol('canli-yayin'), 'Canlı Yayın (doğum günü)', 1, 35500, false, 0),
('5a4e0005-0000-4000-8000-000000000007', '5a4e0004-0000-4000-8000-000000000002', pg_temp.rol('akrobat'), 'Akrobat (doğum günü)', 1, 27000, false, 1),
('5a4e0005-0000-4000-8000-000000000008', '5a4e0004-0000-4000-8000-000000000002', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (doğum günü)', 1, 8500, true, 2),
('5a4e0005-0000-4000-8000-000000000009', '5a4e0004-0000-4000-8000-000000000002', pg_temp.rol('videograf'), 'Videograf (doğum günü)', 1, 39500, true, 3),
('5a4e0005-0000-4000-8000-000000000010', '5a4e0004-0000-4000-8000-000000000003', pg_temp.rol('canli-yayin'), 'Canlı Yayın (doğum günü)', 1, 38500, true, 0),
('5a4e0005-0000-4000-8000-000000000011', '5a4e0004-0000-4000-8000-000000000003', pg_temp.rol('akrobat'), 'Akrobat (doğum günü)', 1, 25000, true, 1),
('5a4e0005-0000-4000-8000-000000000012', '5a4e0004-0000-4000-8000-000000000003', pg_temp.rol('sunucu'), 'Sunucu (doğum günü)', 1, 21000, true, 2),
('5a4e0005-0000-4000-8000-000000000013', '5a4e0004-0000-4000-8000-000000000003', pg_temp.rol('dj'), 'DJ (doğum günü)', 1, 32000, false, 3),
('5a4e0005-0000-4000-8000-000000000014', '5a4e0004-0000-4000-8000-000000000004', pg_temp.rol('tercuman'), 'Tercüman (kurumsal)', 2, 13500, true, 0),
('5a4e0005-0000-4000-8000-000000000015', '5a4e0004-0000-4000-8000-000000000004', pg_temp.rol('ses-isik'), 'Ses & Işık (kurumsal)', 1, 68000, true, 1),
('5a4e0005-0000-4000-8000-000000000016', '5a4e0004-0000-4000-8000-000000000004', pg_temp.rol('muzisyen'), 'Müzisyen (kurumsal)', 2, 17500, true, 2),
('5a4e0005-0000-4000-8000-000000000017', '5a4e0004-0000-4000-8000-000000000004', pg_temp.rol('sunucu'), 'Sunucu (kurumsal)', 2, 26000, true, 3),
('5a4e0005-0000-4000-8000-000000000018', '5a4e0004-0000-4000-8000-000000000005', pg_temp.rol('tercuman'), 'Tercüman (kurumsal)', 1, 14500, true, 0),
('5a4e0005-0000-4000-8000-000000000019', '5a4e0004-0000-4000-8000-000000000005', pg_temp.rol('ses-isik'), 'Ses & Işık (kurumsal)', 1, 31500, true, 1),
('5a4e0005-0000-4000-8000-000000000020', '5a4e0004-0000-4000-8000-000000000005', pg_temp.rol('fotografci'), 'Fotoğrafçı (kurumsal)', 1, 43000, true, 2),
('5a4e0005-0000-4000-8000-000000000021', '5a4e0004-0000-4000-8000-000000000006', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (düğün)', 2, 9500, true, 0),
('5a4e0005-0000-4000-8000-000000000022', '5a4e0004-0000-4000-8000-000000000006', pg_temp.rol('palyaco'), 'Palyaço (düğün)', 1, 5500, true, 1),
('5a4e0005-0000-4000-8000-000000000023', '5a4e0004-0000-4000-8000-000000000007', pg_temp.rol('konusmaci'), 'Konuşmacı (lansman)', 1, 34500, true, 0),
('5a4e0005-0000-4000-8000-000000000024', '5a4e0004-0000-4000-8000-000000000007', pg_temp.rol('dj'), 'DJ (lansman)', 1, 17500, true, 1),
('5a4e0005-0000-4000-8000-000000000025', '5a4e0004-0000-4000-8000-000000000007', pg_temp.rol('model'), 'Model (lansman)', 1, 13000, true, 2),
('5a4e0005-0000-4000-8000-000000000026', '5a4e0004-0000-4000-8000-000000000007', pg_temp.rol('muzisyen'), 'Müzisyen (lansman)', 1, 33500, true, 3),
('5a4e0005-0000-4000-8000-000000000027', '5a4e0004-0000-4000-8000-000000000008', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 12500, true, 0),
('5a4e0005-0000-4000-8000-000000000028', '5a4e0004-0000-4000-8000-000000000008', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 1, 45000, true, 1),
('5a4e0005-0000-4000-8000-000000000029', '5a4e0004-0000-4000-8000-000000000008', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (düğün)', 1, 14500, true, 2),
('5a4e0005-0000-4000-8000-000000000030', '5a4e0004-0000-4000-8000-000000000009', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 23000, true, 0),
('5a4e0005-0000-4000-8000-000000000031', '5a4e0004-0000-4000-8000-000000000009', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 2, 50500, false, 1),
('5a4e0005-0000-4000-8000-000000000032', '5a4e0004-0000-4000-8000-000000000009', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (düğün)', 1, 19000, true, 2),
('5a4e0005-0000-4000-8000-000000000033', '5a4e0004-0000-4000-8000-000000000009', pg_temp.rol('videograf'), 'Videograf (düğün)', 2, 24500, true, 3),
('5a4e0005-0000-4000-8000-000000000034', '5a4e0004-0000-4000-8000-000000000009', pg_temp.rol('canli-yayin'), 'Canlı Yayın (düğün)', 1, 32500, true, 4),
('5a4e0005-0000-4000-8000-000000000035', '5a4e0004-0000-4000-8000-000000000010', pg_temp.rol('konusmaci'), 'Konuşmacı (fuar)', 1, 34500, true, 0),
('5a4e0005-0000-4000-8000-000000000036', '5a4e0004-0000-4000-8000-000000000010', pg_temp.rol('muzisyen'), 'Müzisyen (fuar)', 1, 35500, true, 1),
('5a4e0005-0000-4000-8000-000000000037', '5a4e0004-0000-4000-8000-000000000010', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (fuar)', 2, 7000, true, 2),
('5a4e0005-0000-4000-8000-000000000038', '5a4e0004-0000-4000-8000-000000000010', pg_temp.rol('illuzyonist'), 'İllüzyonist (fuar)', 1, 10000, true, 3),
('5a4e0005-0000-4000-8000-000000000039', '5a4e0004-0000-4000-8000-000000000010', pg_temp.rol('videograf'), 'Videograf (fuar)', 1, 27500, true, 4),
('5a4e0005-0000-4000-8000-000000000040', '5a4e0004-0000-4000-8000-000000000011', pg_temp.rol('konusmaci'), 'Konuşmacı (fuar)', 2, 24500, true, 0),
('5a4e0005-0000-4000-8000-000000000041', '5a4e0004-0000-4000-8000-000000000011', pg_temp.rol('muzisyen'), 'Müzisyen (fuar)', 2, 25500, true, 1),
('5a4e0005-0000-4000-8000-000000000042', '5a4e0004-0000-4000-8000-000000000012', pg_temp.rol('konusmaci'), 'Konuşmacı (fuar)', 1, 48000, true, 0),
('5a4e0005-0000-4000-8000-000000000043', '5a4e0004-0000-4000-8000-000000000012', pg_temp.rol('muzisyen'), 'Müzisyen (fuar)', 1, 24500, true, 1),
('5a4e0005-0000-4000-8000-000000000044', '5a4e0004-0000-4000-8000-000000000012', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (fuar)', 1, 9000, true, 2),
('5a4e0005-0000-4000-8000-000000000045', '5a4e0004-0000-4000-8000-000000000013', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (konser)', 1, 8000, true, 0),
('5a4e0005-0000-4000-8000-000000000046', '5a4e0004-0000-4000-8000-000000000013', pg_temp.rol('dj'), 'DJ (konser)', 2, 35500, true, 1),
('5a4e0005-0000-4000-8000-000000000047', '5a4e0004-0000-4000-8000-000000000013', pg_temp.rol('oyuncu'), 'Oyuncu (konser)', 1, 10000, false, 2),
('5a4e0005-0000-4000-8000-000000000048', '5a4e0004-0000-4000-8000-000000000013', pg_temp.rol('sunucu'), 'Sunucu (konser)', 2, 22500, true, 3),
('5a4e0005-0000-4000-8000-000000000049', '5a4e0004-0000-4000-8000-000000000013', pg_temp.rol('canli-yayin'), 'Canlı Yayın (konser)', 1, 32000, true, 4),
('5a4e0005-0000-4000-8000-000000000050', '5a4e0004-0000-4000-8000-000000000014', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (lansman)', 1, 15500, true, 0),
('5a4e0005-0000-4000-8000-000000000051', '5a4e0004-0000-4000-8000-000000000014', pg_temp.rol('sunucu'), 'Sunucu (lansman)', 2, 16000, true, 1),
('5a4e0005-0000-4000-8000-000000000052', '5a4e0004-0000-4000-8000-000000000014', pg_temp.rol('illuzyonist'), 'İllüzyonist (lansman)', 2, 26000, true, 2),
('5a4e0005-0000-4000-8000-000000000053', '5a4e0004-0000-4000-8000-000000000014', pg_temp.rol('akrobat'), 'Akrobat (lansman)', 1, 24500, true, 3),
('5a4e0005-0000-4000-8000-000000000054', '5a4e0004-0000-4000-8000-000000000015', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (lansman)', 1, 18500, true, 0),
('5a4e0005-0000-4000-8000-000000000055', '5a4e0004-0000-4000-8000-000000000015', pg_temp.rol('sunucu'), 'Sunucu (lansman)', 1, 26500, true, 1),
('5a4e0005-0000-4000-8000-000000000056', '5a4e0004-0000-4000-8000-000000000015', pg_temp.rol('illuzyonist'), 'İllüzyonist (lansman)', 1, 15000, true, 2),
('5a4e0005-0000-4000-8000-000000000057', '5a4e0004-0000-4000-8000-000000000015', pg_temp.rol('akrobat'), 'Akrobat (lansman)', 1, 11500, true, 3),
('5a4e0005-0000-4000-8000-000000000058', '5a4e0004-0000-4000-8000-000000000016', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 31000, false, 0),
('5a4e0005-0000-4000-8000-000000000059', '5a4e0004-0000-4000-8000-000000000016', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (düğün)', 1, 27000, true, 1),
('5a4e0005-0000-4000-8000-000000000060', '5a4e0004-0000-4000-8000-000000000016', pg_temp.rol('palyaco'), 'Palyaço (düğün)', 1, 7000, true, 2),
('5a4e0005-0000-4000-8000-000000000061', '5a4e0004-0000-4000-8000-000000000016', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (düğün)', 2, 9500, true, 3),
('5a4e0005-0000-4000-8000-000000000062', '5a4e0004-0000-4000-8000-000000000016', pg_temp.rol('fotografci'), 'Fotoğrafçı (düğün)', 2, 26000, true, 4),
('5a4e0005-0000-4000-8000-000000000063', '5a4e0004-0000-4000-8000-000000000017', pg_temp.rol('karikaturist'), 'Karikatürist (düğün)', 2, 10500, true, 0),
('5a4e0005-0000-4000-8000-000000000064', '5a4e0004-0000-4000-8000-000000000017', pg_temp.rol('palyaco'), 'Palyaço (düğün)', 1, 6500, true, 1),
('5a4e0005-0000-4000-8000-000000000065', '5a4e0004-0000-4000-8000-000000000017', pg_temp.rol('tercuman'), 'Tercüman (düğün)', 2, 6000, true, 2),
('5a4e0005-0000-4000-8000-000000000066', '5a4e0004-0000-4000-8000-000000000017', pg_temp.rol('hostes'), 'Hostes (düğün)', 1, 3000, true, 3),
('5a4e0005-0000-4000-8000-000000000067', '5a4e0004-0000-4000-8000-000000000018', pg_temp.rol('karikaturist'), 'Karikatürist (düğün)', 2, 8000, true, 0),
('5a4e0005-0000-4000-8000-000000000068', '5a4e0004-0000-4000-8000-000000000018', pg_temp.rol('palyaco'), 'Palyaço (düğün)', 2, 4000, true, 1),
('5a4e0005-0000-4000-8000-000000000069', '5a4e0004-0000-4000-8000-000000000019', pg_temp.rol('karikaturist'), 'Karikatürist (lansman)', 1, 7000, true, 0),
('5a4e0005-0000-4000-8000-000000000070', '5a4e0004-0000-4000-8000-000000000019', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 2, 81000, true, 1),
('5a4e0005-0000-4000-8000-000000000071', '5a4e0004-0000-4000-8000-000000000019', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (lansman)', 1, 15500, true, 2),
('5a4e0005-0000-4000-8000-000000000072', '5a4e0004-0000-4000-8000-000000000019', pg_temp.rol('konusmaci'), 'Konuşmacı (lansman)', 2, 43500, true, 3),
('5a4e0005-0000-4000-8000-000000000073', '5a4e0004-0000-4000-8000-000000000020', pg_temp.rol('karikaturist'), 'Karikatürist (lansman)', 1, 8500, true, 0),
('5a4e0005-0000-4000-8000-000000000074', '5a4e0004-0000-4000-8000-000000000020', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 1, 40500, true, 1),
('5a4e0005-0000-4000-8000-000000000075', '5a4e0004-0000-4000-8000-000000000021', pg_temp.rol('karikaturist'), 'Karikatürist (lansman)', 1, 9500, true, 0),
('5a4e0005-0000-4000-8000-000000000076', '5a4e0004-0000-4000-8000-000000000021', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 2, 43500, false, 1),
('5a4e0005-0000-4000-8000-000000000077', '5a4e0004-0000-4000-8000-000000000021', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (lansman)', 1, 13500, true, 2),
('5a4e0005-0000-4000-8000-000000000078', '5a4e0004-0000-4000-8000-000000000021', pg_temp.rol('konusmaci'), 'Konuşmacı (lansman)', 1, 24500, false, 3),
('5a4e0005-0000-4000-8000-000000000079', '5a4e0004-0000-4000-8000-000000000021', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (lansman)', 1, 9000, true, 4),
('5a4e0005-0000-4000-8000-000000000080', '5a4e0004-0000-4000-8000-000000000022', pg_temp.rol('dj'), 'DJ (kurumsal)', 1, 13500, true, 0),
('5a4e0005-0000-4000-8000-000000000081', '5a4e0004-0000-4000-8000-000000000022', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (kurumsal)', 1, 20000, true, 1),
('5a4e0005-0000-4000-8000-000000000082', '5a4e0004-0000-4000-8000-000000000022', pg_temp.rol('dansci'), 'Dansçı (kurumsal)', 2, 25500, true, 2),
('5a4e0005-0000-4000-8000-000000000083', '5a4e0004-0000-4000-8000-000000000023', pg_temp.rol('model'), 'Model (nişan)', 1, 14500, true, 0),
('5a4e0005-0000-4000-8000-000000000084', '5a4e0004-0000-4000-8000-000000000023', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (nişan)', 1, 7500, true, 1),
('5a4e0005-0000-4000-8000-000000000085', '5a4e0004-0000-4000-8000-000000000023', pg_temp.rol('tercuman'), 'Tercüman (nişan)', 1, 12000, true, 2),
('5a4e0005-0000-4000-8000-000000000086', '5a4e0004-0000-4000-8000-000000000024', pg_temp.rol('model'), 'Model (nişan)', 2, 20000, false, 0),
('5a4e0005-0000-4000-8000-000000000087', '5a4e0004-0000-4000-8000-000000000024', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (nişan)', 1, 8500, false, 1),
('5a4e0005-0000-4000-8000-000000000088', '5a4e0004-0000-4000-8000-000000000024', pg_temp.rol('tercuman'), 'Tercüman (nişan)', 2, 11000, true, 2),
('5a4e0005-0000-4000-8000-000000000089', '5a4e0004-0000-4000-8000-000000000024', pg_temp.rol('videograf'), 'Videograf (nişan)', 2, 63500, true, 3),
('5a4e0005-0000-4000-8000-000000000090', '5a4e0004-0000-4000-8000-000000000024', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (nişan)', 2, 13000, true, 4),
('5a4e0005-0000-4000-8000-000000000091', '5a4e0004-0000-4000-8000-000000000025', pg_temp.rol('konusmaci'), 'Konuşmacı (düğün)', 1, 28000, true, 0),
('5a4e0005-0000-4000-8000-000000000092', '5a4e0004-0000-4000-8000-000000000025', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 1, 12000, true, 1),
('5a4e0005-0000-4000-8000-000000000093', '5a4e0004-0000-4000-8000-000000000026', pg_temp.rol('ses-isik'), 'Ses & Işık (düğün)', 1, 18000, true, 0),
('5a4e0005-0000-4000-8000-000000000094', '5a4e0004-0000-4000-8000-000000000026', pg_temp.rol('oyuncu'), 'Oyuncu (düğün)', 1, 11500, true, 1),
('5a4e0005-0000-4000-8000-000000000095', '5a4e0004-0000-4000-8000-000000000026', pg_temp.rol('dj'), 'DJ (düğün)', 2, 20000, true, 2),
('5a4e0005-0000-4000-8000-000000000096', '5a4e0004-0000-4000-8000-000000000027', pg_temp.rol('ses-isik'), 'Ses & Işık (düğün)', 1, 57000, true, 0),
('5a4e0005-0000-4000-8000-000000000097', '5a4e0004-0000-4000-8000-000000000027', pg_temp.rol('oyuncu'), 'Oyuncu (düğün)', 1, 18000, true, 1),
('5a4e0005-0000-4000-8000-000000000098', '5a4e0004-0000-4000-8000-000000000027', pg_temp.rol('akrobat'), 'Akrobat (düğün)', 1, 19000, true, 2),
('5a4e0005-0000-4000-8000-000000000099', '5a4e0004-0000-4000-8000-000000000027', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 1, 38000, true, 3),
('5a4e0005-0000-4000-8000-000000000100', '5a4e0004-0000-4000-8000-000000000028', pg_temp.rol('dj'), 'DJ (düğün)', 1, 27000, true, 0),
('5a4e0005-0000-4000-8000-000000000101', '5a4e0004-0000-4000-8000-000000000028', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 22000, false, 1),
('5a4e0005-0000-4000-8000-000000000102', '5a4e0004-0000-4000-8000-000000000028', pg_temp.rol('ses-isik'), 'Ses & Işık (düğün)', 1, 88000, true, 2),
('5a4e0005-0000-4000-8000-000000000103', '5a4e0004-0000-4000-8000-000000000029', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 13000, true, 0),
('5a4e0005-0000-4000-8000-000000000104', '5a4e0004-0000-4000-8000-000000000029', pg_temp.rol('oyuncu'), 'Oyuncu (düğün)', 1, 14000, true, 1),
('5a4e0005-0000-4000-8000-000000000105', '5a4e0004-0000-4000-8000-000000000029', pg_temp.rol('karikaturist'), 'Karikatürist (düğün)', 2, 6500, true, 2),
('5a4e0005-0000-4000-8000-000000000106', '5a4e0004-0000-4000-8000-000000000029', pg_temp.rol('ses-isik'), 'Ses & Işık (düğün)', 1, 30000, true, 3),
('5a4e0005-0000-4000-8000-000000000107', '5a4e0004-0000-4000-8000-000000000029', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 1, 22500, true, 4),
('5a4e0005-0000-4000-8000-000000000108', '5a4e0004-0000-4000-8000-000000000030', pg_temp.rol('model'), 'Model (düğün)', 1, 13000, true, 0),
('5a4e0005-0000-4000-8000-000000000109', '5a4e0004-0000-4000-8000-000000000030', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (düğün)', 1, 9500, true, 1),
('5a4e0005-0000-4000-8000-000000000110', '5a4e0004-0000-4000-8000-000000000030', pg_temp.rol('akrobat'), 'Akrobat (düğün)', 1, 11000, true, 2),
('5a4e0005-0000-4000-8000-000000000111', '5a4e0004-0000-4000-8000-000000000031', pg_temp.rol('model'), 'Model (düğün)', 1, 14500, true, 0),
('5a4e0005-0000-4000-8000-000000000112', '5a4e0004-0000-4000-8000-000000000031', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (düğün)', 1, 5500, true, 1),
('5a4e0005-0000-4000-8000-000000000113', '5a4e0004-0000-4000-8000-000000000032', pg_temp.rol('model'), 'Model (düğün)', 1, 6000, true, 0),
('5a4e0005-0000-4000-8000-000000000114', '5a4e0004-0000-4000-8000-000000000032', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (düğün)', 1, 8000, true, 1),
('5a4e0005-0000-4000-8000-000000000115', '5a4e0004-0000-4000-8000-000000000032', pg_temp.rol('dj'), 'DJ (düğün)', 1, 28000, true, 2),
('5a4e0005-0000-4000-8000-000000000116', '5a4e0004-0000-4000-8000-000000000032', pg_temp.rol('akrobat'), 'Akrobat (düğün)', 1, 17000, true, 3),
('5a4e0005-0000-4000-8000-000000000117', '5a4e0004-0000-4000-8000-000000000033', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 33500, true, 0),
('5a4e0005-0000-4000-8000-000000000118', '5a4e0004-0000-4000-8000-000000000033', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 1, 28000, true, 1),
('5a4e0005-0000-4000-8000-000000000119', '5a4e0004-0000-4000-8000-000000000033', pg_temp.rol('dj'), 'DJ (lansman)', 1, 30500, true, 2),
('5a4e0005-0000-4000-8000-000000000120', '5a4e0004-0000-4000-8000-000000000033', pg_temp.rol('illuzyonist'), 'İllüzyonist (lansman)', 2, 26000, true, 3),
('5a4e0005-0000-4000-8000-000000000121', '5a4e0004-0000-4000-8000-000000000033', pg_temp.rol('sunucu'), 'Sunucu (lansman)', 1, 35000, true, 4),
('5a4e0005-0000-4000-8000-000000000122', '5a4e0004-0000-4000-8000-000000000034', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 46500, false, 0),
('5a4e0005-0000-4000-8000-000000000123', '5a4e0004-0000-4000-8000-000000000034', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 1, 22500, true, 1),
('5a4e0005-0000-4000-8000-000000000124', '5a4e0004-0000-4000-8000-000000000034', pg_temp.rol('dj'), 'DJ (lansman)', 1, 17000, true, 2),
('5a4e0005-0000-4000-8000-000000000125', '5a4e0004-0000-4000-8000-000000000035', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 32000, true, 0),
('5a4e0005-0000-4000-8000-000000000126', '5a4e0004-0000-4000-8000-000000000035', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 2, 50000, true, 1),
('5a4e0005-0000-4000-8000-000000000127', '5a4e0004-0000-4000-8000-000000000036', pg_temp.rol('dj'), 'DJ (düğün)', 2, 21500, true, 0),
('5a4e0005-0000-4000-8000-000000000128', '5a4e0004-0000-4000-8000-000000000036', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (düğün)', 2, 20000, true, 1),
('5a4e0005-0000-4000-8000-000000000129', '5a4e0004-0000-4000-8000-000000000036', pg_temp.rol('organizasyon'), 'Organizasyon (düğün)', 1, 178000, true, 2),
('5a4e0005-0000-4000-8000-000000000130', '5a4e0004-0000-4000-8000-000000000037', pg_temp.rol('dj'), 'DJ (düğün)', 1, 9500, true, 0),
('5a4e0005-0000-4000-8000-000000000131', '5a4e0004-0000-4000-8000-000000000037', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (düğün)', 2, 20000, true, 1),
('5a4e0005-0000-4000-8000-000000000132', '5a4e0004-0000-4000-8000-000000000037', pg_temp.rol('organizasyon'), 'Organizasyon (düğün)', 2, 233000, true, 2),
('5a4e0005-0000-4000-8000-000000000133', '5a4e0004-0000-4000-8000-000000000037', pg_temp.rol('tercuman'), 'Tercüman (düğün)', 1, 10500, true, 3),
('5a4e0005-0000-4000-8000-000000000134', '5a4e0004-0000-4000-8000-000000000037', pg_temp.rol('sunucu'), 'Sunucu (düğün)', 1, 18000, false, 4),
('5a4e0005-0000-4000-8000-000000000135', '5a4e0004-0000-4000-8000-000000000038', pg_temp.rol('fotografci'), 'Fotoğrafçı (konferans)', 2, 32000, true, 0),
('5a4e0005-0000-4000-8000-000000000136', '5a4e0004-0000-4000-8000-000000000038', pg_temp.rol('dj'), 'DJ (konferans)', 1, 25000, false, 1),
('5a4e0005-0000-4000-8000-000000000137', '5a4e0004-0000-4000-8000-000000000038', pg_temp.rol('akrobat'), 'Akrobat (konferans)', 2, 21500, true, 2),
('5a4e0005-0000-4000-8000-000000000138', '5a4e0004-0000-4000-8000-000000000039', pg_temp.rol('oyuncu'), 'Oyuncu (gala)', 1, 25000, true, 0),
('5a4e0005-0000-4000-8000-000000000139', '5a4e0004-0000-4000-8000-000000000039', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (gala)', 1, 13000, true, 1),
('5a4e0005-0000-4000-8000-000000000140', '5a4e0004-0000-4000-8000-000000000040', pg_temp.rol('karikaturist'), 'Karikatürist (düğün)', 2, 9000, true, 0),
('5a4e0005-0000-4000-8000-000000000141', '5a4e0004-0000-4000-8000-000000000040', pg_temp.rol('konusmaci'), 'Konuşmacı (düğün)', 1, 59000, true, 1),
('5a4e0005-0000-4000-8000-000000000142', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('karikaturist'), 'Karikatürist (düğün)', 2, 10500, true, 0),
('5a4e0005-0000-4000-8000-000000000143', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('konusmaci'), 'Konuşmacı (düğün)', 2, 61500, false, 1),
('5a4e0005-0000-4000-8000-000000000144', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('videograf'), 'Videograf (düğün)', 1, 26000, true, 2),
('5a4e0005-0000-4000-8000-000000000145', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('dj'), 'DJ (düğün)', 1, 25500, true, 3),
('5a4e0005-0000-4000-8000-000000000146', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 23000, true, 4),
('5a4e0005-0000-4000-8000-000000000147', '5a4e0004-0000-4000-8000-000000000042', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kurumsal)', 1, 12000, true, 0),
('5a4e0005-0000-4000-8000-000000000148', '5a4e0004-0000-4000-8000-000000000042', pg_temp.rol('konusmaci'), 'Konuşmacı (kurumsal)', 1, 39000, true, 1),
('5a4e0005-0000-4000-8000-000000000149', '5a4e0004-0000-4000-8000-000000000042', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 1, 19000, true, 2),
('5a4e0005-0000-4000-8000-000000000150', '5a4e0004-0000-4000-8000-000000000043', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kurumsal)', 1, 6000, true, 0),
('5a4e0005-0000-4000-8000-000000000151', '5a4e0004-0000-4000-8000-000000000043', pg_temp.rol('konusmaci'), 'Konuşmacı (kurumsal)', 1, 49000, true, 1),
('5a4e0005-0000-4000-8000-000000000152', '5a4e0004-0000-4000-8000-000000000043', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 1, 47500, true, 2),
('5a4e0005-0000-4000-8000-000000000153', '5a4e0004-0000-4000-8000-000000000044', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (kurumsal)', 1, 15500, true, 0),
('5a4e0005-0000-4000-8000-000000000154', '5a4e0004-0000-4000-8000-000000000044', pg_temp.rol('organizasyon'), 'Organizasyon (kurumsal)', 1, 96500, true, 1),
('5a4e0005-0000-4000-8000-000000000155', '5a4e0004-0000-4000-8000-000000000044', pg_temp.rol('ses-isik'), 'Ses & Işık (kurumsal)', 1, 53000, true, 2),
('5a4e0005-0000-4000-8000-000000000156', '5a4e0004-0000-4000-8000-000000000044', pg_temp.rol('fotografci'), 'Fotoğrafçı (kurumsal)', 1, 14000, true, 3),
('5a4e0005-0000-4000-8000-000000000157', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (kurumsal)', 1, 15500, true, 0),
('5a4e0005-0000-4000-8000-000000000158', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('organizasyon'), 'Organizasyon (kurumsal)', 1, 197000, true, 1),
('5a4e0005-0000-4000-8000-000000000159', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('ses-isik'), 'Ses & Işık (kurumsal)', 1, 27500, true, 2),
('5a4e0005-0000-4000-8000-000000000160', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('fotografci'), 'Fotoğrafçı (kurumsal)', 1, 37500, true, 3),
('5a4e0005-0000-4000-8000-000000000161', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('dj'), 'DJ (kurumsal)', 1, 14000, true, 4),
('5a4e0005-0000-4000-8000-000000000162', '5a4e0004-0000-4000-8000-000000000046', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kına gecesi)', 2, 13500, true, 0),
('5a4e0005-0000-4000-8000-000000000163', '5a4e0004-0000-4000-8000-000000000046', pg_temp.rol('model'), 'Model (kına gecesi)', 1, 10000, true, 1),
('5a4e0005-0000-4000-8000-000000000164', '5a4e0004-0000-4000-8000-000000000046', pg_temp.rol('dj'), 'DJ (kına gecesi)', 2, 31500, true, 2),
('5a4e0005-0000-4000-8000-000000000165', '5a4e0004-0000-4000-8000-000000000046', pg_temp.rol('dansci'), 'Dansçı (kına gecesi)', 1, 12000, false, 3),
('5a4e0005-0000-4000-8000-000000000166', '5a4e0004-0000-4000-8000-000000000047', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kına gecesi)', 1, 11500, true, 0),
('5a4e0005-0000-4000-8000-000000000167', '5a4e0004-0000-4000-8000-000000000047', pg_temp.rol('model'), 'Model (kına gecesi)', 1, 7500, true, 1),
('5a4e0005-0000-4000-8000-000000000168', '5a4e0004-0000-4000-8000-000000000047', pg_temp.rol('ses-isik'), 'Ses & Işık (kına gecesi)', 1, 15500, false, 2),
('5a4e0005-0000-4000-8000-000000000169', '5a4e0004-0000-4000-8000-000000000048', pg_temp.rol('tercuman'), 'Tercüman (lansman)', 1, 14500, false, 0),
('5a4e0005-0000-4000-8000-000000000170', '5a4e0004-0000-4000-8000-000000000048', pg_temp.rol('organizasyon'), 'Organizasyon (lansman)', 1, 98500, true, 1),
('5a4e0005-0000-4000-8000-000000000171', '5a4e0004-0000-4000-8000-000000000048', pg_temp.rol('influencer'), 'Influencer (lansman)', 2, 46000, true, 2),
('5a4e0005-0000-4000-8000-000000000172', '5a4e0004-0000-4000-8000-000000000048', pg_temp.rol('model'), 'Model (lansman)', 1, 18000, true, 3),
('5a4e0005-0000-4000-8000-000000000173', '5a4e0004-0000-4000-8000-000000000049', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 1, 13000, true, 0),
('5a4e0005-0000-4000-8000-000000000174', '5a4e0004-0000-4000-8000-000000000049', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (fuar)', 1, 17500, true, 1),
('5a4e0005-0000-4000-8000-000000000175', '5a4e0004-0000-4000-8000-000000000050', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 2, 20000, true, 0),
('5a4e0005-0000-4000-8000-000000000176', '5a4e0004-0000-4000-8000-000000000050', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (fuar)', 1, 10500, true, 1),
('5a4e0005-0000-4000-8000-000000000177', '5a4e0004-0000-4000-8000-000000000050', pg_temp.rol('hostes'), 'Hostes (fuar)', 2, 2500, true, 2),
('5a4e0005-0000-4000-8000-000000000178', '5a4e0004-0000-4000-8000-000000000050', pg_temp.rol('influencer'), 'Influencer (fuar)', 2, 37000, true, 3),
('5a4e0005-0000-4000-8000-000000000179', '5a4e0004-0000-4000-8000-000000000051', pg_temp.rol('influencer'), 'Influencer (fuar)', 1, 35500, true, 0),
('5a4e0005-0000-4000-8000-000000000180', '5a4e0004-0000-4000-8000-000000000051', pg_temp.rol('sunucu'), 'Sunucu (fuar)', 1, 14500, true, 1),
('5a4e0005-0000-4000-8000-000000000181', '5a4e0004-0000-4000-8000-000000000051', pg_temp.rol('canli-yayin'), 'Canlı Yayın (fuar)', 2, 48000, true, 2),
('5a4e0005-0000-4000-8000-000000000182', '5a4e0004-0000-4000-8000-000000000051', pg_temp.rol('oyuncu'), 'Oyuncu (fuar)', 1, 24500, false, 3),
('5a4e0005-0000-4000-8000-000000000183', '5a4e0004-0000-4000-8000-000000000051', pg_temp.rol('dansci'), 'Dansçı (fuar)', 2, 30000, true, 4),
('5a4e0005-0000-4000-8000-000000000184', '5a4e0004-0000-4000-8000-000000000052', pg_temp.rol('muzisyen'), 'Müzisyen (diğer)', 1, 29500, true, 0),
('5a4e0005-0000-4000-8000-000000000185', '5a4e0004-0000-4000-8000-000000000052', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (diğer)', 1, 7000, true, 1),
('5a4e0005-0000-4000-8000-000000000186', '5a4e0004-0000-4000-8000-000000000052', pg_temp.rol('hostes'), 'Hostes (diğer)', 1, 4000, true, 2),
('5a4e0005-0000-4000-8000-000000000187', '5a4e0004-0000-4000-8000-000000000052', pg_temp.rol('model'), 'Model (diğer)', 1, 8500, true, 3),
('5a4e0005-0000-4000-8000-000000000188', '5a4e0004-0000-4000-8000-000000000053', pg_temp.rol('muzisyen'), 'Müzisyen (diğer)', 2, 12000, true, 0),
('5a4e0005-0000-4000-8000-000000000189', '5a4e0004-0000-4000-8000-000000000053', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (diğer)', 1, 7000, true, 1),
('5a4e0005-0000-4000-8000-000000000190', '5a4e0004-0000-4000-8000-000000000054', pg_temp.rol('muzisyen'), 'Müzisyen (diğer)', 1, 31500, true, 0),
('5a4e0005-0000-4000-8000-000000000191', '5a4e0004-0000-4000-8000-000000000054', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (diğer)', 1, 6000, true, 1),
('5a4e0005-0000-4000-8000-000000000192', '5a4e0004-0000-4000-8000-000000000055', pg_temp.rol('muzisyen'), 'Müzisyen (gala)', 1, 16000, true, 0),
('5a4e0005-0000-4000-8000-000000000193', '5a4e0004-0000-4000-8000-000000000055', pg_temp.rol('illuzyonist'), 'İllüzyonist (gala)', 2, 17500, true, 1),
('5a4e0005-0000-4000-8000-000000000194', '5a4e0004-0000-4000-8000-000000000055', pg_temp.rol('dansci'), 'Dansçı (gala)', 1, 31000, true, 2),
('5a4e0005-0000-4000-8000-000000000195', '5a4e0004-0000-4000-8000-000000000055', pg_temp.rol('sunucu'), 'Sunucu (gala)', 2, 27000, true, 3),
('5a4e0005-0000-4000-8000-000000000196', '5a4e0004-0000-4000-8000-000000000055', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (gala)', 1, 6000, true, 4),
('5a4e0005-0000-4000-8000-000000000197', '5a4e0004-0000-4000-8000-000000000056', pg_temp.rol('muzisyen'), 'Müzisyen (gala)', 1, 47500, true, 0),
('5a4e0005-0000-4000-8000-000000000198', '5a4e0004-0000-4000-8000-000000000056', pg_temp.rol('illuzyonist'), 'İllüzyonist (gala)', 1, 17500, true, 1),
('5a4e0005-0000-4000-8000-000000000199', '5a4e0004-0000-4000-8000-000000000057', pg_temp.rol('muzisyen'), 'Müzisyen (gala)', 1, 14000, false, 0),
('5a4e0005-0000-4000-8000-000000000200', '5a4e0004-0000-4000-8000-000000000057', pg_temp.rol('illuzyonist'), 'İllüzyonist (gala)', 1, 18500, false, 1),
('5a4e0005-0000-4000-8000-000000000201', '5a4e0004-0000-4000-8000-000000000057', pg_temp.rol('dansci'), 'Dansçı (gala)', 1, 30000, true, 2),
('5a4e0005-0000-4000-8000-000000000202', '5a4e0004-0000-4000-8000-000000000057', pg_temp.rol('sunucu'), 'Sunucu (gala)', 1, 21000, true, 3),
('5a4e0005-0000-4000-8000-000000000203', '5a4e0004-0000-4000-8000-000000000058', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 1, 18000, true, 0),
('5a4e0005-0000-4000-8000-000000000204', '5a4e0004-0000-4000-8000-000000000058', pg_temp.rol('hostes'), 'Hostes (fuar)', 2, 2500, true, 1),
('5a4e0005-0000-4000-8000-000000000205', '5a4e0004-0000-4000-8000-000000000059', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kurumsal)', 1, 11500, true, 0),
('5a4e0005-0000-4000-8000-000000000206', '5a4e0004-0000-4000-8000-000000000059', pg_temp.rol('dj'), 'DJ (kurumsal)', 1, 28500, true, 1),
('5a4e0005-0000-4000-8000-000000000207', '5a4e0004-0000-4000-8000-000000000060', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kurumsal)', 2, 16500, true, 0),
('5a4e0005-0000-4000-8000-000000000208', '5a4e0004-0000-4000-8000-000000000060', pg_temp.rol('dj'), 'DJ (kurumsal)', 1, 9000, true, 1),
('5a4e0005-0000-4000-8000-000000000209', '5a4e0004-0000-4000-8000-000000000060', pg_temp.rol('ses-isik'), 'Ses & Işık (kurumsal)', 2, 53500, true, 2),
('5a4e0005-0000-4000-8000-000000000210', '5a4e0004-0000-4000-8000-000000000060', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (kurumsal)', 1, 8500, true, 3),
('5a4e0005-0000-4000-8000-000000000211', '5a4e0004-0000-4000-8000-000000000061', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kurumsal)', 1, 6000, true, 0),
('5a4e0005-0000-4000-8000-000000000212', '5a4e0004-0000-4000-8000-000000000061', pg_temp.rol('dj'), 'DJ (kurumsal)', 1, 13000, true, 1),
('5a4e0005-0000-4000-8000-000000000213', '5a4e0004-0000-4000-8000-000000000062', pg_temp.rol('sunucu'), 'Sunucu (konferans)', 1, 33500, true, 0),
('5a4e0005-0000-4000-8000-000000000214', '5a4e0004-0000-4000-8000-000000000062', pg_temp.rol('model'), 'Model (konferans)', 1, 16000, true, 1),
('5a4e0005-0000-4000-8000-000000000215', '5a4e0004-0000-4000-8000-000000000062', pg_temp.rol('ses-isik'), 'Ses & Işık (konferans)', 2, 66000, true, 2),
('5a4e0005-0000-4000-8000-000000000216', '5a4e0004-0000-4000-8000-000000000063', pg_temp.rol('fotografci'), 'Fotoğrafçı (kurumsal)', 1, 15500, true, 0),
('5a4e0005-0000-4000-8000-000000000217', '5a4e0004-0000-4000-8000-000000000063', pg_temp.rol('muzisyen'), 'Müzisyen (kurumsal)', 1, 21500, true, 1),
('5a4e0005-0000-4000-8000-000000000218', '5a4e0004-0000-4000-8000-000000000064', pg_temp.rol('organizasyon'), 'Organizasyon (lansman)', 1, 227500, true, 0),
('5a4e0005-0000-4000-8000-000000000219', '5a4e0004-0000-4000-8000-000000000064', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 23500, true, 1),
('5a4e0005-0000-4000-8000-000000000220', '5a4e0004-0000-4000-8000-000000000064', pg_temp.rol('fotografci'), 'Fotoğrafçı (lansman)', 2, 39000, true, 2),
('5a4e0005-0000-4000-8000-000000000221', '5a4e0004-0000-4000-8000-000000000065', pg_temp.rol('organizasyon'), 'Organizasyon (lansman)', 1, 137000, true, 0),
('5a4e0005-0000-4000-8000-000000000222', '5a4e0004-0000-4000-8000-000000000065', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 36000, true, 1),
('5a4e0005-0000-4000-8000-000000000223', '5a4e0004-0000-4000-8000-000000000066', pg_temp.rol('organizasyon'), 'Organizasyon (lansman)', 1, 205000, true, 0),
('5a4e0005-0000-4000-8000-000000000224', '5a4e0004-0000-4000-8000-000000000066', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 42500, true, 1),
('5a4e0005-0000-4000-8000-000000000225', '5a4e0004-0000-4000-8000-000000000066', pg_temp.rol('influencer'), 'Influencer (lansman)', 2, 47000, true, 2),
('5a4e0005-0000-4000-8000-000000000226', '5a4e0004-0000-4000-8000-000000000066', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 1, 22000, true, 3),
('5a4e0005-0000-4000-8000-000000000227', '5a4e0004-0000-4000-8000-000000000067', pg_temp.rol('sunucu'), 'Sunucu (lansman)', 1, 26500, true, 0),
('5a4e0005-0000-4000-8000-000000000228', '5a4e0004-0000-4000-8000-000000000067', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (lansman)', 2, 10500, true, 1),
('5a4e0005-0000-4000-8000-000000000229', '5a4e0004-0000-4000-8000-000000000067', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 1, 63500, true, 2),
('5a4e0005-0000-4000-8000-000000000230', '5a4e0004-0000-4000-8000-000000000067', pg_temp.rol('influencer'), 'Influencer (lansman)', 1, 49000, true, 3),
('5a4e0005-0000-4000-8000-000000000231', '5a4e0004-0000-4000-8000-000000000067', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 1, 46000, true, 4),
('5a4e0005-0000-4000-8000-000000000232', '5a4e0004-0000-4000-8000-000000000068', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (lansman)', 1, 21000, true, 0),
('5a4e0005-0000-4000-8000-000000000233', '5a4e0004-0000-4000-8000-000000000068', pg_temp.rol('akrobat'), 'Akrobat (lansman)', 1, 26000, true, 1),
('5a4e0005-0000-4000-8000-000000000234', '5a4e0004-0000-4000-8000-000000000068', pg_temp.rol('videograf'), 'Videograf (lansman)', 2, 18500, true, 2),
('5a4e0005-0000-4000-8000-000000000235', '5a4e0004-0000-4000-8000-000000000069', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 2, 22500, true, 0),
('5a4e0005-0000-4000-8000-000000000236', '5a4e0004-0000-4000-8000-000000000069', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (kurumsal)', 2, 24000, true, 1),
('5a4e0005-0000-4000-8000-000000000237', '5a4e0004-0000-4000-8000-000000000069', pg_temp.rol('influencer'), 'Influencer (kurumsal)', 2, 25000, true, 2),
('5a4e0005-0000-4000-8000-000000000238', '5a4e0004-0000-4000-8000-000000000070', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 1, 40000, true, 0),
('5a4e0005-0000-4000-8000-000000000239', '5a4e0004-0000-4000-8000-000000000070', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (kurumsal)', 1, 20000, true, 1),
('5a4e0005-0000-4000-8000-000000000240', '5a4e0004-0000-4000-8000-000000000070', pg_temp.rol('fotografci'), 'Fotoğrafçı (kurumsal)', 2, 20500, true, 2),
('5a4e0005-0000-4000-8000-000000000241', '5a4e0004-0000-4000-8000-000000000071', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 1, 17000, true, 0),
('5a4e0005-0000-4000-8000-000000000242', '5a4e0004-0000-4000-8000-000000000071', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (kurumsal)', 1, 18000, false, 1),
('5a4e0005-0000-4000-8000-000000000243', '5a4e0004-0000-4000-8000-000000000071', pg_temp.rol('fotografci'), 'Fotoğrafçı (kurumsal)', 1, 32500, true, 2),
('5a4e0005-0000-4000-8000-000000000244', '5a4e0004-0000-4000-8000-000000000072', pg_temp.rol('dansci'), 'Dansçı (fuar)', 1, 10500, true, 0),
('5a4e0005-0000-4000-8000-000000000245', '5a4e0004-0000-4000-8000-000000000072', pg_temp.rol('karikaturist'), 'Karikatürist (fuar)', 1, 6500, true, 1),
('5a4e0005-0000-4000-8000-000000000246', '5a4e0004-0000-4000-8000-000000000073', pg_temp.rol('canli-yayin'), 'Canlı Yayın (düğün)', 1, 22000, true, 0),
('5a4e0005-0000-4000-8000-000000000247', '5a4e0004-0000-4000-8000-000000000073', pg_temp.rol('palyaco'), 'Palyaço (düğün)', 2, 6500, false, 1),
('5a4e0005-0000-4000-8000-000000000248', '5a4e0004-0000-4000-8000-000000000074', pg_temp.rol('canli-yayin'), 'Canlı Yayın (düğün)', 1, 46500, true, 0),
('5a4e0005-0000-4000-8000-000000000249', '5a4e0004-0000-4000-8000-000000000074', pg_temp.rol('tercuman'), 'Tercüman (düğün)', 1, 6500, true, 1),
('5a4e0005-0000-4000-8000-000000000250', '5a4e0004-0000-4000-8000-000000000074', pg_temp.rol('akrobat'), 'Akrobat (düğün)', 1, 13000, true, 2),
('5a4e0005-0000-4000-8000-000000000251', '5a4e0004-0000-4000-8000-000000000075', pg_temp.rol('canli-yayin'), 'Canlı Yayın (düğün)', 2, 45000, true, 0),
('5a4e0005-0000-4000-8000-000000000252', '5a4e0004-0000-4000-8000-000000000075', pg_temp.rol('tercuman'), 'Tercüman (düğün)', 1, 13500, true, 1),
('5a4e0005-0000-4000-8000-000000000253', '5a4e0004-0000-4000-8000-000000000075', pg_temp.rol('akrobat'), 'Akrobat (düğün)', 1, 26500, true, 2),
('5a4e0005-0000-4000-8000-000000000254', '5a4e0004-0000-4000-8000-000000000076', pg_temp.rol('canli-yayin'), 'Canlı Yayın (düğün)', 1, 39000, true, 0),
('5a4e0005-0000-4000-8000-000000000255', '5a4e0004-0000-4000-8000-000000000076', pg_temp.rol('tercuman'), 'Tercüman (düğün)', 1, 12500, true, 1),
('5a4e0005-0000-4000-8000-000000000256', '5a4e0004-0000-4000-8000-000000000076', pg_temp.rol('akrobat'), 'Akrobat (düğün)', 1, 22000, true, 2),
('5a4e0005-0000-4000-8000-000000000257', '5a4e0004-0000-4000-8000-000000000076', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (düğün)', 1, 6000, true, 3),
('5a4e0005-0000-4000-8000-000000000258', '5a4e0004-0000-4000-8000-000000000077', pg_temp.rol('model'), 'Model (düğün)', 1, 10500, true, 0),
('5a4e0005-0000-4000-8000-000000000259', '5a4e0004-0000-4000-8000-000000000077', pg_temp.rol('fotografci'), 'Fotoğrafçı (düğün)', 2, 19000, true, 1),
('5a4e0005-0000-4000-8000-000000000260', '5a4e0004-0000-4000-8000-000000000077', pg_temp.rol('sunucu'), 'Sunucu (düğün)', 1, 25000, true, 2),
('5a4e0005-0000-4000-8000-000000000261', '5a4e0004-0000-4000-8000-000000000077', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (düğün)', 1, 6000, true, 3),
('5a4e0005-0000-4000-8000-000000000262', '5a4e0004-0000-4000-8000-000000000077', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 19500, true, 4),
('5a4e0005-0000-4000-8000-000000000263', '5a4e0004-0000-4000-8000-000000000078', pg_temp.rol('model'), 'Model (düğün)', 1, 7500, true, 0),
('5a4e0005-0000-4000-8000-000000000264', '5a4e0004-0000-4000-8000-000000000078', pg_temp.rol('fotografci'), 'Fotoğrafçı (düğün)', 1, 44500, true, 1),
('5a4e0005-0000-4000-8000-000000000265', '5a4e0004-0000-4000-8000-000000000078', pg_temp.rol('sunucu'), 'Sunucu (düğün)', 2, 30000, true, 2),
('5a4e0005-0000-4000-8000-000000000266', '5a4e0004-0000-4000-8000-000000000079', pg_temp.rol('model'), 'Model (düğün)', 1, 6000, true, 0),
('5a4e0005-0000-4000-8000-000000000267', '5a4e0004-0000-4000-8000-000000000079', pg_temp.rol('fotografci'), 'Fotoğrafçı (düğün)', 1, 19500, true, 1),
('5a4e0005-0000-4000-8000-000000000268', '5a4e0004-0000-4000-8000-000000000079', pg_temp.rol('sunucu'), 'Sunucu (düğün)', 1, 29000, true, 2),
('5a4e0005-0000-4000-8000-000000000269', '5a4e0004-0000-4000-8000-000000000079', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (düğün)', 2, 6500, true, 3),
('5a4e0005-0000-4000-8000-000000000270', '5a4e0004-0000-4000-8000-000000000080', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (lansman)', 1, 8500, true, 0),
('5a4e0005-0000-4000-8000-000000000271', '5a4e0004-0000-4000-8000-000000000080', pg_temp.rol('influencer'), 'Influencer (lansman)', 2, 34500, true, 1),
('5a4e0005-0000-4000-8000-000000000272', '5a4e0004-0000-4000-8000-000000000081', pg_temp.rol('dansci'), 'Dansçı (lansman)', 1, 19500, true, 0),
('5a4e0005-0000-4000-8000-000000000273', '5a4e0004-0000-4000-8000-000000000081', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 1, 42500, true, 1),
('5a4e0005-0000-4000-8000-000000000274', '5a4e0004-0000-4000-8000-000000000081', pg_temp.rol('model'), 'Model (lansman)', 1, 17000, true, 2),
('5a4e0005-0000-4000-8000-000000000275', '5a4e0004-0000-4000-8000-000000000082', pg_temp.rol('organizasyon'), 'Organizasyon (konferans)', 1, 189500, true, 0),
('5a4e0005-0000-4000-8000-000000000276', '5a4e0004-0000-4000-8000-000000000082', pg_temp.rol('oyuncu'), 'Oyuncu (konferans)', 1, 22000, true, 1),
('5a4e0005-0000-4000-8000-000000000277', '5a4e0004-0000-4000-8000-000000000082', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (konferans)', 2, 19500, true, 2),
('5a4e0005-0000-4000-8000-000000000278', '5a4e0004-0000-4000-8000-000000000082', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (konferans)', 1, 10500, true, 3),
('5a4e0005-0000-4000-8000-000000000279', '5a4e0004-0000-4000-8000-000000000082', pg_temp.rol('ses-isik'), 'Ses & Işık (konferans)', 1, 26500, true, 4),
('5a4e0005-0000-4000-8000-000000000280', '5a4e0004-0000-4000-8000-000000000083', pg_temp.rol('organizasyon'), 'Organizasyon (konferans)', 1, 145000, true, 0),
('5a4e0005-0000-4000-8000-000000000281', '5a4e0004-0000-4000-8000-000000000083', pg_temp.rol('oyuncu'), 'Oyuncu (konferans)', 1, 16000, true, 1),
('5a4e0005-0000-4000-8000-000000000282', '5a4e0004-0000-4000-8000-000000000083', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (konferans)', 2, 16500, true, 2),
('5a4e0005-0000-4000-8000-000000000283', '5a4e0004-0000-4000-8000-000000000083', pg_temp.rol('tercuman'), 'Tercüman (konferans)', 1, 13500, true, 3),
('5a4e0005-0000-4000-8000-000000000284', '5a4e0004-0000-4000-8000-000000000084', pg_temp.rol('organizasyon'), 'Organizasyon (konferans)', 2, 257000, true, 0),
('5a4e0005-0000-4000-8000-000000000285', '5a4e0004-0000-4000-8000-000000000084', pg_temp.rol('oyuncu'), 'Oyuncu (konferans)', 1, 24500, true, 1),
('5a4e0005-0000-4000-8000-000000000286', '5a4e0004-0000-4000-8000-000000000084', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (konferans)', 1, 7500, false, 2),
('5a4e0005-0000-4000-8000-000000000287', '5a4e0004-0000-4000-8000-000000000085', pg_temp.rol('muzisyen'), 'Müzisyen (kurumsal)', 1, 42500, true, 0),
('5a4e0005-0000-4000-8000-000000000288', '5a4e0004-0000-4000-8000-000000000085', pg_temp.rol('konusmaci'), 'Konuşmacı (kurumsal)', 1, 53500, false, 1),
('5a4e0005-0000-4000-8000-000000000289', '5a4e0004-0000-4000-8000-000000000085', pg_temp.rol('videograf'), 'Videograf (kurumsal)', 1, 30000, false, 2),
('5a4e0005-0000-4000-8000-000000000290', '5a4e0004-0000-4000-8000-000000000085', pg_temp.rol('ses-isik'), 'Ses & Işık (kurumsal)', 1, 39000, true, 3),
('5a4e0005-0000-4000-8000-000000000291', '5a4e0004-0000-4000-8000-000000000085', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 1, 34500, true, 4),
('5a4e0005-0000-4000-8000-000000000292', '5a4e0004-0000-4000-8000-000000000086', pg_temp.rol('muzisyen'), 'Müzisyen (kurumsal)', 2, 47500, true, 0),
('5a4e0005-0000-4000-8000-000000000293', '5a4e0004-0000-4000-8000-000000000086', pg_temp.rol('konusmaci'), 'Konuşmacı (kurumsal)', 1, 40000, true, 1),
('5a4e0005-0000-4000-8000-000000000294', '5a4e0004-0000-4000-8000-000000000086', pg_temp.rol('videograf'), 'Videograf (kurumsal)', 1, 46000, true, 2),
('5a4e0005-0000-4000-8000-000000000295', '5a4e0004-0000-4000-8000-000000000086', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 1, 32500, true, 3),
('5a4e0005-0000-4000-8000-000000000296', '5a4e0004-0000-4000-8000-000000000087', pg_temp.rol('muzisyen'), 'Müzisyen (kurumsal)', 1, 42500, true, 0),
('5a4e0005-0000-4000-8000-000000000297', '5a4e0004-0000-4000-8000-000000000087', pg_temp.rol('konusmaci'), 'Konuşmacı (kurumsal)', 1, 57500, true, 1),
('5a4e0005-0000-4000-8000-000000000298', '5a4e0004-0000-4000-8000-000000000088', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (konferans)', 2, 25000, true, 0),
('5a4e0005-0000-4000-8000-000000000299', '5a4e0004-0000-4000-8000-000000000088', pg_temp.rol('oyuncu'), 'Oyuncu (konferans)', 2, 7000, true, 1),
('5a4e0005-0000-4000-8000-000000000300', '5a4e0004-0000-4000-8000-000000000088', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (konferans)', 1, 4000, true, 2),
('5a4e0005-0000-4000-8000-000000000301', '5a4e0004-0000-4000-8000-000000000088', pg_temp.rol('videograf'), 'Videograf (konferans)', 2, 41000, true, 3),
('5a4e0005-0000-4000-8000-000000000302', '5a4e0004-0000-4000-8000-000000000088', pg_temp.rol('ses-isik'), 'Ses & Işık (konferans)', 1, 73500, false, 4),
('5a4e0005-0000-4000-8000-000000000303', '5a4e0004-0000-4000-8000-000000000089', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (konferans)', 1, 21000, true, 0),
('5a4e0005-0000-4000-8000-000000000304', '5a4e0004-0000-4000-8000-000000000089', pg_temp.rol('oyuncu'), 'Oyuncu (konferans)', 1, 16000, true, 1);
  -- gonderim (sent_at ilk kez; tetikleyici proposal_sent olayini sent_at ile yazar)
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3284.55) WHERE id = '5a4e0004-0000-4000-8000-000000000001';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(5033.46) WHERE id = '5a4e0004-0000-4000-8000-000000000002';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(5028.59) WHERE id = '5a4e0004-0000-4000-8000-000000000003';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1410.06) WHERE id = '5a4e0004-0000-4000-8000-000000000004';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1424.21) WHERE id = '5a4e0004-0000-4000-8000-000000000005';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(459.23) WHERE id = '5a4e0004-0000-4000-8000-000000000006';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4474.96) WHERE id = '5a4e0004-0000-4000-8000-000000000007';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2846.84) WHERE id = '5a4e0004-0000-4000-8000-000000000008';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2825.61) WHERE id = '5a4e0004-0000-4000-8000-000000000009';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2076.26) WHERE id = '5a4e0004-0000-4000-8000-000000000010';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2041.32) WHERE id = '5a4e0004-0000-4000-8000-000000000011';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2082.63) WHERE id = '5a4e0004-0000-4000-8000-000000000012';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3577.33) WHERE id = '5a4e0004-0000-4000-8000-000000000013';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(185.53) WHERE id = '5a4e0004-0000-4000-8000-000000000014';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(174.23) WHERE id = '5a4e0004-0000-4000-8000-000000000015';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(645.83) WHERE id = '5a4e0004-0000-4000-8000-000000000016';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2919.36) WHERE id = '5a4e0004-0000-4000-8000-000000000017';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2881.10) WHERE id = '5a4e0004-0000-4000-8000-000000000018';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1587.95) WHERE id = '5a4e0004-0000-4000-8000-000000000019';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1564.26) WHERE id = '5a4e0004-0000-4000-8000-000000000020';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1511.90) WHERE id = '5a4e0004-0000-4000-8000-000000000021';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(832.05) WHERE id = '5a4e0004-0000-4000-8000-000000000022';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1020.50) WHERE id = '5a4e0004-0000-4000-8000-000000000023';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1031.41) WHERE id = '5a4e0004-0000-4000-8000-000000000024';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(205.10) WHERE id = '5a4e0004-0000-4000-8000-000000000025';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2133.49) WHERE id = '5a4e0004-0000-4000-8000-000000000026';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2147.22) WHERE id = '5a4e0004-0000-4000-8000-000000000027';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1369.15) WHERE id = '5a4e0004-0000-4000-8000-000000000028';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3033.11) WHERE id = '5a4e0004-0000-4000-8000-000000000029';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3759.73) WHERE id = '5a4e0004-0000-4000-8000-000000000030';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3725.90) WHERE id = '5a4e0004-0000-4000-8000-000000000031';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3723.09) WHERE id = '5a4e0004-0000-4000-8000-000000000032';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(684.83) WHERE id = '5a4e0004-0000-4000-8000-000000000033';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(719.13) WHERE id = '5a4e0004-0000-4000-8000-000000000034';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(709.64) WHERE id = '5a4e0004-0000-4000-8000-000000000035';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(221.92) WHERE id = '5a4e0004-0000-4000-8000-000000000036';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(175.33) WHERE id = '5a4e0004-0000-4000-8000-000000000037';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3447.00) WHERE id = '5a4e0004-0000-4000-8000-000000000038';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1344.17) WHERE id = '5a4e0004-0000-4000-8000-000000000039';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3166.73) WHERE id = '5a4e0004-0000-4000-8000-000000000040';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3199.53) WHERE id = '5a4e0004-0000-4000-8000-000000000041';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(5730.33) WHERE id = '5a4e0004-0000-4000-8000-000000000042';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(5707.35) WHERE id = '5a4e0004-0000-4000-8000-000000000043';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3855.59) WHERE id = '5a4e0004-0000-4000-8000-000000000044';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3853.01) WHERE id = '5a4e0004-0000-4000-8000-000000000045';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2496.04) WHERE id = '5a4e0004-0000-4000-8000-000000000046';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2516.39) WHERE id = '5a4e0004-0000-4000-8000-000000000047';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4118.80) WHERE id = '5a4e0004-0000-4000-8000-000000000048';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4685.78) WHERE id = '5a4e0004-0000-4000-8000-000000000049';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4442.00) WHERE id = '5a4e0004-0000-4000-8000-000000000050';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(169.25) WHERE id = '5a4e0004-0000-4000-8000-000000000051';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(156.03) WHERE id = '5a4e0004-0000-4000-8000-000000000052';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(165.06) WHERE id = '5a4e0004-0000-4000-8000-000000000053';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(153.77) WHERE id = '5a4e0004-0000-4000-8000-000000000054';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2989.32) WHERE id = '5a4e0004-0000-4000-8000-000000000055';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3036.09) WHERE id = '5a4e0004-0000-4000-8000-000000000056';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3050.24) WHERE id = '5a4e0004-0000-4000-8000-000000000057';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2733.30) WHERE id = '5a4e0004-0000-4000-8000-000000000058';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(928.14) WHERE id = '5a4e0004-0000-4000-8000-000000000059';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(992.90) WHERE id = '5a4e0004-0000-4000-8000-000000000060';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1003.05) WHERE id = '5a4e0004-0000-4000-8000-000000000061';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3645.27) WHERE id = '5a4e0004-0000-4000-8000-000000000062';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1444.60) WHERE id = '5a4e0004-0000-4000-8000-000000000063';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(151.21) WHERE id = '5a4e0004-0000-4000-8000-000000000064';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(204.86) WHERE id = '5a4e0004-0000-4000-8000-000000000065';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(140.99) WHERE id = '5a4e0004-0000-4000-8000-000000000066';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1727.72) WHERE id = '5a4e0004-0000-4000-8000-000000000067';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3587.99) WHERE id = '5a4e0004-0000-4000-8000-000000000068';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(169.36) WHERE id = '5a4e0004-0000-4000-8000-000000000069';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(175.15) WHERE id = '5a4e0004-0000-4000-8000-000000000070';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(152.74) WHERE id = '5a4e0004-0000-4000-8000-000000000071';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3368.94) WHERE id = '5a4e0004-0000-4000-8000-000000000072';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3484.79) WHERE id = '5a4e0004-0000-4000-8000-000000000073';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1381.75) WHERE id = '5a4e0004-0000-4000-8000-000000000074';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1354.70) WHERE id = '5a4e0004-0000-4000-8000-000000000075';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1413.81) WHERE id = '5a4e0004-0000-4000-8000-000000000076';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(445.14) WHERE id = '5a4e0004-0000-4000-8000-000000000077';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(470.73) WHERE id = '5a4e0004-0000-4000-8000-000000000078';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(482.14) WHERE id = '5a4e0004-0000-4000-8000-000000000079';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2989.68) WHERE id = '5a4e0004-0000-4000-8000-000000000080';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(230.89) WHERE id = '5a4e0004-0000-4000-8000-000000000081';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3891.28) WHERE id = '5a4e0004-0000-4000-8000-000000000082';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3884.79) WHERE id = '5a4e0004-0000-4000-8000-000000000083';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3891.15) WHERE id = '5a4e0004-0000-4000-8000-000000000084';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2110.36) WHERE id = '5a4e0004-0000-4000-8000-000000000085';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2135.03) WHERE id = '5a4e0004-0000-4000-8000-000000000086';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2075.36) WHERE id = '5a4e0004-0000-4000-8000-000000000087';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2735.50) WHERE id = '5a4e0004-0000-4000-8000-000000000088';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2701.09) WHERE id = '5a4e0004-0000-4000-8000-000000000089';
  -- durumlar (proposal_* olaylari now() ile yazilir; asagida duzeltilir)
UPDATE public.proposal_versions SET approved_by_name = 'Eda Turan', approved_at = pg_temp.t(3260.36) WHERE id = '5a4e0004-0000-4000-8000-000000000001';
UPDATE public.proposal_versions SET approved_by_name = 'Bahar Keskin', approved_at = pg_temp.t(4990.95) WHERE id = '5a4e0004-0000-4000-8000-000000000002';
UPDATE public.proposal_versions SET approved_by_name = 'Selim Aydın', approved_at = pg_temp.t(1285.38) WHERE id = '5a4e0004-0000-4000-8000-000000000004';
UPDATE public.proposal_versions SET approved_by_name = 'Emre Kurt', approved_at = pg_temp.t(4466.68) WHERE id = '5a4e0004-0000-4000-8000-000000000007';
UPDATE public.proposal_versions SET approved_by_name = 'Çağrı Erdem', approved_at = pg_temp.t(2693.23) WHERE id = '5a4e0004-0000-4000-8000-000000000008';
UPDATE public.proposal_versions SET approved_by_name = 'Burcu Sarı', approved_at = pg_temp.t(3573.58) WHERE id = '5a4e0004-0000-4000-8000-000000000013';
UPDATE public.proposal_versions SET approved_by_name = 'Sinan Özdemir', approved_at = pg_temp.t(1499.37) WHERE id = '5a4e0004-0000-4000-8000-000000000019';
UPDATE public.proposal_versions SET approved_by_name = 'Batuhan Kılıç', approved_at = pg_temp.t(3010.45) WHERE id = '5a4e0004-0000-4000-8000-000000000029';
UPDATE public.proposal_versions SET approved_by_name = 'Selim Çakır', approved_at = pg_temp.t(3606.48) WHERE id = '5a4e0004-0000-4000-8000-000000000030';
UPDATE public.proposal_versions SET approved_by_name = 'Yasemin Erdoğan', approved_at = pg_temp.t(676.75) WHERE id = '5a4e0004-0000-4000-8000-000000000033';
UPDATE public.proposal_versions SET approved_by_name = 'Levent Avcı', approved_at = pg_temp.t(74.82) WHERE id = '5a4e0004-0000-4000-8000-000000000036';
UPDATE public.proposal_versions SET approved_by_name = 'Tuğçe Şahin', approved_at = pg_temp.t(3340.33) WHERE id = '5a4e0004-0000-4000-8000-000000000038';
UPDATE public.proposal_versions SET approved_by_name = 'Fulya Aslan', approved_at = pg_temp.t(1141.63) WHERE id = '5a4e0004-0000-4000-8000-000000000039';
UPDATE public.proposal_versions SET approved_by_name = 'Yiğit Soylu', approved_at = pg_temp.t(5609.15) WHERE id = '5a4e0004-0000-4000-8000-000000000042';
UPDATE public.proposal_versions SET approved_by_name = 'Uğur Erol', approved_at = pg_temp.t(3678.39) WHERE id = '5a4e0004-0000-4000-8000-000000000044';
UPDATE public.proposal_versions SET approved_by_name = 'Enes Koç', approved_at = pg_temp.t(4091.16) WHERE id = '5a4e0004-0000-4000-8000-000000000048';
UPDATE public.proposal_versions SET approved_by_name = 'Doruk Erdoğan', approved_at = pg_temp.t(30.07) WHERE id = '5a4e0004-0000-4000-8000-000000000051';
UPDATE public.proposal_versions SET approved_by_name = 'Doruk Erdoğan', approved_at = pg_temp.t(1694.20) WHERE id = '5a4e0004-0000-4000-8000-000000000067';
UPDATE public.proposal_versions SET approved_by_name = 'Doruk Erdoğan', approved_at = pg_temp.t(3412.73) WHERE id = '5a4e0004-0000-4000-8000-000000000068';
UPDATE public.proposal_versions SET approved_by_name = 'Gökhan Demir', approved_at = pg_temp.t(2820.28) WHERE id = '5a4e0004-0000-4000-8000-000000000080';
UPDATE public.proposal_versions SET approved_by_name = 'Doruk Erdoğan', approved_at = pg_temp.t(64.64) WHERE id = '5a4e0004-0000-4000-8000-000000000081';
UPDATE public.proposal_versions SET approved_by_name = 'Doruk Erdoğan', approved_at = pg_temp.t(1929.46) WHERE id = '5a4e0004-0000-4000-8000-000000000085';
UPDATE public.proposal_versions SET approved_by_name = 'Yiğit Soylu', approved_at = pg_temp.t(2679.71) WHERE id = '5a4e0004-0000-4000-8000-000000000088';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000001';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000002';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000003';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000004';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000005';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000006';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000007';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000008';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000009';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000010';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000011';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000012';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000013';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000014';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000015';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000016';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000017';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000018';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000019';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000020';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000021';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000022';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000023';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000024';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000025';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000026';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000027';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000028';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000029';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000030';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000031';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000032';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000033';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000034';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000035';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000036';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000037';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000038';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000039';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000040';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000041';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000042';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000043';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000044';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000045';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000046';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000047';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000048';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000049';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000050';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000051';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000052';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000053';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000054';
UPDATE public.proposals SET status = 'expired' WHERE id = '5a4e0003-0000-4000-8000-000000000055';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000056';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000057';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000058';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000059';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000060';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000061';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000062';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000063';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000064';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000065';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000066';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000067';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000068';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000069';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000070';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000071';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000072';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000073';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000074';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000075';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000076';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000077';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000078';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000079';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000080';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000081';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000082';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000083';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000084';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000085';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000086';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000087';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000088';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000089';
  PERFORM set_config('kashe.faz7_rpc', '0', true);
END $$;

INSERT INTO public.bookings (id, proposal_version_id, seller_provider_id, buyer_organization_id, customer_id, event_id, event_date, event_type, location, guest_count, total_amount, created_at)
VALUES
('5a4e0013-0000-4000-8000-000000000273', '5a4e0004-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000020001', NULL, NULL, '5a4e0002-0000-4000-8000-000000000001', pg_temp.d(-54), 'henna', 'İstanbul', 120, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000001'), pg_temp.t(3259.86)),
('5a4e0013-0000-4000-8000-000000000274', '5a4e0004-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000020001', NULL, '5a4e0000-0000-4000-8000-000000040009', '5a4e0002-0000-4000-8000-000000000002', pg_temp.d(-151), 'birthday', 'İstanbul', 80, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000002'), pg_temp.t(4990.45)),
('5a4e0013-0000-4000-8000-000000000275', '5a4e0004-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000020001', NULL, NULL, '5a4e0002-0000-4000-8000-000000000003', pg_temp.d(-39), 'corporate', 'İstanbul', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000004'), pg_temp.t(1284.88)),
('5a4e0013-0000-4000-8000-000000000276', '5a4e0004-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000020001', pg_temp.org('5a4e0000-0000-4000-8000-000000030004'), NULL, '5a4e0002-0000-4000-8000-000000000005', pg_temp.d(-155), 'launch', 'İstanbul', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000007'), pg_temp.t(4466.18)),
('5a4e0013-0000-4000-8000-000000000277', '5a4e0004-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000020002', NULL, NULL, '5a4e0002-0000-4000-8000-000000000006', pg_temp.d(-57), 'wedding', 'İstanbul', 100, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000008'), pg_temp.t(2692.73)),
('5a4e0013-0000-4000-8000-000000000278', '5a4e0004-0000-4000-8000-000000000013', '5a4e0000-0000-4000-8000-000000020002', pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), NULL, '5a4e0002-0000-4000-8000-000000000008', pg_temp.d(-127), 'concert', 'İstanbul', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000013'), pg_temp.t(3573.08)),
('5a4e0013-0000-4000-8000-000000000279', '5a4e0004-0000-4000-8000-000000000019', '5a4e0000-0000-4000-8000-000000020003', NULL, '5a4e0000-0000-4000-8000-000000040010', '5a4e0002-0000-4000-8000-000000000012', pg_temp.d(21), 'launch', 'Ankara', 200, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000019'), pg_temp.t(1498.87)),
('5a4e0013-0000-4000-8000-000000000280', '5a4e0004-0000-4000-8000-000000000029', '5a4e0000-0000-4000-8000-000000020005', NULL, '5a4e0000-0000-4000-8000-000000040019', '5a4e0002-0000-4000-8000-000000000018', pg_temp.d(-56), 'wedding', 'Muğla', 200, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000029'), pg_temp.t(3009.95)),
('5a4e0013-0000-4000-8000-000000000281', '5a4e0004-0000-4000-8000-000000000030', '5a4e0000-0000-4000-8000-000000020005', NULL, NULL, '5a4e0002-0000-4000-8000-000000000019', pg_temp.d(-137), 'wedding', 'İstanbul', 150, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000030'), pg_temp.t(3605.98)),
('5a4e0013-0000-4000-8000-000000000282', '5a4e0004-0000-4000-8000-000000000033', '5a4e0000-0000-4000-8000-000000020006', NULL, NULL, '5a4e0002-0000-4000-8000-000000000020', pg_temp.d(-6), 'launch', 'İstanbul', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000033'), pg_temp.t(676.25)),
('5a4e0013-0000-4000-8000-000000000283', '5a4e0004-0000-4000-8000-000000000036', '5a4e0000-0000-4000-8000-000000020006', NULL, NULL, '5a4e0002-0000-4000-8000-000000000021', pg_temp.d(51), 'wedding', 'İstanbul', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000036'), pg_temp.t(74.32)),
('5a4e0013-0000-4000-8000-000000000284', '5a4e0004-0000-4000-8000-000000000038', '5a4e0000-0000-4000-8000-000000020006', pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), NULL, '5a4e0002-0000-4000-8000-000000000022', pg_temp.d(-63), 'conference', 'İstanbul', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000038'), pg_temp.t(3339.83)),
('5a4e0013-0000-4000-8000-000000000285', '5a4e0004-0000-4000-8000-000000000039', '5a4e0000-0000-4000-8000-000000020006', pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), NULL, '5a4e0002-0000-4000-8000-000000000023', pg_temp.d(9), 'gala', 'İstanbul', 150, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000039'), pg_temp.t(1141.13)),
('5a4e0013-0000-4000-8000-000000000286', '5a4e0004-0000-4000-8000-000000000042', '5a4e0000-0000-4000-8000-000000020007', NULL, '5a4e0000-0000-4000-8000-000000040012', '5a4e0002-0000-4000-8000-000000000025', pg_temp.d(-162), 'corporate', 'Antalya', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000042'), pg_temp.t(5608.65)),
('5a4e0013-0000-4000-8000-000000000287', '5a4e0004-0000-4000-8000-000000000044', '5a4e0000-0000-4000-8000-000000020007', NULL, NULL, '5a4e0002-0000-4000-8000-000000000026', pg_temp.d(-94), 'corporate', 'Gaziantep', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000044'), pg_temp.t(3677.89)),
('5a4e0013-0000-4000-8000-000000000288', '5a4e0004-0000-4000-8000-000000000048', '5a4e0000-0000-4000-8000-000000020008', NULL, NULL, '5a4e0002-0000-4000-8000-000000000028', pg_temp.d(-92), 'launch', 'İstanbul', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000048'), pg_temp.t(4090.66)),
('5a4e0013-0000-4000-8000-000000000289', '5a4e0004-0000-4000-8000-000000000051', '5a4e0000-0000-4000-8000-000000020008', pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), NULL, '5a4e0002-0000-4000-8000-000000000031', pg_temp.d(54), 'fair', 'İstanbul', 200, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000051'), pg_temp.t(29.57)),
('5a4e0013-0000-4000-8000-000000000290', '5a4e0004-0000-4000-8000-000000000067', '5a4e0000-0000-4000-8000-000000020010', pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), NULL, '5a4e0002-0000-4000-8000-000000000039', pg_temp.d(2), 'launch', 'İstanbul', 150, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000067'), pg_temp.t(1693.70)),
('5a4e0013-0000-4000-8000-000000000291', '5a4e0004-0000-4000-8000-000000000068', '5a4e0000-0000-4000-8000-000000020010', pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), NULL, '5a4e0002-0000-4000-8000-000000000040', pg_temp.d(-96), 'launch', 'İstanbul', 80, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000068'), pg_temp.t(3412.23)),
('5a4e0013-0000-4000-8000-000000000292', '5a4e0004-0000-4000-8000-000000000080', '5a4e0000-0000-4000-8000-000000020012', NULL, '5a4e0000-0000-4000-8000-000000040011', '5a4e0002-0000-4000-8000-000000000046', pg_temp.d(-56), 'launch', 'Ankara', 50, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000080'), pg_temp.t(2819.78)),
('5a4e0013-0000-4000-8000-000000000293', '5a4e0004-0000-4000-8000-000000000081', '5a4e0000-0000-4000-8000-000000020012', pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), NULL, '5a4e0002-0000-4000-8000-000000000047', pg_temp.d(64), 'launch', 'Ankara', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000081'), pg_temp.t(64.14)),
('5a4e0013-0000-4000-8000-000000000294', '5a4e0004-0000-4000-8000-000000000085', '5a4e0000-0000-4000-8000-000000020012', pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), NULL, '5a4e0002-0000-4000-8000-000000000049', pg_temp.d(-15), 'corporate', 'Ankara', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000085'), pg_temp.t(1928.96)),
('5a4e0013-0000-4000-8000-000000000295', '5a4e0004-0000-4000-8000-000000000088', '5a4e0000-0000-4000-8000-000000020012', NULL, '5a4e0000-0000-4000-8000-000000040012', '5a4e0002-0000-4000-8000-000000000050', pg_temp.d(-35), 'conference', 'Ankara', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000088'), pg_temp.t(2679.21));

UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1272.00) WHERE id = '5a4e0013-0000-4000-8000-000000000273';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(3600.00) WHERE id = '5a4e0013-0000-4000-8000-000000000274';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(912.00) WHERE id = '5a4e0013-0000-4000-8000-000000000275';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(3696.00) WHERE id = '5a4e0013-0000-4000-8000-000000000276';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1344.00) WHERE id = '5a4e0013-0000-4000-8000-000000000277';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(3024.00) WHERE id = '5a4e0013-0000-4000-8000-000000000278';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1320.00) WHERE id = '5a4e0013-0000-4000-8000-000000000280';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(120.00) WHERE id = '5a4e0013-0000-4000-8000-000000000282';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1488.00) WHERE id = '5a4e0013-0000-4000-8000-000000000284';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(3864.00) WHERE id = '5a4e0013-0000-4000-8000-000000000286';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(2232.00) WHERE id = '5a4e0013-0000-4000-8000-000000000287';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(2280.00) WHERE id = '5a4e0013-0000-4000-8000-000000000291';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1320.00) WHERE id = '5a4e0013-0000-4000-8000-000000000292';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(336.00) WHERE id = '5a4e0013-0000-4000-8000-000000000294';

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
