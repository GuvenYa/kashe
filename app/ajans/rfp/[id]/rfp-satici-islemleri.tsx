'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { declineRfpInvite, respondRfp } from '../rfp-satici-actions';

/**
 * FAZ 7b / P1 — satici islemleri: teklif hazirla / daveti reddet.
 *
 * Yalniz RPC cagrilir. Teklif hazirlanmasi idempotandir (davetin teklifi varsa
 * ayni teklife gider). Butce ipucu bu tarafta hic bilinmez.
 */

const BTN_BIRINCIL =
  'kashe-tap px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-5 py-2.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors disabled:opacity-50';

export function RfpSaticiIslemleri({
  rfpId,
  organizationId,
}: {
  rfpId: string;
  /** Davetli ajans kurulusu (`proposals.manage` yetkili). */
  organizationId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [onay, setOnay] = useState(false);

  function teklifHazirla() {
    setHata(null);
    startTransition(async () => {
      const res = await respondRfp({ rfpId, organizationId });
      if (!res.success) {
        setHata(res.error);
        return;
      }
      router.push(`/ajans/teklifler/${res.data!.proposalId}`);
    });
  }

  function reddet() {
    setHata(null);
    startTransition(async () => {
      const res = await declineRfpInvite(rfpId);
      if (!res.success) {
        setHata(res.error);
        return;
      }
      setOnay(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {hata && <p className="text-sm text-danger">{hata}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={teklifHazirla}
          disabled={isPending}
          className={BTN_BIRINCIL}
        >
          {isPending ? 'Hazırlanıyor…' : 'Teklif hazırla'}
        </button>
        <button
          type="button"
          onClick={() => setOnay(true)}
          disabled={isPending}
          className={BTN_IKINCIL}
        >
          Daveti reddet
        </button>
        <Link href="/ajans/rfp" className="text-sm text-brand-ink hover:underline">
          Tüm talepler
        </Link>
      </div>

      {onay && (
        <div className="px-4 py-3 bg-card border border-line-strong rounded-lg flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-ink">
            Daveti reddedeceksin; talep sahibine bildirilir. Emin misin?
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={reddet}
              disabled={isPending}
              className={BTN_BIRINCIL}
            >
              Reddet
            </button>
            <button
              type="button"
              onClick={() => setOnay(false)}
              className={BTN_IKINCIL}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-ink-50">
        Teklif hazırlandığında kalemler bu talepten gelir; fiyatları sen
        girersin. Gönderdiğinde teklif doğrudan alıcı kuruluşa iletilir.
      </p>
    </div>
  );
}
