-- =============================================================================
-- DUZELTME 15-E - ajansa bagli profesyonelin teklifi
-- (Fahri satir 36; bulgu 131; karar 1-A) - Plan: docs/sahne/duzeltme-15-plan.md
--
--   Profesyonel hem kendi profiliyle hem ajansinin ekibinde gorunuyor; musteri
--   ayni kisi icin iki ayri teklif alabiliyordu. Karar 1-A: profesyonel secer -
--   "Bana gelen talepler: kendim teklif veririm / ajansim uzerinden"
--   (varsayilan kendim). "Ajansim uzerinden" seciliyse ona gelen talep ajansa
--   gider, teklifi ajans verir; musteri ayni kisi icin iki teklif almaz.
--
--   1) organization_memberships.offers_via_agency (varsayilan false).
--   2) Tutarlilik tetikleyicisi: tercih yalniz AJANS kurulusunun, kurulusun
--      kendi hesabi olmayan PROFESYONEL uyesinde ve AKTIF uyelikte acilir;
--      uyelik aktif degilse kendiliginden kapanir. Kisi basina en cok bir ajans
--      (kismi tekil indeks).
--   3) org_member_set_offer_routing(p_org, p_via_agency): uye KENDI tercihini
--      yazar. Tabloya dogrudan yazma yetkisi yok (yalniz RPC), degismedi.
--   4) fn_duz15_teklif_yonlendirme(p_profesyoneller): talep acan taraf icin
--      "bu profesyonelin talebi hangi ajansa gider". Yalniz ACIK ekip
--      (organization_team_public: ajans ve uye yayinda + onayli) doner; bu bag
--      zaten kamuya acik, yeni bilgi sizmaz. Giris gerekir.
--
-- Yonlendirmenin kendisi uygulamada (teklif topla alici secimi, profilden
-- dogrudan talep); burada yalniz tercih ve okuma yolu var.
-- Idempotan.
-- Kontrol: docs/envanter/asama34-duzeltme15e-kontrol.sql (yapi),
-- asama34b-duzeltme15e-davranis.sql (davranis, YALNIZ dal).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Sutun + kisi basina tek ajans
-- -----------------------------------------------------------------------------
ALTER TABLE public.organization_memberships
  ADD COLUMN IF NOT EXISTS offers_via_agency boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organization_memberships.offers_via_agency IS
  'Duzeltme 15-E: uyenin tercihi - ona gelen talepler bu ajans uzerinden yanitlanir (teklifi ajans verir). Yalniz org_member_set_offer_routing ile yazilir.';

CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_offers_via_agency_key
  ON public.organization_memberships (user_id)
  WHERE offers_via_agency;

-- -----------------------------------------------------------------------------
-- 2) Tutarlilik: tercih kimde acilabilir
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_duz15_uyelik_teklif_tercihi()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tur text;
  v_kurulus_hesabi uuid;
  v_rol text;
BEGIN
  IF NOT NEW.offers_via_agency THEN
    RETURN NEW;
  END IF;

  -- Aktif olmayan uyelikte tercih kendiliginden kapanir (askiya alma, davet).
  IF NEW.status <> 'active' THEN
    NEW.offers_via_agency := false;
    RETURN NEW;
  END IF;

  SELECT o.account_type::text, o.legacy_profile_id
    INTO v_tur, v_kurulus_hesabi
    FROM public.organizations o
   WHERE o.id = NEW.organization_id;
  SELECT p.role::text INTO v_rol FROM public.profiles p WHERE p.id = NEW.user_id;

  IF v_tur IS DISTINCT FROM 'agency'
     OR NEW.user_id IS NOT DISTINCT FROM v_kurulus_hesabi
     OR NEW.legacy_source IS NOT DISTINCT FROM 'owner_seed'
     OR v_rol IS DISTINCT FROM 'professional' THEN
    RAISE EXCEPTION 'Ajans uzerinden teklif tercihi yalniz ajans kurulusunun profesyonel uyesinde acilir'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_duz15_uyelik_teklif_tercihi ON public.organization_memberships;
CREATE TRIGGER trg_duz15_uyelik_teklif_tercihi
  BEFORE INSERT OR UPDATE OF offers_via_agency, status
  ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION public.fn_duz15_uyelik_teklif_tercihi();

