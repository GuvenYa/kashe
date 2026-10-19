'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { awardRfp, requestRfpRevision } from '../rfp-actions';

/**
 * FAZ 7b / P2 — karsilastirma sutununun altindaki alici islemleri.
 *
 * Bilesen YALNIZ islem icindir: tablo ve veriler sunucuda uretilir, burada
 * sadece onay kapisi + RPC cagrisi vardir (`rfp_award`, `rfp_request_revision`).
 * Ic maliyet/marj bu yuzeye HIC gelmez.
 */

const BTN_BIRINCIL =
  'kashe-tap px-3 py-1.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-xs hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-3 py-1.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-xs hover:border-brand-ink hover:text-brand-ink transition-colors disabled:opacity-50';
const ALAN =
  'w-full px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:border-brand-ink focus:outline-none';

type Kapi = 'sec' | 'revizyon' | null;

export function KarsilastirmaIslemleri({
  rfpId,
  proposalId,
  saticiAdi,
  toplamMetni,
}: {
  rfpId: string;
  proposalId: string;
  saticiAdi: string;
  /** Onay metninde gosterilen genel toplam (KDV dahil). */
  toplamMetni: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [kapi, setKapi] = useState<Kapi>(null);
  const [not, setNot] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  function sec() {
    setHata(null);
    startTransition(async () => {
      const res = await awardRfp({ rfpId, proposalId });
      if (!res.success) {
        setHata(res.error);
        return;
      }
      setKapi(null);
      setBilgi('Seçim yapıldı.');
      router.refresh();
    });
  }

  function revizyonIste() {
    setHata(null);
    if (not.trim().length < 2) {
      setHata('Revizyon notu 2-4000 karakter olmalı.');
      return;
    }
    startTransition(async () => {
      const res = await requestRfpRevision({ rfpId, proposalId, note: not });
      if (!res.success) {
        setHata(res.error);
        return;
      }
      setKapi(null);
      setNot('');
      setBilgi('Revizyon istendi.');
      router.refresh();
    });
  }

  return (
    <div className="mt-3">
      {kapi === null && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setBilgi(null);
              setKapi('sec');
            }}
            disabled={isPending}
            className={BTN_BIRINCIL}
          >
            Seç
          </button>
          <button
            type="button"
            onClick={() => {
              setBilgi(null);
              setKapi('revizyon');
            }}
            disabled={isPending}
            className={BTN_IKINCIL}
          >
            Revizyon iste
          </button>
        </div>
      )}

      {kapi === 'sec' && (
        <div className="px-3 py-2.5 bg-paper border border-line-strong rounded-lg">
          <p className="text-xs text-ink leading-relaxed">
            &ldquo;{saticiAdi}&rdquo; teklifi ({toplamMetni}) seçilecek. Teklif
            onaylanır, diğer davetler &ldquo;seçilmedi&rdquo; olur; bu işlem
            geri alınamaz.
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <button
              type="button"
              onClick={sec}
              disabled={isPending}
              className={BTN_BIRINCIL}
            >
              Seç
            </button>
            <button
              type="button"
              onClick={() => setKapi(null)}
              disabled={isPending}
              className={BTN_IKINCIL}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {kapi === 'revizyon' && (
        <div className="px-3 py-2.5 bg-paper border border-line-strong rounded-lg">
          <label className="block text-xs text-ink-72 mb-1">
            Neyin değişmesini istiyorsun?
          </label>
          <textarea
            value={not}
            onChange={(e) => setNot(e.target.value.slice(0, 4000))}
            rows={3}
            placeholder="Örn: DJ fiyatını yeniden değerlendirir misiniz?"
            className={ALAN}
          />
          <p className="text-[11px] text-ink-50 mt-1">
            {not.length}/4000 — en az 2 karakter. Not ajansa iletilir.
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <button
              type="button"
              onClick={revizyonIste}
              disabled={isPending || not.trim().length < 2}
              className={BTN_BIRINCIL}
            >
              Revizyon iste
            </button>
            <button
              type="button"
              onClick={() => {
                setKapi(null);
                setNot('');
              }}
              disabled={isPending}
              className={BTN_IKINCIL}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {hata && <p className="text-xs text-danger mt-2">{hata}</p>}
      {bilgi && <p className="text-xs text-moss mt-2">{bilgi}</p>}
    </div>
  );
}
