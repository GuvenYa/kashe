-- =============================================================================
-- FAZ 2a / 02 — profiles -> saglayici defteri aynalamasi (cift alan donemi)
--
-- Kaynak: 04-goc-plani.md FAZ 2 madde 13-14 ve "cift alan donemi ... senkron tetikleyici";
--         FAZ 0'daki fn_sync_profile_to_organization ile ayni kalip.
-- Plan: docs/envanter/11-faz2-saglayici-defteri.md
--
-- NE YAPAR:
--   ensure_provider_for_profile(uuid): professional icin talents + providers + professional_profiles,
--     agency icin (once ensure_organization_for_profile) providers + organization_profiles satirlarini
--     YOKSA olusturur; id = profil id. Dolum (03) ve tetikleyici bunu kullanir.
--   trg_faz2_sync_profile_to_provider: profiles INSERT/UPDATE -> providers (display_name, city_id,
--     approval_*, suspended_*, is_published), talents.full_name, professional_profiles.bio /
--     organization_profiles.about. profiles KAYNAK kalir; yeni tablolar okunmaz (FAZ 2c'ye kadar).
--   Koruma tetikleyicisi (providers) admin olmayan baglamda yonetici alanlarini geri alir; aynalama
--   kashe.sync_bypass = 'on' ile bunu atlar (profil tarafinda ayni alanlar zaten
--   protect_sensitive_profile_fields ile korunuyor; aynalanan deger hep mesru).
--   Hata eski akisi KESMEZ: organization_sync_log'a duser (FAZ 0 ile ortak gunluk; source alani ayirir).
--
-- Idempotan. Sapkali harf yok.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_provider_for_profile(p_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p        record;
  v_org    uuid;
  v_talent uuid;
  v_slug   text;
  v_name   text;
BEGIN
  SELECT id, role, full_name, company_name, bio, city_id, slug, is_published,
         approval_status, approval_note, approved_at, suspended_at, suspension_reason, suspended_by, created_at
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
       is_published, created_at)
    VALUES
      (p.id, 'professional', v_talent, v_name, v_slug, p.city_id,
       p.approval_status, p.approval_note, p.approved_at, p.suspended_at, p.suspension_reason, p.suspended_by,
       p.is_published, p.created_at)
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
       is_published, created_at)
    VALUES
      (p.id, 'organization', v_org, v_name, v_slug, p.city_id,
       p.approval_status, p.approval_note, p.approved_at, p.suspended_at, p.suspension_reason, p.suspended_by,
       p.is_published, p.created_at)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.organization_profiles (provider_id, about) VALUES (p.id, p.bio)
    ON CONFLICT (provider_id) DO NOTHING;
  END IF;

  RETURN p.id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_provider_for_profile(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_provider_for_profile(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- Aynalama tetikleyicisi
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_profile_to_provider()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prov uuid;
  v_name text;
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

      PERFORM set_config('kashe.sync_bypass', 'on', true);
      UPDATE public.providers pr
         SET display_name      = v_name,
             city_id           = NEW.city_id,
             approval_status   = NEW.approval_status,
             approval_note     = NEW.approval_note,
             approved_at       = NEW.approved_at,
             suspended_at      = NEW.suspended_at,
             suspension_reason = NEW.suspension_reason,
             suspended_by      = NEW.suspended_by,
             is_published      = NEW.is_published
       WHERE pr.id = v_prov
         AND (pr.display_name      IS DISTINCT FROM v_name
           OR pr.city_id           IS DISTINCT FROM NEW.city_id
           OR pr.approval_status   IS DISTINCT FROM NEW.approval_status
           OR pr.approval_note     IS DISTINCT FROM NEW.approval_note
           OR pr.approved_at       IS DISTINCT FROM NEW.approved_at
           OR pr.suspended_at      IS DISTINCT FROM NEW.suspended_at
           OR pr.suspension_reason IS DISTINCT FROM NEW.suspension_reason
           OR pr.suspended_by      IS DISTINCT FROM NEW.suspended_by
           OR pr.is_published      IS DISTINCT FROM NEW.is_published);
      PERFORM set_config('kashe.sync_bypass', 'off', true);

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
    PERFORM set_config('kashe.sync_bypass', 'off', true);
    PERFORM public.log_org_sync_error(TG_NAME, TG_OP, NEW.id, SQLERRM);
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_sync_profile_to_provider() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_faz2_sync_profile_to_provider ON public.profiles;
CREATE TRIGGER trg_faz2_sync_profile_to_provider
  AFTER INSERT OR UPDATE OF role, full_name, company_name, bio, city_id, slug, is_published,
                            approval_status, approval_note, approved_at,
                            suspended_at, suspension_reason, suspended_by
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_profile_to_provider();

COMMIT;
