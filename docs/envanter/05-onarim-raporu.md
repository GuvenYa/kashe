# 05 — FAZ -1 Onarim Migration'i

> **UYGULANACAK MIGRATION'LAR (8 dosya, HENUZ KOSMADI):**
>
> | # | Dosya | Ne yapar |
> |---|---|---|
> | 01 | `20260620090000_faz_minus1_01_eksik_tablolar.sql` | 13 tablo, 117 sutun |
> | 02 | `20260620090100_faz_minus1_02_is_admin.sql` | `is_admin()` |
> | 03 | `20260620090200_faz_minus1_03_yetki_fonksiyonlari.sql` | 3 yetki fonksiyonu |
> | 04 | `20260620090300_faz_minus1_04_tetikleyici_fonksiyonlari.sql` | 36 fonksiyon |
> | 05 | `20260620090400_faz_minus1_05_tetikleyiciler.sql` | 6 tetikleyici |
> | 06 | `20260620090500_faz_minus1_06_politikalar.sql` | 56 RLS politikasi |
> | 07 | `20260620090600_faz_minus1_07_indeksler.sql` | 36 indeks |
> | 08 | `20260701110000_faz_minus1_08_gec_indeksler.sql` | 1 indeks |
>
> **Dosyalar olusturuldu, UYGULANMADI.** Supabase Dashboard > SQL Editor'den elle kosturulacak.
>
> **01 su anda kasitli olarak DURUR.** Uc enum tipinin degerleri hicbir dokumde yok;
> dosyanin basindaki koruma bloku net bir hata mesajiyla durdurur. Bkz. **bolum 3.1**.

Kaynak: `04-sema-uzlastirma.md` (Grup A/B/C/D ayrimi) ve `uretim-dokum/*.csv` (uretim dokumu).
Bu rapor **ne yazildigini, neyin yazilmadigini ve nedenini** anlatir.

---

## 0. Ozet

Repo migration zinciri temiz bir veritabaninda kosturulunca **ilk eksik tabloda durur**:
`20260625120000_add_service_price_unit_and_starting.sql`, var olmayan `service_packages`
tablosunu `ALTER` etmeye calisir. Bu sekiz dosya o bosluklari kapatir.

Yazilan nesneler — hepsi **Grup A** (uretimde var, repoda yok) — arti **bir bilincli Grup D
istisnasi**:

| Nesne | Grup A'da eksik | Yazildi | Nerede |
|---|---|---|---|
| Tablo | 13 | 13 | 01 |
| Fonksiyon | 39 | 39 | 02 (1) + 03 (3) + 04 (35) |
| Tetikleyici | 6 | 6 | 05 |
| Politika | 56 | 56 | 06 |
| Indeks | 37 | 37 | 07 (36) + 08 (1) |
| *(Grup D istisnasi)* | — | `handle_updated_at` | 04 |

**Toplam 151 nesne + 1 hizalama.** Grup A'da yazilmayan nesne **yok**.

Tum dosyalar yalniz **DDL** icerir. Hicbir `INSERT`, `UPDATE` veya `DELETE` yoktur.

---

## 1. Dosya dosya ozet

### 01 — Eksik tablolar (13 tablo, 117 sutun)

`service_packages`, `service_addons`, `availability_blocks`, `blog_posts`,
`category_requests`, `admin_audit_log`, `message_violations`, `push_subscriptions`,
`conversation_assignees`, `reports`, `quote_requests`, `quote_request_recipients`,
`listing_invitations`

**Sira gerekcesi.** `service_packages` en once: `20260625120000` onu `ALTER` ediyor.
`quote_requests`, `quote_request_recipients`'ten once (yabanci anahtar yonu).

**Sutunlar** `eksik-tablo-sutunlari.csv`'den (`information_schema.columns` dokumu) birebir:
ad, tip, `NOT NULL`, `DEFAULT`.

**Kisitlar TURETILDI, dokum alinmadi.** Ayri bir kisit dokumu yok. `indeksler.csv`'deki
indeks adlarindan cikarildi: `*_pkey` -> `PRIMARY KEY`, `*_key` -> `UNIQUE`. Bu, Postgres'in
kisit indekslerini adlandirma kuralina dayanir; **tahmin degil, ad kuralindan cikarim**.
Yine de kisit dokumunun yerini tutmaz — bkz. bolum 3.2.

**Yabanci anahtarlar YOK.** Bkz. bolum 3.2.

`CREATE TABLE IF NOT EXISTS` ile idempotan.

### 02 — `is_admin()` (1 fonksiyon)

Tek basina bir dosya, cunku **bagimlilik zincirinin kokunde**:

```
is_admin()  ->  protect_sensitive_profile_fields()  ->  protect_profile_fields tetikleyicisi
   (02)                      (04)                              (05)
```

