-- =============================================================================
-- FAZ 0 / 04 — Yetki fonksiyonlarinin kaynagi organization_memberships olur
--
-- 15 Eylul - 22 Eylul arasi docs/envanter/bekleyen/20260915150300_... adiyla bekledi (kosul: 01-03 uretime cikar,
--   asama5-faz0-tutarlilik.sql uretimde birkac gun SIFIR fark ve organization_sync_log SIFIR kayit).
--   22 Eylul'de zincire alindi; zaman damgasi yenilendi cunku CLI, uzak gecmisteki son surumden ESKI
--   bir yerel dosyayi --include-all olmadan uygulamaz (zincir sirasi korunur). Icerik degismedi.
--
-- NE YAPAR (04-goc-plani FAZ 0 madde 10; 05 RLS goc stratejisi "fonksiyon araciligi"):
--   has_business_role, is_business_member, is_business_member_of_request govdeleri
--   organization_memberships + organizations.legacy_profile_id uzerinden okur. IMZALAR AYNI,
--   bu fonksiyonlari cagiran 25 politika metnine DOKUNULMAZ.
--   bookings."Assigned pros read team bookings" agency_members'i dogrudan okuyan TEK politikadir;
--   yeni is_agency_member(uuid) fonksiyonuyla yeniden yazilir.
--
-- DAVRANIS BIREBIR KORUNUR:
--   * Eski tablolar kurucuyu (agency/business profilinin kendisi) icermez; kurucunun
--     owner_seed uyeligi bu fonksiyonlarda SAYILMAZ (user_id <> legacy_profile_id).
--     Politikalar kurucuyu zaten "business_id = auth.uid()" ile ayrica kapsar.
--   * Rol siralamasi eski uc seviyeye indirgenir: owner=3, admin(manager)=2, diger=1.
--   * Yalniz status = 'active' uyelikler sayilir (eski tabloda durum yok = hepsi aktif).
--
-- GERI ALMA: 20260620090200_faz_minus1_03_yetki_fonksiyonlari.sql ve
--   20260701120000_business_member_shared_visibility.sql icindeki eski govdeler
--   CREATE OR REPLACE ile geri yazilir; bookings politikasi 06_politikalar'daki metinle.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.has_business_role(p_business_id uuid, p_min_role business_member_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.organization_memberships om
      JOIN public.organizations o ON o.id = om.organization_id
     WHERE o.legacy_profile_id = p_business_id
       AND o.account_type = 'business'
       AND om.user_id = auth.uid()
       AND om.status = 'active'
       AND om.user_id <> o.legacy_profile_id
       AND (CASE public.map_org_role_to_legacy(om.role)
              WHEN 'owner'   THEN 3
              WHEN 'manager' THEN 2
              ELSE                1
            END)
           >=
           (CASE p_min_role
              WHEN 'owner'   THEN 3
              WHEN 'manager' THEN 2
              WHEN 'member'  THEN 1
            END)
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_business_member(p_business_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.organization_memberships om
      JOIN public.organizations o ON o.id = om.organization_id
     WHERE o.legacy_profile_id = p_business_id
       AND o.account_type = 'business'
       AND om.user_id = auth.uid()
       AND om.status = 'active'
       AND om.user_id <> o.legacy_profile_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_business_member_of_request(p_request_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.quote_requests q
      JOIN public.organizations o ON o.legacy_profile_id = q.customer_id AND o.account_type = 'business'
      JOIN public.organization_memberships om ON om.organization_id = o.id
     WHERE q.id = p_request_id
       AND om.user_id = auth.uid()
       AND om.status = 'active'
       AND om.user_id <> o.legacy_profile_id
  );
$function$;

-- Ajans uyeligi (eski: agency_members.agency_id = X AND professional_id = auth.uid())
CREATE OR REPLACE FUNCTION public.is_agency_member(p_agency_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.organization_memberships om
      JOIN public.organizations o ON o.id = om.organization_id
     WHERE o.legacy_profile_id = p_agency_id
       AND o.account_type = 'agency'
       AND om.user_id = auth.uid()
       AND om.status = 'active'
       AND om.user_id <> o.legacy_profile_id
  );
$function$;

REVOKE ALL ON FUNCTION public.is_agency_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_agency_member(uuid) TO authenticated, service_role;

-- agency_members'i dogrudan okuyan tek politika
DROP POLICY IF EXISTS "Assigned pros read team bookings" ON public.bookings;
CREATE POLICY "Assigned pros read team bookings" ON public.bookings
  FOR SELECT
  USING (public.is_agency_member(bookings.professional_id));

COMMIT;
