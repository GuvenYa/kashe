/**
 * Otomatik rozet (badge) sistemi.
 *
 * Rozetler veriden ANLIK hesaplanır — DB'de saklanmaz, manipüle edilemez,
 * her zaman günceldir. Profil kartı ve profil detayında kullanılır.
 *
 * Öncelik sırası (yüksekten düşüğe): verified > topRated > popular > new
 * Kartta sınırlı sayıda gösterilir; düşük öncelikli rozet üsttekiler varsa elenir.
 */

export type BadgeKey = 'premium' | 'verified' | 'topRated' | 'popular' | 'new';

export type Badge = {
  key: BadgeKey;
  label: string;
  /** Görsel ton — Kashe paletinden */
  tone: 'moss' | 'terracotta' | 'plum' | 'ink' | 'premium';
};

// Öncelik: küçük index = yüksek öncelik
const BADGE_ORDER: BadgeKey[] = ['premium', 'verified', 'topRated', 'popular', 'new'];

export type PremiumTier = 'none' | 'premium' | 'plus' | 'agency';

type BadgeInput = {
  approvalStatus?: string | null;
  createdAt?: string | null;
  rating?: { count: number; average: number } | null;
  premiumTier?: PremiumTier | null;
  premiumUntil?: string | null;
};

/**
 * Premium aktif mi? Tier 'none' değil VE süresi geçmemiş.
 * premium_until null ise (süresiz/manuel) ve tier varsa aktif kabul edilir.
 */
export function isPremiumActive(
  tier?: PremiumTier | null,
  until?: string | null
): boolean {
  if (!tier || tier === 'none') return false;
  if (!until) return true; // süresiz (manuel atama)
  return new Date(until).getTime() > Date.now();
}

/**
 * Bir profil için hak edilen tüm rozetleri öncelik sırasıyla döndürür.
 */
/** Profil doğrulanmış mı? (isim yanında tik olarak gösterilir, rozet listesinde değil) */
export function isVerified(input: BadgeInput): boolean {
  return input.approvalStatus === 'approved';
}

export function getBadges(input: BadgeInput): Badge[] {
  const earned: Badge[] = [];

  // Premium — en yüksek öncelikli rozet (ödeme/kampanya ile aktif)
  if (isPremiumActive(input.premiumTier, input.premiumUntil)) {
    earned.push({ key: 'premium', label: 'Premium', tone: 'premium' });
  }

  // NOT: 'verified' artık rozet listesinde değil — isim yanında tik (isVerified).

  // Yüksek puanlı — ortalama >= 4.5 ve en az 3 yorum
  if (input.rating && input.rating.count >= 3 && input.rating.average >= 4.5) {
    earned.push({ key: 'topRated', label: 'Yüksek Puanlı', tone: 'terracotta' });
  }

  // Çok tercih edilen — 10+ yorum
  if (input.rating && input.rating.count >= 10) {
    earned.push({ key: 'popular', label: 'Çok Tercih Edilen', tone: 'plum' });
  }

  // Yeni — son 30 günde kaydolmuş
  if (input.createdAt) {
    const days = (Date.now() - new Date(input.createdAt).getTime()) / 86400000;
    if (days <= 30) {
      earned.push({ key: 'new', label: 'Yeni', tone: 'ink' });
    }
  }

  // Öncelik sırasına diz
  return earned.sort(
    (a, b) => BADGE_ORDER.indexOf(a.key) - BADGE_ORDER.indexOf(b.key)
  );
}

/**
 * Kartta gösterilecek sınırlı rozet seti (en yüksek öncelikli ilk N).
 * "Yeni", daha güçlü bir rozet varsa elenir — yeni ama kanıtlanmış profilde
 * "Yeni" demek bilgi katmaz.
 */
export function getCardBadges(input: BadgeInput, limit = 2): Badge[] {
  let badges = getBadges(input);
  // Başka rozet varsa "new"i çıkar
  if (badges.length > 1) {
    badges = badges.filter((b) => b.key !== 'new');
  }
  return badges.slice(0, limit);
}

/** Tailwind sınıfları — ton bazlı (rozet pill stili) */
export const BADGE_TONE_CLASS: Record<Badge['tone'], string> = {
  moss: 'text-moss bg-moss/10 border-moss/30',
  terracotta: 'text-terracotta bg-terracotta/10 border-terracotta/30',
  plum: 'text-plum bg-plum/10 border-plum/30',
  ink: 'text-ink-72 bg-ink-72/10 border-ink-72/20',
  premium: 'text-[#8A6D1F] bg-[#F4E9C8] border-[#D9C179]',
};
