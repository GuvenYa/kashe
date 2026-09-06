# Envanter 03 — Tetikleyici ve fonksiyon bagimlilik agaci

Kaynak: `supabase/migrations/` (36 dosya, 4 999 satir). HEAD = `46fcf49`.
**Yalniz okuma** ile uretildi; hicbir dosya degistirilmedi.

**Amac:** gocte uyelik tablolari (`agency_members`, `business_members`) birlesecek ve `bookings`
genisleyecek. Bu tablolara bagli tetikleyiciler tasinmazsa akislar **sessizce** bozulur.

## 0. OZET

| Nesne | Adet |
|---|---|
| `CREATE TRIGGER` | 28 |
| `CREATE [OR REPLACE] FUNCTION` | 35 tanim / 32 benzersiz ad |
| `CREATE POLICY` | 108 |
| `DROP TRIGGER` | 6 |
| `DROP POLICY` | 49 |

**Kanit:** ham `grep -ic` sayimlari — `create trigger` 28, `create or replace function` 26,
`create function` 9 (toplam 35), `create policy` 108. Ayristirici ciktisi bu sayilarla **birebir**.

---

## 1. TETIKLEYICI TABLOSU

| Tetikleyici | Tablo | Olay | Fonksiyon | Tanim |
|---|---|---|---|---|
| `on_agency_invitation_insert_notify` | `agency_invitations` | BEFORE INSERT | `on_agency_invitation_insert_notify` | `20260520071330_add_agency_role_and_members.sql:316` |
| `on_agency_invitation_status_change` | `agency_invitations` | BEFORE UPDATE | `on_agency_invitation_accepted_add_member` | `20260520071330_add_agency_role_and_members.sql:268` |
| `on_agency_member_insert_notify` | `agency_members` | AFTER INSERT | `on_agency_member_insert_notify_agency` | `20260520071330_add_agency_role_and_members.sql:348` |
| `on_agency_member_insert_validate_roles` | `agency_members` | BEFORE INSERT OR UPDATE | `validate_agency_membership_roles` | `20260520071330_add_agency_role_and_members.sql:91` |
| `applications_set_updated_at` | `applications` | BEFORE UPDATE | `update_updated_at_column` | `20260519133753_add_listings_and_applications.sql:222` |
| `on_application_insert_notify_owner` | `applications` | AFTER INSERT | `on_application_insert_notify_owner` | `20260519133753_add_listings_and_applications.sql:291` |
| `on_application_status_change_notify_applicant` | `applications` | BEFORE UPDATE | `on_application_status_change_notify_applicant` | `20260519133753_add_listings_and_applications.sql:348` |
| `on_business_invitation_insert_notify` | `business_invitations` | BEFORE INSERT | `on_business_invitation_insert_notify` | `20260630120000_add_business_members_and_invitations.sql:346` |
| `on_business_invitation_status_change` | `business_invitations` | BEFORE UPDATE | `on_business_invitation_accepted_add_member` | `20260630120000_add_business_members_and_invitations.sql:299` |
| `on_business_member_insert_notify` | `business_members` | AFTER INSERT | `on_business_member_insert_notify_business` | `20260630120000_add_business_members_and_invitations.sql:379` |
| `on_business_member_insert_validate_roles` | `business_members` | BEFORE INSERT OR UPDATE | `validate_business_membership_roles` | `20260630120000_add_business_members_and_invitations.sql:95` |
| `listings_set_updated_at` | `listings` | BEFORE UPDATE | `update_updated_at_column` | `20260519133753_add_listings_and_applications.sql:217` |
| `on_listing_publish_set_metadata` | `listings` | BEFORE INSERT OR UPDATE | `set_listing_published_at` | `20260519133753_add_listings_and_applications.sql:252` |
| `messages_update_conversation` | `messages` | AFTER INSERT | `update_conversation_last_message` | `20260518000000_initial_schema.sql:932` |
| `on_message_insert_notify` | `messages` | AFTER INSERT | `notify_new_message` | `20260518000000_initial_schema.sql:939` |
| `on_message_insert_update_conversation` | `messages` | AFTER INSERT | `update_conversation_last_message_at` | `20260518000000_initial_schema.sql:946` |
| `update_profile_experiences_updated_at` | `profile_experiences` | BEFORE UPDATE | `update_updated_at_column` | `20260711120000_profil_redesign_adim1.sql:52` |
| `on_profiles_updated` | `profiles` | BEFORE UPDATE | `handle_updated_at` | `20260518000000_initial_schema.sql:953` |
| `update_profiles_updated_at` | `profiles` | BEFORE UPDATE | `update_updated_at_column` | `20260518000000_initial_schema.sql:988` |
| `on_review_reply_insert_notify` | `review_replies` | AFTER INSERT | `notify_review_reply` | `20260518000000_initial_schema.sql:967` |
| `trg_review_replies_updated_at` | `review_replies` | BEFORE UPDATE | `touch_review_updated_at` | `20260518000000_initial_schema.sql:974` |
| `on_review_insert_notify` | `reviews` | AFTER INSERT | `notify_new_review` | `20260518000000_initial_schema.sql:960` |
| `trg_reviews_updated_at` | `reviews` | BEFORE UPDATE | `touch_review_updated_at` | `20260518000000_initial_schema.sql:981` |
| `update_services_updated_at` | `services` | BEFORE UPDATE | `update_updated_at_column` | `20260518000000_initial_schema.sql:995` |
| `on_quote_insert_notify_customer` | `quotes` | AFTER INSERT | `on_quote_insert_notify_customer` | `20260519110133_add_quotes_and_bookings.sql:314` |
| `on_quote_responded_notify_professional` | `quotes` | AFTER UPDATE | `on_quote_responded_notify_professional` | `20260519110133_add_quotes_and_bookings.sql:364` |
| `on_quote_status_change_create_booking` | `quotes` | BEFORE UPDATE | `on_quote_accepted_create_booking` | `20260519110133_add_quotes_and_bookings.sql:229` |
| `on_quote_status_change_post_system_message` | `quotes` | AFTER UPDATE | `on_quote_status_change_post_system_message` | `20260519110133_add_quotes_and_bookings.sql:277` |

