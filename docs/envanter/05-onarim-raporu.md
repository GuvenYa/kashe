# 05 — FAZ -1 Onarim Migration'i

> **UYGULANACAK MIGRATION'LAR (8 dosya, HENUZ KOSMADI):**
>
> | # | Dosya | Ne yapar |
> |---|---|---|
> | 00 | `20260620085000_faz_minus1_00_eksik_sutunlar.sql` | 2 enum, 37 sutun, 5 kisit |
> | 01 | `20260620090000_faz_minus1_01_eksik_tablolar.sql` | 3 enum, 13 tablo, 117 sutun, 53 kisit |
> | 02 | `20260620090100_faz_minus1_02_is_admin.sql` | `is_admin()` |
> | 03 | `20260620090200_faz_minus1_03_yetki_fonksiyonlari.sql` | 3 yetki fonksiyonu |
> | 04 | `20260620090300_faz_minus1_04_tetikleyici_fonksiyonlari.sql` | 36 fonksiyon |
> | 05 | `20260620090400_faz_minus1_05_tetikleyiciler.sql` | 6 tetikleyici |
> | 06 | `20260620090500_faz_minus1_06_politikalar.sql` | 56 RLS politikasi |
> | 07 | `20260620090600_faz_minus1_07_indeksler.sql` | 33 indeks |
>
> **Dosyalar olusturuldu, UYGULANMADI.** Supabase Dashboard > SQL Editor'den elle kosturulacak.
>
> **Acik kalem yok.** Uc dokum turu de alindi (sutun, kisit, enum); dosyalarda
> tahmin edilmis tek bir deger yoktur.

Kaynak: `04-sema-uzlastirma.md` (Grup A/B/C/D ayrimi) ve `uretim-dokum/*.csv` (uretim dokumu).
Bu rapor **ne yazildigini, neyin yazilmadigini ve nedenini** anlatir.

---

## 0. Ozet

Repo migration zinciri temiz bir veritabaninda kosturulunca iki yerde duruyordu:

1. `20260620090100_faz_minus1_02_is_admin.sql` -> `column "is_admin" does not exist`
2. `20260625120000_add_service_price_unit_and_starting.sql` -> var olmayan
   `service_packages` tablosunu `ALTER` ediyor

Bu sekiz dosya o bosluklari kapatir.

| Nesne | Eksik | Yazildi | Nerede |
|---|---|---|---|
| Enum tipi | 5 | 5 | 00 (2) + 01 (3) |
| Tablo | 13 | 13 | 01 |
| Sutun (mevcut tablolarda) | 37 | 37 | 00 |
| Kisit | 58 | 58 | 00 (5) + 01 (53) |
| Fonksiyon | 39 | 39 | 02 (1) + 03 (3) + 04 (35) |
| Tetikleyici | 6 | 6 | 05 |
| Politika | 56 | 56 | 06 |
| Indeks | 33 | 33 | 07 |
| *(Grup D istisnasi)* | — | `handle_updated_at` | 04 |

Grup A'da yazilmayan nesne **yok**.

Tum dosyalar yalniz **DDL** icerir. Hicbir `INSERT`, `UPDATE` veya `DELETE` yoktur.

---

## 1. Dosya dosya ozet

### 00 — Mevcut tablolarin eksik sutunlari (37 sutun, 5 kisit, 2 enum)

`04-sema-uzlastirma.md`'de **gorulmeyen** bir bosluk kategorisi: eksik olan tablo,
fonksiyon, politika ya da indeks degil — **var olan bir tablonun sonradan eklenmis
sutunlari**. Ayrinti ve nasil bulundugu: bolum 3.6.

8 tablo: `profiles` (13), `listings` (8), `conversations` (4), `applications` (3),
`bookings` (3), `messages` (3), `service_categories` (2), `notifications` (1).

Iki enum tipi burada olusur: `profile_approval_status`, `premium_tier`.

Bes kisit sutunlarla birlikte gelir, cunku sutunlar olmadan kurulamazlar:
`profiles_suspended_by_fkey`, `bookings_cancelled_by_fkey`,
`default_allowed_roles_valid`, `allowed_roles_valid`,
`conversations_request_type_check`.

