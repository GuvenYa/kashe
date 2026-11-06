-- =============================================================================
-- ASAMA 29b - Guvenlik 05 DAVRANIS testi - YALNIZ DAL (Sahne verisi gerekir)
--
-- Tek islem, sonda ROLLBACK: hicbir sey kalici yazilmaz (dosya deposuna
-- yalniz kayit satiri eklenir, dosya yuklenmez). URETIMDE CALISTIRILMAZ.
-- Kimlik: istek basina `request.jwt.claims` + `SET LOCAL ROLE` (PostgREST gibi).
-- Saldirilar ENGEL / GORUNMEZ, uygulamanin mesru akislari YAPILDI / GORUNUR
-- bekler. Sonuc tablosunda hepsi GECTI olmali (32 test).
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

-- Bakan (NULL = girissiz) kovada kac dosya kaydi gorur (listeleme / indirme
-- / imzali baglanti hep bu okuma kuralindan gecer)
CREATE FUNCTION pg_temp.dosya(p_bakan uuid, p_kova text, p_ad text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  n int;
BEGIN
  IF p_bakan IS NULL THEN
    PERFORM pg_temp.anonim();
  ELSE
    PERFORM pg_temp.kimlik(p_bakan);
  END IF;
  SELECT count(*) INTO n FROM storage.objects
   WHERE bucket_id = p_kova AND (p_ad IS NULL OR name = p_ad);
  PERFORM pg_temp.kimlik(NULL);
  RETURN CASE WHEN p_ad IS NULL THEN n::text
              WHEN n > 0 THEN 'GORUNUR' ELSE 'GORUNMEZ' END;
END $f$;

-- Bakan sistem_mesaji_ekle RPC'sini cagirir
CREATE FUNCTION pg_temp.sistem(p_bakan uuid, p_sohbet uuid, p_tur text, p_kayit uuid, p_metin text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  v uuid;
  r text;
BEGIN
  IF p_bakan IS NULL THEN
    PERFORM pg_temp.anonim();
  ELSE
    PERFORM pg_temp.kimlik(p_bakan);
  END IF;
  BEGIN
    v := public.sistem_mesaji_ekle(p_sohbet, p_tur, p_kayit, p_metin);
    r := CASE WHEN v IS NULL THEN 'TEKRAR YOK' ELSE 'YAPILDI' END;
  EXCEPTION WHEN OTHERS THEN r := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  RETURN r;
END $f$;

-- ---------------------------------------------------------------- fikstur
-- Ilker Sezer (10119, profesyonel), Kaan Erol (40002, musteri), Anadolu Ilac
-- (30003, kurum) ve yonetici uyesi Deniz Erol (31003), yonetici 090001.
DO $$
DECLARE
  p  uuid := '5a4e0000-0000-4000-8000-000000010119';
  c  uuid := '5a4e0000-0000-4000-8000-000000040002';
  k  uuid := '5a4e0000-0000-4000-8000-000000030003';
  ku uuid := '5a4e0000-0000-4000-8000-000000031003';
  v_id uuid;
  v_kat int;
BEGIN
  INSERT INTO fx VALUES ('pro', p, NULL), ('musteri', c, NULL), ('kurum', k, NULL),
                        ('kurum_uyesi', ku, NULL),
                        ('admin', '5a4e0000-0000-4000-8000-000000090001', NULL);

  -- Ilker ve Anadolu ile iliskisi olmayan profesyonel
  INSERT INTO fx
  SELECT 'yabanci', x.id, NULL FROM public.profiles x
   WHERE x.id::text LIKE '5a4e%' AND x.role = 'professional' AND NOT x.is_admin AND x.id <> p
     AND NOT EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.user_id = x.id)
     AND NOT EXISTS (SELECT 1 FROM public.conversations cv WHERE cv.professional_id = x.id AND cv.customer_id IN (c, k, ku))
     AND NOT EXISTS (SELECT 1 FROM public.quote_request_recipients r WHERE r.professional_id = x.id)
   ORDER BY x.id LIMIT 1;

  SELECT s.category_id INTO v_kat FROM public.services s WHERE s.profile_id = p AND s.category_id IS NOT NULL ORDER BY s.id LIMIT 1;

  -- Sohbetler: Kaan-Ilker, Anadolu-Ilker, baska bir sohbet (yabanci)
  INSERT INTO public.conversations (customer_id, professional_id, request_type)
  VALUES (c, p, 'quote') ON CONFLICT (customer_id, professional_id) DO NOTHING;
  INSERT INTO fx SELECT 'sohbet', id, NULL FROM public.conversations WHERE customer_id = c AND professional_id = p;
  INSERT INTO public.conversations (customer_id, professional_id, request_type)
  VALUES (k, p, 'quote') ON CONFLICT (customer_id, professional_id) DO NOTHING;
  INSERT INTO fx SELECT 'kurum_sohbet', id, NULL FROM public.conversations WHERE customer_id = k AND professional_id = p;
  INSERT INTO public.conversations (customer_id, professional_id, request_type)
  VALUES (c, (SELECT id FROM fx WHERE ad = 'yabanci'), 'quote') ON CONFLICT (customer_id, professional_id) DO NOTHING;
  INSERT INTO fx SELECT 'baska_sohbet', id, NULL FROM public.conversations
   WHERE customer_id = c AND professional_id = (SELECT id FROM fx WHERE ad = 'yabanci');

  -- Baska sohbette yabancinin teklifi (sistem olarak)
  INSERT INTO public.quotes (conversation_id, sender_id, total_amount, services_description, expires_at)
  VALUES ((SELECT id FROM fx WHERE ad = 'baska_sohbet'), (SELECT id FROM fx WHERE ad = 'yabanci'),
          5000, 'Baska sohbetin teklifi (test)', now() + interval '3 days')
  RETURNING id INTO v_id;
  INSERT INTO fx VALUES ('baska_teklif', v_id, NULL);

  -- Kurum sohbetinde kurum uyesinin ekli mesaji
  INSERT INTO public.messages (conversation_id, sender_id, body, message_type, attachment_path, attachment_name, attachment_type)
  VALUES ((SELECT id FROM fx WHERE ad = 'kurum_sohbet'), ku, 'Dosya', 'file', ku::text || '/guv05-mesaj.pdf', 'guv05-mesaj.pdf', 'application/pdf');

  -- Kurumun teklif talebi (uye olusturdu, ekli), Ilker'e gonderildi
  INSERT INTO public.quote_requests (customer_id, created_by, category_id, recipient_count, attachment_path, attachment_name, attachment_type)
  VALUES (k, ku, v_kat, 1, ku::text || '/guv05-brief.pdf', 'guv05-brief.pdf', 'application/pdf')
  RETURNING id INTO v_id;
  INSERT INTO public.quote_request_recipients (request_id, professional_id) VALUES (v_id, p);

  -- Kurum ilanina Ilker'in ekli basvurusu
  INSERT INTO public.applications (listing_id, applicant_id, cover_message, attachment_path, attachment_name, attachment_type)
  VALUES ('5a4e0000-0000-4000-8000-000000080001', p, 'Guvenlik 05 test basvurusu, ekli dosya ile',
          p::text || '/guv05-cv.pdf', 'guv05-cv.pdf', 'application/pdf')
  ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.applications WHERE listing_id = '5a4e0000-0000-4000-8000-000000080001' AND applicant_id = p) THEN
    RAISE EXCEPTION 'Basvuru fiksturu olusmadi';
  END IF;
  UPDATE public.applications SET attachment_path = p::text || '/guv05-cv.pdf'
   WHERE listing_id = '5a4e0000-0000-4000-8000-000000080001' AND applicant_id = p;

  -- Dosya kayitlari (yalniz satir)
  -- Dalda gercek dosyalar da var: test kayitlari ayri adla (guv05-*)
  INSERT INTO storage.objects (bucket_id, name) VALUES
    ('avatars', p::text || '/guv05-test.png'),
    ('avatars', c::text || '/guv05-test.png'),
    ('portfolio', p::text || '/guv05-test.jpg'),
    ('blog', '5a4e0000-0000-4000-8000-000000090001/guv05-test.jpg'),
    ('message-attachments', ku::text || '/guv05-mesaj.pdf'),
    ('quote-attachments', ku::text || '/guv05-brief.pdf'),
    ('application-attachments', p::text || '/guv05-cv.pdf')
  ON CONFLICT DO NOTHING;

  -- Kaan'in ilani (dolu) ve Ilker'in kabul edilmis basvurusu
  INSERT INTO public.listings (creator_id, created_by, category_id, title, description, status)
  VALUES (c, c, v_kat, 'Guvenlik 05 test ilani', 'Guvenlik 05 test aciklamasi', 'filled')
  RETURNING id INTO v_id;
  INSERT INTO public.applications (listing_id, applicant_id, cover_message)
  VALUES (v_id, p, 'Guvenlik 05 test basvurusu, kabul edilecek')
  RETURNING id INTO v_id;
  UPDATE public.applications SET status = 'accepted' WHERE id = v_id;
  INSERT INTO fx VALUES ('kabul_basvuru', v_id, NULL);

  IF (SELECT count(*) FROM fx WHERE id IS NOT NULL) < 11 THEN
    RAISE EXCEPTION 'Fikstur eksik: %', (SELECT string_agg(ad, ', ') FROM fx WHERE id IS NULL);
  END IF;
