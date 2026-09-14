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
5. ~~Beklenti: 45 dosya, hata yok~~ — 14 Eylul'de dalda 45/45 gecti. Devami bolum 6.

---

## 6. Asama 2 — dal ile uretim karsilastirmasi (14 Eylul, gercek dal `pkyauwyszvfvbzcgzrdb`)

Dal Dashboard'dan yeniden olusturuldu, `supabase db push` 45 dosyayi hatasiz uyguladi.
`asama2-parmak-izi.sql` (14 sinif, md5) uretimde ve dalda kosturuldu:

| Sinif | Sonuc |
|---|---|
| A sutun, B kisit, C indeks, D politika, E tetikleyici, G enum, H RLS, J view | **birebir esit** (adet + md5) |
| F fonksiyon | 69/69 var; 13 govde yalniz **satir sonu** (CRLF/LF) farkli, 1 gercek fark → bolum 6.1 |
| I realtime yayin | uretim 11, dal 7 → 09 |
| K auth.users tetikleyici | uretim 1, dal 0 → 09 |
| L storage bucket | uretim 6, dal 0 → 09 |
| M uzanti | uretim +pg_cron → 09 (yalniz uzanti; is tanimi haric, bolum 6.4) |
| N tablo yetkileri | uretim 777, dal 333 → 09, bolum 6.2 |

### 6.1 Fonksiyon govdeleri: satir sonu ve tek gercek fark

`asama2b-ayrinti.sql` F1/F2/F3 satirlari: uretimdeki **69 govdenin hepsinde `\r` var**
(Dashboard'a CRLF dosyalardan yapistirilmis). Dalda 56'sinda var, 13'unde yok — bu 13'u
LF kaydedilmis dosyalardan geliyor (20260630, 20260711130000, 20260715130000, 20260718, 08).
Boslugu normalize eden md5 (F2) 69 fonksiyonun **68'inde esit**. Postgres icin `\r` bosluktur;
davranis farki yoktur. **Fonksiyonlar icin olcut F2'dir (normalize md5), F1 degil.**

Tek gercek fark `protect_sensitive_profile_fields`: 04'teki govde ile uretim govdesi ayni
mantikta ama uretimde iki Turkce yorum satiri ve farkli satir duzeni var. Uretim
`pg_get_functiondef` ciktisi 04'e birebir islendi; 04 dosyasi CRLF'e normalize edildi
(cogunlugu zaten CRLF idi). Yerelde ham ve normalize md5 uretimle esit (2026fda3 / 5c5d4916).

### 6.2 Dalin varsayilan ayricaliklari uretimden farkli (platform farki)

`pg_default_acl` (N3):

| | postgres → tablolar | sequence | fonksiyon |
|---|---|---|---|
| Uretim (Mayis 2026 projesi) | anon/authenticated/service_role = `arwdDxtm` (ALL) | `rwU` | `X` |
| Dal (Eylul 2026 projesi) | anon/authenticated/service_role = `Dxtm` (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN — **SELECT/INSERT/UPDATE/DELETE yok**) | yok | yok |

Yeni Supabase projeleri daha dar varsayilanla geliyor. Sonuc: zincir dalda hatasiz kosuyor
ama uygulama RLS'e gelmeden GRANT katmaninda "permission denied" alir; RPC'ler (fonksiyonlar)
`authenticated` tarafindan cagrilamaz. Bu zincirin degil platformun farkidir, ama her yeni dal
ayni durumda dogacak; 09 uretim durumunu acik GRANT ve `ALTER DEFAULT PRIVILEGES` ile kurar.

Uretim fonksiyon ACL dokumu (asama2c/C): 63 fonksiyon `PUBLIC + anon + authenticated +
service_role`; 6 fonksiyon migration'larla daraltilmis (`admin_report_stats`: authenticated +
service_role; `admin_stats_messages`: PUBLIC + authenticated + service_role;
`deal_confirmed_customer_ids`, `delete_push_subscription_by_endpoint`,
`get_push_subscriptions_for_user`, `listing_application_counts`: anon + authenticated +
service_role, PUBLIC yok). 09 bunlari fonksiyon bazinda verir; toptan
`GRANT EXECUTE ON ALL FUNCTIONS` kullanilmadi cunku daraltilmislari yeniden acardi.

