-- SAHNE 06 — Duzeltme 03-B davranis testi (YALNIZ DALDA / yerel kopyada; Sahne v2 kimlikleri: Lumen, Arti Bir,
-- Teknopark, Beren Kara). Tum is tek islemde kosar ve sonda ROLLBACK eder: veritabaninda iz birakmaz.
-- Beklenen: 8 satir GECTI. Hata alinirsa ilk hata satiri hangi adimin (T1a..T6) kirildigini soyler.
-- Yerelde: psql -d kashe_03b -f docs/sahne/06-sahne-duzeltme-03b-davranis.sql ; dalda: SQL Editor'a yapistir.
BEGIN;
CREATE TEMP TABLE t (sira int, test text, sonuc text, detay text);
CREATE OR REPLACE FUNCTION pg_temp.kim(p uuid) RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', p::text, true) $$;

-- Kisiler
-- Lumen ajansi sahibi 5a4e0000-...-020002 (org 1e522123), Beren Kara musteri 040004, Teknopark kurum sahibi 030001 (org 16b8c87b), Arti Bir sahibi 020006 (org eab53497)
DO $$
DECLARE
  -- Sabit kimlikler Sahne SQL'inden (profil = saglayici = 5a4e0000-...; etkinlik 5a4e0002-...). Kurulus id'leri ve rol id'leri
  -- yukleme aninda uretildiginden (gen_random_uuid / identity) ASLA sabit yazilmaz: legacy_profile_id ve slug ile bulunur.
  lumen_u uuid := '5a4e0000-0000-4000-8000-000000020002'; lumen_org uuid;
  beren uuid := '5a4e0000-0000-4000-8000-000000040004';
  tek_u uuid := '5a4e0000-0000-4000-8000-000000030001'; tek_org uuid;
  arti_u uuid := '5a4e0000-0000-4000-8000-000000020006'; arti_pr uuid := '5a4e0000-0000-4000-8000-000000020006'; arti_org uuid;
  ev_lumen uuid := '5a4e0002-0000-4000-8000-000000000007'; ev_tek uuid := '5a4e0002-0000-4000-8000-000000000051';
  rol_sunucu integer;
  prop uuid; ver uuid; tok text; n int; b_id uuid; rfp uuid; prop2 uuid; ver2 uuid; n_lumen_uye int; r record; v_err text;
