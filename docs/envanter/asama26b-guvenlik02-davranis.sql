-- =============================================================================
-- ASAMA 26b - Guvenlik 02 DAVRANIS testi - YALNIZ DAL (Sahne verisi gerekir)
--
-- Tek islem, sonda ROLLBACK: hicbir sey kalici yazilmaz. URETIMDE
-- CALISTIRILMAZ (Sahne hesaplari yoksa ilk adimda durur).
-- Kimlik: istek basina `request.jwt.claims` + `SET LOCAL ROLE` (PostgREST gibi).
-- Saldirilar ENGEL, uygulamanin mesru akislari YAPILDI bekler.
-- Sonuc tablosunda hepsi GECTI olmali (26 test).
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '5a4e0000-0000-4000-8000-000000090001') THEN
    RAISE EXCEPTION 'Sahne verisi yok - bu test yalniz dalda calisir';
  END IF;
END $$;

CREATE TEMP TABLE sonuc (sira int, test text, beklenen text, gercek text) ON COMMIT DROP;
GRANT ALL ON sonuc TO anon, authenticated;
CREATE TEMP TABLE fx (ad text PRIMARY KEY, id uuid, metin text) ON COMMIT DROP;
GRANT ALL ON fx TO anon, authenticated;

-- Kimlik degistirici: NULL = sistem (postgres); 'anon' icin ayri fonksiyon
CREATE FUNCTION pg_temp.kimlik(p uuid) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  IF p IS NULL THEN
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
  ELSE
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', p::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
  END IF;
END $f$;

CREATE FUNCTION pg_temp.anonim() RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'SET LOCAL ROLE anon';
END $f$;

CREATE FUNCTION pg_temp.fx(p text) RETURNS uuid LANGUAGE sql AS $f$ SELECT id FROM fx WHERE ad = p $f$;

-- ---------------------------------------------------------------- fikstur
-- Ilan sahibi: Anadolu Ilac (30003, ilan 080001 yayinda); yonetici 090001;
-- profesyonel Ilker Sezer (10119); musteri Kaan Erol (40002); ikinci musteri
-- Cansu Unal (40001); ikinci profesyonel Burcu Ates (10004); basvuran Utku (10038).
DO $$
DECLARE
  o  uuid := '5a4e0000-0000-4000-8000-000000030003';
  p  uuid := '5a4e0000-0000-4000-8000-000000010119';
  c  uuid := '5a4e0000-0000-4000-8000-000000040002';
  c2 uuid := '5a4e0000-0000-4000-8000-000000040001';
  p2 uuid := '5a4e0000-0000-4000-8000-000000010004';
  v_id uuid;
  v_kat int;
BEGIN
  INSERT INTO fx VALUES ('sahip', o, NULL), ('admin', '5a4e0000-0000-4000-8000-000000090001', NULL),
                        ('pro', p, NULL), ('musteri', c, NULL), ('musteri2', c2, NULL), ('pro2', p2, NULL),
                        ('basvuran', '5a4e0000-0000-4000-8000-000000010038', NULL),
                        ('ilan', '5a4e0000-0000-4000-8000-000000080001', NULL),
                        ('ilan2', '5a4e0000-0000-4000-8000-000000080002', NULL);
  UPDATE public.listings SET status = 'published' WHERE id = '5a4e0000-0000-4000-8000-000000080001';
  INSERT INTO fx SELECT 'ilan_sayac', NULL, views_count::text || '|' || updated_at::text
    FROM public.listings WHERE id = '5a4e0000-0000-4000-8000-000000080001';
  DELETE FROM public.applications
   WHERE listing_id = '5a4e0000-0000-4000-8000-000000080002'
     AND applicant_id = '5a4e0000-0000-4000-8000-000000010038';

  SELECT category_id INTO v_kat FROM public.listings WHERE id = '5a4e0000-0000-4000-8000-000000080001';

  -- Teklif topla: R1 (Kaan -> Ilker), R2 (Cansu -> Burcu)
  INSERT INTO public.quote_requests (customer_id, category_id, recipient_count)
  VALUES (c, v_kat, 1) RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('r1', v_id, NULL);
  INSERT INTO public.quote_request_recipients (request_id, professional_id, status)
  VALUES (v_id, p, 'sent') RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('rr1', v_id, NULL);

  INSERT INTO public.quote_requests (customer_id, category_id, recipient_count)
  VALUES (c2, v_kat, 1) RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('r2', v_id, NULL);
  INSERT INTO public.quote_request_recipients (request_id, professional_id, status)
  VALUES (v_id, p2, 'sent');

  -- Sohbetler: Kaan-Ilker (mesru), Cansu-Ilker (yanlis musteri) + oradaki teklif
  INSERT INTO public.conversations (customer_id, professional_id, request_type)
  VALUES (c, p, 'quote') ON CONFLICT (customer_id, professional_id) DO NOTHING;
  INSERT INTO fx SELECT 'sohbet', id, NULL FROM public.conversations WHERE customer_id = c AND professional_id = p;
  INSERT INTO public.conversations (customer_id, professional_id, request_type)
  VALUES (c2, p, 'quote') ON CONFLICT (customer_id, professional_id) DO NOTHING;
  INSERT INTO fx SELECT 'sohbet2', id, NULL FROM public.conversations WHERE customer_id = c2 AND professional_id = p;
  INSERT INTO public.quotes (conversation_id, sender_id, total_amount, services_description, expires_at)
  VALUES ((SELECT id FROM fx WHERE ad = 'sohbet2'), p, 2500, 'Baska musterinin sohbetindeki teklif', now() + interval '7 days');
