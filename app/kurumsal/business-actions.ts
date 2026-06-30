'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import {
  validateInvitationInput,
  canAcceptInvitation,
  canDeclineInvitation,
  canCancelInvitation,
  type BusinessMemberRole,
  type BusinessInvitationStatus,
} from './business-data';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// =============================================================================
// Davet oluşturma
// =============================================================================

type InviteUserToTeamInput = {
  email: string;
  member_role: BusinessMemberRole;
  message: string | null;
};

/**
 * Kurum (business) bir kullanıcıyı email ile ekibe davet eder.
 */
export async function inviteUserToTeam(
  input: InviteUserToTeamInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Validation
  const validationError = validateInvitationInput({
    email: input.email,
    message: input.message,
  });
  if (validationError) return { success: false, error: validationError };

  // Davet eden kurum mu?
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single();

  if (!profile) return { success: false, error: 'Profil bulunamadı' };
  if (profile.role !== 'business') {
    return {
      success: false,
      error: 'Sadece kurumsal hesaplar ekip üyesi davet edebilir',
    };
  }

  // Kendi email'ine davet engeli
  if (input.email.trim().toLowerCase() === profile.email.toLowerCase()) {
    return { success: false, error: 'Kendine davet gönderemezsin' };
  }

  // INSERT — EXCLUDE constraint pending duplicate'i yakalayacak
  const { data: newInvitation, error } = await supabase
    .from('business_invitations')
    .insert({
      business_id: user.id,
      invited_email: input.email.trim().toLowerCase(),
      invited_by_id: user.id,
      member_role: input.member_role,
      invitation_message: input.message?.trim() || null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !newInvitation) {
    // EXCLUDE constraint error
    if (error?.code === '23P01') {
      return {
        success: false,
        error: 'Bu emaile zaten bekleyen bir davet var',
      };
    }
    return {
      success: false,
      error: 'Davet gönderilemedi: ' + (error?.message ?? 'bilinmeyen'),
    };
  }

  revalidatePath('/profil/ekibim');
  return { success: true, data: { id: newInvitation.id } };
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
  return updateInvitationStatus(
    invitationId,
    'cancelled',
    canCancelInvitation,
    'business'
  );
}

// =============================================================================
// Davet yönetimi (davetli tarafı)
// =============================================================================

/**
 * Davetli daveti kabul eder — trigger otomatik business_members'a ekler.
 */
export async function acceptTeamInvitation(
  invitationId: string
): Promise<ActionResult> {
  return updateInvitationStatus(
    invitationId,
    'accepted',
    canAcceptInvitation,
    'invitee'
  );
}

/**
 * Davetli daveti reddeder.
 */
export async function declineTeamInvitation(
  invitationId: string
): Promise<ActionResult> {
  return updateInvitationStatus(
    invitationId,
    'declined',
    canDeclineInvitation,
    'invitee'
  );
}

/**
 * Davet status değişimi için iç yardımcı.
 */
async function updateInvitationStatus(
  invitationId: string,
  newStatus: BusinessInvitationStatus,
  validator: (current: BusinessInvitationStatus) => boolean,
  actor: 'business' | 'invitee'
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Daveti çek
  const { data: invitation } = await supabase
    .from('business_invitations')
    .select('id, business_id, invited_user_id, invited_email, status')
    .eq('id', invitationId)
    .single();

  if (!invitation) return { success: false, error: 'Davet bulunamadı' };

  // Yetki kontrolü
  if (actor === 'business') {
    if (invitation.business_id !== user.id) {
      return { success: false, error: 'Bu davet senin değil' };
    }
  } else {
    // invitee — email veya user_id ile eşleşmeli
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    if (!myProfile) return { success: false, error: 'Profil bulunamadı' };

    const emailMatch =
      invitation.invited_email.toLowerCase() ===
      myProfile.email.toLowerCase();
    const userMatch = invitation.invited_user_id === user.id;

    if (!emailMatch && !userMatch) {
      return { success: false, error: 'Bu davet sana ait değil' };
    }

    // NOT: agency'deki "role==='professional'" gate'i YOK — kurum ekip üyesi
    // herhangi bir kullanıcı olabilir (erişim üyelikten gelir).
  }

  if (!validator(invitation.status as BusinessInvitationStatus)) {
    return { success: false, error: 'Bu işlem mevcut durumda yapılamaz' };
  }

  const { error } = await supabase
    .from('business_invitations')
    .update({ status: newStatus })
    .eq('id', invitationId);

  if (error) {
    return { success: false, error: 'Güncellenemedi: ' + error.message };
  }

  revalidatePath('/profil/ekibim');
  revalidatePath('/davetlerim');
  return { success: true };
}

// =============================================================================
// Üye yönetimi
// =============================================================================

/**
 * Kurum bir üyeyi ekibinden çıkarır.
 */
export async function removeTeamMember(
  memberId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: member } = await supabase
    .from('business_members')
    .select('id, business_id, member_user_id')
    .eq('id', memberId)
    .single();

  if (!member) return { success: false, error: 'Üye bulunamadı' };
  if (member.business_id !== user.id) {
    return { success: false, error: 'Bu kurum senin değil' };
  }

  const { error } = await supabase
    .from('business_members')
    .delete()
    .eq('id', memberId);

  if (error) {
    return { success: false, error: 'Çıkarılamadı: ' + error.message };
  }

  revalidatePath('/profil/ekibim');
  return { success: true };
}

/**
 * Üye kendi üyeliğinden ayrılır.
 */
export async function leaveTeam(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: member } = await supabase
    .from('business_members')
    .select('id, business_id, member_user_id')
    .eq('id', memberId)
    .single();

  if (!member) return { success: false, error: 'Üyelik bulunamadı' };
  if (member.member_user_id !== user.id) {
    return { success: false, error: 'Bu üyelik senin değil' };
  }

  const { error } = await supabase
    .from('business_members')
    .delete()
    .eq('id', memberId);

  if (error) {
    return { success: false, error: 'Ayrılamadın: ' + error.message };
  }

  revalidatePath('/profil');
  return { success: true };
}

/**
 * Üye rolünü değiştir (örn. member → manager).
 */
export async function updateTeamMemberRole(
  memberId: string,
  newRole: BusinessMemberRole
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: member } = await supabase
    .from('business_members')
    .select('id, business_id')
    .eq('id', memberId)
    .single();

  if (!member) return { success: false, error: 'Üye bulunamadı' };
  if (member.business_id !== user.id) {
    return { success: false, error: 'Bu kurum senin değil' };
  }

  const { error } = await supabase
    .from('business_members')
    .update({ member_role: newRole })
    .eq('id', memberId);

  if (error) {
    return { success: false, error: 'Güncellenemedi: ' + error.message };
  }

  revalidatePath('/profil/ekibim');
  return { success: true };
}
