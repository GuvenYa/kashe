-- =============================================================================
-- Kurumsal Ekip — Yazma Pass DİLİM 2: Kurum Adına Oluşturma
--
-- manager+ üyeler KURUM ADINA teklif talebi + rezervasyon/konuşma + ilan
-- oluşturabilir/düzenleyebilir. Sahiplik kolonu = KURUMUN id'si.
-- quote_requests'e created_by (üye izi) eklenir.
--
-- Dashboard'dan manuel apply (db push YOK). Idempotent + atomik (BEGIN/COMMIT).
-- Rol eşiği helper'ı has_business_role(...) DİLİM 1'de kuruldu (owner=3>manager=2>member=1).
--
-- ⚠️ DRIFT: quote_requests + quote_request_recipients politikaları repo migration'ında
--    YOK (Dashboard'dan kurulmuş). Mevcut halleri (brief'ten) DROP+CREATE ile yeniden yazılır.
--
-- -----------------------------------------------------------------------------
-- GERİ DÖNÜŞ İÇİN — değişen politikaların ÖNCEKİ halleri:
--
--   quote_requests INSERT "Customers create own quote requests"
--     WITH CHECK (customer_id = auth.uid())
--   quote_requests UPDATE "Customers update own quote requests"
--     USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid())
--   quote_request_recipients INSERT "Customers add recipients to own requests"
--     WITH CHECK (owns_quote_request(request_id, auth.uid()))
--   conversations INSERT conversations_insert_customer
--     WITH CHECK (auth.uid() = customer_id)
--   listings INSERT "Customers and businesses create listings"
--     WITH CHECK (creator_id=auth.uid() AND EXISTS(profiles p WHERE p.id=auth.uid()
--                AND p.role IN ('client','business')))
--   listings UPDATE "Users update their own listings"
--     USING (creator_id = auth.uid())
-- -----------------------------------------------------------------------------
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- a) quote_requests.created_by — üye izi (nullable, DEFAULT yok; eski satırlar NULL = sahip)
-- -----------------------------------------------------------------------------
ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id);

-- -----------------------------------------------------------------------------
-- b) has_business_role_on_request — talep üzerinden rol kontrolü
--    (SECURITY DEFINER; politika içine quote_requests subquery'si yazılMAZ → özyineleme yok)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_business_role_on_request(
  p_request_id uuid,
  p_min_role business_member_role
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM quote_requests q
    WHERE q.id = p_request_id
      AND has_business_role(q.customer_id, p_min_role)
  );
$$;

-- -----------------------------------------------------------------------------
-- c) quote_requests INSERT — manager+ kurum adına talep oluşturabilir
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers create own quote requests" ON quote_requests;
CREATE POLICY "Customers create own quote requests"
  ON quote_requests FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    OR has_business_role(customer_id, 'manager')
  );

-- -----------------------------------------------------------------------------
-- d) quote_requests UPDATE — akış-içi güncellemeler üye oluşturunca da çalışsın
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers update own quote requests" ON quote_requests;
CREATE POLICY "Customers update own quote requests"
  ON quote_requests FOR UPDATE
  USING (
    customer_id = auth.uid()
    OR has_business_role(customer_id, 'manager')
  )
  WITH CHECK (
    customer_id = auth.uid()
    OR has_business_role(customer_id, 'manager')
  );

-- -----------------------------------------------------------------------------
-- e) quote_request_recipients INSERT — manager+ kurum talebine alıcı ekleyebilir
--    (owns_quote_request fonksiyonuna DOKUNULMAZ — başka yerlerde sahiplik anlamıyla kullanımda)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers add recipients to own requests" ON quote_request_recipients;
CREATE POLICY "Customers add recipients to own requests"
  ON quote_request_recipients FOR INSERT
  WITH CHECK (
    owns_quote_request(request_id, auth.uid())
    OR has_business_role_on_request(request_id, 'manager')
  );

-- -----------------------------------------------------------------------------
-- f) conversations INSERT — manager+ kurum adına konuşma başlatabilir
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS conversations_insert_customer ON public.conversations;
CREATE POLICY conversations_insert_customer
  ON public.conversations FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id
    OR has_business_role(customer_id, 'manager')
  );

-- -----------------------------------------------------------------------------
-- g) listings INSERT — manager+ kurum adına ilan oluşturabilir
--    (üye dalında profil rolü kontrolü YOK — "kaynak üzerinde yetki" felsefesi)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers and businesses create listings" ON listings;
CREATE POLICY "Customers and businesses create listings"
  ON listings FOR INSERT
  WITH CHECK (
    (
      creator_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('client', 'business')
      )
    )
    OR has_business_role(creator_id, 'manager')
  );

-- -----------------------------------------------------------------------------
-- h) listings UPDATE — manager+ kurum ilanını güncelleyebilir
--    NOT: close/cancel/delete owner-only kurali action katmaninda uygulanir; RLS
--    satir seviyesinde manager'a genis UPDATE verir (bilinçli karar, dilim 2 —
--    iki katmanli savunmanin action tarafi ince ayrimi yapar).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users update their own listings" ON listings;
CREATE POLICY "Users update their own listings"
  ON listings FOR UPDATE
  USING (
    creator_id = auth.uid()
    OR has_business_role(creator_id, 'manager')
  );

COMMIT;
