'use server';

import { createClient } from '@/app/lib/supabase-server';

type ActionResult = { success: boolean; error?: string };

/**
 * Profil görüntülenme sayacını artır (RPC ile — RLS güvenli bypass).
 * Profil sahibinin kendi profilini ziyareti sayılmaz.
 */
export async function incrementProfileViews(
  profileId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sahibi kendi profilini görüntülüyorsa sayma
  if (user && user.id === profileId) {
    return { success: true };
  }

  const { error } = await supabase.rpc('increment_profile_views', {
    profile_id_param: profileId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
