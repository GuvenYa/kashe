-- 20260703120000_fix_recipients_policy_recursion.sql
-- FIX: quote_request_recipients uye politikasi quote_requests'e ciplak EXISTS ile
-- bakiyordu; quote_requests'in mevcut "Recipients see..." politikasi da recipients'a
-- bakiyor → cift yonlu RLS referansi → infinite recursion. Cozum: EXISTS'i
-- SECURITY DEFINER helper'a tasi (RLS baypas → dongu kirilir).

BEGIN;

CREATE OR REPLACE FUNCTION public.is_business_member_of_request(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM quote_requests q
    JOIN business_members bm ON bm.business_id = q.customer_id
    WHERE q.id = p_request_id
      AND bm.member_user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Business members read team request recipients" ON quote_request_recipients;
CREATE POLICY "Business members read team request recipients"
  ON quote_request_recipients FOR SELECT TO authenticated
  USING (is_business_member_of_request(request_id));

COMMIT;