# 04 — Goc Plani

Kaynak: 35 tablo, 184 kisit, 148 RLS politikasi, 14 enum, ~60 fonksiyon (uretim semasindan alinmistir).

---

## 1. UC YAPISAL BOSLUK

Goc planina gecmeden once, mevcut sema ile hedef mimari arasindaki uc temel farki tespit etmek gerekir. Bunlar teknik detay degil, **urunun seklini degistiren** farklardir.

### Bosluk 1 — Talep tek kategorili, hedef cok rollu

```
BUGUN                          HEDEF
listings.category_id  (tekil)  event_requirements (cok satir)
quote_requests.category_id     rol basina adet, zorunluluk, butce
```

Bugun bir ilan **tek kategoriye** aciliyor. "DJ ariyorum" bir ilan, "fotografci ariyorum" ayri bir ilan. Kullanici uc hizmet istiyorsa uc ayri talep aciyor ve uc ayri konusma yurutuyor.

Hedef mimaride ise tek bir etkinlik altinda birden fazla rol var ve Crew AI bunlari **birlikte** cozuyor. Bu, talep tarafinin tum akisini degistirir: ilan/basvuru modelinden etkinlik/gereksinim/ekip modeline gecis.

**Bu, gocun en buyuk parcasidir.** Mevcut `listings` ve `quote_requests` yapilari korunacak ama yeni akisin yaninda, eski akis olarak calisacaktir.

### Bosluk 2 — Teklifte kalem yok

```
BUGUN                          HEDEF
quotes.services_description    proposal_items (satir satir)
  text                         + proposal_internal_items (gizli maliyet)
quotes.total_amount            + proposal_versions (surumleme)
```

Bugunku teklif tek bir metin aciklamasi ve tek bir toplam tutardan olusuyor. Kalem yok, surum yok, ic maliyet yok, marj yok.

Commercial Optimization katmani icin bunlarin hepsi gerekli. Yani teklif yapisi **sifirdan kurulacak**; mevcut `quotes` marketplace'in basit teklif akisi olarak kalir.

### Bosluk 3 — Kurulus kimligi yok

```
BUGUN                          HEDEF
agency_members.agency_id       organizations (bagimsiz varlik)
  -> profiles                  organization_memberships
business_members.business_id
  -> profiles
```

Ajans ve kurumsal hesap, rolu `agency`/`business` olan birer **profil satiri**. Kurulusun kendi kimligi, aboneligi, fatura bilgisi, modul yapisi yok. `premium_tier` kullanici seviyesinde tutuluyor; oysa bes calisanli bir ajansin tek aboneligi olmali.

---

## 2. MEVCUT DURUM: 35 TABLO SINIFLANDIRMASI

### A. Aynen kalir — dokunulmaz (10 tablo)

| Tablo | Not |
|---|---|
| `turkish_cities` | Referans veri |
| `blog_posts` | Icerik |
| `waitlist` | Pazarlama |
| `testimonials` | Icerik |
| `push_subscriptions` | Bildirim altyapisi |
| `notifications` | Bildirim altyapisi |
| `message_violations` | Moderasyon |
| `reports` | Sikayet yonetimi |
| `category_requests` | Kategori talebi |
| `admin_audit_log` | Yonetim denetimi |

### B. Genisletilir — yapisi korunur, alan eklenir (11 tablo)

| Tablo | Eklenecek | Gerekce |
|---|---|---|
| `profiles` | — (hafifler) | Pazaryeri profili `providers`'a, kurulus verisi `organizations`'a tasinir |
| `service_categories` | `parent_id`, `layer` | Uc katmanli taksonominin ust katmani olur |
| `services` | `provider_id` | `profile_id` yaninda, sonra yerine |
| `availability_blocks` | `source`, `last_confirmed_at`, `confidence` | Musaitlik guveni (IP2) |
| `bookings` | `buyer_organization_id`, `seller_provider_id`, `event_id`, `crew_member_id` | Ajansin alici oldugu senaryo (madde 6) |
| `conversations` | `event_id` | Etkinlik baglami |
| `messages` | — | Aynen |
| `reviews` | `provider_id` | Profil yerine saglayiciya baglanir |
| `portfolio_items` | `provider_id` | Ayni |
| `profile_experiences` | `provider_id` | Ayni |
| `favorites` | `provider_id` | Ayni |

