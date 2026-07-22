import type { Profile, Service, PriceUnit } from './types';

/** §11 — Birim ÖNEKİ (total → boş). Tek kaynak. */
const PRICE_UNIT_PREFIX: Record<PriceUnit, string> = {
  total: '',
  hourly: 'Saatlik',
  half_day: 'Yarım gün',
  full_day: 'Tam gün',
};

/** "Talep üzerine" yerine yeni gösterim metni (tek kaynak). */
export const PRICE_ON_REQUEST_LABEL = 'Fiyat görüşülür';

export function isProfessional(profile: Profile | null | undefined): boolean {
  return profile?.role === 'professional';
}

export function isClient(profile: Profile | null | undefined): boolean {
  return profile?.role === 'client';
}

export function isBusiness(profile: Profile | null | undefined): boolean {
  return profile?.role === 'business';
}

export function isAgency(profile: Profile | null | undefined): boolean {
  return profile?.role === 'agency';
}

export function getRoleLabel(role: string | null | undefined): string {
  const labels: Record<string, string> = {
    professional: 'Profesyonel',
    client: 'Müşteri',
    business: 'Kurumsal',
    agency: 'Ajans',
  };
  return labels[role || ''] || 'Belirtilmemiş';
}

/**
 * Profil hangi alanların eksik olduğunu döndürür.
 * Yayınlama için gerekli minimum alanlar.
 * 
 * @param profile - Kullanıcı profili
 * @param services - Profesyonel için hizmet listesi (varsa). Aktif hizmet kontrolü için.
 */
export function getMissingPublishFields(
  profile: Profile,
  services?: Service[] | null
): string[] {
  const missing: string[] = [];

  // Tüm roller için gerekli
  if (!profile.full_name || profile.full_name.trim().length === 0) {
    missing.push('Ad Soyad');
  }
  if (!profile.avatar_url) {
    missing.push('Profil fotoğrafı');
  }
  if (!profile.bio || profile.bio.trim().length < 20) {
    missing.push('Hakkımda (en az 20 karakter)');
  }
  if (!profile.city_id) {
    missing.push('Şehir');
  }
  if (!profile.phone) {
    missing.push('Telefon');
  }

  // Profesyonel için ekstra
  if (profile.role === 'professional') {
    if (!profile.primary_category_id) {
      missing.push('Ana hizmet kategorisi');
    }
    // En az 1 aktif hizmet
    const activeServices = (services || []).filter((s) => s.is_active);
    if (activeServices.length === 0) {
      missing.push('En az 1 aktif hizmet');
    }
  }

  // Kurumsal için ekstra
  if (profile.role === 'business') {
    if (!profile.company_name || profile.company_name.trim().length === 0) {
      missing.push('Şirket adı');
    }
  }

  // Ajans için ekstra
  if (profile.role === 'agency') {
    if (!profile.company_name || profile.company_name.trim().length === 0) {
      missing.push('Ajans adı');
    }
  }

  return missing;
}

export function canPublish(profile: Profile, services?: Service[] | null): boolean {
  return getMissingPublishFields(profile, services).length === 0;
}

/**
 * 0-100 arası tamlık yüzdesi (UI'da progress bar için)
 */
