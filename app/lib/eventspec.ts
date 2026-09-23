/**
 * EventSpec sozlesmesi — `event_spec_versions.spec_jsonb`, schema_version 1.0.
 *
 * Kaynak: `docs/architecture/06-eventspec-sozlesmesi.md` (alan listesi, provenance, surum
 * damgalari, ureticiler) ve `docs/envanter/15-faz4a-etkinlik-eventspec.md` bolum 3 (sema).
 *
 * Ilke: `spec_jsonb` AI ciktisinin surumlu, degistirilemez kaydidir. Uretici BILDIGINI yazar,
 * bilmedigini yazmaz (null da yazmaz); bu yuzden butun alanlar istege baglidir. Sorgulanan
 * alanlar kullanici ONAYINDA (4c) `events` sutunlarina kopyalanir; jsonb icinde filtre yazilmaz.
 *
 * Surum damgalari satir sutunudur, `spec_jsonb` icinde DEGIL: prompt metni degisirse
 * `prompt_version`, cikarim kodu degisirse `parser_version`, model degisirse `model_id` artar.
 */

/** Bu dosyadaki tiplerin uydugu sozlesme surumu. Alan listesi degismedigi surece 1.0 kalir. */
export const EVENTSPEC_SCHEMA_VERSION = '1.0';

/**
 * `analyzeEventNeeds` cikarim hattinin surumu (kod + prompt ailesi).
 * 1.1 (FAZ 4c/P1): rollere ek olarak yapisal alanlar (tur, sehir, tarih, katilimci,
 * butce, aciliyet, mekan durumu, baslik) cikariliyor ve alan bazinda suzuluyor.
 */
export const EVENT_NEEDS_PARSER_VERSION = 'analyze-event-needs/1.1';

/**
 * `analyzeEventNeeds` prompt metninin surumu — metin degisince artar.
 * p2 (FAZ 4c/P1): baglam tarihi, etkinlik turu listesi ve yapisal alanlar eklendi.
 */
export const EVENT_NEEDS_PROMPT_VERSION = 'p2';

/**
 * `analyzeEventNeeds` cagrisinin modeli. Cagri bu sabiti kullanir; model dizesi
 * iki yerde yazilmaz (damga ile cagri ayni kaynaktan gelsin).
 */
export const EVENT_NEEDS_MODEL_ID = 'claude-haiku-4-5';

/** `event_briefs.source` enum'u. */
export type EventBriefSource =
  | 'client_web'
  | 'business_workspace'
  | 'agency_eventos'
  | 'api'
  | 'legacy_import';

/** `event_spec_versions.validation_status` enum'u. */
export type EventSpecValidationStatus = 'valid' | 'invalid' | 'needs_input';

/** `spec_jsonb.venue_status` (06 bolum 1). */
export type EventSpecVenueStatus = 'confirmed' | 'searching' | 'not_needed';

/** `spec_jsonb.urgency` (06 bolum 1). */
export type EventSpecUrgency = 'normal' | 'urgent' | 'flexible';

/** Onerilen rol girdisi; `slug` = `service_roles.slug`. Onayda `event_requirements` olur. */
export type EventSpecSuggestedRole = {
  slug: string;
  reason: string;
  quantity?: number;
  is_required?: boolean;
};

/**
 * schema_version 1.0 alan listesi (06 bolum 1). Bilinmeyen alan reddedilmez (ileri
 * surumlerle uyum), ama okuyan taraf yalniz bu listeyi tanir.
 */
export type EventSpecV1 = {
  /** `event_types.key` */
  event_type?: string;
  /** en fazla 200 karakter */
  title?: string;
  /** YYYY-MM-DD */
  start_date?: string;
  end_date?: string;
  /** HH:MM */
  start_time?: string;
  end_time?: string;
  is_date_flexible?: boolean;
  /** `turkish_cities.id` */
  city_id?: number;
  district?: string;
  venue_status?: EventSpecVenueStatus;
  participant_count?: number;
  /** TRY */
  budget_min?: number;
  budget_max?: number;
  urgency?: EventSpecUrgency;
  suggested_roles?: EventSpecSuggestedRole[];
  /** kullaniciya gosterilen ipucu; `events` karsiligi yok */
  tip?: string;
  /** stil/tercih/kisit, hata ayrintisi, eslesmeyen sehir/tarih notu gibi serbest alanlar */
  extra?: Record<string, unknown>;
};

/** Tek alanin nereden geldigi (06 bolum 2). */
export type EventSpecProvenanceEntry = {
  source: 'extracted' | 'user_input' | 'derived';
  /** 0..1 */
  confidence?: number;
  /** ham metindeki [bas, son] konumu */
  span?: [number, number];
  rule?: string;
  /** ISO zaman damgasi */
  asked_at?: string;
};

/**
 * Alan adiyla anahtarlanir; yalniz `spec_jsonb`'de BULUNAN alanlar icin girdi olur.
 * `suggested_roles` icin dizinin tamamina tek girdi yazilir.
 */
export type EventSpecProvenance = Record<string, EventSpecProvenanceEntry>;

/**
 * Modelin YAPISAL alan icin verdigi ham cikti (parser 1.1). Kod bunu suzer:
 * tip dogru + kume gecerli + `confidence` esigi gecerse `spec_jsonb`'ye yazilir,
 * gecmezse alan hic yazilmaz (06 bolum 1: bilinmeyen alan yazilmaz).
 */
export type EventNeedsRawField<T> = {
  value: T;
  /** 0..1 */
  confidence: number;
  /** metinden kisa alinti; provenance `span`'i bununla hesaplanir */
  evidence?: string;
  /** model degeri varsaydiysa (ornek: yil yazilmamis tarih) */
  inferred?: boolean;
} | null;

/**
 * Turkce duyarsiz karsilastirma anahtari (sehir adi eslemesi, P2 formu da kullanir).
 * Buyuk/kucuk harf, Turkce harfler ve bastaki/sondaki bosluk farkini siler.
 */
export function normalizeTr(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/İ/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .trim();
}
