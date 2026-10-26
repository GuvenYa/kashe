# FAZ 9 — Zeka katmani (olay zinciri · fiyat kiyaslari · Trust Score V0)

**Kaynak plan:** `04-goc-plani.md` FAZ 9 madde 39-41; `01-veri-modeli.md` bolum 11 (`analytics_events`, `price_benchmarks`); `00-genel-bakis.md`
"Karar zinciri" (Outcome Learning) ve "Temel ilkeler" (once calisan ve olculen surum; olcmeden tutma; veri dongusu asil varlik; adalet
olculur); `02-guvenlik-modeli.md` bolum 7 (aciklanabilirlik: gerekce kodlari; itiraz hakki) ve 8 (KVKK); `18-faz6-eslestirme-ekip.md`
(Match V0.2: `high_trust` = `trust_score >= 70` ya da `avg_rating >= 4.5 && cnt >= 3`; `new_talent` = `cnt < 3`; ekle-yalniz kosu kurali).
**Durum:** PLAN KAPANDI; **9a KAPANDI (23 Ekim 2026)**; **9b KAPANDI (25 Ekim 2026)**; **9c-DB/01 hazir**
(`20261027120000_faz9c_01_trust_score.sql`; yerelde asama4 T33 34/34, asama19 K11-K13 ESIT; dal + uretim bekliyor). Sira: 9c-P1 -> FAZ 9 kapanis. Her dilim: migration -> dal
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
   esik alti hucre yayinlanmaz, UI hicbir sey gostermez. **Kaba satirlar da uretilir** (rol x sehir x NULL, rol x NULL x NULL; Guven
   onayi): dar hucre dolmadiginda `lookup` kaba satira duser ve `granularity` ile isaretler.
5. **Trust V0 agirliklari bolum 4 tablosundaki gibi, Match esigi 70 sabit** (Guven: karar Claude'a birakildi; gerekce: dogrulama ve
   tamamlanan is en guclu gercek sinyaller, degerlendirme ucuncu; yeni saglayici notr tabanla 15 puan alir ve `new_talent` kodu adaleti
   ayrica korur).
6. **Itiraz kanali `trust_appeals` tablosu** (Guven: karar Claude'a birakildi; gerekce: KVKK insan incelemesi kanitlanabilir olmali —
   mailto iz birakmaz): saglayici kendi dokumune itiraz acar, admin `/admin/zeka` kuyrugunda inceler, karar + not yazar; e-posta yok (V0).
7. **`analytics_events` saklama sinirsiz** (Guven: musterinin iki yillik portfoy gecmisi yetersiz kalabilir). Arsiv karari yok; tablo
   bolumleme (partition) hacim buyurse FAZ 10+.
8. **Admin `/admin/zeka` grafik + tablo** (Guven): her blokta kucuk grafik (gunluk olaylar cizgi, huni yatay cubuk, adalet payi cizgi,
   trust dagilimi cubuk) + altinda tablo; grafik kutuphanesi uygulamada varsa o, yoksa inline SVG (tek bilesen `app/components/admin/
   mini-grafik.tsx`; DESIGN 9 renkleri; `dataviz` kurallari: tek renk ailesi, eksen etiketi, bos durum).

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

### Uygulama notlari (9a-DB/01)

- Tek yazma noktasi `fn_faz9_olay_yaz(...)` (SECURITY DEFINER; authenticated EXECUTE yok) + tekil indeks `(event_name, entity_id)` →
  ayni olay ayni varlik icin BIR kez (dolum idempotan; tekrar isaretlemeler olay eklemez). Sonuc: `proposal_revision` tekrar
  istenirse ilk istek kalir (V0 kabul).
- `match_run` olayi `match_runs` INSERT'inde degil, `run_event_match`'in sondaki `candidate_count/latency_ms` UPDATE'inde yazilir
  (sayilar o anda dolar). `match_shown/clicked` dolumda adayin `created_at`'i ile (gosterim ani eski kayitlarda yok).
