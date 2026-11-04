// Pure data/constants — no 'use server' directive
// Bu dosya hem server actions'tan hem client component'lerden import edilebilir.

// ETKINLIK TURLERI BURADA DEGIL: tek kaynak `event_types` tablosu
// (FAZ 10b). Sunucu `app/lib/etkinlik-turleri.ts`, istemci
// `app/components/etkinlik-turleri-provider.tsx` uzerinden okur; etiketleme
// `app/lib/etkinlik-turu.ts` (`etiketle`). Yeni tur = tabloda satir.
//
// Butce araliklari SABIT KALIR: `conversations_budget_range_check` hala CHECK
// listesi (tablo yok), degeri burasi tasir.
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