-- =============================================================================
-- ASAMA 28b - Guvenlik 04 DAVRANIS testi - YALNIZ DAL (Sahne verisi gerekir)
--
-- Tek islem, sonda ROLLBACK: hicbir sey kalici yazilmaz. URETIMDE
-- CALISTIRILMAZ (Sahne hesaplari yoksa ilk adimda durur).
-- Kimlik: istek basina `request.jwt.claims` + `SET LOCAL ROLE` (PostgREST gibi).
-- Saldirilar ENGEL / GORUNMEZ / GIZLI, uygulamanin mesru akislari YAPILDI /
-- GORUNUR bekler. Sonuc tablosunda hepsi GECTI olmali (32 test).
--
-- Iliski testleri tek bir "gizli" musteri uzerinden sirayla yapilir: once
-- gorunmedigi kanitlanir, iliski (sistem olarak) eklenir, gorundugu kanitlanir,
-- iliski geri alinir.
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

-- Bakan (NULL = girissiz) hedef profili okuyabiliyor mu?
CREATE FUNCTION pg_temp.gorur(p_bakan uuid, p_hedef uuid) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  n int;
BEGIN
  IF p_bakan IS NULL THEN
    PERFORM pg_temp.anonim();
  ELSE
    PERFORM pg_temp.kimlik(p_bakan);
  END IF;
  SELECT count(*) INTO n FROM public.profiles WHERE id = p_hedef;
  PERFORM pg_temp.kimlik(NULL);
  RETURN CASE WHEN n > 0 THEN 'GORUNUR' ELSE 'GORUNMEZ' END;
END $f$;

-- Bakan teklif talebi butcesini RPC ile alabiliyor mu?
CREATE FUNCTION pg_temp.butce(p_bakan uuid, p_talep uuid) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  v text;
BEGIN
  IF p_bakan IS NULL THEN
    PERFORM pg_temp.anonim();
  ELSE
    PERFORM pg_temp.kimlik(p_bakan);
  END IF;
  BEGIN
    SELECT coalesce(b.budget_min::bigint::text, '-') || '-' || coalesce(b.budget_max::bigint::text, '-')
      INTO v
      FROM public.teklif_talebi_butceleri(ARRAY[p_talep]) b;
    v := coalesce(v, 'GIZLI');
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  RETURN v;
END $f$;

