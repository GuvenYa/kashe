'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export type AvailabilityActionResult = {
  success: boolean;
  error?: string;
};

// YYYY-MM-DD formatı doğrulama (güvenlik + bozuk veri önleme)
function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00');
  return !isNaN(d.getTime());
}

/**
 * Bir günü "dolu" olarak işaretle (manuel blok ekle).
 */
export async function blockDate(
  dateStr: string,
  note?: string | null
): Promise<AvailabilityActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  if (!isValidDateStr(dateStr)) {
    return { success: false, error: 'Geçersiz tarih.' };
  }

  const { error } = await supabase.from('availability_blocks').insert({
    profile_id: user.id,
    blocked_date: dateStr,
    note: note?.trim() || null,
  });

  if (error) {
    // unique violation = zaten bloklu, sorun değil
    if (error.code === '23505') {
      return { success: true };
    }
    return { success: false, error: 'İşaretlenemedi: ' + error.message };
  }

  revalidatePath('/takvimim');
  return { success: true };
}

/**
 * Bir günün "dolu" işaretini kaldır (blok sil).
 */
export async function unblockDate(
  dateStr: string
): Promise<AvailabilityActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  if (!isValidDateStr(dateStr)) {
    return { success: false, error: 'Geçersiz tarih.' };
  }

  const { error } = await supabase
    .from('availability_blocks')
    .delete()
    .eq('profile_id', user.id)
    .eq('blocked_date', dateStr);

  if (error) {
    return { success: false, error: 'Kaldırılamadı: ' + error.message };
  }

  revalidatePath('/takvimim');
  return { success: true };
}