export function getCompletenessPercent(
  profile: Profile,
  services?: Service[] | null
): number {
  const checks: boolean[] = [
    !!profile.full_name,
    !!profile.avatar_url,
    !!profile.bio && profile.bio.length >= 20,
    !!profile.city_id,
    !!profile.phone,
  ];

  if (profile.role === 'professional') {
    checks.push(!!profile.primary_category_id);
    const activeServices = (services || []).filter((s) => s.is_active);
    checks.push(activeServices.length > 0);
  }
  if (profile.role === 'business') {
    checks.push(!!profile.company_name);
  }
  if (profile.role === 'agency') {
    checks.push(!!profile.company_name);
  }

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

/**
 * Fiyat formatlama: 5000 → "5.000 ₺"
 */
export function formatPrice(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * §11 fiyat gösterimi: [birim öneki] + fiyat + [başlangıç soneki].
 *   onRequest         → "Fiyat görüşülür"
 *   total + range     → "5.000 – 15.000 ₺"      (BUGÜNKÜ çıktı, birebir)
 *   hourly            → "Saatlik 1.500 ₺"
 *   full_day          → "Tam gün 15.000 ₺"
 *   total + starting  → "4.000 ₺'den başlar"     (tek değer = min)
 * Geriye uyumlu: unit/starting default'ları (total/false) bugünkü davranışı korur.
 */
export function formatPriceRange(
  min: number | null | undefined,
  max: number | null | undefined,
  onRequest: boolean,
  unit: PriceUnit = 'total',
  starting = false
): string {
  if (onRequest) return PRICE_ON_REQUEST_LABEL;
  if (min === null || min === undefined || max === null || max === undefined) {
    return '';
  }

  // "₺ arkada" tek-fiyat (yeni modlar: birim/başlangıç) — "1.500 ₺"
  const trailingSingle = (v: number) =>
    `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(v)} ₺`;

  // Fiyat gövdesi:
  //  - starting veya birimli (unit≠total) → tek değer (min), "₺ arkada"
  //  - total + tek (min===max)           → BUGÜNKÜ "₺5.000" (formatPrice, ₺ önde)
  //  - total + aralık                     → BUGÜNKÜ "5.000 – 15.000 ₺"
  let priceBody: string;
  if (starting || unit !== 'total') {
    priceBody = trailingSingle(min);
  } else if (min === max) {
    priceBody = formatPrice(min);
  } else {
    const minFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(min);
    const maxFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(max);
    priceBody = `${minFmt} – ${maxFmt} ₺`;
  }

  const prefix = PRICE_UNIT_PREFIX[unit];
  const prefixPart = prefix ? `${prefix} ` : '';
  const suffix = starting ? "'den başlar" : '';

  return `${prefixPart}${priceBody}${suffix}`;
}

/**
 * Süre formatlama: 4 → "4 saat", 2.5 → "2,5 saat"
 */
export function formatDuration(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '';
  const formatted = new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 1,
  }).format(hours);
  return `${formatted} saat`;
}

/**
 * Son aktiflik için kullanıcı dostu metin döner.
 * - null/undefined → null (göstermeme sinyali)
 * - < 2 dakika → "Az önce aktifti" (online'a yakın anlamda)
 * - < 60 dakika → "X dakika önce aktifti"
 * - < 24 saat → "X saat önce aktifti"
 * - < 7 gün → "X gün önce aktifti"
 * - < 30 gün → "1 haftadan uzun süre önce aktifti"
 * - > 30 gün → null (uzun süredir inaktif, gösterme; mesaj atan kullanıcıyı caydırır)
 */
export function formatLastSeen(
  lastSeenAt: string | null | undefined
): string | null {
  if (!lastSeenAt) return null;

  const date = new Date(lastSeenAt);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  // Negatif olursa (clock skew, future tarih) az önce gibi davran
  if (diffMin < 0 || diffMin < 2) return 'Az önce aktifti';
  if (diffMin < 60) return `${diffMin} dakika önce aktifti`;
  if (diffHour < 24) return `${diffHour} saat önce aktifti`;
  if (diffDay < 7) return `${diffDay} gün önce aktifti`;
  if (diffDay < 30) return '1 haftadan uzun süre önce aktifti';

  return null;
}

/**
 * Son aktiflik rozetinin görsel tonu.
 * - 'active' → çok yakın zamanda (5 dk içinde) — brand-ink vurgu
 * - 'recent' → 1 saat içinde — orta ton
 * - 'idle' → 1 saatten uzun — sade
 */
export function getLastSeenTone(
  lastSeenAt: string | null | undefined
): 'active' | 'recent' | 'idle' | null {
  if (!lastSeenAt) return null;

  const date = new Date(lastSeenAt);
  if (isNaN(date.getTime())) return null;

  const diffMin = (Date.now() - date.getTime()) / 60000;
  if (diffMin < 5) return 'active';
  if (diffMin < 60) return 'recent';
  return 'idle';
}