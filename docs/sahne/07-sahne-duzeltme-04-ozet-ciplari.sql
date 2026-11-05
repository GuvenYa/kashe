-- =============================================================================
-- SAHNE DUZELTME 04 - bulgu 78 (Fahri #11): uzmanlik ozet bandi cipleri nesne -> metin
--
-- Neden: Sahne ureteci (uret.py v3) `category_attributes.summary.stats` alanini
-- [{"label": "Yil", "value": "8"}, ...] olarak yazdi. Uygulama (profil duzenleyici
-- `app/profil/kategori-bilgileri` ve kamu profili) bu alani DUZ METIN dizisi
-- (string[]) olarak bekliyor; nesne React cocugu olarak cizilince kamu profili
-- istemcide "This page couldn't load" ile cokuyor (React #31). Etkilenen: ozet
-- bandi cizilen uzmanlik kategorileri (tercuman, konusmaci, etkinlik-koordinatoru;
-- influencer ve karikaturist portfoy izgarasi kullandigi icin bandi cizmez ama
-- veri ayni sekilde duzeltilir) - Sahne'de 20 saglayici.
--
-- Ne yapar: yalniz Sahne saglayicilarinda (id '5a4e%') nesne olan her cipi
-- duz metne cevirir: Yil -> "<n> yil deneyim", Etkinlik -> "<n> etkinlik",
-- Sehir -> "<n> sehir", diger -> "<deger> <etiket>". Metin olan cip DEGISMEZ.
-- Kaynak `providers`; ters ayna tetikleyicisi profiles kopyasini esitler.
-- Tekrar calistirmak guvenli (ikinci kosuda 0 satir).
--
-- YALNIZ DAL (ukqhgspaallzjscjodbb) - Sahne verisi. Uretimde CALISTIRILMAZ.
-- Kosum: Dashboard > SQL Editor (dal) - tamami tek seferde.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_db text := current_database();
  v_once int;
  v_sonra int;
  v_kopya int;
BEGIN
  -- Guvenlik: Sahne yonetici hesabi yoksa (uretim ya da bos dal) dur.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '5a4e0000-0000-4000-8000-000000090001') THEN
    RAISE EXCEPTION 'Sahne yonetici hesabi yok - bu dosya yalniz Sahne verisi yuklu dalda calisir (db: %)', v_db;
  END IF;

  SELECT count(*) INTO v_once FROM public.providers
   WHERE id::text LIKE '5a4e%'
     AND jsonb_typeof(category_attributes->'summary'->'stats') = 'array'
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(category_attributes->'summary'->'stats') e
                  WHERE jsonb_typeof(e) = 'object');

  -- Saglayici yazimi Sahne yoneticisi kimligiyle (01a ile ayni yol).
  PERFORM set_config('request.jwt.claim.sub', '5a4e0000-0000-4000-8000-000000090001', true);

  UPDATE public.providers pr
     SET category_attributes = jsonb_set(
           pr.category_attributes,
           '{summary,stats}',
           (SELECT coalesce(jsonb_agg(
                     CASE WHEN jsonb_typeof(x.e) = 'object' THEN
                       to_jsonb(
                         CASE x.e->>'label'
                           WHEN 'Yıl'      THEN (x.e->>'value') || ' yıl deneyim'
                           WHEN 'Etkinlik' THEN (x.e->>'value') || ' etkinlik'
                           WHEN 'Şehir'    THEN (x.e->>'value') || ' şehir'
                           ELSE trim(coalesce(x.e->>'value', '') || ' ' || coalesce(x.e->>'label', ''))
                         END)
                     ELSE x.e END
                     ORDER BY x.ord), '[]'::jsonb)
              FROM jsonb_array_elements(pr.category_attributes->'summary'->'stats')
                   WITH ORDINALITY AS x(e, ord)))
   WHERE pr.id::text LIKE '5a4e%'
     AND jsonb_typeof(pr.category_attributes->'summary'->'stats') = 'array'
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(pr.category_attributes->'summary'->'stats') e
                  WHERE jsonb_typeof(e) = 'object');

  PERFORM set_config('request.jwt.claim.sub', '', true);

  SELECT count(*) INTO v_sonra FROM public.providers
   WHERE id::text LIKE '5a4e%'
     AND jsonb_typeof(category_attributes->'summary'->'stats') = 'array'
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(category_attributes->'summary'->'stats') e
                  WHERE jsonb_typeof(e) = 'object');

  -- profiles kopyasi (FAZ 11'e kadar) ayni olmali
  SELECT count(*) INTO v_kopya FROM public.providers pr JOIN public.profiles p ON p.id = pr.id
   WHERE pr.id::text LIKE '5a4e%'
     AND p.category_attributes IS DISTINCT FROM pr.category_attributes;

  IF v_sonra <> 0 THEN
    RAISE EXCEPTION 'Nesne cip kaldi: % saglayici', v_sonra;
  END IF;
  IF v_kopya <> 0 THEN
    RAISE EXCEPTION 'profiles kopyasi esit degil: % satir', v_kopya;
  END IF;

  RAISE NOTICE 'ozet cipleri: % saglayici duzeltildi, kalan nesne 0, profiles kopyasi esit', v_once;
END $$;

-- Sonuc (SQL Editor tabloda gosterir): duzeltilen ciplerden ornek
SELECT p.full_name, sc.slug AS kategori, pr.category_attributes->'summary'->'stats' AS cipler
  FROM public.providers pr
  JOIN public.profiles p ON p.id = pr.id
  LEFT JOIN public.service_categories sc ON sc.id = p.primary_category_id
 WHERE pr.id::text LIKE '5a4e%' AND pr.category_attributes ? 'summary'
 ORDER BY sc.slug, p.full_name
 LIMIT 8;

COMMIT;