END $$;

-- ---------------------------------------------------------------- KAMU KOVALARI
-- T1 girissiz avatar kovasini listeleyemez
DO $$ BEGIN
  INSERT INTO sonuc VALUES (1, 'girissiz avatar listesi', '0', pg_temp.dosya(NULL, 'avatars', NULL));
END $$;

-- T2 girissiz portfolyo kovasini listeleyemez
DO $$ BEGIN
  INSERT INTO sonuc VALUES (2, 'girissiz portfolyo listesi', '0', pg_temp.dosya(NULL, 'portfolio', NULL));
END $$;

-- T3 girissiz blog kovasini listeleyemez
DO $$ BEGIN
  INSERT INTO sonuc VALUES (3, 'girissiz blog listesi', '0', pg_temp.dosya(NULL, 'blog', NULL));
END $$;

-- T4 uye baskasinin avatar klasorunu goremez
DO $$ BEGIN
  INSERT INTO sonuc VALUES (4, 'uye baskasinin avatari', 'GORUNMEZ',
    pg_temp.dosya(pg_temp.fx('pro'), 'avatars', pg_temp.fx('musteri')::text || '/guv05-test.png'));
END $$;

-- T5 uye kendi avatar klasorunu listeler (/profil/duzenle eski avatari siler)
DO $$ BEGIN
  INSERT INTO sonuc VALUES (5, 'kendi avatari', 'GORUNUR',
    pg_temp.dosya(pg_temp.fx('pro'), 'avatars', pg_temp.fx('pro')::text || '/guv05-test.png'));
