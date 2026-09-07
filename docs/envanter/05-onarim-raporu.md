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
> **DURUM: zincir 02de duruyor.** `column "is_admin" does not exist`. Yeni bir bosluk
> kategorisi cikti: **mevcut tablolarin sonradan eklenmis sutunlari repoda yok.**
> Bunun icin bir **00** dosyasi gerekiyor ama **henuz yazilamadi** — sutun tipleri
> hicbir dokumde yok. Ayrinti ve gereken dokum: **bolum 3.6**.
>
> Enum engeli kalkti (**3.1**). Yabanci anahtar kisitlari hala acik (**3.2**).

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

**Uc enum tipi** (`listing_invitation_status`, `quote_recipient_status`,
`quote_request_status`) dosyanin basinda olusturulur; degerleri uretimden alindi
(bolum 3.1).

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

### 3.1 Uc enum tipi — degerler uretimden alindi, KAPANDI

`listing_invitation_status`, `quote_recipient_status`, `quote_request_status` repo
migration zincirinde tanimli degildi ve **degerleri hicbir CSV dokumunde yoktu**;
`eksik-tablo-sutunlari.csv` yalniz `information_schema.columns` ciktisidir, enum
etiketlerini icermez. Bu yuzden 01 basta bir koruma blogu ile duruyordu.

Degerler `pg_enum`den cekilip 01e islendi; koruma blogu kaldirildi:

| Tip | Degerler (`enumsortorder` sirasiyla) |
|---|---|
| `listing_invitation_status` | `pending`, `accepted`, `declined`, `expired`, `cancelled` |
| `quote_recipient_status` | `sent`, `viewed`, `quoted`, `declined` |
| `quote_request_status` | `active`, `closed`, `expired`, `fulfilled` |

