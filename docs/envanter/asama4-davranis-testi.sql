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
--   T14 FAZ 2c v_providers_public: ortak sutunlar profiles ile birebir, saglayici sutunlari providers'tan,
--       is_visible, aynalama gorunumden okunur, primary_role_id, anon/authenticated okur, kapali sutun yok
--       (ON KOSUL: faz2c_01 dalda uygulanmis; PostgREST embed'leri onizlemede)
--   T15 FAZ 4a etkinlik/EventSpec: brief -> surumler (otomatik version_no, tek is_current, ekle-yalniz, RPC ile
--       gecerli surum), event (event_types FK, tarih/butce kisitlari) -> gereksinimler (rol FK, tekil, adet),
--       sahiplik RLS (baskasi gormez, kurulus yetkisi, admin), anon 42501, conversations.event_id SET NULL
--       (ON KOSUL: faz4a_01 dalda uygulanmis)
--   T16 FAZ 4c onay: create_event_from_spec — valid olmayan / gecerli olmayan surum reddi, gecersiz slug atomik red,
--       basarili onay (events confirmed + gereksinimler sirali/adetli), ayni surumden ikinci onay 23505, baskasi
--       42501, anon yetkisiz; quote_requests.event_id SET NULL (ON KOSUL: faz4c_01 dalda uygulanmis)
--   T17 FAZ 5 yetenek havuzu: modul kapisi (ajans acik/kurum kapali), kimlik aynasi, harici kayit + roller (RLS: owner/
--       crew_coordinator yazar, viewer 0, kurum 42501, anon 42501), find_talent_by_contact, gizli oranlar (tarihce, finance
--       okur, digerleri 42501, denetim), davet/claim/decline (token kapali, e-posta dogrulama, sure), dolum fonksiyonu
--       idempotan (ON KOSUL: faz5_01-02 dalda uygulanmis)
--   T18 FAZ 5/03 Ekibim -> havuz RPC'leri: ensure_talent_record_for_membership (profesyonel kendisi / talent.manage; viewer 42501,
--       idempotan), sync_org_talent_pool (1 -> 0, viewer 42501, denetim), kayma 0 (ON KOSUL: faz5_03 dalda uygulanmis)
--   T19 FAZ 6 Match V0.2: run_event_match hybrid (butce: affordable) (rol basina profesyonel: kodlar/puan/conf; ajans: agirlikli kapsam, eligible,
--       coverage_full), full_service suzgeci, ekle-yalniz, was_shown/was_clicked (sahip; baskasi 42501), baskasi/anon/gereksinimsiz
--       red, RLS (sahip gorur, baskasi gormez, anon 42501, authenticated yazamaz) (ON KOSUL: faz6_01 dalda uygulanmis)
--   T20 FAZ 6 ekip + ic goruntu: bireysel ekip (kaynaksiz uye 22023, guard, ic goruntu yok), kurulus ekibi (havuz uyesi private +
--       provider turetimi, yabanci kayit 22023), snapshot/list/override (finance okur, crew_coordinator 42501, denetim), viewer okur
--       yazamaz, confirm kapsam kontrolu (ON KOSUL: faz6_01 dalda uygulanmis)
--   T21 FAZ 7a teklif: ekipten teklif (kalem + ic kalem), toplamlar (gizli kalem haric, tax_rate), sales fiyat girer / ic liste 42501 /
--       status-INSERT 42501, finance marj + maliyet, send (token, dondurma 22023), yeni surum kopyasi, crew_coordinator 0 satir,
--       token_hash kapali, anon 42501, taslak silme (7a-DB/02) (ON KOSUL: faz7a_01-02 dalda uygulanmis)
--   T22 FAZ 7a portal: anon view (alanlar, kimlik yok, sayac, viewed), yanlis jeton, onay (ad kontrolu, approved, ikinci onay red),
--       revizyon -> yeni surum -> eski jeton iptal, max_views, suresi dolmus -> expired, declined -> linkler iptal
--       (ON KOSUL: faz7a_01 dalda uygulanmis)
--   T23 FAZ 7c rezervasyon: booking_from_proposal (yetkisiz 42501; onayli teklif -> tek satir/surum, idempotan, teklif sekli, etkinlik
--       alanlari, KDV dahil toplam, denetim; declined 22023), kurulus RLS (owner/finance gorur, digerleri 0), INSERT/total_amount 42501,
--       durum sutunu guncellemesi, portal has_booking, misafir rezervasyonu, eski sekil + sekil kisiti (ON KOSUL: faz7c_01 dalda uygulanmis)
--   T24 FAZ 7b RFP: rfp_create (gereksinimlerden kalem + ipucu), taslak duzenleme, ipucu sutunu kapali, davet/send/bildirimler, satici
--       gorunurlugu, proposal_create_from_rfp + baglantisiz send, alici kurulus teklif okuma (gizli kalem/taslak surum yok), revizyon,
--       rfp_detail, award (approved/awarded/not_selected), kapali RFP, rezervasyon alici kurulusla, ret/evaluating/cancel, anon
--       (ON KOSUL: faz7b_01 dalda uygulanmis)
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
                      'a0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000006',
                      'a0000000-0000-4000-8000-000000000007']::uuid[];
BEGIN
  -- T15 etkinlik verisi (profil silinince cascade ile de gider; acik temizlik). FAZ 6 match_runs/crews etkinlikle cascade.
  IF to_regclass('public.events') IS NOT NULL THEN
    DELETE FROM public.events WHERE owner_user_id = ANY(ids);
    DELETE FROM public.event_briefs WHERE created_by_user_id = ANY(ids);
  END IF;
  -- T13 hizmetleri ve turetilen satirlar: kategori/rol silinmeden ONCE (FK: services.category_id,
  -- provider_services.role_id RESTRICT). services her zaman var; provider_services 2b'den sonra.
  DELETE FROM public.services WHERE profile_id = ANY(ids);
  IF to_regclass('public.provider_services') IS NOT NULL THEN
    DELETE FROM public.provider_services WHERE provider_id = ANY(ids);
  END IF;
  UPDATE public.profiles SET primary_category_id = NULL
   WHERE id = ANY(ids) AND primary_category_id IN (SELECT id FROM public.service_categories WHERE slug LIKE 'faz1test-%');
  -- T29 tedarikciler / kisa liste (etkinlik atamasi -> tedarikci; kalemler listeyle cascade)
  IF to_regclass('public.event_suppliers') IS NOT NULL THEN
    DELETE FROM public.event_suppliers     WHERE organization_id IN (SELECT id FROM public.organizations WHERE legacy_profile_id = ANY(ids));
    DELETE FROM public.suppliers           WHERE organization_id IN (SELECT id FROM public.organizations WHERE legacy_profile_id = ANY(ids));
    DELETE FROM public.supplier_shortlists WHERE organization_id IN (SELECT id FROM public.organizations WHERE legacy_profile_id = ANY(ids));
  END IF;
  -- T28 CRM (firsat -> kisi; teklif bagi SET NULL)
  IF to_regclass('public.crm_leads') IS NOT NULL THEN
    DELETE FROM public.crm_leads WHERE organization_id IN (SELECT id FROM public.organizations WHERE legacy_profile_id = ANY(ids));
    DELETE FROM public.contacts  WHERE organization_id IN (SELECT id FROM public.organizations WHERE legacy_profile_id = ANY(ids));
  END IF;
  -- T26 gorevler/aktivite (done gorev dogrudan silinmez: once iptal)
  IF to_regclass('public.tasks') IS NOT NULL THEN
    UPDATE public.tasks SET status = 'cancelled'
     WHERE organization_id IN (SELECT id FROM public.organizations WHERE legacy_profile_id = ANY(ids)) AND status NOT IN ('todo', 'cancelled');
    DELETE FROM public.tasks WHERE organization_id IN (SELECT id FROM public.organizations WHERE legacy_profile_id = ANY(ids));
    DELETE FROM public.activity_logs WHERE organization_id IN (SELECT id FROM public.organizations WHERE legacy_profile_id = ANY(ids));
  END IF;
  -- T21 teklifler (kalemler service_roles'a RESTRICT: test rolleri silinmeden ONCE; surum/kalem/ic kalem/baglanti cascade)
  IF to_regclass('public.proposals') IS NOT NULL THEN
    -- T23 teklif rezervasyonlari (bookings.proposal_version_id RESTRICT): tekliflerden ONCE
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'proposal_version_id') THEN
      DELETE FROM public.bookings
       WHERE proposal_version_id IN (SELECT v.id FROM public.proposal_versions v JOIN public.proposals p ON p.id = v.proposal_id
                                      WHERE p.seller_organization_id IN (SELECT id FROM public.organizations WHERE legacy_profile_id = ANY(ids)));
    END IF;
    DELETE FROM public.proposals
     WHERE seller_organization_id IN (SELECT id FROM public.organizations WHERE legacy_profile_id = ANY(ids));
  END IF;
  -- T17 havuz kayitlari (roller service_roles'a RESTRICT ile bagli: test rolleri silinmeden ONCE; oranlar cascade)
  IF to_regclass('public.organization_talent_records') IS NOT NULL THEN
    DELETE FROM public.organization_talent_records
     WHERE organization_id IN (SELECT id FROM public.organizations WHERE legacy_profile_id = ANY(ids));
  END IF;
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


-- -----------------------------------------------------------------------------
-- T14) FAZ 2c v_providers_public sozlesmesi. ON KOSUL: 20260921120000_faz2c_01 dalda.
-- T1/T5/T11/T13 verisine dayanir: pro1 (0002, approved + T13 sonunda yayinda), ajans (0004, pending, admin).
-- PostgREST embed'leri (turkish_cities, service_categories!profiles_primary_category_id_fkey) burada
-- SINANAMAZ; onizlemede Claude Code P1 turu dogrular (14 bolum 5).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  pro1  uuid := 'a0000000-0000-4000-8000-000000000002';
  ajans uuid := 'a0000000-0000-4000-8000-000000000004';
  v record; p record; pr record; n int; st text; cat_id int; rol_id int;
BEGIN
  IF to_regclass('public.v_providers_public') IS NULL THEN
    INSERT INTO t_sonuc VALUES (14, 'T14 FAZ 2c gorunum sozlesmesi', 'ATLANDI', 'v_providers_public yok; faz2c_01 dalda uygulanmamis');
    RETURN;
  END IF;

  -- 14a) pro1: ortak sutunlar profiles ile ayni; saglayici sutunlari providers ile ayni
  SELECT * INTO v  FROM public.v_providers_public WHERE id = pro1;
  SELECT * INTO p  FROM public.profiles  WHERE id = pro1;
  SELECT * INTO pr FROM public.providers WHERE id = pro1;
  IF v.id IS NULL THEN RAISE EXCEPTION 'pro1 gorunumde yok'; END IF;
  IF v.full_name IS DISTINCT FROM p.full_name OR v.bio IS DISTINCT FROM p.bio OR v.city_id IS DISTINCT FROM p.city_id
     OR v.is_published IS DISTINCT FROM p.is_published OR v.approval_status IS DISTINCT FROM p.approval_status
     OR v.primary_category_id IS DISTINCT FROM p.primary_category_id OR v.premium_tier IS DISTINCT FROM p.premium_tier
     OR v.role IS DISTINCT FROM p.role OR v.updated_at IS DISTINCT FROM p.updated_at THEN
    RAISE EXCEPTION 'pro1 ortak sutunlar profiles ile ayni degil: ad %/% bio %/% yayin %/% onay %/%',
      v.full_name, p.full_name, v.bio, p.bio, v.is_published, p.is_published, v.approval_status, p.approval_status; END IF;
  IF v.provider_type <> 'professional' OR v.provider_slug IS DISTINCT FROM pr.slug OR v.display_name IS DISTINCT FROM pr.display_name THEN
    RAISE EXCEPTION 'pro1 saglayici sutunlari: tip % slug %/% ad %/%', v.provider_type, v.provider_slug, pr.slug, v.display_name, pr.display_name; END IF;
  SELECT provider_type::text INTO st FROM public.v_providers_public WHERE id = ajans;
  IF st IS DISTINCT FROM 'organization' THEN RAISE EXCEPTION 'ajans provider_type=%', st; END IF;

  -- 14b) is_visible: pro1 (approved + yayinda) true, ajans (pending) false
  SELECT is_visible INTO v FROM public.v_providers_public WHERE id = pro1;
  IF NOT v.is_visible THEN RAISE EXCEPTION 'pro1 is_visible false (approved + yayinda beklenir)'; END IF;
  SELECT is_visible INTO v FROM public.v_providers_public WHERE id = ajans;
  IF v.is_visible THEN RAISE EXCEPTION 'ajans is_visible true (pending beklenir)'; END IF;

  -- 14c) profil guncellemesi gorunumden okunur (aynalama zinciri: profiles -> professional_profiles.bio)
  UPDATE public.profiles SET bio = 'T14 bio' WHERE id = pro1;
  SELECT bio INTO st FROM public.v_providers_public WHERE id = pro1;
  IF st IS DISTINCT FROM 'T14 bio' THEN RAISE EXCEPTION 'bio gorunume yansimadi: %', st; END IF;

  -- 14d) birincil rol: admin test kategorisi -> rol; pro1 birincil -> primary_role_id dolu; temizlik
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active)
  VALUES ('faz1test-gorunum', 'Faz1 Test Gorunum', 'G', 993, true) RETURNING id INTO cat_id;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT id INTO rol_id FROM public.service_roles WHERE legacy_category_id = cat_id;
  UPDATE public.profiles SET primary_category_id = cat_id WHERE id = pro1;
  SELECT primary_role_id INTO n FROM public.v_providers_public WHERE id = pro1;
  IF n IS DISTINCT FROM rol_id THEN RAISE EXCEPTION 'primary_role_id=% (beklenen %)', n, rol_id; END IF;
  UPDATE public.profiles SET primary_category_id = NULL WHERE id = pro1;
  SELECT count(*) INTO n FROM public.v_providers_public WHERE id = pro1;
  IF n <> 1 THEN RAISE EXCEPTION 'birincil NULL iken pro1 satiri % (LEFT JOIN beklenir: 1)', n; END IF;
  DELETE FROM public.service_roles WHERE slug = 'faz1test-gorunum';
  DELETE FROM public.service_categories WHERE slug = 'faz1test-gorunum';

  -- 14e) yetki: anon ve authenticated okur; kapali sutun gorunumde yok (42703)
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.v_providers_public;
  EXECUTE 'RESET ROLE';
  IF n < 3 THEN RAISE EXCEPTION 'anon gorunumde % satir goruyor (>= 3 beklenir)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.v_providers_public WHERE id = pro1;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF n <> 1 THEN RAISE EXCEPTION 'authenticated kendi satirini goremedi'; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'SELECT email FROM public.v_providers_public LIMIT 1' INTO st;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'gorunumde email sutunu VAR';
  EXCEPTION WHEN undefined_column THEN EXECUTE 'RESET ROLE'; END;

  INSERT INTO t_sonuc VALUES (14, 'T14 FAZ 2c gorunum sozlesmesi', 'GECTI',
    'pro1 19 ortak sutun profiles ile ayni, saglayici sutunlari providers ile ayni, ajans organization; is_visible pro1 true / ajans false; bio guncellemesi gorunume yansidi; primary_role_id dolu/bos (LEFT JOIN); anon >= 3 satir, authenticated kendi satiri, email 42703');
EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_sonuc VALUES (14, 'T14 FAZ 2c gorunum sozlesmesi', 'HATA', SQLERRM);
END $$;


-- -----------------------------------------------------------------------------
-- T15) FAZ 4a etkinlik ve EventSpec. ON KOSUL: 20260922150000_faz4a_01 dalda.
-- T1 verisi: musteri (0001, client), pro1 (0002), ajans (0004, T5 admin), kurum (0005, business; T8: kurulus sahibi
-- owner_seed), uye (0006; T9 sonunda uye DEGIL). T2 sohbeti (musteri <-> pro1) event_id bagi icin.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  kurum   uuid := 'a0000000-0000-4000-8000-000000000005';
  uye     uuid := 'a0000000-0000-4000-8000-000000000006';
  v_brief uuid; v1 uuid; v2 uuid; ev uuid; conv uuid; org_k uuid; v_brief_k uuid; rol_a int; rol_b int;
  r record; n int; st text;
BEGIN
  IF to_regclass('public.events') IS NULL THEN
    INSERT INTO t_sonuc VALUES (15, 'T15 FAZ 4a etkinlik/EventSpec', 'ATLANDI', 'events tablosu yok; faz4a_01 dalda uygulanmamis');
    RETURN;
  END IF;

  -- 15a) event_types: 15 satir, anon okur
  SELECT count(*) INTO n FROM public.event_types;
  IF n <> 15 THEN RAISE EXCEPTION 'event_types % satir (15 beklenir)', n; END IF;
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.event_types WHERE is_active;
  EXECUTE 'RESET ROLE';
  IF n <> 15 THEN RAISE EXCEPTION 'anon event_types okuyamadi (%)', n; END IF;

  -- roller: T13 gibi test kategorileri (rol dogar); dalda kategori yok
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active) VALUES ('faz1test-etk-a', 'Faz1 Test Etkinlik Rol A', 'A', 994, true);
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active) VALUES ('faz1test-etk-b', 'Faz1 Test Etkinlik Rol B', 'B', 995, true);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT id INTO rol_a FROM public.service_roles WHERE slug = 'faz1test-etk-a';
  SELECT id INTO rol_b FROM public.service_roles WHERE slug = 'faz1test-etk-b';
  IF rol_a IS NULL OR rol_b IS NULL THEN RAISE EXCEPTION 'test rolleri dogmadi'; END IF;

  -- 15b) musteri (authenticated, RLS) brief yazar; iki surum: version_no otomatik 1,2; ikinci gelince ilki dusuruldu
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.event_briefs (created_by_user_id, source, raw_text)
  VALUES (musteri, 'client_web', 'T15: Haziranda Istanbulda 120 kisilik dugun, DJ ve fotografci lazim') RETURNING id INTO v_brief;
  INSERT INTO public.event_spec_versions (brief_id, spec_jsonb, provenance, schema_version, parser_version, model_id)
  VALUES (v_brief, '{"event_type":"wedding","participant_count":120}'::jsonb, '{"event_type":{"source":"extracted","confidence":0.9}}'::jsonb, '1.0', 'p-test-1', 'test-model')
  RETURNING id INTO v1;
  INSERT INTO public.event_spec_versions (brief_id, spec_jsonb, schema_version, parser_version, validation_status)
  VALUES (v_brief, '{"event_type":"wedding","participant_count":120,"city_id":34}'::jsonb, '1.0', 'p-test-2', 'valid')
  RETURNING id INTO v2;
  EXECUTE 'RESET ROLE';
  SELECT version_no, is_current, created_by_user_id INTO r FROM public.event_spec_versions WHERE id = v1;
  IF r.version_no <> 1 OR r.is_current OR r.created_by_user_id IS DISTINCT FROM musteri THEN
    RAISE EXCEPTION 'v1: no=% current=% by=% (1/false/musteri beklenir)', r.version_no, r.is_current, r.created_by_user_id; END IF;
  SELECT version_no, is_current INTO r FROM public.event_spec_versions WHERE id = v2;
  IF r.version_no <> 2 OR NOT r.is_current THEN RAISE EXCEPTION 'v2: no=% current=% (2/true beklenir)', r.version_no, r.is_current; END IF;

  -- 15c) ekle-yalniz: musteri UPDATE/DELETE yapamaz (42501); RPC ile gecerli surum v1'e doner
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'UPDATE public.event_spec_versions SET validation_status = ''valid'' WHERE id = $1' USING v1;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'event_spec_versions UPDATE yapabildi (ekle-yalniz olmali)';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'DELETE FROM public.event_spec_versions WHERE id = $1' USING v1;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'event_spec_versions DELETE yapabildi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.set_current_event_spec(v1);
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.event_spec_versions WHERE brief_id = v_brief AND is_current;
  IF n <> 1 THEN RAISE EXCEPTION 'is_current sayisi % (1 beklenir)', n; END IF;
  SELECT is_current INTO r FROM public.event_spec_versions WHERE id = v1;
  IF NOT r.is_current THEN RAISE EXCEPTION 'RPC v1''i gecerli yapmadi'; END IF;
  -- baskasi (pro1) RPC ile degistiremez
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_current_event_spec(v2);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'pro1 baskasinin surumunu gecerli yapabildi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 15d) event + gereksinimler (musteri); kisitlar: event_type FK, tarih sirasi, tekil rol, adet
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.events (brief_id, spec_version_id, owner_user_id, title, event_type, start_date, end_date, city_id, participant_count, budget_min, budget_max)
  VALUES (v_brief, v1, musteri, 'T15 dugun', 'wedding', current_date + 60, current_date + 60,
          (SELECT id FROM public.turkish_cities ORDER BY id LIMIT 1), 120, 50000, 80000) RETURNING id INTO ev;
  INSERT INTO public.event_requirements (event_id, role_id, quantity, is_required) VALUES (ev, rol_a, 1, true);
  INSERT INTO public.event_requirements (event_id, role_id, quantity, is_required, duration_hours) VALUES (ev, rol_b, 2, false, 4);
  EXECUTE 'RESET ROLE';
  BEGIN
    INSERT INTO public.events (owner_user_id, event_type) VALUES (musteri, 'olmayan-tur');
    RAISE EXCEPTION 'gecersiz event_type kabul edildi';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.events (owner_user_id, event_type, start_date, end_date) VALUES (musteri, 'wedding', current_date + 5, current_date + 1);
    RAISE EXCEPTION 'ters tarih kabul edildi';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.event_requirements (event_id, role_id) VALUES (ev, rol_a);
    RAISE EXCEPTION 'ayni rol ikinci kez kabul edildi';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.event_requirements (event_id, role_id, quantity) VALUES (ev, rol_b, 0);
    RAISE EXCEPTION 'adet 0 kabul edildi';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- 15e) sahiplik RLS: musteri kendi brief/event/gereksinimini gorur; pro1 hicbirini gormez; admin (ajans) gorur; anon 42501
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.event_briefs WHERE id = v_brief; IF n <> 1 THEN RAISE EXCEPTION 'musteri kendi brief''ini goremedi'; END IF;
  SELECT count(*) INTO n FROM public.event_spec_versions WHERE brief_id = v_brief; IF n <> 2 THEN RAISE EXCEPTION 'musteri surumleri goremedi (%)', n; END IF;
  SELECT count(*) INTO n FROM public.event_requirements WHERE event_id = ev; IF n <> 2 THEN RAISE EXCEPTION 'musteri gereksinimleri goremedi (%)', n; END IF;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.event_briefs WHERE id = v_brief;
  SELECT n + count(*) INTO n FROM public.events WHERE id = ev;
  SELECT n + count(*) INTO n FROM public.event_spec_versions WHERE brief_id = v_brief;
  SELECT n + count(*) INTO n FROM public.event_requirements WHERE event_id = ev;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'pro1 baskasinin etkinlik verisini goruyor (% satir)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.events SET title = 'pro1 yazdi' WHERE id = ev;   -- RLS: 0 satir
  EXECUTE 'RESET ROLE';
  SELECT title INTO st FROM public.events WHERE id = ev;
  IF st = 'pro1 yazdi' THEN RAISE EXCEPTION 'pro1 baskasinin etkinligini guncelledi (RLS delik)'; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.events WHERE id = ev;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF n <> 1 THEN RAISE EXCEPTION 'admin etkinligi goremedi'; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'SELECT count(*) FROM public.events' INTO n;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon events OKUDU';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 15f) kurulus yetkisi: kurum (kurulus sahibi) org brief'i yazar; uye (uye degil) goremez; pro1 org adina yazamaz
  SELECT id INTO org_k FROM public.organizations WHERE legacy_profile_id = kurum;
  IF org_k IS NULL THEN RAISE EXCEPTION 'kurum kurulusu yok (T8)'; END IF;
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.event_briefs (created_by_user_id, organization_id, source, raw_text)
  VALUES (kurum, org_k, 'business_workspace', 'T15 kurum lansmani') RETURNING id INTO v_brief_k;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', uye::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.event_briefs WHERE id = v_brief_k;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'uye olmayan kisi kurulus brief''ini goruyor'; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.event_briefs (created_by_user_id, organization_id, source, raw_text) VALUES (pro1, org_k, 'api', 'sizma');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'pro1 baskasinin kurulusu adina brief yazabildi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- 15g) conversations.event_id: T2 sohbeti baglanir; etkinlik silinince NULL olur (SET NULL)
  SELECT id INTO conv FROM public.conversations WHERE customer_id = musteri AND professional_id = pro1 ORDER BY created_at LIMIT 1;
  IF conv IS NULL THEN RAISE EXCEPTION 'T2 sohbeti yok'; END IF;
  UPDATE public.conversations SET event_id = ev WHERE id = conv;
  DELETE FROM public.events WHERE id = ev;
  SELECT event_id INTO r FROM public.conversations WHERE id = conv;
  IF r.event_id IS NOT NULL THEN RAISE EXCEPTION 'etkinlik silindi ama conversations.event_id kaldi'; END IF;
  SELECT count(*) INTO n FROM public.event_requirements WHERE event_id = ev;
  IF n <> 0 THEN RAISE EXCEPTION 'gereksinimler cascade ile silinmedi'; END IF;

  -- temizlik (brief silinince surumler cascade)
  DELETE FROM public.event_briefs WHERE id IN (v_brief, v_brief_k);
  SELECT count(*) INTO n FROM public.event_spec_versions WHERE brief_id = v_brief;
  IF n <> 0 THEN RAISE EXCEPTION 'surumler cascade ile silinmedi'; END IF;
  DELETE FROM public.service_roles WHERE slug LIKE 'faz1test-etk-%';
  DELETE FROM public.service_categories WHERE slug LIKE 'faz1test-etk-%';

  INSERT INTO t_sonuc VALUES (15, 'T15 FAZ 4a etkinlik/EventSpec', 'GECTI',
    'event_types 15 + anon okur; brief -> v1/v2 otomatik no, tek is_current, created_by otomatik; UPDATE/DELETE 42501, RPC v1 gecerli, pro1 RPC 42501; event + 2 gereksinim; gecersiz tur 23503, ters tarih/adet 0 23514, tekrar rol 23505; RLS: musteri gorur, pro1 0 satir + UPDATE etkisiz, admin gorur, anon 42501; kurulus: kurum yazdi, uye olmayan gormedi, pro1 org adina 42501; conversations.event_id SET NULL, cascade');
EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_sonuc VALUES (15, 'T15 FAZ 4a etkinlik/EventSpec', 'HATA', SQLERRM);
END $$;


