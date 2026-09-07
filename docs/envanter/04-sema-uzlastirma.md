# Envanter 04 — Sema uzlastirma (repo migration zinciri ↔ uretim)

Kaynak: `supabase/migrations/` (36 dosya) + `docs/envanter/uretim-dokum/` (4 CSV). HEAD = `a9b6dd8`.
**Yalniz okuma** ile uretildi; hicbir kaynak dosya degistirilmedi. **Onarim migration'i YAZILMADI.**

## 0. SONUC — tek cumle

> Repo migration zinciri temiz bir veritabaninda kosturulsa, uretimden **13 tablo, 39 fonksiyon,
> 6 tetikleyici, 56 politika ve 35 indeks eksik** bir sema cikardi — ve zincir zaten
> **ilk eksik tabloda hata verip dururdu.**

Buna karsilik, **ortak olan nesnelerde davranis farki bulunamadi**: 67 ortak indeksin tamami
ve 27 ortak tetikleyicinin tamami anlamsal olarak ayni. Yani sorun *sapma* degil, **eksiklik**.

---

## 1. OZET SAYILAR

| Nesne turu | Uretim | Repo | Yalniz uretimde (A) | Yalniz repoda (B) | Farkli (C) | Esit (D) |
|---|---|---|---|---|---|---|
| **Tablo** | 35 | 22 | **13** | 0 | — | 22 |
| **Fonksiyon** | 69 | 32 | **39** | 2 | *olculemedi* | 30 (ad bazli) |
| **Tetikleyici** | 33 | 28 | **6** | 1 | **0** | **27** |
| **Politika** | 148 | 93 | **56** | 1 | *olculemedi* | 92 (ad bazli) |
| **Indeks** | 157 | 67 | **90** | 0 | **0** | **67** |

### Sayilarin okunmasi — dikkat edilecek uc nokta

**(a) CSV satir sayisi.** Dort dosyanin hicbiri satirsonu ile bitmiyor, bu yuzden `wc -l` birer
eksik sayar. Gercek kayit sayilari: fonksiyon **69**, tetikleyici **33**, politika **148**, indeks **157**.
(Son bayt kontrolu: `tail -c 1 dosya | xxd -p` → `0a` degil.)

**(b) Repo politika sayisi 108 degil 93.** Migration'larda **108 `CREATE POLICY`** var ama
**93 benzersiz (tablo, politika_adi)** cifti. Aradaki 15 fark, ayni politikanin sonraki
migration'larda `DROP + CREATE` ile yeniden yazilmasindan geliyor — 13 politika birden fazla kez
olusturuluyor (`messages_insert_participant` ucer kez, `reviews` politikalari ikiser kez).
Karsilastirma **benzersiz cift** uzerinden yapildi; nesne sayimi budur.

**(c) Indeks A grubunun 90'i ayni sey degil.** Kirilim:

| Alt grup | Adet | Anlami |
|---|---|---|
| `*_pkey` | 35 | `PRIMARY KEY` kisitinin otomatik urettigi indeks — migration'da `CREATE INDEX` olarak **gorunmez**, normaldir |
| `*_key` | 18 | `UNIQUE` kisitinin otomatik urettigi indeks — ayni sekilde normaldir |
| **gercek eksik** | **37** | Repoda `CREATE INDEX` ifadesi olmayan gercek indeksler |

Yani indeks tarafinda gercek eksik **37**, 90 degil. Kalan 53 tanesi
ilgili tablonun `CREATE TABLE` ifadesi repoya alindiginda **kendiliginden** olusur.

---

## 2. GRUP A — yalniz uretimde (repoda yok)

Migration zinciri kosturuldugunda **eksik kalacak** nesneler.

### 2a. Tablolar (13)

