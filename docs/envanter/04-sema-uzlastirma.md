# Envanter 04 — Sema uzlastirma (repo migration zinciri ↔ uretim)

Kaynak: `supabase/migrations/` (36 dosya). HEAD = `c656fb7`.
**Yalniz okuma** ile uretildi; hicbir kaynak dosya degistirilmedi. **Onarim migration'i YAZILMADI.**

## ⛔ DURUM: KARSILASTIRMA YARIM — uretim dokumu YOK

Gorevde girdi olarak su dort dosya verilmisti:

```
docs/envanter/uretim-dokum/fonksiyonlar.json
docs/envanter/uretim-dokum/tetikleyiciler.json
docs/envanter/uretim-dokum/politikalar.json
docs/envanter/uretim-dokum/indeksler.json
```

**Bu dosyalarin hicbiri yok** — ne git'te ne diskte:

```bash
$ ls docs/envanter/uretim-dokum/
ls: cannot access: No such file or directory

$ git ls-files | grep -iE "uretim|dokum|dump"
(cikti yok)

$ find . -iname "*fonksiyonlar*" -o -iname "*tetikleyiciler*" -o -iname "*politikalar*" -o -iname "*indeksler*"
(cikti yok)
```

Karsilastirmanin **uretim yarisi** elimde olmadigi icin **GRUP B, C ve D uretilemedi.**
Uydurmadim; bunlar bos birakildi ve dokum geldiginde tek komutla doldurulacak sekilde hazirlandi.

**Bu raporda yine de uretilenler:**
- Repo tarafinin **tam** envanteri (fonksiyon/tetikleyici/politika/indeks, `create or replace` zincirleri cozulmus)
- **Kanitli GRUP A alt kumesi** — dokum olmadan da ispatlanabilen "uretimde var, repoda yok" nesneler
- Onarim sirasi ve risk siralamasi
- Dokumu uretecek SQL (bolum 7)

---

## 1. OZET SAYILAR

| Nesne turu | Uretim | Repo | Yalniz uretimde | Yalniz repoda | Farkli | Esit |
|---|---|---|---|---|---|---|
| Fonksiyon | *dokum yok* | **32** (35 tanim) | ≥3 (kanitli) | *hesaplanamadi* | *hesaplanamadi* | *hesaplanamadi* |
| Tetikleyici | *dokum yok* | **28** | ≥1 (kanitli) | *hesaplanamadi* | *hesaplanamadi* | *hesaplanamadi* |
| Politika | *dokum yok* | **108** | ≥7 (belgelenmis) | *hesaplanamadi* | *hesaplanamadi* | *hesaplanamadi* |
| Indeks | *dokum yok* | **67** | *hesaplanamadi* | *hesaplanamadi* | *hesaplanamadi* | *hesaplanamadi* |
| Tablo | *dokum yok* | **22** `CREATE TABLE` | **6** (kanitli) | *hesaplanamadi* | — | — |

### Sayilarin kaniti

```bash
$ git ls-files "supabase/migrations/*.sql" | xargs grep -ic "create or replace function"  # 26
$ git ls-files "supabase/migrations/*.sql" | xargs grep -ic "create function"             #  9
$ git ls-files "supabase/migrations/*.sql" | xargs grep -ic "create trigger"              # 28
$ git ls-files "supabase/migrations/*.sql" | xargs grep -ic "create policy"               # 108
$ git ls-files "supabase/migrations/*.sql" | xargs grep -ic "create index"                # 68
```

Ayristirici ciktisi: fonksiyon **35** (26+9 ✓), tetikleyici **28** ✓, politika **108** ✓, indeks **67**.
Indekste 68 → 67 farki: bir eslesme yorum satiri (`20260713150000_category_attributes_gin.sql:8`,
`-- Idempotent: CREATE INDEX IF NOT EXISTS...`). Gercek indeks sayisi **67**.

### `create or replace` zincirleri — hangi tanim gecerli

35 tanim, **32 benzersiz ad**. Uc fonksiyonun iki surumu var;
migration dosyalari timestamp sirasiyla uygulandigi icin **son tanim gecerlidir**:

