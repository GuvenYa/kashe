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

INSERT INTO public.review_replies (review_id, body, created_at)
VALUES
('5a4e0014-0000-4000-8000-000000000004', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(928.20)),
('5a4e0014-0000-4000-8000-000000000005', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(3010.38)),
('5a4e0014-0000-4000-8000-000000000006', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(960.73)),
('5a4e0014-0000-4000-8000-000000000008', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(491.22)),
('5a4e0014-0000-4000-8000-000000000011', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(819.33)),
('5a4e0014-0000-4000-8000-000000000012', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(92.98)),
('5a4e0014-0000-4000-8000-000000000013', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(2524.17)),
('5a4e0014-0000-4000-8000-000000000014', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(1463.36)),
('5a4e0014-0000-4000-8000-000000000018', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(1296.17)),
('5a4e0014-0000-4000-8000-000000000021', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(0.10)),
('5a4e0014-0000-4000-8000-000000000022', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(2910.88)),
('5a4e0014-0000-4000-8000-000000000024', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(186.48)),
('5a4e0014-0000-4000-8000-000000000026', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(0.10)),
('5a4e0014-0000-4000-8000-000000000027', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(508.51)),
('5a4e0014-0000-4000-8000-000000000029', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(594.28)),
('5a4e0014-0000-4000-8000-000000000030', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(1743.51)),
('5a4e0014-0000-4000-8000-000000000031', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(760.05)),
('5a4e0014-0000-4000-8000-000000000032', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(87.12)),
('5a4e0014-0000-4000-8000-000000000033', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(3736.13)),
('5a4e0014-0000-4000-8000-000000000035', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(4.46)),
('5a4e0014-0000-4000-8000-000000000036', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(897.19)),
('5a4e0014-0000-4000-8000-000000000037', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(392.71)),
('5a4e0014-0000-4000-8000-000000000038', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(1119.32)),
('5a4e0014-0000-4000-8000-000000000039', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(647.35)),
('5a4e0014-0000-4000-8000-000000000040', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(0.10)),
('5a4e0014-0000-4000-8000-000000000043', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(0.10)),
('5a4e0014-0000-4000-8000-000000000044', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(0.10)),
('5a4e0014-0000-4000-8000-000000000045', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(831.72)),
('5a4e0014-0000-4000-8000-000000000046', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(1189.54)),
('5a4e0014-0000-4000-8000-000000000047', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(205.17)),
('5a4e0014-0000-4000-8000-000000000050', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(364.74)),
('5a4e0014-0000-4000-8000-000000000054', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(1227.15)),
('5a4e0014-0000-4000-8000-000000000055', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(58.36)),
('5a4e0014-0000-4000-8000-000000000056', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(148.44)),
('5a4e0014-0000-4000-8000-000000000057', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(1472.88)),
('5a4e0014-0000-4000-8000-000000000059', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(1093.70)),
('5a4e0014-0000-4000-8000-000000000060', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(0.10)),
('5a4e0014-0000-4000-8000-000000000063', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(779.24)),
('5a4e0014-0000-4000-8000-000000000064', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(157.57)),
('5a4e0014-0000-4000-8000-000000000065', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(94.69)),
('5a4e0014-0000-4000-8000-000000000066', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(1226.64)),
('5a4e0014-0000-4000-8000-000000000068', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(1065.24)),
('5a4e0014-0000-4000-8000-000000000069', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(47.87)),
('5a4e0014-0000-4000-8000-000000000070', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(430.09)),
('5a4e0014-0000-4000-8000-000000000073', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(276.72)),
('5a4e0014-0000-4000-8000-000000000074', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(47.24)),
('5a4e0014-0000-4000-8000-000000000078', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(0.10)),
('5a4e0014-0000-4000-8000-000000000082', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(0.42)),
('5a4e0014-0000-4000-8000-000000000083', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(412.14)),
('5a4e0014-0000-4000-8000-000000000086', 'Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!', pg_temp.t(668.62)),
('5a4e0014-0000-4000-8000-000000000089', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(496.19)),
('5a4e0014-0000-4000-8000-000000000092', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(720.55)),
('5a4e0014-0000-4000-8000-000000000093', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(868.98)),
('5a4e0014-0000-4000-8000-000000000095', 'Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.', pg_temp.t(653.61)),
('5a4e0014-0000-4000-8000-000000000098', 'Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler.', pg_temp.t(1301.85));

-- teklif kabul/red olaylari (durum UPDATE tetikleyicisi yerine dogrudan; zaman gecmis)

