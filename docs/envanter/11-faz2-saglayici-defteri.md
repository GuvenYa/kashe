# 11 — FAZ 2: Saglayici kayit defteri (talents, providers, alt profiller)

**Baslangic:** 17 Eylul 2026 (on kosul `10-faz2-onkosul-tipler.md` kapandiktan sonra)
**Durum:** FAZ 2a dosyalari hazir, yerel zincirde test edildi (T0-T11 12/12, asama7 10/10 ESIT + 1 BILGI). Dala ve uretime UYGULANMADI.
**Kaynak:** `docs/architecture/01-veri-modeli.md` bolum 2-3, `04-goc-plani.md` FAZ 2 (11e-11h, 12-19), `03-taksonomi.md`.

---

## 1. Amac ve alt adimlar

`profiles` bugun uc isi birden yapiyor: kullanici kimligi, pazaryeri profili, kurulus hesabi. FAZ 0 kurulusu
ayirdi (`organizations`); FAZ 2 **pazaryeri profilini** ayirir: pazaryerinde listelenen her varlik `providers`'ta
(profesyonel veya organizasyon), profesyonelin canonical kimligi `talents`'ta, tipe ozel alanlar
`professional_profiles` / `organization_profiles`'ta.

Gocun en buyuk parcasi oldugu icin dort alt adima bolundu; her biri tek basina uretime cikar ve geri alinir:

| Adim | Icerik | Risk | Durum |
|---|---|---|---|
| **2a** | talents, providers, alt profiller; koruma tetikleyicisi; profiles -> providers aynalamasi; dolum. **Okuma yolu degismez.** | dusuk (yalniz ekleme) | dosyalar hazir |
| **3a** | `roles` tablosu: 23 kategori birebir rol (slug korunur), `legacy_category_id`; ust servis kategorisi katmani bos (esleme ekiple) | dusuk | siradaki |
| **2b** | `provider_services` (`role_id -> roles`); `services`, `portfolio_items`, `profile_experiences`, `reviews`, `favorites`'a `provider_id` (= profil id, dolum + aynalama); `v_provider_roles` | dusuk-orta | 3a sonrasi |
| **2c** | okuma yollarinin `providers`'a gecisi (Claude Code; `ProfileOpen` -> `Provider` tipleri), istemci yazma yolunun acilmasi; en sonda profiles'taki tasinan alanlarin salt-okunur yapilmasi | orta | 2b sonrasi, ayri plan |

Sira bagimliligi: `provider_services.role_id` `roles`'a baglidir; `roles` FAZ 3'un tablosu. Karar: 3a
(yalniz tablo + kopya) 2b'den once cekilir. Ust servis kategorisi (6-8 grup) eslemesi ekip karari, 3b olur.

## 2. Kararlar (17 Eylul, Guven onayi)

| Konu | Karar | Gerekce |
|---|---|---|
| Kimlik | **Ayni id:** `providers.id = profiles.id` (profesyonel ve ajans), `talents.id = profiles.id` | `services.profile_id`, `reviews.professional_id`, `favorites.professional_id`, `conversation_assignees.professional_id`, `/p/[id]` zaten saglayici kimligini tasir. Yeni uuid, her FK icin esleme + URL degisimi demekti. Hesapsiz harici yetenekler (FAZ 5) yeni uuid alir |
| Sira | 2a -> 3a (roles) -> 2b -> 2c | `provider_services.role_id` icin `roles` gerekir; `category_id` ile kurup sonra cevirmek bir gecis daha demekti |
| Onay tipi | `providers.approval_status` = mevcut `profile_approval_status` enum'u | Degerler ayni (draft/pending/approved/rejected/revision); ikinci enum ayrisir (premium_tier kararinin aynisi) |
| talents PII | `canonical_email` / `canonical_phone` dolumda BOS | Hesapli yetenegin kimligi `user_id`; e-posta/telefon `profiles`'ta ve RPC'lerle korunuyor; kopya PII'yi ikinci yere yayar. FAZ 5'te yalniz hesapsiz yetenekler icin dolar |

Uygulama sirasinda alinan kararlar:

- **business saglayici degil.** 04-goc-plani madde 13-14: professional -> talents + providers, agency -> providers
  (organization). `business` kurumsal alici; `providers` satiri almaz.
