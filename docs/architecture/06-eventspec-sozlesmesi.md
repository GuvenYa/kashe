# 06 — EventSpec sozlesmesi (`event_spec_versions.spec_jsonb`, schema_version 1.0)

**Yer:** `docs/architecture/`. Veri modeli `01-veri-modeli.md` bolum 4; sema `docs/envanter/15-faz4a-etkinlik-eventspec.md`.
**Ilke:** `spec_jsonb` AI ciktisinin surumlu, degistirilemez kaydidir. Sorgulanan alanlar kullanici ONAYINDA `events`
sutunlarina kopyalanir; jsonb icinde filtre yazilmaz. Sozlesme `schema_version` ile surumlenir; alan eklemek 1.x, alan
anlamini degistirmek 2.0'dir.

## 1. schema_version = "1.0" — alan listesi

Butun alanlar istege bagli; uretici bildigini yazar, bilmedigini YAZMAZ (null da yazmaz). Bilinmeyen alan reddedilmez
(ileri surumlerle uyum), ama okuyan taraf yalniz bu listeyi tanir.

| Alan | Tip | Anlam | `events` karsiligi |
|---|---|---|---|
| `event_type` | `event_types.key` (text) | etkinlik turu | `event_type` |
| `title` | text (<= 200) | kisa ad | `title` |
| `start_date`, `end_date` | `YYYY-MM-DD` | tarih | `start_date`, `end_date` |
| `start_time`, `end_time` | `HH:MM` | saat | `start_time`, `end_time` |
| `is_date_flexible` | boolean | tarih esnek mi | `is_date_flexible` |
| `city_id` | integer (`turkish_cities.id`) | sehir | `city_id` |
| `district` | text | ilce/semt | `district` |
| `venue_status` | `confirmed` \| `searching` \| `not_needed` | mekan durumu | `venue_status` |
| `participant_count` | integer >= 0 | katilimci | `participant_count` |
| `budget_min`, `budget_max` | number >= 0 (TRY) | butce | `budget_min`, `budget_max` |
| `urgency` | `normal` \| `urgent` \| `flexible` | aciliyet | `urgency` |
| `suggested_roles` | dizi: `{ "slug": text, "reason": text, "quantity"?: int, "is_required"?: bool }` | onerilen roller (`service_roles.slug`) | `event_requirements` (onayda; `slug` -> `role_id`) |
| `tip` | text | kullaniciya ipucu (gosterim) | — |
| `extra` | nesne | stil/tercih/kisit (serbest) | `extra` |

## 2. provenance

`provenance` nesnesi alan adiyla anahtarlanir; yalniz `spec_jsonb`'de bulunan alanlar icin girdi olur:
`{ "<alan>": { "source": "extracted" | "user_input" | "derived", "confidence": 0..1, "span"?: [bas, son], "rule"?: text, "asked_at"?: iso } }`.
`suggested_roles` icin tek girdi (dizinin tamami). Arayuz `derived` alanlari "varsayim" olarak isaretler (01 bolum 4).

## 3. Surum damgalari (satir sutunlari, spec_jsonb icinde DEGIL)

| Sutun | Anlam | Ornek |
|---|---|---|
| `schema_version` | bu sozlesme | `1.0` |
| `parser_version` | cikarim hattinin surumu (kod + prompt ailesi) | `analyze-event-needs/1.0` |
| `model_id` | kullanilan model | `claude-haiku-4-5` |
| `prompt_version` | prompt metninin surumu (metin degisince artar) | `p1` |
| `validation_status` | `valid` (sozlesmeye uygun, onaya hazir), `needs_input` (eksik alan var), `invalid` (parse/uretim hatasi) | |

Kural: prompt metni degisirse `prompt_version` artar; cikarim mantigi/kodu degisirse `parser_version` artar; model
degisirse `model_id` degisir. Ucu ayni satirda ama bagimsizdir; altin kume karsilastirmasi bunlarla gruplanir.

## 4. Ureticiler

| Uretici | Yazdigi alanlar | Durum |
|---|---|---|
| `analyzeEventNeeds` (`/etkinlik-planla`, 4b — **uretimde 22 Eylul**) | `suggested_roles` (slug + reason), `tip` | `needs_input` (yapisal alan cikarilmiyor); hata halinde `invalid` + `extra.error`; her cagri yeni brief |
| Etkinlik sihirbazi / yeni talep akisi (4c) | tur, tarih, sehir, katilimci, butce + roller | `valid` -> onay -> `events` |
| Event OS brief (FAZ 6+) | tam kume + `extra` | |

Onay (4c): kullanici gecerli surumu onaylayinca `events` satiri `spec_version_id` ile acilir, bolum 1 tablosundaki
karsiliklar kopyalanir, `suggested_roles` -> `event_requirements`. `spec_jsonb` DEGISMEZ; duzeltme = yeni surum.
