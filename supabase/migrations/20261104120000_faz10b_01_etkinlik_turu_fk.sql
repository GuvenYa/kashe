-- =============================================================================
-- FAZ 10b / DB 01 — Etkinlik turu tek kaynak: `event_types(key)` tablosu
-- Plan: docs/envanter/38-faz10-temizlik.md bolum 10b. (Taslak 29 Ekim'de 20261031120000 ile yazildi; 4 Kasim'da yeniden
-- damgalandi: 20261103150100 duzeltme_03b_02'den eski damga `db push` tarafindan atlanirdi.)
--
-- 1) Veri kontrolu (DEGISTIRMEZ): `conversations`, `listings`, `bookings`, `quote_requests` `event_type` degerlerinden
--    `event_types.key` disinda kalan varsa dosya DURUR ve degerleri listeler; hicbir sey yazilmaz. On kontrol:
--    `docs/envanter/faz10b-on-kontrol.sql` (salt okunur; dalda ve uretimde push'tan once). Uretimde 0 beklenir: uc CHECK
--    listesi ayni 15 anahtardi; `quote_requests.event_type` CHECK'siz ama sihirbaz/teklif-topla anahtar yaziyor.
-- 2) Uc CHECK kisiti duser (`conversations_event_type_check`, `listings_event_type_check`, `bookings_event_type_check`):
--    liste artik kodda/kisitta degil, tabloda.
-- 3) Dort sutuna FK -> `event_types(key)` ON UPDATE CASCADE (anahtar yeniden adlandirilirsa tasinir); silme varsayilan
--    NO ACTION (kullanimdaki tur silinemez; `events.event_type` FK'si ile ayni kural). NULL serbest (sutunlar nullable).
-- 4) Yeni tur eklemek = `event_types`'a satir (migration); uygulama (10b-P1, gorev 42) listeyi tablodan okur, `EVENT_TYPES`
--    sabiti silinir.
-- Test: asama4 T36; asama20 K7 (FK 4, CHECK 0, anahtar disi deger 0); asama11 K1 EMEKLI (CHECK yoksa).
-- Idempotan: kisitlar varsa atlanir.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Veri kontrolu (anahtar disi deger varsa DUR)
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text; v text; ozet text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY['conversations', 'listings', 'bookings', 'quote_requests'] LOOP
    EXECUTE format(
      'SELECT string_agg(DISTINCT event_type, '', '') FROM public.%I x
        WHERE x.event_type IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.event_types e WHERE e.key = x.event_type)', t)
      INTO v;
    IF v IS NOT NULL THEN ozet := ozet || t || ': ' || v || '; '; END IF;
  END LOOP;
  IF ozet <> '' THEN
    RAISE EXCEPTION 'FAZ 10b: event_types disinda event_type degerleri var — % Hicbir sey yazilmadi; once veri duzeltmesi (ayri dosya).', ozet;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. CHECK listeleri duser
-- -----------------------------------------------------------------------------
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_event_type_check;
ALTER TABLE public.listings      DROP CONSTRAINT IF EXISTS listings_event_type_check;
ALTER TABLE public.bookings      DROP CONSTRAINT IF EXISTS bookings_event_type_check;

-- -----------------------------------------------------------------------------
-- 3. FK'ler
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['conversations', 'listings', 'bookings', 'quote_requests'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_event_type_fkey' AND conrelid = ('public.' || t)::regclass) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (event_type) REFERENCES public.event_types(key) ON UPDATE CASCADE',
                     t, t || '_event_type_fkey');
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.event_types IS
  'Etkinlik turleri — TEK KAYNAK (FAZ 4a tablo; FAZ 10b: events, conversations, listings, bookings, quote_requests FK ile bagli; uygulama listeyi buradan okur). Yeni tur = yeni satir.';

COMMIT;
