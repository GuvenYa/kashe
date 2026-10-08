-- =============================================================================
-- FAZ 7c / 01 — bookings genislemesi + onayli tekliften rezervasyon (04 madde 36; 19 bolum 2 ve 11)
--
-- KARARLAR (Guven, 7 Ekim 2026):
--   * bookings tek rezervasyon merkezi kalir; ayri tablo YOK. Eski sekil (quote_id + conversation_id + customer_id + professional_id,
--     dordu dolu) aynen; TEKLIF sekli eklenir (proposal_version_id + seller_provider_id dolu). Dort eski sutun NULLABLE olur,
--     `bookings_shape_check` iki sekilden birini zorunlu kilar. Eski `on_quote_accepted_create_booking` tetikleyicisine DOKUNULMAZ
--     (SECURITY DEFINER; yetki degisikliginden etkilenmez).
--   * Onayli teklif -> TEK rezervasyon / surum (`booking_from_proposal`): total = surumun KDV dahil toplami, status confirmed,
--     customer_id = teklifin buyer_user_id (misafirde NULL), buyer_organization_id, event_id/tarih/sehir/katilimci etkinlikten.
--     Ekip uyesi basina rezervasyon YOK (FAZ 8 gorevlendirme).
--   * Yetki: bookings INSERT/DELETE dogrudan YOK (yalniz tetikleyici + RPC); UPDATE yalniz durum sutunlari (status, cancelled_*,
--     completed_at) — eski iptal/tamamlama akislari bu sutunlari kullanir. Eski RLS politikalari (musteri/profesyonel/kurum uyesi/
--     ajans uyesi) aynen; teklif sekli icin kurulus politikasi eklenir (`can_access_booking_row`): satici kurulus proposals.view/manage,
--     alici kurulus events.view/manage, admin.
--   * Portal: `portal_proposal_view` donusune `has_booking` eklenir (musteri "rezervasyon olusturuldu" gorur).
--
-- Idempotan (iki kez kosulabilir). Sapkali harf yok. VERI YAZMAZ; eski satirlar degismez.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Yeni sutunlar (hepsi NULLABLE)
-- -----------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS buyer_organization_id uuid REFERENCES public.organizations(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_provider_id    uuid REFERENCES public.providers(id)          ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS event_id              uuid REFERENCES public.events(id)             ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crew_member_id        uuid REFERENCES public.crew_members(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proposal_version_id   uuid REFERENCES public.proposal_versions(id)  ON DELETE RESTRICT;

COMMENT ON COLUMN public.bookings.buyer_organization_id IS 'FAZ 7c: alici kurulus (ajans/kurum); kisi aliciysa NULL';
COMMENT ON COLUMN public.bookings.seller_provider_id    IS 'FAZ 7c: satici saglayici (teklifte kurulusun organization saglayicisi); teklif seklinde zorunlu';
COMMENT ON COLUMN public.bookings.event_id              IS 'FAZ 7c: bagli etkinlik (FAZ 4a events)';
COMMENT ON COLUMN public.bookings.crew_member_id        IS 'FAZ 7c: ekip uyesi basina rezervasyon icin ayrilmis; 7c''de NULL (FAZ 8)';
COMMENT ON COLUMN public.bookings.proposal_version_id   IS 'FAZ 7c: onaylanan teklif surumu; surum basina tek rezervasyon (kismi tekil indeks)';

-- -----------------------------------------------------------------------------
-- 2. Eski zorunluluklar kalkar; iki sekilden biri zorunlu
-- -----------------------------------------------------------------------------
ALTER TABLE public.bookings
  ALTER COLUMN quote_id        DROP NOT NULL,
  ALTER COLUMN conversation_id DROP NOT NULL,
  ALTER COLUMN customer_id     DROP NOT NULL,
  ALTER COLUMN professional_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_shape_check' AND conrelid = 'public.bookings'::regclass) THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_shape_check CHECK (
         (quote_id IS NOT NULL AND conversation_id IS NOT NULL AND customer_id IS NOT NULL AND professional_id IS NOT NULL)
      OR (proposal_version_id IS NOT NULL AND seller_provider_id IS NOT NULL)
    );
  END IF;
END $$;

COMMENT ON CONSTRAINT bookings_shape_check ON public.bookings IS
  'FAZ 7c: eski sekil (teklif kabulu: quote+sohbet+musteri+profesyonel) YA DA teklif sekli (proposal_version + seller_provider)';

CREATE UNIQUE INDEX IF NOT EXISTS bookings_proposal_version_id_key ON public.bookings (proposal_version_id) WHERE proposal_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_seller_provider_id_idx    ON public.bookings (seller_provider_id)    WHERE seller_provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_buyer_organization_id_idx ON public.bookings (buyer_organization_id) WHERE buyer_organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_event_id_idx              ON public.bookings (event_id)              WHERE event_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Yetki: dogrudan INSERT/DELETE yok; UPDATE yalniz durum sutunlari
--    (eski: anon/authenticated tabloda TUM yetkilere sahipti — public varsayilan yetkiler; RLS politikasi olmadigi icin INSERT zaten
--     reddediliyordu. Simdi acikca kapatilir. Eski tetikleyici SECURITY DEFINER: etkilenmez. service_role dokunulmaz.)
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.bookings FROM anon, authenticated;
GRANT SELECT ON TABLE public.bookings TO anon, authenticated;
GRANT UPDATE (status, cancelled_at, cancelled_by, cancellation_reason, completed_at) ON TABLE public.bookings TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Erisim yardimcisi + kurulus RLS politikalari (eski politikalar aynen kalir; PERMISSIVE -> OR)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_booking_row(p_seller_provider_id uuid, p_buyer_organization_id uuid, p_mode text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_admin(auth.uid()) THEN true
    WHEN p_seller_provider_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.providers pr
            WHERE pr.id = p_seller_provider_id AND pr.organization_id IS NOT NULL
              AND public.has_org_permission(pr.organization_id, CASE WHEN p_mode = 'manage' THEN 'proposals.manage' ELSE 'proposals.view' END)) THEN true
    WHEN p_buyer_organization_id IS NOT NULL
         AND public.has_org_permission(p_buyer_organization_id, CASE WHEN p_mode = 'manage' THEN 'events.manage' ELSE 'events.view' END) THEN true
    ELSE false
  END;
$$;
COMMENT ON FUNCTION public.can_access_booking_row(uuid, uuid, text) IS
  'FAZ 7c: teklif/kurulus sekli rezervasyon erisimi — satici kurulus proposals.view|manage, alici kurulus events.view|manage, admin';
REVOKE ALL ON FUNCTION public.can_access_booking_row(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_booking_row(uuid, uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS bookings_select_org ON public.bookings;
CREATE POLICY bookings_select_org ON public.bookings FOR SELECT TO authenticated
  USING (public.can_access_booking_row(seller_provider_id, buyer_organization_id, 'view'));

DROP POLICY IF EXISTS bookings_update_org ON public.bookings;
CREATE POLICY bookings_update_org ON public.bookings FOR UPDATE TO authenticated
  USING (public.can_access_booking_row(seller_provider_id, buyer_organization_id, 'manage'))
  WITH CHECK (public.can_access_booking_row(seller_provider_id, buyer_organization_id, 'manage'));

-- -----------------------------------------------------------------------------
-- 5. RPC: onayli tekliften rezervasyon (tek satir / surum; idempotan)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.booking_from_proposal(p_proposal_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  p public.proposals; v public.proposal_versions; ev public.events; b_id uuid; v_loc text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'oturum gerekir' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO p FROM public.proposals WHERE id = p_proposal_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'teklif bulunamadi' USING ERRCODE = 'no_data_found'; END IF;
  IF NOT public.has_org_permission(p.seller_organization_id, 'proposals.manage') THEN
    RAISE EXCEPTION 'yetki yok: proposals.manage' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p.status <> 'approved' THEN RAISE EXCEPTION 'teklif onayli degil' USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT * INTO v FROM public.proposal_versions WHERE id = p.current_version_id;
  IF v.id IS NULL OR v.approved_at IS NULL THEN RAISE EXCEPTION 'onayli surum yok' USING ERRCODE = 'invalid_parameter_value'; END IF;

  -- idempotan: surumun rezervasyonu varsa onu doner
  SELECT id INTO b_id FROM public.bookings WHERE proposal_version_id = v.id;
  IF b_id IS NOT NULL THEN RETURN b_id; END IF;

  IF p.event_id IS NOT NULL THEN
    SELECT * INTO ev FROM public.events WHERE id = p.event_id;
    SELECT concat_ws(' / ', c.name, NULLIF(ev.district, '')) INTO v_loc FROM public.turkish_cities c WHERE c.id = ev.city_id;
  END IF;

  INSERT INTO public.bookings (
    proposal_version_id, seller_provider_id, buyer_organization_id, customer_id, event_id,
    event_date, event_type, location, guest_count, start_time, end_time,
    total_amount, platform_fee, currency, status)
  VALUES (
    v.id, p.seller_provider_id, p.buyer_organization_id, p.buyer_user_id, p.event_id,
    ev.start_date, ev.event_type, v_loc, ev.participant_count, ev.start_time, ev.end_time,
    v.total_amount, 0, v.currency, 'confirmed')
  RETURNING id INTO b_id;

  PERFORM internal.log_access(p.seller_organization_id, 'write', 'bookings', b_id,
    jsonb_build_object('op', 'booking.from_proposal', 'proposal_id', p.id, 'version_id', v.id));
  RETURN b_id;
END $$;
COMMENT ON FUNCTION public.booking_from_proposal(uuid) IS
  'FAZ 7c: onayli (approved) teklifin gecerli surumunden TEK rezervasyon (confirmed; total = KDV dahil toplam); idempotan; proposals.manage';
REVOKE ALL ON FUNCTION public.booking_from_proposal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_from_proposal(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Portal: has_booking alani (govde 7a-DB/01 ile ayni; yalniz donus nesnesine bir alan eklendi)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portal_proposal_view(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE l public.portal_access_links; p record; v public.proposal_versions; items jsonb; ev jsonb; seller text; has_b boolean;
BEGIN
  l := public.fn_faz7_portal_link(p_token);
  SELECT * INTO p FROM public.proposals WHERE id = l.resource_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'baglanti gecersiz' USING ERRCODE = 'no_data_found'; END IF;
  v := public.fn_faz7_last_sent_version(p.id);
  IF v.id IS NULL THEN RAISE EXCEPTION 'gonderilmis surum yok' USING ERRCODE = 'invalid_parameter_value'; END IF;

  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.portal_access_links
     SET view_count = view_count + 1, first_viewed_at = COALESCE(first_viewed_at, now()), last_viewed_at = now()
   WHERE id = l.id;
  IF p.status IN ('sent', 'viewed') AND v.valid_until IS NOT NULL AND v.valid_until < now() THEN
    UPDATE public.proposals SET status = 'expired' WHERE id = p.id; p.status := 'expired';
  ELSIF p.status = 'sent' THEN
    UPDATE public.proposals SET status = 'viewed' WHERE id = p.id; p.status := 'viewed';
  END IF;

  SELECT display_name INTO seller FROM public.providers WHERE id = p.seller_provider_id;
  SELECT jsonb_build_object('title', e.title, 'event_type', et.name_tr, 'start_date', e.start_date, 'city', c.name, 'participant_count', e.participant_count)
    INTO ev
    FROM public.events e LEFT JOIN public.event_types et ON et.key = e.event_type LEFT JOIN public.turkish_cities c ON c.id = e.city_id
   WHERE e.id = p.event_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('description', i.description, 'quantity', i.quantity, 'unit_client_price', i.unit_client_price,
                                                'total_client_price', i.total_client_price, 'role', sr.name_tr) ORDER BY i.sort_order, i.created_at), '[]'::jsonb)
    INTO items
    FROM public.proposal_items i LEFT JOIN public.service_roles sr ON sr.id = i.role_id
   WHERE i.proposal_version_id = v.id AND i.is_visible_to_client;
  SELECT EXISTS (SELECT 1 FROM public.bookings b WHERE b.proposal_version_id = v.id AND b.status <> 'cancelled') INTO has_b;

  PERFORM set_config('kashe.faz7_rpc', '0', true);
  RETURN jsonb_build_object(
    'seller_name', seller, 'title', p.title, 'client_name', p.client_name, 'event', ev,
    'version_no', v.version_no, 'items', items, 'subtotal', v.subtotal, 'tax_rate', v.tax_rate, 'tax_amount', v.tax_amount,
    'total_amount', v.total_amount, 'currency', v.currency, 'valid_until', v.valid_until, 'notes', v.notes,
    'status', p.status, 'approved_by_name', v.approved_by_name, 'approved_at', v.approved_at, 'client_note', v.client_note,
    'scope', to_jsonb(l.scope), 'sent_at', v.sent_at, 'has_booking', has_b);
END $$;

COMMIT;
