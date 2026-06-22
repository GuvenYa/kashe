import 'server-only';
import webpush from 'web-push';
import { createClient } from '@/app/lib/supabase-server';

// VAPID yapılandırması (modül yüklenince bir kez)
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const rawSubject = process.env.VAPID_SUBJECT || 'mailto:kasheofficial@gmail.com';
// mailto: veya https: öneki yoksa ekle (yanlış env build'i çökertmesin)
const vapidSubject =
  rawSubject.startsWith('mailto:') || rawSubject.startsWith('http')
    ? rawSubject
    : `mailto:${rawSubject}`;

let vapidReady = false;
if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  vapidReady = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Bir kullanıcının tüm cihazlarına push gönderir.
 * Subscription'ları SECURITY DEFINER RPC ile çeker (RLS bypass — başka
 * kullanıcıya da gönderebilmek için). Ölü subscription'ları (410/404) temizler.
 *
 * Bildirimi TETİKLEYEN action'lardan çağrılır (mesaj, teklif, başvuru...).
 * Hata fırlatmaz — push opsiyoneldir, asıl işi (mesaj gönderme vb.) bloklamaz.
 */
export async function sendPushToUser(
  targetUserId: string,
  payload: PushPayload
): Promise<void> {
  if (!vapidReady) {
    // VAPID tanımlı değilse sessizce çık (geliştirme/yanlış config)
    return;
  }

  try {
    const supabase = await createClient();

    // Hedefin subscription'larını RPC ile çek (RLS aşılır)
    const { data: subs, error } = await supabase.rpc(
      'get_push_subscriptions_for_user',
      { target_user_id: targetUserId }
    );

    if (error || !subs || subs.length === 0) {
      return;
    }

    const payloadStr = JSON.stringify(payload);

    // Tüm cihazlara paralel gönder
    await Promise.all(
      subs.map(
        async (sub: { endpoint: string; p256dh: string; auth: string }) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payloadStr
            );
          } catch (err: unknown) {
            // 410 Gone / 404 → subscription ölü, temizle
            const statusCode =
              err && typeof err === 'object' && 'statusCode' in err
                ? (err as { statusCode: number }).statusCode
                : 0;
            if (statusCode === 410 || statusCode === 404) {
              await supabase.rpc('delete_push_subscription_by_endpoint', {
                target_endpoint: sub.endpoint,
              });
            } else {
              console.error('[push] gönderim hatası:', statusCode || err);
            }
          }
        }
      )
    );
  } catch (e) {
    // Push asla asıl akışı bozmamalı
    console.error('[push] sendPushToUser genel hata:', e);
  }
}