/**
 * Kurumsal Ekip (business) sistemi için type'lar, sabitler, helper'lar.
 * 'use server' OLMAYAN dosya — async olmayan export'lar burada.
 *
 * app/ajans/agency-data.ts AYNASI. FARK: üye HERHANGİ bir kullanıcı (erişim üyelikten gelir),
 * o yüzden join'de professional-özel alanlar (service_categories vb.) yok — temel profil alanları.
 */

// =============================================================================
// Status enums (business_member_role / business_invitation_status aynası)
// =============================================================================

export type BusinessMemberRole = 'owner' | 'manager' | 'member';

export type BusinessInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'expired';

// =============================================================================
// Row types (DB shape)
// =============================================================================

export type BusinessMember = {
  id: string;
  business_id: string;
  member_user_id: string;
  member_role: BusinessMemberRole;
  joined_at: string;
};

export type BusinessInvitation = {
  id: string;
  business_id: string;
  invited_email: string;
  invited_user_id: string | null;
  invited_by_id: string;
  member_role: BusinessMemberRole;
  status: BusinessInvitationStatus;
  invitation_message: string | null;
  created_at: string;
  responded_at: string | null;
  expires_at: string;
};

// Joined types (UI'da kullanılan)

// Üye herhangi bir kullanıcı → temel profil alanları (professional-özel join yok)
export type BusinessMemberWithProfile = BusinessMember & {
  member: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
  } | null;
};

export type BusinessInvitationWithRelations = BusinessInvitation & {
  business: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    bio: string | null;
  } | null;
};

// Kurumun görünür özet bilgisi (üyenin "şu kurumların ekibindeyim" listesi için)
export type BusinessBrief = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
  member_role: BusinessMemberRole;
};

// =============================================================================
// Constants
// =============================================================================

export const MEMBER_ROLE_OPTIONS: {
  key: BusinessMemberRole;
  label: string;
}[] = [
  { key: 'owner', label: 'Sahibi' },
  { key: 'manager', label: 'Yönetici' },
  { key: 'member', label: 'Üye' },
];

export const INVITATION_STATUS_OPTIONS: {
  key: BusinessInvitationStatus;
  label: string;
}[] = [
  { key: 'pending', label: 'Bekliyor' },
  { key: 'accepted', label: 'Kabul edildi' },
  { key: 'declined', label: 'Reddedildi' },
  { key: 'cancelled', label: 'İptal edildi' },
  { key: 'expired', label: 'Süresi doldu' },
];

// =============================================================================
// Helpers
// =============================================================================

export function getMemberRoleLabel(role: BusinessMemberRole): string {
  return MEMBER_ROLE_OPTIONS.find((r) => r.key === role)?.label ?? role;
}

export function getInvitationStatusLabel(
  status: BusinessInvitationStatus
): string {
  return (
    INVITATION_STATUS_OPTIONS.find((s) => s.key === status)?.label ?? status
  );
}

export function getInvitationStatusTone(
  status: BusinessInvitationStatus
): 'pending' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'accepted':
      return 'success';
    case 'declined':
    case 'cancelled':
      return 'danger';
    case 'expired':
      return 'neutral';
  }
}

/**
 * Davet status transition izinleri.
 */
export function canAcceptInvitation(status: BusinessInvitationStatus): boolean {
  return status === 'pending';
}

export function canDeclineInvitation(status: BusinessInvitationStatus): boolean {
  return status === 'pending';
}

export function canCancelInvitation(status: BusinessInvitationStatus): boolean {
  return status === 'pending';
}

/**
 * "X gün önce davet edildi" / "Bugün davet edildi"
 */
export function formatInvitationAge(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 60) return `${diffMin} dakika önce`;
  if (diffHour < 24) return `${diffHour} saat önce`;
  if (diffDay < 30) return `${diffDay} gün önce`;
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * "Süresi 3 gün sonra dolacak" / "Süresi doldu"
 */
export function formatInvitationExpiry(expiresAt: string): string {
  const date = new Date(expiresAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs < 0) return 'Süresi doldu';

  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffHour / 24);

  if (diffHour < 24) return `${diffHour} saat içinde dolacak`;
  return `${diffDay} gün içinde dolacak`;
}

/**
 * Validation: davet input'u
 */
export function validateInvitationInput(input: {
  email: string;
  message: string | null;
}): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.email || !emailRegex.test(input.email.trim())) {
    return 'Geçerli bir email girmelisin';
  }
  if (input.message && input.message.length > 1000) {
    return 'Davet mesajı en fazla 1000 karakter olabilir';
  }
  return null;
}