-- -----------------------------------------------------------------------------
-- T16) FAZ 4c onay RPC'si. ON KOSUL: 20260922200000_faz4c_01 dalda.
-- T1 verisi: musteri (0001), pro1 (0002). Test rolleri 'faz1test-onay-%' (T0 siler).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  v_brief uuid; v1 uuid; v2 uuid; v3 uuid; ev uuid; ev2 uuid; qr uuid; rol_a int; rol_b int;
  e record; n int; st text;
BEGIN
  IF to_regprocedure('public.create_event_from_spec(uuid)') IS NULL THEN
    INSERT INTO t_sonuc VALUES (16, 'T16 FAZ 4c onay RPC', 'ATLANDI', 'create_event_from_spec yok; faz4c_01 dalda uygulanmamis');
    RETURN;
  END IF;

  -- roller (admin kategori acar -> rol dogar)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active) VALUES ('faz1test-onay-a', 'Faz1 Test Onay A', 'A', 996, true);
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active) VALUES ('faz1test-onay-b', 'Faz1 Test Onay B', 'B', 997, true);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT id INTO rol_a FROM public.service_roles WHERE slug = 'faz1test-onay-a';
  SELECT id INTO rol_b FROM public.service_roles WHERE slug = 'faz1test-onay-b';
  IF rol_a IS NULL OR rol_b IS NULL THEN RAISE EXCEPTION 'test rolleri dogmadi'; END IF;

  -- 16a) musteri brief + v1 (needs_input) -> onay reddi (22023)
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.event_briefs (created_by_user_id, source, raw_text) VALUES (musteri, 'client_web', 'T16 onay testi') RETURNING id INTO v_brief;
  INSERT INTO public.event_spec_versions (brief_id, spec_jsonb, schema_version, parser_version)
  VALUES (v_brief, '{"event_type":"wedding"}'::jsonb, '1.0', 'test') RETURNING id INTO v1;
  BEGIN
    PERFORM public.create_event_from_spec(v1);
    RAISE EXCEPTION 'needs_input surum onaylandi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;

  -- 16b) v2 valid: tur, katilimci, butce, 2 rol (b: adet 2, istege bagli; a tekrar -> ilki alinir) -> v1 artik gecerli degil
  INSERT INTO public.event_spec_versions (brief_id, spec_jsonb, provenance, schema_version, parser_version, validation_status)
  VALUES (v_brief,
          jsonb_build_object('event_type', 'wedding', 'title', 'T16 dugun', 'participant_count', 120, 'budget_min', 50000, 'budget_max', 80000,
                             'start_date', (current_date + 90)::text, 'is_date_flexible', true,
                             'suggested_roles', jsonb_build_array(
                               jsonb_build_object('slug', 'faz1test-onay-a', 'reason', 'a'),
                               jsonb_build_object('slug', 'faz1test-onay-b', 'reason', 'b', 'quantity', 2, 'is_required', false),
                               jsonb_build_object('slug', 'faz1test-onay-a', 'reason', 'tekrar'))),
          '{"event_type":{"source":"user_input","confidence":1}}'::jsonb, '1.0', 'test', 'valid')
  RETURNING id INTO v2;
  BEGIN
    PERFORM public.create_event_from_spec(v1);      -- artik is_current degil
    RAISE EXCEPTION 'gecerli olmayan surum onaylandi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;

  -- 16c) basarili onay
  ev := public.create_event_from_spec(v2);
  EXECUTE 'RESET ROLE';
  SELECT * INTO e FROM public.events WHERE id = ev;
  IF e.owner_user_id <> musteri OR e.brief_id <> v_brief OR e.spec_version_id <> v2 OR e.status <> 'confirmed' OR e.confirmed_at IS NULL
     OR e.event_type <> 'wedding' OR e.title <> 'T16 dugun' OR e.participant_count <> 120 OR e.budget_min <> 50000 OR e.budget_max <> 80000
     OR e.start_date <> current_date + 90 OR NOT e.is_date_flexible OR e.venue_status <> 'searching' OR e.urgency <> 'normal' THEN
    RAISE EXCEPTION 'events satiri beklenen gibi degil: %', e; END IF;
  SELECT count(*) INTO n FROM public.event_requirements WHERE event_id = ev;
  IF n <> 2 THEN RAISE EXCEPTION 'gereksinim sayisi % (2 beklenir; tekrar slug tekillesmeli)', n; END IF;
  SELECT quantity::text || '/' || is_required::text || '/' || sort_order::text INTO st FROM public.event_requirements WHERE event_id = ev AND role_id = rol_a;
  IF st <> '1/true/1' THEN RAISE EXCEPTION 'rol_a gereksinimi % (1/true/1 beklenir)', st; END IF;
  SELECT quantity::text || '/' || is_required::text || '/' || sort_order::text INTO st FROM public.event_requirements WHERE event_id = ev AND role_id = rol_b;
  IF st <> '2/false/2' THEN RAISE EXCEPTION 'rol_b gereksinimi % (2/false/2 beklenir)', st; END IF;

  -- 16d) ayni surumden ikinci onay -> 23505; v3 gecersiz slug -> 22023 ve HICBIR satir yazilmaz (atomik)
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.create_event_from_spec(v2);
    RAISE EXCEPTION 'ayni surumden ikinci etkinlik olustu';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  INSERT INTO public.event_spec_versions (brief_id, spec_jsonb, schema_version, parser_version, validation_status)
  VALUES (v_brief, jsonb_build_object('event_type', 'wedding', 'suggested_roles', jsonb_build_array(
            jsonb_build_object('slug', 'faz1test-onay-a'), jsonb_build_object('slug', 'olmayan-rol'))), '1.0', 'test', 'valid')
  RETURNING id INTO v3;
  BEGIN
    PERFORM public.create_event_from_spec(v3);
    RAISE EXCEPTION 'gecersiz slug ile etkinlik olustu';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.events WHERE spec_version_id = v3;
  IF n <> 0 THEN RAISE EXCEPTION 'gecersiz slug reddedildi ama events satiri kaldi (atomik degil)'; END IF;
  -- gecersiz tur
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.event_spec_versions (brief_id, spec_jsonb, schema_version, parser_version, validation_status)
  VALUES (v_brief, '{"event_type":"olmayan-tur"}'::jsonb, '1.0', 'test', 'valid') RETURNING id INTO v3;
  BEGIN
    PERFORM public.create_event_from_spec(v3);
    RAISE EXCEPTION 'gecersiz tur ile etkinlik olustu';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  EXECUTE 'RESET ROLE';

  -- 16e) baskasi (pro1) musterinin surumunu onaylayamaz (42501); anon RPC'yi cagiramaz (42501)
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.event_spec_versions (brief_id, spec_jsonb, schema_version, parser_version, validation_status)
  VALUES (v_brief, '{"event_type":"wedding"}'::jsonb, '1.0', 'test', 'valid') RETURNING id INTO v3;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_event_from_spec(v3);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'pro1 baskasinin surumunu onayladi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.create_event_from_spec(v3);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon RPC cagirabildi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  -- admin (ajans) onaylayabilir: sahibi ajans olur (auth.uid()), brief musterinin kalir
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  ev2 := public.create_event_from_spec(v3);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT owner_user_id INTO e FROM public.events WHERE id = ev2;
  IF e.owner_user_id <> ajans THEN RAISE EXCEPTION 'admin onayinda owner=% (ajans beklenir)', e.owner_user_id; END IF;

  -- 16f) quote_requests.event_id: musteri etkinlikten talep acar; etkinlik silinince NULL olur
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.quote_requests (customer_id, category_id, event_type, event_id)
  VALUES (musteri, (SELECT legacy_category_id FROM public.service_roles WHERE id = rol_a), 'wedding', ev) RETURNING id INTO qr;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  DELETE FROM public.events WHERE id IN (ev, ev2);
  SELECT event_id INTO e FROM public.quote_requests WHERE id = qr;
  IF e.event_id IS NOT NULL THEN RAISE EXCEPTION 'etkinlik silindi ama quote_requests.event_id kaldi'; END IF;

  -- temizlik
  DELETE FROM public.quote_requests WHERE id = qr;
  DELETE FROM public.event_briefs WHERE id = v_brief;
  DELETE FROM public.service_roles WHERE slug LIKE 'faz1test-onay-%';
  DELETE FROM public.service_categories WHERE slug LIKE 'faz1test-onay-%';

  INSERT INTO t_sonuc VALUES (16, 'T16 FAZ 4c onay RPC', 'GECTI',
    'needs_input surum 22023; eski (is_current degil) surum 22023; onay: events confirmed + tur/baslik/katilimci/butce/tarih/esnek, 2 gereksinim (tekrar slug tekillesti, adet/zorunlu/sira dogru); ayni surum 23505; gecersiz slug 22023 + atomik; gecersiz tur 22023; pro1 42501; anon 42501; admin onayladi (owner admin); quote_requests.event_id SET NULL; temizlik');
EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_sonuc VALUES (16, 'T16 FAZ 4c onay RPC', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T17) FAZ 5 yetenek havuzu. ON KOSUL: 20260930120000/120100 (faz5 01-02) dalda.
-- T8 verisine dayanir: ajans (0004) org_a sahibi (T5'ten beri admin), kurum (0005) org_k sahibi.
-- Kendi verisi: pro1 (0002) Ekibim uyesi (agency_members -> FAZ 0 aynasi) + crew_coordinator; musteri (0001) viewer,
-- uye (0006) finance (dogrudan uyelik); pro2 (0003) harici kayit -> davet -> claim; test rolleri faz1test-havuz-a/b.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  pro2    uuid := 'a0000000-0000-4000-8000-000000000003';
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  kurum   uuid := 'a0000000-0000-4000-8000-000000000005';
  uye     uuid := 'a0000000-0000-4000-8000-000000000006';
  org_a uuid; org_k uuid; rol_a int; rol_b int; cat_a int; am_id uuid; am2_id uuid;
  rec uuid; rec2 uuid; rec3 uuid; tok uuid; tok2 uuid; tok3 uuid; rate1 uuid; rate2 uuid; t_pro1 uuid; t_pro2 uuid;
  r record; d record; n int; n2 int; st text;
BEGIN
  IF to_regclass('public.organization_talent_records') IS NULL THEN
    INSERT INTO t_sonuc VALUES (17, 'T17 FAZ 5 yetenek havuzu', 'ATLANDI', 'organization_talent_records yok; faz5_01 dalda uygulanmamis');
    RETURN;
  END IF;
  SELECT id INTO org_a FROM public.organizations WHERE legacy_profile_id = ajans;
  SELECT id INTO org_k FROM public.organizations WHERE legacy_profile_id = kurum;
  IF org_a IS NULL OR org_k IS NULL THEN RAISE EXCEPTION 'kurulus yok (T8)'; END IF;
  SELECT id INTO t_pro1 FROM public.talents WHERE user_id = pro1;
  SELECT id INTO t_pro2 FROM public.talents WHERE user_id = pro2;
  IF t_pro1 IS NULL OR t_pro2 IS NULL THEN RAISE EXCEPTION 'talents yok (2a)'; END IF;

  -- 17a) modul kapisi: ajans acik (dolum/tetikleyici), kurum kapali
  IF NOT public.org_module_enabled(org_a, 'talent_pool') THEN RAISE EXCEPTION 'ajans kurulusunda talent_pool kapali'; END IF;
  IF public.org_module_enabled(org_k, 'talent_pool') THEN RAISE EXCEPTION 'business kurulusunda talent_pool acik'; END IF;
  -- talents kimlik aynasi: pro1 kapali sutunlarda normalize e-posta
  SELECT canonical_email INTO st FROM public.talents WHERE id = t_pro1;
  IF st IS DISTINCT FROM 'faz1test+pro1@kashe.net' THEN RAISE EXCEPTION 'pro1 canonical_email=% (ayna)', st; END IF;

  -- uyelikler: pro1 Ekibim uyesi (agency_members -> FAZ 0 aynasi, sonra crew_coordinator); musteri viewer, uye finance dogrudan
  INSERT INTO public.agency_members (agency_id, professional_id, member_role) VALUES (ajans, pro1, 'member') RETURNING id INTO am_id;
  SELECT count(*) INTO n FROM public.organization_memberships WHERE id = am_id AND organization_id = org_a AND user_id = pro1;
  IF n <> 1 THEN RAISE EXCEPTION 'pro1 uyeligi aynalanmadi (FAZ 0)'; END IF;
  UPDATE public.organization_memberships SET role = 'crew_coordinator', status = 'active' WHERE id = am_id;
  INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
  VALUES (org_a, musteri, 'viewer', 'active'), (org_a, uye, 'finance', 'active')
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active';

  -- test rolleri (kategori -> rol; ajans admin)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active) VALUES ('faz1test-havuz-a', 'Faz1 Test Havuz Rol A', 'A', 996, true);
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active) VALUES ('faz1test-havuz-b', 'Faz1 Test Havuz Rol B', 'B', 997, true);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT id INTO rol_a FROM public.service_roles WHERE slug = 'faz1test-havuz-a';
  SELECT id INTO rol_b FROM public.service_roles WHERE slug = 'faz1test-havuz-b';
  SELECT id INTO cat_a FROM public.service_categories WHERE slug = 'faz1test-havuz-a';
  IF rol_a IS NULL OR rol_b IS NULL THEN RAISE EXCEPTION 'test rolleri dogmadi'; END IF;

  -- 17b) owner (ajans) harici kayit ekler (RLS): pro2'nin e-postasi; 2 rol, tek birincil
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_talent_records (organization_id, name, email, phone, relationship_type, notes)
  VALUES (org_a, '  Harici Pro Iki ', 'FAZ1TEST+PRO2@kashe.net ', '+90 555 000 0003', 'occasional', 'T17') RETURNING id INTO rec;
  INSERT INTO public.organization_talent_record_roles (record_id, role_id, is_primary) VALUES (rec, rol_a, true), (rec, rol_b, false);
  BEGIN
    UPDATE public.organization_talent_record_roles SET is_primary = true WHERE record_id = rec AND role_id = rol_b;
    RAISE EXCEPTION 'ikinci birincil rol kabul edildi';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  SELECT count(*) INTO n FROM public.organization_talent_records WHERE organization_id = org_a;   -- owner okur
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF n <> 1 THEN RAISE EXCEPTION 'owner kendi havuzunu okuyamadi (%)', n; END IF;
  SELECT * INTO r FROM public.organization_talent_records WHERE id = rec;
  IF r.created_by IS DISTINCT FROM ajans OR r.source <> 'external_manual' OR r.talent_id IS NOT NULL OR r.name <> 'Harici Pro Iki'
     OR r.visibility <> 'private' OR r.invitation_status <> 'none' THEN
    RAISE EXCEPTION 'harici kayit: by=% source=% talent=% name=% vis=% inv=%', r.created_by, r.source, r.talent_id, r.name, r.visibility, r.invitation_status; END IF;
  BEGIN
    UPDATE public.organization_talent_records SET visibility = 'shared_to_marketplace' WHERE id = rec;   -- superuser: CHECK
    RAISE EXCEPTION 'visibility shared_to_marketplace kabul edildi (FAZ 5 kisiti)';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.organization_talent_records SET organization_id = org_k WHERE id = rec;
    RAISE EXCEPTION 'kurulus degistirilebildi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;

  -- 17c) crew_coordinator (pro1) gunceller + okur; viewer (musteri) okumaz/yazamaz; kurum sahibi kendi kurulusuna yazamaz (modul kapali); anon 42501
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.organization_talent_records SET notes = 'T17 koordinator' WHERE id = rec;
  SELECT count(*) INTO n FROM public.organization_talent_records WHERE organization_id = org_a;
  SELECT count(*) INTO n2 FROM public.organization_talent_record_roles WHERE record_id = rec;
  EXECUTE 'RESET ROLE';
  IF n <> 1 OR n2 <> 2 THEN RAISE EXCEPTION 'crew_coordinator okuma: kayit=% rol=% (1/2)', n, n2; END IF;
  SELECT notes INTO st FROM public.organization_talent_records WHERE id = rec;
  IF st <> 'T17 koordinator' THEN RAISE EXCEPTION 'crew_coordinator guncellemesi yazilmadi (%)', st; END IF;

  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.organization_talent_records WHERE organization_id = org_a;
  SELECT count(*) INTO n2 FROM public.organization_talent_record_roles WHERE record_id = rec;
  EXECUTE 'RESET ROLE';
  IF n <> 0 OR n2 <> 0 THEN RAISE EXCEPTION 'viewer havuzu gordu (kayit=% rol=%)', n, n2; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.organization_talent_records (organization_id, name) VALUES (org_a, 'Viewer yazdi');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'viewer havuza yazdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.organization_talent_records (organization_id, name) VALUES (org_k, 'Kurum yazdi');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'business kurulusu havuza yazdi (modul kapali olmali)';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);

  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'SELECT count(*) FROM public.organization_talent_records' INTO n;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon havuzu OKUDU';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 17d) find_talent_by_contact: ajans pro1'i e-postayla bulur (PII yok); musteri (client) bulunmaz; viewer cagiramaz; denetim satiri
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT * INTO d FROM public.find_talent_by_contact(org_a, ' Faz1Test+Pro1@kashe.net', NULL);
  IF d.talent_id IS DISTINCT FROM t_pro1 OR d.match_kind IS DISTINCT FROM 'email' THEN
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'pro1 e-postayla bulunamadi (%, %)', d.talent_id, d.match_kind; END IF;
  SELECT count(*) INTO n FROM public.find_talent_by_contact(org_a, 'faz1test+musteri@kashe.net', '+905550000001');
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'client icin talent bulundu (%)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.find_talent_by_contact(org_a, 'faz1test+pro1@kashe.net', NULL);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'viewer kimlik eslemesi yapabildi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT count(*) INTO n FROM internal.access_audit WHERE organization_id = org_a AND action = 'read' AND target_table = 'talents' AND detail->>'op' = 'talent.lookup' AND actor_user_id = ajans;
  IF n < 2 THEN RAISE EXCEPTION 'talent.lookup denetim satiri eksik (%)', n; END IF;

  -- 17e) gizli oranlar: owner yazar (tarihce), finance okur, crew_coordinator/viewer/kurum/anon 42501, dogrudan tablo 42501
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT public.internal_talent_rate_upsert(org_a, rec, rol_a, 1500, 'per_day', 'TRY', current_date - 10, 'T17 eski') INTO rate1;
  SELECT public.internal_talent_rate_upsert(org_a, rec, rol_a, 1800, 'per_day', 'TRY', current_date, NULL) INTO rate2;
  SELECT count(*) INTO n FROM public.internal_talent_rates_list(org_a, rec);
  SELECT count(*) INTO n2 FROM public.internal_talent_rates_list(org_a, rec) x WHERE x.valid_to IS NULL AND x.default_cost = 1800;
  BEGIN
    PERFORM public.internal_talent_rate_upsert(org_a, rec, rol_a, 1, 'saatlik', 'TRY', current_date, NULL);
    RAISE EXCEPTION 'gecersiz cost_basis kabul edildi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  EXECUTE 'RESET ROLE';
  IF rate1 IS NULL OR rate2 IS NULL OR rate1 = rate2 OR n <> 2 OR n2 <> 1 THEN
    RAISE EXCEPTION 'oran tarihcesi: r1=% r2=% toplam=% acik1800=%', rate1, rate2, n, n2; END IF;
  SELECT valid_to INTO r FROM internal.organization_talent_rates WHERE id = rate1;
  IF r.valid_to IS DISTINCT FROM current_date - 1 THEN RAISE EXCEPTION 'eski oran kapanmadi (valid_to=%)', r.valid_to; END IF;

  PERFORM set_config('request.jwt.claim.sub', uye::text, true);        -- finance: commercial.view + manage
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.internal_talent_rates_list(org_a, rec);
  PERFORM public.internal_talent_rate_close(org_a, rate2, current_date);
  EXECUTE 'RESET ROLE';
  IF n <> 2 THEN RAISE EXCEPTION 'finance oranlari okuyamadi (%)', n; END IF;
  SELECT valid_to INTO r FROM internal.organization_talent_rates WHERE id = rate2;
  IF r.valid_to IS DISTINCT FROM current_date THEN RAISE EXCEPTION 'finance orani kapatamadi (valid_to=%)', r.valid_to; END IF;

  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);       -- crew_coordinator: talent.manage var, commercial YOK
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.internal_talent_rates_list(org_a, rec);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'crew_coordinator ic orani gordu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM internal.organization_talent_rates' INTO n;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'authenticated internal tabloyu dogrudan okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.internal_talent_rate_upsert(org_a, rec, rol_a, 5, 'per_job', 'TRY', current_date, NULL);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'kurum baska kurulusun oranini yazdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'SELECT count(*) FROM public.internal_talent_rates_list($1, $2)' INTO n USING org_a, rec;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon oran RPC''sini cagirdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  SELECT count(*) INTO n FROM internal.access_audit WHERE organization_id = org_a AND target_table = 'organization_talent_rates' AND action = 'write';
  SELECT count(*) INTO n2 FROM internal.access_audit WHERE organization_id = org_a AND target_table = 'organization_talent_rates' AND action = 'read';
  IF n < 3 OR n2 < 2 THEN RAISE EXCEPTION 'oran denetimi eksik (write=% read=%)', n, n2; END IF;

  -- 17f) davet + claim: token yalniz RPC ile; yanlis e-posta 42501; pro2 sahiplenir; ayni token ikinci kez yok; suresi gecmis 22023; client claim edemez; decline
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT public.send_talent_record_invitation(rec) INTO tok;
  BEGIN
    EXECUTE 'SELECT invitation_token FROM public.organization_talent_records WHERE id = $1' INTO tok2 USING rec;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'invitation_token sutunu authenticated tarafindan okundu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  IF tok IS NULL THEN RAISE EXCEPTION 'token uretilmedi'; END IF;
  SELECT * INTO r FROM public.organization_talent_records WHERE id = rec;
  IF r.invitation_status <> 'sent' OR r.invitation_token IS DISTINCT FROM tok OR r.source <> 'invited'
     OR r.invitation_expires_at IS NULL OR r.invitation_expires_at < now() + interval '13 days' THEN
    RAISE EXCEPTION 'davet: status=% token=% source=% expires=%', r.invitation_status, r.invitation_token, r.source, r.invitation_expires_at; END IF;

  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  PERFORM set_config('request.jwt.claim.email', 'faz1test+pro1@kashe.net', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.claim_talent_record(tok);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'yanlis e-postali kullanici kaydi sahiplendi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  PERFORM set_config('request.jwt.claim.sub', pro2::text, true);
  PERFORM set_config('request.jwt.claim.email', 'faz1test+pro2@kashe.net', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.claimable_talent_records_for_me();
  SELECT public.claim_talent_record(tok) INTO rec2;
  SELECT count(*) INTO n2 FROM public.claimable_talent_records_for_me();
  BEGIN
    PERFORM public.claim_talent_record(tok);
    RAISE EXCEPTION 'ayni token ikinci kez kullanildi';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  EXECUTE 'RESET ROLE';
  IF n <> 1 OR n2 <> 0 OR rec2 IS DISTINCT FROM rec THEN RAISE EXCEPTION 'claim: once=% sonra=% rec=%', n, n2, rec2; END IF;
  SELECT * INTO r FROM public.organization_talent_records WHERE id = rec;
  IF r.talent_id IS DISTINCT FROM t_pro2 OR r.source <> 'marketplace_linked' OR r.invitation_status <> 'accepted'
     OR r.invitation_token IS NOT NULL OR r.linked_at IS NULL THEN
    RAISE EXCEPTION 'claim sonrasi: talent=% source=% inv=% token=% linked=%', r.talent_id, r.source, r.invitation_status, r.invitation_token, r.linked_at; END IF;
  SELECT claim_status::text INTO st FROM public.talents WHERE id = t_pro2;
  IF st <> 'claimed' THEN RAISE EXCEPTION 'talents.claim_status=% (claimed beklenir)', st; END IF;
  BEGIN
    UPDATE public.organization_talent_records SET talent_id = t_pro1 WHERE id = rec;   -- superuser: guard
    RAISE EXCEPTION 'bagli talent_id degistirilebildi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;

  -- suresi gecmis davet (musteri e-postali kayit): 22023; sure duzelince client claim edemez (talents yok) -> no_data_found
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_talent_records (organization_id, name, email) VALUES (org_a, 'Harici Musteri', 'faz1test+musteri@kashe.net') RETURNING id INTO rec2;
  SELECT public.send_talent_record_invitation(rec2) INTO tok2;
  INSERT INTO public.organization_talent_records (organization_id, name, email) VALUES (org_a, 'Harici Uye', 'faz1test+uye@kashe.net') RETURNING id INTO rec3;
  SELECT public.send_talent_record_invitation(rec3) INTO tok3;
  EXECUTE 'RESET ROLE';
  UPDATE public.organization_talent_records SET invitation_expires_at = now() - interval '1 day' WHERE id = rec2;
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  PERFORM set_config('request.jwt.claim.email', 'faz1test+musteri@kashe.net', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.claim_talent_record(tok2);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'suresi gecmis davet kabul edildi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  UPDATE public.organization_talent_records SET invitation_expires_at = now() + interval '1 day' WHERE id = rec2;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.claim_talent_record(tok2);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'client (talents yok) kaydi sahiplendi';
  EXCEPTION WHEN no_data_found THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', uye::text, true);
  PERFORM set_config('request.jwt.claim.email', 'faz1test+uye@kashe.net', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.decline_talent_record_invitation(tok3);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.email', '', true);
  SELECT invitation_status::text, invitation_token INTO r FROM public.organization_talent_records WHERE id = rec3;
  IF r.invitation_status <> 'declined' OR r.invitation_token IS NOT NULL THEN RAISE EXCEPTION 'decline: status=% token=%', r.invitation_status, r.invitation_token; END IF;

  -- 17g) dolum fonksiyonu: pro1 (agency_members) -> yeni kayit + rol (provider_services'tan); pro2 (agency_members) -> mevcut kayda iz; ikinci kosu 0
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.services (profile_id, category_id, title, price_min, price_max, price_unit, sort_order)
  VALUES (pro1, cat_a, 'T17 hizmet', 1000, 2000, 'hourly', 1);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF NOT EXISTS (SELECT 1 FROM public.provider_services WHERE provider_id = pro1 AND role_id = rol_a) THEN RAISE EXCEPTION 'provider_services turemedi (2b)'; END IF;
  INSERT INTO public.agency_members (agency_id, professional_id, member_role) VALUES (ajans, pro2, 'member') RETURNING id INTO am2_id;

  SELECT * INTO d FROM public.faz5_backfill_agency_members();
  IF d.yeni_kayit <> 1 OR d.yeni_rol < 1 OR d.atlanan <> 0 THEN RAISE EXCEPTION 'dolum: yeni=% rol=% atlanan=% (1/>=1/0)', d.yeni_kayit, d.yeni_rol, d.atlanan; END IF;
  SELECT * INTO r FROM public.organization_talent_records WHERE legacy_agency_member_id = am_id;
  IF r.id IS NULL OR r.talent_id IS DISTINCT FROM t_pro1 OR r.source <> 'marketplace_linked' OR r.name IS DISTINCT FROM (SELECT trim(full_name) FROM public.profiles WHERE id = pro1) OR r.created_by IS DISTINCT FROM ajans THEN
    RAISE EXCEPTION 'pro1 dolum kaydi: id=% talent=% source=% name=% by=%', r.id, r.talent_id, r.source, r.name, r.created_by; END IF;
  SELECT count(*) INTO n FROM public.organization_talent_record_roles x WHERE x.record_id = r.id AND x.role_id = rol_a;
  IF n <> 1 THEN RAISE EXCEPTION 'pro1 dolum rolu yok'; END IF;
  SELECT legacy_agency_member_id INTO r FROM public.organization_talent_records WHERE id = rec;
  IF r.legacy_agency_member_id IS DISTINCT FROM am2_id THEN RAISE EXCEPTION 'pro2 mevcut kaydina dolum izi yazilmadi (%)', r.legacy_agency_member_id; END IF;
  SELECT * INTO d FROM public.faz5_backfill_agency_members();
  IF d.yeni_kayit <> 0 OR d.yeni_rol <> 0 THEN RAISE EXCEPTION 'dolum idempotan degil (yeni=% rol=%)', d.yeni_kayit, d.yeni_rol; END IF;
  SELECT count(*) INTO n FROM public.agency_members a JOIN public.organizations o ON o.legacy_profile_id = a.agency_id
    JOIN public.talents t ON t.user_id = a.professional_id
   WHERE NOT EXISTS (SELECT 1 FROM public.organization_talent_records x WHERE x.organization_id = o.id AND x.talent_id = t.id);
  IF n <> 0 THEN RAISE EXCEPTION 'havuz kaydi olmayan agency_members var (%)', n; END IF;

  INSERT INTO t_sonuc VALUES (17, 'T17 FAZ 5 yetenek havuzu', 'GECTI',
    'modul: ajans acik / kurum kapali; kimlik aynasi; owner harici kayit + 2 rol (ikinci birincil 23505, visibility CHECK, kurulus sabit); crew_coordinator yazdi/okudu, viewer 0 satir + INSERT 42501, kurum 42501 (modul), anon 42501; find_talent_by_contact pro1 e-posta / client yok / viewer 42501 + denetim; oranlar: tarihce (eski kapandi), finance okudu+kapatti, crew_coordinator/kurum/anon 42501, dogrudan tablo 42501, denetim; davet: token sutunu kapali, yanlis e-posta 42501, pro2 claim (talent bagli, claimed), ayni token yok, suresi gecmis 22023, client claim yok, decline; dolum: pro1 yeni kayit+rol, pro2 mevcut kayda iz, idempotan, kayma 0');
EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.email', '', true);
  INSERT INTO t_sonuc VALUES (17, 'T17 FAZ 5 yetenek havuzu', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T18) FAZ 5/03 Ekibim -> havuz RPC'leri. ON KOSUL: 20260930130000 (faz5 03) dalda. T17 verisine dayanir
-- (ajans org_a; agency_members: pro1 ve pro2; havuz kayitlari dolumla yazilmis; musteri viewer uyesi).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  pro2    uuid := 'a0000000-0000-4000-8000-000000000003';
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  org_a uuid; am1 uuid; am2 uuid; rec uuid; rec2 uuid; t_pro2 uuid; n int; r record;
BEGIN
  IF to_regprocedure('public.sync_org_talent_pool(uuid)') IS NULL THEN
    INSERT INTO t_sonuc VALUES (18, 'T18 FAZ 5 Ekibim -> havuz RPC', 'ATLANDI', 'sync_org_talent_pool yok; faz5_03 dalda uygulanmamis');
    RETURN;
  END IF;
  SELECT id INTO org_a FROM public.organizations WHERE legacy_profile_id = ajans;
  SELECT id INTO am1 FROM public.agency_members WHERE agency_id = ajans AND professional_id = pro1;
  SELECT id INTO am2 FROM public.agency_members WHERE agency_id = ajans AND professional_id = pro2;
  SELECT id INTO t_pro2 FROM public.talents WHERE user_id = pro2;
  IF org_a IS NULL OR am1 IS NULL OR am2 IS NULL THEN RAISE EXCEPTION 'T17 verisi yok (org=%, am1=%, am2=%)', org_a, am1, am2; END IF;

  -- 18a) pro2'nin havuz kaydini sil; pro2 (profesyonelin kendisi) RPC ile yeniden yaratir (davet kabulu senaryosu)
  DELETE FROM public.organization_talent_records WHERE organization_id = org_a AND talent_id = t_pro2;
  PERFORM set_config('request.jwt.claim.sub', pro2::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT public.ensure_talent_record_for_membership(am2) INTO rec;
  SELECT public.ensure_talent_record_for_membership(am2) INTO rec2;  -- idempotan: ayni id
  EXECUTE 'RESET ROLE';
  SELECT * INTO r FROM public.organization_talent_records WHERE id = rec;
  IF r.id IS NULL OR r.talent_id IS DISTINCT FROM t_pro2 OR r.source <> 'marketplace_linked' OR r.legacy_agency_member_id IS DISTINCT FROM am2 THEN
    RAISE EXCEPTION 'pro2 kaydi: id=% talent=% source=% legacy=%', r.id, r.talent_id, r.source, r.legacy_agency_member_id; END IF;
  IF rec2 IS DISTINCT FROM rec THEN RAISE EXCEPTION 'ensure idempotan degil (% / %)', rec, rec2; END IF;
  SELECT count(*) INTO n FROM public.organization_talent_records WHERE organization_id = org_a AND talent_id = t_pro2;
  IF n <> 1 THEN RAISE EXCEPTION 'pro2 icin % kayit (1 beklenir)', n; END IF;

  -- 18b) baskasinin uyeligi: musteri (viewer, talent.manage yok) -> 42501; pro1 (crew_coordinator, talent.manage) am2 icin -> OK
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.ensure_talent_record_for_membership(am2);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'viewer baskasinin uyeligi icin kayit yazabildi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.ensure_talent_record_for_membership(am2);
  EXECUTE 'RESET ROLE';

  -- 18c) sync_org_talent_pool: pro1'in kaydi silinir; ajans (talent.manage) sync -> 1; ikinci -> 0; musteri -> 42501; denetim
  DELETE FROM public.organization_talent_records WHERE organization_id = org_a AND legacy_agency_member_id = am1;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT public.sync_org_talent_pool(org_a) INTO n;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'sync ilk kosu % (1 beklenir)', n; END IF;
  SELECT count(*) INTO n FROM public.organization_talent_records WHERE organization_id = org_a AND legacy_agency_member_id = am1 AND source = 'marketplace_linked';
  IF n <> 1 THEN RAISE EXCEPTION 'pro1 kaydi sync ile gelmedi'; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT public.sync_org_talent_pool(org_a) INTO n;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'sync ikinci kosu % (0 beklenir)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT public.sync_org_talent_pool(org_a) INTO n;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'viewer sync cagirabildi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT count(*) INTO n FROM internal.access_audit WHERE organization_id = org_a AND detail->>'op' = 'talent.sync';
  IF n < 1 THEN RAISE EXCEPTION 'talent.sync denetim satiri yok'; END IF;
  -- kayma sifir
  SELECT count(*) INTO n FROM public.agency_members a JOIN public.organizations o ON o.legacy_profile_id = a.agency_id
    JOIN public.talents t ON t.user_id = a.professional_id
   WHERE NOT EXISTS (SELECT 1 FROM public.organization_talent_records x WHERE x.organization_id = o.id AND x.talent_id = t.id);
  IF n <> 0 THEN RAISE EXCEPTION 'kayma % (0 beklenir)', n; END IF;

  INSERT INTO t_sonuc VALUES (18, 'T18 FAZ 5 Ekibim -> havuz RPC', 'GECTI',
    'profesyonel kendi uyeligi icin kaydi yeniden yaratti (marketplace_linked + legacy iz, idempotan); viewer 42501, crew_coordinator OK; sync_org_talent_pool 1 -> 0, viewer 42501, denetim; kayma 0');
EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_sonuc VALUES (18, 'T18 FAZ 5 Ekibim -> havuz RPC', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T19) FAZ 6 Match V0.2. ON KOSUL: 20261002120000 + 20261002130000 (faz6 01-02) dalda. T17 Ekibim verisine (pro1 + pro2 ajans uyesi) dayanir.
--      Kendi verisi: test rolleri faz1test-match-a/b/c (T0 siler); pro1 -> match-a, pro2 -> match-b hizmeti; pro2 ve ajans yayina
--      alinir (admin = ajans); pro1 40-60 bin (butce 50-80 bin: uygun), pro2 90-120 bin (ust butceyi asar: v0.2 'affordable' kurali);
--      musteri etkinligi 'T19 dugun' (match-a zorunlu 1, match-b istege bagli 2, match-c zorunlu 1 — kimse vermez)
--      create_event_from_spec ile; ajans etkinligi gereksinimsiz (ev2). T20 bu veriye dayanir.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  pro2    uuid := 'a0000000-0000-4000-8000-000000000003';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  ev uuid; ev2 uuid; rol_a int; rol_b int; rol_c int; cat_a int; cat_b int; req_c uuid; v_brief uuid; v1 uuid;
  run1 uuid; run2 uuid; run3 uuid; n int; n2 int; r record; ids uuid[]; st text;
BEGIN
  IF to_regprocedure('public.run_event_match(uuid, public.match_strategy)') IS NULL THEN
    INSERT INTO t_sonuc VALUES (19, 'T19 FAZ 6 Match V0.2', 'ATLANDI', 'run_event_match yok; faz6_01 dalda uygulanmamis');
    RETURN;
  END IF;

  -- 19a) veri: roller, hizmetler, yayin, etkinlikler
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);   -- admin
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active) VALUES
    ('faz1test-match-a', 'Faz1 Test Match A', 'A', 993, true), ('faz1test-match-b', 'Faz1 Test Match B', 'B', 994, true),
    ('faz1test-match-c', 'Faz1 Test Match C', 'C', 995, true);
  EXECUTE 'RESET ROLE';
  SELECT id, legacy_category_id INTO rol_a, cat_a FROM public.service_roles WHERE slug = 'faz1test-match-a';
  SELECT id, legacy_category_id INTO rol_b, cat_b FROM public.service_roles WHERE slug = 'faz1test-match-b';
  SELECT id INTO rol_c FROM public.service_roles WHERE slug = 'faz1test-match-c';
  IF rol_a IS NULL OR rol_b IS NULL OR rol_c IS NULL THEN RAISE EXCEPTION 'test rolleri dogmadi'; END IF;
  INSERT INTO public.services (profile_id, category_id, title, price_min, price_max, price_unit) VALUES (pro1, cat_a, 'T19 A', 40000, 60000, 'total');
  INSERT INTO public.services (profile_id, category_id, title, price_min, price_max, price_unit) VALUES (pro2, cat_b, 'T19 B', 90000, 120000, 'total');   -- ust butceyi asar
  UPDATE public.profiles SET is_published = true, approval_status = 'approved', approved_at = COALESCE(approved_at, now()) WHERE id IN (pro2, ajans);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT count(*) INTO n FROM public.providers WHERE id IN (pro1, pro2, ajans) AND is_published AND approval_status = 'approved' AND suspended_at IS NULL;
  IF n <> 3 THEN RAISE EXCEPTION 'pro1/pro2/ajans yayinda degil (%)', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.provider_services WHERE provider_id = pro1 AND role_id = rol_a)
     OR NOT EXISTS (SELECT 1 FROM public.provider_services WHERE provider_id = pro2 AND role_id = rol_b) THEN
    RAISE EXCEPTION 'provider_services turetilmedi'; END IF;
  IF (SELECT count(*) FROM public.agency_members WHERE agency_id = ajans AND professional_id IN (pro1, pro2)) <> 2 THEN
    RAISE EXCEPTION 'pro1/pro2 ajans uyesi degil (T17 verisi)'; END IF;

  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.event_briefs (created_by_user_id, source, raw_text) VALUES (musteri, 'client_web', 'T19 eslestirme testi') RETURNING id INTO v_brief;
  INSERT INTO public.event_spec_versions (brief_id, spec_jsonb, provenance, schema_version, parser_version, validation_status)
  VALUES (v_brief,
          jsonb_build_object('event_type', 'wedding', 'title', 'T19 dugun', 'participant_count', 120, 'budget_min', 50000, 'budget_max', 80000,
                             'start_date', (current_date + 90)::text,
                             'suggested_roles', jsonb_build_array(
                               jsonb_build_object('slug', 'faz1test-match-a', 'reason', 'a'),
                               jsonb_build_object('slug', 'faz1test-match-b', 'reason', 'b', 'quantity', 2, 'is_required', false),
                               jsonb_build_object('slug', 'faz1test-match-c', 'reason', 'c'))),
          '{"event_type":{"source":"user_input","confidence":1}}'::jsonb, '1.0', 'test', 'valid')
  RETURNING id INTO v1;
  ev := public.create_event_from_spec(v1);
  EXECUTE 'RESET ROLE';
  SELECT id INTO req_c FROM public.event_requirements WHERE event_id = ev AND role_id = rol_c;
  IF req_c IS NULL THEN RAISE EXCEPTION 'match-c gereksinimi yok'; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.event_briefs (created_by_user_id, source, raw_text) VALUES (ajans, 'client_web', 'T19 ajans etkinligi') RETURNING id INTO v_brief;
  INSERT INTO public.event_spec_versions (brief_id, spec_jsonb, schema_version, parser_version, validation_status)
  VALUES (v_brief, '{"event_type":"wedding","title":"T19 ajans"}'::jsonb, '1.0', 'test', 'valid') RETURNING id INTO v1;
  ev2 := public.create_event_from_spec(v1);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- 19b) sahip hybrid kosu: profesyoneller rol basina, ajans eligible DEGIL, durum matching
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  run1 := public.run_event_match(ev, 'hybrid');
  EXECUTE 'RESET ROLE';
  SELECT status INTO st FROM public.events WHERE id = ev;
  IF st <> 'matching' THEN RAISE EXCEPTION 'durum % (matching beklenir)', st; END IF;
  SELECT * INTO r FROM public.match_runs WHERE id = run1;
  IF r.algorithm_version <> 'v0.2' OR r.strategy <> 'hybrid' OR r.created_by <> musteri OR r.candidate_count < 3 OR r.latency_ms IS NULL THEN
    RAISE EXCEPTION 'kosu satiri beklenen gibi degil: %', r; END IF;
  SELECT * INTO r FROM public.match_candidates WHERE match_run_id = run1 AND provider_id = pro1 AND role_id = rol_a;
  IF r.id IS NULL THEN RAISE EXCEPTION 'pro1 match-a adayi yok'; END IF;
  IF NOT (r.reason_codes @> ARRAY['date_available','budget_fit']) OR r.match_score < 45 OR r.availability_conf <> 0.90 OR r.was_shown THEN
    RAISE EXCEPTION 'pro1 adayi: kodlar=% puan=% conf=%', r.reason_codes, r.match_score, r.availability_conf; END IF;
  SELECT * INTO r FROM public.match_candidates WHERE match_run_id = run1 AND provider_id = pro2 AND role_id = rol_b;
  IF r.id IS NULL THEN RAISE EXCEPTION 'pro2 match-b adayi yok'; END IF;
  IF r.reason_codes @> ARRAY['budget_fit'] THEN RAISE EXCEPTION 'pro2 ust butceyi asar ama budget_fit aldi (%)', r.reason_codes; END IF;
  IF (SELECT params->>'budget_rule' FROM public.match_runs WHERE id = run1) <> 'affordable' THEN RAISE EXCEPTION 'params.budget_rule yok'; END IF;
  SELECT count(*) INTO n FROM public.match_candidates WHERE match_run_id = run1 AND role_id = rol_c;
  IF n <> 0 THEN RAISE EXCEPTION 'kimse vermeyen rol icin % aday', n; END IF;
  SELECT * INTO r FROM public.match_candidates WHERE match_run_id = run1 AND provider_id = ajans;
  IF r.id IS NULL OR r.role_id IS NOT NULL OR r.coverage_ratio IS NULL THEN RAISE EXCEPTION 'ajans adayi yok/yanlis: %', r; END IF;
  -- kapsam: match-a (3) pro1 uye -> 1.0; match-b (1, adet 2) pro2 uye 1 kisi -> 0.5; match-c (3) -> 0  => (3 + 0.5) / 7 = 0.5
  IF r.full_service_eligible OR r.coverage_ratio <> 0.500 OR r.reason_codes @> ARRAY['coverage_full'] THEN
    RAISE EXCEPTION 'ajans kapsami: eligible=% coverage=% kodlar=%', r.full_service_eligible, r.coverage_ratio, r.reason_codes; END IF;
  -- full_service kosusu: eligible ajans yok -> 0 ajans adayi, profesyonel de yok
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  run2 := public.run_event_match(ev, 'full_service');
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.match_candidates WHERE match_run_id = run2;
  IF n <> 0 THEN RAISE EXCEPTION 'full_service: eligible olmayan ajans listelendi (%)', n; END IF;

  -- 19c) zorunlu rol kaldirilinca ajans eligible, coverage (3 + 0.5) / 4 = 0.875, coverage_full; full_service'te listelenir
  DELETE FROM public.event_requirements WHERE id = req_c;
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  run3 := public.run_event_match(ev, 'full_service');
  EXECUTE 'RESET ROLE';
  SELECT * INTO r FROM public.match_candidates WHERE match_run_id = run3 AND provider_id = ajans;
  IF r.id IS NULL OR NOT r.full_service_eligible OR r.coverage_ratio <> 0.875 OR NOT (r.reason_codes @> ARRAY['coverage_full']) OR r.final_rank <> 1 THEN
    RAISE EXCEPTION 'ajans eligible bekleniyordu: %', r; END IF;
  SELECT count(*) INTO n FROM public.match_candidates WHERE match_run_id = run3 AND role_id IS NOT NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'full_service kosusunda profesyonel aday var (%)', n; END IF;
  -- ekle-yalniz: ilk kosu degismedi
  SELECT candidate_count INTO n FROM public.match_runs WHERE id = run1;
  SELECT count(*) INTO n2 FROM public.match_candidates WHERE match_run_id = run1;
  IF n <> n2 THEN RAISE EXCEPTION 'ilk kosu degisti (%/%)', n, n2; END IF;

  -- 19d) gosterim / tik: sahip isaretler, baskasi 42501; was_shown yalniz false -> true
  SELECT array_agg(id) INTO ids FROM public.match_candidates WHERE match_run_id = run1 AND role_id = rol_a;
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  n := public.mark_match_candidates_shown(run1, ids);
  IF n <> array_length(ids, 1) THEN RAISE EXCEPTION 'gosterim isareti % (% beklenir)', n, array_length(ids, 1); END IF;
  n := public.mark_match_candidates_shown(run1, ids);
  IF n <> 0 THEN RAISE EXCEPTION 'ikinci gosterim isareti % (0 beklenir)', n; END IF;
  IF NOT public.mark_match_candidate_clicked(ids[1]) THEN RAISE EXCEPTION 'tik isareti basarisiz'; END IF;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.match_candidates WHERE id = ANY(ids) AND was_shown;
  IF n <> array_length(ids, 1) THEN RAISE EXCEPTION 'was_shown yazilmadi'; END IF;
  SELECT count(*) INTO n FROM public.match_candidates WHERE id = ids[1] AND was_clicked;
  IF n <> 1 THEN RAISE EXCEPTION 'was_clicked yazilmadi'; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.mark_match_candidates_shown(run1, ids);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'baskasi gosterim isaretledi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 19e) yetki: baskasi kosamaz (42501), anon kosamaz, gereksinimsiz etkinlik 22023, taslak/baska durum 22023
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.run_event_match(ev, 'hybrid');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'pro1 baskasinin etkinligini eslestirdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.run_event_match(ev, 'hybrid');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon RPC cagirabildi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.run_event_match(ev2, 'hybrid');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'gereksinimsiz etkinlik eslestirildi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- 19f) RLS: sahip kosulari gorur, pro1 gormez, anon 42501; authenticated match_* yazamaz
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.match_runs WHERE event_id = ev;
  SELECT count(*) INTO n2 FROM public.match_candidates WHERE match_run_id = run1;
  EXECUTE 'RESET ROLE';
  IF n < 3 OR n2 < 3 THEN RAISE EXCEPTION 'sahip kosulari goremedi (%/%)', n, n2; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.match_runs WHERE event_id = ev;
  BEGIN
    INSERT INTO public.match_runs (event_id, algorithm_version) VALUES (ev, 'x');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'authenticated match_runs yazdi';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'pro1 baskasinin kosusunu gordu (%)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO n FROM public.match_runs;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon match_runs okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  INSERT INTO t_sonuc VALUES (19, 'T19 FAZ 6 Match V0.2', 'GECTI',
    'v0.2 hybrid: rol basina profesyonel (kodlar, puan, conf; ust butceyi asan budget_fit almaz), ajans coverage 0.5 eligible degil; full_service 0; zorunlu rol kalkinca 0.875 eligible + coverage_full; ekle-yalniz; shown/clicked (sahip, baskasi 42501); baskasi/anon/gereksinimsiz red; RLS');
EXCEPTION WHEN OTHERS THEN
  BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO t_sonuc VALUES (19, 'T19 FAZ 6 Match V0.2', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T20) FAZ 6 ekip + ic ticari goruntu. ON KOSUL: faz6 01 dalda. T19 verisine dayanir (T19 dugun / T19 ajans etkinlikleri, match-a rolu, org_a, pro1 havuz kaydi).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  uye     uuid := 'a0000000-0000-4000-8000-000000000006';   -- finance (commercial.view + manage)
  ev uuid; ev2 uuid; org_a uuid; rol_a int; rec1 uuid; crew1 uuid; crew2 uuid; m1 uuid; m2 uuid;
  n int; r record; st text;
BEGIN
  IF to_regprocedure('public.crew_member_commercial_snapshot(uuid)') IS NULL THEN
    INSERT INTO t_sonuc VALUES (20, 'T20 FAZ 6 ekip + ic goruntu', 'ATLANDI', 'faz6_01 dalda uygulanmamis');
    RETURN;
  END IF;
  SELECT id INTO ev FROM public.events WHERE owner_user_id = musteri AND title = 'T19 dugun';
  SELECT id INTO ev2 FROM public.events WHERE owner_user_id = ajans AND title = 'T19 ajans';
  SELECT id INTO org_a FROM public.organizations WHERE legacy_profile_id = ajans;
  SELECT id INTO rol_a FROM public.service_roles WHERE slug = 'faz1test-match-a';
  SELECT otr.id INTO rec1 FROM public.organization_talent_records otr
   WHERE otr.organization_id = org_a AND otr.talent_id = (SELECT t.id FROM public.talents t WHERE t.user_id = pro1 AND t.claim_status <> 'merged');
  IF ev IS NULL OR ev2 IS NULL OR org_a IS NULL OR rec1 IS NULL THEN RAISE EXCEPTION 'on kosul verisi yok (ev=% ev2=% org=% rec=%)', ev, ev2, org_a, rec1; END IF;
  -- ajans etkinligine zorunlu gereksinim (match-a) — confirm kontrolu icin
  INSERT INTO public.event_requirements (event_id, role_id, quantity, is_required) VALUES (ev2, rol_a, 1, true) ON CONFLICT DO NOTHING;

  -- 20a) bireysel ekip (musteri): crews + uye (pazaryeri); kaynaksiz uye 22023; crew_id degismez; ic goruntu yok (22023)
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.crews (event_id, name) VALUES (ev, 'T20 bireysel') RETURNING id INTO crew1;
  INSERT INTO public.crew_members (crew_id, role_id, provider_id) VALUES (crew1, rol_a, pro1) RETURNING id INTO m1;
  BEGIN
    INSERT INTO public.crew_members (crew_id, role_id) VALUES (crew1, rol_a);
    RAISE EXCEPTION 'kaynaksiz uye eklendi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.crew_member_commercial_snapshot(m1);
    RAISE EXCEPTION 'bireysel ekipte ic goruntu alindi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  EXECUTE 'RESET ROLE';
  -- guard (sutun yetkisi authenticated'da zaten yok; tetikleyici superuser ile olculur)
  BEGIN
    UPDATE public.crews SET event_id = ev2 WHERE id = crew1;
    RAISE EXCEPTION 'ekibin etkinligi degisti';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    UPDATE public.crew_members SET crew_id = crew1 WHERE id = m1;   -- ayni deger: serbest
    UPDATE public.crew_members SET crew_id = gen_random_uuid() WHERE id = m1;
    RAISE EXCEPTION 'uyenin ekibi degisti';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  SELECT * INTO r FROM public.crews WHERE id = crew1;
  IF r.created_by <> musteri OR r.source_policy <> 'marketplace_only' OR r.status <> 'draft' THEN RAISE EXCEPTION 'bireysel ekip satiri: %', r; END IF;
  SELECT pool_origin::text INTO st FROM public.crew_members WHERE id = m1;
  IF st <> 'marketplace' THEN RAISE EXCEPTION 'pool_origin % (marketplace beklenir)', st; END IF;
  -- baskasi (pro1) ekibi gormez / uye ekleyemez
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.crews WHERE id = crew1;
  BEGIN
    INSERT INTO public.crew_members (crew_id, role_id, provider_id) VALUES (crew1, rol_a, pro1);
    RAISE EXCEPTION 'baskasi uye ekledi';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'pro1 baskasinin ekibini gordu'; END IF;

  -- 20b) kurulus ekibi (ajans owner): havuz kaydindan uye -> pool_origin private, provider_id turetildi; kurulusa ait olmayan kayit 22023
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.crews (event_id, organization_id, name) VALUES (ev2, org_a, 'T20 ajans') RETURNING id INTO crew2;
  INSERT INTO public.crew_members (crew_id, role_id, talent_record_id) VALUES (crew2, rol_a, rec1) RETURNING id INTO m2;
  EXECUTE 'RESET ROLE';
  SELECT * INTO r FROM public.crews WHERE id = crew2;
  IF r.source_policy <> 'private_first' THEN RAISE EXCEPTION 'kurulus ekibi source_policy % (private_first beklenir)', r.source_policy; END IF;
  SELECT * INTO r FROM public.crew_members WHERE id = m2;
  IF r.pool_origin <> 'private' OR r.provider_id IS DISTINCT FROM pro1 THEN RAISE EXCEPTION 'havuz uyesi: origin=% provider=%', r.pool_origin, r.provider_id; END IF;
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.crew_members (crew_id, role_id, talent_record_id) VALUES (crew1, rol_a, rec1);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'bireysel ekibe havuz kaydi eklendi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;

  -- 20c) ic goruntu: acik oran yokken snapshot 22023; owner oran acar; snapshot -> default 5000; finance okur; override -> marj; pro1 (crew_coordinator) 42501
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.crew_member_commercial_snapshot(m2);
    RAISE EXCEPTION 'oran yokken snapshot alindi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  PERFORM public.internal_talent_rate_upsert(org_a, rec1, rol_a, 5000, 'per_day', 'TRY', current_date, 'T20');
  PERFORM public.crew_member_commercial_snapshot(m2);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', uye::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT * INTO r FROM public.internal_crew_commercials_list(crew2);
  IF r.crew_member_id IS DISTINCT FROM m2 OR r.agreed_cost <> 5000 OR r.cost_basis <> 'per_day' OR r.rate_source <> 'default' OR r.client_price IS NOT NULL THEN
    RAISE EXCEPTION 'snapshot satiri: %', r; END IF;
  PERFORM public.internal_crew_commercial_upsert(m2, 6000, 'per_day', 'TRY', 9000, 'T20 override');
  SELECT * INTO r FROM public.internal_crew_commercials_list(crew2);
  IF r.agreed_cost <> 6000 OR r.client_price <> 9000 OR r.markup_amount <> 3000 OR r.margin_rate <> 0.3333 OR r.rate_source <> 'manual_override' THEN
    RAISE EXCEPTION 'override satiri: %', r; END IF;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);   -- crew_coordinator: crew.manage var, commercial yok
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.internal_crew_commercials_list(crew2);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'crew_coordinator ic goruntuyu okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM internal.crew_member_commercials;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'authenticated internal tabloyu okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  -- denetim: read + write satirlari
  SELECT count(*) INTO n FROM internal.access_audit WHERE organization_id = org_a AND target_table = 'crew_member_commercials';
  IF n < 3 THEN RAISE EXCEPTION 'denetim satiri az (%)', n; END IF;

  -- 20d) kurulus yetkisi: pro1 (crew_coordinator) ekibi gorur ve uye ekler; musteri (viewer) gorur ama ekleyemez
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.crews WHERE id = crew2;
  UPDATE public.crew_members SET status = 'contacted' WHERE id = m2;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'crew_coordinator kurulus ekibini goremedi'; END IF;
  SELECT status::text INTO st FROM public.crew_members WHERE id = m2;
  IF st <> 'contacted' THEN RAISE EXCEPTION 'crew_coordinator uye guncelleyemedi (%)', st; END IF;
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.crews WHERE id = crew2;
  BEGIN
    UPDATE public.crew_members SET status = 'declined' WHERE id = m2;
    GET DIAGNOSTICS n := ROW_COUNT;   -- RLS: 0 satir (hata degil)
  EXCEPTION WHEN insufficient_privilege THEN n := 0; END;
  EXECUTE 'RESET ROLE';
  SELECT status::text INTO st FROM public.crew_members WHERE id = m2;
  IF st <> 'contacted' THEN RAISE EXCEPTION 'viewer uye guncelledi (%)', st; END IF;

  -- 20e) confirm kontrolu: zorunlu rol onaylanmis uyeyle kapsanmadan 'confirmed' olmaz; uye confirmed -> ekip confirmed
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    UPDATE public.crews SET status = 'confirmed' WHERE id = crew2;
    RAISE EXCEPTION 'kapsanmamis ekip confirmed oldu';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  UPDATE public.crew_members SET status = 'confirmed' WHERE id = m2;
  UPDATE public.crews SET status = 'confirmed' WHERE id = crew2;
  EXECUTE 'RESET ROLE';
  SELECT status::text INTO st FROM public.crews WHERE id = crew2;
  IF st <> 'confirmed' THEN RAISE EXCEPTION 'ekip confirmed olmadi (%)', st; END IF;
  -- havuz kaydi silinirse uye kalir (SET NULL), ic goruntu kalir; kaynak silinmis uye K7'de sayilir — burada yalniz FK davranisi
  PERFORM set_config('request.jwt.claim.sub', '', true);

  INSERT INTO t_sonuc VALUES (20, 'T20 FAZ 6 ekip + ic goruntu', 'GECTI',
    'bireysel ekip (kaynaksiz uye 22023, event_id sabit, ic goruntu yok); kurulus ekibi (havuz uyesi private + provider turetildi, yabanci kayit 22023); snapshot (oran yok 22023 -> 5000 default), finance okur, override marj 0.3333, crew_coordinator/authenticated 42501, denetim; viewer okur yazamaz; confirm kapsam kontrolu');
