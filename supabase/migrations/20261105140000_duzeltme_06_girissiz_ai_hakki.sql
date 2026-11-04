-- =============================================================================
-- Duzeltme 06 / DB - girissiz Kashe AI hakki (EKLEYEN; 5 Kasim 2026). Bulgu 64; karar Guven 5 Kasim:
--   girissiz kullaniciya IP basina gunde 3 yapay zeka analizi + gunluk toplam ust sinir (300); maliyet artarsa degisir.
--   Sayac internal semada (PostgREST'e kapali). Tek giris noktasi RPC ai_girissiz_hak_kullan(p_anahtar, p_ip_ozeti):
--   - p_anahtar: sunucu tarafi ortak anahtar (Vercel / .env.local AI_GIRISSIZ_ANAHTAR). Veritabaninda yalniz SHA-256 ozeti
--     tutulur; anahtarsiz dogrudan cagri (anon anahtari herkeste) 42501 - kimse toplam ust siniri bosuna tuketemez.
--   - p_ip_ozeti: uygulama sha256(anahtar:gun:ip) hesaplar; ham IP veritabanina HIC gelmez, ozet gunden gune degisir
--     (gunler arasi baglanamaz). Satirlar 30 gun sonra silinir (her cagrida).
--   - Atomik: once IP, sonra gunluk toplam artar; biri doluysa ikisi de geri alinir (alt islem). Reddedilen cagri
--     yalniz gunluk "reddedilen" sayacina yazilir (izleme). Gun = Europe/Istanbul takvim gunu.
--   - Donus jsonb: {"izin": bool, "kalan": int, "neden": null | "ip" | "toplam" | "kapali"}.
--   Sinirlari degistirmek: internal.ai_girissiz_ayar tek satir (ip_gunluk / toplam_gunluk; 0 = kapali) - kucuk migration.
--   Uygulama (gorev 47) bu RPC'yi yalniz girissiz istekte, model cagrisindan ONCE cagirir.
-- Kontrol: asama23. Test: asama4 T41 (T40 10c-2'ye ayrildi).
-- =============================================================================

CREATE TABLE IF NOT EXISTS internal.ai_girissiz_ayar (
  id            boolean PRIMARY KEY DEFAULT true CHECK (id),
  anahtar_ozeti text    NOT NULL CHECK (anahtar_ozeti ~ '^[0-9a-f]{64}$'),
  ip_gunluk     integer NOT NULL CHECK (ip_gunluk BETWEEN 0 AND 100),
  toplam_gunluk integer NOT NULL CHECK (toplam_gunluk BETWEEN 0 AND 100000),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Ilk kurulum degerleri; yeniden kosu degistirilmis sinirlari EZMEZ.
INSERT INTO internal.ai_girissiz_ayar (id, anahtar_ozeti, ip_gunluk, toplam_gunluk)
VALUES (true, '7e153fad619037436e67592c35e7042131c534df74e8d7b5d34208e3004c1609', 3, 300)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS internal.ai_girissiz_kullanim (
  gun       date        NOT NULL,
  ip_ozeti  text        NOT NULL CHECK (ip_ozeti ~ '^[0-9a-f]{64}$'),
  adet      integer     NOT NULL CHECK (adet >= 0),
  ilk_at    timestamptz NOT NULL DEFAULT now(),
  son_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gun, ip_ozeti)
);

CREATE TABLE IF NOT EXISTS internal.ai_girissiz_gun (
  gun         date    PRIMARY KEY,
  adet        integer NOT NULL DEFAULT 0 CHECK (adet >= 0),
  reddedilen  integer NOT NULL DEFAULT 0 CHECK (reddedilen >= 0)
);

-- internal sema zaten anon / authenticated'a kapali (FAZ 1); tablolar icin ayrica yetki yok.
REVOKE ALL ON internal.ai_girissiz_ayar, internal.ai_girissiz_kullanim, internal.ai_girissiz_gun FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.ai_girissiz_hak_kullan(p_anahtar text, p_ip_ozeti text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ayar   internal.ai_girissiz_ayar%ROWTYPE;
  v_gun    date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_ip     integer;
  v_toplam integer;
  v_neden  text;
BEGIN
  SELECT * INTO v_ayar FROM internal.ai_girissiz_ayar WHERE id;
  IF v_ayar.id IS NULL
     OR p_anahtar IS NULL
     OR encode(sha256(convert_to(p_anahtar, 'UTF8')), 'hex') <> v_ayar.anahtar_ozeti THEN
    RAISE EXCEPTION 'yetkisiz' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_ip_ozeti IS NULL OR p_ip_ozeti !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'gecersiz ip ozeti' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  DELETE FROM internal.ai_girissiz_kullanim WHERE gun < v_gun - 30;

  IF v_ayar.ip_gunluk = 0 OR v_ayar.toplam_gunluk = 0 THEN
    v_neden := 'kapali';
  ELSE
    BEGIN
      INSERT INTO internal.ai_girissiz_kullanim AS k (gun, ip_ozeti, adet)
      VALUES (v_gun, p_ip_ozeti, 1)
      ON CONFLICT (gun, ip_ozeti) DO UPDATE SET adet = k.adet + 1, son_at = now()
       WHERE k.adet < v_ayar.ip_gunluk
      RETURNING k.adet INTO v_ip;
      IF v_ip IS NULL THEN
        RAISE EXCEPTION 'ip' USING ERRCODE = 'P0001';
      END IF;

      INSERT INTO internal.ai_girissiz_gun AS g (gun, adet)
      VALUES (v_gun, 1)
      ON CONFLICT (gun) DO UPDATE SET adet = g.adet + 1
       WHERE g.adet < v_ayar.toplam_gunluk
      RETURNING g.adet INTO v_toplam;
      IF v_toplam IS NULL THEN
        RAISE EXCEPTION 'toplam' USING ERRCODE = 'P0001';
      END IF;
    EXCEPTION WHEN raise_exception THEN
      v_neden := SQLERRM;   -- alt islem geri alindi: iki sayac da artmadi
    END;
  END IF;

  IF v_neden IS NOT NULL THEN
    INSERT INTO internal.ai_girissiz_gun AS g (gun, reddedilen)
    VALUES (v_gun, 1)
    ON CONFLICT (gun) DO UPDATE SET reddedilen = g.reddedilen + 1;
    RETURN jsonb_build_object('izin', false, 'kalan', 0, 'neden', v_neden);
  END IF;

  RETURN jsonb_build_object('izin', true, 'kalan', GREATEST(v_ayar.ip_gunluk - v_ip, 0), 'neden', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.ai_girissiz_hak_kullan(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_girissiz_hak_kullan(text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