`ADD COLUMN IF NOT EXISTS` ile idempotan. `NOT NULL` olan her sutunun **varsayilani
vardir**; dolu tabloda da guvenle eklenir — jenerator bunu ayrica denetler ve
varsayilansiz bir `NOT NULL` sutun gorurse dosyayi yazmadan durur.

`ADD CONSTRAINT`in `IF NOT EXISTS` bicimi PostgreSQL'de yoktur; idempotanlik
`pg_constraint` kontroluyle saglanir.

### 01 — Eksik tablolar (13 tablo, 117 sutun, 53 kisit, 3 enum)

`service_packages`, `service_addons`, `availability_blocks`, `blog_posts`,
`category_requests`, `admin_audit_log`, `message_violations`, `push_subscriptions`,
`conversation_assignees`, `reports`, `quote_requests`, `quote_request_recipients`,
`listing_invitations`

**Sira gerekcesi.** `service_packages` en once: `20260625120000` onu `ALTER` ediyor.
`quote_requests`, `quote_request_recipients`'ten once (yabanci anahtar yonu).

**Sutunlar** `eksik-tablo-sutunlari.csv`'den birebir. `tum-sutunlar.csv` ile
dogrulandi: 13 tabloda tip/null/default farki **sifir**.

**Kisitlar** `tum-kisitlar.csv`'den (`pg_constraint` dokumu) birebir:
13 `PRIMARY KEY`, 5 `UNIQUE`, 27 `FOREIGN KEY`, 7 `CHECK`, 1 `EXCLUDE`.

> Onceki surumde kisitlar indeks **adlarindan turetilmisti** ve yabanci anahtar
> hic yoktu. Kisit dokumu gelince tamami gercek tanimlarla degistirildi.

Uc enum tipi burada olusur: `listing_invitation_status`, `quote_recipient_status`,
`quote_request_status`.

`CREATE TABLE IF NOT EXISTS` ile idempotan.

### 02 — `is_admin()` (1 fonksiyon)

Tek basina bir dosya, cunku **bagimlilik zincirinin kokunde**:

```
profiles.is_admin  ->  is_admin()  ->  protect_sensitive_profile_fields()  ->  protect_profile_fields
     (00)               (02)                      (04)                              (05)
```

`is_admin()` govdesi `select is_admin from public.profiles` yapar; sutun 00'da
olusur. `protect_sensitive_profile_fields` govdesinin ilk satiri
`if public.is_admin(auth.uid()) then return new; end if;` oldugu icin `is_admin`
04'ten ve 05'ten **once** olusmalidir.

### 03 — Kalan yetki fonksiyonlari (3)

`is_assignee`, `is_professional_or_agency`, `owns_quote_request`

Ucu de `LANGUAGE sql`, `STABLE SECURITY DEFINER`, `SET search_path TO 'public'`.
Govdeler `fonksiyon-govdeleri-*.csv`'den (`pg_get_functiondef` ciktisi) birebir.

### 04 — Tetikleyici fonksiyonlari (36)

35 Grup A fonksiyonu + `handle_updated_at` (Grup D istisnasi, bkz. bolum 3.3).

Bir govde CSV'de yoktu: **`protect_sensitive_profile_fields`**. Govdesi
`docs/architecture/04-goc-plani.md` FAZ -1 bolumunden alindi (uretimden cekilip oraya
islenmisti). Yedi alani koruyan kara liste: `is_admin`, `role`, `approval_status`,
`approved_at`, `suspended_at`, `suspension_reason`, `suspended_by` — **alti 00'da
olusan sutunlardir**, yalniz `role` repoda vardi.

Diger 35 govde `pg_get_functiondef` ciktisindan birebir.

### 05 — Tetikleyiciler (6)