- `bookings` iptalinde `cancelled_by_side`: `customer_id` → buyer, `professional_id`/`seller_provider_id` → seller, diger → other.
- `analytics_summary(p_days)`: `totals` (olay basina), `daily` (Istanbul gunu), `funnel` (benzersiz etkinlik: match_run/shown/clicked;
  `selection` = crew_selected + proposal_sent + quote_created), `fairness` (`new_talent_share`, `top3_new_talent_share`, `gini`
  saglayici basina gosterim sayisi uzerinden; tek saglayici → NULL).

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
Her blok grafik + tablo (karar 8); DESIGN 9.

### 9a kapanis notu (23 Ekim 2026) — KAPANDI

- **9a-DB/01** (`20261025120000_faz9a_01_olay_zinciri.sql`): dal `faz9a/db`; dalda asama4 32/32 GECTI (T31 yeni), asama19 K1-K5 ESIT;
  uretimde asama19 K1-K5 ESIT, K6 = 222 olay (dolum) / son 7 gun 25. Dal ve uretim ayni veriden geldigi icin iki ortamda sayilar esit.
- **9a-P1** (dal `faz9a/p1`; gorev `35-claude-code-gorevi-9a-p1-admin-zeka.md`): yeni `app/admin/zeka/page.tsx` (istemci; TEK kaynak
  `analytics_summary`, secili pencere + 7/30/90 sabit pencere = 4 RPC cagrisi, pencere degisiminde 1), `app/lib/zeka.ts` (23 olay etiketi,
  4 grup — yasam dongusu sirasi, huni adimlari, `yuzde`/`oran`/`sayi`/`ondalik3`), `app/lib/grafik-tema.ts` (`C`, `tooltipStyle`,
  `SERIF`/`MONO`, `PIE_PALETTE` ortak; `istatistikler/page.tsx` yalniz import'a dondu, davranis ayni), menu "Zeka" (`Sparkles`).
  Pencere 7/30/90/365 ("Tumu" YOK — RPC 365'e kirpiyor, etiket yalan soylerdi). Grafikler recharts (Area / yatay Bar + LabelList / gruplu Bar).
- **Canli tur (admin, 800 px + 375 px):** uc blok ve tablolar dolu; pencere secici calisiyor (365 gun -> 222 toplam, "Secili (365 gun)"
  satiri adalet tablosuna eklendi); 375 px'te yatay tasma yok, tablolar kart modunda, huni ekseni okunur; `/admin/istatistikler` renkleri
  degismedi; konsolda hata yok. Dal verisi (30 gun): 144 olay, brief -> rezervasyon %11,1, gosterim -> tiklama %20,0, yeni yetenek payi
  %86,8, Gini 0,357, 12 saglayici / 76 gosterim.
- **Turda duzeltilen:** (1) grup ici sira alfabetikti -> olay sozlugu (yasam dongusu) sirasi; (2) sayfanin kendi `istanbulGun` yardimcisi
  -> `tarih.ts` `istanbulGunu`; (3) huni tablosu altina not: adimlar ic ice DEGIL (eslestirme olmadan havuzdan ekip / dogrudan teklif / RFP
  olur), onceki adima oran %100'u asabilir — turda "Secim / teklif %500" gorundu, veri dogru, okuyan sasirmasin.
- **Ertelenen (FAZ 10+):** gunluk yeni yetenek payi serisi (RPC gunluk `is_new_talent` kirilimi vermiyor; 7/30/90 pencere karsilastirmasi
  ile karsilandi); huni "Tamamlanan" 0 cubugunda etiket cizilmiyor (recharts sifir genislik; kozmetik); `analytics_events` bolumleme hacim
  buyurse.

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

### Uygulama notlari (9b-DB/01, `20261026120000_faz9b_01_fiyat_kiyaslari.sql`)

- **Rezervasyon ayri kaynak DEGIL:** `bookings_shape_check` geregi her rezervasyon ya teklif surumune (kaynak 1'de sayilir) ya da
  quote'a (kaynak 3'te sayilir) baglidir; "crew sekli" diye bagimsiz bir rezervasyon yok. Kaynak 2 bu yuzden kodda yoktur (plan maddesi
  dogru ongormustu: "ikinci kez sayilmaz").
- **Teklif kalemleri:** teklifin SON GONDERILMIS surumu (`DISTINCT ON (proposal_id) ORDER BY version_no DESC`, `sent_at` dolu) —
  revizyon ayni kalemi iki kez saymaz; etkinlik `COALESCE(proposals.event_id, rfps.event_id)`; `role_id` dolu + `is_visible_to_client`
  + `unit_client_price > 0` + surum `currency = 'TRY'`; tur `events.event_type` yalniz `event_types` anahtariysa (degilse NULL -> kaba satir).
- **Pro teklifleri:** `quotes.status = accepted`; rol = `v_provider_roles` birincil rol, birincil yoksa ve TEK aktif rol varsa o, aksi
  halde gozlem ATLANIR (rol uydurulmaz); sehir `providers.city_id`; tur `events` (`conversations.event_id`) yoksa `conversations.event_type`.
  Gozlem zamani `responded_at` (yoksa `created_at`). Kabulde tetikleyicinin actigi rezervasyon ayri gozlem uretmez.
- **Hesap:** `price_benchmarks_compute(p_as_of date default current_date)` → `fn_faz9b_gozlemler(start, end)` (service_role) → uc aile
  `UNION ALL` (GROUPING SETS degil: sehri NULL olan gozlem dar hucreye sizmasin), `percentile_cont`, `ON CONFLICT ... DO UPDATE`
  (ayni gun yeniden kosarsa gunceller; eski gun silinmez). Tekil kisit `UNIQUE NULLS NOT DISTINCT (role_id, city_id, event_type,
  period_end)` (PG15+; uzak PG17). Aile kurali CHECK: `city_id NULL` iken `event_type` NULL. Esik tek kaynak `fn_faz9b_yayin_esigi()` = 15;
  `algorithm_version = 'bench-v0'`. Migration sonunda ilk hesap kosar (uretimde hucreler olusur; esik alti yayinlanmaz).
- **Okuma:** `price_benchmark_lookup(rol, sehir, tur)` — SON hesap gununun (`max(period_end)`, tum tablo) yayinli en dar satiri; eski
  gunun yayinli satiri DONMEZ (asama4 T32 bunu ayrica sinar). `price_benchmark_lookup_many(roller[], sehir, tur)` sihirbaz icin (yayinli
  olmayan rol satir dondurmez). Ikisi de anon + authenticated. Tablo SELECT yalniz `is_admin`; varsayilan ALL ayricaligi authenticated'dan
  geri alindi (asama19 K8 bunu olcer).
- **Admin ozeti:** `price_benchmarks_summary()` (admin; 42501) → `period_end/period_start`, `threshold`, `cells_total`, `cells_published`,
  `observations_total` (rol kaba satirlarinin toplami), `by_granularity`, `published_cells` (50; rol/sehir/tur adlariyla), `near_threshold`
  (esik-7..esik-1 arasi 20 hucre). 9b-P1 admin blogu bunu okur.
- **9b-DB/02 (`20261026130000_faz9b_02_eskiyen_hucre.sql`):** ayni gun yeniden hesapta gozlemi KALMAYAN hucre silinir (kosu basinda
  `clock_timestamp()`, yazilan/guncellenen satir `computed_at = clock_timestamp()`, sonda `period_end = p_as_of AND computed_at < basladi`
  silinir). Neden: kaynak ayni gun silinince sabahki satir `period_end = bugun` ile kaliyor ve lookup onu yayinli saniyordu (tur hazirligi
  geri alinirken fark edildi). Eski gunlere dokunulmaz. asama4 T32 temizlik adimi bunu sinar.
- **9b-DB/03 (`20261026140000_faz9b_03_istanbul_gunu.sql`):** `price_benchmarks_compute` varsayilan `p_as_of` = ISTANBUL gunu
  (`(now() AT TIME ZONE 'Europe/Istanbul')::date`), `current_date` (UTC) degil. Gozlemler Istanbul gunune kovalaniyor; 21:00-24:00 UTC
  arasinda elle kosulan hesap o saatlerin islemlerini "yarin" sayip disarida birakiyordu (tur hazirliginda goruldu). Cron 00:30 UTC'de
  iki gun ayni oldugu icin gece kosusu etkilenmiyordu. asama4 T32 de Istanbul gunuyle calisir.
- **pg_cron:** `price-benchmarks-daily` `30 0 * * *` (00:30 UTC = 03:30 Istanbul); yalniz `pg_extension`'da `pg_cron` varsa (harness'ta yok),
  `EXECUTE` ile dinamik (uzanti yokken ayristirma hatasi olmasin). asama19 K9 cron isini uzanti varligiyla karsilastirir
  (`query_to_xml` ile — `cron.job` yokken salt SELECT'te adi gecemez).
- **Test:** asama4 **T32** (16 kalem = 4 teklif x 4, revizyon cift saymaz, gizli/rolsuz/taslak/etkinliksiz girmez, quote tek rol;
  A dugun 16 yayinli 4750/8500/12250, B dugun 3 ve A kurumsal 2 yayinsiz, A kaba 18, rol kaba >= 21, (rol,NULL,tur) yok, idempotan,
  esik/ceyrek tutarli; lookup anon en dar/rol+sehir/rol/dunku satir donmez/olmayan rol 0/many 1; anon tablo 42501; admin olmayan 0 +
  INSERT/compute/gozlem/ozet 42501; admin ozet) — test sehirleri `turkish_cities` plaka 998/999 gecici; asama19 **K7-K9** ESIT, **K10** bilgi.

### 9b-P1 — yuzeyler (yalniz yayinlanmis hucre; yoksa HICBIR SEY)

- **Sihirbaz butce kutusu** (`anladim-ozeti` / adim 2): rollerin medyan toplami "Benzer etkinliklerde bu roller ~X TL (son 90 gun, N islem)";
  tek rol bile yayinli degilse kutu yok.
- **Kesfet filtre ipucu:** rol + sehir secili ve yayinli ise "Bu rol bu sehirde genelde A-B TL (p25-p75)".
- **Ajans teklif editoru** (`teklif-kalem-tablosu` satir ici; yalniz `canManageProposals`): kalemin rolu icin "Pazar: medyan X" kucuk
  ipucu; teklif fiyatini DEGISTIRMEZ.
- **Pro profil (`/profil` kendi)**: "Rolun bu sehirde pazar araligi" karti — kendi fiyatiyla kiyas (yalniz kendisine).
- Admin `/admin/zeka`'ya "Yayinlanan hucre sayisi / toplam" satiri.

### 9b kapanis notu (25 Ekim 2026) — KAPANDI

- **DB:** 01 (tablo, gozlemler, hesap, lookup, ozet, cron), 02 (ayni gun eskiyen hucre), 03 (hesap gunu Istanbul gunu) dalda ve uretimde;
  uretim: 22 hucre / 0 yayinli / 13 gozlem / esik 15, cron `price-benchmarks-daily` 24 Ekim 03:30'da kostu (period_end 24 Ekim). Uretimde
  yayinli hucre yok (15 islemlik hucre olusana kadar yuzeyler sessiz).
- **9b-P1** (dal `faz9b/p1`; gorev `36-claude-code-gorevi-9b-p1-fiyat-kiyaslari.md`): `app/lib/fiyat-kiyas.ts` (tip, kapsam/konum
  etiketleri, `enKabaKapsam`, `ornekMetni`), `app/lib/fiyat-kiyas-data.ts` (`server-only`; `pazarKiyaslari`, `rolIdleriSlugdan`),
  `app/etkinlik-sihirbazi/pazar-butce-kutusu.tsx` (istemci RPC, 400 ms debounce, TAM kapsama sarti), `app/kesfet/pazar-ipucu.tsx`,
  teklif sayfasi (`events.city_id` eklendi; `canManageProposals` ile) + `teklif-kalem-tablosu` (fiyat altinda ipucu; tablo + kart modu),
  `/profil` pazar karti (birincil/tek rol; kendi liste fiyati + konum rozeti), `/admin/zeka` Blok 4 (KPI, aile grafigi, yayinli hucreler,
  esige yakinlar; `price_benchmarks_summary` paralel). Tablo hicbir yerde dogrudan okunmuyor.
- **Canli tur, iki asamali.** (1) Uretim onizlemesi (gmail): bos durumlar — sihirbaz kutu yok (RPC secim basina 1), Kesfet serit yok,
  onayli teklifte ipucu yok, admin Blok 4 "Yayinlanan hucre yok (esik 15 islem)". (2) **Dolu durumlar yerel dev sunucusunda, dal DB'sine
  bagli** (`$env:NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` + `NEXT_PUBLIC_BAKIM_MODU=false`, `.env.local` degismedi), fixture hesaplarla
  (`faz1test+ajans` owner/admin, `faz1test+pro2` tek rol); `tur-9b-seed.sql` dala gercek esikle 2 yayinli rol kurdu (16 + 15 kalem,
  gecici sehir plaka 999), `tur-9b-temizlik.sql` geri aldi. Sonuclar: sihirbaz ~9.250 -> iki rol ~14.250 -> adet 2 ile ~23.500 TL, yayinsiz
  rol eklenince kutu kayboldu, sehir/tur eslesmeyince "Turkiye genelinde"; Kesfet "bu sehirde genelde 7.375 - 11.125 TL · medyan 9.250 TL
  · son 90 gun · 16 islem"; taslak teklifte iki kalemde "Pazar: medyan ... · 16/15 islem"; admin 10 hucre / 6 yayinli / 38 gozlem, tablo 6
  satir; `/profil` "Faz1 Test Match B · Turkiye genelinde · 4.125 - 5.875 TL · medyan 5.000 TL · 15 islem · Senin liste fiyatin 90.000 -
  120.000 TL · pazarin ustunde".
- **Turda duzeltilen:** admin yayinli hucre tablosunda `lg` altinda Sehir/Tur sutunlari gizlenince ayni rolun uc ailesi ayirt edilemiyordu ->
  Rol hucresine "sehir · tur" alt satiri (esige yakin tablosunda da).
- **Ogrenilen (kalici):** Vercel onizlemeleri URETIM Supabase'ine bagli (dal DB'si yalniz migration provasi + asama4; test disi kullanici
  yok, `turkish_cities` bos). Dolu durum turu icin desen: dal DB'sine bagli yerel dev + fixture hesaplari + seed/temizlik betigi (uretime
  test verisi ASLA yazilmaz). Yerel `.env.local` bakim modunu acik tutuyor; surec ortam degiskeni dosyayi ezer.