Uretimde 35 tablo var (CLAUDE.md'deki "35 tablo" ile birebir), repoda **22** `CREATE TABLE`.

| Tablo | Repoda migration'da aniliyor mu | Not |
|---|---|---|
| `admin_audit_log` | hayir | Admin islem gunlugu — migration'larda hic anilmiyor |
| `availability_blocks` | EVET | Musaitlik takvimi; 5 dosyada `.from()` ile kullaniliyor |
| `blog_posts` | hayir | Blog; kendi tetikleyicisi ve 5 politikasi var |
| `category_requests` | hayir | Kategori talepleri; admin akisinda kullaniliyor |
| `conversation_assignees` | hayir | Konusma atamalari; **2 tetikleyicisi var** (bkz. 2c) |
| `listing_invitations` | EVET | Canlidaki 3 politikasi yoruma birebir yazilmis |
| `message_violations` | hayir | Mesaj ihlalleri |
| `push_subscriptions` | hayir | Push bildirim abonelikleri; 2 fonksiyonu var |
| `quote_request_recipients` | EVET | Ayni; `owns_quote_request` bu tabloda kullaniliyor |
| `quote_requests` | EVET | Politikalari 3 migration'da yeniden yaziliyor — tablo yok |
| `reports` | hayir | Sikayet/rapor kayitlari; 5 politikasi var |
| `service_addons` | EVET | Yalniz admin onizleme politikasinda aniliyor |
| `service_packages` | EVET | `20260625120000` ALTER ediyor → **temiz DB'de zincir burada patlar** |

> Onceki surumde bu liste **6** idi. Fark: o zaman yalniz *migration'larda anilan* tablolar
> bulunabiliyordu. Uretim dokumu, hic anilmayan 7 tabloyu daha ortaya cikardi.

### 2b. Fonksiyonlar (39)

| Grup | Fonksiyonlar |
|---|---|
| Admin raporlama RPC'leri (26) | `admin_booking_daily` · `admin_booking_summary` · `admin_funnel_client` · `admin_funnel_professional` · `admin_ops_application_response` · `admin_ops_listing_to_first_app` · `admin_ops_message_response` · `admin_queue_counts` · `admin_recent_actions` · `admin_retention_incomplete_pros` · `admin_retention_listings_no_apps` · `admin_retention_pros_no_apps` · `admin_stats_active_categories` · `admin_stats_active_users` · `admin_stats_categories` · `admin_stats_cities` · `admin_stats_messages` · `admin_stats_quotes` · `admin_stats_registrations` · `admin_stats_supply_demand_category` · `admin_stats_supply_demand_city` · `admin_stats_top_favorited` · `admin_stats_top_rated` · `admin_stats_top_viewed` · `admin_stats_weekly_compare` · `admin_stats_weekly_trend` |
| Yetkilendirme (4) | `is_admin` · `is_assignee` · `is_professional_or_agency` · `owns_quote_request` |
| Atama akisi (3) | `fn_assignee_added_message` · `fn_assignee_removed_message` · `fn_remove_assignments_on_leave` · `is_assignee` |
| Push bildirim (2) | `delete_push_subscription_by_endpoint` · `get_push_subscriptions_for_user` |
| Diger (4) | `increment_profile_views` · `notify_quote_request_recipients` · `protect_sensitive_profile_fields` · `set_blog_posts_updated_at` |

#### 🔴 Yetkilendirme fonksiyonlari — CLAUDE.md dogruymus

Rapor 01 bolum 5b, dort fonksiyonun "repoda hic gecmiyor" oldugunu tespit etmisti. Uretim dokumu
simdi ikinci yariyi veriyor: **dordu de uretimde MEVCUT.**

| Fonksiyon | Repo | Uretim | SECURITY DEFINER |
|---|---|---|---|
| `is_admin` | ❌ | ✅ `uid uuid` | true |
| `is_assignee` | ❌ | ✅ `conv_id uuid, uid uuid` | true |
| `is_professional_or_agency` | ❌ | ✅ `uid uuid` | true |
| `owns_quote_request` | ❌ | ✅ `req_id uuid, uid uuid` | true |

**Duzeltme:** CLAUDE.md'nin alti fonksiyonluk listesi **uretim acisindan dogruydu**; eksik olan
taraf repoydu. Bu turda CLAUDE.md'ye yazdigimiz "bir kismi repoda tanimli degildir, uretimden
dogrulanmalidir" ifadesi de dogru — ve artik dogrulandi.

**`protect_sensitive_profile_fields`** de uretimde mevcut (`security_definer=true`),
tetikleyicisi `protect_profile_fields` adiyla `profiles` tablosunda (bkz. 2c).

> ✅ **GOVDESI COZULDU.** Bu rapor yazildiktan sonra tam tanim uretimden alindi ve
> `docs/architecture/04-goc-plani.md` FAZ -1 bolumune islendi. Ozet: **kara liste** yontemi;
> admin degilse su **yedi alani** eski degerine geri yazar —
> `is_admin`, `role`, `approval_status`, `approved_at`, `suspended_at`,
> `suspension_reason`, `suspended_by`. Beyaz liste **yok**; listede olmayan her alan serbest.

### 2c. Tetikleyiciler (6)

| Tetikleyici | Tablo | Fonksiyon | Not |
|---|---|---|---|
| `protect_profile_fields` | `profiles` | `protect_sensitive_profile_fields` | 🔴 **`profiles` uzerinde koruma kapisi.** Govdesi hala bilinmiyor; goc `profiles`'i bolecek |
| `set_packages_updated_at` | `service_packages` | `update_updated_at_column` | `service_packages` (repoda olmayan tablo) |
| `trg_assignee_added` | `conversation_assignees` | `fn_assignee_added_message` | `conversation_assignees` (repoda olmayan tablo) |
| `trg_assignee_removed` | `conversation_assignees` | `fn_assignee_removed_message` | `conversation_assignees` (repoda olmayan tablo) |
| `trg_blog_posts_updated_at` | `blog_posts` | `set_blog_posts_updated_at` | `blog_posts` (repoda olmayan tablo) |
| `trg_remove_assignments_on_leave` | `agency_members` | `fn_remove_assignments_on_leave` | ⚠️ `agency_members` — **repoda VAR olan tabloda**, ama tetikleyici repoda yok. Uyelik gocunde atlanma riski |

> `trg_remove_assignments_on_leave` ozellikle onemli: **GRUP A uyelik tablosunda calisan bir
> tetikleyici** ve repoda izi yok. `agency_members` → `organization_memberships` gocunde
> tasinacaklar listesinde **bulunmuyor** (bkz. `03-tetikleyici-agaci.md` GRUP A — o rapor
> yalnizca repoyu gorebiliyordu).

### 2d. Politikalar (56)

Tablo dagilimi:

| Tablo | Eksik politika | Tablo da mi eksik |
|---|---|---|
| `blog_posts` | 5 | **EVET** |
| `reports` | 5 | **EVET** |
| `service_packages` | 5 | **EVET** |
| `availability_blocks` | 4 | **EVET** |
| `bookings` | 4 | hayir |
| `category_requests` | 4 | **EVET** |
| `quote_request_recipients` | 4 | **EVET** |
| `service_addons` | 4 | **EVET** |
| `conversation_assignees` | 3 | **EVET** |
| `push_subscriptions` | 3 | **EVET** |
| `quote_requests` | 3 | **EVET** |
| `admin_audit_log` | 2 | **EVET** |
| `conversations` | 2 | hayir |
| `listings` | 2 | hayir |
| `service_categories` | 2 | hayir |
| `applications` | 1 | hayir |
| `listing_invitations` | 1 | **EVET** |
| `message_violations` | 1 | **EVET** |
| `profiles` | 1 | hayir |

> `listings`, `conversations`, `applications`, `profiles`, `service_categories` satirlari dikkat
> ceker: bu tablolar repoda **var**, ama bazi politikalari yok. Yani drift yalniz eksik tablolarda degil.

### 2e. Indeksler — gercek eksik 37

| Indeks | Tablo | Tablo da mi eksik |
|---|---|---|
| `idx_admin_audit_admin` | `admin_audit_log` | EVET |
| `idx_admin_audit_created` | `admin_audit_log` | EVET |
| `no_duplicate_pending_invitation` | `agency_invitations` | hayir |
| `idx_availability_blocks_profile` | `availability_blocks` | EVET |
| `blog_posts_slug_idx` | `blog_posts` | EVET |
| `blog_posts_status_published_idx` | `blog_posts` | EVET |
| `idx_bookings_customer` | `bookings` | hayir |
| `idx_bookings_event_date` | `bookings` | hayir |
| `idx_bookings_professional` | `bookings` | hayir |
| `idx_bookings_status` | `bookings` | hayir |
| `no_duplicate_pending_business_invitation` | `business_invitations` | hayir |
| `idx_category_requests_created` | `category_requests` | EVET |
| `idx_category_requests_name_lower` | `category_requests` | EVET |
| `idx_category_requests_status` | `category_requests` | EVET |
| `idx_category_requests_user` | `category_requests` | EVET |
| `idx_conv_assignees_conversation` | `conversation_assignees` | EVET |
| `idx_conv_assignees_professional` | `conversation_assignees` | EVET |
| `conversations_unique_pair` | `conversations` | hayir |
| `listing_invitations_inviter_idx` | `listing_invitations` | EVET |
| `listing_invitations_listing_idx` | `listing_invitations` | EVET |
| `listing_invitations_professional_idx` | `listing_invitations` | EVET |
| `listing_invitations_status_idx` | `listing_invitations` | EVET |
| `no_duplicate_pending_listing_invite` | `listing_invitations` | EVET |
| `idx_listings_featured_category` | `listings` | hayir |
| `idx_listings_featured_home` | `listings` | hayir |
| `idx_message_violations_conv` | `message_violations` | EVET |
| `idx_message_violations_time` | `message_violations` | EVET |
| `idx_message_violations_user` | `message_violations` | EVET |
| `idx_notifications_email_sent_at` | `notifications` | hayir |
| `idx_profiles_is_admin` | `profiles` | hayir |
| `idx_profiles_premium` | `profiles` | hayir |
| `idx_profiles_suspended` | `profiles` | hayir |
| `push_subscriptions_user_id_idx` | `push_subscriptions` | EVET |
| `reports_reporter_target_uniq` | `reports` | EVET |
| `reports_status_created_idx` | `reports` | EVET |
| `idx_service_addons_profile` | `service_addons` | EVET |
| `idx_service_addons_service` | `service_addons` | EVET |

---

## 3. GRUP B — yalniz repoda (uretimde yok)

Beklendigi gibi **cok kucuk** (4 nesne). Calisma bicimi "once Dashboard, sonra dosya" oldugu icin
repo uretimin **alt kumesi** olmaya yakin.

| Nesne | Tur | Tanim | Neden uretimde yok |
|---|---|---|---|
| `pg_temp._norm_lang` | Fonksiyon | `20260727140000_language_pairs_to_dictionary.sql` | **Drift degil.** `pg_temp` semasinda gecici fonksiyon; veri gocu bitince oturumla birlikte yok olur. Kalici nesne degildir |
| `update_conversation_last_message` | Fonksiyon | `20260518000000_initial_schema.sql` | `update_conversation_last_message_at` ile degistirilmis; eski surum uretimde silinmis, repoda duruyor |
| `messages_update_conversation` | Tetikleyici | `20260518000000_initial_schema.sql` | Ayni cift: `on_message_insert_update_conversation` yerine gecmis |
| `applications :: Professionals apply to published listings` | Politika | `20260519133753_add_listings_and_applications.sql:191` | Uretimde bu adla yok — yeniden adlandirilmis ya da kaldirilmis olabilir. **Incelenmeli** |

### 3a. Cozulen soru — `is_published` neden "flip etmeyebilir" sanildi

`app/admin/actions.ts:325` bir uyari logu tasiyor: *"is_published tutmadiysa
(protect_sensitive_profile_fields trigger'i engellemis olabilir)"*. Bu bir **hipotezdi**,
gozlem degil. Uretim dokumu hipotezi curutuyor.

**`profiles` uzerindeki uretim tetikleyicilerinin TAMAMI (3):**

| Tetikleyici | Fonksiyon | `is_published`'i engelleyebilir mi |
|---|---|---|
| `on_profiles_updated` | `handle_updated_at()` | Hayir — yalniz `updated_at` damgalar |
| `update_profiles_updated_at` | `update_updated_at_column()` | Hayir — yalniz `updated_at` damgalar |
| `protect_profile_fields` | `protect_sensitive_profile_fields()` | **Hayir** — kara listede 7 alan var, `is_published` **aralarinda degil** |

**Sonuc: uc tetikleyicinin hicbiri `is_published`'i engelleyemez.** Ustelik `approveProfile`
admin olarak kosuyor ve koruma fonksiyonunun ilk satiri admin icin `return new` diyor —
yani tetikleyici o yolda zaten hicbir sey yapmiyor.

`profiles` uzerinde iki UPDATE politikasi var (`Admins can update any profile`,
`Users can update own profile`); ikisinin de **ifadesi elimizde yok** (dokum md5 tasiyor).
Teorik olarak bir `WITH CHECK` `is_published`'i kisitlayabilir, ama admin politikasi
zaten adminlere aciktir.

> **Karar:** `app/admin/actions.ts:323-327`'deki uyari **olu savunma kodudur** — yanlis bir
> hipoteze dayaniyor. Silinmesi ya da yorumun duzeltilmesi onerilir; ama once iki UPDATE
> politikasinin `with_check` ifadesi cekilip teyit edilmeli (bolum 8b sorgusu bunu kapsar).
> **Bu envanterin isi degildir; ayri bir karar.**



> `03-tetikleyici-agaci.md` bolum 1a'da "`messages` tablosunda iki ortusen tetikleyici, hangisi
> gecerli belirsiz" diye isaretlenmisti. **Cevap:** uretimde yalniz `on_message_insert_update_conversation`
> var. Repodaki `messages_update_conversation` olu koddur.

---

## 4. GRUP C — ikisinde de var ama farkli

### 4a. ⚠️ Onceki uyari AMPIRIK OLARAK DOGRULANDI

Bir onceki surumde "ham md5 karsilastirmasi Grup C'yi yanlis pozitifle doldurur" diye uyarmistim.
Indeks tarafinda **her iki tam metin de** elimde oldugu icin bu artik olculebildi:

| Karsilastirma | Farkli cikan |
|---|---|
| Ham metin | **67 / 67** (%100) |
| Anlamsal normalizasyon sonrasi | **1 / 67** |
| Elle incelendikten sonra gercek fark | **0 / 67** |

Kaynak — Postgres `pg_indexes.indexdef` ciktisini yeniden uretirken sunlari ekliyor:

```
uretim: CREATE INDEX agency_invitations_status_idx ON public.agency_invitations
        USING btree (status) WHERE (status = 'pending'::agency_invitation_status)
repo  : CREATE INDEX agency_invitations_status_idx ON agency_invitations(status)
        WHERE status = 'pending';
```

Farklar: `public.` semasi · `USING btree` · tip cast (`::agency_invitation_status`) ·
`WHERE` parantezi · sondaki `;`. **Hicbiri davranis farki degil.**

Normalizasyon sonrasi kalan tek aday da artefakt cikti:

| Indeks | Uretim | Repo | Karar |
|---|---|---|---|
| `messages_type_idx` | `WHERE (message_type <> 'text')` | `WHERE message_type != 'text'` | **Ayni.** PostgreSQL'de `!=` operatoru `<>` icin takma addir; planlayici ikisini ayni cozer |

> **Sonuc: 67 ortak indeksin tamami esit (GRUP D).**

### 4b. Tetikleyiciler — 0 fark

27 ortak tetikleyicinin tamami esit. Karsilastirilan alanlar (`pg_get_triggerdef` tam metninden
ayristirildi): tablo · zamanlama (BEFORE/AFTER) · olay (INSERT/UPDATE/DELETE) · cagirdigi fonksiyon.
**Hicbirinde sapma yok.**

### 4c. 🔴 Fonksiyon ve politika govdeleri — OLCULEMEDI

Dokum bu iki nesne turu icin **yalniz md5 iceriyor**, tam govde yok:

- `fonksiyonlar.csv` → `govde_ozeti` = `md5(pg_get_functiondef(oid))`
- `politikalar.csv` → `ifade_ozeti` = `md5(qual || '|' || with_check)`

Repo tarafinda ise **migration kaynak metni** var. 4a'da olculdu ki bu iki bicim arasinda
**%100 md5 farki** olusuyor. Dolayisiyla:

> Bu md5'leri repo tarafiyla karsilastirmak **hicbir bilgi uretmez** — sonuc her satirda
> "farkli" cikardi ve bunlarin hangisinin gercek oldugu bilinemezdi. Karsilastirma **yapilmadi.**

**Yine de md5 olmadan olculebilen bir sey bulundu — `SECURITY DEFINER` bayragi:**

| Fonksiyon | Uretim | Repo | Etki |
|---|---|---|---|
| `handle_updated_at` | `false` | `true` | Repo surumu `SECURITY DEFINER`, uretim degil. `updated_at` damgasi atan basit bir tetikleyici oldugu icin **pratik etkisi dusuk**, ama zincir kosturuldugunda uretimden farkli bir ayricalik profili olusur |

Diger 29 ortak fonksiyonda `SECURITY DEFINER` bayragi **ayni**.

### 4d. Tam govdesi cekilmesi gerekenler (oncelik sirasiyla)

| # | Nesne | Neden |
|---|---|---|
| ~~1~~ | ~~`protect_sensitive_profile_fields()`~~ | ✅ **COZULDU** — tam tanim alindi, `04-goc-plani.md` FAZ -1'e islendi. Repoya alinmasi hala gerekli, ama karar girdisi olarak kapandi |
| 2 | `has_business_role()`, `is_business_member()` | 26 politika bunlara bagli; govde farki yetkiyi sessizce kaydirir |
| 3 | `owns_quote_request()`, `is_admin()`, `is_assignee()`, `is_professional_or_agency()` | Repoda yok; yetki fonksiyonlari |
| 4 | `on_quote_accepted_create_booking()` | Rezervasyon uretiyor, sifir `RAISE`; sessiz bozulma riski en yuksek |
| 5 | `handle_new_user()`, `notify_new_message()`, `deal_confirmed_customer_ids()` | Repoda iki surumlu; uretimde hangisi var bilinmiyor |
| 6 | 56 GRUP A politikasinin `qual`/`with_check` ifadeleri | Onarim migration'ini yazmak icin zorunlu |

Bunlar icin gereken sorgu bolum 7'de (7f/7g) verildi.

---

## 5. MUKERRER / GEREKSIZ INDEKSLER

Uretim dokumu uzerinde imza karsilastirmasi (tablo + erisim yontemi + sutun listesi + kismi kosul)
yapildi. **8 tam esleşen cift** + 1 kapsama cifti = **9 gereksiz indeks** bulundu.

### 5a. Tam eslesen ciftler (8)

| Tablo | Sutunlar | Indeksler | Not |
|---|---|---|---|
| `availability_blocks` | profile_id, blocked_date | **UNIQUE** `availability_blocks_profile_id_blocked_date_key` + `idx_availability_blocks_profile` | UNIQUE kisit indeksi, non-unique olani **tamamen kapsar** |
| `blog_posts` | slug | `blog_posts_slug_idx` + **UNIQUE** `blog_posts_slug_key` | UNIQUE kisit indeksi, non-unique olani **tamamen kapsar** |
| `bookings` | customer_id | `bookings_customer_id_idx` + `idx_bookings_customer` | Ikisi de non-unique — **birebir ayni** |
| `bookings` | professional_id | `bookings_professional_id_idx` + `idx_bookings_professional` | Ikisi de non-unique — **birebir ayni** |
| `bookings` | status | `bookings_status_idx` + `idx_bookings_status` | Ikisi de non-unique — **birebir ayni** |
| `profiles` | email | `profiles_email_idx` + **UNIQUE** `profiles_email_key` | UNIQUE kisit indeksi, non-unique olani **tamamen kapsar** |
| `review_replies` | review_id | `idx_review_replies_review` + **UNIQUE** `review_replies_review_id_key` | UNIQUE kisit indeksi, non-unique olani **tamamen kapsar** |
| `waitlist` | email | `waitlist_email_idx` + **UNIQUE** `waitlist_email_key` | UNIQUE kisit indeksi, non-unique olani **tamamen kapsar** |

### 5b. Kapsama cifti (1)

| Tablo | Indeksler | Iliski |
|---|---|---|
| `bookings` | `idx_bookings_event_date` (tam) · `bookings_event_date_idx` (kismi, `WHERE event_date IS NOT NULL`) | Tam indeks, kismi olani **kapsar**. Kismi olan gereksiz |

> Bildirilen 5 cift (bookings'te 4, availability_blocks'ta 1) **dogrulandi**. Uzerine 4 cift daha
> bulundu: `blog_posts(slug)`, `profiles(email)`, `review_replies(review_id)`, `waitlist(email)` —
> hepsi "UNIQUE kisit indeksi + gereksiz non-unique kopya" kalibinda.

### 5c. ⚠️ SILMEDEN ONCE KULLANIM DOGRULAMASI ZORUNLU

Iki indeks ayni sutunlari kapsiyor olsa bile **hangisinin planlayici tarafindan secildigi**
ve **kac kez kullanildigi** dokümden gorunmez. Silinecek olani yanlis secmek performans
regresyonu uretir. Silme oncesi:

```sql
-- Mukerrer adaylarin gercek kullanimi
select
  s.relname   as tablo,
  s.indexrelname as indeks,
  s.idx_scan  as tarama_sayisi,
  s.idx_tup_read, s.idx_tup_fetch,
  pg_size_pretty(pg_relation_size(s.indexrelid)) as boyut
from pg_stat_user_indexes s
where s.indexrelname in (
  'bookings_customer_id_idx','idx_bookings_customer',
  'bookings_professional_id_idx','idx_bookings_professional',
  'bookings_status_idx','idx_bookings_status',
  'bookings_event_date_idx','idx_bookings_event_date',
  'availability_blocks_profile_id_blocked_date_key','idx_availability_blocks_profile',
  'blog_posts_slug_idx','blog_posts_slug_key',
  'profiles_email_idx','profiles_email_key',
  'idx_review_replies_review','review_replies_review_id_key',
  'waitlist_email_idx','waitlist_email_key'
)
order by s.relname, s.idx_scan desc;
```

**Okuma kilavuzu:**
- `idx_scan = 0` olan → hic kullanilmamis, silme adayi (ama istatistikler son `pg_stat_reset`
  tarihinden itibarendir; kisa sureli sifirlanmis bir sayacta yaniltir).
- **UNIQUE olani ASLA silinmez** — o bir kisit indeksidir; silmek kisiti kaldirir.
  Ciftin non-unique olani silinir.
- `bookings`'teki uc cift **ikisi de non-unique**; burada `idx_scan` yuksek olani birakip
  digeri silinir. Esitse ad konvansiyonuna gore karar verilir.
- Silme **bu envanterin isi degildir**; ayri bir karar ve ayri bir migration.

---

## 6. ONARIM SIRASI ONERISI

**Onarim migration'i bu adimda YAZILMADI.** Bagimlilik: tablo → kisit/indeks → fonksiyon → politika → tetikleyici.

| Sira | Ne | Kapsam | Neden bu sirada |
|---|---|---|---|
| 1 | Tam govde dokumu al (7f/7g) | 6 fonksiyon + 56 politika ifadesi | Onarim metni bunlar olmadan yazilamaz |
| ~~2~~ | ~~`protect_sensitive_profile_fields()` govdesini incele~~ | — | ✅ **TAMAMLANDI.** Sonuc `04-goc-plani.md` FAZ -1'de. En onemli cikti: korunan iki alan (`approval_status`, `approved_at`) `providers`'a tasiniyor ve orada **koruma kalmiyor** → `providers` icin esdeger tetikleyici zorunlu |
| 3 | 13 tablonun DDL'i | Tablolar + PK/UNIQUE kisitlari | Zincirin kosabilmesi icin ilk esik. `service_packages` olmadan `20260625120000` patlar |
| 4 | 37 gercek eksik indeks | `CREATE INDEX` | Tablolardan sonra. `*_pkey`/`*_key` kendiliginden olusur |
| 5a | **`is_admin()` — EN ONCE** | 1 fonksiyon | 🔴 `protect_sensitive_profile_fields()` govdesinin **ilk satiri** `if public.is_admin(auth.uid()) then return new; end if;`. `is_admin` olmadan koruma tetikleyicisi olusturulamaz. Ayrica 11 politikadaki satir ici admin kapisinin fonksiyon karsiligi |
| 5b | Kalan 3 yetki fonksiyonu | `is_assignee`, `is_professional_or_agency`, `owns_quote_request` | 56 politikanin bir kismi bunlara bagli |
| 5c | Atama (3) → admin RPC (26) → diger (5) | 34 fonksiyon | `protect_sensitive_profile_fields` bu son grupta; 5a'dan **sonra** gelmek zorunda |
| 6 | 56 politika | Tablo + fonksiyon hazir olduktan sonra | Bagimliliklari 3 ve 5'te karsilanir |
| 7 | 6 tetikleyici | `protect_profile_fields` **en sona** | `profiles` yazma kapisi; digerlerinin dogrulugundan sonra. Bagimlilik zinciri: `is_admin` (5a) → `protect_sensitive_profile_fields` (5c) → `protect_profile_fields` tetikleyicisi (7) |
| 8 | GRUP B temizligi | 3 olu nesne | `update_conversation_last_message` + tetikleyicisi + adi degismis politika |
| 9 | Zincir dogrulamasi | Temiz DB | Uygula, ayni dokumu orada al, uretim dokumuyla karsilastir — bu kez **elmayla elma** |

> Adim 9, 4a'da olculen bicim farkini ortadan kaldiran tek yontemdir: iki taraf da
> `pg_get_functiondef`/`pg_indexes` ciktisi olur, md5 karsilastirmasi **anlamli** hale gelir.

---

## 7. RISK SIRALAMASI — sessiz bozulanlar en uste

| # | Nesne | Tur | Bozulma | Neden |
|---|---|---|---|---|
| 1 | `protect_sensitive_profile_fields()` + `protect_profile_fields` tetikleyicisi | Fonksiyon+trigger | 🔴 **SESSIZ** | `profiles` BEFORE UPDATE, **kara liste** (7 alan). Repoda yok; zincir kosturulursa koruma hic olusmaz ve korunan alanlar sessizce yazilabilir hale gelir. Gocte ayrica `approval_status`/`approved_at` `providers`'a tasindigi icin **orada da yeni bir tetikleyici gerekir** — aksi halde profesyonel kendi profilini onaylayabilir |
| 2 | `trg_remove_assignments_on_leave` | Trigger | 🔴 **SESSIZ** | `agency_members` uzerinde; uyelik gocunun **tam ortasinda** ve repoda izi yok. Uye ayrildiginda atamalar temizlenmezse sessizce hatali veri kalir |
| 3 | `on_quote_accepted_create_booking()` | Trigger fn | 🔴 **SESSIZ** | `bookings`'e yaziyor, sifir `RAISE EXCEPTION` |
| 4 | 12 bildirim fonksiyonu | Trigger fn | 🔴 **SESSIZ** | Hicbirinde `RAISE` yok |
| 5 | 4 yetki fonksiyonu (`is_admin`, `is_assignee`, `is_professional_or_agency`, `owns_quote_request`) | Fonksiyon | 🟠 **KARISIK** | Yoksa bagimli politika **olusturulamaz** (gurultulu). Ama govdesi farkli olsa yetki sessizce kayar |
| 6 | 56 eksik politika | Politika | 🟠 **KARISIK** | Politika yoksa RLS reddeder → gurultulu. Politika **fazla genisse** sessizce veri sizar |
| 7 | `handle_updated_at` SECURITY DEFINER farki | Fonksiyon | 🟡 DUSUK | Yalniz `updated_at` damgasi atiyor |
| 8 | 13 eksik tablo | Tablo | 🟡 GURULTULU | `relation does not exist` — hemen fark edilir |
| 9 | 9 gereksiz indeks | Indeks | 🟢 YOK | Dogruluk sorunu degil; yazma maliyeti ve disk |

---

## 8. EK DOKUM SORGULARI

Ilk dort dokum alindi. Grup C'yi kapatmak icin **tam govde** gereken iki sorgu:

### 8a. Fonksiyon tam govdeleri (oncelikli 6)

```sql
select proname, pg_get_functiondef(oid) as tanim
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    -- 'protect_sensitive_profile_fields' ALINDI (bkz. 04-goc-plani.md FAZ -1)
    'has_business_role', 'is_business_member',
    'owns_quote_request', 'is_admin', 'is_assignee', 'is_professional_or_agency',
    'on_quote_accepted_create_booking',
    'handle_new_user', 'notify_new_message', 'deal_confirmed_customer_ids'
  )
order by proname;
```

### 8b. Politika ifadeleri (56 GRUP A politikasi icin)

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

### 8c. Eksik tablolarin DDL'i

Supabase Dashboard → Database → Tables → ilgili tablo → **Definition** sekmesi,
ya da `pg_dump --schema-only -t public.<tablo>`. 13 tablo icin tek tek.

### 8d. Mukerrer indeks kullanimi

Bolum 5c'deki `pg_stat_user_indexes` sorgusu.

---

## 9. YONTEM VE SINIRLAR

- Repo tarafi dengeli-parantez ve `$$` govde ayristiricisiyla cikarildi; ham `grep -ic` sayimlariyla dogrulandi.
- `create or replace` zincirleri timestamp sirasina gore cozuldu; **son tanim gecerli** sayildi.
- Uretim tarafi 4 CSV dokumunden okundu (tirnakli alan + gomulu virgul destekli ayristirici).
- **Indeks ve tetikleyici** karsilastirmasi tam metin uzerinden, anlamsal normalizasyonla yapildi → **guvenilir**.
- **Fonksiyon ve politika govde** karsilastirmasi **yapilmadi**: dokum yalniz md5 iceriyor ve
  4a'da olculdugu gibi bu md5'ler repo kaynak metniyle karsilastirilamaz. Ad bazli A/B/D verildi,
  C icin "tam govde cekilmeli" isaretlendi.
- Tablo karsilastirmasi indeks dokumundeki `tablename` kolonundan turetildi. **Sinir:** hic indeksi
  olmayan bir tablo (PK'si bile olmayan) bu listede gorunmez. Uretimde 35 tablo bulundu ve bu sayi
  CLAUDE.md'deki "35 tablo" ile ortustugu icin liste tam kabul edildi.
- Mukerrer indeks tespiti imza (tablo+yontem+sutun+kosul) esitligine dayanir; kapsama iliskisi
  (kismi ⊂ tam) elle bulundu. Daha karmasik kapsamalar (or. `(a,b)` indeksi `(a)` sorgusunu
  karsilar) **taranmadi** — o ayri bir analizdir.
