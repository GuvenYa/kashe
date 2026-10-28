-- =============================================================================
-- FAZ 10a / DB 01 — Uyelik tek tablo: davet + uyelik yazma yolu yalniz organization_memberships /
-- organization_invitations; FAZ 0 aynasi kapanir; eski tablolar salt okunur.
-- Plan: docs/envanter/38-faz10-temizlik.md bolum 10a (madde 43-44).
--
-- 1) Esitlik kontrolu: eski tablolar (agency_members, business_members, agency_invitations,
--    business_invitations) yeni tablolarla ayni id/kullanici/kurulus/durumda olmali; fark varsa RAISE
--    (dosya uygulanmaz). FAZ 0 aynasi ilk gunden calistigi icin uretimde fark beklenmez.
-- 2) notifications.type CHECK'e 'team' eklenir (davet ve katilim bildirimleri; e-posta kuyruguna girmez,
--    uygulama etiketi 10a-P1: 'Ekip').
-- 3) Aynalama KAPANIR: trg_faz0_sync_* (4), on_*_invitation_status_change (2), on_*_insert_notify (4),
--    on_*_validate_roles (2), trg_remove_assignments_on_leave (1) tetikleyicileri ve fonksiyonlari duser;
--    faz5_backfill_agency_members duser.
-- 4) Eski tablolar salt okunur: SELECT disi tum RLS politikalari duser; anon/authenticated'tan INSERT/UPDATE/
--    DELETE/TRUNCATE/REFERENCES/TRIGGER geri alinir. SELECT kalir (uygulama 10a-P1 bitene kadar okur;
--    Hijyen 05'te tablolar DROP).
-- 5) Bekleyen davet tekilligi: mevcut EXCLUDE kisiti (FAZ 0) kalir; RPC cift davette 23505 verir.
-- 6) Yeni tetikleyiciler: fn_faz10_invitation_notify (davetliye /davetlerim, type 'team'),
--    fn_faz10_member_notify (kurulus sahibine "katildi"), fn_faz10_remove_assignments_on_leave
--    (uyelik silinince / askiya alininca kurulusun sohbet atamalari temizlenir — eski trg_remove_assignments_on_leave).
-- 7) RPC'ler (SECURITY DEFINER): org_invitation_create, org_invitation_cancel, org_invitation_respond,
--    org_member_remove, org_member_leave. Rol degisimi mevcut org_member_set_role (eski tablo yazimi kalkti).
--    Kural tasimasi: ajans kurulusuna yalniz 'professional' hesap katilir (eski validate_agency_membership_roles),
--    kurumsal kurulusa herhangi bir hesap; kurulusun kendi hesabi uye olamaz (eski no_self_membership).
-- 8) Eski tabloyu okuyan is mantigi yeni tabloya cevrilir: run_event_match (ajans kapsami Ekibim uyeleri),
--    sync_org_talent_pool, ensure_talent_record_for_membership(p_membership_id) [parametre adi degisti:
--    eski p_agency_member_id; 10a-P1 cagriyi gunceller], fn_faz5_ensure_record_for_member(p_membership_id),
--    ensure_organization_for_profile (yalniz yorum). organization_talent_records.legacy_agency_member_id
--    artik organization_memberships.id tasir (ayna satirlarinda iki id zaten ayni; sutun adi Hijyen 05'te).
-- 9) Acik ekip sozlesmesi: organization_team_public gorunumu (anon/authenticated SELECT) — ajans kurulusunun
--    yayindaki uyeleri (her iki taraf providers'ta yayinda + onayli + askida degil); /p/[id] ekip listesi ve
--    profesyonelin "temsil eden ajans" listesi bunu okur (eski agency_members SELECT USING true yerine; rol acilmaz).
--
-- Uygulama penceresi: bu dosya uygulandiktan sonra 10a-P1 yayinlanana kadar davet/uyelik YAZMA akislari
-- 42501 verir (eski tablolara yazma yetkisi kalkti). Dalda P1 ile birlikte sinanir; uretimde db push + Vercel
-- yayini ayni oturumda yapilir. Okumalar (SELECT) kesintisiz.
-- Test: asama4 T3/T4/T7/T8/T9/T10/T17/T18/T19/T25 uyarlandi, T34 eklendi; asama20 K1-K4.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Esitlik kontrolu (fark varsa uygulanmaz)
-- -----------------------------------------------------------------------------
DO $$
DECLARE n_am int; n_bm int; n_ai int; n_bi int; n int;
BEGIN
  SELECT count(*) INTO n FROM public.agency_members am
   WHERE NOT EXISTS (SELECT 1 FROM public.organization_memberships om
                       JOIN public.organizations o ON o.id = om.organization_id
                      WHERE om.id = am.id AND om.user_id = am.professional_id AND o.legacy_profile_id = am.agency_id);
  IF n > 0 THEN RAISE EXCEPTION 'FAZ 10a: agency_members -> organization_memberships farki (% satir)', n; END IF;
  SELECT count(*) INTO n FROM public.business_members bm
   WHERE NOT EXISTS (SELECT 1 FROM public.organization_memberships om
                       JOIN public.organizations o ON o.id = om.organization_id
                      WHERE om.id = bm.id AND om.user_id = bm.member_user_id AND o.legacy_profile_id = bm.business_id);
  IF n > 0 THEN RAISE EXCEPTION 'FAZ 10a: business_members -> organization_memberships farki (% satir)', n; END IF;
  SELECT count(*) INTO n FROM public.organization_memberships om
   WHERE (om.legacy_source = 'agency_members'   AND NOT EXISTS (SELECT 1 FROM public.agency_members   x WHERE x.id = om.id))
      OR (om.legacy_source = 'business_members' AND NOT EXISTS (SELECT 1 FROM public.business_members x WHERE x.id = om.id));
  IF n > 0 THEN RAISE EXCEPTION 'FAZ 10a: organization_memberships -> eski tablo farki (% satir)', n; END IF;
  SELECT count(*) INTO n FROM public.agency_invitations ai
   WHERE NOT EXISTS (SELECT 1 FROM public.organization_invitations oi
                       JOIN public.organizations o ON o.id = oi.organization_id
                      WHERE oi.id = ai.id AND oi.status::text = ai.status::text AND o.legacy_profile_id = ai.agency_id);
  IF n > 0 THEN RAISE EXCEPTION 'FAZ 10a: agency_invitations -> organization_invitations farki (% satir)', n; END IF;
  SELECT count(*) INTO n FROM public.business_invitations bi
   WHERE NOT EXISTS (SELECT 1 FROM public.organization_invitations oi
                       JOIN public.organizations o ON o.id = oi.organization_id
                      WHERE oi.id = bi.id AND oi.status::text = bi.status::text AND o.legacy_profile_id = bi.business_id);
  IF n > 0 THEN RAISE EXCEPTION 'FAZ 10a: business_invitations -> organization_invitations farki (% satir)', n; END IF;
  SELECT count(*) INTO n FROM (SELECT organization_id, invited_email FROM public.organization_invitations
                                WHERE status = 'pending' GROUP BY 1, 2 HAVING count(*) > 1) x;
  IF n > 0 THEN RAISE EXCEPTION 'FAZ 10a: ayni kurulus + e-posta icin birden fazla bekleyen davet (% cift)', n; END IF;

  SELECT count(*) INTO n_am FROM public.agency_members;
  SELECT count(*) INTO n_bm FROM public.business_members;
  SELECT count(*) INTO n_ai FROM public.agency_invitations;
  SELECT count(*) INTO n_bi FROM public.business_invitations;
  RAISE NOTICE 'FAZ 10a esitlik: agency_members % | business_members % | agency_invitations % | business_invitations % (fark 0)',
    n_am, n_bm, n_ai, n_bi;
END $$;

-- -----------------------------------------------------------------------------
-- 2. notifications.type: 'team'
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['message', 'review', 'review_reply', 'listing_invitation', 'booking_request',
                           'rfp', 'proposal', 'task', 'crm', 'team']));

