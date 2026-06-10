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

/**
 * Bir tarih aralığını toplu "dolu" işaretle (başlangıç–bitiş dahil).
 * Geçmiş günler atlanır. Zaten bloklu günler çakışırsa sorun değil (upsert mantığı).
 */
export async function blockDateRange(
  startStr: string,
  endStr: string
): Promise<AvailabilityActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  if (!isValidDateStr(startStr) || !isValidDateStr(endStr)) {
    return { success: false, error: 'Geçersiz tarih.' };
  }

  // Başlangıç > bitiş ise yer değiştir
  let start = startStr;
  let end = endStr;
  if (start > end) {
    [start, end] = [end, start];
  }

  // Bugünden önceki günleri atla
  const todayStr = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();

  // Aralıktaki tüm tarihleri üret (max 366 gün güvenlik sınırı)
  const dates: string[] = [];
  const cursor = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  let guard = 0;
  while (cursor <= endDate && guard < 366) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');
    const ds = `${y}-${m}-${day}`;
    if (ds >= todayStr) dates.push(ds);
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }

  if (dates.length === 0) {
    return { success: false, error: 'İşaretlenecek geçerli gün yok.' };
  }

  // Toplu insert — zaten bloklu olanları çakışmadan geç (upsert, ignore duplicates)
  const rows = dates.map((d) => ({
    profile_id: user.id,
    blocked_date: d,
  }));

  const { error } = await supabase
    .from('availability_blocks')
    .upsert(rows, { onConflict: 'profile_id,blocked_date', ignoreDuplicates: true });

  if (error) {
    return { success: false, error: 'İşaretlenemedi: ' + error.message };
  }

  revalidatePath('/takvimim');
  return { success: true };
}
