# 16 — FAZ 4c: Yeni talep akisi (EventSpec -> etkinlik -> teklif/ilan)

**Kaynak plan:** `04-goc-plani.md` FAZ 4 madde 24-26, `06-eventspec-sozlesmesi.md` bolum 4 (onay), `15-faz4a` bolum 2
(parcalama), `05-arayuz-modeli.md`.
**Durum:** 4c-DB URETIMDE (23 Eylul 2026; bolum 7). Uygulama P1-P3 Claude Code (bolum 5): P1 sirada.

## 1. Amac ve sinir

Kullanicinin anlattigi etkinlik, AI cikarimi + kendi duzeltmesiyle **onaylanmis etkinlik** (`events` +
`event_requirements`) olur; oradan bugunku teklif/ilan/kesfet akislarina on dolu ve `event_id` bagiyla gecilir.
Eski akislarin mantigi degismez; yalniz bag eklenir. Ajans ic maliyeti/marji bu fazda yok (FAZ 6-7).

## 2. Kararlar (22 Eylul 2026, Guven ile)

| Konu | Karar | Neden |
|---|---|---|
| Akis yeri | **Sihirbaz yeniden yazilir** (`/etkinlik-sihirbazi` = EventSpec akisi: 0 Anlat -> 1 Tur -> 2 Sehir -> 3 Tarih/katilimci/butce -> 4 Ihtiyac (roller) -> Onayla). `/etkinlik-planla` oldugu gibi kalir (ayni uretici). Onay sonrasi `/etkinliklerim/[id]`; liste `/etkinliklerim` | Guven'in tercihi; metin + form tek yerde. Sihirbazin canli sayaci ve kesfet/teklif linkleri korunur (adim 4'te) |
| Cikarim | **Genisletilmis prompt (p2, parser 1.1):** `analyzeEventNeeds` roller + `tip`'e ek olarak `event_type` (15 anahtar), `start_date`, `end_date`, `is_date_flexible`, sehir adi (kodda `turkish_cities` -> `city_id`), `participant_count`, `budget_min/max`, `urgency` cikarir; her alan `provenance` (extracted/derived + confidence). Bilinmeyen alan YAZILMAZ | Form on dolu gelir; altin kume yapisal alanlarla degerlenir. Fiyat kurali: model butceyi yalniz metinde varsa cikarir, uretmez |
| Onay yolu | **`create_event_from_spec(p_version_id)` RPC** (SECURITY DEFINER): is_current + valid surumden events (confirmed) + gereksinimler; sahiplik brief sahibi / kurulus events.manage / admin; gecersiz tur/sehir/slug -> hata, hicbir satir yok; ayni surumden ikinci onay 23505 (EXISTS + kismi tekil indeks). Kullanici duzeltmeleri once **yeni surum** (`user_input` provenance, `validation_status = 'valid'`) olarak eklenir, onay o surumden | Provenance zinciri tam; iki tabloya yarim yazim olmaz; ekle-yalniz surum ilkesi korunur (RPC surumu degistirmez) |
| Eski akislara bag | **`quote_requests.event_id`, `listings.event_id`** (NULL, FK SET NULL) + `/etkinliklerim/[id]`'de rol basina "Teklif topla" / "Ilan ac" / "Kesfet" on dolu; `conversations.event_id` etkinlikten baslayan sohbette dolar | Eski akis degismez; etkinlik "olu uc" olmaz; FAZ 5-7 bu baglari kullanir |
| Sahip | `events.owner_user_id = auth.uid()` (onaylayan); `organization_id` brief'ten | Kurulus adina onaylayan uye sahip olur, kurulus bagi korunur |
| Form-yalniz kullanim | Metin adimi atlanirsa brief `raw_text` = formdan uretilen ozet (`[form] Dugun, Istanbul, 2026-06-15, 120 kisi`), surum `user_input` | `raw_text` NOT NULL; ham girdi bu durumda formdur |
| Oturum | Adimlar oturumsuz gezilebilir (sayac calisir); "Anlat" (AI) ve "Onayla" oturum ister (`/giris?redirect=`) | Yazma RLS'i authenticated |
| Durum gecisleri | 4c'de yalniz `confirmed`; `matching`/`booked` FAZ 5-7 | Kapsam |