-- ---------------------------------------------------------------- fikstur
-- Ilker Sezer (10119, profesyonel, Lumen ekibinde), Kaan Erol (40002, musteri,
-- yayinda ilani var), Lumen ajansi (20002) ve yonetici uyesi 10112, Anadolu Ilac
-- (30003) ve uyesi Deniz Erol (31003), Fulya Aslan kurumu (30007) ve uyesi
-- Gamze Kara (31007), yonetici 090001.
-- "gizli": ilan sahibi / yorum yazari OLMAYAN, Ilker ve Lumen ile iliskisi
-- olmayan musteri (Sahne'de Gamze Kara).
DO $$
DECLARE
  p  uuid := '5a4e0000-0000-4000-8000-000000010119';
  c  uuid := '5a4e0000-0000-4000-8000-000000040002';
  v_id uuid;
  v_kat int;
BEGIN
  INSERT INTO fx VALUES ('pro', p, NULL), ('musteri', c, NULL),
                        ('ajans', '5a4e0000-0000-4000-8000-000000020002', NULL),
                        ('ajans_uyesi', '5a4e0000-0000-4000-8000-000000010112', NULL),
                        ('kurum', '5a4e0000-0000-4000-8000-000000030003', NULL),
                        ('kurum_uyesi', '5a4e0000-0000-4000-8000-000000031003', NULL),
                        ('kurum2', '5a4e0000-0000-4000-8000-000000030007', NULL),
                        ('admin', '5a4e0000-0000-4000-8000-000000090001', NULL);

  INSERT INTO fx
  SELECT 'gizli', x.id, NULL FROM public.profiles x
   WHERE x.id = '5a4e0000-0000-4000-8000-000000031007'
     AND NOT EXISTS (SELECT 1 FROM public.listings l WHERE l.creator_id = x.id AND l.status IN ('published', 'filled', 'closed'))
     AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.customer_id = x.id OR r.created_by = x.id)
     AND NOT EXISTS (SELECT 1 FROM public.conversations cv WHERE cv.customer_id = x.id
                        AND cv.professional_id IN (p, '5a4e0000-0000-4000-8000-000000020002'));

  -- Ilker ile hicbir iliskisi olmayan profesyonel
  INSERT INTO fx
  SELECT 'yabanci', x.id, NULL FROM public.profiles x
   WHERE x.id::text LIKE '5a4e%' AND x.role = 'professional' AND NOT x.is_admin AND x.id <> p
     AND NOT EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.user_id = x.id)
     AND NOT EXISTS (SELECT 1 FROM public.quote_request_recipients r WHERE r.professional_id = x.id)
   ORDER BY x.id LIMIT 1;

  -- Yayindaki profesyonel
  INSERT INTO fx
  SELECT 'yayindaki_pro', x.id, NULL FROM public.profiles x
   WHERE x.role = 'professional' AND x.is_published ORDER BY x.id LIMIT 1;

  -- Teklif (proposals) + satici kurulusta teklif gorebilen uye
  INSERT INTO fx
  SELECT 'teklif', pr.id, NULL FROM public.proposals pr ORDER BY pr.created_at LIMIT 1;
  INSERT INTO fx
  SELECT 'satici', om.user_id, NULL
    FROM public.proposals pr JOIN public.organization_memberships om ON om.organization_id = pr.seller_organization_id
   WHERE pr.id = (SELECT id FROM fx WHERE ad = 'teklif') AND om.status = 'active'
     AND public.user_has_org_permission(om.user_id, pr.seller_organization_id, 'proposals.view')
   ORDER BY om.user_id LIMIT 1;

  -- Yorum (yorum yazari testi icin created_by gecici degisir)
  INSERT INTO fx SELECT 'yorum', r.id, r.created_by::text FROM public.reviews r ORDER BY r.created_at LIMIT 1;

  -- Kategori
  SELECT s.category_id INTO v_kat FROM public.services s WHERE s.profile_id = p AND s.category_id IS NOT NULL ORDER BY s.id LIMIT 1;
  INSERT INTO fx VALUES ('kategori', NULL, v_kat::text);

  -- Kaan'in iki talebi: butce gizli / paylasilan; ikisi de Ilker'e gonderildi
  INSERT INTO public.quote_requests (customer_id, category_id, recipient_count, share_budget, budget_min, budget_max)
  VALUES (c, v_kat, 1, false, 50000, 80000) RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('talep_gizli', v_id, NULL);
  INSERT INTO public.quote_request_recipients (request_id, professional_id) VALUES (v_id, p);
  INSERT INTO public.quote_requests (customer_id, category_id, recipient_count, share_budget, budget_min, budget_max)
  VALUES (c, v_kat, 1, true, 30000, 40000) RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('talep_acik', v_id, NULL);
  INSERT INTO public.quote_request_recipients (request_id, professional_id) VALUES (v_id, p);
  -- Anadolu Ilac talebi (kurum uyesi butceyi gorur)
  INSERT INTO public.quote_requests (customer_id, category_id, recipient_count, share_budget, budget_min, budget_max)
  VALUES ('5a4e0000-0000-4000-8000-000000030003', v_kat, 0, false, 10000, 20000) RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('talep_kurum', v_id, NULL);

  -- Ilker'in takviminde notlu bir gun
  INSERT INTO public.availability_blocks (profile_id, blocked_date, note)
  VALUES (p, current_date + 200, 'ozel not - test') ON CONFLICT DO NOTHING;

  IF (SELECT count(*) FROM fx WHERE id IS NOT NULL) < 15 THEN
    RAISE EXCEPTION 'Fikstur eksik: %', (SELECT string_agg(ad, ', ') FROM fx WHERE id IS NULL AND ad <> 'kategori');
  END IF;
END $$;

