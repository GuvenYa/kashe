import type { Profile } from './types';

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
 */
export function getMissingPublishFields(profile: Profile): string[] {
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
  }

  // Kurumsal için ekstra
  if (profile.role === 'business') {
    if (!profile.company_name || profile.company_name.trim().length === 0) {
      missing.push('Şirket adı');
    }
  }

  return missing;
}

export function canPublish(profile: Profile): boolean {
  return getMissingPublishFields(profile).length === 0;
}

/**
 * 0-100 arası tamlık yüzdesi (UI'da progress bar için)
 */
export function getCompletenessPercent(profile: Profile): number {
  const checks: boolean[] = [
    !!profile.full_name,
    !!profile.avatar_url,
    !!profile.bio && profile.bio.length >= 20,
    !!profile.city_id,
    !!profile.phone,
  ];

  if (profile.role === 'professional') {
    checks.push(!!profile.primary_category_id);
  }
  if (profile.role === 'business') {
    checks.push(!!profile.company_name);
  }

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}