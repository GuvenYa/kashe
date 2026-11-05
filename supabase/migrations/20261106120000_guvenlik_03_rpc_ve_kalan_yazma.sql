-- =============================================================================
-- GUVENLIK 03 - acik RPC'ler ve kalan yazma yollari (bulgu 92-99)
--
-- Bulgu (5 Kasim 2026, Guvenlik 02 sonrasi tum tablo + SECURITY DEFINER
-- fonksiyon taramasi, yerel test veritabani, uretim semasi):
--   92. admin_* istatistik fonksiyonlarindan 20'si (SQL dilinde yazilanlar)
--       yonetici kontrolu YAPMIYOR ve girissiz ziyaretciye de acik: yonetim
--       islem kaydi (yonetici adi / e-postasi, islem notlari), rezervasyon
--       cirosu, profil / ilan listeleri herkes tarafindan okunabiliyordu.
--   93. notify_quote_request_recipients girissiz cagrilabiliyor: herhangi bir
--       kullaniciya istenen baglantiyla "Sana yeni bir teklif talebi geldi"
--       bildirimi dusurulebiliyordu (kimlik avi baglantisi).
--   94. get_push_subscriptions_for_user / delete_push_subscription_by_endpoint:
--       herkes herhangi bir kullanicinin anlik bildirim aboneliklerini okuyup
--       silebiliyordu.
--   95. proposals: satici kurulus teklifin alicisini (buyer_user_id /
--       buyer_organization_id) ve etkinlik / ekip bagini dogrudan
--       degistirebiliyordu -> teklif, rezervasyon ve bildirimler istenen
--       baska bir kullaniciya / kurulusa itilebiliyordu.
--   96. service_addons: eklenti BASKA bir profesyonelin hizmetine baglanabiliyor,
--       o profesyonelin kamu profilinde gorunuyordu (icerik enjeksiyonu).
--   97. conversation_assignees: profesyonel sohbete ekibinde OLMAYAN birini
--       atayabiliyordu (musteri sohbeti disariya acilir).
--   98. Ek yolu: mesaj / basvuru / teklif topla ekinin yolu baskasinin dosyasini
--       gosterebiliyordu (dosyayi okuma yetkisi ek satirindan gelir).
--   99. profiles: premium simulasyonu sinirsiz sureyle ve rolune uymayan planla
--       yazilabiliyordu (uygulama 1-12 ay ve role gore plan veriyor).
--
-- Cozum: yonetici fonksiyonlari ic semaya tasinir, ayni adla yonetici kontrollu
-- sarmalayici kalir (uygulama degismez); diger RPC'ler oturum + iliski kontrolu
-- yapar; kalan yazma yollari tetikleyiciyle dogrulanir. Sistem (auth.uid()
-- bos) ve yonetici serbesttir.
-- Kontrol: docs/envanter/asama27-guvenlik03-kontrol.sql (yapi),
-- asama27b-guvenlik03-davranis.sql (davranis, YALNIZ dal).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) admin_* (SQL, yonetici kontrolsuz) -> internal + yonetici sarmalayicisi
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_adlar text;
  v_sayi int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname,
           pg_get_function_arguments(p.oid) AS args,
           pg_get_function_identity_arguments(p.oid) AS idargs,
           pg_get_function_result(p.oid) AS sonuc,
           p.proargnames, p.pronargs, p.proretset
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
     WHERE n.nspname = 'public'
       AND p.proname LIKE 'admin\_%'
       AND l.lanname = 'sql'
       AND p.prosecdef
       AND p.prosrc !~* 'is_admin'
  LOOP
    IF NOT r.proretset THEN
      RAISE EXCEPTION 'Guvenlik 03: % kume donmuyor, sarmalayici yazilmadi', r.proname;
    END IF;
    SELECT string_agg(quote_ident(x.ad), ', ' ORDER BY x.sira)
      INTO v_adlar
      FROM unnest(r.proargnames[1:r.pronargs]) WITH ORDINALITY AS x(ad, sira);

    EXECUTE format('ALTER FUNCTION public.%I(%s) SET SCHEMA internal', r.proname, r.idargs);
    EXECUTE format('REVOKE ALL ON FUNCTION internal.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.idargs);
    EXECUTE format(
      'CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql SECURITY DEFINER '
      'SET search_path = public AS $w$ '
      'BEGIN '
      '  IF NOT public.is_admin(auth.uid()) THEN '
      '    RAISE EXCEPTION ''Bu istatistik yalniz yoneticiye acik.'' USING ERRCODE = ''42501''; '
      '  END IF; '
      '  RETURN QUERY SELECT * FROM internal.%I(%s); '
      'END $w$',
      r.proname, r.args, r.sonuc, r.proname, coalesce(v_adlar, ''));
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.idargs);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.idargs);
    v_sayi := v_sayi + 1;
  END LOOP;
  RAISE NOTICE 'Guvenlik 03: % yonetici fonksiyonu sarmalandi', v_sayi;

  -- Kendi icinde yonetici kontrolu olanlar dahil: hicbir admin_* girissize acik degil
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS idargs
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname LIKE 'admin\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.idargs);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.idargs);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2) notify_quote_request_recipients - yalniz kendi talebinin alicilarina,
--    yalniz site ici baglanti
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_quote_request_recipients(recipient_ids uuid[], notif_link text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  pid uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Oturum gerekir.' USING ERRCODE = '42501';
  END IF;
  IF notif_link IS NULL OR notif_link !~ '^/[A-Za-z0-9]' THEN
    RAISE EXCEPTION 'Bildirim baglantisi site ici olmali.' USING ERRCODE = '22023';
  END IF;
  FOREACH pid IN ARRAY coalesce(recipient_ids, '{}'::uuid[]) LOOP
    IF EXISTS (
      SELECT 1
        FROM public.quote_request_recipients r
        JOIN public.quote_requests q ON q.id = r.request_id
       WHERE r.professional_id = pid
         AND r.status = 'sent'
         AND q.created_at > now() - interval '1 hour'
         AND (q.customer_id = v_uid OR public.has_business_role(q.customer_id, 'manager'))
    ) THEN
      INSERT INTO public.notifications (user_id, type, link, body)
      VALUES (pid, 'message', notif_link, 'Sana yeni bir teklif talebi geldi');
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_quote_request_recipients(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_quote_request_recipients(uuid[], text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3) Anlik bildirim abonelikleri - yalniz iliskili kisi (sohbet / basvuru)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guv03_push_iliskisi(p_hedef uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
       p_hedef = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (
         SELECT 1 FROM public.conversations c
          WHERE (c.customer_id = p_hedef OR c.professional_id = p_hedef OR public.is_assignee(c.id, p_hedef))
            AND (c.customer_id = auth.uid() OR c.professional_id = auth.uid()
                 OR public.is_assignee(c.id, auth.uid())
                 OR public.has_business_role(c.customer_id, 'member')))
    OR EXISTS (
         SELECT 1 FROM public.applications ap
           JOIN public.listings l ON l.id = ap.listing_id
          WHERE (ap.applicant_id = auth.uid() AND l.creator_id = p_hedef)
             OR (ap.applicant_id = p_hedef
                 AND (l.creator_id = auth.uid() OR public.has_business_role(l.creator_id, 'member'))))
  );
$$;

REVOKE ALL ON FUNCTION public.fn_guv03_push_iliskisi(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_push_subscriptions_for_user(target_user_id uuid)
RETURNS TABLE(endpoint text, p256dh text, auth text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.endpoint, s.p256dh, s.auth
    FROM public.push_subscriptions s
   WHERE s.user_id = target_user_id
     AND public.fn_guv03_push_iliskisi(target_user_id);
$$;

CREATE OR REPLACE FUNCTION public.delete_push_subscription_by_endpoint(target_endpoint text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.push_subscriptions s
   WHERE s.endpoint = target_endpoint
     AND public.fn_guv03_push_iliskisi(s.user_id);
$$;

REVOKE ALL ON FUNCTION public.get_push_subscriptions_for_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_push_subscriptions_for_user(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.delete_push_subscription_by_endpoint(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription_by_endpoint(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) proposals - alici ve etkinlik / ekip bagi yalniz RPC ile (uygulama
--    yalniz baslik / musteri adi / e-posta / CRM kisisi yazar)
-- -----------------------------------------------------------------------------
REVOKE UPDATE (buyer_organization_id, buyer_user_id, event_id, crew_id)
  ON public.proposals FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5) service_addons - eklenti yalniz kendi hizmetine baglanir
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guv03_eklenti_hizmeti()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.service_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.services s
        WHERE s.id = NEW.service_id AND s.profile_id = NEW.profile_id) THEN
    RAISE EXCEPTION 'Eklenti yalniz kendi hizmetine baglanir.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guv03_eklenti_hizmeti ON public.service_addons;
CREATE TRIGGER trg_guv03_eklenti_hizmeti
  BEFORE INSERT OR UPDATE ON public.service_addons
  FOR EACH ROW EXECUTE FUNCTION public.fn_guv03_eklenti_hizmeti();

-- -----------------------------------------------------------------------------
-- 6) conversation_assignees - atanan, sohbetin profesyonelinin kurulusunda
--    aktif ekip uyesi olmali (kurulusun kendi hesabi degil); atayan = oturum
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guv03_sohbet_atama()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR public.is_admin(v_uid) THEN
    RETURN NEW;
  END IF;
  NEW.assigned_by := v_uid;
  IF NOT EXISTS (
       SELECT 1
         FROM public.conversations c
         JOIN public.organizations o ON o.legacy_profile_id = c.professional_id
         JOIN public.organization_memberships om ON om.organization_id = o.id
        WHERE c.id = NEW.conversation_id
          AND om.user_id = NEW.professional_id
          AND om.status = 'active'
          AND COALESCE(om.legacy_source, '') <> 'owner_seed') THEN
    RAISE EXCEPTION 'Yalniz ekip uyesi atanabilir.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guv03_sohbet_atama ON public.conversation_assignees;
CREATE TRIGGER trg_guv03_sohbet_atama
  BEFORE INSERT ON public.conversation_assignees
  FOR EACH ROW EXECUTE FUNCTION public.fn_guv03_sohbet_atama();

-- -----------------------------------------------------------------------------
-- 7) Ek yolu - yalniz yukleyenin kendi klasoru (`<auth.uid()>/...`; depo
--    yukleme kurali zaten boyle; satir baskasinin dosyasini gosteremez)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guv03_ek_yolu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR public.is_admin(v_uid) THEN
    RETURN NEW;
  END IF;
  IF NEW.attachment_path IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.attachment_path IS DISTINCT FROM OLD.attachment_path)
     AND split_part(NEW.attachment_path, '/', 1) <> v_uid::text THEN
    RAISE EXCEPTION 'Ek yalniz kendi yukledigin dosya olabilir.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guv03_ek_yolu ON public.messages;
CREATE TRIGGER trg_guv03_ek_yolu
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.fn_guv03_ek_yolu();

DROP TRIGGER IF EXISTS trg_guv03_ek_yolu ON public.applications;
CREATE TRIGGER trg_guv03_ek_yolu
  BEFORE INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.fn_guv03_ek_yolu();

DROP TRIGGER IF EXISTS trg_guv03_ek_yolu ON public.quote_requests;
CREATE TRIGGER trg_guv03_ek_yolu
  BEFORE INSERT OR UPDATE ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_guv03_ek_yolu();

-- -----------------------------------------------------------------------------
-- 8) profiles - premium simulasyonu: role uygun plan, en fazla 12 ay
--    (iyzico gelince bu yol odemeye baglanir; yonetici serbest)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guv03_premium()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('kashe.sync_bypass', true), '') = 'on'
     OR auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.premium_tier IS NOT DISTINCT FROM OLD.premium_tier
     AND NEW.premium_until IS NOT DISTINCT FROM OLD.premium_until THEN
    RETURN NEW;
  END IF;
  -- Iptal her zaman serbest
  IF COALESCE(NEW.premium_tier, 'none') = 'none' AND NEW.premium_until IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT (
       (NEW.role = 'professional' AND NEW.premium_tier IN ('premium', 'plus'))
    OR (NEW.role = 'agency' AND NEW.premium_tier = 'agency')
  ) THEN
    RAISE EXCEPTION 'Bu plan hesap turune uygun degil.' USING ERRCODE = '42501';
  END IF;
  IF NEW.premium_until IS NULL OR NEW.premium_until > now() + interval '12 months 2 days' THEN
    RAISE EXCEPTION 'Premium suresi en fazla 12 ay.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guv03_premium ON public.profiles;
CREATE TRIGGER trg_guv03_premium
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_guv03_premium();

-- -----------------------------------------------------------------------------
-- 9) Dogrulama
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_acik text;
BEGIN
  SELECT string_agg(p.proname, ', ')
    INTO v_acik
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname LIKE 'admin\_%'
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_acik IS NOT NULL THEN
    RAISE EXCEPTION 'Guvenlik 03: girissize acik yonetici fonksiyonu kaldi: %', v_acik;
  END IF;
  IF has_function_privilege('anon', 'public.notify_quote_request_recipients(uuid[], text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_push_subscriptions_for_user(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.delete_push_subscription_by_endpoint(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Guvenlik 03: bildirim / abonelik fonksiyonu girissize acik kaldi';
  END IF;
END $$;