INSERT INTO public.analytics_events (event_name, entity_type, entity_id, provider_id, payload, occurred_at, actor_user_id)
SELECT v.ad, v.tip, v.eid::uuid, v.prov::uuid, v.payload, v.ts, v.actor::uuid FROM (VALUES
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 32000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1251.06), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 10000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(764.04), '5a4e0000-0000-4000-8000-000000040011'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010101', '{"total_amount": 19000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(230.00), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010009', '{"total_amount": 18500, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(2610.86), '5a4e0000-0000-4000-8000-000000040018'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010118', '{"total_amount": 48500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2486.64), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 43500, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(2296.72), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010009', '{"total_amount": 26000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1261.49), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 13000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1629.74), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010085', '{"total_amount": 9500, "event_type": "circumcision", "event_id": null}'::jsonb, pg_temp.t(3684.37), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000011', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 17000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1194.00), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000012', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 25000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1505.58), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000013', '5a4e0000-0000-4000-8000-000000010088', '{"total_amount": 7500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(54.39), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000014', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 62000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1274.38), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000015', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 20000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(676.16), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000016', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 38500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(383.23), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000017', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 33500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(119.49), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000018', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 57500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(187.32), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000019', '5a4e0000-0000-4000-8000-000000010028', '{"total_amount": 22000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(937.22), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000021', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 54500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1118.84), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000022', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 18500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(63.60), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000023', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 12500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(414.35), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000024', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 37500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1673.01), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000025', '5a4e0000-0000-4000-8000-000000010049', '{"total_amount": 3500, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(3778.73), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000026', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 16500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(832.01), '5a4e0000-0000-4000-8000-000000040008'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000027', '5a4e0000-0000-4000-8000-000000010109', '{"total_amount": 46500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(2990.16), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000028', '5a4e0000-0000-4000-8000-000000010079', '{"total_amount": 11000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(910.83), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000029', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 21000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(475.40), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000030', '5a4e0000-0000-4000-8000-000000010094', '{"total_amount": 45000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3564.67), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000031', '5a4e0000-0000-4000-8000-000000010038', '{"total_amount": 29500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3997.49), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000032', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 26000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1379.25), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000034', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 15000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1432.36), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000035', '5a4e0000-0000-4000-8000-000000010097', '{"total_amount": 9500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(3321.32), '5a4e0000-0000-4000-8000-000000030003'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000036', '5a4e0000-0000-4000-8000-000000010087', '{"total_amount": 13000, "event_type": "congress", "event_id": null}'::jsonb, pg_temp.t(3942.93), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000037', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 16000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(596.06), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000038', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 51000, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(888.66), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000039', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 57500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1404.26), '5a4e0000-0000-4000-8000-000000040011'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000041', '5a4e0000-0000-4000-8000-000000010102', '{"total_amount": 15000, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(3012.77), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000042', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 49500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1340.37), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000044', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 11500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1767.68), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000045', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 21000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1072.64), '5a4e0000-0000-4000-8000-000000030007'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000046', '5a4e0000-0000-4000-8000-000000010113', '{"total_amount": 29000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(2479.84), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000047', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 54000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1200.96), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000048', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 23000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1032.60), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000049', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 32500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(157.58), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000050', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 41500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(239.18), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000051', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 33000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1722.36), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000052', '5a4e0000-0000-4000-8000-000000010118', '{"total_amount": 60000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1827.08), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000053', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 33000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1278.98), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000054', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 30500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(345.00), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000055', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 58500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(585.41), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000056', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 15000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(174.13), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000057', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 20000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(483.63), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000059', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 20000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(316.43), '5a4e0000-0000-4000-8000-000000040003'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000060', '5a4e0000-0000-4000-8000-000000010105', '{"total_amount": 5000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2916.58), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000061', '5a4e0000-0000-4000-8000-000000010087', '{"total_amount": 15000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(189.00), '5a4e0000-0000-4000-8000-000000030002'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000062', '5a4e0000-0000-4000-8000-000000010122', '{"total_amount": 20000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(448.22), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000063', '5a4e0000-0000-4000-8000-000000010122', '{"total_amount": 19000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(344.18), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000065', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 10500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1737.44), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000066', '5a4e0000-0000-4000-8000-000000010109', '{"total_amount": 58500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2038.90), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000067', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 53500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1038.63), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000068', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 18000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(345.34), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000069', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 42500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1746.23), '5a4e0000-0000-4000-8000-000000031008'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000070', '5a4e0000-0000-4000-8000-000000010114', '{"total_amount": 40000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2633.91), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000071', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 35000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1179.77), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000072', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 24000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(838.46), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000073', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 23500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(525.35), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000074', '5a4e0000-0000-4000-8000-000000010064', '{"total_amount": 18000, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(142.99), '5a4e0000-0000-4000-8000-000000040007'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000075', '5a4e0000-0000-4000-8000-000000010107', '{"total_amount": 71000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3921.94), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000077', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 17000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(859.06), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000078', '5a4e0000-0000-4000-8000-000000010068', '{"total_amount": 12500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2212.06), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000079', '5a4e0000-0000-4000-8000-000000010001', '{"total_amount": 47500, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(1517.27), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000080', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 22000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(820.66), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000081', '5a4e0000-0000-4000-8000-000000010108', '{"total_amount": 61000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(2555.92), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000082', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 11000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(128.69), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000083', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 28500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(986.60), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000084', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 22500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(336.30), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000085', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 34000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(822.48), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000086', '5a4e0000-0000-4000-8000-000000010043', '{"total_amount": 78500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3081.97), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000088', '5a4e0000-0000-4000-8000-000000010059', '{"total_amount": 60500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3744.37), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000089', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 24500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1717.54), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000090', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 44500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1015.18), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000092', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 33000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1672.66), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000093', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 24000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(830.08), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000094', '5a4e0000-0000-4000-8000-000000010084', '{"total_amount": 6500, "event_type": "circumcision", "event_id": null}'::jsonb, pg_temp.t(3298.95), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000095', '5a4e0000-0000-4000-8000-000000010046', '{"total_amount": 263000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2328.50), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000096', '5a4e0000-0000-4000-8000-000000010102', '{"total_amount": 15000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3389.60), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000097', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 13500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1096.75), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000099', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 38000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(517.09), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000100', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 29000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(858.77), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000101', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 26000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(33.32), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000103', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 28000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(182.93), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000104', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 30500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1011.61), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000105', '5a4e0000-0000-4000-8000-000000010087', '{"total_amount": 6000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(1416.82), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000106', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 27500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(623.29), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000108', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 15500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1106.82), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000109', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 31000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1579.70), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000110', '5a4e0000-0000-4000-8000-000000010045', '{"total_amount": 51500, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(1996.84), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000111', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 38000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(391.95), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000112', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 44000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1407.68), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000113', '5a4e0000-0000-4000-8000-000000010056', '{"total_amount": 16500, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(1077.35), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000116', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 41000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(860.38), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000118', '5a4e0000-0000-4000-8000-000000010019', '{"total_amount": 26500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(2626.82), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000119', '5a4e0000-0000-4000-8000-000000010099', '{"total_amount": 28000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1424.42), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000120', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 31000, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(1884.72), '5a4e0000-0000-4000-8000-000000040012'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000121', '5a4e0000-0000-4000-8000-000000010077', '{"total_amount": 5500, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(2821.62), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000123', '5a4e0000-0000-4000-8000-000000010122', '{"total_amount": 21500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2570.81), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000124', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 38500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(286.16), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000125', '5a4e0000-0000-4000-8000-000000010062', '{"total_amount": 71500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1616.96), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000126', '5a4e0000-0000-4000-8000-000000010100', '{"total_amount": 14000, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(739.17), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000127', '5a4e0000-0000-4000-8000-000000010082', '{"total_amount": 11000, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(1540.66), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000129', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 47000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(332.28), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000130', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 18000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1324.62), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000131', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 16500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(560.12), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000132', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 44500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(545.40), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000133', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 30000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(926.76), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000134', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 32000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1229.45), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000136', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 38500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(392.79), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000137', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 32000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(266.52), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000138', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 63500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(110.21), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000139', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 27000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(148.97), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000140', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 21500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(370.84), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000141', '5a4e0000-0000-4000-8000-000000010005', '{"total_amount": 23500, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(3921.94), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000142', '5a4e0000-0000-4000-8000-000000010039', '{"total_amount": 38500, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(4011.35), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000143', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 37500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(60.04), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000144', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 31500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(763.53), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000145', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 21500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(487.67), '5a4e0000-0000-4000-8000-000000030001'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000146', '5a4e0000-0000-4000-8000-000000010097', '{"total_amount": 6000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2871.44), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000147', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 26000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(77.82), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000148', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 11500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1646.11), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000149', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 15500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(3605.06), '5a4e0000-0000-4000-8000-000000030007'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000150', '5a4e0000-0000-4000-8000-000000010110', '{"total_amount": 55500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(4026.60), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000151', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 26500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(516.62), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000152', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 13500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(806.19), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000153', '5a4e0000-0000-4000-8000-000000010073', '{"total_amount": 20000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(1703.17), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000154', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 30000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1707.87), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000155', '5a4e0000-0000-4000-8000-000000010092', '{"total_amount": 10500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2395.19), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000156', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 56000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1743.92), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000157', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 38000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(753.33), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000158', '5a4e0000-0000-4000-8000-000000010056', '{"total_amount": 8000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(183.98), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000159', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 13500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(946.84), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000160', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 27500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(807.46), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000161', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 35500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1644.04), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000163', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 62000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(980.52), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000166', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 28500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(380.40), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000167', '5a4e0000-0000-4000-8000-000000010016', '{"total_amount": 22000, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(880.41), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000168', '5a4e0000-0000-4000-8000-000000010034', '{"total_amount": 23500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1159.84), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000169', '5a4e0000-0000-4000-8000-000000010092', '{"total_amount": 47500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(4152.37), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000170', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 36000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(649.95), '5a4e0000-0000-4000-8000-000000040001'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000171', '5a4e0000-0000-4000-8000-000000010079', '{"total_amount": 18500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(2446.00), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000172', '5a4e0000-0000-4000-8000-000000010068', '{"total_amount": 6000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(930.33), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000173', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 36500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1365.74), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000174', '5a4e0000-0000-4000-8000-000000010062', '{"total_amount": 49500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3020.05), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000175', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 47000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(785.67), '5a4e0000-0000-4000-8000-000000031007'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000176', '5a4e0000-0000-4000-8000-000000010018', '{"total_amount": 25000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2343.08), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000177', '5a4e0000-0000-4000-8000-000000010059', '{"total_amount": 83000, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(2845.75), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000178', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 23500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1525.33), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000179', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 15000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(523.61), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000180', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 52000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1090.57), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000181', '5a4e0000-0000-4000-8000-000000010063', '{"total_amount": 64000, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(1685.61), '5a4e0000-0000-4000-8000-000000030005'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000182', '5a4e0000-0000-4000-8000-000000010084', '{"total_amount": 4500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(3946.81), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000183', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 14000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1017.03), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000184', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 26500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(211.15), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000185', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 54000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(142.17), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000186', '5a4e0000-0000-4000-8000-000000010089', '{"total_amount": 12000, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(3073.34), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000187', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 13000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1404.36), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000188', '5a4e0000-0000-4000-8000-000000010082', '{"total_amount": 21500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2060.50), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000189', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 46500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1187.30), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000190', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 24000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(933.97), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000191', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 30000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(473.51), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000192', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 16000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(417.52), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000193', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 31000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1275.33), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000195', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 34500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1177.91), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000196', '5a4e0000-0000-4000-8000-000000010019', '{"total_amount": 29500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(1682.42), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000197', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 32000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(570.01), '5a4e0000-0000-4000-8000-000000040007'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000198', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 39000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(1296.82), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000199', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 54000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(1193.32), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000200', '5a4e0000-0000-4000-8000-000000010043', '{"total_amount": 165000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2407.11), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000201', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 14000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(396.31), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000202', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 51500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1573.44), '5a4e0000-0000-4000-8000-000000031001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000203', '5a4e0000-0000-4000-8000-000000010043', '{"total_amount": 255500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1141.22), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000204', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 8500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1509.70), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000205', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 29500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(692.64), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000207', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 34000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1038.21), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000208', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 24000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(626.03), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000209', '5a4e0000-0000-4000-8000-000000010046', '{"total_amount": 273500, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(1596.92), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000210', '5a4e0000-0000-4000-8000-000000010074', '{"total_amount": 15500, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(1351.24), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000211', '5a4e0000-0000-4000-8000-000000010096', '{"total_amount": 5000, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(1907.11), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000212', '5a4e0000-0000-4000-8000-000000010082', '{"total_amount": 17500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(881.33), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000213', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 37000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(771.64), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000214', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 20500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(389.73), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000215', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 30500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1358.44), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000216', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 12000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(785.19), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000217', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 22500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1660.19), '5a4e0000-0000-4000-8000-000000031006'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000218', '5a4e0000-0000-4000-8000-000000010116', '{"total_amount": 49500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2653.15), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000219', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 54500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(151.77), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000220', '5a4e0000-0000-4000-8000-000000010055', '{"total_amount": 18500, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(2528.60), '5a4e0000-0000-4000-8000-000000031003'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000223', '5a4e0000-0000-4000-8000-000000010016', '{"total_amount": 11500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(4200.07), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000224', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 28000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1870.62), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000225', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 20500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(426.94), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000226', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 62500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1685.27), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000227', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 25500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(838.20), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000229', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 18000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1368.18), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000230', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 40000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1645.38), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000231', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 45500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(60.30), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000233', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 25500, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(1354.14), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000234', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 28000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(769.62), '5a4e0000-0000-4000-8000-000000040003'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000235', '5a4e0000-0000-4000-8000-000000010104', '{"total_amount": 6000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(2460.84), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000236', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 31000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1809.03), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000237', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 23500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1705.37), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000238', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 12000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(974.47), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000240', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 54500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1598.24), '5a4e0000-0000-4000-8000-000000040018'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000241', '5a4e0000-0000-4000-8000-000000010048', '{"total_amount": 3500, "event_type": "congress", "event_id": null}'::jsonb, pg_temp.t(3078.60), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000242', '5a4e0000-0000-4000-8000-000000010081', '{"total_amount": 27500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1239.85), '5a4e0000-0000-4000-8000-000000040018'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000243', '5a4e0000-0000-4000-8000-000000010008', '{"total_amount": 35500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1539.18), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000244', '5a4e0000-0000-4000-8000-000000010102', '{"total_amount": 23000, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(1043.63), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000245', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 12500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(158.45), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000246', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 49500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(505.18), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000247', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 40500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(688.81), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000248', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 34500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(871.09), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000249', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 30000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(147.55), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000250', '5a4e0000-0000-4000-8000-000000010088', '{"total_amount": 14500, "event_type": "congress", "event_id": null}'::jsonb, pg_temp.t(3482.71), '5a4e0000-0000-4000-8000-000000040002'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000251', '5a4e0000-0000-4000-8000-000000010061', '{"total_amount": 69000, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(590.92), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000252', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 45500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(736.24), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000253', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 35000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1759.53), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000254', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 20000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(401.55), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000255', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 44500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1126.37), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000256', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 24000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1578.73), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000257', '5a4e0000-0000-4000-8000-000000010061', '{"total_amount": 71000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(566.44), '5a4e0000-0000-4000-8000-000000040020'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000258', '5a4e0000-0000-4000-8000-000000010002', '{"total_amount": 41500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2312.17), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000259', '5a4e0000-0000-4000-8000-000000010064', '{"total_amount": 9500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(1973.04), '5a4e0000-0000-4000-8000-000000040002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000260', '5a4e0000-0000-4000-8000-000000010088', '{"total_amount": 7500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(659.13), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000261', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 37000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1493.49), '5a4e0000-0000-4000-8000-000000030007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000262', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 30500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1157.46), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000263', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 40000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1374.12), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000264', '5a4e0000-0000-4000-8000-000000010013', '{"total_amount": 28500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1167.60), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000265', '5a4e0000-0000-4000-8000-000000010104', '{"total_amount": 6500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(2489.44), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000266', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 45000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(778.25), '5a4e0000-0000-4000-8000-000000030006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000267', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 44000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1680.30), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000268', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 33000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(928.88), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000269', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 12000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1597.44), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000270', '5a4e0000-0000-4000-8000-000000010058', '{"total_amount": 23500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(2712.57), '5a4e0000-0000-4000-8000-000000030006'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000271', '5a4e0000-0000-4000-8000-000000010101', '{"total_amount": 24500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1002.76), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000272', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 57000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(231.37), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000273', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 11500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(566.52), '5a4e0000-0000-4000-8000-000000030002'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000274', '5a4e0000-0000-4000-8000-000000010073', '{"total_amount": 26500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(687.72), '5a4e0000-0000-4000-8000-000000040018'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000275', '5a4e0000-0000-4000-8000-000000010075', '{"total_amount": 11000, "event_type": "other", "event_id": null}'::jsonb, pg_temp.t(2444.81), '5a4e0000-0000-4000-8000-000000040019'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000277', '5a4e0000-0000-4000-8000-000000010047', '{"total_amount": 3500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(828.61), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000278', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 30000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(497.55), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000279', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 17500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1311.40), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000280', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 63500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1563.29), '5a4e0000-0000-4000-8000-000000040012'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000281', '5a4e0000-0000-4000-8000-000000010091', '{"total_amount": 23000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1699.91), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000282', '5a4e0000-0000-4000-8000-000000010044', '{"total_amount": 188000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2931.85), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000283', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 60500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(922.35), '5a4e0000-0000-4000-8000-000000040009'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000284', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 10000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(775.53), '5a4e0000-0000-4000-8000-000000040011'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000285', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 35500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1523.72), '5a4e0000-0000-4000-8000-000000030003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000286', '5a4e0000-0000-4000-8000-000000010068', '{"total_amount": 18000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(177.89), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000287', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 33500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(862.32), '5a4e0000-0000-4000-8000-000000040006'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000288', '5a4e0000-0000-4000-8000-000000010062', '{"total_amount": 35000, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(3845.73), '5a4e0000-0000-4000-8000-000000040001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000289', '5a4e0000-0000-4000-8000-000000010118', '{"total_amount": 51500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(3010.16), '5a4e0000-0000-4000-8000-000000040018'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000290', '5a4e0000-0000-4000-8000-000000010104', '{"total_amount": 6000, "event_type": "fair", "event_id": null}'::jsonb, pg_temp.t(2349.33), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000291', '5a4e0000-0000-4000-8000-000000010081', '{"total_amount": 28500, "event_type": "birthday", "event_id": null}'::jsonb, pg_temp.t(1065.27), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000292', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 35000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(951.19), '5a4e0000-0000-4000-8000-000000040014'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000293', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 60000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(726.66), '5a4e0000-0000-4000-8000-000000040007'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000295', '5a4e0000-0000-4000-8000-000000010059', '{"total_amount": 76000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(3680.09), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000296', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 45500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(452.38), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000298', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 32000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1412.49), '5a4e0000-0000-4000-8000-000000040006'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000300', '5a4e0000-0000-4000-8000-000000010096', '{"total_amount": 12000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(3247.60), '5a4e0000-0000-4000-8000-000000040003'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000301', '5a4e0000-0000-4000-8000-000000010008', '{"total_amount": 43000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(4092.07), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000302', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 17500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1440.75), '5a4e0000-0000-4000-8000-000000040005'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000303', '5a4e0000-0000-4000-8000-000000010115', '{"total_amount": 57500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(1799.25), '5a4e0000-0000-4000-8000-000000031005'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000304', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 20500, "event_type": "concert", "event_id": null}'::jsonb, pg_temp.t(3057.30), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000305', '5a4e0000-0000-4000-8000-000000010049', '{"total_amount": 3500, "event_type": "congress", "event_id": null}'::jsonb, pg_temp.t(3348.96), '5a4e0000-0000-4000-8000-000000030008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000307', '5a4e0000-0000-4000-8000-000000010073', '{"total_amount": 20500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1027.58), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000308', '5a4e0000-0000-4000-8000-000000010020', '{"total_amount": 37000, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(552.40), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000309', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 28000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(970.73), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000310', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 18000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(585.44), '5a4e0000-0000-4000-8000-000000031007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000313', '5a4e0000-0000-4000-8000-000000010049', '{"total_amount": 3500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(2322.68), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000315', '5a4e0000-0000-4000-8000-000000010045', '{"total_amount": 262000, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(91.47), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000316', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 22000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(465.84), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000318', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 31500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1146.50), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000319', '5a4e0000-0000-4000-8000-000000010026', '{"total_amount": 14500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(4008.85), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000320', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 34500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1380.82), '5a4e0000-0000-4000-8000-000000030001'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000321', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 12500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(879.78), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000322', '5a4e0000-0000-4000-8000-000000010008', '{"total_amount": 13000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(2580.37), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000323', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 35500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1652.58), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000324', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 34000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1337.19), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000325', '5a4e0000-0000-4000-8000-000000010053', '{"total_amount": 13500, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(576.20), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000326', '5a4e0000-0000-4000-8000-000000010040', '{"total_amount": 28500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1131.64), '5a4e0000-0000-4000-8000-000000031007'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000327', '5a4e0000-0000-4000-8000-000000010029', '{"total_amount": 50000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(690.57), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000328', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 35500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(304.83), '5a4e0000-0000-4000-8000-000000040006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000329', '5a4e0000-0000-4000-8000-000000010109', '{"total_amount": 58500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(3960.75), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000330', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 34500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1189.90), '5a4e0000-0000-4000-8000-000000031008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000331', '5a4e0000-0000-4000-8000-000000010015', '{"total_amount": 10500, "event_type": "gala", "event_id": null}'::jsonb, pg_temp.t(1219.83), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000332', '5a4e0000-0000-4000-8000-000000010084', '{"total_amount": 3500, "event_type": "circumcision", "event_id": null}'::jsonb, pg_temp.t(2615.60), '5a4e0000-0000-4000-8000-000000040004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000333', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 47000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(117.34), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000336', '5a4e0000-0000-4000-8000-000000010105', '{"total_amount": 10000, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(308.66), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000337', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 61000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1003.15), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000338', '5a4e0000-0000-4000-8000-000000010067', '{"total_amount": 8500, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(1435.07), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000339', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 37000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1640.85), '5a4e0000-0000-4000-8000-000000040016'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000340', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 20000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1292.26), '5a4e0000-0000-4000-8000-000000031003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000341', '5a4e0000-0000-4000-8000-000000010005', '{"total_amount": 37500, "event_type": "baby_shower", "event_id": null}'::jsonb, pg_temp.t(1497.88), '5a4e0000-0000-4000-8000-000000040008'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000343', '5a4e0000-0000-4000-8000-000000010021', '{"total_amount": 35000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1935.47), '5a4e0000-0000-4000-8000-000000030004'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000344', '5a4e0000-0000-4000-8000-000000010006', '{"total_amount": 24000, "event_type": "engagement", "event_id": null}'::jsonb, pg_temp.t(2676.90), '5a4e0000-0000-4000-8000-000000031006'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000345', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 43500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1327.56), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000348', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 24500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(1155.08), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000350', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 52000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(288.77), '5a4e0000-0000-4000-8000-000000040017'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000351', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 26000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(198.07), '5a4e0000-0000-4000-8000-000000030004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000352', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 20500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(168.01), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000353', '5a4e0000-0000-4000-8000-000000010093', '{"total_amount": 16000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2679.16), '5a4e0000-0000-4000-8000-000000030005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000354', '5a4e0000-0000-4000-8000-000000010023', '{"total_amount": 55000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1540.86), '5a4e0000-0000-4000-8000-000000040013'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000355', '5a4e0000-0000-4000-8000-000000010098', '{"total_amount": 11500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2081.74), '5a4e0000-0000-4000-8000-000000040010'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000356', '5a4e0000-0000-4000-8000-000000010004', '{"total_amount": 21000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(134.12), '5a4e0000-0000-4000-8000-000000040020'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000357', '5a4e0000-0000-4000-8000-000000010003', '{"total_amount": 39000, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(90.60), '5a4e0000-0000-4000-8000-000000031002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000359', '5a4e0000-0000-4000-8000-000000010020', '{"total_amount": 44500, "event_type": "corporate", "event_id": null}'::jsonb, pg_temp.t(2939.18), '5a4e0000-0000-4000-8000-000000031005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000360', '5a4e0000-0000-4000-8000-000000010033', '{"total_amount": 35000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1202.93), '5a4e0000-0000-4000-8000-000000030002'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000361', '5a4e0000-0000-4000-8000-000000010105', '{"total_amount": 9000, "event_type": "launch", "event_id": null}'::jsonb, pg_temp.t(1517.64), '5a4e0000-0000-4000-8000-000000040005'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000362', '5a4e0000-0000-4000-8000-000000010012', '{"total_amount": 9500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1134.48), '5a4e0000-0000-4000-8000-000000040014'),
('quote_declined', 'quote', '5a4e0012-0000-4000-8000-000000000363', '5a4e0000-0000-4000-8000-000000010053', '{"total_amount": 13500, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(3647.57), '5a4e0000-0000-4000-8000-000000031004'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000364', '5a4e0000-0000-4000-8000-000000010009', '{"total_amount": 16000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(3926.93), '5a4e0000-0000-4000-8000-000000040015'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000365', '5a4e0000-0000-4000-8000-000000010031', '{"total_amount": 29500, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(1685.12), '5a4e0000-0000-4000-8000-000000040003'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000366', '5a4e0000-0000-4000-8000-000000010022', '{"total_amount": 56000, "event_type": "wedding", "event_id": null}'::jsonb, pg_temp.t(4201.26), '5a4e0000-0000-4000-8000-000000040018'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000367', '5a4e0000-0000-4000-8000-000000010107', '{"total_amount": 22500, "event_type": "conference", "event_id": null}'::jsonb, pg_temp.t(1772.82), '5a4e0000-0000-4000-8000-000000040007'),
('quote_accepted', 'quote', '5a4e0012-0000-4000-8000-000000000368', '5a4e0000-0000-4000-8000-000000010074', '{"total_amount": 11000, "event_type": "henna", "event_id": null}'::jsonb, pg_temp.t(3694.91), '5a4e0000-0000-4000-8000-000000040007')
) AS v(ad, tip, eid, prov, payload, ts, actor)
ON CONFLICT (event_name, entity_id) DO NOTHING;

-- C) teklif topla (quote_requests): kurum uyeleri ve musterilerden 1-2

INSERT INTO public.quote_requests (id, customer_id, category_id, city_id, brief_data, event_date, event_type, budget_min, budget_max, response_deadline, recipient_count, status, created_at, created_by)
VALUES
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000040005', pg_temp.kat('influencer'), pg_temp.sehir('Ankara'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(36), 'launch', 10000, 40000, pg_temp.t(111.63), 4, 'active', pg_temp.t(231.63), '5a4e0000-0000-4000-8000-000000040005'),
('5a4e0030-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000040007', pg_temp.kat('tercuman'), pg_temp.sehir('Bursa'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(79), 'conference', 5000, 10000, pg_temp.t(173.58), 3, 'active', pg_temp.t(293.58), '5a4e0000-0000-4000-8000-000000040007'),
('5a4e0030-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000040004', pg_temp.kat('karikaturist'), pg_temp.sehir('İstanbul'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(66), 'launch', 4000, 9000, pg_temp.t(231.77), 3, 'active', pg_temp.t(351.77), '5a4e0000-0000-4000-8000-000000040004'),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000031004', pg_temp.kat('hostes'), pg_temp.sehir('İzmir'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(61), 'corporate', 2500, 3000, pg_temp.t(369.96), 4, 'active', pg_temp.t(489.96), '5a4e0000-0000-4000-8000-000000031004'),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000040013', pg_temp.kat('konusmaci'), pg_temp.sehir('İzmir'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(76), 'corporate', 15000, 45000, pg_temp.t(754.03), 4, 'active', pg_temp.t(874.03), '5a4e0000-0000-4000-8000-000000040013'),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000031005', pg_temp.kat('drone-pilotu'), pg_temp.sehir('İstanbul'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(66), 'launch', 6000, 15000, pg_temp.t(730.04), 4, 'active', pg_temp.t(850.04), '5a4e0000-0000-4000-8000-000000031005'),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000040006', pg_temp.kat('dj'), pg_temp.sehir('Bursa'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(30), 'gala', 8000, 22500, pg_temp.t(513.86), 4, 'active', pg_temp.t(633.86), '5a4e0000-0000-4000-8000-000000040006'),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000040018', pg_temp.kat('model'), pg_temp.sehir('Antalya'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(43), 'fair', 5000, 12500, pg_temp.t(674.08), 4, 'active', pg_temp.t(794.08), '5a4e0000-0000-4000-8000-000000040018'),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000040014', pg_temp.kat('illuzyonist'), pg_temp.sehir('İstanbul'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(88), 'corporate', 8000, 20000, pg_temp.t(603.13), 4, 'active', pg_temp.t(723.13), '5a4e0000-0000-4000-8000-000000040014'),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000040001', pg_temp.kat('stand-up-komedyen'), pg_temp.sehir('Ankara'), '{"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}'::jsonb, pg_temp.d(35), 'launch', 10000, 30000, pg_temp.t(261.08), 4, 'active', pg_temp.t(381.08), '5a4e0000-0000-4000-8000-000000040001');

INSERT INTO public.quote_request_recipients (request_id, professional_id, status, created_at)
VALUES
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010115', 'viewed', pg_temp.t(231.63)),
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010116', 'sent', pg_temp.t(231.63)),
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010117', 'viewed', pg_temp.t(231.63)),
('5a4e0030-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000010118', 'viewed', pg_temp.t(231.63)),
('5a4e0030-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000010087', 'declined', pg_temp.t(293.58)),
('5a4e0030-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000010088', 'viewed', pg_temp.t(293.58)),
('5a4e0030-0000-4000-8000-000000000002', '5a4e0000-0000-4000-8000-000000010089', 'viewed', pg_temp.t(293.58)),
('5a4e0030-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000010096', 'viewed', pg_temp.t(351.77)),
('5a4e0030-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000010097', 'sent', pg_temp.t(351.77)),
('5a4e0030-0000-4000-8000-000000000003', '5a4e0000-0000-4000-8000-000000010098', 'sent', pg_temp.t(351.77)),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010047', 'viewed', pg_temp.t(489.96)),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010048', 'sent', pg_temp.t(489.96)),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010049', 'sent', pg_temp.t(489.96)),
('5a4e0030-0000-4000-8000-000000000004', '5a4e0000-0000-4000-8000-000000010051', 'sent', pg_temp.t(489.96)),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010107', 'viewed', pg_temp.t(874.03)),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010108', 'viewed', pg_temp.t(874.03)),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010109', 'declined', pg_temp.t(874.03)),
('5a4e0030-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000010110', 'declined', pg_temp.t(874.03)),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010119', 'declined', pg_temp.t(850.04)),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010120', 'viewed', pg_temp.t(850.04)),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010121', 'viewed', pg_temp.t(850.04)),
('5a4e0030-0000-4000-8000-000000000006', '5a4e0000-0000-4000-8000-000000010122', 'viewed', pg_temp.t(850.04)),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010012', 'sent', pg_temp.t(633.86)),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010013', 'sent', pg_temp.t(633.86)),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010015', 'viewed', pg_temp.t(633.86)),
('5a4e0030-0000-4000-8000-000000000007', '5a4e0000-0000-4000-8000-000000010016', 'viewed', pg_temp.t(633.86)),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010064', 'declined', pg_temp.t(794.08)),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010065', 'sent', pg_temp.t(794.08)),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010067', 'sent', pg_temp.t(794.08)),
('5a4e0030-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000010068', 'viewed', pg_temp.t(794.08)),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010079', 'viewed', pg_temp.t(723.13)),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010080', 'sent', pg_temp.t(723.13)),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010081', 'sent', pg_temp.t(723.13)),
('5a4e0030-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000010082', 'declined', pg_temp.t(723.13)),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010091', 'declined', pg_temp.t(381.08)),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010092', 'declined', pg_temp.t(381.08)),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010093', 'viewed', pg_temp.t(381.08)),
('5a4e0030-0000-4000-8000-000000000010', '5a4e0000-0000-4000-8000-000000010094', 'sent', pg_temp.t(381.08));

-- D) ajans teklifleri: proposals/versions/items (kashe.faz7_rpc bayragi), gonderim, onay/red, FAZ 7c rezervasyon

DO $$
BEGIN
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  INSERT INTO public.proposals (id, seller_organization_id, seller_provider_id, buyer_user_id, buyer_organization_id, event_id, title, client_name, client_email, source_type, created_by, created_at, updated_at)
  VALUES
('5a4e0003-0000-4000-8000-000000000001', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, NULL, '5a4e0002-0000-4000-8000-000000000001', 'Ece Kına Gecesi — Tam kapsam teklifi', 'Serkan Güler', 'serkan-guler@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(3324.63), pg_temp.t(3324.63)),
('5a4e0003-0000-4000-8000-000000000002', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, NULL, '5a4e0002-0000-4000-8000-000000000002', 'Yasemin Doğum Günü Partisi — Çekim ve içerik', 'Deniz Öz', 'deniz-oz@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(5071.38), pg_temp.t(5071.38)),
('5a4e0003-0000-4000-8000-000000000003', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030004'), '5a4e0002-0000-4000-8000-000000000003', 'Marmara Perakende Grubu Bayi Toplantısı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(1471.41), pg_temp.t(1471.41)),
('5a4e0003-0000-4000-8000-000000000004', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', '5a4e0000-0000-4000-8000-000000040011', NULL, '5a4e0002-0000-4000-8000-000000000004', 'Melis ve Yusuf Düğün Daveti — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(533.33), pg_temp.t(533.33)),
('5a4e0003-0000-4000-8000-000000000005', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000005', 'Akdeniz Gıda Yeni Sezon Lansmanı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(4462.97), pg_temp.t(4462.97)),
('5a4e0003-0000-4000-8000-000000000006', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000005', 'Akdeniz Gıda Yeni Sezon Lansmanı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(4466.46), pg_temp.t(4466.46)),
('5a4e0003-0000-4000-8000-000000000007', pg_temp.org('5a4e0000-0000-4000-8000-000000020001'), '5a4e0000-0000-4000-8000-000000020001', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000005', 'Akdeniz Gıda Yeni Sezon Lansmanı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(4453.79), pg_temp.t(4453.79)),
('5a4e0003-0000-4000-8000-000000000008', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, NULL, '5a4e0002-0000-4000-8000-000000000006', 'Hazal & Eren Düğünü — Tam kapsam teklifi', 'Tarık Şahin', 'tarik-sahin@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2868.82), pg_temp.t(2868.82)),
('5a4e0003-0000-4000-8000-000000000009', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', '5a4e0000-0000-4000-8000-000000040007', NULL, '5a4e0002-0000-4000-8000-000000000007', 'Mavi Deniz Turizm Fuar Standı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2090.30), pg_temp.t(2090.30)),
('5a4e0003-0000-4000-8000-000000000010', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000007', 'Mavi Deniz Turizm Fuar Standı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2117.80), pg_temp.t(2117.80)),
('5a4e0003-0000-4000-8000-000000000011', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000007', 'Mavi Deniz Turizm Fuar Standı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2118.63), pg_temp.t(2118.63)),
('5a4e0003-0000-4000-8000-000000000012', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', '5a4e0000-0000-4000-8000-000000040003', NULL, '5a4e0002-0000-4000-8000-000000000008', 'Boğaziçi Finans Yaz Konseri — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3598.30), pg_temp.t(3598.30)),
('5a4e0003-0000-4000-8000-000000000013', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000008', 'Boğaziçi Finans Yaz Konseri — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3597.87), pg_temp.t(3597.87)),
('5a4e0003-0000-4000-8000-000000000014', pg_temp.org('5a4e0000-0000-4000-8000-000000020002'), '5a4e0000-0000-4000-8000-000000020002', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030008'), '5a4e0002-0000-4000-8000-000000000008', 'Boğaziçi Finans Yaz Konseri — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3602.13), pg_temp.t(3602.13)),
('5a4e0003-0000-4000-8000-000000000015', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', '5a4e0000-0000-4000-8000-000000040008', NULL, '5a4e0002-0000-4000-8000-000000000009', 'Teknopark Yazılım A.Ş. Ürün Lansmanı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(195.54), pg_temp.t(195.54)),
('5a4e0003-0000-4000-8000-000000000016', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', NULL, NULL, '5a4e0002-0000-4000-8000-000000000010', 'Gül & Mert Düğünü — Sahne ve müzik', 'Emre Erol', 'emre-erol@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(714.13), pg_temp.t(714.13)),
('5a4e0003-0000-4000-8000-000000000017', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', NULL, NULL, '5a4e0002-0000-4000-8000-000000000011', 'Selin ve Kaan Düğün Daveti — Tam kapsam teklifi', 'Sinan Güler', 'sinan-guler@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(2932.47), pg_temp.t(2932.47)),
('5a4e0003-0000-4000-8000-000000000018', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000012', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(1578.37), pg_temp.t(1578.37)),
('5a4e0003-0000-4000-8000-000000000019', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000012', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(1579.65), pg_temp.t(1579.65)),
('5a4e0003-0000-4000-8000-000000000020', pg_temp.org('5a4e0000-0000-4000-8000-000000020003'), '5a4e0000-0000-4000-8000-000000020003', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000012', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(1581.75), pg_temp.t(1581.75)),
('5a4e0003-0000-4000-8000-000000000021', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', NULL, NULL, '5a4e0002-0000-4000-8000-000000000013', 'Boğaziçi Finans Bayi Toplantısı — Çekim ve içerik', 'Deniz Güler', 'deniz-guler@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(922.66), pg_temp.t(922.66)),
('5a4e0003-0000-4000-8000-000000000022', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', '5a4e0000-0000-4000-8000-000000040015', NULL, '5a4e0002-0000-4000-8000-000000000014', 'Yasemin & Alp Nişanı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1083.86), pg_temp.t(1083.86)),
('5a4e0003-0000-4000-8000-000000000023', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', NULL, NULL, '5a4e0002-0000-4000-8000-000000000014', 'Yasemin & Alp Nişanı — Sahne ve müzik', 'Pınar Toprak', 'pinar-toprak@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1080.85), pg_temp.t(1080.85)),
('5a4e0003-0000-4000-8000-000000000024', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', '5a4e0000-0000-4000-8000-000000040018', NULL, '5a4e0002-0000-4000-8000-000000000014', 'Yasemin & Alp Nişanı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1075.49), pg_temp.t(1075.49)),
('5a4e0003-0000-4000-8000-000000000025', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', '5a4e0000-0000-4000-8000-000000040018', NULL, '5a4e0002-0000-4000-8000-000000000015', 'Eda ve Volkan Düğün Daveti — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(205.79), pg_temp.t(205.79)),
('5a4e0003-0000-4000-8000-000000000026', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', NULL, NULL, '5a4e0002-0000-4000-8000-000000000015', 'Eda ve Volkan Düğün Daveti — Organizasyon teklifi', 'Koray Bulut', 'koray-bulut@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(218.99), pg_temp.t(218.99)),
('5a4e0003-0000-4000-8000-000000000027', pg_temp.org('5a4e0000-0000-4000-8000-000000020004'), '5a4e0000-0000-4000-8000-000000020004', '5a4e0000-0000-4000-8000-000000040007', NULL, '5a4e0002-0000-4000-8000-000000000015', 'Eda ve Volkan Düğün Daveti — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(228.05), pg_temp.t(228.05)),
('5a4e0003-0000-4000-8000-000000000028', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', '5a4e0000-0000-4000-8000-000000040017', NULL, '5a4e0002-0000-4000-8000-000000000016', 'İrem ve Levent Düğün Daveti — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(2185.53), pg_temp.t(2185.53)),
('5a4e0003-0000-4000-8000-000000000029', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', NULL, NULL, '5a4e0002-0000-4000-8000-000000000017', 'Fulya ve Tolga Düğün Daveti — Çekim ve içerik', 'Cansu Keskin', 'cansu-keskin@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(1425.03), pg_temp.t(1425.03)),
('5a4e0003-0000-4000-8000-000000000030', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', '5a4e0000-0000-4000-8000-000000040012', NULL, '5a4e0002-0000-4000-8000-000000000018', 'Leyla ve Halil Düğün Daveti — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3006.61), pg_temp.t(3006.61)),
('5a4e0003-0000-4000-8000-000000000031', pg_temp.org('5a4e0000-0000-4000-8000-000000020005'), '5a4e0000-0000-4000-8000-000000020005', '5a4e0000-0000-4000-8000-000000040003', NULL, '5a4e0002-0000-4000-8000-000000000019', 'Sevgi ve Burak Düğün Daveti — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3806.65), pg_temp.t(3806.65)),
('5a4e0003-0000-4000-8000-000000000032', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000020', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(767.50), pg_temp.t(767.50)),
('5a4e0003-0000-4000-8000-000000000033', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, NULL, '5a4e0002-0000-4000-8000-000000000020', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Teknik paket', 'Leyla Güneş', 'leyla-gunes@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(785.33), pg_temp.t(785.33)),
('5a4e0003-0000-4000-8000-000000000034', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', '5a4e0000-0000-4000-8000-000000040001', NULL, '5a4e0002-0000-4000-8000-000000000021', 'Ayşe & Koray Düğünü — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(223.58), pg_temp.t(223.58)),
('5a4e0003-0000-4000-8000-000000000035', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, NULL, '5a4e0002-0000-4000-8000-000000000022', 'Marmara Perakende Grubu Teknoloji Konferansı — Çekim ve içerik', 'Oğuz Koç', 'oguz-koc@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(3441.77), pg_temp.t(3441.77)),
('5a4e0003-0000-4000-8000-000000000036', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000022', 'Marmara Perakende Grubu Teknoloji Konferansı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(3450.87), pg_temp.t(3450.87)),
('5a4e0003-0000-4000-8000-000000000037', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000023', 'Teknopark Yazılım A.Ş. Gala Yemeği — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(1389.35), pg_temp.t(1389.35)),
('5a4e0003-0000-4000-8000-000000000038', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000023', 'Teknopark Yazılım A.Ş. Gala Yemeği — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(1377.10), pg_temp.t(1377.10)),
('5a4e0003-0000-4000-8000-000000000039', pg_temp.org('5a4e0000-0000-4000-8000-000000020006'), '5a4e0000-0000-4000-8000-000000020006', NULL, NULL, '5a4e0002-0000-4000-8000-000000000023', 'Teknopark Yazılım A.Ş. Gala Yemeği — Organizasyon teklifi', 'Görkem Toprak', 'gorkem-toprak@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(1385.13), pg_temp.t(1385.13)),
('5a4e0003-0000-4000-8000-000000000040', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, NULL, '5a4e0002-0000-4000-8000-000000000024', 'Tuğçe ve Fatih Düğün Daveti — Tam kapsam teklifi', 'Selim Kara', 'selim-kara@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3206.94), pg_temp.t(3206.94)),
('5a4e0003-0000-4000-8000-000000000041', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000025', 'Mavi Deniz Turizm Şirket Pikniği — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5753.99), pg_temp.t(5753.99)),
('5a4e0003-0000-4000-8000-000000000042', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', '5a4e0000-0000-4000-8000-000000040010', NULL, '5a4e0002-0000-4000-8000-000000000025', 'Mavi Deniz Turizm Şirket Pikniği — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5747.27), pg_temp.t(5747.27)),
('5a4e0003-0000-4000-8000-000000000043', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030008'), '5a4e0002-0000-4000-8000-000000000025', 'Mavi Deniz Turizm Şirket Pikniği — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5717.11), pg_temp.t(5717.11)),
('5a4e0003-0000-4000-8000-000000000044', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030004'), '5a4e0002-0000-4000-8000-000000000026', 'Başkent Eğitim Kurumları Bayi Toplantısı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3871.09), pg_temp.t(3871.09)),
('5a4e0003-0000-4000-8000-000000000045', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000026', 'Başkent Eğitim Kurumları Bayi Toplantısı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3905.39), pg_temp.t(3905.39)),
('5a4e0003-0000-4000-8000-000000000046', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', '5a4e0000-0000-4000-8000-000000040014', NULL, '5a4e0002-0000-4000-8000-000000000027', 'Gizem Kına Gecesi — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(2568.63), pg_temp.t(2568.63)),
('5a4e0003-0000-4000-8000-000000000047', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, NULL, '5a4e0002-0000-4000-8000-000000000027', 'Gizem Kına Gecesi — Teknik paket', 'İrem Çetin', 'irem-cetin@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(2561.42), pg_temp.t(2561.42)),
('5a4e0003-0000-4000-8000-000000000048', pg_temp.org('5a4e0000-0000-4000-8000-000000020007'), '5a4e0000-0000-4000-8000-000000020007', NULL, NULL, '5a4e0002-0000-4000-8000-000000000027', 'Gizem Kına Gecesi — Organizasyon teklifi', 'Murat Erdem', 'murat-erdem@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(2564.24), pg_temp.t(2564.24)),
('5a4e0003-0000-4000-8000-000000000049', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000028', 'Boğaziçi Finans Ürün Lansmanı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4188.73), pg_temp.t(4188.73)),
('5a4e0003-0000-4000-8000-000000000050', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000029', 'Ege Otomotiv Fuar Katılımı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4714.99), pg_temp.t(4714.99)),
('5a4e0003-0000-4000-8000-000000000051', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', '5a4e0000-0000-4000-8000-000000040002', NULL, '5a4e0002-0000-4000-8000-000000000029', 'Ege Otomotiv Fuar Katılımı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4745.28), pg_temp.t(4745.28)),
('5a4e0003-0000-4000-8000-000000000052', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', '5a4e0000-0000-4000-8000-000000040008', NULL, '5a4e0002-0000-4000-8000-000000000030', 'Marmara Perakende Grubu Fuar Katılımı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4506.96), pg_temp.t(4506.96)),
('5a4e0003-0000-4000-8000-000000000053', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000031', 'Boğaziçi Finans Fuar Standı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(193.26), pg_temp.t(193.26)),
('5a4e0003-0000-4000-8000-000000000054', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000031', 'Boğaziçi Finans Fuar Standı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(197.95), pg_temp.t(197.95)),
('5a4e0003-0000-4000-8000-000000000055', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, NULL, '5a4e0002-0000-4000-8000-000000000031', 'Boğaziçi Finans Fuar Standı — Tam kapsam teklifi', 'Leyla Aktaş', 'leyla-aktas@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(195.55), pg_temp.t(195.55)),
('5a4e0003-0000-4000-8000-000000000056', pg_temp.org('5a4e0000-0000-4000-8000-000000020008'), '5a4e0000-0000-4000-8000-000000020008', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000032', 'Başkent Eğitim Kurumları Çalışan Buluşması — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(194.43), pg_temp.t(194.43)),
('5a4e0003-0000-4000-8000-000000000057', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000033', 'Teknopark Yazılım A.Ş. Ödül Gecesi — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3055.02), pg_temp.t(3055.02)),
('5a4e0003-0000-4000-8000-000000000058', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000033', 'Teknopark Yazılım A.Ş. Ödül Gecesi — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3054.87), pg_temp.t(3054.87)),
('5a4e0003-0000-4000-8000-000000000059', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000033', 'Teknopark Yazılım A.Ş. Ödül Gecesi — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3025.78), pg_temp.t(3025.78)),
('5a4e0003-0000-4000-8000-000000000060', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000034', 'Anadolu İlaç Fuar Standı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(2827.00), pg_temp.t(2827.00)),
('5a4e0003-0000-4000-8000-000000000061', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', '5a4e0000-0000-4000-8000-000000040013', NULL, '5a4e0002-0000-4000-8000-000000000034', 'Anadolu İlaç Fuar Standı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(2785.72), pg_temp.t(2785.72)),
('5a4e0003-0000-4000-8000-000000000062', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', '5a4e0000-0000-4000-8000-000000040011', NULL, '5a4e0002-0000-4000-8000-000000000035', 'Teknopark Yazılım A.Ş. Bayi Toplantısı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1009.31), pg_temp.t(1009.31)),
('5a4e0003-0000-4000-8000-000000000063', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000036', 'Anadolu İlaç Liderlik Zirvesi — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3711.88), pg_temp.t(3711.88)),
('5a4e0003-0000-4000-8000-000000000064', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030008'), '5a4e0002-0000-4000-8000-000000000036', 'Anadolu İlaç Liderlik Zirvesi — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3682.70), pg_temp.t(3682.70)),
('5a4e0003-0000-4000-8000-000000000065', pg_temp.org('5a4e0000-0000-4000-8000-000000020009'), '5a4e0000-0000-4000-8000-000000020009', '5a4e0000-0000-4000-8000-000000040007', NULL, '5a4e0002-0000-4000-8000-000000000037', 'Ege Otomotiv Şirket Pikniği — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1460.71), pg_temp.t(1460.71)),
('5a4e0003-0000-4000-8000-000000000066', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000038', 'Boğaziçi Finans Yeni Sezon Lansmanı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(209.21), pg_temp.t(209.21)),
('5a4e0003-0000-4000-8000-000000000067', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', '5a4e0000-0000-4000-8000-000000040008', NULL, '5a4e0002-0000-4000-8000-000000000039', 'Başkent Eğitim Kurumları Yeni Sezon Lansmanı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(1818.33), pg_temp.t(1818.33)),
('5a4e0003-0000-4000-8000-000000000068', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000040', 'Marmara Perakende Grubu Yeni Sezon Lansmanı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(3649.67), pg_temp.t(3649.67)),
('5a4e0003-0000-4000-8000-000000000069', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, NULL, '5a4e0002-0000-4000-8000-000000000041', 'Marmara Perakende Grubu Yıl Sonu Partisi — Çekim ve içerik', 'Yasemin Yılmaz', 'yasemin-yilmaz@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(213.93), pg_temp.t(213.93)),
('5a4e0003-0000-4000-8000-000000000070', pg_temp.org('5a4e0000-0000-4000-8000-000000020010'), '5a4e0000-0000-4000-8000-000000020010', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000042', 'Akdeniz Gıda Fuar Katılımı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(3425.05), pg_temp.t(3425.05)),
('5a4e0003-0000-4000-8000-000000000071', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', '5a4e0000-0000-4000-8000-000000040004', NULL, '5a4e0002-0000-4000-8000-000000000043', 'Selin ve Umut Düğün Daveti — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(3538.46), pg_temp.t(3538.46)),
('5a4e0003-0000-4000-8000-000000000072', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', NULL, NULL, '5a4e0002-0000-4000-8000-000000000044', 'Melike & Utku Düğünü — Tam kapsam teklifi', 'Kerem Turan', 'kerem-turan@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1432.26), pg_temp.t(1432.26)),
('5a4e0003-0000-4000-8000-000000000073', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', '5a4e0000-0000-4000-8000-000000040020', NULL, '5a4e0002-0000-4000-8000-000000000044', 'Melike & Utku Düğünü — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1422.11), pg_temp.t(1422.11)),
('5a4e0003-0000-4000-8000-000000000074', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', NULL, NULL, '5a4e0002-0000-4000-8000-000000000044', 'Melike & Utku Düğünü — Teknik paket', 'Nazlı Kaplan', 'nazli-kaplan@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1418.40), pg_temp.t(1418.40)),
('5a4e0003-0000-4000-8000-000000000075', pg_temp.org('5a4e0000-0000-4000-8000-000000020011'), '5a4e0000-0000-4000-8000-000000020011', '5a4e0000-0000-4000-8000-000000040016', NULL, '5a4e0002-0000-4000-8000-000000000045', 'Seda ve Alp Düğün Daveti — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(520.81), pg_temp.t(520.81)),
('5a4e0003-0000-4000-8000-000000000076', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), '5a4e0002-0000-4000-8000-000000000046', 'Marmara Perakende Grubu Ürün Lansmanı — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3024.69), pg_temp.t(3024.69)),
('5a4e0003-0000-4000-8000-000000000077', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000046', 'Marmara Perakende Grubu Ürün Lansmanı — Organizasyon teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3068.97), pg_temp.t(3068.97)),
('5a4e0003-0000-4000-8000-000000000078', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, NULL, '5a4e0002-0000-4000-8000-000000000046', 'Marmara Perakende Grubu Ürün Lansmanı — Organizasyon teklifi', 'Murat Kaplan', 'murat-kaplan@example.com', 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3030.99), pg_temp.t(3030.99)),
('5a4e0003-0000-4000-8000-000000000079', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), '5a4e0002-0000-4000-8000-000000000047', 'Anadolu İlaç Yeni Sezon Lansmanı — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(198.08), pg_temp.t(198.08)),
('5a4e0003-0000-4000-8000-000000000080', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030004'), '5a4e0002-0000-4000-8000-000000000047', 'Anadolu İlaç Yeni Sezon Lansmanı — Teknik paket', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(236.28), pg_temp.t(236.28)),
('5a4e0003-0000-4000-8000-000000000081', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000047', 'Anadolu İlaç Yeni Sezon Lansmanı — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(204.25), pg_temp.t(204.25)),
('5a4e0003-0000-4000-8000-000000000082', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), '5a4e0002-0000-4000-8000-000000000048', 'Başkent Eğitim Kurumları Liderlik Zirvesi — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3900.43), pg_temp.t(3900.43)),
('5a4e0003-0000-4000-8000-000000000083', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), '5a4e0002-0000-4000-8000-000000000049', 'Ege Otomotiv Şirket Pikniği — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2172.28), pg_temp.t(2172.28)),
('5a4e0003-0000-4000-8000-000000000084', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000050', 'Ege Otomotiv Liderlik Zirvesi — Tam kapsam teklifi', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2740.08), pg_temp.t(2740.08)),
('5a4e0003-0000-4000-8000-000000000085', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030005'), '5a4e0002-0000-4000-8000-000000000050', 'Ege Otomotiv Liderlik Zirvesi — Sahne ve müzik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2736.51), pg_temp.t(2736.51)),
('5a4e0003-0000-4000-8000-000000000086', pg_temp.org('5a4e0000-0000-4000-8000-000000020012'), '5a4e0000-0000-4000-8000-000000020012', NULL, pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), '5a4e0002-0000-4000-8000-000000000050', 'Ege Otomotiv Liderlik Zirvesi — Çekim ve içerik', NULL, NULL, 'direct', '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2728.68), pg_temp.t(2728.68));
  INSERT INTO public.proposal_versions (id, proposal_id, version_no, tax_rate, notes, valid_until, created_by, created_at, updated_at)
  VALUES
('5a4e0004-0000-4000-8000-000000000001', '5a4e0003-0000-4000-8000-000000000001', 1, 0.20, NULL, pg_temp.t(2944.09), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(3324.63), pg_temp.t(3324.63)),
('5a4e0004-0000-4000-8000-000000000002', '5a4e0003-0000-4000-8000-000000000002', 1, 0.20, NULL, pg_temp.t(4673.12), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(5071.38), pg_temp.t(5071.38)),
('5a4e0004-0000-4000-8000-000000000003', '5a4e0003-0000-4000-8000-000000000003', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1096.23), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(1471.41), pg_temp.t(1471.41)),
('5a4e0004-0000-4000-8000-000000000004', '5a4e0003-0000-4000-8000-000000000004', 1, 0.20, NULL, pg_temp.t(181.00), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(533.33), pg_temp.t(533.33)),
('5a4e0004-0000-4000-8000-000000000005', '5a4e0003-0000-4000-8000-000000000005', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(4117.49), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(4462.97), pg_temp.t(4462.97)),
('5a4e0004-0000-4000-8000-000000000006', '5a4e0003-0000-4000-8000-000000000006', 1, 0.20, NULL, pg_temp.t(4073.22), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(4466.46), pg_temp.t(4466.46)),
('5a4e0004-0000-4000-8000-000000000007', '5a4e0003-0000-4000-8000-000000000007', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(4048.05), '5a4e0000-0000-4000-8000-000000020001', pg_temp.t(4453.79), pg_temp.t(4453.79)),
('5a4e0004-0000-4000-8000-000000000008', '5a4e0003-0000-4000-8000-000000000008', 1, 0.20, NULL, pg_temp.t(2488.46), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2868.82), pg_temp.t(2868.82)),
('5a4e0004-0000-4000-8000-000000000009', '5a4e0003-0000-4000-8000-000000000009', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1716.49), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2090.30), pg_temp.t(2090.30)),
('5a4e0004-0000-4000-8000-000000000010', '5a4e0003-0000-4000-8000-000000000010', 1, 0.20, NULL, pg_temp.t(1750.68), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2117.80), pg_temp.t(2117.80)),
('5a4e0004-0000-4000-8000-000000000011', '5a4e0003-0000-4000-8000-000000000011', 1, 0.20, NULL, pg_temp.t(1751.10), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(2118.63), pg_temp.t(2118.63)),
('5a4e0004-0000-4000-8000-000000000012', '5a4e0003-0000-4000-8000-000000000012', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3219.40), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3598.30), pg_temp.t(3598.30)),
('5a4e0004-0000-4000-8000-000000000013', '5a4e0003-0000-4000-8000-000000000013', 1, 0.20, NULL, pg_temp.t(3256.91), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3597.87), pg_temp.t(3597.87)),
('5a4e0004-0000-4000-8000-000000000014', '5a4e0003-0000-4000-8000-000000000014', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(3259.43), '5a4e0000-0000-4000-8000-000000020002', pg_temp.t(3602.13), pg_temp.t(3602.13)),
('5a4e0004-0000-4000-8000-000000000015', '5a4e0003-0000-4000-8000-000000000015', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(-171.04), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(195.54), pg_temp.t(195.54)),
('5a4e0004-0000-4000-8000-000000000016', '5a4e0003-0000-4000-8000-000000000016', 1, 0.20, NULL, pg_temp.t(310.38), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(714.13), pg_temp.t(714.13)),
('5a4e0004-0000-4000-8000-000000000017', '5a4e0003-0000-4000-8000-000000000017', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2569.40), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(2932.47), pg_temp.t(2932.47)),
('5a4e0004-0000-4000-8000-000000000018', '5a4e0003-0000-4000-8000-000000000018', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1210.95), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(1578.37), pg_temp.t(1578.37)),
('5a4e0004-0000-4000-8000-000000000019', '5a4e0003-0000-4000-8000-000000000019', 1, 0.20, NULL, pg_temp.t(1187.19), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(1579.65), pg_temp.t(1579.65)),
('5a4e0004-0000-4000-8000-000000000020', '5a4e0003-0000-4000-8000-000000000020', 1, 0.20, NULL, pg_temp.t(1216.17), '5a4e0000-0000-4000-8000-000000020003', pg_temp.t(1581.75), pg_temp.t(1581.75)),
('5a4e0004-0000-4000-8000-000000000021', '5a4e0003-0000-4000-8000-000000000021', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(528.09), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(922.66), pg_temp.t(922.66)),
('5a4e0004-0000-4000-8000-000000000022', '5a4e0003-0000-4000-8000-000000000022', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(730.59), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1083.86), pg_temp.t(1083.86)),
('5a4e0004-0000-4000-8000-000000000023', '5a4e0003-0000-4000-8000-000000000023', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(734.85), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1080.85), pg_temp.t(1080.85)),
('5a4e0004-0000-4000-8000-000000000024', '5a4e0003-0000-4000-8000-000000000024', 1, 0.20, NULL, pg_temp.t(673.31), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(1075.49), pg_temp.t(1075.49)),
('5a4e0004-0000-4000-8000-000000000025', '5a4e0003-0000-4000-8000-000000000025', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-171.43), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(205.79), pg_temp.t(205.79)),
('5a4e0004-0000-4000-8000-000000000026', '5a4e0003-0000-4000-8000-000000000026', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-150.43), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(218.99), pg_temp.t(218.99)),
('5a4e0004-0000-4000-8000-000000000027', '5a4e0003-0000-4000-8000-000000000027', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(-160.43), '5a4e0000-0000-4000-8000-000000020004', pg_temp.t(228.05), pg_temp.t(228.05)),
('5a4e0004-0000-4000-8000-000000000028', '5a4e0003-0000-4000-8000-000000000028', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1795.06), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(2185.53), pg_temp.t(2185.53)),
('5a4e0004-0000-4000-8000-000000000029', '5a4e0003-0000-4000-8000-000000000029', 1, 0.20, NULL, pg_temp.t(1017.72), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(1425.03), pg_temp.t(1425.03)),
('5a4e0004-0000-4000-8000-000000000030', '5a4e0003-0000-4000-8000-000000000030', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2614.67), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3006.61), pg_temp.t(3006.61)),
('5a4e0004-0000-4000-8000-000000000031', '5a4e0003-0000-4000-8000-000000000031', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3412.33), '5a4e0000-0000-4000-8000-000000020005', pg_temp.t(3806.65), pg_temp.t(3806.65)),
('5a4e0004-0000-4000-8000-000000000032', '5a4e0003-0000-4000-8000-000000000032', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(407.26), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(767.50), pg_temp.t(767.50)),
('5a4e0004-0000-4000-8000-000000000033', '5a4e0003-0000-4000-8000-000000000033', 1, 0.20, NULL, pg_temp.t(412.07), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(785.33), pg_temp.t(785.33)),
('5a4e0004-0000-4000-8000-000000000034', '5a4e0003-0000-4000-8000-000000000034', 1, 0.20, NULL, pg_temp.t(-155.10), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(223.58), pg_temp.t(223.58)),
('5a4e0004-0000-4000-8000-000000000035', '5a4e0003-0000-4000-8000-000000000035', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3069.10), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(3441.77), pg_temp.t(3441.77)),
('5a4e0004-0000-4000-8000-000000000036', '5a4e0003-0000-4000-8000-000000000036', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(3056.19), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(3450.87), pg_temp.t(3450.87)),
('5a4e0004-0000-4000-8000-000000000037', '5a4e0003-0000-4000-8000-000000000037', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1042.01), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(1389.35), pg_temp.t(1389.35)),
('5a4e0004-0000-4000-8000-000000000038', '5a4e0003-0000-4000-8000-000000000038', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1016.86), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(1377.10), pg_temp.t(1377.10)),
('5a4e0004-0000-4000-8000-000000000039', '5a4e0003-0000-4000-8000-000000000039', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1014.79), '5a4e0000-0000-4000-8000-000000020006', pg_temp.t(1385.13), pg_temp.t(1385.13)),
('5a4e0004-0000-4000-8000-000000000040', '5a4e0003-0000-4000-8000-000000000040', 1, 0.20, NULL, pg_temp.t(2853.62), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3206.94), pg_temp.t(3206.94)),
('5a4e0004-0000-4000-8000-000000000041', '5a4e0003-0000-4000-8000-000000000041', 1, 0.20, NULL, pg_temp.t(5376.68), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5753.99), pg_temp.t(5753.99)),
('5a4e0004-0000-4000-8000-000000000042', '5a4e0003-0000-4000-8000-000000000042', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(5341.32), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5747.27), pg_temp.t(5747.27)),
('5a4e0004-0000-4000-8000-000000000043', '5a4e0003-0000-4000-8000-000000000043', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(5360.01), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(5717.11), pg_temp.t(5717.11)),
('5a4e0004-0000-4000-8000-000000000044', '5a4e0003-0000-4000-8000-000000000044', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3494.35), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3871.09), pg_temp.t(3871.09)),
('5a4e0004-0000-4000-8000-000000000045', '5a4e0003-0000-4000-8000-000000000045', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(3522.13), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(3905.39), pg_temp.t(3905.39)),
('5a4e0004-0000-4000-8000-000000000046', '5a4e0003-0000-4000-8000-000000000046', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2171.52), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(2568.63), pg_temp.t(2568.63)),
('5a4e0004-0000-4000-8000-000000000047', '5a4e0003-0000-4000-8000-000000000047', 1, 0.20, NULL, pg_temp.t(2163.47), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(2561.42), pg_temp.t(2561.42)),
('5a4e0004-0000-4000-8000-000000000048', '5a4e0003-0000-4000-8000-000000000048', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2198.94), '5a4e0000-0000-4000-8000-000000020007', pg_temp.t(2564.24), pg_temp.t(2564.24)),
('5a4e0004-0000-4000-8000-000000000049', '5a4e0003-0000-4000-8000-000000000049', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3841.96), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4188.73), pg_temp.t(4188.73)),
('5a4e0004-0000-4000-8000-000000000050', '5a4e0003-0000-4000-8000-000000000050', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(4322.33), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4714.99), pg_temp.t(4714.99)),
('5a4e0004-0000-4000-8000-000000000051', '5a4e0003-0000-4000-8000-000000000051', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(4391.67), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4745.28), pg_temp.t(4745.28)),
('5a4e0004-0000-4000-8000-000000000052', '5a4e0003-0000-4000-8000-000000000052', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(4123.64), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(4506.96), pg_temp.t(4506.96)),
('5a4e0004-0000-4000-8000-000000000053', '5a4e0003-0000-4000-8000-000000000053', 1, 0.20, NULL, pg_temp.t(-202.47), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(193.26), pg_temp.t(193.26)),
('5a4e0004-0000-4000-8000-000000000054', '5a4e0003-0000-4000-8000-000000000054', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-177.15), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(197.95), pg_temp.t(197.95)),
('5a4e0004-0000-4000-8000-000000000055', '5a4e0003-0000-4000-8000-000000000055', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-161.15), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(195.55), pg_temp.t(195.55)),
('5a4e0004-0000-4000-8000-000000000056', '5a4e0003-0000-4000-8000-000000000056', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(-162.91), '5a4e0000-0000-4000-8000-000000020008', pg_temp.t(194.43), pg_temp.t(194.43)),
('5a4e0004-0000-4000-8000-000000000057', '5a4e0003-0000-4000-8000-000000000057', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2671.04), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3055.02), pg_temp.t(3055.02)),
('5a4e0004-0000-4000-8000-000000000058', '5a4e0003-0000-4000-8000-000000000058', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2682.22), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3054.87), pg_temp.t(3054.87)),
('5a4e0004-0000-4000-8000-000000000059', '5a4e0003-0000-4000-8000-000000000059', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2645.60), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3025.78), pg_temp.t(3025.78)),
('5a4e0004-0000-4000-8000-000000000060', '5a4e0003-0000-4000-8000-000000000060', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2489.88), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(2827.00), pg_temp.t(2827.00)),
('5a4e0004-0000-4000-8000-000000000061', '5a4e0003-0000-4000-8000-000000000061', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2392.53), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(2785.72), pg_temp.t(2785.72)),
('5a4e0004-0000-4000-8000-000000000062', '5a4e0003-0000-4000-8000-000000000062', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(607.21), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1009.31), pg_temp.t(1009.31)),
('5a4e0004-0000-4000-8000-000000000063', '5a4e0003-0000-4000-8000-000000000063', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(3357.81), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3711.88), pg_temp.t(3711.88)),
('5a4e0004-0000-4000-8000-000000000064', '5a4e0003-0000-4000-8000-000000000064', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3316.72), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(3682.70), pg_temp.t(3682.70)),
('5a4e0004-0000-4000-8000-000000000065', '5a4e0003-0000-4000-8000-000000000065', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(1089.57), '5a4e0000-0000-4000-8000-000000020009', pg_temp.t(1460.71), pg_temp.t(1460.71)),
('5a4e0004-0000-4000-8000-000000000066', '5a4e0003-0000-4000-8000-000000000066', 1, 0.20, NULL, pg_temp.t(-196.53), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(209.21), pg_temp.t(209.21)),
('5a4e0004-0000-4000-8000-000000000067', '5a4e0003-0000-4000-8000-000000000067', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1466.58), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(1818.33), pg_temp.t(1818.33)),
('5a4e0004-0000-4000-8000-000000000068', '5a4e0003-0000-4000-8000-000000000068', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(3253.12), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(3649.67), pg_temp.t(3649.67)),
('5a4e0004-0000-4000-8000-000000000069', '5a4e0003-0000-4000-8000-000000000069', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(-134.33), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(213.93), pg_temp.t(213.93)),
('5a4e0004-0000-4000-8000-000000000070', '5a4e0003-0000-4000-8000-000000000070', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(3060.21), '5a4e0000-0000-4000-8000-000000020010', pg_temp.t(3425.05), pg_temp.t(3425.05)),
('5a4e0004-0000-4000-8000-000000000071', '5a4e0003-0000-4000-8000-000000000071', 1, 0.20, NULL, pg_temp.t(3185.43), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(3538.46), pg_temp.t(3538.46)),
('5a4e0004-0000-4000-8000-000000000072', '5a4e0003-0000-4000-8000-000000000072', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1051.63), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1432.26), pg_temp.t(1432.26)),
('5a4e0004-0000-4000-8000-000000000073', '5a4e0003-0000-4000-8000-000000000073', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1064.06), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1422.11), pg_temp.t(1422.11)),
('5a4e0004-0000-4000-8000-000000000074', '5a4e0003-0000-4000-8000-000000000074', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1074.52), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(1418.40), pg_temp.t(1418.40)),
('5a4e0004-0000-4000-8000-000000000075', '5a4e0003-0000-4000-8000-000000000075', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(136.85), '5a4e0000-0000-4000-8000-000000020011', pg_temp.t(520.81), pg_temp.t(520.81)),
('5a4e0004-0000-4000-8000-000000000076', '5a4e0003-0000-4000-8000-000000000076', 1, 0.20, NULL, pg_temp.t(2678.91), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3024.69), pg_temp.t(3024.69)),
('5a4e0004-0000-4000-8000-000000000077', '5a4e0003-0000-4000-8000-000000000077', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2685.15), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3068.97), pg_temp.t(3068.97)),
('5a4e0004-0000-4000-8000-000000000078', '5a4e0003-0000-4000-8000-000000000078', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(2672.46), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3030.99), pg_temp.t(3030.99)),
('5a4e0004-0000-4000-8000-000000000079', '5a4e0003-0000-4000-8000-000000000079', 1, 0.20, 'Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.', pg_temp.t(-150.49), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(198.08), pg_temp.t(198.08)),
('5a4e0004-0000-4000-8000-000000000080', '5a4e0003-0000-4000-8000-000000000080', 1, 0.20, NULL, pg_temp.t(-161.55), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(236.28), pg_temp.t(236.28)),
('5a4e0004-0000-4000-8000-000000000081', '5a4e0003-0000-4000-8000-000000000081', 1, 0.20, NULL, pg_temp.t(-184.32), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(204.25), pg_temp.t(204.25)),
('5a4e0004-0000-4000-8000-000000000082', '5a4e0003-0000-4000-8000-000000000082', 1, 0.20, NULL, pg_temp.t(3552.37), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(3900.43), pg_temp.t(3900.43)),
('5a4e0004-0000-4000-8000-000000000083', '5a4e0003-0000-4000-8000-000000000083', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(1810.75), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2172.28), pg_temp.t(2172.28)),
('5a4e0004-0000-4000-8000-000000000084', '5a4e0003-0000-4000-8000-000000000084', 1, 0.20, NULL, pg_temp.t(2399.23), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2740.08), pg_temp.t(2740.08)),
('5a4e0004-0000-4000-8000-000000000085', '5a4e0003-0000-4000-8000-000000000085', 1, 0.20, NULL, pg_temp.t(2373.23), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2736.51), pg_temp.t(2736.51)),
('5a4e0004-0000-4000-8000-000000000086', '5a4e0003-0000-4000-8000-000000000086', 1, 0.20, 'Teklif 14 gün geçerlidir; kapora %30.', pg_temp.t(2364.73), '5a4e0000-0000-4000-8000-000000020012', pg_temp.t(2728.68), pg_temp.t(2728.68));
  UPDATE public.proposals p SET current_version_id = v.id FROM public.proposal_versions v WHERE v.proposal_id = p.id AND p.id::text LIKE '5a4e0003-%';
  INSERT INTO public.proposal_items (id, proposal_version_id, role_id, description, quantity, unit_client_price, is_visible_to_client, sort_order)
  VALUES