## 3. Veritabani (4c-DB)

| Dosya | Icerik |
|---|---|
| `supabase/migrations/20260922200000_faz4c_01_etkinlik_onay.sql` | `quote_requests.event_id`, `listings.event_id` (+ kismi indeks); `events_spec_version_id_key` kismi tekil indeks; `create_event_from_spec(uuid)` (authenticated + service_role EXECUTE; anon yok) |
| `docs/envanter/asama12-faz4c-onay-kontrol.sql` | SALT OKUNUR: K1-K2 event_id sutun+FK, K3 surumu valid olmayan etkinlik 0, K4 gereksinim sayisi = surumdeki gecerli tekil slug, K5 RPC yetkisi, K6 ayni surumden coklu etkinlik 0, K7-K8 bilgi |
| `docs/envanter/asama4-davranis-testi.sql` | T16 (needs_input / eski surum 22023; onay alanlari + gereksinim adet/zorunlu/sira; tekrar slug tekillesir; ayni surum 23505; gecersiz slug/tur 22023 atomik; pro1 42501; anon 42501; admin onayi owner=admin; quote_requests.event_id SET NULL) |

**Yerel zincir (22 Eylul):** dosya iki kez uygulandi; asama12 6 ESIT + 2 BILGI; asama4 T0-T16 **17/17 GECTI**. Mutasyon:
RPC sahiplik kontrolu kaldirildi -> T16 HATA (pro1 onayladi); anon'a EXECUTE -> HATA + K5 FARK; tekil indeks
kaldirildi -> T16 yine GECTI (RPC'nin EXISTS kontrolu yakalar; indeks yaris kosulu icin ikinci kat).

**RPC sozlesmesi:** girdi gecerli surum id'si; cikti `events.id`. Hata kodlari: `no_data_found` (surum yok),
`insufficient_privilege` (42501, sahip degil / anon), `invalid_parameter_value` (22023: is_current degil, valid degil,
event_type/city_id/slug gecersiz), `unique_violation` (23505: ayni surumden ikinci). Tarih/butce CHECK'leri
`check_violation` (23514) verir — istemci formda dogrular.

## 4. Uretim sirasi — 4c-DB (adim adim)

On kosul: `git status` temiz; 4a/4b uretimde. Migration yalniz `db push` ile.

1. Commit (4b kapanis kaydi da bu commit'te): `git add -A` /
   `git commit -m "FAZ 4c-DB: create_event_from_spec RPC, quote_requests/listings.event_id, asama12, T16, plan 16, P1 gorev metni; 4b kapanis kaydi"`.
2. Uretimde on kontrol (SQL Editor, salt okunur):
   ```sql
   select table_name, column_name from information_schema.columns where table_schema='public' and column_name='event_id' and table_name in ('quote_requests','listings','conversations');
   select count(*) from pg_proc where proname = 'create_event_from_spec';
   ```
   Beklenen: yalniz `conversations | event_id`; sayi 0.
3. Dal: `supabase link --project-ref ukqhgspaallzjscjodbb` -> `supabase db push` (1 dosya).
4. Dalda: `asama4-davranis-testi.sql` -> 17 satir, **T16 GECTI**; `asama12-faz4c-onay-kontrol.sql` -> 6 ESIT + K7/K8 0.
5. Uretim: `supabase link --project-ref qydsooqmflrrwtgawhsv` -> `supabase db push` (1 dosya).
6. Uretimde: `asama12` -> 6 ESIT, K7/K8 0; `asama11` degismedi (K9 = brief/surum sayisi).
7. `git push`. Ardindan P1.

Geri alma (4c-DB): `DROP FUNCTION create_event_from_spec(uuid); DROP INDEX events_spec_version_id_key;
ALTER TABLE quote_requests DROP COLUMN event_id; ALTER TABLE listings DROP COLUMN event_id;` (veri yok).

## 5. Uygulama parcalari (Claude Code)

**P1 — cikarim (`16-claude-code-gorevi-p1.md`):** prompt p2 + parser 1.1: model her yapisal alani
`{ value, confidence, evidence, inferred? }` olarak verir; kod tip/kume/`confidence >= 0.5` suzgecinden gecenleri yazar,
gecmeyeni YAZMAZ. Sehir adi -> `city_id` eslemesi kodda (`turkish_cities`, Turkce duyarsiz `normalizeTr`; eslesmezse
`extra.city_note`); gun belli olmayan tarih `start_date` degil `extra.date_note`; yil varsayilan tarih `derived` +
`rule: date_assumed`; `title` model uretimi = `derived`. Butce yalniz metinde acikca yazildiysa aktarilir; `reason`/`tip`
fiyat uretmez. `EventAnalysisResult`'a `spec` + `provenance`; `/etkinlik-planla` arayuzu AYNI (yalniz kayit zenginlesir).
Kabul: "Haziranda Istanbul'da 120 kisilik dugun..." -> `event_type=wedding`, `city_id`=Istanbul, `participant_count=120`,
`start_date` yok + `date_note`, roller ayni. `validation_status` P1'de HEP `needs_input` (kullanici onaylamadan `valid`
olmaz; `valid`'i sihirbaz yazar).

**P2 — sihirbaz + etkinliklerim (`16-claude-code-gorevi-p2.md`, P1 sonra):** `/etkinlik-sihirbazi` yeniden: adim 0
"Anlat" (istege bagli; `analyzeEventNeeds` -> brief + v1), adim 1-4 on dolu form (tur, sehir, tarih+katilimci+butce,
roller adet/zorunlu + canli sayac), "Onayla" -> `event_spec_versions` INSERT (v2, `user_input`/`extracted` karisik
provenance, `valid`) -> `create_event_from_spec` -> `/etkinliklerim/[id]`. `/etkinliklerim` liste (RLS: kendi + kurulus).
Detay: alanlar, roller, durum; rol basina "Teklif topla" / "Ilan ac" / "Kesfet" linkleri (on dolu query).
Oturumsuz: adimlar gezilir, Anlat/Onayla giris ister.

**P3 — baglar (`16-claude-code-gorevi-p3.md`, P2 sonra):** teklif-topla `event_id` alir ve `quote_requests.event_id`
yazar; ilan olusturma `listings.event_id`; etkinlik sayfasindan baslayan sohbet `conversations.event_id`
(`mesajlar/actions.ts`). `/etkinliklerim/[id]`'de bagli talep/ilan/sohbet listesi. Kabul: asama12 K8 > 0 canli testte.

Her parca: git-status-first -> tsc bos -> build -> onizleme turu (main vs dal) -> rapor -> Guven commit/deploy.

## 6. Kalici kurallar (4c sonrasi)

- **Onay yalniz RPC ile.** Uygulama `events`/`event_requirements`'a INSERT yapmaz (UPDATE serbest: tarih/baslik
  duzenleme, iptal). Yeni onay yolu gerekirse RPC genisletilir.
- **Duzeltme = yeni surum.** Kullanicinin formda degistirdigi her alan `user_input` provenance ile yeni surumde; `spec_jsonb`
  hicbir zaman UPDATE edilmez.
- **Eski akis + `event_id`:** etkinlikten baslayan her talep/ilan/sohbet `event_id` tasir; bagimsiz baslayanlar NULL.
  Eski tablolara `event_id` disinda sutun eklenmez.
- **Prompt degisikligi = `prompt_version` artisi** (06 bolum 3); cikarim mantigi = `parser_version`.

## 7. Kapanis kaydi

**4c-DB (23 Eylul 2026, commit `0b67814`):** uretim on kontrolu beklendigi gibi (yalniz `conversations.event_id`, RPC
0); dal `db push` 1 dosya; dalda asama4 **17/17** (T16 GECTI: needs_input/eski surum 22023, onay alanlari + 2 gereksinim
sirali/adetli, ayni surum 23505, gecersiz slug/tur 22023 atomik, pro1/anon 42501, admin onayi owner=admin,
quote_requests.event_id SET NULL), asama12 K1-K6 ESIT + K7/K8 0; uretim `db push` 1 dosya; uretimde asama12 K1-K6 ESIT,
K7/K8 0 (henuz onaylanmis etkinlik yok). `git push` tamam. Siradaki: P1 (`16-claude-code-gorevi-p1.md`).

**P1 (23 Eylul 2026, commit `1a0a79c`):** `app/lib/eventspec.ts` (`p2`, `analyze-event-needs/1.1`, `EventNeedsRawField`,
`normalizeTr`), `app/lib/ai-actions.ts` (`event_types` + `turkish_cities` referans okumasi, baglam tarihi, prompt p2,
parser 1.1 suzgeci: tip + kume + confidence 0.5-1, gecmis tarih/ters aralik yazilmaz, `50.000` gibi ayracli dize
reddedilir; sonuca `spec` + `provenance`). tsc bos, build basarili. Uretim kaydi (3 metin, hepsi `needs_input` / `p2` /
`1.1`): dugun -> `wedding`, `city_id` 34, `participant_count` 120, `extra.date_note` "Haziran", `title` derived;
dogum gunu -> `birthday`, 34, `district` Kadikoy, butce 20000-30000, `venue_status` confirmed, 40 kisi — **`start_date`
YAZILMADI** (`date_note` "15 Haziran" kaldi: model yili 2026 varsaydi, gecmis tarih suzgeci dusurdu; Claude Code'un yerel
olcumunde 2027-06-15 cikmisti — model kararsiz); lansman -> `launch`, `is_date_flexible`, `urgency` flexible,
`venue_status` searching (fazla; formda duzeltilir). Provenance anahtarlari = spec anahtarlari (extra haric).
**Acik madde (P3'e):** parser 1.2 — `inferred` tarih bugunden onceyse yili bugunden sonraki ilk uygun yila kaydir
(`date_assumed`), boylece "15 Haziran" formu on doldurur.

**P2 (23 Eylul 2026, commit `db3e1b3`):** `app/etkinlik-sihirbazi/actions.ts` (`confirmEventFromWizard`: dogrulama, taban
surumle alan bazinda provenance karsilastirmasi, form-yalniz brief `[form] ...`, surum `wizard/1.0` + `valid`, RPC
hata eslemesi), `sihirbaz-client.tsx` (adim 0 Anlat + 4 form adimi + Onayla; tur listesi `event_types`'tan),
`page.tsx`, `app/etkinliklerim/page.tsx` + `[id]/page.tsx`, menu; `EVENT_WIZARD_PARSER_VERSION`. tsc bos, build
basarili; embed adlari yoklamayla dogrulandi. Canli: Anlat -> on dolu form -> Onayla -> `/etkinliklerim/<id>`; brief
`bb375985` v1 `needs_input` (`is_current=false`) + v2 `wizard/1.0` `valid`; form-yalniz brief `ceb638d8` v1 `wizard/1.0`
`valid`; oturumsuz Onayla -> `/giris?redirect=` -> giris sonrasi ayni adim/secimlerle donus DOGRULANDI. Uretimde asama12
K1-K6 ESIT, **K7 = 20000**. Kusurlar: (1) metin/sayi kutularinda 6-7 sn gecikme — her tus `router.push` ile sunucu
bilesenini yeniden kosturuyor (page.tsx `searchParams` okumuyor; gereksiz) -> **P2b** (`16-claude-code-gorevi-p2b.md`:
yerel history API + yerel state); (2) sayisi 0 olan kategori cipi secilemiyor (Ankara'da rol secilemedi) -> P3;
(3) bitis = baslangic ise "tarih -> tarih" gosterimi -> P3.

(P2b-P3 kapanislari buraya eklenir)