END $$;

-- ---------------------------------------------------------------- ILANLAR
-- T1 sahip ilani dogrudan 'published' ekleyemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    INSERT INTO public.listings (creator_id, created_by, category_id, title, description, status)
    SELECT pg_temp.fx('sahip'), pg_temp.fx('sahip'), category_id, 'Onaysiz yayin denemesi',
           'Bu ilan onay beklemeden yayina girmeye calisiyor, test.', 'published'
      FROM public.listings WHERE id = pg_temp.fx('ilan');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (1, 'ilan published olarak eklenemez', 'ENGEL', v);
END $$;

-- T2 sahip eklerken one cikarma alani yazamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    INSERT INTO public.listings (creator_id, created_by, category_id, title, description, status, featured_home_until)
    SELECT pg_temp.fx('sahip'), pg_temp.fx('sahip'), category_id, 'Vitrin denemesi',
           'Bu ilan eklenirken ana sayfa vitrinine yazmaya calisiyor.', 'pending_approval', now() + interval '1 year'
      FROM public.listings WHERE id = pg_temp.fx('ilan');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (2, 'eklerken one cikarma yazilamaz', 'ENGEL', v);
END $$;

-- T3 sahip taslak ekler (mesru, createListing); olusturan izi kendisi
DO $$ DECLARE v text; i uuid; ob uuid; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    INSERT INTO public.listings (creator_id, created_by, category_id, title, description, status)
    SELECT pg_temp.fx('sahip'), pg_temp.fx('pro'), category_id, 'Guvenlik 02 test ilani',
           'Guvenlik 02 davranis testi icin taslak ilan, geri alinir.', 'draft'
      FROM public.listings WHERE id = pg_temp.fx('ilan')
    RETURNING id, created_by INTO i, ob;
    v := 'YAPILDI ' || CASE WHEN ob = pg_temp.fx('sahip') THEN 'sahip' ELSE coalesce(ob::text, '-') END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO fx VALUES ('yeni', i, NULL);
  INSERT INTO sonuc VALUES (3, 'sahip taslak ekler, olusturan sahip', 'YAPILDI sahip', v);
END $$;

-- T4 taslak dogrudan yayina alinamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    UPDATE public.listings SET status = 'published' WHERE id = pg_temp.fx('yeni');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (4, 'taslak -> published olmaz', 'ENGEL', v);
END $$;

-- T5 sahip onaya gonderir (mesru, publishListing)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    UPDATE public.listings SET status = 'pending_approval' WHERE id = pg_temp.fx('yeni');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (5, 'taslak -> onaya gonder', 'YAPILDI', v);
END $$;

-- T6 onay bekleyen ilani sahip yayina alamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    UPDATE public.listings SET status = 'published' WHERE id = pg_temp.fx('yeni');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (6, 'onay bekleyen -> published olmaz (sahip)', 'ENGEL', v);
END $$;

-- T7 sahip onay notu yazamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    UPDATE public.listings SET approval_note = 'Onaylandi (sahte not)' WHERE id = pg_temp.fx('yeni');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (7, 'sahip onay notu yazamaz', 'ENGEL', v);
END $$;

-- T8 yonetici onaylar (mesru, admin approveListing)
DO $$ DECLARE v text; s text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('admin'));
  BEGIN
    UPDATE public.listings SET status = 'published', approval_note = NULL, published_at = now()
     WHERE id = pg_temp.fx('yeni') RETURNING status::text INTO s;
    v := 'YAPILDI ' || coalesce(s, '-');
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (8, 'yonetici onaylar', 'YAPILDI published', v);
END $$;

