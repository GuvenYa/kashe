# 13 — FAZ 2b: Saglayici hizmetleri (`provider_services`) ve `provider_id` sutunlari

**Kaynak plan:** `docs/architecture/01-veri-modeli.md` bolum 2 (provider_services), `04-goc-plani.md` FAZ 2 madde 15-16 ve
madde 21 (`v_provider_roles`), `11-faz2-saglayici-defteri.md` bolum 7.
**Durum:** KAPANDI (21 Eylul 2026; uretimde, asama9 tam, canli aynalama kaniti). Kapanis bolum 8. Siradaki: 2c.

## 1. Amac ve sinir

- `provider_services`: saglayicinin verdigi **roller** (coverage hesabinin temeli). Saglayici x rol basina TEK satir;
  fiyat, birincil bayragi, kapasite, hazirlik suresi.
- 5 eski tabloya (`services`, `portfolio_items`, `profile_experiences`, `reviews`, `favorites`) `provider_id`
  (NULL olabilir, = mevcut `profile_id` / `professional_id`); FAZ 10'da eski sutunun yerine gecer.
- `v_provider_roles`: saglayici + rol + fiyat + gorunurluk birlesimi (security_invoker).
- **Sinir:** `services` KAYNAK kalir; uygulama `provider_services`'i 2c'ye kadar okumaz ve yazmaz. Cift alan
  doneminde her sey `services` + `profiles.primary_category_id`'den **turetilir** (asagida). Eski tablolarda
  yalniz yeni sutun yazilir; baska hic bir sutun (updated_at dahil) degismez.

## 2. Kararlar

