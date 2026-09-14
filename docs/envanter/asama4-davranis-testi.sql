-- =============================================================================
-- FAZ -1 / Asama 4 — Davranis testleri (YALNIZ DALDA kosturulur — guncel dal ref'i; uretimde ASLA)
--
-- Zincirle kurulan dalin uretim gibi DAVRANDIGINI dogrular. Sema esitligi (asama 2)
-- yapinin ayni oldugunu gosterdi; bu test tetikleyicilerin, RLS'in ve GRANT katmaninin
-- gercekten calistigini gosterir. Uretimde KOSTURULMAZ (test verisi yazar).
--
-- Test verisi sabit UUID'lerle yazilir ve her kosuda basta silinir; tekrar guvenlidir.
-- Her test kendi DO blogunda; hata olursa o test HATA olarak raporlanir, digerleri devam eder.
-- Son SELECT sonuc tablosunu verir: hepsi GECTI olmali.
--
-- Kapsanan davranislar (test plani asama 4 + platform katmani):
--   T1 kayit -> profil  (auth.users tetikleyicisi + handle_new_user uretim surumu)
--   T2 teklif kabul -> rezervasyon (start_time/end_time tasinir, sistem mesaji, bildirim)
--   T3 ajans daveti kabul -> uyelik (agency_members, bildirimler)
--   T4 uyelikten cikarma -> atama temizligi (trg_remove_assignments_on_leave)
--   T5 koruma tetikleyicisi (normal kullanici sessiz geri alma, admin serbest)
--   T6 GRANT + RLS: anon/authenticated rolleriyle gercek sorgular (09'un 4a/4c bolumu)
-- =============================================================================

create temp table if not exists t_sonuc (sira int, test text, sonuc text, detay text);
delete from t_sonuc;

-- -----------------------------------------------------------------------------
-- 0) Temizlik — onceki kosunun izleri
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  ids uuid[] := ARRAY['a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002',
                      'a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000004']::uuid[];
BEGIN
  DELETE FROM public.bookings WHERE customer_id = ANY(ids) OR professional_id = ANY(ids);
  DELETE FROM public.messages WHERE conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = ANY(ids) OR professional_id = ANY(ids));
  DELETE FROM public.quotes WHERE conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = ANY(ids) OR professional_id = ANY(ids));
  DELETE FROM public.conversation_assignees WHERE conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = ANY(ids) OR professional_id = ANY(ids));
  DELETE FROM public.conversations WHERE customer_id = ANY(ids) OR professional_id = ANY(ids);
  DELETE FROM public.agency_members WHERE agency_id = ANY(ids) OR professional_id = ANY(ids);
  DELETE FROM public.agency_invitations WHERE agency_id = ANY(ids) OR invited_by_id = ANY(ids) OR invited_user_id = ANY(ids);
  DELETE FROM public.notifications WHERE user_id = ANY(ids);
  DELETE FROM public.profiles WHERE id = ANY(ids);
  DELETE FROM auth.users WHERE id = ANY(ids);
  INSERT INTO t_sonuc VALUES (0, 'T0 temizlik', 'GECTI', 'onceki test verisi silindi');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO t_sonuc VALUES (0, 'T0 temizlik', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T1) Kayit -> profil: auth.users'a 4 kullanici, handle_new_user profil yazmali
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  n int; c record; p record; a record;
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change,
                          email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  VALUES
   ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'faz1test+musteri@kashe.net', extensions.crypt('Faz1Test!2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"client","full_name":"Test Musteri","kvkk_approved":"true","phone":"+905550000001"}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''),
   ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'faz1test+pro1@kashe.net', extensions.crypt('Faz1Test!2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"professional","full_name":"Test Pro Bir"}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''),
   ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
    'faz1test+pro2@kashe.net', extensions.crypt('Faz1Test!2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"professional","full_name":"Test Pro Iki","kvkk_approved":"true"}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''),
   ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
    'faz1test+ajans@kashe.net', extensions.crypt('Faz1Test!2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"agency","full_name":"Test Ajans Sahibi","company_name":"Test Ajans"}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', '');

  SELECT count(*) INTO n FROM public.profiles WHERE id IN ('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000004');
  IF n <> 4 THEN RAISE EXCEPTION 'profiles satiri bekleniyor 4, bulunan %', n; END IF;

  SELECT * INTO c FROM public.profiles WHERE id = 'a0000000-0000-4000-8000-000000000001';
  SELECT * INTO p FROM public.profiles WHERE id = 'a0000000-0000-4000-8000-000000000002';
  SELECT * INTO a FROM public.profiles WHERE id = 'a0000000-0000-4000-8000-000000000004';

  IF c.role <> 'client' OR c.approval_status <> 'approved' OR c.approved_at IS NULL THEN
    RAISE EXCEPTION 'client: role=% approval=% approved_at=% (beklenen client/approved/dolu)', c.role, c.approval_status, c.approved_at; END IF;
  IF c.kvkk_approved_at IS NULL OR c.phone <> '+905550000001' THEN
    RAISE EXCEPTION 'client: kvkk_approved_at=% phone=% (beklenen dolu / +905550000001)', c.kvkk_approved_at, c.phone; END IF;
  IF p.role <> 'professional' OR p.approval_status <> 'pending' OR p.approved_at IS NOT NULL OR p.kvkk_approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'pro1: role=% approval=% approved_at=% kvkk=% (beklenen professional/pending/bos/bos)', p.role, p.approval_status, p.approved_at, p.kvkk_approved_at; END IF;
  IF a.role <> 'agency' OR a.company_name <> 'Test Ajans' OR a.approval_status <> 'pending' THEN
    RAISE EXCEPTION 'agency: role=% company=% approval=%', a.role, a.company_name, a.approval_status; END IF;

  INSERT INTO t_sonuc VALUES (1, 'T1 kayit -> profil', 'GECTI',
    'client approved+kvkk+phone, pro pending, agency company_name — handle_new_user uretim surumu');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO t_sonuc VALUES (1, 'T1 kayit -> profil', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T2) Teklif kabul -> rezervasyon (start/end_time tasinir), sistem mesaji, bildirim
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  conv uuid; q uuid; b record; qr record; n int;
BEGIN
  INSERT INTO public.conversations (customer_id, professional_id, event_date, event_type, location, guest_count, start_time, end_time)
  VALUES ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
          current_date + 30, 'wedding', 'Istanbul', 120, '14:00', '18:00')
  RETURNING id INTO conv;

  INSERT INTO public.quotes (conversation_id, sender_id, total_amount, currency, services_description, expires_at, status)
  VALUES (conv, 'a0000000-0000-4000-8000-000000000002', 5000, 'TRY', 'DJ + ses sistemi', now() + interval '7 days', 'pending')
  RETURNING id INTO q;

  -- teklif geldi bildirimi (on_quote_insert_notify_customer)
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = 'a0000000-0000-4000-8000-000000000001' AND link = '/mesajlar/' || conv;
  IF n < 1 THEN RAISE EXCEPTION 'musteriye teklif bildirimi yok'; END IF;

  UPDATE public.quotes SET status = 'accepted' WHERE id = q;

  SELECT * INTO qr FROM public.quotes WHERE id = q;
  IF qr.responded_at IS NULL THEN RAISE EXCEPTION 'quote.responded_at bos kaldi'; END IF;

  SELECT * INTO b FROM public.bookings WHERE quote_id = q;
  IF b.id IS NULL THEN RAISE EXCEPTION 'booking olusmadi (on_quote_accepted_create_booking)'; END IF;
  IF b.status <> 'confirmed' OR b.total_amount <> 5000 OR b.customer_id <> 'a0000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'booking alanlari: status=% total=% customer=%', b.status, b.total_amount, b.customer_id; END IF;
  IF b.start_time IS DISTINCT FROM '14:00'::time OR b.end_time IS DISTINCT FROM '18:00'::time THEN
    RAISE EXCEPTION 'start/end_time tasinmadi: % / % (08 dosyasindaki uretim govdesi)', b.start_time, b.end_time; END IF;

  -- sistem mesaji (on_quote_status_change_post_system_message)
  SELECT count(*) INTO n FROM public.messages WHERE conversation_id = conv AND message_type = 'system';
  IF n < 1 THEN RAISE EXCEPTION 'kabul sonrasi sistem mesaji yok'; END IF;

  INSERT INTO t_sonuc VALUES (2, 'T2 teklif kabul -> rezervasyon', 'GECTI',
    format('booking %s confirmed, start/end 14:00-18:00 tasindi, sistem mesaji + bildirim var', b.id));
EXCEPTION WHEN OTHERS THEN
  INSERT INTO t_sonuc VALUES (2, 'T2 teklif kabul -> rezervasyon', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T3) Ajans daveti kabul -> uyelik
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  inv uuid; m record; n int; ir record;
BEGIN
  INSERT INTO public.agency_invitations (agency_id, invited_email, invited_by_id, member_role, status)
  VALUES ('a0000000-0000-4000-8000-000000000004', 'faz1test+pro2@kashe.net', 'a0000000-0000-4000-8000-000000000004', 'member', 'pending')
  RETURNING id INTO inv;

  -- davet bildirimi (on_agency_invitation_insert_notify) — pro2 kayitli oldugu icin gitmeli
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = 'a0000000-0000-4000-8000-000000000003' AND link = '/davetlerim';
  IF n < 1 THEN RAISE EXCEPTION 'davet bildirimi yok'; END IF;

  UPDATE public.agency_invitations SET status = 'accepted' WHERE id = inv;

  SELECT * INTO ir FROM public.agency_invitations WHERE id = inv;
  IF ir.invited_user_id IS DISTINCT FROM 'a0000000-0000-4000-8000-000000000003'::uuid OR ir.responded_at IS NULL THEN
    RAISE EXCEPTION 'davet: invited_user_id=% responded_at=%', ir.invited_user_id, ir.responded_at; END IF;

  SELECT * INTO m FROM public.agency_members WHERE agency_id = 'a0000000-0000-4000-8000-000000000004' AND professional_id = 'a0000000-0000-4000-8000-000000000003';
  IF m.id IS NULL THEN RAISE EXCEPTION 'agency_members satiri olusmadi'; END IF;
  IF m.member_role <> 'member' THEN RAISE EXCEPTION 'member_role=% (beklenen member)', m.member_role; END IF;

  -- ajansa "katildi" bildirimi (on_agency_member_insert_notify_agency)
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = 'a0000000-0000-4000-8000-000000000004' AND link = '/profil/ekibim';
  IF n < 1 THEN RAISE EXCEPTION 'ajansa katilim bildirimi yok'; END IF;

  INSERT INTO t_sonuc VALUES (3, 'T3 davet kabul -> uyelik', 'GECTI', 'agency_members olustu, invited_user_id dolduruldu, 2 bildirim gitti');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO t_sonuc VALUES (3, 'T3 davet kabul -> uyelik', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T4) Uyelikten cikarma -> atama temizligi (trg_remove_assignments_on_leave)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  conv uuid; n int;
BEGIN
  -- musteri <-> AJANS sohbeti; pro2 bu sohbete atanir
  INSERT INTO public.conversations (customer_id, professional_id, event_date, event_type, location, guest_count)
  VALUES ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', current_date + 45, 'corporate', 'Ankara', 300)
  RETURNING id INTO conv;

  INSERT INTO public.conversation_assignees (conversation_id, professional_id, assigned_by)
  VALUES (conv, 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004');

  -- atama sistem mesaji (fn_assignee_added_message)
  SELECT count(*) INTO n FROM public.messages WHERE conversation_id = conv AND message_type = 'system';
  IF n < 1 THEN RAISE EXCEPTION 'atama sistem mesaji yok'; END IF;

  SELECT count(*) INTO n FROM public.conversation_assignees WHERE conversation_id = conv;
  IF n <> 1 THEN RAISE EXCEPTION 'atama satiri bekleniyor 1, bulunan %', n; END IF;

  -- uyelikten cikar
  DELETE FROM public.agency_members WHERE agency_id = 'a0000000-0000-4000-8000-000000000004' AND professional_id = 'a0000000-0000-4000-8000-000000000003';

  SELECT count(*) INTO n FROM public.conversation_assignees WHERE conversation_id = conv;
  IF n <> 0 THEN RAISE EXCEPTION 'atama silinmedi (trg_remove_assignments_on_leave), kalan %', n; END IF;

  INSERT INTO t_sonuc VALUES (4, 'T4 uyelikten cikarma -> atama temizligi', 'GECTI', 'uye silinince conversation_assignees satiri otomatik gitti');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO t_sonuc VALUES (4, 'T4 uyelikten cikarma -> atama temizligi', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T5) Koruma tetikleyicisi: normal kullanici sessiz geri alma, admin serbest
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  p record;
BEGIN
  -- 5a) pro1 kendi profilinde hassas alanlari degistirmeye calisir (auth.uid() = pro1)
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
  UPDATE public.profiles
     SET is_admin = true, role = 'agency', approval_status = 'approved', full_name = 'Degisti'
   WHERE id = 'a0000000-0000-4000-8000-000000000002';
  SELECT * INTO p FROM public.profiles WHERE id = 'a0000000-0000-4000-8000-000000000002';
  IF p.is_admin OR p.role <> 'professional' OR p.approval_status <> 'pending' THEN
    RAISE EXCEPTION 'koruma DELINDI: is_admin=% role=% approval=%', p.is_admin, p.role, p.approval_status; END IF;
  IF p.full_name <> 'Degisti' THEN RAISE EXCEPTION 'hassas olmayan alan (full_name) guncellenmedi'; END IF;

  -- 5b) admin bootstrap: tetikleyici kapatilip ajans kullanicisi admin yapilir (test amacli)
  PERFORM set_config('request.jwt.claim.sub', '', true);
  ALTER TABLE public.profiles DISABLE TRIGGER protect_profile_fields;
  UPDATE public.profiles SET is_admin = true WHERE id = 'a0000000-0000-4000-8000-000000000004';
  ALTER TABLE public.profiles ENABLE TRIGGER protect_profile_fields;

  -- 5c) admin (auth.uid() = ajans) pro1'i onaylar
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000004', true);
  UPDATE public.profiles SET approval_status = 'approved', approved_at = now() WHERE id = 'a0000000-0000-4000-8000-000000000002';
  SELECT * INTO p FROM public.profiles WHERE id = 'a0000000-0000-4000-8000-000000000002';
  IF p.approval_status <> 'approved' OR p.approved_at IS NULL THEN
    RAISE EXCEPTION 'admin degisikligi GERI ALINDI: approval=% approved_at=%', p.approval_status, p.approved_at; END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_sonuc VALUES (5, 'T5 koruma tetikleyicisi', 'GECTI', 'normal kullanici: is_admin/role/approval sessizce eski degerde, full_name degisti; admin: onay gecti');
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_sonuc VALUES (5, 'T5 koruma tetikleyicisi', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T6) GRANT + RLS: gercek rollerle sorgu (09 bolum 4a/4c olmadan burada "permission denied")
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  n int; n2 int;
BEGIN
  -- anon: profiller herkese acik (uretim davranisi: "Profiles are viewable by everyone")
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.profiles WHERE id = 'a0000000-0000-4000-8000-000000000002';
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'anon profili goremedi (n=%)', n; END IF;

  -- authenticated (musteri): yalniz kendi sohbetleri (T2 + T4 = 2), baskasinin degil
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.conversations;
  SELECT count(*) INTO n2 FROM public.bookings;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF n <> 2 THEN RAISE EXCEPTION 'musteri kendi 2 sohbetini gormeli, gordugu %', n; END IF;
  IF n2 <> 1 THEN RAISE EXCEPTION 'musteri 1 rezervasyon gormeli, gordugu %', n2; END IF;

  -- authenticated (pro2, artik ajansta degil): musterinin sohbetlerini GORMEMELI
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000003', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.conversations;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF n <> 0 THEN RAISE EXCEPTION 'pro2 baskasinin % sohbetini goruyor (RLS sizintisi)', n; END IF;

  -- authenticated: RPC cagrisi (fonksiyon GRANT'i) — listing_application_counts anon+authenticated'a acik
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.listing_application_counts(ARRAY[]::uuid[]);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  INSERT INTO t_sonuc VALUES (6, 'T6 GRANT + RLS', 'GECTI', 'anon profil okudu; musteri 2 sohbet/1 rezervasyon; pro2 0 sohbet; RPC cagrisi gecti');
EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_sonuc VALUES (6, 'T6 GRANT + RLS', 'HATA', SQLERRM);
END $$;

SELECT sira, test, sonuc, detay FROM t_sonuc ORDER BY sira;
