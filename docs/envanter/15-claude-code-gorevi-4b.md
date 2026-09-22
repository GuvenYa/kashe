# Claude Code gorevi — FAZ 4b: `analyzeEventNeeds` ciktisi brief + EventSpec surumu olarak kaydedilir

Asagidaki metni oldugu gibi Claude Code'a ver. Sema: `docs/envanter/15-faz4a-etkinlik-eventspec.md` (bolum 3);
sozlesme: `docs/architecture/06-eventspec-sozlesmesi.md`. ON KOSUL: FAZ 4a uretimde (22 Eylul, asama11 tam) — kod
deploy'u tablolardan sonra gider.

---

Kashe reposundasin. `docs/envanter/15-faz4a-etkinlik-eventspec.md` (bolum 3 sema, bolum 6 kurallar) ve
`docs/architecture/06-eventspec-sozlesmesi.md` (spec_jsonb 1.0, provenance, surum damgalari, bolum 4 uretici satiri)
dosyalarini oku. Bu is **yalniz uygulama kodu**: migration yok, RPC yok, mevcut kullanici davranisi DEGISMEZ. Amac:
`/etkinlik-planla`'daki `analyzeEventNeeds` her cagrisinda kullanicinin metnini `event_briefs`'e, AI ciktisini
`event_spec_versions`'a yazsin; kullanici hicbir fark gormesin. Bu, Event AI'in altin kumesinin ilk kaynagidir.

Baslamadan: `git status --short` temiz olmali; degilse dur ve soyle.

Yapilacaklar:

1. `app/lib/eventspec.ts` (yeni):
   - `export const EVENTSPEC_SCHEMA_VERSION = '1.0'`, `EVENT_NEEDS_PARSER_VERSION = 'analyze-event-needs/1.0'`,
     `EVENT_NEEDS_PROMPT_VERSION = 'p1'`, `EVENT_NEEDS_MODEL_ID = 'claude-haiku-4-5'` (mevcut cagridaki model dizesiyle
     AYNI kaynak: cagri bu sabiti kullansin, iki yerde yazilmasin).
   - `EventSpecV1` tipi: 06 bolum 1 tablosundaki alanlar, hepsi istege bagli (`suggested_roles: { slug: string; reason: string; quantity?: number; is_required?: boolean }[]`, `tip?: string`, `extra?: Record<string, unknown>` ...).
   - `EventSpecProvenance` tipi: `Record<string, { source: 'extracted' | 'user_input' | 'derived'; confidence?: number; span?: [number, number]; rule?: string; asked_at?: string }>`.
   - `EventBriefSource` tipi: `'client_web' | 'business_workspace' | 'agency_eventos' | 'api' | 'legacy_import'`;
     `EventSpecValidationStatus`: `'valid' | 'invalid' | 'needs_input'`.

2. `app/lib/ai-actions.ts` — `analyzeEventNeeds` icine kayit (sira onemli):
   a. Giris ve uzunluk kontrolleri gectikten sonra, Claude'a gitmeden ONCE `event_briefs`'e INSERT:
      `{ created_by_user_id: user.id, source: 'client_web', raw_text: description }` (organization_id gonderilmez —
      kurulus atfi 4c). `id` alinir (`.select('id').single()`). Hata olursa `console.error('[eventspec] brief kaydi', err)`
      ve analiz NORMAL devam eder (kayit hicbir zaman kullanici akisini kesmez); `briefId = null`.
   b. Claude cagrisi ve parse mevcut haliyle kalir (prompt METNI degismez — `prompt_version` p1 bu metni damgalar).
   c. Sonucta `briefId` doluysa `event_spec_versions`'a INSERT:
      - basari: `spec_jsonb = { suggested_roles: categories.map(c => ({ slug: c.slug, reason: c.reason })), tip }`,
        `provenance = { suggested_roles: { source: 'extracted' }, tip: { source: 'extracted' } }`,
        `validation_status: 'needs_input'`;
      - uretim/parse hatasi (`Analiz uretilemedi`, `okunamadi`, `uygun oneri bulunamadi`, catch dali):
        `spec_jsonb = { extra: { error: '<kisa neden>' } }`, `provenance = {}`, `validation_status: 'invalid'`;
      - her iki halde `brief_id, schema_version, parser_version, model_id, prompt_version` sabitlerden. `version_no` ve
        `is_current` GONDERILMEZ (tetikleyici verir); `created_by_user_id` gonderilmez (tetikleyici auth.uid()).
      Hata olursa `console.error('[eventspec] surum kaydi', err)`, akis devam eder.
   d. Donus tipine iki istege bagli alan: `EventAnalysisResult` basari dalina `briefId?: string`,
      `specVersionId?: string` (4c bunlari `events.brief_id` / `spec_version_id` icin kullanacak). Hata dalina alan
      eklenmez. Cagiran bilesenler bu alanlari SIMDI kullanmaz.
   e. Ayni istekte iki kez kayit olmasin: fonksiyon zaten tek cagri; yeniden deneme yapan bir sarmalayici varsa
     (etkinlik-planla istemcisi) kontrol et ve raporla, degistirme.

