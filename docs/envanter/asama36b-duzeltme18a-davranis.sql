-- =============================================================================
-- ASAMA 36b - Duzeltme 18-A DAVRANIS testi - YALNIZ DAL (Sahne verisi gerekir)
--
-- Tek islem, sonda ROLLBACK: hicbir sey kalici yazilmaz. URETIMDE CALISTIRILMAZ.
-- 18-A goc ICERMEZ; bu dosya `submitOffer` eyleminin (app/teklif-topla/actions.ts)
-- MEVCUT sohbete yazdigi satirlari ayni sirayla, profesyonelin kimligiyle
-- tekrarlar ve sonucu sinar:
--   - teklif topla talebinde ilce / mekan yazildiysa (brief'in `location`
--     alani) yanit bu metni sohbetin yerine yazar;
--   - "Yeni talep #n" karti ve onaydan dogan rezervasyon TALEBIN yerini
--     tasir, onceki isin yerini / kisi sayisini / saatini degil (17-D).
-- Fikstur SABIT DEGIL: yanitlanmamis bir teklif topla alicisi secilir; sohbet
-- yoksa acilir, onceki isin bilgisi ve talebin konumu islem icinde yazilir
-- (ROLLBACK ile gider). asama35b ile ayni iskelet; fark talebin konumu.
-- Sonuc tablosunda hepsi GECTI olmali (14 test).
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

CREATE FUNCTION pg_temp.fx(p text) RETURNS uuid LANGUAGE sql AS $f$ SELECT id FROM fx WHERE ad = p $f$;

-- Bakan olarak tek deger donduren sorgu / yazma: deger (metin) / ENGEL (hata).
CREATE FUNCTION pg_temp.sor(p_bakan uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  r text;
BEGIN
  PERFORM pg_temp.kimlik(p_bakan);
  BEGIN
    EXECUTE p_sql INTO r;
    r := COALESCE(r, 'BOS');
  EXCEPTION WHEN OTHERS THEN r := 'ENGEL: ' || SQLERRM;
  END;
  PERFORM pg_temp.kimlik(NULL);
  RETURN r;
END $f$;

-- -----------------------------------------------------------------------------
-- Fikstur: yanitlanmamis alici + sohbet + "onceki is" (yonetici gozuyle kurulur)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  a record;
  v_sohbet uuid;
BEGIN
  SELECT r.id AS alici, r.request_id AS talep, r.professional_id AS pro, qr.customer_id AS musteri
    INTO a
    FROM public.quote_request_recipients r
    JOIN public.quote_requests qr ON qr.id = r.request_id
    LEFT JOIN public.conversations c
           ON c.customer_id = qr.customer_id AND c.professional_id = r.professional_id
   WHERE r.status IN ('sent', 'viewed')
     AND qr.status = 'active'
     AND qr.event_id IS NULL
     AND qr.customer_id <> r.professional_id
   ORDER BY (EXISTS (SELECT 1 FROM public.events e WHERE e.owner_user_id = qr.customer_id)) DESC,
            (c.id IS NOT NULL) DESC, r.created_at, r.id
   LIMIT 1;
  IF a.alici IS NULL THEN
    RAISE EXCEPTION 'Uygun fikstur yok: etkinlik bagi olmayan, yanitlanmamis teklif topla alicisi bulunamadi';
  END IF;

  SELECT id INTO v_sohbet FROM public.conversations
   WHERE customer_id = a.musteri AND professional_id = a.pro;
  IF v_sohbet IS NULL THEN
    INSERT INTO public.conversations (customer_id, professional_id)
    VALUES (a.musteri, a.pro) RETURNING id INTO v_sohbet;
  END IF;

  -- Onceki is: yeri, kisi sayisi, saati ve rezervasyon talebi turu olan bir is
  UPDATE public.conversations
     SET location = 'Eski Mekan, Kadıköy, İstanbul', guest_count = 120,
         start_time = '18:00', end_time = '23:00',
         request_type = 'booking_request',
         event_id = (SELECT e.id FROM public.events e WHERE e.owner_user_id = a.musteri ORDER BY e.created_at LIMIT 1)
   WHERE id = v_sohbet;

  -- Talepte ilce + mekan yazilmis olsun (18-A: formun yazdigi bicim)
  UPDATE public.quote_requests
     SET brief_data = COALESCE(brief_data, '{}'::jsonb)
                      || jsonb_build_object('location', 'Yeni Mekan, Beşiktaş, İstanbul')
   WHERE id = a.talep;

  -- Onceki talep teklif almis olsun
  IF NOT public.fn_duz12_talep_yanitlandi(v_sohbet) THEN
    INSERT INTO public.quotes (conversation_id, sender_id, total_amount, services_description, expires_at, status)
    VALUES (v_sohbet, a.pro, 1000, '36b onceki is', now() + interval '3 days', 'pending');
  END IF;

  INSERT INTO fx VALUES ('alici', a.alici), ('talep', a.talep), ('pro', a.pro),
                        ('musteri', a.musteri), ('sohbet', v_sohbet);
END $$;

-- Onceki durum (yonetici gozuyle)
INSERT INTO sonuc
SELECT 1, 'on kosul: onceki talep teklif almis', 'true',
       public.fn_duz12_talep_yanitlandi(pg_temp.fx('sohbet'))::text;
INSERT INTO sonuc
SELECT 2, 'on kosul: sohbette onceki isin yeri duruyor', 'Eski Mekan, Kadıköy, İstanbul|120|18:00:00|booking_request',
       c.location || '|' || c.guest_count || '|' || c.start_time || '|' || c.request_type
  FROM public.conversations c WHERE c.id = pg_temp.fx('sohbet');
-- Bilgi: musterinin etkinligi varsa sohbet ona baglandi (bag da temizlenmeli; test 5)
SELECT 'BILGI: onceki isin etkinlik bagi ' ||
       CASE WHEN c.event_id IS NOT NULL THEN 'VAR' ELSE 'YOK (musterinin etkinligi yok; bag sinanmadi)' END AS bilgi
  FROM public.conversations c WHERE c.id = pg_temp.fx('sohbet');

CREATE TEMP TABLE onceki ON COMMIT DROP AS
  SELECT request_count FROM public.conversations WHERE id = pg_temp.fx('sohbet');
GRANT ALL ON onceki TO authenticated;

-- 1) Eylemin ilk adimi: profesyonel onceki talebin durumunu okur
INSERT INTO sonuc
SELECT 3, 'profesyonel talep durumunu okur (yeni is)', 'true',
       pg_temp.sor(pg_temp.fx('pro'),
         format('SELECT public.fn_duz12_talep_yanitlandi(%L)::text', pg_temp.fx('sohbet')));