- **Ertelenen:** gunluk pencere ici elle hesap kosusu yalniz admin/cron (UI'dan tetikleme yok); kiyas satirlarinin 180 gun arsivi FAZ 10;
  Kesfet seridi sonuc 0 iken de gorunur (bilgi degeri var, bilincli).

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
- `/profil` "Guven dokumu" karti (9c-P1): alti bilesen satir satir, puan + ham deger + "nasil artar" tek cumle; altta "Bu degerlendirmeye
  itiraz et" → `trust_appeals` kaydi (karar 6). Musteri yuzeyinde skor YOK; Kesfet siralamasi DEGISMEZ (yalniz Match V0.2 `high_trust`).
- **`trust_appeals`** (karar 6): `id, provider_id fk, snapshot_id fk trust_score_snapshots, message text (20-2000), status
  (open/reviewed/closed), admin_note text, reviewed_by uuid, reviewed_at, created_at`. RLS: saglayici kendi satirini INSERT/SELECT
  (`providers.id = auth.uid()` ya da ajans kurulusunda `settings.manage`), admin hepsini SELECT/UPDATE (status + admin_note); acik itiraz
  varken ikinci acilamaz (kismi tekil indeks). Admin `/admin/zeka` "Itirazlar" kuyrugu: acik/incelendi/kapali; karar + not; saglayici
  `/profil`'de durumu gorur.
- Admin `/admin/zeka`: skor dagilimi (0-39 / 40-69 / 70+ sayilari; cubuk grafik), hesaplanmayan saglayici sayisi, itiraz kuyrugu.

### Uygulama notlari (9c-DB/01, `20261027120000_faz9c_01_trust_score.sql`)

- **Hesap iki parca:** `fn_faz9c_hesapla(providers)` saf (yazmaz; bilesenler + skor jsonb) ve `trust_score_compute(p_provider uuid
  default NULL)` yazar: gorunur saglayicilar (`is_published AND approval_status = 'approved' AND suspended_at IS NULL`) icin snapshot +
  `providers.trust_score/trust_computed_at` (`set_config('kashe.sync_bypass','on', true)` ile koruma kapisi; islem sonunda off);
  gorunur olmayanlarin skoru NULL'a cekilir (eski skor eslestirmeye sizmasin), snapshot yazilmaz. `computed_at = clock_timestamp()`
  (ayni islemde iki kosu ayrisabilsin). pg_cron `trust-score-daily` 00:45 UTC. Migration sonunda ilk hesap kosar.
- **Bilesen ayrintilari:** bio = profesyonelde `professional_profiles.bio` yoksa `profiles.bio`, kurulusta `organization_profiles.about`
  yoksa `profiles.bio` (>= 120 karakter); avatar `profiles.avatar_url`; aktif rol `provider_services x service_roles.is_active`; portfoy
  `portfolio_items.provider_id` ya da `profile_id`. Tamamlanan is tum zamanlar (`professional_id` ya da `seller_provider_id`). Iptal son
  12 ay (`created_at`), satici kaynakli = `cancelled_by` saglayicinin kendisi ya da (kurulus saglayicisinda) aktif uyesi; `seller_cancelled = 0`
  ise 0 puan. Degerlendirme `reviews.provider_id` ya da `professional_id`. Yanit: son 180 gun konusmalari, musterinin ILK mesaji -> saglayici
  (ya da kurulus uyesi) ILK yaniti, `system` mesajlar haric, yanitsiz konusma medyana GIRMEZ (V0; cezalandirma V1), medyan saat.
- **`providers.trust_score` kullanici tarafindan yazilamaz:** sutun yetkisi yok (42501) — koruma tetikleyicisi ikinci kat. asama4 T33 ikisini
  de kabul eder.
- **Itiraz:** saglayici `trust_appeals`'a DOGRUDAN INSERT (RLS `fn_faz9c_provider_yetkisi`: kendisi ya da ajans kurulusunda `settings.manage`;
  WITH CHECK status open, admin alanlari bos); BEFORE INSERT tetikleyicisi `created_by = auth.uid()`, `snapshot_id` bos ise son dokum.
  authenticated'da UPDATE/DELETE GRANT'i YOK (42501) — karar yalniz `trust_appeal_review(id, status, note)` (admin; reviewed/closed;
  `reviewed_by/at`). Saglayici basina tek acik itiraz (`trust_appeals_one_open_idx` kismi tekil, 23505). SELECT: kendi + admin.
