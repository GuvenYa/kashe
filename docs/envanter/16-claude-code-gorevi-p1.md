# Claude Code gorevi — FAZ 4c / P1: `analyzeEventNeeds` yapisal cikarim (prompt p2, parser 1.1)

Asagidaki metni oldugu gibi Claude Code'a ver. Plan: `docs/envanter/16-faz4c-yeni-talep-akisi.md` (bolum 2 kararlar,
bolum 5 P1); sozlesme: `docs/architecture/06-eventspec-sozlesmesi.md`. ON KOSUL: 4c-DB uretimde (asama12 6 ESIT) ve
4b kodu deploy'da — P1 yalniz kayit icerigini zenginlestirir, DB'ye yeni tablo/sutun gerekmez.

---

Kashe reposundasin. `docs/architecture/06-eventspec-sozlesmesi.md` (spec_jsonb 1.0 alan listesi, provenance, surum
damgalari) ve `docs/envanter/16-faz4c-yeni-talep-akisi.md` (bolum 2 "Cikarim" karari, bolum 5 P1, bolum 6 kurallar)
dosyalarini oku. `app/lib/eventspec.ts` ve `app/lib/ai-actions.ts` icindeki `analyzeEventNeeds`'i (FAZ 4b) incele. Bu
is **yalniz uygulama kodu**: migration yok, RPC cagrisi yok, `/etkinlik-planla` arayuzu ve kullanici davranisi
DEGISMEZ. Amac: `analyzeEventNeeds` rollere ek olarak metindeki YAPISAL alanlari (tur, sehir, tarih, katilimci, butce,
aciliyet, mekan durumu, baslik) her alan icin provenance ile cikarsin; P2'deki sihirbaz bu alanlarla on dolu gelecek.

Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

Yapilacaklar:

1. `app/lib/eventspec.ts` — surum damgalari:
   - `EVENT_NEEDS_PROMPT_VERSION = 'p2'` (prompt metni degisiyor), `EVENT_NEEDS_PARSER_VERSION = 'analyze-event-needs/1.1'`
     (cikarim kodu degisiyor). `EVENTSPEC_SCHEMA_VERSION` `'1.0'` KALIR (alan listesi degismiyor). Model sabiti kalir.
   - Yeni yardimci tip (istege bagli, isim serbest): modelin ham yapisal ciktisi icin `EventNeedsRawField<T> = { value: T; confidence: number; evidence?: string; inferred?: boolean } | null`.
   - `EventSpecV1` ve provenance tipleri DEGISMEZ.

