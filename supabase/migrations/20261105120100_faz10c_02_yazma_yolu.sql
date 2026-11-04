-- =============================================================================
-- FAZ 10c-1 / 02 - Saglayici yazma yolu (EKLEYEN; 5 Kasim 2026). 01'den sonra.
-- Kaynak: docs/envanter/38-faz10-temizlik.md bolum 10c (kararlar bolum 4: madde 2, 3, 6).
--   Sahip kendi saglayici satirina ve alt profiline DOGRUDAN yazar (RLS id = auth.uid() + sutun duzeyi GRANT); admin
--   providers'ta onay / askiya alma yazar (providers_update_admin). Tek RPC: provider_set_primary_category(p_category_id).
--   increment_profile_views -> providers.views_count. Ters ayna (providers / professional_profiles / organization_profiles
--   -> profiles kopyasi, kashe.sync_bypass ile) - 83 okuyan dosya ve eski yazma yolu (profiles) degismeden calisir; iki ayna
--   birlikte esit kalir (IS DISTINCT kosulu: dongu yok). v_providers_public attributes / category_attributes / primary_category_id
--   degerlerini saglayici tarafindan okur (sutun adlari, sirasi, tipleri ayni - asama10 sozlesmesi).
--   Koruma: sahip onay alanlarina yazamaz, TEK istisna "revision -> pending" (Model 3: revizyon istenen profil duzenlenince
--   tekrar incelemeye girer; eski revizyon notu temizlenir). Ayni istisna profiles yolunda da acilir: bugun uygulamanin
--   gonderdigi 'pending' tetikleyicide sessizce geri aliniyordu (bulgu 68).
--   KISITLAYAN kisim (profiles tasinmis alanlarinin kilitlenmesi, ileri aynanin daralmasi, fn_faz2b_sync_primary_role'un dusmesi)
--   uygulama (10c-1 P1) uretime ciktiktan SONRA 03'te.
-- Kontrol: asama20 K8 / K8b, asama10 (ESIT). Test: asama4 T38.
-- =============================================================================

DO $$
DECLARE n bigint;
BEGIN
  SELECT COALESCE(sum(satir), 0) INTO n FROM public.fn_faz10c_ayna_kaymasi();
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAZ 10c-1/02: profiles ile providers arasinda kayma var (%): % - once 01 kosmali',
      n, (SELECT string_agg(alan || '=' || satir, ' ') FROM public.fn_faz10c_ayna_kaymasi() WHERE satir > 0);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1) Koruma tetikleyicileri
-- -----------------------------------------------------------------------------
-- profiles: ayna (sync_bypass) tasinmis alanlari yazar ama rol / admin bayragini ASLA; sahip icin revision -> pending
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('kashe.sync_bypass', true) = 'on' THEN
    NEW.is_admin := OLD.is_admin;
    NEW.role := OLD.role;
    RETURN NEW;
  END IF;

  -- Admin her seyi degistirebilir
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Normal kullanici: hassas alanlar eski degerinde kalir
  NEW.is_admin := OLD.is_admin;
  NEW.role := OLD.role;
  -- Tek gecis: revizyon istenen profil duzenlenince tekrar incelemeye girer (Model 3)
  IF NOT (OLD.approval_status = 'revision' AND NEW.approval_status = 'pending') THEN
    NEW.approval_status := OLD.approval_status;
  END IF;
  NEW.approved_at := OLD.approved_at;
  NEW.suspended_at := OLD.suspended_at;
  NEW.suspension_reason := OLD.suspension_reason;
  NEW.suspended_by := OLD.suspended_by;

  RETURN NEW;
END;
$$;

-- providers: ayni istisna; revizyon notu tekrar incelemede temizlenir (sahip notu kendisi yazamaz)
CREATE OR REPLACE FUNCTION public.protect_sensitive_provider_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('kashe.sync_bypass', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.approval_status = 'revision' AND NEW.approval_status = 'pending' THEN
    NEW.approval_note := NULL;
  ELSE
    NEW.approval_status := OLD.approval_status;
    NEW.approval_note   := OLD.approval_note;
  END IF;
  NEW.approved_at        := OLD.approved_at;
  NEW.suspended_at       := OLD.suspended_at;
  NEW.suspension_reason  := OLD.suspension_reason;
  NEW.suspended_by       := OLD.suspended_by;
  NEW.is_verified        := OLD.is_verified;
  NEW.verification_level := OLD.verification_level;
  NEW.trust_score        := OLD.trust_score;
  NEW.trust_computed_at  := OLD.trust_computed_at;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2) Yazma yetkisi + politikalar