- **Okuma:** `my_trust_breakdown(p_provider default auth.uid())` → `{provider_id, visible, snapshot{id, score, computed_at,
  algorithm_version, components}, appeal{id, status, message, admin_note, created_at, reviewed_at, snapshot_id}}` (acik itiraz varsa o,
  yoksa son); yetkisiz 42501. `trust_score_summary()` (admin) → `last_computed_at`, `distribution{low, mid, high, scored, avg, not_computed,
  invisible}`, `appeals{open, reviewed, closed}`, `appeal_queue` (50; acik once), `component_avgs` (son snapshot ortalamalari),
  `high_threshold 70`. Snapshot tablosunda saglayici kendi satirlarini da okur (RLS) — UI tek RPC kullanir.
- **Test:** asama4 **T33** (notr tabanlar 8/7; full 25, 1 tamamlanan 10, 1/2 satici iptali -15, 3 degerlendirme 4.67 -> 15, yanit medyani
  2 sa -> 15; skor = toplam; kullanici skor yazamaz; authenticated compute/snapshot 42501; dokum yetkisi; itiraz akisi: tek acik, kisa mesaj,
  RLS, admin karari, gecersiz durum, karardan sonra yeni itiraz; gorunmeyen NULL; temizlik + yeniden hesap) — fixture musterileri 0001/0005/0006
  (`conversations_unique_pair`: musteri x saglayici tek konusma); asama19 **K11-K13** ESIT, **K14** bilgi.

