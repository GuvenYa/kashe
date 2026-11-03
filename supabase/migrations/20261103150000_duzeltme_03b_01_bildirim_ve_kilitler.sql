-- =============================================================================
-- Duzeltme 03-B / 01 — bildirimler ve kilitler (DB dilimi; 3 Kasim 2026)
-- Kaynak: docs/sahne/bulgular.md 43, 44, 46, 48 + Fahri test rehberi "Bilinen eksikler"
-- (docs/envanter/38-faz10-temizlik.md bolum 6, Duzeltme 03 plani).
--
-- Icerik (hepsi idempotan; sema degisikligi YOK, veri degisikligi YOK — dolum 02 dosyasinda):
--   1) notifications.type CHECK listesine 'booking' (rezervasyon olustu / iptal / tamamlandi).
--   2) fn_faz7b_notify_org: bildirim turu parametresi (varsayilan 'rfp' — eski cagrilar aynen calisir)
--      + istege bagli "haric tutulan kullanici" (islemi yapan kendine bildirim almaz).
--   3) Portal: portal_proposal_approve / portal_proposal_request_revision satici kurulusa 'proposal'
--      bildirimi yazar (bulgu 48); onayda musteri e-postasi bir Kashe hesabiyla eslesiyorsa
--      proposals.buyer_user_id dolar -> booking_from_proposal customer_id'yi tasir, musteri
--      rezervasyonu /rezervasyonlarim'da gorur (bulgu 48).
--   4) RFP revizyon kilidi (bulgu 46): revizyon YANITI (onceki gonderilmis surumde alici notu var)
--      talep 'evaluating' iken ve son tarihten sonra da gonderilebilir; revizyon istenen teklif
--      alici tarafindan secilebilir (son gonderilmis surum). Satici bildirimleri 'proposal' turunde.
--   5) Sohbet teklifleri (quotes): gunluk sure sonu — quotes_expire_stale() + pg_cron 00:20 UTC
--      (proposals_expire_stale kalibi; uygulama zaten 'expired' durumunu cizer).
--   6) Rezervasyon bildirimleri (bulgu 43): iptal / tamamlanma karsi tarafa; teklif seklinde
--      rezervasyon olusunca alici kurulus uyelerine ve (varsa) musteriye (bulgu 46 "kurum bildirimi").
--   7) Yorum politikasi (bulgu 44): reviews INSERT icin tamamlanmis rezervasyon sarti DB'de
--      (uygulama sunucu sarti 03-A ile geldi).
-- Uygulama tarafi (ayri commit): bildirim etiketi 'booking' -> "Rezervasyon" (bildirim-listesi.tsx).
-- Edge Function e-posta kuyruguna 'booking' EKLENMEZ (eski sekil iptal/tamamlama e-postasi uygulamada
-- zaten gidiyor; cift e-posta olmasin). 'proposal' turu kuyrukta oldugundan portal bildirimleri
-- e-postaya da duser.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) notifications.type: + 'booking'
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['message', 'review', 'review_reply', 'listing_invitation', 'booking_request',
                           'rfp', 'proposal', 'task', 'crm', 'team', 'booking']));

