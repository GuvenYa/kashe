import { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
import { ORG_ROLE_LABELS, type OrgRole } from '@/app/lib/org-roles';
import type { DavetDurumu, UyelikDurumu } from '@/app/lib/uyelik';

/**
 * Ekibim (ajans) sistemi icin type'lar, sabitler, helper'lar.
 * 'use server' OLMAYAN dosya — async olmayan export'lar burada.
 *
 * FAZ 10a: satirlar `organization_memberships` / `organization_invitations`
 * tablolarindan gelir. Uyelik rolu TEK GERCEK `OrgRole` (yedi ince rol); eski
 * uc kademeli `member_role` ('owner'|'manager'|'member') ve onun secenek
 * listesi KALKTI — etiketler `ORG_ROLE_LABELS`'tan okunur.
 */

// =============================================================================
// Status enums
// =============================================================================

export type AgencyInvitationStatus = DavetDurumu;

// =============================================================================
// Row types (DB shape)
// =============================================================================

export type AgencyMember = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  status: UyelikDurumu;
  joined_at: string | null;
  legacy_source: string | null;
};

export type AgencyInvitation = {
  id: string;
  organization_id: string;
  invited_email: string;
  invited_user_id: string | null;
  invited_by_id: string | null;
  role: OrgRole;
  status: AgencyInvitationStatus;
  invitation_message: string | null;
  created_at: string;
  responded_at: string | null;
  expires_at: string;
};

// Joined types (UI'da kullanılan)

export type AgencyMemberWithProfile = AgencyMember & {
  professional: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: string;
    bio: string | null;
    primary_category_id: number | null;
    service_categories: { name_tr: string; emoji: string | null } | null;
  } | null;
};

/**
 * Davet + davet eden kurulusun kimligi.
 *
 * `agency.id` kurulusun PAZARYERI profil kimligi (`legacy_profile_id`):
 * `/p/[id]` baglantisi onu bekliyor. Ad kurulus satirindan
 * (`organizations_public.display_name`), avatar profilden.
 */
export type AgencyInvitationWithRelations = AgencyInvitation & {
  agency: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

// =============================================================================
// Constants
// =============================================================================

export const INVITATION_STATUS_OPTIONS: {
  key: AgencyInvitationStatus;
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
  status: AgencyInvitationStatus
): string {
  return (
    INVITATION_STATUS_OPTIONS.find((s) => s.key === status)?.label ?? status
  );
}

export function getInvitationStatusTone(
  status: AgencyInvitationStatus
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
  status: AgencyInvitationStatus;
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
export function canAcceptInvitation(status: AgencyInvitationStatus): boolean {
  return status === 'pending';
}

export function canDeclineInvitation(status: AgencyInvitationStatus): boolean {
  return status === 'pending';
}

export function canCancelInvitation(status: AgencyInvitationStatus): boolean {
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