## 5. Dilimler ve dogrulama

| Dilim | Icerik | Test |
|---|---|---|
| **9a-DB/01** — **KAPANDI** | `analytics_events` + CHECK sozluk + 10 kaynak tabloda tetikleyici + dolum + RLS + `analytics_summary(p_days)` | asama4 **T31** (her olay bir kez, dolum idempotan, PII yok, authenticated INSERT 42501, admin SELECT); **asama19** yeni kontrol dosyasi K1-K6 (nesneler, tetikleyici sayisi, dolum = kaynak sayilari, PII tarama, RLS) |
| **9a-P1** | `/admin/zeka` (gunluk, huni, adalet; grafik + tablo) — **KAPANDI** | tur: admin (gmail is_admin) — gecti |
| **9b-DB/01 + 02 + 03** — **KAPANDI** | `price_benchmarks` + `fn_faz9b_gozlemler` + `price_benchmarks_compute` + cron + `price_benchmark_lookup(_many)` + `price_benchmarks_summary` | asama4 **T32** (2 kaynak — rezervasyon sekil kuraliyla turev; cift sayim yok, esik, kaba satir, lookup en dar yayinli / eski gun donmez), asama19 K7-K9 (+K10 bilgi) |
| **9b-P1** — **KAPANDI** | sihirbaz/Kesfet/editor/profil ipuclari + admin Blok 4 (yalniz yayinli) | tur: uretim onizlemesi bos durumlar (gmail) + yerel dev / dal DB dolu durumlar (fixture hesaplar, tur-9b seed) — gecti |
| **9c-DB/01** — hazir | `trust_score_snapshots` + `trust_appeals` + `fn_faz9c_hesapla` + `trust_score_compute` + cron + `my_trust_breakdown` + `trust_appeal_review` + `trust_score_summary` | asama4 **T33** (bilesen puanlari, notr taban, koruma, dokum yetkisi, itiraz akisi, gorunmeyen NULL), asama19 K11-K13 (+K14 bilgi) |
| **9c-P1** | `/profil` guven dokumu + itiraz formu/durumu; admin dagilim + itiraz kuyrugu | tur: hotmail (Test Pro dokumu + itiraz), gmail (admin kuyrugu) |
| **Kapanis** | 20/34 kapanis notu, CLAUDE.md FAZ 9 paragrafi, roadmap, 04-goc-plani madde 39-41 isaretleme | — |