- **Koruma tetikleyicisi + aynalama bypass.** `protect_sensitive_provider_fields` 10 yonetici alanini
  (approval_status, approval_note, approved_at, suspended_at, suspension_reason, suspended_by, is_verified,
  verification_level, trust_score, trust_computed_at) admin disinda sessizce geri alir (profiles ile ayni yontem;
  `approval_note` ve `trust_score` da listede — 04 Bulgu 2 ve risk tablosu). Aynalama SECURITY DEFINER icinde
  `kashe.sync_bypass = 'on'` ayarlar; aksi halde admin olmayan bir kullanicinin profil guncellemesiyle
  tetiklenen aynalama geri alinirdi. Profil tarafinda ayni alanlar zaten korunuyor, aynalanan deger hep mesru.
- **is_published korunmaz** (01 bolum 2: kullanici alani). Gorunurluk turetilir: `is_published AND
  approval_status = 'approved' AND suspended_at IS NULL`; `providers_visible_idx` bunu destekler.
- **Cascade zinciri profil silmeyle ayni:** `talents.user_id -> profiles ON DELETE CASCADE`,
  `providers.talent_id -> talents CASCADE`, `providers.organization_id -> organizations CASCADE`, alt profiller
  `-> providers CASCADE`. `providers.id -> profiles` FK YOK: ileride profilsiz saglayici (FAZ 5 claim akisi) icin
  kapi acik; K6 profilsiz saglayiciyi sayar.