END $$;

-- T6 yonetici blog kovasini gorur (/admin/blog)
DO $$ BEGIN
  INSERT INTO sonuc VALUES (6, 'yonetici blog', 'GORUNUR',
    pg_temp.dosya(pg_temp.fx('admin'), 'blog', '5a4e0000-0000-4000-8000-000000090001/guv05-test.jpg'));
END $$;

-- T7 uye baskasinin portfolyo klasorunu listeleyemez (kamu baglantisi ayri)
DO $$ BEGIN
  INSERT INTO sonuc VALUES (7, 'uye baskasinin portfolyosu', 'GORUNMEZ',
    pg_temp.dosya(pg_temp.fx('musteri'), 'portfolio', pg_temp.fx('pro')::text || '/guv05-test.jpg'));
END $$;

-- ---------------------------------------------------------------- EKLER
-- T8 kurum uyesi kurum sohbetindeki eki acar
DO $$ BEGIN
  INSERT INTO sonuc VALUES (8, 'kurum uyesi mesaj eki', 'GORUNUR',
    pg_temp.dosya(pg_temp.fx('kurum_uyesi'), 'message-attachments', pg_temp.fx('kurum_uyesi')::text || '/guv05-mesaj.pdf'));
END $$;

-- T9 profesyonel (taraf) ayni eki acar
DO $$ BEGIN
  INSERT INTO sonuc VALUES (9, 'taraf mesaj eki', 'GORUNUR',
    pg_temp.dosya(pg_temp.fx('pro'), 'message-attachments', pg_temp.fx('kurum_uyesi')::text || '/guv05-mesaj.pdf'));
