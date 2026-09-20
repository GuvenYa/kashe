# 12 — FAZ 3a: Taksonomi — service_roles tablosu

**Baslangic:** 18 Eylul 2026 (FAZ 2a uretime ciktigi gun; 2b'nin `provider_services.role_id` on kosulu)
**Durum:** KAPANDI (20 Eylul 2026; uretimde, asama8 tam, migration kaydi dogrulandi). Kapanis bolum 8-9. Siradaki: 2b.
**Kaynak:** `docs/architecture/03-taksonomi.md`, `04-goc-plani.md` FAZ 3 (18-22), `docs/yeni-kategori-checklist.md`.

---

## 1. Amac ve sinir

Uc katmanli taksonominin (service category > role > skill) **rol** katmanini kurar. Mevcut 23
`service_categories` satiri bugun zaten rol duzeyindedir (fotografci, dj, sunucu); birebir kopyalanir.
Ust servis kategorisi katmani (6-8 grup) ve `skills` bu adimda YOK: ust katman eslemesi ekip karari (3b),
skill katmani IP1 stil cikarimiyla dolar (FAZ 9 sonrasi). **Hicbir FK, sayfa, yapilandirma dosyasi degismez.**

## 2. Kararlar

| Konu | Karar | Gerekce |
|---|---|---|
| Tablo adi | **`service_roles`** (18 Eylul, Guven) | `role` kod tabaninda iki kavram (`profiles.role`, `organization_memberships.role`); ucuncusu ayni kelimeyle yasamaz. FK sutunlari `role_id` kalir |
| Anahtar | integer (identity) | 01 kurali: taksonomi ve referans tablolari integer (`service_categories`, `turkish_cities` gibi) |
| slug | `service_categories.slug` BIREBIR, `UNIQUE`, `^[a-z0-9]+(-[a-z0-9]+)*$` | Bes yapilandirma dosyasi + ikonlar slug ile anahtarli (03 bolum 1); slug degisirse hepsi kirilir |
| Eski kimlik | `legacy_category_id` (UNIQUE, FK -> service_categories) | `services/listings/quote_requests.category_id`, `profiles.primary_category_id` dokunulmadan calisir; `v_provider_roles` (2b) bu alanla join yapar |
| `archetype` | sutun var, `category-fields.ts`'ten KOPYA (kaynak TypeScript'te kalir); dolumda slug'a gore `service_role_archetype_for_slug()` ile, eslesmeyen NULL | 03 bolum 2 karari; K5 NULL'lari sayar; elle verilen arketip aynalamada ezilmez |
| `service_categories.layer` | `'legacy_role'` (mevcut 23) / `'category'` (3b ust katman) | 03 "layer enum('category')" tek degerliydi; ust katman satirlari AYNI tabloya girecegi icin (roles.service_category_id -> service_categories) mevcut satirlarla ayrismasi gerekir |
| Aynalama | `service_categories (legacy_role)` INSERT/UPDATE -> `service_roles` (legacy_category_id ile upsert) | Admin bugun kategori talebini onaylayinca `service_categories`'e yazar (`app/admin/actions.ts`); rol satiri otomatik dogar. FAZ 0/2a kalibi, hata `organization_sync_log`'a |
| Yasak karakter | yalniz `slug` uzerinde (`^[a-z0-9]+(-[a-z0-9]+)*$`); `name_tr`'ye kisit YOK | 03 bolum 6 filtreye baglanan degerler icindir; filtreler slug/id ile baglanir. `name_tr` gosterim metnidir ve uretimde "Sac, Makyaj ve Styling" gibi virgullu ad zaten var (bolum 7) |
| Yetki | `service_categories` ile ayni: herkes okur, INSERT/UPDATE yalniz admin (RLS), DELETE yok | Mevcut desen |

## 3. Dosyalar

