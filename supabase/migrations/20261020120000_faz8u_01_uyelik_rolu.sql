-- =============================================================================
-- FAZ 8-U / DB 01 — Uyelik rolu: ince rol korunur + org_member_set_role RPC
-- Kaynak: docs/envanter/20-faz8-event-os-modulleri.md bolum 2
--
-- Sorun: FAZ 0 aynasi (eski agency_members / business_members -> organization_memberships)
-- eski satirdaki HER guncellemede `role = EXCLUDED.role` yazar; SQL ile verilen ince roller
-- (sales, project_manager, crew_coordinator, finance) eziliyordu.
--
-- 1) Ayna tetikleyici fonksiyonlari: ON CONFLICT DO UPDATE'te rol yalniz eski rol GERCEKTEN
--    degistiyse yazilir (TG_OP = 'UPDATE' ve member_role ayniysa mevcut rol korunur). INSERT ve
--    DELETE dallari FAZ 0 ile birebir. Govdeler 20260915150100_faz0_02 dosyasindan kopyalandi,
--    yalniz `role =` satiri degisti.
-- 2) RPC org_member_set_role(p_membership_id, p_role): members.manage; kendi rolu degismez;
--    owner_seed (kurulus sahibi) degismez; owner/admin vermek ya da owner/admin'i dusurmek
--    yalniz owner (ya da platform yoneticisi); son aktif owner dusurulemez; uyelik active olmali.
--    Yazim sirasi: once ESKI tablo (legacy_source'a gore; map_org_role_to_legacy), sonra
--    organization_memberships.role — ayna AFTER tetikleyicisi once calisir, RPC'nin yazimi
--    gecerli kalir. internal.log_access ile kayit.
-- Yetki: organization_memberships UPDATE uygulamaya verilmez (yalniz SELECT; tek yol RPC).
-- Tablo/sutun/enum degisikligi YOK. Idempotan (CREATE OR REPLACE).
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Ayna: ince rolu koru
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_agency_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
          -- FAZ 8-U: eski rol degismediyse ince rol (sales, finance, ...) korunur
          role            = CASE
                              WHEN TG_OP = 'UPDATE' AND NEW.member_role IS NOT DISTINCT FROM OLD.member_role
                                THEN organization_memberships.role
                              ELSE EXCLUDED.role
                            END,
          joined_at       = EXCLUDED.joined_at;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_org_sync_error(TG_NAME, TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM);
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_business_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
          -- FAZ 8-U: eski rol degismediyse ince rol korunur
          role            = CASE
                              WHEN TG_OP = 'UPDATE' AND NEW.member_role IS NOT DISTINCT FROM OLD.member_role
                                THEN organization_memberships.role
                              ELSE EXCLUDED.role
                            END,
          joined_at       = EXCLUDED.joined_at;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_org_sync_error(TG_NAME, TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM);
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. RPC: kurulus rolunu degistir
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_member_set_role(p_membership_id uuid, p_role public.organization_member_role)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE
  m             public.organization_memberships;
  v_caller      uuid := auth.uid();
  v_caller_role public.organization_member_role;
  v_owner_count integer;
  v_legacy_role text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'oturum gerekir' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO m FROM public.organization_memberships WHERE id = p_membership_id;
  IF m.id IS NULL THEN
    RAISE EXCEPTION 'uyelik yok' USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM internal.assert_org_permission(m.organization_id, 'members.manage', 'organization_memberships', m.id);

  IF m.status <> 'active' THEN
    RAISE EXCEPTION 'uyelik aktif degil (%)', m.status USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF m.user_id = v_caller THEN
    RAISE EXCEPTION 'kendi rolunu degistiremezsin' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF m.legacy_source = 'owner_seed' THEN
    RAISE EXCEPTION 'kurulus sahibinin rolu degistirilemez' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF m.role = p_role THEN
    RETURN true; -- idempotan
  END IF;

  SELECT role INTO v_caller_role
    FROM public.organization_memberships
   WHERE organization_id = m.organization_id AND user_id = v_caller AND status = 'active';

  -- owner/admin vermek ya da owner/admin'i dusurmek: yalniz owner (platform yoneticisi dahil)
  IF (p_role IN ('owner', 'admin') OR m.role IN ('owner', 'admin'))
     AND NOT (v_caller_role = 'owner' OR public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'owner/admin rolunu yalniz kurulus sahibi degistirir' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- son aktif owner korunur
  IF m.role = 'owner' AND p_role <> 'owner' THEN
    SELECT count(*) INTO v_owner_count
      FROM public.organization_memberships
     WHERE organization_id = m.organization_id AND role = 'owner' AND status = 'active';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'son sahip dusurulemez' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  -- once eski tablo (ayna AFTER tetikleyicisi mapped rolu yazar), sonra ince rol
  v_legacy_role := public.map_org_role_to_legacy(p_role);
  IF m.legacy_source = 'agency_members' THEN
    UPDATE public.agency_members SET member_role = v_legacy_role::public.agency_member_role WHERE id = m.id;
  ELSIF m.legacy_source = 'business_members' THEN
    UPDATE public.business_members SET member_role = v_legacy_role::public.business_member_role WHERE id = m.id;
  END IF;

  UPDATE public.organization_memberships SET role = p_role WHERE id = m.id;

  PERFORM internal.log_access(m.organization_id, 'write', 'organization_memberships', m.id,
                              jsonb_build_object('op', 'member.set_role', 'from', m.role, 'to', p_role));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.org_member_set_role(uuid, public.organization_member_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_member_set_role(uuid, public.organization_member_role) TO authenticated, service_role;
COMMENT ON FUNCTION public.org_member_set_role(uuid, public.organization_member_role) IS
  'FAZ 8-U: kurulus uyesinin ince rolunu degistirir (members.manage; owner/admin yalniz owner; son owner ve owner_seed korunur). Eski tablo + organization_memberships birlikte.';

COMMIT;