### 1a. Ayni tabloda ortusen tetikleyiciler (risk)

| Tablo | Tetikleyiciler | Sorun |
|---|---|---|
| `profiles` | `on_profiles_updated` → `handle_updated_at` · `update_profiles_updated_at` → `update_updated_at_column` | **Iki tetikleyici ayni isi iki farkli fonksiyonla** yapiyor (BEFORE UPDATE, updated_at damgasi). Gocte biri tasinip digeri unutulursa fark edilmez. |
| `public.messages` | `messages_update_conversation` → `update_conversation_last_message` · `on_message_insert_update_conversation` → `update_conversation_last_message_at` | Iki AFTER INSERT tetikleyici, benzer adli iki ayri fonksiyon. Hangisinin gecerli oldugu koddan net degil — **incelenmeli**. |
| `public.reviews` / `public.review_replies` | `trg_reviews_updated_at` · `trg_review_replies_updated_at` → ikisi de `touch_review_updated_at` | Ayni fonksiyon iki tabloda; tasima sirasinda ikisi birden gitmeli. |

---

## 2. FONKSIYON TABLOSU

Okudugu/yazdigi tablolar fonksiyon govdesinden (`FROM`, `JOIN`, `INSERT INTO`, `UPDATE ... SET`,
`DELETE FROM`) cikarildi. `SD` = `SECURITY DEFINER`.

