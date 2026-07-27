-- DİLLER: SERBEST METİN → KAPALI SÖZLÜK (app/lib/category-fields.ts LANGUAGE_OPTIONS)
--
-- NEDEN: modules.diller_belgeler.language_pairs bugüne dek SERBEST METİN girişiydi
-- ("Türkçe", "türkçe", "TR ↔ EN", "ingilizce"...). Dalga 0'da bu alan keşfet
-- filtresine bağlandı (stand-up-komedyen, tercuman). Filtre jsonb containment ile
-- BİREBİR string eşitliği arar → "türkçe" yazan profil "Türkçe" filtresinde
-- GÖRÜNMEZ. Serbest metin, filtreyle veriyi ayrıştırır.
--
-- VERİ ŞEKLİ: düz dil listesi (string[]), dil ÇİFTİ DEĞİL. "TR ↔ EN" gibi çift
-- ifadeler PARÇALANIR → ["Türkçe","İngilizce"]. Gerekçe: 18 dilde çift modellemesi
-- 306 yön üretir; filtrenin sorduğu soru "hangi dilleri biliyor".
--
-- VERİ KAYBI YOK: bir eleman TAMAMEN eşlenemezse ORİJİNAL HÂLİYLE bırakılır ve
-- RAISE NOTICE ile raporlanır. Kısmi eşleme yapılmaz (yarım veri üretmez).
--
-- İDEMPOTENT: sözlükte olan değer aynen döner; ikinci çalıştırma hiçbir satırı
-- değiştirmez (to_jsonb(...) IS DISTINCT FROM karşılaştırması).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Kanonik sözlük — LANGUAGE_OPTIONS ile BİREBİR (18 değer)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _lang_dict (v text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _lang_dict (v) VALUES
  ('Türkçe'), ('İngilizce'), ('Almanca'), ('Fransızca'), ('Arapça'), ('Rusça'),
  ('İspanyolca'), ('İtalyanca'), ('Rumca'), ('Farsça'), ('Çince'), ('Japonca'),
  ('Korece'), ('Ukraynaca'), ('Bulgarca'), ('Gürcüce'), ('Kürtçe'),
  ('Azerbaycan Türkçesi');

-- ---------------------------------------------------------------------------
-- 2) Eşleme sözlüğü — normalize edilmiş anahtar → kanonik değer
--    (isim varyantları, İngilizce adlar, ISO kodları, yaygın kısaltmalar)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _lang_map (src text PRIMARY KEY, dst text NOT NULL) ON COMMIT DROP;
INSERT INTO _lang_map (src, dst) VALUES
  ('turkce','Türkçe'), ('turkish','Türkçe'), ('tr','Türkçe'), ('tur','Türkçe'), ('trk','Türkçe'),
  ('ingilizce','İngilizce'), ('english','İngilizce'), ('en','İngilizce'), ('eng','İngilizce'), ('ing','İngilizce'),
  ('almanca','Almanca'), ('german','Almanca'), ('de','Almanca'), ('ger','Almanca'), ('deu','Almanca'), ('alm','Almanca'),
  ('fransizca','Fransızca'), ('french','Fransızca'), ('fr','Fransızca'), ('fra','Fransızca'),
  ('arapca','Arapça'), ('arabic','Arapça'), ('ar','Arapça'), ('ara','Arapça'),
  ('rusca','Rusça'), ('russian','Rusça'), ('ru','Rusça'), ('rus','Rusça'),
  ('ispanyolca','İspanyolca'), ('spanish','İspanyolca'), ('es','İspanyolca'), ('spa','İspanyolca'), ('isp','İspanyolca'),
  ('italyanca','İtalyanca'), ('italian','İtalyanca'), ('it','İtalyanca'), ('ita','İtalyanca'),
  ('rumca','Rumca'), ('yunanca','Rumca'), ('greek','Rumca'), ('el','Rumca'), ('gr','Rumca'),
  ('farsca','Farsça'), ('persian','Farsça'), ('farsi','Farsça'), ('fa','Farsça'),
  ('cince','Çince'), ('chinese','Çince'), ('mandarin','Çince'), ('zh','Çince'),
  ('japonca','Japonca'), ('japanese','Japonca'), ('ja','Japonca'), ('jp','Japonca'),
  ('korece','Korece'), ('korean','Korece'), ('ko','Korece'), ('kr','Korece'),
  ('ukraynaca','Ukraynaca'), ('ukrainian','Ukraynaca'), ('uk','Ukraynaca'), ('ukr','Ukraynaca'),
  ('bulgarca','Bulgarca'), ('bulgarian','Bulgarca'), ('bg','Bulgarca'), ('bul','Bulgarca'),
  ('gurcuce','Gürcüce'), ('georgian','Gürcüce'), ('ka','Gürcüce'), ('geo','Gürcüce'),
  ('kurtce','Kürtçe'), ('kurdish','Kürtçe'), ('ku','Kürtçe'), ('kur','Kürtçe'),
  ('azerbaycan turkcesi','Azerbaycan Türkçesi'), ('azerice','Azerbaycan Türkçesi'),
  ('azerbaycanca','Azerbaycan Türkçesi'), ('azeri','Azerbaycan Türkçesi'),
  ('azerbaijani','Azerbaycan Türkçesi'), ('az','Azerbaycan Türkçesi');