2. `app/lib/ai-actions.ts` — `analyzeEventNeeds`:
   a. **Referans verisi** (Claude'a gitmeden once, brief INSERT'inden sonra; ikisi de kullanici oturumuyla okunur,
      RLS herkese acik):
      - `event_types`: `select('key, name_tr').eq('is_active', true).order('sort_order')` -> `{ key, name_tr }[]`.
      - `turkish_cities`: `select('id, name').order('name')` -> `{ id, name }[]`.
      Sorgu hatasi analizi KESMEZ: `console.error('[eventspec] referans', err)`, ilgili alan cikarilmaz (tur listesi bos
      ise `event_type` yazilmaz; sehir listesi bos ise `city_id` yazilmaz), roller ve tip bugunku gibi calisir.
   b. **Prompt p2** (mevcut prompt metninin ustune; kategori listesi, JSON-yalniz kurali ve "markdown yok" kurali
      aynen kalir). Eklenecekler:
      - Baglam satiri: `Bugun: ${bugun} (Europe/Istanbul).` — `bugun` = `new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())` (YYYY-MM-DD). Tarih ifadelerini bu tarihe gore coz.
      - Etkinlik turu listesi: `- ${name_tr} (key: ${key})` satirlari (event_types'tan); "KESINLIKLE bu key'lerden birini
        sec; uymuyorsa `other`; emin degilsen null".
      - JSON yapisi (mevcut `categories` ve `tip` aynen; yeni alanlar EKLENIR):
        ```
        "event_type":        { "value": "wedding", "confidence": 0.95, "evidence": "dugun" } | null,
        "title":             "kisa baslik (en fazla 80 karakter), ornek: Istanbul'da 120 kisilik dugun" | null,
        "city_name":         { "value": "Istanbul", "confidence": 0.9, "evidence": "Istanbul'da" } | null,   // IL adi (Turkiye'nin 81 ili); ilce yazildiysa ilini bul
        "district":          { "value": "Kadikoy", "confidence": 0.8, "evidence": "Kadikoy'de" } | null,
        "start_date":        { "value": "YYYY-MM-DD", "confidence": 0.6, "evidence": "15 Haziran", "inferred": true } | null,
        "end_date":          ayni yapi | null,   // yalniz cok gunluk etkinlikte
        "date_note":         "metindeki tarih ifadesi, gun belli degilse (ornek: Haziran, yaz aylari, hafta sonu)" | null,
        "is_date_flexible":  { "value": true, "confidence": 0.8, "evidence": "tarih esnek" } | null,
        "participant_count": { "value": 120, "confidence": 0.9, "evidence": "120 kisilik" } | null,
        "budget_min":        { "value": 50000, "confidence": 0.9, "evidence": "50-80 bin TL" } | null,
        "budget_max":        { "value": 80000, "confidence": 0.9, "evidence": "50-80 bin TL" } | null,
        "urgency":           { "value": "urgent" | "flexible", "confidence": 0.7, "evidence": "..." } | null,
        "venue_status":      { "value": "confirmed" | "searching" | "not_needed", "confidence": 0.7, "evidence": "..." } | null,
        ```
      - Kurallar (prompt'a yazilacak):
        - "Yalniz metinde OLAN bilgiyi cikar; olmayan alan null. `confidence` 0-1 arasi; `evidence` metinden kisa alinti."
        - "Tarih: gun belli degilse `start_date` null ve `date_note` doldur. Yil yazilmamissa bugunden sonraki ilk uygun
          yili al ve `inferred: true` yaz. Gecmis tarih uretme."
        - "Butce: YALNIZ metinde acikca yazilmis tutari TRY olarak aktar (`50 bin` -> 50000); metinde yoksa null.
          `reason` ve `tip` icinde fiyat, rakam, para birimi veya butce araligi URETME — fiyati yalniz profesyonel belirler."
          (Bugunku FIYAT/BUTCE YAZMA kurali bu sekilde daraltilir; tamamen kaldirilmaz.)
        - "`urgency`: metin kisa sure/acil diyorsa `urgent`, tarih/plan esnek diyorsa `flexible`; belirtilmemisse null
          (normal yazma)." "`venue_status`: mekan belli/ayarlanmis -> `confirmed`, mekan araniyor -> `searching`, mekan
          gerekmiyor -> `not_needed`; belirtilmemisse null."
        - "`title`: metni ozetleyen kisa ad; sehir ve tur biliniyorsa onlari kullan; uydurma ayrinti ekleme."
      Mevcut kurallar ("Turkce yaz", "2-5 oneri", slug birebir, SADECE JSON) korunur. `max_tokens` 800 -> 1200.
   c. **Parse ve dogrulama** (kod = parser 1.1; her alan icin: tip dogru + alan kumesi gecerli + `confidence >= 0.5`
      degilse YAZILMAZ; yazilmayan alan icin provenance girdisi de olmaz — 06 bolum 1-2):
      - `event_type`: `value` aktif key listesinde -> `spec.event_type`, provenance `extracted`.
      - `city_name` -> `city_id`: `turkish_cities` listesinde **Turkce duyarsiz esleme** ile bul: iki tarafi da
        `normalizeTr(s) = s.toLocaleLowerCase('tr').replace(/İ/g,'i').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').trim()`
        ile normallestirip esitlik; eslesirse `spec.city_id = id`, provenance `{ source: 'extracted', confidence, span, rule: 'city_name_match' }`;
        eslesmezse `city_id` yazilmaz, `extra.city_note = value` (P2 formunda ipucu). `normalizeTr` `app/lib/eventspec.ts`'e
        export edilir (P2 de kullanacak).
      - `district`: string, en fazla 100 karakter -> `spec.district`, `extracted`.
      - `start_date` / `end_date`: `^\d{4}-\d{2}-\d{2}$` + gecerli takvim gunu (`new Date(v + 'T00:00:00Z')` geri ayni
        dizeyi vermeli) + `bugun`'den kucuk DEGIL; `end_date < start_date` ise `end_date` yazilmaz. `inferred: true` ise
        provenance `{ source: 'derived', confidence, rule: 'date_assumed', span }`, degilse `extracted`.
        `date_note` (string, <= 100) -> `extra.date_note` (spec alani DEGIL; provenance girdisi yok).
      - `is_date_flexible`: boolean -> `extracted`.
      - `participant_count`: tam sayi, 1..100000 -> `extracted`.
      - `budget_min` / `budget_max`: sayi >= 0; ikisi de varsa ve `min > max` ise yer degistir; tek biri varsa yalniz o
        yazilir -> `extracted`.
      - `urgency` ∈ `urgent | flexible` (`normal` gelirse yazilmaz), `venue_status` ∈ `confirmed | searching | not_needed` -> `extracted`.
      - `title`: string, kirp <= 200 (prompt 80 ister) -> `spec.title`, provenance `{ source: 'derived', rule: 'model_title', confidence: 0.5 }`
        (model uretimi; arayuz "varsayim" isareti koyabilir).
      - `span`: `evidence` doluysa `description.indexOf(evidence)` >= 0 ise `[bas, bas + evidence.length]`; bulunamazsa
        span yazilmaz.
      - `suggested_roles` ve `tip`: bugunku mantik AYNEN (slug filtresi, `extracted`, bos tip yazilmaz).
      - Sayi alanlari "120" gibi dize gelirse `Number()` ile cevir; NaN ise yazilmaz.
   d. **Kayit**: basari dalinda `specSurumuYaz(spec, provenance, 'needs_input')` — `validation_status` P1'de HER ZAMAN
      `needs_input` (kullanici onaylamadan `valid` olmaz; `valid`'i P2 sihirbazi yazar). Hata dallari (bos yanit, JSON
      parse, gecerli slug yok, istisna) aynen `invalid` + `extra.error`. Brief INSERT'i degismez (`client_web`).
   e. **Donus tipi**: `EventAnalysisResult` basari dalina `spec: EventSpecV1` ve `provenance: EventSpecProvenance`
      eklenir (kaydedilenle AYNI nesneler; kayit basarisiz olsa da doner). `categories`/`tip`/`briefId`/`specVersionId`
      kalir. Hata dalina alan eklenmez. `/etkinlik-planla` istemcisi bu alanlari SIMDI kullanmaz; dokunma.
   f. Roller icin `quantity`/`is_required` P1'de yazilmaz (P2 formu verir; RPC varsayilan 1/true).

3. Dogrulama:
   - `npx tsc --noEmit` bos; `npm run build` basarili.
   - `grep -rn "'p1'\|analyze-event-needs/1.0" app` -> 0 (yalniz sabitler degisti; damga dizeleri baska yerde yazilmaz).
   - `grep -rn "from('event_types')\|from(\"event_types\")" app` -> yalniz `ai-actions.ts` (+ varsa P1 oncesi kullanim; raporla).
   - **Onizleme (bakim anahtari cookie'si + Test Musteri oturumu), `/etkinlik-planla`'da su uc metin** (arayuzde
     bugunku gibi yalniz roller + ipucu gorunur; kayit SQL ile bakilir):
     1. "Haziranda Istanbul'da 120 kisilik dugun, DJ ve fotografci lazim" -> beklenen spec: `event_type=wedding`,
        `city_id`=Istanbul'un id'si, `participant_count=120`, `start_date` YOK, `extra.date_note` ~ "Haziran", roller
        (dj, fotografci, ...), budget yok; provenance'ta yalniz yazilan alanlar.
     2. "15 Haziran'da Kadikoy'de 40 kisilik dogum gunu, butcemiz 20-30 bin TL, mekan belli" -> `event_type=birthday`,
        `city_id`=Istanbul (ilceden il), `district=Kadikoy`, `start_date=<gelecek 15 Haziran>` provenance `derived` +
        `date_assumed`, `participant_count=40`, `budget_min=20000`, `budget_max=30000`, `venue_status=confirmed`.
     3. "Sirket lansmani, tarih esnek, sehir henuz belli degil" -> `event_type=launch`, `is_date_flexible=true`,
        `city_id` YOK, `start_date` YOK; `urgency=flexible` olabilir.
     Ardindan (Guven, Dashboard SQL Editor, uretim, salt okunur):
     ```sql
     select b.id, left(b.raw_text, 50) metin, v.version_no, v.validation_status, v.parser_version, v.prompt_version,
            v.spec_jsonb - 'suggested_roles' - 'tip' as yapisal, v.provenance - 'suggested_roles' - 'tip' as prov
       from public.event_briefs b join public.event_spec_versions v on v.brief_id = b.id
      order by b.created_at desc limit 3;
     ```
     Beklenen: `parser_version = analyze-event-needs/1.1`, `prompt_version = p2`, `validation_status = needs_input`,
     `yapisal` ve `prov` yukaridaki alanlarla; `prov` icindeki her anahtar `yapisal`'da var ve tersi (extra haric).
   - `docs/envanter/asama11-faz4a-etkinlik-kontrol.sql` uretimde: K2/K3 ESIT kalir; K9 artar.

Yapilmayacaklar:
- Arayuz (`/etkinlik-planla`, sihirbaz), model, kategori listesi kaynagi, hata mesajlari degismez.
- `events` / `event_requirements` yazilmaz; `create_event_from_spec` cagrilmaz (P2). `organization_id` gonderilmez.
- `validation_status = 'valid'` yazilmaz. `spec_jsonb`'ye bos/null alan yazilmaz.
- Migration yok. `turkish_cities`/`event_types` icin yeni RPC yok.

Rapor: degisen dosya listesi, tsc/build, grep ciktilari, uc onizleme metni icin olusan brief id'leri ve SQL ciktisi
(Guven kosar), beklenenden sapan alanlar (ozellikle sehir eslemesi ve tarih) ve nedeni. Commit ATMA.
