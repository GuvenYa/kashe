# 14 — FAZ 2c: Pazaryeri okuma yolunun yeni yapiya gecisi (`v_providers_public`)

**Kaynak plan:** `docs/architecture/04-goc-plani.md` FAZ 2 madde 18 ("okuma yollari tek tek providers'a gecirilir"),
`11-faz2-saglayici-defteri.md` bolum 2 (cift alan doneminin bitis kriteri), `13-faz2b` bolum 7.
**Durum:** P0 URETIMDE, P1 DEPLOY EDILDI, P2 KOD HAZIR (21 Eylul 2026; commit bekliyor). P3 gorev metni `14-claude-code-gorevi-p3.md`. Kapanis bolum 8.

## 1. Tarama (21 Eylul, repo `682b860`)

| Olcum | Sonuc |
|---|---|
| `from('profiles')` | **133 cagri / 63 dosya** (tek tirnak). **Duzeltme (P2 sonrasi):** cift tirnakli `from("profiles")` 5 dosya daha: `components/sections/featured-profiles.tsx`, `marquee-profiles.ts`, `categories.tsx`, `hero.tsx` (ana sayfa, PAZARYERI) + `top-nav.tsx` (kimlik). Toplam 68 dosya; pazaryeri okumasi 10 + 4 = 14 dosya. Ders: tarama iki tirnak stilini de arar |
| Bunlarin pazaryeri yuzu (is_published/approval/bio/kategori/premium okuyan) | ~25 dosya isaretli; gercek pazaryeri LISTE/DETAY okumasi **10 dosya** |
| Pazaryeri okuma yollari | `kesfet/page.tsx`, `kategori/[slug]/page.tsx`, `kategoriler/page.tsx` (sayac), `sitemap.ts`, `etkinlik-sihirbazi/page.tsx` (sayac), `lib/ai-actions.ts` (pro-bul havuzu), `teklif-topla/actions.ts` (havuz), `p/[id]/page.tsx` (detay + benzer profiller), `p/[id]/yorumlar/page.tsx`, `favoriler/page.tsx` |
| Bu 10 dosyanin okudugu sutun kumesi | `id, full_name, avatar_url, bio, city_id, primary_category_id, company_name, role, is_published, last_seen_at, attributes, category_attributes, premium_tier, premium_until, approval_status, created_at, updated_at` + embed `turkish_cities(name)`, `service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)` |
| Ortak gorunurluk filtresi | `app/lib/discover-base.ts` `applyDiscoverBase` (is_published + role in professional/agency) — tek kaynak, degismez |
| Kalan ~53 dosya | kimlik / operasyon okumalari (oturum sahibinin rolu, is_admin, admin paneli, mesajlasma, rezervasyon, auth). Hedef modelde de `profiles`'ta kalir; **2c kapsami DISI** |
| `services` okuyan | 10 dosya (hizmetlerim, /p/[id], kesfet/kategori/favoriler fiyat gosterimi, admin rapor). `services` hedef modelde KALIYOR (provider_id ile); degismez |

## 2. Kararlar (21 Eylul 2026, Guven ile)

