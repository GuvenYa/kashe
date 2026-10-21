'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { teklifMusterisiniKisiYap } from '@/app/lib/crm-actions';
import type { TeklifOnerisi } from '@/app/lib/crm-data';

/**
 * FAZ 8b — "teklif musterisi kisi olarak eklenebilir" seridi.
 *
 * Kaynak `crm_contact_suggestions` gorunumu: satici kurulusun e-postasi olan
 * ama kisi kaydi OLMAYAN teklifleri. Yani liste kendiliginden kisalir —
 * eklenen satir bir daha gorunmez.
 *
 * IYIMSER: dugmeye basilinca satir hemen kaybolur, sunucu yanitini beklemez.
 * Hata donerse satir GERI GELIR ve mesaj yazilir (sessiz kayip olmaz).
 */
const BTN =
  'kashe-tap px-3 py-1.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-xs hover:bg-brand-ink-deep transition-colors disabled:opacity-50';

export function OnerilerSeridi({
  organizationId,
  oneriler,
}: {
  organizationId: string;
  oneriler: TeklifOnerisi[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [gizlenen, setGizlenen] = useState<Set<string>>(new Set());
  const [hata, setHata] = useState<string | null>(null);

  const gorunen = oneriler.filter((o) => !gizlenen.has(o.proposalId));
  if (gorunen.length === 0) return null;

  function ekle(proposalId: string) {
    setHata(null);
    setGizlenen((o) => new Set(o).add(proposalId));
    startTransition(async () => {
      const res = await teklifMusterisiniKisiYap(organizationId, proposalId);
      if (!res.ok) {
        // Geri al: satir yeniden gorunur, kullanici ne olmadigini bilir.
        setGizlenen((o) => {
          const y = new Set(o);
          y.delete(proposalId);
          return y;
        });
        setHata(res.hata);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="bg-brand-accent/[0.04] border border-brand-accent/30 rounded-xl p-4 mb-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-accent mb-1.5">
        Öneri
      </p>
      <p className="text-sm text-ink">
        Teklif müşterileri kişi olarak eklenebilir: {gorunen.length}
      </p>

      <ul className="mt-3 divide-y divide-line">
        {gorunen.map((o) => (
          <li
            key={o.proposalId}
            className="flex items-start justify-between gap-3 py-2.5 flex-wrap"
          >
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-sm text-ink break-words">
                {o.clientName ?? o.clientEmail}
              </p>
              <p className="text-xs text-ink-72 break-words">
                {o.clientName ? `${o.clientEmail} · ` : ''}
                {o.proposalTitle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => ekle(o.proposalId)}
              disabled={isPending}
              className={BTN}
            >
              Kişi olarak ekle
            </button>
          </li>
        ))}
      </ul>

      {hata && <p className="text-sm text-danger mt-2">{hata}</p>}
    </div>
  );
}
