'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { ORG_ROLES, type OrgRole } from '@/app/lib/org-roles';
import { kurulusumunId, uyelikHataMesaji } from '@/app/lib/uyelik';
import { validateInvitationInput } from './business-data';

/**
 * KURUMSAL EKIP YAZMA YOLU — FAZ 10a.
 *
 * `app/ajans/agency-actions.ts` AYNASI: davet ve uyelik yazimi TEK YOL RPC
 * (`org_invitation_create/_cancel/_respond`, `org_member_remove/_leave`).
 * Uygulamanin `organization_invitations` / `organization_memberships` uzerinde
 * INSERT/UPDATE/DELETE yetkisi YOK; kurallar RPC govdesinde.
 *
 * AJANSTAN FARK: kurumsal ekip uyesi herhangi bir hesap olabilir (erisim
 * uyelikten gelir) — "profesyonel hesap gerekir" sarti yalniz ajans
 * kurulusunda isler ve o sarti da RPC uygular.
 */

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Davetle verilebilen roller: sahip HARIC (RPC de reddeder). */
const DAVET_ROLLERI: readonly OrgRole[] = ORG_ROLES.filter(
  (r) => r !== 'owner'
);

// =============================================================================
// Davet oluşturma
// =============================================================================

type InviteUserToTeamInput = {
  email: string;
  role: OrgRole;
  message: string | null;
};

/**
 * Kurum (business) bir kullaniciyi e-posta ile ekibe davet eder.
 */
export async function inviteUserToTeam(
  input: InviteUserToTeamInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const validationError = validateInvitationInput({
    email: input.email,
    message: input.message,
  });
  if (validationError) return { success: false, error: validationError };

  if (!DAVET_ROLLERI.includes(input.role)) {
    return { success: false, error: 'Rol geçersiz.' };
  }

  // Kendi adresine davet — oturumdan okunur (profiles.email authenticated'a
  // kapali, PII adim 2b). RPC de reddeder.
  if (input.email.trim().toLowerCase() === (user.email ?? '').toLowerCase()) {
    return { success: false, error: 'Kendine davet gönderemezsin' };
  }

  const orgId = await kurulusumunId(supabase, user.id);
  if (!orgId) {
    return { success: false, error: 'Kuruluş kaydın bulunamadı.' };
  }

  const { data, error } = await supabase.rpc('org_invitation_create', {
    p_org: orgId,
    p_email: input.email.trim().toLowerCase(),
    p_role: input.role,
    p_message: input.message?.trim() || null,
  });

  if (error) {
    console.error('[kurumsal ekip] davet olusturma', error.code, error.message);
    return { success: false, error: uyelikHataMesaji(error) };
  }

  revalidatePath('/profil/kurumsal-ekip');
  revalidatePath('/davetlerim');
  return { success: true, data: { id: data as unknown as string } };
}

// =============================================================================
// Davet yönetimi (kurum tarafı)
// =============================================================================

/**
 * Kurum bekleyen daveti iptal eder.
 */
export async function cancelTeamInvitation(
  invitationId: string
): Promise<ActionResult> {
  if (!UUID_KALIBI.test(invitationId)) {
    return { success: false, error: 'Davet geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { error } = await supabase.rpc('org_invitation_cancel', {
    p_id: invitationId,
  });
  if (error) {
    console.error('[kurumsal ekip] davet iptali', error.code, error.message);
    return { success: false, error: uyelikHataMesaji(error) };
  }

  revalidatePath('/profil/kurumsal-ekip');
  revalidatePath('/davetlerim');
  return { success: true };
}

// =============================================================================
// Davet yönetimi (davetli tarafı)
// =============================================================================

/**
 * Davetli daveti kabul eder — uyeligi RPC acar.
 */
export async function acceptTeamInvitation(
  invitationId: string
): Promise<ActionResult> {
  return respondToTeamInvitation(invitationId, true);
}

/**
 * Davetli daveti reddeder.
 */
export async function declineTeamInvitation(
  invitationId: string
): Promise<ActionResult> {
  return respondToTeamInvitation(invitationId, false);
}

async function respondToTeamInvitation(
  invitationId: string,
  accept: boolean
): Promise<ActionResult> {
  if (!UUID_KALIBI.test(invitationId)) {
    return { success: false, error: 'Davet geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { error } = await supabase.rpc('org_invitation_respond', {
    p_id: invitationId,
    p_accept: accept,
  });
  if (error) {
    console.error('[kurumsal ekip] davet yaniti', error.code, error.message);
    return { success: false, error: uyelikHataMesaji(error) };
  }

  revalidatePath('/profil/kurumsal-ekip');
  revalidatePath('/davetlerim');
  revalidatePath('/profil');
  return { success: true };
}

// =============================================================================
// Üye yönetimi
// =============================================================================

/**
 * Kurum bir uyeyi ekibinden cikarir. `membershipId` = `organization_memberships.id`.
 */
export async function removeTeamMember(
  membershipId: string
): Promise<ActionResult> {
  if (!UUID_KALIBI.test(membershipId)) {
    return { success: false, error: 'Üyelik geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: uyelik } = await supabase
    .from('organization_memberships')
    .select('organization_id, user_id')
    .eq('id', membershipId)
    .maybeSingle();

  const satir = uyelik as {
    organization_id: string;
    user_id: string;
  } | null;
  if (!satir) return { success: false, error: 'Üye bulunamadı' };

  const { error } = await supabase.rpc('org_member_remove', {
    p_org: satir.organization_id,
    p_user: satir.user_id,
  });
  if (error) {
    console.error('[kurumsal ekip] uye cikarma', error.code, error.message);
    return { success: false, error: uyelikHataMesaji(error) };
  }

  revalidatePath('/profil/kurumsal-ekip');
  return { success: true };
}

/**
 * Uye kendi uyeliginden ayrilir. `membershipId` = `organization_memberships.id`.
 */
export async function leaveTeam(membershipId: string): Promise<ActionResult> {
  if (!UUID_KALIBI.test(membershipId)) {
    return { success: false, error: 'Üyelik geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: uyelik } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('id', membershipId)
    .eq('user_id', user.id)
    .maybeSingle();

  const satir = uyelik as { organization_id: string } | null;
  if (!satir) return { success: false, error: 'Üyelik bulunamadı' };

  const { error } = await supabase.rpc('org_member_leave', {
    p_org: satir.organization_id,
  });
  if (error) {
    console.error('[kurumsal ekip] ayrilma', error.code, error.message);
    return { success: false, error: uyelikHataMesaji(error) };
  }

  revalidatePath('/profil');
  revalidatePath('/profil/kurumsal-ekip');
  return { success: true };
}