| Fonksiyon | Argumanlar | Okudugu | Yazdigi | SD | Cagiran | Tanim |
|---|---|---|---|---|---|---|
| `admin_report_stats` | `—` | profiles, bookings, quotes | — | ✓ | uygulama katmani / yok | `20260715130000_admin_report_stats.sql:14` |
| `deal_confirmed_customer_ids` | `p_professional uuid, p_customers uuid[]` | bookings | — | ✓ | uygulama katmani / yok | `20260711130000_deal_confirmed_customer_ids.sql:26` |
| `deal_confirmed_customer_ids` | `p_professional uuid, p_customers uuid[]` | bookings | — | ✓ | uygulama katmani / yok | `20260711150000_deal_confirmed_cap.sql:10` |
| `handle_new_user` | `—` | — | profiles | ✓ | uygulama katmani / yok | `20260518000000_initial_schema.sql:41` |
| `handle_new_user` | `—` | — | profiles | ✓ | uygulama katmani / yok | `20260520151810_fix_handle_new_user_for_agency.sql:13` |
| `handle_updated_at` | `—` | — | — | ✓ | 1 tetikleyici | `20260518000000_initial_schema.sql:74` |
| `has_business_role` | `p_business_id uuid, p_min_role business_member` | business_members | — | ✓ | 16 politika | `20260707120000_business_write_pass_messages.sql:36` |
| `has_business_role_on_request` | `p_request_id uuid, p_min_role business_member_` | quote_requests | — | ✓ | uygulama katmani / yok | `20260708120000_business_write_pass_create.sql:45` |
| `is_business_member` | `p_business_id UUID` | business_members | — | ✓ | 10 politika | `20260630120000_add_business_members_and_invitations.sql:157` |
| `is_business_member_of_request` | `p_request_id uuid` | quote_requests, business_members | — | ✓ | uygulama katmani / yok | `20260703120000_fix_recipients_policy_recursion.sql:9` |
| `listing_application_counts` | `listing_ids uuid[]` | applications | — | ✓ | uygulama katmani / yok | `20260718120000_listing_application_counts_rpc.sql:13` |
| `notify_new_message` | `—` | conversations | notifications | ✓ | 1 tetikleyici | `20260518000000_initial_schema.sql:88` |
| `notify_new_message` | `—` | conversations | notifications | ✓ | 1 tetikleyici | `20260519115516_filter_notify_new_message_by_type.sql:11` |
| `notify_new_review` | `—` | — | notifications | ✓ | 1 tetikleyici | `20260518000000_initial_schema.sql:125` |
| `notify_review_reply` | `—` | reviews | notifications | ✓ | 1 tetikleyici | `20260518000000_initial_schema.sql:147` |
| `on_agency_invitation_accepted_add_member` | `—` | profiles, agencies | agency_members | ✓ | 1 tetikleyici | `20260520071330_add_agency_role_and_members.sql:219` |
| `on_agency_invitation_insert_notify` | `—` | profiles | notifications | ✓ | 1 tetikleyici | `20260520071330_add_agency_role_and_members.sql:277` |
| `on_agency_member_insert_notify_agency` | `—` | profiles | notifications | ✓ | 1 tetikleyici | `20260520071330_add_agency_role_and_members.sql:325` |
| `on_application_insert_notify_owner` | `—` | listings, profiles | notifications | ✓ | 1 tetikleyici | `20260519133753_add_listings_and_applications.sql:261` |
| `on_application_status_change_notify_applicant` | `—` | listings | notifications | ✓ | 1 tetikleyici | `20260519133753_add_listings_and_applications.sql:300` |
| `on_business_invitation_accepted_add_member` | `—` | profiles | business_members | ✓ | 1 tetikleyici | `20260630120000_add_business_members_and_invitations.sql:256` |
| `on_business_invitation_insert_notify` | `—` | profiles | notifications | ✓ | 1 tetikleyici | `20260630120000_add_business_members_and_invitations.sql:308` |
| `on_business_member_insert_notify_business` | `—` | profiles | notifications | ✓ | 1 tetikleyici | `20260630120000_add_business_members_and_invitations.sql:355` |
| `on_quote_accepted_create_booking` | `—` | conversations | bookings | ✓ | 1 tetikleyici | `20260519110133_add_quotes_and_bookings.sql:183` |
| `on_quote_insert_notify_customer` | `—` | conversations, profiles | notifications | ✓ | 1 tetikleyici | `20260519110133_add_quotes_and_bookings.sql:286` |
| `on_quote_responded_notify_professional` | `—` | conversations, profiles | notifications | ✓ | 1 tetikleyici | `20260519110133_add_quotes_and_bookings.sql:323` |
| `on_quote_status_change_post_system_message` | `—` | — | messages | ✓ | 1 tetikleyici | `20260519110133_add_quotes_and_bookings.sql:238` |
| `pg_temp._norm_lang` | `v text` | — | — |  | uygulama katmani / yok | `20260727140000_language_pairs_to_dictionary.sql:63` |
| `set_listing_published_at` | `—` | — | — | ✓ | 1 tetikleyici | `20260519133753_add_listings_and_applications.sql:231` |
| `touch_review_updated_at` | `—` | — | — |  | 2 tetikleyici | `20260518000000_initial_schema.sql:181` |
| `update_conversation_last_message` | `—` | — | conversations | ✓ | 1 tetikleyici | `20260518000000_initial_schema.sql:195` |
| `update_conversation_last_message_at` | `—` | — | conversations | ✓ | 1 tetikleyici | `20260518000000_initial_schema.sql:211` |
| `update_updated_at_column` | `—` | — | — |  | 5 tetikleyici | `20260518000000_initial_schema.sql:229` |
| `validate_agency_membership_roles` | `—` | profiles | — |  | 1 tetikleyici | `20260520071330_add_agency_role_and_members.sql:68` |
| `validate_business_membership_roles` | `—` | profiles | — |  | 1 tetikleyici | `20260630120000_add_business_members_and_invitations.sql:76` |

