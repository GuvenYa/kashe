'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { ORG_ROLES, type OrgRole } from '@/app/lib/org-roles';
import { uyelikHataMesaji } from '@/app/lib/uyelik';

/**
 * FAZ 8-U — kurulus uyelik rolu.
 *
 * Yazma TEK YOL: `org_member_set_role` RPC. `organization_memberships` uzerinde
 * uygulamanin UPDATE yetkisi YOK (yalniz SELECT); kurallar (kendi rolu, owner/admin,
 * son sahip, owner_seed) DB'de. Buradaki kontroller yalniz anlasilir mesaj icin.
 *
 * FAZ 10a: RPC artik yalniz `organization_memberships` yazar — eski uyelik
 * tablolarina yazim kalkti (aynalama kapandi, o tablolar salt okunur).
 * Hata metinleri ortak sozlukte (`uyelik.ts` `uyelikHataMesaji`).
 */

type ActionResult = { success: true } | { success: false; error: string };

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setOrgMemberRole(
  membershipId: string,
  role: string
): Promise<ActionResult> {
  if (!UUID_KALIBI.test(membershipId)) {
    return { success: false, error: 'Üyelik geçersiz.' };
  }
  if (!ORG_ROLES.includes(role as OrgRole)) {
    return { success: false, error: 'Rol geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase.rpc('org_member_set_role', {
    p_membership_id: membershipId,
    p_role: role,
  });
  if (error) {
    console.error('[uyelik] rol degistirme', error.code, error.message);
    return { success: false, error: uyelikHataMesaji(error) };
  }

  revalidatePath('/profil/ekibim');
  revalidatePath('/profil/kurumsal-ekip');
  return { success: true };
}
