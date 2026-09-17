# 10 — FAZ 2 on kosulu: profil tiplerinin tekillestirilmesi

**Baslangic:** 17 Eylul 2026 (FAZ 1 kapanisindan sonra; FAZ 0/04 tutarlilik izlemesi surerken)
**Durum:** Claude Code uyguladi (17 Eylul; 10 dosya, +193/-147, `tsc` bos, build basarili). Kapanis kaydi bolum 7. Deploy ve sayfa turu ile kapanir.
**Kaynak:** `docs/architecture/04-goc-plani.md` FAZ 2 "ON KOSUL — tip tekillestirme" (11a-11d), `docs/envanter/02-profiles-kullanimi.md`.

---

## 1. Neden simdi

FAZ 2 `profiles`'tan `providers`'a alan tasiyacak (`approval_status`, `approved_at`, `attributes`,
`category_attributes`, `default_allowed_applicant_roles`, `primary_category_id`...). Bugun bu alanlarin bir
kismi `Profile` tipinde YOK, sayfalar kendi yerel tiplerini yaziyor ve cogu alan `string | null` gibi gevsek.
Sonuc: alan tasindiginda **TypeScript uyarmaz, calisma zamaninda `undefined` gelir**. Tekillestirme, FAZ 2'nin
"derleyici her kullanimi gostersin" garantisidir. Sema degisikligi YOK; yalniz TypeScript.

## 2. Tarama (17 Eylul, repo `92e5be6`)

### 2.1 `app/lib/types.ts` `Profile` tipi — 24 alan, veritabani 30 sutun

| Durum | Alanlar |
|---|---|
| Tipte VAR, DB'de VAR (24) | id, email, full_name, role, bio, avatar_url, phone, city_id, slug, is_published, approval_status, approval_note, approved_at, kvkk_approved_at, is_admin, primary_category_id, company_name, premium_tier, premium_until, views_count, created_at, updated_at, attributes (+ `attributes?` opsiyonel) |
| Tipte YOK, DB'de VAR (7) | `last_seen_at`, `suspended_at`, `suspension_reason`, `suspended_by`, `default_allowed_applicant_roles`, `category_attributes`, `welcome_email_sent_at` |
| Tipte yanlis nullability | `premium_tier: ... \| null` (DB NOT NULL default 'none'); `attributes?: ... \| null` (DB NOT NULL default '{}'); `email: string` (istemci artik RPC ile alir, null olabilir) |

PII adim 2 (15 Eylul) sonrasi `Profile` tipi iki farkli seyi karistiriyor: istemcinin dogrudan secebildigi
**23 acik sutun** (`app/lib/own-profile.ts` `PROFILE_OPEN_COLUMNS`) ve yalniz `get_own_private_profile()`
RPC'siyle gelen **7 kapali sutun** (`OwnPrivateProfile`). `fetchOwnProfile` ikisini tek nesnede birlestirir.
Tip bu ayrimi yansitmali.

### 2.2 Yerel profil sekilleri — 8 tanim, 7 dosya