### C. Birlesir veya donusur (6 tablo)

| Bugun | Yarin | Yontem |
|---|---|---|
| `agency_members` + `business_members` | `organization_memberships` | Birlestirme; `account_type` ile ayrilir |
| `agency_invitations` + `business_invitations` | `organization_invitations` | Ayni |
| `listings` | Korunur; yaninda `events` + `event_requirements` | Eski akis calismaya devam eder |
| `quote_requests` | Korunur; `brief_data` -> `event_spec_versions` tohumu | Ayni |
| `applications` | Korunur; yaninda `match_candidates` | Ayni |
| `quotes` | Korunur; yaninda `proposals` zinciri | Marketplace teklifi ile Event OS teklifi ayri urunler |

**Onemli ilke:** Eski akislar silinmez, yenilerin yaninda calisir. Uretimde kullanicisi olan hicbir akis kesilmez.

### D. Yeni olusturulur (28 tablo)

```
KIMLIK VE KIRACI
  organizations
  organization_memberships
  organization_invitations
  organization_modules

SAGLAYICI KAYIT DEFTERI
  providers
  professional_profiles
  organization_profiles
  provider_services

YETENEK VE HAVUZ
  talents
  organization_talent_records
  organization_talent_record_roles

TAKSONOMI
  roles
  skills
  role_skill_map

ETKINLIK
  event_briefs
  event_spec_versions
  events
  event_requirements

ESLESTIRME
  match_runs
  match_candidates

EKIP
  crews
  crew_members

TICARI
  proposals
  proposal_versions
  proposal_items
  rfps
  rfp_items
  rfp_invites

ERISIM
  portal_access_links

EVENT OS
  crm_leads
  tasks
  suppliers

ZEKA
  price_benchmarks
  analytics_events

INTERNAL SEMA (PostgREST'e acilmaz)
  internal.organization_talent_rates
  internal.crew_member_commercials
  internal.proposal_internal_items
  internal.access_audit
```

---

## 3. ONEMLI TESPITLER

### Iyi haber: uc sey zaten hazir

**Uyelik deseni kurulu.** `agency_members` ve `business_members` birebir ayni yapida: `id, {parent}_id, member_user_id, member_role, joined_at`. Rol enum'lari da ayni degerlere sahip: `owner, manager, member`. Birlestirme icin enum donusumu bile gerekmiyor; yalnizca yeni roller eklenecek.

**Yetkilendirme fonksiyon uzerinden.** `has_business_role(p_business_id, p_min_role)` hiyerarsik kontrol yapiyor. Ayrica `is_business_member`, `is_professional_or_agency`, `owns_quote_request` var. Yani RLS politikalari dogrudan `p.role = 'x'` yerine fonksiyon cagirma aliskanligina zaten sahip. `has_org_permission(org_id, permission)` fonksiyonuna gecis dogal olur.

**Esnek alan saklama kurulu.** `profiles.attributes`, `profiles.category_attributes`, `quote_requests.brief_data` — hepsi JSONB. EventSpec'in `payload` ve `provenance` alanlari yeni bir yaklasim degil, mevcut desenin devami.

### Dikkat gerektiren dort nokta

**Anahtar tipi karisikligi.** `service_categories.id` ve `turkish_cities.id` **integer**; diger her sey UUID. Yeni taksonomi tablolari (`roles`, `skills`) **integer** olmali ki mevcut yapiya uysun. Etkinlik ve saglayici tablolari UUID kalir.

**`role` alani text, enum degil.** `profiles.role` kisitsiz metin. Gocte enum'a cevrilmesi onerilir ama bu tek basina bir migration adimidir ve mevcut degerlerin temizlenmesini gerektirir.

**`premium_tier` kullanici seviyesinde.** Degerleri: `none, premium, plus, agency`. Is planindaki paketlerle ortusuyor (499/999/1.999 TL).

**Karar: goc rol bazlidir, tier degeri bazli degil.**

