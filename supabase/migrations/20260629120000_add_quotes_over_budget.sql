-- Teklif Topla — bütçe yumuşak sınır: quotes.over_budget bayrağı.
--
-- "Bütçe üstü" işareti teklif gönderilirken (submitOffer) HESAPLANIR ve burada saklanır:
--   over_budget = share_budget AND budget_max IS NOT NULL AND total_amount > budget_max
-- Müşteri tarafı bu bayrağı okuyup "Bütçe üstü" rozetini gösterir (runtime türetme/parse yok).
--
-- quotes tablosu DRIFT DEĞİL (20260519110133_add_quotes_and_bookings.sql'de tanımlı).
-- Additive + idempotent + DEFAULT false → mevcut tüm teklifler over_budget=false,
-- davranış/gösterim geriye uyumlu. Basit boolean; ek CHECK/constraint gerekmez.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS over_budget boolean NOT NULL DEFAULT false;