END $$;

-- T10 iliskisiz profesyonel eki acamaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (10, 'yabanci mesaj eki', 'GORUNMEZ',
    pg_temp.dosya(pg_temp.fx('yabanci'), 'message-attachments', pg_temp.fx('kurum_uyesi')::text || '/guv05-mesaj.pdf'));
END $$;

-- T11 kurum uyesi kurumun teklif talebi ekini acar
DO $$ BEGIN
  INSERT INTO sonuc VALUES (11, 'kurum uyesi talep eki', 'GORUNUR',
    pg_temp.dosya(pg_temp.fx('kurum_uyesi'), 'quote-attachments', pg_temp.fx('kurum_uyesi')::text || '/guv05-brief.pdf'));
END $$;

-- T12 alici profesyonel talep ekini acar
DO $$ BEGIN
  INSERT INTO sonuc VALUES (12, 'alici talep eki', 'GORUNUR',
    pg_temp.dosya(pg_temp.fx('pro'), 'quote-attachments', pg_temp.fx('kurum_uyesi')::text || '/guv05-brief.pdf'));
END $$;

-- T13 alici olmayan profesyonel talep ekini acamaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (13, 'yabanci talep eki', 'GORUNMEZ',
    pg_temp.dosya(pg_temp.fx('yabanci'), 'quote-attachments', pg_temp.fx('kurum_uyesi')::text || '/guv05-brief.pdf'));
END $$;

-- T14 kurum yoneticisi kurum ilanina gelen basvuru ekini acar
DO $$ BEGIN
  INSERT INTO sonuc VALUES (14, 'kurum yoneticisi basvuru eki', 'GORUNUR',
    pg_temp.dosya(pg_temp.fx('kurum_uyesi'), 'application-attachments', pg_temp.fx('pro')::text || '/guv05-cv.pdf'));
END $$;

-- T15 basvuran kendi ekini acar
DO $$ BEGIN
  INSERT INTO sonuc VALUES (15, 'basvuran kendi eki', 'GORUNUR',
    pg_temp.dosya(pg_temp.fx('pro'), 'application-attachments', pg_temp.fx('pro')::text || '/guv05-cv.pdf'));
END $$;

-- T16 iliskisiz profesyonel basvuru ekini acamaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (16, 'yabanci basvuru eki', 'GORUNMEZ',
    pg_temp.dosya(pg_temp.fx('yabanci'), 'application-attachments', pg_temp.fx('pro')::text || '/guv05-cv.pdf'));
END $$;

-- ---------------------------------------------------------------- MESAJ TURLERI
-- T17 taraf dogrudan sistem satiri ekleyemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    INSERT INTO public.messages (conversation_id, sender_id, body, message_type)
    VALUES (pg_temp.fx('sohbet'), pg_temp.fx('musteri'), '✓ Teklif onaylandı', 'system');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (17, 'sahte sistem satiri', 'ENGEL', v);
END $$;

-- T18 taraf normal mesaj yazar (mesru)
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    INSERT INTO public.messages (conversation_id, sender_id, body)
    VALUES (pg_temp.fx('sohbet'), pg_temp.fx('musteri'), 'Merhaba (Guvenlik 05 test)');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (18, 'normal mesaj', 'YAPILDI', v);
END $$;

-- T19 baska sohbetin teklifi mesaja eklenemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    INSERT INTO public.messages (conversation_id, sender_id, body, message_type, quote_id)
    VALUES (pg_temp.fx('sohbet'), pg_temp.fx('musteri'), 'Teklif', 'quote', pg_temp.fx('baska_teklif'));
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (19, 'baska sohbetin teklifi', 'ENGEL', v);
END $$;

