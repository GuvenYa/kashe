# Envanter 02 — `profiles` tablosu kullanimi

Kaynak: repo calisma agaci, HEAD = `46fcf49`. **Yalniz okuma** ile uretildi; hicbir kaynak dosya degistirilmedi.

**Amac:** goc planinda `profiles` hafifleyecek — pazaryeri profili alanlari `providers` +
`professional_profiles`, kurulus alanlari `organizations` tablosuna tasinacak. Bu envanter
hangi kodun hangi alani okudugunu tespit eder.

## 0. OZET

| Olcum | Deger |
|---|---|
| `.from('profiles')` erisimi | **146** / 75 dosya |
| select | 127 |
| update | 19 |
| insert / upsert / delete | 0 |
| **`select('*')`** | **8** |
| Iliskisel referans (`profiles!fk(...)`) | 46 / 27 dosya |
| SQL tarafi `profiles` referansi | 100 / 18 dosya |

**Goc etkisi dagilimi:**

| Etki | Adet | Oran |
|---|---|---|
| etkilenmez | 74 | %50.7 |
| join-gerekir | 62 | %42.5 |
| alan-tasinir | 4 | %2.7 |
| incelenmeli | 6 | %4.1 |

| Hedef tablo | Adet |
|---|---|
| profiles | 74 |
| karma | 63 |
| providers | 5 |
| organizations | 4 |

> **En onemli tek sayi: 62 sorgu (%42) gocte iki tabloya birden bakmak zorunda.**
> Ayni sorguda hem `profiles`'ta kalan hem tasinan alan var.

### Aramanin kendisi (kanit)

Sayilar grep ile degil, **dengeli-parantez ayristiricisiyle** uretildi: her `.from('profiles')`
cagrisindan bir sonraki `.from(` cagrisina kadar olan dilimde `.select/.update/.insert/...`
aranip ilk argumanin string govdesi cikarildi. Nedeni: pencere tabanli grep, bir sorgunun
`select`'ini bir onceki `from`'a bagliyordu (`app/profil/duzenle/actions.ts:115` yanlislikla
`select('*')` sayiliyordu). Ayristirici iki noktada gozle dogrulandi.

---

## 1. ALAN BAZLI TABLO

