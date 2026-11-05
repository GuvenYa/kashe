# 38 — FAZ 10: Temizlik (cift yapilarin kapanmasi)

**Kaynak:** `docs/architecture/04-goc-plani.md` FAZ 10 (madde 42-45) + onceki fazlarin "FAZ 10'a" erteledigi kalemler (asagida envanter).
**Ilke:** FAZ 0-2b'de acilan cift yapilar (eski uyelik tablolari + aynalama, `profiles` -> `providers` aynasi, `profile_id` + `provider_id`
cift sutunu, `EVENT_TYPES` sabiti + eski CHECK listeleri) tek kaynaga iner. Her kesim: once UYGULAMA yeni yola gecer, sonra DB eski yolu
kapatir (yazma yetkisi kalkar, tetikleyici duser); fiziksel DROP bir sonraki hijyen turunda. Eski akislar kesilene kadar calisir durur.
**Durum (5 Kasim 2026, gece):** **FAZ 10 KAPANDI** - 10a, 10b, 10c-1, 10c-2, 10d uretimde (`main` dc53df9). Eski tablolar / sutunlar
salt okunur ya da tetikleyiciyle dolarak bekliyor; fiziksel silme Hijyen 05 / FAZ 11 (~3 Aralik). Sahne v3 tamam. Asagidaki durumlar tarihcedir.
**Durum (5 Kasim 2026, aksam):** **10c-2 KAPANDI** (DB 04 + P2 uretimde, `main` 6c9fa7b) - **10c tamam**; siradaki Sahne v3
(bulgu 70), sonra 10d. Asagidaki 5 Kasim durumu tarihcedir.
**Durum (5 Kasim 2026):** **10c-1 KAPANDI** (DB 01 + 02 + 02b + 03 ve P1 uretimde, `main` a67aa10) + **Duzeltme 05 uretimde**;
Duzeltme 06 (girissiz AI + tek giris) ve 07 (Turkce arama) uretimde; siradaki 10c-2 (bolum 10c), sonra Sahne v3.
**Durum (4 Kasim 2026):** **10b KAPANDI** (DB + P1 uretimde, `main` 568c7b1) + **Duzeltme 04 uretimde** (bolum 6); siradaki **10c-1** (bolum 10c).
Asagidaki 3 Kasim durumu tarihcedir.
**Durum (3 Kasim 2026):** **10a + Duzeltme 01 URETIMDE** (merge e4317d5; `supabase db push` 20261028 + 20261030; asama20/5/18/19 uretimde beklendigi gibi; tur 3 Kasim, bulgular 4-38);
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

