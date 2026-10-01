# 18 — FAZ 6: Eslestirme ve ekip (match_runs, match_candidates, crews, crew_members, internal.crew_member_commercials)

**Kaynak plan:** `04-goc-plani.md` FAZ 6 madde 31-33; `01-veri-modeli.md` bolum 5 (eslestirme, coverage), bolum 6 (ekip),
bolum 8 (`internal.crew_member_commercials`); `02-guvenlik-modeli.md` (gerekce kodlari, "sunucu tarafi kurallar: fiyat/butce/
musaitlik deterministik servislerde", KVKK itiraz hakki); `15-faz4a` (events, event_requirements); `17-faz5` (havuz, ic oran).
**Durum:** 6-DB/01 URETIMDE (1 Ekim 2026, commit `0b473f0`; bolum 10). Uygulama P1-P2 Claude Code (bolum 8).

## 1. Amac ve sinir

Onayli etkinligin (`events.status = confirmed`) gereksinimlerinden (`event_requirements`) **aday listesi** uretmek ve bu
adaylardan **ekip** kurmak. Ilk surum (Match V0) **kural tabanli ve deterministik**: skorlar SQL'de hesaplanir, her kosu ve
her gosterilen aday kaydedilir (`was_shown`), boylece FAZ 9 ogrenme katmani secilim yanliligi olmadan calisir.

Sinir: fiyat teklifi, rezervasyon ve musteri portali FAZ 7; kurulus atfi (`events.organization_id`) FAZ 8; ML/olasilik
(`acceptance_prob`) FAZ 9 — sutun acilir, NULL kalir. Pazaryeri akislari (kesfet, ilan, teklif, mesaj) DEGISMEZ.

## 2. Kararlar (1 Ekim 2026, Guven ile)

| Konu | Karar | Gerekce / etki |
|---|---|---|
| Match V0 nerede calisir | **DB fonksiyonu** `run_event_match(p_event_id, p_strategy)` (SECURITY DEFINER; kosuyu ve adaylari yazar, kosu id doner) | Tek kaynak; `internal` ve kapali sutunlara dokunmadan `v_providers_public` + `provider_services` + `availability_blocks` + `bookings` okur; asama4 ile test edilir; uygulama yalniz cagirir ve gosterir. Alternatif (server action'da hesapla, RLS ile yaz) skoru koda dagitir, test edilemez |
| Kim calistirir | **Etkinlik sahibi** (`events.owner_user_id = auth.uid()`; musteri, profesyonel veya ajans kullanicisi fark etmez) | FAZ 8'e kadar `events.organization_id` NULL; kurulus yetkisi (`events.view/crew.manage`) FAZ 8'de eklenir. Admin okur (RLS), calistirmaz |
| Aday kaynagi (V0) | **Bireysel profesyoneller + ajanslar** (Guven karari; onerilen "yalniz bireysel" DEGIL). Profesyonel adaylar rol basina (`role_id` dolu); ajans adaylari etkinlik basina (`role_id` NULL, `coverage_ratio` dolu). Ikisi de yayinda + onayli `providers`. Ajansin rol kapsami **yalniz acik sinyallerden**: kendi `provider_services` satirlari + Ekibim uyelerinin (`agency_members` -> profesyonel) `provider_services` rolleri. **Ozel havuz (`organization_talent_records`) kapsam hesabina GIRMEZ** (FAZ 5 kurali: havuz kurulusun ozel verisi; ileride kurulus "havuzumu kapsamda say" secenegi acabilir) | 01 bolum 5 coverage hesabi bugunden yazilir; "tam hizmet" kurali DB'de. Veri seyrekse ajans skoru dusuk cikar, bu dogru davranistir |
| Coverage (V0.1) | `coverage = SUM(w_i * covered_i) / SUM(w_i)`; `w = 3` zorunlu, `1` istege bagli. `covered_i = 1.0` ajans rolu kapsiyor VE (tarih yok VEYA ajans profili o tarihte blokte degil) VE (gereksinim `quantity = 1` VEYA `provider_services.capacity >= quantity`); `0.5` rolu kapsiyor ama tarihte/kapasitede belirsizlik (`quantity > 1` ve `capacity` NULL; ya da tarih belirsiz isaretli); `0.0` kapsamiyor. `full_service_eligible` = her zorunlu rolde `covered_i > 0`. Eligible degilse ajans yine aday olur (hibrit parcasi) ama `coverage_full` kodu almaz | 01 "kritik kural"; kapasite NULL = `quantity 1` icin yeterli sayilir (bugun kapasite verisi yok) — deterministik ve belgeli |
| Strateji | `run_event_match` varsayilan `hybrid`: iki liste birden (profesyonel rol basina + ajans etkinlik basina). `individual` yalniz profesyoneller, `full_service` yalniz eligible ajanslar. Hibrit koordinasyon cezasi (01) **ekip birlestirmede** (P2) uygulanir, aday skorunda degil | Tek kosu = tek ekran, iki bolum |
| Skor bilesenleri (V0.1) — profesyonel | `role_match` (zorunlu: `provider_services` o rolde), `same_city` (+40; `service_radius_km` yoksa sehir esitligi), `date_available` (+25; `availability_blocks` ve `bookings` o tarihte yoksa; tarih yoksa +10 "belirsiz"), `budget_fit` (+20; gereksinim/etkinlik butcesi ile `provider_services.price_min/max` kesisiyor veya fiyat yok +10), `high_trust` (+15; `providers.trust_score` >= 70 veya yorum ortalamasi >= 4.5 ve >= 3 yorum), `new_talent` (+5; < 3 yorum — cesitlilik). `match_score` 0-100 (ust sinir 100'e kirpilir); `reason_codes` = puan alan kodlar. Agirliklar `match_runs.params`'a yazilir; `algorithm_version = 'v0.1'` | 02 "gerekce kodlari" listesiyle birebir (`fast_response`/`style_match` V0'da yok). Degisiklik = yeni `algorithm_version`, eski kosular degismez |
| Skor bilesenleri (V0.1) — ajans | `60 * coverage` + `same_city` (+20) + `date_available` (+10; ajans profili blokte degil; tarih yoksa +5) + `high_trust` (+10). `coverage_full` kodu yalniz eligible ise. `budget_fit` ajansta yok (fiyat verisi yok) | Ayni 0-100 olcegi; iki liste ayri siralanir, karsilastirilmaz |
| Kosu kapsami | Kosu etkinlik basina **tum gereksinimler** icin tek `match_run` (`requirement_id` NULL); profesyonel aday satiri rol basina (`role_id` dolu), ajans aday satiri etkinlik basina (`role_id` NULL). Rol basina en fazla **20** profesyonel, en fazla **10** ajans (`params.limit_per_role`, `params.limit_orgs`) | Tek kosu = tek ekran; `requirement_id` sutunu tek rol yeniden cozumu icin acik kalir (kilitli ekipte "kalan rolleri yeniden coz") |
| Etkinlik durumu | Ilk basarili kosuda `events.status`: `confirmed -> matching` (yalniz bu gecis; RPC icinde). `booked` FAZ 7 | 16 bolum 8 "matching/booked FAZ 5-7" maddesi kapanir |
| Ekip (crews) | Etkinlik sahibi kurar; `organization_id` = sahibinin **crew.manage** yetkili aktif kurulusu varsa o (tek kurulus varsayimi; birden fazlaysa secim), yoksa NULL (bireysel). `source_policy` kurulus varsa `private_first`, yoksa `marketplace_only`; `objective` V0'da `best_fit` sabit | Ajans kullanicisi sihirbazla kendi etkinligini acip havuzundan ekip kurabilir (FAZ 5 havuzu kullanilir); musteri yalniz pazaryerinden |
| Ekip uyesi kaynagi | `crew_members.talent_record_id` (havuz; `pool_origin` private/external) veya `provider_id` (pazaryeri; `marketplace`); ikisi birden olabilir (havuz kaydi Kashe uyesine bagliysa). CHECK en az biri dolu (01) | 01 bolum 6 |
| Ic ticari anlik goruntu | `internal.crew_member_commercials` tablosu + `crew_member_commercial_snapshot(p_crew_member_id)` (commercial.manage; `rate_source = 'default'`: havuz kaydinin acik ic oranindan `agreed_cost` kopyalar; oran yoksa satir acilmaz, hata doner) + `internal_crew_commercials_list(p_crew_id)` (commercial.view) + `internal_crew_commercial_upsert(...)` (`manual_override`) (04 madde 32) | FAZ 7 teklif kalemleri bu goruntuden beslenir; `client_price` FAZ 7'de doldurulur (NULL olabilir) |
| Gosterim/tik kaydi | `mark_match_candidates_shown(p_run_id, p_candidate_ids)` ve `mark_match_candidate_clicked(p_candidate_id)` (sahip; yalniz false->true) | 01 "was_shown neden onemli" |
| KVKK itiraz | Aday listesi ekraninda sabit metin: "Bu liste kurallara gore otomatik siralanir; itiraz/inceleme: destek" + `reason_codes` gorunur | 02 "itiraz hakki" ve "aciklanabilirlik" |

## 3. Veri modeli (6-DB/01)

Enum'lar: `match_strategy('individual','full_service','hybrid')`, `crew_source_policy('private_first','private_plus_marketplace','marketplace_only')`,
`crew_objective('best_fit','most_economical','highest_margin')`, `crew_status('draft','proposed','confirmed','cancelled')`,
`crew_member_pool_origin('private','marketplace','external')`, `crew_member_status('proposed','contacted','confirmed','declined','replaced')`,
`rate_source('default','manual_override','marketplace_quote')`.

```
match_runs            id, event_id fk events CASCADE, requirement_id null fk event_requirements SET NULL, strategy, algorithm_version text,
                      params jsonb, candidate_count int, latency_ms int, created_by uuid, created_at
match_candidates      id, match_run_id fk CASCADE, provider_id fk providers CASCADE, role_id int fk service_roles RESTRICT,
                      match_score numeric(5,2) 0-100, trust_score numeric null, coverage_ratio numeric null, availability_conf numeric(3,2),
                      acceptance_prob numeric null, final_rank int, reason_codes text[], was_shown bool, was_clicked bool, created_at
                      full_service_eligible bool null (yalniz ajans adayinda dolu)
                      UNIQUE (match_run_id, provider_id, role_id) (role_id NULL icin: UNIQUE kismi indeks (match_run_id, provider_id) WHERE role_id IS NULL)
                      CHECK ((role_id IS NOT NULL AND coverage_ratio IS NULL) OR (role_id IS NULL AND coverage_ratio IS NOT NULL))
crews                 id, event_id fk CASCADE, organization_id null fk organizations SET NULL, name text, strategy, algorithm_version text null,
                      source_policy, objective, status, created_by uuid, created_at, updated_at
crew_members          id, crew_id fk CASCADE, role_id int fk RESTRICT, talent_record_id null fk organization_talent_records SET NULL,
                      provider_id null fk providers SET NULL, pool_origin, status, is_locked bool, sort_order int, note text null,
                      match_candidate_id null fk match_candidates SET NULL (izlenebilirlik), created_at, updated_at
                      Kaynak kisiti (talent_record_id VEYA provider_id) INSERT tetikleyicisinde — tablo CHECK'i DEGIL: iki FK de
                      ON DELETE SET NULL; CHECK olsaydi havuz kaydi / hesap silinince ust satirin silinmesi engellenirdi. Iki kaynagi
                      da silinmis uye "kaynagi silinmis" kalir (asama14 K7 bilgi). Tetikleyici pool_origin'i turetir (havuz kaydi
                      Kashe uyesine bagliysa private + provider_id turetilir; bagli degilse external; yalniz saglayici -> marketplace)
                      ve havuz kaydinin ekibin kurulusuna ait olmasini ister.
internal.crew_member_commercials
                      crew_member_id uuid pk fk crew_members CASCADE, organization_id fk, agreed_cost numeric >= 0, cost_basis talent_cost_basis,
                      currency char(3), client_price numeric null, markup_amount GENERATED (client_price - agreed_cost),
                      margin_rate GENERATED (CASE WHEN client_price > 0 THEN (client_price - agreed_cost)/client_price END),
                      rate_source, source_rate_id null (internal.organization_talent_rates.id), snapshot_at, private_note, created_by, updated_at
```

Yetki (FAZ 5 deseni): public tablolar REVOKE ALL anon/authenticated -> sutun bazli GRANT (SELECT hepsi; INSERT/UPDATE yalniz `crews`
ve `crew_members` kullanici sutunlari; `match_*` uygulamadan YAZILMAZ — yalniz RPC). `internal.crew_member_commercials` tablo yetkisi 0.
Tetikleyici fonksiyonlari REVOKE EXECUTE. `updated_at` tetikleyicileri.

RLS: `match_runs`/`match_candidates` SELECT: etkinlik kapsami (`can_access_event_scope(owner, org, 'events.view')`). `crews`:
SELECT/UPDATE/DELETE `can_access_crew_row(event_id, organization_id, 'crew.view' | 'crew.manage')` = etkinlik sahibi VEYA kurulusta
yetki VEYA admin — **satir sutunlariyla** calisir (id ile yeniden okuyan STABLE fonksiyon `INSERT ... RETURNING`'de yeni satiri
goremez, yanlis red; yerelde yakalandi). INSERT: etkinlik sahibi + (`organization_id` NULL veya `crew.manage`). `crew_members`:
`can_access_crew(crew_id, ...)` (ekip satiri onceki komutta var). **Kurulus uyesi etkinlige sahip olmadan da ekibi gorur/yonetir**
(FAZ 8 oncesi tek kurulus atfi noktasi). Guard: `crews.event_id`, `crew_members.crew_id` degismez; `organization_id` NULL->deger bir
kez; uyenin kaynagi (havuz kaydi / saglayici) degistirilemez — yeni kisi = yeni uye, eskisi `replaced`; `pool_origin` sabit.
`crews.status -> confirmed`: zorunlu her rol `status = confirmed` uyelerle en az `quantity` kadar kapsanmali (22023 "zorunlu rol
kapsanmadi: <slug>"). INSERT tetikleyicisi: `created_by = auth.uid()`, kurulus ekibinde `marketplace_only -> private_first`.

RPC'ler (SECURITY DEFINER, authenticated; anon yok): `run_event_match(p_event_id uuid, p_strategy match_strategy DEFAULT 'individual')
RETURNS uuid`, `mark_match_candidates_shown(uuid, uuid[])`, `mark_match_candidate_clicked(uuid)`, `crew_member_commercial_snapshot(uuid) RETURNS uuid`,
`internal_crew_commercials_list(p_crew_id uuid)`, `internal_crew_commercial_upsert(p_crew_member_id, p_agreed_cost, p_basis, p_currency, p_client_price, p_note)`;
erisim fonksiyonlari `can_access_crew_row(uuid,uuid,text)`, `can_access_crew(uuid,text)` (authenticated EXECUTE).
Denetim: `internal.log_access(org, 'read'|'write', 'crew_member_commercials', ...)` (`detail.op`: `crew.snapshot` / `crew.override`).
Bireysel ekipte (organization_id NULL) ic goruntu YOK: uc RPC de 22023 verir. Snapshot: uyenin havuz kaydi + rolu icin bugun gecerli
ic oran (`valid_from <= bugun`, `valid_to` NULL veya >= bugun; en yeni) kopyalanir, yoksa 22023 "elle gir"; override `rate_source
manual_override`, `client_price` ile `markup_amount`/`margin_rate` GENERATED.

### Match V0.1 — `run_event_match` govdesi (ozet)

1. Etkinlik: sahip = `auth.uid()` degilse 42501; `status NOT IN (confirmed, matching)` ise 22023 ("once onayla"); gereksinim yoksa 22023.
2. Profesyonel adaylar (`individual`/`hybrid`): `v_providers_public`'ten (yayinda + onayli) `provider_type = 'professional'`; rol: `provider_services.role_id = gereksinim.role_id`.
3. Puan (bolum 2 tablosu). `availability_conf`: tarih yok 0.50; tarih var + blok/booking yok 0.90; blok/booking var -> aday DISARIDA.
4. Rol basina `match_score DESC, trust_score DESC NULLS LAST, created_at` ile ilk `limit_per_role` (20); `final_rank` 1..n.
4b. Ajans adaylar (`full_service`/`hybrid`): yayinda + onayli `provider_type = 'agency'`; rol kapsami = kendi `provider_services` UNION Ekibim
    uyelerinin `provider_services` (yalniz acik veri; ozel havuz yok). Her gereksinim icin `covered_i`, `coverage`, `full_service_eligible`
    (bolum 2). `full_service`'te yalniz eligible; `hybrid`'de `coverage > 0` olan tum ajanslar. `role_id` NULL, `coverage_ratio` dolu,
    ilk `limit_orgs` (10), kendi `final_rank` dizisi.
5. `match_runs` satiri (`params`: agirliklar, limit, surum), `match_candidates` satirlari, `candidate_count`, `latency_ms` (clock_timestamp farki).
6. `events.status = 'matching'` (yalniz `confirmed`'den). Donus: run id.

## 4. Dolum

Yok (yeni tablolar bos baslar). `applications` (ilan basvurulari) korunur; `match_candidates` yaninda durur (04 bolum "korunur").

## 5. asama14 — tutarlilik (SALT OKUNUR; dal + uretim)

`docs/envanter/asama14-faz6-eslestirme-kontrol.sql`: K1 tablolar (4 public + 1 internal) + 7 enum (12); K2 `match_*` tablolarina
anon/authenticated INSERT/UPDATE/DELETE yetkisi, tablo + sutun (0 — mutasyon: tek GRANT INSERT -> 11); K3 `internal.crew_member_commercials`
tablo yetkisi (0); K4 6 RPC + 2 erisim fonksiyonu authenticated var + anon yok (16); K5 RLS politikasi (10); K6 aday satir turu tutarsiz
(0); K7 bilgi: kaynagi silinmis ekip uyesi; K8 `events.status = matching` ama kosusu yok (0); K9 kosu basina limit ustu aday (params'tan
okur) (0); K10 bilgi: kosu*100 + ekip; K11 aday turu ile saglayici turu uyumsuz (0); K12 confirmed ekipte kapsanmamis zorunlu rol (0);
K13 ic goruntu kurulusu ekipten farkli (0). Beklenen: K1-K6, K8, K9, K11-K13 ESIT; K7, K10 BILGI. Yerelde: hepsi ESIT, K10 302.

## 6. asama4 T19 / T20 (dalda) ve yerel zincir

T19 (Match V0.1; kendi verisi: roller `faz1test-match-a/b/c`, pro1 -> a, pro2 -> b, pro2 + ajans yayina alinir, musteri etkinligi
'T19 dugun' `create_event_from_spec` ile: a zorunlu 1, b istege bagli 2, c zorunlu 1 kimse vermez; ajans etkinligi gereksinimsiz):
hybrid kosu -> `matching`; pro1 a adayi `date_available + budget_fit`, puan >= 45, conf 0.90; pro2 b adayi butceye uymaz (kod yok);
c icin aday yok; ajans adayi `role_id` NULL, coverage **0.500** ((3*1 + 1*0.5 + 3*0)/7), eligible false, `coverage_full` yok;
`full_service` kosusu 0 aday; c kaldirilinca `full_service` -> ajans eligible, coverage **0.875**, `coverage_full`, rank 1, profesyonel
yok; ilk kosu degismedi (ekle-yalniz); shown/clicked (sahip; ikinci isaret 0; baskasi 42501); pro1/anon kosamaz, gereksinimsiz
etkinlik 22023; RLS: sahip gorur, pro1 0 satir + INSERT 42501, anon 42501.
T20 (ekip + ic goruntu): musteri bireysel ekip + pazaryeri uyesi (`pool_origin marketplace`, created_by, source_policy marketplace_only);
kaynaksiz uye 22023; guard (event_id / crew_id); bireysel snapshot 22023; pro1 ekibi gormez / uye ekleyemez; ajans kurulus ekibi
(`private_first` otomatik) + havuz uyesi (`private`, provider_id pro1 turetildi); bireysel ekibe havuz kaydi 22023; oran yokken snapshot
22023 -> owner oran acar -> snapshot 5000 default -> finance (uye) okur -> override 6000/9000: markup 3000, margin 0.3333; pro1
(crew_coordinator) list 42501; authenticated internal tablo 42501; denetim >= 3; crew_coordinator ekibi gorur + uye gunceller, viewer
(musteri) gorur ama guncelleyemez; kapsanmamis ekip `confirmed` 22023 -> uye confirmed -> ekip confirmed.
Yerel zincir (1 Ekim 2026): faz6_01 uc kez uygulandi (idempotan), asama4 **21/21**, asama14 hepsi ESIT (K10 302), asama13 degismedi.
Yakalanan: `can_access_crew(id)` ile crews SELECT politikasi `INSERT ... RETURNING`'i reddediyordu -> satir sutunlu `can_access_crew_row`.

## 7. Uretim sirasi — 6-DB

**6-DB/01 (sema + RPC'ler, tek dosya `20261002120000_faz6_01_eslestirme_ekip.sql`):** 1. Yerel: iki kez uygula, asama4 T19-T20, asama14.
2. Commit. 3. Dal `db push` (y!). 4. Dalda asama4 21/21, asama14 ESIT. 5. Uretim `db push`. 6. Uretimde asama14 (K10 0), asama5/asama13 degismedi.
7. `git push` -> P1.

## 8. Uygulama parcalari (Claude Code)

**P1 — aday listesi (`18-claude-code-gorevi-p1.md`):** `/etkinliklerim/[id]`'de onayli etkinlikte "Aday öner" -> `run_event_match`
(`hybrid`) -> iki bolum: **"Tam hizmet: ajanslar"** (kapsam yuzdesi, "tam hizmet" rozeti yalniz eligible, kapsanmayan zorunlu roller
acikca yazilir) ve **"Rol bazında profesyoneller"** (rol basina kartlar: ad, sehir, puan, gerekce rozetleri: "aynı şehir", "tarihte
müsait", "bütçeye uygun", "yüksek güven", "yeni yetenek", "tam kapsam"); "Profili gör" (`/p/[id]`; `mark_match_candidate_clicked`), liste
gorununce `mark_match_candidates_shown`; onceki kosular (tarih, surum, aday sayisi) listesi; KVKK itiraz metni. Etkinlik durumu rozeti
`matching`. Sahip degilse hicbir sey yok.
**P2 — ekip kurma (`-p2.md`):** ayni sayfada "Ekip kur": kosudan aday sec (rol basina) -> `crews` + `crew_members` (RLS; `match_candidate_id`
izi); ajans kullanicisi icin kaynak secimi (havuzdan `organization_talent_records` listesi — FAZ 5 panelinin verisi — veya adaylardan);
uye durumu (`proposed/contacted/confirmed/declined/replaced`), kilit, siralama; ekip durumu `draft -> proposed -> confirmed`; "tam hizmet"
kontrolu: zorunlu rol kapsanmadiysa ekip `confirmed` yapilamaz (uygulama + DB CHECK tetikleyicisi). Ic ticari kart: ekip `organization_id`
doluysa ve `commercial.view` -> uye basina `agreed_cost` (snapshot/override), yalniz `commercial.manage` yazar. `/ajans/ekipler`:
kurulusun ekipleri (crew.view).

## 9. Kalici kurallar (6 sonrasi)

- **Skor DB'de hesaplanir, uygulama hesaplamaz.** Degisiklik = yeni `algorithm_version`; eski kosular ve adaylar degistirilmez (ekle-yalniz).
- **Gosterilen her aday kaydedilir** (`was_shown`); uygulama listeyi gosterdigi anda isaretler.
- **`match_*` tablolarina uygulama yazmaz;** yalniz RPC.
- **Ic ticari goruntu yalniz kurulus ekibinde ve yalniz RPC ile;** bireysel ekipte yok.
- **Zorunlu rol kapsanmadan ekip `confirmed` olamaz.**
- **Gerekce kodlari sabit listeden** (02): uygulama kodlari Turkce etikete cevirir, yeni kod uretmez.
- **Ajans kapsami yalniz acik verilerden** (kendi hizmetleri + Ekibim uyeleri); ozel havuz kapsam hesabina girmez (kurulus acikca acmadikca — bugun secenek yok).
- **Zorunlu rol kapsanmayan ajans "tam hizmet" olarak sunulmaz** (`full_service_eligible = false`; `coverage_full` kodu yok).

## 10. Kapanis kaydi

**6-DB/01 (1 Ekim 2026, commit `0b473f0`):** yerelde uc kez uygulandi (idempotan), asama4 21/21, asama14 hepsi ESIT. Dal: ilk asama4
kosusu push bitmeden yapildi (T19-T20 ATLANDI — fonksiyon yoktu), push sonrasi **21/21 GECTI**, asama14 K7/K10 BILGI digerleri ESIT.
Uretim: `db push` 1 dosya; asama14 hepsi ESIT, K10 0 (tablolar bos); asama13 K14 30000 degismedi. `git push` tamam. Siradaki: P1 (`-p1.md`).

(P1, P2 icin doldurulur)
