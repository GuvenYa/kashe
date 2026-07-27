-- EKİP BOYUTU DEĞER GÖÇÜ: 'Grup (4+)' → 'Grup 4+'
--
-- NEDEN: dansci Dalga 0'da 'category_attributes' filtre sistemine geçti ve
-- ekip_boyutu bir filtre alanı. Filtre koşulları PostgREST `or=(...)` gövdesinde
-- taşınır; parantez orada GRUP karakteridir. app/lib/filter-config.ts →
-- isPostgrestSafeValue bu değeri eler.
--
-- SESSİZ HATA UYARISI: alanın diğer 3 değeri güvenli olduğu için koşul
-- NEVER_MATCH'e DÜŞMEZ — yalnız 'Grup (4+)' seçeneği OR listesinden sessizce
-- düşerdi. Yani "Grup (4+)" filtreleyen kullanıcı hiçbir sonuç görmezdi ve
-- bunun bir hata olduğunu anlayamazdı. Değer bu yüzden kısaltıldı.
--
-- KAPSAM: EKIP_BOYUTU_OPTIONS'ı kullanan TÜM kategoriler — dansci (yeni sistem)
-- ve muzisyen (eski sistem; filtreye bağlı değil ama sözlük tek kaynak olmalı).
-- organizasyon'un kendi ekip_boyutu kümesi ayrıdır ('1–5 kişi'...), etkilenmez.
--
-- İDEMPOTENT: ikinci çalıştırmada eşleşen satır kalmaz.

BEGIN;

DO $$
DECLARE
  touched integer;
BEGIN
  UPDATE public.profiles p
  SET category_attributes =
        jsonb_set(
          p.category_attributes,
          '{quick,ekip_boyutu}',
          '"Grup 4+"'::jsonb,
          false  -- create_missing = false: anahtar yoksa dokunma
        )
  WHERE p.category_attributes->'quick'->>'ekip_boyutu' = 'Grup (4+)';

  GET DIAGNOSTICS touched = ROW_COUNT;
  RAISE NOTICE 'ekip_boyutu ''Grup (4+)'' → ''Grup 4+'': % satır', touched;
END $$;

COMMIT;

-- =============================================================================
-- DOĞRULAMA (elle çalıştır)
-- =============================================================================
--
-- 1) Eski değer kalmış mı? Beklenen: 0 satır.
--
--    SELECT id FROM public.profiles
--    WHERE category_attributes->'quick'->>'ekip_boyutu' = 'Grup (4+)';
--
-- 2) Ekip boyutu dağılımı — yalnız Solo / Duo / Trio / Grup 4+ görünmeli.
--
--    SELECT category_attributes->'quick'->>'ekip_boyutu' AS ekip, count(*)
--    FROM public.profiles
--    WHERE category_attributes->'quick' ? 'ekip_boyutu'
--    GROUP BY 1 ORDER BY 2 DESC;
--
-- 3) Filtre eşleşiyor mu?
--
--    SELECT id FROM public.profiles
--    WHERE category_attributes @> '{"quick":{"ekip_boyutu":"Grup 4+"}}';
