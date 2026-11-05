-- =============================================================================
-- ASAMA 25b - Guvenlik 01 DAVRANIS testi - YALNIZ DAL (Sahne verisi gerekir)
--
-- Tum is TEK islemde yapilir ve sonda ROLLBACK edilir: hicbir sey kalici
-- yazilmaz (bildirimler dahil). Yine de URETIMDE CALISTIRILMAZ: Sahne
-- hesaplari yoksa ilk adimda durur.
--
-- Kimlik: istek basina `request.jwt.claims` + `SET LOCAL ROLE authenticated`
-- (PostgREST'in yaptigi gibi). Her test bir saldiri (ENGEL beklenir) ya da
-- uygulamanin mesru akisi (YAPILDI beklenir) dener.
-- Sonuc tablosunda hepsi GECTI olmali (25 test).
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '5a4e0000-0000-4000-8000-000000090001') THEN
    RAISE EXCEPTION 'Sahne verisi yok - bu test yalniz dalda calisir';
  END IF;
END $$;

CREATE TEMP TABLE sonuc (sira int, test text, beklenen text, gercek text) ON COMMIT DROP;
GRANT ALL ON sonuc TO authenticated;
CREATE TEMP TABLE fx (ad text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON fx TO authenticated;

-- Kimlik degistirici: PostgREST benzeri (rol + JWT)
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

-- ---------------------------------------------------------------- fikstur
-- Musteri: Kaan Erol (40002), profesyonel: Ilker Sezer (10119, drone)
DO $$
DECLARE
  c uuid := '5a4e0000-0000-4000-8000-000000040002';
  p uuid := '5a4e0000-0000-4000-8000-000000010119';
  v_conv uuid;
  v_id uuid;
BEGIN
  INSERT INTO public.conversations (customer_id, professional_id, request_type)
  VALUES (c, p, 'quote') ON CONFLICT (customer_id, professional_id) DO NOTHING;
  SELECT id INTO v_conv FROM public.conversations WHERE customer_id = c AND professional_id = p;
  INSERT INTO fx VALUES ('conv', v_conv), ('musteri', c), ('pro', p);

  INSERT INTO public.quotes (conversation_id, sender_id, total_amount, services_description, expires_at, status)
  VALUES (v_conv, p, 3000, 'Drone cekimi, 2 saat, test teklifi', now() + interval '7 days', 'pending') RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('q1', v_id);
  INSERT INTO public.quotes (conversation_id, sender_id, total_amount, services_description, expires_at, status)
  VALUES (v_conv, p, 4000, 'Drone cekimi, 3 saat, test teklifi', now() + interval '7 days', 'pending') RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('q2', v_id);
  INSERT INTO public.quotes (conversation_id, sender_id, total_amount, services_description, created_at, expires_at, status)
  VALUES (v_conv, p, 5000, 'Suresi dolmus test teklifi', now() - interval '3 days', now() - interval '1 day', 'pending') RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('q3', v_id);
  INSERT INTO public.quotes (conversation_id, sender_id, total_amount, services_description, expires_at, status)
  VALUES (v_conv, p, 6000, 'Iptal testi icin teklif', now() + interval '7 days', 'pending') RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('q4', v_id);
  INSERT INTO public.messages (conversation_id, sender_id, body, message_type)
  VALUES (v_conv, c, 'Merhaba, test mesaji', 'text') RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('m1', v_id);
  INSERT INTO public.reviews (conversation_id, customer_id, professional_id, rating, body)
  VALUES (v_conv, c, p, 5, 'Test yorumu, guvenlik denemesi') RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('yorum', v_id);

  -- Basvuru testlerinin baslangic durumu (Fahri dalda degistirmis olabilir;
  -- islem sonunda geri alinir)
  UPDATE public.applications SET status = 'pending', listing_id = '5a4e0000-0000-4000-8000-000000080001'
   WHERE id IN ('5a4e0000-0000-4000-8000-000000083002', '5a4e0000-0000-4000-8000-000000083003');
  IF (SELECT count(*) FROM public.applications a JOIN public.listings l ON l.id = a.listing_id
       WHERE a.id IN ('5a4e0000-0000-4000-8000-000000083002', '5a4e0000-0000-4000-8000-000000083003')
         AND l.creator_id = '5a4e0000-0000-4000-8000-000000030003') <> 2 THEN
    RAISE EXCEPTION 'Sahne 08 basvuru fiksturu bulunamadi (ilan 080001 / basvuru 083002-083003)';
  END IF;
END $$;

-- ---------------------------------------------------------------- testler
-- T1 musteri teklif tutarini degistiremez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'musteri'));
  BEGIN
    UPDATE public.quotes SET total_amount = 1 WHERE id = (SELECT id FROM fx WHERE ad = 'q1');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (1, 'musteri teklif tutarini degistiremez', 'ENGEL', v);
