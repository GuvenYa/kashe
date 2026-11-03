-- =============================================================================
-- FAZ 10b / DB 00 — VERI DUZELTMESI (veri degistirir; 01 FK dosyasindan ONCE kosar)
-- Uretimde 4 Kasim push denemesinde 01 dosyasi durdu: `quote_requests.event_type` icinde `event_types` disinda
-- `activation`, `fashion` degerleri var. Kaynak: Temmuz 2026 "etkinlik taksonomisi tek kaynak" duzeltmesinden (3f7ffc5)
-- once model/hostes brief formlarinin kendi tur listeleri vardi; bugunku formlar bu degerleri yazmaz.
-- Kural (38 bolum 10b, onayli plan): anahtar disi deger -> 'other' (Diger). Orijinal deger `brief_data` icinde aynen
-- durur (bu dosya brief_data'ya DOKUNMAZ) — kayip yok.
-- Dort tablo taranir (conversations, listings, bookings, quote_requests); `listings` updated_at tetikleyicisi bu islem
-- icin gecici kapatilir ve ayni blokta acilip dogrulanir (dolum updated_at oynatmaz). Uretimde yalniz quote_requests
-- satiri beklenir; degisen her deger NOTICE ile listelenir.
-- Idempotan: ikinci kosuda 0 satir. Dalda (Sahne) 0 satir (no-op).
-- =============================================================================

DO $$
DECLARE t text; v text; n int; toplam int := 0;
BEGIN
  ALTER TABLE public.listings DISABLE TRIGGER listings_set_updated_at;
  FOREACH t IN ARRAY ARRAY['conversations', 'listings', 'bookings', 'quote_requests'] LOOP
    EXECUTE format(
      'SELECT string_agg(DISTINCT event_type, '', '') FROM public.%I x
        WHERE x.event_type IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.event_types e WHERE e.key = x.event_type)', t)
      INTO v;
    EXECUTE format(
      'UPDATE public.%I x SET event_type = ''other''
        WHERE x.event_type IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.event_types e WHERE e.key = x.event_type)', t);
    GET DIAGNOSTICS n = ROW_COUNT;
    toplam := toplam + n;
    IF n > 0 THEN RAISE NOTICE 'FAZ 10b dolum: %.event_type % satir -> other (degerler: %)', t, n, v; END IF;
  END LOOP;
  ALTER TABLE public.listings ENABLE TRIGGER listings_set_updated_at;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'listings_set_updated_at' AND tgrelid = 'public.listings'::regclass AND tgenabled = 'D') THEN
    RAISE EXCEPTION 'listings_set_updated_at kapali kaldi';
  END IF;
  RAISE NOTICE 'FAZ 10b dolum: toplam % satir duzeltildi', toplam;
END $$;