-- ---------------------------------------------------------------- PROFIL: SIZINTI
-- T1 girissiz, iliskisiz musteriyi okuyamaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (1, 'girissiz iliskisiz musteri', 'GORUNMEZ', pg_temp.gorur(NULL, pg_temp.fx('gizli')));
END $$;

-- T2 girissiz okunabilen musteri / kurum profillerinin hepsi ilan sahibi ya da yorum yazari
DO $$ DECLARE n int; BEGIN
  PERFORM pg_temp.anonim();
  SELECT count(*) INTO n FROM public.profiles x
   WHERE x.role IN ('client', 'business')
     AND NOT EXISTS (SELECT 1 FROM public.listings l WHERE l.creator_id = x.id AND l.status IN ('published', 'filled', 'closed'))
     AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.customer_id = x.id OR r.created_by = x.id);
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (2, 'girissiz: kamusal iliskisi olmayan musteri sayisi', '0', n::text);
END $$;

-- T3 profesyonel, iliskisi olmayan musteriyi okuyamaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (3, 'profesyonel iliskisiz musteri', 'GORUNMEZ', pg_temp.gorur(pg_temp.fx('pro'), pg_temp.fx('gizli')));
END $$;

-- T4 ajans uyesi, iliskisiz musteriyi okuyamaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (4, 'ajans uyesi iliskisiz musteri', 'GORUNMEZ', pg_temp.gorur(pg_temp.fx('ajans_uyesi'), pg_temp.fx('gizli')));
END $$;

-- T5 girissiz profile_completeness okuyamaz
DO $$ DECLARE v text; n int; BEGIN
  PERFORM pg_temp.anonim();
  BEGIN
    SELECT count(*) INTO n FROM public.profile_completeness;
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (5, 'girissiz profile_completeness', 'ENGEL', v);
END $$;

-- ---------------------------------------------------------------- PROFIL: MESRU
-- T6 girissiz yayindaki profesyoneli okur (/kesfet, /p/[id])
DO $$ BEGIN
  INSERT INTO sonuc VALUES (6, 'girissiz yayindaki profesyonel', 'GORUNUR', pg_temp.gorur(NULL, pg_temp.fx('yayindaki_pro')));
END $$;

-- T7 girissiz yayindaki ilanin sahibini okur (/ilanlar)
DO $$ BEGIN
  INSERT INTO sonuc VALUES (7, 'girissiz ilan sahibi', 'GORUNUR', pg_temp.gorur(NULL, pg_temp.fx('musteri')));
END $$;

-- T8 kullanici kendi profilini okur
DO $$ BEGIN
  INSERT INTO sonuc VALUES (8, 'kendi profili', 'GORUNUR', pg_temp.gorur(pg_temp.fx('gizli'), pg_temp.fx('gizli')));
END $$;

-- T9 yonetici her profili okur
DO $$ BEGIN
  INSERT INTO sonuc VALUES (9, 'yonetici', 'GORUNUR', pg_temp.gorur(pg_temp.fx('admin'), pg_temp.fx('gizli')));
END $$;

-- T10 kurum sahibi, kurum uyesini okur (/profil/kurumsal-ekip)
DO $$ BEGIN
  INSERT INTO sonuc VALUES (10, 'kurum sahibi uyesini gorur', 'GORUNUR', pg_temp.gorur(pg_temp.fx('kurum2'), pg_temp.fx('gizli')));
END $$;

-- T11 sohbet: profesyonel, sohbetteki musteriyi okur (/mesajlar)
DO $$ DECLARE v_id uuid; BEGIN
  INSERT INTO public.conversations (customer_id, professional_id, request_type)
  VALUES (pg_temp.fx('gizli'), pg_temp.fx('pro'), 'quote') RETURNING id INTO v_id;
  INSERT INTO sonuc VALUES (11, 'sohbet karsi tarafi', 'GORUNUR', pg_temp.gorur(pg_temp.fx('pro'), pg_temp.fx('gizli')));
  DELETE FROM public.conversations WHERE id = v_id;
END $$;