END $$;

-- T2 profesyonel kendi teklifini kabul edemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'pro'));
  BEGIN
    UPDATE public.quotes SET status = 'accepted' WHERE id = (SELECT id FROM fx WHERE ad = 'q1');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (2, 'profesyonel kendi teklifini kabul edemez', 'ENGEL', v);
END $$;

-- T3 musteri teklifi kabul eder (mesru) -> rezervasyon 3000 TL
DO $$ DECLARE v text; t numeric; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'musteri'));
  BEGIN
    UPDATE public.quotes SET status = 'accepted' WHERE id = (SELECT id FROM fx WHERE ad = 'q1');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  SELECT total_amount INTO t FROM public.bookings WHERE quote_id = (SELECT id FROM fx WHERE ad = 'q1');
  INSERT INTO fx SELECT 'b1', id FROM public.bookings WHERE quote_id = (SELECT id FROM fx WHERE ad = 'q1');
  INSERT INTO sonuc VALUES (3, 'musteri teklifi kabul eder, rezervasyon 3000', 'YAPILDI 3000.00', v || ' ' || coalesce(t::text, '-'));
END $$;

-- T4 kabul edilmis teklif reddedilemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'musteri'));
  BEGIN
    UPDATE public.quotes SET status = 'declined' WHERE id = (SELECT id FROM fx WHERE ad = 'q1');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (4, 'kabul edilmis teklif geri dondurulemez', 'ENGEL', v);
END $$;

-- T5 musteri teklifi geri cekemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'musteri'));
  BEGIN
    UPDATE public.quotes SET status = 'withdrawn' WHERE id = (SELECT id FROM fx WHERE ad = 'q2');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (5, 'musteri teklifi geri cekemez', 'ENGEL', v);
END $$;

-- T6 profesyonel teklifini geri ceker (mesru)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'pro'));
  BEGIN
    UPDATE public.quotes SET status = 'withdrawn' WHERE id = (SELECT id FROM fx WHERE ad = 'q2');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (6, 'profesyonel teklifini geri ceker', 'YAPILDI', v);
END $$;

-- T7 suresi dolmus teklif kabul edilemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'musteri'));
  BEGIN
    UPDATE public.quotes SET status = 'accepted' WHERE id = (SELECT id FROM fx WHERE ad = 'q3');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (7, 'suresi dolmus teklif kabul edilemez', 'ENGEL', v);
END $$;

-- T8 suresi dolmus teklif "expired" yapilir (mesru, quotes_expire_stale yolu)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'musteri'));
  BEGIN
    UPDATE public.quotes SET status = 'expired' WHERE id = (SELECT id FROM fx WHERE ad = 'q3');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (8, 'suresi dolmus teklif expired olur', 'YAPILDI', v);
END $$;