- `professional` rollu profillerin `premium_tier` degeri **profilde kalir** (bireysel abonelik)
- `agency` ve `business` rollu profillerinki `organizations.subscription_tier`'a **tasinir**

⚠️ **`grantPremium` rol kontrolu yapmiyor** (Rapor 02, 5d). Bir `professional` kullaniciya `agency` tier verilebiliyor; o kullanicinin `organizations` kaydi olmayacagi icin goc sirasinda kaybolur.

Iki is gerekir: (1) mevcut veride bu durumun var olup olmadigi kontrol edilir, (2) `grantPremium`'a rol kontrolu eklenir.

**Tetikleyici zinciri yogun.** `on_quote_accepted_create_booking`, `on_agency_invitation_accepted_add_member`, `on_business_invitation_accepted_add_member`, `validate_*_membership_roles` ve bir dizi bildirim tetikleyicisi var. Uyelik tablolari birlestirilirken bu tetikleyicilerin de tasinmasi gerekir; aksi halde davet kabul akisi sessizce bozulur.

---

## 3b. ENVANTER BULGULARI

Uc envanter calismasi yapildi (`docs/envanter/`). Ciktilar goc planini uc noktada degistirdi.

### En kritik bulgu: migration zinciri uretimi temsil etmiyor

Uc raporun ucunden de ayni sonuc cikti:

| Bulgu | Kanit |
|---|---|
| `owns_quote_request` canli politikada kullaniliyor, repoda `CREATE FUNCTION` tanimi **yok** | Rapor 01, 5b |
| `is_admin()` fonksiyonu repoda **yok**; kontrol 11 yerde satir ici kopyalanmis | Rapor 03 |
| CLAUDE.md'ye yazilan alti yetki fonksiyonundan yalniz **ikisi** repoda tanimli | Rapor 03 |

Sebep bilinen calisma kisitidir: SQL'ler Dashboard'dan elle uygulaniyor ve bir kismi migration dosyasina geri yazilmamis.

**Sonuc:** Repodaki migration zinciri sifirdan kosturulursa **uretimden farkli bir veritabani** cikar. Bu, gocun temel varsayimini sarsar — "mevcut semanin uzerine ekleriz" demek icin mevcut semanin ne oldugunun yazili olmasi gerekir.

**Bu yuzden FAZ -1 (Sema Uzlastirma) eklendi ve goc oncesi zorunlu hale getirildi.**

### Rol kontrolu envanteri (Rapor 01)

337 bulgu, 87 dosya.

| Taraf | Durum |
|---|---|
| TypeScript | **Tek kaynak yok.** 36 dosya rol kontrolunu yalniz elle yapiyor, 6 dosya yalniz yardimci kullaniyor, 13 dosya ikisini birden |
| SQL | **Fonksiyon araciligi kurulu.** 65 yetki fonksiyonu cagrisina karsi yalniz 10 dogrudan `role = '...'` karsilastirmasi |

`has_business_role` 16 politikada, `is_business_member` 10 politikada cagriliyor. **Bu iki fonksiyonun govdesi `organization_memberships`'e cevrildiginde 26 politika otomatik dogru calisir**, politika metinlerine hic dokunulmaz.

**`app/lib/business-write.ts` ilk taramada kacirildi.** 60 cagri, 17 dosya — A grubunun en buyuk yuzeyi. `role` degil `member_role` kullandigi icin desen yakalamadi. Bu dosya goc planinda **tek basina bir adimdir.**

### profiles kullanim haritasi (Rapor 02)

146 erisim / 75 dosya. `select` 127, `update` 19.

**`select('*')`: 8 yer**, hepsi `app/profil/` altinda. Beklenenden az; Faz 2 bu acidan yonetilebilir.

**Ancak tip guvenligi yok.** `app/lib/types.ts` icindeki `Profile` tipi 23 alan tanimliyor ama kodda kullanilan **yedi alan tipte hic yok**: `category_attributes`, `default_allowed_applicant_roles`, `suspended_at`, `suspension_reason`, `suspended_by`, `last_seen_at`, `welcome_email_sent_at`.

Ilk ikisi `providers`'a tasinacak. **Tasindiginda TypeScript uyarmayacak, calisma zamaninda `undefined` gelecek.** `select('*')` ile birleşince sessiz kirilma riski iki katina cikar.

