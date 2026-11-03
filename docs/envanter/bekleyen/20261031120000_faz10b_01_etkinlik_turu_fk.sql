-- =============================================================================
-- FAZ 10b / DB 01 — Etkinlik turu tek kaynak: `event_types(key)` tablosu
-- Plan: docs/envanter/38-faz10-temizlik.md bolum 10b. BEKLEYEN DOSYA: 10a ve Duzeltme 01 uretime cikmadan dala/uretime
-- UYGULANMAZ (dosya adi 20261031 sirasi korunur; 10a + duzeltme_01'den sonra gelir).
--
-- 1) Veri kontrolu: `conversations`, `listings`, `bookings`, `quote_requests` `event_type` degerlerinden `event_types.key`
--    disinda kalanlar `other` olur; sayisi NOTICE ile loglanir (uretimde 0 beklenir: CHECK listesi ayni kumeydi;
--    `quote_requests.event_type` serbest metindi — sihirbaz/teklif-topla anahtar yaziyor).
-- 2) Uc CHECK kisiti duser (`conversations_event_type_check`, `listings_event_type_check`, `bookings_event_type_check`):
--    liste artik kodda/kisitta degil, tabloda.
-- 3) Dort sutuna FK -> `event_types(key)` ON UPDATE CASCADE (anahtar yeniden adlandirilirsa tasinir), ON DELETE RESTRICT
--    (kullanimdaki tur silinemez; `events.event_type` FK'si ile ayni kural). NULL serbest kalir (sutunlar nullable).
-- 4) Yeni tur eklemek = `event_types`'a satir (admin/migration); uygulama (10b-P1) listeyi tablodan okur, `EVENT_TYPES` sabiti silinir.
-- Test: asama4 T36; asama20 K7 (FK 4, CHECK 0, anahtar disi deger 0); asama11 K1 EMEKLI (CHECK yoksa).
-- Idempotan: kisitlar varsa atlanir.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Veri kontrolu
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text; n int;
BEGIN
  FOREACH t IN ARRAY ARRAY['conversations', 'listings', 'bookings', 'quote_requests'] LOOP
    EXECUTE format(
      'UPDATE public.%I SET event_type = ''other''
        WHERE event_type IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.event_types e WHERE e.key = public.%I.event_type)', t, t);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'FAZ 10b: %.event_type anahtar disi -> other: % satir', t, n;
  END LOOP;
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
