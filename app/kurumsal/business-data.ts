import { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
import { ORG_ROLE_LABELS, type OrgRole } from '@/app/lib/org-roles';
import type { DavetDurumu, UyelikDurumu } from '@/app/lib/uyelik';

/**
 * Kurumsal Ekip (business) sistemi için type'lar, sabitler, helper'lar.
 * 'use server' OLMAYAN dosya — async olmayan export'lar burada.
 *
 * app/ajans/agency-data.ts AYNASI. FARK: üye HERHANGİ bir kullanıcı (erişim
 * üyelikten gelir), o yüzden join'de professional-özel alanlar
 * (service_categories vb.) yok — temel profil alanları.
 *
 * FAZ 10a: satirlar `organization_memberships` / `organization_invitations`
 * tablolarindan gelir; rol TEK GERCEK `OrgRole` (eski uc kademeli
 * `member_role` kalkti). Eski kurum rolu semantigine ihtiyac duyan yazma
 * yetkisi kontrolleri `uyelik.ts` `eskiKurumRolu` ile turetilir.
 */

// =============================================================================
// Status enums
// =============================================================================

export type BusinessInvitationStatus = DavetDurumu;

// =============================================================================
// Row types (DB shape)
// =============================================================================

export type BusinessMember = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  status: UyelikDurumu;
  joined_at: string | null;
  legacy_source: string | null;
};

export type BusinessInvitation = {
  id: string;
  organization_id: string;
  invited_email: string;
  invited_user_id: string | null;
  invited_by_id: string | null;
  role: OrgRole;
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

/**
 * Davet + davet eden kurulusun kimligi.
 *
 * `business.id` kurulusun PAZARYERI profil kimligi (`legacy_profile_id`):
 * `/p/[id]` baglantisi onu bekliyor.
 */
export type BusinessInvitationWithRelations = BusinessInvitation & {
  business: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

// =============================================================================
// Constants
// =============================================================================

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

/** FAZ 10a: etiket tek kaynak `org-roles.ts`. */
export function getMemberRoleLabel(role: OrgRole | string): string {
  return ORG_ROLE_LABELS[role as OrgRole] ?? role;
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
 * Suresi dolmus bekleyen davet.
 *
 * DB durumu `pending` BIRAKIR (RPC suresi dolmus davette 22023 verir ve
 * yazimi geri alir); "Suresi doldu" kararini arayuz `expires_at` ile verir.
 */
export function isInvitationExpired(invitation: {
  status: BusinessInvitationStatus;
  expires_at: string | null;
}): boolean {
  if (invitation.status !== 'pending' || !invitation.expires_at) return false;
  const t = new Date(invitation.expires_at).getTime();
  return Number.isFinite(t) && t < Date.now();
}

/**
 * Davet status transition izinleri — yalniz DUGME GORUNURLUGU icin.
 * Gercek kural DB'de (`org_invitation_respond` / `_cancel`).
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
    timeZone: KASHE_SAAT_DILIMI,
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
 * Validation: davet input'u — yalniz bos/kalip kontrolu.
 * Normalize ve asil dogrulama DB'de (`org_invitation_create`).
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
