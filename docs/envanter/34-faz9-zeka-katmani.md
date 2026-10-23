# FAZ 9 — Zeka katmani (olay zinciri · fiyat kiyaslari · Trust Score V0)

**Kaynak plan:** `04-goc-plani.md` FAZ 9 madde 39-41; `01-veri-modeli.md` bolum 11 (`analytics_events`, `price_benchmarks`); `00-genel-bakis.md`
"Karar zinciri" (Outcome Learning) ve "Temel ilkeler" (once calisan ve olculen surum; olcmeden tutma; veri dongusu asil varlik; adalet
olculur); `02-guvenlik-modeli.md` bolum 7 (aciklanabilirlik: gerekce kodlari; itiraz hakki) ve 8 (KVKK); `18-faz6-eslestirme-ekip.md`
(Match V0.2: `high_trust` = `trust_score >= 70` ya da `avg_rating >= 4.5 && cnt >= 3`; `new_talent` = `cnt < 3`; ekle-yalniz kosu kurali).
**Durum:** PLAN (23 Ekim 2026). Sira: 9a olay zinciri -> 9b fiyat kiyaslari -> 9c Trust Score V0 -> kapanis. Her dilim: migration -> dal
(asama4 + asama19) -> uretim -> Claude Code uygulama -> canli tur -> kapanis notu.

## 1. Kararlar (Guven, 23 Ekim 2026)

1. **Ucu de V0 simdi, ogrenme 2027.** 9a/9b/9c kural tabanli, aciklanabilir, olculebilir surumlerle Ekim-Aralik 2026'da kurulur; veri
   birikmeye baslar. TUBITAK Ar-Ge donemi (IP2 ay 3-6, IP3 ay 4-8, IP5 ay 8-12) ogrenen katmani alir: Match V1 (`acceptance_prob`,
   ogrenen agirliklar), Trust V1 (sonuca gore kalibrasyon), fiyat modeli (tur/sezon/kapasite etkisi), pilot olcumu. V0 altyapidir;
   "Ar-Ge projede yapilmali" kosulu ogrenme katmaninda karsilanir.
2. **Olaylari DB tetikleyicileri yazar.** Durum gecisleri (`event_briefs`, `match_runs`, `match_candidates`, `crew_members`,
   `proposal_versions`/`proposals`, `quotes`, `rfps`, `bookings`) tetikleyiciyle `analytics_events`'e duser; uygulama olay YAZMAZ; gecmis
   mevcut satirlardan dolar. Salt UI olaylari (profil goruntuleme, Kesfet filtresi) kopyalanmaz — kendi tablolarindan okunur ya da V1'e.
3. **Trust Score V0 sistem ici + saglayici kendi dokumunu gorur.** Skor yalniz eslestirme/siralamada kullanilir (bugunku `high_trust`
   kodu dolar); saglayici `/profil`'de bilesenlerini ve "itiraz et" kanalini gorur (KVKK). Musteriye sayi gosterilmez; mevcut guven cipleri
   (gercek sinyaller) kalir.
4. **Fiyat kiyasi hucresi rol x sehir x etkinlik turu;** son 90 gun kayan pencere, aylik degil gunluk hesap; yayin esigi 15 islem;
   esik alti hucre yayinlanmaz, UI hicbir sey gostermez. (Oneri — bkz. bolum 6 soru 1: ayni hesapta `event_type = NULL` "tum turler"
   satiri da uretilsin ki dar hucre dolmadiginda kaba kiyas gosterilebilsin.)

## 2. 9a — Olay zinciri (`analytics_events`)

### Tablo

```
analytics_events                    -- EKLE-YALNIZ; uygulama yazmaz, yalniz tetikleyici (SECURITY DEFINER)
  id                 bigint identity pk
  event_name         text not null   -- sozluk asagida; CHECK listesi
  occurred_at        timestamptz not null default now()   -- dolumda kaynak satirin zamani
  actor_user_id      uuid null       -- auth.uid(); cron/dolum NULL
  organization_id    uuid null       -- ilgili kurulus (alici ya da satici; sozlukte belirtilir)
  provider_id        uuid null       -- ilgili saglayici (gosterim, tik, secim, teklif, rezervasyon)
  entity_type        text not null   -- brief | event | match_run | match_candidate | crew_member | proposal | quote | rfp | booking
  entity_id          uuid not null
  algorithm_version  text null       -- match kosusundan tasinir (gosterim/tik/secim)
  payload            jsonb not null default '{}'   -- sozlukte alanlar; PII YOK (ad, e-posta, telefon, not yazilmaz)
  created_at         timestamptz not null default now()
```