-- T12 sohbet: ajansin sohbetindeki musteriyi ajans uyesi okur
DO $$ DECLARE v_id uuid; BEGIN
  INSERT INTO public.conversations (customer_id, professional_id, request_type)
  VALUES (pg_temp.fx('gizli'), pg_temp.fx('ajans'), 'quote') RETURNING id INTO v_id;
  INSERT INTO sonuc VALUES (12, 'ajans sohbeti, ajans uyesi', 'GORUNUR', pg_temp.gorur(pg_temp.fx('ajans_uyesi'), pg_temp.fx('gizli')));
  DELETE FROM public.conversations WHERE id = v_id;
END $$;

-- T13 mesaj yazari: profesyonelin sohbetinde mesaj yazan (kurum uyesi gibi)
DO $$ DECLARE v_cv uuid; v_id uuid; BEGIN
  INSERT INTO public.conversations (customer_id, professional_id, request_type)
  VALUES (pg_temp.fx('musteri'), pg_temp.fx('pro'), 'quote')
  ON CONFLICT (customer_id, professional_id) DO NOTHING;
  SELECT id INTO v_cv FROM public.conversations WHERE customer_id = pg_temp.fx('musteri') AND professional_id = pg_temp.fx('pro');
  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES (v_cv, pg_temp.fx('gizli'), 'Test') RETURNING id INTO v_id;
  INSERT INTO sonuc VALUES (13, 'mesaj yazari', 'GORUNUR', pg_temp.gorur(pg_temp.fx('pro'), pg_temp.fx('gizli')));
  DELETE FROM public.messages WHERE id = v_id;
END $$;

-- T14 rezervasyon musterisi (/takvimim, /rezervasyon); satici tarafi Ilker
DO $$ DECLARE v_id uuid; BEGIN
  INSERT INTO public.bookings (customer_id, seller_provider_id, proposal_version_id, total_amount, status, event_date)
  SELECT pg_temp.fx('gizli'), pg_temp.fx('pro'), pv.id, 1000, 'confirmed', current_date + 90
    FROM public.proposal_versions pv
   WHERE NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.proposal_version_id = pv.id)
   ORDER BY pv.id LIMIT 1
  RETURNING id INTO v_id;
  INSERT INTO sonuc VALUES (14, 'rezervasyon musterisi', 'GORUNUR', pg_temp.gorur(pg_temp.fx('pro'), pg_temp.fx('gizli')));
  DELETE FROM public.bookings WHERE id = v_id;
END $$;

-- T15 teklif talebi sahibi (/teklif-talepleri)
DO $$ DECLARE v_id uuid; BEGIN
  INSERT INTO public.quote_requests (customer_id, category_id, recipient_count)
  VALUES (pg_temp.fx('gizli'), (SELECT metin::int FROM fx WHERE ad = 'kategori'), 1) RETURNING id INTO v_id;
  INSERT INTO public.quote_request_recipients (request_id, professional_id) VALUES (v_id, pg_temp.fx('pro'));
  INSERT INTO sonuc VALUES (15, 'teklif talebi sahibi', 'GORUNUR', pg_temp.gorur(pg_temp.fx('pro'), pg_temp.fx('gizli')));
  DELETE FROM public.quote_request_recipients WHERE request_id = v_id;
  DELETE FROM public.quote_requests WHERE id = v_id;
END $$;

-- T16 basvurulan ilanin sahibi, ilan iptal edilmis olsa da (/basvurularim)
DO $$ DECLARE v_l uuid; BEGIN
  INSERT INTO public.listings (creator_id, created_by, category_id, title, description, status)
  VALUES (pg_temp.fx('gizli'), pg_temp.fx('gizli'), (SELECT metin::int FROM fx WHERE ad = 'kategori'), 'Test ilan', 'Test aciklama', 'cancelled')
  RETURNING id INTO v_l;
  INSERT INTO public.applications (listing_id, applicant_id, cover_message)
  VALUES (v_l, pg_temp.fx('pro'), 'Test basvuru mesaji, yirmi karakterden uzun');
  INSERT INTO sonuc VALUES (16, 'basvurulan ilanin sahibi', 'GORUNUR', pg_temp.gorur(pg_temp.fx('pro'), pg_temp.fx('gizli')));
  DELETE FROM public.applications WHERE listing_id = v_l;
  DELETE FROM public.listings WHERE id = v_l;
