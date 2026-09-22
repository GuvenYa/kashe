# 15 — FAZ 4a: Etkinlik ve EventSpec semasi

**Kaynak plan:** `docs/architecture/01-veri-modeli.md` bolum 4 (dort tablo, provenance, surum alanlari), `04-goc-plani.md`
FAZ 4 madde 23-26, `02-guvenlik-modeli.md` (satir sahipligi + kurulus yetkisi).
**Durum:** 4a KAPANDI, 4b KAPANDI (22 Eylul 2026; ilk EventSpec kayitlari uretimde). Kapanis bolum 8-9. Siradaki: 4c (plan 16).

## 1. Amac ve sinir

Event AI'in veri temeli: dogal dil brief (ham) -> AI ciktisi (surumlu, kaynak ve guven bilgisiyle) -> onaylanmis
canonical etkinlik -> normalize rol ihtiyaclari. 4a **yalniz sema** kurar; veri yazmaz (event_types referansi haric),
eski akislara (`listings`, `quote_requests`, `conversations`) dokunmaz; yalniz `conversations.event_id` ekler (NULL).
Uygulama 4b'ye kadar bu tablolari okumaz/yazmaz.

## 2. Kararlar (22 Eylul 2026, Guven ile)

| Konu | Karar | Neden |
|---|---|---|
| Parcalama | **4a** sema (bu dosya) -> **4b** ilk uretici: `etkinlik-planla`/sihirbaz AI ciktisi `event_briefs` + `event_spec_versions`'a yazilir (Claude Code) -> **4c** yeni talep akisi (`events` -> `event_requirements` -> pro-bul/teklif-topla; ayri plan) | Kucuk adimlar; 4b ile altin kume ve TUBITAK IP kaniti hemen birikmeye baslar; eski akis calismaya devam eder |
| Etkinlik turu | **`event_types` tablosu + FK** (15 anahtar = bugunku `conversations/listings.event_type` CHECK listesi = `app/mesajlar/data.ts EVENT_TYPES`; `group_key` sosyal/kurumsal/diger = sihirbazin gruplamasi). Eski text + CHECK sutunlari degismez (FAZ 10) | Event AI turu genisletince veri degisir, kod degil; asama11 K1 iki kumenin esitligini olcer |
| Yazma yolu / RLS | **Satir sahipligi + kurulus yetkisi:** sahip (`created_by_user_id` / `owner_user_id` = auth.uid()) VEYA `organization_id` icin `has_org_permission(org, 'events.view' | 'events.manage')`; admin okur; anon HIC. `event_spec_versions` **ekle-yalniz** (UPDATE/DELETE grant yok); gecerli surum `set_current_event_spec(uuid)` RPC'siyle | Ticari sir yok (internal'a girmez); RPC-yalniz yol 4c'de akis hizini dusururdu; ekle-yalniz surumler altin kume butunlugu icin sart |
| Eski veri | **Paralel akis, dolum yok** (04 madde 25). Ileride istenirse `event_brief_source = 'legacy_import'` ile ayri idempotan dolum | Sehir/tur eslemesi tahmin ister; 3a dersi |
| `events.spec_version_id` | plana ek sutun: hangi surumden onaylandigi | Provenance zinciri kopmasin (altin kume degerlendirmesi hangi surum onaylandi bilmeli) |
| `events.title` | plana ek, NULL olabilir, 200 karakter | Liste/gosterim icin ad; extra jsonb icinde saklamak sorgulanamaz |
| `event_brief_source` | plandaki 4 deger + `legacy_import` | Ileride dolum icin kaynak damgasi |
| Surum numarasi | BEFORE INSERT tetikleyicisi: verilmezse max+1; `is_current` true gelirse eskiler dusurulur; `created_by_user_id` bossa auth.uid() | Istemci sadece ekler; tek-gecerli invaryanti kismi tekil indeksle de zorlanir |
| `algorithm_version` | bu tablolarda YOK (01 bolum 4: match_runs / crews / proposals'ta) | Yalniz siralama algoritmasi degisince EventSpec surumu artmasin |

## 3. Sema ozeti

| Tablo | Anahtar sutunlar | Kisitlar |
|---|---|---|
| `event_types` | key pk, name_tr, group_key, sort_order, is_active | key `^[a-z0-9]+(_[a-z0-9]+)*$`; group sosyal/kurumsal/diger; 15 satir |
| `event_briefs` | created_by_user_id -> profiles CASCADE, organization_id -> organizations SET NULL, source enum, raw_text, attachments jsonb[] | raw_text 1-20000; attachments dizi |
| `event_spec_versions` | brief_id CASCADE, version_no, spec_jsonb, provenance jsonb, schema_version, parser_version, model_id, prompt_version, validation_status enum, is_current, created_by_user_id | UNIQUE(brief, version_no); brief basina bir is_current (kismi tekil indeks); jsonb tipleri |
| `events` | brief_id SET NULL, spec_version_id SET NULL, organization_id SET NULL, owner_user_id CASCADE, title, event_type -> event_types, start/end date-time, is_date_flexible, city_id, district, venue_status, participant_count, budget_min/max, currency TRY, urgency, extra jsonb, status enum, confirmed_at | tarih sirasi, katilimci 0-1e6, butce >= 0 ve min <= max |
| `event_requirements` | event_id CASCADE, role_id -> service_roles RESTRICT, quantity, is_required, budget_hint_min/max, duration_hours, notes, sort_order | UNIQUE(event, role); adet 1-1000; sure 0-720 saat |
| `conversations.event_id` | -> events SET NULL | eski akista NULL |

Enum'lar: `event_brief_source`, `event_spec_validation_status`, `event_venue_status`, `event_urgency`, `event_status`.
Fonksiyonlar: `fn_event_spec_version_before_insert()` (tetikleyici), `set_current_event_spec(uuid)` (authenticated),
`can_access_event_scope(owner, org, permission)` (politika yardimcisi; sahip / kurulus yetkisi / admin).

**Provenance sozlesmesi (01 bolum 4):** `{"<alan>": {"source": "extracted|user_input|derived", "confidence": 0-1, ...}}`.
**spec_jsonb sozlesmesi:** `docs/architecture/06-eventspec-sozlesmesi.md` (schema_version 1.0 alan listesi, provenance,
surum damgalari, ureticiler). jsonb serbest; sorgulanan alanlar `events` sutunlarina onayda kopyalanir.

## 4. Dosyalar

| Dosya | Icerik |
|---|---|
| `supabase/migrations/20260922150000_faz4a_01_etkinlik_eventspec.sql` | 5 enum, `event_types` (+15 satir), 4 tablo, indeksler, updated_at tetikleyicileri, surum tetikleyicisi, RPC, yardimci fonksiyon, GRANT/RLS, `conversations.event_id` |
| `docs/envanter/asama11-faz4a-etkinlik-kontrol.sql` | SALT OKUNUR, dal + uretim: K1 event_types = CHECK listesi, K2-K3 surum invaryantlari, K4 pasif rol, K5 RLS 5, K6 anon 0, K7 ekle-yalniz, K8 conversations.event_id, K9 bilgi |
| `docs/envanter/asama4-davranis-testi.sql` | T15 (bolum 6); T0'a etkinlik temizligi |

**Yerel zincir (22 Eylul):** dosya iki kez uygulandi (ikinci kosu yalniz "already exists" NOTICE'lari); asama11 8 ESIT + K9
BILGI; asama4 T0-T15 **16/16 GECTI**. Mutasyon: events SELECT politikasi `true` -> T15 HATA (pro1 gordu); authenticated'a
spec UPDATE acildi -> HATA + asama11 K7 FARK; surum tetikleyicisi kapali -> HATA (version_no NULL); anon'a events SELECT
-> HATA + K6 FARK. Geri alinca GECTI/ESIT.

## 5. Uretim sirasi (adim adim)

On kosul: `git status` temiz; FAZ 0/04 ve 2c uretimde. Migration yalniz `db push` ile.

1. Commit: `git add -A` / `git commit -m "FAZ 4a: etkinlik ve EventSpec semasi (event_types, event_briefs, event_spec_versions, events, event_requirements), asama11, T15"`.
2. **Uretimde on kontrol (SQL Editor, salt okunur):**
   ```sql
   select table_name from information_schema.tables where table_schema='public' and table_name in ('event_types','event_briefs','event_spec_versions','events','event_requirements');
   select pg_get_constraintdef(oid) from pg_constraint where conname='conversations_event_type_check';
   ```
   Beklenen: ilk sorgu bos; ikinci sorgu 15 anahtar (wedding ... other) — bolum 2'deki liste ile ayni olmali, farkliysa DUR.
3. **Dal:** `supabase link --project-ref ukqhgspaallzjscjodbb` -> `supabase db push` (1 dosya).
4. **Dalda test:** `asama4-davranis-testi.sql` -> 16 satir, **T15 GECTI**; `asama11-faz4a-etkinlik-kontrol.sql` -> 8 ESIT + K9 0.
5. **Uretim:** `supabase link --project-ref qydsooqmflrrwtgawhsv` -> `supabase db push` (1 dosya).
6. **Uretimde dogrulama:** `asama11` -> 8 ESIT, K9 0 (henuz veri yok). Onizlemede degisiklik beklenmez (uygulama
   tablolari okumuyor); `/etkinlik-planla` ve `/mesajlar` bir kez acilir.
7. `git push`.

**Geri alma (4a):** `ALTER TABLE conversations DROP COLUMN event_id;` sonra 4 tablo + event_types + 5 enum + 3 fonksiyon
DROP (bagimlilik: event_requirements -> events -> event_spec_versions -> event_briefs). Veri yok, kayip yok.

## 6. Kalici kurallar (4a sonrasi)

- **Yeni etkinlik turu = `event_types` satiri** (migration ile; admin paneli karari 4c). Eski `conversations/listings.event_type`
  CHECK listesi ve `EVENT_TYPES` dizisi FAZ 10'a kadar elle ayni tutulur; asama11 K1 farki yakalar.
- **`event_spec_versions` ekle-yalniz.** Duzeltme = yeni surum. Gecerli surum yalniz `set_current_event_spec` ile.
- **Sorgulanan alan sutun, esnek alan `extra`.** `events`'e yeni sorgulanabilir alan gerekirse sutun eklenir (migration +
  tip), jsonb icinde filtre yazilmaz.
- **Ticari alan buraya girmez.** Butce `events`'te (alici tarafi); ajansin ic maliyeti/marji FAZ 6-7'de `internal.*`.

## 7. Sonraki: 4b

`analyzeEventNeeds` (etkinlik-planla) ve sihirbaz ciktisi `event_briefs` (raw_text = kullanici metni, source client_web)
+ `event_spec_versions` (spec_jsonb = onerilen kategoriler/roller + cikarilan alanlar, provenance, `schema_version` 1.0,
`parser_version` = `analyze-event-needs/1.0`, `prompt_version` p1, `model_id`) olarak kaydedilir; kullanici arayuzu
degismez (yalniz kayit). Sozlesme `docs/architecture/06-eventspec-sozlesmesi.md`. Claude Code gorev metni:
`15-claude-code-gorevi-4b.md`. Her cagri yeni brief (surumleme 4c'deki "duzelt" akisiyla); hata halinde de surum
yazilir (`invalid`), altin kume icin.

## 8. Kapanis kaydi (22 Eylul 2026)

Commit `6b3b496` (4a + FAZ 0/04 ve 2c kapanislari). **Uretim on kontrolu:** 5 tablo yok; `conversations_event_type_check`
15 anahtar, migration'daki `event_types` satirlariyla birebir. **Dal (`ukqhgspaallzjscjodbb`):** 1 dosya push; asama4
T0-T15 **16/16 GECTI** (T9 ve T15 dahil); asama11 K1-K8 ESIT, K9 0. **Uretim (`qydsooqmflrrwtgawhsv`):** 1 dosya
push; asama11 **K1-K8 ESIT, K9 0** (K1 0/0: event_types = CHECK listesi; K5 5; K6 0; K7 0; K8 2). `git push`
sorunsuz. Uygulama bu tablolari henuz okumuyor/yazmiyor; ilk yazim 4b ile.

## 9. 4b kapanis kaydi (22 Eylul 2026)

**Kod (Claude Code, 2 dosya):** `app/lib/eventspec.ts` (sabitler `1.0` / `analyze-event-needs/1.0` / `p1` /
`claude-haiku-4-5`; `EventSpecV1` 17 istege bagli alan; provenance ve enum tipleri), `app/lib/ai-actions.ts`
`analyzeEventNeeds`: uzunluk kontrolunden sonra `event_briefs` INSERT (client_web), Claude cagrisi degismeden, sonucta
`event_spec_versions` INSERT (basari: `suggested_roles` + `tip`, provenance `extracted`, `needs_input`; dort hata dalinda
`extra.error` + `invalid`); iki INSERT de kendi try/catch'inde, akis kesilmez; sonuca `briefId`/`specVersionId` eklendi.
tsc bos, build basarili. Sapmalar (kabul): `!anthropic` kapisi brief kaydindan once (bos anahtarla kayit olusmaz —
kullaniciya gorunen mesaj degismesin diye yerinde birakildi; hata yolu kod incelemesiyle kapatildi); bos `tip` yazilmaz
(06 bolum 1 kurali). Prompt metni, model, arayuz degismedi. Commit + push Guven.

**Canli dogrulama (uretim, Test Musteri, onizleme):** ayni metin iki kez ("Haziranda Istanbul'da 120 kisilik dugun, DJ
ve fotografci lazim") -> kullanici tarafinda fark yok; SQL: **2 brief** (`client_web`, `eb302fd8…`, `0a6ccd7d…`),
her birinde **surum 1** (`is_current` true, `needs_input`, `1.0` / `analyze-event-needs/1.0` / `claude-haiku-4-5` /
`p1`), `spec_jsonb.suggested_roles` 4 rol (dj, fotografci, etkinlik-koordinatoru, ses-isik; gerekceli) + `tip`.
Iki kosunun gerekceleri farkli — altin kume icin tam da istenen: ayni girdi, surumlenmis farkli ciktilar.
**Ilk EventSpec kayitlari uretimde.** asama11 K2/K3 ESIT beklenir, K9 = 2020000.