**Yedi ayri profil sekli var** ve her biri bagimsiz guncellenecek: `Profile`, `ProfileWithCity`, `FeaturedProfile`, `MarqueeProfile`, `PublishedProfile` (iki farkli tanim, ayni ad), `PublicProfile` (iki kez).

⚠️ **`slug`, `approved_at`, `views_count` icin "0 okuma" cikti. Bu, kaldirilabilir demek DEGILDIR.** `slug` profil URL'lerinde kullaniliyor olmali; muhtemelen iliskisel select icinde veya farkli desenle erisiliyor. Sifir okuma bulgusu "dogrula" isaretidir, "kaldir" isareti degil.

### Tetikleyici agaci (Rapor 03)

28 tetikleyici, 35 fonksiyon tanimi (32 benzersiz), 108 politika.

**35 fonksiyondan yalniz 3'unde `RAISE EXCEPTION` var. Kalan 32'si basarisizlikta sessiz.**

Sessiz bozulma siralamasi:

| Sira | Fonksiyon | Bozulursa |
|---|---|---|
| 1 | `on_quote_accepted_create_booking` | Teklif kabul edilir, rezervasyon olusmaz. Sifir `RAISE`, `bookings`'e yaziyor |
| 2 | `on_agency_invitation_accepted_add_member`, `on_business_invitation_accepted_add_member` | Davet `accepted` olur, uyelik satiri olusmaz. `RAISE` var ama yalniz "kullanici yok" dalinda; tetikleyici tasinmazsa o dal hic calismaz |
| 3 | 12 bildirim fonksiyonu | Hicbirinde `RAISE` yok; kayip yalniz kullanici sikayetiyle anlasilir |

**Ortusen tetikleyiciler:** `profiles` uzerinde iki ayri BEFORE UPDATE tetikleyicisi ayni isi yapiyor (`handle_updated_at` ve `update_updated_at_column`). `messages`'ta da benzer ikilik var. Hangisinin gecerli oldugu koddan net degil; FAZ -1'de netlesmelidir.

---

## 4. GOC SIRASI

Her faz bagimsiz olarak yayina alinabilir ve geri alinabilir. Hicbir faz uretimdeki bir akisi kesmez.

### FAZ -1 — Sema uzlastirma (ZORUNLU on kosul)

Repo ile uretim arasindaki fark kapatilmadan goc baslatilmaz.

0a. Uretimdeki **tum** fonksiyon, tetikleyici ve politika tanimlari dokulur.
0b. Repo migration zinciri temiz bir veritabaninda kosturulur; cikan sema ile uretim karsilastirilir.
0c. Fark listesi cikarilir: repoda olmayan tanimlar, repoda olup uretimde olmayanlar, govdesi farkli olanlar.
0d. Eksikler icin **onarim migration'i** yazilir; yalniz tanim ekler, veri degistirmez.
0e. `handle_updated_at` / `update_updated_at_column` ikiligi ve `messages` uzerindeki benzer ikilik netlestirilir; gereksiz olan kaldirilir.
0f. `is_admin()` fonksiyonu tanimlanir; 11 satir ici kopya bu fonksiyona cevrilir.
0g. Onarim sonrasi migration zinciri tekrar kosturulur ve uretimle **birebir** eslestigi dogrulanir.

**Cikti:** Repodan kosturulan sema = uretim semasi.

**Risk: dusuk ama is yuku yuksek.** Yalniz tanim ekleme; veri dokunulmaz. Ancak fark sayisi bilinmiyor; envanter bu adimin ilk isidir.

---

### FAZ 0 — Kiraci temeli (goc yok, yalniz ekleme)

1. `organizations`, `organization_memberships`, `organization_invitations`, `organization_modules` olusturulur.
2. Mevcut `agency` ve `business` rollu her profil icin bir `organizations` satiri uretilir:
   - `account_type` = rolden turetilir
   - `display_name` = `company_name` veya `full_name`
   - `subscription_tier` = `premium_tier`
   - `owner_user_id` = profil kimligi
