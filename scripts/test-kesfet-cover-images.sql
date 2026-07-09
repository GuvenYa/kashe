-- ============================================================================
-- TEST VERİSİ — Keşfet kart kapak görselleri (profiles.avatar_url) atama
--
-- ⚠️ TEST VERİSİ — launch öncesi bu profiller ve görsel atamaları SİLİNECEK.
--    (En altta GERİ ALMA bloğu var.)
--
-- Amaç: Keşfet'teki "placeholder çölünü" gidermek. Avatar'ı olmayan YAYINDA
-- pro/ajans profillerine public/images/hero/*.webp (ve public/hero/pro-*.jpg)
-- görsellerini atar. Kart bileşeni <img src> ile relative path render eder
-- (Supabase Storage ŞART DEĞİL) — o yüzden '/images/hero/x.webp' gibi yollar
-- doğrudan çalışır.
--
-- Sıra: (1) kategoriye uygun tema görseli (DJ→dj görseli, Fotoğraf→foto vb.),
--       (2) kalanlara sırayla (döngüsel).
-- Idempotent: yalnız avatar_url IS NULL olanlar güncellenir → tekrar çalıştırmak
--             güvenli (zaten atanmışa dokunmaz).
--
-- ÇALIŞTIRMA: Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) KATEGORİ-TERCİHLİ atama — eşleşen kategorideki avatar'sız profillere,
--    kategori içinde döngüsel (round-robin) tema görseli.
--    Eşleşme: lower(slug + ' ' + name_tr) LIKE desen (desenler ayrık seçildi).
-- ----------------------------------------------------------------------------
WITH mapping AS (
  SELECT * FROM (VALUES
    ('%dj%',           ARRAY['/images/hero/dj-mertkan.webp','/images/hero/dj-02.webp']),
    ('%foto%',         ARRAY['/images/hero/ece-yildiz.webp','/images/hero/selin-aksoy.webp','/images/hero/dugun-01.webp','/images/hero/dugun-02.webp']),
    ('%müzik%',        ARRAY['/images/hero/vibes-band.webp','/images/hero/hero-event.webp','/images/hero/konser-01.webp','/images/hero/konser-02.webp']),
    ('%dans%',         ARRAY['/images/hero/dans-01.webp']),
    ('%sunucu%',       ARRAY['/images/hero/sahne-01.webp','/images/hero/sahne-02.webp']),
    ('%organizasyon%', ARRAY['/images/hero/parti-01.webp','/images/hero/parti-02.webp','/images/hero/parti-03.webp'])
  ) AS m(pat, urls)
),
matched AS (
  SELECT DISTINCT ON (p.id)
         p.id,
         m.urls,
         (row_number() OVER (PARTITION BY m.pat ORDER BY p.created_at, p.id) - 1) AS rn
  FROM profiles p
  JOIN service_categories sc ON sc.id = p.primary_category_id
  JOIN mapping m
    ON lower(coalesce(sc.slug, '') || ' ' || coalesce(sc.name_tr, '')) LIKE m.pat
  WHERE p.is_published = true
    AND p.role IN ('professional', 'agency')
    AND p.avatar_url IS NULL
  ORDER BY p.id, m.pat
)
UPDATE profiles pr
SET avatar_url = mt.urls[(mt.rn % array_length(mt.urls, 1)) + 1]
FROM matched mt
WHERE pr.id = mt.id;

-- ----------------------------------------------------------------------------
-- 2) SIRAYLA (fallback) — hâlâ avatar'sız kalan pro/ajans profillerine, genel
--    etkinlik görsellerinden döngüsel (kategori eşleşmeyenler için).
-- ----------------------------------------------------------------------------
WITH imgs AS (
  SELECT ord, url FROM (VALUES
    (0,  '/images/hero/parti-01.webp'),
    (1,  '/images/hero/parti-02.webp'),
    (2,  '/images/hero/parti-03.webp'),
    (3,  '/images/hero/konser-01.webp'),
    (4,  '/images/hero/konser-02.webp'),
    (5,  '/images/hero/sahne-01.webp'),
    (6,  '/images/hero/sahne-02.webp'),
    (7,  '/images/hero/isik-01.webp'),
    (8,  '/images/hero/hero-event.webp'),
    (9,  '/images/hero/dans-01.webp'),
    (10, '/hero/pro-1.jpg'),
    (11, '/hero/pro-2.jpg'),
    (12, '/hero/pro-3.jpg'),
    (13, '/hero/pro-4.jpg')
  ) AS t(ord, url)
),
img_count AS (SELECT count(*)::int AS n FROM imgs),
targets AS (
  SELECT p.id,
         (row_number() OVER (ORDER BY p.created_at, p.id) - 1) AS rn
  FROM profiles p
  WHERE p.is_published = true
    AND p.role IN ('professional', 'agency')
    AND p.avatar_url IS NULL
)
UPDATE profiles pr
SET avatar_url = i.url
FROM targets t
CROSS JOIN img_count c
JOIN imgs i ON i.ord = (t.rn % c.n)
WHERE pr.id = t.id;

COMMIT;

-- ============================================================================
-- GERİ ALMA — TEST TEMİZLİĞİ (launch öncesi çalıştır): yalnız bu script'in
-- yazdığı test görsellerini (/images/hero/… veya /hero/pro-…) null'a çeker.
-- Gerçek yüklenmiş avatarlara (Storage URL'leri) DOKUNMAZ.
-- ----------------------------------------------------------------------------
-- BEGIN;
-- UPDATE profiles
--   SET avatar_url = NULL
--   WHERE avatar_url LIKE '/images/hero/%'
--      OR avatar_url LIKE '/hero/pro-%';
-- COMMIT;
-- ============================================================================