-- T20 profesyonel teklif verir ve teklif mesajini ekler (mesru, /mesajlar)
DO $$ DECLARE v text; v_q uuid; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    INSERT INTO public.quotes (conversation_id, sender_id, total_amount, services_description, expires_at)
    VALUES (pg_temp.fx('sohbet'), pg_temp.fx('pro'), 7000, 'Guvenlik 05 test teklifi A', now() + interval '3 days')
    RETURNING id INTO v_q;
    INSERT INTO public.messages (conversation_id, sender_id, body, message_type, quote_id)
    VALUES (pg_temp.fx('sohbet'), pg_temp.fx('pro'), 'Teklif', 'quote', v_q);
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO fx VALUES ('teklif_a', v_q, NULL);
  INSERT INTO sonuc VALUES (20, 'teklif + teklif mesaji', 'YAPILDI', v);
END $$;

-- T21 ayni teklif ikinci kez mesaja eklenemez
DO $$ DECLARE v text; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    INSERT INTO public.messages (conversation_id, sender_id, body, message_type, quote_id)
    VALUES (pg_temp.fx('sohbet'), pg_temp.fx('pro'), 'Teklif', 'quote', pg_temp.fx('teklif_a'));
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (21, 'ayni teklif ikinci kez', 'ENGEL', v);
END $$;

-- T22 musteri teklifi kabul eder: tetikleyici sistem satirini yazar (mesru)
DO $$ DECLARE v text; n0 int; n1 int; BEGIN
  SELECT count(*) INTO n0 FROM public.messages WHERE conversation_id = pg_temp.fx('sohbet') AND message_type = 'system';
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    UPDATE public.quotes SET status = 'accepted' WHERE id = pg_temp.fx('teklif_a');
    v := 'YAPILDI';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  SELECT count(*) INTO n1 FROM public.messages WHERE conversation_id = pg_temp.fx('sohbet') AND message_type = 'system';
  INSERT INTO fx SELECT 'rez_a', id, NULL FROM public.bookings WHERE quote_id = pg_temp.fx('teklif_a');
  INSERT INTO sonuc VALUES (22, 'kabul -> tetikleyici sistem satiri', 'YAPILDI +',
    v || CASE WHEN n1 > n0 THEN ' +' ELSE ' 0' END);
END $$;

-- ---------------------------------------------------------------- SISTEM RPC
-- T23 girissiz RPC cagiramaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (23, 'girissiz sistem RPC', 'ENGEL',
    pg_temp.sistem(NULL, pg_temp.fx('sohbet'), 'rezervasyon_talebi', NULL, '📅 Rezervasyon talebi — Tarih: 1 Ocak 2027'));
END $$;

-- T24 musteri rezervasyon talebi notu yazar (mesru, profilden rezervasyon talebi)
DO $$ BEGIN
  INSERT INTO sonuc VALUES (24, 'rezervasyon talebi notu', 'YAPILDI',
    pg_temp.sistem(pg_temp.fx('musteri'), pg_temp.fx('sohbet'), 'rezervasyon_talebi', NULL, '📅 Rezervasyon talebi — Tarih: 1 Ocak 2027 · Yer: Test'));
END $$;

-- T25 serbest metin rezervasyon notu olarak yazilamaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (25, 'sahte metin RPC ile', 'ENGEL',
    pg_temp.sistem(pg_temp.fx('musteri'), pg_temp.fx('sohbet'), 'rezervasyon_talebi', NULL, '✓ Teklif onaylandı'));
END $$;

-- T26 yabanci baskasinin sohbetine yazamaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (26, 'yabanci sohbete RPC', 'ENGEL',
    pg_temp.sistem(pg_temp.fx('yabanci'), pg_temp.fx('sohbet'), 'basvuru_kabul', pg_temp.fx('kabul_basvuru'), NULL));
END $$;

-- T27 basvuran "kabul edildi" satirini kendisi yazamaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (27, 'basvuran kabul satiri', 'ENGEL',
    pg_temp.sistem(pg_temp.fx('pro'), pg_temp.fx('sohbet'), 'basvuru_kabul', pg_temp.fx('kabul_basvuru'), NULL));
END $$;