3. `agency_members` ve `business_members` kayitlari `organization_memberships`'a kopyalanir.
4. Kurucu icin `owner` rolunde bir uyelik satiri eklenir (bugun yok — kurucu profil satirinin kendisi).
5. **Uyumluluk gorunumleri** olusturulur:
   ```sql
   create view v_business_members as
     select om.id, o.owner_user_id as business_id, om.user_id as member_user_id,
            om.role::text as member_role, om.joined_at
     from organization_memberships om
     join organizations o on o.id = om.organization_id
     where o.account_type = 'business';
   ```
6. `has_org_permission(p_org_id uuid, p_permission text)` fonksiyonu yazilir.
7. **Cift yazma** devreye alinir: yeni uyelik hem eski hem yeni tabloya yazilir.

8. **Tetikleyiciler once kopyalanir, sonra eskisi kaldirilir.** Tasinacak yedi tetikleyici (Rapor 03 Grup A):
   - `on_agency_invitation_accepted_add_member`
   - `on_business_invitation_accepted_add_member`
   - `on_agency_invitation_insert_notify`
   - `on_business_invitation_insert_notify`
   - `on_agency_member_insert_notify_agency`
   - `on_business_member_insert_notify_business`
   - `validate_agency_membership_roles` / `validate_business_membership_roles`

9. **Sessiz fonksiyonlara sayac eklenir.** `on_*_invitation_accepted_add_member` govdelerine bir log satiri veya sayac yazilir. Calistigini gormek, calismadigini fark etmekten kolaydir.

10. `has_business_role` ve `is_business_member` govdeleri `organization_memberships`'e cevrilir. **Politika metinlerine dokunulmaz** — 26 politika otomatik dogru calisir.

**Risk: dusuk.** Hicbir okuma yolu degismez. Tek risk tetikleyici kopyalamanin atlanmasi; adim 8 ve 9 bunu karsilar.

### FAZ 1 — Internal sema iskeleti

8. `internal` semasi olusturulur; PostgREST `exposed_schemas` listesine **eklenmez**.
9. `internal.access_audit` kurulur.
10. Erisim fonksiyonlari yazilir (`security definer`, uyelik + rol kontrolu iceren).
11. Gizlilik testi yazilir: musteri jetonuyla `internal` semadaki her tabloya erisim denenir, hepsi reddedilmeli.

**Risk: yok.** Yalniz ekleme.

### FAZ 2 — Saglayici kayit defteri

**ON KOSUL — tip tekillestirme.** Alan tasimaya baslamadan once:

11a. `Profile` tipi tamamlanir; eksik yedi alan eklenir (`category_attributes`, `default_allowed_applicant_roles`, `suspended_at`, `suspension_reason`, `suspended_by`, `last_seen_at`, `welcome_email_sent_at`).
11b. Yedi profil sekli tekillestirilir. Ozellikle ayni adi tasiyan iki farkli `PublishedProfile` tanimi ve iki farkli `PublicProfile` birlestirilir.
11c. `app/profil/` altindaki sekiz `select('*')` acik alan listesine cevrilir.
11d. `slug`, `approved_at`, `views_count` icin "sifir okuma" bulgusu **dogrulanir**; iliskisel select ve farkli desenler taranir. Kullanilmadigi kanitlanmadan hicbir alan kaldirilmaz.

Bu adimlar yapilmadan alan tasinirsa TypeScript uyarmaz ve calisma zamaninda `undefined` gelir.

12. `talents`, `providers`, `professional_profiles`, `organization_profiles`, `provider_services` olusturulur.
13. Her `professional` rollu profil icin:
    - `talents` satiri (`user_id` dolu, `claim_status='claimed'`)
    - `providers` satiri (`provider_type='professional'`, `talent_id` dolu)
    - `professional_profiles` satiri (bio, deneyim, fiyat)
14. Her `agency` rollu profil icin `providers` satiri (`provider_type='organization'`).
15. `services` -> `provider_services` kopyalanir; `services.provider_id` alani eklenir ve doldurulur.
16. `portfolio_items`, `profile_experiences`, `reviews`, `favorites` tablolarina `provider_id` eklenir ve doldurulur.
17. Okuma yollari tek tek `providers`'a gecirilir; `profile_id` alanlari bir surum boyunca korunur.