END $$;

-- T17 davet eden ilan sahibi (/davetlerim)
DO $$ DECLARE v_l uuid; BEGIN
  INSERT INTO public.listings (creator_id, created_by, category_id, title, description, status)
  VALUES (pg_temp.fx('gizli'), pg_temp.fx('gizli'), (SELECT metin::int FROM fx WHERE ad = 'kategori'), 'Test ilan', 'Test aciklama', 'cancelled')
  RETURNING id INTO v_l;
  INSERT INTO public.listing_invitations (listing_id, inviter_id, professional_id) VALUES (v_l, pg_temp.fx('gizli'), pg_temp.fx('pro'));
  INSERT INTO sonuc VALUES (17, 'davet eden', 'GORUNUR', pg_temp.gorur(pg_temp.fx('pro'), pg_temp.fx('gizli')));
  DELETE FROM public.listing_invitations WHERE listing_id = v_l;
  DELETE FROM public.listings WHERE id = v_l;
END $$;

-- T18 teklif (proposals) alicisi, satici kurulus uyesi (/ajans/teklifler)
DO $$ DECLARE v_eski uuid; BEGIN
  SELECT buyer_user_id INTO v_eski FROM public.proposals WHERE id = pg_temp.fx('teklif');
  UPDATE public.proposals SET buyer_user_id = pg_temp.fx('gizli') WHERE id = pg_temp.fx('teklif');
  INSERT INTO sonuc VALUES (18, 'teklif alicisi', 'GORUNUR', pg_temp.gorur(pg_temp.fx('satici'), pg_temp.fx('gizli')));
  UPDATE public.proposals SET buyer_user_id = v_eski WHERE id = pg_temp.fx('teklif');
END $$;

-- T19 yorum yazari herkese acik (/p/[id] yorumlar)
DO $$ BEGIN
  UPDATE public.reviews SET created_by = pg_temp.fx('gizli') WHERE id = pg_temp.fx('yorum');
  INSERT INTO sonuc VALUES (19, 'girissiz yorum yazari', 'GORUNUR', pg_temp.gorur(NULL, pg_temp.fx('gizli')));
  UPDATE public.reviews SET created_by = (SELECT metin::uuid FROM fx WHERE ad = 'yorum') WHERE id = pg_temp.fx('yorum');
END $$;

-- T20 iliskiler geri alindi: profesyonel yine goremez
DO $$ BEGIN
  INSERT INTO sonuc VALUES (20, 'iliski bitince yine gorunmez', 'GORUNMEZ', pg_temp.gorur(pg_temp.fx('pro'), pg_temp.fx('gizli')));
END $$;

-- ---------------------------------------------------------------- TAKVIM NOTU
-- T21 girissiz takvim notunu okuyamaz
DO $$ DECLARE v text; n int; BEGIN
  PERFORM pg_temp.anonim();
  BEGIN
    SELECT count(note) INTO n FROM public.availability_blocks;
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (21, 'girissiz takvim notu', 'ENGEL', v);
END $$;

-- T22 girissiz dolu gunleri okur (/p/[id] takvim, /kesfet)
DO $$ DECLARE v text; n int; BEGIN
  PERFORM pg_temp.anonim();
  BEGIN
    SELECT count(*) INTO n FROM public.availability_blocks WHERE profile_id = pg_temp.fx('pro');
    v := CASE WHEN n > 0 THEN 'YAPILDI' ELSE 'BOS' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (22, 'girissiz dolu gunler', 'YAPILDI', v);
END $$;

-- T23 profesyonel gun isaretler (upsert) ve kaldirir (/takvimim)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    INSERT INTO public.availability_blocks (profile_id, blocked_date, note)
    VALUES (pg_temp.fx('pro'), current_date + 201, 'Not')
    ON CONFLICT (profile_id, blocked_date) DO NOTHING;
    DELETE FROM public.availability_blocks WHERE profile_id = pg_temp.fx('pro') AND blocked_date = current_date + 201;
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (23, 'takvim isaretle / kaldir', 'YAPILDI', v);
END $$;