Indeksler: `(event_name, occurred_at desc)`, `(provider_id, occurred_at desc) where provider_id is not null`, `(entity_type, entity_id)`,
`(organization_id, occurred_at desc) where organization_id is not null`. RLS: SELECT yalniz `is_admin`; authenticated INSERT/UPDATE/DELETE
YOK (grant yok); tetikleyiciler SECURITY DEFINER. `service_role` SELECT (Edge/rapor). Saklama: V0'da silme yok; 24 ay sonra arsiv
karari FAZ 10.

### Olay sozlugu (V0) — ad · kaynak tetikleyici · payload

| event_name | Kaynak | payload |
|---|---|---|
| `brief_created` | `event_briefs` INSERT | `source`, `organization_id`, `has_attachments` |
| `event_confirmed` | `events` status -> `confirmed` | `event_type`, `city_id`, `participant_count`, `budget_min/max`, `is_date_flexible`, `organization_id` |
| `event_cancelled` / `event_completed` | `events` status -> `cancelled` / `completed` | `event_type`, `city_id` |
| `match_run` | `match_runs` INSERT | `strategy`, `algorithm_version`, `params` (agirliklar), `candidate_count`, `latency_ms` |
| `match_shown` | `match_candidates` UPDATE `was_shown` false->true | `role_id`, `final_rank`, `match_score`, `reason_codes`, `provider_type`, `is_new_talent` (reason_codes'ta `new_talent`) |
| `match_clicked` | `match_candidates` UPDATE `was_clicked` false->true | ayni |
| `crew_selected` | `crew_members` INSERT | `role_id`, `pool_origin`, `from_match` (match_candidate_id dolu mu), `crew_strategy` |
| `crew_confirmed` / `crew_declined` | `crew_members` status -> `confirmed` / `declined` | `role_id`, `pool_origin` |
| `proposal_sent` | `proposal_versions.sent_at` NULL -> dolu | `version_no`, `total_amount`, `item_count`, `rfp_id` dolu mu, `source_type` |
| `proposal_approved` / `proposal_declined` / `proposal_revision` | `proposals` status gecisi | `version_no`, `total_amount`, portal mi (approved_by_name dolu) |
| `quote_created` | `quotes` INSERT (pazaryeri pro teklifi) | `total_amount`, `over_budget`, `event_type` (conversation) |
| `quote_accepted` / `quote_declined` | `quotes` status gecisi | `total_amount` |
| `rfp_sent` / `rfp_awarded` / `rfp_cancelled` | `rfps` status gecisi | `invite_count`, `response_count`, `awarded_proposal_id` dolu mu |
| `booking_created` | `bookings` INSERT | `total_amount`, `event_type`, `shape` (eski teklif / proposal_version / crew_member), `buyer_organization_id` dolu mu |
| `booking_cancelled` / `booking_completed` | `bookings` status -> `cancelled` / `completed` | `total_amount`, `cancelled_by_side` (buyer/seller/null), gun farki |

`provider_id`: match_* -> aday; crew_* -> uye saglayicisi; proposal_* -> `seller_provider_id`; quote_* -> `sender_id` (= providers.id);
booking_* -> `seller_provider_id` ya da `professional_id`. `organization_id`: brief/event/rfp/booking alici kurulusu; proposal/crew satici.
Tutarlar MUSTERIYE DONUK alanlardir (`total_amount`, `unit_client_price`); `internal.*` hicbir olaya girmez.

### Dolum (tek seferlik, migration icinde)

Mevcut satirlardan `occurred_at` = kaynak zaman (`created_at`, `sent_at`, `approved_at`, `completed_at`, `cancelled_at`,
`confirmed_at`); gecis zamani olmayan durumlar (`proposals.declined`, `quotes.declined`) icin `updated_at`/`responded_at`. Dolum
`actor_user_id` NULL, `payload.backfill = true`. Idempotan: `NOT EXISTS (ayni event_name + entity_id)`.

### 9a-P1 — admin yuzeyi (`/admin/zeka`)

Yalniz `is_admin`. Uc blok: (1) **Gunluk olay sayilari** (son 30 gun, olay basina satir; `VeriTablosu`); (2) **Huni** (son 90 gun):
brief -> event_confirmed -> match_run -> match_shown (benzersiz aday) -> match_clicked -> crew_selected/proposal_sent -> approval
(proposal_approved + quote_accepted + rfp_awarded) -> booking_created -> booking_completed; her adimda sayi + onceki adima oran;
(3) **Adalet gostergesi** (00-genel-bakis): `match_shown` icinde `is_new_talent` payi (%) ve ilk 3 sirada yeni yetenek payi; gosterim
dagiliminin Gini katsayisi (saglayici basina gosterim). Veri `analytics_events`'ten TEK SQL (RPC `analytics_summary(p_days)`, admin).
Grafik yok (V0 tablo); DESIGN 9.

## 3. 9b — Fiyat kiyaslari (`price_benchmarks`)

### Tablo (01 bolum 11 + kararlar)

```
price_benchmarks
  id             bigint identity pk
  role_id        integer not null fk service_roles
  city_id        integer null fk turkish_cities       -- NULL = tum sehirler (kaba satir, bkz. soru 1)
  event_type     text null fk event_types(key)        -- NULL = tum turler (kaba satir)
  period_start   date not null, period_end date not null   -- kayan 90 gun
  sample_size    integer not null
  p25, median, p75, average  numeric(12,2)
  currency       char(3) not null default 'TRY'
  is_published   boolean not null                     -- sample_size >= 15
  computed_at    timestamptz not null default now()
  unique (role_id, city_id, event_type, period_end)   -- gun basina bir satir (NULLS NOT DISTINCT)
```

Gunluk hesap (pg_cron 03:30 Istanbul; uretimde pg_cron var, dalda uzanti var; harness'ta yok -> `cron.schedule` yalniz uzanti
varsa — `IF EXISTS pg_extension`). Hesap fonksiyonu `public.price_benchmarks_compute(p_as_of date default current_date)`
SECURITY DEFINER, yalniz `service_role` + cron; eski gunlerin satirlari silinmez (ekle-yalniz; 180 gunden eski satirlar FAZ 10 arsiv).

### Kaynak islemler (yalniz MUSTERIYE DONUK fiyat; `internal.*` YOK)

1. **Teklif kalemleri:** `proposal_items.unit_client_price` (adet basina), `is_visible_to_client`, surumu GONDERILMIS (`sent_at` dolu),
   `role_id` dolu; sehir/tur `proposals.event_id -> events(city_id, event_type)`; etkinliksiz teklif (rfp'siz, event NULL) hesaba
   girmez. Teklif basina ayni rolun birden fazla kalemi varsa her kalem bir gozlem.
2. **Rezervasyonlar:** `bookings.total_amount`, `status in (confirmed, completed)`, `crew_member_id -> crew_members.role_id`,
   sehir/tur `event_id -> events`; teklif sekli (`proposal_version_id` dolu) olanlar 1'de zaten sayildiysa ikinci kez SAYILMAZ
   (gozlem anahtari: proposal_version_id dolu -> atla).
3. **Pazaryeri pro teklifleri:** `quotes.total_amount`, `status = accepted`; rol = saglayicinin birincil rolu (`v_provider_roles`
   `is_primary`), sehir = saglayicinin `city_id`, tur = `conversations.event_type`.
4. Liste fiyatlari (`services.price_min/max`) ISLEM DEGIL — hesaba girmez (ileride ayri "liste fiyati" satiri olabilir).

Istatistik: `percentile_cont(0.25/0.5/0.75)`, `avg`; para birimi TRY disi gozlem atlanir. Ayni hesapta uc tane satir ailesi:
(rol, sehir, tur) · (rol, sehir, NULL) · (rol, NULL, NULL). Yayin esigi her satirda ayri (15).

### Okuma RPC'si

`price_benchmark_lookup(p_role_id int, p_city_id int, p_event_type text)` -> en guncel `period_end`'de **yayinlanmis** en dar satir
(once rol+sehir+tur, yoksa rol+sehir, yoksa rol) + hangi duzeyde oldugu (`granularity`: `role_city_type` | `role_city` | `role`).
Yayinlanan yoksa bos. `authenticated` + `anon` (sihirbaz anonim de olabilir); yalniz yayinlanmis satir dondurur (fonksiyon icinde
`is_published`), tabloya dogrudan SELECT yok. Donus alanlari: `median, p25, p75, sample_size, period_end, granularity`.

### 9b-P1 — yuzeyler (yalniz yayinlanmis hucre; yoksa HICBIR SEY)

- **Sihirbaz butce kutusu** (`anladim-ozeti` / adim 2): rollerin medyan toplami "Benzer etkinliklerde bu roller ~X TL (son 90 gun, N islem)";
  tek rol bile yayinli degilse kutu yok.
- **Kesfet filtre ipucu:** rol + sehir secili ve yayinli ise "Bu rol bu sehirde genelde A-B TL (p25-p75)".
- **Ajans teklif editoru** (`teklif-kalem-tablosu` satir ici; yalniz `canManageProposals`): kalemin rolu icin "Pazar: medyan X" kucuk
  ipucu; teklif fiyatini DEGISTIRMEZ.
- **Pro profil (`/profil` kendi)**: "Rolun bu sehirde pazar araligi" karti — kendi fiyatiyla kiyas (yalniz kendisine).
- Admin `/admin/zeka`'ya "Yayinlanan hucre sayisi / toplam" satiri.

## 4. 9c — Trust Score V0

### Ilke

Kural tabanli, aciklanabilir, 0-100, gunluk hesaplanir; bilesenleri saklanir (dokum + itiraz). Yalniz GERCEK sinyaller (D2 guven
cipleri kurali); yeni saglayici cezalandirilmaz (notr taban). `providers.trust_score` + `trust_computed_at` yazilir (sutunlar FAZ 2a'da
var; kullanici yazamaz — koruma tetikleyicisi); Match V0.2 `high_trust` esigi (70) kendiliginden calisir.

### Bilesenler (toplam 100)

| Bilesen | Puan | Kural (V0) |
|---|---|---|
| Dogrulama | 0-25 | `verification_level`: none 0 · email 10 · document 20 · full 25 |
| Profil onayi ve tamligi | 0-15 | approved 5; bio ≥ 120 karakter 3; avatar 2; ≥ 1 aktif hizmet/rol 2; ≥ 3 portfoy ogesi 3 |
| Tamamlanan is | 0-25 | completed rezervasyon (satici tarafi: `professional_id` ya da `seller_provider_id`): 0 -> 0 · 1-2 -> 10 · 3-9 -> 18 · 10+ -> 25 |
| Iptal | -15..0 | son 12 ayda satici kaynakli iptal orani (`cancelled_by` = satici): 0 -> 0 · <%10 -> -5 · <%25 -> -10 · uzeri -15 |
| Degerlendirme | 0-20 | `reviews`: cnt < 3 -> 8 (notr); cnt ≥ 3: avg ≥ 4.7 -> 20 · ≥ 4.3 -> 15 · ≥ 3.8 -> 10 · altinda 4 |
| Yanit suresi | 0-15 | son 180 gun, musteri mesajina ILK yanit medyani (`messages`): ≤ 2 sa 15 · ≤ 24 sa 10 · ≤ 72 sa 5 · uzeri 0; veri yok -> 7 (notr) |

Toplam `GREATEST(0, LEAST(100, ...))`. `algorithm_version = 'trust-v0.1'`. Bilesen puanlari ve ham sayilar `trust_score_snapshots`'a:

```
trust_score_snapshots           -- ekle-yalniz, gunluk
  id bigint pk, provider_id uuid fk, computed_at, algorithm_version text,
  score numeric(5,2), components jsonb   -- {verification:{points,level}, profile:{...}, completed:{points,count}, cancel:{points,rate}, reviews:{points,avg,cnt}, response:{points,median_h}}
```

Hesap `public.trust_score_compute()` SECURITY DEFINER (cron 03:45). `providers` koruma tetikleyicisi (`protect_sensitive_provider_fields`,
FAZ 2a) `trust_score`/`trust_computed_at` yazimini kullaniciya kapatiyor; mevcut kapi `current_setting('kashe.sync_bypass') = 'on'` —
hesap fonksiyonu FAZ 2b aynalama ile ayni kapiyi `set_config('kashe.sync_bypass','on', true)` ile acar (islem sonunda duser). Yalniz
gorunur saglayicilar (`is_visible`) hesaplanir; digerleri NULL kalir.

### Okuma ve itiraz

- `my_trust_breakdown()` RPC: oturum sahibinin KENDI saglayicisinin son dokumu (authenticated; baska saglayici 42501). Ajans
  kurulusunda `settings.manage`.
- `/profil` "Guven dokumu" karti (9c-P1): altı bilesen satir satir, puan + ham deger + "nasil artar" tek cumle; altta "Bu degerlendirmeye
  itiraz et" → `mailto:info@kashe.net?subject=Guven%20dokumu%20itirazi` (KVKK insan incelemesi; V1'de tablo). Musteri yuzeyinde skor
  YOK; Kesfet siralamasi DEGISMEZ (yalniz Match V0.2 `high_trust`).
- Admin `/admin/zeka`: skor dagilimi (0-39 / 40-69 / 70+ sayilari), hesaplanmayan saglayici sayisi.

## 5. Dilimler ve dogrulama

| Dilim | Icerik | Test |
|---|---|---|
| **9a-DB/01** | `analytics_events` + CHECK sozluk + 9 kaynak tabloda tetikleyici + dolum + RLS + `analytics_summary(p_days)` | asama4 **T31** (her olay bir kez, dolum idempotan, PII yok, authenticated INSERT 42501, admin SELECT); **asama19** yeni kontrol dosyasi K1-K6 (nesneler, tetikleyici sayisi, dolum = kaynak sayilari, PII tarama, RLS) |
| **9a-P1** | `/admin/zeka` (gunluk, huni, adalet) | tur: admin (gmail is_admin) |
| **9b-DB/01** | `price_benchmarks` + `price_benchmarks_compute` + cron + `price_benchmark_lookup` | asama4 **T32** (3 kaynak, cift sayim yok, esik, kaba satir, lookup en dar yayinli), asama19 K7-K10 |
| **9b-P1** | sihirbaz/Kesfet/editor/profil ipuclari (yalniz yayinli) | tur: testguven sihirbaz, gmail editor (uretimde buyuk olasilikla hucre yok — "hicbir sey" davranisi dogrulanir) |
| **9c-DB/01** | `trust_score_snapshots` + `trust_score_compute` + cron + `my_trust_breakdown` + koruma tetikleyicisi uyumu | asama4 **T33** (bilesen puanlari, notr taban, koruma: kullanici yazamaz, fonksiyon yazar, high_trust kodu dolar), asama19 K11-K14 |
| **9c-P1** | `/profil` guven dokumu + itiraz; admin dagilim | tur: hotmail (Test Pro dokumu), gmail (ajans) |
| **Kapanis** | 20/34 kapanis notu, CLAUDE.md FAZ 9 paragrafi, roadmap, 04-goc-plani madde 39-41 isaretleme | — |

Kirmizi cizgiler (hepsi): `internal.*` hicbir olaya/kiyasa girmez; PII payload'a yazilmaz; uygulama `analytics_events`/`price_benchmarks`/
`trust_score` YAZMAZ; her sey ekle-yalniz; algoritma degisikligi = yeni `algorithm_version`; hesaplar SECURITY DEFINER + cron;
esik alti hicbir sey gosterilmez; musteriye skor yok.

## 6. Acik sorular (Guven)

1. Fiyat kiyasi kaba satirlari (`event_type NULL`, `city NULL`) ayni hesapta uretilsin mi? (Oneri: evet — dar hucre dolmadiginda
   `lookup` kaba satira duser ve `granularity` ile isaretler; UI "bu rol genelde …" diye yazar.)
2. Trust bileseni agirliklari (bolum 4 tablosu) — V0 icin kabul mu, degisiklik var mi? Esik 70 Match'te sabit kalsin mi?
3. Itiraz kanali V0'da `mailto:info@kashe.net` yeterli mi, yoksa `trust_appeals` tablosu + admin kuyrugu ile mi acilsin?
4. `analytics_events` saklama: sinirsiz mi, 24 ay mi (FAZ 10 arsiv)?
5. 9a-P1 admin sayfasi grafiksiz tablo (V0) — kabul mu?

## 7. TUBITAK eslemesi (bilgi)

| Simdi (V0, Ekim-Aralik 2026) | Ar-Ge donemi (2027) |
|---|---|
| `analytics_events` olay zinciri + huni + adalet gostergesi | IP5: pilot olcum raporlari; IP2: `acceptance_prob` ogrenimi icin veri |
| `price_benchmarks` kural tabanli (p25/medyan/p75, esik) | IP3: fiyat modeli (tur/sezon/kapasite), marj onerisi (Commercial Optimization) |
| Trust V0 kural tabanli, dokum + itiraz | IP2: Trust V1 (sonuca gore kalibrasyon, musaitlik guveni), Match V1 (ogrenen agirliklar) |