| Dosya | Tip | Alan sayisi | Not |
|---|---|---|---|
| `app/lib/types.ts` | `Profile`, `ProfileWithCity` | 24, +1 embed | tek "resmi" tip; 9 dosya import eder (profil/*, profile-helpers, duzenle/actions) |
| `app/components/sections/featured-profiles.tsx` | `FeaturedProfile` | 14 | 9 DB alani + 5 turetilmis (city, category, categorySlug, rating, reviewCount); `role: string`, `approval_status: string \| null` |
| `app/components/sections/marquee-profiles.ts` | `MarqueeProfile` | 7 | 5 DB alani + category, categorySlug |
| `app/kesfet/page.tsx` | `PublishedProfile` | 15 | 13 DB alani + 2 embed; `category_attributes` YOK |
| `app/kategori/[slug]/page.tsx` | `PublishedProfile` | 16 | kesfet ile AYNI AD, +`category_attributes` |
| `app/p/[id]/page.tsx` | `PublicProfile` | 18 | 16 DB alani + 2 embed; `is_published`, `last_seen_at` var |
| `app/p/[id]/yorumlar/page.tsx` | `PublicProfile` | 6 | p/[id] ile AYNI AD, alt kume |
| `app/admin/rapor/route.ts` | `ProfileRow` | 14 | 12 DB alani (email/phone `admin_profile_contacts` RPC'sinden birlesir) + 2 embed |

Ortak sorunlar: `role: string` (UserRole degil), `approval_status: string | null`, `premium_tier: string | null`,
`created_at: string | null` — hepsi DB'de daha dar. Ayni ad iki farkli sekil (2x).

### 2.3 "Sifir okuma" bulgulari (Rapor 02) — DOGRULANDI, hicbiri kaldirilamaz

| Alan | Uygulama okumasi | Veritabani kullanimi | Sonuc |
|---|---|---|---|
| `slug` | 0 (yalniz PROFILE_OPEN_COLUMNS listesinde; profil URL'leri `/p/[id]` id ile) | FAZ 0 `ensure_organization_for_profile` kurulus slug'ini buradan turetir; UNIQUE kisit | KALIR |
| `approved_at` | 0 (tip + sutun listesi) | `handle_new_user` yazar (client icin now()), `protect_sensitive_profile_fields` korur, admin onayi yazar | KALIR — FAZ 2'de `providers`'a tasinacak alan |
| `views_count` | 1 (`app/profil/page.tsx:231` istatistik) | `increment_profile_views` RPC (`app/p/[id]/profile-views-actions.ts`), `admin_stats_top_viewed` | KALIR |

### 2.4 `select('*')` — 11c ZATEN KAPANDI

PII adim 2'de (15 Eylul, Claude Code) `app/profil/` altindaki 8 `select('*')` `fetchOwnProfile` /
`PROFILE_OPEN_COLUMNS` ile degistirildi. Bugun `profiles` baglaminda `select('*')` yok (grep: 0). Gorev bunu
yeniden dogrular ve raporlar.

## 3. Hedef tip yapisi (`app/lib/types.ts`)

Veritabanindan turetilir; nullability DB ile birebir (`information_schema.columns`, 15 Eylul dokumu):

```
sutun                            tip                       null?   varsayilan
id                               uuid                      NO
email                            text                      NO      (kapali)
full_name                        text                      YES
role                             text (check: 4 deger)     NO
avatar_url                       text                      YES
created_at, updated_at           timestamptz               NO      now()
bio                              text                      YES
phone                            text                      YES     (kapali)
city_id                          integer                   YES
slug                             text                      YES
is_published                     boolean                   NO      false
primary_category_id              integer                   YES
company_name                     text                      YES
last_seen_at                     timestamptz               YES
kvkk_approved_at                 timestamptz               YES     (kapali)
is_admin                         boolean                   NO      false
approval_status                  profile_approval_status   NO      'pending'
approval_note                    text                      YES     (kapali)
approved_at                      timestamptz               YES
attributes                       jsonb                     NO      '{}'
suspended_at                     timestamptz               YES
suspension_reason                text                      YES     (kapali)
suspended_by                     uuid                      YES     (kapali)
premium_tier                     premium_tier              NO      'none'
premium_until                    timestamptz               YES
views_count                      integer                   NO      0
default_allowed_applicant_roles  text[] (<@ {professional,agency}, >=1)  NO   {professional,agency}
category_attributes              jsonb                     NO      '{}'
welcome_email_sent_at            timestamptz               YES     (kapali)
```

```ts
export type UserRole = 'professional' | 'client' | 'business' | 'agency';           // var
export type ProfileApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'revision';
export type PremiumTier = 'none' | 'premium' | 'plus' | 'agency';
export type ApplicantRole = 'professional' | 'agency';

/** profiles: anon ve authenticated'a ACIK 23 sutun. PROFILE_OPEN_COLUMNS ile birebir. */
export type ProfileOpen = { id; full_name; role: UserRole; avatar_url; created_at; updated_at; bio; city_id;
  slug; is_published; primary_category_id; company_name; last_seen_at; is_admin;
  approval_status: ProfileApprovalStatus; approved_at; attributes: Record<string, string | string[]>;
  suspended_at; premium_tier: PremiumTier; premium_until; views_count: number;
  default_allowed_applicant_roles: ApplicantRole[]; category_attributes: Record<string, unknown> };

/** profiles: KAPALI 7 sutun; yalniz get_own_private_profile() / admin_profile_contacts() ile. */
export type ProfilePrivate = { email: string | null; phone; kvkk_approved_at; approval_note;
  suspension_reason; suspended_by; welcome_email_sent_at };   // hepsi string | null

/** Oturum sahibinin tam profili = fetchOwnProfile ciktisi. */
export type Profile = ProfileOpen & ProfilePrivate;

// Ortak embed'ler
export type CityEmbed = { turkish_cities: { name: string } | null };
export type CategoryEmbed = { service_categories: { name_tr: string; emoji: string | null; slug: string } | null };

// Herkese acik sekiller — hepsi ProfileOpen'dan Pick ile
export type ProfileCard    = Pick<ProfileOpen, 'id' | 'full_name' | 'avatar_url' | 'company_name' | 'role'>;
export type ProfileListing = Pick<ProfileOpen, 'id' | 'full_name' | 'avatar_url' | 'bio' | 'city_id' | 'primary_category_id'
  | 'company_name' | 'role' | 'created_at' | 'approval_status' | 'premium_tier' | 'premium_until'
  | 'attributes' | 'category_attributes'> & CityEmbed & CategoryEmbed;            // kesfet + kategori/[slug]
export type ProfilePublic  = ProfileListing & Pick<ProfileOpen, 'is_published' | 'last_seen_at'>;   // p/[id]
export type ProfileWithCity = Profile & CityEmbed;                                                   // var, korunur
```

Dosya ici sekiller bunlardan turetilir: `FeaturedProfile = Pick<ProfileOpen, ...9 alan> & { city; category;
categorySlug; rating; reviewCount }`, `MarqueeProfile = ProfileCard & { category; categorySlug }`,
yorumlar `PublicProfile = ProfileCard & Pick<ProfileOpen, 'is_published'>`, admin `ProfileRow =
Pick<ProfileOpen, ...> & Pick<ProfilePrivate, 'email' | 'phone'> & CityEmbed & { service_categories: { name_tr } | null }`.

**Derleme zamani sutun kilidi** (`app/lib/own-profile.ts`): liste `as const satisfies readonly (keyof ProfileOpen)[]`
olur ve `Exclude<keyof ProfileOpen, (typeof LIST)[number]>` `never` degilse derleme kirilir. Boylece
`ProfileOpen`'a alan eklenip GRANT listesine eklenmemesi (ya da tersi) `tsc`'de yakalanir. Bu, 07'deki
"kalici kural"in derleyici tarafidir; migration GRANT'i yine elle yazilir.

## 4. Sinirlar

- Davranis degismez: hicbir sorgu, select listesi, JSX ya da server action mantigi degismez. Yalniz tip
  tanimlari, import'lar ve gerekirse `as` cast'leri.
- Veritabani, migration, RPC yok.
- `kesfet` ve `kategori/[slug]` `PublishedProfile` farki (`category_attributes`): iki sayfa da `ProfileListing`
  kullanir; kesfet sorgusu `category_attributes` secmiyorsa sorguya EKLENMEZ — o alan tipte var ama sorguda yoksa
  `Omit<ProfileListing, 'category_attributes'>` ile daraltilir. Sorguyu genisletmek davranis degisikligidir.
- `Profile` tipinin adi ve 9 import yeri korunur (`Profile = ProfileOpen & ProfilePrivate`); mevcut
  `profile.email`, `profile.phone` kullanimlari derlenmeye devam eder (`string | null`).
- `attributes`/`category_attributes` icin `?? {}` gibi savunmalar kalir; tip daraldi diye kaldirilmaz.

## 5. Dogrulama

- `tsc --noEmit` bos.
- `grep -rn "type PublishedProfile\|type PublicProfile\|type FeaturedProfile\|type MarqueeProfile\|type ProfileRow" app`
  -> yerel `= {` tanimi kalmaz; hepsi `types.ts` tiplerinden turetilir.
- `grep -rn "role: string" app --include=*.ts --include=*.tsx | grep -i profile` -> 0.
- `select('*')` profiles baglaminda 0 (yeniden dogrulama).
- Sutun kilidi calisiyor mu: `ProfileOpen`'a gecici sahte alan eklenince `tsc` hata verir (Claude Code
  bunu dener ve geri alir, raporlar).
- Onizleme ile: ana sayfa (featured/marquee), kesfet, kategori/[slug], /p/[id], /p/[id]/yorumlar, /profil,
  /profil/duzenle, admin rapor indirme.

## 6. Kapsam disi (FAZ 2'nin kendisi)

`providers` tablolari, alan tasima, `protect_sensitive_provider_fields`, `services.provider_id` — hepsi
FAZ 2 migration'lari. Bu on kosul yalniz TypeScript'i alan tasimaya hazir hale getirir.

## 7. Kapanis kaydi (17 Eylul 2026)

Claude Code raporu (10 dosya, +193 / -147): `types.ts` hedef yapi; `own-profile.ts` sutun kilidi
(`PROFILE_OPEN_COLUMN_LIST as const satisfies ...` + `EksikSutun extends never`), `PROFILE_OPEN_COLUMNS`
listeden uretilir, 23 ad ve sira degismedi; 7 yerel sekil turetildi; hicbir `.select(...)`, JSX ve action
mantigi degismedi. Cowork tarafinda dogrulandi: `ProfileOpen` 23 alan, nullability bolum 3 tablosuyla birebir;
liste ayni 23 sutun ayni sirada.

Spec'ten sapmalar (kabul edildi):
1. `PremiumTier` yeniden tanimlanmadi; `app/lib/badges.ts` zaten tek kaynak (`'none'|'premium'|'plus'|'agency'`),
   `types.ts` import edip yeniden disa aktarir.
2. kesfet sorgusu `category_attributes`'i zaten seciyordu; iki liste sayfasi da duz `ProfileListing`.
3. `profil/duzenle/duzenle-form.tsx`: `value={profile.email ?? ''}` — `Profile.email` artik `string | null`,
   React `value` null kabul etmez; alan `disabled`, gorunen davranis ayni.

Kanitlar: sutun kilidi — `ProfileOpen`'a gecici alan eklenince `own-profile.ts(51,7): error TS2322: Type 'true'
is not assignable to type 'never'`, geri alindi; `npx tsc --noEmit` bos; `npm run build` basarili; yerel
profil tiplerinde `= {` govde kalmadi (7 satir, hepsi turetim); `select('*')` 23 kullanim, hepsi baska
tablolarda, profiles 0; `role: string` 5 satir kaldi — hepsi listedeki 7 dosyanin disinda (kesfet/profile-card
prop'u, p/[id]/professional-profile prop'u, `getRoleLabel` bilincli genis, profil/page.tsx `member_role` ve
favoriler embed'i) — FAZ 2'yi zayiflatmaz: alan tasininca `ProfileOpen` onu kaybeder, cagiran derlenmez.
ESLint: degisen dosyalarda 5 hata + 1 uyari, hepsi 14 Mayis - 3 Haziran commit'lerinden (Date.now purity,
1 unused, 2 prefer-const); yeni satirlarda bulgu yok.

Acik: bu 4 sekil (profile-card, professional-profile prop'lari, favoriler embed'i) istenirse ayri kucuk bir
gorevle daraltilir; FAZ 2 migration'lari icin on kosul degildir.
