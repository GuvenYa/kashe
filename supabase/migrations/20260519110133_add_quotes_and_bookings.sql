-- =============================================================================
-- Faz 8: Quote System + Bookings
--
-- İki yeni tablo: quotes (gönderilen teklifler) ve bookings (onaylanan teklifler).
-- messages tablosuna message_type + quote_id eklenir.
-- 4 trigger: expire kontrol, accepted → booking otomasyonu, declined/expired
-- bildirim, sistem mesajı oluşturma.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUM types
-- -----------------------------------------------------------------------------

CREATE TYPE quote_status AS ENUM (
  'pending',     -- Teklif gönderildi, bekliyor
  'accepted',    -- Müşteri onayladı
  'declined',    -- Müşteri reddetti
  'expired',     -- Geçerlilik tarihi geçti
  'withdrawn'    -- Profesyonel geri çekti
);

CREATE TYPE booking_status AS ENUM (
  'confirmed',   -- Onaylandı, etkinlik bekleniyor
  'cancelled',   -- İptal edildi
  'completed'    -- Etkinlik tamamlandı
);

CREATE TYPE message_type AS ENUM (
  'text',        -- Normal mesaj (mevcut, default)
  'quote',       -- Teklif kartı
  'system'       -- Sistem bildirimi
);

-- -----------------------------------------------------------------------------
-- 2. quotes tablosu
-- -----------------------------------------------------------------------------

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Teklif içeriği
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'TRY' CHECK (currency IN ('TRY')),
  services_description TEXT NOT NULL CHECK (char_length(services_description) BETWEEN 10 AND 2000),
  cancellation_policy TEXT CHECK (cancellation_policy IS NULL OR char_length(cancellation_policy) <= 1000),

  -- Süreç
  expires_at TIMESTAMPTZ NOT NULL,
  status quote_status NOT NULL DEFAULT 'pending',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,

  -- Geçerlilik en az 1 saat, en fazla 30 gün olmalı
  CONSTRAINT valid_expires_at CHECK (
    expires_at > created_at + interval '1 hour'
    AND expires_at < created_at + interval '30 days'
  )
);

CREATE INDEX quotes_conversation_id_idx ON quotes(conversation_id);
CREATE INDEX quotes_sender_id_idx ON quotes(sender_id);
CREATE INDEX quotes_status_idx ON quotes(status) WHERE status = 'pending';
CREATE INDEX quotes_expires_at_idx ON quotes(expires_at) WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- 3. bookings tablosu
-- -----------------------------------------------------------------------------

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE RESTRICT,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Etkinlik bilgileri (conversation'dan snapshot - DB normalize değil, kayıt amaçlı)
  event_date DATE,
  event_type TEXT,
  location TEXT,
  guest_count INTEGER,

  -- Para
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
  currency TEXT NOT NULL DEFAULT 'TRY',

  status booking_status NOT NULL DEFAULT 'confirmed',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

CREATE INDEX bookings_customer_id_idx ON bookings(customer_id);
CREATE INDEX bookings_professional_id_idx ON bookings(professional_id);
CREATE INDEX bookings_conversation_id_idx ON bookings(conversation_id);
CREATE INDEX bookings_status_idx ON bookings(status);
CREATE INDEX bookings_event_date_idx ON bookings(event_date) WHERE event_date IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. messages tablosuna message_type + quote_id ekle
-- -----------------------------------------------------------------------------

ALTER TABLE messages
  ADD COLUMN message_type message_type NOT NULL DEFAULT 'text';

ALTER TABLE messages
  ADD COLUMN quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE;

CREATE INDEX messages_quote_id_idx ON messages(quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX messages_type_idx ON messages(message_type) WHERE message_type != 'text';

-- quote_id varsa message_type 'quote' olmalı, system mesajının quote_id'si olabilir
ALTER TABLE messages ADD CONSTRAINT messages_quote_consistency
  CHECK (
    (message_type = 'quote' AND quote_id IS NOT NULL)
    OR (message_type != 'quote')
  );

-- -----------------------------------------------------------------------------
-- 5. RLS — quotes
-- -----------------------------------------------------------------------------

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Konuşmanın taraflarından biri okuyabilir
CREATE POLICY "Quotes visible to conversation participants"
  ON quotes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = quotes.conversation_id
      AND (c.customer_id = auth.uid() OR c.professional_id = auth.uid())
    )
  );

-- Sadece konuşmadaki profesyonel teklif gönderebilir
CREATE POLICY "Professional creates quotes in their conversations"
  ON quotes FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = quotes.conversation_id
      AND c.professional_id = auth.uid()
    )
  );

