// Pure data/constants — no 'use server' directive
// Bu dosya hem server actions'tan hem client component'lerden import edilebilir.

export const EVENT_TYPES = [
  { key: 'wedding', label: 'Düğün' },
  { key: 'engagement', label: 'Nişan' },
  { key: 'birthday', label: 'Doğum günü' },
  { key: 'baby_shower', label: 'Baby shower' },
  { key: 'graduation', label: 'Mezuniyet' },
  { key: 'circumcision', label: 'Sünnet' },
  { key: 'corporate', label: 'Kurumsal' },
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