EXCEPTION WHEN OTHERS THEN
  BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO t_sonuc VALUES (20, 'T20 FAZ 6 ekip + ic goruntu', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T21) FAZ 7a teklif yasam dongusu. ON KOSUL: 20261003120000 (faz7a 01) dalda. T20 verisine dayanir (Test Ajans kurulus ekibi,
--      1 confirmed uye, ic goruntu 6000/9000). Roller: ajans owner (proposals.manage + commercial.*), musteri -> 'sales'
--      (proposals.manage, commercial YOK; T17'deki viewer uyeligi bu testte sales yapilir), uye (0006) finance (commercial.*),
--      pro1 crew_coordinator (proposals.view YOK).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  uye     uuid := 'a0000000-0000-4000-8000-000000000006';
  org_a uuid; crew2 uuid; prop uuid; v1 uuid; v2 uuid; item1 uuid; item2 uuid; n int; r record; st text; tok text; lnk uuid;
BEGIN
  IF to_regprocedure('public.proposal_create(uuid,text,uuid,uuid,text,text,uuid)') IS NULL THEN
    INSERT INTO t_sonuc VALUES (21, 'T21 FAZ 7a teklif', 'ATLANDI', 'proposal_create yok; faz7a_01 dalda uygulanmamis');
    RETURN;
  END IF;
  SELECT id INTO org_a FROM public.organizations WHERE legacy_profile_id = ajans;
  SELECT id INTO crew2 FROM public.crews WHERE organization_id = org_a AND name = 'T20 ajans';
  IF org_a IS NULL OR crew2 IS NULL THEN RAISE EXCEPTION 'on kosul: org_a=% crew2=% (T20 kosmali)', org_a, crew2; END IF;
  UPDATE public.organization_memberships SET role = 'sales' WHERE organization_id = org_a AND user_id = musteri;

  -- 21a) owner ekipten teklif acar: 1 kalem (confirmed uye), fiyat 9000 (client_price), ic kalem 6000 (crew_snapshot), toplamlar
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  prop := public.proposal_create(org_a, 'T21 teklif', NULL, crew2, 'Musteri Adi', 'Faz1Test+Musteri@kashe.net');
  EXECUTE 'RESET ROLE';
  SELECT * INTO r FROM public.proposals WHERE id = prop;
  IF r.status <> 'draft' OR r.current_version_id IS NULL OR r.client_email <> 'faz1test+musteri@kashe.net' OR r.crew_id <> crew2 OR r.created_by <> ajans THEN
    RAISE EXCEPTION 'teklif satiri: %', r; END IF;
  v1 := r.current_version_id;
  SELECT * INTO r FROM public.proposal_versions WHERE id = v1;
  IF r.version_no <> 1 OR r.subtotal <> 9000 OR r.tax_rate <> 0.20 OR r.tax_amount <> 1800 OR r.total_amount <> 10800 OR r.sent_at IS NOT NULL THEN
    RAISE EXCEPTION 'surum 1 toplamlari: %', r; END IF;
  SELECT count(*) INTO n FROM public.proposal_items WHERE proposal_version_id = v1;
  IF n <> 1 THEN RAISE EXCEPTION 'kalem sayisi % (1 beklenir)', n; END IF;
  SELECT id INTO item1 FROM public.proposal_items WHERE proposal_version_id = v1;
  SELECT count(*) INTO n FROM internal.proposal_internal_items WHERE proposal_item_id = item1 AND internal_cost = 6000 AND source = 'crew_snapshot';
  IF n <> 1 THEN RAISE EXCEPTION 'ic kalem yok/yanlis'; END IF;

  -- 21b) sales (musteri): fiyat gunceller (toplam yeniden), gizli kalem toplama girmez, ic kalem listesi 42501, status/INSERT dogrudan 42501
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.proposal_items SET unit_client_price = 9500 WHERE id = item1;
  INSERT INTO public.proposal_items (proposal_version_id, description, quantity, unit_client_price, is_visible_to_client, sort_order)
  VALUES (v1, 'T21 gizli', 1, 500, false, 9) RETURNING id INTO item2;
  SELECT * INTO r FROM public.proposal_versions WHERE id = v1;
  IF r.subtotal <> 9500 OR r.tax_amount <> 1900 OR r.total_amount <> 11400 THEN
    RAISE EXCEPTION 'sales guncellemesi sonrasi toplam %/%/% (9500/1900/11400 beklenir; gizli kalem girmemeli)', r.subtotal, r.tax_amount, r.total_amount; END IF;
  DELETE FROM public.proposal_items WHERE id = item2;
  BEGIN
    PERFORM public.internal_proposal_items_list(v1);
    RAISE EXCEPTION 'sales ic kalemleri gordu';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.proposals SET status = 'sent' WHERE id = prop;
    RAISE EXCEPTION 'sales durumu dogrudan degistirdi';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.proposals (seller_organization_id, seller_provider_id, title) VALUES (org_a, ajans, 'x');
    RAISE EXCEPTION 'sales dogrudan teklif acti';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.proposal_versions SET tax_rate = 0.10 WHERE id = v1;
  SELECT * INTO r FROM public.proposal_versions WHERE id = v1;
  IF r.tax_amount <> 950 OR r.total_amount <> 10450 THEN RAISE EXCEPTION 'tax_rate degisimi sonrasi %/% (950/10450 beklenir)', r.tax_amount, r.total_amount; END IF;
  UPDATE public.proposal_versions SET tax_rate = 0.20 WHERE id = v1;
  EXECUTE 'RESET ROLE';

  -- 21c) finance (uye): ic kalem listesi (marj), ic maliyet guncelle
  PERFORM set_config('request.jwt.claim.sub', uye::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT * INTO r FROM public.internal_proposal_items_list(v1);
  IF r.item_id <> item1 OR r.internal_cost <> 6000 OR r.markup_amount <> 3500 OR r.margin_rate <> 0.3684 THEN
    RAISE EXCEPTION 'finance liste: %', r; END IF;
  PERFORM public.internal_proposal_item_upsert(item1, 6500, 'T21 elle');
  SELECT * INTO r FROM public.internal_proposal_items_list(v1);
  IF r.internal_cost <> 6500 OR r.markup_amount <> 3000 OR r.source <> 'manual' THEN RAISE EXCEPTION 'finance guncelleme: %', r; END IF;
  EXECUTE 'RESET ROLE';

  -- 21d) owner gonderir: token, surum dondu, kalem/ic kalem/tax degisimi 22023; yeni surum kopyalar
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.proposal_new_version(prop);
    RAISE EXCEPTION 'taslakken yeni surum acildi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  SELECT s.link_id, s.token INTO lnk, tok FROM public.proposal_send(prop, 14) s;
  IF lnk IS NULL OR char_length(tok) <> 64 THEN RAISE EXCEPTION 'send donusu: link=% token_len=%', lnk, char_length(tok); END IF;
  BEGIN
    UPDATE public.proposal_items SET unit_client_price = 1 WHERE id = item1;
    RAISE EXCEPTION 'dondurulmus kalem degisti';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    UPDATE public.proposal_versions SET tax_rate = 0.1 WHERE id = v1;
    RAISE EXCEPTION 'dondurulmus surum tax_rate degisti';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.internal_proposal_item_upsert(item1, 1, NULL);
    RAISE EXCEPTION 'dondurulmus ic kalem degisti';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  v2 := public.proposal_new_version(prop);
  EXECUTE 'RESET ROLE';
  SELECT * INTO r FROM public.proposals WHERE id = prop;
  IF r.status <> 'draft' OR r.current_version_id <> v2 THEN RAISE EXCEPTION 'yeni surum sonrasi teklif: %', r; END IF;
  SELECT * INTO r FROM public.proposal_versions WHERE id = v2;
  IF r.version_no <> 2 OR r.sent_at IS NOT NULL OR r.subtotal <> 9500 OR r.total_amount <> 11400 THEN RAISE EXCEPTION 'surum 2: %', r; END IF;
  SELECT count(*) INTO n FROM public.proposal_items i JOIN internal.proposal_internal_items x ON x.proposal_item_id = i.id
   WHERE i.proposal_version_id = v2 AND x.internal_cost = 6500;
  IF n <> 1 THEN RAISE EXCEPTION 'surum 2 kalem/ic kalem kopyasi eksik (%)', n; END IF;
  SELECT * INTO r FROM public.proposal_versions WHERE id = v1;
  IF r.sent_at IS NULL OR r.valid_until IS NULL OR r.valid_until < now() + interval '13 days' THEN RAISE EXCEPTION 'surum 1 sent_at/valid_until: %', r; END IF;
  SELECT count(*) INTO n FROM public.portal_access_links WHERE resource_id = prop AND revoked_at IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'aktif baglanti % (1)', n; END IF;

  -- 21e) yetki: pro1 (crew_coordinator) teklif gormez, acamaz; token_hash sutunu owner'a bile kapali; anon 42501
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.proposals WHERE id = prop;
  BEGIN
    PERFORM public.proposal_create(org_a, 'x', NULL, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'crew_coordinator teklif acti';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'crew_coordinator teklifi gordu'; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.portal_access_links WHERE resource_id = prop;
  BEGIN
    EXECUTE 'SELECT token_hash FROM public.portal_access_links LIMIT 1';
    RAISE EXCEPTION 'token_hash okunabildi';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'owner baglanti satirlarini goremedi (%)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO n FROM public.proposals;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon teklif okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 21f) taslak silme (7a-DB/02): hic gonderilmemis bos taslak owner tarafindan silinir; gonderilmis teklif silinemez (0 satir)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'proposals' AND policyname = 'proposals_delete') THEN
    PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v2 := public.proposal_create(org_a, 'T21 bos taslak', NULL, NULL, NULL, NULL, NULL);
    DELETE FROM public.proposals WHERE id = v2;
    DELETE FROM public.proposals WHERE id = prop;      -- gonderilmis: RLS 0 satir
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO n FROM public.proposals WHERE id IN (v2, prop);
    IF n <> 1 THEN RAISE EXCEPTION 'taslak silme: kalan % (1 beklenir: gonderilmis teklif durur, bos taslak gider)', n; END IF;
    st := '; taslak silme OK (gonderilmis silinmedi)';
  ELSE
    st := '; taslak silme ATLANDI (7a-DB/02 yok)';
  END IF;

  INSERT INTO t_sonuc VALUES (21, 'T21 FAZ 7a teklif', 'GECTI',
    'ekipten teklif: 1 kalem 9000 + ic 6000, toplam 9000/1800/10800; sales fiyat 9500 -> 9500/1900/11400, gizli kalem toplama girmedi, ic liste 42501, status/INSERT 42501, tax 0.10 -> 950/10450; finance marj 0.3684, maliyet 6500; send: token 64, surum dondu (kalem/tax/ic 22023), yeni surum 2 kopyali; crew_coordinator 0 satir + 42501; token_hash kapali; anon 42501' || st);
EXCEPTION WHEN OTHERS THEN
  BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO t_sonuc VALUES (21, 'T21 FAZ 7a teklif', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T22) FAZ 7a musteri portali (anon RPC'ler). ON KOSUL: faz7a 01 dalda. T21 verisine dayanir (T21 teklif: v1 gonderildi, v2 taslak).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  org_a uuid; prop uuid; prop2 uuid; lnk uuid; tok text; tok2 text; tok3 text; lnk3 uuid; j jsonb; n int; r record; st text; v uuid;
BEGIN
  IF to_regprocedure('public.portal_proposal_view(text)') IS NULL THEN
    INSERT INTO t_sonuc VALUES (22, 'T22 FAZ 7a portal', 'ATLANDI', 'faz7a_01 dalda uygulanmamis');
    RETURN;
  END IF;
  SELECT id INTO org_a FROM public.organizations WHERE legacy_profile_id = ajans;
  SELECT id INTO prop FROM public.proposals WHERE seller_organization_id = org_a AND title = 'T21 teklif';
  IF prop IS NULL THEN RAISE EXCEPTION 'T21 teklifi yok'; END IF;
  -- T21'in ham jetonu bu blokta yok: yeni bir teklif acip gonderelim (prop2), T21 teklifini ise yeniden gondererek jeton alalim
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT s.token INTO tok FROM public.proposal_send(prop, 10) s;      -- v2 taslagi gonderilir -> v2 dondu, eski link iptal
  prop2 := public.proposal_create(org_a, 'T22 revizyon', NULL, NULL, 'Ikinci Musteri', 'faz1test+ikinci@kashe.net');
  SELECT current_version_id INTO v FROM public.proposals WHERE id = prop2;
  BEGIN
    PERFORM public.proposal_send(prop2, 14);
    RAISE EXCEPTION 'kalemsiz teklif gonderildi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  INSERT INTO public.proposal_items (proposal_version_id, description, quantity, unit_client_price, sort_order) VALUES (v, 'T22 hizmet', 2, 1000, 1);
  INSERT INTO public.proposal_items (proposal_version_id, description, quantity, unit_client_price, sort_order) VALUES (v, 'T22 fiyatsiz', 1, 0, 2);
  BEGIN
    PERFORM public.proposal_send(prop2, 14);
    RAISE EXCEPTION 'fiyatsiz kalemle gonderildi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  DELETE FROM public.proposal_items WHERE proposal_version_id = v AND description = 'T22 fiyatsiz';
  SELECT s.token INTO tok2 FROM public.proposal_send(prop2, 14) s;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- 22a) anon goruntuleme: alanlar, kimlik yok, sayac, sent -> viewed; yanlis jeton
  EXECUTE 'SET LOCAL ROLE anon';
  j := public.portal_proposal_view(tok);
  EXECUTE 'RESET ROLE';
  IF (j->>'version_no')::int <> 2 OR (j->>'status') <> 'viewed' OR jsonb_array_length(j->'items') <> 1 OR (j->>'total_amount')::numeric <> 11400
     OR (j->>'seller_name') IS NULL OR j ? 'seller_organization_id' OR j ? 'created_by' THEN
    RAISE EXCEPTION 'portal view: %', j; END IF;
  SELECT view_count INTO n FROM public.portal_access_links WHERE resource_id = prop AND revoked_at IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'view_count % (1)', n; END IF;
  SELECT status::text INTO st FROM public.proposals WHERE id = prop;
  IF st <> 'viewed' THEN RAISE EXCEPTION 'durum % (viewed)', st; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    j := public.portal_proposal_view(repeat('a', 64));
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'yanlis jeton kabul edildi';
  EXCEPTION WHEN no_data_found THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    j := public.portal_proposal_view('kisa');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'kisa jeton kabul edildi';
  EXCEPTION WHEN no_data_found THEN EXECUTE 'RESET ROLE'; END;

  -- 22b) onay: kisa ad 22023; onay -> approved + ad; ikinci onay 22023; onaylanmis teklifte yeni surum 22023
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.portal_proposal_approve(tok, 'A');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'kisa adla onaylandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM public.portal_proposal_approve(tok, 'Ad Soyad');
  EXECUTE 'RESET ROLE';
  SELECT p.status::text || '/' || COALESCE(pv.approved_by_name, '-') INTO st
    FROM public.proposals p JOIN public.proposal_versions pv ON pv.id = p.current_version_id WHERE p.id = prop;
  IF st <> 'approved/Ad Soyad' THEN RAISE EXCEPTION 'onay sonrasi % (approved/Ad Soyad)', st; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.portal_proposal_approve(tok, 'Ad Soyad');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'ikinci onay gecti';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.proposal_new_version(prop);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'onaylanmis teklifte yeni surum acildi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- 22c) revizyon: view -> request_revision -> owner yeni surum -> send -> eski jeton iptal, yeni jeton surum 2
  EXECUTE 'SET LOCAL ROLE anon';
  j := public.portal_proposal_view(tok2);
  PERFORM public.portal_proposal_request_revision(tok2, 'Daha uygun fiyat rica ederiz');
  EXECUTE 'RESET ROLE';
  SELECT p.status::text || '/' || COALESCE(pv.client_note, '-') INTO st
    FROM public.proposals p JOIN public.proposal_versions pv ON pv.id = p.current_version_id WHERE p.id = prop2;
  IF st <> 'revision_requested/Daha uygun fiyat rica ederiz' THEN RAISE EXCEPTION 'revizyon sonrasi %', st; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v := public.proposal_new_version(prop2);
  UPDATE public.proposal_items SET unit_client_price = 900 WHERE proposal_version_id = v;
  SELECT s.link_id, s.token INTO lnk3, tok3 FROM public.proposal_send(prop2, 5) s;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    j := public.portal_proposal_view(tok2);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'iptal edilmis jeton calisti';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE anon';
  j := public.portal_proposal_view(tok3);
  EXECUTE 'RESET ROLE';
  IF (j->>'version_no')::int <> 2 OR (j->>'subtotal')::numeric <> 1800 OR (j->>'total_amount')::numeric <> 2160 THEN
    RAISE EXCEPTION 'surum 2 portal: %', j; END IF;

  -- 22d) max_views, suresi dolmus surum -> expired, onay 22023; satici declined -> baglantilar iptal
  UPDATE public.portal_access_links SET max_views = 1 WHERE id = lnk3;   -- superuser (test)
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    j := public.portal_proposal_view(tok3);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'max_views asildi ama goruntulendi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  UPDATE public.portal_access_links SET max_views = NULL WHERE id = lnk3;
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  UPDATE public.proposal_versions SET valid_until = now() - interval '1 hour' WHERE id = v;   -- superuser + bayrak (test)
  PERFORM set_config('kashe.faz7_rpc', '0', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.portal_proposal_approve(tok3, 'Gec Kalan');     -- view'dan once: gecerlilik kontrolu
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'suresi dolmus teklif onaylandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE anon';
  j := public.portal_proposal_view(tok3);                           -- goruntuleme expired isaretler
  EXECUTE 'RESET ROLE';
  IF (j->>'status') <> 'expired' THEN RAISE EXCEPTION 'portal durum % (expired)', j->>'status'; END IF;
  SELECT status::text INTO st FROM public.proposals WHERE id = prop2;
  IF st <> 'expired' THEN RAISE EXCEPTION 'durum % (expired)', st; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.portal_proposal_approve(tok3, 'Gec Kalan');     -- expired durumda onay yok
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'expired teklif onaylandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.proposal_set_status(prop2, 'declined');
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT count(*) INTO n FROM public.portal_access_links WHERE resource_id = prop2 AND revoked_at IS NULL;
  SELECT status::text INTO st FROM public.proposals WHERE id = prop2;
  IF n <> 0 OR st <> 'declined' THEN RAISE EXCEPTION 'declined sonrasi aktif link=% durum=%', n, st; END IF;

  INSERT INTO t_sonuc VALUES (22, 'T22 FAZ 7a portal', 'GECTI',
    'anon view: surum 2 alanlari, kimlik yok, sayac 1, viewed; yanlis/kisa jeton P0002; onay (kisa ad 22023) -> approved + ad, ikinci onay 22023, onayli teklifte yeni surum 22023; revizyon -> client_note -> yeni surum + send -> eski jeton iptal, yeni jeton surum 2 (1800/2160); max_views; suresi dolmus -> expired, onay 22023; declined -> linkler iptal');
EXCEPTION WHEN OTHERS THEN
  BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO t_sonuc VALUES (22, 'T22 FAZ 7a portal', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T23) FAZ 7c onayli tekliften rezervasyon. ON KOSUL: 20261008120000 (faz7c 01) dalda. T21/T22 verisine dayanir
--      ("T21 teklif": approved, surum 2 "Ad Soyad", event_id = T20 etkinligi; "T22 revizyon": declined). Roller: ajans owner
--      (proposals.manage), uye (0006) finance (proposals.view), pro1 crew_coordinator (proposals.* YOK), pro2 (0003) kurulusa yabanci.
--      Eski akis kaniti: T2 (quote kabul -> booking) ayni kosuda GECTI olmali (tetikleyici dokunulmadi).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  pro2    uuid := 'a0000000-0000-4000-8000-000000000003';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  uye     uuid := 'a0000000-0000-4000-8000-000000000006';
  org_a uuid; prop uuid; prop2 uuid; prop3 uuid; v uuid; v3 uuid; b1 uuid; b2 uuid; b3 uuid; n int; r record; ev record; tok text; j jsonb; st text;
BEGIN
  IF to_regprocedure('public.booking_from_proposal(uuid)') IS NULL THEN
    INSERT INTO t_sonuc VALUES (23, 'T23 FAZ 7c rezervasyon', 'ATLANDI', 'booking_from_proposal yok; faz7c_01 dalda uygulanmamis');
    RETURN;
  END IF;
  SELECT id INTO org_a FROM public.organizations WHERE legacy_profile_id = ajans;
  SELECT id, current_version_id INTO prop, v FROM public.proposals WHERE seller_organization_id = org_a AND title = 'T21 teklif';
  SELECT id INTO prop2 FROM public.proposals WHERE seller_organization_id = org_a AND title = 'T22 revizyon';
  IF org_a IS NULL OR prop IS NULL OR prop2 IS NULL THEN RAISE EXCEPTION 'on kosul: org_a=% prop=% prop2=% (T21/T22 kosmali)', org_a, prop, prop2; END IF;
  SELECT status::text INTO st FROM public.proposals WHERE id = prop;
  IF st <> 'approved' THEN RAISE EXCEPTION 'on kosul: T21 teklif durumu % (approved beklenir)', st; END IF;

  -- 23a) yetkisiz: pro1 (crew_coordinator) 42501; yabanci pro2 42501; anon 42501 (EXECUTE yok)
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.booking_from_proposal(prop);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'crew_coordinator rezervasyon acti';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', pro2::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.booking_from_proposal(prop);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'yabanci kullanici rezervasyon acti';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.booking_from_proposal(prop);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon rezervasyon acti';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 23b) owner: onayli teklif -> tek rezervasyon; teklif sekli; etkinlikten tarih/sehir/katilimci; total = surum KDV dahil
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  b1 := public.booking_from_proposal(prop);
  b2 := public.booking_from_proposal(prop);                       -- idempotan: ayni id
  EXECUTE 'RESET ROLE';
  IF b1 IS NULL OR b1 <> b2 THEN RAISE EXCEPTION 'idempotanlik: % / %', b1, b2; END IF;
  SELECT count(*) INTO n FROM public.bookings WHERE proposal_version_id = v;
  IF n <> 1 THEN RAISE EXCEPTION 'surum basina rezervasyon % (1)', n; END IF;
  SELECT b.*, pv.total_amount AS v_total, p.seller_provider_id AS p_seller, p.event_id AS p_event INTO r
    FROM public.bookings b JOIN public.proposal_versions pv ON pv.id = b.proposal_version_id JOIN public.proposals p ON p.id = pv.proposal_id
   WHERE b.id = b1;
  IF r.quote_id IS NOT NULL OR r.conversation_id IS NOT NULL OR r.customer_id IS NOT NULL OR r.professional_id IS NOT NULL THEN
    RAISE EXCEPTION 'teklif seklinde eski sutunlar dolu: %', r; END IF;
  IF r.seller_provider_id <> r.p_seller OR r.event_id IS DISTINCT FROM r.p_event OR r.status::text <> 'confirmed'
     OR r.total_amount <> r.v_total OR r.total_amount <> 11400 OR r.currency <> 'TRY' OR r.platform_fee <> 0 OR r.crew_member_id IS NOT NULL THEN
    RAISE EXCEPTION 'rezervasyon alanlari: %', r; END IF;
  SELECT * INTO ev FROM public.events WHERE id = r.event_id;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'T21 teklifinin etkinligi yok (T20 ekibi etkinlige bagli olmali)'; END IF;
  IF r.event_date IS DISTINCT FROM ev.start_date OR r.guest_count IS DISTINCT FROM ev.participant_count
     OR r.event_type IS DISTINCT FROM ev.event_type OR (ev.city_id IS NOT NULL AND r.location IS NULL) THEN
    RAISE EXCEPTION 'etkinlik alanlari tasinmadi: date=%/% guest=%/% type=%/% loc=%', r.event_date, ev.start_date, r.guest_count, ev.participant_count, r.event_type, ev.event_type, r.location; END IF;
  SELECT count(*) INTO n FROM internal.access_audit WHERE target_table = 'bookings' AND target_id = b1 AND detail->>'op' = 'booking.from_proposal';
  IF n <> 1 THEN RAISE EXCEPTION 'denetim satiri % (1)', n; END IF;

  -- 23c) onayli olmayan teklif 22023 (declined)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.booking_from_proposal(prop2);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'declined tekliften rezervasyon acildi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;

  -- 23d) RLS: owner ve finance (proposals.view) gorur; crew_coordinator 0; yabanci 0; anon 0 satir (SELECT yetkisi var, politika yok)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.bookings WHERE id = b1;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'owner rezervasyonu gormedi'; END IF;
  PERFORM set_config('request.jwt.claim.sub', uye::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.bookings WHERE id = b1;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'finance rezervasyonu gormedi'; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.bookings WHERE id = b1;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'crew_coordinator rezervasyonu gordu'; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro2::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.bookings WHERE id = b1;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'yabanci rezervasyonu gordu'; END IF;
  -- anon: SELECT yetkisi eskiden beri var; eski politika is_agency_member()'i cagirir ve anon'da EXECUTE yoktur -> 42501
  -- (eski davranis, 7c degistirmez); 42501 ya da 0 satir kabul, satir gormek HATA
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO n FROM public.bookings WHERE id = b1;
    EXECUTE 'RESET ROLE';
    IF n <> 0 THEN RAISE EXCEPTION 'anon rezervasyon gordu'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 23e) yetki: authenticated dogrudan INSERT 42501; finance (manage yok) UPDATE 0 satir; owner total_amount 42501 (sutun yetkisi yok);
  --      owner status -> cancelled gecer (sutun yetkisi + kurulus politikasi)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.bookings (proposal_version_id, seller_provider_id, total_amount, status) VALUES (v, r.seller_provider_id, 1, 'confirmed');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'authenticated dogrudan rezervasyon yazdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.bookings SET total_amount = 1 WHERE id = b1;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'owner total_amount degistirdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', uye::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.bookings SET status = 'cancelled', cancelled_at = now() WHERE id = b1;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'finance (manage yok) rezervasyonu iptal etti'; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.bookings SET status = 'cancelled', cancelled_at = now(), cancelled_by = ajans, cancellation_reason = 'T23 test' WHERE id = b1;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'owner iptal edemedi (satir %)', n; END IF;

  -- 23f) portalda has_booking: yeni teklif -> gonder -> anon onay -> has_booking false -> rezervasyon -> true; misafir (customer_id NULL)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  prop3 := public.proposal_create(org_a, 'T23 rezervasyon', NULL, NULL, 'Rez Musteri', 'faz1test+rez@kashe.net');
  SELECT current_version_id INTO v3 FROM public.proposals WHERE id = prop3;
  INSERT INTO public.proposal_items (proposal_version_id, description, quantity, unit_client_price, sort_order) VALUES (v3, 'T23 hizmet', 1, 2000, 1);
  SELECT s.token INTO tok FROM public.proposal_send(prop3, 14) s;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM public.portal_proposal_approve(tok, 'Rez Musteri');
  j := public.portal_proposal_view(tok);
  EXECUTE 'RESET ROLE';
  IF (j->>'status') <> 'approved' OR (j->>'has_booking')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'portal onay sonrasi: %', j; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  b3 := public.booking_from_proposal(prop3);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'SET LOCAL ROLE anon';
  j := public.portal_proposal_view(tok);
  EXECUTE 'RESET ROLE';
  IF (j->>'has_booking')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'portal has_booking true degil: %', j; END IF;
  SELECT * INTO r FROM public.bookings WHERE id = b3;
  IF r.customer_id IS NOT NULL OR r.event_id IS NOT NULL OR r.event_date IS NOT NULL OR r.total_amount <> 2400 THEN
    RAISE EXCEPTION 'misafir/etkinliksiz rezervasyon: %', r; END IF;

  -- 23g) eski sekil korunur: T2'nin quote rezervasyonu dort eski sutunla duruyor; sekil kisiti bos satiri reddeder
  SELECT count(*) INTO n FROM public.bookings b WHERE b.quote_id IS NOT NULL
     AND (b.conversation_id IS NULL OR b.customer_id IS NULL OR b.professional_id IS NULL);
  IF n <> 0 THEN RAISE EXCEPTION 'eski sekilde eksik sutun: %', n; END IF;
  BEGIN
    INSERT INTO public.bookings (total_amount, status) VALUES (1, 'confirmed');   -- superuser: yalniz CHECK test edilir
    RAISE EXCEPTION 'sekil kisiti sekilsiz satiri kabul etti';
  EXCEPTION WHEN check_violation THEN NULL; END;

  INSERT INTO t_sonuc VALUES (23, 'T23 FAZ 7c rezervasyon', 'GECTI',
    'yetkisiz 42501 (crew_coordinator, yabanci, anon); owner: tek satir/surum, idempotan, teklif sekli (eski sutunlar NULL), etkinlikten tarih/sehir/katilimci, total 11400 KDV dahil, confirmed, denetim; declined 22023; RLS owner+finance 1 / crew_coordinator+yabanci 0 / anon 0 ya da 42501 (eski politika); INSERT 42501, total_amount 42501, finance iptal 0 satir, owner iptal 1; portal has_booking false->true, misafir customer_id NULL, 2400; eski sekil korunur, sekilsiz satir 23514');