-- T28 ilan sahibi kabul satirini yazar (mesru, /ilanlar basvuru kabulu)
DO $$ BEGIN
  INSERT INTO sonuc VALUES (28, 'ilan sahibi kabul satiri', 'YAPILDI',
    pg_temp.sistem(pg_temp.fx('musteri'), pg_temp.fx('sohbet'), 'basvuru_kabul', pg_temp.fx('kabul_basvuru'), NULL));
END $$;

-- T29 iptal edilmemis rezervasyon icin iptal satiri yazilamaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (29, 'iptalsiz iptal satiri', 'ENGEL',
    pg_temp.sistem(pg_temp.fx('musteri'), pg_temp.fx('sohbet'), 'rezervasyon_iptal', pg_temp.fx('rez_a'), NULL));
END $$;

-- T30 musteri iptal eder, iptal satiri bir kez yazilir (mesru, /rezervasyon)
DO $$ DECLARE v text; v1 text; v2 text; n int; BEGIN
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  BEGIN
    UPDATE public.bookings SET status = 'cancelled', cancelled_at = now(), cancelled_by = pg_temp.fx('musteri')
     WHERE id = pg_temp.fx('rez_a');
    v := 'IPTAL';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  v1 := pg_temp.sistem(pg_temp.fx('musteri'), pg_temp.fx('sohbet'), 'rezervasyon_iptal', pg_temp.fx('rez_a'), NULL);
  v2 := pg_temp.sistem(pg_temp.fx('musteri'), pg_temp.fx('sohbet'), 'rezervasyon_iptal', pg_temp.fx('rez_a'), NULL);
  -- Bu islemde yazilan (created_at = islem zamani) musteri iptal satiri sayisi
  SELECT count(*) INTO n FROM public.messages
   WHERE conversation_id = pg_temp.fx('sohbet') AND message_type = 'system'
     AND body = 'Müşteri rezervasyonu iptal etti' AND created_at >= now();
  INSERT INTO sonuc VALUES (30, 'iptal satiri bir kez', 'IPTAL YAPILDI TEKRAR YOK 1',
    v || ' ' || v1 || ' ' || v2 || ' ' || n::text);
END $$;

-- T31 profesyonel tamamlar, tamamlama satirini yazar (mesru, /rezervasyon)
DO $$ DECLARE v text; v_q uuid; v_b uuid; BEGIN
  INSERT INTO public.quotes (conversation_id, sender_id, total_amount, services_description, expires_at)
  VALUES (pg_temp.fx('sohbet'), pg_temp.fx('pro'), 8000, 'Guvenlik 05 test teklifi B', now() + interval '3 days')
  RETURNING id INTO v_q;
  PERFORM pg_temp.kimlik(pg_temp.fx('musteri'));
  UPDATE public.quotes SET status = 'accepted' WHERE id = v_q;
  PERFORM pg_temp.kimlik(NULL);
  SELECT id INTO v_b FROM public.bookings WHERE quote_id = v_q;
  INSERT INTO fx VALUES ('rez_b', v_b, NULL);
  -- Duzeltme 12: tarih gecmeden dogrudan tamamlama musteri onayi ister; tarih gecmis sayilir
  UPDATE public.bookings SET event_date = (now() AT TIME ZONE 'Europe/Istanbul')::date - 1 WHERE id = v_b;
  PERFORM pg_temp.kimlik(pg_temp.fx('pro'));
  BEGIN
    UPDATE public.bookings SET status = 'completed', completed_at = now() WHERE id = v_b;
    v := 'TAMAM';
  EXCEPTION WHEN OTHERS THEN v := 'ENGEL ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  INSERT INTO sonuc VALUES (31, 'tamamlama satiri', 'TAMAM YAPILDI',
    v || ' ' || pg_temp.sistem(pg_temp.fx('pro'), pg_temp.fx('sohbet'), 'rezervasyon_tamam', v_b, NULL));
END $$;

-- T32 musteri tamamlama satirini yazamaz
DO $$ BEGIN
  INSERT INTO sonuc VALUES (32, 'musteri tamamlama satiri', 'ENGEL',
    pg_temp.sistem(pg_temp.fx('musteri'), pg_temp.fx('sohbet'), 'rezervasyon_tamam', pg_temp.fx('rez_b'), NULL));
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