| Tetikleyici | Tablo | Zamanlama |
|---|---|---|
| `trg_remove_assignments_on_leave` | `agency_members` | `AFTER DELETE` |
| `trg_blog_posts_updated_at` | `blog_posts` | `BEFORE UPDATE` |
| `trg_assignee_added` | `conversation_assignees` | `AFTER INSERT` |
| `trg_assignee_removed` | `conversation_assignees` | `AFTER DELETE` |
| `protect_profile_fields` | `profiles` | `BEFORE UPDATE` |
| `set_packages_updated_at` | `service_packages` | `BEFORE UPDATE` |

`CREATE TRIGGER IF NOT EXISTS` PostgreSQL'de yoktur; idempotanlik
`DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` ile saglanir.

### 06 — RLS politikalari (56)

`politika-ifadeleri-*.csv` (`pg_policies` dokumu) ciktisindan birebir.

| Komut | Adet |
|---|---|
| `SELECT` | 25 |
| `INSERT` | 13 |
| `UPDATE` | 11 |
| `DELETE` | 7 |

**`WITH CHECK` kurali.** 22 politikada `WITH CHECK` var (13 `INSERT` + 9 `UPDATE`),
34 politikada **yok** ve **bilincli olarak yazilmadi**. Dokumde `with_check` bos olan bir
politikaya bos bir `WITH CHECK` eklemek davranisi degistirirdi: PostgreSQL, `UPDATE`'te
`WITH CHECK` verilmemisse `USING` ifadesini dogrulama icin kullanir.

