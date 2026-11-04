-- SAHNE 05 — asama4'un biraktigi test kategorileri/rolleri ("Faz1 Test ...", slug 'faz1test-%') ve onlara
-- bagli satirlari siler. YALNIZ DALDA (ukqhgspaallzjscjodbb). Uretimde bu kayitlar yok; uretim korumasi yine de var.
-- Bulgu 57 (docs/sahne/bulgular.md). asama4 T0 blogunun aksine t_sonuc kullanmaz, hatayi yutmaz: bir sey kirilirsa
-- gercek hata mesaji gorunur ve HICBIR SEY silinmez (tek DO = tek islem).
--
-- Yontem: service_roles(id) ve service_categories(id)'ye FK ile bagli HER tablo information_schema'dan bulunur;
-- test rollerine/kategorilerine isaret eden satirlar silinir (profiles.primary_category_id yalniz NULL'lanir),
-- sonra roller, sonra kategoriler. Sonuc tablosu: hangi tablodan kac satir gitti.

DO $$
DECLARE n_cron int := 0; n_prof int;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM cron.job WHERE jobname = ''send-message-notifications''' INTO n_cron;
  END IF;
  SELECT count(*) INTO n_prof FROM public.profiles WHERE email NOT LIKE 'faz1test+%' AND email NOT LIKE 'sahne+%';
  IF n_cron > 0 OR n_prof > 10 THEN
    RAISE EXCEPTION 'URETIM KORUMASI: bu veritabani uretim gibi gorunuyor (cron=%, test disi profil=%). Yalniz dalda kosulur. Hicbir sey yazilmadi.', n_cron, n_prof;
  END IF;
END $$;

CREATE TEMP TABLE IF NOT EXISTS sahne05_rapor (sira serial, tablo text, sutun text, islem text, satir bigint);
DELETE FROM sahne05_rapor;

DO $$
DECLARE
  rol_ids integer[];   -- service_roles.id ve service_categories.id INTEGER (identity), uuid DEGIL
  kat_ids integer[];
  fk record;
  n bigint;
  hedef text;
  ids integer[];
BEGIN
  PERFORM set_config('kashe.faz7_rpc', '1', true);  -- Duzeltme 04: gonderilmis teklif kalemleri bayraksiz silinmez
  SELECT COALESCE(array_agg(id), '{}') INTO rol_ids FROM public.service_roles      WHERE slug LIKE 'faz1test-%';
  SELECT COALESCE(array_agg(id), '{}') INTO kat_ids FROM public.service_categories WHERE slug LIKE 'faz1test-%';
  INSERT INTO sahne05_rapor (tablo, sutun, islem, satir) VALUES
    ('service_roles', 'slug faz1test-%', 'bulundu', coalesce(array_length(rol_ids, 1), 0)),
    ('service_categories', 'slug faz1test-%', 'bulundu', coalesce(array_length(kat_ids, 1), 0));

  -- 1) Once rollere bagli satirlar, sonra kategorilere bagli satirlar (service_roles.category_id dahil degil:
  --    roller zaten 2. adimda silinir). Ayni tabloya iki FK varsa ikisi de islenir.
  FOR hedef IN SELECT unnest(ARRAY['service_roles', 'service_categories']) LOOP
    ids := CASE WHEN hedef = 'service_roles' THEN rol_ids ELSE kat_ids END;
    IF coalesce(array_length(ids, 1), 0) = 0 THEN CONTINUE; END IF;
    FOR fk IN
      SELECT nsp.nspname AS sema, cls.relname AS tablo, att.attname AS sutun
        FROM pg_constraint con
        JOIN pg_class cls ON cls.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
        JOIN pg_class ref ON ref.oid = con.confrelid
        JOIN pg_namespace rnsp ON rnsp.oid = ref.relnamespace
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
       WHERE con.contype = 'f' AND rnsp.nspname = 'public' AND ref.relname = hedef
         AND NOT (hedef = 'service_categories' AND cls.relname = 'service_roles')
       ORDER BY nsp.nspname, cls.relname, att.attname
    LOOP
      IF fk.sema = 'public' AND fk.tablo = 'profiles' THEN
        EXECUTE format('UPDATE %I.%I SET %I = NULL WHERE %I = ANY($1)', fk.sema, fk.tablo, fk.sutun, fk.sutun) USING ids;
        GET DIAGNOSTICS n = ROW_COUNT;
        INSERT INTO sahne05_rapor (tablo, sutun, islem, satir) VALUES (fk.sema || '.' || fk.tablo, fk.sutun, 'NULL yapildi', n);
      ELSE
        EXECUTE format('DELETE FROM %I.%I WHERE %I = ANY($1)', fk.sema, fk.tablo, fk.sutun) USING ids;
        GET DIAGNOSTICS n = ROW_COUNT;
        INSERT INTO sahne05_rapor (tablo, sutun, islem, satir) VALUES (fk.sema || '.' || fk.tablo, fk.sutun, 'silindi', n);
      END IF;
    END LOOP;
  END LOOP;

  -- 2) Roller, 3) kategoriler
  DELETE FROM public.service_roles WHERE id = ANY(rol_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO sahne05_rapor (tablo, sutun, islem, satir) VALUES ('public.service_roles', 'id', 'silindi', n);
  DELETE FROM public.service_categories WHERE id = ANY(kat_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO sahne05_rapor (tablo, sutun, islem, satir) VALUES ('public.service_categories', 'id', 'silindi', n);

  -- 4) Kanit: kalan sifir
  SELECT count(*) INTO n FROM public.service_categories WHERE slug LIKE 'faz1test-%' OR name_tr LIKE 'Faz1 Test%';
  IF n <> 0 THEN RAISE EXCEPTION 'temizlik eksik: % test kategorisi kaldi', n; END IF;
  SELECT count(*) INTO n FROM public.service_roles WHERE slug LIKE 'faz1test-%';
  IF n <> 0 THEN RAISE EXCEPTION 'temizlik eksik: % test rolu kaldi', n; END IF;
  INSERT INTO sahne05_rapor (tablo, sutun, islem, satir) VALUES ('KANIT', 'faz1test-% kalan', 'sifir', 0);
END $$;

SELECT sira, tablo, sutun, islem, satir FROM sahne05_rapor ORDER BY sira;