-- -----------------------------------------------------------------------------
-- 3) Uye kendi tercihini yazar
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_member_set_offer_routing(p_org uuid, p_via_agency boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'internal'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  m record;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'oturum gerekir' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_via_agency IS NULL THEN
    RAISE EXCEPTION 'tercih bos olamaz' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT id, status, offers_via_agency INTO m
    FROM public.organization_memberships
   WHERE organization_id = p_org AND user_id = v_caller;
  IF m.id IS NULL THEN
    RAISE EXCEPTION 'bu kurulusun uyesi degilsin' USING ERRCODE = 'no_data_found';
  END IF;
  IF m.status <> 'active' THEN
    RAISE EXCEPTION 'uyelik aktif degil' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF m.offers_via_agency IS NOT DISTINCT FROM p_via_agency THEN
    RETURN p_via_agency;
  END IF;

  IF p_via_agency THEN
    -- Kisi basina tek ajans: baska ajanstaki tercih kapanir.
    UPDATE public.organization_memberships
       SET offers_via_agency = false
     WHERE user_id = v_caller AND id <> m.id AND offers_via_agency;
  END IF;

  -- Uygunluk (ajans + profesyonel uye) tetikleyicide dogrulanir.
  UPDATE public.organization_memberships
     SET offers_via_agency = p_via_agency
   WHERE id = m.id;

  PERFORM internal.log_access(p_org, 'write', 'organization_memberships', m.id,
                              jsonb_build_object('op', 'member.offer_routing', 'via_agency', p_via_agency));
  RETURN p_via_agency;
END;
$$;

COMMENT ON FUNCTION public.org_member_set_offer_routing(uuid, boolean) IS
  'Duzeltme 15-E: uye kendi "ajansim uzerinden teklif" tercihini yazar. Yalniz ajans kurulusunun profesyonel uyesi acabilir; acinca baska ajanstaki tercihi kapanir.';

REVOKE ALL ON FUNCTION public.org_member_set_offer_routing(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_member_set_offer_routing(uuid, boolean) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4) Talep hangi ajansa gider (okuma)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_duz15_teklif_yonlendirme(p_profesyoneller uuid[])
RETURNS TABLE (professional_id uuid, agency_id uuid, agency_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.user_id,
         t.agency_id,
         COALESCE(NULLIF(btrim(o.display_name), ''),
                  NULLIF(btrim(pa.company_name), ''),
                  NULLIF(btrim(pa.full_name), ''),
                  'Ajans')
    FROM public.organization_team_public t
    JOIN public.organization_memberships om
      ON om.id = t.membership_id AND om.offers_via_agency
    JOIN public.organizations o ON o.id = t.organization_id
    JOIN public.profiles pa ON pa.id = t.agency_id
   WHERE auth.uid() IS NOT NULL
     AND p_profesyoneller IS NOT NULL
     AND cardinality(p_profesyoneller) <= 1000
     AND t.user_id = ANY (p_profesyoneller);
$$;

COMMENT ON FUNCTION public.fn_duz15_teklif_yonlendirme(uuid[]) IS
  'Duzeltme 15-E: "ajansim uzerinden" tercihi acik profesyonellerin talebinin gidecegi ajans (pazaryeri profil kimligi + ad). Yalniz acik ekip (organization_team_public); giris gerekir.';

REVOKE ALL ON FUNCTION public.fn_duz15_teklif_yonlendirme(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_duz15_teklif_yonlendirme(uuid[]) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5) Yapi dogrulamasi
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'organization_memberships'
                    AND column_name = 'offers_via_agency' AND is_nullable = 'NO') THEN
    RAISE EXCEPTION 'Duzeltme 15-E: organization_memberships.offers_via_agency yok';
  END IF;
  IF has_table_privilege('authenticated', 'public.organization_memberships', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.organization_memberships', 'offers_via_agency', 'UPDATE') THEN
    RAISE EXCEPTION 'Duzeltme 15-E: uyelik tablosu istemciye yazilabilir (tercih yalniz RPC ile yazilmali)';
  END IF;
  IF has_function_privilege('anon', 'public.org_member_set_offer_routing(uuid, boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.fn_duz15_teklif_yonlendirme(uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'Duzeltme 15-E: fonksiyon girissize acik';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.org_member_set_offer_routing(uuid, boolean)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.fn_duz15_teklif_yonlendirme(uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'Duzeltme 15-E: fonksiyon uyelere kapali';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organization_memberships WHERE offers_via_agency) THEN
    RAISE NOTICE 'Duzeltme 15-E: tercihi acik uyelik var (yeniden calistirma)';
  END IF;
END;
$$;