| Fonksiyon | Surum | Onceki (gecersiz) | **GECERLI** |
|---|---|---|---|
| `handle_new_user` | 2 | `20260518000000_initial_schema.sql:41` | **`20260520151810_fix_handle_new_user_for_agency.sql:13`** |
| `notify_new_message` | 2 | `20260518000000_initial_schema.sql:88` | **`20260519115516_filter_notify_new_message_by_type.sql:11`** |
| `deal_confirmed_customer_ids` | 2 | `20260711130000_deal_confirmed_customer_ids.sql:26` | **`20260711150000_deal_confirmed_cap.sql:10`** |

---

## 2. GRUP A — repoda olmayan nesneler

Dokum olmadan da **kanitlanabilen** alt kume. Iki kanit yolu kullanildi:

1. **Cagri kaniti:** migration bir nesneyi kullaniyor ve o migration uretimde basariyla
   uygulanmis → nesne uretimde **olmak zorunda**, repoda tanimi yoksa GRUP A.
2. **Belge kaniti:** migration yorumlari drift'i acikca yaziyor.

### 2a. Tablolar — `CREATE TABLE` repoda YOK (6)

| Tablo | Migration'da kullanildigi yer | Uygulama kullanimi | Eksikse ne olur | Sessiz mi |
|---|---|---|---|---|
| `quote_requests` | 20260701120000, 20260703120000, 20260708120000 | 3 dosya | Teklif toplama akisi tamamen calismaz | HAYIR — "relation does not exist" |
| `quote_request_recipients` | 20260701120000, 20260703120000, 20260708120000 | 3 dosya | Teklif alici secimi calismaz | HAYIR — hata verir |
| `listing_invitations` | 20260711120000, 20260712120000 | 3 dosya | Ilana pro davet akisi calismaz | HAYIR — hata verir |
| `service_packages` | 20260625120000, 20260713120000 | 4 dosya | Paketler bolumu calismaz; ayrica 20260625120000 ALTER "relation does not exist" verir | HAYIR — migration kosarken patlar |
| `service_addons` | 20260713120000 | 1 dosya | Hizmet ek secenekleri calismaz | HAYIR — hata verir |
| `availability_blocks` | 20260713120000 | 5 dosya | Musaitlik takvimi calismaz | HAYIR — hata verir |

**Kanit yontemi:** migration'lardaki `CREATE TABLE` adlari ile `ON`/`FROM`/`JOIN`/`INSERT INTO`/
`ALTER TABLE` hedefleri karsilastirildi (yorumlar ayiklandi, takma adlar elendi).
Alti tablonun her biri uygulama kodunda `.from('<tablo>')` ile de kullaniliyor (3-5 dosya) —
yani gercek ve canli.

> ⚠️ **Bu tek basina su demek:** repo migration zinciri **temiz bir veritabaninda kosturulamaz.**
> `20260625120000_add_service_price_unit_and_starting.sql` `ALTER TABLE public.service_packages`
> ile **hata vererek durur**. Migration dosyasinin kendi yorumu bunu zaten yaziyor (satir 36-38).

### 2b. Fonksiyonlar — repoda tanim YOK

| Fonksiyon | Kanit | Nerede kullaniliyor | Eksikse ne olur | Sessiz mi |
|---|---|---|---|---|
| `owns_quote_request(uuid, uuid)` | **Cagri kaniti** — `20260708120000_business_write_pass_create.sql:96` politikasi cagiriyor | `quote_request_recipients` INSERT politikasi | Politika olusturulamaz; migration **hata verir**. Uretimde varsa sorun yok ama repo temsil etmiyor | HAYIR (migration kosarken) |
| `protect_sensitive_profile_fields()` | **Belge kaniti** — `20260711120000_profil_redesign_adim1.sql:20-21` | `profiles` BEFORE UPDATE trigger'i | 🔴 **Alan koruma kalkar.** `profiles` update'lerinde hangi alanlarin korundugu bilinmiyor | **EVET — sessiz.** Koruma yoksa yazma gecer, kimse fark etmez |
| `is_admin()` | Migration yorumlari "drift fonksiyon" diyor (`20260715130000:9`) | RLS'te **kullanilmiyor** (admin kapisi satir ici `EXISTS`) | Repo RLS'i bagimli degil | — (bagimlilik yok) |

