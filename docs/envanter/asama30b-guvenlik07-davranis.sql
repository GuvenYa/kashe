-- =============================================================================
-- ASAMA 30b - Guvenlik 07 DAVRANIS testi - YALNIZ DAL (Sahne verisi gerekir)
--
-- Tek islem, sonda ROLLBACK: hicbir sey kalici yazilmaz. URETIMDE CALISTIRILMAZ.
-- Kanal kurali (realtime.messages) fonksiyon uzerinden sinanir; gercek
-- WebSocket katilimi onizleme turunda denenir.
-- Sonuc tablosunda hepsi GECTI olmali (10 test).
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
CREATE TEMP TABLE fx (ad text PRIMARY KEY, id uuid) ON COMMIT DROP;
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

-- Bakan (NULL = girissiz) kanala katilabilir mi
CREATE FUNCTION pg_temp.kanal(p_bakan uuid, p_konu text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  v boolean;
  r text;
BEGIN
  IF p_bakan IS NULL THEN
    PERFORM pg_temp.anonim();
  ELSE
    PERFORM pg_temp.kimlik(p_bakan);
  END IF;
  BEGIN
    -- Dinamik cagri: yetki her seferinde cagiran rolle denetlenir
    -- (plpgsql basit ifade onbellegi ilk cagiranin yetkisini tasimasin).
    EXECUTE 'SELECT public.fn_guv07_sohbet_kanali($1)' INTO v USING p_konu;
    r := CASE WHEN v THEN 'KATILIR' ELSE 'GIREMEZ' END;
  EXCEPTION WHEN OTHERS THEN r := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  RETURN r;
END $f$;

CREATE FUNCTION pg_temp.dosya(p_bakan uuid, p_kova text, p_ad text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  n int;
BEGIN
  PERFORM pg_temp.kimlik(p_bakan);
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = p_kova AND name = p_ad;
  PERFORM pg_temp.kimlik(NULL);
  RETURN CASE WHEN n > 0 THEN 'GORUNUR' ELSE 'GORUNMEZ' END;
END $f$;

-- ---------------------------------------------------------------- fikstur
DO $$
DECLARE
  p  uuid := '5a4e0000-0000-4000-8000-000000010119';  -- Ilker
  c  uuid := '5a4e0000-0000-4000-8000-000000040002';  -- Kaan
  k  uuid := '5a4e0000-0000-4000-8000-000000030003';  -- Anadolu Ilac
  ku uuid := '5a4e0000-0000-4000-8000-000000031003';  -- Deniz Erol (kurum yoneticisi)
BEGIN
  INSERT INTO fx VALUES ('pro', p), ('musteri', c), ('kurum_uyesi', ku);
  INSERT INTO fx
  SELECT 'yabanci', x.id FROM public.profiles x
   WHERE x.id::text LIKE '5a4e%' AND x.role = 'professional' AND NOT x.is_admin AND x.id <> p
     AND NOT EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.user_id = x.id)
     AND NOT EXISTS (SELECT 1 FROM public.conversations cv WHERE cv.professional_id = x.id AND cv.customer_id IN (c, k))
   ORDER BY x.id LIMIT 1;

  INSERT INTO public.conversations (customer_id, professional_id, request_type)
  VALUES (c, p, 'quote') ON CONFLICT (customer_id, professional_id) DO NOTHING;
  INSERT INTO fx SELECT 'sohbet', id FROM public.conversations WHERE customer_id = c AND professional_id = p;
  INSERT INTO public.conversations (customer_id, professional_id, request_type)
  VALUES (k, p, 'quote') ON CONFLICT (customer_id, professional_id) DO NOTHING;
  INSERT INTO fx SELECT 'kurum_sohbet', id FROM public.conversations WHERE customer_id = k AND professional_id = p;

  -- Sahipsiz (satira baglanmamis) yuklemeler
  INSERT INTO storage.objects (bucket_id, name) VALUES
    ('message-attachments', ku::text || '/guv07-sahipsiz.pdf'),
    ('quote-attachments', c::text || '/guv07-sahipsiz.pdf')
  ON CONFLICT DO NOTHING;

  IF (SELECT count(*) FROM fx WHERE id IS NOT NULL) < 6 THEN
    RAISE EXCEPTION 'Fikstur eksik: %', (SELECT string_agg(ad, ', ') FROM fx WHERE id IS NULL);
  END IF;
END $$;

-- ---------------------------------------------------------------- KANAL
DO $$ BEGIN
  INSERT INTO sonuc VALUES (1, 'musteri kendi sohbet kanali', 'KATILIR',
    pg_temp.kanal(pg_temp.fx('musteri'), 'messages:' || pg_temp.fx('sohbet')));
  INSERT INTO sonuc VALUES (2, 'profesyonel kendi sohbet kanali', 'KATILIR',
    pg_temp.kanal(pg_temp.fx('pro'), 'messages:' || pg_temp.fx('sohbet')));
  INSERT INTO sonuc VALUES (3, 'kurum uyesi kurum sohbeti kanali', 'KATILIR',
    pg_temp.kanal(pg_temp.fx('kurum_uyesi'), 'messages:' || pg_temp.fx('kurum_sohbet')));
  INSERT INTO sonuc VALUES (4, 'yabanci profesyonel', 'GIREMEZ',
    pg_temp.kanal(pg_temp.fx('yabanci'), 'messages:' || pg_temp.fx('sohbet')));
  INSERT INTO sonuc VALUES (5, 'kurum uyesi baskasinin sohbeti', 'GIREMEZ',
    pg_temp.kanal(pg_temp.fx('kurum_uyesi'), 'messages:' || pg_temp.fx('sohbet')));
  INSERT INTO sonuc VALUES (6, 'girissiz', 'ENGEL',
    pg_temp.kanal(NULL, 'messages:' || pg_temp.fx('sohbet')));
  INSERT INTO sonuc VALUES (7, 'bozuk konu adi', 'GIREMEZ',
    pg_temp.kanal(pg_temp.fx('musteri'), 'messages:' || pg_temp.fx('sohbet') || ''' OR 1=1'));
  INSERT INTO sonuc VALUES (8, 'baska kanal adi', 'GIREMEZ',
    pg_temp.kanal(pg_temp.fx('musteri'), 'notifications:' || pg_temp.fx('musteri')));
END $$;

-- ---------------------------------------------------------------- KENDI DOSYASI
DO $$ BEGIN
  INSERT INTO sonuc VALUES (9, 'yukleyen kendi sahipsiz dosyasi', 'GORUNUR',
    pg_temp.dosya(pg_temp.fx('kurum_uyesi'), 'message-attachments', pg_temp.fx('kurum_uyesi')::text || '/guv07-sahipsiz.pdf'));
  INSERT INTO sonuc VALUES (10, 'baskasinin sahipsiz dosyasi', 'GORUNMEZ',
    pg_temp.dosya(pg_temp.fx('pro'), 'quote-attachments', pg_temp.fx('musteri')::text || '/guv07-sahipsiz.pdf'));
END $$;

-- ---------------------------------------------------------------- sonuc
SELECT sira, test, beklenen, gercek,
       CASE WHEN gercek = beklenen THEN 'GECTI' ELSE 'KALDI' END AS durum
  FROM sonuc
UNION ALL
SELECT 99, 'OZET', '10 GECTI / 10',
       (SELECT count(*) FILTER (WHERE gercek = beklenen) || ' GECTI / ' || count(*) FROM sonuc), ''
 ORDER BY 1;

ROLLBACK;
