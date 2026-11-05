-- =============================================================================
-- ASAMA 27b - Guvenlik 03 DAVRANIS testi - YALNIZ DAL (Sahne verisi gerekir)
--
-- Tek islem, sonda ROLLBACK: hicbir sey kalici yazilmaz. URETIMDE
-- CALISTIRILMAZ (Sahne hesaplari yoksa ilk adimda durur).
-- Kimlik: istek basina `request.jwt.claims` + `SET LOCAL ROLE` (PostgREST gibi).
-- Saldirilar ENGEL, uygulamanin mesru akislari YAPILDI bekler.
-- Sonuc tablosunda hepsi GECTI olmali (24 test).
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
-- Ilker Sezer (10119, profesyonel, Lumen ekibinde), Kaan Erol (40002, musteri),
-- yonetici 090001, Lumen Produksiyon ajansi (20002), Lumen uyesi 10112.
DO $$
DECLARE
  p  uuid := '5a4e0000-0000-4000-8000-000000010119';
  c  uuid := '5a4e0000-0000-4000-8000-000000040002';
  ag uuid := '5a4e0000-0000-4000-8000-000000020002';
  v_id uuid;
  v_kat int;
BEGIN
  INSERT INTO fx VALUES ('pro', p, NULL), ('musteri', c, NULL), ('ajans', ag, NULL),
                        ('admin', '5a4e0000-0000-4000-8000-000000090001', NULL),
                        ('ajans_uyesi', '5a4e0000-0000-4000-8000-000000010112', NULL);

  -- Ilker ile hicbir iliskisi olmayan bir profesyonel (sohbet / basvuru yok)
  INSERT INTO fx
  SELECT 'yabanci', x.id, NULL FROM public.profiles x
   WHERE x.id::text LIKE '5a4e%' AND x.role = 'professional' AND NOT x.is_admin AND x.id <> p
     AND NOT EXISTS (SELECT 1 FROM public.conversations cv
                      WHERE (cv.customer_id = x.id OR cv.professional_id = x.id
                             OR EXISTS (SELECT 1 FROM public.conversation_assignees a WHERE a.conversation_id = cv.id AND a.professional_id = x.id))
                        AND (cv.customer_id = p OR cv.professional_id = p
                             OR EXISTS (SELECT 1 FROM public.conversation_assignees a WHERE a.conversation_id = cv.id AND a.professional_id = p)))
     AND NOT EXISTS (SELECT 1 FROM public.applications ap JOIN public.listings l ON l.id = ap.listing_id
                      WHERE (ap.applicant_id = x.id AND l.creator_id = p) OR (ap.applicant_id = p AND l.creator_id = x.id))
   ORDER BY x.id LIMIT 1;

  -- Sohbetler: Kaan-Ilker (iliskili), Kaan-Lumen (ajans atama testi)
  INSERT INTO public.conversations (customer_id, professional_id, request_type)
  VALUES (c, p, 'quote') ON CONFLICT (customer_id, professional_id) DO NOTHING;
  INSERT INTO fx SELECT 'sohbet', id, NULL FROM public.conversations WHERE customer_id = c AND professional_id = p;
  INSERT INTO public.conversations (customer_id, professional_id, request_type)
  VALUES (c, ag, 'quote') ON CONFLICT (customer_id, professional_id) DO NOTHING;
  INSERT INTO fx SELECT 'ajans_sohbet', id, NULL FROM public.conversations WHERE customer_id = c AND professional_id = ag;

  -- Ilker'in anlik bildirim aboneligi (test)
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
  VALUES (p, 'https://push.example.invalid/guv03-test', 'test-p256dh', 'test-auth');

  -- Teklif: satici kurulus uyesi + teklif
  INSERT INTO fx
  SELECT 'teklif', pr.id, NULL FROM public.proposals pr ORDER BY pr.created_at LIMIT 1;
  INSERT INTO fx
  SELECT 'satici', om.user_id, NULL
    FROM public.proposals pr JOIN public.organization_memberships om ON om.organization_id = pr.seller_organization_id
   WHERE pr.id = (SELECT id FROM fx WHERE ad = 'teklif') AND om.status = 'active'
     AND public.user_has_org_permission(om.user_id, pr.seller_organization_id, 'proposals.manage')
   ORDER BY om.user_id LIMIT 1;

  -- Hizmetler
  INSERT INTO fx SELECT 'hizmet', s.id, NULL FROM public.services s WHERE s.profile_id = p ORDER BY s.id LIMIT 1;
  INSERT INTO fx SELECT 'baska_hizmet', s.id, NULL FROM public.services s WHERE s.profile_id <> p ORDER BY s.id LIMIT 1;

  -- Kaan'in teklif topla talebi (ek yolu testi)
  SELECT category_id INTO v_kat FROM public.services WHERE id = (SELECT id FROM fx WHERE ad = 'hizmet');
  INSERT INTO public.quote_requests (customer_id, category_id, recipient_count)
  VALUES (c, v_kat, 0) RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('talep', v_id, NULL);

  -- Ilker premium temiz baslar
  UPDATE public.profiles SET premium_tier = 'none', premium_until = NULL WHERE id = p;

  IF (SELECT count(*) FROM fx WHERE id IS NOT NULL) < 13 THEN
    RAISE EXCEPTION 'Fikstur eksik: %', (SELECT string_agg(ad, ', ') FROM fx WHERE id IS NULL);
  END IF;