-- 2) Eylemin yazdigi satir (17-D + 18-A): yeni is -> onceki isin alanlari
--    temizlenir, yer TALEBIN konumu olur
INSERT INTO sonuc
SELECT 4, 'profesyonel sohbeti gunceller (10 alan)', '1',
       pg_temp.sor(pg_temp.fx('pro'), format($q$
         WITH g AS (
           UPDATE public.conversations c
              SET event_date = qr.event_date, event_type = qr.event_type,
                  budget_range = NULL, brief_data = qr.brief_data,
                  request_type = 'quote',
                  location = NULLIF(btrim(left(qr.brief_data->>'location', 200)), ''),
                  guest_count = NULL,
                  start_time = NULL, end_time = NULL, event_id = qr.event_id
             FROM public.quote_requests qr
            WHERE c.id = %L AND qr.id = %L
           RETURNING 1)
         SELECT count(*)::text FROM g $q$, pg_temp.fx('sohbet'), pg_temp.fx('talep')));

INSERT INTO sonuc
SELECT 5, 'sohbetin yeri talebin konumu; digerleri bos', 'Yeni Mekan, Beşiktaş, İstanbul|BOS|BOS|BOS|BOS|quote',
       COALESCE(c.location, 'BOS') || '|' || COALESCE(c.guest_count::text, 'BOS') || '|'
       || COALESCE(c.start_time::text, 'BOS') || '|' || COALESCE(c.end_time::text, 'BOS') || '|'
       || COALESCE(c.event_id::text, 'BOS') || '|' || c.request_type
  FROM public.conversations c WHERE c.id = pg_temp.fx('sohbet');