3. Ucuz koruma: `raw_text` ve `spec_jsonb` boyutu — description zaten 1000 karaktere kirpiliyor; ek kirpma yok.

4. Dogrulama:
   - `npx tsc --noEmit` bos; `npm run build` basarili.
   - `grep -n "from('event_briefs')\|from('event_spec_versions')" app` -> yalniz `app/lib/ai-actions.ts` (iki INSERT).
   - `grep -rn "claude-haiku-4-5" app` -> `analyzeEventNeeds` icin tek kaynak `eventspec.ts` sabiti (diger AI fonksiyonlari
     kendi dizelerini koruyabilir; degistirme).
   - **Onizleme (bakim anahtari cookie'si + Test Musteri oturumu):** `/etkinlik-planla`'da bir metin gir ("Haziranda
     Istanbulda 120 kisilik dugun, DJ ve fotografci lazim"), oneri gelsin. Ardindan (Guven, Dashboard SQL Editor,
     uretim, salt okunur):
     ```sql
     select b.id, b.source, left(b.raw_text, 60) metin, v.version_no, v.is_current, v.validation_status, v.schema_version, v.parser_version, v.model_id, v.prompt_version, v.spec_jsonb
       from public.event_briefs b left join public.event_spec_versions v on v.brief_id = b.id
      order by b.created_at desc limit 5;
     ```
     Beklenen: 1 brief (client_web, metin), 1 surum (version_no 1, is_current true, needs_input, 1.0 /
     analyze-event-needs/1.0 / claude-haiku-4-5 / p1, spec_jsonb icinde suggested_roles + tip). Ayni metni ikinci kez
     gonderince YENI brief + surum 1 (ayni brief'e surum 2 DEGIL — her cagri yeni brief; surumleme 4c'de "duzelt" akisiyla).
   - Hata yolu: `ANTHROPIC_API_KEY`'i yerelde bosaltip bir cagri yap -> brief var, surum `invalid` + `extra.error`;
     kullanici eski hata mesajini gorur. (Yerel dev'de uretim DB'sine yazacagi icin bu denemeyi Test Musteri ile yap ve
     raporda brief id'lerini yaz; Guven asama11 K9'da sayilari gorecek.)
   - `docs/envanter/asama11-faz4a-etkinlik-kontrol.sql` uretimde: K2 (brief = is_current) ve K3 (surum bosluk yok) ESIT
     kalmali; K9 artik > 0.

Yapilmayacaklar:
- Prompt metni, model, kategori listesi, hata mesajlari, arayuz degismez.
- `events` / `event_requirements` yazilmaz (4c). `organization_id` gonderilmez.
- Sihirbaz (`etkinlik-sihirbazi`) ve `recommendProfessionals` (pro-bul) bu turda kayit yapmaz (ayri karar).
- Migration yok.

Rapor: degisen dosya listesi, tsc/build, grep ciktilari, onizlemede olusan brief/surum id'leri ve SQL ciktisi (Guven
kosar), hata yolu denemesinin sonucu, sapma ve nedeni. Commit ATMA.
