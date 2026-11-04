-- =============================================================================
-- Duzeltme 06 / Asama 23 - girissiz Kashe AI hakki kontrolu (SALT OKUNUR; dalda ve URETIMDE)
-- Kaynak: supabase/migrations/20261105140000_duzeltme_06_girissiz_ai_hakki.sql
--   K1 yapi (10): internal.ai_girissiz_ayar / _kullanim / _gun (3) + ai_girissiz_hak_kullan var (1) + SECURITY DEFINER (1)
--      + anon EXECUTE (1) + authenticated EXECUTE (1) + PUBLIC EXECUTE yok (1) + anon internal sema USAGE yok (1)
--      + ayar satiri tek ve anahtar ozeti 64 hex (1)
--   K2 bilgi: sinirlar - IP basina gunluk (eski) / gunluk toplam (yeni); karar 3 / 300, 0 = kapali
--   K3 bilgi: bugun (Europe/Istanbul) kullanilan hak (eski) / reddedilen cagri (yeni)
--   K4 bilgi: son 7 gun kullanilan hak (eski) / farkli IP ozeti (yeni; ozet gunden gune degisir, gun-IP cifti sayilir)
--   K5 saklama: 30 gunden eski kullanim satiri (0)
--   Duzeltme 06 uygulanmamissa hepsi BEKLIYOR.
-- Beklenen: K1, K5 ESIT; K2, K3, K4 BILGI. Maliyet izlemesi: K3 / K4 gunluk bakilir (karar: maliyet artarsa sinir degisir).
-- =============================================================================

WITH
var AS (SELECT to_regprocedure('public.ai_girissiz_hak_kullan(text, text)') AS fn,
               to_regclass('internal.ai_girissiz_ayar') AS ayar,
               to_regclass('internal.ai_girissiz_kullanim') AS kullanim,
               to_regclass('internal.ai_girissiz_gun') AS gun,
               (now() AT TIME ZONE 'Europe/Istanbul')::date AS bugun),
k1 AS (
  SELECT 'K1 yapi: 3 tablo + RPC + definer + anon/authenticated EXECUTE + PUBLIC yok + internal kapali + ayar satiri (10)' AS kontrol,
         ((v.ayar IS NOT NULL)::int + (v.kullanim IS NOT NULL)::int + (v.gun IS NOT NULL)::int
          + (v.fn IS NOT NULL)::int
          + COALESCE((SELECT prosecdef::int FROM pg_proc WHERE oid = v.fn), 0)
          + COALESCE((SELECT has_function_privilege('anon', v.fn, 'EXECUTE')::int WHERE v.fn IS NOT NULL), 0)
          + COALESCE((SELECT has_function_privilege('authenticated', v.fn, 'EXECUTE')::int WHERE v.fn IS NOT NULL), 0)
          + COALESCE((SELECT (NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
                                           WHERE p.oid = v.fn AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'))::int
                       WHERE v.fn IS NOT NULL), 0)
          + (NOT has_schema_privilege('anon', 'internal', 'USAGE'))::int
          + COALESCE((CASE WHEN v.ayar IS NULL THEN NULL
                           ELSE (xpath('/row/n/text()', query_to_xml(
                                  'SELECT (count(*) = 1 AND bool_and(anahtar_ozeti ~ ''^[0-9a-f]{64}$''))::int AS n FROM internal.ai_girissiz_ayar',
                                  false, true, '')))[1]::text::int END), 0))::bigint AS eski,
         10::bigint AS yeni
    FROM var v
),
k2 AS (
  SELECT 'K2 sinirlar: IP basina gunluk (eski) / gunluk toplam (yeni) (bilgi; karar 3 / 300)' AS kontrol,
         (CASE WHEN v.ayar IS NULL THEN NULL ELSE (xpath('/row/n/text()', query_to_xml(
            'SELECT COALESCE(max(ip_gunluk), -1) AS n FROM internal.ai_girissiz_ayar', false, true, '')))[1]::text::bigint END),
         (CASE WHEN v.ayar IS NULL THEN NULL ELSE (xpath('/row/n/text()', query_to_xml(
            'SELECT COALESCE(max(toplam_gunluk), -1) AS n FROM internal.ai_girissiz_ayar', false, true, '')))[1]::text::bigint END)
    FROM var v
),
k3 AS (
  SELECT 'K3 bugun: kullanilan hak (eski) / reddedilen cagri (yeni) (bilgi)' AS kontrol,
         (CASE WHEN v.gun IS NULL THEN NULL ELSE COALESCE((xpath('/row/n/text()', query_to_xml(
            format('SELECT COALESCE(max(adet), 0) AS n FROM internal.ai_girissiz_gun WHERE gun = %L', v.bugun), false, true, '')))[1]::text::bigint, 0) END),
         (CASE WHEN v.gun IS NULL THEN NULL ELSE COALESCE((xpath('/row/n/text()', query_to_xml(
            format('SELECT COALESCE(max(reddedilen), 0) AS n FROM internal.ai_girissiz_gun WHERE gun = %L', v.bugun), false, true, '')))[1]::text::bigint, 0) END)
    FROM var v
),
k4 AS (
  SELECT 'K4 son 7 gun: kullanilan hak (eski) / gun-IP ozeti cifti (yeni) (bilgi)' AS kontrol,
         (CASE WHEN v.kullanim IS NULL THEN NULL ELSE (xpath('/row/n/text()', query_to_xml(
            format('SELECT COALESCE(sum(adet), 0) AS n FROM internal.ai_girissiz_kullanim WHERE gun > %L::date - 7', v.bugun),
            false, true, '')))[1]::text::bigint END),
         (CASE WHEN v.kullanim IS NULL THEN NULL ELSE (xpath('/row/n/text()', query_to_xml(
            format('SELECT count(*) AS n FROM internal.ai_girissiz_kullanim WHERE gun > %L::date - 7', v.bugun),
            false, true, '')))[1]::text::bigint END)
    FROM var v
),
k5 AS (
  SELECT 'K5 saklama: 30 gunden eski kullanim satiri (0)' AS kontrol,
         (CASE WHEN v.kullanim IS NULL THEN NULL ELSE (xpath('/row/n/text()', query_to_xml(
            format('SELECT count(*) AS n FROM internal.ai_girissiz_kullanim WHERE gun < %L::date - 30', v.bugun),
            false, true, '')))[1]::text::bigint END),
         0::bigint
    FROM var v
),
hepsi AS (
  SELECT * FROM k1 UNION ALL SELECT * FROM k2 UNION ALL SELECT * FROM k3 UNION ALL SELECT * FROM k4 UNION ALL SELECT * FROM k5
)
SELECT h.kontrol, h.eski, h.yeni, abs(h.eski - h.yeni) AS fark,
       CASE WHEN (SELECT fn FROM var) IS NULL THEN 'BEKLIYOR'
            WHEN h.kontrol LIKE 'K2 %' OR h.kontrol LIKE 'K3 %' OR h.kontrol LIKE 'K4 %' THEN 'BILGI'
            WHEN h.eski = h.yeni THEN 'ESIT' ELSE 'FARK' END AS durum
  FROM hepsi h;