### 2a. Birden fazla surumu olan fonksiyonlar

| Fonksiyon | Surumler | Gecerli olan |
|---|---|---|
| `handle_new_user` | `20260518000000_initial_schema.sql:41` · `20260520151810_fix_handle_new_user_for_agency.sql:13` | **20260520151810_fix_handle_new_user_for_agency.sql:13** (migration sirasinda son uygulanan) |
| `notify_new_message` | `20260518000000_initial_schema.sql:88` · `20260519115516_filter_notify_new_message_by_type.sql:11` | **20260519115516_filter_notify_new_message_by_type.sql:11** (migration sirasinda son uygulanan) |
| `deal_confirmed_customer_ids` | `20260711130000_deal_confirmed_customer_ids.sql:26` · `20260711150000_deal_confirmed_cap.sql:10` | **20260711150000_deal_confirmed_cap.sql:10** (migration sirasinda son uygulanan) |

> Migration dosyalari zaman damgasiyla siralandigi icin "gecerli olan" = en son timestamp.
> `CREATE OR REPLACE` oncekini ezer.

---

## 3. GOCTE ETKILENENLER

### GRUP A — Uyelik tablolarina bagli

`agency_members`, `business_members`, `agency_invitations`, `business_invitations`.
Bunlar `organization_memberships`'e tasinacak.

**Tetikleyiciler (7):**

| Tetikleyici | Tablo | Olay | Fonksiyon | Ne yapiyor |
|---|---|---|---|---|
| `on_agency_member_insert_validate_roles` | `agency_members` | BEFORE INSERT OR UPDATE | `validate_agency_membership_roles` | Uyelik satirinda ajans/profesyonel rollerini dogrular |
| `on_agency_invitation_status_change` | `agency_invitations` | BEFORE UPDATE | `on_agency_invitation_accepted_add_member` | pending→accepted gecisinde `agency_members` satiri olusturur |
| `on_agency_invitation_insert_notify` | `agency_invitations` | BEFORE INSERT | `on_agency_invitation_insert_notify` | Yeni ajans daveti → davet edilene bildirim |
| `on_agency_member_insert_notify` | `agency_members` | AFTER INSERT | `on_agency_member_insert_notify_agency` | incelenmeli |
| `on_business_member_insert_validate_roles` | `business_members` | BEFORE INSERT OR UPDATE | `validate_business_membership_roles` | Uyelik satirinda kurum/uye rollerini dogrular |
| `on_business_invitation_status_change` | `business_invitations` | BEFORE UPDATE | `on_business_invitation_accepted_add_member` | pending→accepted gecisinde `business_members` satiri olusturur |
| `on_business_invitation_insert_notify` | `business_invitations` | BEFORE INSERT | `on_business_invitation_insert_notify` | Yeni kurum daveti → davet edilene bildirim |
| `on_business_member_insert_notify` | `business_members` | AFTER INSERT | `on_business_member_insert_notify_business` | incelenmeli |

**Fonksiyonlar (uyelik tablolarina dokunan, 5):**

| Fonksiyon | Okur | Yazar | Tanim |
|---|---|---|---|
| `on_agency_invitation_accepted_add_member` | — | agency_members | `20260520071330_add_agency_role_and_members.sql:219` |
| `is_business_member` | business_members | — | `20260630120000_add_business_members_and_invitations.sql:157` |
| `on_business_invitation_accepted_add_member` | — | business_members | `20260630120000_add_business_members_and_invitations.sql:256` |
| `is_business_member_of_request` | business_members | — | `20260703120000_fix_recipients_policy_recursion.sql:9` |
| `has_business_role` | business_members | — | `20260707120000_business_write_pass_messages.sql:36` |