Idempotanlik icin repo idyomu kullanildi (`20260630120000` dosyasindaki kalip):
`DO $$ BEGIN CREATE TYPE ...; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
— `CREATE TYPE IF NOT EXISTS` PostgreSQLde yoktur.

**Dogrulama.** Uc sey kontrol edildi:

1. Uc sutunun `column_default` degeri (`pending` / `sent` / `active`) kendi tipinin
   listesinde **var**.
2. Tum migration dosyalari ve dokum CSVleri tarandi; bu uc tipe cast edilen literal
   **yalniz** o uc varsayilan. Listelerin disinda kalan bir deger yok.
3. Uygulama kodunda bu uc tabloya deginen 8 dosyadaki `status` degerleri tarandi:
   `pending`, `accepted`, `declined`, `cancelled`, `sent`, `viewed`, `quoted`,
   `active` — hepsi listelerde. Ayni dosyalarda gecen `published` ve `approved`
   baska sutunlara ait (`listings.status` ve `profiles.approval_status`).

Listelerde olup uygulama kodunda hic gecmeyen degerler: `expired` (iki tipte de),
`closed` ve `fulfilled`. Bunlar sistemin atadigi ya da henuz kullanilmayan
durumlardir; enum uyeligi uretimden geldigi icin **yine de yazildi**.


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

### 3.6 YENI BOSLUK KATEGORISI — mevcut tablolarin eksik sutunlari

Zincir `20260620090100_faz_minus1_02_is_admin.sql` dosyasinda durdu:

```
column "is_admin" does not exist
```

`is_admin()` govdesi `profiles.is_admin` okuyor, ama repo migration zinciri o sutunu
**hic olusturmuyor**. Bu, 04-sema-uzlastirmada gorulmeyen bir kategori: eksik olan
tablo, fonksiyon, politika ya da indeks degil — **var olan bir tablonun sutunu**.

#### 3.6.1 `tum-sutunlar.csv` bu isi gormez — uretim degil, repo ciktisi

Eklenen dokum uretimden alinmis gibi duruyor ama degil. Uc bagimsiz kanit:

**Kanit A — bir tablo indekslidir ama sutunsuzdur.** `business_invitations` uretim
dokumlerinde 7 indeks, 4 politika ve 2 tetikleyiciye sahip; `tum-sutunlar.csv`de
**sifir satiri var**. Uretimde bir tablonun indeksi olup sutunu olamaz.

**Kanit B — dokum, repo zincirinin ciktisiyla BIREBIR ayni.** Zincir
`20260625120000` oncesine kadar simule edilip dokumle karsilastirildi:

| Yon | Fark |
|---|---|
| Repo uretiyor, dokumde yok | **0** |
| Dokumde var, repo uretmiyor | **0** (12 satir haric: `professional_rating_summary` ve `profile_completeness` — bunlar **VIEW**, `20260518000000`de tanimli; `information_schema.columns` view sutunlarini da listeler) |

Sifir fark tesadufi degildir. Dokum, **repo migration zincirinin
`20260625120000` oncesine kadar uygulanmis halinden** alinmis. Bu yuzden tanimi
geregi hicbir eksik sutun gosteremez.

**Kanit C — `is_admin` dokumun kesme tarihinden eski.** Uygulama kodunda ilk gecisi
**2026-05-24** (`61e9307`, "Faz 12b: Admin onay sistemi"). Dokumun kesme noktasi
`20260625120000`. Uretimden alinmis bir dokum `is_admin`i icermeliydi.

> Sonuc: yeni bir dokum gerekiyor ve **uretim veritabaninda** kosturulmali.

#### 3.6.2 Kanita dayali aday liste (alt sinir, tam liste degil)

Dokum olmadigi icin eksik sutunlar iki dolayli kaynaktan cikarildi:

1. **Uretim eserleri** — `indeksler.csv` indeks tanimlari, `politika-ifadeleri-*.csv`,
   fonksiyon govdeleri, `protect_sensitive_profile_fields` kara listesi.
2. **Uygulama kodu** — `.select()`, `.eq()`, `.update()` cagrilarindaki sutun adlari.

32 aday bulundu. **Ikisi de tek basina yetmiyor:** `profiles.approved_at` yalniz
uretim eserinde, 21 sutun yalniz kodda geciyor. Hicbir yerde referansi olmayan bir
sutun ikisine de gorunmez — bu yuzden liste bir **alt sinirdir**.

| Tablo | Sutun | Uretim eseri | Kod |
|---|---|---|---|
| `applications` | `attachment_name` | — | var |
| `applications` | `attachment_path` | — | var |
| `applications` | `attachment_type` | — | var |
| `bookings` | `cancelled_by` | — | var |
| `bookings` | `end_time` | — | var |
| `bookings` | `start_time` | — | var |
| `conversations` | `brief_data` | — | var |
| `conversations` | `end_time` | — | var |
| `conversations` | `request_type` | — | var |
| `conversations` | `start_time` | — | var |
| `listings` | `allowed_applicant_roles` | — | var |
| `listings` | `application_deadline` | — | var |
| `listings` | `approval_note` | — | var |
| `listings` | `featured_category_until` | indeks `idx_listings_featured_category` | var |
| `listings` | `featured_home_until` | indeks `idx_listings_featured_home` | var |
| `listings` | `is_urgent` | — | var |
| `listings` | `urgent_until` | — | var |
| `messages` | `attachment_name` | — | var |
| `messages` | `attachment_path` | — | var |
| `messages` | `attachment_type` | — | var |
| `notifications` | `email_sent_at` | indeks `idx_notifications_email_sent_at` | var |
| `profiles` | `approval_note` | — | var |
| `profiles` | `approval_status` | `protect_sensitive_profile_fields()` | var |
| `profiles` | `approved_at` | `protect_sensitive_profile_fields()` | — |
| `profiles` | `attributes` | — | var |
| `profiles` | `default_allowed_applicant_roles` | — | var |
| `profiles` | `is_admin` | indeks `idx_profiles_is_admin` | var |
| `profiles` | `premium_tier` | indeks `idx_profiles_premium` | var |
| `profiles` | `premium_until` | indeks `idx_profiles_premium` | var |
| `profiles` | `suspended_at` | indeks `idx_profiles_suspended` | var |
| `profiles` | `suspended_by` | `protect_sensitive_profile_fields()` | var |
| `profiles` | `suspension_reason` | `protect_sensitive_profile_fields()` | var |

#### 3.6.3 Neden 00 dosyasi HENUZ yazilmadi

32 sutunun **tipi, varsayilani ve null durumu hicbir kaynakta yok.** Indeks tanimindan
cikan tek kesin bilgi `profiles.is_admin`in **boolean** oldugu
(`WHERE (is_admin = true)`); `suspended_at` icin yalniz "nullable" cikarilabiliyor
(`WHERE (suspended_at IS NOT NULL)`). Kalan 30 sutun icin hicbir sey.

Tip uydurmak, FAZ -1in ortadan kaldirmak icin var oldugu sapmanin ta kendisini
uretirdi: `timestamptz` yerine `timestamp`, `NOT NULL DEFAULT false` yerine
nullable bir `boolean` yazmak zincirin kosmasini saglar ama semayi uretimden
**sessizce** ayirir.

#### 3.6.4 Gereken dokum

**Uretim veritabaninda** kosturulacak. Ciktinin `profiles.is_admin` satirini
icermesi, dogru veritabanina baglanildiginin kontroludur:

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

`table_type = 'BASE TABLE'` suzgeci view sutunlarini disarida birakir. Cikti
**297 satirdan belirgin sekilde fazla** olmalidir; degilse yine yanlis veritabani.

#### 3.6.5 00 dosyasinin zaman damgasi

Slot hesaplandi: **`20260620085000`**.

- `20260520151810`dan **sonra** — etkilenen tablolarin en genci `agency_members`
  (`20260520071330`); hepsi bu damgadan once doguyor.
- `20260620090000`dan **once** — hem 01 hem 02 bu sutunlara bagimli olabilir
  (`is_admin()` govdesi `profiles.is_admin` okuyor).

Dosya adi: `20260620085000_faz_minus1_00_eksik_sutunlar.sql`.
Icerik `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, veri degistirme yok.