- **Yetki:** providers / alt profiller herkese okunur (profiles gibi `qual = true`), ama providers'ta
  `approval_note`, `suspension_reason`, `suspended_by` anon/authenticated'a kapali. `talents`: anon hic;
  authenticated yalniz kendi satiri (+admin), `canonical_*` kapali. **Istemciden yazma yolu yok** (2c'ye kadar).
- **slug:** profil slug'i gecerli ve bossa degilse o; yoksa `'p-' || uuid`. Uretimde profesyonel slug'lari
  cogunlukla bos (kurulus profillerinde 3/3 bostu); URL'ler id ile calisiyor, slug FAZ 2c'de ele alinir.
- **Fiyat birimi:** `provider_price_unit` enum'u 01'e uyar (per_job/per_hour/per_half_day/per_day);
  `services.price_unit` metni (total/hourly/half_day/full_day) 2b'de eslenir. 2a'da fiyat alanlari bos
  (deger uydurulmaz; `services`'tan turetme 2b'nin isi).
- **Hata gunlugu:** FAZ 0'in `organization_sync_log` / `log_org_sync_error` tekrar kullanilir; `source`
  (`trg_faz2_sync_profile_to_provider`, `faz2a_03_dolum.providers`) ayirir. Ikinci bir gunluk tablosu acilmaz.

## 3. Dosyalar (2a)

| Dosya | Icerik |
|---|---|
| `supabase/migrations/20260917120000_faz2a_01_saglayici_tablolari.sql` | 6 enum (provider_type, verification_level, talent_origin, talent_claim_status, pricing_mode, provider_price_unit); `talents`, `providers` (tam-bir kisiti, slug unique, gorunurluk indeksi), `professional_profiles`, `organization_profiles`; `protect_sensitive_provider_fields` + tetikleyici; REVOKE/GRANT (providers sutun listeli, talents sutun listeli); RLS SELECT politikalari |
| `supabase/migrations/20260917120100_faz2a_02_aynalama.sql` | `ensure_provider_for_profile(uuid)`; `fn_sync_profile_to_provider` + `trg_faz2_sync_profile_to_provider` (profiles AFTER INSERT/UPDATE OF 13 sutun) |
| `supabase/migrations/20260917120200_faz2a_03_dolum.sql` | VERI YAZAR: professional/agency profiller -> defter; idempotan |
| `docs/envanter/asama7-faz2-tutarlilik.sql` | SALT OKUNUR, dal + uretim: K1-K10 (sayilar, profilsiz/yanlis rol, alan farki, bio farki, FAZ 0 kurulus bagi, talents PII bos, sync_log) |
| `docs/envanter/asama4-davranis-testi.sql` | T11: ayni id, aynalama (is_published/bio/ad/admin onayi), koruma (kara liste + admin), anon approval_note 42501, talents gizliligi, istemci UPDATE 42501, tam-bir kisiti 23514, sync_log bos |

Yerel zincir (46 + PII + faz0 01-04 + faz1): uc dosya ikiser kez (idempotan; ikinci dolum "0 saglayici"),
T0-T11 12/12 GECTI, asama7 10 ESIT + K9 BILGI (0). T11 mutasyon: koruma tetikleyicisi kapatildi -> HATA
("koruma DELINDI"); aynalama tetikleyicisi kapatildi -> HATA (talents yok); `approval_note` anon'a acildi ->
HATA. Geri alinca GECTI.

## 4. Davranis ozeti (2a sonrasi)

- Kayit: `handle_new_user` profil yazar -> professional icin talents + providers + professional_profiles,
  agency icin (FAZ 0 kurulusu garanti edilerek) providers + organization_profiles. client/business: hicbir sey.
- Profil guncellemesi (ad, sirket adi, bio, sehir, is_published, onay ve askiya alma alanlari) providers /
  talents / alt profile yansir. profiles KAYNAK; uygulama yeni tablolari 2c'ye kadar okumaz.
- Admin onayi profilde verilir, providers'a aynalanir. Bir kullanici providers'a dogrudan yazamaz (politika
  yok); yazabilse bile yonetici alanlari geri alinir.
- Uretimde beklenen dolum: 35 professional -> 35 talents + 35 providers + 35 professional_profiles;
  1 agency -> 1 providers(organization) + 1 organization_profiles; toplam 36 saglayici (17 Eylul sayimi).

## 5. Uretim sirasi (adim adim)

On kosul: `git status` temiz; dal `ukqhgspaallzjscjodbb`; FAZ 0 01-03 ve FAZ 1 uretimde (17 Eylul).

1. Commit: `git add -A` / `git commit -m "FAZ 2a: saglayici defteri - talents, providers, alt profiller, aynalama, dolum, T11, asama7"`.
2. **Uretimde on kontrol (salt okunur):**
   ```sql
   select role, count(*) from public.profiles group by 1 order by 1;
   select count(*) filter (where slug is null) as slug_bos, count(*) as toplam from public.profiles where role in ('professional','agency');
   select table_name from information_schema.tables where table_schema='public' and table_name in ('talents','providers','professional_profiles','organization_profiles');
   ```
   Beklenen: professional 35, agency 1 (degistiyse not al); son sorgu bos.
3. **Dal:** `supabase link --project-ref ukqhgspaallzjscjodbb` -> `supabase db push` (3 dosya).
4. **Dalda test:** `asama4-davranis-testi.sql` -> 12 satir, T11 GECTI (T9 ATLANDI normal); `asama7-faz2-tutarlilik.sql`
   -> 10 ESIT + K9 BILGI.
5. **Uretim:** `supabase link --project-ref qydsooqmflrrwtgawhsv` -> `supabase db push` (3 dosya); 03
   `NOTICE: faz2a dolum: 36 saglayici olusturuldu` (adim 2 sayisina gore).
6. **Uretimde dogrulama:** yalniz `asama7-faz2-tutarlilik.sql` -> hepsi ESIT, K1 35/35, K4 1/1, K10 0.
   Onizleme ile sayfa turu (degisiklik beklenmez; profil duzenle ve admin onay akisi bir kez denenir,
   ardindan asama7 tekrar: K7 0 kalmali).
7. `git push`.

Geri alma (2a): `DROP TRIGGER trg_faz2_sync_profile_to_provider ON public.profiles;` yeterlidir; tablolar dursa
zarar vermez. Tam geri alma: 4 tablo + 6 enum + 3 fonksiyon DROP (bagimlilik: alt profiller -> providers ->
talents).

## 6. Kalici kurallar (2a sonrasi)

- `profiles`'a yeni bir pazaryeri alani eklenirse: `providers` (veya alt profil) tarafi da eklenir, aynalama
  fonksiyonu ve `trg_faz2_sync_profile_to_provider`'in `UPDATE OF` listesi guncellenir, asama7 K7/K8 genisletilir.
- `providers`'a yeni sutun: GRANT listesi (hassas degilse) + yonetici alaniysa koruma kara listesi.
- Yeni yonetici karari alani (ornek `verification_level`) yalniz admin veya sistem (SECURITY DEFINER +
  `kashe.sync_bypass`) yazar; istemci yolu asla dogrudan yazmaz.

## 7. Sonraki: 3a ve 2b

- **3a** `roles`: `service_categories` 23 satiri `roles`'a kopyalanir (`id` yeni integer, `slug` birebir,
  `legacy_category_id` = eski id, `archetype` `category-fields.ts`'ten kopya), `service_categories`'e `layer`
  ve `parent_id` eklenir; ust kategori satirlari ve `roles.service_category_id` doldurulmasi ekip eslemesini
  bekler (03-taksonomi bolum "Ornek esleme": kesin liste 23 kategoriyle yapilir).
- **2b** `provider_services` (provider_id, role_id, is_primary, capacity, price_min/max, price_unit,
  lead_time_days) `services` + `profiles.primary_category_id`'den dolar; `provider_id` sutunlari 5 tabloya
  eklenir (= mevcut profile_id / professional_id; NOT NULL yapilmaz, aynalanir); `v_provider_roles`.