-- T9 sahip yayin tarihini ileri atamaz (hep ustte kalma)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    UPDATE public.listings SET published_at = now() + interval '5 years' WHERE id = pg_temp.fx('yeni');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (9, 'yayin tarihi degistirilemez', 'ENGEL', v);
END $$;

-- T10 sahip 100 gunluk vitrin acamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    UPDATE public.listings SET featured_home_until = now() + interval '100 days' WHERE id = pg_temp.fx('yeni');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (10, 'one cikarma 14 gunu asamaz', 'ENGEL', v);
END $$;

-- T11 sahip 7 gunluk kategori one cikarma acar (mesru, simulasyon) ve acil etiketi
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    UPDATE public.listings SET featured_category_until = now() + interval '7 days' WHERE id = pg_temp.fx('yeni');
    UPDATE public.listings SET is_urgent = true, urgent_until = now() + interval '3 days' WHERE id = pg_temp.fx('yeni');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (11, 'one cikarma 7 gun + acil 3 gun', 'YAPILDI', v);
END $$;

-- T12 sahip goruntulenme sayisini yazamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    UPDATE public.listings SET views_count = 99999 WHERE id = pg_temp.fx('yeni');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (12, 'goruntulenme sayisi yazilamaz', 'ENGEL', v);
END $$;

-- T13 sahip yayindaki ilani duzenler (mesru, updateListing)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    UPDATE public.listings SET title = 'Guvenlik 02 test ilani (duzenlendi)', guest_count = 120
     WHERE id = pg_temp.fx('yeni');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (13, 'yayindaki ilan duzenlenir', 'YAPILDI', v);
END $$;

-- T14 basvuru kabulu ilani doldurur, sahip yeniden acar (mesru: acceptApplication + reopenListing)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    UPDATE public.listings SET status = 'filled' WHERE id = pg_temp.fx('yeni');
    UPDATE public.listings SET status = 'published' WHERE id = pg_temp.fx('yeni');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (14, 'dolu -> yeniden yayinda', 'YAPILDI', v);
END $$;

-- T15 kapat (mesru) ve kapali ilan sahibince yeniden yayina alinamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    UPDATE public.listings SET status = 'closed' WHERE id = pg_temp.fx('yeni');
    v := 'KAPANDI';
    UPDATE public.listings SET status = 'published' WHERE id = pg_temp.fx('yeni');
    v := v || ' ACILDI';
  EXCEPTION WHEN OTHERS THEN v := coalesce(v, '') || ' ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (15, 'kapat olur, kapali -> published olmaz', 'KAPANDI ENGEL', v);
END $$;

-- T16 iptal -> dolu -> yayin kacamagi yok (onaysiz ilan)
DO $$ DECLARE v text; i uuid; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    INSERT INTO public.listings (creator_id, created_by, category_id, title, description, status)
    SELECT pg_temp.fx('sahip'), pg_temp.fx('sahip'), category_id, 'Kacamak denemesi',
           'Onaysiz ilan iptal edilip dolu yapilarak yayina sokulmaya calisiliyor.', 'pending_approval'
      FROM public.listings WHERE id = pg_temp.fx('ilan')
    RETURNING id INTO i;
    UPDATE public.listings SET status = 'cancelled' WHERE id = i;
    v := 'IPTAL';
    UPDATE public.listings SET status = 'filled' WHERE id = i;
    v := v || ' DOLU';
  EXCEPTION WHEN OTHERS THEN v := coalesce(v, '') || ' ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (16, 'onaysiz: iptal olur, iptal -> dolu olmaz', 'IPTAL ENGEL', v);
END $$;

-- T17 girissiz ziyaretci goruntulenme sayar; updated_at oynamaz
DO $$ DECLARE v text; once text; sonra text; BEGIN
  SELECT metin INTO once FROM fx WHERE ad = 'ilan_sayac';
  PERFORM pg_temp.anonim();
  BEGIN
    PERFORM public.ilan_goruntulenme_artir(pg_temp.fx('ilan'));
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  SELECT views_count::text || '|' || updated_at::text INTO sonra FROM public.listings WHERE id = pg_temp.fx('ilan');
  INSERT INTO sonuc VALUES (17, 'ziyaretci +1 sayar, updated_at ayni', 'YAPILDI +1 ayni',
    v || ' +' || (split_part(sonra, '|', 1)::int - split_part(once, '|', 1)::int)::text
      || ' ' || CASE WHEN split_part(sonra, '|', 2) = split_part(once, '|', 2) THEN 'ayni' ELSE 'degisti' END);
END $$;