EXCEPTION WHEN OTHERS THEN
  BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO t_sonuc VALUES (23, 'T23 FAZ 7c rezervasyon', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T24) FAZ 7b RFP (teklif talebi). ON KOSUL: 20261009120000 (faz7b 01) dalda. T8 (Test Kurum kurulusu, owner 0005), T21-T23 (Test Ajans
--      kurulusu: owner 0004, sales 0001, crew_coordinator 0002, viewer 0003, finance 0006) verisine dayanir. Ikinci ajans (0007, "Test Ajans
--      Iki") bu testte auth.users ile acilir (T0 temizligi ids listesinde). Etkinlik kurum adina superuser ile acilir (kurulum; davranis degil).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  pro2    uuid := 'a0000000-0000-4000-8000-000000000003';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  kurum   uuid := 'a0000000-0000-4000-8000-000000000005';
  ajans2  uuid := 'a0000000-0000-4000-8000-000000000007';
  org_k uuid; org_a uuid; org_b uuid; prov_a uuid; prov_b uuid; ev uuid; rfp uuid; rfp2 uuid; inv_a uuid; inv_b uuid; prop_a uuid; prop_b uuid;
  v uuid; v2 uuid; b_id uuid; n int; n2 int; r record; j jsonb; st text; lnk uuid; tok text; rol int[];
BEGIN
  IF to_regprocedure('public.rfp_create(uuid,uuid,text,text,timestamptz)') IS NULL THEN
    INSERT INTO t_sonuc VALUES (24, 'T24 FAZ 7b RFP', 'ATLANDI', 'rfp_create yok; faz7b_01 dalda uygulanmamis');
    RETURN;
  END IF;
  SELECT id INTO org_k FROM public.organizations WHERE legacy_profile_id = kurum;
  SELECT id INTO org_a FROM public.organizations WHERE legacy_profile_id = ajans;
  SELECT id INTO prov_a FROM public.providers WHERE organization_id = org_a AND provider_type = 'organization';
  IF org_k IS NULL OR org_a IS NULL OR prov_a IS NULL THEN RAISE EXCEPTION 'on kosul: org_k=% org_a=% prov_a=%', org_k, org_a, prov_a; END IF;
  -- kurulum: 3 test rolu (kategori -> rol otomatik dogar; FAZ 3a). Dal yalniz test verisi tasir, legacy rol olmayabilir; T0 'faz1test-%' siler.
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active) VALUES ('faz1test-rfp-a', 'Faz1 Test RFP A', 'A', 981, true);
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active) VALUES ('faz1test-rfp-b', 'Faz1 Test RFP B', 'B', 982, true);
  INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active) VALUES ('faz1test-rfp-c', 'Faz1 Test RFP C', 'C', 983, true);
  SELECT array_agg(id ORDER BY slug) INTO rol FROM public.service_roles WHERE slug IN ('faz1test-rfp-a', 'faz1test-rfp-b', 'faz1test-rfp-c');
  IF rol IS NULL OR array_length(rol, 1) <> 3 THEN RAISE EXCEPTION 'on kosul: test rolleri dogmadi (bulunan %)', COALESCE(array_length(rol, 1), 0); END IF;

  -- kurulum: ikinci ajans (0007) -> kurulus + organization saglayicisi otomatik (FAZ 0 / 2a)
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES ('00000000-0000-0000-0000-000000000000', ajans2, 'authenticated', 'authenticated',
          'faz1test+ajans2@kashe.net', extensions.crypt('Faz1Test!2026', extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          '{"role":"agency","full_name":"Test Ajans Iki Sahibi","company_name":"Test Ajans Iki"}'::jsonb, now(), now(), '', '', '', '');
  SELECT id INTO org_b FROM public.organizations WHERE legacy_profile_id = ajans2;
  SELECT id INTO prov_b FROM public.providers WHERE organization_id = org_b AND provider_type = 'organization';
  IF org_b IS NULL OR prov_b IS NULL THEN RAISE EXCEPTION 'ikinci ajans kurulusu/saglayicisi olusmadi: org_b=% prov_b=%', org_b, prov_b; END IF;
  -- kurulum: kurumun etkinligi + 2 gereksinim (butce ipucu dahil)
  INSERT INTO public.events (organization_id, owner_user_id, title, event_type, start_date, end_date, city_id, participant_count, status)
  VALUES (org_k, kurum, 'T24 lansman', 'launch', current_date + 45, current_date + 45, (SELECT id FROM public.turkish_cities ORDER BY id LIMIT 1), 100, 'confirmed')
  RETURNING id INTO ev;
  INSERT INTO public.event_requirements (event_id, role_id, quantity, is_required, budget_hint_min, budget_hint_max, sort_order) VALUES (ev, rol[1], 1, true, 10000, 15000, 1);
  INSERT INTO public.event_requirements (event_id, role_id, quantity, is_required, sort_order) VALUES (ev, rol[2], 2, false, 2);

  -- 24a) rfp_create: kurum owner acar (kalemler gereksinimlerden, ipucu dahil); pro1 42501; baska kurulusun etkinligi 22023; kisa baslik 22023
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.rfp_create(org_k, ev, 'T24 RFP');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'uye olmayan RFP acti';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.rfp_create(org_a, ev, 'T24 RFP');                       -- etkinlik kurumun, org_a degil
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'baska kurulusun etkinligiyle RFP acildi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.rfp_create(org_k, ev, 'X');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'kisa baslikla RFP acildi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  rfp := public.rfp_create(org_k, ev, 'T24 RFP', 'Lansman icin ekip', now() + interval '7 days');
  EXECUTE 'RESET ROLE';
  SELECT * INTO r FROM public.rfps WHERE id = rfp;
  IF r.status <> 'draft' OR r.organization_id <> org_k OR r.event_id <> ev OR r.created_by <> kurum THEN RAISE EXCEPTION 'rfp satiri: %', r; END IF;
  SELECT count(*), count(*) FILTER (WHERE budget_hint_min = 10000 AND budget_hint_max = 15000 AND is_required) INTO n, n2 FROM public.rfp_items WHERE rfp_id = rfp;
  IF n <> 2 OR n2 <> 1 THEN RAISE EXCEPTION 'kalemler gereksinimden kopyalanmadi: %/%', n, n2; END IF;

  -- 24b) taslak duzenleme: kurum baslik/son tarih gunceller, kalem ekler (RLS + sutun yetkisi); butce sutunu SELECT 42501; durum dogrudan 42501;
  --      rfp_detail (alici) ipucu TASIR
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.rfps SET title = 'T24 RFP lansman', deadline = now() + interval '10 days' WHERE id = rfp;
  INSERT INTO public.rfp_items (rfp_id, role_id, quantity, is_required, budget_hint_min, budget_hint_max, sort_order) VALUES (rfp, rol[3], 1, false, 2000, 4000, 3);
  BEGIN
    PERFORM budget_hint_min FROM public.rfp_items WHERE rfp_id = rfp;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'butce ipucu sutunu okundu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.rfps SET status = 'sent' WHERE id = rfp;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'durum dogrudan degisti';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  j := public.rfp_detail(rfp);
  EXECUTE 'RESET ROLE';
  IF (j->>'title') <> 'T24 RFP lansman' OR jsonb_array_length(j->'items') <> 3 OR NOT (j->'items'->0 ? 'budget_hint_min') OR (j->>'is_buyer')::boolean IS NOT TRUE
     OR (j->'event'->>'title') <> 'T24 lansman' THEN RAISE EXCEPTION 'rfp_detail (alici): %', j; END IF;

  -- 24c) davet: davetsiz gonderim 22023; iki ajans davet (ikinci cagri ayni id); profesyonel saglayici 22023; gonderim -> sent + bildirimler
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.rfp_send(rfp);
    RAISE EXCEPTION 'davetsiz gonderildi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  inv_a := public.rfp_invite(rfp, prov_a);
  inv_b := public.rfp_invite(rfp, prov_b);
  IF public.rfp_invite(rfp, prov_a) <> inv_a THEN RAISE EXCEPTION 'tekrar davet yeni satir acti'; END IF;
  BEGIN
    PERFORM public.rfp_invite(rfp, pro1);                                 -- profesyonel saglayici (id = profil id)
    RAISE EXCEPTION 'profesyonel davet edildi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  PERFORM public.rfp_send(rfp);
  EXECUTE 'RESET ROLE';
  SELECT status::text INTO st FROM public.rfps WHERE id = rfp;
  IF st <> 'sent' THEN RAISE EXCEPTION 'gonderim sonrasi durum % (sent)', st; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'rfp' AND user_id IN (ajans, musteri) AND link = '/ajans/rfp/' || rfp::text;
  IF n <> 2 THEN RAISE EXCEPTION 'ajans bildirimleri % (2: owner + sales)', n; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'rfp' AND user_id IN (pro1, pro2);
  IF n <> 0 THEN RAISE EXCEPTION 'yetkisiz uyeye bildirim gitti'; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'rfp' AND user_id = ajans2;
  IF n <> 1 THEN RAISE EXCEPTION 'ikinci ajans bildirimi % (1)', n; END IF;
  -- gonderilmis taslak duzenlenemez (RLS gecer, tetikleyici 22023)
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.rfps SET title = 'degisti' WHERE id = rfp;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'gonderilmis RFP duzenlendi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;

  -- 24d) satici gorunurlugu: musteri (org_a sales, proposals.view; admin DEGIL — ajans 0004 onceki testlerde is_admin) 1 satir, ipucu yok,
  --      my_invite sent -> viewed; pro2 (viewer, proposals.view yok) 0; dogrudan INSERT 42501
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.rfps WHERE id = rfp;
  j := public.rfp_detail(rfp);
  PERFORM public.rfp_mark_viewed(rfp);
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'davetli ajans RFP gormedi'; END IF;
  IF (j->'items'->0 ? 'budget_hint_min') OR (j ? 'invites') OR (j->'my_invite'->>'status') <> 'sent' OR (j->>'is_buyer')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'rfp_detail (satici): %', j; END IF;
  SELECT status::text INTO st FROM public.rfp_invites WHERE id = inv_a;
  IF st <> 'viewed' THEN RAISE EXCEPTION 'goruntuleme isareti % (viewed)', st; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro2::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.rfps WHERE id = rfp;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'viewer RFP gordu'; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.rfps (organization_id, event_id, title) VALUES (org_a, ev, 'kacak');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'dogrudan rfps INSERT gecti';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 24e) yanit: ajans proposal_create_from_rfp (rfp_id, rfp_response, alici kurulus, 3 kalem fiyatsiz; ikinci cagri ayni id);
  --      gizli kalem + fiyatlar; proposal_send -> baglanti YOK, davet responded, RFP collecting, kurum bildirimi
  EXECUTE 'SET LOCAL ROLE authenticated';
  prop_a := public.proposal_create_from_rfp(rfp, org_a);
  IF public.proposal_create_from_rfp(rfp, org_a) <> prop_a THEN RAISE EXCEPTION 'ikinci yanit acildi'; END IF;
  EXECUTE 'RESET ROLE';
  SELECT * INTO r FROM public.proposals WHERE id = prop_a;
  IF r.rfp_id <> rfp OR r.source_type::text <> 'rfp_response' OR r.buyer_organization_id <> org_k OR r.event_id <> ev OR r.status <> 'draft' THEN
    RAISE EXCEPTION 'yanit teklifi: %', r; END IF;
  v := r.current_version_id;
  SELECT count(*), count(*) FILTER (WHERE unit_client_price = 0) INTO n, n2 FROM public.proposal_items WHERE proposal_version_id = v;
  IF n <> 3 OR n2 <> 3 THEN RAISE EXCEPTION 'yanit kalemleri %/% (3/3)', n, n2; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.proposal_items SET unit_client_price = 12000 WHERE proposal_version_id = v AND role_id = rol[1];
  UPDATE public.proposal_items SET unit_client_price = 5000 WHERE proposal_version_id = v AND role_id = rol[2];
  UPDATE public.proposal_items SET unit_client_price = 3000 WHERE proposal_version_id = v AND role_id = rol[3];
  INSERT INTO public.proposal_items (proposal_version_id, description, quantity, unit_client_price, is_visible_to_client, sort_order) VALUES (v, 'T24 gizli', 1, 1, false, 9);
  SELECT s.link_id, s.token INTO lnk, tok FROM public.proposal_send(prop_a, 14) s;
  EXECUTE 'RESET ROLE';
  IF lnk IS NOT NULL OR tok IS NOT NULL THEN RAISE EXCEPTION 'RFP yanitina portal baglantisi acildi'; END IF;
  SELECT count(*) INTO n FROM public.portal_access_links WHERE resource_id = prop_a;
  IF n <> 0 THEN RAISE EXCEPTION 'portal_access_links satiri var (%)', n; END IF;
  SELECT status::text || '/' || COALESCE(proposal_id::text, '-') INTO st FROM public.rfp_invites WHERE id = inv_a;
  IF st <> 'responded/' || prop_a::text THEN RAISE EXCEPTION 'davet durumu % (responded/prop)', st; END IF;
  SELECT status::text INTO st FROM public.rfps WHERE id = rfp;
  IF st <> 'collecting' THEN RAISE EXCEPTION 'yanit sonrasi RFP % (collecting)', st; END IF;
  SELECT total_amount INTO n FROM public.proposal_versions WHERE id = v;        -- 12000 + 2*5000 + 3000 = 25000 (+KDV 5000)
  IF n <> 30000 THEN RAISE EXCEPTION 'yanit toplami % (30000)', n; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'rfp' AND user_id = kurum AND link = '/kurumsal/rfp/' || rfp::text;
  IF n <> 1 THEN RAISE EXCEPTION 'kurum bildirimi % (1)', n; END IF;

  -- 24f) alici okur: kurum teklifi, gonderilmis surumu ve YALNIZ gorunur kalemleri gorur; sales (musteri, org_a) 4 kalem; ic kalem RPC kurum 42501
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.proposals WHERE id = prop_a;
  IF n <> 1 THEN EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'alici kurulus teklifi gormedi'; END IF;
  SELECT count(*) INTO n FROM public.proposal_items WHERE proposal_version_id = v;
  IF n <> 3 THEN EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'alici % kalem gordu (3; gizli haric)', n; END IF;
  BEGIN
    PERFORM public.internal_proposal_items_list(v);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'alici ic kalemleri gordu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.proposal_items WHERE proposal_version_id = v;
  EXECUTE 'RESET ROLE';
  IF n <> 4 THEN RAISE EXCEPTION 'sales % kalem gordu (4)', n; END IF;

  -- 24g) revizyon: kurum rfp_request_revision -> revision_requested + not + ajans bildirimi; ajans yeni surum (kurum taslak surumu GORMEZ) -> fiyat -> send -> kurum 2 surum
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.rfp_request_revision(prop_a, 'DJ fiyati yuksek');
  EXECUTE 'RESET ROLE';
  SELECT p.status::text || '/' || COALESCE(pv.client_note, '-') INTO st FROM public.proposals p JOIN public.proposal_versions pv ON pv.id = p.current_version_id WHERE p.id = prop_a;
  IF st <> 'revision_requested/DJ fiyati yuksek' THEN RAISE EXCEPTION 'revizyon sonrasi %', st; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'rfp' AND user_id = ajans AND link = '/ajans/teklifler/' || prop_a::text;
  IF n <> 1 THEN RAISE EXCEPTION 'revizyon bildirimi % (1)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v2 := public.proposal_new_version(prop_a);
  UPDATE public.proposal_items SET unit_client_price = 9000 WHERE proposal_version_id = v2 AND role_id = rol[1];
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.proposal_versions WHERE proposal_id = prop_a;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'alici taslak surumu gordu (% surum; 1)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.proposal_send(prop_a, 14);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.proposal_versions WHERE proposal_id = prop_a;
  EXECUTE 'RESET ROLE';
  IF n <> 2 THEN RAISE EXCEPTION 'alici % surum gordu (2)', n; END IF;

  -- 24h) ikinci ajans yanitlar (20000 + KDV)
  PERFORM set_config('request.jwt.claim.sub', ajans2::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  prop_b := public.proposal_create_from_rfp(rfp, org_b);
  SELECT current_version_id INTO v FROM public.proposals WHERE id = prop_b;
  UPDATE public.proposal_items SET unit_client_price = 10000 WHERE proposal_version_id = v AND role_id = rol[1];
  UPDATE public.proposal_items SET unit_client_price = 4000 WHERE proposal_version_id = v AND role_id = rol[2];
  UPDATE public.proposal_items SET unit_client_price = 2000 WHERE proposal_version_id = v AND role_id = rol[3];
  PERFORM public.proposal_send(prop_b, 14);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  j := public.rfp_detail(rfp);
  EXECUTE 'RESET ROLE';
  IF jsonb_array_length(j->'invites') <> 2 OR (SELECT count(*) FROM jsonb_array_elements(j->'invites') x WHERE x->>'status' = 'responded' AND (x->>'total_amount')::numeric IN (26400, 24000)) <> 2 THEN
    RAISE EXCEPTION 'rfp_detail davetler/yanit ozetleri: %', j->'invites'; END IF;   -- ajans v2: 9000+10000+3000 = 22000 -> 26400; ajans2: 20000 -> 24000

  -- 24i) secim: pro1 42501; kurum rfp_award(prop_a) -> approved (onaylayan ad), rfp awarded, ajans2 daveti not_selected, bildirimler;
  --      ikinci secim 22023; ajans2 yeni surum gonderemez 22023; rezervasyon (7c) alici kurulusla, kurum gorur
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.rfp_award(rfp, prop_a);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'yetkisiz secim yapti';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.rfp_award(rfp, prop_a);
  BEGIN
    PERFORM public.rfp_award(rfp, prop_b);
    RAISE EXCEPTION 'ikinci secim gecti';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  EXECUTE 'RESET ROLE';
  SELECT p.status::text || '/' || COALESCE(pv.approved_by_name, '-') INTO st FROM public.proposals p JOIN public.proposal_versions pv ON pv.id = p.current_version_id WHERE p.id = prop_a;
  IF st <> 'approved/Test Kurum Sahibi' THEN RAISE EXCEPTION 'secim sonrasi teklif % (approved/Test Kurum Sahibi)', st; END IF;
  SELECT status::text || '/' || COALESCE(awarded_proposal_id::text, '-') INTO st FROM public.rfps WHERE id = rfp;
  IF st <> 'awarded/' || prop_a::text THEN RAISE EXCEPTION 'secim sonrasi RFP %', st; END IF;
  SELECT status::text INTO st FROM public.rfp_invites WHERE id = inv_b;
  IF st <> 'not_selected' THEN RAISE EXCEPTION 'ikinci davet % (not_selected)', st; END IF;
  SELECT status::text INTO st FROM public.rfp_invites WHERE id = inv_a;
  IF st <> 'responded' THEN RAISE EXCEPTION 'kazanan davet % (responded)', st; END IF;
  SELECT status::text INTO st FROM public.proposals WHERE id = prop_b;
  IF st <> 'sent' THEN RAISE EXCEPTION 'secilmeyen teklif durumu degisti (%)', st; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'rfp' AND user_id = ajans2 AND body LIKE 'Teklif talebi ba_ka bir teklife%';
  IF n <> 1 THEN RAISE EXCEPTION 'secilmedi bildirimi % (1)', n; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'rfp' AND user_id = ajans AND body LIKE 'Teklifin kabul edildi%';
  IF n <> 1 THEN RAISE EXCEPTION 'kabul bildirimi % (1)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans2::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v2 := public.proposal_new_version(prop_b);
  BEGIN
    PERFORM public.proposal_send(prop_b, 14);
    RAISE EXCEPTION 'kapali RFP''ye yanit gonderildi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  b_id := public.booking_from_proposal(prop_a);
  EXECUTE 'RESET ROLE';
  SELECT * INTO r FROM public.bookings WHERE id = b_id;
  IF r.buyer_organization_id <> org_k OR r.customer_id IS NOT NULL OR r.event_id <> ev OR r.total_amount <> 26400 THEN RAISE EXCEPTION 'RFP rezervasyonu: %', r; END IF;
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.bookings WHERE id = b_id;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'alici kurulus rezervasyonu gormedi'; END IF;

  -- 24j) ikinci RFP: davet reddi (bildirim), degerlendirmeye alma, iptal (davetler not_selected; reddedilen kalir)
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  rfp2 := public.rfp_create(org_k, ev, 'T24 ikinci RFP', NULL, now() + interval '3 days');
  PERFORM public.rfp_invite(rfp2, prov_a);
  PERFORM public.rfp_invite(rfp2, prov_b);
  PERFORM public.rfp_send(rfp2);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', ajans2::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.rfp_invite_decline(rfp2);
  BEGIN
    PERFORM public.proposal_create_from_rfp(rfp2, org_b);
    RAISE EXCEPTION 'reddedilen davetle yanit acildi';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'rfp' AND user_id = kurum AND body LIKE '%daveti reddetti%';
  IF n <> 1 THEN RAISE EXCEPTION 'ret bildirimi % (1)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.rfp_close(rfp2);
  SELECT status::text INTO st FROM public.rfps WHERE id = rfp2;
  IF st <> 'evaluating' THEN EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'degerlendirme durumu % (evaluating)', st; END IF;
  PERFORM public.rfp_cancel(rfp2);
  EXECUTE 'RESET ROLE';
  SELECT status::text INTO st FROM public.rfps WHERE id = rfp2;
  IF st <> 'cancelled' THEN RAISE EXCEPTION 'iptal durumu % (cancelled)', st; END IF;
  SELECT string_agg(status::text, ',' ORDER BY status::text) INTO st FROM public.rfp_invites WHERE rfp_id = rfp2;
  IF st <> 'declined,not_selected' THEN RAISE EXCEPTION 'iptal sonrasi davetler % (declined,not_selected)', st; END IF;
  -- anon hicbir RPC'yi cagiramaz
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.rfp_detail(rfp);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon rfp_detail cagirdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  INSERT INTO t_sonuc VALUES (24, 'T24 FAZ 7b RFP', 'GECTI',
    'rfp_create (kalemler gereksinimden + ipucu; uye olmayan 42501, yabanci etkinlik/kisa baslik 22023); taslak duzenleme + kalem ekleme, ipucu sutunu 42501, durum dogrudan 42501, rfp_detail alici ipucu tasir; davet (idempotan, profesyonel 22023), davetsiz send 22023, send -> sent + bildirimler (owner+sales, viewer/crew yok), gonderilmis RFP duzenlenemez; satici: davetli gorur (ipucu yok, my_invite viewed), viewer 0, INSERT 42501; yanit: rfp_response + alici kurulus + 3 kalem, idempotan, send baglantisiz, davet responded, collecting, kurum bildirimi, toplam 30000; alici: teklif + gorunur 3 kalem, ic kalem 42501, taslak surum gorunmez; revizyon -> yeni surum -> 2 surum; ikinci ajans yaniti, rfp_detail ozetleri; award: yetkisiz 42501, approved/Test Kurum Sahibi, awarded, not_selected, bildirimler, ikinci secim 22023, kapali RFP send 22023, rezervasyon alici kurulusla + kurum gorur; RFP2: ret + bildirim, evaluating, cancel -> declined,not_selected; anon 42501');