END $$;

-- ---------------------------------------------------------------- YONETICI FONKSIYONLARI
-- T1 girissiz yonetim islem kaydini okuyamaz
DO $$ DECLARE v text; n int; BEGIN
  PERFORM pg_temp.anonim();
  BEGIN
    SELECT count(*) INTO n FROM public.admin_recent_actions(5);
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (1, 'girissiz admin_recent_actions', 'ENGEL', v);
END $$;

-- T2 girissiz ciro ozetini okuyamaz
DO $$ DECLARE v text; n int; BEGIN
  PERFORM pg_temp.anonim();
  BEGIN
    SELECT count(*) INTO n FROM public.admin_booking_summary(30);
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (2, 'girissiz admin_booking_summary', 'ENGEL', v);
END $$;

-- T3 uye (yonetici degil) profil listesini okuyamaz
DO $$ DECLARE v text; n int; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    SELECT count(*) INTO n FROM public.admin_retention_incomplete_pros();
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (3, 'uye admin_retention_incomplete_pros', 'ENGEL', v);
END $$;

-- T4 yonetici istatistikleri okur (mesru, /admin/istatistikler)
DO $$ DECLARE v text; n int; m int; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('admin'));
  BEGIN
    SELECT count(*) INTO n FROM public.admin_booking_summary(30);
    SELECT count(*) INTO m FROM public.admin_stats_weekly_compare();
    v := 'YAPILDI ' || n::text || CASE WHEN m > 0 THEN ' +' ELSE ' 0' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (4, 'yonetici istatistik okur', 'YAPILDI 1 +', v);
END $$;

-- ---------------------------------------------------------------- BILDIRIM
-- T5 girissiz bildirim gonderemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.anonim();
  BEGIN
    PERFORM public.notify_quote_request_recipients(ARRAY[pg_temp.fx('pro')], '/teklif-talepleri');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (5, 'girissiz bildirim gonderemez', 'ENGEL', v);
END $$;

-- T6 dis baglantili bildirim olmaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    PERFORM public.notify_quote_request_recipients(ARRAY[pg_temp.fx('pro')], '//kotu.example/giris');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (6, 'dis baglanti reddedilir', 'ENGEL', v);
END $$;

-- T7 talebinin alicisi olmayan kisiye bildirim dusmez
DO $$ DECLARE v text; once int; sonra int; BEGIN
  SELECT count(*) INTO once FROM public.notifications WHERE user_id = pg_temp.fx('yabanci');
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    PERFORM public.notify_quote_request_recipients(ARRAY[pg_temp.fx('yabanci')], '/teklif-talepleri');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  SELECT count(*) INTO sonra FROM public.notifications WHERE user_id = pg_temp.fx('yabanci');
  INSERT INTO sonuc VALUES (7, 'ilgisiz kisiye bildirim dusmez', 'YAPILDI +0', v || ' +' || (sonra - once)::text);
END $$;

