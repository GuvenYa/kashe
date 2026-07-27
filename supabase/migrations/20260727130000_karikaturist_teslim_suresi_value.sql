-- KARİKATÜRİST teslim_suresi DEĞER GÖÇÜ: 'Anında (canlı)' → 'Anında'
--
-- NEDEN: karikaturist Dalga 0'da 'category_attributes' filtre sistemine geçti.
-- Filtre koşulları PostgREST `or=(...)` gövdesinde taşınıyor; bu dilbilgisinde
-- parantez GRUP karakteridir. Değerin içindeki '(' ')' ayracı taklit eder.
-- app/lib/filter-config.ts → isPostgrestSafeValue bu tür değerleri eler ve
-- alan NEVER_MATCH'e düşer (sessizce gevşemez ama o değer hiç eşleşmez).
--
-- Bu yüzden QUICK_OPTIONS_BY_SLUG.karikaturist.teslim_suresi seçeneği
-- 'Anında (canlı)' → 'Anında' olarak kısaltıldı. "canlı" nüansı zaten
-- logisticsChecks.canli_cizim ("Etkinlikte canlı çizim yapar") ile taşınıyor.
--
-- KAPSAM: yalnız tam eşleşen eski değer. Başka değere dokunmaz.
-- İDEMPOTENT: ikinci çalıştırmada eşleşen satır kalmaz (WHERE boş döner).
--
-- NOT: Dalga 0 pilotlarında yayında profil olmadığı bildirildi; bu migration
-- yayında OLMAYAN (taslak) kayıtlar için de koruma sağlar ve 0 satırda zararsızdır.

BEGIN;

DO $$
DECLARE
  touched integer;
BEGIN
  UPDATE public.profiles p
  SET category_attributes =
        jsonb_set(
          p.category_attributes,
          '{quick,teslim_suresi}',
          '"Anında"'::jsonb,
          false  -- create_missing = false: anahtar yoksa dokunma
        )
  WHERE p.category_attributes->'quick'->>'teslim_suresi' = 'Anında (canlı)';

  GET DIAGNOSTICS touched = ROW_COUNT;
  RAISE NOTICE 'karikaturist teslim_suresi ''Anında (canlı)'' → ''Anında'': % satır', touched;
END $$;

COMMIT;

-- =============================================================================
-- DOĞRULAMA (elle çalıştır — migration'ın parçası değil)
-- =============================================================================
--
-- 1) Eski değer kalmış mı? Beklenen: 0 satır.
--
--    SELECT id, category_attributes->'quick'->>'teslim_suresi'
--    FROM public.profiles
--    WHERE category_attributes->'quick'->>'teslim_suresi' = 'Anında (canlı)';
--
-- 2) Karikatürist profillerinin teslim süresi dağılımı — yalnız config'teki
--    üç değer ('Anında', '1–3 gün', '1 hafta') görünmeli.
--
--    SELECT p.category_attributes->'quick'->>'teslim_suresi' AS teslim, count(*)
--    FROM public.profiles p
--    JOIN public.service_categories sc ON sc.id = p.primary_category_id
--    WHERE sc.slug = 'karikaturist'
--      AND p.category_attributes->'quick' ? 'teslim_suresi'
--    GROUP BY 1;
--
-- 3) Filtre fiilen eşleşiyor mu?
--
--    SELECT id FROM public.profiles
--    WHERE category_attributes @> '{"quick":{"teslim_suresi":"Anında"}}';