`protect_sensitive_profile_fields` govdesinin ilk satiri
`if public.is_admin(auth.uid()) then return new; end if;` oldugu icin `is_admin` 04'ten ve
05'ten **once** olusmalidir.

### 03 — Kalan yetki fonksiyonlari (3)

`is_assignee`, `is_professional_or_agency`, `owns_quote_request`

Ucu de `LANGUAGE sql`, `STABLE SECURITY DEFINER`, `SET search_path TO 'public'`.
Govdeler `fonksiyon-govdeleri-*.csv`'den (`pg_get_functiondef` ciktisi) birebir.

### 04 — Tetikleyici fonksiyonlari (36)

35 Grup A fonksiyonu + `handle_updated_at` (Grup D istisnasi, bkz. bolum 3.3).

Bir govde CSV'de yoktu: **`protect_sensitive_profile_fields`**. Govdesi
`docs/architecture/04-goc-plani.md` FAZ -1 bolumunden alindi (uretimden cekilip oraya
islenmisti). Yedi alani koruyan kara liste: `is_admin`, `role`, `approval_status`,
`approved_at`, `suspended_at`, `suspension_reason`, `suspended_by`.

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

### 07 — Indeksler (36)

`pg_indexes.indexdef` ciktisindan birebir. 2 tanesi `UNIQUE`.
En cok indeks alan tablo `listing_invitations` (5).

**Yazilmayanlar:** 35 `*_pkey` ve 18 `*_key`. Bunlar kisit indeksleridir; dosya 01'deki
`PRIMARY KEY` / `UNIQUE` ifadeleriyle kendiliginden olusur. Elle `CREATE INDEX` yazmak
kopya uretirdi.

**Mukerrer indeksler silinmedi.** `04-sema-uzlastirma.md` bolum 5'te 9 gereksiz cift
tespit edildi, ama silme karari `pg_stat_user_indexes` olcumune baglidir ve **ayri bir
adimdir**. Bu dosya yalniz eksikleri ekler.

### 08 — Gec baglanan indeksler (1)

`no_duplicate_pending_business_invitation` — `business_invitations(business_id, invited_email)
WHERE status = 'pending'`.

Ayri dosya, cunku `business_invitations` zincirde `20260630120000`'de dogar; 07'nin
damgasi (`20260620090600`) ondan oncedir. Bkz. bolum 3.4.

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

Dosya basliklarinda acikca atlandigi belirtilen ornekler:

- **03'te:** `has_business_role`, `is_business_member`, `has_business_role_on_request`,
  `is_business_member_of_request` — dordu de repoda tanimli.
- **05'te:** `messages_update_conversation` — **repoda var, uretimde yok** (Grup B).
  `04-sema-uzlastirma.md` bolum 3'te olu kod olarak isaretlendi; uretimde yalniz
  `on_message_insert_update_conversation` calisiyor. Silme karari bu dosyanin isi degil.

---

## 3. Karar noktalari

### 3.1 ENGEL — uc enum tipinin degerleri bilinmiyor

`listing_invitation_status`, `quote_recipient_status`, `quote_request_status` repoda
tanimli degil ve **degerleri hicbir dokumde yok**. `eksik-tablo-sutunlari.csv` yalniz
`information_schema.columns` ciktisidir; enum etiketlerini icermez.

Gozlemlenebilen tek sey, `column_default`'tan cikan **birer deger**:

| Tablo.sutun | Tip | Gozlemlenen tek deger |
|---|---|---|
| `listing_invitations.status` | `listing_invitation_status` | `'pending'` |
| `quote_request_recipients.status` | `quote_recipient_status` | `'sent'` |
| `quote_requests.status` | `quote_request_status` | `'active'` |

**Kalan degerler uydurulmadi.** Eksik bir etiket, o enumu kullanan her `INSERT`/`UPDATE`
calisma aninda patlatirdi ve tablo dolduktan sonra duzeltmesi zordur.

Dosya 01'in basinda bir koruma bloku var; uc tip de yoksa net bir hata mesajiyla durur:

```
FAZ -1/01 DURDU: su enum tipleri yok: ...
```

