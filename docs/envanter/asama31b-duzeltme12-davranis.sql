-- =============================================================================
-- ASAMA 31b - Duzeltme 12 DAVRANIS testi - YALNIZ DAL (Sahne verisi gerekir)
--
-- Tek islem, sonda ROLLBACK: hicbir sey kalici yazilmaz. URETIMDE CALISTIRILMAZ.
-- Sinanan: teklif tarih/yer/talep no (12-A, 12-B), kabulde rezervasyon ve
-- musteri bildirimi (12-A, 12-E), tamamlanma onayi (12-F), satici iptalinde
-- yorum hakki (12-G), kamu takvimi dolu gunler (12-A), teklif topla yaniti
-- ve yeni sohbet sayaci (12-B).
-- Sonuc tablosunda hepsi GECTI olmali (33 test).
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

-- Bakan olarak yazma denemesi: OK (satir etkilendi) / YOK (0 satir) / ENGEL (hata)
CREATE FUNCTION pg_temp.dene(p_bakan uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  n int;
  r text;
BEGIN
  PERFORM pg_temp.kimlik(p_bakan);
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := CASE WHEN n > 0 THEN 'OK' ELSE 'YOK' END;
  EXCEPTION WHEN OTHERS THEN r := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  RETURN r;
END $f$;

-- Bakan olarak RPC: donen uuid metni / BOS (NULL) / ENGEL
CREATE FUNCTION pg_temp.rpc(p_bakan uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  v text;
  r text;
BEGIN
  PERFORM pg_temp.kimlik(p_bakan);
  BEGIN
    EXECUTE p_sql INTO v;
    r := COALESCE(v, 'BOS');
  EXCEPTION WHEN OTHERS THEN r := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  RETURN r;
END $f$;

-- Girissiz dolu gun listesi
CREATE FUNCTION pg_temp.dolu(p_prov uuid) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  v date[];
  r text;
BEGIN
  PERFORM pg_temp.anonim();
  BEGIN
    EXECUTE 'SELECT public.saglayici_dolu_gunler($1)' INTO v USING p_prov;
    r := CASE WHEN v IS NULL OR cardinality(v) = 0 THEN 'BOS' ELSE array_to_string(v, ',') END;
  EXCEPTION WHEN OTHERS THEN r := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  RETURN r;
END $f$;

-- ---------------------------------------------------------------- fikstur
-- Musteriler SABIT DEGIL: Ilker ve Eda ile hic sohbeti olmayan iki Sahne
-- musterisi secilir. Dalda onceki onizleme turlarinin sohbetleri (ornek: Kaan -
-- Ilker, teklifli) varken sabit cift kullanilirsa talep sayaci 1'den baslamaz.
-- Fahri'nin rehber musterileri (Beren 40004, Irem 40008, Caner 40014) secilmez.
DO $$
DECLARE
  p  uuid := '5a4e0000-0000-4000-8000-000000010119';  -- Ilker Sezer (pro)
  p2 uuid := '5a4e0000-0000-4000-8000-000000010001';  -- Eda Bozkurt (pro)
  c  uuid;
  c2 uuid;
  v_bugun date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
  SELECT x.id INTO c FROM public.profiles x
   WHERE x.role = 'client' AND x.id::text LIKE '5a4e0000-0000-4000-8000-00000004%'
     AND x.id NOT IN ('5a4e0000-0000-4000-8000-000000040004',
                      '5a4e0000-0000-4000-8000-000000040008',
                      '5a4e0000-0000-4000-8000-000000040014')
     AND NOT EXISTS (SELECT 1 FROM public.conversations cv
                      WHERE cv.customer_id = x.id AND cv.professional_id IN (p, p2))
   ORDER BY x.id LIMIT 1;
  SELECT x.id INTO c2 FROM public.profiles x
   WHERE x.role = 'client' AND x.id::text LIKE '5a4e0000-0000-4000-8000-00000004%'
     AND x.id NOT IN ('5a4e0000-0000-4000-8000-000000040004',
                      '5a4e0000-0000-4000-8000-000000040008',
                      '5a4e0000-0000-4000-8000-000000040014')
     AND x.id IS DISTINCT FROM c
     AND NOT EXISTS (SELECT 1 FROM public.conversations cv
                      WHERE cv.customer_id = x.id AND cv.professional_id IN (p, p2))
   ORDER BY x.id LIMIT 1;
  IF c IS NULL OR c2 IS NULL THEN
    RAISE EXCEPTION 'Fikstur eksik: Ilker ve Eda ile sohbeti olmayan iki musteri bulunamadi';
  END IF;
  INSERT INTO fx VALUES ('musteri', c), ('pro', p), ('pro2', p2), ('musteri2', c2);

  -- Sohbet 1: musteri - Ilker, dogum gunu, tarih yok, yer Kadikoy
  INSERT INTO public.conversations (customer_id, professional_id, request_type, event_type, event_date, location)
  VALUES (c, p, 'quote', 'birthday', NULL, 'Kadıköy');
  INSERT INTO fx SELECT 'sohbet', id FROM public.conversations WHERE customer_id = c AND professional_id = p;
  -- Sohbet 2: musteri - Eda, tarih 10 gun sonra
  INSERT INTO public.conversations (customer_id, professional_id, request_type, event_type, event_date)
  VALUES (c, p2, 'quote', 'birthday', v_bugun + 10);
  INSERT INTO fx SELECT 'sohbet2', id FROM public.conversations WHERE customer_id = c AND professional_id = p2;
  -- Sohbet 3: musteri2 - Ilker
  INSERT INTO public.conversations (customer_id, professional_id, request_type, event_type)
  VALUES (c2, p, 'quote', 'concert');
  INSERT INTO fx SELECT 'sohbet3', id FROM public.conversations WHERE customer_id = c2 AND professional_id = p;

  IF (SELECT count(*) FROM fx WHERE id IS NOT NULL) < 7 THEN
    RAISE EXCEPTION 'Fikstur eksik: %', (SELECT string_agg(ad, ', ') FROM fx WHERE id IS NULL);
  END IF;
  IF (SELECT request_count FROM public.conversations WHERE id = pg_temp.fx('sohbet')) <> 1 THEN
    RAISE EXCEPTION 'Sohbet 1 sayaci 1 degil';
  END IF;
END $$;

-- ---------------------------------------------------------------- 12-A / 12-B teklif
DO $$
DECLARE
  v_bugun date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  q1 uuid; q1b uuid; q2 uuid; b1 uuid;
  v text;
BEGIN
  -- T1 taze sohbette "yeni talep": sonuclanmis teklif yok -> kart yok, sayac 1
  v := pg_temp.rpc(pg_temp.fx('musteri'), format('SELECT public.sistem_mesaji_ekle(%L, %L)::text', pg_temp.fx('sohbet'), 'yeni_talep'));
  INSERT INTO sonuc VALUES (1, 'taze sohbette yeni_talep kart yazmaz', 'BOS|1',
    v || '|' || (SELECT request_count FROM public.conversations WHERE id = pg_temp.fx('sohbet')));

  -- T2 profesyonel tarih / saat (gece yarisini asan) / yer ile teklif yazar
  INSERT INTO sonuc VALUES (2, 'pro tarihli teklif ekler', 'OK',
    pg_temp.dene(pg_temp.fx('pro'), format(
      'INSERT INTO public.quotes (conversation_id, sender_id, total_amount, currency, expires_at, services_description, event_date, start_time, end_time, location)
       VALUES (%L, %L, 15000, ''TRY'', now() + interval ''7 days'', ''Duz12 test teklifi 1'', %L, ''20:00'', ''02:00'', ''  Moda sahil  '')',
      pg_temp.fx('sohbet'), pg_temp.fx('pro'), v_bugun + 5)));
  SELECT id INTO q1 FROM public.quotes WHERE conversation_id = pg_temp.fx('sohbet') AND services_description = 'Duz12 test teklifi 1';
  INSERT INTO fx VALUES ('q1', q1);

  -- T3 talep no 1, yer kirpildi
  INSERT INTO sonuc VALUES (3, 'teklif talep no 1 + yer kirpildi', '1|Moda sahil|20:00:00|02:00:00',
    (SELECT request_no || '|' || location || '|' || start_time || '|' || end_time FROM public.quotes WHERE id = q1));

  -- T4 gecmis tarihe teklif engellenir
  INSERT INTO sonuc VALUES (4, 'gecmis tarihe teklif', 'ENGEL',
    pg_temp.dene(pg_temp.fx('pro'), format(
      'INSERT INTO public.quotes (conversation_id, sender_id, total_amount, currency, expires_at, services_description, event_date)
       VALUES (%L, %L, 1000, ''TRY'', now() + interval ''7 days'', ''Duz12 gecmis'', %L)',
      pg_temp.fx('sohbet'), pg_temp.fx('pro'), v_bugun - 1)));

  -- T5 istemcinin yazdigi talep no ezilir
  v := pg_temp.dene(pg_temp.fx('pro'), format(
      'INSERT INTO public.quotes (conversation_id, sender_id, total_amount, currency, expires_at, services_description, request_no)
       VALUES (%L, %L, 2000, ''TRY'', now() + interval ''7 days'', ''Duz12 test teklifi 1b'', 9)',
      pg_temp.fx('sohbet'), pg_temp.fx('pro')));
  INSERT INTO sonuc VALUES (5, 'istemci talep no yazamaz', 'OK|1',
    v
    || '|' || (SELECT request_no FROM public.quotes WHERE conversation_id = pg_temp.fx('sohbet') AND services_description = 'Duz12 test teklifi 1b'));

  -- T6 musteri teklifi kabul eder
  INSERT INTO sonuc VALUES (6, 'musteri teklifi kabul eder', 'OK',
    pg_temp.dene(pg_temp.fx('musteri'), format('UPDATE public.quotes SET status = ''accepted'' WHERE id = %L', q1)));
  SELECT id INTO b1 FROM public.bookings WHERE quote_id = q1;
  INSERT INTO fx VALUES ('b1', b1);

  -- T7 rezervasyon teklifin tarih / saat / yerini aldi (sohbette tarih yoktu)
  INSERT INTO sonuc VALUES (7, 'rezervasyon teklifin tarih/yerini alir', (v_bugun + 5)::text || '|Moda sahil|20:00:00|02:00:00|confirmed',
    (SELECT event_date || '|' || location || '|' || start_time || '|' || end_time || '|' || status FROM public.bookings WHERE id = b1));

  -- T8 musteriye bildirim
  INSERT INTO sonuc VALUES (8, 'kabulde musteriye bildirim', 'EVET',
    CASE WHEN EXISTS (SELECT 1 FROM public.notifications n
                       WHERE n.user_id = pg_temp.fx('musteri')
                         AND n.body = 'Teklifi onayladın — İlker Sezer ile rezervasyon oluştu'
                         AND n.link = '/rezervasyon/' || b1) THEN 'EVET' ELSE 'HAYIR' END);

  -- T9 talep sonuclandi: yeni_talep sayaci 2 yapar, kart yazar
  v := pg_temp.rpc(pg_temp.fx('musteri'), format('SELECT public.sistem_mesaji_ekle(%L, %L)::text', pg_temp.fx('sohbet'), 'yeni_talep'));
  INSERT INTO sonuc VALUES (9, 'ikinci talep: sayac 2 + kart', '2|Yeni talep #2 · Doğum günü · Tarih belli değil · Kadıköy',
    (SELECT request_count FROM public.conversations WHERE id = pg_temp.fx('sohbet'))
    || '|' || COALESCE((SELECT body FROM public.messages WHERE id = NULLIF(NULLIF(v, 'ENGEL'), 'BOS')::uuid AND message_type = 'system'), v));

  -- T10 yeni teklif talep no 2
  v := pg_temp.dene(pg_temp.fx('pro'), format(
      'INSERT INTO public.quotes (conversation_id, sender_id, total_amount, currency, expires_at, services_description)
       VALUES (%L, %L, 3000, ''TRY'', now() + interval ''7 days'', ''Duz12 test teklifi 2'')',
      pg_temp.fx('sohbet'), pg_temp.fx('pro')));
  INSERT INTO sonuc VALUES (10, 'yeni teklif talep no 2', 'OK|2',
    v
    || '|' || (SELECT request_no FROM public.quotes WHERE conversation_id = pg_temp.fx('sohbet') AND services_description = 'Duz12 test teklifi 2'));
  SELECT id INTO q2 FROM public.quotes WHERE conversation_id = pg_temp.fx('sohbet') AND services_description = 'Duz12 test teklifi 2';
  INSERT INTO fx VALUES ('q2', q2);

  -- T11 yabanci yeni_talep acamaz
  INSERT INTO sonuc VALUES (11, 'pro yeni_talep acamaz', 'ENGEL',
    pg_temp.rpc(pg_temp.fx('pro'), format('SELECT public.sistem_mesaji_ekle(%L, %L)::text', pg_temp.fx('sohbet'), 'yeni_talep')));
END $$;

-- ---------------------------------------------------------------- 12-F tamamlanma onayi
DO $$
DECLARE
  b1 uuid := pg_temp.fx('b1');
  v text;
BEGIN
  -- T12 tarih gelmeden satici dogrudan tamamlayamaz
  INSERT INTO sonuc VALUES (12, 'tarihten once dogrudan tamamlama', 'ENGEL',
    pg_temp.dene(pg_temp.fx('pro'), format('UPDATE public.bookings SET status = ''completed'' WHERE id = %L', b1)));

  -- T13 musteri tamamlanma onayi isteyemez
  INSERT INTO sonuc VALUES (13, 'musteri onay istegi yazamaz', 'ENGEL',
    pg_temp.dene(pg_temp.fx('musteri'), format('UPDATE public.bookings SET completion_requested_at = now() WHERE id = %L', b1)));

  -- T14 satici onay ister; damga ve kisi sunucuda
  v := pg_temp.dene(pg_temp.fx('pro'), format('UPDATE public.bookings SET completion_requested_at = now() WHERE id = %L', b1));
  INSERT INTO sonuc VALUES (14, 'satici tamamlanma onayi ister', 'OK|EVET',
    v
    || '|' || (SELECT CASE WHEN completion_requested_at IS NOT NULL AND completion_requested_by = pg_temp.fx('pro') AND status = 'confirmed'
                           THEN 'EVET' ELSE 'HAYIR' END FROM public.bookings WHERE id = b1));

  -- T15 musteriye bildirim
  INSERT INTO sonuc VALUES (15, 'onay istegi musteriye bildirim', 'EVET',
    CASE WHEN EXISTS (SELECT 1 FROM public.notifications n
                       WHERE n.user_id = pg_temp.fx('musteri') AND n.link = '/rezervasyon/' || b1
                         AND n.body LIKE 'İlker Sezer işin tamamlandığını bildirdi — onayın bekleniyor: Doğum günü (%')
         THEN 'EVET' ELSE 'HAYIR' END);

  -- T16 ikinci kez istenemez
  -- (ayni islemde now() ayni kalir; farkli damga icin +1 sn)
  INSERT INTO sonuc VALUES (16, 'onay istegi bir kez', 'ENGEL',
    pg_temp.dene(pg_temp.fx('pro'), format('UPDATE public.bookings SET completion_requested_at = now() + interval ''1 second'' WHERE id = %L', b1)));

  -- T17 sistem satiri: tamamlama_talebi (satici)
  v := pg_temp.rpc(pg_temp.fx('pro'), format('SELECT public.sistem_mesaji_ekle(%L, %L, %L)::text', pg_temp.fx('sohbet'), 'tamamlama_talebi', b1));
  INSERT INTO sonuc VALUES (17, 'tamamlama_talebi sistem satiri', 'Profesyonel işin tamamlandığını bildirdi — onayını bekliyor',
    COALESCE((SELECT body FROM public.messages WHERE id = NULLIF(NULLIF(v, 'ENGEL'), 'BOS')::uuid), v));

  -- T18 musteri tamamlama_talebi yazamaz
  INSERT INTO sonuc VALUES (18, 'musteri tamamlama_talebi yazamaz', 'ENGEL',
    pg_temp.rpc(pg_temp.fx('musteri'), format('SELECT public.sistem_mesaji_ekle(%L, %L, %L)::text', pg_temp.fx('sohbet'), 'tamamlama_talebi', b1)));

  -- T19 musteri onaylar -> completed
  v := pg_temp.dene(pg_temp.fx('musteri'), format('UPDATE public.bookings SET status = ''completed'' WHERE id = %L', b1));
  INSERT INTO sonuc VALUES (19, 'musteri tamamlanmayi onaylar', 'OK|completed|EVET',
    v
    || '|' || (SELECT status || '|' || CASE WHEN completed_at IS NOT NULL THEN 'EVET' ELSE 'HAYIR' END FROM public.bookings WHERE id = b1));

  -- T20 saticiya bildirim
  INSERT INTO sonuc VALUES (20, 'onay saticiya bildirim', 'EVET',
    CASE WHEN EXISTS (SELECT 1 FROM public.notifications n
                       WHERE n.user_id = pg_temp.fx('pro') AND n.link = '/rezervasyon/' || b1
                         AND n.body LIKE 'Müşteri işin tamamlandığını onayladı: Doğum günü (%')
         THEN 'EVET' ELSE 'HAYIR' END);

  -- T21 sistem satiri: rezervasyon_tamam (musteri onayi)
  v := pg_temp.rpc(pg_temp.fx('musteri'), format('SELECT public.sistem_mesaji_ekle(%L, %L, %L)::text', pg_temp.fx('sohbet'), 'rezervasyon_tamam', b1));
  INSERT INTO sonuc VALUES (21, 'rezervasyon_tamam musteri satiri', 'Müşteri işin tamamlandığını onayladı',
    COALESCE((SELECT body FROM public.messages WHERE id = NULLIF(NULLIF(v, 'ENGEL'), 'BOS')::uuid), v));
END $$;

-- ---------------------------------------------------------------- 12-B rezervasyon talebi sayaci
DO $$
DECLARE
  v_metin text := '📅 Rezervasyon talebi — Tarih: 12.12.2026';
  v text;
BEGIN
  -- T22 guncel talebin (#2) tek teklifi geri cekildi: rez. talebi ayni talebin guncellemesi
  PERFORM pg_temp.dene(pg_temp.fx('pro'), format('UPDATE public.quotes SET status = ''withdrawn'' WHERE id = %L', pg_temp.fx('q2')));
  v := pg_temp.rpc(pg_temp.fx('musteri'), format('SELECT public.sistem_mesaji_ekle(%L, %L, NULL, %L)::text', pg_temp.fx('sohbet'), 'rezervasyon_talebi', v_metin));
  INSERT INTO sonuc VALUES (22, 'teklifsiz talepte rez. talebi sayac ayni', '2',
    (SELECT request_count::text FROM public.conversations WHERE id = pg_temp.fx('sohbet')));

  -- T23 #2'ye bekleyen teklif gelir; yeni rez. talebi #3 acar, hemen ardindaki ikincisi #3'te kalir
  PERFORM pg_temp.dene(pg_temp.fx('pro'), format(
    'INSERT INTO public.quotes (conversation_id, sender_id, total_amount, currency, expires_at, services_description)
     VALUES (%L, %L, 3500, ''TRY'', now() + interval ''7 days'', ''Duz12 test teklifi 2b'')',
    pg_temp.fx('sohbet'), pg_temp.fx('pro')));
  v := pg_temp.rpc(pg_temp.fx('musteri'), format('SELECT public.sistem_mesaji_ekle(%L, %L, NULL, %L)::text', pg_temp.fx('sohbet'), 'rezervasyon_talebi', v_metin));
  v := (SELECT request_count::text FROM public.conversations WHERE id = pg_temp.fx('sohbet'));
  PERFORM pg_temp.rpc(pg_temp.fx('musteri'), format('SELECT public.sistem_mesaji_ekle(%L, %L, NULL, %L)::text', pg_temp.fx('sohbet'), 'rezervasyon_talebi', v_metin));
  INSERT INTO sonuc VALUES (23, 'yanitli talepte rez. talebi yeni talep acar', '3|3',
    v || '|' || (SELECT request_count::text FROM public.conversations WHERE id = pg_temp.fx('sohbet')));
END $$;

-- ---------------------------------------------------------------- 12-G / 12-A iptal, yorum hakki, dolu gunler
DO $$
DECLARE
  v_bugun date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  q3 uuid; b3 uuid; q4 uuid; b4 uuid; q5 uuid; b5 uuid;
  v text;
BEGIN
  -- Sohbet 3 (musteri2 - Ilker): teklif, kabul, SATICI iptali
  PERFORM pg_temp.dene(pg_temp.fx('pro'), format(
    'INSERT INTO public.quotes (conversation_id, sender_id, total_amount, currency, expires_at, services_description)
     VALUES (%L, %L, 5000, ''TRY'', now() + interval ''7 days'', ''Duz12 test teklifi 3'')', pg_temp.fx('sohbet3'), pg_temp.fx('pro')));
  SELECT id INTO q3 FROM public.quotes WHERE conversation_id = pg_temp.fx('sohbet3') AND services_description = 'Duz12 test teklifi 3';
  PERFORM pg_temp.dene(pg_temp.fx('musteri2'), format('UPDATE public.quotes SET status = ''accepted'' WHERE id = %L', q3));
  SELECT id INTO b3 FROM public.bookings WHERE quote_id = q3;

  -- T24 iptalden once yorum hakki yok
  INSERT INTO sonuc VALUES (24, 'onayli rezervasyonda yorum hakki yok', 'HAYIR',
    CASE WHEN public.fn_duz03_tamamlanmis_rezervasyon_var(pg_temp.fx('musteri2'), pg_temp.fx('pro')) THEN 'EVET' ELSE 'HAYIR' END);

  -- T25 satici iptal eder -> musteri yorum birakabilir
  v := pg_temp.dene(pg_temp.fx('pro'), format('UPDATE public.bookings SET status = ''cancelled'', cancellation_reason = ''Duz12 test'' WHERE id = %L', b3));
  INSERT INTO sonuc VALUES (25, 'satici iptalinde yorum hakki', 'OK|EVET',
    v
    || '|' || CASE WHEN public.fn_duz03_tamamlanmis_rezervasyon_var(pg_temp.fx('musteri2'), pg_temp.fx('pro')) THEN 'EVET' ELSE 'HAYIR' END);

  -- Sohbet 2 (musteri - Eda): teklif tarihsiz, sohbet tarihi 10 gun sonra
  PERFORM pg_temp.dene(pg_temp.fx('pro2'), format(
    'INSERT INTO public.quotes (conversation_id, sender_id, total_amount, currency, expires_at, services_description)
     VALUES (%L, %L, 7000, ''TRY'', now() + interval ''7 days'', ''Duz12 test teklifi 4'')', pg_temp.fx('sohbet2'), pg_temp.fx('pro2')));
  SELECT id INTO q4 FROM public.quotes WHERE conversation_id = pg_temp.fx('sohbet2') AND services_description = 'Duz12 test teklifi 4';
  PERFORM pg_temp.dene(pg_temp.fx('musteri'), format('UPDATE public.quotes SET status = ''accepted'' WHERE id = %L', q4));
  SELECT id INTO b4 FROM public.bookings WHERE quote_id = q4;

  -- T26 teklifte tarih yoksa rezervasyon sohbetin tarihini alir
  INSERT INTO sonuc VALUES (26, 'tarihsiz teklif: sohbet tarihi', (v_bugun + 10)::text,
    (SELECT event_date::text FROM public.bookings WHERE id = b4));

  -- T27 girissiz dolu gunler: Eda'nin onayli rezervasyonunun gunu listede
  -- (Eda'nin dalda baska rezervasyonlari da olabilir; yalniz bu gun aranir)
  INSERT INTO sonuc VALUES (27, 'girissiz dolu gun listesi', 'VAR',
    CASE WHEN position((v_bugun + 10)::text IN pg_temp.dolu(pg_temp.fx('pro2'))) > 0
         THEN 'VAR' ELSE pg_temp.dolu(pg_temp.fx('pro2')) END);

  -- T28 musteri iptal eder -> yorum hakki yok, dolu gun listesinden duser
  v := pg_temp.dene(pg_temp.fx('musteri'), format('UPDATE public.bookings SET status = ''cancelled'' WHERE id = %L', b4));
  INSERT INTO sonuc VALUES (28, 'musteri iptali: yorum yok, gun bosalir', 'OK|HAYIR|YOK',
    v
    || '|' || CASE WHEN public.fn_duz03_tamamlanmis_rezervasyon_var(pg_temp.fx('musteri'), pg_temp.fx('pro2')) THEN 'EVET' ELSE 'HAYIR' END
    || '|' || CASE WHEN position((v_bugun + 10)::text IN pg_temp.dolu(pg_temp.fx('pro2'))) > 0
                   THEN 'VAR' ELSE 'YOK' END);

  -- T29 yayinda olmayan saglayici icin dolu gun listesi bos
  UPDATE public.providers SET is_published = false WHERE id = pg_temp.fx('pro');
  INSERT INTO sonuc VALUES (29, 'yayinda olmayan saglayici: bos', 'BOS', pg_temp.dolu(pg_temp.fx('pro')));
  UPDATE public.providers SET is_published = true WHERE id = pg_temp.fx('pro');

  -- T30 tarihi gecmis is: satici dogrudan tamamlar (sistem gecmis tarihli teklif yazar)
  INSERT INTO public.quotes (conversation_id, sender_id, total_amount, currency, expires_at, services_description, event_date)
  VALUES (pg_temp.fx('sohbet3'), pg_temp.fx('pro'), 4000, 'TRY', now() + interval '7 days', 'Duz12 test teklifi 5', v_bugun - 2)
  RETURNING id INTO q5;
  PERFORM pg_temp.dene(pg_temp.fx('musteri2'), format('UPDATE public.quotes SET status = ''accepted'' WHERE id = %L', q5));
  SELECT id INTO b5 FROM public.bookings WHERE quote_id = q5;
  v := pg_temp.dene(pg_temp.fx('pro'), format('UPDATE public.bookings SET status = ''completed'' WHERE id = %L', b5));
  INSERT INTO sonuc VALUES (30, 'tarihi gecmis isi satici dogrudan tamamlar', 'OK|completed',
    v
    || '|' || (SELECT status FROM public.bookings WHERE id = b5));
END $$;

-- ---------------------------------------------------------------- 12-B teklif topla, yeni sohbet sayaci
DO $$
DECLARE
  v_talep uuid;
  v text;
BEGIN
  -- musteri2'nin teklif topla talebi; Ilker ve Eda alici
  INSERT INTO public.quote_requests (customer_id, category_id, event_type)
  VALUES (pg_temp.fx('musteri2'), (SELECT id FROM public.service_categories ORDER BY id LIMIT 1), 'concert')
  RETURNING id INTO v_talep;
  INSERT INTO public.quote_request_recipients (request_id, professional_id)
  VALUES (v_talep, pg_temp.fx('pro')), (v_talep, pg_temp.fx('pro2'));

  -- T31 Ilker mevcut (teklif almis) sohbetten yanitlar: #2 + kart
  v := pg_temp.rpc(pg_temp.fx('pro'), format('SELECT public.sistem_mesaji_ekle(%L, %L, %L)::text', pg_temp.fx('sohbet3'), 'teklif_topla', v_talep));
  INSERT INTO sonuc VALUES (31, 'teklif topla yaniti yeni talep acar', '2|Yeni talep #2 · Teklif topla · Konser · Tarih belli değil',
    (SELECT request_count FROM public.conversations WHERE id = pg_temp.fx('sohbet3'))
    || '|' || COALESCE((SELECT body FROM public.messages WHERE id = NULLIF(NULLIF(v, 'ENGEL'), 'BOS')::uuid), v));

  -- T32 baska profesyonel bu sohbette teklif topla karti acamaz
  INSERT INTO sonuc VALUES (32, 'yabanci pro teklif_topla acamaz', 'ENGEL',
    pg_temp.rpc(pg_temp.fx('pro2'), format('SELECT public.sistem_mesaji_ekle(%L, %L, %L)::text', pg_temp.fx('sohbet3'), 'teklif_topla', v_talep)));

  -- T33 istemci yeni sohbette sayaci yazamaz
  v := pg_temp.dene(pg_temp.fx('musteri2'), format(
    'INSERT INTO public.conversations (customer_id, professional_id, request_type, request_count) VALUES (%L, %L, ''quote'', 9)',
    pg_temp.fx('musteri2'), pg_temp.fx('pro2')));
  INSERT INTO sonuc VALUES (33, 'yeni sohbet sayaci 1', 'OK|1',
    v || '|' || COALESCE((SELECT request_count::text FROM public.conversations
                           WHERE customer_id = pg_temp.fx('musteri2') AND professional_id = pg_temp.fx('pro2')), 'YOK'));
END $$;

-- ---------------------------------------------------------------- sonuc
SELECT sira, test, beklenen, gercek,
       CASE WHEN gercek = beklenen THEN 'GECTI' ELSE 'KALDI' END AS durum
  FROM sonuc
UNION ALL
SELECT 99, 'OZET', '33 GECTI / 33',
       (SELECT count(*) FILTER (WHERE gercek = beklenen) || ' GECTI / ' || count(*) FROM sonuc), ''
 ORDER BY 1;

ROLLBACK;
