'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { declineQuoteRequest } from '@/app/teklif-topla/actions';
import { TeklifVerModal } from './teklif-ver-modal';

type Props = {
  recipientId: string;
  customerName: string;
  alreadyResponded: boolean;
  conversationId: string | null;
  status: string;
  budgetMax: number | null;
  shareBudget: boolean;
};

export function TalepKartiAksiyonlari({
  recipientId,
  customerName,
  alreadyResponded,
  conversationId,
  status,
  budgetMax,
  shareBudget,
}: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);

  // Zaten teklif verilmişse → mesajlaşmaya git
  if (status === 'quoted' && conversationId) {
    return (
      <button
        onClick={() => router.push(`/mesajlar/${conversationId}`)}
        className="px-4 py-2 bg-ink text-paper rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] hover:bg-ink/90 transition"
      >
        Teklifi gör →
      </button>
    );
  }

  // Reddedilmişse → pasif etiket
  if (status === 'declined') {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-72">
        Reddedildi
      </span>
    );
  }

  function handleDecline() {
    if (!confirmDecline) {
      setConfirmDecline(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await declineQuoteRequest(recipientId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Hata');
        setConfirmDecline(false);
      }
    });
  }

  return (
    <>
      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setModalOpen(true)}
          disabled={isPending}
          className="px-4 py-2 bg-terracotta text-paper rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] hover:opacity-90 disabled:opacity-50 transition"
        >
          Teklif ver
        </button>
        <button
          onClick={handleDecline}
          disabled={isPending}
          className={`px-4 py-2 border rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] transition disabled:opacity-50 ${
            confirmDecline
              ? 'bg-danger text-paper border-danger'
              : 'border-line text-ink-72 hover:border-ink'
          }`}
        >
          {confirmDecline ? 'Emin misin?' : 'İlgilenmiyorum'}
        </button>
      </div>

      {modalOpen && (
        <TeklifVerModal
          recipientId={recipientId}
          customerName={customerName}
          budgetMax={budgetMax}
          shareBudget={shareBudget}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}