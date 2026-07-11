-- Deal-confirmed müşteri seti — public /p/[id] "Onaylı yorum" rozeti için.
--
-- Neden gerekli: reviews INSERT RLS yalnız KONUŞMA varlığı ister → sadece mesajlaşmış
-- müşteri de yorum bırakabilir. "Onaylı yorum" rozetini tüm kartlarda göstermek fazla
-- iddia. Rozet YALNIZ gerçek anlaşması olan müşterinin yorumunda çizilmeli.
--
-- Deal tanımı (SIRA1 iletişim-gate ile birebir): bookings.status ∈ {confirmed, completed}.
-- Bu tanım kabul edilmiş teklifleri de kapsar — çünkü on_quote_accepted_create_booking
-- trigger'ı (bkz. 20260519110133) teklif pending→accepted olunca status='confirmed' bir
-- booking materyalize eder. Dolayısıyla "kabul edilmiş teklif VEYA onaylı rezervasyon"
-- tamamı TEK tabloda (bookings) yakalanır.
--
-- Neden SECURITY DEFINER: bookings SELECT RLS'i yalnız taraflara açık
-- (customer_id = auth.uid() OR professional_id = auth.uid()). Üçüncü kişi / anon ziyaretçi
-- ham satırları göremez → istemci sorgusu boş döner. Bu fonksiyon SADECE verilen
-- (professional, customer_ids) çiftleri için ÜYELİK (hangi müşterinin deal'i var) sızdırır —
-- ham deal verisi (tutar, tarih, konu) DEĞİL. Yorumlar zaten public olduğundan bu
-- türetilmiş güven sinyali güvenlidir.
--
-- DOKUNULMAYANLAR: hiçbir RLS politikası değişmez; reviews / yorum oluşturma akışı değişmez.
-- Yalnız yeni, salt-okunur bir yardımcı fonksiyon eklenir. MANUEL uygulanır (Dashboard SQL).
-- Idempotent: CREATE OR REPLACE + koşulsuz GRANT.

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
    AND b.customer_id = ANY(p_customers)
    AND b.status IN ('confirmed', 'completed');
$$;

-- Anon dahil herkes çağırabilir (yalnız üyelik döndürür, ham satır değil).
REVOKE ALL ON FUNCTION public.deal_confirmed_customer_ids(uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.deal_confirmed_customer_ids(uuid, uuid[]) TO anon, authenticated;

COMMENT ON FUNCTION public.deal_confirmed_customer_ids(uuid, uuid[]) IS
  'SIRA1 deal tanımı (bookings confirmed/completed; kabul edilmiş teklif trigger ile buraya düşer) — public yorum "Onaylı" rozeti için güvenli üyelik sorgusu. SECURITY DEFINER; ham satır sızdırmaz.';

COMMIT;
