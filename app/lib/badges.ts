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

/** "Yeni" eşiği (gün). Rozet + teklif-topla keşif kotası tek kaynaktan okur. */
export const NEW_BADGE_DAYS = 30;

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

  // Yeni — son NEW_BADGE_DAYS günde kaydolmuş
  if (input.createdAt) {
    const days = (Date.now() - new Date(input.createdAt).getTime()) / 86400000;
    if (days <= NEW_BADGE_DAYS) {
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
// =============================================================================
// MÜSAİTLİK — "Yoğun" tespiti (Sıra 3)
// =============================================================================

/**
 * Önümüzdeki BUSY_WINDOW_DAYS günün HEPSİ doluysa profil "yoğun" sayılır.
 * Dolu gün = availability_blocks (manuel) ∪ onaylı bookings event_date.
 * Gevşek eşik: penceredeki her gün kapalıysa yoğun; 1 boş gün bile varsa müsait.
 */
export const BUSY_WINDOW_DAYS = 7;

/** Pencerede kaç gün dolu olursa "yoğun" sayılır (BUSY_WINDOW_DAYS içinden). */
export const BUSY_THRESHOLD = 5;

/** Bir tarihi yerel 'YYYY-MM-DD' anahtarına çevir (saat dilimi kaymadan). */
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Bugünden itibaren BUSY_WINDOW_DAYS günün tarih anahtarları.
 * Sorgu aralığını ve doluluk kontrolünü buradan türetiriz (tek kaynak).
 */
export function busyWindowKeys(today: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 0; i < BUSY_WINDOW_DAYS; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    keys.push(dateKey(d));
  }
  return keys;
}

/**
 * Penceredeki (BUSY_WINDOW_DAYS) günlerden en az BUSY_THRESHOLD tanesi
 * doluysa profil "yoğun" sayılır. Eşik tabanlı — delik delik ama yoğun
 * takvimleri de yakalar, tek-iki boşluğu tolere eder.
 * blockedSet: 'YYYY-MM-DD' string'lerinden oluşan Set.
 */
export function isBusy(
  blockedSet: Set<string>,
  today: Date = new Date()
): boolean {
  if (blockedSet.size === 0) return false;
  const filledCount = busyWindowKeys(today).filter((k) =>
    blockedSet.has(k)
  ).length;
  return filledCount >= BUSY_THRESHOLD;
}

// =============================================================================
// ROZET FİLTRESİ — keşfet toggle'ları için yardımcı (Sıra 3)
// =============================================================================

/**
 * Bir profil, verilen rozet anahtarlarından HERHANGİ BİRİNE sahip mi? (VEYA havuzu)
 * keys: ['premium','verified','topRated','popular'] alt kümesi.
 * Premium ve verified türetilmiş (rozet listesinde olmayabilir), o yüzden
 * burada doğrudan kontrol ediyoruz.
 */
export function matchesAnyBadge(input: BadgeInput, keys: string[]): boolean {
  if (keys.length === 0) return true; // hiç seçim yok → herkes geçer

  for (const key of keys) {
    if (key === 'premium') {
      if (isPremiumActive(input.premiumTier, input.premiumUntil)) return true;
    } else if (key === 'verified') {
      if (isVerified(input)) return true;
    } else {
      // topRated / popular → getBadges'ten türet
      if (getBadges(input).some((b) => b.key === key)) return true;
    }
  }
  return false;
}