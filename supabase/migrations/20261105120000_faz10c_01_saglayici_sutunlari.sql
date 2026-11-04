-- =============================================================================
-- FAZ 10c-1 / 01 - Saglayici sutunlari + ileri ayna genisler (VERI: kopya ve kayma esitleme; 5 Kasim 2026)
-- Kaynak: docs/envanter/38-faz10-temizlik.md bolum 10c (kararlar bolum 4: madde 3, 4).
--   SEMA (ekleyen): providers.attributes / category_attributes (jsonb, varsayilan '{}') + views_count; GIN
--   idx_providers_category_attributes_gin (jsonb_path_ops; profiles'taki eski GIN 10c-2'de duser); anon/authenticated
--   yeni sutunlari okur. Kayma olcer public.fn_faz10c_ayna_kaymasi() (alan, satir) - 02, 03 ve asama20 K8b kullanir.
--   Ileri ayna (profiles -> providers) attributes / category_attributes'i da tasir; kashe.sync_bypass ONCEKI degerine
--   doner (ic ice aynalar bayragi erken kapatmasin - 02'deki ters ayna ile birlikte calisir). ensure_provider_for_profile
--   ilk satirda yeni sutunlari doldurur.
--   VERI: (1) uc sutun profiles'tan kopyalanir; (2) FAZ 2a aynasinin tasidigi alanlarda (ad, sehir, onay/askiya alma, yayin,
--   bio, birincil rol) kayma varsa bugunku kaynaktan (profiles) yeniden esitlenir, sayisi NOTICE olur; (3) kayma 0 RAISE ile
--   dogrulanir. providers.updated_at kopya sirasinda degismez (tetikleyici gecici kapali, ayni blokta acilir ve dogrulanir).
--   Davranis DEGISMEZ: uygulama hala profiles'a yazar ve okur. Gorunum + yazma yolu 02'de; profiles kilidi P1'den sonra 03'te.
-- Idempotan: ikinci kosuda 0 satir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Sutunlar, indeks, okuma yetkisi
-- -----------------------------------------------------------------------------
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS attributes          jsonb   NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS category_attributes jsonb   NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS views_count         integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_providers_category_attributes_gin
  ON public.providers USING gin (category_attributes jsonb_path_ops);