| Dosya | Icerik |
|---|---|
| `supabase/migrations/20260918130000_faz3a_01_service_roles.sql` | `service_categories` + `layer` + `parent_id` (+2 CHECK, indeks); `service_roles` (identity pk, slug/legacy unique, 2 CHECK, 2 indeks, updated_at tetikleyicisi); `service_role_archetype_for_slug(text)` (23 slug); `fn_sync_category_to_service_role` + `trg_faz3_sync_category_to_service_role`; dolum (idempotan); GRANT/RLS |
| `docs/envanter/asama8-faz3a-taksonomi-kontrol.sql` | SALT OKUNUR, dal + uretim: K1 sayi, K2 slug EXCEPT, K3 alan farki, K4 legacy bos, K5 arketipsiz, K6 ust katman sayisi (3a'da 0), K7 arketip dagilimi (beklenen 8/3/6/6), K8 sync_log |
| `docs/envanter/asama4-davranis-testi.sql` | T12: legacy = rol (slug+ad), admin kategori -> rol dogar (arketip NULL), guncelleme aynalanir + elle arketip korunur, ust katman satiri rol olmaz, parent_id = id 23514, anon okur/yazamaz, pro1 RLS 0 satir, admin yazar, gecersiz slug 23514; test verisini sonunda siler |

Yerel zincir (46 + PII + faz0 + faz1 + faz2a): yerel harness'ta kategori satiri yoktu, once 23 slug'lik uydurma
adli bir seed kullanildi (bolum 7'deki ders); duzeltmeden sonra seed uretim gercegine cekildi: 25 satir, 23 aktif +
2 pasif presetsiz (`sanatci`, `animasyon`), virgullu ad. **Yalniz yerel**, migration degil. Dosya iki kez kosuldu (idempotan),
25 rol / 23 arketip (8 sahne, 3 cast, 6 produksiyon, 6 uzmanlik; 2 pasif NULL), T0-T12 13/13 GECTI, asama8 7 ESIT
+ K5b 2 BILGI + K7 8030606 BILGI, asama7 (FAZ 2a) degismedi. T12 mutasyon: aynalama tetikleyicisi kapatildi -> HATA; update politikasi
`true` yapildi -> HATA ("RLS delik"). Ders: PL/pgSQL'de `r record` degiskeni ile `service_roles r` takma adi
catisir ("record r is not assigned yet"); takma ad `sr` yapildi.

## 4. Uretim sirasi (adim adim)

On kosul: FAZ 2a uretimde (18 Eylul), `git status` temiz, dal `ukqhgspaallzjscjodbb`.

0. **Uretim temiz mi (20 Eylul denemesinden sonra, salt okunur):**
   ```sql
   select to_regclass('public.service_roles') is not null as service_roles_var,
          exists (select 1 from information_schema.columns where table_name = 'service_categories' and column_name = 'layer') as layer_var,
          exists (select 1 from supabase_migrations.schema_migrations where version = '20260918130000') as kayit_var;
   ```
   Ucu de false olmali. Biri true ise DUR ve bildir.
1. Commit: `git add -A` / `git commit -m "FAZ 3a: service_roles - taksonomi rol katmani, aynalama, dolum, T12, asama8"`.
2. **Uretimde on kontrol (salt okunur):**
   ```sql
   select count(*) as kategori, count(*) filter (where is_active) as aktif from public.service_categories;
   select slug from public.service_categories order by sort_order, id;
   select column_name from information_schema.columns where table_name = 'service_categories' and column_name in ('layer','parent_id');
   select to_regclass('public.service_roles') is not null as service_roles_var;
   ```
   Uretimde 20 Eylul: **25 kategori** (23 aktif + 2 pasif: `sanatci`, `animasyon` — preset yok, arketipsiz ve pasif
   rol olurlar; K5 yalniz aktif arketipsizleri sayar, K5b pasifleri bilgi olarak gosterir); son iki sorgu bos / false.
3. **Dal:** `supabase link --project-ref ukqhgspaallzjscjodbb` -> `supabase db push` (1 dosya). Dalda kategori
   satiri yoksa (dal bos kuruldu) dolum 0 satir yazar; T12 yine gecer (kendi test kategorisini ekler), asama8
   K1 0/0 ESIT olur.
4. **Dalda test:** `asama4-davranis-testi.sql` -> 13 satir, T12 GECTI (T9 ATLANDI normal); `asama8-faz3a-taksonomi-kontrol.sql`.
5. **Uretim:** `supabase link --project-ref qydsooqmflrrwtgawhsv` -> `supabase db push` (1 dosya).
6. **Uretimde dogrulama:** yalniz `asama8-faz3a-taksonomi-kontrol.sql` -> K1 25/25, K2-K5 0, K5b 2 (BILGI),
   K6 0, K7 8030606, K8 0. Onizlemeyle /kategoriler ve bir kategori sayfasi (degisiklik beklenmez).
7. `git push`.

Geri alma: `DROP TRIGGER trg_faz3_sync_category_to_service_role ON public.service_categories; DROP TABLE
public.service_roles; DROP FUNCTION public.fn_sync_category_to_service_role(), public.service_role_archetype_for_slug(text);
ALTER TABLE public.service_categories DROP COLUMN layer, DROP COLUMN parent_id;` — hicbir uygulama yolu bagli degil.

## 5. Kalici kurallar (3a sonrasi)

- **Yeni kategori = yeni rol, otomatik.** `docs/yeni-kategori-checklist.md` madde 1 degismez: admin
  `service_categories`'e yazar, rol aynalanir. Yeni slug `category-fields.ts`'e preset olarak eklendiginde
  `service_role_archetype_for_slug` CASE'ine de eklenir (migration) — yoksa K5 onu sayar ve rol arketipsiz
  kalir (hub gruplamasi TS'ten okudugu icin kirilma olmaz).
- **slug degismez.** `service_roles.slug` ve `service_categories.slug` birebir; K2 bunu her kosuda dogrular.
- **Dolum on kontrolu deger gosterir.** Veri yazan bir dosya (dolum) icin uretim on kontrolu, dolumun okuyacagi
  sutunlarin ornek degerlerini de listeler (`string_agg(name_tr, ...)` gibi); yalniz `count(*)` yeterli degildir
  (bolum 7 dersi).
- **Ust katman (3b) icin uyari:** `layer = 'category'` satirlari `service_categories`'e girecek; uygulama bugun
  bu tabloyu `layer` filtresi olmadan okur (`/kategoriler`, hero, etkinlik sihirbazi, pro-bul, sitemap). 3b'de
  once uygulama sorgulari `layer = 'legacy_role'` ile daraltilir (Claude Code), sonra ust satirlar eklenir;
  aksi halde ust kategoriler kesfet/kategori listelerinde birer kategori gibi gorunur.

## 6. Sonraki: 2b

`provider_services (provider_id -> providers, role_id -> service_roles, is_primary, capacity, price_min/max,
price_unit, lead_time_days)`; dolum `services` + `profiles.primary_category_id`'den (`role_id` = legacy esleme);
`provider_id` sutunlari `services`, `portfolio_items`, `profile_experiences`, `reviews`, `favorites`'a (= mevcut
profile_id / professional_id; aynalama); `v_provider_roles`. Plan `11-faz2-saglayici-defteri.md` bolum 7.

## 7. Olay kaydi — 20 Eylul: ilk uretim denemesi geri alindi

Dosya dal adimi atlanarak dogrudan uretime push edildi ve **dolumda hata verdi**:
`new row for relation "service_roles" violates check constraint "service_roles_name_tr_check"` — satir
`sac-makyaj-styling`, ad `Sac, Makyaj ve Styling` (virgul). Dosya `BEGIN ... COMMIT` icinde oldugu icin islem
geri alindi: uretimde `service_roles` yok, `layer`/`parent_id` yok, migration kaydi yazilmadi (bolum 4 adim 0 ile
dogrulanir).

**Kok neden:** yerel harness'ta kategori verisi yoktu; test icin uydurulan seed'de virgullu ad yoktu. 03 bolum 6'nin
"yasak karakter" kurali filtreye baglanan DEGERLER icindir (secenek degerleri, slug); `name_tr` gosterim metnidir ve
uretimde zaten virgul iceriyor. Kisit yanlis yere konmustu.

**Duzeltme (ayni dosya, ayni zaman damgasi — hicbir ortamda uygulanmadigi icin yerinde duzeltildi):**
`service_roles_name_tr_check` kaldirildi; `slug` regex kisiti kaldi. asama8 K5 yalniz aktif arketipsizleri sayar
(+K5b pasif bilgi). T12'den name_tr yasak-karakter denemesi cikti. Yerel seed uretim gercegine cekildi (25 satir,
virgullu ad, 2 pasif) ve tum test yeniden kosuldu (bolum 3).

**Iki ders:**
1. **Dal adimi atlanmaz.** Uretim `BEGIN/COMMIT` sayesinde temiz kaldi, ama bu sansti; dosya `COMMIT` sonrasi
   ikinci bir ifade icerseydi yarim kalabilirdi. Sira her zaman: dal push -> asama4 + asamaN -> uretim push.
2. **Yerel harness'ta uretim verisinin sekli olmayan tablolarda dolum test edilmis sayilmaz.** Dolum yazan her
   dosya icin on kontrol sorgusu, dolumun okuyacagi sutunlarin DEGERLERINI (yalniz sayilarini degil) gostermeli;
   `count(*)` yeterli degildi. Bu kural bolum 5'e eklendi.

## 8. Kapanis kaydi (20 Eylul 2026)

**Dal (`ukqhgspaallzjscjodbb`):** duzeltilmis dosya push; asama4 T0-T12: **13/13 GECTI** (T9 ATLANDI); asama8
hepsi ESIT (dalda kategori satiri yok: K1 0/0).

**Uretim (`qydsooqmflrrwtgawhsv`):** asama8 **K1 25/25, K2-K5 0, K5b 2 (sanatci, animasyon), K6 0, K7 8030606
(8 sahne / 3 cast / 6 produksiyon / 6 uzmanlik), K8 0**. `supabase db push` -> "Remote database is up to date"
(migration kaydi Remote'ta). `git push` -> `0b1aea4..9398ba2 main`.

**Uygulama yolu (netlestirildi, bolum 9):** kayit basarili bir `db push` ile yazildi; "kayitli ama semasi eksik"
penceresi olmadi. Dosya uretimde SQL Editor'dan da calistirildi ("Success. No rows returned") — idempotan, hicbir
seyi degistirmedi; kurala aykiriydi (bolum 9).

## 9. Netlestirme — migration kaydi ve SQL Editor kosusu (20 Eylul 2026, aksam)

**Bulgu:** `supabase migration list` (uretim) 56 satir, hepsinde Local = Remote; son satir
`20260918130000 | 20260918130000 | 2026-09-18 13:00:00`.

**20 Eylul'deki basarisiz push kaydi YAZMADI.** Supabase CLI `db push` her dosyayi tek bir ortuk islem icinde
gonderir (`pgconn.ExecBatch`, "implicitly transactional"); surum kaydi (`supabase_migrations.schema_migrations`'a
INSERT) ayni paketin son ifadesidir. Bir ifade hata verince sunucu paketin kalanini (COMMIT ve kayit INSERT'i dahil)
atlar; hicbir sey kalici olmaz. Bolum 7'deki "migration kaydi yazilmadi" tespiti bununla uyumludur. Dolayisiyla
bolum 8'deki (b) senaryosu elenir: kayit, duzeltilmis dosyanin basarili `db push`u ile yazildi (sonraki
`db push` bu yuzden "up to date" dedi). Sema ya o push ile geldi ya da daha once SQL Editor'da calistirilmisti
(Guven hatirlamiyor); ikinci halde bile push idempotan dosyayi sorunsuz uygulayip kaydi yazdi — sonuc ayni.

**SQL Editor kosusu:** dosya 20 Eylul aksami uretimde SQL Editor'dan bir kez (daha) calistirildi: "Success. No rows
returned". Dosya idempotan (`IF NOT EXISTS`, `ON CONFLICT`, `CREATE OR REPLACE`) ve zaten uygulanmis oldugu icin
hicbir satir/nesne degismedi; asama8 ciktisi ayni kaldi. **Ama kural nettir:** migration dosyalari SQL Editor'da
CALISTIRILMAZ; SQL Editor yalniz salt okunur kontroller (asamaN, on kontrol) icindir. Bir migration dosyasi SQL
Editor'dan uygulanirsa `schema_migrations` kaydi yazilmaz; sonraki `db push` dosyayi yeniden calistirir — idempotan
degilse hata, idempotansa sessiz ikinci kosu. Bu kez zararsiz kaldi; tekrar edilmemeli.

**Kapanis:** FAZ 3a nihai durumu tutarli — sema uygulandi (asama8 uretim), kayit var (`migration list`), git
`9398ba2`. Acik soru kalmadi.
