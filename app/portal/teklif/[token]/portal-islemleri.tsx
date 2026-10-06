'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveProposal, requestRevision } from './portal-actions';

/**
 * FAZ 7a / P2 — portal islem paneli.
 *
 * Onay KRITIK ISLEM (05): tek tikla gecilmez — ad soyad + okudum kutusu + ozet.
 * Revizyon istegi not zorunlu. Jeton yalniz prop olarak gelir ve action'a verilir.
 */

const BTN_BIRINCIL =
  'kashe-tap px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-5 py-2.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors disabled:opacity-50';
const ALAN =
  'w-full px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:border-brand-ink focus:outline-none';

export function PortalIslemleri({
  token,
  toplamMetni,
  gecerlilikMetni,
  onaylanabilir,
  revizeIstenebilir,
}: {
  token: string;
  /** Bicimli toplam (KDV dahil) — sunucuda hazirlandi. */
  toplamMetni: string | null;
  gecerlilikMetni: string | null;
  /** Baglantinin `scope`'u izin veriyor mu. */
  onaylanabilir: boolean;
  revizeIstenebilir: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [panel, setPanel] = useState<'yok' | 'onay' | 'revizyon'>('yok');
  const [ad, setAd] = useState('');
  const [kabul, setKabul] = useState(false);
  const [not, setNot] = useState('');

  function onayla() {
    if (ad.trim().length < 2) {
      setHata('Ad soyad 2-120 karakter olmalı.');
      return;
    }
    if (!kabul) {
      setHata('Onaylamak için kutuyu işaretle.');
      return;
    }
    setHata(null);
    startTransition(async () => {
      const res = await approveProposal(token, ad);
      if (!res.success) {
        setHata(res.error);
        return;
      }
      setPanel('yok');
      router.refresh();
    });
  }

  function revizeIste() {
    if (not.trim().length < 2) {
      setHata('Revizyon notu 2-4000 karakter olmalı.');
      return;
    }
    setHata(null);
    startTransition(async () => {
      const res = await requestRevision(token, not);
      if (!res.success) {
        setHata(res.error);
        return;
      }
      setPanel('yok');
      router.refresh();
    });
  }

  if (!onaylanabilir && !revizeIstenebilir) {
    return (
      <p className="text-sm text-ink-72">
        Bu bağlantı yalnızca görüntüleme içindir. Onay veya revizyon için
        kuruluşla iletişime geç.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {hata && <p className="text-sm text-danger">{hata}</p>}

      {panel === 'yok' && (
        <div className="flex items-center gap-3 flex-wrap">
          {onaylanabilir && (
            <button
              type="button"
              onClick={() => {
                setHata(null);
                setPanel('onay');
              }}
              disabled={isPending}
              className={BTN_BIRINCIL}
            >
              Teklifi onayla
            </button>
          )}
          {revizeIstenebilir && (
            <button
              type="button"
              onClick={() => {
                setHata(null);
                setPanel('revizyon');
              }}
              disabled={isPending}
              className={BTN_IKINCIL}
            >
              Revizyon iste
            </button>
          )}
        </div>
      )}

      {panel === 'onay' && (
        <div className="px-4 py-4 bg-card border border-line-strong rounded-lg space-y-3">
          <p className="font-display font-semibold text-ink">Teklifi onayla</p>
          <ul className="text-sm text-ink-72 space-y-1">
            <li>Toplam (KDV dahil): {toplamMetni ?? '—'}</li>
            <li>Geçerlilik: {gecerlilikMetni ?? 'belirtilmedi'}</li>
          </ul>
          <div>
            <label className="block text-xs text-ink-72 mb-1">
              Ad Soyad (onaylayan)
            </label>
            <input
              type="text"
              value={ad}
              onChange={(e) => setAd(e.target.value.slice(0, 120))}
              placeholder="Ad Soyad"
              className={ALAN}
            />
          </div>
          <label className="inline-flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={kabul}
              onChange={(e) => setKabul(e.target.checked)}
              className="mt-0.5"
            />
            Teklifi okudum, kabul ediyorum.
          </label>
          <p className="text-xs text-ink-50">
            Onay sonrası teklif değişmez; değişiklik için kuruluşun yeni sürüm
            göndermesi gerekir.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onayla}
              disabled={isPending}
              className={BTN_BIRINCIL}
            >
              {isPending ? 'Onaylanıyor…' : 'Onaylıyorum'}
            </button>
            <button
              type="button"
              onClick={() => setPanel('yok')}
              disabled={isPending}
              className={BTN_IKINCIL}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {panel === 'revizyon' && (
        <div className="px-4 py-4 bg-card border border-line-strong rounded-lg space-y-3">
          <p className="font-display font-semibold text-ink">Revizyon iste</p>
          <div>
            <label className="block text-xs text-ink-72 mb-1">
              Neyin değişmesini istiyorsun?
            </label>
            <textarea
              value={not}
              onChange={(e) => setNot(e.target.value.slice(0, 4000))}
              rows={4}
              placeholder="Örnek: Ses ve ışık kalemi için indirim rica ederiz."
              className={ALAN}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={revizeIste}
              disabled={isPending}
              className={BTN_BIRINCIL}
            >
              {isPending ? 'Gönderiliyor…' : 'Gönder'}
            </button>
            <button
              type="button"
              onClick={() => setPanel('yok')}
              disabled={isPending}
              className={BTN_IKINCIL}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
