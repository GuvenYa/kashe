-- =============================================================================
-- FAZ 2b / 02 — Aynalama: services + profiles.primary_category_id -> provider_services;
--                provider_id sutunlarinin turetilmesi; professional_profiles fiyat ozeti
--
-- Kaynak: 04-goc-plani.md "cift alan donemi ... senkron tetikleyici"; 11-faz2 bolum 2 ("services.price_unit
--         metni 2b'de eslenir", "services'tan turetme 2b'nin isi"). FAZ 0/2a kalibi: AFTER, SECURITY DEFINER,
--         hata eski akisi KESMEZ, organization_sync_log'a duser.
-- Plan: docs/envanter/13-faz2b-saglayici-hizmetleri.md
--
-- TURETME KURALI (derive_provider_services):
--   * Saglayicinin her AKTIF services satiri kategorisi -> service_roles.legacy_category_id ile rol; ayni rolde
--     birden fazla aktif hizmet varsa TEMSILCI = en dusuk (sort_order, created_at, id). Fiyat temsilciden:
--       price_on_request -> pricing_mode on_request, fiyat/birim NULL
--       price_starting   -> range, price_min dolu, price_max NULL ("X'ten baslayan")
--       min = max        -> fixed;  aksi halde range
--       price_unit: total->per_job, hourly->per_hour, half_day->per_half_day, full_day->per_day
--   * profiles.primary_category_id'nin rolu is_primary = true olur; hizmeti yoksa fiyatsiz satir (pricing_mode NULL).
--   * Turetilemeyen satir (origin legacy_sync) SILINIR; origin = 'provider' satirlara DOKUNULMAZ (2c).
--   * professional_profiles fiyat ozeti (derive_provider_price_summary): birincil rol fiyatliysa o; degilse en
--     dusuk price_min'li fiyatli rol; degilse on_request olan; hic satir yoksa NULL.
--
-- TETIKLEYICILER:
--   trg_faz2b_sync_services            services AFTER INSERT/UPDATE OF (fiyat, kategori, aktiflik, sira, sahip)/DELETE
--   trg_faz2b_sync_primary_role        profiles AFTER UPDATE OF primary_category_id
--   trg_faz2b_sync_new_provider        providers AFTER INSERT (kayit sirasinda primary_category_id doluysa)
--   trg_faz2b_set_provider_id          services / portfolio_items / profile_experiences BEFORE INSERT OR UPDATE
--                                      (provider_id := profile_id, saglayici varsa; yoksa NULL)
--   trg_faz2b_set_provider_id          reviews / favorites BEFORE INSERT OR UPDATE (provider_id := professional_id)
--
-- Idempotan. Sapkali harf yok.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Birim eslemesi
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.map_legacy_price_unit(p_unit text)
RETURNS public.provider_price_unit
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_unit
           WHEN 'total'    THEN 'per_job'::public.provider_price_unit
           WHEN 'hourly'   THEN 'per_hour'
           WHEN 'half_day' THEN 'per_half_day'
           WHEN 'full_day' THEN 'per_day'
           ELSE NULL
         END;
$$;

-- -----------------------------------------------------------------------------
-- 2) Turetme (salt okur; dolum, tetikleyici ve asama9 ayni fonksiyonu kullanir)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.derive_provider_services(p_provider_id uuid)
RETURNS TABLE (
  role_id           integer,
  is_primary        boolean,
  pricing_mode      public.pricing_mode,
  price_min         numeric,
  price_max         numeric,
  price_unit        public.provider_price_unit,
  legacy_service_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH prim AS (
    SELECT sr.id AS role_id
      FROM public.profiles p
      JOIN public.service_roles sr ON sr.legacy_category_id = p.primary_category_id
     WHERE p.id = p_provider_id
  ),
  temsilci AS (
    SELECT DISTINCT ON (s.category_id)
           s.category_id, s.id, s.price_on_request, s.price_starting, s.price_min, s.price_max, s.price_unit
      FROM public.services s
     WHERE s.profile_id = p_provider_id AND s.is_active
     ORDER BY s.category_id, s.sort_order, s.created_at, s.id
  ),
  hizmet_rol AS (
    SELECT sr.id AS role_id, t.id AS service_id, t.price_on_request, t.price_starting, t.price_min, t.price_max, t.price_unit
      FROM temsilci t
      JOIN public.service_roles sr ON sr.legacy_category_id = t.category_id
  ),
  hepsi AS (
    SELECT * FROM hizmet_rol
    UNION ALL
    SELECT prim.role_id, NULL::uuid, NULL::boolean, NULL::boolean, NULL::numeric, NULL::numeric, NULL::text
      FROM prim
     WHERE NOT EXISTS (SELECT 1 FROM hizmet_rol h WHERE h.role_id = prim.role_id)
  )
  SELECT h.role_id,
         COALESCE(h.role_id = (SELECT role_id FROM prim), false)                     AS is_primary,
         CASE WHEN h.service_id IS NULL      THEN NULL
              WHEN h.price_on_request        THEN 'on_request'::public.pricing_mode
              WHEN h.price_starting          THEN 'range'
              WHEN h.price_min = h.price_max THEN 'fixed'
              ELSE 'range' END                                                        AS pricing_mode,
         CASE WHEN h.service_id IS NULL OR h.price_on_request THEN NULL ELSE h.price_min END AS price_min,
         CASE WHEN h.service_id IS NULL OR h.price_on_request OR h.price_starting THEN NULL ELSE h.price_max END AS price_max,
         CASE WHEN h.service_id IS NULL OR h.price_on_request THEN NULL
              ELSE public.map_legacy_price_unit(h.price_unit) END                    AS price_unit,
         h.service_id                                                                  AS legacy_service_id
    FROM hepsi h;
$$;

REVOKE ALL ON FUNCTION public.derive_provider_services(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.derive_provider_services(uuid) TO service_role;

-- professional_profiles fiyat ozeti: birincil fiyatli rol > en dusuk price_min > on_request > yok
CREATE OR REPLACE FUNCTION public.derive_provider_price_summary(p_provider_id uuid)
RETURNS TABLE (
  pricing_mode public.pricing_mode,
  price_min    numeric,
  price_max    numeric,
  price_unit   public.provider_price_unit
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.pricing_mode, ps.price_min, ps.price_max, ps.price_unit
    FROM public.provider_services ps
   WHERE ps.provider_id = p_provider_id
   ORDER BY (ps.is_primary AND ps.pricing_mode IS NOT NULL) DESC,
            ps.price_min ASC NULLS LAST,
            (ps.pricing_mode IS NULL) ASC,
            ps.role_id
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.derive_provider_price_summary(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.derive_provider_price_summary(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 3) Yeniden hesaplama (yazar): turetilen kume ile legacy_sync satirlarini esitler
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_provider_services(p_provider_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type  public.provider_type;
  v_prim  integer;
  v_n     integer := 0;
  v_pm    public.pricing_mode;
  v_min   numeric;
  v_max   numeric;
  v_unit  public.provider_price_unit;
BEGIN
  SELECT provider_type INTO v_type FROM public.providers WHERE id = p_provider_id;
  IF v_type IS NULL THEN
    RETURN 0;   -- saglayici degil (client/business) veya henuz yok
  END IF;

  -- turetme kucuk bir sorgudur; gecici tablo yerine uc kez cagrilir (plan onbellegi sorunu yok)
  SELECT d.role_id INTO v_prim FROM public.derive_provider_services(p_provider_id) d WHERE d.is_primary LIMIT 1;

  -- once eski birincil dusurulur (tek-birincil indeksi UPSERT sirasinda catismasin)
  UPDATE public.provider_services ps
     SET is_primary = false
   WHERE ps.provider_id = p_provider_id AND ps.origin = 'legacy_sync' AND ps.is_primary
     AND ps.role_id IS DISTINCT FROM v_prim;

  -- turetilemeyen legacy_sync satirlari silinir (origin = provider dokunulmaz)
  DELETE FROM public.provider_services ps
   WHERE ps.provider_id = p_provider_id AND ps.origin = 'legacy_sync'
     AND NOT EXISTS (SELECT 1 FROM public.derive_provider_services(p_provider_id) d WHERE d.role_id = ps.role_id);

  -- ekle / guncelle (yalniz degisen legacy_sync satirlari; capacity ve lead_time_days korunur)
  INSERT INTO public.provider_services
    (provider_id, role_id, is_primary, pricing_mode, price_min, price_max, price_unit, legacy_service_id, origin)
  SELECT p_provider_id, d.role_id, d.is_primary, d.pricing_mode, d.price_min, d.price_max, d.price_unit, d.legacy_service_id, 'legacy_sync'
    FROM public.derive_provider_services(p_provider_id) d
  ON CONFLICT (provider_id, role_id) DO UPDATE
     SET is_primary        = EXCLUDED.is_primary,
         pricing_mode      = EXCLUDED.pricing_mode,
         price_min         = EXCLUDED.price_min,
         price_max         = EXCLUDED.price_max,
         price_unit        = EXCLUDED.price_unit,
         legacy_service_id = EXCLUDED.legacy_service_id
   WHERE provider_services.origin = 'legacy_sync'
     AND (provider_services.is_primary        IS DISTINCT FROM EXCLUDED.is_primary
       OR provider_services.pricing_mode      IS DISTINCT FROM EXCLUDED.pricing_mode
       OR provider_services.price_min         IS DISTINCT FROM EXCLUDED.price_min
       OR provider_services.price_max         IS DISTINCT FROM EXCLUDED.price_max
       OR provider_services.price_unit        IS DISTINCT FROM EXCLUDED.price_unit
       OR provider_services.legacy_service_id IS DISTINCT FROM EXCLUDED.legacy_service_id);

  SELECT count(*) INTO v_n FROM public.provider_services WHERE provider_id = p_provider_id;

  -- professional_profiles fiyat ozeti (yalniz degistiyse; satir yoksa hepsi NULL)
  IF v_type = 'professional' THEN
    SELECT s.pricing_mode, s.price_min, s.price_max, s.price_unit
      INTO v_pm, v_min, v_max, v_unit
      FROM public.derive_provider_price_summary(p_provider_id) s;
    UPDATE public.professional_profiles pp
       SET pricing_mode = v_pm,
           price_min    = v_min,
           price_max    = v_max,
           price_unit   = v_unit
     WHERE pp.provider_id = p_provider_id
       AND (pp.pricing_mode IS DISTINCT FROM v_pm
         OR pp.price_min    IS DISTINCT FROM v_min
         OR pp.price_max    IS DISTINCT FROM v_max
         OR pp.price_unit   IS DISTINCT FROM v_unit);
  END IF;

  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_provider_services(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_provider_services(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 4) Tetikleyici fonksiyonlari (hata eski akisi KESMEZ)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz2b_sync_services()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      PERFORM public.recompute_provider_services(NEW.profile_id);
    END IF;
    IF TG_OP IN ('DELETE', 'UPDATE') AND (TG_OP = 'DELETE' OR OLD.profile_id IS DISTINCT FROM NEW.profile_id) THEN
      PERFORM public.recompute_provider_services(OLD.profile_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_org_sync_error(TG_NAME, TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM);
  END;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz2b_sync_primary_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.recompute_provider_services(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_org_sync_error(TG_NAME, TG_OP, NEW.id, SQLERRM);
  END;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_faz2b_sync_new_provider()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.recompute_provider_services(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_org_sync_error(TG_NAME, TG_OP, NEW.id, SQLERRM);
  END;
  RETURN NULL;
END;
$$;

-- provider_id := profile_id (services, portfolio_items, profile_experiences); saglayici yoksa NULL
CREATE OR REPLACE FUNCTION public.fn_faz2b_set_provider_id_from_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    NEW.provider_id := CASE WHEN EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = NEW.profile_id)
                            THEN NEW.profile_id ELSE NULL END;
  EXCEPTION WHEN OTHERS THEN
    NEW.provider_id := NULL;   -- istemcinin verdigi deger hata halinde de kalmaz
    PERFORM public.log_org_sync_error(TG_NAME || '.' || TG_TABLE_NAME, TG_OP, NEW.profile_id, SQLERRM);
  END;
  RETURN NEW;
END;
$$;

-- provider_id := professional_id (reviews, favorites)
CREATE OR REPLACE FUNCTION public.fn_faz2b_set_provider_id_from_professional()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    NEW.provider_id := CASE WHEN EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = NEW.professional_id)
                            THEN NEW.professional_id ELSE NULL END;
  EXCEPTION WHEN OTHERS THEN
    NEW.provider_id := NULL;
    PERFORM public.log_org_sync_error(TG_NAME || '.' || TG_TABLE_NAME, TG_OP, NEW.professional_id, SQLERRM);
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_faz2b_sync_services()                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz2b_sync_primary_role()                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz2b_sync_new_provider()                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz2b_set_provider_id_from_profile()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_faz2b_set_provider_id_from_professional()   FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5) Tetikleyiciler
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_faz2b_sync_services ON public.services;
CREATE TRIGGER trg_faz2b_sync_services
  AFTER INSERT OR DELETE OR UPDATE OF profile_id, category_id, price_min, price_max, price_on_request,
                                     price_starting, price_unit, is_active, sort_order
  ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz2b_sync_services();

DROP TRIGGER IF EXISTS trg_faz2b_sync_primary_role ON public.profiles;
CREATE TRIGGER trg_faz2b_sync_primary_role
  AFTER UPDATE OF primary_category_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz2b_sync_primary_role();

DROP TRIGGER IF EXISTS trg_faz2b_sync_new_provider ON public.providers;
CREATE TRIGGER trg_faz2b_sync_new_provider
  AFTER INSERT ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz2b_sync_new_provider();

DROP TRIGGER IF EXISTS trg_faz2b_set_provider_id ON public.services;
CREATE TRIGGER trg_faz2b_set_provider_id
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz2b_set_provider_id_from_profile();

DROP TRIGGER IF EXISTS trg_faz2b_set_provider_id ON public.portfolio_items;
CREATE TRIGGER trg_faz2b_set_provider_id
  BEFORE INSERT OR UPDATE ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz2b_set_provider_id_from_profile();

DROP TRIGGER IF EXISTS trg_faz2b_set_provider_id ON public.profile_experiences;
CREATE TRIGGER trg_faz2b_set_provider_id
  BEFORE INSERT OR UPDATE ON public.profile_experiences
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz2b_set_provider_id_from_profile();

DROP TRIGGER IF EXISTS trg_faz2b_set_provider_id ON public.reviews;
CREATE TRIGGER trg_faz2b_set_provider_id
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz2b_set_provider_id_from_professional();

DROP TRIGGER IF EXISTS trg_faz2b_set_provider_id ON public.favorites;
CREATE TRIGGER trg_faz2b_set_provider_id
  BEFORE INSERT OR UPDATE ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz2b_set_provider_id_from_professional();

COMMIT;
