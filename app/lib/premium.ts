import type { PremiumTier } from './badges';
import { formatTL } from './para';

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

/**
 * TL formati — "1.500 TL". Bicim TEK KAYNAK app/lib/para.ts.
 * Ad korunuyor: kazanclarim ve premium ekranlari bu adi cagiriyor.
 */
export function formatTRY(amount: number): string {
  return formatTL(amount);
}
/**
 * PREMIUM SIRALAMA AGIRLIGI — TEK KAYNAK (FAZ 10d).
 *
 * Dort yuzey (Kesfet, kategori sayfasi, ana sayfa one cikanlar, ilan listesi)
 * ayni agirlik merdivenini KENDI icinde yaziyordu ve her biri render sirasinda
 * `Date.now()` cagiriyordu; `react-hooks/purity` bunu hakli olarak isaretliyor
 * (render govdesinde okunan saat ayni girdiyle farkli cikti uretebilir).
 *
 * Cozum: agirlik SAF fonksiyon, "simdi" PARAMETRE. Cagiran istegin basinda
 * zamani bir kez alir (`simdiMs()`); ayni istek icindeki tum karsilastirmalar
 * ayni ana gore yapilir — siralama sonucu eskisiyle AYNI, ama tekrarlanabilir.
 *
 * Merdiven: agency(3) > plus(2) > premium(1) > none/suresi gecmis(0).
 * Suresiz premium (`until` NULL) AKTIFTIR — `isPremiumActive` ile ayni kural.
 */

/** Siralamada kullanilacak "simdi" — istek basinda BIR KEZ alinir. */
export function simdiMs(): number {
  return Date.now();
}

/**
 * Premium kademesinin siralama agirligi.
 *
 * @param tier  `premium_tier` (null / 'none' / 'premium' / 'plus' / 'agency')
 * @param until `premium_until` (ISO; null = suresiz)
 * @param simdi karsilastirma ani (ms) — `simdiMs()` ile alinir
 */
export function premiumAgirligi(
  tier: string | null | undefined,
  until: string | null | undefined,
  simdi: number
): number {
  if (!tier || tier === 'none') return 0;
  if (until && new Date(until).getTime() <= simdi) return 0;
  if (tier === 'agency') return 3;
  if (tier === 'plus') return 2;
  if (tier === 'premium') return 1;
  return 0;
}