-- ---------------------------------------------------------------- TALEP BUTCESI
-- T24 alici, paylasilmayan butceyi tablodan okuyamaz
DO $$ DECLARE v text; x numeric; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    SELECT budget_max INTO x FROM public.quote_requests WHERE id = pg_temp.fx('talep_gizli');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (24, 'alici gizli butceyi tablodan okuyamaz', 'ENGEL', v);
END $$;

-- T25 alici, paylasilmayan butceyi RPC ile de alamaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (25, 'alici gizli butce (RPC)', 'GIZLI', pg_temp.butce(pg_temp.fx('pro'), pg_temp.fx('talep_gizli')));
END $$;

-- T26 talebin gonderilmedigi profesyonel, paylasilan butceyi de alamaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (26, 'yabanci profesyonel butce', 'GIZLI', pg_temp.butce(pg_temp.fx('yabanci'), pg_temp.fx('talep_acik')));
END $$;

-- T27 girissiz butce RPC'sini cagiramaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (27, 'girissiz butce RPC', 'ENGEL', pg_temp.butce(NULL, pg_temp.fx('talep_acik')));
END $$;

-- T28 alici, paylasilan butceyi alir (/teklif-talepleri, teklif ver)
DO $$ BEGIN
  INSERT INTO sonuc VALUES (28, 'alici paylasilan butce', '30000-40000', pg_temp.butce(pg_temp.fx('pro'), pg_temp.fx('talep_acik')));
END $$;

-- T29 talep sahibi kendi gizli butcesini alir (/teklif-taleplerim/[id])
DO $$ BEGIN
  INSERT INTO sonuc VALUES (29, 'sahip kendi butcesi', '50000-80000', pg_temp.butce(pg_temp.fx('musteri'), pg_temp.fx('talep_gizli')));
END $$;

-- T30 kurum uyesi kurumun gizli butcesini alir (kurum ekibi)
DO $$ BEGIN
  INSERT INTO sonuc VALUES (30, 'kurum uyesi butce', '10000-20000', pg_temp.butce(pg_temp.fx('kurum_uyesi'), pg_temp.fx('talep_kurum')));
END $$;

-- T31 alici talep listesini butcesiz okur (/teklif-talepleri gommesi)
DO $$ DECLARE v text; n int; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    SELECT count(*) INTO n
      FROM public.quote_request_recipients r
      JOIN public.quote_requests q ON q.id = r.request_id
     WHERE r.professional_id = pg_temp.fx('pro')
       AND q.id IN (pg_temp.fx('talep_gizli'), pg_temp.fx('talep_acik'))
       AND q.share_budget IS NOT NULL AND q.status IS NOT NULL;
    v := 'YAPILDI ' || n::text;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (31, 'alici talep listesi', 'YAPILDI 2', v);
END $$;

-- T32 musteri talep olusturur (id doner) ve gunceller (/teklif-topla)
DO $$ DECLARE v text; v_id uuid; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    INSERT INTO public.quote_requests (customer_id, category_id, recipient_count, share_budget, budget_min, budget_max)
    VALUES (pg_temp.fx('musteri'), (SELECT metin::int FROM fx WHERE ad = 'kategori'), 0, false, 1000, 2000)
    RETURNING id INTO v_id;
    UPDATE public.quote_requests SET status = status WHERE id = v_id AND customer_id = pg_temp.fx('musteri');
    v := CASE WHEN v_id IS NOT NULL THEN 'YAPILDI' ELSE 'BOS' END;
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (32, 'talep olustur / guncelle', 'YAPILDI', v);
END $$;

-- ---------------------------------------------------------------- sonuc
SELECT sira, test, beklenen, gercek,
       CASE WHEN gercek = beklenen THEN 'GECTI' ELSE 'KALDI' END AS durum
  FROM sonuc
UNION ALL
SELECT 99, 'OZET', '32 GECTI / 32',
       (SELECT count(*) FILTER (WHERE gercek = beklenen) || ' GECTI / ' || count(*) FROM sonuc), ''
 ORDER BY 1;

ROLLBACK;
