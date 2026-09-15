-- =============================================================================
-- FAZ 0 / 02 — Yardimci fonksiyonlar, RLS politikalari, aynalama tetikleyicileri,
--               uyumluluk gorunumleri
--
-- Kaynak: docs/architecture/02-guvenlik-modeli.md bolum 4 (yetki matrisi) ve 5,
--         04-goc-plani.md FAZ 0 madde 5-9. Plan: docs/envanter/08-faz0-kiraci-temeli.md
--
-- NE YAPAR (yalniz ekleme; eski akislar degismez):
--   1) Rol esleme: agency/business_member_role (owner/manager/member) <-> organization_member_role
--      owner -> owner, manager -> admin, member -> viewer (01-veri-modeli bolum 1). Ters yon:
--      owner -> owner, admin -> manager, diger her sey -> member.
--   2) ensure_organization_for_profile(uuid): agency/business rollu profil icin kurulus + kurucu
--      (owner_seed) uyeligi yoksa olusturur, id doner. Aynalama ve dolum bunu kullanir.
--   3) is_org_member, org_role_permissions, has_org_permission — 02 bolum 4 matrisinin kodu.
--      Izin anahtarlari: belgedeki 11 anahtar + matrisi ifade etmek icin 4 ek
--      (talent.view, proposals.view, proposals.manage, billing.manage). "admin ayarlar kismi" =
--      billing.manage yalniz owner'da.
--   4) RLS politikalari (yalniz SELECT): uyeler kendi kurulusunu/ekibini gorur; davetler
--      members.manage yetkisi veya davetli; sync_log yalniz admin.
--   5) AYNALAMA (cift yazma, veritabani tarafinda): profiles -> organizations;
--      agency_members / business_members -> organization_memberships (AYNI id);
--      agency_invitations / business_invitations -> organization_invitations (AYNI id).
--      Tetikleyiciler AFTER calisir, SECURITY DEFINER'dir, hata olursa ESKI AKISI KESMEZ:
--      hata organization_sync_log'a yazilir (04-goc-plani FAZ 0 madde 9).
--   6) Uyumluluk gorunumleri v_agency_members / v_business_members (security_invoker):
--      tutarlilik sorgusu (asama5-faz0-tutarlilik.sql) eski tabloyla EXCEPT karsilastirir.
--
-- DOKUNULMAYAN: has_business_role, is_business_member, is_business_member_of_request
--   govdeleri ve tum mevcut politikalar (04 dosyasi, tutarlilik kontrolu sonrasi).
--
-- Idempotan: CREATE OR REPLACE / DROP IF EXISTS. Sapkali harf yok.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Rol esleme
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.map_legacy_member_role(p_role text)
RETURNS public.organization_member_role
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'owner'   THEN 'owner'::public.organization_member_role
    WHEN 'manager' THEN 'admin'::public.organization_member_role
    ELSE                'viewer'::public.organization_member_role
  END
$$;

CREATE OR REPLACE FUNCTION public.map_org_role_to_legacy(p_role public.organization_member_role)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'owner' THEN 'owner'
    WHEN 'admin' THEN 'manager'
    ELSE              'member'
  END
$$;