**Cozmek icin gereken dokum** (Dashboard > SQL Editor'de kosturulup ciktisi paylasilacak):

```sql
select t.typname as tip,
       string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder) as degerler
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
 where t.typname in ('listing_invitation_status','quote_recipient_status','quote_request_status')
 group by t.typname;
```

Cikti geldiginde 01'in basina uc `CREATE TYPE` ifadesi eklenip koruma bloku kaldirilir.

### 3.2 Yabanci anahtar kisitlari hicbir dosyada YOK

FK tanimlari dokumlerde bulunmuyor. `eksik-tablo-sutunlari.csv` sutun listesidir; kisit
listesi degil. **Uydurulmadi.**

Sonucu: tablolar dogru sutun ve tiplerle olusur, ama **referans butunlugu olmadan**.
Uretimle sema esitligi bu haliyle tam degildir.

13 tablodaki `_id` ile biten **25 sutun** FK adayidir (bu bir gozlem, tahmin degil):

| Tablo | Sutunlar |
|---|---|
| `admin_audit_log` | `admin_id`, `target_id` |
| `availability_blocks` | `profile_id` |
| `blog_posts` | `author_id` |
| `category_requests` | `user_id` |
| `conversation_assignees` | `conversation_id`, `professional_id` |
| `listing_invitations` | `listing_id`, `inviter_id`, `professional_id`, `resulting_application_id` |
| `message_violations` | `user_id`, `conversation_id` |
| `push_subscriptions` | `user_id` |
| `quote_request_recipients` | `request_id`, `professional_id`, `conversation_id` |
| `quote_requests` | `customer_id`, `category_id`, `city_id` |
| `reports` | `reporter_id`, `target_id` |
| `service_addons` | `service_id`, `profile_id` |
| `service_packages` | `profile_id` |

Hedef tablo ve `ON DELETE` davranisi **bilinmiyor**; ikisi de dokum gerektirir:

```sql
select c.conrelid::regclass as tablo,
       c.conname            as kisit,
       pg_get_constraintdef(c.oid) as tanim
  from pg_constraint c
 where c.contype in ('f','p','u','c')
   and c.connamespace = 'public'::regnamespace
   and c.conrelid::regclass::text in (
     'service_packages','service_addons','availability_blocks','blog_posts',
     'category_requests','admin_audit_log','message_violations','push_subscriptions',
     'conversation_assignees','reports','quote_requests','quote_request_recipients',
     'listing_invitations')
 order by 1, 2;
```

Bu dokum ayni zamanda **01'deki `PRIMARY KEY` / `UNIQUE` cikarimini da dogrular** ve
`CHECK` kisitlarini ortaya cikarir — onlar da su an dosyalarda yok.

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
ALT SINIR   20260520071330   agency_members dogumu -> 05 ve 06 ona bagimli
```

Her dosyanin en gec bagimliligi olculdu:

| Dosya | En gec bagimlilik | Nesne |
|---|---|---|
| 01 | — | (yok) |
| 02 | `20260518000000` | `profiles` |
| 03 | `20260518000000` | `profiles` |
| 04 | `20260519133753` | `listings` |
| 05 | `20260520071330` | `agency_members` |
| 06 | `20260520071330` | `agency_members` |
| 07 | `20260520071330` | `agency_invitations` |
| 08 | `20260630120000` | `business_invitations` |

01–07 icin gecerli pencere `20260520071330 < TS < 20260625120000`; `2026062009xxxx` secildi.

**08 bu pencereye SIGMAZ.** Tek indeksi (`no_duplicate_pending_business_invitation`)
`business_invitations` tablosuna dayanir, o da `20260630120000`'de dogar. Bu yuzden 07'den
ayrildi ve `20260701110000`'e alindi. Brief 7 dosya istiyordu; **8'inci dosya bu zorunluluktan
dogdu**, keyfi degil.

Zincirdeki nihai yer:

```
20260520151810_fix_handle_new_user_for_agency.sql
20260620090000_faz_minus1_01_eksik_tablolar.sql          <- yeni
...
20260620090600_faz_minus1_07_indeksler.sql               <- yeni
20260625120000_add_service_price_unit_and_starting.sql   <- artik service_packages'i buluyor
20260629120000_add_quotes_over_budget.sql
20260630120000_add_business_members_and_invitations.sql
20260701110000_faz_minus1_08_gec_indeksler.sql           <- yeni
20260701120000_business_member_shared_visibility.sql
```

### 3.5 Neden sekiz dosya, tek dosya degil

Biri hata verirse **nerede durdugu belli olur** ve tek dosya geri alinabilir. Her dosya
kendi `BEGIN; ... COMMIT;` blogundadir; bir dosya kismen uygulanmis halde kalmaz.

---

## 4. Uygulama sirasi

**Supabase Dashboard > SQL Editor.** SQL terminale yapistirilmaz (PowerShell `<` karakterini
dusuruyor). Her dosya **kendi calistirmasinda**, sirayla:

| Sira | Dosya | On kosul |
|---|---|---|
| 1 | 01 eksik tablolar | **Uc enum tipi olmali** (3.1) |
| 2 | 02 is_admin | 01 |
| 3 | 03 yetki fonksiyonlari | 01 (`quote_requests` tablosu) |
| 4 | 04 tetikleyici fonksiyonlari | 01, 02 |
| 5 | 05 tetikleyiciler | 01, 04 |
| 6 | 06 politikalar | 01, 02, 03 |
| 7 | 07 indeksler | 01 |
| 8 | 08 gec indeksler | `business_invitations` (uretimde zaten var) |

**Uretimde uygulama notu.** Bu nesneler uretimde **zaten var**. Dosyalar idempotan
(`IF NOT EXISTS`, `DROP ... IF EXISTS` + `CREATE`), yani uretimde kosturulunca islevsel
etkisi olmamalidir. Ama gercek amac uretimi degistirmek degil, **repo zincirini uretime
esitlemektir**; dogru dogrulama ortami **bos bir veritabanidir** (bolum 5).

Bir dosya hata verirse: o dosya tamamen geri alinir (kendi islemi icinde), hata mesaji
kaydedilir, sonraki dosyalara **gecilmez**.

---

## 5. Dogrulama adimlari

### 5.1 Zincir bastan sona kosuyor mu

Bos bir veritabaninda tum zinciri kostur. Basari olcusu: **hicbir migration hata vermez**.
Ozellikle `20260625120000` artik `service_packages`'i bulmalidir.

### 5.2 Sema uretimle esit mi

Zincir bittikten sonra ayni dort dokumu **yeni veritabanindan** al ve
`uretim-dokum/*.csv` ile karsilastir:

```sql
-- tablo sayisi
select count(*) from information_schema.tables
 where table_schema = 'public' and table_type = 'BASE TABLE';

-- fonksiyon / tetikleyici / politika / indeks sayilari
select 'fonksiyon' as nesne, count(*) from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
union all select 'tetikleyici', count(*) from pg_trigger where not tgisinternal
union all select 'politika',    count(*) from pg_policies where schemaname = 'public'
union all select 'indeks',      count(*) from pg_indexes  where schemaname = 'public';
```

**Beklenen** (`04-sema-uzlastirma.md` bolum 0'daki uretim sayilari):

| Nesne | Uretim |
|---|---|
| Fonksiyon | 69 |
| Tetikleyici | 33 |
| Politika | 148 |
| Indeks | 157 |

> Tetikleyici icin not: 05'te `messages_update_conversation` **yazilmadi** (Grup B, repoda
> var uretimde yok). Repo zinciri onu kendi migration'inda hala olusturuyor. Bu yuzden
> yeni veritabaninda tetikleyici sayisi **34** cikar, 33 degil. Fark budur ve beklenendir;
> o tetikleyicinin silinmesi ayri bir karardir.

### 5.3 Karsilastirmada md5 KULLANMA

`04-sema-uzlastirma.md` bolum 5'te olculdu: `pg_get_functiondef` ve `pg_indexes.indexdef`
ciktilari Postgres tarafindan **yeniden render edilir** (`public.` on eki, `USING btree`,
tip cast'i, parantez). Migration kaynak metninin md5'i ile uretim ciktisinin md5'i
karsilastirilirsa **neredeyse %100 yanlis pozitif** cikar — indekslerde 67/67 ham fark
elde edilmisti, elle bakinca gercek fark **0** idi.

Dogru yontem: **iki tarafta da `pg_*` ciktisini al**, sonra karsilastir. Yani yeni
veritabanindan alinan dokumu `uretim-dokum/*.csv` ile karsilastir; migration dosyasinin
metniyle degil.

### 5.4 Yabanci anahtar ve kisit acigi

3.2'deki `pg_constraint` sorgusunu **iki tarafta da** kostur ve karsilastir. Su an fark
cikmasi beklenir: yeni veritabaninda FK'ler **eksik olacak**. Bu, bilinen ve raporlanan
bir aciktir; kapatilmasi kisit dokumunun alinmasina baglidir.

### 5.5 Uygulama sonrasi uretim dumani kontrolu

Dosyalar uretimde kosturulursa, sonrasinda `04-sema-uzlastirma.md` bolum 0'daki dort sayi
**degismemelidir** (69 / 33 / 148 / 157). Degistiyse idempotanlik varsayimlarindan biri
tutmamis demektir; hangi dosyanin sayiyi degistirdigi tespit edilmelidir.

---

## 6. Sonraki adim

Bu dosyalar **FAZ -1'in son adimidir**. Iki acik kalem kapanmadan FAZ 0'a gecilmemelidir:

1. **Enum degerleri** (3.1) — 01 bunlar olmadan calismaz.
2. **Kisit dokumu** (3.2) — FK, `CHECK` ve `PRIMARY KEY`/`UNIQUE` dogrulamasi.

Ayrica `04-goc-plani.md`'de FAZ 2 on kosulu olarak kayitli olan bir kalem hatirlatilir:
`approval_status` ve `approved_at` `providers` tablosuna tasinirken
`protect_sensitive_profile_fields` korumasi disinda kalir; `providers` icin esdeger bir
koruma tetikleyicisi gerekir.