-- T8 kendi talebinin alicisina bildirim (mesru, teklif topla)
DO $$ DECLARE v text; once int; sonra int; BEGIN
  INSERT INTO public.quote_request_recipients (request_id, professional_id, status)
  VALUES (pg_temp.fx('talep'), pg_temp.fx('pro'), 'sent');
  SELECT count(*) INTO once FROM public.notifications WHERE user_id = pg_temp.fx('pro');
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    PERFORM public.notify_quote_request_recipients(ARRAY[pg_temp.fx('pro')], '/teklif-talepleri');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  SELECT count(*) INTO sonra FROM public.notifications WHERE user_id = pg_temp.fx('pro');
  INSERT INTO sonuc VALUES (8, 'alicisina bildirim gider', 'YAPILDI +1', v || ' +' || (sonra - once)::text);
END $$;

-- ---------------------------------------------------------------- ANLIK BILDIRIM ABONELIGI
-- T9 girissiz abonelik okuyamaz
DO $$ DECLARE v text; n int; BEGIN
  PERFORM pg_temp.anonim();
  BEGIN
    SELECT count(*) INTO n FROM public.get_push_subscriptions_for_user(pg_temp.fx('pro'));
    v := 'YAPILDI ' || n::text;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (9, 'girissiz abonelik okuyamaz', 'ENGEL', v);
END $$;

-- T10 ilgisiz uye abonelik goremez
DO $$ DECLARE v text; n int; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('yabanci'));
  BEGIN
    SELECT count(*) INTO n FROM public.get_push_subscriptions_for_user(pg_temp.fx('pro'));
    v := 'YAPILDI ' || n::text;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (10, 'ilgisiz uye abonelik goremez', 'YAPILDI 0', v);
END $$;

-- T11 ilgisiz uye abonelik silemez
DO $$ DECLARE v text; kalan int; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('yabanci'));
  BEGIN
    PERFORM public.delete_push_subscription_by_endpoint('https://push.example.invalid/guv03-test');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  SELECT count(*) INTO kalan FROM public.push_subscriptions WHERE endpoint = 'https://push.example.invalid/guv03-test';
  INSERT INTO sonuc VALUES (11, 'ilgisiz uye abonelik silemez', 'YAPILDI kaldi',
    v || ' ' || CASE WHEN kalan = 1 THEN 'kaldi' ELSE 'silindi' END);
END $$;

-- T12 sohbet tarafi abonelige ulasir (mesru, mesaj / teklif bildirimi)
DO $$ DECLARE v text; n int; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    SELECT count(*) INTO n FROM public.get_push_subscriptions_for_user(pg_temp.fx('pro'));
    v := 'YAPILDI ' || n::text;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (12, 'sohbet tarafi aboneligi gorur', 'YAPILDI 1', v);
END $$;

-- ---------------------------------------------------------------- TEKLIF DOSYASI
-- T13 satici teklifin alicisini degistiremez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('satici'));
  BEGIN
    UPDATE public.proposals SET buyer_user_id = pg_temp.fx('musteri') WHERE id = pg_temp.fx('teklif');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (13, 'teklif alicisi degistirilemez', 'ENGEL', v);
END $$;

-- T14 satici teklif basligini duzenler (mesru, updateProposalFields)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('satici'));
  BEGIN
    UPDATE public.proposals SET title = title || ' (test)', client_name = client_name WHERE id = pg_temp.fx('teklif');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (14, 'teklif basligi duzenlenir', 'YAPILDI', v);
END $$;

-- ---------------------------------------------------------------- EKLENTI
-- T15 profesyonel baskasinin hizmetine eklenti ekleyemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    INSERT INTO public.service_addons (service_id, profile_id, title, price)
    VALUES (pg_temp.fx('baska_hizmet'), pg_temp.fx('pro'), 'Baskasinin hizmetine eklenti', 1);
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (15, 'baskasinin hizmetine eklenti olmaz', 'ENGEL', v);
END $$;

-- T16 kendi hizmetine eklenti (mesru)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    INSERT INTO public.service_addons (service_id, profile_id, title, price)
    VALUES (pg_temp.fx('hizmet'), pg_temp.fx('pro'), 'Ek kurgu (test)', 1500);
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (16, 'kendi hizmetine eklenti', 'YAPILDI', v);
END $$;