-- -----------------------------------------------------------------------------
-- 2) Kurulus bulma / olusturma
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.organization_id_for_profile(p_profile_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id FROM public.organizations o WHERE o.legacy_profile_id = p_profile_id
$$;

CREATE OR REPLACE FUNCTION public.ensure_organization_for_profile(p_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p     record;
  v_org uuid;
  v_slug text;
BEGIN
  SELECT id, role, company_name, full_name, city_id, slug, premium_tier, premium_until, created_at
    INTO p
    FROM public.profiles
   WHERE id = p_profile_id;

  IF p.id IS NULL OR p.role NOT IN ('agency', 'business') THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_org FROM public.organizations WHERE legacy_profile_id = p.id;

  IF v_org IS NULL THEN
    -- slug: profil slug'i bossa ya da baska bir kurulusta kullaniliyorsa uuid tabanli slug
    v_slug := CASE
      WHEN p.slug IS NOT NULL AND char_length(p.slug) BETWEEN 3 AND 120
           AND NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = p.slug)
        THEN p.slug
      ELSE 'org-' || replace(p.id::text, '-', '')
    END;

    INSERT INTO public.organizations
      (slug, account_type, display_name, city_id, owner_user_id,
       subscription_tier, subscription_until, legacy_profile_id, created_at)
    VALUES
      (v_slug, p.role::public.organization_account_type,
       COALESCE(NULLIF(p.company_name, ''), NULLIF(p.full_name, '')),
       p.city_id, p.id, p.premium_tier, p.premium_until, p.id, p.created_at)
    ON CONFLICT (legacy_profile_id) DO NOTHING
    RETURNING id INTO v_org;

    IF v_org IS NULL THEN
      SELECT id INTO v_org FROM public.organizations WHERE legacy_profile_id = p.id;
    END IF;
  END IF;

  -- kurucu uyeligi (eski tablolarda yok: agency_members/business_members kurucuyu icermez)
  INSERT INTO public.organization_memberships (organization_id, user_id, role, status, joined_at, legacy_source)
  VALUES (v_org, p.id, 'owner', 'active', p.created_at, 'owner_seed')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_organization_for_profile(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_organization_for_profile(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 3) Yetki fonksiyonlari
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships om
     WHERE om.organization_id = p_org_id
       AND om.user_id = auth.uid()
       AND om.status = 'active'
  )
$$;

-- 02-guvenlik-modeli bolum 4 matrisi. Anahtarlar:
--   events.view events.manage crew.view crew.manage talent.view talent.manage
--   commercial.view commercial.manage proposals.view proposals.manage
--   finance.view finance.manage settings.manage members.manage billing.manage
-- commercial.view = ic maliyeti gorme (internal sema erisimi). sales ve project_manager
-- teklif hazirlar (proposals.manage / proposals.view) ama commercial.view ALMAZ.
CREATE OR REPLACE FUNCTION public.org_role_permissions(p_role public.organization_member_role)
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'owner' THEN ARRAY[
      'events.view','events.manage','crew.view','crew.manage','talent.view','talent.manage',
      'commercial.view','commercial.manage','proposals.view','proposals.manage',
      'finance.view','finance.manage','settings.manage','members.manage','billing.manage']
    WHEN 'admin' THEN ARRAY[
      'events.view','events.manage','crew.view','crew.manage','talent.view','talent.manage',
      'commercial.view','commercial.manage','proposals.view','proposals.manage',
      'finance.view','finance.manage','settings.manage','members.manage']
    WHEN 'sales' THEN ARRAY[
      'events.view','events.manage','crew.view','talent.view','proposals.view','proposals.manage']
    WHEN 'project_manager' THEN ARRAY[
      'events.view','events.manage','crew.view','crew.manage','talent.view','talent.manage','proposals.view']
    WHEN 'crew_coordinator' THEN ARRAY[
      'events.view','crew.view','crew.manage','talent.view','talent.manage']
    WHEN 'finance' THEN ARRAY[
      'events.view','crew.view','talent.view','commercial.view','commercial.manage',
      'proposals.view','finance.view','finance.manage']
    WHEN 'viewer' THEN ARRAY['events.view','crew.view']
  END
$$;

-- permissions jsonb ince ayari: {"commercial.view": true} verir, {"crew.manage": false} alir;
-- anahtar yoksa rolun varsayilani gecerlidir.
CREATE OR REPLACE FUNCTION public.has_org_permission(p_org_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships om
     WHERE om.organization_id = p_org_id
       AND om.user_id = auth.uid()
       AND om.status = 'active'
       AND CASE
             WHEN om.permissions ? p_permission THEN (om.permissions ->> p_permission) = 'true'
             ELSE p_permission = ANY (public.org_role_permissions(om.role))
           END
  )
$$;

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_org_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_permission(uuid, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4) RLS politikalari — yalniz SELECT
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS organizations_select_member ON public.organizations;
CREATE POLICY organizations_select_member ON public.organizations
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_org_member(id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS organization_memberships_select_member ON public.organization_memberships;
CREATE POLICY organization_memberships_select_member ON public.organization_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(organization_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS organization_invitations_select ON public.organization_invitations;
CREATE POLICY organization_invitations_select ON public.organization_invitations
  FOR SELECT TO authenticated
  USING (invited_user_id = auth.uid()
      OR invited_email = auth.email()
      OR public.has_org_permission(organization_id, 'members.manage')
      OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS organization_modules_select_member ON public.organization_modules;
CREATE POLICY organization_modules_select_member ON public.organization_modules
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS organization_sync_log_select_admin ON public.organization_sync_log;
CREATE POLICY organization_sync_log_select_admin ON public.organization_sync_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- -----------------------------------------------------------------------------
-- 5) Aynalama tetikleyicileri
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_org_sync_error(p_source text, p_operation text, p_legacy_id uuid, p_detail text)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.organization_sync_log (source, operation, legacy_id, detail)
  VALUES (p_source, p_operation, p_legacy_id, left(p_detail, 2000))
$$;
REVOKE ALL ON FUNCTION public.log_org_sync_error(text, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- 5a) profiles -> organizations
--   INSERT: agency/business rollu profil kaydolunca kurulus + kurucu uyeligi olusur
--           (handle_new_user'in yazdigi profil satiri bu tetikleyiciyi tetikler).
--   UPDATE: profil hala kaynak oldugu icin ad, sehir, abonelik kurulusa yansir.
--   Rol agency/business DISINA cikarsa kurulus silinmez (tutarlilik sorgusu raporlar).
CREATE OR REPLACE FUNCTION public.fn_sync_profile_to_organization()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_display text;
BEGIN
  IF NEW.role NOT IN ('agency', 'business') THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_org := public.ensure_organization_for_profile(NEW.id);

    IF TG_OP = 'UPDATE' AND v_org IS NOT NULL THEN
      v_display := COALESCE(NULLIF(NEW.company_name, ''), NULLIF(NEW.full_name, ''));
      UPDATE public.organizations o
         SET account_type       = NEW.role::public.organization_account_type,
             display_name       = v_display,
             city_id            = NEW.city_id,
             subscription_tier  = NEW.premium_tier,
             subscription_until = NEW.premium_until
       WHERE o.id = v_org
         AND (o.account_type       IS DISTINCT FROM NEW.role::public.organization_account_type
           OR o.display_name       IS DISTINCT FROM v_display
           OR o.city_id            IS DISTINCT FROM NEW.city_id
           OR o.subscription_tier  IS DISTINCT FROM NEW.premium_tier
           OR o.subscription_until IS DISTINCT FROM NEW.premium_until);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_org_sync_error(TG_NAME, TG_OP, NEW.id, SQLERRM);
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_faz0_sync_profile_to_organization ON public.profiles;
CREATE TRIGGER trg_faz0_sync_profile_to_organization
  AFTER INSERT OR UPDATE OF role, company_name, full_name, city_id, premium_tier, premium_until
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_profile_to_organization();

-- 5b) agency_members -> organization_memberships (ayni id)
CREATE OR REPLACE FUNCTION public.fn_sync_agency_member()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM public.organization_memberships WHERE id = OLD.id;
      RETURN OLD;
    END IF;

    v_org := public.ensure_organization_for_profile(NEW.agency_id);
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'agency_id % icin kurulus yok (profil rolu agency degil?)', NEW.agency_id;
    END IF;

    INSERT INTO public.organization_memberships
      (id, organization_id, user_id, role, status, joined_at, legacy_source)
    VALUES
      (NEW.id, v_org, NEW.professional_id, public.map_legacy_member_role(NEW.member_role::text),
       'active', NEW.joined_at, 'agency_members')
    ON CONFLICT (id) DO UPDATE
      SET organization_id = EXCLUDED.organization_id,
          user_id         = EXCLUDED.user_id,
          role            = EXCLUDED.role,
          joined_at       = EXCLUDED.joined_at;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_org_sync_error(TG_NAME, TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM);
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_faz0_sync_agency_member ON public.agency_members;
CREATE TRIGGER trg_faz0_sync_agency_member
  AFTER INSERT OR UPDATE OR DELETE ON public.agency_members
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_agency_member();

-- 5c) business_members -> organization_memberships (ayni id)
CREATE OR REPLACE FUNCTION public.fn_sync_business_member()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM public.organization_memberships WHERE id = OLD.id;
      RETURN OLD;
    END IF;

    v_org := public.ensure_organization_for_profile(NEW.business_id);
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'business_id % icin kurulus yok (profil rolu business degil?)', NEW.business_id;
    END IF;

    INSERT INTO public.organization_memberships
      (id, organization_id, user_id, role, status, joined_at, legacy_source)
    VALUES
      (NEW.id, v_org, NEW.member_user_id, public.map_legacy_member_role(NEW.member_role::text),
       'active', NEW.joined_at, 'business_members')
    ON CONFLICT (id) DO UPDATE
      SET organization_id = EXCLUDED.organization_id,
          user_id         = EXCLUDED.user_id,
          role            = EXCLUDED.role,
          joined_at       = EXCLUDED.joined_at;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_org_sync_error(TG_NAME, TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM);
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_faz0_sync_business_member ON public.business_members;
CREATE TRIGGER trg_faz0_sync_business_member
  AFTER INSERT OR UPDATE OR DELETE ON public.business_members
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_business_member();

-- 5d) agency_invitations -> organization_invitations (ayni id)
CREATE OR REPLACE FUNCTION public.fn_sync_agency_invitation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM public.organization_invitations WHERE id = OLD.id;
      RETURN OLD;
    END IF;

    v_org := public.ensure_organization_for_profile(NEW.agency_id);
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'agency_id % icin kurulus yok', NEW.agency_id;
    END IF;

    INSERT INTO public.organization_invitations
      (id, organization_id, invited_email, invited_user_id, invited_by_id, role, status,
       invitation_message, created_at, responded_at, expires_at, legacy_source)
    VALUES
      (NEW.id, v_org, NEW.invited_email, NEW.invited_user_id, NEW.invited_by_id,
       public.map_legacy_member_role(NEW.member_role::text),
       NEW.status::text::public.organization_invitation_status,
       NEW.invitation_message, NEW.created_at, NEW.responded_at, NEW.expires_at, 'agency_invitations')
    ON CONFLICT (id) DO UPDATE
      SET organization_id    = EXCLUDED.organization_id,
          invited_email      = EXCLUDED.invited_email,
          invited_user_id    = EXCLUDED.invited_user_id,
          invited_by_id      = EXCLUDED.invited_by_id,
          role               = EXCLUDED.role,
          status             = EXCLUDED.status,
          invitation_message = EXCLUDED.invitation_message,
          responded_at       = EXCLUDED.responded_at,
          expires_at         = EXCLUDED.expires_at;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_org_sync_error(TG_NAME, TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM);
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_faz0_sync_agency_invitation ON public.agency_invitations;
CREATE TRIGGER trg_faz0_sync_agency_invitation
  AFTER INSERT OR UPDATE OR DELETE ON public.agency_invitations
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_agency_invitation();

-- 5e) business_invitations -> organization_invitations (ayni id)
CREATE OR REPLACE FUNCTION public.fn_sync_business_invitation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM public.organization_invitations WHERE id = OLD.id;
      RETURN OLD;
    END IF;

    v_org := public.ensure_organization_for_profile(NEW.business_id);
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'business_id % icin kurulus yok', NEW.business_id;
    END IF;

    INSERT INTO public.organization_invitations
      (id, organization_id, invited_email, invited_user_id, invited_by_id, role, status,
       invitation_message, created_at, responded_at, expires_at, legacy_source)
    VALUES
      (NEW.id, v_org, NEW.invited_email, NEW.invited_user_id, NEW.invited_by_id,
       public.map_legacy_member_role(NEW.member_role::text),
       NEW.status::text::public.organization_invitation_status,
       NEW.invitation_message, NEW.created_at, NEW.responded_at, NEW.expires_at, 'business_invitations')
    ON CONFLICT (id) DO UPDATE
      SET organization_id    = EXCLUDED.organization_id,
          invited_email      = EXCLUDED.invited_email,
          invited_user_id    = EXCLUDED.invited_user_id,
          invited_by_id      = EXCLUDED.invited_by_id,
          role               = EXCLUDED.role,
          status             = EXCLUDED.status,
          invitation_message = EXCLUDED.invitation_message,
          responded_at       = EXCLUDED.responded_at,
          expires_at         = EXCLUDED.expires_at;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_org_sync_error(TG_NAME, TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM);
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_faz0_sync_business_invitation ON public.business_invitations;
CREATE TRIGGER trg_faz0_sync_business_invitation
  AFTER INSERT OR UPDATE OR DELETE ON public.business_invitations
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_business_invitation();

