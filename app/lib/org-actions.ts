'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { ORG_ROLES, type OrgRole } from '@/app/lib/org-roles';

/**
 * FAZ 8-U — kurulus uyelik rolu.
 *
 * Yazma TEK YOL: `org_member_set_role` RPC. `organization_memberships` uzerinde
 * uygulamanin UPDATE yetkisi YOK (yalniz SELECT); kurallar (kendi rolu, owner/admin,
 * son sahip, owner_seed) DB'de. Buradaki kontroller yalniz anlasilir mesaj icin.
 *
 * RPC eski tabloyu (agency_members / business_members) ve kurulus uyeligini
 * birlikte yazar — uygulama eski tabloya DOKUNMAZ.
 */

type ActionResult = { success: true } | { success: false; error: string };

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DB metinleri ASCII; eslesme ona gore. */
function rolHataMesaji(error: {
  code?: string | null;
  message?: string | null;
}): string {
  const mesaj = error.message ?? '';

  if (mesaj.includes('kendi rolunu degistiremezsin')) {
    return 'Kendi rolünü değiştiremezsin.';
  }
  if (mesaj.includes('owner/admin rolunu yalniz kurulus sahibi degistirir')) {
    return 'Sahip/Yönetici rolünü yalnız kuruluş sahibi değiştirebilir.';
  }
  if (mesaj.includes('son sahip dusurulemez')) {
    return 'Son sahip düşürülemez.';
  }
  if (mesaj.includes('kurulus sahibinin rolu degistirilemez')) {
    return 'Kuruluş sahibinin rolü değiştirilemez.';
  }
  if (mesaj.includes('uyelik aktif degil')) {
    return 'Bu üyelik aktif değil.';
  }
  if (error.code === 'P0002' || mesaj.includes('uyelik yok')) {
    return 'Üyelik bulunamadı.';
  }
  if (error.code === '42501' || mesaj.includes('oturum gerekir')) {
    return 'Bu işlem için yetkin yok.';
  }
  return 'Rol değiştirilemedi, tekrar dene.';
}

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
    return { success: false, error: rolHataMesaji(error) };
  }

  revalidatePath('/profil/ekibim');
  revalidatePath('/profil/kurumsal-ekip');
  return { success: true };
}
