-- ÇOKLU-ÇİP QUICK ALANLARI: " · " BİRLEŞİK STRING → string[] (jsonb array)
--
-- NEDEN: category_attributes.quick.<key> çoklu-çip değerleri bugüne dek tek bir
-- birleşik string olarak saklandı ("Simultane · Ardıl"). jsonb containment (@>)
-- substring eşleyemez, yani bu değerler
--     category_attributes @> '{"quick":{"ceviri_turleri":["Simultane"]}}'
-- sorgusuyla ASLA eşleşmez. Keşfet filtre köprüsü (Dalga 0) bu operatöre dayanıyor.
--
-- Uygulama tarafındaki toQuickList() okuma fallback'i GÖSTERİMİ kurtarır ama
-- FİLTREYİ KURTARMAZ: filtre DB'de containment ile çalışır, JS'e hiç gelmez.
-- Backfill yapılmazsa eski string'li profil, filtre uygulandığı anda sonuç
-- listesinden düşer — kullanıcıya hata gösterilmez, profil sessizce kaybolur
-- (sessiz keşfedilebilirlik kaybı). Bu yüzden veri göçü zorunludur.
--
-- HEDEF ANAHTARLAR = app/lib/category-fields.ts → QUICK_MULTI_OPTIONS anahtarlarının
-- TAMAMI. Bu liste oraya yeni anahtar eklendiğinde güncellenmelidir (yeni anahtarlar
-- zaten dizi olarak doğar; bu migration yalnız geçmiş kayıtlar içindir).
--
-- İDEMPOTENT: yalnız jsonb_typeof(...) = 'string' olan satırlara dokunur.
-- Zaten dizi olanlar (yeni kayıtlar + ikinci çalıştırma) WHERE ile elenir.

BEGIN;

DO $$
DECLARE
  -- QUICK_MULTI_OPTIONS anahtarları (2026-07-27 itibarıyla)
  multi_keys text[] := ARRAY['ceviri_turleri', 'enstruman'];
  k           text;
  touched     integer;
BEGIN
  FOREACH k IN ARRAY multi_keys LOOP
    UPDATE public.profiles p
    SET category_attributes = jsonb_set(
          p.category_attributes,
          ARRAY['quick', k],
          COALESCE(
            (
              -- "A · B" → ["A","B"]; ayraç '·', her eleman trim'lenir, boşlar atılır.
              -- (Form eskiden join(' · ') yazıyor, split('·') okuyordu — boşluk
              --  tutarsızlığına dayanıklı olmak için '·' üzerinden bölüyoruz.)
              SELECT jsonb_agg(e)
              FROM (
                SELECT btrim(elem) AS e
                FROM unnest(
                  string_to_array(p.category_attributes->'quick'->>k, '·')
                ) AS elem
                WHERE btrim(elem) <> ''
              ) AS parts
            ),
            '[]'::jsonb
          ),
          false  -- create_missing = false: 'quick' yoksa hiçbir şey yapma
        )
    WHERE jsonb_typeof(p.category_attributes->'quick'->k) = 'string';

    GET DIAGNOSTICS touched = ROW_COUNT;
    RAISE NOTICE 'quick.% → dizi: % satır güncellendi', k, touched;
  END LOOP;
END $$;

COMMIT;

-- =============================================================================
-- DOĞRULAMA (elle çalıştır — migration'ın parçası değil)
-- =============================================================================
--
-- 1) Geriye string kalmış mı? Beklenen: 0 satır.
--
--    SELECT id,
--           category_attributes->'quick'->'ceviri_turleri' AS ceviri,
--           category_attributes->'quick'->'enstruman'      AS enstruman
--    FROM public.profiles
--    WHERE jsonb_typeof(category_attributes->'quick'->'ceviri_turleri') = 'string'
--       OR jsonb_typeof(category_attributes->'quick'->'enstruman')      = 'string';
--
-- 2) Tip dağılımı — her anahtar için 'array' dışında bir tip kalmamalı.
--
--    SELECT 'ceviri_turleri' AS anahtar,
--           jsonb_typeof(category_attributes->'quick'->'ceviri_turleri') AS tip,
--           count(*)
--    FROM public.profiles
--    WHERE category_attributes->'quick' ? 'ceviri_turleri'
--    GROUP BY 1, 2
--    UNION ALL
--    SELECT 'enstruman',
--           jsonb_typeof(category_attributes->'quick'->'enstruman'),
--           count(*)
--    FROM public.profiles
--    WHERE category_attributes->'quick' ? 'enstruman'
--    GROUP BY 1, 2;
--
-- 3) Containment fiilen çalışıyor mu? (Dalga 0 filtre köprüsünün asıl testi)
--
--    SELECT id, full_name
--    FROM public.profiles
--    WHERE category_attributes @> '{"quick":{"ceviri_turleri":["Simultane"]}}';
--
-- 4) Index kullanılıyor mu? Beklenen: Bitmap Index Scan on
--    idx_profiles_category_attributes_gin (satır sayısı düşükken Seq Scan da normaldir).
--
--    EXPLAIN ANALYZE
--    SELECT id FROM public.profiles
--    WHERE category_attributes @> '{"quick":{"ceviri_turleri":["Simultane"]}}';
