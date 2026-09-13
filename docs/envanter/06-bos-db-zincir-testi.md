# 06 — Bos veritabanina zincir testi (yerel)

**Tarih:** 14 Eylul 2026
**Ortam:** Yerel PostgreSQL 16.13 (Supabase disi), her dosya kendi oturumunda, CLI'nin
`supabase_migrations.schema_migrations` tablosu birebir taklit edildi (version = PRIMARY KEY).
Supabase'e ozgu tek sim: `auth.users` tablosu, `auth.uid()`, `anon/authenticated/service_role`
rolleri, `supabase_realtime` yayini. `SET transaction_timeout` satiri PG16'da yorumlandi
(dal PG17, orada sorun degil).

**Amac:** Dali silip yeniden olusturmadan once zincirin bos DB'de nerede duracagini ve
bittiginde uretime esit olup olmadigini gormek. Test plani (bolum 5) asama 1 + asama 2'nin
yerel provasi.

---

## 1. Sonuc ozeti

| Adim | Sonuc |
|---|---|
| 44 dosya bos DB'de | **1 hata**: `04` → `invalid input value for enum listing_status: "pending_approval"` |
| + enum degerleri (00'a islendi) | 44/44 SQL hatasiz |
| CLI surum kaydi taklidi | **2 dosyada `schema_migrations_pkey` ihlali** (mukerrer zaman damgasi) |
| Zincir sonu sema vs uretim dokumu | **13 gercek fark** (Grup D — iki tarafta da var, tanimi farkli) |
| + `08_grup_d_farklari.sql` eklenince | sutun 374/374 · kisit 184/184 · fonksiyon 69/69 · govde 68/68 · tetikleyici 33/33 · politika 148/148 · indeks 157/157 · enum 14/14 — **fark 0** |
| Son hal (00 guncel + 2 yeniden ad + 08) | **45/45 dosya hatasiz, surum kaydi catismasiz, uretime fark 0** |

Yani dosya 00 dogru ve yeterliydi (is_admin sorunu kapandi); zincir 00'dan sonra ilk kez
`04`'te, o da bir **enum degeri** yuzunden duruyor.

---

## 2. Bulgular

### 2.1 Besinci bosluk kategorisi: mevcut enum'a sonradan eklenen degerler

`listing_status` uretimde `pending_approval` degerini iceriyor; zincirde `draft, published,
closed, filled, cancelled` ile bitiyor. `04`'teki `admin_queue_counts()` `LANGUAGE sql`
oldugu icin govdesi olusturma aninda dogrulanir ve orada patlar.

Zincirde hicbir `ALTER TYPE ... ADD VALUE` yok. 05-onarim-raporu bolum 3.1 yalniz **yeni**
bes tipin degerlerini uretimden cekmisti; **mevcut 7 tipin** (`agency_invitation_status`,
`agency_member_role`, `application_status`, `booking_status`, `listing_status`,
`message_type`, `quote_status`) uretimde ek deger alip almadigi bilinmiyor. Kod taramasi
yalniz `pending_approval`'i buluyor ama raporun kendi tespiti gecerli: kod taramasi enum
uyeligi icin yeterli kaynak degildir.

**Uretim pg_enum dokumu alindi (14 Eylul, bolum 4/A sorgusu).** 14 tipin 12'si zincirle
birebir; iki tipte sona eklenmis degerler var:

| Tip | Zincir | Uretimde ek |
|---|---|---|
| `listing_status` | draft, published, closed, filled, cancelled | + `pending_approval`, `rejected`, `revision` |
| `message_type` | text, quote, system | + `file` |

`00`'a "1b) Mevcut enum tiplerine sonradan eklenen degerler" bolumu eklendi: dort
`ALTER TYPE ... ADD VALUE IF NOT EXISTS ... AFTER ...` (sira uretime sabit). 00 icinde bu
degerler kullanilmadigi icin ayni islemde olmasi sorun degil (PostgreSQL 12+).

### 2.2 Mukerrer migration surumu (CLI'yi durdurur)

| Surum | Dosyalar |
|---|---|
| `20260711120000` | `business_write_pass_owner.sql`, `profil_redesign_adim1.sql` |
| `20260716120000` | `event_type_check_sync.sql`, `testimonials.sql` |

CLI her dosyadan sonra `INSERT INTO supabase_migrations.schema_migrations(version, ...)`
calistirir; `version` PRIMARY KEY'dir. Ikinci dosyada `duplicate key value violates unique
constraint "schema_migrations_pkey"` ile push durur. Daha kotusu: bu dosyalar kendi
`BEGIN/COMMIT`'ini tasidigi icin DDL commit olmus, surum kaydi yazilmamis olur (yarim durum).

Uretimde bu hic gorulmedi cunku dosyalar Dashboard'dan uygulanip `migration repair` ile
kaydedildi (bir surume tek satir).

**Gereken:** Push'tan ONCE ikinci dosyalari yeniden adlandir (sira degismez, yalniz
benzersizlesir):
`20260711120000_profil_redesign_adim1.sql` → `20260711120001_profil_redesign_adim1.sql`
`20260716120000_testimonials.sql` → `20260716120001_testimonials.sql`
Uretim tarafinda daha sonra: `supabase migration repair --status applied 20260711120001 20260716120001`.

### 2.3 Grup D gercek farklari — `08_grup_d_farklari.sql`

04-sema-uzlastirma ve 05-onarim-raporu "Grup D'ye dokunulmadi" demisti; karsilastirma
**repo kaynak metni** ile **Postgres render'i** arasinda yapildigi icin bicimsel gurultu
gercek farklari ortmustu. Bu testte iki taraf da Postgres tarafindan render edildi
(`pg_get_functiondef`, `pg_get_constraintdef`, `pg_policies`), gurultu sifir:

| Tur | Nesne | Zincir | Uretim |
|---|---|---|---|
| Fonksiyon | `handle_new_user` | 20260520151810 surumu | `city_id`, `kvkk_approved_at`, `approval_status` (client→approved, digerleri→pending), `approved_at` yazar |
| Fonksiyon | `on_quote_accepted_create_booking` | start/end_time yok | `start_time`, `end_time`'i bookings'e tasir |
| Politika | `conversations_select_participant` | sahip + pro | + `is_assignee(id, auth.uid())` |
| Politika | `messages_select_participant` | sahip + pro | + `is_assignee(c.id, auth.uid())` |
| Politika | `Quotes visible to conversation participants` | sahip + pro | + `is_assignee(...)` |
| Politika | `Professional creates quotes in their conversations` | `sender_id = auth.uid()` | atanan uye pro adina teklif verebilir |
| Politika (sil) | `Professionals apply to published listings` (applications) | var | yok — 06'daki "Pros and agencies apply..." yerine gecmis |
| CHECK | `listings_description_check` | `>= 30` | `>= 10` |
| CHECK | `listings_title_check` | `>= 10` | `>= 3` |
| CHECK | `notifications_type_check` | 3 tur | 5 tur (+`listing_invitation`, `booking_request`) |
| CHECK (sil) | `listings.valid_event_date` | var | yok |

Davranissal etkisi olmayan tek bir kalem yok: zincirle kurulan DB'de client kayitlari
`pending` kalir, davet bildirimi CHECK ihlaliyle duser, ajans atamalari mesajlari goremez.

`08` dosyasi: 2 `CREATE OR REPLACE` (govde uretim CSV'sinden birebir), 4 `DROP+CREATE POLICY`,
1 `DROP POLICY`, 3 kisit (tanim uretimle esitse atlanir), 1 `DROP CONSTRAINT`. Idempotan
(iki kez kosturuldu, ikinci kosu no-op). Uretimde islevsel etkisi yoktur.

Zincirin geri kalaninda (20260625 → 20260727) bu nesnelere dokunan dosya yok (grep ile
dogrulandi); 08'in `20260620090700` konumu zincir sonuna kadar korunur.

---

## 3. Dokumlerde OLMAYAN, dalda ayrica bakilmasi gerekenler

Uretim dokumleri yalniz `public` semasinin sutun/kisit/fonksiyon/tetikleyici/politika/
indekslerini kapsar. Su kalemler karsilastirilamadi:

- **`auth.users` uzerindeki tetikleyici** (`on_auth_user_created` → `handle_new_user`). Zincirde
  `ON auth.users` yazan tek satir yok; muhtemelen Dashboard'dan kuruldu. Dalda yoksa kayit
  olan kullanicinin profili olusmaz.
- tablo bazinda **RLS acik/kapali** bayragi (`relrowsecurity`)
- `supabase_realtime` yayin uyeligi
- view'lar (`professional_rating_summary` vb.), sequence'ler, GRANT'lar

Bolum 4'teki sorgu paketi bunlari da dokuyor; ayni sorgu dalda kosturulup fark alinir.

---

## 4. Uretimde kosturulacak sorgu paketi (Dashboard > SQL Editor, salt okunur)

```sql
-- A) Tum public enum degerleri, sirali
select t.typname, string_agg(e.enumlabel, ', ' order by e.enumsortorder) as degerler
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
group by t.typname
order by t.typname;

-- B) auth.users tetikleyicileri
select tgname, pg_get_triggerdef(oid)
from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;

-- C) RLS bayraklari
select relname, relrowsecurity, relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and relkind = 'r'
order by relname;

-- D) Realtime yayin uyeleri
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' order by tablename;

-- E) View'lar
select viewname from pg_views where schemaname = 'public' order by viewname;
```

---

## 5. Yeniden kosturma sirasi

1. ~~`00`'a enum degerleri bolumu~~ — yapildi (14 Eylul).
2. ~~Iki dosya yeniden adlandirildi~~ — yapildi (`git mv`).
3. ~~`08` `supabase/migrations/` altinda~~ — yapildi.
4. Dal silinir, Dashboard'dan yeniden olusturulur, yeni ref ile `supabase link`,
   `supabase migration list` ile hedefin dal oldugu (uretim `qydsooqmflrrwtgawhsv` DEGIL)
   dogrulanir, `supabase db push`.
5. Beklenti: **45 dosya**, hata yok (yerelde ayni set 45/45 gecti). Sonra bolum 4 sorgu
   paketi (B-E) dalda kosturulup uretim ciktisiyla karsilastirilir.
