import type { PremiumTier } from './badges';

export type PremiumPlan = {
  tier: Exclude<PremiumTier, 'none'>;
  label: string;
  monthlyPrice: number; // TL/ay
  /** Hangi roller bu planı alabilir (boşsa herkes) */
  forRoles: string[];
  features: string[];
  /** Görsel vurgu — kart için */
  highlighted?: boolean;
};

/**
 * Premium planları (doküman 12.2). Fiyatlar kod sabiti — nadir değişir,
 * DB'ye gerek yok. iyzico gelince satın alma bu planlara bağlanır.
 */
export const PREMIUM_PLANS: PremiumPlan[] = [
  {
    tier: 'premium',
    label: 'Premium',
    monthlyPrice: 499,
    forRoles: ['professional'],
    features: [
      'Keşfet listelerinde öne çıkma',
      'Profilde Premium rozeti',
      'Önceliklendirilmiş teklif sıralaması',
      'Sınırsız hizmet ve paket',
    ],
    highlighted: true,
  },
  {
    tier: 'plus',
    label: 'Plus',
    monthlyPrice: 999,
    forRoles: ['professional'],
    features: [
      'Premium\'un tüm avantajları',
      'Kategori sayfalarında üst sıralarda',
      'Gelişmiş profil istatistikleri',
      'Öncelikli destek',
    ],
  },
  {
    tier: 'agency',
    label: 'Ajans',
    monthlyPrice: 1999,
    forRoles: ['agency'],
    features: [
      'Ajans profilinde öne çıkma',
      'Sınırsız ekip üyesi',
      'Ajans rozeti ve vitrin',
      'Öncelikli destek',
    ],
  },
];

/** Tier → plan bilgisi */
export function getPlan(tier: PremiumTier): PremiumPlan | null {
  if (tier === 'none') return null;
  return PREMIUM_PLANS.find((p) => p.tier === tier) ?? null;
}

/** Tier → okunabilir etiket */
export function tierLabel(tier: PremiumTier | null | undefined): string {
  if (!tier || tier === 'none') return 'Standart';
  return getPlan(tier)?.label ?? tier;
}

/** Admin atama için süre seçenekleri (ay) */
export const PREMIUM_DURATIONS: { months: number; label: string }[] = [
  { months: 1, label: '1 ay' },
  { months: 3, label: '3 ay' },
  { months: 6, label: '6 ay' },
  { months: 12, label: '1 yıl' },
];

/** Komisyon oranı (doküman 12.1 — %10) */
export const COMMISSION_RATE = 0.1;

/** Bir tutardan komisyon ve net hesapla (anlık — DB'ye yazılmaz) */
export function calcCommission(gross: number): {
  gross: number;
  commission: number;
  net: number;
} {
  const commission = Math.round(gross * COMMISSION_RATE * 100) / 100;
  return {
    gross,
    commission,
    net: Math.round((gross - commission) * 100) / 100,
  };
}

/** TL formatı (₺1.500) */
export function formatTRY(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}