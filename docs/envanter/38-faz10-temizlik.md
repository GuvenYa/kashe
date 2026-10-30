# 38 — FAZ 10: Temizlik (cift yapilarin kapanmasi)

**Kaynak:** `docs/architecture/04-goc-plani.md` FAZ 10 (madde 42-45) + onceki fazlarin "FAZ 10'a" erteledigi kalemler (asagida envanter).
**Ilke:** FAZ 0-2b'de acilan cift yapilar (eski uyelik tablolari + aynalama, `profiles` -> `providers` aynasi, `profile_id` + `provider_id`
cift sutunu, `EVENT_TYPES` sabiti + eski CHECK listeleri) tek kaynaga iner. Her kesim: once UYGULAMA yeni yola gecer, sonra DB eski yolu
kapatir (yazma yetkisi kalkar, tetikleyici duser); fiziksel DROP bir sonraki hijyen turunda. Eski akislar kesilene kadar calisir durur.
**Durum (30 Ekim 2026):** 10a-DB/01 + 10a-P1 + Duzeltme 01 dalda (asama4 37/37 harness, 36 dal), uretim bekliyor (tur: Cowork kotasi);
10b-DB/01 bekleyen dosya (`docs/envanter/bekleyen/`), 10b-P1 gorevi yazildi (42); **10c plan turu yapildi, kararlar bolum 4, tasarim bolum 10c**. Sira: 10a uyelik -> 10b etkinlik turu -> 10c saglayici yazma yolu ->
10d kucukler -> kapanis (DROP'lar Hijyen 05'e, 30 gun sonra). Her dilim: migration -> dal (asama4 + asama20) -> uretim -> Claude Code ->
canli tur -> kapanis notu.

## 1. Kararlar (Guven, 27 Ekim 2026)

1. **Dort dilim, sirayla:** 10a uyelik tek tablo -> 10b etkinlik turu tek kaynak -> 10c saglayici yazma yolu + `profile_id` kesimi ->
   10d kucukler. En riskli (10c) en sonda; her dilim kendi migration'i, Claude Code gorevi ve turuyla.
2. **Eski uyelik tablolari SILINMEZ, salt okunur kalir:** uygulama yazmayi keser, aynalama tetikleyicileri ve eski RLS yazma politikalari
   kalkar, `authenticated` icin INSERT/UPDATE/DELETE yetkisi geri alinir. Fiziksel DROP (tablolar + eski fonksiyonlar + uyumluluk
   gorunumleri) **Hijyen 05**'te, 30 gun sorunsuz gecince.
3. **`profiles`'taki tasinmis alanlar SILINMEZ, salt okunur olur:** yazma `providers` / `professional_profiles` / `organization_profiles`'a
   gecer; `profiles`'taki kopyalar koruma tetikleyicisiyle kilitlenir (yalniz fonksiyon yazar) ve aynalama TERS yone doner
   (`providers` -> `profiles`), boylece 83 okuyan dosya ayni anda degismez. Sutunlar FAZ 11'de duser.
4. **Plan dokumani once** (bu dosya), sonra 10a-DB/01. Roadmap'e FAZ 10 alt maddeleri eklenir.

## 2. Envanter (27 Ekim 2026; harness = uretim semasi, repo `main`)

### Veritabani