**RLS politikalari:** `has_business_role` **16** politikada, `is_business_member` **10** politikada
cagriliyor. Bu iki fonksiyonun govdesi `organization_memberships`'e cevrildiginde 26 politika
**otomatik** dogru calisir — politika govdeleri degismez. Bu, goc planinin (`04-goc-plani.md:172`)
"fonksiyon cagirma aliskanligi" tespitini dogrular.

### GRUP B — `bookings`'e bagli

| Fonksiyon | Okur | Yazar | Cagiran | Tanim |
|---|---|---|---|---|
| `on_quote_accepted_create_booking` | — | bookings | on_quote_status_change_create_booking | `20260519110133_add_quotes_and_bookings.sql:183` |
| `deal_confirmed_customer_ids` | bookings | — | uygulama katmani | `20260711130000_deal_confirmed_customer_ids.sql:26` |
| `deal_confirmed_customer_ids` | bookings | — | uygulama katmani | `20260711150000_deal_confirmed_cap.sql:10` |
| `admin_report_stats` | bookings | — | uygulama katmani | `20260715130000_admin_report_stats.sql:14` |

**`on_quote_accepted_create_booking` zinciri:**

```
quotes UPDATE (status: pending -> accepted)
  └─ TRIGGER on_quote_status_change_create_booking  (BEFORE UPDATE, quotes)
       └─ FUNCTION on_quote_accepted_create_booking  → INSERT INTO bookings
  └─ TRIGGER on_quote_status_change_post_system_message  (AFTER UPDATE, quotes)
       └─ FUNCTION on_quote_status_change_post_system_message  → INSERT INTO messages
```

🔴 `on_quote_accepted_create_booking` govdesinde **`RAISE EXCEPTION` yok**. Tetikleyici
tasinmazsa teklif kabul edilir, durum `accepted` olur, **rezervasyon olusmaz** ve hicbir
hata gorunmez. Sessiz bozulma listesinin (bolum 5) en ustundeki yazma islemi bu.

### GRUP C — `profiles`'a bagli

`profiles` okuyan/yazan **14 fonksiyon**:

| Fonksiyon | SD | Tanim |
|---|---|---|
| `handle_new_user` | ✓ | `20260518000000_initial_schema.sql:41` |
| `on_quote_insert_notify_customer` | ✓ | `20260519110133_add_quotes_and_bookings.sql:286` |
| `on_quote_responded_notify_professional` | ✓ | `20260519110133_add_quotes_and_bookings.sql:323` |
| `on_application_insert_notify_owner` | ✓ | `20260519133753_add_listings_and_applications.sql:261` |
| `validate_agency_membership_roles` |  | `20260520071330_add_agency_role_and_members.sql:68` |
| `on_agency_invitation_accepted_add_member` | ✓ | `20260520071330_add_agency_role_and_members.sql:219` |
| `on_agency_invitation_insert_notify` | ✓ | `20260520071330_add_agency_role_and_members.sql:277` |
| `on_agency_member_insert_notify_agency` | ✓ | `20260520071330_add_agency_role_and_members.sql:325` |
| `handle_new_user` | ✓ | `20260520151810_fix_handle_new_user_for_agency.sql:13` |
| `validate_business_membership_roles` |  | `20260630120000_add_business_members_and_invitations.sql:76` |
| `on_business_invitation_accepted_add_member` | ✓ | `20260630120000_add_business_members_and_invitations.sql:256` |
| `on_business_invitation_insert_notify` | ✓ | `20260630120000_add_business_members_and_invitations.sql:308` |
| `on_business_member_insert_notify_business` | ✓ | `20260630120000_add_business_members_and_invitations.sql:355` |
| `admin_report_stats` | ✓ | `20260715130000_admin_report_stats.sql:14` |

**RLS tarafi:** `profiles` alt sorgusu iceren politika sayisi: **21**.
Bunlarin cogu `p.role` veya `p.is_admin` okuyor. `role` ve `is_admin` **profiles'ta kaliyor**,
dolayisiyla bu 21 politika gocten dogrudan etkilenmez. Ancak `p.is_published` /
`p.approval_status` okuyan politikalar `providers`'a bakmak zorunda kalir — bunlar
`docs/envanter/02-profiles-kullanimi.md` bolum 5e ile birlikte degerlendirilmeli.

---

