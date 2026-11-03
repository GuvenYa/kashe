'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { ORG_ROLES, type OrgRole } from '@/app/lib/org-roles';
import { kurulusumunId, uyelikHataMesaji } from '@/app/lib/uyelik';
import { validateInvitationInput } from './agency-data';

/**
 * EKIBIM (ajans) YAZMA YOLU — FAZ 10a.
 *
 * Davet ve uyelik yazimi TEK YOL RPC: `org_invitation_create` / `_cancel` /
 * `_respond`, `org_member_remove` / `_leave`. Uygulamanin
 * `organization_invitations` ve `organization_memberships` uzerinde
 * INSERT/UPDATE/DELETE yetkisi YOK.
 *
 * KURAL TEKRARI YOK: e-posta normalize, owner rolu yasagi, zaten-uye,
 * cift bekleyen davet, suresi dolmus davet, profesyonel hesap sarti, son
 * sahip korumasi — hepsi RPC govdesinde. Buradaki on kontroller yalniz bos
 * form ve kendi e-postasi gibi hatalari sunucu turu olmadan yakalar; DB'nin
 * reddettigi hic bir kural burada "bir daha" dogrulanmaz.
 *
 * Kabulde FAZ 5 havuz kaydini da RPC acar — uygulamanin eski havuz kaydi
 * tamamlama cagrisi KALKTI.
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

type InviteProfessionalInput = {
  email: string;
  role: OrgRole;
  message: string | null;
};

/**
 * Ajans bir profesyoneli e-posta ile davet eder.
 */
export async function inviteProfessional(
  input: InviteProfessionalInput
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
  // kapali, PII adim 2b). RPC de reddeder; buradaki kontrol tur kazandirir.
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
    console.error('[ekibim] davet olusturma', error.code, error.message);
    return { success: false, error: uyelikHataMesaji(error) };
  }

  revalidatePath('/profil/ekibim');
  revalidatePath('/davetlerim');
  return { success: true, data: { id: data as unknown as string } };
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
    console.error('[ekibim] davet iptali', error.code, error.message);
    return { success: false, error: uyelikHataMesaji(error) };
  }

  revalidatePath('/profil/ekibim');
  revalidatePath('/davetlerim');
  return { success: true };
}

// =============================================================================
// Davet yönetimi (davetli tarafı)
// =============================================================================

/**
 * Profesyonel daveti kabul eder — uyelik ve havuz kaydini RPC acar.
 */
export async function acceptInvitation(
  invitationId: string
): Promise<ActionResult> {
  return respondToInvitation(invitationId, true);
}

/**
 * Profesyonel daveti reddeder.
 */
export async function declineInvitation(
  invitationId: string
): Promise<ActionResult> {
  return respondToInvitation(invitationId, false);
}

async function respondToInvitation(
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
    console.error('[ekibim] davet yaniti', error.code, error.message);
    return { success: false, error: uyelikHataMesaji(error) };
  }

  revalidatePath('/profil/ekibim');
  revalidatePath('/davetlerim');
  revalidatePath('/profil');
  // Kabulde havuz kaydi DB'de dogar; liste tazelenmezse kayit gorunmezdi.
  revalidatePath('/ajans/havuz');
  return { success: true };
}

// =============================================================================
// Üye yönetimi
// =============================================================================

/**
 * Ajans bir uyeyi ekibinden cikarir. `membershipId` = `organization_memberships.id`.
 */
export async function removeMember(
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

  // RPC kurulus + kullanici ikilisiyle calisir; satirdan ikisini okuyoruz
  // (uyelik id'si RLS ile gorulemezse zaten cikarma yetkisi de yok).
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
    console.error('[ekibim] uye cikarma', error.code, error.message);
    return { success: false, error: uyelikHataMesaji(error) };
  }

  revalidatePath('/profil/ekibim');
  revalidatePath('/ajans/havuz');
  return { success: true };
}

/**
 * Profesyonel kendi uyeliginden ayrilir. `membershipId` = `organization_memberships.id`.
 */
export async function leaveAgency(membershipId: string): Promise<ActionResult> {
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
    console.error('[ekibim] ayrilma', error.code, error.message);
    return { success: false, error: uyelikHataMesaji(error) };
  }

  revalidatePath('/profil');
  revalidatePath('/profil/ekibim');
  return { success: true };
}