| Yapi | Durum | FAZ 10 islemi |
|---|---|---|
| `agency_members` (2), `business_members` (0), `agency_invitations` (1), `business_invitations` (1) — harness sayilari | Uygulama yazar; `trg_faz0_sync_*` 4 tetikleyici `organization_memberships` / `organization_invitations`'a aynalar | 10a: yazma kesilir, tetikleyiciler duser, salt okunur |
| `organization_memberships` (7), `organization_invitations` (2) | Tek gercek (8-U: rol; RLS fonksiyonlari buraya bakar) | 10a: davet/kabul/cikarma RPC'leri buraya yazar |
| Eski tablolara referans veren fonksiyonlar (13): `fn_sync_agency_member`, `fn_sync_agency_invitation`, `fn_sync_business_member`, `fn_sync_business_invitation`, `on_agency_invitation_accepted_add_member`, `on_business_invitation_accepted_add_member`, `ensure_organization_for_profile`, `ensure_talent_record_for_membership`, `fn_faz5_ensure_record_for_member`, `faz5_backfill_agency_members`, `org_member_set_role`, `run_event_match`, `sync_org_talent_pool` | Bir kismi aynalama (duser), bir kismi is mantigi (yeni tabloya cevrilir) | 10a-DB/01: 4 sync + 2 accepted + 3 eski bildirim tetikleyicisi (`on_agency_invitation_insert_notify`, `on_agency_member_insert_notify_agency`, `on_business_*`) duser; `org_member_set_role`, `run_event_match`, `sync_org_talent_pool`, `ensure_talent_record_for_membership`, `fn_faz5_ensure_record_for_member`, `ensure_organization_for_profile` yalniz yeni tabloyu okur; `faz5_backfill_agency_members` duser |
| RLS fonksiyonlari `is_agency_member`, `is_business_member`, `has_business_role` | ZATEN `organization_memberships` okuyor (FAZ 0/04) | Degismez; 18 politika bunlari cagiriyor |
| Uyumluluk gorunumleri `v_agency_members`, `v_business_members` | Uygulamada 0 referans | Hijyen 05'te DROP (10a'da dokunulmaz) |
| `profiles` -> `providers` aynasi `trg_faz2_sync_profile_to_provider`, `trg_faz2b_sync_primary_role`, `trg_faz0_sync_profile_to_organization`, `trg_faz5_sync_talent_contact` | Profil formu `profiles`'a yazar, tetikleyici tasir | 10c: yon degisir (yazma yeni tablolara; `profiles` kopyasi fonksiyonla dolar) |
| `services` -> `provider_services` aynasi `trg_faz2b_sync_services`, `trg_faz2b_sync_new_provider` | `hizmetlerim` `services`'a yazar (15 cagri), `provider_services` 2 cagri | 10c plan turunda netlesir: `services` paket/aciklama alanlari `provider_services`'te yok — ayna KALABILIR (bkz. acik soru 1) |
| Cift sutun: `services.profile_id`, `portfolio_items.profile_id`, `profile_experiences.profile_id`, `reviews.professional_id`, `favorites.professional_id` + hepsinde `provider_id` (NULL olabilir; `trg_faz2b_set_provider_id` turetir) | Uygulamada `profile_id` 108 gecis | 10c: `provider_id` NOT NULL + CASCADE; eski sutun kalir (tetikleyici tersten doldurur), FAZ 11'de duser |
| `profiles` tasinmis alanlar: `approval_status`, `approval_note`, `approved_at`, `suspended_at/reason/by`, `is_published`, `city_id`, `bio`, `primary_category_id`, `attributes`, `category_attributes`, `views_count` | `providers` + alt profillerde kopya var; yazma hala `profiles`'a (8 dosya: `profil/duzenle/actions.ts`, `avatar-upload.tsx`, `kategori-bilgileri/actions.ts`, `admin/actions.ts` 9 yazma, `auth/callback`, `auth/confirm`, `supabase-middleware.ts`, `premium/actions.ts`) | 10c: `premium_*`, `last_seen_at`, `role`, `is_admin`, `full_name`, `email`, `phone`, `kvkk_approved_at`, `welcome_email_sent_at` HESAP alanidir, `profiles`'ta KALIR; tasinmis alanlar salt okunur + ters ayna; `views_count` `providers`'a tasinir (`increment_profile_views`) |
| `event_type` CHECK listeleri: `conversations_event_type_check`, `listings_event_type_check`, `bookings_event_type_check`; `quote_requests.event_type` serbest text | `events.event_type` ZATEN FK (FAZ 4a); 15 anahtar | 10b: dort sutun FK -> `event_types(key)`; CHECK'ler duser; asama11 K1 emekli |
| `bookings` eski `public` rollu politikalar (`Bookings visible to participants`, `Customers read own`, `Professionals read own`, `Parties update own`, `Assigned pros read team`) | anon'a 42501 ama `public` rolu gereksiz genis | 10d: `TO authenticated` |

### Uygulama (repo `main`, 27 Ekim)

| Alan | Sayi | Dosyalar |
|---|---|---|
| Eski uyelik tablolarina yazma | 10 cagri / 2 dosya | `app/ajans/agency-actions.ts` (inviteProfessional, cancelInvitation, acceptInvitation, declineInvitation, removeMember, leaveAgency, updateMemberRole), `app/kurumsal/business-actions.ts` (ayni yedi akis) |
| Eski uyelik tablolarini okuma | 12 dosya | `agency-actions.ts`, `business-actions.ts`, `app/lib/business-write.ts` (5), `app/ajans/havuz/{page,havuz-actions}`, `app/davetlerim/page.tsx`, `app/mesajlar/{[id]/page,actions}`, `app/p/[id]/page.tsx`, `app/profil/{ekibim,kurumsal-ekip}/page.tsx`, `app/profil/page.tsx` |
| `organization_memberships` okuma | 7 dosya / 9 cagri | 8-U ile gelenler (ekip sayfalari rol kutusu vb.) |
| `EVENT_TYPES` sabiti | 12 dosya / 20 gecis | `app/mesajlar/data.ts` (kaynak), `ilanlar/{ilanlar-listesi,listings-data,yeni/yeni-ilan-formu}`, `kesfet/kesfet-filters.tsx`, `lib/{brief-config,category-fields,etkinlik-turu,filter-config}.ts`, `profil/kategori-bilgileri/kategori-form.tsx`, `teklif-topla/{page,teklif-topla-formu}` |
| `from('profiles')` | 83 dosya / 145 cagri (2c kesim listesi: kimlik 70, operasyon 5, yazma-yolu 12, admin 33; pazaryeri 0) | 10c yalniz YAZMA yolunu tasir; okumalar kalir (ters ayna) |
| `profile_id` | 108 gecis | 10c-P1: okuma/yazma `provider_id`'ye |
| `views_count` | `increment_profile_views` RPC (`/p/[id]`), `own-profile.ts`, ilanlar (ilan sayaci AYRI, dokunulmaz) | 10c |

## 3. Dilimler

### 10a — Uyelik tek tablo (madde 43-44)

**10a-DB/01** (`20261028120000_faz10a_01_uyelik_tek_tablo.sql`):
- RPC'ler (SECURITY DEFINER, `has_org_permission(org, 'members.manage')` ya da owner/admin; 22023 Turkce metin):
  `org_invitation_create(p_org, p_email, p_role, p_message)` (e-posta normalize; ayni e-postaya acik davet 23505; kurulus turune gore
  izinli roller — `validate_*_membership_roles` kurali tasinir), `org_invitation_cancel(p_id)`, `org_invitation_respond(p_id, p_accept)`
  (davetli oturum sahibi: `invited_user_id = auth.uid()` ya da e-posta eslesmesi; kabulde `organization_memberships` satiri + FAZ 5
  `ensure_talent_record_for_membership`), `org_member_remove(p_org, p_user)` (owner cikarilamaz; son owner kurali 8-U ile ayni),
  `org_member_leave(p_org)` (son owner ayrilamaz). Rol degisimi mevcut `org_member_set_role`.