-- Profesyonel kendi teklifini withdraw edebilir (sadece pending)
-- Müşteri kendi konuşmasındaki teklifi accept/decline edebilir
CREATE POLICY "Quote status updates by authorized parties"
  ON quotes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = quotes.conversation_id
      AND (c.customer_id = auth.uid() OR c.professional_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 6. RLS — bookings
-- -----------------------------------------------------------------------------

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Taraflar görür
CREATE POLICY "Bookings visible to participants"
  ON bookings FOR SELECT
  USING (customer_id = auth.uid() OR professional_id = auth.uid());

-- INSERT/UPDATE/DELETE yok — sadece trigger yazar
-- (Manuel müdahale gerekirse service_role kullanılır)

-- -----------------------------------------------------------------------------
-- 7. Trigger function: Teklif kabul edilince booking oluştur
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_quote_accepted_create_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv RECORD;
BEGIN
  -- Sadece status 'pending' → 'accepted' geçişinde çalış
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN

    -- responded_at'i set et
    NEW.responded_at := now();

    -- Konuşma verilerini al
    SELECT customer_id, professional_id, event_date, event_type, location, guest_count
    INTO conv
    FROM conversations
    WHERE id = NEW.conversation_id;

    -- Booking oluştur (snapshot)
    INSERT INTO bookings (
      quote_id, conversation_id,
      customer_id, professional_id,
      event_date, event_type, location, guest_count,
      total_amount, platform_fee, currency,
      status
    ) VALUES (
      NEW.id, NEW.conversation_id,
      conv.customer_id, conv.professional_id,
      conv.event_date, conv.event_type, conv.location, conv.guest_count,
      NEW.total_amount, 0, NEW.currency,  -- platform_fee Faz 14'te hesaplanır
      'confirmed'
    );
  END IF;

  -- declined/withdrawn için sadece responded_at'i set et
  IF OLD.status = 'pending' AND NEW.status IN ('declined', 'withdrawn', 'expired') THEN
    NEW.responded_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_quote_status_change_create_booking
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION on_quote_accepted_create_booking();

-- -----------------------------------------------------------------------------
-- 8. Trigger function: Teklif değişikliklerinde sistem mesajı oluştur
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_quote_status_change_post_system_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  system_body TEXT;
  system_sender UUID;
BEGIN
  -- Sadece status değişiminde çalış
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Sistem mesajı için sender = profesyonel (kim olursa olsun, mesaj sahibi gerek)
  system_sender := NEW.sender_id;

  -- Mesaj içeriği status'e göre
  CASE NEW.status
    WHEN 'accepted'  THEN system_body := '✓ Teklif onaylandı';
    WHEN 'declined'  THEN system_body := '✗ Teklif reddedildi';
    WHEN 'expired'   THEN system_body := '⏱ Teklif süresi doldu';
    WHEN 'withdrawn' THEN system_body := '↩ Teklif geri çekildi';
    ELSE RETURN NEW;
  END CASE;

  INSERT INTO messages (
    conversation_id, sender_id, body,
    message_type, quote_id
  ) VALUES (
    NEW.conversation_id, system_sender, system_body,
    'system', NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_quote_status_change_post_system_message
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION on_quote_status_change_post_system_message();

-- -----------------------------------------------------------------------------
-- 9. Trigger function: Teklif gönderilince notification oluştur (müşteriye)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_quote_insert_notify_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer UUID;
  professional_name TEXT;
BEGIN
  SELECT c.customer_id, p.full_name
  INTO customer, professional_name
  FROM conversations c
  JOIN profiles p ON p.id = NEW.sender_id
  WHERE c.id = NEW.conversation_id;

  INSERT INTO notifications (user_id, type, body, link)
  VALUES (
    customer,
    'message',
    COALESCE(professional_name, 'Profesyonel') || ' sana bir teklif gönderdi',
    '/mesajlar/' || NEW.conversation_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_quote_insert_notify_customer
  AFTER INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION on_quote_insert_notify_customer();

-- -----------------------------------------------------------------------------
-- 10. Trigger function: Teklif accept/decline edilince profesyonele notification
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_quote_responded_notify_professional()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_name TEXT;
  notif_body TEXT;
BEGIN
  -- Sadece müşteri onaylar/reddederse profesyonele bildir
  IF NEW.status NOT IN ('accepted', 'declined') THEN
    RETURN NEW;
  END IF;
  IF OLD.status != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT p.full_name INTO customer_name
  FROM conversations c
  JOIN profiles p ON p.id = c.customer_id
  WHERE c.id = NEW.conversation_id;

  notif_body := COALESCE(customer_name, 'Müşteri') || ' teklifini ' ||
    CASE NEW.status
      WHEN 'accepted' THEN 'onayladı 🎉'
      WHEN 'declined' THEN 'reddetti'
    END;

  INSERT INTO notifications (user_id, type, body, link)
  VALUES (
    NEW.sender_id,
    'message',
    notif_body,
    '/mesajlar/' || NEW.conversation_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_quote_responded_notify_professional
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION on_quote_responded_notify_professional();

-- -----------------------------------------------------------------------------
-- 11. Realtime: quotes tablosunu Realtime publication'a ekle
-- -----------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE quotes;