-- T9 profesyonel teklifi 'accepted' olarak ekleyemez (pending'e cekilir)
DO $$ DECLARE v text; s text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'pro'));
  BEGIN
    INSERT INTO public.quotes (conversation_id, sender_id, total_amount, services_description, expires_at, status)
    VALUES ((SELECT id FROM fx WHERE ad = 'conv'), (SELECT id FROM fx WHERE ad = 'pro'), 7000,
            'Kabul edilmis gibi eklenen teklif', now() + interval '7 days', 'accepted')
    RETURNING status::text INTO s;
    v := 'YAPILDI ' || s;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (9, 'teklif accepted olarak eklenemez (pending olur)', 'YAPILDI pending', v);
END $$;

-- T10 musteri rezervasyonu tamamlayamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'musteri'));
  BEGIN
    UPDATE public.bookings SET status = 'completed', completed_at = now() WHERE id = (SELECT id FROM fx WHERE ad = 'b1');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (10, 'musteri rezervasyonu tamamlayamaz', 'ENGEL', v);
END $$;

-- T11 durum degismeden iptal eden degistirilemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'musteri'));
  BEGIN
    UPDATE public.bookings SET cancelled_by = (SELECT id FROM fx WHERE ad = 'pro') WHERE id = (SELECT id FROM fx WHERE ad = 'b1');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (11, 'iptal damgalari durumsuz degismez', 'ENGEL', v);
END $$;

-- T12 profesyonel rezervasyonu tamamlar (mesru)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'pro'));
  BEGIN
    UPDATE public.bookings SET status = 'completed', completed_at = now() WHERE id = (SELECT id FROM fx WHERE ad = 'b1');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (12, 'profesyonel rezervasyonu tamamlar', 'YAPILDI', v);
END $$;

-- T13 tamamlanmis rezervasyon iptal edilemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'pro'));
  BEGIN
    UPDATE public.bookings SET status = 'cancelled', cancelled_at = now() WHERE id = (SELECT id FROM fx WHERE ad = 'b1');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (13, 'tamamlanmis rezervasyon iptal edilemez', 'ENGEL', v);
END $$;

-- T14 musteri iptal eder (mesru); iptal eden kendisi olarak damgalanir
DO $$ DECLARE v text; b uuid; iptal uuid; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'musteri'));
  BEGIN
    UPDATE public.quotes SET status = 'accepted' WHERE id = (SELECT id FROM fx WHERE ad = 'q4');
    SELECT id INTO b FROM public.bookings WHERE quote_id = (SELECT id FROM fx WHERE ad = 'q4');
    UPDATE public.bookings SET status = 'cancelled', cancelled_at = now(),
           cancelled_by = (SELECT id FROM fx WHERE ad = 'pro'), cancellation_reason = 'Test iptali'
     WHERE id = b;
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  SELECT cancelled_by INTO iptal FROM public.bookings WHERE quote_id = (SELECT id FROM fx WHERE ad = 'q4');
  INSERT INTO sonuc VALUES (14, 'musteri iptal eder, iptal eden musteri', 'YAPILDI musteri',
    v || ' ' || CASE WHEN iptal = (SELECT id FROM fx WHERE ad = 'musteri') THEN 'musteri' ELSE coalesce(iptal::text, '-') END);
END $$;

-- T15 profesyonel musterinin mesajini degistiremez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'pro'));
  BEGIN
    UPDATE public.messages SET body = 'Teklifi 1 TL olarak kabul ediyorum.' WHERE id = (SELECT id FROM fx WHERE ad = 'm1');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (15, 'karsi tarafin mesaji degistirilemez', 'ENGEL', v);
END $$;

-- T16 alici mesaji okundu isaretler (mesru)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'pro'));
  BEGIN
    UPDATE public.messages SET read_at = now() WHERE id = (SELECT id FROM fx WHERE ad = 'm1');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (16, 'alici okundu isaretler', 'YAPILDI', v);
END $$;

-- T17 profesyonel sohbeti baska musteriye tasiyamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'pro'));
  BEGIN
    UPDATE public.conversations SET customer_id = '5a4e0000-0000-4000-8000-000000040001' WHERE id = (SELECT id FROM fx WHERE ad = 'conv');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (17, 'sohbet baska musteriye tasinamaz', 'ENGEL', v);
