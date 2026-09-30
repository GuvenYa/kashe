-- =============================================================================
-- FAZ 5 / 03 — Ekibim -> havuz kaydi RPC'leri (aynalama tetikleyicisi YERINE, uygulama cagirir)
--
-- Karar (17 bolum 2): agency_members'a aynalama tetikleyicisi yok; yeni uyelikler icin havuz kaydini UYGULAMA yazar.
-- Ancak agency_members satirini davet kabulunde bir DB tetikleyicisi (on_*_invitation_accepted_add_member) yaratir ve
-- kabul eden PROFESYONEL'dir (kurulusun talent.manage uyesi degil) -> dogrudan INSERT RLS'ten gecmez. Bu yuzden iki
-- dar, idempotan, SECURITY DEFINER RPC:
--   ensure_talent_record_for_membership(p_agency_member_id)  cagiran = o satirin profesyoneli VEYA kurulusta talent.manage
--   sync_org_talent_pool(p_org_id)                            cagiran = kurulusta talent.manage; kurulusun havuz kaydi olmayan
--                                                             tum agency_members satirlarini tamamlar; olusturulan sayiyi doner
-- Ikisi de faz5_backfill_agency_members ile AYNI kurali uygular (marketplace_linked, legacy_agency_member_id, roller
-- provider_services'tan). asama13 K5 (kayma) bu RPC'lerle sifirda tutulur; havuz sayfasi acilirken sync cagrilir.
--
-- Idempotan. Sapkali harf yok. VERI YAZMAZ (cagrilinca yazar).
-- =============================================================================

BEGIN;

-- Ortak govde: tek agency_members satiri icin kayit (yoksa) + roller (yoksa). Yetki kontrolu YOK — cagiranlar yapar.
CREATE OR REPLACE FUNCTION public.fn_faz5_ensure_record_for_member(p_agency_member_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE am record; v_org uuid; v_talent uuid; v_rec uuid;
BEGIN
  SELECT a.id, a.agency_id, a.professional_id, a.joined_at INTO am FROM public.agency_members a WHERE a.id = p_agency_member_id;
  IF am.id IS NULL THEN RAISE EXCEPTION 'agency_members satiri yok' USING ERRCODE = 'no_data_found'; END IF;
  SELECT o.id INTO v_org FROM public.organizations o WHERE o.legacy_profile_id = am.agency_id;
  SELECT t.id INTO v_talent FROM public.talents t WHERE t.user_id = am.professional_id AND t.claim_status <> 'merged';
  IF v_org IS NULL OR v_talent IS NULL THEN
    RAISE EXCEPTION 'kurulus veya talent kaydi yok (org=%, talent=%)', v_org, v_talent USING ERRCODE = 'no_data_found';
  END IF;

  SELECT id INTO v_rec FROM public.organization_talent_records WHERE legacy_agency_member_id = am.id;
  IF v_rec IS NULL THEN
    SELECT id INTO v_rec FROM public.organization_talent_records
     WHERE organization_id = v_org AND talent_id = v_talent AND legacy_agency_member_id IS NULL;
    IF v_rec IS NOT NULL THEN
      UPDATE public.organization_talent_records SET legacy_agency_member_id = am.id WHERE id = v_rec;
    ELSE
      INSERT INTO public.organization_talent_records
        (organization_id, talent_id, name, source, visibility, relationship_type, status, linked_at, legacy_agency_member_id, created_by)
      SELECT v_org, v_talent, COALESCE(NULLIF(trim(p.full_name), ''), 'Kashe uyesi'),
             'marketplace_linked', 'private', 'regular_freelancer', 'active', am.joined_at, am.id, am.agency_id
        FROM public.profiles p WHERE p.id = am.professional_id
      RETURNING id INTO v_rec;
    END IF;
  END IF;

  INSERT INTO public.organization_talent_record_roles (record_id, role_id, is_primary)
  SELECT v_rec, ps.role_id, ps.is_primary
    FROM public.provider_services ps
   WHERE ps.provider_id = am.professional_id
     AND NOT EXISTS (SELECT 1 FROM public.organization_talent_record_roles x WHERE x.record_id = v_rec AND x.role_id = ps.role_id)
     AND (NOT ps.is_primary OR NOT EXISTS (SELECT 1 FROM public.organization_talent_record_roles y WHERE y.record_id = v_rec AND y.is_primary));
  RETURN v_rec;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_faz5_ensure_record_for_member(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Profesyonelin kendi uyeligi (davet kabulu) veya kurulusun talent.manage uyesi
CREATE OR REPLACE FUNCTION public.ensure_talent_record_for_membership(p_agency_member_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE am record; v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'giris gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT a.id, a.agency_id, a.professional_id INTO am FROM public.agency_members a WHERE a.id = p_agency_member_id;
  IF am.id IS NULL THEN RAISE EXCEPTION 'agency_members satiri yok' USING ERRCODE = 'no_data_found'; END IF;
  SELECT o.id INTO v_org FROM public.organizations o WHERE o.legacy_profile_id = am.agency_id;
  IF NOT (am.professional_id = auth.uid()
          OR (v_org IS NOT NULL AND public.has_org_permission(v_org, 'talent.manage'))) THEN
    RAISE EXCEPTION 'yetkisiz erisim' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_org IS NULL OR NOT public.org_module_enabled(v_org, 'talent_pool') THEN
    RAISE EXCEPTION 'talent_pool modulu bu kurulusta acik degil' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN public.fn_faz5_ensure_record_for_member(am.id);
END;
$$;

-- Kurulusun tum Ekibim uyeleri icin eksik havuz kayitlarini tamamlar; olusturulan/iz yazilan sayiyi doner
CREATE OR REPLACE FUNCTION public.sync_org_talent_pool(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE v_legacy uuid; am record; n integer := 0;
BEGIN
  PERFORM internal.assert_org_permission(p_org_id, 'talent.manage', 'organization_talent_records');
  IF NOT public.org_module_enabled(p_org_id, 'talent_pool') THEN
    RAISE EXCEPTION 'talent_pool modulu bu kurulusta acik degil' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT legacy_profile_id INTO v_legacy FROM public.organizations WHERE id = p_org_id;
  IF v_legacy IS NULL THEN RETURN 0; END IF;

  FOR am IN
    SELECT a.id FROM public.agency_members a
     WHERE a.agency_id = v_legacy
       AND EXISTS (SELECT 1 FROM public.talents t WHERE t.user_id = a.professional_id AND t.claim_status <> 'merged')
       AND NOT EXISTS (SELECT 1 FROM public.organization_talent_records r
                        WHERE r.organization_id = p_org_id
                          AND r.talent_id = (SELECT t.id FROM public.talents t WHERE t.user_id = a.professional_id AND t.claim_status <> 'merged'))
     ORDER BY a.joined_at
  LOOP
    PERFORM public.fn_faz5_ensure_record_for_member(am.id);
    n := n + 1;
  END LOOP;
  IF n > 0 THEN
    PERFORM internal.log_access(p_org_id, 'write', 'organization_talent_records', NULL, jsonb_build_object('op', 'talent.sync', 'created', n));
  END IF;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_talent_record_for_membership(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_org_talent_pool(uuid)                FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_talent_record_for_membership(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_org_talent_pool(uuid)                TO authenticated, service_role;

COMMIT;