-- -----------------------------------------------------------------------------
-- 3. Aynalama ve eski tetikleyiciler kapanir
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_faz0_sync_agency_member            ON public.agency_members;
DROP TRIGGER IF EXISTS trg_faz0_sync_business_member          ON public.business_members;
DROP TRIGGER IF EXISTS trg_faz0_sync_agency_invitation        ON public.agency_invitations;
DROP TRIGGER IF EXISTS trg_faz0_sync_business_invitation      ON public.business_invitations;
DROP TRIGGER IF EXISTS on_agency_invitation_status_change     ON public.agency_invitations;
DROP TRIGGER IF EXISTS on_business_invitation_status_change   ON public.business_invitations;
DROP TRIGGER IF EXISTS on_agency_invitation_insert_notify     ON public.agency_invitations;
DROP TRIGGER IF EXISTS on_business_invitation_insert_notify   ON public.business_invitations;
DROP TRIGGER IF EXISTS on_agency_member_insert_notify         ON public.agency_members;
DROP TRIGGER IF EXISTS on_business_member_insert_notify       ON public.business_members;
DROP TRIGGER IF EXISTS on_agency_member_insert_validate_roles ON public.agency_members;
DROP TRIGGER IF EXISTS on_business_member_insert_validate_roles ON public.business_members;
DROP TRIGGER IF EXISTS trg_remove_assignments_on_leave        ON public.agency_members;

DROP FUNCTION IF EXISTS public.fn_sync_agency_member();
DROP FUNCTION IF EXISTS public.fn_sync_business_member();
DROP FUNCTION IF EXISTS public.fn_sync_agency_invitation();
DROP FUNCTION IF EXISTS public.fn_sync_business_invitation();
DROP FUNCTION IF EXISTS public.on_agency_invitation_accepted_add_member();
DROP FUNCTION IF EXISTS public.on_business_invitation_accepted_add_member();
DROP FUNCTION IF EXISTS public.on_agency_invitation_insert_notify();
DROP FUNCTION IF EXISTS public.on_business_invitation_insert_notify();
DROP FUNCTION IF EXISTS public.on_agency_member_insert_notify_agency();
DROP FUNCTION IF EXISTS public.on_business_member_insert_notify_business();
DROP FUNCTION IF EXISTS public.validate_agency_membership_roles();
DROP FUNCTION IF EXISTS public.validate_business_membership_roles();
DROP FUNCTION IF EXISTS public.fn_remove_assignments_on_leave();
DROP FUNCTION IF EXISTS public.faz5_backfill_agency_members();

-- -----------------------------------------------------------------------------
-- 4. Eski tablolar salt okunur
-- -----------------------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename IN ('agency_members', 'business_members', 'agency_invitations', 'business_invitations')
              AND cmd <> 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.agency_members, public.business_members, public.agency_invitations, public.business_invitations
  FROM anon, authenticated;
COMMENT ON TABLE public.agency_members IS 'FAZ 10a: SALT OKUNUR (eski). Gercek: organization_memberships. Hijyen 05: DROP.';
COMMENT ON TABLE public.business_members IS 'FAZ 10a: SALT OKUNUR (eski). Gercek: organization_memberships. Hijyen 05: DROP.';
COMMENT ON TABLE public.agency_invitations IS 'FAZ 10a: SALT OKUNUR (eski). Gercek: organization_invitations. Hijyen 05: DROP.';
COMMENT ON TABLE public.business_invitations IS 'FAZ 10a: SALT OKUNUR (eski). Gercek: organization_invitations. Hijyen 05: DROP.';