END $$;

-- T18 musteri brief'i gunceller (mesru, startConversation yolu)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'musteri'));
  BEGIN
    UPDATE public.conversations SET brief_data = '{"hizmet":"Test"}'::jsonb, location = 'Izmir', request_type = 'quote'
     WHERE id = (SELECT id FROM fx WHERE ad = 'conv');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (18, 'musteri brief gunceller', 'YAPILDI', v);
END $$;

-- T19 musteri yorumunu baska profesyonele tasiyamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'musteri'));
  BEGIN
    UPDATE public.reviews SET professional_id = '5a4e0000-0000-4000-8000-000000010003', rating = 1
     WHERE id = (SELECT id FROM fx WHERE ad = 'yorum');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (19, 'yorum baska profesyonele tasinamaz', 'ENGEL', v);
END $$;

-- T20 musteri yorumunu duzenler (mesru)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik((SELECT id FROM fx WHERE ad = 'musteri'));
  BEGIN
    UPDATE public.reviews SET rating = 4, body = 'Duzenlenmis test yorumu', created_by = (SELECT id FROM fx WHERE ad = 'musteri')
     WHERE id = (SELECT id FROM fx WHERE ad = 'yorum');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (20, 'musteri yorumunu duzenler', 'YAPILDI', v);
END $$;

-- Basvuru testleri: Sahne 08 ilani 1 (Anadolu Ilac, 30003); basvuranlar 10040 / 10038 / 20006
-- T21 basvuran kendi basvurusunu kabul edemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik('5a4e0000-0000-4000-8000-000000010038');
  BEGIN
    UPDATE public.applications SET status = 'accepted' WHERE id = '5a4e0000-0000-4000-8000-000000083002';
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (21, 'basvuran kendi basvurusunu kabul edemez', 'ENGEL', v);
END $$;

-- T22 basvuran basvuruyu baska ilana tasiyamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik('5a4e0000-0000-4000-8000-000000010038');
  BEGIN
    UPDATE public.applications SET listing_id = '5a4e0000-0000-4000-8000-000000080002' WHERE id = '5a4e0000-0000-4000-8000-000000083002';
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (22, 'basvuru baska ilana tasinamaz', 'ENGEL', v);
END $$;

-- T23 basvuran geri ceker (mesru)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik('5a4e0000-0000-4000-8000-000000010038');
  BEGIN
    UPDATE public.applications SET status = 'withdrawn' WHERE id = '5a4e0000-0000-4000-8000-000000083002';
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (23, 'basvuran geri ceker', 'YAPILDI', v);
END $$;

-- T24 ilan sahibi geri cekilmis basvuruyu kabul edemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik('5a4e0000-0000-4000-8000-000000030003');
  BEGIN
    UPDATE public.applications SET status = 'accepted' WHERE id = '5a4e0000-0000-4000-8000-000000083002';
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (24, 'geri cekilmis basvuru degerlendirilemez', 'ENGEL', v);
END $$;

-- T25 ilan sahibi baska basvuruyu kisa listeye alir (mesru)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik('5a4e0000-0000-4000-8000-000000030003');
  BEGIN
    UPDATE public.applications SET status = 'shortlisted' WHERE id = '5a4e0000-0000-4000-8000-000000083003';
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (25, 'ilan sahibi kisa listeye alir', 'YAPILDI', v);
END $$;

-- ---------------------------------------------------------------- sonuc
SELECT sira, test, beklenen, gercek,
       CASE WHEN gercek = beklenen THEN 'GECTI' ELSE 'KALDI' END AS durum
  FROM sonuc
UNION ALL
SELECT 99, 'OZET', '25 GECTI / 25',
       (SELECT count(*) FILTER (WHERE gercek = beklenen) || ' GECTI / ' || count(*) FROM sonuc), ''
 ORDER BY 1;

ROLLBACK;