('5a4e0005-0000-4000-8000-000000000001', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('hostes'), 'Hostes (kına gecesi)', 2, 4500, true, 0),
('5a4e0005-0000-4000-8000-000000000002', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('akrobat'), 'Akrobat (kına gecesi)', 2, 10000, true, 1),
('5a4e0005-0000-4000-8000-000000000003', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('videograf'), 'Videograf (kına gecesi)', 1, 55000, true, 2),
('5a4e0005-0000-4000-8000-000000000004', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('sunucu'), 'Sunucu (kına gecesi)', 1, 36500, true, 3),
('5a4e0005-0000-4000-8000-000000000005', '5a4e0004-0000-4000-8000-000000000001', pg_temp.rol('muzisyen'), 'Müzisyen (kına gecesi)', 1, 26000, true, 4),
('5a4e0005-0000-4000-8000-000000000006', '5a4e0004-0000-4000-8000-000000000002', pg_temp.rol('canli-yayin'), 'Canlı Yayın (doğum günü)', 1, 36500, true, 0),
('5a4e0005-0000-4000-8000-000000000007', '5a4e0004-0000-4000-8000-000000000002', pg_temp.rol('akrobat'), 'Akrobat (doğum günü)', 1, 21500, true, 1),
('5a4e0005-0000-4000-8000-000000000008', '5a4e0004-0000-4000-8000-000000000002', pg_temp.rol('sunucu'), 'Sunucu (doğum günü)', 1, 32500, true, 2),
('5a4e0005-0000-4000-8000-000000000009', '5a4e0004-0000-4000-8000-000000000003', pg_temp.rol('tercuman'), 'Tercüman (kurumsal)', 2, 8000, true, 0),
('5a4e0005-0000-4000-8000-000000000010', '5a4e0004-0000-4000-8000-000000000003', pg_temp.rol('ses-isik'), 'Ses & Işık (kurumsal)', 2, 73000, true, 1),
('5a4e0005-0000-4000-8000-000000000011', '5a4e0004-0000-4000-8000-000000000003', pg_temp.rol('videograf'), 'Videograf (kurumsal)', 1, 29500, true, 2),
('5a4e0005-0000-4000-8000-000000000012', '5a4e0004-0000-4000-8000-000000000003', pg_temp.rol('sunucu'), 'Sunucu (kurumsal)', 2, 15500, true, 3),
('5a4e0005-0000-4000-8000-000000000013', '5a4e0004-0000-4000-8000-000000000004', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (düğün)', 2, 5000, true, 0),
('5a4e0005-0000-4000-8000-000000000014', '5a4e0004-0000-4000-8000-000000000004', pg_temp.rol('palyaco'), 'Palyaço (düğün)', 2, 5000, true, 1),
('5a4e0005-0000-4000-8000-000000000015', '5a4e0004-0000-4000-8000-000000000004', pg_temp.rol('sunucu'), 'Sunucu (düğün)', 1, 28000, true, 2),
('5a4e0005-0000-4000-8000-000000000016', '5a4e0004-0000-4000-8000-000000000005', pg_temp.rol('konusmaci'), 'Konuşmacı (lansman)', 1, 46500, true, 0),
('5a4e0005-0000-4000-8000-000000000017', '5a4e0004-0000-4000-8000-000000000005', pg_temp.rol('dj'), 'DJ (lansman)', 1, 25500, true, 1),
('5a4e0005-0000-4000-8000-000000000018', '5a4e0004-0000-4000-8000-000000000006', pg_temp.rol('konusmaci'), 'Konuşmacı (lansman)', 2, 19500, false, 0),
('5a4e0005-0000-4000-8000-000000000019', '5a4e0004-0000-4000-8000-000000000006', pg_temp.rol('dj'), 'DJ (lansman)', 1, 28500, true, 1),
('5a4e0005-0000-4000-8000-000000000020', '5a4e0004-0000-4000-8000-000000000006', pg_temp.rol('model'), 'Model (lansman)', 1, 8500, false, 2),
('5a4e0005-0000-4000-8000-000000000021', '5a4e0004-0000-4000-8000-000000000006', pg_temp.rol('videograf'), 'Videograf (lansman)', 1, 53000, true, 3),
('5a4e0005-0000-4000-8000-000000000022', '5a4e0004-0000-4000-8000-000000000007', pg_temp.rol('konusmaci'), 'Konuşmacı (lansman)', 1, 30500, true, 0),
('5a4e0005-0000-4000-8000-000000000023', '5a4e0004-0000-4000-8000-000000000007', pg_temp.rol('dj'), 'DJ (lansman)', 1, 34000, true, 1),
('5a4e0005-0000-4000-8000-000000000024', '5a4e0004-0000-4000-8000-000000000007', pg_temp.rol('model'), 'Model (lansman)', 2, 16500, true, 2),
('5a4e0005-0000-4000-8000-000000000025', '5a4e0004-0000-4000-8000-000000000007', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (lansman)', 1, 16500, true, 3),
('5a4e0005-0000-4000-8000-000000000026', '5a4e0004-0000-4000-8000-000000000008', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 17000, true, 0),
('5a4e0005-0000-4000-8000-000000000027', '5a4e0004-0000-4000-8000-000000000008', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 1, 17000, true, 1),
('5a4e0005-0000-4000-8000-000000000028', '5a4e0004-0000-4000-8000-000000000008', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (düğün)', 1, 15500, false, 2),
('5a4e0005-0000-4000-8000-000000000029', '5a4e0004-0000-4000-8000-000000000008', pg_temp.rol('ses-isik'), 'Ses & Işık (düğün)', 1, 51500, true, 3),
('5a4e0005-0000-4000-8000-000000000030', '5a4e0004-0000-4000-8000-000000000008', pg_temp.rol('videograf'), 'Videograf (düğün)', 1, 20000, true, 4),
('5a4e0005-0000-4000-8000-000000000031', '5a4e0004-0000-4000-8000-000000000009', pg_temp.rol('konusmaci'), 'Konuşmacı (fuar)', 1, 62500, true, 0),
('5a4e0005-0000-4000-8000-000000000032', '5a4e0004-0000-4000-8000-000000000009', pg_temp.rol('muzisyen'), 'Müzisyen (fuar)', 1, 44500, true, 1),
('5a4e0005-0000-4000-8000-000000000033', '5a4e0004-0000-4000-8000-000000000009', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (fuar)', 1, 8000, true, 2),
('5a4e0005-0000-4000-8000-000000000034', '5a4e0004-0000-4000-8000-000000000009', pg_temp.rol('illuzyonist'), 'İllüzyonist (fuar)', 1, 25000, false, 3),
('5a4e0005-0000-4000-8000-000000000035', '5a4e0004-0000-4000-8000-000000000009', pg_temp.rol('videograf'), 'Videograf (fuar)', 1, 44000, true, 4),
('5a4e0005-0000-4000-8000-000000000036', '5a4e0004-0000-4000-8000-000000000010', pg_temp.rol('konusmaci'), 'Konuşmacı (fuar)', 1, 26000, true, 0),
('5a4e0005-0000-4000-8000-000000000037', '5a4e0004-0000-4000-8000-000000000010', pg_temp.rol('muzisyen'), 'Müzisyen (fuar)', 1, 37000, true, 1),
('5a4e0005-0000-4000-8000-000000000038', '5a4e0004-0000-4000-8000-000000000010', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (fuar)', 1, 6000, true, 2),
('5a4e0005-0000-4000-8000-000000000039', '5a4e0004-0000-4000-8000-000000000011', pg_temp.rol('konusmaci'), 'Konuşmacı (fuar)', 1, 16500, true, 0),
('5a4e0005-0000-4000-8000-000000000040', '5a4e0004-0000-4000-8000-000000000011', pg_temp.rol('muzisyen'), 'Müzisyen (fuar)', 1, 14500, true, 1),
('5a4e0005-0000-4000-8000-000000000041', '5a4e0004-0000-4000-8000-000000000011', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (fuar)', 1, 7500, true, 2),
('5a4e0005-0000-4000-8000-000000000042', '5a4e0004-0000-4000-8000-000000000012', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (konser)', 2, 10500, true, 0),
('5a4e0005-0000-4000-8000-000000000043', '5a4e0004-0000-4000-8000-000000000012', pg_temp.rol('dj'), 'DJ (konser)', 2, 28500, false, 1),
('5a4e0005-0000-4000-8000-000000000044', '5a4e0004-0000-4000-8000-000000000012', pg_temp.rol('oyuncu'), 'Oyuncu (konser)', 2, 14500, true, 2),
('5a4e0005-0000-4000-8000-000000000045', '5a4e0004-0000-4000-8000-000000000012', pg_temp.rol('sunucu'), 'Sunucu (konser)', 2, 18500, true, 3),
('5a4e0005-0000-4000-8000-000000000046', '5a4e0004-0000-4000-8000-000000000013', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (konser)', 1, 5500, false, 0),
('5a4e0005-0000-4000-8000-000000000047', '5a4e0004-0000-4000-8000-000000000013', pg_temp.rol('dj'), 'DJ (konser)', 1, 23500, true, 1),
('5a4e0005-0000-4000-8000-000000000048', '5a4e0004-0000-4000-8000-000000000014', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (konser)', 1, 10000, true, 0),
('5a4e0005-0000-4000-8000-000000000049', '5a4e0004-0000-4000-8000-000000000014', pg_temp.rol('dj'), 'DJ (konser)', 1, 26000, true, 1),
('5a4e0005-0000-4000-8000-000000000050', '5a4e0004-0000-4000-8000-000000000015', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (lansman)', 1, 6000, true, 0),
('5a4e0005-0000-4000-8000-000000000051', '5a4e0004-0000-4000-8000-000000000015', pg_temp.rol('sunucu'), 'Sunucu (lansman)', 1, 15000, true, 1),
('5a4e0005-0000-4000-8000-000000000052', '5a4e0004-0000-4000-8000-000000000015', pg_temp.rol('illuzyonist'), 'İllüzyonist (lansman)', 1, 15000, true, 2),
('5a4e0005-0000-4000-8000-000000000053', '5a4e0004-0000-4000-8000-000000000015', pg_temp.rol('akrobat'), 'Akrobat (lansman)', 1, 20500, true, 3),
('5a4e0005-0000-4000-8000-000000000054', '5a4e0004-0000-4000-8000-000000000015', pg_temp.rol('fotografci'), 'Fotoğrafçı (lansman)', 2, 41000, true, 4),
('5a4e0005-0000-4000-8000-000000000055', '5a4e0004-0000-4000-8000-000000000016', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 22500, true, 0),
('5a4e0005-0000-4000-8000-000000000056', '5a4e0004-0000-4000-8000-000000000016', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (düğün)', 1, 14500, true, 1),
('5a4e0005-0000-4000-8000-000000000057', '5a4e0004-0000-4000-8000-000000000017', pg_temp.rol('karikaturist'), 'Karikatürist (düğün)', 2, 5500, true, 0),
('5a4e0005-0000-4000-8000-000000000058', '5a4e0004-0000-4000-8000-000000000017', pg_temp.rol('palyaco'), 'Palyaço (düğün)', 1, 3000, true, 1),
('5a4e0005-0000-4000-8000-000000000059', '5a4e0004-0000-4000-8000-000000000018', pg_temp.rol('karikaturist'), 'Karikatürist (lansman)', 1, 11500, false, 0),
('5a4e0005-0000-4000-8000-000000000060', '5a4e0004-0000-4000-8000-000000000018', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 2, 78000, true, 1),
('5a4e0005-0000-4000-8000-000000000061', '5a4e0004-0000-4000-8000-000000000018', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (lansman)', 1, 11000, true, 2),
('5a4e0005-0000-4000-8000-000000000062', '5a4e0004-0000-4000-8000-000000000019', pg_temp.rol('karikaturist'), 'Karikatürist (lansman)', 1, 8500, true, 0),
('5a4e0005-0000-4000-8000-000000000063', '5a4e0004-0000-4000-8000-000000000019', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 2, 83000, true, 1),
('5a4e0005-0000-4000-8000-000000000064', '5a4e0004-0000-4000-8000-000000000020', pg_temp.rol('karikaturist'), 'Karikatürist (lansman)', 1, 12500, true, 0),
('5a4e0005-0000-4000-8000-000000000065', '5a4e0004-0000-4000-8000-000000000020', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 1, 47000, true, 1),
('5a4e0005-0000-4000-8000-000000000066', '5a4e0004-0000-4000-8000-000000000020', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (lansman)', 1, 11000, true, 2),
('5a4e0005-0000-4000-8000-000000000067', '5a4e0004-0000-4000-8000-000000000021', pg_temp.rol('dj'), 'DJ (kurumsal)', 2, 19000, true, 0),
('5a4e0005-0000-4000-8000-000000000068', '5a4e0004-0000-4000-8000-000000000021', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (kurumsal)', 1, 10500, true, 1),
('5a4e0005-0000-4000-8000-000000000069', '5a4e0004-0000-4000-8000-000000000021', pg_temp.rol('fotografci'), 'Fotoğrafçı (kurumsal)', 1, 21500, true, 2),
('5a4e0005-0000-4000-8000-000000000070', '5a4e0004-0000-4000-8000-000000000022', pg_temp.rol('model'), 'Model (nişan)', 1, 8000, true, 0),
('5a4e0005-0000-4000-8000-000000000071', '5a4e0004-0000-4000-8000-000000000022', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (nişan)', 1, 8500, true, 1),
('5a4e0005-0000-4000-8000-000000000072', '5a4e0004-0000-4000-8000-000000000022', pg_temp.rol('tercuman'), 'Tercüman (nişan)', 1, 14000, true, 2),
('5a4e0005-0000-4000-8000-000000000073', '5a4e0004-0000-4000-8000-000000000022', pg_temp.rol('videograf'), 'Videograf (nişan)', 1, 38500, true, 3),
('5a4e0005-0000-4000-8000-000000000074', '5a4e0004-0000-4000-8000-000000000022', pg_temp.rol('organizasyon'), 'Organizasyon (nişan)', 2, 276500, true, 4),
('5a4e0005-0000-4000-8000-000000000075', '5a4e0004-0000-4000-8000-000000000023', pg_temp.rol('model'), 'Model (nişan)', 1, 16500, true, 0),
('5a4e0005-0000-4000-8000-000000000076', '5a4e0004-0000-4000-8000-000000000023', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (nişan)', 1, 12000, true, 1),
('5a4e0005-0000-4000-8000-000000000077', '5a4e0004-0000-4000-8000-000000000024', pg_temp.rol('model'), 'Model (nişan)', 1, 19500, true, 0),
('5a4e0005-0000-4000-8000-000000000078', '5a4e0004-0000-4000-8000-000000000024', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (nişan)', 2, 11000, true, 1),
('5a4e0005-0000-4000-8000-000000000079', '5a4e0004-0000-4000-8000-000000000025', pg_temp.rol('konusmaci'), 'Konuşmacı (düğün)', 1, 57000, true, 0),
('5a4e0005-0000-4000-8000-000000000080', '5a4e0004-0000-4000-8000-000000000025', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 1, 32000, true, 1),
('5a4e0005-0000-4000-8000-000000000081', '5a4e0004-0000-4000-8000-000000000026', pg_temp.rol('konusmaci'), 'Konuşmacı (düğün)', 2, 56500, false, 0),
('5a4e0005-0000-4000-8000-000000000082', '5a4e0004-0000-4000-8000-000000000026', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 1, 16500, true, 1),
('5a4e0005-0000-4000-8000-000000000083', '5a4e0004-0000-4000-8000-000000000026', pg_temp.rol('hostes'), 'Hostes (düğün)', 1, 3000, true, 2),
('5a4e0005-0000-4000-8000-000000000084', '5a4e0004-0000-4000-8000-000000000027', pg_temp.rol('konusmaci'), 'Konuşmacı (düğün)', 1, 60500, true, 0),
('5a4e0005-0000-4000-8000-000000000085', '5a4e0004-0000-4000-8000-000000000027', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 1, 15500, true, 1),
('5a4e0005-0000-4000-8000-000000000086', '5a4e0004-0000-4000-8000-000000000027', pg_temp.rol('hostes'), 'Hostes (düğün)', 1, 3500, true, 2),
('5a4e0005-0000-4000-8000-000000000087', '5a4e0004-0000-4000-8000-000000000027', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (düğün)', 1, 19500, false, 3),
('5a4e0005-0000-4000-8000-000000000088', '5a4e0004-0000-4000-8000-000000000028', pg_temp.rol('ses-isik'), 'Ses & Işık (düğün)', 2, 29500, true, 0),
('5a4e0005-0000-4000-8000-000000000089', '5a4e0004-0000-4000-8000-000000000028', pg_temp.rol('oyuncu'), 'Oyuncu (düğün)', 1, 11000, true, 1),
('5a4e0005-0000-4000-8000-000000000090', '5a4e0004-0000-4000-8000-000000000028', pg_temp.rol('muzisyen'), 'Müzisyen (düğün)', 1, 49000, true, 2),
('5a4e0005-0000-4000-8000-000000000091', '5a4e0004-0000-4000-8000-000000000029', pg_temp.rol('dj'), 'DJ (düğün)', 1, 13000, true, 0),
('5a4e0005-0000-4000-8000-000000000092', '5a4e0004-0000-4000-8000-000000000029', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 28500, true, 1),
('5a4e0005-0000-4000-8000-000000000093', '5a4e0004-0000-4000-8000-000000000029', pg_temp.rol('akrobat'), 'Akrobat (düğün)', 1, 31000, true, 2),
('5a4e0005-0000-4000-8000-000000000094', '5a4e0004-0000-4000-8000-000000000030', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 17500, true, 0),
('5a4e0005-0000-4000-8000-000000000095', '5a4e0004-0000-4000-8000-000000000030', pg_temp.rol('oyuncu'), 'Oyuncu (düğün)', 1, 16000, true, 1),
('5a4e0005-0000-4000-8000-000000000096', '5a4e0004-0000-4000-8000-000000000030', pg_temp.rol('karikaturist'), 'Karikatürist (düğün)', 1, 4500, true, 2),
('5a4e0005-0000-4000-8000-000000000097', '5a4e0004-0000-4000-8000-000000000030', pg_temp.rol('ses-isik'), 'Ses & Işık (düğün)', 1, 49500, true, 3),
('5a4e0005-0000-4000-8000-000000000098', '5a4e0004-0000-4000-8000-000000000031', pg_temp.rol('model'), 'Model (düğün)', 2, 6000, true, 0),
('5a4e0005-0000-4000-8000-000000000099', '5a4e0004-0000-4000-8000-000000000031', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (düğün)', 1, 10000, true, 1),
('5a4e0005-0000-4000-8000-000000000100', '5a4e0004-0000-4000-8000-000000000031', pg_temp.rol('akrobat'), 'Akrobat (düğün)', 1, 27000, true, 2),
('5a4e0005-0000-4000-8000-000000000101', '5a4e0004-0000-4000-8000-000000000031', pg_temp.rol('dj'), 'DJ (düğün)', 1, 14000, true, 3),
('5a4e0005-0000-4000-8000-000000000102', '5a4e0004-0000-4000-8000-000000000032', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 22000, true, 0),
('5a4e0005-0000-4000-8000-000000000103', '5a4e0004-0000-4000-8000-000000000032', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 1, 30500, true, 1),
('5a4e0005-0000-4000-8000-000000000104', '5a4e0004-0000-4000-8000-000000000032', pg_temp.rol('dj'), 'DJ (lansman)', 1, 34500, true, 2),
('5a4e0005-0000-4000-8000-000000000105', '5a4e0004-0000-4000-8000-000000000033', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 29500, true, 0),
('5a4e0005-0000-4000-8000-000000000106', '5a4e0004-0000-4000-8000-000000000033', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 1, 46500, true, 1),
('5a4e0005-0000-4000-8000-000000000107', '5a4e0004-0000-4000-8000-000000000034', pg_temp.rol('dj'), 'DJ (düğün)', 2, 28500, true, 0),
('5a4e0005-0000-4000-8000-000000000108', '5a4e0004-0000-4000-8000-000000000034', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (düğün)', 1, 17500, true, 1),
('5a4e0005-0000-4000-8000-000000000109', '5a4e0004-0000-4000-8000-000000000034', pg_temp.rol('organizasyon'), 'Organizasyon (düğün)', 1, 239500, true, 2),
('5a4e0005-0000-4000-8000-000000000110', '5a4e0004-0000-4000-8000-000000000035', pg_temp.rol('fotografci'), 'Fotoğrafçı (konferans)', 1, 31000, true, 0),
('5a4e0005-0000-4000-8000-000000000111', '5a4e0004-0000-4000-8000-000000000035', pg_temp.rol('dj'), 'DJ (konferans)', 2, 27500, true, 1),
('5a4e0005-0000-4000-8000-000000000112', '5a4e0004-0000-4000-8000-000000000036', pg_temp.rol('fotografci'), 'Fotoğrafçı (konferans)', 1, 27500, true, 0),
('5a4e0005-0000-4000-8000-000000000113', '5a4e0004-0000-4000-8000-000000000036', pg_temp.rol('dj'), 'DJ (konferans)', 1, 13500, true, 1),
('5a4e0005-0000-4000-8000-000000000114', '5a4e0004-0000-4000-8000-000000000037', pg_temp.rol('oyuncu'), 'Oyuncu (gala)', 2, 14500, false, 0),
('5a4e0005-0000-4000-8000-000000000115', '5a4e0004-0000-4000-8000-000000000037', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (gala)', 1, 45500, true, 1),
('5a4e0005-0000-4000-8000-000000000116', '5a4e0004-0000-4000-8000-000000000037', pg_temp.rol('sunucu'), 'Sunucu (gala)', 1, 34500, true, 2),
('5a4e0005-0000-4000-8000-000000000117', '5a4e0004-0000-4000-8000-000000000037', pg_temp.rol('konusmaci'), 'Konuşmacı (gala)', 2, 59000, true, 3),
('5a4e0005-0000-4000-8000-000000000118', '5a4e0004-0000-4000-8000-000000000038', pg_temp.rol('oyuncu'), 'Oyuncu (gala)', 2, 18000, true, 0),
('5a4e0005-0000-4000-8000-000000000119', '5a4e0004-0000-4000-8000-000000000038', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (gala)', 2, 36000, false, 1),
('5a4e0005-0000-4000-8000-000000000120', '5a4e0004-0000-4000-8000-000000000038', pg_temp.rol('sunucu'), 'Sunucu (gala)', 1, 17500, true, 2),
('5a4e0005-0000-4000-8000-000000000121', '5a4e0004-0000-4000-8000-000000000039', pg_temp.rol('oyuncu'), 'Oyuncu (gala)', 1, 17500, true, 0),
('5a4e0005-0000-4000-8000-000000000122', '5a4e0004-0000-4000-8000-000000000039', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (gala)', 1, 36500, true, 1),
('5a4e0005-0000-4000-8000-000000000123', '5a4e0004-0000-4000-8000-000000000039', pg_temp.rol('sunucu'), 'Sunucu (gala)', 1, 13500, true, 2),
('5a4e0005-0000-4000-8000-000000000124', '5a4e0004-0000-4000-8000-000000000039', pg_temp.rol('konusmaci'), 'Konuşmacı (gala)', 1, 24000, true, 3),
('5a4e0005-0000-4000-8000-000000000125', '5a4e0004-0000-4000-8000-000000000039', pg_temp.rol('illuzyonist'), 'İllüzyonist (gala)', 1, 18500, true, 4),
('5a4e0005-0000-4000-8000-000000000126', '5a4e0004-0000-4000-8000-000000000040', pg_temp.rol('karikaturist'), 'Karikatürist (düğün)', 1, 7500, false, 0),
('5a4e0005-0000-4000-8000-000000000127', '5a4e0004-0000-4000-8000-000000000040', pg_temp.rol('konusmaci'), 'Konuşmacı (düğün)', 1, 33500, true, 1),
('5a4e0005-0000-4000-8000-000000000128', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kurumsal)', 1, 5500, true, 0),
('5a4e0005-0000-4000-8000-000000000129', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('konusmaci'), 'Konuşmacı (kurumsal)', 2, 54500, true, 1),
('5a4e0005-0000-4000-8000-000000000130', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 1, 27500, true, 2),
('5a4e0005-0000-4000-8000-000000000131', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('sunucu'), 'Sunucu (kurumsal)', 1, 22000, true, 3),
('5a4e0005-0000-4000-8000-000000000132', '5a4e0004-0000-4000-8000-000000000041', pg_temp.rol('dj'), 'DJ (kurumsal)', 1, 12000, true, 4),
('5a4e0005-0000-4000-8000-000000000133', '5a4e0004-0000-4000-8000-000000000042', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kurumsal)', 1, 11000, true, 0),
('5a4e0005-0000-4000-8000-000000000134', '5a4e0004-0000-4000-8000-000000000042', pg_temp.rol('konusmaci'), 'Konuşmacı (kurumsal)', 2, 37500, true, 1),
('5a4e0005-0000-4000-8000-000000000135', '5a4e0004-0000-4000-8000-000000000042', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 1, 48500, true, 2),
('5a4e0005-0000-4000-8000-000000000136', '5a4e0004-0000-4000-8000-000000000043', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kurumsal)', 1, 16500, true, 0),
('5a4e0005-0000-4000-8000-000000000137', '5a4e0004-0000-4000-8000-000000000043', pg_temp.rol('konusmaci'), 'Konuşmacı (kurumsal)', 2, 55500, true, 1),
('5a4e0005-0000-4000-8000-000000000138', '5a4e0004-0000-4000-8000-000000000044', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (kurumsal)', 1, 6500, true, 0),
('5a4e0005-0000-4000-8000-000000000139', '5a4e0004-0000-4000-8000-000000000044', pg_temp.rol('organizasyon'), 'Organizasyon (kurumsal)', 1, 43500, true, 1),
('5a4e0005-0000-4000-8000-000000000140', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (kurumsal)', 1, 12000, true, 0),
('5a4e0005-0000-4000-8000-000000000141', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('organizasyon'), 'Organizasyon (kurumsal)', 1, 90000, true, 1),
('5a4e0005-0000-4000-8000-000000000142', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('ses-isik'), 'Ses & Işık (kurumsal)', 1, 60500, true, 2),
('5a4e0005-0000-4000-8000-000000000143', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('fotografci'), 'Fotoğrafçı (kurumsal)', 1, 41500, true, 3),
('5a4e0005-0000-4000-8000-000000000144', '5a4e0004-0000-4000-8000-000000000045', pg_temp.rol('dj'), 'DJ (kurumsal)', 1, 21000, true, 4),
('5a4e0005-0000-4000-8000-000000000145', '5a4e0004-0000-4000-8000-000000000046', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kına gecesi)', 1, 14500, true, 0),
('5a4e0005-0000-4000-8000-000000000146', '5a4e0004-0000-4000-8000-000000000046', pg_temp.rol('model'), 'Model (kına gecesi)', 1, 6500, true, 1),
('5a4e0005-0000-4000-8000-000000000147', '5a4e0004-0000-4000-8000-000000000047', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kına gecesi)', 2, 16500, true, 0),
('5a4e0005-0000-4000-8000-000000000148', '5a4e0004-0000-4000-8000-000000000047', pg_temp.rol('model'), 'Model (kına gecesi)', 2, 8500, true, 1),
('5a4e0005-0000-4000-8000-000000000149', '5a4e0004-0000-4000-8000-000000000048', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kına gecesi)', 2, 10500, true, 0),
('5a4e0005-0000-4000-8000-000000000150', '5a4e0004-0000-4000-8000-000000000048', pg_temp.rol('model'), 'Model (kına gecesi)', 1, 11500, true, 1),
('5a4e0005-0000-4000-8000-000000000151', '5a4e0004-0000-4000-8000-000000000048', pg_temp.rol('muzisyen'), 'Müzisyen (kına gecesi)', 1, 33500, true, 2),
('5a4e0005-0000-4000-8000-000000000152', '5a4e0004-0000-4000-8000-000000000048', pg_temp.rol('ses-isik'), 'Ses & Işık (kına gecesi)', 1, 58500, true, 3),
('5a4e0005-0000-4000-8000-000000000153', '5a4e0004-0000-4000-8000-000000000049', pg_temp.rol('tercuman'), 'Tercüman (lansman)', 1, 14000, true, 0),
('5a4e0005-0000-4000-8000-000000000154', '5a4e0004-0000-4000-8000-000000000049', pg_temp.rol('organizasyon'), 'Organizasyon (lansman)', 2, 163000, false, 1),
('5a4e0005-0000-4000-8000-000000000155', '5a4e0004-0000-4000-8000-000000000050', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 2, 11000, true, 0),
('5a4e0005-0000-4000-8000-000000000156', '5a4e0004-0000-4000-8000-000000000050', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (fuar)', 2, 25500, false, 1),
('5a4e0005-0000-4000-8000-000000000157', '5a4e0004-0000-4000-8000-000000000051', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 2, 21000, false, 0),
('5a4e0005-0000-4000-8000-000000000158', '5a4e0004-0000-4000-8000-000000000051', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (fuar)', 1, 23000, true, 1),
('5a4e0005-0000-4000-8000-000000000159', '5a4e0004-0000-4000-8000-000000000051', pg_temp.rol('ses-isik'), 'Ses & Işık (fuar)', 1, 93500, true, 2),
('5a4e0005-0000-4000-8000-000000000160', '5a4e0004-0000-4000-8000-000000000052', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 1, 18500, true, 0),
('5a4e0005-0000-4000-8000-000000000161', '5a4e0004-0000-4000-8000-000000000052', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (fuar)', 1, 6000, true, 1),
('5a4e0005-0000-4000-8000-000000000162', '5a4e0004-0000-4000-8000-000000000052', pg_temp.rol('oyuncu'), 'Oyuncu (fuar)', 1, 14000, false, 2),
('5a4e0005-0000-4000-8000-000000000163', '5a4e0004-0000-4000-8000-000000000053', pg_temp.rol('influencer'), 'Influencer (fuar)', 1, 56000, true, 0),
('5a4e0005-0000-4000-8000-000000000164', '5a4e0004-0000-4000-8000-000000000053', pg_temp.rol('sunucu'), 'Sunucu (fuar)', 2, 17500, true, 1),
('5a4e0005-0000-4000-8000-000000000165', '5a4e0004-0000-4000-8000-000000000053', pg_temp.rol('canli-yayin'), 'Canlı Yayın (fuar)', 1, 42500, true, 2),
('5a4e0005-0000-4000-8000-000000000166', '5a4e0004-0000-4000-8000-000000000053', pg_temp.rol('oyuncu'), 'Oyuncu (fuar)', 1, 21500, true, 3),
('5a4e0005-0000-4000-8000-000000000167', '5a4e0004-0000-4000-8000-000000000053', pg_temp.rol('dansci'), 'Dansçı (fuar)', 2, 22500, true, 4),
('5a4e0005-0000-4000-8000-000000000168', '5a4e0004-0000-4000-8000-000000000054', pg_temp.rol('influencer'), 'Influencer (fuar)', 2, 38000, true, 0),
('5a4e0005-0000-4000-8000-000000000169', '5a4e0004-0000-4000-8000-000000000054', pg_temp.rol('sunucu'), 'Sunucu (fuar)', 1, 12000, true, 1),
('5a4e0005-0000-4000-8000-000000000170', '5a4e0004-0000-4000-8000-000000000055', pg_temp.rol('influencer'), 'Influencer (fuar)', 1, 15500, true, 0),
('5a4e0005-0000-4000-8000-000000000171', '5a4e0004-0000-4000-8000-000000000055', pg_temp.rol('sunucu'), 'Sunucu (fuar)', 1, 34000, true, 1),
('5a4e0005-0000-4000-8000-000000000172', '5a4e0004-0000-4000-8000-000000000055', pg_temp.rol('canli-yayin'), 'Canlı Yayın (fuar)', 1, 50500, true, 2),
('5a4e0005-0000-4000-8000-000000000173', '5a4e0004-0000-4000-8000-000000000056', pg_temp.rol('muzisyen'), 'Müzisyen (diğer)', 2, 50000, true, 0),
('5a4e0005-0000-4000-8000-000000000174', '5a4e0004-0000-4000-8000-000000000056', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (diğer)', 1, 9500, false, 1),
('5a4e0005-0000-4000-8000-000000000175', '5a4e0004-0000-4000-8000-000000000056', pg_temp.rol('model'), 'Model (diğer)', 2, 17000, true, 2),
('5a4e0005-0000-4000-8000-000000000176', '5a4e0004-0000-4000-8000-000000000056', pg_temp.rol('dansci'), 'Dansçı (diğer)', 1, 29000, true, 3),
('5a4e0005-0000-4000-8000-000000000177', '5a4e0004-0000-4000-8000-000000000057', pg_temp.rol('muzisyen'), 'Müzisyen (gala)', 1, 20500, true, 0),
('5a4e0005-0000-4000-8000-000000000178', '5a4e0004-0000-4000-8000-000000000057', pg_temp.rol('illuzyonist'), 'İllüzyonist (gala)', 2, 12500, true, 1),
('5a4e0005-0000-4000-8000-000000000179', '5a4e0004-0000-4000-8000-000000000057', pg_temp.rol('dansci'), 'Dansçı (gala)', 1, 31500, true, 2),
('5a4e0005-0000-4000-8000-000000000180', '5a4e0004-0000-4000-8000-000000000057', pg_temp.rol('fotografci'), 'Fotoğrafçı (gala)', 1, 43500, true, 3),
('5a4e0005-0000-4000-8000-000000000181', '5a4e0004-0000-4000-8000-000000000057', pg_temp.rol('ses-isik'), 'Ses & Işık (gala)', 1, 50000, true, 4),
('5a4e0005-0000-4000-8000-000000000182', '5a4e0004-0000-4000-8000-000000000058', pg_temp.rol('muzisyen'), 'Müzisyen (gala)', 2, 44000, true, 0),
('5a4e0005-0000-4000-8000-000000000183', '5a4e0004-0000-4000-8000-000000000058', pg_temp.rol('illuzyonist'), 'İllüzyonist (gala)', 1, 27000, true, 1),
('5a4e0005-0000-4000-8000-000000000184', '5a4e0004-0000-4000-8000-000000000058', pg_temp.rol('dansci'), 'Dansçı (gala)', 1, 26500, true, 2),
('5a4e0005-0000-4000-8000-000000000185', '5a4e0004-0000-4000-8000-000000000058', pg_temp.rol('ses-isik'), 'Ses & Işık (gala)', 1, 31500, true, 3),
('5a4e0005-0000-4000-8000-000000000186', '5a4e0004-0000-4000-8000-000000000059', pg_temp.rol('muzisyen'), 'Müzisyen (gala)', 2, 33500, true, 0),
('5a4e0005-0000-4000-8000-000000000187', '5a4e0004-0000-4000-8000-000000000059', pg_temp.rol('illuzyonist'), 'İllüzyonist (gala)', 2, 20500, true, 1),
('5a4e0005-0000-4000-8000-000000000188', '5a4e0004-0000-4000-8000-000000000059', pg_temp.rol('dansci'), 'Dansçı (gala)', 1, 10500, true, 2),
('5a4e0005-0000-4000-8000-000000000189', '5a4e0004-0000-4000-8000-000000000060', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 1, 15000, true, 0),
('5a4e0005-0000-4000-8000-000000000190', '5a4e0004-0000-4000-8000-000000000060', pg_temp.rol('hostes'), 'Hostes (fuar)', 1, 3500, false, 1),
('5a4e0005-0000-4000-8000-000000000191', '5a4e0004-0000-4000-8000-000000000061', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (fuar)', 1, 20500, true, 0),
('5a4e0005-0000-4000-8000-000000000192', '5a4e0004-0000-4000-8000-000000000061', pg_temp.rol('hostes'), 'Hostes (fuar)', 1, 2500, false, 1),
('5a4e0005-0000-4000-8000-000000000193', '5a4e0004-0000-4000-8000-000000000061', pg_temp.rol('dj'), 'DJ (fuar)', 1, 23500, false, 2),
('5a4e0005-0000-4000-8000-000000000194', '5a4e0004-0000-4000-8000-000000000062', pg_temp.rol('sac-makyaj-styling'), 'Saç & Makyaj & Styling (kurumsal)', 1, 15500, true, 0),
('5a4e0005-0000-4000-8000-000000000195', '5a4e0004-0000-4000-8000-000000000062', pg_temp.rol('dj'), 'DJ (kurumsal)', 1, 16000, true, 1),
('5a4e0005-0000-4000-8000-000000000196', '5a4e0004-0000-4000-8000-000000000062', pg_temp.rol('sunucu'), 'Sunucu (kurumsal)', 2, 20500, false, 2),
('5a4e0005-0000-4000-8000-000000000197', '5a4e0004-0000-4000-8000-000000000062', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (kurumsal)', 1, 5500, true, 3),
('5a4e0005-0000-4000-8000-000000000198', '5a4e0004-0000-4000-8000-000000000063', pg_temp.rol('sunucu'), 'Sunucu (konferans)', 1, 28000, true, 0),
('5a4e0005-0000-4000-8000-000000000199', '5a4e0004-0000-4000-8000-000000000063', pg_temp.rol('model'), 'Model (konferans)', 1, 15500, true, 1),
('5a4e0005-0000-4000-8000-000000000200', '5a4e0004-0000-4000-8000-000000000063', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (konferans)', 1, 8500, true, 2),
('5a4e0005-0000-4000-8000-000000000201', '5a4e0004-0000-4000-8000-000000000064', pg_temp.rol('sunucu'), 'Sunucu (konferans)', 2, 31000, true, 0),
('5a4e0005-0000-4000-8000-000000000202', '5a4e0004-0000-4000-8000-000000000064', pg_temp.rol('model'), 'Model (konferans)', 2, 8000, true, 1),
('5a4e0005-0000-4000-8000-000000000203', '5a4e0004-0000-4000-8000-000000000064', pg_temp.rol('ses-isik'), 'Ses & Işık (konferans)', 1, 75000, true, 2),
('5a4e0005-0000-4000-8000-000000000204', '5a4e0004-0000-4000-8000-000000000065', pg_temp.rol('fotografci'), 'Fotoğrafçı (kurumsal)', 1, 13500, true, 0),
('5a4e0005-0000-4000-8000-000000000205', '5a4e0004-0000-4000-8000-000000000065', pg_temp.rol('muzisyen'), 'Müzisyen (kurumsal)', 1, 34000, true, 1),
('5a4e0005-0000-4000-8000-000000000206', '5a4e0004-0000-4000-8000-000000000066', pg_temp.rol('organizasyon'), 'Organizasyon (lansman)', 2, 93000, false, 0),
('5a4e0005-0000-4000-8000-000000000207', '5a4e0004-0000-4000-8000-000000000066', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (lansman)', 1, 44000, true, 1),
('5a4e0005-0000-4000-8000-000000000208', '5a4e0004-0000-4000-8000-000000000066', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (lansman)', 1, 13500, true, 2),
('5a4e0005-0000-4000-8000-000000000209', '5a4e0004-0000-4000-8000-000000000066', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 2, 19000, true, 3),
('5a4e0005-0000-4000-8000-000000000210', '5a4e0004-0000-4000-8000-000000000067', pg_temp.rol('sunucu'), 'Sunucu (lansman)', 1, 25500, true, 0),
('5a4e0005-0000-4000-8000-000000000211', '5a4e0004-0000-4000-8000-000000000067', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (lansman)', 1, 11000, true, 1),
('5a4e0005-0000-4000-8000-000000000212', '5a4e0004-0000-4000-8000-000000000067', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 1, 50000, true, 2),
('5a4e0005-0000-4000-8000-000000000213', '5a4e0004-0000-4000-8000-000000000067', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 1, 18500, true, 3),
('5a4e0005-0000-4000-8000-000000000214', '5a4e0004-0000-4000-8000-000000000067', pg_temp.rol('fotografci'), 'Fotoğrafçı (lansman)', 1, 26500, true, 4),
('5a4e0005-0000-4000-8000-000000000215', '5a4e0004-0000-4000-8000-000000000068', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (lansman)', 1, 7000, true, 0),
('5a4e0005-0000-4000-8000-000000000216', '5a4e0004-0000-4000-8000-000000000068', pg_temp.rol('akrobat'), 'Akrobat (lansman)', 1, 13500, true, 1),
('5a4e0005-0000-4000-8000-000000000217', '5a4e0004-0000-4000-8000-000000000068', pg_temp.rol('canli-yayin'), 'Canlı Yayın (lansman)', 1, 18500, true, 2),
('5a4e0005-0000-4000-8000-000000000218', '5a4e0004-0000-4000-8000-000000000068', pg_temp.rol('influencer'), 'Influencer (lansman)', 1, 51500, true, 3),
('5a4e0005-0000-4000-8000-000000000219', '5a4e0004-0000-4000-8000-000000000069', pg_temp.rol('canli-yayin'), 'Canlı Yayın (kurumsal)', 2, 25000, true, 0),
('5a4e0005-0000-4000-8000-000000000220', '5a4e0004-0000-4000-8000-000000000069', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (kurumsal)', 1, 38000, false, 1),
('5a4e0005-0000-4000-8000-000000000221', '5a4e0004-0000-4000-8000-000000000069', pg_temp.rol('fotografci'), 'Fotoğrafçı (kurumsal)', 2, 36500, true, 2),
('5a4e0005-0000-4000-8000-000000000222', '5a4e0004-0000-4000-8000-000000000070', pg_temp.rol('dansci'), 'Dansçı (fuar)', 1, 25500, true, 0),
('5a4e0005-0000-4000-8000-000000000223', '5a4e0004-0000-4000-8000-000000000070', pg_temp.rol('karikaturist'), 'Karikatürist (fuar)', 1, 7000, true, 1),
('5a4e0005-0000-4000-8000-000000000224', '5a4e0004-0000-4000-8000-000000000071', pg_temp.rol('canli-yayin'), 'Canlı Yayın (düğün)', 2, 21500, false, 0),
('5a4e0005-0000-4000-8000-000000000225', '5a4e0004-0000-4000-8000-000000000071', pg_temp.rol('palyaco'), 'Palyaço (düğün)', 2, 3000, true, 1),
('5a4e0005-0000-4000-8000-000000000226', '5a4e0004-0000-4000-8000-000000000071', pg_temp.rol('oyuncu'), 'Oyuncu (düğün)', 2, 18500, true, 2),
('5a4e0005-0000-4000-8000-000000000227', '5a4e0004-0000-4000-8000-000000000071', pg_temp.rol('dansci'), 'Dansçı (düğün)', 1, 26000, true, 3),
('5a4e0005-0000-4000-8000-000000000228', '5a4e0004-0000-4000-8000-000000000072', pg_temp.rol('canli-yayin'), 'Canlı Yayın (düğün)', 2, 45000, true, 0),
('5a4e0005-0000-4000-8000-000000000229', '5a4e0004-0000-4000-8000-000000000072', pg_temp.rol('tercuman'), 'Tercüman (düğün)', 1, 12500, true, 1),
('5a4e0005-0000-4000-8000-000000000230', '5a4e0004-0000-4000-8000-000000000072', pg_temp.rol('akrobat'), 'Akrobat (düğün)', 1, 8500, false, 2),
('5a4e0005-0000-4000-8000-000000000231', '5a4e0004-0000-4000-8000-000000000073', pg_temp.rol('canli-yayin'), 'Canlı Yayın (düğün)', 1, 43000, true, 0),
('5a4e0005-0000-4000-8000-000000000232', '5a4e0004-0000-4000-8000-000000000073', pg_temp.rol('tercuman'), 'Tercüman (düğün)', 1, 12000, false, 1),
('5a4e0005-0000-4000-8000-000000000233', '5a4e0004-0000-4000-8000-000000000073', pg_temp.rol('akrobat'), 'Akrobat (düğün)', 1, 15500, false, 2),
('5a4e0005-0000-4000-8000-000000000234', '5a4e0004-0000-4000-8000-000000000073', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (düğün)', 1, 6500, true, 3),
('5a4e0005-0000-4000-8000-000000000235', '5a4e0004-0000-4000-8000-000000000073', pg_temp.rol('fotografci'), 'Fotoğrafçı (düğün)', 1, 32500, true, 4),
('5a4e0005-0000-4000-8000-000000000236', '5a4e0004-0000-4000-8000-000000000074', pg_temp.rol('canli-yayin'), 'Canlı Yayın (düğün)', 2, 24500, true, 0),
('5a4e0005-0000-4000-8000-000000000237', '5a4e0004-0000-4000-8000-000000000074', pg_temp.rol('tercuman'), 'Tercüman (düğün)', 1, 9500, true, 1),
('5a4e0005-0000-4000-8000-000000000238', '5a4e0004-0000-4000-8000-000000000074', pg_temp.rol('akrobat'), 'Akrobat (düğün)', 1, 23000, true, 2),
('5a4e0005-0000-4000-8000-000000000239', '5a4e0004-0000-4000-8000-000000000075', pg_temp.rol('model'), 'Model (düğün)', 1, 15500, true, 0),
('5a4e0005-0000-4000-8000-000000000240', '5a4e0004-0000-4000-8000-000000000075', pg_temp.rol('fotografci'), 'Fotoğrafçı (düğün)', 1, 45000, true, 1),
('5a4e0005-0000-4000-8000-000000000241', '5a4e0004-0000-4000-8000-000000000076', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (lansman)', 1, 13500, true, 0),
('5a4e0005-0000-4000-8000-000000000242', '5a4e0004-0000-4000-8000-000000000076', pg_temp.rol('influencer'), 'Influencer (lansman)', 2, 31500, true, 1),
('5a4e0005-0000-4000-8000-000000000243', '5a4e0004-0000-4000-8000-000000000077', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (lansman)', 1, 9500, true, 0),
('5a4e0005-0000-4000-8000-000000000244', '5a4e0004-0000-4000-8000-000000000077', pg_temp.rol('influencer'), 'Influencer (lansman)', 1, 28000, true, 1),
('5a4e0005-0000-4000-8000-000000000245', '5a4e0004-0000-4000-8000-000000000077', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 2, 53000, true, 2),
('5a4e0005-0000-4000-8000-000000000246', '5a4e0004-0000-4000-8000-000000000077', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (lansman)', 2, 9500, true, 3),
('5a4e0005-0000-4000-8000-000000000247', '5a4e0004-0000-4000-8000-000000000078', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (lansman)', 2, 12000, false, 0),
('5a4e0005-0000-4000-8000-000000000248', '5a4e0004-0000-4000-8000-000000000078', pg_temp.rol('influencer'), 'Influencer (lansman)', 1, 51000, true, 1),
('5a4e0005-0000-4000-8000-000000000249', '5a4e0004-0000-4000-8000-000000000078', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 1, 76000, true, 2),
('5a4e0005-0000-4000-8000-000000000250', '5a4e0004-0000-4000-8000-000000000079', pg_temp.rol('dansci'), 'Dansçı (lansman)', 2, 11000, true, 0),
('5a4e0005-0000-4000-8000-000000000251', '5a4e0004-0000-4000-8000-000000000079', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 1, 41000, true, 1),
('5a4e0005-0000-4000-8000-000000000252', '5a4e0004-0000-4000-8000-000000000079', pg_temp.rol('model'), 'Model (lansman)', 1, 6000, true, 2),
('5a4e0005-0000-4000-8000-000000000253', '5a4e0004-0000-4000-8000-000000000079', pg_temp.rol('oyuncu'), 'Oyuncu (lansman)', 1, 13500, true, 3),
('5a4e0005-0000-4000-8000-000000000254', '5a4e0004-0000-4000-8000-000000000079', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (lansman)', 1, 8500, true, 4),
('5a4e0005-0000-4000-8000-000000000255', '5a4e0004-0000-4000-8000-000000000080', pg_temp.rol('dansci'), 'Dansçı (lansman)', 2, 19000, true, 0),
('5a4e0005-0000-4000-8000-000000000256', '5a4e0004-0000-4000-8000-000000000080', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 2, 56500, true, 1),
('5a4e0005-0000-4000-8000-000000000257', '5a4e0004-0000-4000-8000-000000000080', pg_temp.rol('model'), 'Model (lansman)', 2, 13000, true, 2),
('5a4e0005-0000-4000-8000-000000000258', '5a4e0004-0000-4000-8000-000000000080', pg_temp.rol('oyuncu'), 'Oyuncu (lansman)', 2, 24000, true, 3),
('5a4e0005-0000-4000-8000-000000000259', '5a4e0004-0000-4000-8000-000000000080', pg_temp.rol('videograf'), 'Videograf (lansman)', 2, 31500, true, 4),
('5a4e0005-0000-4000-8000-000000000260', '5a4e0004-0000-4000-8000-000000000081', pg_temp.rol('dansci'), 'Dansçı (lansman)', 2, 26000, true, 0),
('5a4e0005-0000-4000-8000-000000000261', '5a4e0004-0000-4000-8000-000000000081', pg_temp.rol('ses-isik'), 'Ses & Işık (lansman)', 1, 49500, false, 1),
('5a4e0005-0000-4000-8000-000000000262', '5a4e0004-0000-4000-8000-000000000081', pg_temp.rol('model'), 'Model (lansman)', 1, 17500, true, 2),
('5a4e0005-0000-4000-8000-000000000263', '5a4e0004-0000-4000-8000-000000000081', pg_temp.rol('oyuncu'), 'Oyuncu (lansman)', 1, 8500, false, 3),
('5a4e0005-0000-4000-8000-000000000264', '5a4e0004-0000-4000-8000-000000000081', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (lansman)', 1, 4500, true, 4),
('5a4e0005-0000-4000-8000-000000000265', '5a4e0004-0000-4000-8000-000000000082', pg_temp.rol('organizasyon'), 'Organizasyon (konferans)', 1, 252500, true, 0),
('5a4e0005-0000-4000-8000-000000000266', '5a4e0004-0000-4000-8000-000000000082', pg_temp.rol('oyuncu'), 'Oyuncu (konferans)', 1, 23000, true, 1),
('5a4e0005-0000-4000-8000-000000000267', '5a4e0004-0000-4000-8000-000000000082', pg_temp.rol('drone-pilotu'), 'Drone Pilotu (konferans)', 1, 7500, true, 2),
('5a4e0005-0000-4000-8000-000000000268', '5a4e0004-0000-4000-8000-000000000082', pg_temp.rol('tercuman'), 'Tercüman (konferans)', 1, 14500, true, 3),
('5a4e0005-0000-4000-8000-000000000269', '5a4e0004-0000-4000-8000-000000000082', pg_temp.rol('canli-yayin'), 'Canlı Yayın (konferans)', 2, 50000, true, 4),
('5a4e0005-0000-4000-8000-000000000270', '5a4e0004-0000-4000-8000-000000000083', pg_temp.rol('muzisyen'), 'Müzisyen (kurumsal)', 2, 33500, true, 0),
('5a4e0005-0000-4000-8000-000000000271', '5a4e0004-0000-4000-8000-000000000083', pg_temp.rol('konusmaci'), 'Konuşmacı (kurumsal)', 1, 31500, true, 1),
('5a4e0005-0000-4000-8000-000000000272', '5a4e0004-0000-4000-8000-000000000083', pg_temp.rol('videograf'), 'Videograf (kurumsal)', 1, 22000, true, 2),
('5a4e0005-0000-4000-8000-000000000273', '5a4e0004-0000-4000-8000-000000000083', pg_temp.rol('ses-isik'), 'Ses & Işık (kurumsal)', 1, 59500, true, 3),
('5a4e0005-0000-4000-8000-000000000274', '5a4e0004-0000-4000-8000-000000000083', pg_temp.rol('tercuman'), 'Tercüman (kurumsal)', 1, 13000, true, 4),
('5a4e0005-0000-4000-8000-000000000275', '5a4e0004-0000-4000-8000-000000000084', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (konferans)', 1, 19500, true, 0),
('5a4e0005-0000-4000-8000-000000000276', '5a4e0004-0000-4000-8000-000000000084', pg_temp.rol('oyuncu'), 'Oyuncu (konferans)', 1, 24000, true, 1),
('5a4e0005-0000-4000-8000-000000000277', '5a4e0004-0000-4000-8000-000000000085', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (konferans)', 1, 27000, true, 0),
('5a4e0005-0000-4000-8000-000000000278', '5a4e0004-0000-4000-8000-000000000085', pg_temp.rol('oyuncu'), 'Oyuncu (konferans)', 1, 13500, true, 1),
('5a4e0005-0000-4000-8000-000000000279', '5a4e0004-0000-4000-8000-000000000085', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (konferans)', 1, 9000, true, 2),
('5a4e0005-0000-4000-8000-000000000280', '5a4e0004-0000-4000-8000-000000000085', pg_temp.rol('ses-isik'), 'Ses & Işık (konferans)', 1, 53000, true, 3),
('5a4e0005-0000-4000-8000-000000000281', '5a4e0004-0000-4000-8000-000000000086', pg_temp.rol('stand-up-komedyen'), 'Stand-up Komedyen (konferans)', 1, 27500, true, 0),
('5a4e0005-0000-4000-8000-000000000282', '5a4e0004-0000-4000-8000-000000000086', pg_temp.rol('oyuncu'), 'Oyuncu (konferans)', 1, 16000, true, 1),
('5a4e0005-0000-4000-8000-000000000283', '5a4e0004-0000-4000-8000-000000000086', pg_temp.rol('etkinlik-koordinatoru'), 'Etkinlik Koordinatörü (konferans)', 1, 4000, true, 2),
('5a4e0005-0000-4000-8000-000000000284', '5a4e0004-0000-4000-8000-000000000086', pg_temp.rol('tercuman'), 'Tercüman (konferans)', 1, 11500, true, 3);
  -- gonderim (sent_at ilk kez; tetikleyici proposal_sent olayini sent_at ile yazar)
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3280.09) WHERE id = '5a4e0004-0000-4000-8000-000000000001';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(5009.12) WHERE id = '5a4e0004-0000-4000-8000-000000000002';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1432.23) WHERE id = '5a4e0004-0000-4000-8000-000000000003';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(517.00) WHERE id = '5a4e0004-0000-4000-8000-000000000004';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4453.49) WHERE id = '5a4e0004-0000-4000-8000-000000000005';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4409.22) WHERE id = '5a4e0004-0000-4000-8000-000000000006';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4384.05) WHERE id = '5a4e0004-0000-4000-8000-000000000007';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2824.46) WHERE id = '5a4e0004-0000-4000-8000-000000000008';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2052.49) WHERE id = '5a4e0004-0000-4000-8000-000000000009';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2086.68) WHERE id = '5a4e0004-0000-4000-8000-000000000010';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2087.10) WHERE id = '5a4e0004-0000-4000-8000-000000000011';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3555.40) WHERE id = '5a4e0004-0000-4000-8000-000000000012';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3592.91) WHERE id = '5a4e0004-0000-4000-8000-000000000013';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3595.43) WHERE id = '5a4e0004-0000-4000-8000-000000000014';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(164.96) WHERE id = '5a4e0004-0000-4000-8000-000000000015';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(646.38) WHERE id = '5a4e0004-0000-4000-8000-000000000016';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2905.40) WHERE id = '5a4e0004-0000-4000-8000-000000000017';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1546.95) WHERE id = '5a4e0004-0000-4000-8000-000000000018';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1523.19) WHERE id = '5a4e0004-0000-4000-8000-000000000019';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1552.17) WHERE id = '5a4e0004-0000-4000-8000-000000000020';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(864.09) WHERE id = '5a4e0004-0000-4000-8000-000000000021';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1066.59) WHERE id = '5a4e0004-0000-4000-8000-000000000022';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1070.85) WHERE id = '5a4e0004-0000-4000-8000-000000000023';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1009.31) WHERE id = '5a4e0004-0000-4000-8000-000000000024';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(164.57) WHERE id = '5a4e0004-0000-4000-8000-000000000025';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(185.57) WHERE id = '5a4e0004-0000-4000-8000-000000000026';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(175.57) WHERE id = '5a4e0004-0000-4000-8000-000000000027';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2131.06) WHERE id = '5a4e0004-0000-4000-8000-000000000028';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1353.72) WHERE id = '5a4e0004-0000-4000-8000-000000000029';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2950.67) WHERE id = '5a4e0004-0000-4000-8000-000000000030';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3748.33) WHERE id = '5a4e0004-0000-4000-8000-000000000031';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(743.26) WHERE id = '5a4e0004-0000-4000-8000-000000000032';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(748.07) WHERE id = '5a4e0004-0000-4000-8000-000000000033';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(180.90) WHERE id = '5a4e0004-0000-4000-8000-000000000034';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3405.10) WHERE id = '5a4e0004-0000-4000-8000-000000000035';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3392.19) WHERE id = '5a4e0004-0000-4000-8000-000000000036';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1378.01) WHERE id = '5a4e0004-0000-4000-8000-000000000037';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1352.86) WHERE id = '5a4e0004-0000-4000-8000-000000000038';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1350.79) WHERE id = '5a4e0004-0000-4000-8000-000000000039';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3189.62) WHERE id = '5a4e0004-0000-4000-8000-000000000040';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(5712.68) WHERE id = '5a4e0004-0000-4000-8000-000000000041';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(5677.32) WHERE id = '5a4e0004-0000-4000-8000-000000000042';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(5696.01) WHERE id = '5a4e0004-0000-4000-8000-000000000043';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3830.35) WHERE id = '5a4e0004-0000-4000-8000-000000000044';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3858.13) WHERE id = '5a4e0004-0000-4000-8000-000000000045';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2507.52) WHERE id = '5a4e0004-0000-4000-8000-000000000046';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2499.47) WHERE id = '5a4e0004-0000-4000-8000-000000000047';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2534.94) WHERE id = '5a4e0004-0000-4000-8000-000000000048';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4177.96) WHERE id = '5a4e0004-0000-4000-8000-000000000049';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4658.33) WHERE id = '5a4e0004-0000-4000-8000-000000000050';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4727.67) WHERE id = '5a4e0004-0000-4000-8000-000000000051';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(4459.64) WHERE id = '5a4e0004-0000-4000-8000-000000000052';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(133.53) WHERE id = '5a4e0004-0000-4000-8000-000000000053';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(158.85) WHERE id = '5a4e0004-0000-4000-8000-000000000054';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(174.85) WHERE id = '5a4e0004-0000-4000-8000-000000000055';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(173.09) WHERE id = '5a4e0004-0000-4000-8000-000000000056';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3007.04) WHERE id = '5a4e0004-0000-4000-8000-000000000057';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3018.22) WHERE id = '5a4e0004-0000-4000-8000-000000000058';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2981.60) WHERE id = '5a4e0004-0000-4000-8000-000000000059';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2825.88) WHERE id = '5a4e0004-0000-4000-8000-000000000060';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2728.53) WHERE id = '5a4e0004-0000-4000-8000-000000000061';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(943.21) WHERE id = '5a4e0004-0000-4000-8000-000000000062';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3693.81) WHERE id = '5a4e0004-0000-4000-8000-000000000063';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3652.72) WHERE id = '5a4e0004-0000-4000-8000-000000000064';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1425.57) WHERE id = '5a4e0004-0000-4000-8000-000000000065';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(139.47) WHERE id = '5a4e0004-0000-4000-8000-000000000066';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1802.58) WHERE id = '5a4e0004-0000-4000-8000-000000000067';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3589.12) WHERE id = '5a4e0004-0000-4000-8000-000000000068';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(201.67) WHERE id = '5a4e0004-0000-4000-8000-000000000069';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3396.21) WHERE id = '5a4e0004-0000-4000-8000-000000000070';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3521.43) WHERE id = '5a4e0004-0000-4000-8000-000000000071';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1387.63) WHERE id = '5a4e0004-0000-4000-8000-000000000072';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1400.06) WHERE id = '5a4e0004-0000-4000-8000-000000000073';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(1410.52) WHERE id = '5a4e0004-0000-4000-8000-000000000074';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(472.85) WHERE id = '5a4e0004-0000-4000-8000-000000000075';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3014.91) WHERE id = '5a4e0004-0000-4000-8000-000000000076';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3021.15) WHERE id = '5a4e0004-0000-4000-8000-000000000077';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3008.46) WHERE id = '5a4e0004-0000-4000-8000-000000000078';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(185.51) WHERE id = '5a4e0004-0000-4000-8000-000000000079';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(174.45) WHERE id = '5a4e0004-0000-4000-8000-000000000080';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(151.68) WHERE id = '5a4e0004-0000-4000-8000-000000000081';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(3888.37) WHERE id = '5a4e0004-0000-4000-8000-000000000082';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2146.75) WHERE id = '5a4e0004-0000-4000-8000-000000000083';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2735.23) WHERE id = '5a4e0004-0000-4000-8000-000000000084';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2709.23) WHERE id = '5a4e0004-0000-4000-8000-000000000085';
UPDATE public.proposal_versions SET sent_at = pg_temp.t(2700.73) WHERE id = '5a4e0004-0000-4000-8000-000000000086';
  -- durumlar (proposal_* olaylari now() ile yazilir; asagida duzeltilir)