BEGIN
  SELECT id INTO lumen_org FROM public.organizations WHERE legacy_profile_id = lumen_u;
  SELECT id INTO tek_org   FROM public.organizations WHERE legacy_profile_id = tek_u;
  SELECT id INTO arti_org  FROM public.organizations WHERE legacy_profile_id = arti_u;
  SELECT id INTO rol_sunucu FROM public.service_roles WHERE slug = 'sunucu';
  IF lumen_org IS NULL OR tek_org IS NULL OR arti_org IS NULL OR rol_sunucu IS NULL THEN
    RAISE EXCEPTION 'Sahne kimlikleri bulunamadi (lumen %, teknopark %, arti bir %, sunucu rolu %)', lumen_org, tek_org, arti_org, rol_sunucu;
  END IF;
  -- ============ T1 portal: gonder -> onayla -> satici bildirimi + buyer_user_id -> rezervasyon -> musteri bildirimi
  PERFORM pg_temp.kim(lumen_u);
  prop := public.proposal_create(lumen_org, 'Test 03B dogrudan teklif', ev_lumen, NULL, 'Beren Kara', 'SAHNE+Beren-Kara@kashe.net', NULL);
  SELECT current_version_id INTO ver FROM public.proposals WHERE id = prop;
  INSERT INTO public.proposal_items (proposal_version_id, role_id, description, quantity, unit_client_price, is_visible_to_client, sort_order)
  VALUES (ver, rol_sunucu, 'Sunucu', 1, 10000, true, 1);
  SELECT token INTO tok FROM public.proposal_send(prop, 14);
  IF tok IS NULL THEN RAISE EXCEPTION 'T1: token bos'; END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);  -- anonim portal
  PERFORM public.portal_proposal_view(tok);
  PERFORM public.portal_proposal_approve(tok, 'Beren Kara');
  SELECT count(*) INTO n_lumen_uye FROM public.organization_memberships om WHERE om.organization_id = lumen_org AND om.status = 'active'
     AND CASE WHEN om.permissions ? 'proposals.manage' THEN (om.permissions ->> 'proposals.manage') = 'true' ELSE 'proposals.manage' = ANY (public.org_role_permissions(om.role)) END;
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'proposal' AND link = '/ajans/teklifler/' || prop::text AND body LIKE 'Beren Kara teklifi onayladı:%';
  IF n <> n_lumen_uye OR n = 0 THEN RAISE EXCEPTION 'T1a: satici bildirimi % (beklenen %)', n, n_lumen_uye; END IF;
  SELECT buyer_user_id INTO b_id FROM public.proposals WHERE id = prop;
  IF b_id IS DISTINCT FROM beren THEN RAISE EXCEPTION 'T1b: buyer_user_id % (beklenen Beren)', b_id; END IF;
  INSERT INTO t VALUES (1, 'T1 portal onay', 'GECTI', n || ' satici bildirimi (proposal), buyer_user_id = Beren (e-posta buyuk/kucuk harf normalize)');

  PERFORM pg_temp.kim(lumen_u);
  b_id := public.booking_from_proposal(prop);
  IF (SELECT customer_id FROM public.bookings WHERE id = b_id) IS DISTINCT FROM beren THEN RAISE EXCEPTION 'T1c: booking customer_id bos'; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = beren AND type = 'booking' AND link = '/rezervasyon/' || b_id::text AND body LIKE 'Lumen Prodüksiyon rezervasyon oluşturdu:%';
  IF n <> 1 THEN RAISE EXCEPTION 'T1d: musteri olustu bildirimi % (1)', n; END IF;
  INSERT INTO t VALUES (2, 'T1 rezervasyon olustu', 'GECTI', 'customer_id = Beren; Beren''e 1 booking bildirimi');

  -- musteri iptal eder -> Lumen uyelerine (proposals.view) bildirim; musteriye yok
  PERFORM pg_temp.kim(beren);
  UPDATE public.bookings SET status = 'cancelled', cancelled_at = now(), cancelled_by = beren, cancellation_reason = 'test' WHERE id = b_id;
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'booking' AND link = '/rezervasyon/' || b_id::text AND body LIKE 'Beren Kara rezervasyonu iptal etti:%';
  IF n = 0 THEN RAISE EXCEPTION 'T1e: satici iptal bildirimi yok'; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE user_id = beren AND body LIKE 'Beren Kara rezervasyonu iptal etti:%') THEN RAISE EXCEPTION 'T1f: iptal eden kendine bildirim aldi'; END IF;
  INSERT INTO t VALUES (3, 'T1 musteri iptali', 'GECTI', n || ' satici uyesine booking bildirimi, iptal edene yok');

  -- ============ T2 eski sekil: tamamlandi -> musteriye yorum baglantisi; satici iptali -> musteriye
  SELECT b.* INTO r FROM public.bookings b WHERE b.quote_id IS NOT NULL AND b.status = 'confirmed' AND b.customer_id IS NOT NULL AND b.professional_id IS NOT NULL ORDER BY b.created_at DESC LIMIT 1;
  PERFORM pg_temp.kim(r.professional_id);
  UPDATE public.bookings SET status = 'completed', completed_at = now() WHERE id = r.id;
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = r.customer_id AND type = 'booking' AND link = '/p/' || r.professional_id::text || '?yorum=1' AND body LIKE '%işi tamamlandı olarak işaretledi:%yorum bırakabilirsin';
  IF n <> 1 THEN RAISE EXCEPTION 'T2a: tamamlandi bildirimi % (1)', n; END IF;
  SELECT b.* INTO r FROM public.bookings b WHERE b.quote_id IS NOT NULL AND b.status = 'confirmed' AND b.customer_id IS NOT NULL AND b.professional_id IS NOT NULL AND b.id <> r.id ORDER BY b.created_at DESC LIMIT 1;
  PERFORM pg_temp.kim(r.professional_id);
  UPDATE public.bookings SET status = 'cancelled', cancelled_at = now(), cancelled_by = r.professional_id WHERE id = r.id;
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = r.customer_id AND type = 'booking' AND link = '/rezervasyon/' || r.id::text AND body LIKE '% rezervasyonu iptal etti:%';
  IF n <> 1 THEN RAISE EXCEPTION 'T2b: musteriye iptal bildirimi % (1)', n; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE user_id = r.professional_id AND link = '/rezervasyon/' || r.id::text) THEN RAISE EXCEPTION 'T2c: iptal eden pro kendine bildirim aldi'; END IF;
  INSERT INTO t VALUES (4, 'T2 eski sekil tamamlama + iptal', 'GECTI', 'musteriye /p/<pro>?yorum=1; satici iptalinde musteriye, iptal edene yok');

  -- ============ T3 yorum politikasi (RLS, authenticated)
  -- 3a: tamamlanmis rezervasyonu olan musteri (T2 ilk kayit) yorum yazabilir
  SELECT b.* INTO r FROM public.bookings b WHERE b.status = 'completed' AND b.quote_id IS NOT NULL AND b.conversation_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.reviews rv WHERE rv.conversation_id = b.conversation_id AND rv.customer_id = b.customer_id) ORDER BY b.completed_at DESC NULLS LAST LIMIT 1;
  PERFORM pg_temp.kim(r.customer_id);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.reviews (conversation_id, customer_id, provider_id, rating, body) VALUES (r.conversation_id, r.customer_id, r.professional_id, 5, 'Test 03B yorum');
  RESET ROLE;
  -- 3b: yalniz sohbeti olan (tamamlanmis rezervasyonu olmayan) musteri yazamaz
  SELECT c.* INTO r FROM public.conversations c
   WHERE NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.status = 'completed' AND (b.customer_id = c.customer_id) AND (b.professional_id = c.professional_id OR b.seller_provider_id = c.professional_id))
     AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.legacy_profile_id = c.customer_id)
     AND NOT EXISTS (SELECT 1 FROM public.reviews rv WHERE rv.conversation_id = c.id) LIMIT 1;
  PERFORM pg_temp.kim(r.customer_id);
  BEGIN
    SET LOCAL ROLE authenticated;
    INSERT INTO public.reviews (conversation_id, customer_id, provider_id, rating, body) VALUES (r.id, r.customer_id, r.professional_id, 4, 'Olmamali');
    RESET ROLE;
    RAISE EXCEPTION 'T3b: tamamlanmis rezervasyonsuz yorum GECTI';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE; v_err := SQLERRM;
  END;
  INSERT INTO t VALUES (5, 'T3 yorum politikasi', 'GECTI', 'tamamlanmis rezervasyonla INSERT gecti; yalniz sohbetle 42501 (' || v_err || ')');

  -- ============ T4 RFP revizyon kilidi
  PERFORM pg_temp.kim(tek_u);
  rfp := public.rfp_create(tek_org, ev_tek, 'Test 03B RFP', 'aciklama', now() + interval '3 days');
  INSERT INTO public.rfp_items (rfp_id, role_id, quantity, is_required, sort_order) VALUES (rfp, rol_sunucu, 1, true, 1);
  PERFORM public.rfp_invite(rfp, arti_pr);
  PERFORM public.rfp_send(rfp);
  PERFORM pg_temp.kim(arti_u);
  prop2 := public.proposal_create_from_rfp(rfp, arti_org);
  SELECT current_version_id INTO ver2 FROM public.proposals WHERE id = prop2;
  UPDATE public.proposal_items SET unit_client_price = 12000 WHERE proposal_version_id = ver2;
  PERFORM public.proposal_send(prop2, 14);
  -- alici degerlendirmeye alir, sonra revizyon ister
  PERFORM pg_temp.kim(tek_u);
  PERFORM public.rfp_close(rfp);
  PERFORM public.rfp_request_revision(prop2, 'Fiyati dusurun lutfen');
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'proposal' AND link = '/ajans/teklifler/' || prop2::text AND body LIKE 'Teklifin için revizyon istendi:%';
  IF n = 0 THEN RAISE EXCEPTION 'T4a: revizyon bildirimi (proposal) yok'; END IF;
  -- satici yeni surum acar ve degerlendirme asamasinda gonderebilir (03-B)
  PERFORM pg_temp.kim(arti_u);
  ver2 := public.proposal_new_version(prop2);
  UPDATE public.proposal_items SET unit_client_price = 11000 WHERE proposal_version_id = ver2;
  PERFORM public.proposal_send(prop2, 14);
  IF (SELECT status FROM public.proposals WHERE id = prop2) <> 'sent' THEN RAISE EXCEPTION 'T4b: revize surum gonderilemedi'; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'rfp' AND link = '/kurumsal/rfp/' || rfp::text AND body LIKE '% revize teklif gönderdi:%';
  IF n = 0 THEN RAISE EXCEPTION 'T4c: aliciya revize bildirimi yok'; END IF;
  -- alici tekrar revizyon ister, bu kez revizyon istenen teklifi dogrudan secer (03-B)
  PERFORM pg_temp.kim(tek_u);
  PERFORM public.rfp_request_revision(prop2, 'Son bir kucuk duzeltme');
  PERFORM public.rfp_award(rfp, prop2);
  IF (SELECT status FROM public.proposals WHERE id = prop2) <> 'approved' OR (SELECT status FROM public.rfps WHERE id = rfp) <> 'awarded' THEN RAISE EXCEPTION 'T4d: secim olmadi'; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'proposal' AND body = 'Teklifin kabul edildi: ' || (SELECT title FROM public.proposals WHERE id = prop2);
  IF n = 0 THEN RAISE EXCEPTION 'T4e: kabul bildirimi (proposal) yok'; END IF;
  -- satici rezervasyon olusturur -> alici kurulus uyelerine booking bildirimi (satici haric)
  PERFORM pg_temp.kim(arti_u);
  b_id := public.booking_from_proposal(prop2);
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'booking' AND link = '/rezervasyon/' || b_id::text AND body LIKE 'Artı Bir Ajans rezervasyon oluşturdu:%'
     AND user_id IN (SELECT user_id FROM public.organization_memberships WHERE organization_id = tek_org AND status = 'active');
  IF n = 0 THEN RAISE EXCEPTION 'T4f: kurum rezervasyon bildirimi yok'; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE type = 'booking' AND link = '/rezervasyon/' || b_id::text AND user_id = arti_u) THEN RAISE EXCEPTION 'T4g: satici kendine bildirim aldi'; END IF;
  -- satici tamamlar -> kurum uyelerine
  UPDATE public.bookings SET status = 'completed', completed_at = now() WHERE id = b_id;
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'booking' AND link = '/rezervasyon/' || b_id::text AND body LIKE 'Artı Bir Ajans işi tamamlandı olarak işaretledi:%';
  IF n = 0 THEN RAISE EXCEPTION 'T4h: kurum tamamlandi bildirimi yok'; END IF;
  INSERT INTO t VALUES (6, 'T4 RFP revizyon kilidi + kurum bildirimleri', 'GECTI', 'evaluating iken revize surum gonderildi; revision_requested teklif secildi; kurum uyelerine olustu + tamamlandi (' || n || ')');

  -- ============ T5 ilk yanit kilidi degismedi: degerlendirmedeki talebe ILK yanit gonderilemez
  PERFORM pg_temp.kim(tek_u);
  rfp := public.rfp_create(tek_org, ev_tek, 'Test 03B RFP 2', NULL, now() + interval '3 days');
  INSERT INTO public.rfp_items (rfp_id, role_id, quantity, is_required, sort_order) VALUES (rfp, rol_sunucu, 1, true, 1);
  PERFORM public.rfp_invite(rfp, arti_pr);
  PERFORM public.rfp_send(rfp);
  PERFORM pg_temp.kim(arti_u);
  prop2 := public.proposal_create_from_rfp(rfp, arti_org);
  SELECT current_version_id INTO ver2 FROM public.proposals WHERE id = prop2;
  UPDATE public.proposal_items SET unit_client_price = 12000 WHERE proposal_version_id = ver2;
  PERFORM pg_temp.kim(tek_u);
  PERFORM public.rfp_close(rfp);
  PERFORM pg_temp.kim(arti_u);
  BEGIN
    PERFORM public.proposal_send(prop2, 14);
    RAISE EXCEPTION 'T5: ilk yanit degerlendirmede GECTI';
  EXCEPTION WHEN invalid_parameter_value THEN v_err := SQLERRM;
  END;
  INSERT INTO t VALUES (7, 'T5 ilk yanit kilidi', 'GECTI', 'degerlendirmedeki talebe ilk yanit: ' || v_err);

  -- ============ T6 quotes sure sonu (dolum kostu) + 4 parametreli notify_org cagrisi (rfp_send) calisti
  SELECT count(*) INTO n FROM public.quotes WHERE status = 'pending' AND expires_at < now();
  IF n <> 0 THEN RAISE EXCEPTION 'T6a: suresi gecmis pending teklif kaldi (%)', n; END IF;
  SELECT count(*) INTO n FROM public.messages m JOIN public.quotes q ON q.conversation_id = m.conversation_id WHERE q.status = 'expired' AND m.body = '⏱ Teklif süresi doldu';
  INSERT INTO t VALUES (8, 'T6 sohbet teklifi sure sonu', 'GECTI', 'pending+gecmis = 0; sistem mesaji olan expired teklif: ' || n);
END $$;
SELECT * FROM t ORDER BY sira;
ROLLBACK;
