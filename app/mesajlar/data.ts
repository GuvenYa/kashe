// Pure data/constants — no 'use server' directive
// Bu dosya hem server actions'tan hem client component'lerden import edilebilir.

// TEK KAYNAK — etkinlik taksonomisi. Bu listeyi güncellemek TÜM türetilen yüzeyleri
// (Teklif Al brief formu · keşfet etkinlik filtresi · kategori-bilgileri etkinlik_turleri
// çipleri · ilan formu/filtresi) otomatik genişletir; DB tarafında constraint'ler ayrı
// migration ile eşlenir. Sıra: sosyal blok → kurumsal blok → Diğer.
// NOT: Çekim/iş türleri (product, fashion, social, promo, ad, kids, stage, school, mall,
// family, outdoor, activation) etkinlik DEĞİLDİR ve buraya GİRMEZ (ayrı brief alanı — backlog).
export const EVENT_TYPES = [
  // Sosyal
  { key: 'wedding', label: 'Düğün' },
  { key: 'engagement', label: 'Nişan' },
  { key: 'henna', label: 'Kına gecesi' },
  { key: 'birthday', label: 'Doğum günü' },
  { key: 'baby_shower', label: 'Baby shower' },
  { key: 'graduation', label: 'Mezuniyet' },
  { key: 'circumcision', label: 'Sünnet' },
  // Kurumsal
  { key: 'corporate', label: 'Kurumsal' },
  { key: 'launch', label: 'Lansman' },
  { key: 'fair', label: 'Fuar' },
  { key: 'conference', label: 'Konferans' },
  { key: 'congress', label: 'Kongre' },
  { key: 'gala', label: 'Gala' },
  { key: 'concert', label: 'Konser' },
  // Diğer
  { key: 'other', label: 'Diğer' },
] as const;

export type EventTypeKey = (typeof EVENT_TYPES)[number]['key'];

export const EVENT_TYPE_KEYS = EVENT_TYPES.map(
  (e) => e.key
) as readonly EventTypeKey[];

export const BUDGET_RANGES = [
  { key: 'under_5k', label: '5.000 TL altı' },
  { key: '5k_15k', label: '5.000 - 15.000 TL' },
  { key: '15k_30k', label: '15.000 - 30.000 TL' },
  { key: '30k_50k', label: '30.000 - 50.000 TL' },
  { key: 'over_50k', label: '50.000 TL üzeri' },
  { key: 'open', label: 'Açık / Görüşülecek' },
] as const;

export type BudgetRangeKey = (typeof BUDGET_RANGES)[number]['key'];

export const BUDGET_RANGE_KEYS = BUDGET_RANGES.map(
  (b) => b.key
) as readonly BudgetRangeKey[];

// Etiket çevirme yardımcıları (UI'da key → label dönüştürmek için)
export function getEventTypeLabel(key: EventTypeKey | string | null): string | null {
  if (!key) return null;
  const found = EVENT_TYPES.find((e) => e.key === key);
  return found?.label ?? null;
}

export function getBudgetRangeLabel(key: BudgetRangeKey | string | null): string | null {
  if (!key) return null;
  const found = BUDGET_RANGES.find((b) => b.key === key);
  return found?.label ?? null;
}

/**
 * Gecerli bir butce araligi anahtari mi?
 * `conversations_budget_range_check` yalniz BUDGET_RANGES anahtarlarini kabul eder;
 * serbest metin 23514 verir ve o UPDATE'teki DIGER alanlar da yazilmaz.
 */
export function isBudgetRangeKey(v: unknown): v is BudgetRangeKey {
  return (
    typeof v === 'string' && (BUDGET_RANGE_KEYS as readonly string[]).includes(v)
  );
}

/**
 * Tutar araligini (TL) `budget_range` anahtarina cevirir.
 * Esik UST sinira gore secilir (`max ?? min`): 20000-30000 -> `15k_30k`.
 * Ikisi de bossa null doner (cagiran taraf paylasim aciksa `open`'a duser).
 */
export function budgetToRangeKey(
  min: number | null | undefined,
  max: number | null | undefined
): BudgetRangeKey | null {
  const deger = max ?? min;
  if (deger === null || deger === undefined || !Number.isFinite(deger)) {
    return null;
  }
  if (deger <= 5000) return 'under_5k';
  if (deger <= 15000) return '5k_15k';
  if (deger <= 30000) return '15k_30k';
  if (deger <= 50000) return '30k_50k';
  return 'over_50k';
}