| Konu | Karar | Neden |
|---|---|---|
| Okuma yolu | **Gorunum sozlesmesi:** `v_providers_public` (security_invoker) pazaryeri sutun kumesini AYNI ADLARLA sunar; kaynak `providers` / `professional_profiles` / `organization_profiles` / `provider_services` + `profiles` kimlik sutunlari. Uygulama `.from('profiles')` -> `.from('v_providers_public')` | 10 dosya ayni kumeyi okuyor; tek sozlesme. FAZ 10'da `profiles`'tan sutun dusurulunce yalniz gorunum yeniden baglanir, uygulama degismez. Dogrudan tablo okumasi her sayfada 3-4 sorgu ve regresyon riski demekti |
| Yazma yolu | **FAZ 10'da tek kesimle.** 2c yalniz OKUMA. Profil formu `profiles`'a yazar (aynalama providers'a tasir); `hizmetlerim` `services`'a yazar (2b aynalamasi provider_services'i turetir) | Ters aynalama (providers -> profiles) ve providers'a istemci UPDATE politikalari gerekmez; cift yazma FAZ 10'da tek seferde biter |
| Parcalama | **3 Claude Code parcasi** (bolum 4), her biri ayri commit/deploy; onunde P0 veritabani adimi | Kucuk deploy, kolay geri alma |
| `updated_at` kaynagi | `profiles.updated_at` (kesfet siralamasi ve sitemap bugunku davranisi korur) | `providers.updated_at` aynalama zamanini gosterir, kullanici eylemini degil |
| `primary_category_id` kaynagi | 2c'de `profiles.primary_category_id` (embed FK'si korunur); ek olarak `primary_role_id` (provider_services birincil satiri) | 3b/FAZ 10'da kategori embed'i `service_roles`'a doner; simdilik uygulama davranisi birebir |
| `bio` kaynagi | `COALESCE(professional_profiles.bio, organization_profiles.about)` | 2a aynalamasi; asama7 K8 esitligi korur |
| Gorunum degisikligi | Sutun eklemek `CREATE OR REPLACE` ile; sutun cikarmak/yeniden siralamak `DROP VIEW` + `CREATE` (ayri migration) | PostgreSQL kurali; uygulama tipleri ayni migration'la guncellenir |

## 3. Sozlesme: `v_providers_public` sutunlari

| Sutun | Kaynak | TS tipi (`ProviderPublic`) |
|---|---|---|
| id | providers.id (= profiles.id) | string |
| role | profiles.role | UserRole |
| provider_type | providers | 'professional' \| 'organization' |
| provider_slug | providers.slug | string |
| display_name | providers | string \| null |
| full_name, company_name, avatar_url | profiles | string \| null |
| bio | professional_profiles.bio / organization_profiles.about | string \| null |
| city_id | providers | number \| null |
| primary_category_id | profiles | number \| null |
| primary_role_id | provider_services (is_primary) | number \| null |
| attributes | profiles | Record<string, string \| string[]> |
| category_attributes | profiles | Record<string, unknown> |
| premium_tier, premium_until | profiles | PremiumTier, string \| null |
| is_published | providers | boolean |
| approval_status | providers | ProfileApprovalStatus |
| approved_at, suspended_at | providers | string \| null |
| is_visible | turetilmis (yayinda + onayli + askida degil) | boolean |
| is_verified | providers | boolean |
| verification_level | providers | 'none' \| 'email' \| 'document' \| 'full' |
| trust_score | providers | number \| null |
| headline, experience_years | professional_profiles | string \| null, number \| null |
| pricing_mode | professional_profiles | 'fixed' \| 'range' \| 'on_request' \| null |
| price_min, price_max | professional_profiles | number \| null |
| price_unit | professional_profiles | 'per_job' \| 'per_hour' \| 'per_half_day' \| 'per_day' \| null |
| last_seen_at | profiles | string \| null |
| created_at, updated_at | profiles | string |

Embed'ler (PostgREST, taban tablo FK'leri uzerinden): `turkish_cities(name)` (providers.city_id),
`service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)` (profiles.primary_category_id).
**Onizlemede dogrulanir (P1);** cozumlenmezse gorunume `primary_category_name_tr/emoji/slug` sutunlari eklenir
(ayri migration), uygulama embed yerine sutunu okur — hack yapilmaz.

Kapali sutun (email, phone, ...) gorunumde YOK; profiles kimlik alanlari icin bugunku RPC'ler gecerli.

## 4. Parcalar

**P0 — veritabani (bu dosya ile birlikte, Guven):** `20260921120000_faz2c_01_v_providers_public.sql` dal -> asama4
(T14) + asama10 -> uretim -> asama10 -> git push. Gorunum kullanilmadan once uretimde olur; kod deploy'u sonra.

**P1 — liste yollari (Claude Code, `14-claude-code-gorevi-p1.md`):** `app/lib/types.ts` `ProviderPublic` +
`ProviderListing`; `kesfet/page.tsx` (liste sorgusu), `kategori/[slug]/page.tsx`, `kategoriler/page.tsx` (sayac),
`sitemap.ts`, `etkinlik-sihirbazi/page.tsx` (sayac) -> `v_providers_public`. Oturum sahibinin rol/is_admin okumalari
`profiles`'ta kalir. Kabul: tsc bos; onizleme turu (kesfet filtreleri/siralama/arama, kategori sayfasi, kategoriler
sayaclari, sihirbaz sayaci = kesfet sonucu, sitemap.xml satir sayisi); asama7/asama9/asama10 degismedi.

