-- =============================================================================
-- notify_new_message trigger fonksiyonunu güncelle:
-- Sadece 'text' tipindeki mesajlarda bildirim üretsin.
--
-- Sebep: Faz 8 ile messages tablosuna 3 mesaj tipi eklendi: text, quote, system.
--   - quote mesajları için zaten on_quote_insert_notify_customer ayrı bildirir
--   - system mesajları kullanıcının attığı bir mesaj değil, otomatik kayıt
--   - sadece text mesajlar gerçek mesaj bildirimi olmalı
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id UUID;
BEGIN
  -- Sadece text mesajlar bildirim üretir
  IF NEW.message_type != 'text' THEN
    RETURN NEW;
  END IF;

  -- Karşı tarafı bul (sender olmayan)
  SELECT CASE
    WHEN customer_id = NEW.sender_id THEN professional_id
    ELSE customer_id
  END
  INTO recipient_id
  FROM conversations
  WHERE id = NEW.conversation_id;

  -- Kendine bildirim atma
  IF recipient_id IS NULL OR recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, body, link)
  VALUES (
    recipient_id,
    'message',
    'Yeni mesaj aldın',
    '/mesajlar/' || NEW.conversation_id
  );

  RETURN NEW;
END;
$$;