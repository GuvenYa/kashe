-- 20260701120000_business_member_shared_visibility.sql
-- Kurumsal ekip Adim 2 — paylasimli veri gorunurlugu (SELECT-only pass)
-- business uyeleri, uyesi olduklari kurumun verisini gorur (customer/creator yolu).
-- EK politikalar: mevcut sahip + agency/is_assignee politikalarina DOKUNULMAZ.
-- Idempotent (DROP IF EXISTS + CREATE) + atomik (BEGIN/COMMIT — yarida kalmaz).
--
-- NOT (drift): Bu migration asagidaki tablolarin RLS'ine EK politika ekler,
-- tablolari OLUSTURMAZ. quote_requests + quote_request_recipients (ve digerleri)
-- repo CREATE'lerinde drift — fresh DB'de bu dosya tek basina calismaz, once
-- drift tablolarin DDL'i gerekir (db dump ertelendi). Prod'a dashboard'dan
-- uygulandi; db push kullanilmiyor, o yuzden mevcut akista sorun degil.

BEGIN;

-- 1) listings (dogrudan: creator_id — DIKKAT, customer_id degil)
DROP POLICY IF EXISTS "Business members read team listings" ON listings;
CREATE POLICY "Business members read team listings"
  ON listings FOR SELECT TO authenticated
  USING (is_business_member(creator_id));

-- 2) conversations (dogrudan: customer_id)
DROP POLICY IF EXISTS "Business members read team conversations" ON conversations;
CREATE POLICY "Business members read team conversations"
  ON conversations FOR SELECT TO authenticated
  USING (is_business_member(customer_id));

-- 3) bookings (dogrudan: customer_id)
DROP POLICY IF EXISTS "Business members read team bookings" ON bookings;
CREATE POLICY "Business members read team bookings"
  ON bookings FOR SELECT TO authenticated
  USING (is_business_member(customer_id));

-- 4) quote_requests (dogrudan: customer_id)
DROP POLICY IF EXISTS "Business members read team quote requests" ON quote_requests;
CREATE POLICY "Business members read team quote requests"
  ON quote_requests FOR SELECT TO authenticated
  USING (is_business_member(customer_id));

-- 5) messages (zincirli: conversations.customer_id uzerinden)
DROP POLICY IF EXISTS "Business members read team messages" ON messages;
CREATE POLICY "Business members read team messages"
  ON messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND is_business_member(c.customer_id)
  ));

-- 6) quotes (zincirli: conversations.customer_id uzerinden)
DROP POLICY IF EXISTS "Business members read team quotes" ON quotes;
CREATE POLICY "Business members read team quotes"
  ON quotes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = quotes.conversation_id
      AND is_business_member(c.customer_id)
  ));

-- 7) quote_request_recipients (zincirli: quote_requests.customer_id uzerinden)
DROP POLICY IF EXISTS "Business members read team request recipients" ON quote_request_recipients;
CREATE POLICY "Business members read team request recipients"
  ON quote_request_recipients FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quote_requests q
    WHERE q.id = quote_request_recipients.request_id
      AND is_business_member(q.customer_id)
  ));

COMMIT;