**Risk: orta.** Cift alan donemi dikkat ister; her iki alan da senkron tutulmali.

### FAZ 3 — Taksonomi

18. `roles`, `skills`, `role_skill_map` olusturulur (integer anahtarli).
19. Mevcut 23 `service_categories` satiri **rol** olarak `roles`'a kopyalanir; `legacy_category_id` doldurulur.
20. Ust katman servis kategorileri olusturulur (6-8 adet) ve roller bunlara baglanir.
21. Gorunum: `v_professional_roles` — eski kategori iliskisini yeni rol kimligine cevirir.
22. `skills` bos baslar; IP1'in stil cikarimi doldurur.

**Risk: dusuk.** Eski `category_id` alanlari korunur.

### FAZ 4 — Etkinlik ve EventSpec

23. `event_briefs`, `event_spec_versions`, `events`, `event_requirements` olusturulur.
24. Mevcut `quote_requests.brief_data` yapisi incelenir; EventSpec semasinin ilk surumu buna gore tanimlanir.
25. Yeni talep akisi **yeni bir yol** olarak acilir; eski `listings`/`quote_requests` akisi calismaya devam eder.
26. `conversations.event_id` eklenir.

**Risk: dusuk.** Paralel akis.

### FAZ 5 — Yetenek havuzu

