'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export type Notification = {
  id: string;
  user_id: string;
  type: 'message' | 'review' | 'review_reply';
  link: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type NotificationActionResult = {
  success: boolean;
  error?: string;
};

/**
 * Kullanıcının bildirimlerini döner.
 * Varsayılan: en yeni 50 bildirim. Pagination'a geçtiğimizde limit/offset eklenebilir.
 */
export async function getNotifications(): Promise<{
  notifications: Notification[];
  error: string | null;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { notifications: [], error: 'Oturum bulunamadı.' };
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return { notifications: [], error: error.message };
  }

  return {
    notifications: (data ?? []) as Notification[],
    error: null,
  };
}

/**
 * Okunmamış bildirim sayısı.
 * TopNav'daki zil ikonu kullanır.
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Tek bir bildirimi okundu işaretler.
 * Kullanıcı bildirime tıkladığında çağrılır.
 */
export async function markNotificationRead(
  notificationId: string
): Promise<NotificationActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/bildirimler');

  return { success: true };
}

/**
 * Kullanıcının tüm okunmamış bildirimlerini okundu işaretler.
 * /bildirimler sayfasındaki "Tümünü okundu işaretle" butonu kullanır.
 */
export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/bildirimler');

  return { success: true };
}

/**
 * Tek bir bildirimi siler.
 * /bildirimler sayfasındaki satır içi "Sil" butonu kullanır (opsiyonel UI).
 */
export async function deleteNotification(
  notificationId: string
): Promise<NotificationActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' };
  }

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/bildirimler');

  return { success: true };
}