**10b-DB/01** (`20261104120000_faz10b_01_etkinlik_turu_fk.sql`; 29 Ekim taslagi 20261031120000 idi, 4 Kasim'da yeniden damgalandi):
`conversations`, `listings`, `bookings`, `quote_requests` `event_type` -> FK `event_types(key)` ON UPDATE CASCADE; once veri kontrolu
(anahtar disi deger varsa dosya DURUR ve degerleri listeler — veri degistirmez; on kontrol `faz10b-on-kontrol.sql`); uc CHECK duser.
**10b-DB URETIMDE (4 Kasim):** dal asama4 37/37 + asama20 K7 ESIT; uretim db push 00 (quote_requests 2 satir activation/fashion
-> other) + 01, asama20 K1-K7 ESIT. 10b-P1 de uretimde (4 Kasim; tur ve uretim notu asagida / bolum 6).
**4 Kasim uretim denemesi:** 01 durdu — `quote_requests.event_type` icinde `activation`, `fashion` (Temmuz taksonomi duzeltmesi
3f7ffc5 oncesi model/hostes brief listeleri). Eklenen: **10b-DB/00** `20261104110000_faz10b_00_etkinlik_turu_veri.sql` (VERI:
anahtar disi -> 'other', brief_data dokunulmaz, listings updated_at tetikleyicisi gecici kapali) + uygulama kontrolu
(`teklif-topla/actions.ts`, `ilanlar/listings-actions.ts`: liste disi tur -> NULL; P1 tabloya tasir). Sira: kod uretime -> db push
(00 + 01). Dalda 01 zaten uygulu oldugu icin 00 `supabase db push --include-all` ile (dalda 0 satir, no-op). asama11 K1 ("CHECK listesi = tablo") emekli; yerine asama20 K5 (FK var, CHECK yok).

**10b-P1:** `EVENT_TYPES` sabiti silinir; tek kaynak `event_types` tablosu — sunucu yardimcisi `app/lib/etkinlik-turu.ts`
(`etkinlikTurleri()`; `unstable_cache` ya da istek basina), istemci bilesenlere prop. 12 dosya. Tur: ilan formu, Kesfet filtresi,
teklif-topla, kategori bilgileri, mesaj basligi.
**10b-P1 TUR (4 Kasim, onizleme `faz10b/p1`, commit 8a85b32; Sahne hesaplari Irem / Kerem / Mavi Sahne):** ilan formu 15 tur (tablo
sirasi), Kesfet "Etkinlik turu" 15 kutu + `?etkinlik=wedding` 64 / `corporate` 92 / `olmayan` yok sayildi (120 = suzgecsiz) / `wedding,olmayan` 64,
teklif-topla `?kategori=377&tur=corporate` on-dolu, `?tur=activation` bos (hata yok), profilde "Teklif Al" brief 15 tur, sohbet listesi
ve konusma karti Turkce etiket, profil "ETKINLIK TURLERI", `/rezervasyonlarim`, `/takvimim` Siradaki isler "Kurumsal / Dogum gunu / Dugun"
(bulgu 55 kapandi), kategori bilgileri ortak alan 15 cip + kayitli 3 secim, sihirbaz adim 2 15 cip, ajans teklif musteri gorunumu "TUR Dugun":
DOGRULANDI; temiz sekmede konsol hatasi yok. Turda bulgu 61 (asama4 test kategorileri yine listede) ve 62 (guvenlik: RPC bayragi) -> Duzeltme 04.

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
- Test: asama4 **T38** (T37 Duzeltme 04'un) (sahip providers/alt profil yazar -> profiles kopyasi dolar; profiles tasinmis alana yazim sessiz geri alinir;
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

**10c-1 UYGULAMA (5 Kasim, harness):** DB/01 deploy kuralina gore UCE bolundu. `20261105120000_faz10c_01_saglayici_sutunlari.sql`
(VERI + ekleyen: 3 sutun, GIN, okuma yetkisi, kopya + FAZ 2a alanlarinda kayma esitleme (kaynak profiles, NOTICE) + RAISE dogrulama;
ileri ayna attributes/category_attributes'i da tasir, `kashe.sync_bypass` onceki degerine doner; `ensure_provider_for_profile` yeni
sutunlari doldurur; kayma olcer `fn_faz10c_ayna_kaymasi()`). `20261105120100_faz10c_02_yazma_yolu.sql` (EKLEYEN: GRANT + 4 UPDATE
politikasi, ters ayna 3 tetikleyici, `provider_set_primary_category`, `increment_profile_views` -> providers, gorunum saglayicidan;
koruma: sahip icin TEK gecis revision -> pending, not temizlenir - profiles yolunda da, bulgu 68; ayna bayragi profiles'ta rol/admin
yazamaz). Eski uygulama 01+02 sonrasi AYNEN calisir (iki ayna birlikte, IS DISTINCT ile dongusuz) -> uretime P1'den ONCE gider.
KISITLAYAN `03` (profiles tasinmis alanlari kilidi `protect_profiles_moved_fields` - yalniz providers satiri olan hesapta; ileri ayna
display_name + talents'a daralir; `fn_faz2b_sync_primary_role` duser; asama4 T5/T11/T13/T14 uyarlanir) P1 uretimden sonra. 10c-2 dosyasi
`04` olur. Isletme hesabinin onayi (providers satiri yok) profiles'ta kalir; P1 admin eylemleri dallanir (gorev 45).
Yerel: Sahne + asama4 verili harness'ta 01 (134 kopya, kayma yok) + 02, ikinci kosu no-op; asama4 40/40 (T38 GECTI; tek islem ve
otomatik, ikinci kosu), 10c'siz kopyada T38 ATLANDI; mutasyon: ters ayna kapali -> T38 HATA + asama20 K8 36/37 FARK, profiles
revision istisnasi yok -> T38 HATA. asama10 ESIT, asama20 K8 37 / K8b 0 ESIT (10c'siz BEKLIYOR). T11 `providers UPDATE 42501` ->
`providers.display_name UPDATE 42501` (yazma yolu acildi; ad hala profiles'tan).
Sira: `faz10c/db` dal push (01+02) -> asama4 / asama20 / asama10 -> uretim db push (01+02) -> gorev 45 (P1) -> tur -> uretim kod ->
`03` -> dal -> uretim.
**10c-1 DALDA (5 Kasim):** 01 (134 kopya, kayma yok) + 02; asama20 K8 37 / K8b 0, asama10 ESIT, asama4 40/40. Ardindan Kesfet dalda
kirildi (bulgu 69): gorunum primary_category_id'yi birincil rolden okuyunca PostgREST `profiles_primary_category_id_fkey` gomme
iliskisini kaybetti. `20261105120200_faz10c_02b_gorunum_kategori_baglantisi.sql` sutunu yine profiles'tan okutur (degerler ayni);
asama20 K8 artik kaynagi da olcer. KURAL: gorunumde yabanci anahtarli bir sutunun kaynagi, uygulamadaki gomme ipuclari
(`tablo!fk_adi(...)`) degismeden degistirilmez; 10c-2 P2'de once ipuclari, sonra kaynak. Dal Kesfet duzeldi (117 sonuc).
**10c-1 URETIMDE (5 Kasim):** uretim db push 01+02+02b (asama20 K8 37 / K8b 0, asama10 ESIT). P1 (gorev 45; `app/lib/saglayici-yazma.ts`,
profil duzenle / yayin / kategori bilgileri / admin onay-askiya alma) dal turu `faz10c/p1` onizlemesinde (Tolga Dogan, Sevgi Oz, Ekim Kreatif;
degerler geri alindi): bio, sehir, birincil kategori (RPC) -> /p/ + Kesfet + panel; yayindan kaldir -> Kesfet'ten duser; kategori
bilgileri providers'a; admin revizyon -> sayac 7/4, sahip duzenler -> "Profilin onay bekliyor" + not temiz (bulgu 68) -> 8/3; askiya
al/kaldir profesyonel + ajans -> Kesfet'ten duser / doner; konsol temiz. Bulgu 70 (Sahne: avatarsiz saglayici yayindan kalkinca geri
yayinlayamiyor). Kod uretimde (`main` <- `faz10c/p1` hizli ileri; kashe.net Kesfet 34, profil ve ana sayfa sorunsuz).
Siradaki: `03` KISITLAYAN (profiles tasinmis alan kilidi, ileri ayna daralir, fn_faz2b_sync_primary_role duser; P1 yardimcisi
`saglayiciMi` sorgu hatasinda profiles'a DUSMESIN - 03'ten sonra o yazim sessizce geri alinirdi), sonra 10c-2.
**Duzeltme 05 (5 Kasim, URETIMDE - main ff40f83; gorev 46; Fahri bulgulari 63/66/67):** ekip daveti geri bildirimi; Kesfet karti
(tam kategori, 2 satir ad, baslik bir kademe kucuk); "Ajanslar" -> "Kurumsal hizmet saglayicilar" (kesif yuzeyleri; ust menu ve ajansa
seslenen ana sayfa bolumu kaldi); arama `app/lib/arama.ts` (`q` PostgREST filtre karakterlerinden temizlenir - once "a,b" 400, "%" 500;
baslik/tanitim da aranir; es anlamli sozluk -> etkinlik turu / kategori / kurumsal; sonuc yoksa 12 yakin sonuc + Kashe AI baglantisi);
"Ad S." `app/lib/kamu-adi.ts` (bireysel profesyonel; tam ad kendisi / admin / onayli-tamamlanmis rezervasyonlu karsi taraf; tarayiciya
tam ad gonderilmez; API duzeyi gizleme 10c-2 sonrasi). Onizleme turu + uretim anonim kontrol temiz. Not: Vercel 2 push'u almadi
(webhook), bos commit ile tetiklendi; `main` push'u `git push origin main` ile gitti.
**10c-1 / 03 UYGULAMA (5 Kasim, harness):** `20261105130000_faz10c_03_profiles_kilidi.sql` (KISITLAYAN; veri degismez, basta ve sonda
kayma 0 RAISE): `protect_profiles_moved_fields` (BEFORE UPDATE `trg_faz10c_protect_moved_fields`; `providers` satiri olan hesapta 13
tasinmis alan kullanici VE admin icin sessizce eski degerde, yalniz `kashe.sync_bypass` yazar; musteri / isletme kilitsiz), ileri ayna
`fn_sync_profile_to_provider` display_name + talents.full_name'e daraldi (tetikleyici UPDATE OF role, full_name, company_name),
`trg_faz2b_sync_primary_role` + fonksiyonu dustu (birincil rol RPC'de turetilir). asama4: saglayici hazirlik yazimlari saglayici tarafina
(T0/T99 faz1test birincil NULL ayna bayragiyla; T5c, T7, T11d, T13b/f/h, T14c/d, T19), T38 eski yol bolumu 03 oncesi ileri ayna / 03
sonrasi kilit, yeni **T39** (yapi, sahip 13 alan, admin profiles yolu, musteri / isletme kilitsiz, ayna ve RPC kilidi gecer, geri alma);
asama20 **K9** (18). Sahne: `01a` profil blogu ayna bayragiyla + kaynak taraf esitleme (providers, alt profil, recompute) - degismemis
01a 03 sonrasi 0 gorunur saglayici kurardi; `05` faz1test birincil NULL ayna bayragiyla (degismemis 05 FK'de durur). Uygulama:
`saglayiciMi` sorgu hatasinda firlatir (profiles'a dusup sessizce kaybolmaz). Yerel: 03 tek islem ve otomatik, ikinci kosu no-op;
asama4 41/41 iki kipte + ikinci kosu, 03'suz kopyada 40 + T39 ATLANDI; mutasyon: kilit kapali -> T38 + T39 HATA, admin muaf -> T39,
musteri de kilitli -> T39, ayna bayragi yok sayilir -> 30+ test HATA; asama20 K9 18 ESIT (03'suz BEKLIYOR), K8 37 / K8b 0; asama7 /
asama9 / asama10 ESIT; Sahne 00-04 03'lu harness'ta yeniden kuruldu -> providers / alt profil / provider_services / profiles ozetleri
03 oncesiyle birebir (md5), kayma 0. tsc + eslint temiz.
Sira: dal db push (03) -> asama4 / asama20 / asama10 -> `main` (saglayiciMi + Sahne + belgeler) -> uretim db push (03) -> asama20 /
asama10 -> uretim anonim kontrol. 10c-2 dosyasi `04`, testleri asama4 **T40** / asama20 **K10**.
**10c-1 / 03 URETIMDE (5 Kasim) - 10c-1 KAPANDI:** dal db push (03) -> asama4 41/41 (T39 GECTI, T38 "03 kilidinde sessizce eski
deger"), asama20 K8 37 / K8b 0 / K9 18, asama10 ESIT. Dal turu `faz10c/03` onizlemesinde (Tolga Dogan, Ekim Kreatif, admin; degerler
geri alindi): tanitim / sehir / ana kategori (RPC) -> /profil + /p/ + Kesfet; yayindan kaldir -> Kesfet'ten duser; admin revizyon
(sayac 3 -> 4, not) -> sahip duzenler -> "Profilin onay bekliyor", not temiz -> admin onay -> yayinda (8/3); ajans askiya al / kaldir ->
Kesfet'ten duser / doner; konsol temiz. `main` <- `faz10c/03` (a67aa10, Vercel), sonra uretim db push (03): asama20 K8 37 / K8b 0 /
K9 18 ESIT, asama10 ESIT (39 saglayici, 34 gorunur). kashe.net anonim: Kesfet 34 profil, /p/ ve ana sayfa sorunsuz. Bulgu 71 (Turkce
harfsiz arama) acildi.
**Duzeltme 06 (5 Kasim, URETIMDE - main 4dee081; gorev 47; Fahri bulgulari 64/65):** girissiz Kashe AI hakki
`20261105140000_duzeltme_06_girissiz_ai_hakki.sql` (EKLEYEN: `internal.ai_girissiz_ayar / _kullanim / _gun`, RPC
`ai_girissiz_hak_kullan(p_anahtar, p_ip_ozeti)`; IP basina gunde 3 + gunluk toplam 300, atomik, sunucu anahtari
`AI_GIRISSIZ_ANAHTAR` - Vercel Production + Preview, veritabaninda yalniz SHA-256 ozeti; ham IP yok, ozet gunluk, 30 gun saklama);
asama4 **T41** (42/42 iki kip; mutasyon: anahtar kontrolu yok / sinir yok / toplam reddinde IP sayaci geri alinmiyor -> T41 HATA),
asama23 K1 10 ESIT (dal + uretim). Uygulama: `app/lib/girissiz-ai.ts` (KAPALI baslar), `analyzeEventNeeds` girissiz (EventSpec kaydi
yalniz girisli), `/kashe-ai` tek kutu + `app/kashe-ai/actions.ts` (adaylar veritabanindan: rol + sehir, sehirde yoksa Turkiye geneli,
tur beyan edenler once; ikinci model cagrisi yok), `app/lib/sihirbaz-url.ts` (sihirbaz ve Kashe AI ortak), sihirbaz Anlat girissiz,
`/etkinlik-planla` + `/pro-bul` kalici yonlendirme, `recommendProfessionals` silindi. Inceleme yamalari: tur suzgec degil oncelik
(uretimde "dugun fotografcisi" 0 aday veriyordu), girisli Kashe AI -> sihirbaz brief / surum tasir, sehir notu ek uyumu, `.env.example`
depoya (`.gitignore` istisnasi). Dal turu (anonim + Derya Celik): kalan 2/1/0, 4. cagri hak doldu + uye ol / giris (metinli donus),
cok rol -> sihirbaz 5. adim dolu, girissiz onay -> giris (durum korunur), yonlendirmeler; turda bulunan: niyet rol sayisindan
okunamiyor (analiz tamamlayici rol oneriyor) -> metinde adiyla anilan tek rol = "Aradigin" gorunumu (tur yamasi). kashe.net anonim:
`/kashe-ai` tek kutu, iki eski adres yonleniyor, ana sayfa kartlari ve Kesfet "Kashe AI'a anlat" metinli.
**Duzeltme 07 (5 Kasim, URETIMDE - main b7367c1; bulgu 71):** Turkce harf duyarsiz Kesfet aramasi
`20261105150000_duzeltme_07_turkce_arama.sql` (EKLEYEN: `public.tr_katla(text)` IMMUTABLE - Turkce + sapkali harfler ASCII, kucuk
harf; `v_providers_public` sonuna `arama_metni` = tr_katla(ad + sirket + baslik + tanitim + birincil kategori adi), mevcut sutunlar /
sira / kaynaklar 02b ile ayni, security_invoker). Uygulama: `app/lib/arama.ts` `aramaKatla` (DB ile birebir esleme), Kesfet
`arama_metni.ilike` + katlanmis kategori adi eslemesi, `ProviderPublic.arama_metni`. asama4 **T42** (43/43 iki kip; mutasyon: katlama
yok -> T42 HATA), asama24 K1 5 / K2 0 ESIT (dal + uretim), asama10 ESIT. Dal: fotograf 13, dogan 5, dugun 72, IZMIR 15, acilis 78;
uretim: fotograf 3, dugun 9, Kesfet 34. Sira degismedi: veritabani once (yeni sutun yoksa Kesfet hata verir), kod sonra.

**10c-2 / DB/02** (`20261105160000_faz10c_04_provider_id_kesimi.sql`; 10c-1 / 03 uretimden sonra): 5 tabloda `provider_id` NOT NULL
(once NULL 0 dogrulanir, RAISE), FK `ON DELETE CASCADE`; `trg_faz2b_set_provider_id` yon degistirir (`provider_id` -> `profile_id` /
`professional_id` doldurur; istemci eski sutunu gondermezse de dolar); eski GIN indeks (`profiles.category_attributes`) duser;
asama4 **T40**, asama20 **K10**. **P2:** 108 `profile_id`/`professional_id` gecisi `provider_id`'ye (okuma + yazma; `reviews.professional_id`
ve `favorites.professional_id` dahil), tipler; eski sutunlar FAZ 11'e kadar kalir (tetikleyici doldurur). Tur: portfoy/hizmet/deneyim
ekle-sil, favori, yorum; /p/[id] ve Kesfet degismez.
**10c-2 UYGULAMA (5 Kasim, harness):** on kontrol `faz10c2-on-kontrol.sql` (uretim: bes tabloda bos / uyusmaz / saglayici olmayan
sahip 0; toplam 57 satir). `04`: basta veri RAISE; tetikleyici IKI YONLU (yalniz provider_id gelirse eski sutun ondan dolar - P2;
eski sutun gelirse provider_id ondan, farkli istemci degeri ezilir - eski uygulama; saglayici olmayan sahip 42501 acik mesaj,
eskiden provider_id bos kalirdi); 5 tabloda NOT NULL + ON DELETE CASCADE; favorites (user_id, provider_id) TEKIL, reviews /
profile_experiences provider_id indeksleri; `idx_profiles_category_attributes_gin` duser. RLS ve eski sutunlar FAZ 11'e kadar.
Eski uygulama aynen calisir -> `04` uretime P2'den ONCE. asama4 **T40** (yapi, yeni yol, baskasi adina RLS 42501, eski yolda
ezme, favori upsert, musteri 42501, yorum alt islemde) + T13 musteri portfoyu 04 sonrasi 42501; asama20 **K10** (16). Yerel: 04 tek
islem ve otomatik, ikinci kosu no-op; asama4 44/44 iki kip, 04'suz kopyada 43 + T40 ATLANDI; mutasyon: eski sutun doldurulmuyor ->
T40 HATA, istemci provider_id'sine guveniliyor -> T13 + T40 HATA; asama7 / 9 / 10 ESIT; Sahne 00-04 04'lu harness'ta ayni sayilar.
P2 gorevi 48 (25 dosya, ~97 referans; suzgec + yuk provider_id, gomme ipuclari FAZ 11'e kadar ayni).
Sira: dal db push (04) -> asama4 / asama20 -> uretim db push (04) -> gorev 48 (P2) -> tur -> uretim kod.
**10c-2 URETIMDE (5 Kasim):** dal `db push` (04) -> asama20 K10 16 ESIT, asama4 44/44 GECTI (T40 dahil), asama10 ESIT; uretim
`db push` (04) -> asama20 K1-K10 ESIT (K10 16), asama10 ESIT (39 / gorunur 34). P2 (gorev 48, `main` 6c9fa7b): 28 dosya, 63 sorgu
zinciri; bes tabloda eski sahip sutunu suzgec / yuk / okunan alan olarak 0. Kalan iki gomme ipucu FAZ 11'e kadar
(`admin/yorumlar` `profiles!reviews_professional_id_fkey`, `favoriler/actions` `professional:professional_id`); tiplere `provider_id`
(Service, PortfolioItem, Review, ProfileExperience; eski alan tipte kalir). Sapma: favorites'ta upsert yokmus (duz insert + 23505;
yeni TEKIL indeks ayni hatayi verir). Onizleme turu (Sahne: Bahar Yalcin / Kaan Erol / admin): hizmet ekle-duzenle-pasif-sil + /p +
Kesfet rozeti, deneyim ekle-tasi-sil, portfoy yukle-aciklama-sil, favori ekle-cikar (/favoriler 5-6-5), yorum yaz-sil (Cem Kilic,
ozet 4 / 1), admin yorumlar 82 / sikayetler / rapor, kategori, ana sayfa; test kayitlari geri alindi. Uretim anonim kontrol: Kesfet
34 sonuc / 20 rozet (P2 oncesi olcumle ayni), 34 /p sayfasi 200, portfoy / deneyim / yorum geldi. Ana sayfadaki React #419 uyarisi
hero'daki iki `ssr: false` bolumden (uretimde de ayni isaretler), P2 ile ilgisiz.

### 10d — Kucukler

`bookings` eski politikalar `TO authenticated`; `ensure_organization_for_profile` sadeletirme; `profile_approval_status` enum adi
(KOZMETIK — yapilmaz); asama kontrol dosyalarinin FAZ 10 sonrasi durumu (asama5 aynalama kontrolleri emekli/bilgi; asama7/9/10/11
gozden gecirilir); CLAUDE.md "FAZ 10'a kadar" cumleleri temizlenir.
Sahne turunda eklenen (27 Ekim 2026): `app/components/sections/featured-profiles.tsx` satir 61 `tierWeight` icindeki `Date.now()`
eslint `react-hooks/purity` hatasi veriyor (onceden var; derlemeyi engellemiyor) — `Date.now()` bilesen govdesinden once tek sefer
alinir (`const now = Date.now()` sunucu fonksiyonunun basinda) ya da `premium_until` karsilastirmasi `isPremiumActive` yardimcisina
tasinir; `npx eslint app/components/sections` temiz olmali.
**10d PLANI (5 Kasim, Sahne v3'ten sonra; karar: Claude, Guven "karar senin"):**
- **DB/01** `20261105170000_faz10d_01_bookings_politikalari.sql`: bookings'in rolsuz (public) bes eski politikasi `TO authenticated`
  (kosullar ayni; anonim zaten 0 satir goruyordu). asama20 **K11** (6; uygulanmamissa BEKLIYOR). Harness (Sahne v3 + 04 uzerinde):
  once K11 BEKLIYOR, sonra ESIT; ikinci kosu no-op; asama4 44/44; anon bookings 0, musteri kendi 9 satiri.
- **Kontrol dosyalari:** asama13 K4/K5 `agency_members` dolum/kayma olcumu 10a sonrasi EMEKLI (aynalama tetikleyicisi yoksa; asama5
  ile ayni kural; Sahne'de K4 67 FARK veriyordu). asama15 K9 Sahne teklifleri haric (uretec gonderim zamanini geriye yazar; asama22 K4
  kurali; Sahne'de 304 FARK veriyordu). Harness'ta 23 kontrol dosyasi: kalici FARK yok (asama21 K6 yalniz harness - gece isi kosmadi).
- **Uygulama + Duzeltme 08:** gorev `49-claude-code-gorevi-10d-duzeltme-08.md` - A) `eslint app` 68 hata -> 0 (purity, set-state-in-effect
  mesru olanlar gerekceli satir istisnasi, any -> tip, `<a>` -> `<Link>`), B) CLAUDE.md FAZ 10 sonrasi eskimis cumleler
  (`provider_services` "2c'ye kadar", FAZ 5 `agency_members` yazimi / silme kurali, sema ozeti `profiles` uc is), C) bulgu 17, 38, 51,
  52, 53, 54, 56.
- **Yapilmayan (gerekce):** `ensure_organization_for_profile` sadelestirme - govde dogru ve idempotan, tek cagiran
  `trg_faz0_sync_profile_to_organization`; degisiklik kazanc getirmez. `profile_approval_status` enum adi kozmetik. Diger 39 tablodaki
  115 rolsuz politika (Supabase varsayilani; kosullari auth.uid() / yayin durumu) Hijyen 05 adayi, 10d disinda.
- Sira: `faz10d` dali -> dal `supabase db push` (DB/01) -> asama20 (K11 ESIT) + asama4 (44) + asama13 / asama15 -> uretim
  `supabase db push` -> gorev 49 -> diff + tur -> uretim kod -> **FAZ 10 KAPANIS** (Hijyen 05 ~3 Aralik).
**10d URETIMDE - FAZ 10 KAPANDI (5 Kasim):** dal `db push` (10d/01) -> asama20 K1-K11 ESIT, asama4 44/44, asama13 K4/K5 EMEKLI,
asama15 K9 ESIT; uretim `db push` -> ayni uc kontrol temiz. Gorev 49 (`main` ae1069f + dc53df9): `eslint app` 68 -> 0 hata (purity: saf
`premiumAgirligi` + istek basi `simdiMs`; set-state-in-effect 13 duzeltme - `useSyncExternalStore` kancalari `app/lib/istemci-kancalari.ts`,
modallar kosullu mount + `key`, 6 gerekceli satir istisnasi: adres cubugu / URL fragmani / realtime esitleme; any -> tip; 9 `<a>` -> `<Link>`),
CLAUDE.md 5 cumle (provider_services okunur, FAZ 5 havuz 10a sonrasi, sema ozeti `profiles` kimlik), Duzeltme 08 bulgu 17 / 51 / 52 / 53 / 54 /
56 (38 zaten duzelmisti). Inceleme yamalari: ters tirnakla dusen 4 yorum, sehir secici guncelleyici; tur bulgusu: model "250 bin civari"
bazen yalniz `budget_min` donuyor -> kural tek taraf dolu tutari da kapsar (dc53df9; onizlemede sihirbaz 210.000 - 290.000). Onizleme turu:
Kesfet / kategori / ana sayfa siralamasi eski onizlemeyle birebir (117 / 10 / 16), hizmet / paket / yorum yaniti modallari, sehir secici,
mobil menu, admin arama + aksiyon menusu + istatistik grafikleri, #52 / #53 / #56 ekranlari. Uretim anonim kontrol: yeni dagitim (dpl
degisti), 10 sayfa 200, Kesfet 34, menu / alt bilgi baglantilari. Kalan kucukler (FAZ 10 disi): ust menu / alt bilgide dinamik `<a href>`
baglantilar (tam sayfa yenileme), kazanclarim ozet kartinda "Komisyon (%10) −0 TL", #51 / #54 canli tur (taslak ekip / RFP gerektirir).

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
| **10b-DB/01** | 4 sutun FK `event_types`; CHECK'ler duser — **4 Kasim: `supabase/migrations/20261104120000_faz10b_01_etkinlik_turu_fk.sql`** (yeniden damgalandi; anahtar disi deger varsa DURUR) + on kontrol `faz10b-on-kontrol.sql` | asama4 **T36** (37/37 harness, 03-B dahil; T13/T23/T24 03-B beklentilerine guncellendi), asama20 **K7** (10b yoksa BEKLIYOR), asama11 K1 EMEKLI |
| **10b-P1** | `EVENT_TYPES` silinir; 46 dosya tablodan okur (`42-claude-code-gorevi-10b-p1-etkinlik-turu.md`) — **URETIMDE 4 Kasim** (8a85b32) | tur: ilan formu, Kesfet, teklif-topla, kategori bilgileri, konusma karti — DOGRULANDI (bolum 10b TUR) |
| **10c-1 DB/01** | providers jsonb sutunlar + views_count, yazma yolu (RLS/GRANT + `provider_set_primary_category`), ters ayna, koruma, ileri ayna daralir | asama4 **T38**; asama20 **K8**; asama10 ESIT |
| **10c-1 P1** | profil duzenle / kategori bilgileri / admin / yayin / views yazmalari saglayici tarafina | tur: profil duzenle, admin onay, yayin, sayac; Kesfet ve /p/[id] degismez |
| **10c-1 DB/03** | profiles tasinmis alan kilidi (KISITLAYAN), ileri ayna daralir, birincil rol aynasi duser; Sahne 01a/05 ayna bayragi | asama4 **T39**; asama20 **K9**; asama10 ESIT |
| **10c-2 DB/02** | `provider_id` NOT NULL + CASCADE, `set_provider_id` yon degisimi, eski GIN duser | asama4 **T40**; asama20 **K10** |
| **10c-2 P2** | 108 `profile_id`/`professional_id` gecisi `provider_id`'ye | tur: portfoy/hizmet/deneyim/favori/yorum |
| **10d** | politikalar, kontrol dosyalari, CLAUDE.md | asama20 K11 |
| **Kapanis** | 38 bolum 6, CLAUDE.md FAZ 10 paragrafi, roadmap, 04-goc-plani madde 42-45 | — |

Kirmizi cizgiler: her kesimde once uygulama yeni yola gecer, DB sonra kapatir (ters sira eski sayfalari kirar); fiziksel DROP bu fazda
YOK; `internal.*` ve FAZ 6-9 yapilarina dokunulmaz; her dilim asama4 + asama20 ile dalda, asama20 ile uretimde dogrulanir.

## 6. Kapanis notlari

### URETIME CIKTI (3 Kasim 2026) — SIRA: 10b

Uretim: `main` <- `duzeltme-01` (merge e4317d5; 10 commit: 9f17bef 10a-DB, d8f0d4e 10a-P1, 13f53ff Sahne v2, 3d42f74 + e1e7761 Duzeltme 01,
8311ab8 10b bekleyen, 2854782 10c plan, 4255d24, e619a42 tur yamalari), `supabase db push` -> 20261028 faz10a_01 + 20261030 duzeltme_01;
uretim SQL Editor salt okunur: asama20 K1/K3/K4/K5 ESIT + K7 BEKLIYOR, asama5 K3-K6 EMEKLI, asama18 ve asama19 ESIT; canli kontrol
`/davetlerim` (ajans hesabi) sorunsuz. Hijyen 05 DROP'lari icin 30 gun: ~3 Aralik 2026. Fahri'nin manuel urun incelemesi Sahne
onizlemesinde (`sahne` dali, main ile ayni; rehber `docs/sahne/test-rehberi-fahri.md`, bulgu tablosu Google Sheet "Sahne bulgulari — Fahri"); bulgulari Duzeltme 03 olur.
**Duzeltme 03-A (3 Kasim, dal `duzeltme-03a`, tur tamamlandi):** gorev 44 A1-A9 uygulandi; onizleme turunda A1/A2/A3/A7/A8/A9 dogrulandi,
A2 kategori kaynagi (profesyonelin kategorisi) ve davet `orgId` ek yamalari; sohbet basliginda ajans icin kurulus adi ve panel hesap
kartinda kisi adi (bulgu 49-50) ek yamalari. Rehber v2 (`docs/sahne/test-rehberi/`, 10 ekran goruntusu `shots/`) ayni dalda. Yeni
bulgular 51-57 (kozmetik; 57 Sahne temizligi). Siradaki: main'e merge, `sahne` dali guncelle, sonra 03-B (DB).
**Duzeltme 03-B (3 Kasim, URETIMDE — merge 696d6d7; dal asama21 K1-K6 ESIT + Sahne 06 8/8 GECTI; uretim db push dolum 0 teklif / 5 eski
sohbet teklifi sessiz expired, asama21 K1-K6 ESIT; onizleme turu: portal -> rezervasyon -> musteri bildirimi, RFP revizyon yaniti
degerlendirmede gonderildi + secildi + kurum rezervasyon bildirimi; tur yamalari bulgu 58-59; rehber v2.1 bilinen eksikler 18 -> 9):** `20261103150000_duzeltme_03b_01_bildirim_ve_kilitler.sql`
(notifications.type + 'booking'; `fn_faz7b_notify_org(org, izin, link, govde, tur='rfp', haric=NULL)`; portal onay/revizyon ->
satici 'proposal' bildirimi + onayda e-posta esi hesaba `buyer_user_id` bagi; RFP revizyon yaniti 'evaluating'/son tarih sonrasi da
gonderilir (`proposal_send` v_rev), revizyon istenen teklif secilebilir (`rfp_award`); `quotes_expire_stale()` + pg_cron
`quotes-expire-daily` 00:20 UTC; `fn_duz03_booking_notify` tetikleyicisi (olustu -> alici kurulus/musteri, iptal -> karsi taraf,
tamamlandi -> musteri `/p/<pro>?yorum=1` + kurum); reviews INSERT politikasi `fn_duz03_tamamlanmis_rezervasyon_var`),
`20261103150100_duzeltme_03b_02_dolum.sql` (onayli dogrudan tekliflerde e-posta esi -> buyer_user_id + bookings.customer_id;
suresi gecmis sohbet teklifleri: 7 gunden eskiler sistem mesajsiz, yeniler mesajla expired), `asama21-duzeltme-03b-kontrol.sql`
(K1-K6 ESIT, K7-K9 bilgi), `docs/sahne/06-sahne-duzeltme-03b-davranis.sql` (8 adim, ROLLBACK; yerelde 8/8 GECTI, mutasyon
yakalandi). Uygulama: bildirim etiketi 'booking', sohbet teklif kartinda suresi gecmis 'pending' = "Suresi doldu", iptal/tamamlama
pencere metinleri. E-posta kuyruguna 'booking' EKLENMEDI (eski sekil e-postasi uygulamada; cift olmasin). Acik: portal musterisi
yorum birakamaz (reviews.conversation_id zorunlu; urun karari), portalda "Reddet" dugmesi (urun karari), ekip uyesi kabul/ret (10d/11).
**Duzeltme 04 (4 Kasim, dal `duzeltme-04`; bulgu 61-62):** `20261104130000_duzeltme_04_faz7_bayrak.sql` — `fn_faz7_rpc_flag()`
COALESCE ile false (tanimsiz ayarda NULL donup `NOT flag` dondurma kilitlerini atliyordu: taze baglantida satici uye gonderilmis/onayli
surumun kalem fiyat/adet/ekle/sil ve tax_rate/valid_until/notes yazabiliyordu; yerelde onayli 11.400 TL teklif 28.500 TL oldu, duzeltmeyle
22023). Yetkiler/imza ayni. asama4: T0 ve yeni T99 (kosu sonu temizligi; 8 'Faz1 Test' kategorisi artik kalmaz; SQL Editor dosyayi
TEK ISLEMDE kostugu icin T99 teklifleri etkinlik/ekip/RFP'den ONCE siler - ilk dal kosusunda 23503 proposals_rfp_id_fkey, yerelde `psql -1` ile
tekrarlandi) bayragi acar, T37 govde
+ dogrudan yazim 22023 (yerelde 39/39; duzeltmesiz kopyada yalniz T37 HATA; eski T0 duzeltilmis DB'de HATA -> bayrak sart). Sahne 05
bayraksiz duzeltilmis DB'de durur (crew_members -> proposal_items SET NULL), bayrakla 8+8 siler; 00/01a/02a ayni bayragi alir.
`asama22-duzeltme-04-kontrol.sql` K1-K3 ESIT, K4/K5 bilgi (gonderimden sonra degismis kalem/surum; Sahne disi 0 beklenir; K5 onay
`approved_at` ve revizyon notu `client_note` yazimlarini saymaz - ilk dal kosusunda bunlar 4 cikmisti).
**URETIME CIKTI (4 Kasim 2026) — 10b-P1 + Duzeltme 04:** `main` <- `duzeltme-04` (hizli ileri: 8a85b32 10b-P1, 029dc86 + 568c7b1 Duzeltme 04),
`supabase db push` -> 20261104130000; uretim asama22 K1-K3 ESIT, K4 0 / K5 0 (gonderilmis teklif kalemi ya da surumu gonderimden sonra
degismemis: acik kullanilmamis gorunuyor; SILINMIS kalem bu olcumle gorulmez). Dal: asama22 ESIT, asama4 39/39 (T37, T99; test kategorileri
silindi). Canli kontrol (kashe.net/kesfet, anonim): Etkinlik turu 15 kutu, `?etkinlik=olmayan` yok sayildi (34 = suzgecsiz), `wedding,olmayan`
= `wedding` (3). `sahne` = `main`. **10b kapandi.** Siradaki: 10c-1 (DB/01 harness'ta; asama4 test numaralari T38'den baslar, T37 Duzeltme 04'un).
**Duzeltme 03 (planlandi, 3 Kasim):** Fahri test rehberi (`docs/sahne/test-rehberi/test-rehberi.html`, PDF; kod taramasi bulgular 40-48)
iki dilim — **03-A yalniz uygulama** (gorev 44: Teklif Al basligi, sohbette brief alanlari, ajans karsi taraf etiketi, iptal metni,
yorum sunucu sarti, admin askidan donus + sayimlar + etiketler, kurum durum etiketleri + uye Ekip sayfasi, takvim/kazanc teklif
rezervasyonlari, davet formu kapanisi) once; **03-B DB** (portal onay/revizyon bildirimi, quotes gunluk sure sonu, iptal/tamamlama
bildirimleri, kurum rezervasyon bildirimi, RFP revizyon kilidi, portal teklifi <-> musteri hesabi, yorum politikasi) sona. Ekip uyesi
kabul/ret: urun karari (10d/11).
**Duzeltme 02 (3 Kasim, uretimde):** bulgu #39 menu sadelestirme — avatar menusu/mobil hamburger kisa baslatici, panel yan menusu katlanabilir bolumler (gorev 43; `app/lib/panel-menu.ts` modeline `bolum` / `oncelik`, `baslaticiMenusu`; DB yok). Siradaki: madde 3 (10b).

### TUR TAMAMLANDI (3 Kasim 2026)

`duzeltme-01` onizlemesinde (Sahne v2) madde 1'deki tur bitti; tum 10a ve Duzeltme 01 kontrolleri dogrulandi (`docs/sahne/bulgular.md`
satirlar 4-31 durumlari, yeni satirlar 34-38). Turda yapilan branch verisi: Arti Bir'in "Teknopark Gala" etkinliginde 4 kisilik ekip + teklif
(Bahar Keskin portalda onayladi; rezervasyon olusturulmadi), Akdeniz Gida -> Bahar Keskin kurumsal ekip daveti (kabul edildi, Proje
yoneticisi), Bahar -> Baris Arslan brief konusmasi, Sevgi Tekin portfoy/avatar PNG. Tur sonrasi uc kucuk yama (commit'e girer):
`app/admin/page.tsx` (onay karti `profiles` kaynagi — kurum hesabi providers'da yok), `app/davetlerim/page.tsx` (rol adi Turkce),
`app/rezervasyon/[id]/page.tsx` ("tarihinde onaylandi"). Sonraki adim madde 2 (uretim), ardindan 3-5.

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
4. **10c:** bolum 10c tasarimina gore DB/01 harness'ta yazilir (T38, K8, asama10 ESIT) -> dal -> P1 -> tur -> uretim; sonra DB/02 + P2.
5. **Sahne v3** (10c-1 ile birlikte): uretec provider tarafina yazar. **YAPILDI (5 Kasim):** uretec v3 + `foto-yukle --saglayici-avatar`
   (bulgu 70 dalda kapandi), #37 uretecte; ayrinti `39-sahne-sentetik-dunya.md` bolum 8 (v3 notu). Dal yeniden kurulmadi.

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

### 10a-DB/01 — `supabase/migrations/20261028120000_faz10a_01_uyelik_tek_tablo.sql` (28 Ekim 2026; harness; dal 29 Ekim; URETIM 3 Kasim 2026)

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