-- -----------------------------------------------------------------------------
GRANT UPDATE (city_id, district, service_radius_km, is_published, attributes, category_attributes,
              approval_status, approval_note, approved_at, suspended_at, suspension_reason, suspended_by)
  ON public.providers TO authenticated;
GRANT UPDATE (headline, bio, experience_years, languages, equipment)
  ON public.professional_profiles TO authenticated;
GRANT UPDATE (about, team_size_range, can_full_service, subcontracts, min_project_budget, portfolio_scale)
  ON public.organization_profiles TO authenticated;

DROP POLICY IF EXISTS providers_update_own ON public.providers;
CREATE POLICY providers_update_own ON public.providers FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS providers_update_admin ON public.providers;
CREATE POLICY providers_update_admin ON public.providers FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS professional_profiles_update_own ON public.professional_profiles;
CREATE POLICY professional_profiles_update_own ON public.professional_profiles FOR UPDATE TO authenticated
  USING (provider_id = auth.uid()) WITH CHECK (provider_id = auth.uid());
DROP POLICY IF EXISTS organization_profiles_update_own ON public.organization_profiles;
CREATE POLICY organization_profiles_update_own ON public.organization_profiles FOR UPDATE TO authenticated
  USING (provider_id = auth.uid()) WITH CHECK (provider_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3) Ters ayna: saglayici tarafi -> profiles kopyasi (bayrak onceki degerine doner)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz10c_sync_provider_to_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_onceki text := current_setting('kashe.sync_bypass', true);
BEGIN
  PERFORM set_config('kashe.sync_bypass', 'on', true);
  UPDATE public.profiles p
     SET city_id             = NEW.city_id,
         approval_status     = NEW.approval_status,
         approval_note       = NEW.approval_note,
         approved_at         = NEW.approved_at,
         suspended_at        = NEW.suspended_at,
         suspension_reason   = NEW.suspension_reason,
         suspended_by        = NEW.suspended_by,
         is_published        = NEW.is_published,
         attributes          = NEW.attributes,
         category_attributes = NEW.category_attributes,
         views_count         = NEW.views_count
   WHERE p.id = NEW.id
     AND (p.city_id             IS DISTINCT FROM NEW.city_id
       OR p.approval_status     IS DISTINCT FROM NEW.approval_status
       OR p.approval_note       IS DISTINCT FROM NEW.approval_note
       OR p.approved_at         IS DISTINCT FROM NEW.approved_at
       OR p.suspended_at        IS DISTINCT FROM NEW.suspended_at
       OR p.suspension_reason   IS DISTINCT FROM NEW.suspension_reason
       OR p.suspended_by        IS DISTINCT FROM NEW.suspended_by
       OR p.is_published        IS DISTINCT FROM NEW.is_published
       OR p.attributes          IS DISTINCT FROM NEW.attributes
       OR p.category_attributes IS DISTINCT FROM NEW.category_attributes
       OR p.views_count         IS DISTINCT FROM NEW.views_count);
  PERFORM set_config('kashe.sync_bypass', COALESCE(NULLIF(v_onceki, ''), 'off'), true);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_faz10c_sync_provider_to_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_faz10c_sync_provider_to_profile ON public.providers;
CREATE TRIGGER trg_faz10c_sync_provider_to_profile
  AFTER UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz10c_sync_provider_to_profile();

-- alt profil bio'su -> profiles.bio (profesyonel: bio, kurulus: about)
CREATE OR REPLACE FUNCTION public.fn_faz10c_sync_subprofile_bio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_onceki text := current_setting('kashe.sync_bypass', true);
  v_bio text;
BEGIN
  IF TG_TABLE_NAME = 'professional_profiles' THEN
    v_bio := NEW.bio;
  ELSE
    v_bio := NEW.about;
  END IF;
  PERFORM set_config('kashe.sync_bypass', 'on', true);
  UPDATE public.profiles p SET bio = v_bio WHERE p.id = NEW.provider_id AND p.bio IS DISTINCT FROM v_bio;
  PERFORM set_config('kashe.sync_bypass', COALESCE(NULLIF(v_onceki, ''), 'off'), true);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_faz10c_sync_subprofile_bio() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_faz10c_sync_professional_bio ON public.professional_profiles;
CREATE TRIGGER trg_faz10c_sync_professional_bio
  AFTER INSERT OR UPDATE OF bio ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz10c_sync_subprofile_bio();