-- -----------------------------------------------------------------------------
-- 2) fn_faz7b_notify_org: tur parametresi + haric tutulan kullanici
--    Eski imza (uuid, text, text, text) DUSER; yeni imzanin varsayilanlari eski 4 parametreli
--    cagrilari (rfp_send, rfp_cancel, rfp_invite_decline, proposal_send ...) aynen karsilar.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_faz7b_notify_org(uuid, text, text, text);
CREATE OR REPLACE FUNCTION public.fn_faz7b_notify_org(
  p_org_id uuid, p_permission text, p_link text, p_body text,
  p_type text DEFAULT 'rfp', p_except_user uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; m record;
BEGIN
  FOR m IN
    SELECT DISTINCT om.user_id FROM public.organization_memberships om
     WHERE om.organization_id = p_org_id AND om.status = 'active'
       AND (p_except_user IS NULL OR om.user_id <> p_except_user)
       AND CASE WHEN om.permissions ? p_permission THEN (om.permissions ->> p_permission) = 'true'
                ELSE p_permission = ANY (public.org_role_permissions(om.role)) END
  LOOP
    INSERT INTO public.notifications (user_id, type, link, body) VALUES (m.user_id, p_type, p_link, p_body);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.fn_faz7b_notify_org(uuid, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3) Portal: onay -> satici bildirimi + musteri hesabi bagi; revizyon -> satici bildirimi
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portal_proposal_approve(p_token text, p_name text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE l public.portal_access_links; p record; v public.proposal_versions; v_user uuid;
BEGIN
  l := public.fn_faz7_portal_link(p_token);
  IF NOT ('approve' = ANY(l.scope)) THEN RAISE EXCEPTION 'bu baglanti onay yetkisi tasimiyor' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_name IS NULL OR char_length(trim(p_name)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'onaylayan ad soyad gerekir (2-120 karakter)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT * INTO p FROM public.proposals WHERE id = l.resource_id;
  v := public.fn_faz7_last_sent_version(p.id);
  IF v.id IS NULL THEN RAISE EXCEPTION 'gonderilmis surum yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p.status = 'approved' THEN RAISE EXCEPTION 'teklif zaten onaylanmis' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p.status NOT IN ('sent', 'viewed') THEN RAISE EXCEPTION 'teklif bu durumda onaylanamaz (%)', p.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  IF v.valid_until IS NOT NULL AND v.valid_until < now() THEN
    -- durum isareti portal_proposal_view'da konur (RAISE bu fonksiyonun yazimini geri alirdi)
    RAISE EXCEPTION 'teklifin gecerlilik suresi dolmus' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  UPDATE public.proposal_versions SET approved_by_name = trim(p_name), approved_at = now() WHERE id = v.id;
  UPDATE public.proposals SET status = 'approved' WHERE id = p.id;

  -- Duzeltme 03-B: teklifin musteri e-postasi bir Kashe hesabiysa teklif o hesaba baglanir
  -- (client_email before-write tetikleyicisiyle normalize: lower/trim). Baglanti yalniz onay aninda
  -- kurulur: onaylayan kisi o adresin sahibidir. booking_from_proposal customer_id'yi buradan alir.
  IF p.buyer_user_id IS NULL AND p.client_email IS NOT NULL THEN
    SELECT pf.id INTO v_user FROM public.profiles pf WHERE lower(pf.email) = p.client_email LIMIT 1;
    IF v_user IS NOT NULL AND v_user IS DISTINCT FROM (SELECT o.legacy_profile_id FROM public.organizations o WHERE o.id = p.seller_organization_id) THEN
      UPDATE public.proposals SET buyer_user_id = v_user WHERE id = p.id;
    END IF;
  END IF;

  -- Duzeltme 03-B: satici kurulusa bildirim (e-posta kuyrugu 'proposal' turunu tasir)
  PERFORM public.fn_faz7b_notify_org(p.seller_organization_id, 'proposals.manage', '/ajans/teklifler/' || p.id::text,
    trim(p_name) || ' teklifi onayladı: ' || p.title, 'proposal');
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_proposal_request_revision(p_token text, p_note text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE l public.portal_access_links; p record; v public.proposal_versions;
BEGIN
  l := public.fn_faz7_portal_link(p_token);
  IF NOT ('request_revision' = ANY(l.scope)) THEN RAISE EXCEPTION 'bu baglanti revizyon yetkisi tasimiyor' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_note IS NULL OR char_length(trim(p_note)) NOT BETWEEN 2 AND 4000 THEN
    RAISE EXCEPTION 'revizyon notu gerekir (2-4000 karakter)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT * INTO p FROM public.proposals WHERE id = l.resource_id;
  v := public.fn_faz7_last_sent_version(p.id);
  IF v.id IS NULL THEN RAISE EXCEPTION 'gonderilmis surum yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p.status NOT IN ('sent', 'viewed') THEN RAISE EXCEPTION 'teklif bu durumda revize istenemez (%)', p.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.proposal_versions SET client_note = trim(p_note) WHERE id = v.id;
  UPDATE public.proposals SET status = 'revision_requested' WHERE id = p.id;
  -- Duzeltme 03-B: satici kurulusa bildirim
  PERFORM public.fn_faz7b_notify_org(p.seller_organization_id, 'proposals.manage', '/ajans/teklifler/' || p.id::text,
    COALESCE(NULLIF(trim(p.client_name), ''), 'Müşteri') || ' teklif için revizyon istedi: ' || p.title, 'proposal');
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4) RFP: revizyon kilidi + satici bildirimleri 'proposal' turunde
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rfp_request_revision(p_proposal_id uuid, p_note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE p record; r record; v public.proposal_versions;
BEGIN
  SELECT * INTO p FROM public.proposals WHERE id = p_proposal_id;
  IF p.id IS NULL OR p.rfp_id IS NULL THEN RAISE EXCEPTION 'teklif talebi yaniti yok' USING ERRCODE = 'no_data_found'; END IF;
  SELECT * INTO r FROM public.rfps WHERE id = p.rfp_id;
  PERFORM internal.assert_org_permission(r.organization_id, 'events.manage', 'rfps', r.id);
  IF p_note IS NULL OR char_length(trim(p_note)) NOT BETWEEN 2 AND 4000 THEN RAISE EXCEPTION 'revizyon notu gerekir (2-4000 karakter)' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF r.status NOT IN ('sent', 'collecting', 'evaluating') THEN RAISE EXCEPTION 'talep bu durumda (%)', r.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  v := public.fn_faz7_last_sent_version(p.id);
  IF v.id IS NULL THEN RAISE EXCEPTION 'gonderilmis surum yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p.status NOT IN ('sent', 'viewed') THEN RAISE EXCEPTION 'teklif bu durumda revize istenemez (%)', p.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.proposal_versions SET client_note = trim(p_note) WHERE id = v.id;
  UPDATE public.proposals SET status = 'revision_requested' WHERE id = p.id;
  -- Duzeltme 03-B: tur 'proposal' (eskiden 'rfp')
  PERFORM public.fn_faz7b_notify_org(p.seller_organization_id, 'proposals.manage', '/ajans/teklifler/' || p.id::text, 'Teklifin için revizyon istendi: ' || p.title, 'proposal');
  PERFORM internal.log_access(r.organization_id, 'write', 'proposals', p.id, jsonb_build_object('op', 'rfp.request_revision', 'rfp_id', r.id));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.rfp_award(p_rfp_id uuid, p_proposal_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
DECLARE r record; p record; v public.proposal_versions; v_name text; i record;
BEGIN
  SELECT * INTO r FROM public.rfps WHERE id = p_rfp_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'teklif talebi yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(r.organization_id, 'events.manage', 'rfps', r.id);
  IF r.status NOT IN ('sent', 'collecting', 'evaluating') THEN RAISE EXCEPTION 'bu durumda secim yapilamaz (%)', r.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT * INTO p FROM public.proposals WHERE id = p_proposal_id;
  IF p.id IS NULL OR p.rfp_id IS DISTINCT FROM r.id THEN RAISE EXCEPTION 'teklif bu talebe ait degil' USING ERRCODE = 'invalid_parameter_value'; END IF;
  -- Duzeltme 03-B: revizyon istenen teklif de secilebilir (alici son gonderilmis surumu kabul eder)
  IF p.status NOT IN ('sent', 'viewed', 'revision_requested') THEN RAISE EXCEPTION 'teklif bu durumda secilemez (%)', p.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  v := public.fn_faz7_last_sent_version(p.id);
  IF v.id IS NULL THEN RAISE EXCEPTION 'gonderilmis surum yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT NULLIF(trim(full_name), '') INTO v_name FROM public.profiles WHERE id = auth.uid();

  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.proposal_versions SET approved_by_name = COALESCE(v_name, 'Kurulus yetkilisi'), approved_at = now() WHERE id = v.id;
  UPDATE public.proposals SET status = 'approved' WHERE id = p.id;
  UPDATE public.rfps SET status = 'awarded', awarded_proposal_id = p.id WHERE id = r.id;
  UPDATE public.rfp_invites SET status = 'not_selected' WHERE rfp_id = r.id AND status IN ('sent', 'viewed', 'responded') AND (proposal_id IS DISTINCT FROM p.id);
  PERFORM public.fn_faz7b_notify_org(p.seller_organization_id, 'proposals.manage', '/ajans/teklifler/' || p.id::text, 'Teklifin kabul edildi: ' || p.title, 'proposal');
  FOR i IN SELECT DISTINCT pr.organization_id FROM public.rfp_invites inv JOIN public.providers pr ON pr.id = inv.provider_id
            WHERE inv.rfp_id = r.id AND inv.status = 'not_selected' AND pr.organization_id <> p.seller_organization_id LOOP
    PERFORM public.fn_faz7b_notify_org(i.organization_id, 'proposals.manage', '/ajans/rfp/' || r.id::text, 'Teklif talebi başka bir teklife verildi: ' || r.title);
  END LOOP;
  PERFORM internal.log_access(r.organization_id, 'write', 'rfps', r.id, jsonb_build_object('op', 'rfp.award', 'proposal_id', p.id, 'version_id', v.id));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.proposal_send(p_proposal_id uuid, p_valid_days integer DEFAULT 14)
RETURNS TABLE(link_id uuid, token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal, extensions AS $$
DECLARE p record; v record; n_items integer; n_bad integer; v_token text; v_link uuid; v_exp timestamptz; r record; seller_name text; v_rev boolean := false;
BEGIN
  SELECT * INTO p FROM public.proposals WHERE id = p_proposal_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'teklif yok' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM internal.assert_org_permission(p.seller_organization_id, 'proposals.manage', 'proposals', p.id);
  SELECT * INTO v FROM public.proposal_versions WHERE id = p.current_version_id;
  IF v.id IS NULL OR v.sent_at IS NOT NULL OR p.status <> 'draft' THEN
    RAISE EXCEPTION 'gonderilecek taslak surum yok' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT count(*) FILTER (WHERE is_visible_to_client), count(*) FILTER (WHERE is_visible_to_client AND unit_client_price <= 0)
    INTO n_items, n_bad FROM public.proposal_items WHERE proposal_version_id = v.id;
  IF n_items = 0 THEN RAISE EXCEPTION 'teklifte musteriye gorunen kalem yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF n_bad > 0 THEN RAISE EXCEPTION 'fiyati girilmemis kalem var (%)', n_bad USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_valid_days IS NULL OR p_valid_days < 1 OR p_valid_days > 365 THEN
    RAISE EXCEPTION 'gecerlilik 1-365 gun olmali' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p.rfp_id IS NOT NULL THEN
    -- FAZ 7b: RFP yaniti — alici Kashe icinde okur; portal baglantisi acilmaz
    SELECT * INTO r FROM public.rfps WHERE id = p.rfp_id;
    -- Duzeltme 03-B: revizyon YANITI (onceki gonderilmis surumde alici notu var) talep degerlendirmede
    -- ve son tarih gectikten sonra da gonderilir; ilk yanit icin kural degismez (sent/collecting + son tarih).
    SELECT EXISTS (SELECT 1 FROM public.proposal_versions pv
                    WHERE pv.proposal_id = p.id AND pv.sent_at IS NOT NULL AND pv.client_note IS NOT NULL
                      AND pv.version_no < v.version_no) INTO v_rev;
    IF r.id IS NULL OR r.status NOT IN ('sent', 'collecting', 'evaluating')
       OR (NOT v_rev AND (r.status = 'evaluating' OR (r.deadline IS NOT NULL AND r.deadline <= now()))) THEN
      RAISE EXCEPTION 'teklif talebi kapali' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    PERFORM set_config('kashe.faz7_rpc', '1', true);
    UPDATE public.proposal_versions
       SET sent_at = now(), valid_until = COALESCE(valid_until, now() + make_interval(days => p_valid_days))
     WHERE id = v.id;
    UPDATE public.proposals SET status = 'sent' WHERE id = p.id;
    UPDATE public.rfp_invites SET status = 'responded', responded_at = now(), proposal_id = p.id
     WHERE rfp_id = r.id AND provider_id = p.seller_provider_id;
    IF r.status = 'sent' THEN UPDATE public.rfps SET status = 'collecting' WHERE id = r.id; END IF;
    SELECT display_name INTO seller_name FROM public.providers WHERE id = p.seller_provider_id;
    PERFORM public.fn_faz7b_notify_org(r.organization_id, 'events.manage', '/kurumsal/rfp/' || r.id::text,
      COALESCE(seller_name, 'Bir ajans') || CASE WHEN v_rev THEN ' revize teklif gönderdi: ' ELSE ' teklif gönderdi: ' END || r.title);
    PERFORM internal.log_access(p.seller_organization_id, 'write', 'proposals', p.id, jsonb_build_object('op', 'proposal.send', 'version_id', v.id, 'rfp_id', r.id, 'revision', v_rev));
    PERFORM set_config('kashe.faz7_rpc', '0', true);
    RETURN QUERY SELECT NULL::uuid, NULL::text;
    RETURN;
  END IF;

  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.proposal_versions
     SET sent_at = now(), valid_until = COALESCE(valid_until, now() + make_interval(days => p_valid_days))
   WHERE id = v.id;
  SELECT valid_until INTO v_exp FROM public.proposal_versions WHERE id = v.id;
  -- eski baglantilar iptal (ayni teklif)
  UPDATE public.portal_access_links SET revoked_at = now()
   WHERE resource_type = 'proposal' AND resource_id = p.id AND revoked_at IS NULL;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.portal_access_links (organization_id, resource_type, resource_id, token_hash, recipient_email, expires_at)
  VALUES (p.seller_organization_id, 'proposal', p.id, encode(extensions.digest(v_token, 'sha256'), 'hex'), p.client_email,
          GREATEST(v_exp + interval '7 days', now() + interval '30 days'))
  RETURNING id INTO v_link;
  UPDATE public.proposals SET status = 'sent' WHERE id = p.id;
  PERFORM internal.log_access(p.seller_organization_id, 'write', 'proposals', p.id, jsonb_build_object('op', 'proposal.send', 'version_id', v.id, 'link_id', v_link));
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN QUERY SELECT v_link, v_token;
END $$;

-- -----------------------------------------------------------------------------
-- 5) Sohbet teklifleri: gunluk sure sonu (quotes.expires_at; durum 'pending' -> 'expired').
--    BEFORE tetikleyici responded_at'i, AFTER tetikleyici "Teklif suresi doldu" sistem mesajini yazar.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quotes_expire_stale()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer := 0;
BEGIN
  UPDATE public.quotes SET status = 'expired' WHERE status = 'pending' AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.quotes_expire_stale() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quotes_expire_stale() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE 'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = ''quotes-expire-daily''';
    EXECUTE 'SELECT cron.schedule(''quotes-expire-daily'', ''20 0 * * *'', ''SELECT public.quotes_expire_stale();'')';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6) Rezervasyon bildirimleri: olustu (teklif sekli -> alici), iptal, tamamlandi
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_duz03_booking_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_satici_org uuid; v_satici_ad text; v_baslik text; v_tarih text; v_link text; v_body text;
  v_iptal_eden uuid; v_iptal_ad text; v_satici_iptal boolean; v_alici_iptal boolean; v_musteri_org_uyesi boolean;
BEGIN
  -- Satici: teklif seklinde saglayici (kurulusu), eski sekilde profesyonel profili.
  IF NEW.seller_provider_id IS NOT NULL THEN
    SELECT pv.organization_id, pv.display_name INTO v_satici_org, v_satici_ad FROM public.providers pv WHERE pv.id = NEW.seller_provider_id;
  END IF;
  IF v_satici_ad IS NULL AND NEW.professional_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(trim(pf.company_name), ''), NULLIF(trim(pf.full_name), '')) INTO v_satici_ad FROM public.profiles pf WHERE pf.id = NEW.professional_id;
  END IF;
  v_satici_ad := COALESCE(v_satici_ad, 'Hizmet sağlayıcı');

  -- Baslik: teklif sekli -> teklif basligi; eski sekil -> etkinlik turu etiketi
  IF NEW.proposal_version_id IS NOT NULL THEN
    SELECT pr.title INTO v_baslik FROM public.proposal_versions pv JOIN public.proposals pr ON pr.id = pv.proposal_id WHERE pv.id = NEW.proposal_version_id;
  END IF;
  IF v_baslik IS NULL AND NEW.event_type IS NOT NULL THEN
    SELECT et.name_tr INTO v_baslik FROM public.event_types et WHERE et.key = NEW.event_type;
  END IF;
  v_baslik := COALESCE(NULLIF(trim(v_baslik), ''), 'Rezervasyon');
  v_tarih := CASE WHEN NEW.event_date IS NOT NULL THEN ' (' || to_char(NEW.event_date, 'DD.MM.YYYY') || ')' ELSE '' END;
  v_link := '/rezervasyon/' || NEW.id::text;

  -- ---- OLUSTU: yalniz teklif sekli (eski sekli musterinin kendi kabulu acar; profesyonele mevcut bildirim gider)
  IF TG_OP = 'INSERT' THEN
    IF NEW.proposal_version_id IS NULL THEN RETURN NEW; END IF;
    v_body := v_satici_ad || ' rezervasyon oluşturdu: ' || v_baslik || v_tarih;
    IF NEW.buyer_organization_id IS NOT NULL THEN
      PERFORM public.fn_faz7b_notify_org(NEW.buyer_organization_id, 'events.view', v_link, v_body, 'booking', auth.uid());
    END IF;
    IF NEW.customer_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM auth.uid() THEN
      SELECT EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.organization_id = NEW.buyer_organization_id AND om.user_id = NEW.customer_id AND om.status = 'active') INTO v_musteri_org_uyesi;
      IF NOT COALESCE(v_musteri_org_uyesi, false) THEN
        INSERT INTO public.notifications (user_id, type, link, body) VALUES (NEW.customer_id, 'booking', v_link, v_body);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  -- ---- IPTAL: karsi tarafa (iptal eden kendine almaz; iptal eden bilinmiyorsa iki tarafa)
  IF NEW.status = 'cancelled' THEN
    v_iptal_eden := COALESCE(NEW.cancelled_by, auth.uid());
    IF v_iptal_eden IS NOT NULL THEN
      SELECT COALESCE(NULLIF(trim(pf.company_name), ''), NULLIF(trim(pf.full_name), '')) INTO v_iptal_ad FROM public.profiles pf WHERE pf.id = v_iptal_eden;
    END IF;
    -- NULL kiyaslari (professional_id/customer_id bos olabilir) false sayilir: COALESCE sart
    v_satici_iptal := COALESCE(v_iptal_eden IS NOT NULL AND (
      v_iptal_eden IS NOT DISTINCT FROM NEW.professional_id OR v_iptal_eden IS NOT DISTINCT FROM NEW.seller_provider_id
      OR (v_satici_org IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.organization_id = v_satici_org AND om.user_id = v_iptal_eden AND om.status = 'active'))), false);
    v_alici_iptal := COALESCE(v_iptal_eden IS NOT NULL AND NOT v_satici_iptal AND (
      v_iptal_eden IS NOT DISTINCT FROM NEW.customer_id
      OR (NEW.buyer_organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.organization_id = NEW.buyer_organization_id AND om.user_id = v_iptal_eden AND om.status = 'active'))), false);
    v_body := COALESCE(v_iptal_ad, 'Karşı taraf') || ' rezervasyonu iptal etti: ' || v_baslik || v_tarih;

    -- aliciya (satici iptal ettiyse ya da iptal eden bilinmiyorsa)
    IF NOT v_alici_iptal THEN
      IF NEW.customer_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM v_iptal_eden THEN
        INSERT INTO public.notifications (user_id, type, link, body) VALUES (NEW.customer_id, 'booking', v_link, v_body);
      END IF;
      IF NEW.buyer_organization_id IS NOT NULL THEN
        PERFORM public.fn_faz7b_notify_org(NEW.buyer_organization_id, 'events.view', v_link, v_body, 'booking', COALESCE(NEW.customer_id, v_iptal_eden));
      END IF;
    END IF;
    -- saticiya (alici iptal ettiyse ya da iptal eden bilinmiyorsa)
    IF NOT v_satici_iptal THEN
      IF v_satici_org IS NOT NULL THEN
        PERFORM public.fn_faz7b_notify_org(v_satici_org, 'proposals.view', v_link, v_body, 'booking', v_iptal_eden);
      ELSIF NEW.professional_id IS NOT NULL AND NEW.professional_id IS DISTINCT FROM v_iptal_eden THEN
        INSERT INTO public.notifications (user_id, type, link, body) VALUES (NEW.professional_id, 'booking', v_link, v_body);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- ---- TAMAMLANDI: aliciya (musteri yorum birakabilsin; kurum uyeleri rezervasyonu gorsun)
  IF NEW.status = 'completed' THEN
    v_body := v_satici_ad || ' işi tamamlandı olarak işaretledi: ' || v_baslik || v_tarih;
    IF NEW.customer_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, type, link, body)
      VALUES (NEW.customer_id, 'booking',
              CASE WHEN NEW.professional_id IS NOT NULL THEN '/p/' || NEW.professional_id::text || '?yorum=1' ELSE v_link END,
              v_body || CASE WHEN NEW.professional_id IS NOT NULL THEN ' — yorum bırakabilirsin' ELSE '' END);
    END IF;
    IF NEW.buyer_organization_id IS NOT NULL THEN
      PERFORM public.fn_faz7b_notify_org(NEW.buyer_organization_id, 'events.view', v_link, v_body, 'booking', COALESCE(NEW.customer_id, auth.uid()));
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_duz03_booking_notify ON public.bookings;
CREATE TRIGGER trg_duz03_booking_notify
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.fn_duz03_booking_notify();

