# 14 — FAZ 2c: Pazaryeri okuma yolunun yeni yapiya gecisi (`v_providers_public`)

**Kaynak plan:** `docs/architecture/04-goc-plani.md` FAZ 2 madde 18 ("okuma yollari tek tek providers'a gecirilir"),
`11-faz2-saglayici-defteri.md` bolum 2 (cift alan doneminin bitis kriteri), `13-faz2b` bolum 7.
**Durum:** P0 (veritabani) DOSYALAR HAZIR (21 Eylul 2026; yerelde test edildi). P1-P3 Claude Code isleri sirada.

## 1. Tarama (21 Eylul, repo `682b860`)

| Olcum | Sonuc |
|---|---|
| `from('profiles')` | **133 cagri / 63 dosya** |
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

**P2 — detay ve havuzlar:** `p/[id]/page.tsx` (detay + benzer profiller; oturum sahibi/yorumcu profilleri profiles'ta),
`p/[id]/yorumlar/page.tsx`, `favoriler/page.tsx` (favori kartlari), `lib/ai-actions.ts` (pro-bul havuzu),
`teklif-topla/actions.ts` (havuz). Kabul: /p/[id] ziyaretci + sahip + admin gorunumu, yorumlar, favoriler, pro-bul
onerisi, teklif-topla dagitimi (kota algoritmasi ayni girdileri almali: premium_tier, premium_until, created_at).

**P3 — kalan ve kural:** taramada kalan pazaryeri okumalari (`admin/profiller` ve `admin/rapor` HARIC — admin
`profiles`'ta kalir), `app/components/sections/*` varsa; `CLAUDE.md`'ye kural: **yeni kod pazaryeri alanini
`profiles`'tan okumaz, `v_providers_public` okur**; `grep "from('profiles')"` sonucu kimlik/operasyon listesi olarak
14'e islenir (FAZ 10 kesim listesi).

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

(P0 uretim sonrasi: asama10 uretim degerleri, git; P1-P3 her biri kendi commit'iyle buraya islenir)