-- 3) "Yeni talep #n" karti: sayac artar, kartta TALEBIN yeri var, onceki isinki yok
INSERT INTO sonuc
SELECT 6, 'profesyonel yeni talep kartini yazar', 'true',
       pg_temp.sor(pg_temp.fx('pro'),
         format('SELECT (public.sistem_mesaji_ekle(%L, %L, %L) IS NOT NULL)::text',
                pg_temp.fx('sohbet'), 'teklif_topla', pg_temp.fx('talep')));
INSERT INTO sonuc
SELECT 7, 'sayac bir artti', (SELECT (request_count + 1)::text FROM onceki),
       (SELECT request_count::text FROM public.conversations WHERE id = pg_temp.fx('sohbet'));
INSERT INTO sonuc
SELECT 8, 'kart teklif topla karti', 'true',
       (SELECT (m.body LIKE 'Yeni talep #%' AND m.body LIKE '%· Teklif topla%')::text
          FROM public.messages m
         WHERE m.conversation_id = pg_temp.fx('sohbet') AND m.message_type = 'system'
         ORDER BY m.created_at DESC, m.id DESC LIMIT 1);
INSERT INTO sonuc
SELECT 9, 'kartta onceki isin yeri yok', 'false',
       (SELECT (m.body LIKE '%Eski Mekan%')::text
          FROM public.messages m
         WHERE m.conversation_id = pg_temp.fx('sohbet') AND m.message_type = 'system'
         ORDER BY m.created_at DESC, m.id DESC LIMIT 1);

INSERT INTO sonuc
SELECT 10, 'kartta talebin yeri var', 'true',
       (SELECT (m.body LIKE '%Yeni Mekan, Beşiktaş, İstanbul')::text
          FROM public.messages m
         WHERE m.conversation_id = pg_temp.fx('sohbet') AND m.message_type = 'system'
         ORDER BY m.created_at DESC, m.id DESC LIMIT 1);

-- 4) Profesyonel teklifi yazar (eylemdeki alanlar; yer / saat YOK)
INSERT INTO sonuc
SELECT 11, 'profesyonel teklifi yazar', 'true',
       pg_temp.sor(pg_temp.fx('pro'), format($q$
         WITH t AS (
           INSERT INTO public.quotes (conversation_id, sender_id, total_amount, services_description, expires_at, status)
           VALUES (%L, %L, 7500, '36b teklif topla yaniti', now() + interval '3 days', 'pending')
           RETURNING id)
         SELECT (count(*) = 1)::text FROM t $q$, pg_temp.fx('sohbet'), pg_temp.fx('pro')));
INSERT INTO fx
SELECT 'teklif', q.id FROM public.quotes q
 WHERE q.conversation_id = pg_temp.fx('sohbet') AND q.services_description = '36b teklif topla yaniti';

INSERT INTO sonuc
SELECT 12, 'teklif yeni talep numarasini aldi', 'true',
       (SELECT (q.request_no = c.request_count)::text
          FROM public.quotes q JOIN public.conversations c ON c.id = q.conversation_id
         WHERE q.id = pg_temp.fx('teklif'));

-- 5) Musteri onaylar: rezervasyon onceki isin yerini / kisi sayisini / saatini ALMAZ
INSERT INTO sonuc
SELECT 13, 'musteri teklifi onaylar', '1',
       pg_temp.sor(pg_temp.fx('musteri'), format($q$
         WITH g AS (UPDATE public.quotes SET status = 'accepted' WHERE id = %L RETURNING 1)
         SELECT count(*)::text FROM g $q$, pg_temp.fx('teklif')));
INSERT INTO sonuc
SELECT 14, 'rezervasyon talebin yerini aldi; digerleri bos', 'Yeni Mekan, Beşiktaş, İstanbul|BOS|BOS|BOS',
       COALESCE((SELECT COALESCE(b.location, 'BOS') || '|' || COALESCE(b.guest_count::text, 'BOS') || '|'
                        || COALESCE(b.start_time::text, 'BOS') || '|' || COALESCE(b.end_time::text, 'BOS')
                   FROM public.bookings b WHERE b.quote_id = pg_temp.fx('teklif')), 'REZERVASYON YOK');

SELECT sira, test, beklenen, gercek,
       CASE WHEN beklenen = gercek THEN 'GECTI' ELSE 'KALDI' END AS sonuc
  FROM sonuc ORDER BY sira;

ROLLBACK;