-- ---------------------------------------------------------------------------
-- 3) Normalizasyon — Türkçe-duyarlı.
--    'İ'/'I'/'ı' → 'i' ÖNCE yapılır: lower('İ') İngilizce locale'de birleşik
--    nokta bırakır ve eşleşmeyi bozar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp._norm_lang(v text) RETURNS text AS $fn$
  SELECT btrim(regexp_replace(
    regexp_replace(
      translate(
        lower(translate(v, 'İIı', 'iii')),
        'çğöşüâîû', 'cgosuaiu'
      ),
      '[^a-z ]+', ' ', 'g'
    ),
    ' +', ' ', 'g'
  ));
$fn$ LANGUAGE sql IMMUTABLE;

DO $$
DECLARE
  r          record;
  elem       text;
  token      text;
  mapped     text;
  elem_out   text[];
  all_ok     boolean;
  new_langs  text[];
  unmapped   text[] := '{}';
  touched    integer := 0;
BEGIN
  FOR r IN
    SELECT
      id,
      category_attributes->'modules'->'diller_belgeler'->'language_pairs' AS langs
    FROM public.profiles
    WHERE jsonb_typeof(
            category_attributes->'modules'->'diller_belgeler'->'language_pairs'
          ) = 'array'
      AND jsonb_array_length(
            category_attributes->'modules'->'diller_belgeler'->'language_pairs'
          ) > 0
  LOOP
    new_langs := '{}';

    FOR elem IN SELECT jsonb_array_elements_text(r.langs) LOOP
      CONTINUE WHEN btrim(coalesce(elem, '')) = '';

      -- (a) Zaten kanonik → aynen koru (idempotenslik buradan gelir)
      IF EXISTS (SELECT 1 FROM _lang_dict d WHERE d.v = elem) THEN
        new_langs := array_append(new_langs, elem);
        CONTINUE;
      END IF;

      -- (b) Çift/liste ifadesini parçala: "TR ↔ EN", "Türkçe/İngilizce", "TR - EN"
      elem_out := '{}';
      all_ok   := true;

      FOR token IN
        SELECT btrim(t)
        FROM regexp_split_to_table(elem, '(↔|<->|->|<-|[/,;|–—]|\s+-\s+)') AS t
        WHERE btrim(t) <> ''
      LOOP
        SELECT m.dst INTO mapped
        FROM _lang_map m
        WHERE m.src = pg_temp._norm_lang(token);

        IF mapped IS NULL THEN
          all_ok := false;
          EXIT;                      -- kısmi eşleme YAPMA
        END IF;
        elem_out := array_append(elem_out, mapped);
      END LOOP;

      IF all_ok AND array_length(elem_out, 1) IS NOT NULL THEN
        new_langs := new_langs || elem_out;
      ELSE
        -- (c) Eşlenemedi → ORİJİNALİ KORU + raporla (veri kaybı yok)
        new_langs := array_append(new_langs, elem);
        IF NOT (elem = ANY(unmapped)) THEN
          unmapped := array_append(unmapped, elem);
        END IF;
      END IF;
    END LOOP;

    -- Tekrarları ele, ilk görülme sırasını koru
    SELECT array_agg(x ORDER BY first_ord)
      INTO new_langs
    FROM (
      SELECT x, min(ord) AS first_ord
      FROM unnest(new_langs) WITH ORDINALITY AS u(x, ord)
      GROUP BY x
    ) s;

    IF to_jsonb(new_langs) IS DISTINCT FROM r.langs THEN
      UPDATE public.profiles
      SET category_attributes = jsonb_set(
            category_attributes,
            '{modules,diller_belgeler,language_pairs}',
            to_jsonb(new_langs),
            false                    -- create_missing = false
          )
      WHERE id = r.id;
      touched := touched + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'language_pairs sözlüğe taşındı: % profil güncellendi', touched;

  IF array_length(unmapped, 1) IS NOT NULL THEN
    RAISE NOTICE 'EŞLENEMEYEN % farklı değer (orijinal hâliyle KORUNDU): %',
      array_length(unmapped, 1), array_to_string(unmapped, ' | ');
    RAISE NOTICE 'Bu değerler filtrede eşleşmez. Ya LANGUAGE_OPTIONS''a eklenmeli ya da profil sahibi yeniden seçmeli.';
  ELSE
    RAISE NOTICE 'Eşlenemeyen değer yok.';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- DOĞRULAMA (elle çalıştır — migration'ın parçası değil)
-- =============================================================================
--
-- 1) Sözlük DIŞINDA kalan değerler. Beklenen: 0 satır (varsa RAISE NOTICE'takiler).
--
--    SELECT p.id, lang
--    FROM public.profiles p,
--         LATERAL jsonb_array_elements_text(
--           p.category_attributes->'modules'->'diller_belgeler'->'language_pairs'
--         ) AS lang
--    WHERE jsonb_typeof(p.category_attributes->'modules'->'diller_belgeler'->'language_pairs') = 'array'
--      AND lang NOT IN ('Türkçe','İngilizce','Almanca','Fransızca','Arapça','Rusça',
--                       'İspanyolca','İtalyanca','Rumca','Farsça','Çince','Japonca',
--                       'Korece','Ukraynaca','Bulgarca','Gürcüce','Kürtçe',
--                       'Azerbaycan Türkçesi');
--
-- 2) Dil dağılımı — hangi dil kaç profilde.
--
--    SELECT lang, count(*) AS profil
--    FROM public.profiles p,
--         LATERAL jsonb_array_elements_text(
--           p.category_attributes->'modules'->'diller_belgeler'->'language_pairs'
--         ) AS lang
--    GROUP BY lang ORDER BY profil DESC;
--
-- 3) Çift ifadesi kalmış mı? Beklenen: 0 satır.
--
--    SELECT p.id, lang
--    FROM public.profiles p,
--         LATERAL jsonb_array_elements_text(
--           p.category_attributes->'modules'->'diller_belgeler'->'language_pairs'
--         ) AS lang
--    WHERE lang ~ '(↔|<->|->|<-|/)';
--
-- 4) Filtre fiilen eşleşiyor mu? (module yolu containment testi)
--
--    SELECT id FROM public.profiles
--    WHERE category_attributes @> '{"modules":{"diller_belgeler":{"language_pairs":["Türkçe"]}}}';