| Konu | Karar | Neden |
|---|---|---|
| Satir tanecigi | saglayici x rol = 1 satir (`UNIQUE (provider_id, role_id)`); `services` ise saglayici x kategori x N hizmet | Coverage "bu saglayici bu rolu veriyor mu" sorusudur; N hizmet fiyat listesidir, 2c'de `services` bu rolun altinda kalir |
| Kaynak | AKTIF `services` satirlari (kategori -> `service_roles.legacy_category_id`) + `profiles.primary_category_id` (birincil) | Pasif hizmet teklif degildir; birincil kategori hizmeti olmasa da rolu tanimlar (fiyatsiz satir) |
| Ayni rolde birden fazla aktif hizmet | **temsilci** = en dusuk (`sort_order`, `created_at`, `id`); fiyat temsilciden | min/max birlestirmesi farkli birimlerde (saatlik + gunluk) anlamsiz olur; temsilci deterministik ve aciklanabilir. `legacy_service_id` hangi hizmet oldugunu soyler |
| Fiyat eslemesi | `price_on_request` -> `on_request`, fiyat/birim NULL; `price_starting` -> `range`, `price_max` NULL ("X'ten baslayan"); min = max -> `fixed`; aksi `range`. Birim: total->per_job, hourly->per_hour, half_day->per_half_day, full_day->per_day (`map_legacy_price_unit`) | 01 enum'larina uyum; "baslayan" bilgisi acik ust sinirla korunur |
| `professional_profiles` fiyat ozeti | birincil rol fiyatliysa o; degilse en dusuk `price_min`'li fiyatli rol; degilse `on_request` olan; satir yoksa NULL (`derive_provider_price_summary`) | 2a "services'tan turetme 2b'nin isi" demisti; kart/ozet icin tek fiyat gerekir, birincil rol basligi belirler |
| `origin` sutunu | `legacy_sync` (turetildi; aynalama siler/gunceller) / `provider` (2c'de uygulama yazdi; aynalama DOKUNMAZ) | 2c'de dogrudan yazma basladiginda aynalama ile catisma olmasin; `capacity`/`lead_time_days` hic turetilmez, korunur |
| `provider_id` FK | `providers(id) ON DELETE SET NULL`, NULL olabilir, indeksli | Cift alan doneminde CASCADE tehlikeli (providers satiri bagimsiz silinse eski veri gider). NOT NULL + CASCADE FAZ 10'da |
| `provider_id` yazimi | BEFORE tetikleyici her INSERT/UPDATE'te `profile_id`/`professional_id`'den turetir; **istemcinin verdigi deger ezilir**; sahip saglayici degilse (client/business) NULL | Eski tablolarda tablo duzeyi GRANT var (yeni sutun otomatik yazilabilir); kurcalamaya kapali tek yol turetmedir |
| Dolumda `updated_at` | `services`, `profile_experiences`, `reviews` updated_at tetikleyicileri dolum suresince gecici kapatilir | reviews'ta "duzenlendi" gorunumu, services'ta siralama oynamasin; dosya sonunda acik kaldigi dogrulanir, hata olursa BEGIN/COMMIT hepsini geri alir |
| Yetki | `provider_services` herkese okunur (RLS: saglayici `is_published` VEYA kendi VEYA admin — `services_read_published` siniri); **istemciden yazma yok** (2c). `v_provider_roles` security_invoker | Hassas sutun yok; onay/askiya gorunurlugu 2c okuma yolunda `is_visible` ile |
| Rolu olmayan kategori | turetme atlar; asama9 K9 sayar (0 beklenir) | 3a aynalamasi her legacy_role kategoriye rol verir; K9 emniyet |

## 3. Dosyalar

| Dosya | Icerik |
|---|---|
| `supabase/migrations/20260920180000_faz2b_01_saglayici_hizmetleri.sql` | `provider_services` (UNIQUE provider+rol, tek-birincil kismi indeks, fiyat/kapasite CHECK, origin CHECK); 5 tabloya `provider_id` + indeks; `v_provider_roles`; GRANT SELECT anon/authenticated, RLS SELECT politikasi; yazma grant'i yok |
| `supabase/migrations/20260920180100_faz2b_02_aynalama.sql` | `map_legacy_price_unit`, `derive_provider_services(uuid)` (salt okur, tek gercek), `derive_provider_price_summary(uuid)`, `recompute_provider_services(uuid)` (legacy_sync satirlarini turetilen kumeye esitler; ozet gunceller); tetikleyiciler: `trg_faz2b_sync_services` (services AFTER I/U-of/D), `trg_faz2b_sync_primary_role` (profiles AFTER UPDATE OF primary_category_id), `trg_faz2b_sync_new_provider` (providers AFTER INSERT), `trg_faz2b_set_provider_id` (5 tabloda BEFORE I/U) |
| `supabase/migrations/20260920180200_faz2b_03_dolum.sql` | VERI YAZAR: updated_at tetikleyicilerini gecici kapatir; 5 tabloda `provider_id` dolar; her saglayici icin `recompute`; NOTICE ile sayilar; kapali tetikleyici kalmadigini dogrular |
| `docs/envanter/asama9-faz2b-tutarlilik.sql` | SALT OKUNUR, dal + uretim: K1-K5 sahip = provider_id, K5b farkli provider_id 0, K6 legacy_sync = turetilen (EXCEPT iki yon, fiyat dahil), K7 ozet farki, K8 cift birincil, K9 rolsuz kategori, K10/K11 bilgi, K12 sync_log |
| `docs/envanter/asama4-davranis-testi.sql` | T13 (bolum 4); T0'a hizmet/provider_services temizligi (kategori silinmeden once) |

**Yerel zincir (21 Eylul):** 46 + PII + faz0 + faz1 + faz2a + faz3a + uretim benzeri seed (4 profil, 8 hizmet: 4 birim,
on_request, starting, ayni kategoride 2 aktif, pasif hizmet, client hizmeti; portfoy/deneyim/yorum/favori). Uc dosya
ikiser kez: dolum NOTICE `provider_id yazildi — services 7, portfolio_items 2, profile_experiences 2, reviews 1,
favorites 2` / `6 saglayici hesaplandi, 6 satir, hata 0`; ikinci kosuda 0 yazim, `provider_services.updated_at`
degismedi. **`services.updated_at` ve `reviews.updated_at` dolum oncesi/sonrasi birebir ayni.** asama4 T0-T13
**14/14 GECTI** (iki kosu); asama9 hepsi ESIT (K10 6/3); asama7 ve asama8 degismedi. Mutasyon: aynalama
tetikleyicisi kapali -> T13 HATA (fiyat NULL); provider_id tetikleyicisi kapali -> HATA (istemci degeri kaldi);
INSERT grant + izinli politika -> HATA (yazabildi; yalniz grant acilinca RLS hala engelledi, 42501); RLS `true` ->
HATA (anon yayinda olmayani gordu); birincil tetikleyicisi kapali -> HATA; asama9 K6 fiyat kaydirmasini 1/1 FARK
yakaladi, `recompute` onardi.

## 4. Davranis ozeti (2b sonrasi)

- Profesyonel hizmet ekler/duzenler/siler (bugunku `hizmetlerim` akisi, `services`'a yazar) -> ilgili rol satiri
  turetilir/guncellenir/silinir; `professional_profiles` fiyat ozeti yenilenir. Birincil kategori degisir -> birincil
  bayragi tasinir; hizmeti olmayan eski birincil satiri silinir.
- Yeni kayit: profil -> (2a) providers -> (2b) recompute (hizmet yok, birincil yok -> satir yok; hata yok).
- `services`/`portfolio_items`/`profile_experiences`/`reviews`/`favorites` yazimlarinda `provider_id` otomatik dolar;
  uygulama bu sutunu GONDERMEZ (gonderse de ezilir).
- Uygulama `provider_services`/`v_provider_roles`'u 2c'ye kadar okumaz. Okuyacaginda gorunurluk icin
  `v_provider_roles.is_visible` kullanilir (yayinda + onayli + askida degil).

## 5. Uretim sirasi (adim adim)

On kosul: `git status` temiz; dal `ukqhgspaallzjscjodbb`; FAZ 2a ve 3a uretimde (20 Eylul). Migration dosyalari
YALNIZ `supabase db push` ile uygulanir; SQL Editor salt okunur sorgular icindir (12 bolum 9).

1. Commit: `git add -A` / `git commit -m "FAZ 2b: provider_services, provider_id sutunlari, v_provider_roles, aynalama, dolum, T13, asama9"`.
2. **Uretimde on kontrol (Dashboard SQL Editor, salt okunur; DEGERLER gosterilir — 12 bolum 5 kurali):**
   ```sql
   -- (a) yeni nesneler henuz yok (bos donmeli)
   select table_name from information_schema.tables where table_schema='public' and table_name in ('provider_services','v_provider_roles');
   select table_name from information_schema.columns where table_schema='public' and column_name='provider_id'
     and table_name in ('services','portfolio_items','profile_experiences','reviews','favorites');
   -- (b) services degerleri (birim / istek / baslayan / aktif)
   select price_unit, price_on_request, price_starting, is_active, count(*) as adet,
          min(price_min) as en_dusuk, max(price_max) as en_yuksek, count(*) filter (where price_min = price_max) as min_esit_max
     from public.services group by 1,2,3,4 order by 1,2,3,4;
   -- (c) ayni saglayicida ayni kategoride birden fazla aktif hizmet (temsilci secimi devreye girer)
   select count(*) as cakisan_kategori from (select profile_id, category_id from public.services where is_active group by 1,2 having count(*) > 1) x;
   -- (d) rolu olmayan kategoriye bagli hizmet / birincil kategori (0 olmali)
   select (select count(*) from public.services s where not exists (select 1 from public.service_roles sr where sr.legacy_category_id = s.category_id)) as rolsuz_hizmet,
          (select count(*) from public.profiles p where p.primary_category_id is not null and not exists (select 1 from public.service_roles sr where sr.legacy_category_id = p.primary_category_id)) as rolsuz_birincil;
   -- (e) sahip rolu: saglayici olmayan (client/business) profile ait hizmet var mi
   select p.role, count(*) from public.services s join public.profiles p on p.id = s.profile_id group by 1 order by 1;
   -- (f) birincil kategori doluluk (professional/agency)
   select p.role, count(*) filter (where p.primary_category_id is not null) as birincil_dolu, count(*) as toplam
     from public.profiles p where p.role in ('professional','agency') group by 1;
   -- (g) 5 tablo satir sayisi
   select 'services' t, count(*) from public.services union all select 'portfolio_items', count(*) from public.portfolio_items
   union all select 'profile_experiences', count(*) from public.profile_experiences union all select 'reviews', count(*) from public.reviews
   union all select 'favorites', count(*) from public.favorites;
   -- (h) dolumun gecici kapatacagi updated_at tetikleyicileri (uc ad beklenir)
   select c.relname, g.tgname from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('services','profile_experiences','reviews','portfolio_items','favorites')
      and not g.tgisinternal and g.tgname ilike '%updated_at%';
   ```
   Beklenen: (a) bos; (b) `price_unit` yalniz total/hourly/half_day/full_day (CHECK zaten zorlar); (d) 0/0; (h)
   `update_services_updated_at`, `update_profile_experiences_updated_at`, `trg_reviews_updated_at`. (b)-(g)
   ciktilari 13 bolum 8'e islenir; **cikti degerlendirilmeden 3. adima gecilmez.**
3. **Dal:** `supabase link --project-ref ukqhgspaallzjscjodbb` -> `supabase db push` (3 dosya). NOTICE'lar: dalda
   hizmet yok -> `provider_id yazildi — ... 0` ve `N saglayici hesaplandi, 0 satir`.
4. **Dalda test:** `asama4-davranis-testi.sql` -> 14 satir, **T13 GECTI** (T9 ATLANDI normal);
   `asama9-faz2b-tutarlilik.sql` -> hepsi ESIT (K10 0/0 BILGI).
5. **Uretim:** `supabase link --project-ref qydsooqmflrrwtgawhsv` -> `supabase db push` (3 dosya). NOTICE
   sayilari adim 2 (g) ile karsilastirilir (services satiri = saglayici sahipli satir sayisi).
6. **Uretimde dogrulama:** yalniz `asama9-faz2b-tutarlilik.sql` -> hepsi ESIT; K10 satir sayisi ~ (aktif
   kategori sayisi + hizmetsiz birincil). Ardindan `asama7` (K7 ESIT kalmali) ve onizlemede bir profesyonelle
   `hizmetlerim`'de fiyat degistir -> asama9 K6 ESIT kalmali (canli aynalama kaniti).
7. `git push`.

**Geri alma (2b):** tetikleyicileri kaldirmak yeter (`DROP TRIGGER trg_faz2b_sync_services ON public.services;`
`... trg_faz2b_sync_primary_role ON public.profiles; ... trg_faz2b_sync_new_provider ON public.providers;` ve 5 tabloda
`trg_faz2b_set_provider_id`). Tam geri alma: `DROP VIEW v_provider_roles; DROP TABLE provider_services;` 5 tabloda
`ALTER TABLE ... DROP COLUMN provider_id;` 4 fonksiyon + 5 tetikleyici fonksiyonu DROP;
`UPDATE professional_profiles SET pricing_mode = NULL, price_min = NULL, price_max = NULL, price_unit = NULL;`.

## 6. Kalici kurallar (2b sonrasi)

- **`provider_id` istemciden gonderilmez.** Tetikleyici turetir; uygulama kodu (2c dahil) bu sutunu INSERT/UPDATE
  govdesine koymaz. FAZ 10'da `profile_id` kaldirilirken tetikleyici de kaldirilir ve sutun NOT NULL + CASCADE olur.
- **`services` fiyat/kategori/aktiflik sutunu eklenir veya degisirse:** `derive_provider_services` ve
  `trg_faz2b_sync_services`'in `UPDATE OF` listesi guncellenir; asama9 K6 farki yakalar.
- **`provider_services`'a uygulama yazmaya baslarken (2c):** `origin = 'provider'` ile yazilir; aynalama bu satirlara
  dokunmaz. Kaynak `provider_services`'a gectiginde `trg_faz2b_sync_services` kaldirilir, `services` fiyat
  alanlari salt-okunur yapilir (FAZ 10).
- **Yeni kategori:** 3a kurali (rol otomatik dogar) 2b'yi de kapsar; rolsuz kategoriye bagli hizmet olusamaz
  (K9 emniyet).
- **`updated_at` damgasi dolumda oynatilmaz.** Eski tabloya sutun dolduran her dosya, tabloda `*updated_at*`
  tetikleyicisi varsa 03 kalibiyla gecici kapatir ve acik kaldigini dogrular.

## 7. Sonraki: 2c

Okuma yollarinin `providers` / `provider_services` / `v_provider_roles`'a gecisi (Claude Code; `ProfileOpen` ->
`Provider` tipleri), `hizmetlerim` yazma yolunun `provider_services`'a acilmasi (`origin = 'provider'`), cift yazma
doneminin bitis kriteri (11 bolum 2). Plan: `14-faz2c-okuma-yolu.md` (21 Eylul; karar: gorunum sozlesmesi, yazma yolu FAZ 10).

## 8. Kapanis kaydi (21 Eylul 2026)

**Uretim on kontrolu (adim 2, degerler):** (a) bos. (b) 17 hizmet, hepsi aktif: `hourly` 1 (2000/2000), `total` 11
(2000-200000, min=max yok), `total` + `price_starting` 1 (2000/2000), `total` + `price_on_request` 4. (c) 5 saglayici-kategori
ciftinde birden fazla aktif hizmet (temsilci kurali devrede). (d) rolsuz hizmet 0 / rolsuz birincil 0. (e) 17 hizmetin
hepsi `professional`. (f) birincil kategori dolu: professional 21/35, agency 0/1. (g) services 17, portfolio_items 20,
profile_experiences 13, reviews 3, favorites 4. (h) `update_profile_experiences_updated_at`, `trg_reviews_updated_at`,
`update_services_updated_at`.

**Dal (`ukqhgspaallzjscjodbb`):** 3 dosya push; dolum NOTICE `provider_id yazildi — 0/0/0/0/0`, `3 saglayici hesaplandi,
0 satir, hata 0`. asama4 T0-T13 **14/14** (T9 ATLANDI, **T13 GECTI**); asama9 hepsi ESIT (K10 0/0).

**Uretim (`qydsooqmflrrwtgawhsv`):** 3 dosya push; NOTICE `provider_id yazildi — services 17, portfolio_items 20,
profile_experiences 13, reviews 3, favorites 4` (on kontrol (g) ile birebir), `36 saglayici hesaplandi,
provider_services toplam 23 satir, hata 0`. asama9: **hepsi ESIT** — K1 17/17, K2 20/20, K3 13/13, K4 3/3, K5 4/4, K5b 0,
K6 0/0, K7 0, K8 0, K9 0, **K10 23 satir / 21 birincil** (21 = birincil kategorisi dolu profesyonel sayisi; 2 satir
birincil disi rol), K11 0, K12 0. asama7 (2a) degismedi: hepsi ESIT (K1-K3 35/35, K4-K5 1/1). **Canli aynalama
kaniti:** onizlemeyle `hizmetlerim`'de fiyat degistirildi, asama9 tekrar: K6 0/0 ESIT (turetilen = kayitli).
`git push` -> `cf88dfc..7fef329 main`. Migration dosyalari yalniz `db push` ile uygulandi (SQL Editor'a
yapistirilmadi).

**Sonuc:** FAZ 2b uretimde ve kapali. `services` kaynak; `provider_services` 23 satirla turetilmis ve canli aynalanir;
uygulama 2c'ye kadar yeni yapiyi okumaz. Siradaki: 2c plani (14).