## 4. BILDIRIM ZINCIRI

`notify_*` ve `on_*_notify_*` bicimli **12 fonksiyon tanimi** (11 benzersiz).
Hepsi `notifications` tablosuna yaziyor ve **hicbirinde `RAISE EXCEPTION` yok**.

| Fonksiyon | Tetiklenme kosulu | Tanim |
|---|---|---|
| `notify_new_message` | `messages` AFTER INSERT | `20260518000000_initial_schema.sql:88` |
| `notify_new_message` | `messages` AFTER INSERT | `20260519115516_filter_notify_new_message_by_type.sql:11` |
| `notify_new_review` | `reviews` AFTER INSERT | `20260518000000_initial_schema.sql:125` |
| `notify_review_reply` | `review_replies` AFTER INSERT | `20260518000000_initial_schema.sql:147` |
| `on_agency_invitation_insert_notify` | `agency_invitations` BEFORE INSERT | `20260520071330_add_agency_role_and_members.sql:277` |
| `on_agency_member_insert_notify_agency` | `agency_members` AFTER INSERT | `20260520071330_add_agency_role_and_members.sql:325` |
| `on_application_insert_notify_owner` | `applications` AFTER INSERT | `20260519133753_add_listings_and_applications.sql:261` |
| `on_application_status_change_notify_applicant` | `applications` BEFORE UPDATE | `20260519133753_add_listings_and_applications.sql:300` |
| `on_business_invitation_insert_notify` | `business_invitations` BEFORE INSERT | `20260630120000_add_business_members_and_invitations.sql:308` |
| `on_business_member_insert_notify_business` | `business_members` AFTER INSERT | `20260630120000_add_business_members_and_invitations.sql:355` |
| `on_quote_insert_notify_customer` | `quotes` AFTER INSERT | `20260519110133_add_quotes_and_bookings.sql:286` |
| `on_quote_responded_notify_professional` | `quotes` AFTER UPDATE | `20260519110133_add_quotes_and_bookings.sql:323` |

> `notify_new_message` iki surumlu (bkz. 2a); tetikleyici `on_message_insert_notify`
> (AFTER INSERT, `public.messages`) gecerli surumu cagirir.

**Goc riski:** bildirim kaybi kullaniciya **gorunmez**. Bir tetikleyici tasinmazsa
kullanici "bildirim gelmedi" der ama loglarda hicbir iz olmaz. Goc sonrasi her bildirim
yolu icin **uctan uca tek bir manuel test** yapilmasi gerekir; kod incelemesi yeterli degildir.

---

## 5. RISK SIRALAMASI — sessiz bozulanlar en ustte

**Puanlama (heuristik, karar degil):** tetikleyiciye bagli +2 · `RAISE EXCEPTION` yok +3 ·
kosullu erken cikis +2 · yazma yapiyor +2 · bildirim uretiyor +1.
Yuksek puan = **bozuldugunda hata vermez, sadece calismaz**.