### 6.3 `09_platform_katmani.sql` — icerik ve konum

`20260727160000_faz_minus1_09_platform_katmani.sql` — **zincirin sonunda**. 202606200908xx
konumunda denendi, `type "business_member_role" does not exist` ile durdu: fonksiyon bazinda
GRANT icin nesnelerin tamami gerekir, onlar ancak zincir sonunda vardir.

| Bolum | Icerik | Kaynak |
|---|---|---|
| 1 | `on_auth_user_created AFTER INSERT ON auth.users → handle_new_user()` (pg_trigger kontrollu) | asama2b K |
| 2 | Yayina 4 tablo: conversations, listing_invitations, messages, notifications (pg_publication_tables kontrollu) | asama2b I |
| 3a | 6 bucket (public, boyut siniri, MIME) `ON CONFLICT (id) DO NOTHING` — VERI DEGISTIRILMEZ kuralinin bilincli tek istisnasi, yapilandirma satirlari | asama2b L |
| 3b | storage.objects uzerinde 21 politika, DROP IF EXISTS + CREATE | asama2b S |
| 4a | `GRANT ALL ON ALL TABLES / SEQUENCES IN SCHEMA public TO anon, authenticated, service_role` | asama2c G, D |
| 4b | `ALTER DEFAULT PRIVILEGES FOR ROLE postgres` (tablo ALL, sequence ALL, fonksiyon EXECUTE) | asama2b N3 |
| 4c | 69 fonksiyon icin GRANT/REVOKE EXECUTE, uretim proacl birebir | asama2c C |
| 5 | `CREATE EXTENSION IF NOT EXISTS pg_cron` | asama2b M |
| 6 | `listing_invitations REPLICA IDENTITY FULL` (uretimde 9 tablo FULL, zincir 8'ini kuruyor) | asama2c E |

Yerelde: 46/46 dosya hatasiz; 09 iki kez kosturuldu, ikinci kosu no-op. Parmak izi v2'de
I/K/L/N satirlari uretimle esit (11/40fa26ae, 1/ffa9bd9a, 6/8fffbe99, 777/215a55fd).

### 6.4 Bilincli disarida birakilan: cron isi

Uretimde tek pg_cron isi var: `send-message-notifications`, `*/5 * * * *`,
`net.http_post(url := 'https://qydsooqmflrrwtgawhsv.supabase.co/functions/v1/send-message-notification',
headers := {'Content-Type': 'application/json', 'Authorization': 'Bearer <URETIM_ANON_KEY>'}, body := '{}')`.

Bu is **migration'a alinmadi**: URL ve anahtar uretim projesine aittir; dalda Edge Function
yoktur; dal bu isi kosturursa uretim fonksiyonunu tetikler. Yeni bir projede kurulmasi
gerekirse `cron.schedule(...)` Dashboard'dan, o projenin URL/anahtariyla yapilir. Anahtar
buraya yazilmadi (anon key tarayiciya giden bir anahtardir ama repoya ait degildir).

### 6.5 Parmak izi v2

`asama2-parmak-izi.sql`'e uc satir eklendi: **O replica identity**, **P fonksiyon ACL**
(kume olarak — ACL dizisinin sirasi GRANT sirasina bagli, o yuzden normalize), **Q sequence ACL**.
Beklenti (dal yeniden kurulduktan sonra): A–E, G–L, N–Q birebir esit; F yalniz satir sonu
(F2 ile dogrulanir); M pg_cron surumu farkli olabilir (1.6.4 vs dalin kurdugu surum).

### 6.6 Kalan is sirasi

1. Commit → dal sil → Dashboard'dan yeniden olustur → `supabase link` → ref dogrula →
   `supabase migration list` (Remote bos) → `supabase db push` (**46 dosya**).
2. `asama2-parmak-izi.sql` (v2) uretim + dal; fark yalniz F ve olasi M surumunde kalmali.
   F icin `asama2b-ayrinti.sql` F2 satiri.
3. Asama 3 (uretime uygulama, dosya dosya) ve asama 4 (4 davranis testi) test planina gore.
4. Hijyen (asama 3'ten sonra): `.gitattributes` → `*.sql text eol=lf`, `git add --renormalize .`
   Bundan sonra fonksiyon karsilastirmalarinda normalize md5 olcut olarak kalir.