27. `organization_talent_records`, `organization_talent_record_roles` olusturulur.
28. `internal.organization_talent_rates` olusturulur.
29. Mevcut `agency_members` iliskileri yerel kayitlara tasinir (her profesyonel icin `talents` kaydi zaten Faz 2'de olustu).
30. Harici profesyonel ekleme ve davet akisi kurulur.

**Risk: orta.** Ajans arayuzu degisir.

### FAZ 6 — Eslestirme ve ekip

31. `match_runs`, `match_candidates` olusturulur.
32. `crews`, `crew_members`, `internal.crew_member_commercials` olusturulur.
33. Match V0 kural tabanli calisir; sonuclar kaydedilir.

### FAZ 7 — Ticari katman

34. `proposals`, `proposal_versions`, `proposal_items`, `internal.proposal_internal_items` olusturulur.
34b. `rfps`, `rfp_items`, `rfp_invites` olusturulur (Buyer Workspace icin).
35. `portal_access_links` ve musteri portali kurulur.
36. `bookings` genisletilir: `buyer_organization_id`, `seller_provider_id`, `event_id`, `crew_member_id`.

**Risk: yuksek.** `bookings` uretimde aktif ve `on_quote_accepted_create_booking` tetikleyicisi var. Yeni alanlar nullable eklenmeli, tetikleyici once eski davranisini korumali.

### FAZ 8 — Event OS modulleri

37. `crm_leads`, `tasks`, `suppliers`, `activity_logs`.
38. Buyer Workspace tablolari: `rfps`, `procurement_requests`, `supplier_shortlists`.

### FAZ 9 — Zeka katmani

39. `analytics_events` (olay zinciri).
40. `price_benchmarks` + zamanlanmis toplama isi.
41. Trust Score hesaplama isi.

### FAZ 10 — Temizlik

42. Uyumluluk gorunumleri kaldirilir.
43. Cift yazma kapatilir.
44. `agency_members`, `business_members`, `agency_invitations`, `business_invitations` kullanimdan kaldirilir.
45. `profiles`'tan tasinmis alanlar kaldirilir.

---

## 5. RLS GOC STRATEJISI

148 politika var ve onemli kismi rol kontrolu iceriyor. Hepsini birden degistirmek riskli.

**Onerilen yaklasim: fonksiyon araciligi.**

Bugunku politikalar zaten `is_admin(auth.uid())` ve `has_business_role(...)` gibi fonksiyonlar cagiriyor. Ayni deseni surdurup **fonksiyonun icini degistirmek**, politikayi degistirmekten cok daha guvenli:

```sql
-- Once
create function has_business_role(p_business_id uuid, p_min_role business_member_role)
  -- govde: business_members tablosuna bakar

-- Sonra (imza ayni, govde degisir)
create or replace function has_business_role(p_business_id uuid, p_min_role business_member_role)
  -- govde: organization_memberships'a bakar, uyumluluk esleme ile
```

Boylece politikalara **hic dokunulmadan** yetkilendirme kaynagi degistirilir. Politika metinleri ancak yeni izin turleri gerektiginde (ornegin `crew.manage`, `commercial.view`) guncellenir.

Dogrudan `p.role = 'agency'` yazan politikalar tek tek ele alinir; bunlar sayica az (yaklasik 8-10 politika).

---

## 6. URETIM RISKLERI

| Risk | Etki | Onlem |
|---|---|---|
| Uyelik tetikleyicilerinin kopmasi | Davet kabul akisi sessizce bozulur | Tetikleyiciler yeni tabloya once kopyalanir, sonra eskisi kaldirilir |
| `bookings` tetikleyicisi | Teklif kabulunde rezervasyon olusmaz | Yeni alanlar nullable; tetikleyici once eski davranisi korur |
| Cift alan donemi (`profile_id` + `provider_id`) | Veri tutarsizligi | Senkron tetikleyici; nightly tutarlilik kontrolu |
| RLS fonksiyon degisimi | Yanlis erisim veya erisim kaybi | Once golge ortamda tum politika testleri; sonra kademeli |
| `premium_tier` gocu | Abonelik kaybi | Gocte iki yerde tutulur; kesinlestikten sonra profil alani salt okunur |
| Kategori kimligi (integer) ile yeni tablolar (UUID) | Join hatalari | Taksonomi tablolari integer kalir; karisim yapilmaz |
| Sema dokumundeki 100 satir siniri | Gozden kacan tablo | Goc oncesi tam dokum tekrar alinir ve bu belge dogrulanir |
| **Repo migration zinciri uretimi temsil etmiyor** | Sifirdan kurulan ortam calismaz; goc yanlis zemine kurulur | **FAZ -1 zorunlu on kosul** |
| **32 fonksiyon basarisizlikta sessiz** | Akis bozulur, hata gorunmez | Tetikleyiciler once kopyalanir; kritik olanlara sayac eklenir |
| **`business-write.ts` 60 cagri, tek yerde** | A grubunun en buyuk yuzeyi; atlanirsa yetkilendirme yarim kalir | Ayri bir goc adimi olarak ele alinir |
| **Tip tanimi eksik (7 alan)** | Alan tasinir, TypeScript uyarmaz, calisma zamaninda undefined | Faz 2 on kosulu: tip tekillestirme |
| **`grantPremium` rol kontrolu yok** | `professional`'a `agency` tier verilmis kayitlar gocte kaybolur | Goc oncesi veri kontrolu + kod duzeltmesi |

---

## 7. ILK ADIM

Uc envanter tamamlandi (`docs/envanter/`). Ciktilar bu belgeye islendi.

**Siradaki is: FAZ -1 sema uzlastirma.**

Bu, goc planinin geri kalaninin on kosuludur. Repodaki migration zinciri uretimi temsil etmiyorsa, "mevcut semanin uzerine ekleriz" varsayimi gecersizdir.

Ilk adim, dorduncu bir envanter isidir: **uretim semasi ile repo migration'larinin karsilastirilmasi.** Bu karsilastirma FAZ -1'in fark listesini uretir.

Ardindan:

1. Onarim migration'i yazilir (yalniz tanim ekler, veri degistirmez)
2. Temiz ortamda kosturulur ve uretimle esitlik dogrulanir
3. FAZ 0 baslar


---

## 8. BELGE ILISKILERI

Bu goc plani su belgelerle birlikte okunur:

- `00-genel-bakis.md` — urun modeli ve rol yapisi
- `01-veri-modeli.md` — hedef tablolarin tam tasarimi ve gerekceleri
- `02-guvenlik-modeli.md` — internal sema ve yetki matrisi
- `03-taksonomi.md` — kategori gocunun ayrintisi
- `05-arayuz-modeli.md` — calisma alani ayrimi

Bir tablo tasarimi sorusunda once `01-veri-modeli.md` okunur; bu belge yalniz **gecis sirasini** ve **uretim risklerini** anlatir.