UPDATE public.proposal_versions SET approved_by_name = 'Serkan Güler', approved_at = pg_temp.t(3261.06) WHERE id = '5a4e0004-0000-4000-8000-000000000001';
UPDATE public.proposal_versions SET approved_by_name = 'Sevgi Erol', approved_at = pg_temp.t(4322.87) WHERE id = '5a4e0004-0000-4000-8000-000000000005';
UPDATE public.proposal_versions SET approved_by_name = 'Tarık Şahin', approved_at = pg_temp.t(2584.56) WHERE id = '5a4e0004-0000-4000-8000-000000000008';
UPDATE public.proposal_versions SET approved_by_name = 'Cem Çakır', approved_at = pg_temp.t(1991.36) WHERE id = '5a4e0004-0000-4000-8000-000000000009';
UPDATE public.proposal_versions SET approved_by_name = 'Sinan Güler', approved_at = pg_temp.t(2840.27) WHERE id = '5a4e0004-0000-4000-8000-000000000017';
UPDATE public.proposal_versions SET approved_by_name = 'Deniz Güler', approved_at = pg_temp.t(819.78) WHERE id = '5a4e0004-0000-4000-8000-000000000021';
UPDATE public.proposal_versions SET approved_by_name = 'Melis Erdoğan', approved_at = pg_temp.t(2009.88) WHERE id = '5a4e0004-0000-4000-8000-000000000028';
UPDATE public.proposal_versions SET approved_by_name = 'İlker Arslan', approved_at = pg_temp.t(3564.63) WHERE id = '5a4e0004-0000-4000-8000-000000000031';
UPDATE public.proposal_versions SET approved_by_name = 'Doruk Erdoğan', approved_at = pg_temp.t(505.28) WHERE id = '5a4e0004-0000-4000-8000-000000000032';
UPDATE public.proposal_versions SET approved_by_name = 'Selim Kara', approved_at = pg_temp.t(3043.22) WHERE id = '5a4e0004-0000-4000-8000-000000000040';
UPDATE public.proposal_versions SET approved_by_name = 'Tuğçe Şahin', approved_at = pg_temp.t(5624.70) WHERE id = '5a4e0004-0000-4000-8000-000000000041';
UPDATE public.proposal_versions SET approved_by_name = 'Emre Kurt', approved_at = pg_temp.t(3672.65) WHERE id = '5a4e0004-0000-4000-8000-000000000044';
UPDATE public.proposal_versions SET approved_by_name = 'Sevgi Erol', approved_at = pg_temp.t(2726.56) WHERE id = '5a4e0004-0000-4000-8000-000000000060';
UPDATE public.proposal_versions SET approved_by_name = 'Gökhan Demir', approved_at = pg_temp.t(904.65) WHERE id = '5a4e0004-0000-4000-8000-000000000062';
UPDATE public.proposal_versions SET approved_by_name = 'Cem Çakır', approved_at = pg_temp.t(1413.12) WHERE id = '5a4e0004-0000-4000-8000-000000000065';
UPDATE public.proposal_versions SET approved_by_name = 'Fulya Aslan', approved_at = pg_temp.t(3492.47) WHERE id = '5a4e0004-0000-4000-8000-000000000068';
UPDATE public.proposal_versions SET approved_by_name = 'Beren Kara', approved_at = pg_temp.t(3346.69) WHERE id = '5a4e0004-0000-4000-8000-000000000071';
UPDATE public.proposal_versions SET approved_by_name = 'Tuğçe Şahin', approved_at = pg_temp.t(3853.87) WHERE id = '5a4e0004-0000-4000-8000-000000000082';
UPDATE public.proposal_versions SET approved_by_name = 'Burcu Sarı', approved_at = pg_temp.t(2531.13) WHERE id = '5a4e0004-0000-4000-8000-000000000084';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000001';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000002';
UPDATE public.proposals SET status = 'expired' WHERE id = '5a4e0003-0000-4000-8000-000000000003';
UPDATE public.proposals SET status = 'revision_requested' WHERE id = '5a4e0003-0000-4000-8000-000000000004';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000005';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000006';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000007';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000008';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000009';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000010';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000011';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000012';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000013';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000014';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000015';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000016';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000017';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000018';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000019';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000020';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000021';
UPDATE public.proposals SET status = 'expired' WHERE id = '5a4e0003-0000-4000-8000-000000000022';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000023';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000024';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000025';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000026';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000027';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000028';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000029';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000030';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000031';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000032';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000033';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000034';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000035';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000036';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000037';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000038';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000039';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000040';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000041';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000042';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000043';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000044';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000045';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000046';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000047';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000048';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000049';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000050';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000051';
UPDATE public.proposals SET status = 'expired' WHERE id = '5a4e0003-0000-4000-8000-000000000052';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000053';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000054';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000055';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000056';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000057';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000058';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000059';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000060';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000061';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000062';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000063';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000064';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000065';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000066';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000067';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000068';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000069';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000070';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000071';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000072';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000073';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000074';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000075';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000076';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000077';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000078';
UPDATE public.proposals SET status = 'sent' WHERE id = '5a4e0003-0000-4000-8000-000000000079';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000080';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000081';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000082';
UPDATE public.proposals SET status = 'expired' WHERE id = '5a4e0003-0000-4000-8000-000000000083';
UPDATE public.proposals SET status = 'approved' WHERE id = '5a4e0003-0000-4000-8000-000000000084';
UPDATE public.proposals SET status = 'declined' WHERE id = '5a4e0003-0000-4000-8000-000000000085';
UPDATE public.proposals SET status = 'viewed' WHERE id = '5a4e0003-0000-4000-8000-000000000086';
  PERFORM set_config('kashe.faz7_rpc', '0', true);
