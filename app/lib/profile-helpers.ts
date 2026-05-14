import type { Profile, Service } from './types';

export function isProfessional(profile: Profile | null | undefined): boolean {
  return profile?.role === 'professional';
}

export function isClient(profile: Profile | null | undefined): boolean {
  return profile?.role === 'client';
}

export function isBusiness(profile: Profile | null | undefined): boolean {
  return profile?.role === 'business';
}

export function getRoleLabel(role: string | null | undefined): string {
  const labels: Record<string, string> = {
    professional: 'Profesyonel',
    client: 'Müşteri',
    business: 'Kurumsal',
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
 * Fiyat aralığı: 5000, 15000 → "5.000 – 15.000 ₺"
 * Talep üzerine ise farklı string.
 */
export function formatPriceRange(
  min: number | null | undefined,
  max: number | null | undefined,
  onRequest: boolean
): string {
  if (onRequest) return 'Talep üzerine';
  if (min === null || min === undefined || max === null || max === undefined) {
    return '';
  }
  if (min === max) return formatPrice(min);
  const minFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(min);
  const maxFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(max);
  return `${minFmt} – ${maxFmt} ₺`;
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