---

## 4. Uygulama sirasi

**Supabase Dashboard > SQL Editor.** SQL terminale yapistirilmaz (PowerShell `<` karakterini
dusuruyor). Her dosya **kendi calistirmasinda**, sirayla:

| Sira | Dosya | On kosul |
|---|---|---|
| 1 | 01 eksik tablolar | — (uc enum tipini kendisi olusturur) |
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

Bu dosyalar **FAZ -1'in son adimidir**. Uc kalemden ikisi acik:

1. ~~**Enum degerleri** (3.1)~~ — **kapandi**, degerler uretimden alinip 01e islendi.
2. **Eksik sutunlar** (3.6) — **zinciri su an durduran kalem.** Uretimden gercek bir
   sutun dokumu gerekiyor; 00 dosyasi ancak ondan sonra yazilabilir.
3. **Kisit dokumu** (3.2) — FK, `CHECK` ve `PRIMARY KEY`/`UNIQUE` dogrulamasi.
   FAZ 0 oncesinde kapatilmalidir.

2 ve 3 **ayni dokum turunden** besleniyor. Ikisi tek seferde alinabilir: 3.6.4teki
sutun sorgusu ve 3.2deki `pg_constraint` sorgusu birlikte kosturulursa FAZ -1in
kalan iki acigi da kapanir.

Ayrica `04-goc-plani.md`'de FAZ 2 on kosulu olarak kayitli olan bir kalem hatirlatilir:
`approval_status` ve `approved_at` `providers` tablosuna tasinirken
`protect_sensitive_profile_fields` korumasi disinda kalir; `providers` icin esdeger bir
koruma tetikleyicisi gerekir.