**P2 — detay ve havuzlar (`14-claude-code-gorevi-p2.md`):** `p/[id]/page.tsx` (detay + benzer profiller; oturum sahibi/yorumcu profilleri profiles'ta),
`p/[id]/yorumlar/page.tsx`, `favoriler/page.tsx` (favori kartlari), `lib/ai-actions.ts` (pro-bul havuzu),
`teklif-topla/actions.ts` (havuz). Kabul: /p/[id] ziyaretci + sahip + admin gorunumu, yorumlar, favoriler, pro-bul
onerisi, teklif-topla dagitimi (kota algoritmasi ayni girdileri almali: premium_tier, premium_until, created_at).

**P3 — ana sayfa + rol kapisi + siniflandirma (`14-claude-code-gorevi-p3.md`):** `components/sections/featured-profiles.tsx`,
`marquee-profiles.ts`, `categories.tsx`, `hero.tsx` -> gorunum (cift tirnakli okumalar); `/p/[id]` rol kapisindan
`business` cikar (bolum 8 karari); `ai-actions.ts:86` sapkali harf; kalan tum `profiles` okumalari siniflandirilip
bolum 9'a yazilir (FAZ 10 kesim listesi; `pazaryeri-kaldi` 0 beklenir). `CLAUDE.md` kurali P0'da eklendi.

## 5. Dogrulama araclari

| Dosya | Icerik |
|---|---|
| `supabase/migrations/20260921120000_faz2c_01_v_providers_public.sql` | gorunum + GRANT SELECT anon/authenticated/service_role (security_invoker) |
| `docs/envanter/asama10-faz2c-gorunum-kontrol.sql` | SALT OKUNUR, dal + uretim: K1 satir sayisi, **K2 19 ortak sutun EXCEPT iki yon 0** (birebir yerine gecme kaniti), K3 is_visible, K4 primary_role_id, K5 kapali sutun yok, K6 security_invoker + grant |
| `docs/envanter/asama4-davranis-testi.sql` | T14: ortak sutunlar = profiles, saglayici sutunlari = providers, is_visible, bio guncellemesi gorunumden okunur, primary_role_id dolu/bos, anon/authenticated okur, email 42703 |

**Yerel zincir (21 Eylul):** gorunum iki kez uygulandi; asama10 6/6 ESIT (K2 0/0, 6 saglayici); asama4 T0-T14 **15/15
GECTI**. Mutasyon: gorunumun `bio`'su sabit metne baglandi -> T14 HATA + asama10 K2 6/6 FARK; anon grant kaldirildi ->
T14 HATA (permission denied) + K6 2/3 FARK. Geri alinca GECTI/ESIT.

## 6. Uretim sirasi — P0 (adim adim)

On kosul: `git status` temiz; FAZ 2b uretimde (21 Eylul). Migration yalniz `db push` ile.

1. Commit: `git add -A` / `git commit -m "FAZ 2c P0: v_providers_public gorunumu, asama10, T14, plan 14"`.
2. Uretimde on kontrol (SQL Editor, salt okunur): `select table_name from information_schema.views where table_schema='public' and table_name='v_providers_public';` -> bos.
3. Dal: `supabase link --project-ref ukqhgspaallzjscjodbb` -> `supabase db push` (1 dosya).
4. Dalda: `asama4-davranis-testi.sql` -> 15 satir, T14 GECTI; `asama10-faz2c-gorunum-kontrol.sql` -> 6 ESIT.
5. Uretim: `supabase link --project-ref qydsooqmflrrwtgawhsv` -> `supabase db push` (1 dosya).
6. Uretimde: `asama10` -> 6 ESIT (K1 36/36, K2 0/0, K4 21/21 beklenir).
7. `git push`. Ardindan P1 Claude Code gorevi (`14-claude-code-gorevi-p1.md`).

Geri alma (P0): `DROP VIEW public.v_providers_public;` (kod henuz okumuyor; zarar yok).

## 7. Kalici kurallar (2c sonrasi)

- **Pazaryeri okumasi = `v_providers_public`.** Yeni sayfa/sorgu `profiles`'tan pazaryeri alani (bio, city, onay,
  yayin, kategori, fiyat) okumaz. Kimlik (ad, avatar, rol, is_admin) ve operasyon okumalari `profiles`'ta kalir.
- **Gorunume sutun ekleme:** migration + `ProviderPublic` tipi ayni commit'te; `CREATE OR REPLACE` yalniz sona ekler.
- **FAZ 10 kesim kriteri:** bolum 1'deki 10 dosya + P3 listesi gorunume gecmis, `grep "from('profiles')"` yalniz
  kimlik/operasyon; o zaman yazma yolu yeni tablolara doner, `profiles` pazaryeri sutunlari dusurulur,
  `trg_faz2_sync_profile_to_provider` kaldirilir, gorunum yeniden baglanir.

## 8. Kapanis kaydi

**P0 — uretimde (21 Eylul 2026):** dal: 1 dosya push, asama4 T0-T14 15/15 (T14 GECTI), asama10 6/6 ESIT. Uretim: 1 dosya
push; asama10 **6/6 ESIT — K1 36/36, K2 0/0, K3 34/34 (is_visible), K4 21/21 (primary_role_id), K5 0, K6 3/3**.
`git push` -> `682b860..18b41c3 main`.