EXCEPTION WHEN OTHERS THEN
  BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO t_sonuc VALUES (24, 'T24 FAZ 7b RFP', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T25) FAZ 8-U uyelik rolu. ON KOSUL: 20261020120000 (faz8u 01) dalda. Test Ajans kurulusu (owner 0004 owner_seed, sales 0001,
--      crew_coordinator 0002 [agency_members], viewer 0003 [agency_members]) verisine dayanir. Sonda roller eski haline doner.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  pro2    uuid := 'a0000000-0000-4000-8000-000000000003';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  org_a   uuid;
  m_pro1  uuid; m_pro2 uuid; m_owner uuid;
  st      text;
  n       integer;
BEGIN
  SELECT o.id INTO org_a FROM public.organizations o WHERE o.legacy_profile_id = ajans;
  SELECT id INTO m_pro1  FROM public.organization_memberships WHERE organization_id = org_a AND user_id = pro1;
  SELECT id INTO m_pro2  FROM public.organization_memberships WHERE organization_id = org_a AND user_id = pro2;
  SELECT id INTO m_owner FROM public.organization_memberships WHERE organization_id = org_a AND user_id = ajans;
  IF org_a IS NULL OR m_pro1 IS NULL OR m_pro2 IS NULL OR m_owner IS NULL THEN
    RAISE EXCEPTION 'on kosul: org_a=% m_pro1=% m_pro2=% m_owner=%', org_a, m_pro1, m_pro2, m_owner;
  END IF;
  SELECT legacy_source INTO st FROM public.organization_memberships WHERE id = m_pro2;
  IF st <> 'agency_members' THEN RAISE EXCEPTION 'on kosul: pro2 legacy_source % (agency_members)', st; END IF;

  -- 1) owner -> pro2 viewer -> sales (ince rol); eski tablo member kalir
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.org_member_set_role(m_pro2, 'sales');
  EXECUTE 'RESET ROLE';
  SELECT role::text INTO st FROM public.organization_memberships WHERE id = m_pro2;
  IF st <> 'sales' THEN RAISE EXCEPTION 'pro2 rol % (sales)', st; END IF;
  SELECT member_role::text INTO st FROM public.agency_members WHERE id = m_pro2;
  IF st <> 'member' THEN RAISE EXCEPTION 'pro2 eski rol % (member)', st; END IF;

  -- 2) eski satirda rol disi guncelleme -> ince rol KORUNUR (FAZ 8-U aynasi)
  UPDATE public.agency_members SET joined_at = joined_at WHERE id = m_pro2;
  SELECT role::text INTO st FROM public.organization_memberships WHERE id = m_pro2;
  IF st <> 'sales' THEN RAISE EXCEPTION 'ayna ince rolu ezdi: % (sales)', st; END IF;

  -- 3) eski satirda rol degisimi -> ayna yazar (manager -> admin)
  UPDATE public.agency_members SET member_role = 'manager' WHERE id = m_pro2;
  SELECT role::text INTO st FROM public.organization_memberships WHERE id = m_pro2;
  IF st <> 'admin' THEN RAISE EXCEPTION 'ayna rol degisimini yazmadi: % (admin)', st; END IF;

  -- 4) owner -> pro2 admin -> project_manager; eski tablo member'a doner
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.org_member_set_role(m_pro2, 'project_manager');
  PERFORM public.org_member_set_role(m_pro1, 'admin');
  EXECUTE 'RESET ROLE';
  SELECT role::text INTO st FROM public.organization_memberships WHERE id = m_pro2;
  IF st <> 'project_manager' THEN RAISE EXCEPTION 'pro2 rol % (project_manager)', st; END IF;
  SELECT member_role::text INTO st FROM public.agency_members WHERE id = m_pro2;
  IF st <> 'member' THEN RAISE EXCEPTION 'pro2 eski rol % (member, admin sonrasi)', st; END IF;
  SELECT member_role::text INTO st FROM public.agency_members WHERE id = m_pro1;
  IF st <> 'manager' THEN RAISE EXCEPTION 'pro1 eski rol % (manager)', st; END IF;

  -- 5) admin (pro1): owner veremez (42501), finance verebilir, kendi rolunu degistiremez (22023), sahibi degistiremez (22023)
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.org_member_set_role(m_pro2, 'owner');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'admin owner verdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.org_member_set_role(m_pro2, 'finance');
  EXECUTE 'RESET ROLE';
  SELECT role::text INTO st FROM public.organization_memberships WHERE id = m_pro2;
  IF st <> 'finance' THEN RAISE EXCEPTION 'pro2 rol % (finance)', st; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.org_member_set_role(m_pro1, 'viewer');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'kendi rolunu degistirdi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.org_member_set_role(m_owner, 'viewer');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'kurulus sahibi degistirildi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;

  -- 6) sales (musteri, members.manage yok) -> 42501; anon -> 42501
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.org_member_set_role(m_pro2, 'viewer');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'sales rol degistirdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.org_member_set_role(m_pro2, 'viewer');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'anon rol degistirdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 7) denetim kaydi
  SELECT count(*) INTO n FROM internal.access_audit
   WHERE target_table = 'organization_memberships' AND detail->>'op' = 'member.set_role' AND organization_id = org_a;
  IF n < 4 THEN RAISE EXCEPTION 'denetim kaydi % (>=4)', n; END IF;

  -- 8) eski hale don (owner): pro1 crew_coordinator, pro2 viewer
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.org_member_set_role(m_pro1, 'crew_coordinator');
  PERFORM public.org_member_set_role(m_pro2, 'viewer');
  EXECUTE 'RESET ROLE';
  SELECT string_agg(role::text, ',' ORDER BY user_id) INTO st
    FROM public.organization_memberships WHERE id IN (m_pro1, m_pro2);
  IF st <> 'crew_coordinator,viewer' THEN RAISE EXCEPTION 'geri alma % (crew_coordinator,viewer)', st; END IF;

  INSERT INTO t_sonuc VALUES (25, 'T25 FAZ 8-U uyelik rolu', 'GECTI',
    'owner ince rol verdi (sales; eski tablo member); eski satirda rol disi guncelleme ince rolu korudu; eski rol degisimi (manager) aynada admin; owner project_manager/admin verdi (eski tablo member/manager); admin owner veremedi 42501, finance verdi, kendi rolu 22023, sahip 22023; sales 42501; anon 42501; denetim >=4; geri alma');
EXCEPTION WHEN OTHERS THEN
  BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO t_sonuc VALUES (25, 'T25 FAZ 8-U uyelik rolu', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T26) FAZ 8a gorevler + aktivite. ON KOSUL: 20261021120000 (faz8a 01) dalda. Test Ajans (org_a: owner 0004, sales 0001 [events.manage],
--      crew_coordinator 0002 [events.view], viewer 0003; havuz kaydi 'Test Pro Iki B' = 0003) ve Test Kurum AS (org_k: owner 0005; tasks
--      modulu KAPALI) verisine dayanir. Sonda gorevler/aktivite silinir.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  pro2    uuid := 'a0000000-0000-4000-8000-000000000003';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  kurum   uuid := 'a0000000-0000-4000-8000-000000000005';
  ajans2  uuid := 'a0000000-0000-4000-8000-000000000007';
  org_a uuid; org_k uuid; org_b uuid;
  ev_a uuid; ev_k uuid;
  rec_a uuid; rec_b uuid;
  t_a uuid; t_b uuid; t_c uuid; t_k uuid;
  n integer; st text; ts timestamptz;
BEGIN
  SELECT id INTO org_a FROM public.organizations WHERE legacy_profile_id = ajans;
  SELECT id INTO org_k FROM public.organizations WHERE legacy_profile_id = kurum;
  SELECT id INTO org_b FROM public.organizations WHERE legacy_profile_id = ajans2;
  SELECT id INTO ev_k FROM public.events WHERE organization_id = org_k LIMIT 1;
  SELECT id INTO rec_a FROM public.organization_talent_records WHERE organization_id = org_a AND talent_id = pro2;
  IF org_a IS NULL OR org_k IS NULL OR org_b IS NULL OR ev_k IS NULL OR rec_a IS NULL THEN
    RAISE EXCEPTION 'on kosul: org_a=% org_k=% org_b=% ev_k=% rec_a=%', org_a, org_k, org_b, ev_k, rec_a;
  END IF;
  IF NOT public.org_module_enabled(org_a, 'tasks') THEN RAISE EXCEPTION 'on kosul: ajansta tasks modulu acik olmali (dolum)'; END IF;
  IF public.org_module_enabled(org_k, 'tasks') THEN RAISE EXCEPTION 'on kosul: kurumda tasks modulu kapali olmali'; END IF;
  -- temizlik (tekrar kosu)
  UPDATE public.tasks SET status = 'cancelled' WHERE organization_id IN (org_a, org_k) AND status NOT IN ('todo', 'cancelled');
  DELETE FROM public.tasks WHERE organization_id IN (org_a, org_k);
  DELETE FROM public.activity_logs WHERE organization_id IN (org_a, org_k);
  DELETE FROM public.notifications WHERE type = 'task' AND user_id IN (musteri, pro1, pro2, ajans, kurum);
  DELETE FROM public.events WHERE organization_id = org_a AND title = 'T26 ajans etkinligi';
  INSERT INTO public.organization_talent_records (organization_id, name) VALUES (org_b, 'T26 yabanci kayit') RETURNING id INTO rec_b;

  -- 1) owner: kurulus etkinligi + etkinlige bagli gorev A + genel gorev B
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.events (organization_id, owner_user_id, title, event_type, start_date, end_date)
  VALUES (org_a, ajans, 'T26 ajans etkinligi', 'wedding', current_date + 30, current_date + 30) RETURNING id INTO ev_a;
  INSERT INTO public.tasks (organization_id, event_id, title, due_at, is_milestone)
  VALUES (org_a, ev_a, 'T26 gorev A', now() + interval '10 days', true) RETURNING id INTO t_a;
  INSERT INTO public.tasks (organization_id, title, description)
  VALUES (org_a, 'T26 gorev B', 'kurulus geneli') RETURNING id INTO t_b;
  EXECUTE 'RESET ROLE';
  SELECT created_by::text INTO st FROM public.tasks WHERE id = t_a;
  IF st <> ajans::text THEN RAISE EXCEPTION 'created_by % (ajans)', st; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE organization_id = org_a AND entity_type = 'task' AND action = 'created';
  IF n <> 2 THEN RAISE EXCEPTION 'created aktivite % (2)', n; END IF;

  -- 2) owner: A'yi uyeye (pro1) ata -> bildirim + 'assigned'; B'yi havuz kaydina ata
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.tasks SET assignee_user_id = pro1 WHERE id = t_a;
  UPDATE public.tasks SET assignee_talent_record_id = rec_a WHERE id = t_b;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = pro1 AND type = 'task' AND body = 'Sana görev atandı: T26 gorev A';
  IF n <> 1 THEN RAISE EXCEPTION 'atama bildirimi % (1)', n; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = t_a AND action = 'assigned';
  IF n <> 1 THEN RAISE EXCEPTION 'assigned aktivite % (1)', n; END IF;

  -- 3) kurallar (22023): uye olmayan kisi, yabanci havuz kaydi, baska kurulusun etkinligi, kurulus degisimi
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.tasks SET assignee_user_id = kurum WHERE id = t_a;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'uye olmayan kisi atandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.tasks SET assignee_talent_record_id = rec_b WHERE id = t_b;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'yabanci havuz kaydi atandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.tasks SET event_id = ev_k WHERE id = t_b;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'baska kurulusun etkinligine baglandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.tasks SET organization_id = org_b WHERE id = t_b;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'kurulus degisti';
  EXCEPTION WHEN invalid_parameter_value OR insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.tasks SET depends_on_task_id = t_b WHERE id = t_b;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'kendine bagimlilik gecti';
  EXCEPTION WHEN check_violation THEN EXECUTE 'RESET ROLE'; END;

  -- 4) durum: A in_progress -> done (completed_at dolar) -> silinemez (22023); bagimlilik ayni kurulus gecer
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.tasks SET status = 'in_progress' WHERE id = t_a;
  UPDATE public.tasks SET status = 'done' WHERE id = t_a;
  UPDATE public.tasks SET depends_on_task_id = t_a WHERE id = t_b;
  EXECUTE 'RESET ROLE';
  SELECT completed_at INTO ts FROM public.tasks WHERE id = t_a;
  IF ts IS NULL THEN RAISE EXCEPTION 'done: completed_at bos'; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = t_a AND action = 'status_changed';
  IF n <> 2 THEN RAISE EXCEPTION 'status_changed aktivite % (2)', n; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.tasks WHERE id = t_a;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'done gorev silindi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  SELECT count(*) INTO n FROM public.tasks WHERE id = t_a;
  IF n <> 1 THEN RAISE EXCEPTION 'done gorev kayboldu'; END IF;

  -- 5) sales (musteri, events.manage): gorev C acar; atanan musteri; owner olusturdu degil -> blocked bildirimi olusturana
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.tasks (organization_id, title, assignee_user_id) VALUES (org_a, 'T26 gorev C', musteri) RETURNING id INTO t_c;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.tasks SET status = 'blocked' WHERE id = t_c;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = ajans AND type = 'task' AND body = 'Görev engellendi: T26 gorev C';
  IF n <> 1 THEN RAISE EXCEPTION 'engellendi bildirimi (olusturan) % (1)', n; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = musteri AND type = 'task';
  IF n <> 1 THEN RAISE EXCEPTION 'musteri bildirim % (1: atama; engellendi kendi islemi)', n; END IF;

  -- 6) crew_coordinator (pro1, events.view): okur, yazamaz (0 satir); viewer (pro2) INSERT 42501; anon SELECT 42501
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.tasks WHERE organization_id = org_a;
  IF n <> 3 THEN EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'crew_coordinator % gorev gordu (3)', n; END IF;
  UPDATE public.tasks SET title = 'T26 gorev B x' WHERE id = t_b;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'crew_coordinator yazdi (%)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro2::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.tasks (organization_id, title) VALUES (org_a, 'T26 viewer');
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'viewer gorev acti';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM count(*) FROM public.tasks;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'anon gorev okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 7) aktivite: viewer okur (events.view), authenticated INSERT 42501
  PERFORM set_config('request.jwt.claim.sub', pro2::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.activity_logs WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  IF n < 6 THEN RAISE EXCEPTION 'viewer aktivite % (>=6)', n; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.activity_logs (organization_id, entity_type, entity_id, action) VALUES (org_a, 'task', t_b, 'updated');
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'authenticated aktivite yazdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 8) business: modul kapali -> 22023; sahip org_module_set ile acar -> gecer; uye (settings.manage yok) acamaz 42501
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.tasks (organization_id, title) VALUES (org_k, 'T26 kurum gorev');
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'modul kapaliyken gorev acildi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.org_module_set(org_k, 'tasks', true);
  INSERT INTO public.tasks (organization_id, event_id, title) VALUES (org_k, ev_k, 'T26 kurum gorev') RETURNING id INTO t_k;
  PERFORM public.org_module_set(org_k, 'tasks', false);
  EXECUTE 'RESET ROLE';
  IF public.org_module_enabled(org_k, 'tasks') THEN RAISE EXCEPTION 'modul kapanmadi'; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro2::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.org_module_set(org_a, 'tasks', false);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'viewer modul kapatti';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  SELECT count(*) INTO n FROM internal.access_audit WHERE organization_id = org_k AND detail->>'op' = 'module.set';
  IF n <> 2 THEN RAISE EXCEPTION 'modul denetim % (2)', n; END IF;

  -- 9) bildirim tipi ve e-posta kuyrugu indeksi
  SELECT count(*) INTO n FROM pg_indexes WHERE indexname = 'notifications_email_pending_idx' AND indexdef LIKE '%task%';
  IF n <> 1 THEN RAISE EXCEPTION 'e-posta kuyrugu indeksi task icermiyor'; END IF;

  -- 10) temizlik (etkinlik silinince gorev event_id NULL; kalanlar iptal + sil)
  DELETE FROM public.events WHERE id = ev_a;
  SELECT event_id::text INTO st FROM public.tasks WHERE id = t_a;
  IF st IS NOT NULL THEN RAISE EXCEPTION 'etkinlik silinince event_id NULL olmadi'; END IF;
  UPDATE public.tasks SET status = 'cancelled' WHERE organization_id IN (org_a, org_k) AND status NOT IN ('todo', 'cancelled');
  DELETE FROM public.tasks WHERE organization_id IN (org_a, org_k);
  DELETE FROM public.organization_talent_records WHERE id = rec_b;
  SELECT count(*) INTO n FROM public.tasks WHERE organization_id IN (org_a, org_k);
  IF n <> 0 THEN RAISE EXCEPTION 'temizlik: % gorev kaldi', n; END IF;

  INSERT INTO t_sonuc VALUES (26, 'T26 FAZ 8a gorevler + aktivite', 'GECTI',
    'owner etkinlikli + genel gorev acti (created_by, 2 created); uyeye atama bildirim + assigned; havuz kaydina atama; uye olmayan/yabanci kayit/baska kurulus etkinligi/kurulus degisimi 22023, kendine bagimlilik 23514; done completed_at + 2 status_changed, done silinemez; sales acti, blocked -> olusturana bildirim; crew_coordinator okur 3 yazamaz 0; viewer INSERT 42501; anon 42501; aktivite viewer okur >=6, authenticated INSERT 42501; business modul kapali 22023 -> org_module_set ac/kapat (denetim 2), viewer 42501; indeks task; etkinlik silinince event_id NULL; temizlik');
EXCEPTION WHEN OTHERS THEN
  BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO t_sonuc VALUES (26, 'T26 FAZ 8a gorevler + aktivite', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T27) Hijyen 03 organizations_public. ON KOSUL: 20261021110000 (hijyen_03) dalda. musteri (0001) yalniz Test Ajans uyesi;
--      Test Kurum AS'in adini gorunumden okur, tablodan okuyamaz; gorunumde abonelik sutunu yok; anon 42501.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  kurum   uuid := 'a0000000-0000-4000-8000-000000000005';
  org_k uuid; n integer; st text;
BEGIN
  SELECT id INTO org_k FROM public.organizations WHERE legacy_profile_id = kurum;
  IF org_k IS NULL THEN RAISE EXCEPTION 'on kosul: org_k yok'; END IF;
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT display_name INTO st FROM public.organizations_public WHERE id = org_k;
  SELECT count(*) INTO n FROM public.organizations WHERE id = org_k;
  EXECUTE 'RESET ROLE';
  IF st IS NULL THEN RAISE EXCEPTION 'gorunumden karsi taraf adi okunamadi'; END IF;
  IF n <> 0 THEN RAISE EXCEPTION 'tablo RLS: uye olmadigi kurulus satiri goruldu (%)', n; END IF;
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'organizations_public' AND column_name IN ('subscription_tier', 'settings', 'seat_limit', 'legal_name');
  IF n <> 0 THEN RAISE EXCEPTION 'gorunumde kapali sutun var (%)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM count(*) FROM public.organizations_public;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'anon gorunumu okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  SELECT count(*) INTO n FROM public.notifications WHERE type IN ('rfp', 'proposal')
   AND (body LIKE '% teklif gonderdi: %' OR body LIKE 'Teklifin icin revizyon%' OR body LIKE 'Teklif talebi baska%');
  IF n <> 0 THEN RAISE EXCEPTION 'ASCII bildirim metni kaldi (%)', n; END IF;
  INSERT INTO t_sonuc VALUES (27, 'T27 hijyen_03 organizations_public', 'GECTI',
    'uye olmadigi kurulusun adi gorunumden okundu (' || st || '), tablodan 0 satir; kapali sutun yok; anon 42501; ASCII bildirim 0');
EXCEPTION WHEN OTHERS THEN
  BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO t_sonuc VALUES (27, 'T27 hijyen_03 organizations_public', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T28) FAZ 8b CRM. ON KOSUL: 20261022120000 (faz8b 01) dalda. Test Ajans (org_a: owner 0004, sales 0001 [crm.manage],
--      crew_coordinator 0002 [crm yok], finance 0006 [crm.view], viewer 0003), Test Kurum AS (org_k: owner 0005; crm modulu KAPALI),
--      Test Ajans Iki (org_b: 0007) ve T21 teklifleri (Test Ajans satici; client_email dolu) verisine dayanir. Sonda kisi/firsat silinir.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  pro2    uuid := 'a0000000-0000-4000-8000-000000000003';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  kurum   uuid := 'a0000000-0000-4000-8000-000000000005';
  finans  uuid := 'a0000000-0000-4000-8000-000000000006';
  ajans2  uuid := 'a0000000-0000-4000-8000-000000000007';
  org_a uuid; org_k uuid; org_b uuid;
  ev_a uuid; ev_k uuid; tk_a uuid; tk_b uuid;
  c_a uuid; c_b uuid; c_yab uuid;
  l_a uuid; l_b uuid;
  n integer; st text; ts timestamptz;
