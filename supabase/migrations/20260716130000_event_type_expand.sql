-- event_type taksonomisi GENİŞLETME — 8 → 15 anahtar.
--
-- KAYNAK: app/mesajlar/data.ts → EVENT_TYPES / EVENT_TYPE_KEYS (tek kaynak).
--   Bu migration, taksonomiye eklenen 7 meşru ETKİNLİK türünü (henna, launch, fair,
--   conference, congress, gala, concert) üç event_type CHECK constraint'ine yansıtır.
--   Çekim/iş türleri (product, fashion, social, promo, ad, kids, stage, school, mall,
--   family, outdoor, activation) etkinlik DEĞİLDİR → taksonomiye GİRMEZ.
--
--   20260716120000_event_type_check_sync.sql'i (8 anahtar) günceller/üzerine yazar;
--   DROP IF EXISTS kullanıldığı için o migration uygulanmış olsun/olmasın güvenli.
--
-- 15 anahtar: wedding, engagement, henna, birthday, baby_shower, graduation,
--             circumcision, corporate, launch, fair, conference, congress, gala,
--             concert, other
--
-- DARALTMA YOK: yeni liste eski 8 anahtarı kapsar (superset) → mevcut satırlar uyumlu.

BEGIN;

-- 1) conversations
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_event_type_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_event_type_check
  CHECK (
    event_type IS NULL OR event_type IN (
      'wedding', 'engagement', 'henna', 'birthday', 'baby_shower',
      'graduation', 'circumcision', 'corporate', 'launch', 'fair',
      'conference', 'congress', 'gala', 'concert', 'other'
    )
  );
COMMENT ON CONSTRAINT conversations_event_type_check ON conversations IS
  'Kaynak: app/mesajlar/data.ts EVENT_TYPE_KEYS (15). Taksonomi degisirse guncelle.';

-- 2) listings
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_event_type_check;
ALTER TABLE listings ADD CONSTRAINT listings_event_type_check
  CHECK (
    event_type IS NULL OR event_type IN (
      'wedding', 'engagement', 'henna', 'birthday', 'baby_shower',
      'graduation', 'circumcision', 'corporate', 'launch', 'fair',
      'conference', 'congress', 'gala', 'concert', 'other'
    )
  );
COMMENT ON CONSTRAINT listings_event_type_check ON listings IS
  'Kaynak: app/mesajlar/data.ts EVENT_TYPE_KEYS (15). Taksonomi degisirse guncelle.';

-- 3) bookings — bu kez VALID (satır sayısı küçük, tam tarama anlık).
--    Trigger conversations'tan kopyalar → mevcut satırlar zaten uyumlu.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_event_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_event_type_check
  CHECK (
    event_type IS NULL OR event_type IN (
      'wedding', 'engagement', 'henna', 'birthday', 'baby_shower',
      'graduation', 'circumcision', 'corporate', 'launch', 'fair',
      'conference', 'congress', 'gala', 'concert', 'other'
    )
  );
COMMENT ON CONSTRAINT bookings_event_type_check ON bookings IS
  'Kaynak: app/mesajlar/data.ts EVENT_TYPE_KEYS (15). Taksonomi degisirse guncelle.';

COMMIT;