GRANT SELECT (attributes, category_attributes, views_count) ON public.providers TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2) Kayma olcer: providers ile profiles kopyalari (ve alt profil bio'su, birincil rol) arasindaki fark
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz10c_ayna_kaymasi()
RETURNS TABLE (alan text, satir bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH b AS (
    SELECT pr.id, pr.provider_type, pr.display_name, pr.city_id, pr.approval_status, pr.approval_note, pr.approved_at,
           pr.suspended_at, pr.suspension_reason, pr.suspended_by, pr.is_published, pr.attributes, pr.category_attributes,
           pr.views_count,
           p.role, p.full_name, p.company_name, p.bio AS p_bio, p.city_id AS p_city, p.approval_status AS p_onay,
           p.approval_note AS p_not, p.approved_at AS p_onay_zamani, p.suspended_at AS p_askiya, p.suspension_reason AS p_neden,
           p.suspended_by AS p_askiya_alan, p.is_published AS p_yayin, p.attributes AS p_attr, p.category_attributes AS p_kattr,
           p.views_count AS p_views,
           CASE WHEN pr.provider_type = 'professional'
                THEN (SELECT pp.bio FROM public.professional_profiles pp WHERE pp.provider_id = pr.id)
                ELSE (SELECT op.about FROM public.organization_profiles op WHERE op.provider_id = pr.id) END AS s_bio,
           (SELECT ps.role_id FROM public.provider_services ps WHERE ps.provider_id = pr.id AND ps.is_primary) AS s_rol,
           (SELECT sr.id FROM public.service_roles sr WHERE sr.legacy_category_id = p.primary_category_id) AS p_rol
      FROM public.providers pr
      JOIN public.profiles p ON p.id = pr.id
     WHERE p.role IN ('professional', 'agency')
  )
  SELECT x.alan, x.satir FROM (
    SELECT 'display_name' AS alan, count(*) FILTER (WHERE display_name IS DISTINCT FROM
             (CASE WHEN role = 'professional' THEN NULLIF(full_name, '')
                   ELSE COALESCE(NULLIF(company_name, ''), NULLIF(full_name, '')) END)) AS satir, 1 AS sira FROM b
    UNION ALL SELECT 'city_id', count(*) FILTER (WHERE city_id IS DISTINCT FROM p_city), 2 FROM b
    UNION ALL SELECT 'onay_askiya', count(*) FILTER (WHERE (approval_status::text, approval_note, approved_at, suspended_at, suspension_reason, suspended_by)
                     IS DISTINCT FROM (p_onay::text, p_not, p_onay_zamani, p_askiya, p_neden, p_askiya_alan)), 3 FROM b
    UNION ALL SELECT 'is_published', count(*) FILTER (WHERE is_published IS DISTINCT FROM p_yayin), 4 FROM b
    UNION ALL SELECT 'attributes', count(*) FILTER (WHERE attributes IS DISTINCT FROM p_attr), 5 FROM b
    UNION ALL SELECT 'category_attributes', count(*) FILTER (WHERE category_attributes IS DISTINCT FROM p_kattr), 6 FROM b
    UNION ALL SELECT 'views_count', count(*) FILTER (WHERE views_count IS DISTINCT FROM p_views), 7 FROM b
    UNION ALL SELECT 'bio', count(*) FILTER (WHERE s_bio IS DISTINCT FROM p_bio), 8 FROM b
    UNION ALL SELECT 'birincil_rol', count(*) FILTER (WHERE s_rol IS DISTINCT FROM p_rol), 9 FROM b
  ) x ORDER BY x.sira;
$$;
REVOKE ALL ON FUNCTION public.fn_faz10c_ayna_kaymasi() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3) Ileri ayna (profiles -> providers): + attributes / category_attributes; bayrak onceki degerine doner
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_profile_to_provider()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prov uuid;
  v_name text;
  v_onceki text;
BEGIN
  IF NEW.role NOT IN ('professional', 'agency') THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_prov := public.ensure_provider_for_profile(NEW.id);

    IF TG_OP = 'UPDATE' AND v_prov IS NOT NULL THEN
      v_name := CASE WHEN NEW.role = 'professional'
                     THEN NULLIF(NEW.full_name, '')
                     ELSE COALESCE(NULLIF(NEW.company_name, ''), NULLIF(NEW.full_name, '')) END;

      v_onceki := current_setting('kashe.sync_bypass', true);
      PERFORM set_config('kashe.sync_bypass', 'on', true);
      UPDATE public.providers pr
         SET display_name        = v_name,
             city_id             = NEW.city_id,
             approval_status     = NEW.approval_status,
             approval_note       = NEW.approval_note,
             approved_at         = NEW.approved_at,
             suspended_at        = NEW.suspended_at,
             suspension_reason   = NEW.suspension_reason,
             suspended_by        = NEW.suspended_by,
             is_published        = NEW.is_published,
             attributes          = NEW.attributes,
             category_attributes = NEW.category_attributes
       WHERE pr.id = v_prov
         AND (pr.display_name        IS DISTINCT FROM v_name
           OR pr.city_id             IS DISTINCT FROM NEW.city_id
           OR pr.approval_status     IS DISTINCT FROM NEW.approval_status
           OR pr.approval_note       IS DISTINCT FROM NEW.approval_note
           OR pr.approved_at         IS DISTINCT FROM NEW.approved_at
           OR pr.suspended_at        IS DISTINCT FROM NEW.suspended_at
           OR pr.suspension_reason   IS DISTINCT FROM NEW.suspension_reason
           OR pr.suspended_by        IS DISTINCT FROM NEW.suspended_by
           OR pr.is_published        IS DISTINCT FROM NEW.is_published
           OR pr.attributes          IS DISTINCT FROM NEW.attributes
           OR pr.category_attributes IS DISTINCT FROM NEW.category_attributes);
      PERFORM set_config('kashe.sync_bypass', COALESCE(NULLIF(v_onceki, ''), 'off'), true);

      IF NEW.role = 'professional' THEN
        UPDATE public.talents t SET full_name = NULLIF(NEW.full_name, '')
         WHERE t.user_id = NEW.id AND t.full_name IS DISTINCT FROM NULLIF(NEW.full_name, '');
        UPDATE public.professional_profiles pp SET bio = NEW.bio
         WHERE pp.provider_id = v_prov AND pp.bio IS DISTINCT FROM NEW.bio;
      ELSE
        UPDATE public.organization_profiles op SET about = NEW.bio
         WHERE op.provider_id = v_prov AND op.about IS DISTINCT FROM NEW.bio;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('kashe.sync_bypass', COALESCE(NULLIF(v_onceki, ''), 'off'), true);
    PERFORM public.log_org_sync_error(TG_NAME, TG_OP, NEW.id, SQLERRM);
  END;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4) ensure_provider_for_profile: ilk satir yeni sutunlarla acilir (govdenin geri kalani FAZ 2a ile ayni)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_provider_for_profile(p_profile_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p        record;
  v_org    uuid;
  v_talent uuid;
  v_slug   text;
  v_name   text;
BEGIN
  SELECT id, role, full_name, company_name, bio, city_id, slug, is_published,
         approval_status, approval_note, approved_at, suspended_at, suspension_reason, suspended_by, created_at,
         attributes, category_attributes, views_count
    INTO p
    FROM public.profiles
   WHERE id = p_profile_id;

  IF p.id IS NULL OR p.role NOT IN ('professional', 'agency') THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.providers WHERE id = p.id) THEN
    -- alt profil eksikse tamamla (guvence)
    IF p.role = 'professional' THEN
      INSERT INTO public.professional_profiles (provider_id, bio) VALUES (p.id, p.bio) ON CONFLICT (provider_id) DO NOTHING;
    ELSE
      INSERT INTO public.organization_profiles (provider_id, about) VALUES (p.id, p.bio) ON CONFLICT (provider_id) DO NOTHING;
    END IF;
    RETURN p.id;
  END IF;

  v_slug := CASE
    WHEN p.slug IS NOT NULL AND char_length(p.slug) BETWEEN 3 AND 120
         AND NOT EXISTS (SELECT 1 FROM public.providers WHERE slug = p.slug)
      THEN p.slug
    ELSE 'p-' || replace(p.id::text, '-', '')
  END;

  IF p.role = 'professional' THEN
    v_name := NULLIF(p.full_name, '');

    SELECT id INTO v_talent FROM public.talents WHERE user_id = p.id;
    IF v_talent IS NULL THEN
      INSERT INTO public.talents (id, user_id, full_name, origin, claim_status, claimed_at, created_at)
      VALUES (p.id, p.id, v_name, 'marketplace_signup', 'claimed', p.created_at, p.created_at)
      ON CONFLICT (id) DO NOTHING
      RETURNING id INTO v_talent;
      IF v_talent IS NULL THEN
        SELECT id INTO v_talent FROM public.talents WHERE user_id = p.id;
      END IF;
    END IF;

    INSERT INTO public.providers
      (id, provider_type, talent_id, display_name, slug, city_id,
       approval_status, approval_note, approved_at, suspended_at, suspension_reason, suspended_by,
       is_published, created_at, attributes, category_attributes, views_count)
    VALUES
      (p.id, 'professional', v_talent, v_name, v_slug, p.city_id,
       p.approval_status, p.approval_note, p.approved_at, p.suspended_at, p.suspension_reason, p.suspended_by,
       p.is_published, p.created_at, COALESCE(p.attributes, '{}'::jsonb), COALESCE(p.category_attributes, '{}'::jsonb),
       COALESCE(p.views_count, 0))
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.professional_profiles (provider_id, bio) VALUES (p.id, p.bio)
    ON CONFLICT (provider_id) DO NOTHING;

  ELSE  -- agency
    v_org := public.ensure_organization_for_profile(p.id);
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'agency % icin kurulus olusturulamadi', p.id;
    END IF;
    v_name := COALESCE(NULLIF(p.company_name, ''), NULLIF(p.full_name, ''));

    INSERT INTO public.providers
      (id, provider_type, organization_id, display_name, slug, city_id,
       approval_status, approval_note, approved_at, suspended_at, suspension_reason, suspended_by,
       is_published, created_at, attributes, category_attributes, views_count)
    VALUES
      (p.id, 'organization', v_org, v_name, v_slug, p.city_id,
       p.approval_status, p.approval_note, p.approved_at, p.suspended_at, p.suspension_reason, p.suspended_by,
       p.is_published, p.created_at, COALESCE(p.attributes, '{}'::jsonb), COALESCE(p.category_attributes, '{}'::jsonb),
       COALESCE(p.views_count, 0))
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.organization_profiles (provider_id, about) VALUES (p.id, p.bio)
    ON CONFLICT (provider_id) DO NOTHING;
  END IF;

  RETURN p.id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5) VERI: kopya + kayma esitleme + dogrulama (tek blok = tek islem)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  n_kopya int := 0; n_alan int := 0; n_bio int := 0; n_rol int := 0; n int := 0; n_kalan bigint; r record; v_ozet text := '';