**P1 — liste yollari (21 Eylul 2026, Claude Code raporu):** 7 dosya (+128/-17): `types.ts` (`ProviderType`,
`VerificationLevel`, `PricingMode`, `ProviderPriceUnit`, `ProviderPublic` 33 sutun, `PROVIDER_LISTING_COLUMN_LIST` +
`PROVIDER_LISTING_COLUMNS`, `ProviderListing = Pick<ProviderPublic, liste> & CityEmbed & CategoryEmbed`), `kesfet`,
`kategori/[slug]`, `kategoriler` (sayac), `sitemap`, `etkinlik-sihirbazi` (sayac) -> `v_providers_public`;
`discover-base.ts` yalniz not. Oturum sahibi rol okumalari profiles'ta. tsc bos, build basarili. Uretilen select dizesi
eskiyle karakter karakter ayni (14 sutun). Onizleme (ayni veri aninda profiles vs gorunum + dal kodu calistirilarak):
kesfet 34/34 (ilk 5 id ve tum alanlar ayni), kategori/dj 3/3, kategoriler haritasi ayni (Yakinda rozeti 12 = db sifir
kumesi 12), sihirbaz sayaci 34 = kesfet, sitemap 34/34 URL. **Embed kaniti:** gorunum uzerinden `turkish_cities(name)`
ve `service_categories!profiles_primary_category_id_fkey(...)` dolu dondu (hint'li yazim korundu; hint'siz de
calisiyor) — bolum 3'teki yedek plan gerekmedi. Sapmalar (kabul): sutun kilidi yalniz `satisfies` ile (liste 33
sutunun alt kumesi; Exclude/never burada anlamsiz), tipler semadan yazildi ve bolum 3 ile ortustu, 2 ESLint hatasi
onceden var (`tierWeight` icinde `Date.now()`, 6c0ede70). Commit Guven tarafindan.

**P1 deploy (21 Eylul):** Vercel deploy tamam; onizleme cookie'siyle kesfet/kategori/kategoriler normal (Guven).

**P2 — detay ve havuzlar (21 Eylul 2026, Claude Code raporu):** 6 dosya (+81/-60): `p/[id]/page.tsx` (yayin on
kontrolu, ana detay `ProviderPage`, benzer profiller), `p/[id]/yorumlar` (`ProviderCard & Pick<..., 'is_published'>`),
`favoriler` (kart sorgusu; `any` kalkti), `lib/ai-actions.ts` (pro-bul havuzu), `teklif-topla/actions.ts` (dagitim
havuzu) -> gorunum; kimlik okumalari (oturum sahibi rol/is_admin/suspended_at, yorumcu kartlari) profiles'ta.
`ProfileListing` ve `ProfilePublic` silindi (kullanim 0), `ProviderPage`/`ProviderCard` eklendi. tsc bos, build
basarili. Sayfa kiyasi (main vs dal, derleme kimligi normalize): /p/<professional> 50069 bayt birebir, /p/<yayinda
olmayan> birebir, /yorumlar birebir, /p/<ajans> birebir. Oturum gerektiren maddeler (sahip/admin gorunumu, favoriler,
pro-bul, teklif-topla) veri katmaninda kanitlandi: 34/34 detay satiri alan alan esit, favori kartlari 34/34, pro-bul
havuzu 3/3, teklif-topla havuzu 3/3 (premium_tier/premium_until/created_at kumesi esit), benzer profiller 2/2.
Sapma (kabul): detay select dizesinin sutun SIRASI degisti (kume ayni; PostgREST JSON'u siradan bagimsiz; sayfa
birebir) — gorev metnindeki "ayni sira" ile "PROVIDER_LISTING_COLUMNS + 2" celisiyordu, tek kaynak tercih edildi.

**P2 bulgulari:**
1. **`/p/[id]` rol kapisi `business`'a izin veriyor, gorunumde business yok.** Bugun yayinda business profili 0 ->
   davranis degismedi. **Karar (21 Eylul, Guven):** kapidan `business` cikarilir (11 bolum 2: business saglayici
   degil; kurum sayfasi FAZ 8 organizations). P3'te uygulanir.
2. **"Benzer profiller" sorgusu hic kosmuyor** (`page.tsx` ~440-563: professional dalinda erken return; sorgu
   blogun disinda; tek ajansin primary_category_id'si null). Onceden var olan olu kod / urun hatasi; 2c kapsami
   disi, ayri is (davranis degisikligi). Sorgu gorunume gecirildi, veri katmaninda 2/2 dogrulandi.
3. **Tarama eksigi:** tek tirnakli grep cift tirnakli 5 dosyayi kacirmisti (bolum 1 duzeltmesi); 4'u ana sayfa
   pazaryeri okumasi -> P3.
4. `ai-actions.ts:86` "davetkar" sapkali harf (e4cc541e, 22 Haziran) -> P3'te duzeltilir.