-- ---------------------------------------------------------------- SOHBET ATAMA
-- T17 ajans ekibinde olmayan birini sohbete atayamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('ajans'));
  BEGIN
    INSERT INTO public.conversation_assignees (conversation_id, professional_id, assigned_by)
    VALUES (pg_temp.fx('ajans_sohbet'), pg_temp.fx('yabanci'), pg_temp.fx('ajans'));
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (17, 'ekip disina atama olmaz', 'ENGEL', v);
END $$;

-- T18 ajans ekip uyesini atar (mesru, assignConversation)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('ajans'));
  BEGIN
    INSERT INTO public.conversation_assignees (conversation_id, professional_id, assigned_by)
    VALUES (pg_temp.fx('ajans_sohbet'), pg_temp.fx('ajans_uyesi'), pg_temp.fx('ajans'));
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (18, 'ekip uyesi atanir', 'YAPILDI', v);
END $$;

-- ---------------------------------------------------------------- EK YOLU
-- T19 mesaj eki baskasinin dosyasini gosteremez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    INSERT INTO public.messages (conversation_id, sender_id, body, message_type, attachment_path, attachment_type, attachment_name)
    VALUES (pg_temp.fx('sohbet'), pg_temp.fx('musteri'), 'Dosya', 'file',
            pg_temp.fx('pro')::text || '/baska-sohbet/gizli.pdf', 'application/pdf', 'gizli.pdf');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (19, 'mesaj eki baskasinin dosyasi olamaz', 'ENGEL', v);
END $$;

-- T20 kendi yukledigi dosyayla mesaj (mesru, sendFileMessage)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    INSERT INTO public.messages (conversation_id, sender_id, body, message_type, attachment_path, attachment_type, attachment_name)
    VALUES (pg_temp.fx('sohbet'), pg_temp.fx('musteri'), 'Dosya', 'file',
            pg_temp.fx('musteri')::text || '/' || pg_temp.fx('sohbet')::text || '/test.pdf', 'application/pdf', 'test.pdf');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (20, 'kendi dosyasiyla mesaj', 'YAPILDI', v);
END $$;

-- T21 teklif topla ekini baskasinin dosyasina ceviremez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    UPDATE public.quote_requests SET attachment_path = pg_temp.fx('pro')::text || '/gizli.pdf' WHERE id = pg_temp.fx('talep');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (21, 'talep eki baskasinin dosyasi olamaz', 'ENGEL', v);
END $$;

-- ---------------------------------------------------------------- PREMIUM
-- T22 profesyonel 5 yillik premium yazamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    UPDATE public.profiles SET premium_tier = 'premium', premium_until = now() + interval '5 years' WHERE id = pg_temp.fx('pro');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (22, 'premium 12 ayi asamaz', 'ENGEL', v);
END $$;

-- T23 profesyonel ajans planini alamaz
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    UPDATE public.profiles SET premium_tier = 'agency', premium_until = now() + interval '1 month' WHERE id = pg_temp.fx('pro');
    v := CASE WHEN FOUND THEN 'YAPILDI' ELSE 'SATIR YOK' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (23, 'rolune uymayan plan olmaz', 'ENGEL', v);
END $$;

-- T24 6 aylik premium simulasyonu ve iptali (mesru, /premium)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    UPDATE public.profiles SET premium_tier = 'plus', premium_until = now() + interval '6 months' WHERE id = pg_temp.fx('pro');
    v := 'ACILDI';
    UPDATE public.profiles SET premium_tier = 'none', premium_until = NULL WHERE id = pg_temp.fx('pro');
    v := v || ' KAPANDI';
  EXCEPTION WHEN OTHERS THEN v := coalesce(v, '') || ' ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (24, 'premium 6 ay ac / kapat', 'ACILDI KAPANDI', v);
END $$;

-- ---------------------------------------------------------------- sonuc
SELECT sira, test, beklenen, gercek,
       CASE WHEN gercek = beklenen THEN 'GECTI' ELSE 'KALDI' END AS durum
  FROM sonuc
UNION ALL
SELECT 99, 'OZET', '24 GECTI / 24',
       (SELECT count(*) FILTER (WHERE gercek = beklenen) || ' GECTI / ' || count(*) FROM sonuc), ''
 ORDER BY 1;

ROLLBACK;
