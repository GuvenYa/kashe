'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteDraftProposal } from './teklif-actions';

/**
 * FAZ 7a / P2 — listede taslak silme.
 *
 * Satirin tamami bir baglanti oldugu icin tiklama YUKARI TASINMAZ
 * (preventDefault + stopPropagation). Kapi DB politikasinda (7a-DB/02):
 * yalniz hicbir surumu gonderilmemis taslak silinir.
 */
export function TeklifSil({
  proposalId,
  baslik,
}: {
  proposalId: string;
  baslik: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [onay, setOnay] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  function dur(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function sil(e: React.MouseEvent) {
    dur(e);
    setHata(null);
    startTransition(async () => {
      const res = await deleteDraftProposal(proposalId);
      if (!res.success) {
        setHata(res.error);
        return;
      }
      setOnay(false);
      router.refresh();
    });
  }

  if (!onay) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={(e) => {
            dur(e);
            setOnay(true);
          }}
          className="kashe-tap font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 border border-line px-2 py-1 rounded hover:border-danger hover:text-danger transition-colors"
        >
          Sil
        </button>
        {hata && <span className="text-[11px] text-danger">{hata}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="text-xs text-ink">{baslik} silinecek. Emin misin?</span>
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={sil}
          disabled={isPending}
          className="kashe-tap font-mono text-[10px] uppercase tracking-[0.12em] text-paper bg-brand-ink px-2 py-1 rounded disabled:opacity-50"
        >
          {isPending ? 'Siliniyor…' : 'Sil'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            dur(e);
            setOnay(false);
          }}
          className="kashe-tap font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 border border-line px-2 py-1 rounded"
        >
          Vazgeç
        </button>
      </span>
      {hata && <span className="text-[11px] text-danger">{hata}</span>}
    </span>
  );
}
