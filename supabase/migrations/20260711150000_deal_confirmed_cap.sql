-- deal_confirmed_customer_ids — RPC tavanı: p_customers dizisini ilk 50 ile sınırla.
--
-- Amaç: kötü niyetli/anormal büyük p_customers dizisiyle çağrılara karşı sabit tavan.
-- Sayfada gösterilen yorumcu sayısı zaten küçük (≤3); bu yalnız güvenlik tavanıdır.
-- İmza ve grant'ler AYNEN; tek fark gövdede p_customers -> p_customers[1:50] (array dilimi).
--
-- MANUEL uygulanır (Supabase Dashboard SQL Editor). Idempotent: CREATE OR REPLACE.
BEGIN;

CREATE OR REPLACE FUNCTION public.deal_confirmed_customer_ids(
  p_professional uuid,
  p_customers uuid[]
)
RETURNS TABLE(customer_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT b.customer_id
  FROM public.bookings b
  WHERE b.professional_id = p_professional
    AND b.customer_id = ANY(p_customers[1:50])
    AND b.status IN ('confirmed', 'completed');
$$;

REVOKE ALL ON FUNCTION public.deal_confirmed_customer_ids(uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.deal_confirmed_customer_ids(uuid, uuid[]) TO anon, authenticated;

COMMENT ON FUNCTION public.deal_confirmed_customer_ids(uuid, uuid[]) IS
  'SIRA1 deal tanimi (bookings confirmed/completed) - public yorum "Onayli" rozeti icin guvenli uyelik sorgusu. SECURITY DEFINER; p_customers ilk 50 ile sinirli (RPC tavani).';

COMMIT;