DROP TRIGGER IF EXISTS trg_faz10c_sync_organization_about ON public.organization_profiles;
CREATE TRIGGER trg_faz10c_sync_organization_about
  AFTER INSERT OR UPDATE OF about ON public.organization_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz10c_sync_subprofile_bio();

-- -----------------------------------------------------------------------------
-- 4) RPC'ler
-- -----------------------------------------------------------------------------
-- Birincil kategori: sahip; NULL = birincil yok. profiles kopyasi (derive_provider_services kaynagi) ayna bayragiyla
-- yazilir ve provider_services yeniden turetilir (03 fn_faz2b_sync_primary_role'u dusurdugunde de calisir).
CREATE OR REPLACE FUNCTION public.provider_set_primary_category(p_category_id integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_onceki text;
  v_rol integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'oturum gerekli' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = v_uid) THEN
    RAISE EXCEPTION 'saglayici hesabi degil' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_category_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.service_categories c JOIN public.service_roles sr ON sr.legacy_category_id = c.id
        WHERE c.id = p_category_id AND c.is_active) THEN
    RAISE EXCEPTION 'gecersiz kategori' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_onceki := current_setting('kashe.sync_bypass', true);
  PERFORM set_config('kashe.sync_bypass', 'on', true);
  UPDATE public.profiles SET primary_category_id = p_category_id
   WHERE id = v_uid AND primary_category_id IS DISTINCT FROM p_category_id;
  PERFORM set_config('kashe.sync_bypass', COALESCE(NULLIF(v_onceki, ''), 'off'), true);

  PERFORM public.recompute_provider_services(v_uid);
  SELECT role_id INTO v_rol FROM public.provider_services WHERE provider_id = v_uid AND is_primary;
  RETURN v_rol;
END;
$$;
REVOKE ALL ON FUNCTION public.provider_set_primary_category(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_set_primary_category(integer) TO authenticated;

-- Goruntulenme sayaci saglayici satirinda (profiles kopyasi ters aynayla); saglayici olmayan profilde eski yol
CREATE OR REPLACE FUNCTION public.increment_profile_views(profile_id_param uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.providers SET views_count = views_count + 1 WHERE id = profile_id_param;
  IF NOT FOUND THEN
    UPDATE public.profiles SET views_count = views_count + 1 WHERE id = profile_id_param;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5) v_providers_public: attributes / category_attributes / primary_category_id saglayici tarafindan
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_providers_public WITH (security_invoker = true) AS
 SELECT pr.id,
    p.role,
    pr.provider_type,
    pr.slug AS provider_slug,
    pr.display_name,
    p.full_name,
    p.company_name,
    p.avatar_url,
    COALESCE(pp.bio, op.about) AS bio,
    pr.city_id,
    sr.legacy_category_id AS primary_category_id,
    ps.role_id AS primary_role_id,
    pr.attributes,
    pr.category_attributes,
    p.premium_tier,
    p.premium_until,
    pr.is_published,
    pr.approval_status,
    pr.approved_at,
    pr.suspended_at,
    pr.is_published AND pr.approval_status = 'approved'::profile_approval_status AND pr.suspended_at IS NULL AS is_visible,
    pr.is_verified,
    pr.verification_level,
    pr.trust_score,
    pp.headline,
    pp.experience_years,
    pp.pricing_mode,
    pp.price_min,
    pp.price_max,
    pp.price_unit,
    p.last_seen_at,
    p.created_at,
    p.updated_at
   FROM public.providers pr
     JOIN public.profiles p ON p.id = pr.id
     LEFT JOIN public.professional_profiles pp ON pp.provider_id = pr.id
     LEFT JOIN public.organization_profiles op ON op.provider_id = pr.id
     LEFT JOIN public.provider_services ps ON ps.provider_id = pr.id AND ps.is_primary
     LEFT JOIN public.service_roles sr ON sr.id = ps.role_id;

-- -----------------------------------------------------------------------------
-- 6) Son dogrulama
-- -----------------------------------------------------------------------------
DO $$
DECLARE n bigint;
BEGIN
  SELECT COALESCE(sum(satir), 0) INTO n FROM public.fn_faz10c_ayna_kaymasi();
  IF n <> 0 THEN RAISE EXCEPTION 'FAZ 10c-1/02: sonda kayma %', n; END IF;
  RAISE NOTICE 'FAZ 10c-1/02: yazma yolu acik (providers + alt profiller + 2 RPC), ters ayna 3 tetikleyici, gorunum saglayici tarafindan; kayma 0';
END $$;