BEGIN
  SELECT id INTO org_a FROM public.organizations WHERE legacy_profile_id = ajans;
  SELECT id INTO org_k FROM public.organizations WHERE legacy_profile_id = kurum;
  SELECT id INTO org_b FROM public.organizations WHERE legacy_profile_id = ajans2;
  SELECT id INTO ev_k FROM public.events WHERE organization_id = org_k LIMIT 1;
  SELECT id INTO tk_a FROM public.proposals WHERE seller_organization_id = org_a AND client_email = 'faz1test+musteri@kashe.net' LIMIT 1;
  SELECT id INTO tk_b FROM public.proposals WHERE seller_organization_id = org_b LIMIT 1;
  IF org_a IS NULL OR org_k IS NULL OR org_b IS NULL OR ev_k IS NULL OR tk_a IS NULL OR tk_b IS NULL THEN
    RAISE EXCEPTION 'on kosul: org_a=% org_k=% org_b=% ev_k=% tk_a=% tk_b=%', org_a, org_k, org_b, ev_k, tk_a, tk_b;
  END IF;
  IF NOT public.org_module_enabled(org_a, 'crm') THEN RAISE EXCEPTION 'on kosul: ajansta crm modulu acik olmali (dolum)'; END IF;
  IF public.org_module_enabled(org_k, 'crm') THEN RAISE EXCEPTION 'on kosul: kurumda crm modulu kapali olmali'; END IF;
  IF NOT ('crm.manage' = ANY (public.org_role_permissions('sales'))) THEN RAISE EXCEPTION 'on kosul: sales crm.manage'; END IF;
  IF 'crm.view' = ANY (public.org_role_permissions('crew_coordinator')) THEN RAISE EXCEPTION 'on kosul: crew_coordinator crm.view almamali'; END IF;
  -- temizlik (tekrar kosu)
  DELETE FROM public.crm_leads WHERE organization_id IN (org_a, org_k, org_b);
  DELETE FROM public.contacts  WHERE organization_id IN (org_a, org_k, org_b);
  DELETE FROM public.activity_logs WHERE organization_id IN (org_a, org_k, org_b) AND entity_type IN ('contact', 'lead');
  DELETE FROM public.notifications WHERE type = 'crm' AND user_id IN (musteri, pro1, pro2, ajans, kurum, finans);
  UPDATE public.proposals SET buyer_contact_id = NULL WHERE seller_organization_id IN (org_a, org_b);
  DELETE FROM public.events WHERE organization_id = org_a AND title = 'T28 ajans etkinligi';
  INSERT INTO public.contacts (organization_id, full_name, email) VALUES (org_b, 'T28 yabanci kisi', 'yabanci@kashe.net') RETURNING id INTO c_yab;

  -- 1) oneri gorunumu: owner, teklif musterisi icin kisi yok -> oneri satiri var
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.crm_contact_suggestions WHERE organization_id = org_a AND client_email = 'faz1test+musteri@kashe.net';
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'oneri satiri % (1)', n; END IF;

  -- 2) owner: kisi A (e-posta BUYUK harf -> normalize), kisi B (firma); tekrar e-posta 23505; created_by; aktivite created 2
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.contacts (organization_id, full_name, email, phone)
  VALUES (org_a, '  T28 Kisi A ', ' Faz1test+Musteri@kashe.net ', '0532 000 00 00') RETURNING id INTO c_a;
  INSERT INTO public.contacts (organization_id, kind, full_name, company_name)
  VALUES (org_a, 'company', 'T28 Firma B', 'Firma B AS') RETURNING id INTO c_b;
  EXECUTE 'RESET ROLE';
  SELECT email || '|' || full_name || '|' || created_by::text INTO st FROM public.contacts WHERE id = c_a;
  IF st <> 'faz1test+musteri@kashe.net|T28 Kisi A|' || ajans::text THEN RAISE EXCEPTION 'normalizasyon/created_by: %', st; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.contacts (organization_id, full_name, email) VALUES (org_a, 'T28 Kopya', 'FAZ1TEST+MUSTERI@kashe.net');
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'ayni e-posta ikinci kez girdi';
  EXCEPTION WHEN unique_violation THEN EXECUTE 'RESET ROLE'; END;
  SELECT count(*) INTO n FROM public.activity_logs WHERE organization_id = org_a AND entity_type = 'contact' AND action = 'created';
  IF n <> 2 THEN RAISE EXCEPTION 'contact created aktivite % (2)', n; END IF;
  -- oneri artik yok (kisi var)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.crm_contact_suggestions WHERE organization_id = org_a AND client_email = 'faz1test+musteri@kashe.net';
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'kisi acildiktan sonra oneri kaldi (%)', n; END IF;

  -- 3) owner: firsat A (sahip sales=musteri -> bildirim + assigned yok (INSERT: created)); etkinlige bagla; teklife bagla -> buyer_contact_id dolar
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.events (organization_id, owner_user_id, title, event_type, start_date, end_date)
  VALUES (org_a, ajans, 'T28 ajans etkinligi', 'corporate', current_date + 40, current_date + 40) RETURNING id INTO ev_a;
  INSERT INTO public.crm_leads (organization_id, contact_id, title, estimated_value, expected_date, owner_user_id, event_id)
  VALUES (org_a, c_a, 'T28 firsat A', 120000, current_date + 30, musteri, ev_a) RETURNING id INTO l_a;
  UPDATE public.crm_leads SET proposal_id = tk_a WHERE id = l_a;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = musteri AND type = 'crm' AND body = 'Sana fırsat atandı: T28 firsat A';
  IF n <> 1 THEN RAISE EXCEPTION 'sahip bildirimi % (1)', n; END IF;
  SELECT buyer_contact_id::text INTO st FROM public.proposals WHERE id = tk_a;
  IF st IS DISTINCT FROM c_a::text THEN RAISE EXCEPTION 'teklif buyer_contact_id dolmadi (%)', st; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = l_a AND entity_type = 'lead';
  IF n <> 2 THEN RAISE EXCEPTION 'lead aktivite % (2: created, updated)', n; END IF;

  -- 4) kurallar (22023): yabanci kisi, baska kurulusun etkinligi, baska kurulusun teklifi, uye olmayan sahip, kurulus degisimi,
  --    kisi kendi kurulusuna baglanamaz, teklife yabanci kisi
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.crm_leads SET contact_id = c_yab WHERE id = l_a;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'yabanci kisi baglandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.crm_leads SET event_id = ev_k WHERE id = l_a;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'baska kurulusun etkinligi baglandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.crm_leads SET proposal_id = tk_b WHERE id = l_a;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'baska kurulusun teklifi baglandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.crm_leads SET owner_user_id = kurum WHERE id = l_a;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'uye olmayan sahip atandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.crm_leads SET organization_id = org_b WHERE id = l_a;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'kurulus degisti';
  EXCEPTION WHEN invalid_parameter_value OR insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.contacts SET linked_organization_id = org_a WHERE id = c_b;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'kisi kendi kurulusuna baglandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.proposals SET buyer_contact_id = c_yab WHERE id = tk_a;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'teklife yabanci kisi baglandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;

  -- 5) asama: contacted -> proposal_sent -> won (won_at dolar) -> contacted (won_at bosalir) -> lost (lost_at + neden); status_changed 5
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.crm_leads SET stage = 'contacted' WHERE id = l_a;
  UPDATE public.crm_leads SET stage = 'proposal_sent' WHERE id = l_a;
  UPDATE public.crm_leads SET stage = 'won' WHERE id = l_a;
  EXECUTE 'RESET ROLE';
  SELECT won_at INTO ts FROM public.crm_leads WHERE id = l_a;
  IF ts IS NULL THEN RAISE EXCEPTION 'won: won_at bos'; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.crm_leads SET stage = 'contacted' WHERE id = l_a;
  UPDATE public.crm_leads SET stage = 'lost', lost_reason = 'Butce' WHERE id = l_a;
  EXECUTE 'RESET ROLE';
  SELECT won_at INTO ts FROM public.crm_leads WHERE id = l_a;
  IF ts IS NOT NULL THEN RAISE EXCEPTION 'geri alinca won_at bosalmadi'; END IF;
  SELECT lost_at INTO ts FROM public.crm_leads WHERE id = l_a;
  IF ts IS NULL THEN RAISE EXCEPTION 'lost: lost_at bos'; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = l_a AND action = 'status_changed';
  IF n <> 5 THEN RAISE EXCEPTION 'status_changed aktivite % (5)', n; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = l_a AND action = 'status_changed' AND diff->>'lost_reason' = 'Butce';
  IF n <> 1 THEN RAISE EXCEPTION 'lost_reason diff % (1)', n; END IF;

  -- 6) PII diff'e yazilmaz: owner e-posta/telefon degistirir -> diff {email:true, phone:true}, deger yok
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.contacts SET email = 'yeni+t28@kashe.net', phone = '0533 111 11 11' WHERE id = c_a;
  EXECUTE 'RESET ROLE';
  SELECT diff::text INTO st FROM public.activity_logs WHERE entity_id = c_a AND action = 'updated' ORDER BY id DESC LIMIT 1;
  IF st NOT LIKE '%"email": true%' OR st LIKE '%kashe.net%' OR st LIKE '%0533%' THEN RAISE EXCEPTION 'PII diff: %', st; END IF;

  -- 7) sales (musteri, crm.manage): kisi B'ye firsat B acar, sahip kendisi -> kendine bildirim YOK; sahibi owner'a verir -> owner'a bildirim
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.crm_leads (organization_id, contact_id, title, owner_user_id) VALUES (org_a, c_b, 'T28 firsat B', musteri) RETURNING id INTO l_b;
  UPDATE public.crm_leads SET owner_user_id = ajans, next_step = 'Aramak', next_step_at = now() + interval '2 days' WHERE id = l_b;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = musteri AND type = 'crm' AND body LIKE '%T28 firsat B';
  IF n <> 0 THEN RAISE EXCEPTION 'kendine atama bildirimi (%)', n; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = ajans AND type = 'crm' AND body = 'Sana fırsat atandı: T28 firsat B';
  IF n <> 1 THEN RAISE EXCEPTION 'owner bildirimi % (1)', n; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = l_b AND action = 'assigned';
  IF n <> 1 THEN RAISE EXCEPTION 'assigned aktivite % (1)', n; END IF;

  -- 8) finance (finans, crm.view): okur (2 kisi, 2 firsat), yazamaz (0 satir); crew_coordinator (pro1) hic gormez; viewer INSERT 42501; anon 42501
  PERFORM set_config('request.jwt.claim.sub', finans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.contacts WHERE organization_id = org_a;
  IF n <> 2 THEN EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'finance % kisi gordu (2)', n; END IF;
  SELECT count(*) INTO n FROM public.crm_leads WHERE organization_id = org_a;
  IF n <> 2 THEN EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'finance % firsat gordu (2)', n; END IF;
  UPDATE public.crm_leads SET title = 'T28 firsat B x' WHERE id = l_b;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'finance yazdi (%)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.contacts WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'crew_coordinator % kisi gordu (0)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro2::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.contacts (organization_id, full_name) VALUES (org_a, 'T28 viewer');
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'viewer kisi acti';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM count(*) FROM public.contacts;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'anon kisi okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  -- ince ayar: owner, finance'a {"crm.manage": true} verir -> finance yazar; geri alinir
  UPDATE public.organization_memberships SET permissions = permissions || '{"crm.manage": true}'::jsonb WHERE organization_id = org_a AND user_id = finans;
  PERFORM set_config('request.jwt.claim.sub', finans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.crm_leads SET next_step = 'Teklif hazirla' WHERE id = l_b;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  UPDATE public.organization_memberships SET permissions = permissions - 'crm.manage' WHERE organization_id = org_a AND user_id = finans;
  IF n <> 1 THEN RAISE EXCEPTION 'ince ayar crm.manage ile finance yazamadi (%)', n; END IF;

  -- 9) business: modul kapali -> 22023; org_module_set ile acilir -> kisi girer; kapatilir
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.contacts (organization_id, full_name) VALUES (org_k, 'T28 kurum kisi');
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'modul kapaliyken kisi acildi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.org_module_set(org_k, 'crm', true);
  INSERT INTO public.contacts (organization_id, full_name) VALUES (org_k, 'T28 kurum kisi');
  PERFORM public.org_module_set(org_k, 'crm', false);
  EXECUTE 'RESET ROLE';
  IF public.org_module_enabled(org_k, 'crm') THEN RAISE EXCEPTION 'modul kapanmadi'; END IF;

  -- 10) silme: kisi A firsatliyken silinemez (23503 RESTRICT); firsat silinince kisi silinir; teklif bagi SET NULL
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.contacts WHERE id = c_a;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'firsatli kisi silindi';
  EXCEPTION WHEN foreign_key_violation THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  DELETE FROM public.crm_leads WHERE id = l_a;
  DELETE FROM public.contacts WHERE id = c_a;
  EXECUTE 'RESET ROLE';
  SELECT buyer_contact_id::text INTO st FROM public.proposals WHERE id = tk_a;
  IF st IS NOT NULL THEN RAISE EXCEPTION 'kisi silinince teklif buyer_contact_id NULL olmadi'; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE organization_id = org_a AND entity_type IN ('contact', 'lead') AND action = 'deleted';
  IF n <> 2 THEN RAISE EXCEPTION 'deleted aktivite % (2)', n; END IF;

  -- 11) bildirim tipi + e-posta kuyrugu indeksi
  SELECT count(*) INTO n FROM pg_indexes WHERE indexname = 'notifications_email_pending_idx' AND indexdef LIKE '%crm%';
  IF n <> 1 THEN RAISE EXCEPTION 'e-posta kuyrugu indeksi crm icermiyor'; END IF;

  -- 12) temizlik
  DELETE FROM public.crm_leads WHERE organization_id IN (org_a, org_k, org_b);
  DELETE FROM public.contacts  WHERE organization_id IN (org_a, org_k, org_b);
  DELETE FROM public.events WHERE id = ev_a;
  SELECT count(*) INTO n FROM public.contacts WHERE organization_id IN (org_a, org_k, org_b);
  IF n <> 0 THEN RAISE EXCEPTION 'temizlik: % kisi kaldi', n; END IF;

  INSERT INTO t_sonuc VALUES (28, 'T28 FAZ 8b CRM', 'GECTI',
    'oneri gorunumu 1 -> kisi acilinca 0; e-posta normalize + kurulus ici tekil (23505); created_by; firsat sahibe bildirim; teklif bagi buyer_contact_id dolar; yabanci kisi/etkinlik/teklif/uye olmayan sahip/kurulus degisimi/kendine baglanma/teklife yabanci kisi 22023; asama won_at/lost_at + 5 status_changed + lost_reason; PII diff yok; sales acti, kendine bildirim yok, owner''a bildirim + assigned; finance okur 2/2 yazamaz 0, crew_coordinator 0, viewer 42501, anon 42501; ince ayar crm.manage ile finance yazdi; business modul kapali 22023 -> ac/kapat; firsatli kisi 23503, silince teklif SET NULL, deleted 2; indeks crm; temizlik');
EXCEPTION WHEN OTHERS THEN
  BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO t_sonuc VALUES (28, 'T28 FAZ 8b CRM', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T29) FAZ 8c tedarikciler + kisa liste. ON KOSUL: 20261023120000 (faz8c 01) dalda. Test Ajans (org_a: owner 0004,
--      sales 0001 [suppliers.view], crew_coordinator 0002 [suppliers.manage, commercial yok], finance 0006 [suppliers.view +
--      commercial.manage], viewer 0003), Test Kurum AS (org_k: owner 0005; supplier_search ACIK, suppliers KAPALI), Test Ajans Iki
--      (org_b: 0007; providers 0007), saglayicilar 0002/0003 (pro) ve 0004 (Test Ajans'in kendi saglayicisi). Sonda silinir.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  pro2    uuid := 'a0000000-0000-4000-8000-000000000003';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  kurum   uuid := 'a0000000-0000-4000-8000-000000000005';
  finans  uuid := 'a0000000-0000-4000-8000-000000000006';
  ajans2  uuid := 'a0000000-0000-4000-8000-000000000007';
  org_a uuid; org_k uuid; org_b uuid;
  ev_a uuid; ev_k uuid;
  s_a uuid; s_b uuid; s_yab uuid; es_a uuid;
  sl_k uuid; sl_a uuid; c_t uuid; l_t uuid;
  n integer; st text; ts timestamptz; amt numeric;
BEGIN
  SELECT id INTO org_a FROM public.organizations WHERE legacy_profile_id = ajans;
  SELECT id INTO org_k FROM public.organizations WHERE legacy_profile_id = kurum;
  SELECT id INTO org_b FROM public.organizations WHERE legacy_profile_id = ajans2;
  SELECT id INTO ev_k FROM public.events WHERE organization_id = org_k LIMIT 1;
  IF org_a IS NULL OR org_k IS NULL OR org_b IS NULL OR ev_k IS NULL THEN
    RAISE EXCEPTION 'on kosul: org_a=% org_k=% org_b=% ev_k=%', org_a, org_k, org_b, ev_k;
  END IF;
  IF NOT public.org_module_enabled(org_a, 'suppliers') THEN RAISE EXCEPTION 'on kosul: ajansta suppliers acik olmali (dolum)'; END IF;
  IF NOT public.org_module_enabled(org_k, 'supplier_search') THEN RAISE EXCEPTION 'on kosul: kurumda supplier_search acik olmali (dolum)'; END IF;
  IF public.org_module_enabled(org_a, 'supplier_search') THEN RAISE EXCEPTION 'on kosul: ajansta supplier_search kapali olmali'; END IF;
  IF NOT ('suppliers.manage' = ANY (public.org_role_permissions('crew_coordinator'))) THEN RAISE EXCEPTION 'on kosul: crew_coordinator suppliers.manage'; END IF;
  IF 'suppliers.manage' = ANY (public.org_role_permissions('sales')) THEN RAISE EXCEPTION 'on kosul: sales suppliers.manage almamali'; END IF;
  IF 'suppliers.view' = ANY (public.org_role_permissions('viewer')) THEN RAISE EXCEPTION 'on kosul: viewer suppliers.view almamali'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = ajans2) OR NOT EXISTS (SELECT 1 FROM public.providers WHERE id = ajans AND organization_id = org_a) THEN
    RAISE EXCEPTION 'on kosul: providers 0007 ve 0004 (org_a) olmali';
  END IF;
  -- temizlik (tekrar kosu)
  DELETE FROM public.crm_leads WHERE organization_id = org_a AND title LIKE 'T29%';
  DELETE FROM public.contacts  WHERE organization_id = org_a AND full_name LIKE 'T29%';
  DELETE FROM public.event_suppliers WHERE organization_id IN (org_a, org_k, org_b);
  DELETE FROM public.suppliers WHERE organization_id IN (org_a, org_k, org_b);
  DELETE FROM public.supplier_shortlists WHERE organization_id IN (org_a, org_k, org_b);
  DELETE FROM public.activity_logs WHERE organization_id IN (org_a, org_k, org_b) AND entity_type IN ('supplier', 'event_supplier', 'shortlist');
  DELETE FROM public.events WHERE organization_id = org_a AND title = 'T29 ajans etkinligi';
  INSERT INTO public.suppliers (organization_id, name) VALUES (org_b, 'T29 yabanci tedarikci') RETURNING id INTO s_yab;

  -- 1) owner: tedarikci A (ad kirpilir, e-posta kucuk harf, saglayici bagi 0007), B (catering); created_by; created 2;
  --    kendi saglayicisi 22023; ayni saglayici ikinci kez 23505; puan 6 ve gecersiz kategori 23514
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.suppliers (organization_id, name, category, email, phone, rating, linked_provider_id)
  VALUES (org_a, '  T29 Ses Isik Ltd ', 'sound_light', ' Ses@Firma.com ', '0212 000 00 00', 5, ajans2) RETURNING id INTO s_a;
  INSERT INTO public.suppliers (organization_id, name, category) VALUES (org_a, 'T29 Catering AS', 'catering') RETURNING id INTO s_b;
  EXECUTE 'RESET ROLE';
  SELECT name || '|' || email || '|' || created_by::text INTO st FROM public.suppliers WHERE id = s_a;
  IF st <> 'T29 Ses Isik Ltd|ses@firma.com|' || ajans::text THEN RAISE EXCEPTION 'normalizasyon/created_by: %', st; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE organization_id = org_a AND entity_type = 'supplier' AND action = 'created';
  IF n <> 2 THEN RAISE EXCEPTION 'supplier created aktivite % (2)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.suppliers (organization_id, name, linked_provider_id) VALUES (org_a, 'T29 kendi', ajans);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'kendi saglayicisi tedarikci oldu';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.suppliers (organization_id, name, linked_provider_id) VALUES (org_a, 'T29 kopya bag', ajans2);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'ayni saglayici ikinci kez baglandi';
  EXCEPTION WHEN unique_violation THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.suppliers SET rating = 6 WHERE id = s_b;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'puan 6 girdi';
  EXCEPTION WHEN check_violation THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.suppliers SET category = 'uzay' WHERE id = s_b;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'gecersiz kategori girdi';
  EXCEPTION WHEN check_violation THEN EXECUTE 'RESET ROLE'; END;

  -- 2) owner etkinlik acar; crew_coordinator (pro1, suppliers.manage) A'yi atar; confirmed -> confirmed_at; planned -> bos;
  --    created + status_changed 2; ayni tedarikci ikinci kez 23505; yabanci tedarikci / baska kurulusun etkinligi 22023;
  --    B arsive -> B atanamaz 22023
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.events (organization_id, owner_user_id, title, event_type, start_date, end_date)
  VALUES (org_a, ajans, 'T29 ajans etkinligi', 'corporate', current_date + 45, current_date + 45) RETURNING id INTO ev_a;
  UPDATE public.suppliers SET is_active = false WHERE id = s_b;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.event_suppliers (organization_id, event_id, supplier_id, service)
  VALUES (org_a, ev_a, s_a, ' Ses sistemi ') RETURNING id INTO es_a;
  UPDATE public.event_suppliers SET status = 'confirmed' WHERE id = es_a;
  EXECUTE 'RESET ROLE';
  SELECT confirmed_at INTO ts FROM public.event_suppliers WHERE id = es_a;
  IF ts IS NULL THEN RAISE EXCEPTION 'confirmed: confirmed_at bos'; END IF;
  SELECT service INTO st FROM public.event_suppliers WHERE id = es_a;
  IF st <> 'Ses sistemi' THEN RAISE EXCEPTION 'service kirpilmadi: [%]', st; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.event_suppliers SET status = 'planned' WHERE id = es_a;
  EXECUTE 'RESET ROLE';
  SELECT confirmed_at INTO ts FROM public.event_suppliers WHERE id = es_a;
  IF ts IS NOT NULL THEN RAISE EXCEPTION 'planned: confirmed_at bosalmadi'; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = es_a AND entity_type = 'event_supplier' AND action = 'status_changed';
  IF n <> 2 THEN RAISE EXCEPTION 'event_supplier status_changed % (2)', n; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = es_a AND action = 'created' AND diff->>'event_id' = ev_a::text;
  IF n <> 1 THEN RAISE EXCEPTION 'event_supplier created diff event_id yok'; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.event_suppliers (organization_id, event_id, supplier_id) VALUES (org_a, ev_a, s_a);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'ayni tedarikci ikinci kez atandi';
  EXCEPTION WHEN unique_violation THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.event_suppliers (organization_id, event_id, supplier_id) VALUES (org_a, ev_a, s_yab);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'yabanci tedarikci atandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.event_suppliers (organization_id, event_id, supplier_id) VALUES (org_a, ev_k, s_a);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'baska kurulusun etkinligine atandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.event_suppliers (organization_id, event_id, supplier_id) VALUES (org_a, ev_a, s_b);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'arsivdeki tedarikci atandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;

  -- 3) ic maliyet: pro1 (commercial yok) set/list 42501; finance set 15000 + not -> list 1 satir; negatif 22023;
  --    NULL -> satir silinir (list 0); access_audit >= 3
  PERFORM set_config('request.jwt.claim.sub', pro1::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.internal_event_supplier_cost_set(es_a, 1000);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'commercial.manage olmadan tutar yazildi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM * FROM public.internal_event_supplier_costs_list(ev_a);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'commercial.view olmadan tutar okundu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', finans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.internal_event_supplier_cost_set(es_a, 15000, ' Nakit ');
  SELECT count(*), max(agreed_amount) INTO n, amt FROM public.internal_event_supplier_costs_list(ev_a);
  EXECUTE 'RESET ROLE';
  IF n <> 1 OR amt <> 15000 THEN RAISE EXCEPTION 'tutar list % / % (1 / 15000)', n, amt; END IF;
  SELECT private_note || '|' || organization_id::text INTO st FROM internal.event_supplier_costs WHERE event_supplier_id = es_a;
  IF st <> 'Nakit|' || org_a::text THEN RAISE EXCEPTION 'ic maliyet not/kurulus: %', st; END IF;
  PERFORM set_config('request.jwt.claim.sub', finans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.internal_event_supplier_cost_set(es_a, -5);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'negatif tutar girdi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.internal_event_supplier_cost_set(es_a, NULL);
  SELECT count(*) INTO n FROM public.internal_event_supplier_costs_list(ev_a);
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'NULL ile tutar silinmedi (%)', n; END IF;
  SELECT count(*) INTO n FROM internal.access_audit WHERE organization_id = org_a AND target_table = 'event_supplier_costs';
  IF n < 3 THEN RAISE EXCEPTION 'access_audit % (>=3)', n; END IF;
  -- dogrudan tablo: authenticated erisemez (42501)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM count(*) FROM internal.event_supplier_costs;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'internal tabloya dogrudan erisildi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 4) RLS: sales (musteri) okur 2 tedarikci / 1 atama, yazamaz (0); viewer (pro2) 0 + INSERT 42501; anon 42501;
  --    ince ayar: sales'e {"suppliers.manage": true} -> puan yazar; geri alinir
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.suppliers WHERE organization_id = org_a;
  IF n <> 2 THEN EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'sales % tedarikci gordu (2)', n; END IF;
  SELECT count(*) INTO n FROM public.event_suppliers WHERE organization_id = org_a;
  IF n <> 1 THEN EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'sales % atama gordu (1)', n; END IF;
  UPDATE public.suppliers SET rating = 3 WHERE id = s_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'sales yazdi (%)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', pro2::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.suppliers WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'viewer % tedarikci gordu (0)', n; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.suppliers (organization_id, name) VALUES (org_a, 'T29 viewer');
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'viewer tedarikci acti';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM count(*) FROM public.suppliers;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'anon tedarikci okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM count(*) FROM public.supplier_shortlists;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'anon kisa liste okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  UPDATE public.organization_memberships SET permissions = permissions || '{"suppliers.manage": true}'::jsonb WHERE organization_id = org_a AND user_id = musteri;
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.suppliers SET rating = 3 WHERE id = s_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  UPDATE public.organization_memberships SET permissions = permissions - 'suppliers.manage' WHERE organization_id = org_a AND user_id = musteri;
  IF n <> 1 THEN RAISE EXCEPTION 'ince ayar suppliers.manage ile sales yazamadi (%)', n; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = s_a AND action = 'updated' AND diff->'rating'->>'to' = '3';
  IF n <> 1 THEN RAISE EXCEPTION 'rating diff % (1)', n; END IF;

  -- 5) kisa liste: kurum (org_k, owner) liste + 2 kalem (pro1, pro2); kalem organization_id listeden kopyalanir;
  --    ayni saglayici ikinci kez 23505; baska kurulusun etkinligi 22023; aktivite created 1 + updated 2 (item_added);
  --    kalem cikar -> item_removed 1; liste silinince kalemler cascade, ek aktivite yok, deleted 1
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.supplier_shortlists (organization_id, name, event_id) VALUES (org_k, ' T29 kisa liste ', ev_k) RETURNING id INTO sl_k;
  INSERT INTO public.supplier_shortlist_items (shortlist_id, organization_id, provider_id, note) VALUES (sl_k, org_a, pro1, ' iyi ');
  INSERT INTO public.supplier_shortlist_items (shortlist_id, organization_id, provider_id) VALUES (sl_k, org_k, pro2);
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.supplier_shortlist_items WHERE shortlist_id = sl_k AND organization_id = org_k;
  IF n <> 2 THEN RAISE EXCEPTION 'kalem organization_id kopyasi % (2)', n; END IF;
  SELECT name INTO st FROM public.supplier_shortlists WHERE id = sl_k;
  IF st <> 'T29 kisa liste' THEN RAISE EXCEPTION 'liste adi kirpilmadi: [%]', st; END IF;
  SELECT note INTO st FROM public.supplier_shortlist_items WHERE shortlist_id = sl_k AND provider_id = pro1;
  IF st <> 'iyi' THEN RAISE EXCEPTION 'kalem notu kirpilmadi: [%]', st; END IF;
  PERFORM set_config('request.jwt.claim.sub', kurum::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.supplier_shortlist_items (shortlist_id, organization_id, provider_id) VALUES (sl_k, org_k, pro1);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'ayni saglayici ikinci kez eklendi';
  EXCEPTION WHEN unique_violation THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.supplier_shortlists SET event_id = ev_a WHERE id = sl_k;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'baska kurulusun etkinligi baglandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = sl_k AND entity_type = 'shortlist' AND action = 'created';
  IF n <> 1 THEN RAISE EXCEPTION 'shortlist created % (1)', n; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = sl_k AND action = 'updated' AND diff ? 'item_added';
  IF n <> 2 THEN RAISE EXCEPTION 'item_added % (2)', n; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  DELETE FROM public.supplier_shortlist_items WHERE shortlist_id = sl_k AND provider_id = pro2;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = sl_k AND action = 'updated' AND diff ? 'item_removed';
  IF n <> 1 THEN RAISE EXCEPTION 'item_removed % (1)', n; END IF;
  -- kurum tedarikci defteri acamaz (suppliers modulu kapali) 22023
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.suppliers (organization_id, name) VALUES (org_k, 'T29 kurum tedarikci');
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'kurum modul kapaliyken tedarikci acti';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  -- ajans: supplier_search kapali -> 22023; org_module_set ile acilir; kendi saglayicisi (0004) 22023; 0007 eklenir; kapatilir
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.supplier_shortlists (organization_id, name) VALUES (org_a, 'T29 ajans listesi');
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'modul kapaliyken ajans liste acti';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.org_module_set(org_a, 'supplier_search', true);
  INSERT INTO public.supplier_shortlists (organization_id, name) VALUES (org_a, 'T29 ajans listesi') RETURNING id INTO sl_a;
  EXECUTE 'RESET ROLE';
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.supplier_shortlist_items (shortlist_id, organization_id, provider_id) VALUES (sl_a, org_a, ajans);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'kendi saglayicisi kisa listeye girdi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.supplier_shortlist_items (shortlist_id, organization_id, provider_id) VALUES (sl_a, org_a, ajans2);
  PERFORM public.org_module_set(org_a, 'supplier_search', false);
  DELETE FROM public.supplier_shortlists WHERE id = sl_a;
  EXECUTE 'RESET ROLE';
  IF public.org_module_enabled(org_a, 'supplier_search') THEN RAISE EXCEPTION 'ajans supplier_search kapanmadi'; END IF;
  SELECT count(*) INTO n FROM public.supplier_shortlist_items WHERE shortlist_id = sl_a;
  IF n <> 0 THEN RAISE EXCEPTION 'liste silinince kalem kaldi (%)', n; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = sl_a AND action = 'updated' AND diff ? 'item_removed';
  IF n <> 0 THEN RAISE EXCEPTION 'cascade silmede item_removed yazildi (%)', n; END IF;
  SELECT count(*) INTO n FROM public.activity_logs WHERE entity_id = sl_a AND action = 'deleted';
  IF n <> 1 THEN RAISE EXCEPTION 'shortlist deleted % (1)', n; END IF;
  -- baska kurulus (ajans2, admin degil) kurumun listesini gormez; admin (ajans 0004) gorur
  PERFORM set_config('request.jwt.claim.sub', ajans2::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.supplier_shortlists WHERE id = sl_k;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'ajans2 kurumun listesini gordu (%)', n; END IF;
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.supplier_shortlists WHERE id = sl_k;
  EXECUTE 'RESET ROLE';
  IF n <> 1 THEN RAISE EXCEPTION 'admin kurumun listesini gormedi (%)', n; END IF;

  -- 6) 8b-P2 kurali: firsat sahibi crm.view tasimali — viewer (pro2) sahip 22023; sales (musteri) sahip olur
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.contacts (organization_id, full_name) VALUES (org_a, 'T29 kisi') RETURNING id INTO c_t;
  EXECUTE 'RESET ROLE';
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.crm_leads (organization_id, contact_id, title, owner_user_id) VALUES (org_a, c_t, 'T29 firsat', pro2);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'crm.view olmayan sahip atandi';
  EXCEPTION WHEN invalid_parameter_value THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.crm_leads (organization_id, contact_id, title, owner_user_id) VALUES (org_a, c_t, 'T29 firsat', musteri) RETURNING id INTO l_t;
  DELETE FROM public.crm_leads WHERE id = l_t;
  DELETE FROM public.contacts WHERE id = c_t;
  EXECUTE 'RESET ROLE';
  DELETE FROM public.notifications WHERE type = 'crm' AND body = 'Sana fırsat atandı: T29 firsat';

  -- 7) silme: A atanmisken silinemez (23503); atama silinince A silinir; deleted aktivite supplier 1 + event_supplier 1
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.suppliers WHERE id = s_a;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'atanmis tedarikci silindi';
  EXCEPTION WHEN foreign_key_violation THEN EXECUTE 'RESET ROLE'; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  DELETE FROM public.event_suppliers WHERE id = es_a;
  DELETE FROM public.suppliers WHERE id = s_a;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.activity_logs WHERE organization_id = org_a AND entity_type IN ('supplier', 'event_supplier') AND action = 'deleted';
  IF n <> 2 THEN RAISE EXCEPTION 'deleted aktivite % (2)', n; END IF;

  -- 8) temizlik
  DELETE FROM public.supplier_shortlists WHERE organization_id IN (org_a, org_k, org_b);
  DELETE FROM public.event_suppliers WHERE organization_id IN (org_a, org_k, org_b);
  DELETE FROM public.suppliers WHERE organization_id IN (org_a, org_k, org_b);
  DELETE FROM public.events WHERE id = ev_a;
  SELECT count(*) INTO n FROM public.suppliers WHERE organization_id IN (org_a, org_k, org_b);
  IF n <> 0 THEN RAISE EXCEPTION 'temizlik: % tedarikci kaldi', n; END IF;

  INSERT INTO t_sonuc VALUES (29, 'T29 FAZ 8c tedarikciler + kisa liste', 'GECTI',
    'tedarikci normalize + created_by + created 2; kendi saglayicisi 22023, ayni saglayici 23505, puan 6 / kategori 23514; crew_coordinator atadi, confirmed_at durumla, status_changed 2, diff event_id; ayni tedarikci 23505, yabanci tedarikci / baska etkinlik / arsiv 22023; ic maliyet: commercial yok 42501 (set+list), finance 15000 -> 1 satir, negatif 22023, NULL siler, access_audit >=3, tablo dogrudan 42501; sales okur 2/1 yazamaz 0, viewer 0 + 42501, anon 42501 (2 tablo), ince ayar ile sales yazdi + rating diff; kisa liste: kalem org kopyasi, kirpma, ayni saglayici 23505, baska etkinlik 22023, created 1 + item_added 2 + item_removed 1, kurum suppliers kapali 22023, ajans supplier_search kapali 22023 -> ac -> kendi saglayicisi 22023 -> 0007 eklendi -> kapat, cascade silmede ek aktivite yok + deleted 1, baska kurulus listeyi gormez / admin gorur; 8b-P2 sahip crm.view 22023; atanmis tedarikci 23503, deleted 2; temizlik');
