'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminCancelListing } from '@/app/ilanlar/listings-actions';

export function AdminIlanKaldir({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await adminCancelListing(listingId);
      if (result.success) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(result.error || 'Bir hata oluştu.');
        setConfirming(false);
      }
    });
  }

  return (
    <div>
      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`px-4 py-2 rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] border transition disabled:opacity-50 ${
          confirming
            ? 'bg-danger text-paper border-danger'
            : 'border-danger text-danger hover:bg-danger/5'
        }`}
      >
        {isPending
          ? 'İşleniyor...'
          : confirming
          ? 'Eminsen tekrar tıkla'
          : 'Yayından kaldır'}
      </button>
      {confirming && !isPending && (
        <button
          onClick={() => setConfirming(false)}
          className="ml-2 px-3 py-2 text-ink-72 hover:text-ink font-mono text-[11px] uppercase tracking-[0.1em] transition"
        >
          İptal
        </button>
      )}
    </div>
  );
}
