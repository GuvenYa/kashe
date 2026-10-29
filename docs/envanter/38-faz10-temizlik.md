# 38 — FAZ 10: Temizlik (cift yapilarin kapanmasi)

**Kaynak:** `docs/architecture/04-goc-plani.md` FAZ 10 (madde 42-45) + onceki fazlarin "FAZ 10'a" erteledigi kalemler (asagida envanter).
**Ilke:** FAZ 0-2b'de acilan cift yapilar (eski uyelik tablolari + aynalama, `profiles` -> `providers` aynasi, `profile_id` + `provider_id`
cift sutunu, `EVENT_TYPES` sabiti + eski CHECK listeleri) tek kaynaga iner. Her kesim: once UYGULAMA yeni yola gecer, sonra DB eski yolu
kapatir (yazma yetkisi kalkar, tetikleyici duser); fiziksel DROP bir sonraki hijyen turunda. Eski akislar kesilene kadar calisir durur.
**Durum:** **10a-DB/01 yazildi ve harness'ta dogrulandi (28 Ekim 2026; asama4 35/35, asama20 K1-K6, asama18/asama5 uyarlandi) — dala
`db push` + 10a-P1 (`40-claude-code-gorevi-10a-p1-uyelik.md`) sirada.** Sira: 10a uyelik -> 10b etkinlik turu -> 10c saglayici yazma yolu ->
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

### 10c — Saglayici yazma yolu + `profile_id` kesimi (madde 43, 45)

**Plan turu once** (acik sorular bolum 4): `services` aynasinin kaderi, `increment_profile_views`, admin onay akisinin hedefi.

**10c-DB/01** (taslak): `providers.views_count` (+ `increment_profile_views` -> providers); `profiles` tasinmis alanlar icin
`protect_profiles_moved_fields` (yalniz `kashe.sync_bypass`/fonksiyon yazar; kullanici yazimi sessiz geri alinir — FAZ 2a deseni);
ters ayna `trg_faz10_sync_provider_to_profile` (providers/alt profil -> profiles kopyasi); `trg_faz2_sync_profile_to_provider` duser;
`provider_id` NOT NULL + FK CASCADE (5 tablo; once NULL sayisi 0 dogrulanir), `trg_faz2b_set_provider_id` yon degistirir
(`provider_id` -> eski sutun), eski sutunlar FAZ 11'e kadar kalir.

**10c-P1:** profil duzenleme, avatar, kategori bilgileri, admin onay/askiya alma yazmalari yeni tablolara (`providers`,
`professional_profiles`, `organization_profiles`); `profile_id` okuma/yazmalari `provider_id`'ye (108 gecis); `own-profile.ts`
`PROFILE_OPEN_COLUMNS` yeni kaynaga. Tur: hotmail profil duzenle (bio/sehir/kategori), portfoy ekle, admin onay; `/p/[slug]` ve Kesfet
degismeden gorunur (ters ayna).

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

## 4. Acik sorular (10c plan turunda, Guven'e)

1. `services` tablosu: paket/aciklama/fiyat alanlari `provider_services`'te yok. (a) `services` kalir, `provider_services` turev
   (bugunku) — 10c dokunmaz; (b) `provider_services` genisler ve `services` salt okunur. Oneri: (a) — pazaryeri paketleri `services`
   kavramina bagli, FAZ 10'un konusu degil.
2. Admin onay/askiya alma hedefi: `providers.approval_status` (dogru kaynak) — admin paneli `profiles` yerine `providers`'a yazar; ters
   ayna `profiles.approval_status`'u doldurur. Oneri: evet.
3. `increment_profile_views`: `providers.views_count` eklenir, RPC oraya yazar, `profiles.views_count` ters ayna ile dolar. Oneri: evet.

## 5. Dilimler ve dogrulama (ozet)

| Dilim | Icerik | Test |
|---|---|---|
| **10a-DB/01** | davet/uyelik RPC'leri, bildirim tetikleyicileri yeni tabloda, aynalama kapanir, eski tablolar salt okunur — **YAZILDI** (bolum 6) | asama4 **T34** + T3/T4/T7/T8/T9/T10/T17/T18/T19/T25 uyarlama (35/35); **asama20** K1-K6; asama18 K2/K3 ve asama5 K3-K6 10a'ya uyarlandi |
| **10a-P1** | 7+7 akis RPC'ye, 12 dosyada okuma yeni tabloya; eski tablo adi 0 (`40-claude-code-gorevi-10a-p1-uyelik.md`) | tur (Sahne): ajans davet -> kabul -> ekipte gorunur -> rol degistir -> cikar; kurum ayni akis; `/davetlerim`; `/p/[id]` ekip |
| **10b-DB/01** | 4 sutun FK `event_types`; CHECK'ler duser | asama20 K5; asama11 K1 emekli |
| **10b-P1** | `EVENT_TYPES` silinir; 12 dosya tablodan okur | tur: ilan formu, Kesfet, teklif-topla |
| **10c-DB/01** | ters ayna, koruma, `provider_id` NOT NULL, `views_count` | asama4 **T35**; asama20 K6-K8 |
| **10c-P1** | yazma yolu yeni tablolara, `profile_id` -> `provider_id` | tur: profil duzenle, admin onay, Kesfet degismez |
| **10d** | politikalar, kontrol dosyalari, CLAUDE.md | asama20 K9 |
| **Kapanis** | 38 bolum 6, CLAUDE.md FAZ 10 paragrafi, roadmap, 04-goc-plani madde 42-45 | — |

Kirmizi cizgiler: her kesimde once uygulama yeni yola gecer, DB sonra kapatir (ters sira eski sayfalari kirar); fiziksel DROP bu fazda
YOK; `internal.*` ve FAZ 6-9 yapilarina dokunulmaz; her dilim asama4 + asama20 ile dalda, asama20 ile uretimde dogrulanir.

## 6. Kapanis notlari

### KALDIGIMIZ YER (29 Ekim 2026, Cowork haftalik kotasi doldu)

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
