-- =============================================================================
-- Hijyen 02 (19 Ekim 2026) — kullaniciya gorunen bildirim metinlerinde Turkce karakter
--
-- 7b bildirim govdeleri ASCII yazilmisti ("teklif gonderdi", "icin", "baska"); uygulama ici
-- bildirimde ve e-postada kullaniciya gorunuyor. Kural: kod/yorum ASCII, UI metni duzgun Turkce.
-- Uc fonksiyon 20261009120000_faz7b_01_rfp.sql'deki govdeleriyle BIREBIR yeniden yazilir;
-- yalniz uc metin degisir (diff ile dogrulanabilir). Davranis, yetki, grant degismez.
-- Idempotan (CREATE OR REPLACE).
-- =============================================================================
BEGIN;

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
  PERFORM public.fn_faz7b_notify_org(p.seller_organization_id, 'proposals.manage', '/ajans/teklifler/' || p.id::text, 'Teklifin için revizyon istendi: ' || p.title);
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
  IF p.status NOT IN ('sent', 'viewed') THEN RAISE EXCEPTION 'teklif bu durumda secilemez (%)', p.status USING ERRCODE = 'invalid_parameter_value'; END IF;
  v := public.fn_faz7_last_sent_version(p.id);
  IF v.id IS NULL THEN RAISE EXCEPTION 'gonderilmis surum yok' USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT NULLIF(trim(full_name), '') INTO v_name FROM public.profiles WHERE id = auth.uid();

  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.proposal_versions SET approved_by_name = COALESCE(v_name, 'Kurulus yetkilisi'), approved_at = now() WHERE id = v.id;
  UPDATE public.proposals SET status = 'approved' WHERE id = p.id;
  UPDATE public.rfps SET status = 'awarded', awarded_proposal_id = p.id WHERE id = r.id;
  UPDATE public.rfp_invites SET status = 'not_selected' WHERE rfp_id = r.id AND status IN ('sent', 'viewed', 'responded') AND (proposal_id IS DISTINCT FROM p.id);
  PERFORM public.fn_faz7b_notify_org(p.seller_organization_id, 'proposals.manage', '/ajans/teklifler/' || p.id::text, 'Teklifin kabul edildi: ' || p.title);
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
DECLARE p record; v record; n_items integer; n_bad integer; v_token text; v_link uuid; v_exp timestamptz; r record; seller_name text;
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
    IF r.id IS NULL OR r.status NOT IN ('sent', 'collecting') OR (r.deadline IS NOT NULL AND r.deadline <= now()) THEN
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
    PERFORM public.fn_faz7b_notify_org(r.organization_id, 'events.manage', '/kurumsal/rfp/' || r.id::text, COALESCE(seller_name, 'Bir ajans') || ' teklif gönderdi: ' || r.title);
    PERFORM internal.log_access(p.seller_organization_id, 'write', 'proposals', p.id, jsonb_build_object('op', 'proposal.send', 'version_id', v.id, 'rfp_id', r.id));
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

COMMIT;
