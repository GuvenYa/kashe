-- §11 — Yapılandırılmış fiyat modu (Seçenek B): birim + "başlangıç" bayrağı.
--
-- AMAÇ: Mevcut price_min/price_max/price_on_request modelini KORUYARAK üstüne
--   - price_unit  → birim (toplam / saatlik / yarım gün / tam gün)
--   - price_starting → "X'ten başlayan" semantiği
-- ekler. Tamamen ADDITIVE + GERİYE UYUMLU: yeni sütunlar DEFAULT aldığı için
-- mevcut tüm satırlar 'total' + false olur → bugünkü gösterim/davranış BİREBİR korunur.
--
-- DOKUNULMAYAN: mevcut price_range_valid CHECK constraint (price_on_request'e bağlı,
-- çalışıyor) — yeni sütunlar ondan bağımsız.
--
-- İDEMPOTENT: ADD COLUMN IF NOT EXISTS + DROP/ADD CONSTRAINT IF EXISTS.

-- ─────────────────────────────────────────────────────────────
-- services
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS price_unit text NOT NULL DEFAULT 'total';

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS price_starting boolean NOT NULL DEFAULT false;

-- price_unit geçerli değer kümesi. Mevcut 'total' satırları geçerli kalır.
ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_price_unit_valid;
ALTER TABLE public.services
  ADD CONSTRAINT services_price_unit_valid
  CHECK (price_unit IN ('total', 'hourly', 'half_day', 'full_day'));

-- ─────────────────────────────────────────────────────────────
-- service_packages
-- ─────────────────────────────────────────────────────────────
-- NOT (DRIFT): service_packages tablosu erken migration'larda YOK ama prod'da MEVCUT
-- (dashboard'dan manuel kurulmuş). Bu yüzden burada CREATE TABLE DEĞİL, yalnızca
-- ALTER ADD COLUMN kullanılır — prod'da tablo var, sadece yeni sütun eklenir.
-- ⚠️ Bu migration prod için tasarlandı; TAZE bir DB'de (service_packages yokken)
--    bu ALTER "relation does not exist" verir. Tablonun migration'a alınması
--    (CREATE) ayrı bir drift-temizleme işidir.
--
-- §11: paketlerde yalnızca "X'ten başlar" isteniyor → price_unit YOK, sadece price_starting.
ALTER TABLE public.service_packages
  ADD COLUMN IF NOT EXISTS price_starting boolean NOT NULL DEFAULT false;

-- ── Drift referansı (yalnızca yorum — çalıştırılmaz) ──
-- service_packages prod şeması (types.ts + paketler/actions.ts'ten türetilmiş):
--   id uuid PK
--   profile_id uuid NOT NULL  (FK → profiles)
--   title text NOT NULL
--   description text
--   includes text[]
--   price_min numeric(10,2)
--   price_max numeric(10,2)
--   price_on_request boolean NOT NULL DEFAULT false
--   is_active boolean NOT NULL DEFAULT true
--   sort_order integer
--   created_at timestamptz
--   updated_at timestamptz
--   (+ bu migration) price_starting boolean NOT NULL DEFAULT false