-- -----------------------------------------------------------------------------
-- 5. Bekleyen davet tekil (kurulus + e-posta): mevcut EXCLUDE kisiti organization_invitations_no_duplicate_pending
--    (FAZ 0) zaten korur (23P01); RPC once kendisi bakar ve 23505 ('Bu e-postaya zaten bekleyen bir davet var') verir.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 6. Yeni tetikleyiciler (bildirim + atama temizligi)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_faz10_invitation_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o record;
BEGIN
  IF NEW.invited_user_id IS NULL OR NEW.status <> 'pending' THEN RETURN NEW; END IF;
  SELECT display_name, account_type INTO o FROM public.organizations WHERE id = NEW.organization_id;
  INSERT INTO public.notifications (user_id, type, body, link)
  VALUES (NEW.invited_user_id, 'team',
          COALESCE(NULLIF(o.display_name, ''), CASE WHEN o.account_type = 'agency' THEN 'Bir ajans' ELSE 'Bir kurum' END)
            || CASE WHEN o.account_type = 'agency' THEN ' seni ajansına davet etti' ELSE ' seni kurumsal ekibine davet etti' END,
          '/davetlerim');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_faz10_invitation_notify ON public.organization_invitations;
CREATE TRIGGER trg_faz10_invitation_notify
  AFTER INSERT ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz10_invitation_notify();

CREATE OR REPLACE FUNCTION public.fn_faz10_member_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o record; v_name text;
BEGIN
  IF NEW.status <> 'active' OR NEW.legacy_source = 'owner_seed' THEN RETURN NEW; END IF;
  SELECT owner_user_id, legacy_profile_id, account_type INTO o FROM public.organizations WHERE id = NEW.organization_id;
  IF o.owner_user_id IS NULL OR o.owner_user_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, type, body, link)
  VALUES (o.owner_user_id, 'team',
          COALESCE(NULLIF(v_name, ''), CASE WHEN o.account_type = 'agency' THEN 'Bir profesyonel' ELSE 'Bir kullanıcı' END)
            || CASE WHEN o.account_type = 'agency' THEN ' ajansına katıldı' ELSE ' kurumsal ekibine katıldı' END,
          CASE WHEN o.account_type = 'agency' THEN '/profil/ekibim' ELSE '/profil/kurumsal-ekip' END);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_faz10_member_notify ON public.organization_memberships;
CREATE TRIGGER trg_faz10_member_notify
  AFTER INSERT ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz10_member_notify();

-- Eski trg_remove_assignments_on_leave: uye kurulustan cikinca (satir silinir ya da askiya alinir) kurulusun
-- sohbetlerindeki atamalari (conversation_assignees) gider. Sohbet sahibi = kurulusun eski profil kimligi.
CREATE OR REPLACE FUNCTION public.fn_faz10_remove_assignments_on_leave()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_legacy uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.status = 'active' OR OLD.status <> 'active') THEN RETURN NEW; END IF;
  SELECT legacy_profile_id INTO v_legacy FROM public.organizations WHERE id = OLD.organization_id;
  IF v_legacy IS NOT NULL THEN
    DELETE FROM public.conversation_assignees ca
     USING public.conversations c
     WHERE ca.conversation_id = c.id AND ca.professional_id = OLD.user_id AND c.professional_id = v_legacy;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_faz10_remove_assignments_on_leave ON public.organization_memberships;
CREATE TRIGGER trg_faz10_remove_assignments_on_leave
  AFTER DELETE OR UPDATE OF status ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION public.fn_faz10_remove_assignments_on_leave();

