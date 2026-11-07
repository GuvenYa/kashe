-- =============================================================================
-- DUZELTME 13 - adaylarda ajans rol kapsami (Fahri satir 32; bulgu 125)
-- Plan: docs/sahne/duzeltme-12-14-plan.md (13-C)
--
--   Hibrit ekipte ajans adaylari ayri listede duruyordu ve ekibe SECILEMIYORDU.
--   Fahri'nin onerisi: her rol sutununda tekil profesyoneller ve o rolu
--   kapsayan ajanslar birlikte, ayrim yalniz rozetle; ajans da secilebilir.
--
--   Hangi ajansin hangi rolu kapsadigi eslestirme fonksiyonunun
--   (run_event_match 7b) kurali ile ayni: ajansin KENDI hizmeti o rolde VEYA
--   aktif bir ekip uyesinin o rolde hizmeti var. Uye listesi baska kurulusa
--   kapali oldugu icin (organization_memberships RLS) bu bilgi istemciden
--   okunamaz; yalniz (saglayici, rol) ciftini donduren definer fonksiyon.
--   Uye kimligi DONMEZ. Yalniz etkinligi gorebilen kullanici sorgular.
--
-- Kontrol: docs/envanter/asama32-duzeltme13-kontrol.sql (yapi),
-- asama32b-duzeltme13-davranis.sql (davranis, YALNIZ dal).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_duz13_ajans_rol_kapsami(p_run uuid)
RETURNS TABLE (provider_id uuid, role_id integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT mc.provider_id, rq.role_id
    FROM public.match_runs mr
    JOIN public.events e ON e.id = mr.event_id
    JOIN public.match_candidates mc
      ON mc.match_run_id = mr.id AND mc.role_id IS NULL
    JOIN public.event_requirements rq ON rq.event_id = mr.event_id
   WHERE mr.id = p_run
     AND auth.uid() IS NOT NULL
     AND public.can_access_event_scope(e.owner_user_id, e.organization_id, 'events.view')
     AND (
       EXISTS (SELECT 1 FROM public.provider_services ps
                WHERE ps.provider_id = mc.provider_id AND ps.role_id = rq.role_id)
       OR EXISTS (SELECT 1
                    FROM public.organization_memberships om
                    JOIN public.organizations og ON og.id = om.organization_id
                    JOIN public.provider_services ps
                      ON ps.provider_id = om.user_id AND ps.role_id = rq.role_id
                   WHERE og.legacy_profile_id = mc.provider_id
                     AND om.status = 'active'
                     AND om.user_id <> mc.provider_id)
     );
$$;

COMMENT ON FUNCTION public.fn_duz13_ajans_rol_kapsami(uuid) IS
  'Duzeltme 13: eslestirme kosusundaki ajans adaylarinin kapsadigi roller (run_event_match 7b kurali; uye kimligi donmez).';

REVOKE ALL ON FUNCTION public.fn_duz13_ajans_rol_kapsami(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_duz13_ajans_rol_kapsami(uuid) TO authenticated;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.fn_duz13_ajans_rol_kapsami(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Duzeltme 13: ajans rol kapsami girissize acik';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.fn_duz13_ajans_rol_kapsami(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Duzeltme 13: ajans rol kapsami uyelere kapali';
  END IF;
END;
$$;