- Bildirimler yeni tablolarda: `fn_faz10_invitation_notify` (davetliye `/davetlerim`), `fn_faz10_member_notify` (kurulus sahibine "ekibe
  katildi"); eski `on_*_insert_notify*` tetikleyicileri duser. `notifications.type` mevcut degerler (`agency`/`business`?) — kontrol
  edilir, yeni tip gerekirse CHECK'e eklenir.
- Aynalama KAPANIR: `trg_faz0_sync_*` 4 tetikleyici + `on_*_invitation_accepted_add_member` 2 duser. Eski tablolar salt okunur:
  tum RLS INSERT/UPDATE/DELETE politikalari duser, `REVOKE INSERT, UPDATE, DELETE ... FROM authenticated`; SELECT kalir (uygulama P1 bitene
  kadar okur). `organization_memberships` / `organization_invitations` icin okuma politikalari gozden gecirilir (uye kendi kurulusunu,
  davetli kendi davetini gorur).
- `run_event_match`, `sync_org_talent_pool`, `ensure_talent_record_for_membership`, `fn_faz5_ensure_record_for_member`,
  `ensure_organization_for_profile`, `org_member_set_role` icindeki eski tablo referanslari yeni tabloya cevrilir;
  `faz5_backfill_agency_members` duser.
- Dolum: kesim aninda eski ve yeni tablolar zaten esit olmali (FAZ 0 aynasi); migration basinda `asama5` benzeri esitlik kontrolu, fark
  varsa RAISE (uygulanmaz).

**10a-P1 (Claude Code):** `agency-actions.ts` + `business-actions.ts` yedi akis RPC'lere; `business-write.ts` 5 okuma
`organization_memberships`'e; `davetlerim`, `ekibim`, `kurumsal-ekip`, `havuz`, `mesajlar`, `/p/[id]`, `profil/page.tsx` okumalari yeni
tablolara; eski tablo adi uygulamada 0'a iner. Tur: gmail ajans davet -> hotmail kabul -> ekipte gorunur -> rol degistir -> cikar;
testguven kurum ayni akis; `/davetlerim`.

**Test:** asama4 T3/T4/T8 (eski akisi sinayan) yeni RPC'lere uyarlanir (ya da ATLANDI isaretlenip T34 gelir); **T34** FAZ 10a
(davet -> kabul -> uyelik + talent record, iptal, ret, cikarma kurallari, son owner, bildirimler, eski tabloya INSERT 42501);
**asama20** (yeni kontrol dosyasi) K1 eski tablolara `authenticated` yazma yetkisi 0 + yazma politikasi 0, K2 eski = yeni sayilar (kesim
ani; sonra bilgi), K3 eski tabloya referans veren fonksiyon sayisi (yalniz izinli liste), K4 bildirim tetikleyicileri yeni tabloda.

### 10b — Etkinlik turu tek kaynak

**10b-DB/01** (`20261029120000_faz10b_01_etkinlik_turu_fk.sql`): `conversations`, `listings`, `bookings`, `quote_requests`
`event_type` -> FK `event_types(key)` ON UPDATE CASCADE; once veri kontrolu (anahtar disi deger varsa `other`'a cevrilir ve sayisi
loglanir); uc CHECK duser. asama11 K1 ("CHECK listesi = tablo") emekli; yerine asama20 K5 (FK var, CHECK yok).

**10b-P1:** `EVENT_TYPES` sabiti silinir; tek kaynak `event_types` tablosu — sunucu yardimcisi `app/lib/etkinlik-turu.ts`
(`etkinlikTurleri()`; `unstable_cache` ya da istek basina), istemci bilesenlere prop. 12 dosya. Tur: ilan formu, Kesfet filtresi,
teklif-topla, kategori bilgileri, mesaj basligi.

### 10c — Saglayici yazma yolu + `profile_id` kesimi (madde 43, 45) — PLAN (kararlar bolum 4; 30 Ekim 2026)

Envanter (harness = uretim semasi): `providers` (approval/suspend/is_published/city_id/slug/display_name), `professional_profiles`
(bio, headline, experience_years, languages, equipment, pricing), `organization_profiles` (about, team_size_range, ...); authenticated'in
uc tabloda yalniz SELECT'i var (yazma bugun yalniz ayna tetikleyicileriyle). `profiles` tasinmis alanlar: `approval_status`,
`approval_note`, `approved_at`, `suspended_at/reason/by`, `is_published`, `city_id`, `bio`, `primary_category_id`, `attributes`,
`category_attributes`, `views_count`. Hesap alanlari `profiles`'ta KALIR: `role, is_admin, full_name, company_name, email, phone,
avatar_url, premium_tier/until, last_seen_at, kvkk_approved_at, welcome_email_sent_at, default_allowed_applicant_roles`.
Ileri ayna `fn_sync_profile_to_provider` bugun display_name/city/approval/is_published/bio tasiyor; `fn_faz2b_sync_primary_role`
`profiles.primary_category_id` -> `provider_services` birincil satiri. `provider_id` 5 tabloda NULL sayisi 0 (harness: services 300,
experiences 361, reviews 82, favorites 110, portfolio 0); FK'ler `ON DELETE SET NULL`.

**10c-1 / DB/01** (`20261101120000_faz10c_01_saglayici_yazma_yolu.sql`, 10b uretimden sonra):
- `providers.attributes jsonb`, `providers.category_attributes jsonb` (+ GIN `jsonb_path_ops` `idx_providers_category_attributes_gin`),
  `providers.views_count int NOT NULL DEFAULT 0`; dolum `profiles`'tan (saglayici satiri olanlar); eski GIN indeks 10c-2'de duser
  (okuyan kalmadiginda).
- `v_providers_public`: `attributes`, `category_attributes`, `primary_category_id` (-> `service_roles.legacy_category_id` uzerinden
  birincil rolden), `views_count` saglayici tarafindan okunur; sutun adlari ve sirasi DEGISMEZ (uygulama ve asama10 sozlesmesi).
- Yazma yolu: GRANT UPDATE (city_id, district, service_radius_km, is_published, attributes, category_attributes, approval_status,
  approval_note, approved_at, suspended_at, suspension_reason, suspended_by) ON providers TO authenticated; politika
  `providers_update_own` (`id = auth.uid()`) + `providers_update_admin` (`is_admin`); `protect_sensitive_provider_fields` admin disi
  icin onay/guven alanlarini geri alir (mevcut). `professional_profiles` / `organization_profiles`: GRANT UPDATE (icerik sutunlari)
  + `*_update_own` (`provider_id = auth.uid()`). RPC `provider_set_primary_category(p_category_id int)`: sahip; `provider_services`
  birincil satirini degistirir (`recompute_provider_services` mantigi), `profiles.primary_category_id` aynayla dolar.
- `increment_profile_views(profile_id_param)` -> `providers.views_count` (+1); `profiles.views_count` aynayla.
- Ters ayna `trg_faz10c_sync_provider_to_profile` (providers AFTER UPDATE; professional_profiles / organization_profiles AFTER
  INSERT/UPDATE; provider_services birincil degisimi): `profiles` kopyalari `kashe.sync_bypass='on'` ile yazilir.
- Koruma `protect_profiles_moved_fields` (profiles BEFORE UPDATE): `kashe.sync_bypass` degilse tasinmis alanlar `OLD` degerinde
  kalir (admin DAHIL — tek yazma yolu saglayici tarafi); `protect_sensitive_profile_fields`'in onay/askiya dallari bu tetikleyiciye
  tasinir (role/is_admin korumasi orada kalir).
- Ileri ayna daraltilir: `fn_sync_profile_to_provider` yalniz `display_name` (full_name/company_name) ve `talents.full_name`;
  `fn_faz2b_sync_primary_role` DUSER (yon degisti). `ensure_provider_for_profile` kayitta ilk satiri acmaya devam eder (role'e gore).
- Esitlik kontrolu migration basinda: `profiles` x `providers` tasinmis alanlar farki 0 olmali (FAZ 2a aynasi), fark varsa RAISE.
- Sahne: uretec v3 — profil guncellemeleri `providers` / alt profillere (admin JWT yerine `kashe.sync_bypass` ya da sahip JWT);
  `01` dosyasinda `attributes`/`category_attributes` `providers`'a.
- Test: asama4 **T37** (sahip providers/alt profil yazar -> profiles kopyasi dolar; profiles tasinmis alana yazim sessiz geri alinir;
  admin onay providers'tan -> kopya; views RPC; birincil kategori RPC; anon/baskasi 42501), asama20 **K8** (GRANT/politika sayilari,
  ayna tetikleyicileri, esitlik), asama10 gorunum sozlesmesi degismez (ESIT).

**10c-1 / P1 (Claude Code):** `profil/duzenle/actions.ts` (bio -> professional_profiles.bio / organization_profiles.about; city_id,
attributes -> providers; primary_category_id -> `provider_set_primary_category`; `approval_status='pending'` sifirlamasi providers'a;
hesap alanlari full_name/company_name/phone profiles'ta kalir — payload ikiye bolunur), `profil/duzenle` yayin dugmesi
(`is_published` -> providers), `kategori-bilgileri/actions.ts` (`category_attributes` whitelist merge -> providers), `admin/actions.ts`
(onay/ret/revizyon/askiya alma/kaldirma -> providers; premium/is_admin profiles'ta kalir), `admin/profiller` sorgulari (durum suzgeci
`providers.approval_status` ya da `v_providers_public`), `p/[id]/profile-views-actions.ts` (RPC adi ayni), `own-profile.ts`
`PROFILE_OPEN_COLUMNS` tasinmis alanlar `v_providers_public`/providers'tan. Kesfet, /p/[id], ana sayfa okumalari DEGISMEZ (gorunum).
Tur (Sahne): profesyonel profil duzenle (bio/sehir/kategori/ozellikler) -> /p/[id] ve Kesfet yansir; yayina al/kaldir; admin onay ->
Kesfet'te gorunur; goruntulenme sayaci; `profiles` dogrudan yazimi (SQL Editor) geri alinir.

**10c-2 / DB/02** (`20261102120000_faz10c_02_provider_id_kesimi.sql`, 10c-1 uretimden sonra): 5 tabloda `provider_id` NOT NULL
(once NULL 0 dogrulanir, RAISE), FK `ON DELETE CASCADE`; `trg_faz2b_set_provider_id` yon degistirir (`provider_id` -> `profile_id` /
`professional_id` doldurur; istemci eski sutunu gondermezse de dolar); eski GIN indeks (`profiles.category_attributes`) duser;
asama4 **T38**, asama20 **K9**. **P2:** 108 `profile_id`/`professional_id` gecisi `provider_id`'ye (okuma + yazma; `reviews.professional_id`
ve `favorites.professional_id` dahil), tipler; eski sutunlar FAZ 11'e kadar kalir (tetikleyici doldurur). Tur: portfoy/hizmet/deneyim
ekle-sil, favori, yorum; /p/[id] ve Kesfet degismez.

### 10d — Kucukler

`bookings` eski politikalar `TO authenticated`; `ensure_organization_for_profile` sadeletirme; `profile_approval_status` enum adi
(KOZMETIK — yapilmaz); asama kontrol dosyalarinin FAZ 10 sonrasi durumu (asama5 aynalama kontrolleri emekli/bilgi; asama7/9/10/11
gozden gecirilir); CLAUDE.md "FAZ 10'a kadar" cumleleri temizlenir.
Sahne turunda eklenen (27 Ekim 2026): `app/components/sections/featured-profiles.tsx` satir 61 `tierWeight` icindeki `Date.now()`
eslint `react-hooks/purity` hatasi veriyor (onceden var; derlemeyi engellemiyor) — `Date.now()` bilesen govdesinden once tek sefer
alinir (`const now = Date.now()` sunucu fonksiyonunun basinda) ya da `premium_until` karsilastirmasi `isPremiumActive` yardimcisina
tasinir; `npx eslint app/components/sections` temiz olmali.

### Hijyen 05 (30 gun sonra, ayri)

DROP: `agency_members`, `business_members`, `agency_invitations`, `business_invitations`, `v_agency_members`, `v_business_members`,
eski fonksiyonlar (`fn_sync_*`, `on_*_accepted_add_member`, `validate_*_membership_roles`, `map_legacy_member_role`?), `profiles`
tasinmis sutunlar + ters ayna, `profile_id`/`professional_id` eski sutunlar + tetikleyici. Her biri once "0 referans" kaniti ile.

## 4. Acik sorular — KARARLAR (10c plan turu, Guven, 30 Ekim 2026)

1. **`services` kalir, ayna kalir.** Pazaryeri paketleri (`title/description/duration_hours/is_active/price_starting`) `services`'te;
   `provider_services` turev olmaya devam eder (`trg_faz2b_sync_services`). 10c yalniz `services.provider_id` NOT NULL + ters turetmeye
   dokunur. (b) secenegi — `provider_services` genislemesi — FAZ 11'e not.
2. **Admin onay/askiya alma ve `is_published` `providers`'a yazilir; `profiles` kopya.** Admin paneli ve profil duzenleme
   `providers.approval_status / approval_note / approved_at / suspended_* / is_published` yazar; ters ayna `profiles` kopyasini doldurur;
   83 okuyan dosya degismez. `profiles`'taki kopyalar koruma tetikleyicisiyle kilitlenir (yalniz ayna yazar; kullanici/admin yazimi
   sessiz geri alinir — FAZ 2a deseni).
3. **`increment_profile_views` -> `providers.views_count`.** `profiles.views_count` ters aynayla dolar (`/profil` okuması degismez).
   Ilan sayaci (`listings.views_count`) AYRI, dokunulmaz.
4. **`attributes` / `category_attributes`: `providers`'a iki jsonb sutun** (GIN `jsonb_path_ops` indeksi tasinir); `v_providers_public`
   oradan okur; Kesfet containment sorgulari, sihirbaz sayaci ve Sahne ureteci sema olarak degismez (yalniz hedef tablo). Satir tablosu
   (`provider_attributes`, per-alan sorgu / deger sozlugu / AI ozellikleri) **FAZ 11/12'de ayri tasarim turu**; o zaman jsonb'den tabloya
   tek migrasyonla tasinir. Ilk tercih satir tablosuydu; belge sekilli moduller (ekipman.items[], performans.details{}, sosyal_erisim.platforms[])
   ve "en riskli dilim kucuk adimlarla" ilkesi nedeniyle jsonb'de karar kilindi.
5. **10c iki alt dilim:** 10c-1 yazma yolu (DB/01 + P1 + tur + uretim), 10c-2 `provider_id` kesimi (DB/02 + P2 + tur + uretim).
6. **Yazma modeli (10c-1):** sahibin kendi saglayici satirina DOGRUDAN UPDATE (RLS `id = auth.uid()` + sutun duzeyi GRANT; koruma
   tetikleyicisi `protect_sensitive_provider_fields` admin disi icin onay/guven alanlarini zaten geri aliyor) — bugunku `profiles`
   modeliyle ayni; admin icin `providers_update_admin` politikasi. Tek RPC: `provider_set_primary_category(p_category_id)` (birincil rol
   degisimi `provider_services.is_primary` ile; `profiles.primary_category_id` kopyasi aynayla dolar). Kural tasiyan baska yazim yok.

## 5. Dilimler ve dogrulama (ozet)

| Dilim | Icerik | Test |
|---|---|---|
| **10a-DB/01** | davet/uyelik RPC'leri, bildirim tetikleyicileri yeni tabloda, aynalama kapanir, eski tablolar salt okunur — **YAZILDI** (bolum 6) | asama4 **T34** + T3/T4/T7/T8/T9/T10/T17/T18/T19/T25 uyarlama (35/35); **asama20** K1-K6; asama18 K2/K3 ve asama5 K3-K6 10a'ya uyarlandi |
| **10a-P1** | 7+7 akis RPC'ye, 12 dosyada okuma yeni tabloya; eski tablo adi 0 (`40-claude-code-gorevi-10a-p1-uyelik.md`) | tur (Sahne): ajans davet -> kabul -> ekipte gorunur -> rol degistir -> cikar; kurum ayni akis; `/davetlerim`; `/p/[id]` ekip |
| **10b-DB/01** | 4 sutun FK `event_types`; CHECK'ler duser — **HAZIR, BEKLEYEN DOSYA** `docs/envanter/bekleyen/20261031120000_faz10b_01_etkinlik_turu_fk.sql` (10a + Duzeltme 01 uretime cikinca `supabase/migrations/`e tasinir) | asama4 **T36** (37/37 harness), asama20 **K7** (10b yoksa BEKLIYOR), asama11 K1 EMEKLI |
| **10b-P1** | `EVENT_TYPES` silinir; 17 dosya tablodan okur (`42-claude-code-gorevi-10b-p1-etkinlik-turu.md`, bekleyen) | tur: ilan formu, Kesfet, teklif-topla, kategori bilgileri, konusma karti |
| **10c-1 DB/01** | providers jsonb sutunlar + views_count, yazma yolu (RLS/GRANT + `provider_set_primary_category`), ters ayna, koruma, ileri ayna daralir | asama4 **T37**; asama20 **K8**; asama10 ESIT |
| **10c-1 P1** | profil duzenle / kategori bilgileri / admin / yayin / views yazmalari saglayici tarafina | tur: profil duzenle, admin onay, yayin, sayac; Kesfet ve /p/[id] degismez |
| **10c-2 DB/02** | `provider_id` NOT NULL + CASCADE, `set_provider_id` yon degisimi, eski GIN duser | asama4 **T38**; asama20 **K9** |
| **10c-2 P2** | 108 `profile_id`/`professional_id` gecisi `provider_id`'ye | tur: portfoy/hizmet/deneyim/favori/yorum |
| **10d** | politikalar, kontrol dosyalari, CLAUDE.md | asama20 K10 |
| **Kapanis** | 38 bolum 6, CLAUDE.md FAZ 10 paragrafi, roadmap, 04-goc-plani madde 42-45 | — |

Kirmizi cizgiler: her kesimde once uygulama yeni yola gecer, DB sonra kapatir (ters sira eski sayfalari kirar); fiziksel DROP bu fazda
YOK; `internal.*` ve FAZ 6-9 yapilarina dokunulmaz; her dilim asama4 + asama20 ile dalda, asama20 ile uretimde dogrulanir.

## 6. Kapanis notlari

### KALDIGIMIZ YER (30 Ekim 2026 — Cowork kotasi acilinca SIRA)

1. **Tur** — `duzeltme-01` onizlemesi (`https://kashe-git-duzeltme-01-guvenyapicioglu-8124s-projects.vercel.app`, Sahne v2 verisi):
   (a) 10a: Arti Bir Ajans (`sahne+ajans-arti-bir@kashe.net`) `/profil/ekibim` -> bekleyen davet listesi (Sahne v2: `docs/sahne/hesaplar.md`
   Davetler) -> yeni davet `sahne+baris-arslan@kashe.net` (Izleyici) -> cift davet uyarisi -> Baris ile `/bildirimler` "Ekip" + `/davetlerim`
   kabul -> ekipte / `/ajans/havuz` kaydi -> rol degistir -> cikar; kurum `sahne+kurum-akdeniz-gida@kashe.net` -> `sahne+bahar-keskin@kashe.net`
   daveti -> kabul -> `/profil/kurumsal-ekip`; `/p/<arti-bir>` ekip (rol rozeti yok), `/p/<uye>` temsil eden ajans.
   (b) Duzeltme 01 (41 bolum 12): `/p/<pro>` anonim "N TAMAMLANMIS IS" cipi; `/rezervasyon/<tamamlanan>` "Yorum birak" -> modal;
   `/ajans` acik islerde suresi gecmis teklif yok; `/admin` onay karti; `/admin/zeka` baslik KPI <= %100; teklif gonderiminde portal
   baglantisi onizleme alan adinda; Kesfet filtresinde test kategorileri yok; avatarsiz pro'da kategori ikonu; sihirbaz 4. adim 4/5 rol kutusu;
   konusma sekmesi "Mesaj — <ad> — Kashe". (c) Kalan: admin itiraz karari (Merve Avci — Sahne v2 yuklemesi itirazi sildi, turda yeniden
   acilir), kurum RFP/uye yetkileri, portfoy yukleme (#27), Teklif Al TARIH/KISI (#31).
2. **Uretim (tek oturum):** `git checkout main` -> `git merge --no-ff duzeltme-01` (10a-db + 10a-p1 + duzeltme-01 icerir) -> `git push`
   (Vercel uretim derlemesi baslar) -> HEMEN `supabase link --project-ref qydsooqmflrrwtgawhsv` -> `supabase db push` (iki migration:
   20261028 faz10a_01, 20261030 duzeltme_01) -> yayin biter -> uretimde SQL Editor salt okunur: asama20 (K1/K3/K4/K5 ESIT, K7 BEKLIYOR),
   asama5 (K3-K6 EMEKLI), asama18/asama19 ESIT. Vercel Preview `NEXT_PUBLIC_SITE_URL` gecici degeri kaldirilabilir (#16 kodla cozuldu).
   Sonra kapanis satiri (bolum 6), roadmap, CLAUDE.md FAZ 10a + Duzeltme 01 notu, `04-goc-plani` madde 43-44.
3. **10b:** `git checkout -b faz10b/db` -> `git mv docs/envanter/bekleyen/20261031120000_faz10b_01_etkinlik_turu_fk.sql supabase/migrations/`
   -> dal `supabase db push` -> asama4 (T36 GECTI), asama20 (K7 ESIT), asama11 (K1 EMEKLI) -> `faz10b/p1` + `42` gorevi -> tur (ilan formu,
   Kesfet, teklif-topla, kategori bilgileri, konusma karti) -> uretim.
4. **10c:** bolum 10c tasarimina gore DB/01 harness'ta yazilir (T37, K8, asama10 ESIT) -> dal -> P1 -> tur -> uretim; sonra DB/02 + P2.
5. **Sahne v3** (10c-1 ile birlikte): uretec provider tarafina yazar.

### (eski) KALDIGIMIZ YER (29 Ekim 2026, Cowork haftalik kotasi doldu)

- **Dalda uygulandi:** `faz10a/db` (migration + testler) dal projesine `supabase db push` ile gitti; asama4 35/35, asama20 ESIT,
  asama18 ESIT, asama5 K3-K6 EMEKLI — hepsi Sahne dalinda dogrulandi. **10a-P1** `faz10a/p1` dalinda commit'li ve push'lu
  (28 dosya + `app/lib/uyelik.ts`; diff okundu, CRLF->LF duzeltildi, tsc temiz). Onizleme:
  `https://kashe-git-faz10a-p1-guvenyapicioglu-8124s-projects.vercel.app` (Sahne verisine bagli).
- **Tur basladi, yarim kaldi:** Arti Bir Ajans (`sahne+ajans-arti-bir@kashe.net`) ile `/profil/ekibim` acildi — 5 uye yeni tablodan,
  ince rol kutulariyla dogru listelendi; "Davet gonder" formu acildi, davet GONDERILMEDI.
- **Kalan tur (sirasiyla):** (1) ajans -> `sahne+baris-arslan@kashe.net` daveti (rol Izleyici) -> `/profil/ekibim` davet listesinde
  "Bekliyor"; ayni e-postaya ikinci davet -> "Bu e-postaya zaten bekleyen bir davet var."; (2) Baris ile giris -> `/bildirimler` "Ekip"
  bildirimi -> `/davetlerim` ad+avatar -> Kabul -> `/profil`de "uyesi oldugum ajans"; (3) ajans -> ekipte gorunur, ajansa "katildi"
  bildirimi, `/ajans/havuz`da kayit, rol degistir (Satis), Cikar -> havuz kaydi "ayrildi"; (4) kurum `sahne+kurum-akdeniz-gida@kashe.net`
  -> `sahne+bahar-keskin@kashe.net` daveti -> kabul -> `/profil/kurumsal-ekip`; (5) `/p/<arti-bir id>` ekip listesi (yalniz yayindaki
  uyeler, rol rozeti yok), `/p/<uye id>` "temsil eden ajans"; (6) admin itiraz karari (Merve Avci), kurum RFP/davet/uye yetkileri turu,
  portfoy yukleme, Teklif Al TARIH/KISI, portal URL (bulgular.md #31/#16).
- **Tur bitince uretim (tek oturum):** `faz10a/db` + `faz10a/p1` -> `main` birlestir, push (Vercel uretim derlemesi baslar) ->
  HEMEN `supabase link --project-ref qydsooqmflrrwtgawhsv` + `supabase db push` -> yayin biter -> uretimde SQL Editor: asama20
  (K1/K3/K4/K5 ESIT) ve asama5 (K3-K6 EMEKLI) salt okunur. Sonra bu bolume kapanis satiri, roadmap v23, `CLAUDE.md` FAZ 10a notu.
- Sonraki dilim 10b (etkinlik turu tek kaynak) ancak 10a uretimde ve tur temizse.
- **29 Ekim ek:** Sahne v2 dala yuklendi (bekleyen davetler tur icin hazir, `docs/sahne/hesaplar.md` Davetler). **Duzeltme 01** (bulgular;
  DB `20261030120000_duzeltme_01_sahne_bulgulari.sql` dalda uygulandi, asama4 36/36; P1 `duzeltme-01` dalinda, diff okundu, tsc temiz).
  Tur `duzeltme-01` onizlemesinde yapilir (`kashe-git-duzeltme-01-...vercel.app`): 10a maddeleri + duzeltme maddeleri (41 bolum 12) birlikte.
  Uretim: `duzeltme-01` -> `main` (10a-db + 10a-p1 + duzeltme-01 birlikte) + `supabase db push` (iki migration).
- **10b-DB/01 hazir (29 Ekim, bekleyen):** `docs/envanter/bekleyen/20261031120000_faz10b_01_etkinlik_turu_fk.sql` — migrations klasorune
  KONMADI ki dalda/uretimde erken uygulanmasin. Sirasi gelince: `git mv docs/envanter/bekleyen/20261031120000_faz10b_01_etkinlik_turu_fk.sql
  supabase/migrations/` -> dal `supabase db push` -> asama4 (T36 GECTI), asama20 (K7 ESIT), asama11 (K1 EMEKLI) -> `42` gorevi (10b-P1).
  Harness'ta 10a + duzeltme_01 + 10b uzerinde asama4 37/37.

### 10a-DB/01 — `supabase/migrations/20261028120000_faz10a_01_uyelik_tek_tablo.sql` (28 Ekim 2026; harness'ta dogrulandi, dal/uretim bekliyor)

Plandan sapmalar ve kararlar (migration basligi ayrintili):

1. **Bildirim tipi `team`:** `notifications.type` CHECK'e eklendi (davet + katilim; eski tetikleyiciler `message` kullaniyordu). E-posta
   kuyruguna girmez (Edge Function yalniz rfp/proposal/task/crm). Uygulama etiketi 10a-P1: `team: 'Ekip'` (bilinmeyen tip zaten "Bildirim").
   Kurum uyesi katilim baglantisi `/profil/kurumsal-ekip` (eski tetikleyici yanlislikla `/profil/ekibim` veriyordu).
2. **Acik ekip sozlesmesi `organization_team_public`** (gorunum, `security_invoker = false`, anon/authenticated SELECT): eski
   `agency_members` "Agency members are public" (USING true) politikasinin karsiligi. Yalniz ajans kuruluslari; ajans VE uye `providers`'ta
   yayinda + onayli + askida degil; rol ACILMAZ. `/p/[id]` ekip listesi ve profesyonelin "temsil eden ajans" listesi bunu okur;
   `organization_memberships` SELECT politikasi degismedi (uye kendi kurulusunu gorur; T8 8h sayilari korundu).
3. **Davet kurallari RPC'de:** e-posta normalize (lower/trim), owner rolu verilemez, kendine / kurulusun kendi hesabina / zaten uyeye davet
   22023, bekleyen cift 23505 (EXCLUDE kisiti FAZ 0'dan kaldi, RPC once bakar), mesaj <= 1000. Kabulde ajans kurulusuna yalniz
   `professional` hesap (eski `validate_agency_membership_roles` + uygulama kurali), kurumsal kurulusa herhangi bir hesap; kurulusun kendi
   hesabi uye olamaz (eski `no_self_membership`). Suresi dolmus davet: 22023, **durum `pending` kalir** (RAISE yazimi geri alir; arayuz
   `expires_at`'a bakar; plan "expired olur" diyordu).
4. **FAZ 5 havuz kaydi kabulde:** modul acik + `talents` kaydi varsa `fn_faz5_ensure_record_for_member(uyelik)`; hata kabulu bozmaz
   (WARNING). Ayrilip yeniden katilan uye: eski kaydin izi (`legacy_agency_member_id`) silinmis uyelige bagliysa yeni uyelige tasinir
   (eskiden `otr_org_talent_key` 23505 verirdi). `legacy_agency_member_id` artik `organization_memberships.id` tasir (ayna satirlarinda iki id
   zaten ayni); sutun adi Hijyen 05'te. `ensure_talent_record_for_membership(p_membership_id)` — parametre adi degisti (P1 cagriyi gunceller).
5. **Cikarma/ayrilma:** `org_member_remove` kendini (22023) ve `owner_seed`'i (22023) cikaramaz; owner/admin uyeyi yalniz owner (ya da platform
   yoneticisi) cikarir (42501), son owner cikarilamaz; `org_member_leave` owner_seed ve son owner icin 22023. Uyelik silinince/askiya alininca
   `conversation_assignees` temizligi yeni tabloda (`trg_faz10_remove_assignments_on_leave`). Havuz kaydi SILINMEZ ("ayrildi" izi; havuz sayfasi
   uyelik id'sinin varligina bakar — P1 `organization_memberships` id'leriyle).
6. **Dusenler (plandan fazla):** `on_*_validate_roles` (2) ve `trg_remove_assignments_on_leave` tetikleyici/fonksiyonlari da dustu (donmus
   tabloda anlamsiz; asama20 K3 = 0 icin). Toplam 14 fonksiyon. `map_legacy_member_role`, `log_org_sync_error`, `organization_sync_log`,
   `v_agency_members`/`v_business_members` Hijyen 05'e kaldi (gorunumler security_invoker; uygulama P1'de de kullanmaz).
7. **Testler:** asama4 T3 (RPC ile davet/kabul), T4 (`org_member_remove`), T7 7k (`organization_invitations`), T8 8b/8e/8f/8j (ayna testleri
   dogrudan tablo + RPC), T9/T10 (dogrudan uyelik), T17 (uyelik dogrudan; 17g `sync_org_talent_pool` = dolum), T18/T19/T25 (eski tablo
   okumalari kalkti) uyarlandi; **T34** eklendi (35/35). **asama20** yeni (K1 salt okunur, K2 bilgi, K3 referans 0, K4 nesneler 12, K5 yetki 6,
   K6 bilgi). **asama18** K2/K3 ayna yoksa 0 = 0; **asama5** K3-K6 ayna tetikleyicisi yoksa `EMEKLI` (uretimde de).
8. **Uygulama penceresi:** migration uygulandiktan sonra P1 yayinlanana kadar davet/uyelik YAZMA akislari 42501 verir (okumalar surer).
   Uretim sirasi: `main`'e birlestir -> Vercel uretim derlemesi baslarken `supabase db push` (uretim) -> yayin biter. Dalda: once `db push`,
   sonra P1 (RPC'ler P1'den once var olmali).
9. **Sahne v2 etkisi** (`scripts/sahne/uret.py`, 10a kapanisindan sonra): `agency_members`/`business_members` INSERT'leri yerine
   `organization_memberships` (ayni id duzeni, `legacy_source` NULL, `invited_by` sahibi), `faz5_backfill_agency_members()` yerine kurulus
   basina `sync_org_talent_pool(org)` (sahip JWT'siyle), davetler `organization_invitations`'a; `fn_faz10_member_notify` sahip bildirimi
   uretir (uretec bu `team` bildirimlerini silebilir ya da gecmise tarihler). `00-sahne-temizlik.sql` eski tablolari postgres olarak siler (yetki
   kisiti authenticated/anon icin), degismez. Sahne'nin dalda mevcut verisi migration esitlik kontrolunu gecer (ayna satirlari ayni id).