En cok politika alan tablolar: `service_packages`, `reports`, `blog_posts` (5'er).

`DROP POLICY IF EXISTS` + `CREATE POLICY` ile idempotan.

### 07 — Indeksler (33)

`pg_indexes.indexdef` ciktisindan birebir. 2 tanesi `UNIQUE`.

**Yazilmayanlar:**

- 35 `*_pkey` ve 18 `*_key` — kisit indeksleri; dosya 00 ve 01'deki
  `PRIMARY KEY` / `UNIQUE` ifadeleriyle kendiliginden olusur.
- 4 adet kisit destek indeksi — bkz. bolum 3.7. Bu, **sessiz gevseme** riskiydi.

**Mukerrer indeksler silinmedi.** `04-sema-uzlastirma.md` bolum 5'te 9 gereksiz cift
tespit edildi, ama silme karari `pg_stat_user_indexes` olcumune baglidir ve **ayri bir
adimdir**. Bu dosya yalniz eksikleri ekler.

---

## 2. Dokunulmayan nesneler (Grup D) ve gerekcesi

**Kural 4: mevcut nesneye dokunma.** Iki tarafta da var olan nesneler yeniden yazilmadi.
`CREATE OR REPLACE` ile "zararsizca" hizalamak bile riskli olurdu: dokum ciktisi
`pg_get_functiondef`'ten gelir ve Postgres tanimlari yeniden render eder
(`public.` ekler, `USING btree` yazar, tip cast'i ve parantez ekler). Bu farklar
**anlamsal degil, bicimseldir** — ama koru koruna uygulamak gercek bir farki gizleyebilirdi.

| Nesne turu | Ne yapildi |
|---|---|
| Fonksiyon | Dokunulmadi (1 istisna: `handle_updated_at`) |
| Tetikleyici | Dokunulmadi — `04` bolum 4'te 27 ortak tetikleyicinin tamami anlamsal olarak esit bulundu |
| Indeks | Dokunulmadi — `04` bolum 5'te 67 ortak indeksin tamami esit bulundu |
| Politika | Dokunulmadi |
| Kisit | Dokunulmadi — bkz. bolum 3.8 (24 CHECK yanlis pozitifti) |

Dosya basliklarinda acikca atlandigi belirtilen ornekler:

- **03'te:** `has_business_role`, `is_business_member`, `has_business_role_on_request`,
  `is_business_member_of_request` — dordu de repoda tanimli.
- **05'te:** `messages_update_conversation` — **repoda var, uretimde yok** (Grup B).
  `04-sema-uzlastirma.md` bolum 3'te olu kod olarak isaretlendi; uretimde yalniz
  `on_message_insert_update_conversation` calisiyor. Silme karari bu dosyanin isi degil.

---

## 3. Karar noktalari

### 3.1 Bes enum tipi — degerler uretimden alindi

Bes enum tipi repo migration zincirinde tanimli degildi ve **degerleri hicbir CSV
dokumunde yoktu**; `information_schema.columns` enum etiketlerini icermez. Degerler
`pg_enum`'dan (`enumsortorder` sirasiyla) cekilip ilgili dosyaya islendi.

| Tip | Degerler | Dosya |
|---|---|---|
| `listing_invitation_status` | `pending`, `accepted`, `declined`, `expired`, `cancelled` | 01 |
| `quote_recipient_status` | `sent`, `viewed`, `quoted`, `declined` | 01 |
| `quote_request_status` | `active`, `closed`, `expired`, `fulfilled` | 01 |
| `profile_approval_status` | `draft`, `pending`, `approved`, `rejected`, `revision` | 00 |
| `premium_tier` | `none`, `premium`, `plus`, `agency` | 00 |

**Sira alfabetik degil.** `premium_tier` kademe sirasiyla yazilidir. Uygulama
kodundan cikarilan degerler dogruydu ama **sirayi gostermiyordu**; kod taramasi
enum uyeligi icin yeterli bir kaynak degildir. Ilk uc tipte kodda hic gecmeyen
degerler de vardi (`expired`, `closed`, `fulfilled`).

Idempotanlik icin repo idyomu kullanildi (`20260630120000` dosyasindaki kalip):
`DO $$ BEGIN CREATE TYPE ...; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
— `CREATE TYPE IF NOT EXISTS` PostgreSQL'de yoktur.

**Dogrulama.** Bes tipin de varsayilan degeri (`pending` / `sent` / `active` /
`pending` / `none`) kendi listesinde bulunuyor. Tum migration'lar ve dokum CSV'leri
tarandi; bu bes tipe cast edilen literal **yalniz** o bes varsayilan.

### 3.2 Kisitlar — dokum alindi, KAPANDI

Ilk surumde kisit dokumu yoktu; `PRIMARY KEY` ve `UNIQUE` indeks ad kuralindan
(`*_pkey`, `*_key`) turetilmis, yabanci anahtarlar ise **hic yazilmamisti**.

`tum-kisitlar.csv` (183 kisit) gelince:

- **13 yeni tablonun 53 kisiti** dosya 01'e birebir islendi. Turetim kaldirildi.
- **5 kisit** dosya 00'a girdi (eksik sutunlara bagli olanlar).
- **Kalan 125 kisit** repo zincirinde zaten uretiliyor — bkz. bolum 3.8.

### 3.3 `handle_updated_at` — kural 4'un tek bilincli istisnasi

Bu fonksiyon Grup D'dedir (iki tarafta da var), ama **tek bilinen govde farki ondadir**:

| | `SECURITY DEFINER` |
|---|---|
| Uretim | `false` |
| Repo | `true` |

**Kural 2 (catismada uretim kazanir)** kural 4'u (mevcut nesneye dokunma) bastirir.
Uretim surumu — yani `SECURITY DEFINER` **olmayan** hali — `CREATE OR REPLACE` ile yazildi.

Yan etkisi: zincir kosturuldugunda repo surumundeki `SECURITY DEFINER` kaldirilir ve
fonksiyon cagiranin yetkisiyle calisir. Bu fonksiyon yalnizca `new.updated_at := now()`
atadigi icin yetki dusurmek dogru yondur.

### 3.4 Zaman damgasi penceresi — hesaplandi, secilmedi

Damgalar keyfi degil. Iki sinir var:

```
UST SINIR   20260625120000   service_packages'i ALTER ediyor -> tablo ONCE olmali
ALT SINIR   20260520151810   son mevcut migration; etkilenen tablolarin en genci
                             agency_members (20260520071330), hepsi bundan once
```

Dosyalarin kendi aralarindaki bagimliligi:

| Dosya | Bagimli oldugu | Nesne |
|---|---|---|
| 00 | (yok) | mevcut tablolar, hepsi `20260520071330`'dan eski |
| 01 | (yok) | — |
| 02 | 00 | `profiles.is_admin` |
| 03 | 01 | `quote_requests` |
| 04 | 00, 01, 02 | `is_admin()`, korunan sutunlar |
| 05 | 01, 04 | `protect_sensitive_profile_fields()` |
| 06 | 00, 01, 02, 03 | yetki fonksiyonlari, sutunlar |
| 07 | 00, 01 | indekslenen sutunlar ve tablolar |

Gecerli pencere `20260520151810 < TS < 20260625120000`; `2026062008-09xxxx` secildi.

Zincirdeki nihai yer:

```
20260520151810_fix_handle_new_user_for_agency.sql
20260620085000_faz_minus1_00_eksik_sutunlar.sql          <- yeni
20260620090000_faz_minus1_01_eksik_tablolar.sql          <- yeni
...
20260620090600_faz_minus1_07_indeksler.sql               <- yeni
20260625120000_add_service_price_unit_and_starting.sql   <- artik service_packages'i buluyor
```

### 3.5 Neden sekiz dosya, tek dosya degil

Biri hata verirse **nerede durdugu belli olur** ve tek dosya geri alinabilir. Her dosya
kendi `BEGIN; ... COMMIT;` blogundadir; bir dosya kismen uygulanmis halde kalmaz.

### 3.6 Eksik sutunlar nasil bulundu — ve dokum nasil dogrulanir

Zincir `02`'de `column "is_admin" does not exist` ile durdu. `is_admin()` govdesi
`profiles.is_admin` okuyor, ama repo zinciri o sutunu **hic olusturmuyor**.

**Ilk sutun dokumu uretim degil, repo ciktisiydi.** Uc bagimsiz kanit:

- `business_invitations` uretim dokumlerinde 7 indeks, 4 politika ve 2 tetikleyiciye
  sahipti; sutun dokumunde **sifir satiri** vardi. Uretimde bir tablonun indeksi olup
  sutunu olamaz.
- Zincir `20260625120000` oncesine kadar simule edilip dokumle karsilastirildi:
  iki yonde de fark **sifir** (12 satir haric — `professional_rating_summary` ve
  `profile_completeness` **VIEW**'lari; `information_schema.columns` view sutunlarini
  da listeler). Sifir fark tesadufi degildir.
- `is_admin` uygulama kodunda **2026-05-24**'ten beri var; dokumun kesme noktasi
  `20260625120000`. Uretim dokumu olsaydi icermeliydi.

**Dokum kontrolu.** Sutun dokumu alinirken `table_type = 'BASE TABLE'` suzgeci
kullanilmalidir (view sutunlarini disarida birakir) ve cikti `profiles.is_admin`
satirini **icermelidir**. Icermiyorsa yanlis veritabanina baglanilmistir.

```sql
select c.table_name, c.ordinal_position, c.column_name,
       c.data_type, c.udt_name, c.is_nullable, c.column_default,
       c.character_maximum_length, c.numeric_precision, c.numeric_scale
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
 where c.table_schema = 'public'
   and t.table_type = 'BASE TABLE'
 order by c.table_name, c.ordinal_position;
```

**Dolayli cikarim yetmedi.** Dogru dokum gelmeden once eksik sutunlar uretim
eserlerinden (indeks tanimlari, politika ifadeleri, fonksiyon govdeleri) ve uygulama
kodundan cikarilmis, **32 aday** bulunmustu. Gercek sayi **37**. Kacan bes sutun —
`listings.notified_at`, `profiles.kvkk_approved_at`, `profiles.views_count`,
`service_categories.description`, `service_categories.seo_title` — hicbir indekste,
politikada, fonksiyonda ya da sorgu cagrisinda gecmiyordu. **Referansi olmayan sutun
dolayli yontemle gorunmez.**

### 3.7 Kisit destek indeksleri — sessiz gevseme onlendi

`pg_indexes`, kisitlarin arkasindaki indeksleri de listeler. Ilk analizde "37 eksik
indeks" sayilmisti; kisit dokumu gelince bunlarin **4 tanesinin aslinda kisit oldugu**
ortaya cikti:

| Nesne | Gercekte | Durum |
|---|---|---|
| `no_duplicate_pending_invitation` | `EXCLUDE` | repoda **zaten var** |
| `no_duplicate_pending_business_invitation` | `EXCLUDE` | repoda **zaten var** |
| `conversations_unique_pair` | `UNIQUE` | repoda **zaten var** |
| `no_duplicate_pending_listing_invite` | `EXCLUDE` | dosya **01**'e alindi |

Bunlari `CREATE INDEX` olarak yazmak kisiti kurmaz, **yalniz indeksi** kurar:
tekillik ve dislama kurallari sessizce kaybolurdu. Derleme hatasi vermez, testte
gorunmez — ancak mukerrer kayit olustugunda anlasilirdi.

Gercek eksik indeks sayisi **37 degil 33**. Bu duzeltme ayrica bir dosyayi tamamen
gereksiz kildi: sekizinci bir dosya yalnizca `no_duplicate_pending_business_invitation`
icin olusturulmustu (o indeks `business_invitations` tablosunun dogumundan sonraya
konmak zorundaydi), o da repoda zaten var oldugu icin silindi.

### 3.8 24 CHECK kisiti — yanlis pozitifti

Kisit dokumu ilk incelendiginde mevcut 22 tabloda **29 kisit eksik** gorunuyordu
(27 `CHECK` + 2 `FOREIGN KEY`). Ad bazli karsilastirma yaniltti: repo bu kisitlari
**satir ici ve adsiz** yaziyor, adi Postgres kendi uretiyor.

Yirmi dordunun her biri tek tek dogrulandi; **kesin eksik: 0**. Ornekler:

| Uretim (`pg_get_constraintdef`) | Repo (kaynak metin) |
|---|---|
| `CHECK ((rating >= 1) AND (rating <= 5))` | `CHECK (rating BETWEEN 1 AND 5)` |
| `CHECK (currency = 'TRY'::text)` | `CHECK (currency IN ('TRY'))` |
| `CHECK (kind = ANY (ARRAY['work'::text, ...]))` | `CHECK (kind IN ('work', 'education', 'award'))` |

Bu, `04-sema-uzlastirma.md` bolum 5'te olculen **yeniden render** olayinin aynisidir:
Postgres tanimi normalize eder, kaynak metinle karsilastirma yanlis pozitif uretir.

Geriye kalan 5 kisit gercekten eksikti ve dosya 00'a girdi — besi de **repoda hic
olmayan sutunlara** ait, dolayisiyla var olamazlardi.

---

## 4. Uygulama sirasi

**Supabase Dashboard > SQL Editor.** SQL terminale yapistirilmaz (PowerShell `<` karakterini
dusuruyor). Her dosya **kendi calistirmasinda**, sirayla:

| Sira | Dosya | On kosul |
|---|---|---|
| 1 | 00 eksik sutunlar | — |
| 2 | 01 eksik tablolar | — |
| 3 | 02 is_admin | 00 (`profiles.is_admin`) |
| 4 | 03 yetki fonksiyonlari | 01 (`quote_requests`) |
| 5 | 04 tetikleyici fonksiyonlari | 00, 01, 02 |
| 6 | 05 tetikleyiciler | 01, 04 |
| 7 | 06 politikalar | 00, 01, 02, 03 |
| 8 | 07 indeksler | 00, 01 |

**Uretimde uygulama notu.** Bu nesneler uretimde **zaten var**. Dosyalar idempotan
(`IF NOT EXISTS`, `DROP ... IF EXISTS` + `CREATE`, `pg_constraint` kontrolu), yani
uretimde kosturulunca islevsel etkisi olmamalidir. Ama gercek amac uretimi degistirmek
degil, **repo zincirini uretime esitlemektir**; dogru dogrulama ortami **bos bir
veritabanidir** (bolum 5).

Bir dosya hata verirse: o dosya tamamen geri alinir (kendi islemi icinde), hata mesaji
kaydedilir, sonraki dosyalara **gecilmez**.

---

## 5. Dogrulama adimlari

### 5.1 Zincir bastan sona kosuyor mu

Bos bir veritabaninda tum zinciri kostur. Basari olcusu: **hicbir migration hata vermez**.
Ozellikle `02` artik `profiles.is_admin`i, `20260625120000` ise `service_packages`i
bulmalidir.

### 5.2 Sema uretimle esit mi

Zincir bittikten sonra ayni dokumleri **yeni veritabanindan** al ve
`uretim-dokum/*.csv` ile karsilastir:

```sql
select 'tablo' as nesne, count(*) from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE'
union all select 'sutun', count(*) from information_schema.columns c
   join information_schema.tables t
     on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
union all select 'kisit', count(*) from pg_constraint
   where connamespace = 'public'::regnamespace and contype in ('f','p','u','c','x')
union all select 'fonksiyon', count(*) from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
union all select 'tetikleyici', count(*) from pg_trigger where not tgisinternal
union all select 'politika',    count(*) from pg_policies where schemaname = 'public'
union all select 'indeks',      count(*) from pg_indexes  where schemaname = 'public';
```

**Beklenen** (uretim dokumundeki sayilar):

| Nesne | Uretim |
|---|---|
| Tablo | 35 |
| Sutun | 373 |
| Kisit | 183 |
| Fonksiyon | 69 |
| Tetikleyici | 33 |
| Politika | 148 |
| Indeks | 157 |

> Tetikleyici icin not: 05'te `messages_update_conversation` **yazilmadi** (Grup B, repoda
> var uretimde yok). Repo zinciri onu kendi migration'inda hala olusturuyor. Bu yuzden
> yeni veritabaninda tetikleyici sayisi **34** cikar, 33 degil. Fark budur ve beklenendir;
> o tetikleyicinin silinmesi ayri bir karardir.

### 5.3 Karsilastirmada md5 KULLANMA

`04-sema-uzlastirma.md` bolum 5'te olculdu, bolum 3.8'de tekrar dogrulandi:
`pg_get_functiondef`, `pg_get_constraintdef` ve `pg_indexes.indexdef` ciktilari
Postgres tarafindan **yeniden render edilir** (`public.` on eki, `USING btree`,
tip cast'i, parantez, `BETWEEN` -> `>= AND <=`, `IN` -> `= ANY (ARRAY[...])`).
Migration kaynak metninin md5'i ile uretim ciktisinin md5'i karsilastirilirsa
**neredeyse %100 yanlis pozitif** cikar — indekslerde 67/67 ham fark elde edilmisti,
elle bakinca gercek fark **0** idi; kisitlarda 24/24 ayni sekilde.

Dogru yontem: **iki tarafta da `pg_*` ciktisini al**, sonra karsilastir. Yani yeni
veritabanindan alinan dokumu `uretim-dokum/*.csv` ile karsilastir; migration
dosyasinin metniyle degil.

### 5.4 Uygulama sonrasi uretim dumani kontrolu

Dosyalar uretimde kosturulursa, sonrasinda 5.2'deki yedi sayi **degismemelidir**.
Degistiyse idempotanlik varsayimlarindan biri tutmamis demektir; hangi dosyanin
sayiyi degistirdigi tespit edilmelidir.

---

## 6. Sonraki adim

Bu dosyalar **FAZ -1'in son adimidir** ve **acik kalemi yoktur**. Uc dokum turu de
alindi (sutun, kisit, enum); dosyalarda tahmin edilmis tek bir deger yoktur.

FAZ 0'a gecmeden once yalnizca **bolum 5'teki dogrulama** yapilmalidir: bos bir
veritabaninda zincirin bastan sona kosmasi ve yedi sayinin tutmasi.

`04-goc-plani.md`'de FAZ 2 on kosulu olarak kayitli olan kalem hatirlatilir:
`approval_status` ve `approved_at` `providers` tablosuna tasinirken
`protect_sensitive_profile_fields` korumasi disinda kalir; `providers` icin esdeger bir
koruma tetikleyicisi gerekir. Bu iki sutun artik dosya 00'da olusuyor.
