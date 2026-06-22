/**
 * İlan öne çıkarma (doküman 12.3). Premium PROFİL'i öne çıkarır; bu ise
 * belirli bir İLANI öne çıkarır (müşteri/işletme için, süreli).
 * DB: listings tablosunda is_urgent/urgent_until, featured_category_until,
 * featured_home_until, notified_at kolonları (zaten mevcut).
 * Fiyatlar kod sabiti. iyzico gelince satın alma bunlara bağlanır;
 * şimdilik simülasyon + admin verebilir (premium ile aynı yaklaşım).
 */

export type PromotionType = 'urgent' | 'featured_category' | 'featured_home' | 'notify';

export type PromotionPlan = {
  type: PromotionType;
  label: string;
  /** Kısa açıklama — kullanıcıya ne kazandırır */
  desc: string;
  /** Sabit fiyat (TL) — süreli olanlar için bu süre boyunca */
  price: number;
  /** Etki süresi (gün). 0 = anlık/tek seferlik (bildirim gibi) */
  durationDays: number;
  /** Görsel vurgu */
  highlighted?: boolean;
};

export const PROMOTION_PLANS: PromotionPlan[] = [
  {
    type: 'urgent',
    label: 'Acil Etiketi',
    desc: 'İlanına "Acil" rozeti ekle, hızlı başvuru topla.',
    price: 199,
    durationDays: 7,
    highlighted: true,
  },
  {
    type: 'featured_category',
    label: 'Kategori Üstü',
    desc: 'İlanın, kategori ve ilan listelerinde üst sıralarda görünsün.',
    price: 399,
    durationDays: 7,
  },
  {
    type: 'featured_home',
    label: 'Vitrin',
    desc: 'İlanın ana sayfa ve keşfet vitrininde öne çıksın.',
    price: 999,
    durationDays: 7,
  },
  {
    type: 'notify',
    label: 'Bildirim Gönder',
    desc: 'İlgili profesyonellere ilanından haberdar eden bir bildirim gönderilsin.',
    price: 299,
    durationDays: 0,
  },
];

/** Süre seçenekleri (gün) — admin atama + simülasyon için */
export const PROMOTION_DURATIONS: { days: number; label: string }[] = [
  { days: 3, label: '3 gün' },
  { days: 7, label: '7 gün' },
  { days: 14, label: '14 gün' },
];

export function getPromotionPlan(type: PromotionType): PromotionPlan | null {
  return PROMOTION_PLANS.find((p) => p.type === type) ?? null;
}

export function promotionLabel(type: PromotionType): string {
  return getPromotionPlan(type)?.label ?? type;
}

/**
 * Bir "...until" tarihinin hâlâ aktif olup olmadığı.
 * null/geçmiş = aktif değil.
 */
export function isPromotionActive(until: string | null | undefined): boolean {
  if (!until) return false;
  return new Date(until) > new Date();
}

/**
 * Acil etiket aktif mi? Hem is_urgent bool hem urgent_until tarihine bakar.
 * (is_urgent true ama süresi geçmişse aktif değil.)
 */
export function isUrgentActive(
  isUrgent: boolean | null | undefined,
  urgentUntil: string | null | undefined
): boolean {
  if (!isUrgent) return false;
  return isPromotionActive(urgentUntil);
}