-- T18 sahip kendi ilanini goruntuleyince sayilmaz
DO $$ DECLARE v text; once int; sonra int; BEGIN
  SELECT views_count INTO once FROM public.listings WHERE id = pg_temp.fx('ilan');
  PERFORM pg_temp.kimlik(pg_temp.fx('sahip'));
  BEGIN
    PERFORM public.ilan_goruntulenme_artir(pg_temp.fx('ilan'));
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  SELECT views_count INTO sonra FROM public.listings WHERE id = pg_temp.fx('ilan');
  v := v || ' +' || (sonra - once)::text;
  INSERT INTO sonuc VALUES (18, 'sahibin ziyareti sayilmaz', 'YAPILDI +0', v);
END $$;

-- ---------------------------------------------------------------- TEKLIF TOPLA
-- T19 profesyonel alici satirini baska talebe tasiyamaz (baskasinin talebini okuma)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    UPDATE public.quote_request_recipients SET request_id = pg_temp.fx('r2') WHERE id = pg_temp.fx('rr1');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (19, 'alici satiri baska talebe tasinamaz', 'ENGEL', v);
END $$;

-- T20 profesyonel talebi goruldu isaretler (mesru, markRequestViewed)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    UPDATE public.quote_request_recipients SET status = 'viewed'
     WHERE id = pg_temp.fx('rr1') AND professional_id = pg_temp.fx('pro') AND status = 'sent';
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (20, 'alici goruldu isaretler', 'YAPILDI', v);
END $$;

-- T21 teklif vermeden 'quoted' olmaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    UPDATE public.quote_request_recipients SET status = 'quoted' WHERE id = pg_temp.fx('rr1');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (21, 'teklifsiz quoted olmaz', 'ENGEL', v);
END $$;

-- T22 baska musterinin sohbetine baglanamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    UPDATE public.quote_request_recipients
       SET status = 'quoted', conversation_id = pg_temp.fx('sohbet2'), responded_at = now()
     WHERE id = pg_temp.fx('rr1');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (22, 'yanlis sohbete baglanamaz', 'ENGEL', v);
END $$;

-- T23 profesyonel teklif verir (mesru, submitQuote: once teklif, sonra alici)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    INSERT INTO public.quotes (conversation_id, sender_id, total_amount, services_description, expires_at)
    VALUES (pg_temp.fx('sohbet'), pg_temp.fx('pro'), 4200, 'Teklif topla yaniti (test)', now() + interval '7 days');
    UPDATE public.quote_request_recipients
       SET status = 'quoted', conversation_id = pg_temp.fx('sohbet'), responded_at = now()
     WHERE id = pg_temp.fx('rr1');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (23, 'teklif verir, alici quoted', 'YAPILDI', v);
END $$;

-- T24 teklif verilmis talep reddedilmis gibi isaretlenemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    UPDATE public.quote_request_recipients SET status = 'declined' WHERE id = pg_temp.fx('rr1');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (24, 'quoted -> declined olmaz', 'ENGEL', v);
END $$;

-- T25 musteri alici eklerken durum 'sent'e cekilir
DO $$ DECLARE v text; s text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    INSERT INTO public.quote_request_recipients (request_id, professional_id, status)
    VALUES (pg_temp.fx('r1'), pg_temp.fx('pro2'), 'quoted') RETURNING status::text INTO s;
    v := 'YAPILDI ' || s;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (25, 'alici quoted eklenemez (sent olur)', 'YAPILDI sent', v);
END $$;

-- ---------------------------------------------------------------- BASVURU
-- T26 basvuran 'accepted' olarak basvuru ekleyemez (pending olur)
DO $$ DECLARE v text; s text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('basvuran'));
  BEGIN
    INSERT INTO public.applications (listing_id, applicant_id, cover_message, status)
    VALUES (pg_temp.fx('ilan2'), pg_temp.fx('basvuran'), 'Guvenlik 02 testi: kabul edilmis gibi basvuru.', 'accepted')
    RETURNING status::text INTO s;
    v := 'YAPILDI ' || s;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (26, 'basvuru accepted eklenemez (pending olur)', 'YAPILDI pending', v);
END $$;

-- ---------------------------------------------------------------- sonuc
SELECT sira, test, beklenen, gercek,
       CASE WHEN gercek = beklenen THEN 'GECTI' ELSE 'KALDI' END AS durum
  FROM sonuc
UNION ALL
SELECT 99, 'OZET', '26 GECTI / 26',
       (SELECT count(*) FILTER (WHERE gercek = beklenen) || ' GECTI / ' || count(*) FROM sonuc), ''
 ORDER BY 1;

ROLLBACK;
