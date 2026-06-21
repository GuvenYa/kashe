'use server';

import { createClient } from '@/app/lib/supabase-server';

type PushActionResult = { success: boolean; error?: string };

/**
 * Tarayıcı push subscription'ını kaydet (kullanıcı bildirimleri açınca).
 * Aynı endpoint varsa güncelle (upsert) — cihaz tekrar abone olursa çoğaltma.
 */
export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<PushActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Giriş yapmalısın.' };
  }

  // endpoint UNIQUE — upsert ile aynı cihaz tekrar abone olursa güncelle
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    return { success: false, error: 'Kaydedilemedi: ' + error.message };
  }

  return { success: true };
}

/**
 * Subscription'ı sil (kullanıcı bildirimleri kapatınca).
 * Kendi subscription'ı olduğu için RLS delete politikası yeterli.
 */
export async function removePushSubscription(
  endpoint: string
): Promise<PushActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Giriş yapmalısın.' };
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: 'Silinemedi: ' + error.message };
  }

  return { success: true };
}