EXCEPTION WHEN OTHERS THEN
  BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO t_sonuc VALUES (29, 'T29 FAZ 8c tedarikciler + kisa liste', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T30) Hijyen 04 bildirim temizligi. ON KOSUL: 20261024120000 (hijyen_04) dalda. Test Ajans (org_a: owner 0004, sales 0001)
--      verisine dayanir. Firsat silinince crm bildirimi, genel gorev silinince task bildirimi silinir; etkinlige bagli gorevin
--      bildirimi (etkinlik sekmesi baglantisi) KALIR.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  org_a uuid; ev_a uuid; c_t uuid; l_t uuid; g_genel uuid; g_etk uuid;
  n integer;
BEGIN
  SELECT id INTO org_a FROM public.organizations WHERE legacy_profile_id = ajans;
  IF org_a IS NULL THEN RAISE EXCEPTION 'on kosul: org_a'; END IF;
  IF to_regprocedure('public.fn_hijyen04_lead_notif_cleanup()') IS NULL THEN RAISE EXCEPTION 'on kosul: hijyen_04 uygulanmamis'; END IF;
  -- temizlik
  DELETE FROM public.crm_leads WHERE organization_id = org_a AND title LIKE 'T30%';
  DELETE FROM public.contacts  WHERE organization_id = org_a AND full_name LIKE 'T30%';
  UPDATE public.tasks SET status = 'cancelled' WHERE organization_id = org_a AND title LIKE 'T30%' AND status NOT IN ('todo', 'cancelled');
  DELETE FROM public.tasks WHERE organization_id = org_a AND title LIKE 'T30%';
  DELETE FROM public.notifications WHERE user_id = musteri AND body LIKE '%T30%';
  DELETE FROM public.events WHERE organization_id = org_a AND title = 'T30 etkinlik';

  -- 1) owner: kisi + firsat (sahip sales) -> bildirim 1; firsat silinince 0
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.contacts (organization_id, full_name) VALUES (org_a, 'T30 kisi') RETURNING id INTO c_t;
  INSERT INTO public.crm_leads (organization_id, contact_id, title, owner_user_id) VALUES (org_a, c_t, 'T30 firsat', musteri) RETURNING id INTO l_t;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = musteri AND type = 'crm' AND link = '/ajans/musteriler?firsat=' || l_t::text;
  IF n <> 1 THEN RAISE EXCEPTION 'firsat bildirimi % (1)', n; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  DELETE FROM public.crm_leads WHERE id = l_t;
  DELETE FROM public.contacts WHERE id = c_t;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'crm' AND link = '/ajans/musteriler?firsat=' || l_t::text;
  IF n <> 0 THEN RAISE EXCEPTION 'firsat silinince bildirim kaldi (%)', n; END IF;

  -- 2) owner: genel gorev (sales'e atanir) -> bildirim 1; silinince 0. Etkinlige bagli gorev -> bildirim 1; silinince KALIR (1)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.tasks (organization_id, title, assignee_user_id) VALUES (org_a, 'T30 genel gorev', musteri) RETURNING id INTO g_genel;
  INSERT INTO public.events (organization_id, owner_user_id, title, event_type, start_date, end_date)
  VALUES (org_a, ajans, 'T30 etkinlik', 'corporate', current_date + 50, current_date + 50) RETURNING id INTO ev_a;
  INSERT INTO public.tasks (organization_id, event_id, title, assignee_user_id) VALUES (org_a, ev_a, 'T30 etkinlik gorevi', musteri) RETURNING id INTO g_etk;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = musteri AND type = 'task' AND link = '/kurulus/gorevler?gorev=' || g_genel::text;
  IF n <> 1 THEN RAISE EXCEPTION 'genel gorev bildirimi % (1)', n; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = musteri AND type = 'task' AND body = 'Sana görev atandı: T30 etkinlik gorevi';
  IF n <> 1 THEN RAISE EXCEPTION 'etkinlik gorevi bildirimi % (1)', n; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  DELETE FROM public.tasks WHERE id = g_genel;
  DELETE FROM public.tasks WHERE id = g_etk;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.notifications WHERE type = 'task' AND link = '/kurulus/gorevler?gorev=' || g_genel::text;
  IF n <> 0 THEN RAISE EXCEPTION 'genel gorev silinince bildirim kaldi (%)', n; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE user_id = musteri AND type = 'task' AND body = 'Sana görev atandı: T30 etkinlik gorevi';
  IF n <> 1 THEN RAISE EXCEPTION 'etkinlik gorevi bildirimi silindi (% ; 1 kalmali)', n; END IF;

  -- 3) temizlik
  DELETE FROM public.notifications WHERE user_id = musteri AND body LIKE '%T30%';
  DELETE FROM public.events WHERE id = ev_a;

  INSERT INTO t_sonuc VALUES (30, 'T30 hijyen_04 bildirim temizligi', 'GECTI',
    'firsat bildirimi 1 -> silinince 0; genel gorev bildirimi 1 -> silinince 0; etkinlige bagli gorev bildirimi silinince kalir (1); temizlik');
EXCEPTION WHEN OTHERS THEN
  BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO t_sonuc VALUES (30, 'T30 hijyen_04 bildirim temizligi', 'HATA', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T31) FAZ 9a olay zinciri. ON KOSUL: 20261025120000 (faz9a 01) dalda. Test Ajans (org_a: owner 0004 = admin, sales 0001),
--      pro1 0002 (providers), service_roles aktif. Tetikleyiciler her gecisi BIR kez yazar; PII payload'a girmez; yalniz admin okur.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  musteri uuid := 'a0000000-0000-4000-8000-000000000001';
  pro1    uuid := 'a0000000-0000-4000-8000-000000000002';
  ajans   uuid := 'a0000000-0000-4000-8000-000000000004';
  org_a uuid; ev uuid; br uuid; run_id uuid; cand uuid; crew_id uuid; cm uuid; prop uuid; ver uuid; prop2 uuid; ver2 uuid; bk uuid; bk2 uuid; rol integer;
  n integer; n0 integer; st text; st2 text; js jsonb;
BEGIN
  SELECT id INTO org_a FROM public.organizations WHERE legacy_profile_id = ajans;
  SELECT id INTO rol FROM public.service_roles WHERE is_active ORDER BY id LIMIT 1;
  IF org_a IS NULL OR rol IS NULL THEN RAISE EXCEPTION 'on kosul: org_a=% rol=%', org_a, rol; END IF;
  IF to_regclass('public.analytics_events') IS NULL THEN RAISE EXCEPTION 'on kosul: faz9a_01 uygulanmamis'; END IF;
  SELECT count(*) INTO n0 FROM public.analytics_events;

  -- 1) brief_created (owner)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.event_briefs (created_by_user_id, organization_id, source, raw_text)
  VALUES (ajans, org_a, 'agency_eventos', 'T31 brief metni — PII: faz1test+gizli@kashe.net 0532 111 11 11') RETURNING id INTO br;
  EXECUTE 'RESET ROLE';
  SELECT count(*), max(payload::text), max(actor_user_id::text) INTO n, st, st2 FROM (SELECT payload, actor_user_id FROM public.analytics_events WHERE event_name = 'brief_created' AND entity_id = br) x;
  IF n <> 1 THEN RAISE EXCEPTION 'brief_created % (1)', n; END IF;
  IF st LIKE '%kashe.net%' OR st LIKE '%0532%' OR st LIKE '%raw_text%' THEN RAISE EXCEPTION 'brief payload PII tasiyor: %', st; END IF;
  IF st2 <> ajans::text THEN RAISE EXCEPTION 'brief actor % (owner)', st2; END IF;

  -- 2) event: draft -> confirmed -> matching (olay yok) -> cancelled
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.events (organization_id, owner_user_id, title, event_type, start_date, end_date, status)
  VALUES (org_a, ajans, 'T31 etkinlik', 'corporate', current_date + 60, current_date + 60, 'draft') RETURNING id INTO ev;
  UPDATE public.events SET status = 'confirmed', confirmed_at = now() WHERE id = ev;
  UPDATE public.events SET status = 'matching' WHERE id = ev;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.analytics_events WHERE entity_id = ev AND event_name = 'event_confirmed';
  IF n <> 1 THEN RAISE EXCEPTION 'event_confirmed % (1)', n; END IF;
  SELECT count(*) INTO n FROM public.analytics_events WHERE entity_id = ev;
  IF n <> 1 THEN RAISE EXCEPTION 'matching gecisi olay yazdi (% satir, 1 beklenir)', n; END IF;

  -- 3) match_run (INSERT olay yazmaz; candidate_count UPDATE'i yazar) + aday gosterim/tik (ikinci kez isaretleme olay eklemez)
  INSERT INTO public.match_runs (event_id, strategy, algorithm_version, params, created_by)
  VALUES (ev, 'hybrid', 'match-v0.2-test', '{"w": 1}'::jsonb, ajans) RETURNING id INTO run_id;
  SELECT count(*) INTO n FROM public.analytics_events WHERE entity_id = run_id;
  IF n <> 0 THEN RAISE EXCEPTION 'match_run INSERT aninda olay yazildi (%)', n; END IF;
  UPDATE public.match_runs SET candidate_count = 1, latency_ms = 42 WHERE id = run_id;
  SELECT count(*), max(payload->>'latency_ms'), max(algorithm_version) INTO n, st, st2 FROM (SELECT payload, algorithm_version FROM public.analytics_events WHERE entity_id = run_id AND event_name = 'match_run') x;
  IF n <> 1 OR st <> '42' OR st2 <> 'match-v0.2-test' THEN RAISE EXCEPTION 'match_run % / latency % / alg % (1 / 42 / test)', n, st, st2; END IF;
  INSERT INTO public.match_candidates (match_run_id, provider_id, role_id, match_score, final_rank, reason_codes)
  VALUES (run_id, pro1, rol, 77.5, 2, ARRAY['same_city', 'new_talent']) RETURNING id INTO cand;
  UPDATE public.match_candidates SET was_shown = true WHERE id = cand;
  UPDATE public.match_candidates SET was_shown = true WHERE id = cand;     -- tekrar: olay yok
  UPDATE public.match_candidates SET was_clicked = true WHERE id = cand;
  SELECT count(*) INTO n FROM public.analytics_events WHERE entity_id = cand;
  IF n <> 2 THEN RAISE EXCEPTION 'aday olaylari % (2: shown, clicked)', n; END IF;
  SELECT payload INTO js FROM public.analytics_events WHERE entity_id = cand AND event_name = 'match_shown';
  IF (js->>'is_new_talent')::boolean IS DISTINCT FROM true OR (js->>'final_rank') <> '2' OR js->>'provider_type' <> 'professional'
     OR (SELECT algorithm_version FROM public.analytics_events WHERE entity_id = cand AND event_name = 'match_shown') <> 'match-v0.2-test' THEN
    RAISE EXCEPTION 'match_shown payload: %', js; END IF;
  SELECT provider_id::text INTO st FROM public.analytics_events WHERE entity_id = cand AND event_name = 'match_clicked';
  IF st <> pro1::text THEN RAISE EXCEPTION 'match_clicked provider % (pro1)', st; END IF;

  -- 4) crew_selected -> crew_confirmed
  INSERT INTO public.crews (event_id, organization_id, name, strategy, algorithm_version, created_by)
  VALUES (ev, org_a, 'T31 ekip', 'hybrid', 'match-v0.2-test', ajans) RETURNING id INTO crew_id;
  INSERT INTO public.crew_members (crew_id, role_id, provider_id, pool_origin, status, match_candidate_id)
  VALUES (crew_id, rol, pro1, 'marketplace', 'proposed', cand) RETURNING id INTO cm;
  UPDATE public.crew_members SET status = 'contacted' WHERE id = cm;   -- olay yok
  UPDATE public.crew_members SET status = 'confirmed' WHERE id = cm;
  SELECT string_agg(event_name, ',' ORDER BY event_name) INTO st FROM public.analytics_events WHERE entity_id = cm;
  IF st <> 'crew_confirmed,crew_selected' THEN RAISE EXCEPTION 'crew olaylari: %', st; END IF;
  SELECT payload INTO js FROM public.analytics_events WHERE entity_id = cm AND event_name = 'crew_selected';
  IF (js->>'from_match')::boolean IS DISTINCT FROM true OR js->>'pool_origin' <> 'marketplace' OR js->>'event_id' <> ev::text THEN
    RAISE EXCEPTION 'crew_selected payload: %', js; END IF;

  -- 5) teklif: olustur (olay yok) -> kalem -> gonder (proposal_sent; item_count 1, PII yok) -> declined (proposal_declined)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  prop := public.proposal_create(org_a, 'T31 teklif', ev, NULL, 'Gizli Musteri', 'faz1test+t31@kashe.net');
  SELECT current_version_id INTO ver FROM public.proposals WHERE id = prop;
  INSERT INTO public.proposal_items (proposal_version_id, role_id, description, quantity, unit_client_price, is_visible_to_client, sort_order)
  VALUES (ver, rol, 'T31 kalem', 1, 12000, true, 1);
  SELECT count(*) INTO n FROM public.analytics_events WHERE entity_type = 'proposal' AND (entity_id = prop OR entity_id = ver);
  IF n <> 0 THEN RAISE EXCEPTION 'taslak teklif olay yazdi (%)', n; END IF;
  PERFORM public.proposal_send(prop, 14);
  PERFORM public.proposal_set_status(prop, 'declined');
  EXECUTE 'RESET ROLE';
  SELECT payload INTO js FROM public.analytics_events WHERE entity_id = ver AND event_name = 'proposal_sent';
  IF js IS NULL OR (js->>'item_count') <> '1' OR (js->>'total_amount')::numeric <> 14400 OR js::text LIKE '%Gizli%' OR js::text LIKE '%kashe.net%' THEN   -- 12000 + KDV %20
    RAISE EXCEPTION 'proposal_sent payload: %', js; END IF;
  SELECT count(*) INTO n FROM public.analytics_events WHERE entity_id = prop AND event_name = 'proposal_declined';
  IF n <> 1 THEN RAISE EXCEPTION 'proposal_declined % (1)', n; END IF;
  SELECT organization_id::text || '|' || provider_id::text INTO st FROM public.analytics_events WHERE entity_id = prop AND event_name = 'proposal_declined';
  IF st <> org_a::text || '|' || ajans::text THEN RAISE EXCEPTION 'proposal org/provider: %', st; END IF;

  -- 6) rezervasyon: created -> cancelled (satici iptali, gun farki); ikinci rezervasyon -> completed
  INSERT INTO public.bookings (proposal_version_id, seller_provider_id, customer_id, event_id, event_date, event_type, total_amount, status)
  VALUES (ver, ajans, musteri, ev, current_date + 60, 'corporate', 12000, 'confirmed') RETURNING id INTO bk;
  UPDATE public.bookings SET status = 'cancelled', cancelled_by = ajans, cancelled_at = now(), cancellation_reason = 'T31 gizli neden' WHERE id = bk;
  SELECT payload INTO js FROM public.analytics_events WHERE entity_id = bk AND event_name = 'booking_cancelled';
  IF js IS NULL OR js->>'cancelled_by_side' <> 'seller' OR (js->>'days_before_event')::int <> 60 OR js->>'shape' <> 'proposal'
     OR js::text LIKE '%gizli%' THEN RAISE EXCEPTION 'booking_cancelled payload: %', js; END IF;
  -- ikinci rezervasyon icin ikinci teklif (surum basina tek rezervasyon kurali)
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  prop2 := public.proposal_create(org_a, 'T31 teklif 2', ev, NULL, NULL, NULL);
  SELECT current_version_id INTO ver2 FROM public.proposals WHERE id = prop2;
  INSERT INTO public.proposal_items (proposal_version_id, role_id, description, quantity, unit_client_price, is_visible_to_client, sort_order)
  VALUES (ver2, rol, 'T31 kalem 2', 1, 1000, true, 1);
  PERFORM public.proposal_send(prop2, 14);
  EXECUTE 'RESET ROLE';
  INSERT INTO public.bookings (proposal_version_id, seller_provider_id, customer_id, event_id, event_date, event_type, total_amount, status)
  VALUES (ver2, ajans, musteri, ev, current_date + 61, 'corporate', 1200, 'confirmed') RETURNING id INTO bk2;
  UPDATE public.bookings SET status = 'completed', completed_at = now() WHERE id = bk2;
  SELECT string_agg(event_name, ',' ORDER BY event_name) INTO st FROM public.analytics_events WHERE entity_id = bk2;
  IF st <> 'booking_completed,booking_created' THEN RAISE EXCEPTION 'booking2 olaylari: %', st; END IF;

  -- 7) etkinlik iptali
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.events SET status = 'cancelled' WHERE id = ev;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.analytics_events WHERE entity_id = ev AND event_name = 'event_cancelled';
  IF n <> 1 THEN RAISE EXCEPTION 'event_cancelled % (1)', n; END IF;

  -- 8) RLS: admin (ajans) okur (>0), sales (musteri) 0 satir + INSERT 42501 + analytics_summary 42501; anon 42501; admin ozet huni
  PERFORM set_config('request.jwt.claim.sub', ajans::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.analytics_events;
  IF n = 0 THEN EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'admin olay okuyamadi'; END IF;
  SELECT public.analytics_summary(3650) INTO js;
  EXECUTE 'RESET ROLE';
  IF (js->'funnel'->>'brief_created')::int < 1 OR (js->'fairness'->>'shown_total')::int < 1 OR (js->'totals'->>'booking_completed')::int < 1 THEN
    RAISE EXCEPTION 'analytics_summary icerik: %', js; END IF;
  PERFORM set_config('request.jwt.claim.sub', musteri::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.analytics_events;
  EXECUTE 'RESET ROLE';
  IF n <> 0 THEN RAISE EXCEPTION 'sales % olay gordu (0)', n; END IF;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.analytics_events (event_name, entity_type, entity_id) VALUES ('brief_created', 'brief', gen_random_uuid());
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'authenticated olay yazdi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.analytics_summary(30);
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'admin olmayan ozet aldi';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM count(*) FROM public.analytics_events;
    EXECUTE 'RESET ROLE'; RAISE EXCEPTION 'anon olay okudu';
  EXCEPTION WHEN insufficient_privilege THEN EXECUTE 'RESET ROLE'; END;

  -- 9) PII taramasi (tum tablo): payload anahtarlari arasinda yasakli alan yok
  SELECT count(*) INTO n FROM public.analytics_events, LATERAL jsonb_object_keys(payload) k
   WHERE k IN ('email', 'client_email', 'phone', 'full_name', 'client_name', 'name', 'body', 'notes', 'raw_text', 'description', 'cancellation_reason', 'title');
  IF n <> 0 THEN RAISE EXCEPTION 'payload yasakli anahtar tasiyor (%)', n; END IF;

  -- 10) temizlik (olaylar ekle-yalniz, kalir; kaynak satirlar silinir)
  DELETE FROM public.bookings WHERE id IN (bk, bk2);
  DELETE FROM public.proposals WHERE id IN (prop, prop2);
  DELETE FROM public.crews WHERE id = crew_id;
  DELETE FROM public.match_runs WHERE id = run_id;
  DELETE FROM public.events WHERE id = ev;
  DELETE FROM public.event_briefs WHERE id = br;
  SELECT count(*) - n0 INTO n FROM public.analytics_events;

  INSERT INTO t_sonuc VALUES (31, 'T31 FAZ 9a olay zinciri', 'GECTI',
    'brief_created (PII yok, actor owner); event confirmed 1 / matching yok / cancelled 1; match_run INSERT yok -> UPDATE 1 (latency, alg); aday shown+clicked 2 (tekrar yok; new_talent, rank, tur, alg); crew selected+confirmed (contacted yok; from_match); teklif taslak 0 -> sent (item_count 1, 14400 KDV dahil, PII yok) -> declined (org/provider); booking cancelled (seller, 60 gun, proposal sekli, neden yok) + created/completed; admin okur + ozet (huni/adalet/toplam), sales 0 + INSERT 42501 + ozet 42501, anon 42501; yasakli anahtar 0; bu kosuda ' || n || ' olay');
EXCEPTION WHEN OTHERS THEN
  BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO t_sonuc VALUES (31, 'T31 FAZ 9a olay zinciri', 'HATA', SQLERRM);
END $$;

SELECT sira, test, sonuc, detay FROM t_sonuc ORDER BY sira;
