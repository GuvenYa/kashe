-- =============================================================================
-- FAZ -1 / Asama 4 — Davranis testleri (YALNIZ DALDA kosturulur — guncel dal ref'i; uretimde ASLA;
-- uretim korumasi asagida: uretimde kosulursa ilk blokta durur)
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
--   T7 profiles PII adim 2: authenticated sutun kisiti, iletisim/admin/bildirim RPC'leri,
--      davet politikalari auth.email() (ON KOSUL: 2a ve 2b dalda uygulanmis)
--   T8 FAZ 0 kiraci temeli: profil -> kurulus, uyelik/davet aynalama, has_org_permission,
--      RLS + sutun kisiti, uyumluluk gorunumu (ON KOSUL: faz0 01-03 dalda uygulanmis)
--   T9 FAZ 0 / 04 yetki fonksiyon gecisi (04 uygulanmamissa ATLANDI yazar)
--   T10 FAZ 1 internal sema gizliligi: anon/authenticated/service_role internal'a ulasamaz,
--       internal_audit_recent yalniz settings.manage ile, okuma denetime duser, PostgREST'e acik degil
--       (ON KOSUL: faz1_01 dalda uygulanmis)
--   T11 FAZ 2a saglayici defteri: profil -> talents/providers/alt profil (ayni id), aynalama,
--       koruma tetikleyicisi (kara liste + admin), sutun kisiti, talents gizliligi, tam-bir kisiti
--       (ON KOSUL: faz2a 01-03 dalda uygulanmis)
--   T12 FAZ 3a taksonomi: service_roles = legacy kategoriler (slug birebir, arketip), admin kategori
--       ekler -> rol dogar, guncelleme aynalanir, ust katman satiri rol olmaz, anon okur/yazamaz,
--       slug kisiti (ON KOSUL: faz3a_01 dalda uygulanmis)
--   T13 FAZ 2b saglayici hizmetleri: birincil kategori -> provider_services birincil satiri; hizmet ekle /
--       fiyat degistir / temsilci degisimi / pasife al / sil -> satir turetilir veya silinir; fiyat birimi
--       eslemesi; professional_profiles ozeti; 5 tabloda provider_id otomatik (istemci degeri ezilir,
--       client sahibi -> NULL); RLS (yayinda degilse anon gormez), istemci yazamaz; v_provider_roles
--       (ON KOSUL: faz2b 01-03 dalda uygulanmis)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- URETIM KORUMASI — bu betik uretimde KOSULMAZ. Uretim iki isaretten tanınir:
--   (1) pg_cron isi "send-message-notifications" yalniz uretimde vardir
--   (2) test disi (faz1test+ olmayan) profil sayisi > 10 — dal yalniz test verisi tasir
-- Uretim tespit edilirse betik BURADA durur, hicbir sey yazilmaz.
-- 15 Eylul 2026: Dashboard'un uretimi "main" diye etiketlemesi yuzunden bir kez uretimde
-- kosuldu (T0 blogu ile temizlendi); bu koruma o gun eklendi. Proje ref'ini adres cubugundan
-- dogrula: dal = ukqhgspaallzjscjodbb, uretim = qydsooqmflrrwtgawhsv.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  n_cron int := 0;
  n_prof int;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM cron.job WHERE jobname = ''send-message-notifications''' INTO n_cron;
  END IF;
  SELECT count(*) INTO n_prof FROM public.profiles WHERE email NOT LIKE 'faz1test+%';
  IF n_cron > 0 OR n_prof > 10 THEN
    RAISE EXCEPTION 'URETIM KORUMASI: bu veritabani uretim gibi gorunuyor (cron isi=%, test disi profil=%). asama4 yalniz onizleme dalinda kosulur. Hicbir sey yazilmadi.', n_cron, n_prof;
  END IF;
END $$;

create temp table if not exists t_sonuc (sira int, test text, sonuc text, detay text);
delete from t_sonuc;

-- -----------------------------------------------------------------------------
-- 0) Temizlik — onceki kosunun izleri
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  ids uuid[] := ARRAY['a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002',
                      'a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000004',
                      'a0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000006']::uuid[];
BEGIN
  -- T13 hizmetleri ve turetilen satirlar: kategori/rol silinmeden ONCE (FK: services.category_id,
  -- provider_services.role_id RESTRICT). services her zaman var; provider_services 2b'den sonra.
  DELETE FROM public.services WHERE profile_id = ANY(ids);
  IF to_regclass('public.provider_services') IS NOT NULL THEN
    DELETE FROM public.provider_services WHERE provider_id = ANY(ids);
  END IF;
  UPDATE public.profiles SET primary_category_id = NULL
   WHERE id = ANY(ids) AND primary_category_id IN (SELECT id FROM public.service_categories WHERE slug LIKE 'faz1test-%');
  -- T12/T13 test kategorileri (slug 'faz1test-%'): once rol, sonra kategori
  IF to_regclass('public.service_roles') IS NOT NULL THEN
    DELETE FROM public.service_roles WHERE slug LIKE 'faz1test-%';
    DELETE FROM public.service_categories WHERE slug LIKE 'faz1test-%';
  END IF;
  -- T10 denetim kayitlari (FK yok; aktor uzerinden silinir)
  IF to_regclass('internal.access_audit') IS NOT NULL THEN
    DELETE FROM internal.access_audit WHERE actor_user_id = ANY(ids);
  END IF;
  -- T8/T9 kurum verisi (tablolar FAZ 0'dan once yoksa sessizce atla)
  IF to_regclass('public.business_members') IS NOT NULL THEN
    DELETE FROM public.business_members WHERE business_id = ANY(ids) OR member_user_id = ANY(ids);
    DELETE FROM public.business_invitations WHERE business_id = ANY(ids) OR invited_by_id = ANY(ids) OR invited_user_id = ANY(ids);
  END IF;
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

-- -----------------------------------------------------------------------------
-- T7) profiles PII adim 2: authenticated sutun kisiti + RPC'ler + davet politikalari
-- ON KOSUL: 20260915100000_profiles_pii_adim2a_rpc.sql VE adim 2b
-- (docs/envanter/bekleyen/20260915100100_...) dalda uygulanmis olmali. 2b yoksa ilk
-- kontrol ("select email" -> 42501 beklenir) GECMEZ. T1-T5 verisine dayanir:
-- T2 musteri<->pro1 onayli rezervasyon, T4 pro2'nin atamasi silindi, T5 ajans admin.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  n int; n2 int; e text; r record;
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  pro2    uuid := 'a0000000-0000-4000-8000-000000000003';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
BEGIN
  -- 7 hazirlik: pro1'e bilinen telefon ve revizyon notu yazilir (T1'de pro1'in telefonu
  -- yok; NULL = NULL karsilastirmasi "kendi telefonunu doner"i kanitlamaz). Admin (ajans,
  -- T5) claim'iyle yazilir ki koruma tetikleyicisi hicbir alani geri almasin.
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  UPDATE public.profiles SET phone = '+905550000002', approval_note = 'T7 revizyon notu' WHERE id = pro1;
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- 7a) authenticated (pro1): kapali sutun dogrudan secilemez -> 42501
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT p.email INTO e FROM public.profiles p WHERE p.id = pro1;
    RAISE EXCEPTION 'authenticated profiles.email okuyabildi (2b uygulanmamis olabilir)';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- beklenen
  END;
  EXECUTE 'RESET ROLE';

  -- 7b) pro1 kendi iletisim bilgisini okur
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.get_contact_info(pro1) g WHERE g.email = 'faz1test+pro1@kashe.net';
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'get_contact_info(pro1) kendi bilgisini donmedi (n=%)', n; END IF;

  -- 7c) pro1 -> musteri: T2'deki onayli rezervasyon sayesinde acik
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.get_contact_info(musteri) g WHERE g.phone = '+905550000001';
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'get_contact_info(musteri) onayli rezervasyona ragmen donmedi (n=%)', n; END IF;

  -- 7d) pro1 -> ajans: iliski yok, bos
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.get_contact_info(ajans);
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'get_contact_info(ajans) iliski olmadan % satir dondu (sizinti)', n; END IF;

  -- 7e) pro1 kendi kapali sutunlarini argumansiz RPC ile okur: kendi phone'u, e-postasi, notu
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.get_own_private_profile();
  SELECT o.phone, o.email, o.approval_note INTO r FROM public.get_own_private_profile() o;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'get_own_private_profile 1 satir donmeli, % dondu', n; END IF;
  IF r.phone IS DISTINCT FROM '+905550000002' THEN
    RAISE EXCEPTION 'get_own_private_profile phone=% (beklenen pro1''in telefonu +905550000002)', r.phone; END IF;
  IF r.email IS DISTINCT FROM 'faz1test+pro1@kashe.net' OR r.approval_note IS DISTINCT FROM 'T7 revizyon notu' THEN
    RAISE EXCEPTION 'get_own_private_profile email=% not=% (beklenen pro1)', r.email, r.approval_note; END IF;

  -- 7f) bildirim adresi: pro1 musteriyle ayni konusmada -> doner
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT public.get_notification_email(musteri) INTO e;
  EXECUTE 'RESET ROLE';
  IF e IS DISTINCT FROM 'faz1test+musteri@kashe.net' THEN
    RAISE EXCEPTION 'get_notification_email(musteri) pro1 icin % dondu', e; END IF;

  -- 7g) pro2 (T4'te ajanstan cikti, atamasi silindi) -> null
  PERFORM set_config('request.jwt.claim.sub', pro2::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT public.get_notification_email(musteri) INTO e;
  EXECUTE 'RESET ROLE';
  IF e IS NOT NULL THEN RAISE EXCEPTION 'get_notification_email(musteri) pro2 icin null bekleniyordu, % dondu', e; END IF;

  -- 7h) admin RPC'leri: pro1 (admin degil) -> ikisi de 42501
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM * FROM public.admin_profile_contacts(ARRAY[pro1]);
    RAISE EXCEPTION 'admin_profile_contacts admin olmayan pro1 icin calisti';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- beklenen
  END;
  EXECUTE 'RESET ROLE';
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM * FROM public.admin_profile_ids_by_email('faz1test');
    RAISE EXCEPTION 'admin_profile_ids_by_email admin olmayan pro1 icin calisti';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- beklenen
  END;
  EXECUTE 'RESET ROLE';

  -- 7i) ajans (T5'te admin yapildi) -> id + 7 kapali sutun doner; e-posta aramasi pro1'i bulur
  -- Sutun sayisi fonksiyon imzasindan olculur: RETURNS TABLE sutunlari proargmodes'ta 't'.
  SELECT count(*) INTO n FROM pg_proc p, unnest(p.proargmodes) m
   WHERE p.oid = 'public.admin_profile_contacts(uuid[])'::regprocedure AND m = 't';
  IF n <> 8 THEN RAISE EXCEPTION 'admin_profile_contacts donus sutunu % (beklenen id + 7 kapali = 8)', n; END IF;

  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.admin_profile_contacts(ARRAY[pro1, musteri]);
  -- 7 kapali sutunun hepsi adiyla okunur; biri yoksa sorgu hata verir ve T7 HATA olur
  SELECT a.id, a.email, a.phone, a.kvkk_approved_at, a.approval_note,
         a.suspension_reason, a.suspended_by, a.welcome_email_sent_at
    INTO r FROM public.admin_profile_contacts(ARRAY[pro1]) a;
  SELECT count(*) INTO n2 FROM public.admin_profile_ids_by_email('faz1test+pro1') x WHERE x = pro1;
  EXECUTE 'RESET ROLE';
  IF n <> 2 THEN RAISE EXCEPTION 'admin_profile_contacts ajans (admin) icin 2 satir bekleniyordu, %', n; END IF;
  IF r.email IS DISTINCT FROM 'faz1test+pro1@kashe.net' OR r.phone IS DISTINCT FROM '+905550000002'
     OR r.approval_note IS DISTINCT FROM 'T7 revizyon notu' THEN
    RAISE EXCEPTION 'admin_profile_contacts pro1 degerleri: email=% phone=% not=%', r.email, r.phone, r.approval_note; END IF;
  IF n2 <> 1 THEN RAISE EXCEPTION 'admin_profile_ids_by_email pro1''i bulmadi (n=%)', n2; END IF;

  -- 7j) anon: RPC yetkisi yok -> 42501
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM * FROM public.get_contact_info(pro1);
    RAISE EXCEPTION 'anon get_contact_info cagirabildi';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- beklenen
  END;
  EXECUTE 'RESET ROLE';

  -- 7k) authenticated davet sorgusu hata vermez (politika artik auth.email() kullaniyor)
  PERFORM set_config('request.jwt.claim.sub', pro2::text, true);
  PERFORM set_config('request.jwt.claim.email', 'faz1test+pro2@kashe.net', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.agency_invitations;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.email', '', true);
  IF n < 1 THEN RAISE EXCEPTION 'pro2 T3 davetini goremedi (n=%)', n; END IF;

  INSERT INTO t_sonuc VALUES (7, 'T7 profiles PII adim 2', 'GECTI',
    'authenticated email 42501; get_contact_info kendi/rezervasyon/iliskisiz; get_own_private_profile pro1 kendi phone/email/notu; bildirim pro1 var pro2 null; admin RPC pro1 42501 (iki fonksiyon); ajans admin_profile_contacts id+7 sutun, pro1 degerleriyle; e-posta aramasi; anon RPC 42501; davet politikasi auth.email()');
EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.email', '', true);
  INSERT INTO t_sonuc VALUES (7, 'T7 profiles PII adim 2', 'HATA', SQLERRM);
END $$;


-- -----------------------------------------------------------------------------
-- T8) FAZ 0 kiraci temeli: profil -> kurulus, aynalama, yetki, RLS
-- ON KOSUL: 20260915150000/150100/150200 (faz0 01-03) dalda uygulanmis. T1-T4 verisine dayanir:
-- ajans (0004) T1'de kaydoldu, pro2 T3'te uye oldu T4'te cikarildi, T5 ajans admin.
-- Kendi verisi: kurum (0005, business) ve uye (0006, client).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  pro2    uuid := 'a0000000-0000-4000-8000-000000000003';
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  kurum   uuid := 'a0000000-0000-4000-8000-000000000005';
  uye     uuid := 'a0000000-0000-4000-8000-000000000006';
  org_a uuid; org_k uuid; bm_id uuid; inv uuid; o record; m record; n int; n2 int; st text;
BEGIN
  -- 8a) T1'de kaydolan ajans icin kurulus + kurucu uyeligi otomatik olusmus olmali
  SELECT * INTO o FROM public.organizations WHERE legacy_profile_id = ajans;
  IF o.id IS NULL THEN RAISE EXCEPTION 'ajans icin organizations satiri yok (profil tetikleyicisi)'; END IF;
  IF o.account_type <> 'agency' OR o.display_name <> 'Test Ajans' OR o.owner_user_id <> ajans OR o.slug NOT LIKE 'org-%' THEN
    RAISE EXCEPTION 'ajans kurulusu: type=% ad=% owner=% slug=%', o.account_type, o.display_name, o.owner_user_id, o.slug; END IF;
  org_a := o.id;
  SELECT * INTO m FROM public.organization_memberships WHERE organization_id = org_a AND user_id = ajans;
  IF m.id IS NULL OR m.role <> 'owner' OR m.status <> 'active' OR m.legacy_source <> 'owner_seed' THEN
    RAISE EXCEPTION 'kurucu uyeligi: role=% status=% src=%', m.role, m.status, m.legacy_source; END IF;

  -- 8b) pro2: T3'te eklendi, T4'te silindi -> yeni tabloda da yok; T3 daveti aynalandi (ayni id, accepted, viewer)
  SELECT count(*) INTO n FROM public.organization_memberships WHERE organization_id = org_a AND user_id = pro2;
  IF n <> 0 THEN RAISE EXCEPTION 'pro2 uyeligi yeni tabloda kaldi (DELETE aynalamasi), n=%', n; END IF;
  SELECT count(*) INTO n FROM public.agency_invitations ai JOIN public.organization_invitations oi ON oi.id = ai.id
   WHERE ai.agency_id = ajans AND oi.organization_id = org_a AND oi.status::text = ai.status::text AND oi.role = 'viewer';
  IF n <> 1 THEN RAISE EXCEPTION 'T3 daveti aynalanmadi (n=%)', n; END IF;

  -- 8c) client icin kurulus yok
  IF public.organization_id_for_profile(musteri) IS NOT NULL THEN RAISE EXCEPTION 'client icin kurulus olusmus'; END IF;

  -- 8d) kurum (business) + uye (client) kaydi -> kurum icin kurulus otomatik
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
  ('00000000-0000-0000-0000-000000000000', kurum, 'authenticated', 'authenticated',
    'faz1test+kurum@kashe.net', extensions.crypt('Faz1Test!2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"business","full_name":"Test Kurum Sahibi","company_name":"Test Kurum"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', uye, 'authenticated', 'authenticated',
    'faz1test+uye@kashe.net', extensions.crypt('Faz1Test!2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"client","full_name":"Test Uye"}'::jsonb, now(), now(), '', '', '', '');

  SELECT * INTO o FROM public.organizations WHERE legacy_profile_id = kurum;
  IF o.id IS NULL OR o.account_type <> 'business' OR o.display_name <> 'Test Kurum' THEN
    RAISE EXCEPTION 'kurum kurulusu: id=% type=% ad=%', o.id, o.account_type, o.display_name; END IF;
  org_k := o.id;
  IF public.organization_id_for_profile(uye) IS NOT NULL THEN RAISE EXCEPTION 'uye (client) icin kurulus olusmus'; END IF;

  -- 8e) business_members INSERT/UPDATE aynalamasi (ayni id; manager->admin, member->viewer)
  INSERT INTO public.business_members (business_id, member_user_id, member_role) VALUES (kurum, uye, 'manager') RETURNING id INTO bm_id;
  SELECT * INTO m FROM public.organization_memberships WHERE id = bm_id;
  IF m.id IS NULL OR m.organization_id <> org_k OR m.user_id <> uye OR m.role <> 'admin' OR m.legacy_source <> 'business_members' THEN
    RAISE EXCEPTION 'uyelik aynalamasi INSERT: org=% user=% role=% src=%', m.organization_id, m.user_id, m.role, m.legacy_source; END IF;
  UPDATE public.business_members SET member_role = 'member' WHERE id = bm_id;
  SELECT role INTO m FROM public.organization_memberships WHERE id = bm_id;
  IF m.role <> 'viewer' THEN RAISE EXCEPTION 'uyelik aynalamasi UPDATE: role=% (beklenen viewer)', m.role; END IF;
  SELECT count(*) INTO n FROM (
    (SELECT id, business_id, member_user_id, member_role FROM public.business_members WHERE business_id = kurum
     EXCEPT SELECT id, business_id, member_user_id, member_role FROM public.v_business_members WHERE business_id = kurum)
    UNION ALL
    (SELECT id, business_id, member_user_id, member_role FROM public.v_business_members WHERE business_id = kurum
     EXCEPT SELECT id, business_id, member_user_id, member_role FROM public.business_members WHERE business_id = kurum)) x;
  IF n <> 0 THEN RAISE EXCEPTION 'v_business_members eski tabloyla farkli (% satir)', n; END IF;

  -- 8f) business_invitations aynalamasi: pending -> cancelled
  INSERT INTO public.business_invitations (business_id, invited_email, invited_by_id, member_role, status)
  VALUES (kurum, 'faz1test+pro1@kashe.net', kurum, 'manager', 'pending') RETURNING id INTO inv;
  SELECT status::text INTO st FROM public.organization_invitations WHERE id = inv AND organization_id = org_k AND role = 'admin';
  IF st IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'davet aynalamasi INSERT: status=%', st; END IF;
  UPDATE public.business_invitations SET status = 'cancelled' WHERE id = inv;
  SELECT status::text INTO st FROM public.organization_invitations WHERE id = inv;
  IF st IS DISTINCT FROM 'cancelled' THEN RAISE EXCEPTION 'davet aynalamasi UPDATE: status=%', st; END IF;

  -- 8g) has_org_permission / is_org_member (02 matrisi)
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  IF NOT public.has_org_permission(org_k, 'members.manage') OR NOT public.has_org_permission(org_k, 'billing.manage') THEN
    RAISE EXCEPTION 'kurucu (owner) members.manage/billing.manage almali'; END IF;
  PERFORM set_config('request.jwt.claim.sub', uye::text, true);
  IF NOT public.is_org_member(org_k) THEN RAISE EXCEPTION 'uye is_org_member false'; END IF;
  IF NOT public.has_org_permission(org_k, 'events.view') THEN RAISE EXCEPTION 'viewer events.view almali'; END IF;
  IF public.has_org_permission(org_k, 'members.manage') OR public.has_org_permission(org_k, 'crew.manage') THEN
    RAISE EXCEPTION 'viewer members.manage/crew.manage ALMAMALI'; END IF;
  IF public.is_org_member(org_a) THEN RAISE EXCEPTION 'uye ajans kurulusunun uyesi gorunuyor (kiraci sizintisi)'; END IF;
  -- permissions jsonb ince ayari
  UPDATE public.organization_memberships SET permissions = '{"crew.manage": true, "events.view": false}'::jsonb WHERE id = bm_id;
  IF NOT public.has_org_permission(org_k, 'crew.manage') THEN RAISE EXCEPTION 'permissions {crew.manage:true} etkisiz'; END IF;
  IF public.has_org_permission(org_k, 'events.view') THEN RAISE EXCEPTION 'permissions {events.view:false} etkisiz'; END IF;
  UPDATE public.organization_memberships SET permissions = '{}'::jsonb WHERE id = bm_id;
  -- pasif uyelik sayilmaz
  UPDATE public.organization_memberships SET status = 'suspended' WHERE id = bm_id;
  IF public.is_org_member(org_k) THEN RAISE EXCEPTION 'suspended uye is_org_member true'; END IF;
  UPDATE public.organization_memberships SET status = 'active' WHERE id = bm_id;
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- 8h) RLS + GRANT: uye yalniz kendi kurulusunu gorur; pro1 hicbirini; ajans (admin) hepsini
  PERFORM set_config('request.jwt.claim.sub', uye::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.organizations;
  SELECT count(*) INTO n2 FROM public.organization_memberships;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'uye % kurulus goruyor (beklenen 1)', n; END IF;
  IF n2 <> 2 THEN RAISE EXCEPTION 'uye % uyelik goruyor (beklenen 2: kurucu + kendisi)', n2; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.organizations;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'pro1 (uye degil) % kurulus goruyor', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.organizations;
  EXECUTE 'RESET ROLE';
  IF n < 2 THEN RAISE EXCEPTION 'admin (ajans) % kurulus goruyor (beklenen >= 2)', n; END IF;
  -- sutun kisiti: tax_number authenticated'a kapali
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT tax_number FROM public.organizations' INTO st;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'tax_number authenticated tarafindan OKUNDU (42501 beklenirdi)';
  EXCEPTION WHEN insufficient_privilege THEN
    EXECUTE 'RESET ROLE';
  END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  -- anon: hic erisim yok
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'SELECT count(*) FROM public.organizations' INTO n;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon organizations okudu (42501 beklenirdi)';
  EXCEPTION WHEN insufficient_privilege THEN
    EXECUTE 'RESET ROLE';
  END;

  -- 8i) profil guncellemesi kurulusa yansir (profil hala kaynak)
  UPDATE public.profiles SET company_name = 'Test Kurum AS', premium_tier = 'plus' WHERE id = kurum;
  SELECT * INTO o FROM public.organizations WHERE id = org_k;
  IF o.display_name <> 'Test Kurum AS' OR o.subscription_tier <> 'plus' THEN
    RAISE EXCEPTION 'profil -> kurulus guncellemesi yansimadi: ad=% tier=%', o.display_name, o.subscription_tier; END IF;

  -- 8j) DELETE aynalamasi + hata gunlugu bos
  DELETE FROM public.business_members WHERE id = bm_id;
  SELECT count(*) INTO n FROM public.organization_memberships WHERE id = bm_id;
  IF n <> 0 THEN RAISE EXCEPTION 'uyelik DELETE aynalanmadi'; END IF;
  SELECT count(*) INTO n FROM public.organization_sync_log;
  IF n <> 0 THEN
    SELECT string_agg(source || '/' || operation || ': ' || detail, ' | ') INTO st FROM public.organization_sync_log;
    RAISE EXCEPTION 'organization_sync_log bos degil (%): %', n, st; END IF;

  INSERT INTO t_sonuc VALUES (8, 'T8 FAZ 0 kiraci temeli', 'GECTI',
    'ajans+kurum kurulusu otomatik, kurucu owner_seed; uyelik INSERT/UPDATE/DELETE ve davet aynalandi (ayni id); v_business_members = business_members; has_org_permission matris + jsonb ince ayar + suspended; RLS uye 1 / pro1 0 / admin hepsi; tax_number ve anon 42501; profil guncellemesi yansidi; sync_log bos');
EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_sonuc VALUES (8, 'T8 FAZ 0 kiraci temeli', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T9) FAZ 0 / 04 yetki fonksiyon gecisi: has_business_role / is_business_member yeni tablodan okur
-- 04 uygulanmamissa (govde hala business_members okuyor) ATLANDI yazar. T8 verisine dayanir.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  kurum uuid := 'a0000000-0000-4000-8000-000000000005';
  uye   uuid := 'a0000000-0000-4000-8000-000000000006';
  bm_id uuid; n int;
BEGIN
  IF pg_get_functiondef('public.has_business_role(uuid, public.business_member_role)'::regprocedure) NOT ILIKE '%organization_memberships%' THEN
    INSERT INTO t_sonuc VALUES (9, 'T9 FAZ 0 yetki fonksiyon gecisi', 'ATLANDI', '04_yetki_fonksiyon_gecisi dalda uygulanmamis; has_business_role hala business_members okuyor');
    RETURN;
  END IF;

  INSERT INTO public.business_members (business_id, member_user_id, member_role) VALUES (kurum, uye, 'manager') RETURNING id INTO bm_id;

  -- uye (manager): member ve manager esigi gecer, owner gecmez; is_business_member true
  PERFORM set_config('request.jwt.claim.sub', uye::text, true);
  IF NOT public.has_business_role(kurum, 'member') OR NOT public.has_business_role(kurum, 'manager') THEN
    RAISE EXCEPTION 'manager: member/manager esigi gecmedi'; END IF;
  IF public.has_business_role(kurum, 'owner') THEN RAISE EXCEPTION 'manager owner esigini gecti'; END IF;
  IF NOT public.is_business_member(kurum) THEN RAISE EXCEPTION 'is_business_member false'; END IF;

  -- kurucu: eski davranis korunur (business_members'ta yoktu -> false)
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  IF public.is_business_member(kurum) OR public.has_business_role(kurum, 'member') THEN
    RAISE EXCEPTION 'kurucu icin is_business_member/has_business_role true (eski davranis: false)'; END IF;

  -- mutasyon: yeni tablodaki satir silinince fonksiyon false donmeli (eski tabloyu degil yeniyi okudugunun kaniti)
  PERFORM set_config('request.jwt.claim.sub', uye::text, true);
  DELETE FROM public.organization_memberships WHERE id = bm_id;
  IF public.has_business_role(kurum, 'member') OR public.is_business_member(kurum) THEN
    RAISE EXCEPTION 'yeni tablo satiri silindi ama fonksiyon hala true (eski tabloyu okuyor?)'; END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);

  DELETE FROM public.business_members WHERE id = bm_id;
  SELECT count(*) INTO n FROM public.organization_sync_log;
  IF n <> 0 THEN RAISE EXCEPTION 'organization_sync_log bos degil (%)', n; END IF;

  INSERT INTO t_sonuc VALUES (9, 'T9 FAZ 0 yetki fonksiyon gecisi', 'GECTI',
    'has_business_role member/manager gecer owner gecmez; is_business_member true; kurucu false (eski davranis); yeni satir silinince false (mutasyon kaniti)');
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_sonuc VALUES (9, 'T9 FAZ 0 yetki fonksiyon gecisi', 'HATA', SQLERRM);
END $$;


-- -----------------------------------------------------------------------------
-- T10) FAZ 1 internal sema gizliligi (02-guvenlik-modeli bolum 9: "musteri jetonuyla internal
-- semadaki her tablo -> tumu reddedilir"). ON KOSUL: 20260915170000_faz1_01_internal_sema.sql dalda.
-- T8 verisine dayanir: kurum (0005) kurulus sahibi, uye (0006) T8/T9 sonunda uye DEGIL, pro1 (0002) iliskisiz.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  kurum uuid := 'a0000000-0000-4000-8000-000000000005';
  uye   uuid := 'a0000000-0000-4000-8000-000000000006';
  pro1  uuid := 'a0000000-0000-4000-8000-000000000002';
  org_k uuid; bm_id uuid; n int; n2 int; cfg text; r record;
BEGIN
  IF to_regnamespace('internal') IS NULL THEN
    INSERT INTO t_sonuc VALUES (10, 'T10 FAZ 1 internal gizlilik', 'ATLANDI', 'internal semasi yok; faz1_01 dalda uygulanmamis');
    RETURN;
  END IF;
  SELECT id INTO org_k FROM public.organizations WHERE legacy_profile_id = kurum;
  IF org_k IS NULL THEN RAISE EXCEPTION 'kurum kurulusu yok (T8 kosmadi?)'; END IF;

  -- 10a) PostgREST'e acik degil: authenticator rolunun pgrst.db_schemas ayarinda 'internal' gecmez.
  --      Supabase bu ayari rol uzerinde tutmaz (platform ayari); o zaman kontrol bos gecer ve
  --      Dashboard > Project Settings > API > Exposed schemas elle dogrulanir (asama6 K2 ayrintisi).
  SELECT string_agg(c, ' ') INTO cfg
    FROM pg_roles pr, unnest(pr.rolconfig) c WHERE pr.rolname = 'authenticator' AND c LIKE 'pgrst.db_schemas%';
  IF cfg IS NOT NULL AND cfg ~* '\minternal\M' THEN
    RAISE EXCEPTION 'internal semasi PostgREST''e ACIK: %', cfg; END IF;

  -- 10b) Sema ve tablo yetkileri: uc rolde de USAGE yok, internal'da hic GRANT yok
  IF has_schema_privilege('anon', 'internal', 'USAGE') OR has_schema_privilege('authenticated', 'internal', 'USAGE')
     OR has_schema_privilege('service_role', 'internal', 'USAGE') THEN
    RAISE EXCEPTION 'internal semasinda USAGE var (anon/authenticated/service_role)'; END IF;
  SELECT count(*) INTO n FROM information_schema.role_table_grants
   WHERE table_schema = 'internal' AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC');
  IF n <> 0 THEN RAISE EXCEPTION 'internal tablolarinda % GRANT var', n; END IF;

  -- 10c) Dogrudan erisim: anon, authenticated (sahip bile), service_role -> 42501
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'SELECT count(*) FROM internal.access_audit' INTO n;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon internal.access_audit okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM internal.access_audit' INTO n;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'authenticated (kurulus sahibi) internal.access_audit''i dogrudan okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT internal.log_access($1, ''read'', ''x'')' USING org_k;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'authenticated internal.log_access cagirdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE service_role';
    EXECUTE 'SELECT count(*) FROM internal.access_audit' INTO n;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'service_role internal.access_audit okudu (BYPASSRLS yetmemeli, USAGE yok)';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 10d) RPC: sahip (settings.manage) okur ve okuma denetime duser
  SELECT count(*) INTO n FROM internal.access_audit WHERE organization_id = org_k;
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n2 FROM public.internal_audit_recent(org_k, 10);
  EXECUTE 'RESET ROLE';
  IF n2 < 1 THEN RAISE EXCEPTION 'sahip internal_audit_recent bos dondu (kendi okumasi bile yok)'; END IF;
  SELECT * INTO r FROM internal.access_audit WHERE organization_id = org_k ORDER BY id DESC LIMIT 1;
  IF r.actor_user_id IS DISTINCT FROM kurum OR r.action <> 'read' OR r.target_table <> 'access_audit' THEN
    RAISE EXCEPTION 'denetim satiri hatali: actor=% action=% tablo=%', r.actor_user_id, r.action, r.target_table; END IF;
  SELECT count(*) INTO n2 FROM internal.access_audit WHERE organization_id = org_k;
  IF n2 <> n + 1 THEN RAISE EXCEPTION 'denetim satiri sayisi % -> % (beklenen +1)', n, n2; END IF;

  -- 10e) RPC: viewer uye (settings.manage yok) -> 42501; iliskisiz pro1 -> 42501; anon -> 42501
  INSERT INTO public.business_members (business_id, member_user_id, member_role) VALUES (kurum, uye, 'member') RETURNING id INTO bm_id;
  PERFORM set_config('request.jwt.claim.sub', uye::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.internal_audit_recent(org_k, 10);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'viewer uye internal_audit_recent okudu (% satir)', n;
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.internal_audit_recent(org_k, 10);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'iliskisiz pro1 internal_audit_recent okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO n FROM public.internal_audit_recent(org_k, 10);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon internal_audit_recent cagirdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  DELETE FROM public.business_members WHERE id = bm_id;

  -- 10f) reddedilen denemeler denetime yazilmamis olmali (RAISE geri alir); sahip okumasi tek kayit
  SELECT count(*) INTO n2 FROM internal.access_audit WHERE organization_id = org_k;
  IF n2 <> n + 1 THEN RAISE EXCEPTION 'reddedilen denemeler sonrasi denetim sayisi degisti: %', n2; END IF;

  INSERT INTO t_sonuc VALUES (10, 'T10 FAZ 1 internal gizlilik', 'GECTI',
    'PostgREST''e acik degil; USAGE/GRANT yok; anon, sahip (dogrudan), service_role 42501; log_access dogrudan 42501; sahip RPC okudu + denetim satiri (actor/read/access_audit); viewer, iliskisiz, anon RPC 42501; reddedilenler denetime yazilmadi');
EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_sonuc VALUES (10, 'T10 FAZ 1 internal gizlilik', 'HATA', SQLERRM);
END $$;


-- -----------------------------------------------------------------------------
-- T11) FAZ 2a saglayici defteri. ON KOSUL: 20260917120000/120100/120200 dalda.
-- T1 verisine dayanir: pro1 (0002), pro2 (0003), ajans (0004, T5'te admin + approved degil),
-- musteri (0001), kurum (0005, business). T5: pro1 approved.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  pro2    uuid := 'a0000000-0000-4000-8000-000000000003';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  kurum   uuid := 'a0000000-0000-4000-8000-000000000005';
  pr record; t record; n int; st text; org_a uuid;
BEGIN
  IF to_regclass('public.providers') IS NULL THEN
    INSERT INTO t_sonuc VALUES (11, 'T11 FAZ 2a saglayici defteri', 'ATLANDI', 'providers tablosu yok; faz2a dalda uygulanmamis');
    RETURN;
  END IF;

  -- 11a) pro1: talents + providers + professional_profiles, hepsi ayni id; onay T5'ten aynalanmis
  SELECT * INTO t FROM public.talents WHERE id = pro1;
  IF t.id IS NULL OR t.user_id <> pro1 OR t.claim_status <> 'claimed' OR t.origin <> 'marketplace_signup' THEN
    RAISE EXCEPTION 'pro1 talents: id=% user=% claim=% origin=%', t.id, t.user_id, t.claim_status, t.origin; END IF;
  SELECT * INTO pr FROM public.providers WHERE id = pro1;
  IF pr.id IS NULL OR pr.provider_type <> 'professional' OR pr.talent_id <> pro1 OR pr.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'pro1 providers: type=% talent=% org=%', pr.provider_type, pr.talent_id, pr.organization_id; END IF;
  IF pr.approval_status <> 'approved' OR pr.approved_at IS NULL THEN
    RAISE EXCEPTION 'pro1 onayi aynalanmadi: %', pr.approval_status; END IF;
  IF pr.display_name <> 'Degisti' THEN RAISE EXCEPTION 'pro1 display_name=% (T5 full_name Degisti beklenir)', pr.display_name; END IF;
  IF pr.slug NOT LIKE 'p-%' THEN RAISE EXCEPTION 'pro1 slug=% (profil slug bos -> p- beklenir)', pr.slug; END IF;
  SELECT count(*) INTO n FROM public.professional_profiles WHERE provider_id = pro1;
  IF n <> 1 THEN RAISE EXCEPTION 'pro1 professional_profiles yok'; END IF;

  -- 11b) ajans: organization tipi, FAZ 0 kurulusuna bagli, organization_profiles var
  SELECT id INTO org_a FROM public.organizations WHERE legacy_profile_id = ajans;
  SELECT * INTO pr FROM public.providers WHERE id = ajans;
  IF pr.id IS NULL OR pr.provider_type <> 'organization' OR pr.organization_id IS DISTINCT FROM org_a OR pr.talent_id IS NOT NULL THEN
    RAISE EXCEPTION 'ajans providers: type=% org=% (beklenen %) talent=%', pr.provider_type, pr.organization_id, org_a, pr.talent_id; END IF;
  IF pr.display_name <> 'Test Ajans' THEN RAISE EXCEPTION 'ajans display_name=%', pr.display_name; END IF;
  SELECT count(*) INTO n FROM public.organization_profiles WHERE provider_id = ajans;
  IF n <> 1 THEN RAISE EXCEPTION 'ajans organization_profiles yok'; END IF;
  SELECT count(*) INTO n FROM public.talents WHERE id = ajans;
  IF n <> 0 THEN RAISE EXCEPTION 'ajans icin talents satiri olusmus'; END IF;

  -- 11c) client ve business: saglayici degil
  SELECT count(*) INTO n FROM public.providers WHERE id IN (musteri, kurum);
  IF n <> 0 THEN RAISE EXCEPTION 'client/business icin providers satiri var (%)', n; END IF;

  -- 11d) aynalama: profil guncellemesi -> providers / professional_profiles / talents
  UPDATE public.profiles SET is_published = true, bio = 'T11 bio', full_name = 'Test Pro Iki B' WHERE id = pro2;
  SELECT * INTO pr FROM public.providers WHERE id = pro2;
  IF NOT pr.is_published OR pr.display_name <> 'Test Pro Iki B' THEN
    RAISE EXCEPTION 'pro2 aynalama: is_published=% ad=%', pr.is_published, pr.display_name; END IF;
  SELECT bio INTO st FROM public.professional_profiles WHERE provider_id = pro2;
  IF st IS DISTINCT FROM 'T11 bio' THEN RAISE EXCEPTION 'pro2 bio aynalanmadi: %', st; END IF;
  SELECT full_name INTO st FROM public.talents WHERE id = pro2;
  IF st IS DISTINCT FROM 'Test Pro Iki B' THEN RAISE EXCEPTION 'pro2 talents.full_name aynalanmadi: %', st; END IF;
  -- admin (ajans) profilde onay verir -> providers'a yansir (koruma tetikleyicisi aynalamayi engellememeli)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  UPDATE public.profiles SET approval_status = 'approved', approved_at = now() WHERE id = pro2;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT approval_status::text INTO st FROM public.providers WHERE id = pro2;
  IF st <> 'approved' THEN RAISE EXCEPTION 'pro2 admin onayi providers''a yansimadi: %', st; END IF;

  -- 11e) koruma tetikleyicisi: normal kullanici (pro1) yonetici alanlarini degistiremez, is_published degistirir
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  UPDATE public.providers SET approval_status = 'rejected', trust_score = 99, is_verified = true, is_published = true WHERE id = pro1;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT * INTO pr FROM public.providers WHERE id = pro1;
  IF pr.approval_status <> 'approved' OR pr.trust_score IS NOT NULL OR pr.is_verified THEN
    RAISE EXCEPTION 'koruma DELINDI: approval=% trust=% verified=%', pr.approval_status, pr.trust_score, pr.is_verified; END IF;
  IF NOT pr.is_published THEN RAISE EXCEPTION 'is_published (kullanici alani) guncellenmedi'; END IF;
  -- admin (ajans) trust_score yazar
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  UPDATE public.providers SET trust_score = 42 WHERE id = pro1;
  SELECT trust_score INTO pr FROM public.providers WHERE id = pro1;
  IF pr.trust_score IS DISTINCT FROM 42 THEN RAISE EXCEPTION 'admin trust_score yazamadi: %', pr.trust_score; END IF;
  UPDATE public.providers SET trust_score = NULL WHERE id = pro1;
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- 11f) yetki: anon providers okur ama approval_note okuyamaz; talents anon'a kapali;
  --      authenticated yalniz kendi talents satirini gorur, iletisim sutunu kapali; istemci providers'i yazamaz
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.providers;
  EXECUTE 'RESET ROLE';
  IF n < 3 THEN RAISE EXCEPTION 'anon providers sayisi % (>= 3 beklenir: pro1, pro2, ajans)', n; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'SELECT approval_note FROM public.providers LIMIT 1' INTO st;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon providers.approval_note OKUDU';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'SELECT count(*) FROM public.talents' INTO n;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon talents OKUDU';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.talents;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'pro1 % talents satiri goruyor (beklenen 1: kendisi)', n; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT canonical_email FROM public.talents' INTO st;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'authenticated talents.canonical_email OKUDU';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'UPDATE public.providers SET is_published = false WHERE id = $1' USING pro1;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'authenticated providers UPDATE yapabildi (yazma yolu FAZ 2c''ye kadar kapali olmali)';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT is_published INTO pr FROM public.providers WHERE id = pro1;
  IF NOT pr.is_published THEN RAISE EXCEPTION 'istemci yazmasi providers''i degistirdi'; END IF;
  -- 11e'deki dogrudan yazma test yapayligiydi (gercekte istemci providers'a yazamaz); profille esitle
  -- ki asama7 K7 test sonrasi da ESIT kalsin
  UPDATE public.providers pr2 SET is_published = p.is_published FROM public.profiles p WHERE p.id = pr2.id AND pr2.id = pro1;

  -- 11g) tam-bir kisiti: professional + organization_id -> 23514
  BEGIN
    INSERT INTO public.providers (id, provider_type, talent_id, organization_id, slug)
    VALUES (gen_random_uuid(), 'professional', pro1, org_a, 'p-kisit-testi');
    RAISE EXCEPTION 'tam-bir kisiti CALISMADI';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- 11h) sync_log bos
  SELECT count(*) INTO n FROM public.organization_sync_log WHERE source ILIKE '%faz2%' OR source ILIKE '%provider%';
  IF n <> 0 THEN
    SELECT string_agg(source || ': ' || detail, ' | ') INTO st FROM public.organization_sync_log WHERE source ILIKE '%faz2%' OR source ILIKE '%provider%';
    RAISE EXCEPTION 'sync_log FAZ 2 kaydi var (%): %', n, st; END IF;

  INSERT INTO t_sonuc VALUES (11, 'T11 FAZ 2a saglayici defteri', 'GECTI',
    'pro1: talents+providers+professional_profiles ayni id, onay aynalanmis, slug p-; ajans: organization tipi FAZ 0 kurulusuna bagli; client/business yok; profil guncellemesi (is_published, bio, ad, admin onayi) aynalandi; koruma: pro1 approval/trust/verified geri alindi, is_published degisti, admin trust yazdi; anon approval_note ve talents 42501, pro1 yalniz kendi talents, canonical_email 42501, providers UPDATE 42501; tam-bir kisiti 23514; sync_log bos');
EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_sonuc VALUES (11, 'T11 FAZ 2a saglayici defteri', 'HATA', SQLERRM);
END $$;


-- -----------------------------------------------------------------------------
-- T12) FAZ 3a taksonomi. ON KOSUL: 20260918130000_faz3a_01_service_roles.sql dalda.
-- Uretim/dal kategorileriyle calisir (test kategorisi 'faz1test-%' slug'iyla eklenir, T0 siler).
-- T5 sonrasi ajans (0004) admin.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  ajans uuid := 'a0000000-0000-4000-8000-000000000004';
  pro1  uuid := 'a0000000-0000-4000-8000-000000000002';
  n int; n2 int; cat_id int; ust_id int; r record; st text;
BEGIN
  IF to_regclass('public.service_roles') IS NULL THEN
    INSERT INTO t_sonuc VALUES (12, 'T12 FAZ 3a taksonomi', 'ATLANDI', 'service_roles yok; faz3a_01 dalda uygulanmamis');
    RETURN;
  END IF;

  -- 12a) legacy_role kategorileri = roller; slug birebir; legacy_category_id dolu
  SELECT count(*) INTO n FROM public.service_categories WHERE layer = 'legacy_role';
  SELECT count(*) INTO n2 FROM public.service_roles sr JOIN public.service_categories sc
     ON sc.id = sr.legacy_category_id AND sc.slug = sr.slug AND sc.name_tr = sr.name_tr;
  IF n <> n2 THEN RAISE EXCEPTION 'kategori % / eslesen rol % (slug+ad birebir olmali)', n, n2; END IF;
  SELECT count(*) INTO n2 FROM public.service_roles WHERE legacy_category_id IS NULL;
  IF n2 <> 0 THEN RAISE EXCEPTION '% rolde legacy_category_id bos', n2; END IF;

  -- 12b) admin yeni kategori ekler -> rol otomatik dogar (aynalama); arketip eslesmez -> NULL
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active)
  VALUES ('faz1test-rol', 'Faz1 Test Rolu', 'X', 999, true) RETURNING id INTO cat_id;
  EXECUTE 'RESET ROLE';
  SELECT * INTO r FROM public.service_roles WHERE legacy_category_id = cat_id;
  IF r.id IS NULL OR r.slug <> 'faz1test-rol' OR r.name_tr <> 'Faz1 Test Rolu' OR r.sort_order <> 999 THEN
    RAISE EXCEPTION 'yeni kategori rol olarak dogmadi: %', r; END IF;
  IF r.archetype IS NOT NULL THEN RAISE EXCEPTION 'bilinmeyen slug icin arketip NULL olmali, gelen %', r.archetype; END IF;

  -- 12c) kategori guncellemesi aynalanir (ad, aktiflik); admin rolde arketip verirse aynalama onu ezmez
  UPDATE public.service_roles SET archetype = 'uzmanlik' WHERE id = r.id;
  UPDATE public.service_categories SET name_tr = 'Faz1 Test Rolu B', is_active = false WHERE id = cat_id;
  SELECT * INTO r FROM public.service_roles WHERE legacy_category_id = cat_id;
  IF r.name_tr <> 'Faz1 Test Rolu B' OR r.is_active THEN RAISE EXCEPTION 'guncelleme aynalanmadi: % %', r.name_tr, r.is_active; END IF;
  IF r.archetype <> 'uzmanlik' THEN RAISE EXCEPTION 'elle verilen arketip aynalamada ezildi: %', r.archetype; END IF;

  -- 12d) ust katman satiri (layer = category) rol OLMAZ
  INSERT INTO public.service_categories (slug, name_tr, sort_order, is_active, layer)
  VALUES ('faz1test-ust', 'Faz1 Test Ust Katman', 998, false, 'category') RETURNING id INTO ust_id;
  SELECT count(*) INTO n FROM public.service_roles WHERE legacy_category_id = ust_id OR slug = 'faz1test-ust';
  IF n <> 0 THEN RAISE EXCEPTION 'ust katman satiri rol olarak dogdu'; END IF;
  -- parent_id kendine isaret edemez
  BEGIN
    UPDATE public.service_categories SET parent_id = ust_id WHERE id = ust_id;
    RAISE EXCEPTION 'parent_id = id kabul edildi';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- legacy rol ust katmana baglanabilir
  UPDATE public.service_categories SET parent_id = ust_id WHERE id = cat_id;

  -- 12e) yetki: anon service_roles okur, yazamaz; normal kullanici (pro1) yazamaz (RLS admin); admin yazar
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.service_roles;
  EXECUTE 'RESET ROLE';
  IF n < 1 THEN RAISE EXCEPTION 'anon service_roles okuyamadi'; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'UPDATE public.service_roles SET name_tr = ''x'' WHERE id = $1' USING r.id;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon service_roles UPDATE yapabildi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.service_roles SET name_tr = 'pro1 yazdi' WHERE id = r.id;     -- RLS: 0 satir etkilenir
  EXECUTE 'RESET ROLE';
  SELECT name_tr INTO st FROM public.service_roles WHERE id = r.id;
  IF st = 'pro1 yazdi' THEN RAISE EXCEPTION 'normal kullanici service_roles guncelledi (RLS delik)'; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.service_roles SET sort_order = 997 WHERE id = r.id;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT sort_order INTO n FROM public.service_roles WHERE id = r.id;
  IF n <> 997 THEN RAISE EXCEPTION 'admin service_roles guncelleyemedi'; END IF;

  -- 12f) slug kisiti (03 bolum 6 yasak karakterleri slug uzerinde zorlanir; name_tr gosterim metni,
  --      uretimde virgullu ad var: "Sac, Makyaj ve Styling")
  BEGIN
    INSERT INTO public.service_roles (slug, name_tr) VALUES ('Buyuk Harf', 'x');
    RAISE EXCEPTION 'gecersiz slug kabul edildi';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- 12g) sync_log bos
  SELECT count(*) INTO n FROM public.organization_sync_log WHERE source ILIKE '%faz3%' OR source ILIKE '%service_role%';
  IF n <> 0 THEN RAISE EXCEPTION 'sync_log FAZ 3 kaydi var (%)', n; END IF;

  -- test kategorileri/rolleri temizlenir ki asama8 test sonrasi da ESIT kalsin (T0 da siler)
  DELETE FROM public.service_roles WHERE slug LIKE 'faz1test-%';
  DELETE FROM public.service_categories WHERE slug LIKE 'faz1test-%';

  INSERT INTO t_sonuc VALUES (12, 'T12 FAZ 3a taksonomi', 'GECTI',
    'legacy kategoriler = roller (slug+ad birebir, legacy_category_id dolu); admin kategori -> rol dogdu (arketip NULL); ad/aktiflik aynalandi, elle arketip korundu; ust katman satiri rol olmadi, parent_id=id 23514, legacy rol ust katmana baglandi; anon okur/UPDATE 42501, pro1 RLS 0 satir, admin yazdi; gecersiz slug 23514; sync_log bos');
EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_sonuc VALUES (12, 'T12 FAZ 3a taksonomi', 'HATA', SQLERRM);
END $$;


-- -----------------------------------------------------------------------------
-- T13) FAZ 2b saglayici hizmetleri. ON KOSUL: 20260920180000/180100/180200 dalda.
-- T1 verisine dayanir: musteri (0001), pro1 (0002, T5 approved), pro2 (0003), ajans (0004, T5 admin).
-- T2 sohbeti (musteri <-> pro1) yorum icin kullanilir. Test kategorileri 'faz1test-hizmet-%' (T0 siler).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  pro2    uuid := 'a0000000-0000-4000-8000-000000000003';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  cat_a int; cat_b int; rol_a int; rol_b int;
  svc_a uuid; svc_b1 uuid; svc_b2 uuid; conv uuid; v_prov uuid;
  ps record; pp record; n int; st text;
BEGIN
  IF to_regclass('public.provider_services') IS NULL THEN
    INSERT INTO t_sonuc VALUES (13, 'T13 FAZ 2b saglayici hizmetleri', 'ATLANDI', 'provider_services yok; faz2b dalda uygulanmamis');
    RETURN;
  END IF;

  -- 13a) admin iki test kategorisi acar -> roller dogar (3a aynalamasi)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active)
  VALUES ('faz1test-hizmet-a', 'Faz1 Test Hizmet A', 'A', 991, true) RETURNING id INTO cat_a;
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active)
  VALUES ('faz1test-hizmet-b', 'Faz1 Test Hizmet B', 'B', 992, true) RETURNING id INTO cat_b;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT id INTO rol_a FROM public.service_roles WHERE legacy_category_id = cat_a;
  SELECT id INTO rol_b FROM public.service_roles WHERE legacy_category_id = cat_b;
  IF rol_a IS NULL OR rol_b IS NULL THEN RAISE EXCEPTION 'test kategorileri rol olarak dogmadi (3a)'; END IF;

  -- 13b) birincil kategori -> fiyatsiz birincil satir (origin legacy_sync)
  UPDATE public.profiles SET is_published = true, primary_category_id = cat_a WHERE id = pro1;
  SELECT * INTO ps FROM public.provider_services WHERE provider_id = pro1 AND role_id = rol_a;
  IF ps.id IS NULL OR NOT ps.is_primary OR ps.pricing_mode IS NOT NULL OR ps.origin <> 'legacy_sync' THEN
    RAISE EXCEPTION 'birincil satir: id=% primary=% mode=% origin=%', ps.id, ps.is_primary, ps.pricing_mode, ps.origin; END IF;
  SELECT count(*) INTO n FROM public.provider_services WHERE provider_id = pro1;
  IF n <> 1 THEN RAISE EXCEPTION 'pro1 icin % satir (beklenen 1)', n; END IF;

  -- 13c) pro1 (authenticated, RLS) hizmet ekler; istemcinin verdigi provider_id (pro2) EZILIR; fiyat birincile yansir
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.services (profile_id, provider_id, category_id, title, price_min, price_max, price_unit)
  VALUES (pro1, pro2, cat_a, 'T13 A saatlik', 1000, 2000, 'hourly') RETURNING id INTO svc_a;
  EXECUTE 'RESET ROLE';
  SELECT provider_id INTO v_prov FROM public.services WHERE id = svc_a;
  IF v_prov IS DISTINCT FROM pro1 THEN RAISE EXCEPTION 'services.provider_id=% (istemci degeri ezilmeli, beklenen pro1)', v_prov; END IF;
  SELECT * INTO ps FROM public.provider_services WHERE provider_id = pro1 AND role_id = rol_a;
  IF NOT ps.is_primary OR ps.pricing_mode IS DISTINCT FROM 'range'::public.pricing_mode OR ps.price_min IS DISTINCT FROM 1000 OR ps.price_max IS DISTINCT FROM 2000
     OR ps.price_unit IS DISTINCT FROM 'per_hour'::public.provider_price_unit OR ps.legacy_service_id IS DISTINCT FROM svc_a THEN
    RAISE EXCEPTION 'rol_a fiyat: mode=% min=% max=% unit=% svc=%', ps.pricing_mode, ps.price_min, ps.price_max, ps.price_unit, ps.legacy_service_id; END IF;
  SELECT * INTO pp FROM public.professional_profiles WHERE provider_id = pro1;
  IF pp.pricing_mode IS DISTINCT FROM 'range'::public.pricing_mode OR pp.price_min IS DISTINCT FROM 1000 OR pp.price_unit IS DISTINCT FROM 'per_hour'::public.provider_price_unit THEN
    RAISE EXCEPTION 'professional_profiles ozeti: mode=% min=% unit=%', pp.pricing_mode, pp.price_min, pp.price_unit; END IF;

  -- 13d) kategori b: on_request -> daha dusuk sort_order ile fixed 500 full_day temsilci olur -> starting (max NULL) -> pasife alinca on_request'e doner
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.services (profile_id, category_id, title, price_on_request, price_unit, sort_order)
  VALUES (pro1, cat_b, 'T13 B1 istek', true, 'total', 5) RETURNING id INTO svc_b1;
  EXECUTE 'RESET ROLE';
  SELECT * INTO ps FROM public.provider_services WHERE provider_id = pro1 AND role_id = rol_b;
  IF ps.id IS NULL OR ps.is_primary OR ps.pricing_mode IS DISTINCT FROM 'on_request'::public.pricing_mode OR ps.price_min IS NOT NULL OR ps.price_unit IS NOT NULL THEN
    RAISE EXCEPTION 'rol_b on_request: id=% primary=% mode=% min=% unit=%', ps.id, ps.is_primary, ps.pricing_mode, ps.price_min, ps.price_unit; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.services (profile_id, category_id, title, price_min, price_max, price_unit, sort_order)
  VALUES (pro1, cat_b, 'T13 B2 gunluk', 500, 500, 'full_day', 1) RETURNING id INTO svc_b2;
  EXECUTE 'RESET ROLE';
  SELECT * INTO ps FROM public.provider_services WHERE provider_id = pro1 AND role_id = rol_b;
  IF ps.pricing_mode IS DISTINCT FROM 'fixed'::public.pricing_mode OR ps.price_min IS DISTINCT FROM 500 OR ps.price_max IS DISTINCT FROM 500
     OR ps.price_unit IS DISTINCT FROM 'per_day'::public.provider_price_unit OR ps.legacy_service_id IS DISTINCT FROM svc_b2 THEN
    RAISE EXCEPTION 'rol_b temsilci degisimi: mode=% min=% max=% unit=% svc=%', ps.pricing_mode, ps.price_min, ps.price_max, ps.price_unit, ps.legacy_service_id; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.services SET price_starting = true WHERE id = svc_b2;
  EXECUTE 'RESET ROLE';
  SELECT * INTO ps FROM public.provider_services WHERE provider_id = pro1 AND role_id = rol_b;
  IF ps.pricing_mode IS DISTINCT FROM 'range'::public.pricing_mode OR ps.price_min IS DISTINCT FROM 500 OR ps.price_max IS NOT NULL THEN
    RAISE EXCEPTION 'rol_b starting: mode=% min=% max=% (beklenen range/500/NULL)', ps.pricing_mode, ps.price_min, ps.price_max; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.services SET is_active = false WHERE id = svc_b2;
  EXECUTE 'RESET ROLE';
  SELECT * INTO ps FROM public.provider_services WHERE provider_id = pro1 AND role_id = rol_b;
  IF ps.pricing_mode IS DISTINCT FROM 'on_request'::public.pricing_mode OR ps.legacy_service_id IS DISTINCT FROM svc_b1 THEN
    RAISE EXCEPTION 'rol_b pasife alma: mode=% svc=% (beklenen on_request / B1)', ps.pricing_mode, ps.legacy_service_id; END IF;

  -- 13e) hizmet a silinir (RLS) -> rol_a birincil kalir ama fiyatsiz; ozet rol_b (on_request) olur
  EXECUTE 'SET LOCAL ROLE authenticated';
  DELETE FROM public.services WHERE id = svc_a;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT * INTO ps FROM public.provider_services WHERE provider_id = pro1 AND role_id = rol_a;
  IF ps.id IS NULL OR NOT ps.is_primary OR ps.pricing_mode IS NOT NULL OR ps.legacy_service_id IS NOT NULL THEN
    RAISE EXCEPTION 'hizmet silme sonrasi rol_a: id=% primary=% mode=%', ps.id, ps.is_primary, ps.pricing_mode; END IF;
  SELECT * INTO pp FROM public.professional_profiles WHERE provider_id = pro1;
  IF pp.pricing_mode IS DISTINCT FROM 'on_request'::public.pricing_mode OR pp.price_min IS NOT NULL THEN
    RAISE EXCEPTION 'ozet on_request''e dusmedi: mode=% min=%', pp.pricing_mode, pp.price_min; END IF;

  -- 13f) birincil b'ye gecer -> rol_a satiri silinir (hizmeti yok), rol_b birincil; birincil NULL -> birincil yok, rol_b kalir
  UPDATE public.profiles SET primary_category_id = cat_b WHERE id = pro1;
  SELECT count(*) INTO n FROM public.provider_services WHERE provider_id = pro1 AND role_id = rol_a;
  IF n <> 0 THEN RAISE EXCEPTION 'hizmetsiz eski birincil (rol_a) silinmedi'; END IF;
  SELECT is_primary INTO ps FROM public.provider_services WHERE provider_id = pro1 AND role_id = rol_b;
  IF NOT ps.is_primary THEN RAISE EXCEPTION 'rol_b birincil olmadi'; END IF;
  UPDATE public.profiles SET primary_category_id = NULL WHERE id = pro1;
  SELECT count(*) INTO n FROM public.provider_services WHERE provider_id = pro1 AND is_primary;
  IF n <> 0 THEN RAISE EXCEPTION 'birincil NULL iken birincil satir kaldi'; END IF;
  SELECT count(*) INTO n FROM public.provider_services WHERE provider_id = pro1;
  IF n <> 1 THEN RAISE EXCEPTION 'pro1 % satir (beklenen 1: rol_b)', n; END IF;

  -- 13g) provider_id otomatik: portfoy + deneyim (pro1), yorum (musteri, T2 sohbeti) + favori (musteri -> pro1); client sahibi portfoy -> NULL
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.portfolio_items (profile_id, media_url, media_type, caption) VALUES (pro1, 'https://example.com/t13.jpg', 'image', 'T13')
  RETURNING provider_id INTO v_prov;
  IF v_prov IS DISTINCT FROM pro1 THEN RAISE EXCEPTION 'portfolio_items.provider_id=%', v_prov; END IF;
  INSERT INTO public.profile_experiences (profile_id, kind, title) VALUES (pro1, 'work', 'T13') RETURNING provider_id INTO v_prov;
  IF v_prov IS DISTINCT FROM pro1 THEN RAISE EXCEPTION 'profile_experiences.provider_id=%', v_prov; END IF;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  SELECT id INTO conv FROM public.conversations WHERE customer_id = musteri AND professional_id = pro1 ORDER BY created_at LIMIT 1;
  IF conv IS NULL THEN RAISE EXCEPTION 'T2 sohbeti bulunamadi (yorum testi icin gerekli)'; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.reviews (conversation_id, customer_id, professional_id, rating, body) VALUES (conv, musteri, pro1, 5, 'T13 yorum')
  RETURNING provider_id INTO v_prov;
  IF v_prov IS DISTINCT FROM pro1 THEN RAISE EXCEPTION 'reviews.provider_id=%', v_prov; END IF;
  INSERT INTO public.favorites (user_id, professional_id) VALUES (musteri, pro1) RETURNING provider_id INTO v_prov;
  IF v_prov IS DISTINCT FROM pro1 THEN RAISE EXCEPTION 'favorites.provider_id=%', v_prov; END IF;
  INSERT INTO public.portfolio_items (profile_id, media_url, media_type, caption) VALUES (musteri, 'https://example.com/t13c.jpg', 'image', 'T13 client')
  RETURNING provider_id INTO v_prov;
  IF v_prov IS NOT NULL THEN RAISE EXCEPTION 'client portfoyunde provider_id=% (NULL beklenir)', v_prov; END IF;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- 13h) yetki: anon yayindaki pro1'in satirini ve v_provider_roles'u gorur; yayindan cikinca anon 0, pro1 kendini gorur;
  --      istemci provider_services'e yazamaz (INSERT/UPDATE 42501)
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.provider_services WHERE provider_id = pro1;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'anon yayindaki pro1 icin % satir goruyor (beklenen 1)', n; END IF;
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.v_provider_roles WHERE provider_id = pro1 AND role_slug = 'faz1test-hizmet-b' AND pricing_mode = 'on_request';
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'anon v_provider_roles: % satir (beklenen 1)', n; END IF;
  UPDATE public.profiles SET is_published = false WHERE id = pro1;
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.provider_services WHERE provider_id = pro1;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'anon yayinda olmayan pro1 icin % satir goruyor (RLS delik)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.provider_services WHERE provider_id = pro1;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'pro1 kendi satirini goremedi (%)', n; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'INSERT INTO public.provider_services (provider_id, role_id) VALUES ($1, $2)' USING pro1, rol_a;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'authenticated provider_services INSERT yapabildi (yazma yolu 2c''ye kadar kapali)';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'UPDATE public.provider_services SET is_primary = true WHERE provider_id = $1' USING pro1;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'authenticated provider_services UPDATE yapabildi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  UPDATE public.profiles SET is_published = true WHERE id = pro1;

  -- 13i) sync_log FAZ 2b bos
  SELECT count(*) INTO n FROM public.organization_sync_log WHERE source ILIKE '%faz2b%';
  IF n <> 0 THEN
    SELECT string_agg(source || ': ' || detail, ' | ') INTO st FROM public.organization_sync_log WHERE source ILIKE '%faz2b%';
    RAISE EXCEPTION 'sync_log FAZ 2b kaydi var (%): %', n, st; END IF;

  -- temizlik: hizmetler silinir -> turetilen satirlar kendiliginden gider; sonra test rolleri/kategorileri
  DELETE FROM public.services WHERE profile_id = pro1 AND title LIKE 'T13%';
  DELETE FROM public.portfolio_items WHERE caption LIKE 'T13%' AND profile_id IN (pro1, musteri);
  DELETE FROM public.profile_experiences WHERE profile_id = pro1 AND title = 'T13';
  DELETE FROM public.reviews WHERE professional_id = pro1 AND body = 'T13 yorum';
  DELETE FROM public.favorites WHERE user_id = musteri AND professional_id = pro1;
  SELECT count(*) INTO n FROM public.provider_services WHERE provider_id = pro1;
  IF n <> 0 THEN RAISE EXCEPTION 'temizlik: pro1 icin % provider_services satiri kaldi', n; END IF;
  SELECT pricing_mode::text INTO st FROM public.professional_profiles WHERE provider_id = pro1;
  IF st IS NOT NULL THEN RAISE EXCEPTION 'temizlik: ozet sifirlanmadi (%)', st; END IF;
  DELETE FROM public.service_roles WHERE slug LIKE 'faz1test-hizmet-%';
  DELETE FROM public.service_categories WHERE slug LIKE 'faz1test-hizmet-%';

  INSERT INTO t_sonuc VALUES (13, 'T13 FAZ 2b saglayici hizmetleri', 'GECTI',
    'birincil kategori -> fiyatsiz birincil satir; hizmet ekle (istemci provider_id ezildi) -> range 1000-2000 per_hour + ozet; kategori b: on_request -> temsilci fixed 500 per_day -> starting max NULL -> pasif on_request; hizmet sil -> birincil fiyatsiz, ozet on_request; birincil degisimi rol_a silindi/rol_b birincil, NULL -> birincil yok; portfoy/deneyim/yorum/favori provider_id otomatik, client NULL; anon yayinda 1 / yayinda degil 0, kendi 1, v_provider_roles; INSERT/UPDATE 42501; sync_log bos; temizlik');
EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_sonuc VALUES (13, 'T13 FAZ 2b saglayici hizmetleri', 'HATA', SQLERRM);
END $$;

SELECT sira, test, sonuc, detay FROM t_sonuc ORDER BY sira;