**`protect_sensitive_profile_fields()` neden en kritigi:**

- `profiles` uzerinde **BEFORE UPDATE** calisiyor ve hangi alanlari koruduğu **repodan okunamiyor**.
- Migration yazari bu belirsizlik yuzunden `category_attributes`'u whitelist'e eklemekten
  **kacinmis** (`20260711120000_profil_redesign_adim1.sql:26`).
- Uygulama kodu da etkisini biliyor: `app/admin/actions.ts:323` — *"is_published tutmadiysa
  (protect_sensitive_profile_fields trigger'i engellemis olabilir)"* diye **savunma kodu** var.
- Goc `profiles`'i bolecek. Bu trigger'in govdesi bilinmeden `providers`/`organizations`'a
  tasima **guvenli degildir**.

### 2c. Politikalar — repoda olmayan (belgelenmis, ≥7)

| Nesne | Belge | Not |
|---|---|---|
| `listing_invitations` INSERT/SELECT/UPDATE (3 politika) | `20260711120000_business_write_pass_owner.sql:29-39` | Canlidaki halleri yoruma **birebir yazilmis** |
| `quote_requests` + `quote_request_recipients` politikalari | `20260708120000_business_write_pass_create.sql:11-12` | "Dashboard'dan kurulmus" |
| `service_addons` politikasi | `20260713120000_admin_preview_select.sql:50` | "policy migration'da yok" |
| `service_packages` politikasi | `20260713120000_admin_preview_select.sql:59` | "Dashboard'da kurulmus" |
| `availability_blocks` politikasi | `20260713120000_admin_preview_select.sql:77` | "policy migration'da yok" |
| `agency_members` politikasi | `20260713120000_admin_preview_select.sql:86` | "policy migration'da yok" |

> Bu liste **alt sinirdir**. Gercek sayi ancak dokumla bilinir.

### 2d. Repoda zaten yazili 17 drift notu

Migration yazarlari drift'i **belgelemis**. Bu notlar 10 dosyada:

```bash
$ git ls-files "supabase/migrations/*.sql" | xargs grep -niE "drift"   # 17 satir
```

| Dosya:satir | Not |
|---|---|
| `20260625120000_add_service_price_unit_and_starting.sql:33` | `service_packages` tablosu prod'da var, repoda yok |
| `20260625120000_add_service_price_unit_and_starting.sql:38` | "CREATE ayri bir drift-temizleme isidir" |
| `20260625120000_add_service_price_unit_and_starting.sql:44` | Drift referansi — prod semasi yoruma yazilmis |
| `20260629120000_add_quotes_over_budget.sql:7` | `quotes` DRIFT DEGIL (tanimli) |
| `20260701120000_business_member_shared_visibility.sql:7-10` | "fresh DB'de bu dosya tek basina calismaz" |
| `20260708120000_business_write_pass_create.sql:11` | `quote_requests` + `quote_request_recipients` politikalari yok |
| `20260711120000_business_write_pass_owner.sql:29` | `listing_invitations` tablosu yok — canlidaki 3 politika yoruma yazilmis |
| `20260711120000_business_write_pass_owner.sql:112` | "DRIFT tablo — canlidaki hali brief'ten birebir yeniden yaziliyor" |
| `20260711120000_profil_redesign_adim1.sql:21` | `protect_sensitive_profile_fields()` repoda yok |
| `20260712120000_invitation_cancel_and_touches.sql:23` | `listing_invitations` tablosu yok |
| `20260713120000_admin_preview_select.sql:50,59,77,86` | 4 tablonun politikasi migration'da yok |
| `20260715130000_admin_report_stats.sql:9` | `is_admin()` drift fonksiyonuna yeni bagimlilik yok |

**Bu, tesadufi bir birikme degil — bilincli bir calisma bicimi.** `20260711120000_business_write_pass_owner.sql:12`
acikca yaziyor: *"Dashboard'dan manuel apply (db push YOK)"*. Notlar iyi tutulmus; eksik olan
nesnelerin **DDL'inin repoya alinmasi**.

---

## 3. GRUP C — govdesi farkli olanlar

**URETILEMEDI** (dokum yok).

### ⚠️ Dokum geldiginde md5 karsilastirmasi TEK BASINA YANILTIR

Bu, dokumu almadan once bilinmesi gereken bir yontem sorunu:

- Repo tarafinda elimizde **migration kaynak metni** var (yazarin yazdigi bicim).
- Uretim tarafinda `pg_get_functiondef()` **PostgreSQL'in yeniden urettigi normalize metni** doner:
  anahtar kelimeler buyuk harfe cevrilir, bosluklar yeniden duzenlenir, tip adlari genisletilir
  (`uuid` → `uuid`, ama `varchar` → `character varying`), varsayilan degerler acilir.
- Yani **ayni fonksiyonun** iki tarafi neredeyse **her zaman farkli md5** verir.

> Ham md5 karsilastirmasi GRUP C'yi **%100'e yakin yanlis pozitifle** doldurur.

**Dogru yontem — elmayla elma:**
1. Bos bir Postgres'e repo migration zincirini uygula (`supabase db reset` ya da scratch DB).
   *(Not: bolum 2a nedeniyle bu **su an basarisiz olur** — once 6 tablonun DDL'i gerekir.)*
2. Ayni dokum sorgusunu **o veritabaninda** kosturup ikinci bir dokum al.
3. Iki dokumu karsilastir. Her iki taraf da `pg_get_functiondef()` ciktisi oldugu icin
   md5 farki **gercek davranis farki** demektir.

Bu yol acilana kadar C grubu icin yapilabilecek en iyi sey: **ad bazli eslesme** kurup
govde karsilastirmasini "tam govde cekilmeli" diye isaretlemek.

**Tam govdesi oncelikle cekilmesi gerekenler** (davranis kritik, ad eslesse bile guvenilmez):

| Nesne | Neden |
|---|---|
| `protect_sensitive_profile_fields()` | Repoda hic yok; govdesi bilinmeden `profiles` bolunemez |
| `owns_quote_request()` | Repoda hic yok; canli politika bagimli |
| `handle_new_user()` | Iki surumlu; uretimde hangisi var? Kayit akisinin tamami buna bagli |
| `notify_new_message()` | Iki surumlu; bildirim davranisi surume gore degisir |
| `deal_confirmed_customer_ids()` | Iki surumlu; ikinci surum "cap" ekliyor |
| `has_business_role()`, `is_business_member()` | 26 politika bunlara bagli; govde farki tum yetkiyi kaydirir |
| `on_quote_accepted_create_booking()` | Rezervasyon uretiyor; sessiz bozulma riski en yuksek (bkz. `03-tetikleyici-agaci.md`) |

---

## 4. GRUP B — uretimde olmayan repo nesneleri

**URETILEMEDI** (dokum yok).

Dokum geldiginde bu grubun **muhtemelen kucuk** cikmasi beklenir, cunku calisma bicimi
"once Dashboard'a uygula, sonra migration dosyasina yaz" seklinde. Yine de iki aday sinif var:

| Aday | Neden uretimde olmayabilir |
|---|---|
| `DROP POLICY` sonrasi yeniden olusturulmayan politikalar | Repoda **49 `DROP POLICY`** var; hepsinin karsiliginda `CREATE` var mi dokumsuz dogrulanamaz |
| `DROP TRIGGER` edilenler | Repoda **6 `DROP TRIGGER`** |
| Eski surum fonksiyonlar | `create or replace` zincirinde ezilen 3 onceki surum uretimde yok (dogal) |

---

## 5. ONARIM SIRASI ONERISI

**Onarim migration'i bu adimda YAZILMADI.** Asagidaki yalniz sira onerisidir.

Bagimlilik zinciri: tablo → indeks → fonksiyon → politika → tetikleyici.
Bir politika bagimli oldugu fonksiyon ve tablo olmadan olusturulamaz.

| Sira | Ne | Neden bu sirada |
|---|---|---|
| 1 | **Uretim dokumunu al** (bolum 7) | Digerlerinin hicbiri dokumsuz dogrulanamaz |
| 2 | `protect_sensitive_profile_fields()` govdesini cek | Tek basina bir adim: govde bilinmeden `profiles` gocu planlanamaz. Yazma DEGIL, **okuma** adimi |
| 3 | 6 tablonun DDL'i (`quote_requests`, `quote_request_recipients`, `listing_invitations`, `service_packages`, `service_addons`, `availability_blocks`) | Fonksiyon ve politikalar bunlara bagli. Bu adim bitmeden migration zinciri temiz DB'de kosmaz |
| 4 | Bu tablolarin indeksleri | Politikalardan once; performans degil, `UNIQUE` kisitlari politika mantigini etkileyebilir |
| 5 | `owns_quote_request()` fonksiyonu | `quote_request_recipients` INSERT politikasi buna bagli (adim 6'dan once olmali) |
| 6 | Eksik politikalar (≥7, bkz. 2c) | Tablo + fonksiyon hazir olduktan sonra |
| 7 | `protect_sensitive_profile_fields()` ve tetikleyicisi | En sona: `profiles` uzerinde yazma kapisi; once digerlerinin dogru oldugundan emin ol |
| 8 | Zincir dogrulamasi | Temiz DB'ye uygula, ikinci dokum al, uretim dokumu ile karsilastir (bolum 3'teki elmayla-elma yontemi) |

> **Adim 3 kritik esik:** o bitmeden `supabase db reset` calismaz, dolayisiyla adim 8'deki
> dogrulama da yapilamaz. Onarim buradan baslamali.

---

## 6. RISK SIRALAMASI — sessiz bozulanlar en uste

| # | Nesne | Tur | Bozulma bicimi | Neden bu sirada |
|---|---|---|---|---|
| 1 | `protect_sensitive_profile_fields()` | Fonksiyon + trigger | 🔴 **SESSIZ** | `profiles` BEFORE UPDATE; govdesi bilinmiyor. Kalkarsa korunan alanlar yazilabilir hale gelir ve **hicbir hata olusmaz**. Uygulama kodunda savunma yorumu var (`app/admin/actions.ts:323`) — yani etkisi zaten gozlenmis |
| 2 | `on_quote_accepted_create_booking()` | Trigger fn | 🔴 **SESSIZ** | `bookings`'e yaziyor, **sifir `RAISE EXCEPTION`**. Tasinmazsa teklif kabul edilir, rezervasyon olusmaz (bkz. `03-tetikleyici-agaci.md` bolum 5) |
| 3 | 12 bildirim fonksiyonu | Trigger fn | 🔴 **SESSIZ** | Hicbirinde `RAISE EXCEPTION` yok. Kaybi yalnizca kullanici sikayetiyle anlasilir |
| 4 | `has_business_role()` / `is_business_member()` govde farki | Fonksiyon | 🟠 **SESSIZ-YETKI** | 26 politika bunlara bagli. Govde farkliysa yetki **gevser veya daralir**; ikisi de hata vermez. Fazla yetki felakettir, az yetki sikayet uretir |
| 5 | `owns_quote_request()` | Fonksiyon | 🟡 GURULTULU | Yoksa politika olusturulamaz, migration **hata verir**. Uretimde var oldugu icin bugun sorun yok |
| 6 | 6 eksik tablo | Tablo | 🟡 GURULTULU | `relation does not exist` — hemen fark edilir |
| 7 | Eksik politikalar (≥7) | Politika | 🟠 **KARISIK** | Politika yoksa RLS **varsayilan olarak reddeder** → gurultulu. Ama politika **fazla genisse** sessizce veri sizdirir. Dokumsuz hangisi oldugu bilinmiyor |

**Genel kural:** `RAISE EXCEPTION` icermeyen fonksiyonlar ve bildirim tetikleyicileri
sessiz gruptadir. Repo tarafinda **32 fonksiyondan yalniz 5 tanesinde** `RAISE EXCEPTION` var:
`validate_agency_membership_roles` (2) · `on_agency_invitation_accepted_add_member` (2) · `validate_business_membership_roles` (1) · `on_business_invitation_accepted_add_member` (1) · `admin_report_stats` (1)

---

## 7. DOKUMU URETEN SQL (Guven — Dashboard SQL Editor)

Asagidaki dort sorgu, gorevde beklenen dort dosyayi uretir. Her biri **tek sutun JSON** dondurur;
ciktiyi ilgili dosyaya kaydet. Sorgular yalniz **okuma** yapar.

### 7a. `fonksiyonlar.json`

```sql
select jsonb_agg(jsonb_build_object(
  'ad',        p.proname,
  'argumanlar', pg_get_function_identity_arguments(p.oid),
  'donus',     pg_get_function_result(p.oid),
  'secdef',    p.prosecdef,
  'tanim',     pg_get_functiondef(p.oid),
  'md5',       md5(pg_get_functiondef(p.oid))
) order by p.proname)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';
```

### 7b. `tetikleyiciler.json`

```sql
select jsonb_agg(jsonb_build_object(
  'ad',     t.tgname,
  'tablo',  c.relname,
  'fonksiyon', p.proname,
  'tanim',  pg_get_triggerdef(t.oid),
  'md5',    md5(pg_get_triggerdef(t.oid))
) order by c.relname, t.tgname)
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'public' and not t.tgisinternal;
```

### 7c. `politikalar.json`

```sql
select jsonb_agg(jsonb_build_object(
  'ad', policyname, 'tablo', tablename, 'komut', cmd, 'roller', roles,
  'using', qual, 'withcheck', with_check,
  'md5', md5(coalesce(qual,'') || '|' || coalesce(with_check,''))
) order by tablename, policyname)
from pg_policies
where schemaname = 'public';
```

### 7d. `indeksler.json`

```sql
select jsonb_agg(jsonb_build_object(
  'ad', indexname, 'tablo', tablename,
  'tanim', indexdef, 'md5', md5(indexdef)
) order by tablename, indexname)
from pg_indexes
where schemaname = 'public';
```

### 7e. Ek — tablo listesi (bolum 2a'yi dogrulamak icin)

```sql
select jsonb_agg(tablename order by tablename)
from pg_tables where schemaname = 'public';
```

### 7f. Ek — `protect_sensitive_profile_fields()` tam govdesi (adim 2)

```sql
select pg_get_functiondef(oid)
from pg_proc
where proname = 'protect_sensitive_profile_fields';
```

Bu sonuncusu **oncelikli**: risk siralamasinin 1. sirasindaki nesne ve tek basina bir karar girdisi.

---

## 8. YONTEM VE SINIRLAR

- Repo tarafi dengeli-parantez ve `$$` govde ayristiricisiyla cikarildi; sayilar ham `grep -ic`
  ciktilariyla dogrulandi (fonksiyon 35, tetikleyici 28, politika 108; indeks 68 grep → 67 gercek).
- `create or replace` zincirleri migration timestamp sirasina gore cozuldu; **son tanim gecerli** sayildi.
- GRUP A'nin **tamami degil, kanitlanabilir alt kumesi** verildi. Gercek A grubu dokumla buyuyebilir.
- GRUP B, C ve D **uretilmedi** — uretim dokumu yok. Uydurma yapilmadi.
- "Cagri kaniti" su varsayima dayanir: migration'lar uretimde basariyla uygulanmis.
  Calisma kisiti bunu soyluyor (Dashboard'dan elle apply). Uygulanmamis bir migration varsa
  o dosyanin cagri kaniti gecersizdir — **dokumla dogrulanmali**.
- Tablo karsilastirmasinda takma adlar (`p`, `bm`, `r`) ve SQL anahtar kelimeleri elendi;
  kalan 6 tablonun her biri uygulama kodunda `.from()` ile kullanildigi dogrulanarak teyit edildi.