END $$;

INSERT INTO public.bookings (id, proposal_version_id, seller_provider_id, buyer_organization_id, customer_id, event_id, event_date, event_type, location, guest_count, total_amount, created_at)
VALUES
('5a4e0013-0000-4000-8000-000000000287', '5a4e0004-0000-4000-8000-000000000001', '5a4e0000-0000-4000-8000-000000020001', NULL, NULL, '5a4e0002-0000-4000-8000-000000000001', pg_temp.d(-54), 'henna', 'İstanbul', 120, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000001'), pg_temp.t(3260.56)),
('5a4e0013-0000-4000-8000-000000000288', '5a4e0004-0000-4000-8000-000000000005', '5a4e0000-0000-4000-8000-000000020001', pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), NULL, '5a4e0002-0000-4000-8000-000000000005', pg_temp.d(-155), 'launch', 'İstanbul', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000005'), pg_temp.t(4322.37)),
('5a4e0013-0000-4000-8000-000000000289', '5a4e0004-0000-4000-8000-000000000008', '5a4e0000-0000-4000-8000-000000020002', NULL, NULL, '5a4e0002-0000-4000-8000-000000000006', pg_temp.d(-57), 'wedding', 'İstanbul', 100, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000008'), pg_temp.t(2584.06)),
('5a4e0013-0000-4000-8000-000000000290', '5a4e0004-0000-4000-8000-000000000009', '5a4e0000-0000-4000-8000-000000020002', NULL, '5a4e0000-0000-4000-8000-000000040007', '5a4e0002-0000-4000-8000-000000000007', pg_temp.d(-7), 'fair', 'Antalya', 200, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000009'), pg_temp.t(1990.86)),
('5a4e0013-0000-4000-8000-000000000291', '5a4e0004-0000-4000-8000-000000000017', '5a4e0000-0000-4000-8000-000000020003', NULL, NULL, '5a4e0002-0000-4000-8000-000000000011', pg_temp.d(-88), 'wedding', 'Ankara', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000017'), pg_temp.t(2839.77)),
('5a4e0013-0000-4000-8000-000000000292', '5a4e0004-0000-4000-8000-000000000021', '5a4e0000-0000-4000-8000-000000020004', NULL, NULL, '5a4e0002-0000-4000-8000-000000000013', pg_temp.d(46), 'corporate', 'İzmir', 50, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000021'), pg_temp.t(819.28)),
('5a4e0013-0000-4000-8000-000000000293', '5a4e0004-0000-4000-8000-000000000028', '5a4e0000-0000-4000-8000-000000020005', NULL, '5a4e0000-0000-4000-8000-000000040017', '5a4e0002-0000-4000-8000-000000000016', pg_temp.d(-45), 'wedding', 'İstanbul', 150, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000028'), pg_temp.t(2009.38)),
('5a4e0013-0000-4000-8000-000000000294', '5a4e0004-0000-4000-8000-000000000031', '5a4e0000-0000-4000-8000-000000020005', NULL, '5a4e0000-0000-4000-8000-000000040003', '5a4e0002-0000-4000-8000-000000000019', pg_temp.d(-137), 'wedding', 'İstanbul', 150, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000031'), pg_temp.t(3564.13)),
('5a4e0013-0000-4000-8000-000000000295', '5a4e0004-0000-4000-8000-000000000032', '5a4e0000-0000-4000-8000-000000020006', pg_temp.org('5a4e0000-0000-4000-8000-000000030006'), NULL, '5a4e0002-0000-4000-8000-000000000020', pg_temp.d(-6), 'launch', 'İstanbul', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000032'), pg_temp.t(504.78)),
('5a4e0013-0000-4000-8000-000000000296', '5a4e0004-0000-4000-8000-000000000040', '5a4e0000-0000-4000-8000-000000020007', NULL, NULL, '5a4e0002-0000-4000-8000-000000000024', pg_temp.d(-54), 'wedding', 'Antalya', 150, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000040'), pg_temp.t(3042.72)),
('5a4e0013-0000-4000-8000-000000000297', '5a4e0004-0000-4000-8000-000000000041', '5a4e0000-0000-4000-8000-000000020007', pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), NULL, '5a4e0002-0000-4000-8000-000000000025', pg_temp.d(-162), 'corporate', 'Antalya', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000041'), pg_temp.t(5624.20)),
('5a4e0013-0000-4000-8000-000000000298', '5a4e0004-0000-4000-8000-000000000044', '5a4e0000-0000-4000-8000-000000020007', pg_temp.org('5a4e0000-0000-4000-8000-000000030004'), NULL, '5a4e0002-0000-4000-8000-000000000026', pg_temp.d(-94), 'corporate', 'Gaziantep', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000044'), pg_temp.t(3672.15)),
('5a4e0013-0000-4000-8000-000000000299', '5a4e0004-0000-4000-8000-000000000060', '5a4e0000-0000-4000-8000-000000020009', pg_temp.org('5a4e0000-0000-4000-8000-000000030003'), NULL, '5a4e0002-0000-4000-8000-000000000034', pg_temp.d(-68), 'fair', 'Bursa', 150, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000060'), pg_temp.t(2726.06)),
('5a4e0013-0000-4000-8000-000000000300', '5a4e0004-0000-4000-8000-000000000062', '5a4e0000-0000-4000-8000-000000020009', NULL, '5a4e0000-0000-4000-8000-000000040011', '5a4e0002-0000-4000-8000-000000000035', pg_temp.d(21), 'corporate', 'Bursa', 50, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000062'), pg_temp.t(904.15)),
('5a4e0013-0000-4000-8000-000000000301', '5a4e0004-0000-4000-8000-000000000065', '5a4e0000-0000-4000-8000-000000020009', NULL, '5a4e0000-0000-4000-8000-000000040007', '5a4e0002-0000-4000-8000-000000000037', pg_temp.d(4), 'corporate', 'Bursa', 120, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000065'), pg_temp.t(1412.62)),
('5a4e0013-0000-4000-8000-000000000302', '5a4e0004-0000-4000-8000-000000000068', '5a4e0000-0000-4000-8000-000000020010', pg_temp.org('5a4e0000-0000-4000-8000-000000030007'), NULL, '5a4e0002-0000-4000-8000-000000000040', pg_temp.d(-96), 'launch', 'İstanbul', 80, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000068'), pg_temp.t(3491.97)),
('5a4e0013-0000-4000-8000-000000000303', '5a4e0004-0000-4000-8000-000000000071', '5a4e0000-0000-4000-8000-000000020011', NULL, '5a4e0000-0000-4000-8000-000000040004', '5a4e0002-0000-4000-8000-000000000043', pg_temp.d(-74), 'wedding', 'Gaziantep', 300, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000071'), pg_temp.t(3346.19)),
('5a4e0013-0000-4000-8000-000000000304', '5a4e0004-0000-4000-8000-000000000082', '5a4e0000-0000-4000-8000-000000020012', pg_temp.org('5a4e0000-0000-4000-8000-000000030001'), NULL, '5a4e0002-0000-4000-8000-000000000048', pg_temp.d(-80), 'conference', 'İstanbul', 150, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000082'), pg_temp.t(3853.37)),
('5a4e0013-0000-4000-8000-000000000305', '5a4e0004-0000-4000-8000-000000000084', '5a4e0000-0000-4000-8000-000000020012', pg_temp.org('5a4e0000-0000-4000-8000-000000030002'), NULL, '5a4e0002-0000-4000-8000-000000000050', pg_temp.d(-35), 'conference', 'Ankara', 800, (SELECT total_amount FROM public.proposal_versions WHERE id = '5a4e0004-0000-4000-8000-000000000084'), pg_temp.t(2530.63));

UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1272.00) WHERE id = '5a4e0013-0000-4000-8000-000000000287';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(3696.00) WHERE id = '5a4e0013-0000-4000-8000-000000000288';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1344.00) WHERE id = '5a4e0013-0000-4000-8000-000000000289';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(144.00) WHERE id = '5a4e0013-0000-4000-8000-000000000290';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1056.00) WHERE id = '5a4e0013-0000-4000-8000-000000000293';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(3264.00) WHERE id = '5a4e0013-0000-4000-8000-000000000294';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(120.00) WHERE id = '5a4e0013-0000-4000-8000-000000000295';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1272.00) WHERE id = '5a4e0013-0000-4000-8000-000000000296';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(3864.00) WHERE id = '5a4e0013-0000-4000-8000-000000000297';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(2232.00) WHERE id = '5a4e0013-0000-4000-8000-000000000298';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1608.00) WHERE id = '5a4e0013-0000-4000-8000-000000000299';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(2280.00) WHERE id = '5a4e0013-0000-4000-8000-000000000302';
UPDATE public.bookings SET status = 'completed', completed_at = pg_temp.t(1896.00) WHERE id = '5a4e0013-0000-4000-8000-000000000304';

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
