'use client';

// VAPID public key'i base64'ten Uint8Array'e çevir (Push API gereği)
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export type PushSupportState =
  | 'unsupported'
  | 'denied'
  | 'granted'
  | 'default';

/** Tarayıcı push destekliyor mu + izin durumu */
export function getPushState(): PushSupportState {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return 'unsupported';
  }
  return Notification.permission as PushSupportState;
}

/** Service worker'ı kaydet (idempotent) */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch (e) {
    console.error('SW kaydı başarısız:', e);
    return null;
  }
}

/**
 * İzin iste + subscribe et + subscription'ı sunucuya gönder.
 * Başarılıysa true döner.
 */
export async function subscribeToPush(
  saveSubscription: (sub: {
    endpoint: string;
    p256dh: string;
    auth: string;
  }) => Promise<{ success: boolean; error?: string }>
): Promise<{ success: boolean; error?: string }> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    return { success: false, error: 'VAPID anahtarı tanımlı değil.' };
  }

  if (getPushState() === 'unsupported') {
    return { success: false, error: 'Tarayıcın bildirimi desteklemiyor.' };
  }

  // İzin iste
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { success: false, error: 'Bildirim izni verilmedi.' };
  }

  const reg = await registerServiceWorker();
  if (!reg) {
    return { success: false, error: 'Service worker kaydedilemedi.' };
  }

  // Hazır olmasını bekle
  await navigator.serviceWorker.ready;

  // Zaten abone mi? Varsa onu kullan, yoksa yeni oluştur
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  // Subscription'ı parçala (endpoint + keys)
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return { success: false, error: 'Abonelik bilgisi eksik.' };
  }

  // Sunucuya kaydet
  return await saveSubscription({ endpoint, p256dh, auth });
}

/** Aboneliği iptal et (tarayıcı tarafı) */
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint; // sunucudan da silmek için endpoint döner
}