BEGIN
  -- kayma raporu (esitlemeden ONCE; uc yeni sutun bu noktada henuz kopyalanmadi, sayilmaz)
  FOR r IN SELECT * FROM public.fn_faz10c_ayna_kaymasi() WHERE alan NOT IN ('attributes', 'category_attributes', 'views_count') AND satir > 0 LOOP
    v_ozet := v_ozet || r.alan || '=' || r.satir || ' ';
  END LOOP;

  PERFORM set_config('kashe.sync_bypass', 'on', true);   -- koruma tetikleyicisi onay alanlarini geri almasin
  ALTER TABLE public.providers DISABLE TRIGGER on_providers_updated;

  -- (1) uc yeni sutun
  UPDATE public.providers pr
     SET attributes = COALESCE(p.attributes, '{}'::jsonb),
         category_attributes = COALESCE(p.category_attributes, '{}'::jsonb),
         views_count = COALESCE(p.views_count, 0)
    FROM public.profiles p
   WHERE p.id = pr.id
     AND (pr.attributes IS DISTINCT FROM COALESCE(p.attributes, '{}'::jsonb)
       OR pr.category_attributes IS DISTINCT FROM COALESCE(p.category_attributes, '{}'::jsonb)
       OR pr.views_count IS DISTINCT FROM COALESCE(p.views_count, 0));
  GET DIAGNOSTICS n_kopya = ROW_COUNT;

  -- (2) FAZ 2a alanlari: kayma varsa profiles'tan (bugunku kaynak)
  UPDATE public.providers pr
     SET display_name = CASE WHEN p.role = 'professional' THEN NULLIF(p.full_name, '')
                             ELSE COALESCE(NULLIF(p.company_name, ''), NULLIF(p.full_name, '')) END,
         city_id = p.city_id, approval_status = p.approval_status, approval_note = p.approval_note,
         approved_at = p.approved_at, suspended_at = p.suspended_at, suspension_reason = p.suspension_reason,
         suspended_by = p.suspended_by, is_published = p.is_published
    FROM public.profiles p
   WHERE p.id = pr.id AND p.role IN ('professional', 'agency')
     AND (pr.display_name IS DISTINCT FROM (CASE WHEN p.role = 'professional' THEN NULLIF(p.full_name, '')
                                                 ELSE COALESCE(NULLIF(p.company_name, ''), NULLIF(p.full_name, '')) END)
       OR pr.city_id IS DISTINCT FROM p.city_id OR pr.approval_status IS DISTINCT FROM p.approval_status
       OR pr.approval_note IS DISTINCT FROM p.approval_note OR pr.approved_at IS DISTINCT FROM p.approved_at
       OR pr.suspended_at IS DISTINCT FROM p.suspended_at OR pr.suspension_reason IS DISTINCT FROM p.suspension_reason
       OR pr.suspended_by IS DISTINCT FROM p.suspended_by OR pr.is_published IS DISTINCT FROM p.is_published);
  GET DIAGNOSTICS n_alan = ROW_COUNT;

  ALTER TABLE public.providers ENABLE TRIGGER on_providers_updated;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_providers_updated' AND tgrelid = 'public.providers'::regclass AND tgenabled = 'D') THEN
    RAISE EXCEPTION 'on_providers_updated kapali kaldi';
  END IF;

  UPDATE public.professional_profiles pp SET bio = p.bio
    FROM public.profiles p WHERE p.id = pp.provider_id AND p.role = 'professional' AND pp.bio IS DISTINCT FROM p.bio;
  GET DIAGNOSTICS n_bio = ROW_COUNT;
  UPDATE public.organization_profiles op SET about = p.bio
    FROM public.profiles p WHERE p.id = op.provider_id AND p.role = 'agency' AND op.about IS DISTINCT FROM p.bio;
  GET DIAGNOSTICS n = ROW_COUNT;
  n_bio := n_bio + n;

  FOR r IN
    SELECT pr.id FROM public.providers pr JOIN public.profiles p ON p.id = pr.id
     WHERE p.role IN ('professional', 'agency')
       AND (SELECT ps.role_id FROM public.provider_services ps WHERE ps.provider_id = pr.id AND ps.is_primary)
           IS DISTINCT FROM (SELECT sr.id FROM public.service_roles sr WHERE sr.legacy_category_id = p.primary_category_id)
  LOOP
    PERFORM public.recompute_provider_services(r.id);
    n_rol := n_rol + 1;
  END LOOP;
  PERFORM set_config('kashe.sync_bypass', 'off', true);

  -- (3) dogrulama
  SELECT COALESCE(sum(satir), 0) INTO n_kalan FROM public.fn_faz10c_ayna_kaymasi();
  IF n_kalan <> 0 THEN
    RAISE EXCEPTION 'FAZ 10c-1/01: esitlemeden sonra kayma kaldi (%): %', n_kalan,
      (SELECT string_agg(alan || '=' || satir, ' ') FROM public.fn_faz10c_ayna_kaymasi() WHERE satir > 0);
  END IF;

  RAISE NOTICE 'FAZ 10c-1/01: % saglayiciya attributes/category_attributes/views_count kopyalandi; once kayma: %; esitlenen: % saglayici satiri, % bio, % birincil rol; kalan kayma 0',
    n_kopya, COALESCE(NULLIF(v_ozet, ''), 'yok'), n_alan, n_bio, n_rol;
END $$;
