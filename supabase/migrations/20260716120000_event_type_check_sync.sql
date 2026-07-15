-- event_type CHECK constraint senkronizasyonu — tek-kaynak taksonomi.
--
-- KAYNAK: app/mesajlar/data.ts → EVENT_TYPES / EVENT_TYPE_KEYS.
--   Taksonomi değişirse (yeni etkinlik türü eklenir/çıkarılırsa) yalnız data.ts
--   güncellenir ve BU migration'daki listeler onu takip eder.
--
-- TEŞHİS NOTU: "conversations_event_type_check violation" hatasının kaynağı
--   constraint DEĞİLDİ. conversations_event_type_check Mayıs'tan beri AKTİF ve
--   zaten tam bu 8 değeri zorluyordu; taksonomi-dışı bir event_type hiçbir zaman
--   INSERT edilemedi. Gerçek sebep: brief formlarının (app/lib/brief-config.ts)
--   legacyColumn:'event_type' alanlarının taksonomi-dışı seçenek üretmesiydi
--   (ör. fotografci → 'product'/'fashion'/'social', sunucu → 'conference'/'gala'/
--   'launch'/'fair' ...). Kod tarafında düzeltildi (formlar tek kaynağa bağlandı +
--   startConversation'a server-side normalizasyon eklendi). Bu migration constraint'i
--   tek kaynağa göre YENİDEN BİLDİRİR + BELGELER ve bookings'e savunma katmanı ekler.
--
-- ÖN KOŞUL / DAĞILIM SORGUSU (apply öncesi elle çalıştır — istenirse):
--   select event_type, count(*) from conversations group by 1 order by 2 desc;
--   select event_type, count(*) from bookings      group by 1 order by 2 desc;
--   select event_type, count(*) from listings      group by 1 order by 2 desc;
--   Not: conversations & listings zaten VALID constraint ile bu 8 değere kısıtlıydı
--   → mevcut satırlar garantili uyumlu, yeniden bildirme apply'da patlamaz.

BEGIN;

-- 1) conversations — value kümesi aynı; yeniden bildir + belgele (idempotent-güvenli)
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_event_type_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_event_type_check
  CHECK (
    event_type IS NULL OR event_type IN (
      'wedding', 'engagement', 'birthday', 'baby_shower',
      'graduation', 'circumcision', 'corporate', 'other'
    )
  );
COMMENT ON CONSTRAINT conversations_event_type_check ON conversations IS
  'Kaynak: app/mesajlar/data.ts EVENT_TYPE_KEYS. Taksonomi degisirse guncelle.';

-- 2) listings — aynı taksonomi; inline (isimsiz) CHECK'i adlandırılmışla değiştir
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_event_type_check;
ALTER TABLE listings ADD CONSTRAINT listings_event_type_check
  CHECK (
    event_type IS NULL OR event_type IN (
      'wedding', 'engagement', 'birthday', 'baby_shower',
      'graduation', 'circumcision', 'corporate', 'other'
    )
  );
COMMENT ON CONSTRAINT listings_event_type_check ON listings IS
  'Kaynak: app/mesajlar/data.ts EVENT_TYPE_KEYS. Taksonomi degisirse guncelle.';

-- 3) bookings — daha önce CHECK yoktu (trigger conversations'tan kopyalar, o yüzden
--    mevcut satırlar zaten uyumlu). Savunma katmanı olarak aynı taksonomiyi ekle.
--    NOT VALID: mevcut satırları taramaz → apply hiçbir veri durumunda patlamaz;
--    yeni INSERT/UPDATE'leri zorlar. Veri doğrulandıktan sonra istenirse:
--    ALTER TABLE bookings VALIDATE CONSTRAINT bookings_event_type_check;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_event_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_event_type_check
  CHECK (
    event_type IS NULL OR event_type IN (
      'wedding', 'engagement', 'birthday', 'baby_shower',
      'graduation', 'circumcision', 'corporate', 'other'
    )
  ) NOT VALID;
COMMENT ON CONSTRAINT bookings_event_type_check ON bookings IS
  'Kaynak: app/mesajlar/data.ts EVENT_TYPE_KEYS. Taksonomi degisirse guncelle.';

COMMIT;