REVOKE ALL ON FUNCTION public.fn_sync_profile_to_organization() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_sync_agency_member()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_sync_business_member()         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_sync_agency_invitation()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_sync_business_invitation()     FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6) Uyumluluk gorunumleri — eski tablonun seklinde, yeni tablodan okur.
--    security_invoker: sorgulayanin RLS'i gecerli (postgres sahipligiyle sizinti olmaz).
--    Kurucu (user_id = legacy_profile_id) eski tablolarda yoktur, gorunumde de yoktur.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_agency_members
WITH (security_invoker = true) AS
SELECT om.id,
       o.legacy_profile_id AS agency_id,
       om.user_id          AS professional_id,
       public.map_org_role_to_legacy(om.role)::public.agency_member_role AS member_role,
       om.joined_at
  FROM public.organization_memberships om
  JOIN public.organizations o ON o.id = om.organization_id
 WHERE o.account_type = 'agency'
   AND om.user_id IS DISTINCT FROM o.legacy_profile_id;

CREATE OR REPLACE VIEW public.v_business_members
WITH (security_invoker = true) AS
SELECT om.id,
       o.legacy_profile_id AS business_id,
       om.user_id          AS member_user_id,
       public.map_org_role_to_legacy(om.role)::public.business_member_role AS member_role,
       om.joined_at
  FROM public.organization_memberships om
  JOIN public.organizations o ON o.id = om.organization_id
 WHERE o.account_type = 'business'
   AND om.user_id IS DISTINCT FROM o.legacy_profile_id;

REVOKE ALL ON public.v_agency_members, public.v_business_members FROM anon;
GRANT SELECT ON public.v_agency_members, public.v_business_members TO authenticated, service_role;

COMMIT;