| # | Puan | Fonksiyon | Yazdigi | RAISE | Bozulursa ne olur |
|---|---|---|---|---|---|
| 1 | 10 | `notify_new_message` | notifications | 0 | Mesaj gider, bildirim olusmaz |
| 2 | 10 | `notify_new_message` | notifications | 0 | Mesaj gider, bildirim olusmaz |
| 3 | 10 | `notify_review_reply` | notifications | 0 | Yorum yaniti kaydedilir, bildirim olusmaz |
| 4 | 10 | `on_agency_invitation_insert_notify` | notifications | 0 | Davet olusur, davet edilen haberdar olmaz |
| 5 | 10 | `on_application_status_change_notify_applicant` | notifications | 0 | Basvuru durumu degisir, basvuran haberdar olmaz |
| 6 | 10 | `on_business_invitation_insert_notify` | notifications | 0 | Davet olusur, davet edilen haberdar olmaz |
| 7 | 10 | `on_quote_responded_notify_professional` | notifications | 0 | Teklife yanit verilir, profesyonel haberdar olmaz |
| 8 | 9 | `on_quote_accepted_create_booking` | bookings | 0 | 🔴 **Teklif kabul edilir, REZERVASYON OLUSMAZ** |
| 9 | 9 | `on_quote_status_change_post_system_message` | messages | 0 | Durum degisir, konusmaya sistem mesaji dusmez |
| 10 | 8 | `notify_new_review` | notifications | 0 | Yorum yazilir, bildirim olusmaz |
| 11 | 8 | `on_agency_member_insert_notify_agency` | notifications | 0 | Uye eklenir, ajans haberdar olmaz |
| 12 | 8 | `on_application_insert_notify_owner` | notifications | 0 | Basvuru gelir, ilan sahibi haberdar olmaz |
| 13 | 8 | `on_business_member_insert_notify_business` | notifications | 0 | Uye eklenir, kurum haberdar olmaz |
| 14 | 8 | `on_quote_insert_notify_customer` | notifications | 0 | Teklif gelir, musteri haberdar olmaz |
| 15 | 7 | `set_listing_published_at` | — | 0 | Ilan yayinlanir, published_at damgasi bos kalir |
| 16 | 7 | `update_conversation_last_message` | conversations | 0 | Mesaj gider, konusma listesi guncellenmez |
| 17 | 7 | `update_conversation_last_message_at` | conversations | 0 | Mesaj gider, siralama bozulur |
| 18 | 6 | `on_agency_invitation_accepted_add_member` | agency_members | 2 | Davet accepted olur, **uyelik satiri olusmaz** (2 RAISE var — kismen gurultulu) |
| 19 | 6 | `on_business_invitation_accepted_add_member` | business_members | 1 | Davet accepted olur, **uyelik satiri olusmaz** (1 RAISE var — kismen gurultulu) |
| 20 | 5 | `handle_new_user` | profiles | 0 | Kullanici kaydolur, profil satiri olusmaz |

### 5a. En kritik uc nokta

1. 🔴 **`on_quote_accepted_create_booking`** — GRUP B. Yazma yapiyor (`bookings`), sifir `RAISE`.
   Bozulursa para/rezervasyon akisi sessizce durur. `bookings` genisletilirken bu tetikleyicinin
   tasindigi **testle** dogrulanmali.
2. 🔴 **Iki davet-kabul tetikleyicisi** — GRUP A. `RAISE EXCEPTION` iceriyorlar ama yalniz
   "kullanici bulunamadi" ve "rol yanlis" dallarinda. **Tetikleyicinin kendisi tasinmazsa**
   `status = accepted` guncellemesi basariyla gecer ve uyelik satiri hic olusmaz — bu dal sessizdir.
3. 🟠 **12 bildirim fonksiyonu** — hicbirinde `RAISE` yok. Kaybi yalnizca kullanici sikayetiyle anlasilir.

### 5b. Gurultulu (goreceli guvenli) fonksiyonlar

35 tanimdan yalniz **5 tanesinde** `RAISE EXCEPTION` var:
`on_agency_invitation_accepted_add_member` (2) · `on_business_invitation_accepted_add_member` (1) · `validate_agency_membership_roles` (2) · `validate_business_membership_roles` (1) · `admin_report_stats` (1)

Kalan **30 fonksiyon** basarisizlik durumunda sessiz kalir.

---

## 6. YONTEM VE SINIRLAR

- Tetikleyici/fonksiyon/politika sayilari dengeli-parantez ve `$$` govde ayristiricisiyla
  cikarildi; ham `grep -ic` sayimlariyla **birebir** uyusuyor (28 / 35 / 108).
- Okudugu/yazdigi tablolar govde icindeki `FROM`/`JOIN`/`INSERT INTO`/`UPDATE ... SET`/
  `DELETE FROM` kaliplariyla bulundu. **Sinir:** dinamik SQL (`EXECUTE format(...)`) varsa
  yakalanmaz; bu repoda dinamik SQL kullanan trigger fonksiyonu tespit edilmedi ama
  ayrica dogrulanmadi — **incelenmeli**.
- Sessizlik puani bir **heuristiktir**, karar degildir. `RAISE EXCEPTION` yoklugu
  "kesin sessiz" demek degil; kisit ihlali (FK, NOT NULL) yine hata uretebilir.
  Puan, incelemeye nereden baslanacagini soyler.
- Politika→fonksiyon eslemesi yalniz bilinen alti yardimci adi icin arandi.
  `is_admin` bu repoda **fonksiyon olarak yok** (bkz. `01-rol-kontrolleri.md` bolum 5b);
  admin kapisi 11 yerde satir ici `EXISTS` ile tekrarlaniyor.
