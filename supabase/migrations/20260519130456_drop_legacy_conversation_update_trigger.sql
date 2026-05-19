-- =============================================================================
-- Eski duplicate trigger ve fonksiyonu temizle.
--
-- Sebep: Faz 7'de update_conversation_last_message_at() yazıldı ve
--   on_message_insert_update_conversation trigger'ı ile bağlandı.
--   Ondan önce var olan messages_update_conversation trigger'ı +
--   update_conversation_last_message() fonksiyonu duplicate iş yapıyor.
--
-- Davranış aynı (her ikisi de last_message_at güncelliyor) ama her INSERT'te
-- iki kez çalışıyor — gereksiz yük.
-- =============================================================================

-- Trigger önce (fonksiyona dependency)
DROP TRIGGER IF EXISTS messages_update_conversation ON messages;

-- Sonra fonksiyon
DROP FUNCTION IF EXISTS update_conversation_last_message();

-- =============================================================================
-- notifications: REPLICA IDENTITY FULL
--
-- Realtime UPDATE event'lerinde Postgres default olarak sadece PK'yi payload'a
-- koyar. NotificationBell'in 'read_at IS NULL → NOT NULL' geçişini yakalayabilmesi
-- için tüm satırın eski değerine ihtiyacı var. FULL ile her UPDATE/DELETE
-- event'inde tüm kolonlar yayınlanır.
-- =============================================================================

ALTER TABLE notifications REPLICA IDENTITY FULL;