-- -----------------------------------------------------------------------------
-- 7) Yorum politikasi: tamamlanmis rezervasyon sarti (sohbet sarti aynen kalir)
--    Yardimci SECURITY DEFINER: politika icinde bookings RLS'ine takilmadan bakar.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_duz03_tamamlanmis_rezervasyon_var(p_customer uuid, p_provider uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
     WHERE b.status = 'completed'
       AND (b.customer_id = p_customer
            OR (b.buyer_organization_id IS NOT NULL
                AND b.buyer_organization_id IN (SELECT o.id FROM public.organizations o WHERE o.legacy_profile_id = p_customer)))
       AND (b.professional_id = p_provider OR b.seller_provider_id = p_provider));
$$;
REVOKE ALL ON FUNCTION public.fn_duz03_tamamlanmis_rezervasyon_var(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_duz03_tamamlanmis_rezervasyon_var(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Customers can create reviews for their conversations" ON public.reviews;
CREATE POLICY "Customers can create reviews for their conversations"
  ON public.reviews FOR INSERT
  WITH CHECK (
    (auth.uid() = customer_id OR public.has_business_role(customer_id, 'owner'))
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = reviews.conversation_id
        AND c.customer_id = reviews.customer_id
        AND c.professional_id = reviews.professional_id
    )
    AND public.fn_duz03_tamamlanmis_rezervasyon_var(reviews.customer_id, reviews.professional_id)
  );

COMMENT ON FUNCTION public.fn_duz03_booking_notify() IS 'Duzeltme 03-B: rezervasyon olustu (teklif sekli) / iptal / tamamlandi bildirimleri (type booking).';
COMMENT ON FUNCTION public.quotes_expire_stale() IS 'Duzeltme 03-B: suresi gecen sohbet tekliflerini expired yapar (pg_cron quotes-expire-daily 00:20 UTC).';
COMMENT ON FUNCTION public.fn_duz03_tamamlanmis_rezervasyon_var(uuid, uuid) IS 'Duzeltme 03-B: yorum politikasi icin tamamlanmis rezervasyon var mi (musteri ya da kurumu x saglayici).';
