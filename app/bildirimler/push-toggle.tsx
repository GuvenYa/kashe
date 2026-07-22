'use client';

import { useState, useEffect } from 'react';
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  registerServiceWorker,
  type PushSupportState,
} from '@/app/lib/push-client';
import {
  savePushSubscription,
  removePushSubscription,
} from './push-actions';

export function PushToggle() {
  const [state, setState] = useState<PushSupportState | 'loading'>('loading');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // İlk durum: izin + mevcut abonelik kontrolü
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const s = getPushState();
      if (cancelled) return;
      setState(s);

      if (s === 'granted' && 'serviceWorker' in navigator) {
        await registerServiceWorker();
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setIsSubscribed(!!existing);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable() {
    setBusy(true);
    setError(null);
    const result = await subscribeToPush(savePushSubscription);
    if (result.success) {
      setIsSubscribed(true);
      setState('granted');
    } else {
      setError(result.error || 'Bir hata oluştu.');
      // İzin reddedildiyse state'i güncelle
      setState(getPushState());
    }
    setBusy(false);
  }

  async function handleDisable() {
    setBusy(true);
    setError(null);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) {
        await removePushSubscription(endpoint);
      }
      setIsSubscribed(false);
    } catch {
      setError('Kapatılamadı.');
    }
    setBusy(false);
  }

  // Desteklenmiyorsa hiç gösterme
  if (state === 'loading') return null;
  if (state === 'unsupported') return null;

  return (
    <div className="bg-card border border-line rounded-2xl p-5 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 mt-0.5 text-brand-ink"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <div className="min-w-0">
            <p className="font-display font-semibold text-ink mb-0.5">
              Tarayıcı bildirimleri
            </p>
            <p className="text-sm text-ink-72 leading-relaxed">
              {isSubscribed
                ? 'Açık — yeni mesaj, teklif ve başvurularda anlık bildirim alırsın.'
                : 'Aç, böylece site kapalıyken bile yeni mesaj ve tekliflerden anında haberdar ol.'}
            </p>
            {state === 'denied' && (
              <p className="text-xs text-ink-72 mt-1.5">
                Bildirim izni tarayıcıda engellenmiş. Açmak için tarayıcı site
                ayarlarından bildirimlere izin ver.
              </p>
            )}
            {error && (
              <p className="text-xs text-danger mt-1.5">{error}</p>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {isSubscribed ? (
            <button
              type="button"
              onClick={handleDisable}
              disabled={busy}
              className="kashe-tap px-4 py-2 rounded-lg border border-line text-ink-72 font-display font-semibold text-sm hover:border-ink hover:text-ink transition disabled:opacity-50"
            >
              {busy ? '...' : 'Kapat'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnable}
              disabled={busy || state === 'denied'}
              className="kashe-tap px-4 py-2 rounded-lg bg-brand-ink text-paper font-display font-semibold text-sm hover:bg-brand-ink-deep transition disabled:opacity-50"
            >
              {busy ? '...' : 'Bildirimleri aç'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}