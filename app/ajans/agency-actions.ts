'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import {
  validateInvitationInput,
  canAcceptInvitation,
  canDeclineInvitation,
  canCancelInvitation,
  type AgencyMemberRole,
  type AgencyInvitationStatus,
} from './agency-data';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// =============================================================================
// Davet oluşturma
// =============================================================================

type InviteProfessionalInput = {
  email: string;
  member_role: AgencyMemberRole;
  message: string | null;
};

/**
 * Ajans bir profesyoneli email ile davet eder.
 */
export async function inviteProfessional(
  input: InviteProfessionalInput
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

  // Davet eden ajans mı?
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single();

  if (!profile) return { success: false, error: 'Profil bulunamadı' };
  if (profile.role !== 'agency') {
    return {
      success: false,
      error: 'Sadece ajanslar profesyonel davet edebilir',
    };
  }

  // Kendi email'ine davet engeli
  if (input.email.trim().toLowerCase() === profile.email.toLowerCase()) {
    return { success: false, error: 'Kendine davet gönderemezsin' };
  }

  // INSERT — EXCLUDE constraint pending duplicate'i yakalayacak
  const { data: newInvitation, error } = await supabase
    .from('agency_invitations')
    .insert({
      agency_id: user.id,
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
// Davet yönetimi (ajans tarafı)
// =============================================================================

/**
 * Ajans bekleyen daveti iptal eder.
 */
export async function cancelInvitation(
  invitationId: string
): Promise<ActionResult> {
  return updateInvitationStatus(
    invitationId,
    'cancelled',
    canCancelInvitation,
    'agency'
  );
}

// =============================================================================
// Davet yönetimi (profesyonel tarafı)
// =============================================================================

/**
 * Profesyonel daveti kabul eder — trigger otomatik agency_members'a ekler.
 */
export async function acceptInvitation(
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
 * Profesyonel daveti reddeder.
 */
export async function declineInvitation(
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
  newStatus: AgencyInvitationStatus,
  validator: (current: AgencyInvitationStatus) => boolean,
  actor: 'agency' | 'invitee'
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  // Daveti çek
  const { data: invitation } = await supabase
    .from('agency_invitations')
    .select('id, agency_id, invited_user_id, invited_email, status')
    .eq('id', invitationId)
    .single();

  if (!invitation) return { success: false, error: 'Davet bulunamadı' };

  // Yetki kontrolü
  if (actor === 'agency') {
    if (invitation.agency_id !== user.id) {
      return { success: false, error: 'Bu davet senin değil' };
    }
  } else {
    // invitee — email veya user_id ile eşleşmeli
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('email, role')
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

    // Profesyonel olmayan kabul edemez
    if (newStatus === 'accepted' && myProfile.role !== 'professional') {
      return {
        success: false,
        error: 'Ajansa katılmak için profesyonel hesap gerekir',
      };
    }
  }

  if (!validator(invitation.status as AgencyInvitationStatus)) {
    return { success: false, error: 'Bu işlem mevcut durumda yapılamaz' };
  }

  const { error } = await supabase
    .from('agency_invitations')
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
 * Ajans bir üyeyi takımından çıkarır.
 */
export async function removeMember(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: member } = await supabase
    .from('agency_members')
    .select('id, agency_id, professional_id')
    .eq('id', memberId)
    .single();

  if (!member) return { success: false, error: 'Üye bulunamadı' };
  if (member.agency_id !== user.id) {
    return { success: false, error: 'Bu ajans senin değil' };
  }

  const { error } = await supabase
    .from('agency_members')
    .delete()
    .eq('id', memberId);

  if (error) {
    return { success: false, error: 'Çıkarılamadı: ' + error.message };
  }

  revalidatePath('/profil/ekibim');
  return { success: true };
}

/**
 * Profesyonel kendi üyeliğinden ayrılır.
 */
export async function leaveAgency(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: member } = await supabase
    .from('agency_members')
    .select('id, agency_id, professional_id')
    .eq('id', memberId)
    .single();

  if (!member) return { success: false, error: 'Üyelik bulunamadı' };
  if (member.professional_id !== user.id) {
    return { success: false, error: 'Bu üyelik senin değil' };
  }

  const { error } = await supabase
    .from('agency_members')
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
export async function updateMemberRole(
  memberId: string,
  newRole: AgencyMemberRole
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın' };

  const { data: member } = await supabase
    .from('agency_members')
    .select('id, agency_id')
    .eq('id', memberId)
    .single();

  if (!member) return { success: false, error: 'Üye bulunamadı' };
  if (member.agency_id !== user.id) {
    return { success: false, error: 'Bu ajans senin değil' };
  }

  const { error } = await supabase
    .from('agency_members')
    .update({ member_role: newRole })
    .eq('id', memberId);

  if (error) {
    return { success: false, error: 'Güncellenemedi: ' + error.message };
  }

  revalidatePath('/profil/ekibim');
  return { success: true };
}