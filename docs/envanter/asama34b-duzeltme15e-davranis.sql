-- =============================================================================
-- ASAMA 34b - Duzeltme 15-E DAVRANIS testi - YALNIZ DAL (Sahne verisi gerekir)
--
-- Tek islem, sonda ROLLBACK: hicbir sey kalici yazilmaz. URETIMDE CALISTIRILMAZ.
-- Sinanan: "ajansim uzerinden teklif" tercihi (org_member_set_offer_routing),
-- tutarlilik tetikleyicisi ve talebin gidecegi ajansi donduren okuma yolu
-- (fn_duz15_teklif_yonlendirme).
-- Fikstur SABIT DEGIL: dalda acik ekipte gorunen bir ajans uyesi secilir;
-- ikinci ajans uyeligi islemin icinde eklenir (ROLLBACK ile gider).
-- Sonuc tablosunda hepsi GECTI olmali (14 test).
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '5a4e0000-0000-4000-8000-000000090001') THEN
    RAISE EXCEPTION 'Sahne verisi yok - bu test yalniz dalda calisir';
  END IF;
END $$;

CREATE TEMP TABLE sonuc (sira int, test text, beklenen text, gercek text) ON COMMIT DROP;
GRANT ALL ON sonuc TO anon, authenticated;
CREATE TEMP TABLE fx (ad text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON fx TO anon, authenticated;

CREATE FUNCTION pg_temp.kimlik(p uuid) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  IF p IS NULL THEN
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
  ELSE
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', p::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
  END IF;
END $f$;

CREATE FUNCTION pg_temp.anonim() RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'SET LOCAL ROLE anon';
END $f$;

CREATE FUNCTION pg_temp.fx(p text) RETURNS uuid LANGUAGE sql AS $f$ SELECT id FROM fx WHERE ad = p $f$;

-- Bakan olarak tek deger donduren sorgu: deger (metin) / ENGEL (hata).
-- p_bakan NULL ise girissiz (anon).
CREATE FUNCTION pg_temp.sor(p_bakan uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  r text;
BEGIN
  IF p_bakan IS NULL THEN
    PERFORM pg_temp.anonim();
  ELSE
    PERFORM pg_temp.kimlik(p_bakan);
  END IF;
  BEGIN
    EXECUTE p_sql INTO r;
    r := COALESCE(r, 'BOS');
  EXCEPTION WHEN OTHERS THEN r := 'ENGEL';
  END;
  PERFORM pg_temp.kimlik(NULL);
  RETURN r;
END $f$;

-- Yonetici gozuyle: kullanicinin tercihi acik uyeliklerinin kuruluslari
CREATE FUNCTION pg_temp.acik(p_uye uuid) RETURNS text LANGUAGE sql AS $f$
  SELECT COALESCE(string_agg(organization_id::text, ',' ORDER BY organization_id::text), 'YOK')
    FROM public.organization_memberships
   WHERE user_id = p_uye AND offers_via_agency
$f$;

-- ---------------------------------------------------------------- fikstur
DO $$
DECLARE
  v_uye uuid;
  v_org uuid;
  v_ajans uuid;
  v_org2 uuid;
  v_seed uuid;
  v_yabanci uuid;
  v_kurum uuid;
  v_kurum_uyesi uuid;
BEGIN
  -- Acik ekipte gorunen, TEK ajansa bagli profesyonel uye + ajansi
  SELECT t.user_id, t.organization_id, t.agency_id INTO v_uye, v_org, v_ajans
    FROM public.organization_team_public t
    JOIN public.profiles p ON p.id = t.user_id AND p.role = 'professional'
   WHERE (SELECT count(*) FROM public.organization_memberships om WHERE om.user_id = t.user_id) = 1
   ORDER BY t.user_id
   LIMIT 1;

  -- Ikinci ajans (uyenin uye OLMADIGI); uyelik islem icinde eklenir
  SELECT o.id INTO v_org2
    FROM public.organizations o
   WHERE o.account_type = 'agency' AND o.id <> v_org
   ORDER BY o.id
   LIMIT 1;
  INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
  VALUES (v_org2, v_uye, 'viewer', 'active');

  -- Ajansin kendi hesabi (owner_seed)
  SELECT om.user_id INTO v_seed
    FROM public.organization_memberships om
   WHERE om.organization_id = v_org AND om.legacy_source = 'owner_seed'
   LIMIT 1;

  -- Bu ajansin uyesi olmayan bir profesyonel
  SELECT p.id INTO v_yabanci
    FROM public.profiles p
   WHERE p.role = 'professional' AND p.id::text LIKE '5a4e0000-0000-4000-8000-00000001%'
     AND NOT EXISTS (SELECT 1 FROM public.organization_memberships om
                      WHERE om.user_id = p.id AND om.organization_id IN (v_org, v_org2))
   ORDER BY p.id
   LIMIT 1;

  -- Kurum (business) kurulusu ve aktif uyesi (kurulusun kendi hesabi haric)
  SELECT o.id, om.user_id INTO v_kurum, v_kurum_uyesi
    FROM public.organization_memberships om
    JOIN public.organizations o ON o.id = om.organization_id
   WHERE o.account_type = 'business' AND om.status = 'active'
     AND om.legacy_source IS DISTINCT FROM 'owner_seed'
   ORDER BY om.user_id
   LIMIT 1;

  INSERT INTO fx VALUES ('uye', v_uye), ('org', v_org), ('ajans', v_ajans), ('org2', v_org2),
                        ('seed', v_seed), ('yabanci', v_yabanci),
                        ('kurum', v_kurum), ('kurum_uyesi', v_kurum_uyesi);
  IF (SELECT count(*) FROM fx WHERE id IS NOT NULL) < 8 THEN
    RAISE EXCEPTION 'Fikstur eksik: %', (SELECT string_agg(ad, ', ') FROM fx WHERE id IS NULL);
  END IF;
END $$;

-- ---------------------------------------------------------------- tercih yazma
DO $$
DECLARE
  v_uye uuid := pg_temp.fx('uye');
  v_org uuid := pg_temp.fx('org');
  v_org2 uuid := pg_temp.fx('org2');
  v_yon text := format('SELECT agency_id::text FROM public.fn_duz15_teklif_yonlendirme(ARRAY[%L]::uuid[])', v_uye);
  v text;
BEGIN
  -- T1 varsayilan: tercih kapali, yonlendirme bos
  INSERT INTO sonuc VALUES (1, 'varsayilan kapali, yonlendirme yok', 'YOK|BOS',
    pg_temp.acik(v_uye) || '|' || pg_temp.sor(pg_temp.fx('yabanci'), v_yon));

  -- T2 uye kendi tercihini acar
  v := pg_temp.sor(v_uye, format('SELECT public.org_member_set_offer_routing(%L, true)::text', v_org));
  INSERT INTO sonuc VALUES (2, 'uye tercihini acar', 'true|' || v_org::text, v || '|' || pg_temp.acik(v_uye));

  -- T3 baska bir kullanici (musteri gozu) talebin gidecegi ajansi gorur
  INSERT INTO sonuc VALUES (3, 'yonlendirme ajansin profil kimligini doner', pg_temp.fx('ajans')::text,
    pg_temp.sor(pg_temp.fx('yabanci'), v_yon));

  -- T4 ajans adi dolu doner
  INSERT INTO sonuc VALUES (4, 'yonlendirme ajans adini doner', 'DOLU',
    CASE WHEN pg_temp.sor(pg_temp.fx('yabanci'),
           format('SELECT agency_name FROM public.fn_duz15_teklif_yonlendirme(ARRAY[%L]::uuid[])', v_uye))
              NOT IN ('BOS', 'ENGEL', '') THEN 'DOLU' ELSE 'BOS' END);

  -- T5 ikinci ajansta acinca birincisi kapanir (kisi basina tek ajans)
  v := pg_temp.sor(v_uye, format('SELECT public.org_member_set_offer_routing(%L, true)::text', v_org2));
  INSERT INTO sonuc VALUES (5, 'ikinci ajansta acinca ilki kapanir', 'true|' || v_org2::text,
    v || '|' || pg_temp.acik(v_uye));

  -- T6 uye kapatir: yonlendirme biter
  v := pg_temp.sor(v_uye, format('SELECT public.org_member_set_offer_routing(%L, false)::text', v_org2));
  INSERT INTO sonuc VALUES (6, 'uye kapatir, yonlendirme biter', 'false|YOK|BOS',
    v || '|' || pg_temp.acik(v_uye) || '|' || pg_temp.sor(pg_temp.fx('yabanci'), v_yon));
END $$;

-- ---------------------------------------------------------------- kim acamaz
DO $$
DECLARE
  v_org uuid := pg_temp.fx('org');
BEGIN
  -- T7 uye olmayan acamaz
  INSERT INTO sonuc VALUES (7, 'uye olmayan acamaz', 'ENGEL',
    pg_temp.sor(pg_temp.fx('yabanci'), format('SELECT public.org_member_set_offer_routing(%L, true)::text', v_org)));

  -- T8 ajansin kendi hesabi acamaz
  INSERT INTO sonuc VALUES (8, 'ajansin kendi hesabi acamaz', 'ENGEL|YOK',
    pg_temp.sor(pg_temp.fx('seed'), format('SELECT public.org_member_set_offer_routing(%L, true)::text', v_org))
      || '|' || pg_temp.acik(pg_temp.fx('seed')));

  -- T9 kurum (business) uyesi kurumda acamaz
  INSERT INTO sonuc VALUES (9, 'kurum uyesi acamaz', 'ENGEL|YOK',
    pg_temp.sor(pg_temp.fx('kurum_uyesi'),
                format('SELECT public.org_member_set_offer_routing(%L, true)::text', pg_temp.fx('kurum')))
      || '|' || pg_temp.acik(pg_temp.fx('kurum_uyesi')));

  -- T10 uye tabloya dogrudan yazamaz (tercih yalniz RPC ile)
  INSERT INTO sonuc VALUES (10, 'tabloya dogrudan yazilamaz', 'ENGEL|YOK',
    pg_temp.sor(pg_temp.fx('uye'), format(
      'WITH g AS (UPDATE public.organization_memberships SET offers_via_agency = true
                   WHERE organization_id = %L AND user_id = %L RETURNING 1)
       SELECT count(*)::text FROM g', v_org, pg_temp.fx('uye')))
      || '|' || pg_temp.acik(pg_temp.fx('uye')));

  -- T11 girissiz ne yazar ne okur
  INSERT INTO sonuc VALUES (11, 'girissiz yazamaz ve okuyamaz', 'ENGEL|ENGEL',
    pg_temp.sor(NULL, format('SELECT public.org_member_set_offer_routing(%L, true)::text', v_org))
      || '|' || pg_temp.sor(NULL, format(
        'SELECT count(*)::text FROM public.fn_duz15_teklif_yonlendirme(ARRAY[%L]::uuid[])', pg_temp.fx('uye'))));
END $$;

-- ---------------------------------------------------------------- tutarlilik
DO $$
DECLARE
  v_uye uuid := pg_temp.fx('uye');
  v_org uuid := pg_temp.fx('org');
  v_yon text := format('SELECT count(*)::text FROM public.fn_duz15_teklif_yonlendirme(ARRAY[%L]::uuid[])', v_uye);
  v text;
BEGIN
  -- T12 yayindan kalkan uye icin yonlendirme donmez (acik ekip kurali)
  v := pg_temp.sor(v_uye, format('SELECT public.org_member_set_offer_routing(%L, true)::text', v_org));
  UPDATE public.providers SET is_published = false WHERE id = v_uye;
  INSERT INTO sonuc VALUES (12, 'yayinda olmayan uye yonlendirilmez', 'true|0',
    v || '|' || pg_temp.sor(pg_temp.fx('yabanci'), v_yon));
  UPDATE public.providers SET is_published = true WHERE id = v_uye;

  -- T13 yeniden yayinda: yonlendirme geri gelir
  INSERT INTO sonuc VALUES (13, 'yayindaki uye yonlendirilir', '1',
    pg_temp.sor(pg_temp.fx('yabanci'), v_yon));

  -- T14 uyelik askiya alininca tercih kendiliginden kapanir
  UPDATE public.organization_memberships SET status = 'suspended'
   WHERE organization_id = v_org AND user_id = v_uye;
  INSERT INTO sonuc VALUES (14, 'askiya alinan uyelikte tercih kapanir', 'YOK|0',
    pg_temp.acik(v_uye) || '|' || pg_temp.sor(pg_temp.fx('yabanci'), v_yon));
END $$;

-- ---------------------------------------------------------------- sonuc
SELECT sira, test, beklenen, gercek,
       CASE WHEN gercek = beklenen THEN 'GECTI' ELSE 'KALDI' END AS durum
  FROM sonuc
UNION ALL
SELECT 99, 'OZET', '14 GECTI / 14',
       (SELECT count(*) FILTER (WHERE gercek = beklenen) || ' GECTI / ' || count(*) FROM sonuc), ''
 ORDER BY 1;

ROLLBACK;