Kirmizi cizgiler (hepsi): `internal.*` hicbir olaya/kiyasa girmez; PII payload'a yazilmaz; uygulama `analytics_events`/`price_benchmarks`/
`trust_score` YAZMAZ; her sey ekle-yalniz; algoritma degisikligi = yeni `algorithm_version`; hesaplar SECURITY DEFINER + cron;
esik alti hicbir sey gosterilmez; musteriye skor yok.

## 6. Acik sorular — KAPANDI (Guven, 23 Ekim 2026; kararlar bolum 1 madde 4-8)

1. Kaba satirlar: evet. 2. Agirliklar/esik: Claude karari — tablo ve 70 kalir. 3. Itiraz: `trust_appeals`. 4. Saklama: sinirsiz.
5. Admin: grafik + tablo.

## 7. TUBITAK eslemesi (bilgi)

| Simdi (V0, Ekim-Aralik 2026) | Ar-Ge donemi (2027) |
|---|---|
| `analytics_events` olay zinciri + huni + adalet gostergesi | IP5: pilot olcum raporlari; IP2: `acceptance_prob` ogrenimi icin veri |
| `price_benchmarks` kural tabanli (p25/medyan/p75, esik) | IP3: fiyat modeli (tur/sezon/kapasite), marj onerisi (Commercial Optimization) |
| Trust V0 kural tabanli, dokum + itiraz | IP2: Trust V1 (sonuca gore kalibrasyon, musaitlik guveni), Match V1 (ogrenen agirliklar) |