Okuma sayilari **select alan listelerinden** cikarildi; `select('*')` yapan 8 sorgu bu sayima **girmez**
(bolum 2'de ayrica ele alindi). Yazma sayilari `update` nesnesinin anahtarlarindan.

| Alan | Okunuyor (gecis/dosya) | Yaziliyor (gecis/dosya) | Hedef tablo |
|---|---|---|---|
| `role` | 67/44 | 0/0 | profiles (kalir) |
| `full_name` | 49/31 | 0/0 | profiles (kalir) |
| **`company_name`** | 38/24 | 0/0 | organizations |
| `id` | 33/26 | 0/0 | profiles (kalir) |
| `suspended_at` | 25/24 | 2/1 | profiles (kalir) |
| `is_admin` | 19/13 | 2/1 | profiles (kalir) |
| `email` | 17/13 | 0/0 | profiles (kalir) |
| `avatar_url` | 13/10 | 2/1 | profiles (kalir) |
| **`approval_status`** | 12/9 | 3/1 | providers |
| **`premium_tier`** | 11/10 | 4/2 | organizations |
| **`is_published`** | 10/8 | 5/2 | providers |
| **`premium_until`** | 10/9 | 4/2 | organizations |
| **`category_attributes`** | 7/7 | 1/1 | providers |
| **`primary_category_id`** | 7/7 | 0/0 | providers |
| **`city_id`** | 6/5 | 0/0 | providers |
| **`attributes`** | 5/4 | 0/0 | providers |
| **`bio`** | 5/4 | 0/0 | providers |
| `last_seen_at` | 3/3 | 1/1 | profiles (kalir) |
| `suspension_reason` | 3/3 | 2/1 | profiles (kalir) |
| `welcome_email_sent_at` | 2/2 | 2/2 | profiles (kalir) |
| **`approval_note`** | 1/1 | 3/1 | providers |
| **`default_allowed_applicant_roles`** | 1/1 | 0/0 | providers |
| `phone` | 1/1 | 0/0 | profiles (kalir) |
| **`approved_at`** | 0/0 | 0/0 | providers |
| `kvkk_approved_at` | 0/0 | 0/0 | profiles (kalir) |
| **`slug`** | 0/0 | 0/0 | providers |
| `suspended_by` | 0/0 | 2/1 | profiles (kalir) |
| **`views_count`** | 0/0 | 0/0 | providers |

**Hic okunmayan/yazilmayan tasinan alanlar:** `slug`, `approved_at`, `views_count` — select listelerinde
hic gecmiyor. `views_count` yalniz `select('*')` uzerinden okunuyor (`app/profil/page.tsx:230`),
`slug` ve `approved_at` icin kodda **tek bir okuma bile bulunamadi**. Bunlar goc oncesi
"gercekten kullaniliyor mu" diye sorgulanmali.

---

## 2. `select('*')` LISTESI — EN KRITIK BOLUM

**8 yer. Hepsi `app/profil/` altinda.**

> **Ortak kok risk:** sekiz sorgunun tamami sonucu `as Profile` ile zorla doku­yor ve
> `app/lib/types.ts:5` `Profile` tipi tasinan alanlarin cogunu (`bio, slug, city_id,
> primary_category_id, is_published, approval_status, approval_note, approved_at,
> views_count, attributes, company_name, premium_tier, premium_until`) **hala icinde tutuyor**.
> Yani alan tasindiktan sonra kolon gelmese bile **derleme gecer**, calisma zamaninda `undefined` olur.
> `category_attributes` ve `default_allowed_applicant_roles` tipte **hic yok**, satir ici cast ile okunuyor.

| # | Dosya:satir | select | Goc etkisi |
|---|---|---|---|
| 1 | `app/profil/deneyim/page.tsx:25` | `'*, service_categories!profiles_primary_category_id_fkey(slug)'` | **join-gerekir** / karma |
| 2 | `app/profil/duzenle/actions.ts:147` | `'*'` | **join-gerekir** / karma |
| 3 | `app/profil/duzenle/page.tsx:24` | `'*'` | **join-gerekir** / karma |
| 4 | `app/profil/hizmetlerim/page.tsx:29` | `'*'` | **join-gerekir** / karma |
| 5 | `app/profil/kategori-bilgileri/page.tsx:25` | `'*, service_categories!profiles_primary_category_id_fkey(slug, name_tr)'` | **join-gerekir** / karma |
| 6 | `app/profil/page.tsx:39` | `'*, turkish_cities(name), service_categories!profiles_primary_category_id_fkey(n` | **join-gerekir** / karma |
| 7 | `app/profil/paketler/page.tsx:25` | `'*'` | **etkilenmez** / profiles |
| 8 | `app/profil/portfoy/page.tsx:28` | `'*'` | **etkilenmez** / profiles |

### Her biri icin gercekten kullanilan alanlar

**`app/profil/deneyim/page.tsx:25`**

- Okunan alanlar: TUMU (select('*') + service_categories!profiles_primary_category_id_fkey(slug))
- Tasinan alanlar: primary_category_id (iliskili select uzerinden)
- Not: select('*') ile donen profileData nesnesinden ASAGIDA gercekten kullanilan iki sey var: (1) satir 36 isProfessional(profile) — yalniz profile.role okur (app/lib/profile-helpers.ts satir 14-16); (2) satir 48 profile.service_categories?.slug — bu iliski profiles_primary_category_id_fkey uzerinden kuruluyor. Baska hicbir profil alani kullanilmiyor. role profiles'ta kalacagi icin, kategori iliskisi providers'a tasindiginda sorgu iki tabloya bakmak zorunda.

**`app/profil/duzenle/actions.ts:147`**

- Okunan alanlar: TUMU (select('*'))
- Tasinan alanlar: bio, city_id, primary_category_id, approval_status (providers); company_name (organizations)
- Not: Donen profile nesnesinden gercekten kullanilan alanlar: satir 159 profile.role, satir 160 profile.approval_status, satir 168 ve 177 tekrar profile.role, ve satir 180 getMissingPublishFields(profile) cagrisi — o fonksiyon (app/lib/profile-helpers.ts satir 47-97) full_name, avatar_url, bio, city_id, phone, role, primary_category_id, company_name okur. Yani toplam kullanilanlar: role, approval_status, full_name, avatar_url, bio, city_id, phone, primary_category_id, company_name. Yayin kapisi bu yuzden gocte uc tablodan da veri toplamak zorunda.

**`app/profil/duzenle/page.tsx:24`**

- Okunan alanlar: TUMU (select('*'))
- Tasinan alanlar: bio, city_id, primary_category_id, attributes, default_allowed_applicant_roles (providers); company_name (organizations)
- Not: profile nesnesi DuzenleForm'a butun olarak veriliyor (satir 56). duzenle-form.tsx icinde gercekten okunan alanlar: role (satir 64, 109 ve isProfessional/isBusiness cagrilari satir 107-108), full_name (74, 172), bio (75), phone (77), city_id (79), primary_category_id (82), company_name (84), default_allowed_applicant_roles (89-90), attributes (101), id (170), avatar_url (171), email (263). Yani form uc tabloya birden yayilan alanlari tek nesne olarak bekliyor; gocte hem sorgu hem prop sozlesmesi degismek zorunda.

**`app/profil/hizmetlerim/page.tsx:29`**

- Okunan alanlar: TUMU (select('*'))
- Tasinan alanlar: primary_category_id
- Not: Donen profile nesnesinden gercekten kullanilan iki alan: satir 41 isProfessional(profile) → profile.role, ve satir 85 profile.primary_category_id (HizmetlerimClient'a prop). role profiles'ta kalir, primary_category_id providers'a tasinir; bu yuzden iki tabloya bakmak gerekecek.

**`app/profil/kategori-bilgileri/page.tsx:25`**

- Okunan alanlar: TUMU (select('*') + service_categories!profiles_primary_category_id_fkey(slug, name_tr))
- Tasinan alanlar: category_attributes, primary_category_id (iliskili select uzerinden)
- Not: Donen profile nesnesinden gercekten kullanilanlar: satir 38 isProfessional(profile) → profile.role; satir 42 profile.service_categories?.slug; satir 105 profile.service_categories?.name_tr; satir 114 profile.category_attributes (KategoriForm'a initialAttributes). Baska profil alani okunmuyor. role profiles'ta kalir, digerleri providers tarafina gecer.

**`app/profil/page.tsx:39`**

- Okunan alanlar: TUMU (select('*') + turkish_cities(name) + service_categories!profiles_primary_category_id_fkey(name_tr, emoji))
- Tasinan alanlar: bio, city_id, primary_category_id, is_published, approval_status, approval_note, views_count, category_attributes (providers); company_name, premium_tier, premium_until (organizations)
- Not: select('*') donusundan KODDA gercekten okunan alanlar: suspended_at (51), premium_tier (161), premium_until (167), views_count (230), turkish_cities.name (241, city_id FK), service_categories.emoji/name_tr (242-243, primary_category_id FK), category_attributes (264, 276), full_name (281, 292, 338), company_name (290-291, 336), avatar_url (302, 305), role (317 getRoleLabel + 61-64 isProfessional/isClient/isBusiness/isAgency), is_published (324, 329, 1156), approval_status (367, 369, 385, 404, 1153), approval_note (393, 411), primary_category_id (426, 457), phone (547, 550), bio (561, 565), id (1169). Ayrica satir 246-248'deki getMissingPublishFields/canPublish/getCompletenessPercent cagrilari full_name, avatar_url, bio, city_id, phone, role, primary_category_id, company_name okuyor. Bu sayfa uc tabloyu birden gerektiren en agir tuketici.

**`app/profil/paketler/page.tsx:25`**

- Okunan alanlar: TUMU (select('*'))
- Tasinan alanlar: yok
- Not: select('*') olmasina ragmen donen profile nesnesinden ASAGIDA kullanilan TEK sey satir 37'deki isProfessional(profile) — yani yalniz profile.role. Paketler PaketlerClient'a service_packages'tan geliyor, profilden alan tasinmiyor. role profiles'ta kaldigi icin goc bu sorguyu etkilemez; yine de select('*') daralacagi icin ileride select('role') yapilmasi guvenli olur.

**`app/profil/portfoy/page.tsx:28`**

- Okunan alanlar: TUMU (select('*'))
- Tasinan alanlar: yok
- Not: Donen profile nesnesinden kullanilan TEK alan: satir 39 isProfessional(profile) → profile.role. PortfolioUpload'a user.id veriliyor (profile.id degil), portfolyo kayitlari portfolio_items'tan geliyor. role profiles'ta kaldigi icin goc etkilemiyor.

---

## 3. SORGU BAZLI TABLO

146 sorgu. `ELLE` isaretli iki satir gruplama hatasi nedeniyle ajana gitmedi, elle siniflandirildi.

| # | Dosya:satir | Tip | Okunan alanlar | Gocten etkilenir mi | Hedef |
|---|---|---|---|---|---|
| 1 | `app/admin/actions.ts:28` | select | is_admin | **etkilenmez** | profiles |
| 2 | `app/admin/actions.ts:80` | select | is_admin | **etkilenmez** | profiles |
| 3 | `app/admin/actions.ts:101` | update | (update) suspended_at, suspension_reason, suspended_by, is_published | **join-gerekir** | karma |
| 4 | `app/admin/actions.ts:127` | update | (update) suspended_at, suspension_reason, suspended_by | **etkilenmez** | profiles |
| 5 | `app/admin/actions.ts:160` | update | (update) is_admin | **etkilenmez** | profiles |
| 6 | `app/admin/actions.ts:184` | update | (update) is_admin | **etkilenmez** | profiles |
| 7 | `app/admin/actions.ts:307` | update | (update) approval_status, approval_note, is_published; (returning select) id, approval_status, is_pu | **join-gerekir** | karma |
| 8 | `app/admin/actions.ts:367` | update | (update) approval_status, approval_note, is_published; (returning select) id, approval_status | **alan-tasinir** | providers |
| 9 | `app/admin/actions.ts:409` | update | (update) approval_status, approval_note, is_published; (returning select) id, approval_status, email | **join-gerekir** | karma |
| 10 | `app/admin/actions.ts:699` | select | is_admin | **etkilenmez** | profiles |
| 11 | `app/admin/actions.ts:802` | update | (update) premium_tier, premium_until | **incelenmeli** | organizations |
| 12 | `app/admin/actions.ts:830` | update | (update) premium_tier, premium_until | **incelenmeli** | organizations |
| 13 | `app/admin/blog/actions.ts:18` | select | is_admin | **etkilenmez** | profiles |
| 14 | `app/admin/gorusler/actions.ts:18` | select | is_admin | **etkilenmez** | profiles |
| 15 | `app/admin/kullanicilar/page.tsx:69` | select | id, full_name, company_name, email, role, avatar_url, created_at, updated_at, is_admin, suspended_at | **join-gerekir** | karma |
| 16 | `app/admin/layout.tsx:38` | select | is_admin, full_name, avatar_url | **etkilenmez** | profiles |
| 17 | `app/admin/page.tsx:43` | select | id (count: exact, head) | **etkilenmez** | profiles |
| 18 | `app/admin/page.tsx:58` | select | id (count: exact, head) | **etkilenmez** | profiles |
| 19 | `app/admin/page.tsx:69` | select | id (count: exact, head) | **etkilenmez** | profiles |
| 20 | `app/admin/page.tsx:72` | select | id (count: exact, head) | **etkilenmez** | profiles |
| 21 | `app/admin/page.tsx:88` | select | id, full_name, email, suspended_at, suspension_reason | **etkilenmez** | profiles |
| 22 | `app/admin/page.tsx:96` | select | id, full_name, company_name, email, role, created_at | **join-gerekir** | karma |
| 23 | `app/admin/profiller/page.tsx:71` | select | id (count: exact, head) | **join-gerekir** | karma |
| 24 | `app/admin/profiller/page.tsx:72` | select | id (count: exact, head) | **join-gerekir** | karma |
| 25 | `app/admin/profiller/page.tsx:73` | select | id (count: exact, head) | **join-gerekir** | karma |
| 26 | `app/admin/profiller/page.tsx:74` | select | id (count: exact, head) | **etkilenmez** | profiles |
| 27 | `app/admin/profiller/page.tsx:86` | select | id, full_name, company_name, email, role, avatar_url, approval_status, approval_note, is_published,  | **join-gerekir** | karma |
| 28 | `app/admin/rapor/route.ts:71` | select | is_admin | **etkilenmez** | profiles |
| 29 | `app/admin/rapor/route.ts:80` | select | id, full_name, company_name, email, phone, role, created_at, last_seen_at, approval_status, is_publi | **join-gerekir** | karma |
| 30 | `app/admin/sikayetler/actions.ts:15` | select | is_admin | **etkilenmez** | profiles |
| 31 | `app/admin/sikayetler/page.tsx:93` | select | id, full_name, company_name, role | **join-gerekir** | karma |
| 32 | `app/admin/sikayetler/page.tsx:99` | select | id, full_name, company_name, role, email | **join-gerekir** | karma |
| 33 | `app/ajans/agency-actions.ts:51` | select | role, email | **etkilenmez** | profiles |
| 34 | `app/ajans/agency-actions.ts:185` | select | email, role | **etkilenmez** | profiles |
| 35 | `app/askiya-alindi/page.tsx:31` `ELLE` | select | full_name, suspended_at, suspension_reason | **etkilenmez** | profiles |
| 36 | `app/auth/callback/route.ts:47` | select | role, email, full_name, welcome_email_sent_at | **etkilenmez** | profiles |
| 37 | `app/auth/callback/route.ts:56` | update | yazma: welcome_email_sent_at | **etkilenmez** | profiles |
| 38 | `app/auth/confirm/route.ts:77` | select | role, email, full_name, welcome_email_sent_at | **etkilenmez** | profiles |
| 39 | `app/auth/confirm/route.ts:86` | update | yazma: welcome_email_sent_at | **etkilenmez** | profiles |
| 40 | `app/basvurularim/page.tsx:27` | select | role, suspended_at | **etkilenmez** | profiles |
| 41 | `app/bildirimler/page.tsx:71` | select | suspended_at | **etkilenmez** | profiles |
| 42 | `app/components/sections/categories.tsx:49` | select | primary_category_id (filtreler: is_published = true, role in ['professional','agency']) | **join-gerekir** | karma |
| 43 | `app/components/sections/featured-profiles.tsx:46` | select | id, full_name, avatar_url, company_name, role, created_at, premium_tier, premium_until, approval_sta | **join-gerekir** | karma |
| 44 | `app/components/sections/hero.tsx:26` | select | id — yalniz sayim ({ count: 'exact', head: true }), satir donmuyor; filtreler: is_published = true,  | **join-gerekir** | karma |
| 45 | `app/components/sections/marquee-profiles.ts:43` | select | id, full_name, avatar_url, company_name, role, premium_tier, premium_until + service_categories(name | **join-gerekir** | karma |
| 46 | `app/components/sections/top-nav.tsx:26` | select | role, full_name, avatar_url, is_admin | **etkilenmez** | profiles |
| 47 | `app/davetlerim/page.tsx:28` | select | email, role, suspended_at | **etkilenmez** | profiles |
| 48 | `app/etkinlik-sihirbazi/page.tsx:41` | select | primary_category_id, city_id, role, category_attributes (ayrica applyDiscoverBase filtreleri: is_pub | **join-gerekir** | karma |
| 49 | `app/favoriler/actions.ts:32` | select | role | **etkilenmez** | profiles |
| 50 | `app/favoriler/actions.ts:50` | select | role | **etkilenmez** | profiles |
| 51 | `app/favoriler/page.tsx:89` | select | role, suspended_at | **etkilenmez** | profiles |
| 52 | `app/favoriler/page.tsx:196` | select | id, city_id, primary_category_id, approval_status, premium_tier, premium_until, created_at, attribut | **join-gerekir** | karma |
| 53 | `app/giris/giris-form.tsx:158` | select | suspended_at | **etkilenmez** | profiles |
| 54 | `app/ilanlar/[id]/duzenle/page.tsx:42` | select | is_admin | **etkilenmez** | profiles |
| 55 | `app/ilanlar/[id]/page.tsx:77` | select | role, suspended_at, is_admin | **etkilenmez** | profiles |
| 56 | `app/ilanlar/invitations-actions.ts:64` | select | id, role, is_published | **join-gerekir** | karma |
| 57 | `app/ilanlar/listings-actions.ts:105` | select | role | **etkilenmez** | profiles |
| 58 | `app/ilanlar/listings-actions.ts:188` | select | is_admin | **etkilenmez** | profiles |
| 59 | `app/ilanlar/listings-actions.ts:416` | select | is_admin | **etkilenmez** | profiles |
| 60 | `app/ilanlar/listings-actions.ts:551` | select | role, is_published | **join-gerekir** | karma |
| 61 | `app/ilanlar/listings-actions.ts:599` | select | default_allowed_applicant_roles | **incelenmeli** | providers |
| 62 | `app/ilanlar/listings-actions.ts:666` | select | full_name, company_name, role | **join-gerekir** | karma |
| 63 | `app/ilanlar/listings-actions.ts:867` | select | full_name, company_name, role | **join-gerekir** | karma |
| 64 | `app/ilanlar/listings-actions.ts:1222` | select | is_admin | **etkilenmez** | profiles |
| 65 | `app/ilanlar/listings-actions.ts:1278` | select | is_admin | **etkilenmez** | profiles |
| 66 | `app/ilanlar/listings-actions.ts:1458` | select | is_admin | **etkilenmez** | profiles |
| 67 | `app/ilanlar/page.tsx:16` | select | role | **etkilenmez** | profiles |
| 68 | `app/ilanlar/yeni/page.tsx:22` | select | role, suspended_at | **etkilenmez** | profiles |
| 69 | `app/ilanlarim/page.tsx:43` | select | role, suspended_at | **etkilenmez** | profiles |
| 70 | `app/ilanlarim/page.tsx:109` | select | id, full_name, company_name | **join-gerekir** | karma |
| 71 | `app/kategori/[slug]/page.tsx:126` | select | id, full_name, avatar_url, bio, city_id, primary_category_id, company_name, role, attributes, catego | **join-gerekir** | karma |
| 72 | `app/kategori/[slug]/page.tsx:249` | select | role | **etkilenmez** | profiles |
| 73 | `app/kategoriler/page.tsx:82` | select | primary_category_id; filtreler: is_published=true, role in (professional,agency) | **join-gerekir** | karma |
| 74 | `app/kazanclarim/page.tsx:42` | select | role, suspended_at | **etkilenmez** | profiles |
| 75 | `app/kazanclarim/page.tsx:73` | select | id, full_name, company_name, role | **join-gerekir** | karma |
| 76 | `app/kesfet/page.tsx:146` | select | id, full_name, avatar_url, bio, city_id, primary_category_id, company_name, role, attributes, catego | **join-gerekir** | karma |
| 77 | `app/kesfet/page.tsx:500` | select | role | **etkilenmez** | profiles |
| 78 | `app/kurumsal/business-actions.ts:51` | select | role, email | **etkilenmez** | profiles |
| 79 | `app/kurumsal/business-actions.ts:185` | select | email | **etkilenmez** | profiles |
| 80 | `app/lib/admin.ts:15` | select | id, full_name, email, is_admin | **etkilenmez** | profiles |
| 81 | `app/lib/ai-actions.ts:450` | select | id, full_name, company_name, role, bio, premium_tier; filtreler: is_published = true, role in ['prof | **join-gerekir** | karma |
| 82 | `app/lib/check-suspension.ts:18` | select | suspended_at | **etkilenmez** | profiles |
| 83 | `app/lib/check-suspension.ts:44` | select | suspended_at | **etkilenmez** | profiles |
| 84 | `app/lib/email/send-email.ts:41` | select | last_seen_at | **etkilenmez** | profiles |
| 85 | `app/lib/email/send-email.ts:122` | select | email | **etkilenmez** | profiles |
| 86 | `app/lib/supabase-middleware.ts:51` | update | yok (yalniz yazma: last_seen_at); .eq('id', user.id) ile hedefleniyor | **etkilenmez** | profiles |
| 87 | `app/mesajlar/[id]/page.tsx:56` | select | suspended_at | **etkilenmez** | profiles |
| 88 | `app/mesajlar/[id]/page.tsx:178` | select | id, full_name, company_name, role | **join-gerekir** | karma |
| 89 | `app/mesajlar/actions.ts:189` | select | full_name, company_name, role | **join-gerekir** | karma |
| 90 | `app/mesajlar/actions.ts:194` | select | full_name, company_name, role | **join-gerekir** | karma |
| 91 | `app/mesajlar/actions.ts:256` | select | full_name, company_name, role | **join-gerekir** | karma |
| 92 | `app/mesajlar/actions.ts:261` | select | full_name, company_name, role | **join-gerekir** | karma |
| 93 | `app/mesajlar/actions.ts:376` | select | id, role, is_published | **join-gerekir** | karma |
| 94 | `app/mesajlar/page.tsx:47` | select | suspended_at | **etkilenmez** | profiles |
| 95 | `app/mesajlar/page.tsx:135` | select | id, full_name, company_name | **join-gerekir** | karma |
| 96 | `app/mesajlar/quote-actions.ts:356` | select | full_name, company_name, role | **join-gerekir** | karma |
| 97 | `app/mesajlar/quote-actions.ts:361` | select | full_name, company_name, role | **join-gerekir** | karma |
| 98 | `app/mesajlar/quote-actions.ts:425` | select | full_name, company_name, role | **join-gerekir** | karma |
| 99 | `app/mesajlar/quote-actions.ts:430` | select | full_name, company_name, role | **join-gerekir** | karma |
| 100 | `app/odemelerim/page.tsx:66` | select | suspended_at | **etkilenmez** | profiles |
| 101 | `app/odemelerim/page.tsx:91` | select | id, full_name, company_name, role | **join-gerekir** | karma |
| 102 | `app/p/[id]/page.tsx:66` | select | full_name, company_name, role, is_published | **join-gerekir** | karma |
| 103 | `app/p/[id]/page.tsx:100` | select | id, full_name, avatar_url, bio, city_id, primary_category_id, company_name, role, is_published, last | **join-gerekir** | karma |
| 104 | `app/p/[id]/page.tsx:125` | select | role, is_admin | **etkilenmez** | profiles |
| 105 | `app/p/[id]/page.tsx:390` | select | id, full_name, avatar_url | **etkilenmez** | profiles |
| 106 | `app/p/[id]/page.tsx:608` | select | id, full_name, avatar_url, bio, company_name, role, created_at, approval_status, premium_tier, premi | **join-gerekir** | karma |
| 107 | `app/p/[id]/yorumlar/page.tsx:24` | select | full_name, company_name, role, is_published | **join-gerekir** | karma |
| 108 | `app/p/[id]/yorumlar/page.tsx:52` | select | id, full_name, avatar_url, company_name, role, is_published | **join-gerekir** | karma |
| 109 | `app/p/[id]/yorumlar/page.tsx:124` | select | id, full_name, avatar_url | **etkilenmez** | profiles |
| 110 | `app/premium/actions.ts:30` | select | role, suspended_at | **etkilenmez** | profiles |
| 111 | `app/premium/actions.ts:61` | update | yazma: premium_tier, premium_until | **incelenmeli** | organizations |
| 112 | `app/premium/actions.ts:91` | update | yazma: premium_tier, premium_until | **incelenmeli** | organizations |
| 113 | `app/premium/page.tsx:22` | select | role, premium_tier, premium_until, suspended_at | **join-gerekir** | karma |
| 114 | `app/profil/deneyim/page.tsx:25` ⭐ | select | TUMU (select('*') + service_categories!profiles_primary_category_id_fkey(slug)) | **join-gerekir** | karma |
| 115 | `app/profil/duzenle/actions.ts:26` | select | approval_status | **alan-tasinir** | providers |
| 116 | `app/profil/duzenle/actions.ts:115` | update | yok (update) | **join-gerekir** | karma |
| 117 | `app/profil/duzenle/actions.ts:147` ⭐ | select | TUMU (select('*')) | **join-gerekir** | karma |
| 118 | `app/profil/duzenle/actions.ts:192` | update | yok (update) | **alan-tasinir** | providers |
| 119 | `app/profil/duzenle/avatar-upload.tsx:74` | update | yok (update) | **etkilenmez** | profiles |
| 120 | `app/profil/duzenle/avatar-upload.tsx:112` | update | yok (update) | **etkilenmez** | profiles |
| 121 | `app/profil/duzenle/page.tsx:24` ⭐ | select | TUMU (select('*')) | **join-gerekir** | karma |
| 122 | `app/profil/ekibim/page.tsx:28` | select | role | **etkilenmez** | profiles |
| 123 | `app/profil/hizmetlerim/page.tsx:29` ⭐ | select | TUMU (select('*')) | **join-gerekir** | karma |
| 124 | `app/profil/kategori-bilgileri/actions.ts:83` | select | role, category_attributes, service_categories!profiles_primary_category_id_fkey(slug) | **join-gerekir** | karma |
| 125 | `app/profil/kategori-bilgileri/actions.ts:355` | update | yok (update) | **alan-tasinir** | providers |
| 126 | `app/profil/kategori-bilgileri/page.tsx:25` ⭐ | select | TUMU (select('*') + service_categories!profiles_primary_category_id_fkey(slug, name_tr)) | **join-gerekir** | karma |
| 127 | `app/profil/kurumsal-ekip/page.tsx:28` | select | role | **etkilenmez** | profiles |
| 128 | `app/profil/page.tsx:39` ⭐ | select | TUMU (select('*') + turkish_cities(name) + service_categories!profiles_primary_category_id_fkey(name | **join-gerekir** | karma |
| 129 | `app/profil/paketler/page.tsx:25` ⭐ | select | TUMU (select('*')) | **etkilenmez** | profiles |
| 130 | `app/profil/portfoy/page.tsx:28` ⭐ | select | TUMU (select('*')) | **etkilenmez** | profiles |
| 131 | `app/rezervasyon/[id]/actions.ts:259` | select | full_name, company_name, role | **join-gerekir** | karma |
| 132 | `app/rezervasyon/[id]/actions.ts:264` | select | full_name, company_name, role | **join-gerekir** | karma |
| 133 | `app/rezervasyon/[id]/actions.ts:332` | select | full_name, company_name, role | **join-gerekir** | karma |
| 134 | `app/rezervasyon/[id]/actions.ts:337` | select | full_name, company_name, role | **join-gerekir** | karma |
| 135 | `app/rezervasyon/[id]/page.tsx:139` | select | suspended_at | **etkilenmez** | profiles |
| 136 | `app/rezervasyonlarim/page.tsx:136` | select | suspended_at | **etkilenmez** | profiles |
| 137 | `app/sitemap.ts:55` | select | id, updated_at (filtreler: is_published = true, role in ['professional','agency']) | **join-gerekir** | karma |
| 138 | `app/takvimim/page.tsx:52` | select | role | **etkilenmez** | profiles |
| 139 | `app/teklif-talepleri/page.tsx:21` | select | role, suspended_at | **etkilenmez** | profiles |
| 140 | `app/teklif-taleplerim/[id]/page.tsx:78` | select | full_name, company_name | **join-gerekir** | karma |
| 141 | `app/teklif-taleplerim/page.tsx:28` | select | suspended_at | **etkilenmez** | profiles |
| 142 | `app/teklif-taleplerim/page.tsx:57` | select | id, full_name, company_name | **join-gerekir** | karma |
| 143 | `app/teklif-topla/actions.ts:65` | select | role | **etkilenmez** | profiles |
| 144 | `app/teklif-topla/actions.ts:90` | select | id, premium_tier, premium_until, created_at (filtreler: role, approval_status, is_published, primary | **incelenmeli** | karma |
| 145 | `app/teklif-topla/page.tsx:50` | select | role, suspended_at | **etkilenmez** | profiles |
| 146 | `supabase/functions/send-message-notification/index.ts:169` `ELLE` | select | id, full_name, company_name, role | **join-gerekir** | karma |

⭐ = `select('*')`

---

## 4. TIP TANIMLARI

### 4a. Merkezi tip: `app/lib/types.ts:5` `Profile` (23 alan)

| Durum | Alanlar |
|---|---|
| Tipte **VAR**, tasinacak | `bio, slug, city_id, primary_category_id, is_published, approval_status, approval_note, approved_at, views_count, attributes` (providers) · `company_name, premium_tier, premium_until` (organizations) |
| Tipte **VAR**, kalacak | `id, email, full_name, phone, avatar_url, kvkk_approved_at, is_admin, role, created_at, updated_at` |
| 🔴 Tipte **YOK** ama kodda kullaniliyor | `category_attributes`, `default_allowed_applicant_roles`, `suspended_at`, `suspension_reason`, `suspended_by`, `last_seen_at`, `welcome_email_sent_at` |

**Neden kritik:** ilk iki tasinan alan (`category_attributes`, `default_allowed_applicant_roles`)
tipte hic tanimli degil, satir ici cast ile okunuyor (`app/profil/page.tsx:57`,
`app/profil/duzenle/duzenle-form.tsx:88-89`). Bu alanlar `providers`'a tasindiginda
TypeScript **hicbir uyari vermez**.

`ProfileWithCity` (`app/lib/types.ts:79`) `Profile`'i genisletir; ayni riski miras alir.

### 4b. Yerel profil sekilleri — her biri BAGIMSIZ guncellenecek

| Tip | Dosya:satir |
|---|---|
| `Profile` | `app/lib/types.ts:5` |
| `ProfileWithCity` | `app/lib/types.ts:79` |
| `FeaturedProfile` | `app/components/sections/featured-profiles.tsx:14` |
| `MarqueeProfile` | `app/components/sections/marquee-profiles.ts:12` |
| `PublishedProfile` | `app/kesfet/page.tsx:46` |
| `PublishedProfile` (ayni ad, **ayri tanim**) | `app/kategori/[slug]/page.tsx:30` |
| `PublicProfile` | `app/p/[id]/page.tsx:37` |
| `PublicProfile` (ayni ad, **ayri tanim**) | `app/p/[id]/yorumlar/page.tsx:7` |

**Sekiz ayri sekil, iki ad ikiser kez.** Merkezi `Profile` guncellendiginde bu yedi tanim
kendiliginden duzelmez; her biri elle taranmali.

---

## 5. RISK NOTLARI

### 5a. 🔴 `select('*')` + `as Profile` = sessiz kirilma

8 yerde `select('*')` var ve **hepsi** sonucu `as Profile` ile zorla dokuyor.
`Profile` tipi tasinan alanlari hala icerdigi icin:

1. Alan `providers`'a tasinir, `profiles` sorgusundan gelmez.
2. `as Profile` cast'i derleyiciyi susturur — **derleme gecer**.
3. Calisma zamaninda alan `undefined` olur.
4. `undefined` cogu yerde "bos deger" gibi davranir: profil yayindan duser, kategori
   bilgisi kaybolur, onay durumu bilinmez gorunur — **hicbiri hata firlatmaz**.

En riskli tekil nokta: `app/profil/page.tsx:39` — **11 tasinan alan** okuyor
(`bio, city_id, primary_category_id, is_published, approval_status, approval_note,
views_count, category_attributes, company_name, premium_tier, premium_until`) ve ayrica
`turkish_cities` + `service_categories` embed'leri **profiles FK'si uzerinden** cekiyor;
o FK'ler `providers`'a tasindiginda embed'ler de kirilir.

### 5b. Ayni alani farkli isimle/yoldan okuyan yerler

| Kalip | Nerede | Not |
|---|---|---|
| `company_name` dogrudan | 38 gecis / 24 dosya | En cok okunan tasinan alan |
| `company_name` iliskisel embed uzerinden | `profiles!<fk>(... company_name ...)` | Ayri yuzey, ayri duzeltme gerekir |
| Goruntulenen ad hesabi | `role === business/agency ? company_name : full_name` | ~30 yerde tekrarlanan ifade; ikisi **farkli tabloya** ayrilacak |
| `category_attributes` | 7 gecis + `select('*')` uzerinden | Tipte tanimsiz, cast ile okunuyor |

**Goruntulenen ad** kalibi ozellikle tehlikeli: goc sonrasi `full_name` `profiles`'ta,
`company_name` `organizations`'ta olacak. Tek satirlik bu ifade her yerde iki kaynaga bakmak zorunda kalacak.

### 5c. Gocte iki tabloya birden bakacak sorgular

**62 sorgu** (%42) `join-gerekir` isaretli.
Ozellikle dikkat gerektiren desen: **tek `update` cagrisinda hem kalan hem tasinan alan yazmak.**

| Dosya:satir | Yazilan alanlar | Sorun |
|---|---|---|
| `app/admin/actions.ts:101` | `suspended_at, suspension_reason, suspended_by` + `is_published` | Askiya alma (profiles) ile yayindan cikarma (providers) tek update'te. Gocte iki yazma olur; ikisi arasinda **atomiklik kaybolur**. |
| `app/admin/actions.ts:307` | `approval_status, approval_note, is_published` + returning `email, full_name` | Yazma providers'a, ama donen satirdan e-posta gonderiliyor (`:335-341`). Iki tablo gerekir. |
| `app/admin/actions.ts:409` | ayni desen | Revizyon e-postasi icin ayni sorun. |

`app/admin/actions.ts:101` en kritigi: bugun tek islemde tutulan "askidaki profil yayinda kalmamali"
kurali, goc sonrasi iki tablo arasinda **elle tutarli tutulmak** zorunda kalacak.

### 5d. `premium_tier` icin hedef tablo belirsiz

`app/admin/actions.ts:802` (`grantPremium`) ve `:830` (`revokePremium`) `premium_tier`/`premium_until`
yaziyor ama **kullanicinin rolune hic bakmiyor**. Cagiran arayuz
(`app/admin/kullanicilar/kullanici-aksiyonlar.tsx:128`) `canHavePremium = role === 'professional' || role === 'agency'`
diyor — yani **`professional` rollu bir kullaniciya da premium verilebiliyor**, ve o kullanicinin
`organizations` kaydi olmayacak.

Goc plani "`premium_tier` yalniz agency/business profillerinde organizations'a tasinir; bireysel
profesyonelinki profilde kalir" diyor (`docs/architecture/04-goc-plani.md:182`). Kod bu ayrimi
**yapmiyor**. Bu iki fonksiyon `incelenmeli` isaretli; goc oncesi karar gerekir.

### 5e. Mekanik taramanin disinda kalan yuzeyler

| Yuzey | Olcum | Not |
|---|---|---|
| Iliskisel join (`profiles!<fk>(...)`) | **27 satir / 18 dosya** | Ayri duzeltme yuzeyi |
| SQL tarafi `profiles` referansi | 100 satir / 18 dosya | RLS, trigger, fonksiyon govdeleri |
| Tip tanimlari | 8 ayri sekil | Bolum 4b |

> **Duzeltme:** ilk olcumumde iliskisel referans sayisini **46** olarak bildirmistim. Yanlisti:
> o sayim `service_categories!profiles_primary_category_id_fkey` gibi, FK **adinda** "profiles"
> gecen ama `profiles`'a join **olmayan** 19 satiri da iceriyordu. Dogru sayi **27**.
> (`profiles!` ile baslayan: 27 · `<tablo>!profiles_...` bicimli: 19 · toplam 46.)

---

## 6. YONTEM VE SINIRLAR

- Sorgu envanteri dengeli-parantez ayristiricisiyla uretildi; satir numaralari kaynaktan okundu.
- Baglam ve goc etkisi 8 paralel ajan tarafindan dosyalar okunarak atandi (144/146).
- Gruplama hatam nedeniyle 2 sorgu ajanlara gitmedi (`app/askiya-alindi/`, `supabase/functions/`);
  ikisi de elle siniflandirildi ve tabloda `ELLE` isaretli.
- Iki adversarial denetim ajani `select('*')` risk analizi ve kapsama denetimi yapti.
  Kapsama denetimi mekanik sayimin (146/75) dogrulugunu bagimsiz olarak teyit etti ve
  iliskisel referans sayimimdaki hatayi buldu.
- **Sinir:** `select('*')` sorgularinda "gercekten kullanilan alanlar" listesi, degiskenin
  ayni dosyada ve dogrudan prop olarak gecirildigi yerlerde izlenerek cikarildi. Cok katmanli
  prop zincirleri tam izlenmemis olabilir; bu alanlar eksik degil **fazla** tarafta hata verir
  (yani listelenen alan gercekten kullaniliyor, listelenmeyen bir alan atlanmis olabilir).
