'use server';

import { createClient } from '@/app/lib/supabase-server';
import { getAdminUser } from '@/app/lib/admin';
import { revalidatePath } from 'next/cache';

export type AdminActionResult = { success: boolean; error?: string };

// Profili onayla → approved + otomatik yayın (is_published = true)
export async function approveProfile(
  profileId: string
): Promise<AdminActionResult> {
  const { isAdmin } = await getAdminUser();
  if (!isAdmin) return { success: false, error: 'Yetkisiz.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      is_published: true, // Approved = otomatik yayın (karar)
      approval_note: null,
    })
    .eq('id', profileId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/profiller');
  revalidatePath('/admin');
  return { success: true };
}

// Profili reddet → rejected + yayından kaldır
export async function rejectProfile(
  profileId: string,
  note: string
): Promise<AdminActionResult> {
  const { isAdmin } = await getAdminUser();
  if (!isAdmin) return { success: false, error: 'Yetkisiz.' };

  if (!note.trim()) {
    return { success: false, error: 'Red gerekçesi zorunlu.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      approval_status: 'rejected',
      is_published: false,
      approval_note: note.trim(),
    })
    .eq('id', profileId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/profiller');
  revalidatePath('/admin');
  return { success: true };
}

// Revizyon iste → revision + yayından kaldır + not
export async function requestProfileRevision(
  profileId: string,
  note: string
): Promise<AdminActionResult> {
  const { isAdmin } = await getAdminUser();
  if (!isAdmin) return { success: false, error: 'Yetkisiz.' };

  if (!note.trim()) {
    return { success: false, error: 'Revizyon notu zorunlu.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      approval_status: 'revision',
      is_published: false,
      approval_note: note.trim(),
    })
    .eq('id', profileId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/profiller');
  revalidatePath('/admin');
  return { success: true };
}