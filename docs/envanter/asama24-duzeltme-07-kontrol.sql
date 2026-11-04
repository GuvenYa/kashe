-- =============================================================================
-- Duzeltme 07 / Asama 24 - Turkce harf duyarsiz arama kontrolu (SALT OKUNUR; dalda ve URETIMDE)
-- Kaynak: supabase/migrations/20261105150000_duzeltme_07_turkce_arama.sql
--   K1 yapi (5): tr_katla var (1) + IMMUTABLE (1) + ornek katlama dogru (1) + v_providers_public son sutunu arama_metni (1)
--      + gorunum security_invoker (1)
--   K2 katlanmamis harf: gorunurdeki arama_metni icinde Turkce ya da sapkali harf kalan satir (0)
--   K3 bilgi: gorunur saglayici (eski) / arama_metni bos olan (yeni)
--   Duzeltme 07 uygulanmamissa hepsi BEKLIYOR.
-- Beklenen: K1, K2 ESIT; K3 BILGI.
-- =============================================================================

WITH
var AS (SELECT to_regprocedure('public.tr_katla(text)') AS fn,
               EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.v_providers_public'::regclass
                          AND attname = 'arama_metni' AND NOT attisdropped) AS sutun),
k1 AS (
  SELECT 'K1 yapi: tr_katla + IMMUTABLE + ornek katlama + arama_metni son sutun + security_invoker (5)' AS kontrol,
         ((v.fn IS NOT NULL)::int
          + COALESCE((SELECT (provolatile = 'i')::int FROM pg_proc WHERE oid = v.fn), 0)
          + COALESCE((CASE WHEN v.fn IS NULL THEN NULL
                           ELSE (xpath('/row/n/text()', query_to_xml(
                                  'SELECT (public.tr_katla(U&''\00C7a\011Fr\0131 I\015F\0131k \0130zmir \00D6z\00FCm'') = ''cagri isik izmir ozum'')::int AS n',
                                  false, true, '')))[1]::text::int END), 0)
          + COALESCE((SELECT (attname = 'arama_metni')::int FROM pg_attribute
                       WHERE attrelid = 'public.v_providers_public'::regclass AND attnum > 0 AND NOT attisdropped
                       ORDER BY attnum DESC LIMIT 1), 0)
          + (SELECT ('security_invoker=true' = ANY(COALESCE(reloptions, '{}')))::int FROM pg_class
              WHERE oid = 'public.v_providers_public'::regclass))::bigint AS eski,
         5::bigint AS yeni
    FROM var v
),
k2 AS (
  SELECT 'K2 katlanmamis harf: gorunur satirda arama_metni Turkce / sapkali harf iceren (0)' AS kontrol,
         (CASE WHEN NOT v.sutun THEN NULL ELSE (xpath('/row/n/text()', query_to_xml(
            'SELECT count(*) AS n FROM public.v_providers_public WHERE is_visible
               AND arama_metni ~ U&''[\00C7\00E7\011E\011F\0130\0131\00D6\00F6\015E\015F\00DC\00FC\00C2\00E2\00CE\00EE\00DB\00FB]''',
            false, true, '')))[1]::text::bigint END),
         0::bigint
    FROM var v
),
k3 AS (
  SELECT 'K3 gorunur saglayici (eski) / arama_metni bos (yeni) (bilgi)' AS kontrol,
         (SELECT count(*) FROM public.v_providers_public WHERE is_visible)::bigint,
         (CASE WHEN NOT v.sutun THEN NULL ELSE (xpath('/row/n/text()', query_to_xml(
            'SELECT count(*) AS n FROM public.v_providers_public WHERE is_visible AND COALESCE(arama_metni, '''') = ''''',
            false, true, '')))[1]::text::bigint END)
    FROM var v
),
hepsi AS (SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3)
SELECT h.kontrol, h.eski, h.yeni, abs(h.eski - h.yeni) AS fark,
       CASE WHEN (SELECT fn FROM var) IS NULL OR NOT (SELECT sutun FROM var) THEN 'BEKLIYOR'
            WHEN h.kontrol LIKE 'K3 %' THEN 'BILGI'
            WHEN h.eski = h.yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi h;