-- -----------------------------------------------------------------------------
-- 7. RPC'ler
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_invitation_create(
  p_org uuid, p_email text, p_role public.organization_member_role DEFAULT 'viewer', p_message text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'internal' AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_email  text;
  v_msg    text;
  v_user   uuid;
  v_id     uuid;
  org      record;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'oturum gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  PERFORM internal.assert_org_permission(p_org, 'members.manage', 'organization_invitations');
  SELECT id, account_type, legacy_profile_id INTO org FROM public.organizations WHERE id = p_org;

  v_email := lower(trim(COALESCE(p_email, '')));
  IF v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'gecersiz e-posta adresi' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_role IS NULL OR p_role = 'owner' THEN
    RAISE EXCEPTION 'sahip rolu davetle verilemez' USING ERRCODE = 'invalid_parameter_value'; END IF;
  v_msg := NULLIF(trim(COALESCE(p_message, '')), '');
  IF char_length(v_msg) > 1000 THEN
    RAISE EXCEPTION 'davet mesaji en fazla 1000 karakter' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF v_email = lower(COALESCE(auth.email(), '')) THEN
    RAISE EXCEPTION 'kendine davet gonderemezsin' USING ERRCODE = 'invalid_parameter_value'; END IF;

  SELECT id INTO v_user FROM public.profiles WHERE lower(email) = v_email LIMIT 1;
  IF v_user IS NOT NULL AND v_user = org.legacy_profile_id THEN
    RAISE EXCEPTION 'kurulusun kendi hesabi davet edilemez' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF v_user IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_memberships
                                     WHERE organization_id = p_org AND user_id = v_user AND status = 'active') THEN
    RAISE EXCEPTION 'bu kullanici zaten uye' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF EXISTS (SELECT 1 FROM public.organization_invitations
              WHERE organization_id = p_org AND invited_email = v_email AND status = 'pending') THEN
    RAISE EXCEPTION 'Bu e-postaya zaten bekleyen bir davet var' USING ERRCODE = 'unique_violation'; END IF;

  INSERT INTO public.organization_invitations
    (organization_id, invited_email, invited_user_id, invited_by_id, role, status, invitation_message)
  VALUES (p_org, v_email, v_user, v_caller, p_role, 'pending', v_msg)
  RETURNING id INTO v_id;

  PERFORM internal.log_access(p_org, 'write', 'organization_invitations', v_id,
                              jsonb_build_object('op', 'invitation.create', 'role', p_role, 'registered', v_user IS NOT NULL));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.org_invitation_cancel(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'internal' AS $$
DECLARE v_caller uuid := auth.uid(); inv record;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'oturum gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT id, organization_id, status INTO inv FROM public.organization_invitations WHERE id = p_id;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'davet yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(inv.organization_id, 'members.manage', 'organization_invitations', p_id);
  IF inv.status = 'cancelled' THEN RETURN true; END IF; -- idempotan
  IF inv.status <> 'pending' THEN
    RAISE EXCEPTION 'davet artik beklemede degil (%)', inv.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  UPDATE public.organization_invitations SET status = 'cancelled', responded_at = now() WHERE id = p_id;
  PERFORM internal.log_access(inv.organization_id, 'write', 'organization_invitations', p_id,
                              jsonb_build_object('op', 'invitation.cancel'));
  RETURN true;
END $$;

-- Davetli yanitlar. Kabulde uyelik (ayni kullanici icin mevcut/askidaki satir aktiflesir) + FAZ 5 havuz kaydi
-- (modul acik ve talents kaydi varsa; hata kabulu bozmaz). Donus: kabulde uyelik id, redde NULL.
CREATE OR REPLACE FUNCTION public.org_invitation_respond(p_id uuid, p_accept boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'internal' AS $$
DECLARE
  v_caller uuid := auth.uid();
  inv      record;
  org      record;
  v_prole  text;
  v_m      uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'oturum gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO inv FROM public.organization_invitations WHERE id = p_id;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'davet yok' USING ERRCODE = 'no_data_found'; END IF;
  IF NOT (inv.invited_user_id = v_caller OR lower(inv.invited_email) = lower(COALESCE(auth.email(), ''))) THEN
    RAISE EXCEPTION 'bu davet sana ait degil' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF inv.status <> 'pending' THEN
    RAISE EXCEPTION 'davet artik beklemede degil (%)', inv.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  -- suresi dolmus davet: durum degismez (RAISE ifadenin tum yazimini geri alir); arayuz expires_at'a bakar
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN
    RAISE EXCEPTION 'davetin suresi dolmus' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.organization_invitations
       SET status = 'declined', invited_user_id = v_caller, responded_at = now() WHERE id = p_id;
    RETURN NULL;
  END IF;

  SELECT id, account_type, legacy_profile_id INTO org FROM public.organizations WHERE id = inv.organization_id;
  IF org.legacy_profile_id = v_caller THEN
    RAISE EXCEPTION 'kurulusun kendi hesabi uye olamaz' USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT role INTO v_prole FROM public.profiles WHERE id = v_caller;
  IF org.account_type = 'agency' AND v_prole IS DISTINCT FROM 'professional' THEN
    RAISE EXCEPTION 'ajansa katilmak icin profesyonel hesap gerekir (hesap: %)', v_prole
      USING ERRCODE = 'invalid_parameter_value'; END IF;

  INSERT INTO public.organization_memberships (organization_id, user_id, role, status, invited_by, joined_at)
  VALUES (org.id, v_caller, inv.role, 'active', inv.invited_by_id, now())
  ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active'
  RETURNING id INTO v_m;

  UPDATE public.organization_invitations
     SET status = 'accepted', invited_user_id = v_caller, responded_at = now() WHERE id = p_id;

  BEGIN
    IF public.org_module_enabled(org.id, 'talent_pool')
       AND EXISTS (SELECT 1 FROM public.talents t WHERE t.user_id = v_caller AND t.claim_status <> 'merged') THEN
      PERFORM public.fn_faz5_ensure_record_for_member(v_m);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'faz10 havuz kaydi yazilamadi (uyelik %): %', v_m, SQLERRM;
  END;

  PERFORM internal.log_access(org.id, 'write', 'organization_memberships', v_m,
                              jsonb_build_object('op', 'invitation.accept', 'invitation_id', p_id, 'role', inv.role));
  RETURN v_m;
END $$;

CREATE OR REPLACE FUNCTION public.org_member_remove(p_org uuid, p_user uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'internal' AS $$
DECLARE v_caller uuid := auth.uid(); m record; v_caller_role public.organization_member_role; v_owners int;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'oturum gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  PERFORM internal.assert_org_permission(p_org, 'members.manage', 'organization_memberships');
  SELECT id, user_id, role, legacy_source INTO m
    FROM public.organization_memberships WHERE organization_id = p_org AND user_id = p_user;
  IF m.id IS NULL THEN RAISE EXCEPTION 'uyelik yok' USING ERRCODE = 'no_data_found'; END IF;
  IF m.user_id = v_caller THEN
    RAISE EXCEPTION 'kendini cikaramazsin (ayrilmak icin org_member_leave)' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF m.legacy_source = 'owner_seed' THEN
    RAISE EXCEPTION 'kurulus sahibi cikarilamaz' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF m.role IN ('owner', 'admin') THEN
    SELECT role INTO v_caller_role FROM public.organization_memberships
     WHERE organization_id = p_org AND user_id = v_caller AND status = 'active';
    IF NOT (v_caller_role = 'owner' OR public.is_admin(v_caller)) THEN
      RAISE EXCEPTION 'owner/admin uyeyi yalniz kurulus sahibi cikarir' USING ERRCODE = 'insufficient_privilege'; END IF;
    IF m.role = 'owner' THEN
      SELECT count(*) INTO v_owners FROM public.organization_memberships
       WHERE organization_id = p_org AND role = 'owner' AND status = 'active';
      IF v_owners <= 1 THEN RAISE EXCEPTION 'son sahip cikarilamaz' USING ERRCODE = 'invalid_parameter_value'; END IF;
    END IF;
  END IF;
  DELETE FROM public.organization_memberships WHERE id = m.id;
  PERFORM internal.log_access(p_org, 'write', 'organization_memberships', m.id,
                              jsonb_build_object('op', 'member.remove', 'user_id', p_user, 'role', m.role));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.org_member_leave(p_org uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'internal' AS $$
DECLARE v_caller uuid := auth.uid(); m record; v_owners int;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'oturum gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT id, role, legacy_source INTO m
    FROM public.organization_memberships WHERE organization_id = p_org AND user_id = v_caller;
  IF m.id IS NULL THEN RAISE EXCEPTION 'bu kurulusun uyesi degilsin' USING ERRCODE = 'no_data_found'; END IF;
  IF m.legacy_source = 'owner_seed' THEN
    RAISE EXCEPTION 'kurulus sahibi ayrilamaz' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF m.role = 'owner' THEN
    SELECT count(*) INTO v_owners FROM public.organization_memberships
     WHERE organization_id = p_org AND role = 'owner' AND status = 'active';
    IF v_owners <= 1 THEN RAISE EXCEPTION 'son sahip ayrilamaz' USING ERRCODE = 'invalid_parameter_value'; END IF;
  END IF;
  DELETE FROM public.organization_memberships WHERE id = m.id;
  PERFORM internal.log_access(p_org, 'write', 'organization_memberships', m.id,
                              jsonb_build_object('op', 'member.leave', 'role', m.role));
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.org_invitation_create(uuid, text, public.organization_member_role, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_invitation_cancel(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_invitation_respond(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_member_remove(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_member_leave(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_invitation_create(uuid, text, public.organization_member_role, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_invitation_cancel(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_invitation_respond(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_member_remove(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_member_leave(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. Eski tabloyu okuyan is mantigi yeni tabloya
-- -----------------------------------------------------------------------------
-- 8a) org_member_set_role: eski tablo yazimi kalkti (FAZ 8-U govdesi, yalniz o blok silindi)
CREATE OR REPLACE FUNCTION public.org_member_set_role(p_membership_id uuid, p_role public.organization_member_role)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'internal' AS $$
DECLARE
  m             public.organization_memberships;
  v_caller      uuid := auth.uid();
  v_caller_role public.organization_member_role;
  v_owner_count integer;
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

  UPDATE public.organization_memberships SET role = p_role WHERE id = m.id;

  PERFORM internal.log_access(m.organization_id, 'write', 'organization_memberships', m.id,
                              jsonb_build_object('op', 'member.set_role', 'from', m.role, 'to', p_role));
  RETURN true;
END;
$$;

-- 8b) FAZ 5 havuz: uyelik id ile (eski agency_members id ile ayniydi). Parametre adi degisti; eski imza duser.
DROP FUNCTION IF EXISTS public.ensure_talent_record_for_membership(uuid);
DROP FUNCTION IF EXISTS public.fn_faz5_ensure_record_for_member(uuid);

CREATE FUNCTION public.fn_faz5_ensure_record_for_member(p_membership_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE om record; v_talent uuid; v_rec uuid;
BEGIN
  SELECT m.id, m.organization_id, m.user_id, m.joined_at, o.legacy_profile_id
    INTO om
    FROM public.organization_memberships m JOIN public.organizations o ON o.id = m.organization_id
   WHERE m.id = p_membership_id;
  IF om.id IS NULL THEN RAISE EXCEPTION 'uyelik satiri yok' USING ERRCODE = 'no_data_found'; END IF;
  SELECT t.id INTO v_talent FROM public.talents t WHERE t.user_id = om.user_id AND t.claim_status <> 'merged';
  IF v_talent IS NULL THEN
    RAISE EXCEPTION 'talent kaydi yok (uye %)', om.user_id USING ERRCODE = 'no_data_found';
  END IF;

  SELECT id INTO v_rec FROM public.organization_talent_records WHERE legacy_agency_member_id = om.id;
  IF v_rec IS NULL THEN
    -- ayni yetenegin kaydi: izsiz (harici kayit sonra claim) ya da izi silinmis uyelige bagli (ayrilip yeniden katildi)
    SELECT r.id INTO v_rec FROM public.organization_talent_records r
     WHERE r.organization_id = om.organization_id AND r.talent_id = v_talent
       AND (r.legacy_agency_member_id IS NULL
            OR NOT EXISTS (SELECT 1 FROM public.organization_memberships x WHERE x.id = r.legacy_agency_member_id));
    IF v_rec IS NOT NULL THEN
      UPDATE public.organization_talent_records SET legacy_agency_member_id = om.id WHERE id = v_rec;
    ELSE
      INSERT INTO public.organization_talent_records
        (organization_id, talent_id, name, source, visibility, relationship_type, status, linked_at, legacy_agency_member_id, created_by)
      SELECT om.organization_id, v_talent, COALESCE(NULLIF(trim(p.full_name), ''), 'Kashe uyesi'),
             'marketplace_linked', 'private', 'regular_freelancer', 'active', om.joined_at, om.id, om.legacy_profile_id
        FROM public.profiles p WHERE p.id = om.user_id
      RETURNING id INTO v_rec;
    END IF;
  END IF;

  INSERT INTO public.organization_talent_record_roles (record_id, role_id, is_primary)
  SELECT v_rec, ps.role_id, ps.is_primary
    FROM public.provider_services ps
   WHERE ps.provider_id = om.user_id
     AND NOT EXISTS (SELECT 1 FROM public.organization_talent_record_roles x WHERE x.record_id = v_rec AND x.role_id = ps.role_id)
     AND (NOT ps.is_primary OR NOT EXISTS (SELECT 1 FROM public.organization_talent_record_roles y WHERE y.record_id = v_rec AND y.is_primary));
  RETURN v_rec;
END $$;
REVOKE ALL ON FUNCTION public.fn_faz5_ensure_record_for_member(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.ensure_talent_record_for_membership(p_membership_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE om record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'giris gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT m.id, m.organization_id, m.user_id, m.status INTO om FROM public.organization_memberships m WHERE m.id = p_membership_id;
  IF om.id IS NULL THEN RAISE EXCEPTION 'uyelik satiri yok' USING ERRCODE = 'no_data_found'; END IF;
  IF NOT (om.user_id = auth.uid() OR public.has_org_permission(om.organization_id, 'talent.manage')) THEN
    RAISE EXCEPTION 'yetkisiz erisim' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF om.status <> 'active' THEN
    RAISE EXCEPTION 'uyelik aktif degil (%)', om.status USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT public.org_module_enabled(om.organization_id, 'talent_pool') THEN
    RAISE EXCEPTION 'talent_pool modulu bu kurulusta acik degil' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN public.fn_faz5_ensure_record_for_member(om.id);
END $$;
REVOKE ALL ON FUNCTION public.ensure_talent_record_for_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_talent_record_for_membership(uuid) TO authenticated, service_role;

-- 8c) sync_org_talent_pool: Ekibim = kurulusun aktif uyeleri (kurulusun kendi hesabi haric) icinden talents
-- kaydi olanlar; havuz kaydi olmayan ya da uyelik izi (legacy_agency_member_id) bos olan icin kayit/iz yazilir.
-- Donus: yeni acilan kayit sayisi.
CREATE OR REPLACE FUNCTION public.sync_org_talent_pool(p_org_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'internal' AS $$
DECLARE om record; v_before int; v_after int; n integer := 0;
BEGIN
  PERFORM internal.assert_org_permission(p_org_id, 'talent.manage', 'organization_talent_records');
  IF NOT public.org_module_enabled(p_org_id, 'talent_pool') THEN
    RAISE EXCEPTION 'talent_pool modulu bu kurulusta acik degil' USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR om IN
    SELECT m.id
      FROM public.organization_memberships m
      JOIN public.organizations o ON o.id = m.organization_id
      JOIN public.talents t ON t.user_id = m.user_id AND t.claim_status <> 'merged'
     WHERE m.organization_id = p_org_id
       AND m.status = 'active'
       AND m.user_id IS DISTINCT FROM o.legacy_profile_id
       AND NOT EXISTS (SELECT 1 FROM public.organization_talent_records r
                        WHERE r.organization_id = p_org_id AND r.talent_id = t.id AND r.legacy_agency_member_id = m.id)
     ORDER BY m.joined_at, m.id
  LOOP
    SELECT count(*) INTO v_before FROM public.organization_talent_records WHERE organization_id = p_org_id;
    PERFORM public.fn_faz5_ensure_record_for_member(om.id);
    SELECT count(*) INTO v_after FROM public.organization_talent_records WHERE organization_id = p_org_id;
    n := n + (v_after - v_before);
  END LOOP;
  IF n > 0 THEN
    PERFORM internal.log_access(p_org_id, 'write', 'organization_talent_records', NULL, jsonb_build_object('op', 'talent.sync', 'created', n));
  END IF;
  RETURN n;
END $$;

-- 8d) ensure_organization_for_profile: govde ayni, eski tablo adi yalniz yorumdaydi (asama20 K3 icin temizlendi)
CREATE OR REPLACE FUNCTION public.ensure_organization_for_profile(p_profile_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

  -- kurucu uyeligi (owner_seed): kurulusun kendi hesabi
  INSERT INTO public.organization_memberships (organization_id, user_id, role, status, joined_at, legacy_source)
  VALUES (v_org, p.id, 'owner', 'active', p.created_at, 'owner_seed')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN v_org;
END;
$$;

-- 8e) run_event_match: ajans kapsaminda Ekibim uyeleri yeni tablodan (govde faz9c sonrasi mevcut surum; yalniz member_cnt alt sorgusu degisti)
CREATE OR REPLACE FUNCTION public.run_event_match(p_event_id uuid, p_strategy match_strategy DEFAULT 'hybrid'::match_strategy)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ev        record;
  t0        timestamptz := clock_timestamp();
  run_id    uuid;
  n_pro     integer := 0;
  n_org     integer := 0;
  lim_role  integer := 20;
  lim_org   integer := 10;
  d_from    date;
  d_to      date;
  v_params  jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'giris gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO ev FROM public.events WHERE id = p_event_id;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'etkinlik yok' USING ERRCODE = 'no_data_found'; END IF;
  IF ev.owner_user_id <> auth.uid() THEN RAISE EXCEPTION 'yetkisiz erisim' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF ev.status NOT IN ('confirmed', 'matching') THEN
    RAISE EXCEPTION 'etkinlik once onaylanmali (durum: %)', ev.status USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_requirements WHERE event_id = p_event_id) THEN
    RAISE EXCEPTION 'etkinligin gereksinimi yok' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  d_from := ev.start_date;
  d_to   := COALESCE(ev.end_date, ev.start_date);
  v_params := jsonb_build_object(
    'version', 'v0.2', 'strategy', p_strategy::text, 'budget_rule', 'affordable',
    'pro', jsonb_build_object('same_city', 40, 'date_available', 25, 'date_unknown', 10, 'budget_fit', 20, 'budget_unknown', 10, 'high_trust', 15, 'new_talent', 5),
    'org', jsonb_build_object('coverage', 60, 'same_city', 20, 'date_available', 10, 'date_unknown', 5, 'high_trust', 10),
    'required_weight', 3, 'optional_weight', 1, 'limit_per_role', lim_role, 'limit_orgs', lim_org,
    'trust_threshold', 70, 'rating_threshold', 4.5, 'min_reviews', 3);

  INSERT INTO public.match_runs (event_id, strategy, algorithm_version, params, created_by)
  VALUES (p_event_id, p_strategy, 'v0.2', v_params, auth.uid()) RETURNING id INTO run_id;

  -- 7a) Bireysel profesyoneller: rol basina
  IF p_strategy IN ('individual', 'hybrid') THEN
    WITH aday AS (
      SELECT p.id AS provider_id, r.role_id, p.trust_score, p.created_at,
             (ev.city_id IS NOT NULL AND p.city_id = ev.city_id)                                    AS same_city,
             (d_from IS NOT NULL)                                                                  AS date_known,
             -- v0.2 butce kurali "affordable": saglayicinin baslangic fiyati rolun (yoksa etkinligin) ust butcesini asmiyorsa uygun.
             -- v0.1 "kesisim" kurali butcenin altinda kalan (ucuz) saglayiciyi uygun saymiyordu (canli kalibrasyon, 2 Ekim 2026).
             CASE WHEN ps.price_min IS NULL AND ps.price_max IS NULL THEN NULL                      -- fiyat yok: belirsiz
                  WHEN COALESCE(r.budget_hint_max, ev.budget_max) IS NULL THEN NULL                 -- ust butce yok: belirsiz
                  WHEN COALESCE(ps.price_min, ps.price_max) <= COALESCE(r.budget_hint_max, ev.budget_max) THEN true
                  ELSE false END                                                                    AS budget_fit,
             (COALESCE(p.trust_score, 0) >= 70 OR (rv.avg_rating >= 4.5 AND rv.cnt >= 3))         AS high_trust,
             (COALESCE(rv.cnt, 0) < 3)                                                             AS new_talent
        FROM public.event_requirements r
        JOIN public.provider_services ps ON ps.role_id = r.role_id
        JOIN public.providers p ON p.id = ps.provider_id
       LEFT JOIN LATERAL (SELECT avg(rating)::numeric AS avg_rating, count(*) AS cnt FROM public.reviews WHERE provider_id = p.id) rv ON true
       WHERE r.event_id = p_event_id
         AND p.provider_type = 'professional' AND p.is_published AND p.approval_status = 'approved' AND p.suspended_at IS NULL
         AND p.id <> auth.uid()
         AND (d_from IS NULL OR NOT EXISTS (SELECT 1 FROM public.availability_blocks ab WHERE ab.profile_id = p.id AND ab.blocked_date BETWEEN d_from AND d_to))
         AND (d_from IS NULL OR NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.professional_id = p.id AND b.status = 'confirmed' AND b.event_date BETWEEN d_from AND d_to))
    ), puan AS (
      SELECT a.*,
             (CASE WHEN a.same_city THEN 40 ELSE 0 END
              + CASE WHEN a.date_known THEN 25 ELSE 10 END
              + CASE WHEN a.budget_fit IS NULL THEN 10 WHEN a.budget_fit THEN 20 ELSE 0 END
              + CASE WHEN a.high_trust THEN 15 ELSE 0 END
              + CASE WHEN a.new_talent THEN 5 ELSE 0 END)::numeric AS score,
             array_remove(ARRAY[CASE WHEN a.same_city THEN 'same_city' END,
                                CASE WHEN a.date_known THEN 'date_available' END,
                                CASE WHEN a.budget_fit THEN 'budget_fit' END,
                                CASE WHEN a.high_trust THEN 'high_trust' END,
                                CASE WHEN a.new_talent THEN 'new_talent' END], NULL) AS codes
        FROM aday a
    ), sirali AS (
      SELECT q.*, row_number() OVER (PARTITION BY q.role_id ORDER BY q.score DESC, q.trust_score DESC NULLS LAST, q.created_at, q.provider_id) AS rn
        FROM puan q
    )
    INSERT INTO public.match_candidates (match_run_id, provider_id, role_id, match_score, trust_score, availability_conf, final_rank, reason_codes)
    SELECT run_id, s.provider_id, s.role_id, LEAST(100, s.score), s.trust_score,
           CASE WHEN s.date_known THEN 0.90 ELSE 0.50 END, s.rn, s.codes
      FROM sirali s WHERE s.rn <= lim_role;
    GET DIAGNOSTICS n_pro = ROW_COUNT;
  END IF;

  -- 7b) Ajanslar: etkinlik basina, agirlikli kapsam (01 bolum 5). Kapsam yalniz ACIK verilerden.
  IF p_strategy IN ('full_service', 'hybrid') THEN
    WITH req AS (
      SELECT r.role_id, r.quantity, r.is_required, CASE WHEN r.is_required THEN 3 ELSE 1 END AS w
        FROM public.event_requirements r WHERE r.event_id = p_event_id
    ), org AS (
      SELECT p.id, p.city_id, p.trust_score, p.created_at
        FROM public.providers p
       WHERE p.provider_type = 'organization' AND p.is_published AND p.approval_status = 'approved' AND p.suspended_at IS NULL
         AND p.id <> auth.uid()
         AND (d_from IS NULL OR NOT EXISTS (SELECT 1 FROM public.availability_blocks ab WHERE ab.profile_id = p.id AND ab.blocked_date BETWEEN d_from AND d_to))
    ), kapsam AS (
      -- org x rol: kendi hizmeti (kapasite) + Ekibim uyelerinin ayni roldeki hizmet sayisi
      SELECT o.id AS org_id, rq.role_id, rq.w, rq.quantity,
             EXISTS (SELECT 1 FROM public.provider_services ps WHERE ps.provider_id = o.id AND ps.role_id = rq.role_id) AS own_has,
             (SELECT max(ps.capacity) FROM public.provider_services ps WHERE ps.provider_id = o.id AND ps.role_id = rq.role_id) AS own_cap,
             (SELECT count(DISTINCT om.user_id) FROM public.organization_memberships om
                JOIN public.organizations og ON og.id = om.organization_id
                JOIN public.provider_services ps ON ps.provider_id = om.user_id AND ps.role_id = rq.role_id
               WHERE og.legacy_profile_id = o.id AND om.status = 'active' AND om.user_id <> o.id) AS member_cnt
        FROM org o CROSS JOIN req rq
    ), covered AS (
      SELECT k.org_id, k.w, k.role_id,
             CASE WHEN NOT (k.own_has OR k.member_cnt > 0) THEN 0.0
                  WHEN k.quantity <= 1 OR COALESCE(k.own_cap, 0) >= k.quantity OR k.member_cnt >= k.quantity THEN 1.0
                  ELSE 0.5 END AS c
        FROM kapsam k
    ), toplam AS (
      SELECT c.org_id,
             round(sum(c.w * c.c) / sum(c.w), 3) AS coverage,
             bool_and(CASE WHEN rq.is_required THEN c.c > 0 ELSE true END) AS eligible
        FROM covered c JOIN req rq ON rq.role_id = c.role_id
       GROUP BY c.org_id
    ), puan AS (
      SELECT o.id AS provider_id, o.trust_score, o.created_at, t.coverage, t.eligible,
             (ev.city_id IS NOT NULL AND o.city_id = ev.city_id) AS same_city,
             (d_from IS NOT NULL) AS date_known,
             (COALESCE(o.trust_score, 0) >= 70 OR (rv.avg_rating >= 4.5 AND rv.cnt >= 3)) AS high_trust
        FROM org o JOIN toplam t ON t.org_id = o.id
       LEFT JOIN LATERAL (SELECT avg(rating)::numeric AS avg_rating, count(*) AS cnt FROM public.reviews WHERE provider_id = o.id) rv ON true
       WHERE t.coverage > 0 AND (p_strategy = 'hybrid' OR t.eligible)
    ), sirali AS (
      SELECT q.*,
             (round(60 * q.coverage) + CASE WHEN q.same_city THEN 20 ELSE 0 END + CASE WHEN q.date_known THEN 10 ELSE 5 END
              + CASE WHEN q.high_trust THEN 10 ELSE 0 END)::numeric AS score,
             array_remove(ARRAY[CASE WHEN q.eligible THEN 'coverage_full' END,
                                CASE WHEN q.same_city THEN 'same_city' END,
                                CASE WHEN q.date_known THEN 'date_available' END,
                                CASE WHEN q.high_trust THEN 'high_trust' END], NULL) AS codes
        FROM puan q
    ), rn AS (
      SELECT s.*, row_number() OVER (ORDER BY s.score DESC, s.coverage DESC, s.trust_score DESC NULLS LAST, s.created_at, s.provider_id) AS rnk
        FROM sirali s
    )
    INSERT INTO public.match_candidates (match_run_id, provider_id, role_id, match_score, trust_score, coverage_ratio, availability_conf,
                                         full_service_eligible, final_rank, reason_codes)
    SELECT run_id, r.provider_id, NULL, LEAST(100, r.score), r.trust_score, r.coverage,
           CASE WHEN r.date_known THEN 0.90 ELSE 0.50 END, r.eligible, r.rnk, r.codes
      FROM rn r WHERE r.rnk <= lim_org;
    GET DIAGNOSTICS n_org = ROW_COUNT;
  END IF;

  UPDATE public.match_runs
     SET candidate_count = n_pro + n_org,
         latency_ms = GREATEST(0, (extract(epoch FROM clock_timestamp() - t0) * 1000)::integer)
   WHERE id = run_id;

  UPDATE public.events SET status = 'matching' WHERE id = p_event_id AND status = 'confirmed';
  RETURN run_id;
END;
$function$;


-- -----------------------------------------------------------------------------
-- 9. Acik ekip sozlesmesi: organization_team_public
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.organization_team_public WITH (security_invoker = false) AS
SELECT om.id              AS membership_id,
       om.organization_id,
       o.legacy_profile_id AS agency_id,
       om.user_id,
       om.joined_at
  FROM public.organization_memberships om
  JOIN public.organizations o  ON o.id = om.organization_id
  JOIN public.providers     pa ON pa.id = o.legacy_profile_id
                              AND pa.is_published AND pa.approval_status = 'approved' AND pa.suspended_at IS NULL
  JOIN public.providers     pm ON pm.id = om.user_id
                              AND pm.is_published AND pm.approval_status = 'approved' AND pm.suspended_at IS NULL
 WHERE o.account_type = 'agency'
   AND om.status = 'active'
   AND om.user_id <> o.legacy_profile_id;
COMMENT ON VIEW public.organization_team_public IS
  'FAZ 10a: ajans kurulusunun YAYINDAKI ekip uyeleri (ajans ve uye providers''ta yayinda+onayli+askida degil). Rol acilmaz. /p/[id] ekip listesi ve profesyonelin temsil eden ajanslari bunu okur.';
REVOKE ALL ON public.organization_team_public FROM PUBLIC;
GRANT SELECT ON public.organization_team_public TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.org_invitation_create(uuid, text, public.organization_member_role, text) IS
  'FAZ 10a: kurulusa e-posta ile davet (members.manage). E-posta normalize; owner rolu verilemez; kendine/kurulusun hesabina/uyeye davet 22023; bekleyen cift 23505. Kayitli davetliye type=team bildirim (tetikleyici).';
COMMENT ON FUNCTION public.org_invitation_respond(uuid, boolean) IS
  'FAZ 10a: davetli kabul/ret. Kabul: uyelik (ajans kurulusuna yalniz professional; kurulusun kendi hesabi olamaz) + FAZ 5 havuz kaydi (modul acik ve talents varsa; ayrilip donende eski kayda iz). Suresi dolmus davet 22023 (durum pending kalir; arayuz expires_at''a bakar).';
COMMENT ON FUNCTION public.org_member_remove(uuid, uuid) IS
  'FAZ 10a: uyeyi cikar (members.manage). Kendini/owner_seed cikaramaz; owner/admin uyeyi yalniz owner (ya da platform yoneticisi); son owner cikarilamaz. Silme conversation_assignees temizligini tetikler.';
COMMENT ON FUNCTION public.org_member_leave(uuid) IS
  'FAZ 10a: kendi uyeliginden ayril. owner_seed ve son owner ayrilamaz.';

COMMIT;
