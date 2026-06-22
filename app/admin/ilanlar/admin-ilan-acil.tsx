'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminGrantUrgent,
  adminRevokeUrgent,
} from '@/app/ilanlar/listings-actions';
import { isUrgentActive } from '@/app/lib/promotion';

type Props = {
  listingId: string;
  isUrgent: boolean;
  urgentUntil: string | null;
};

export function AdminIlanAcil({ listingId, isUrgent, urgentUntil }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = isUrgentActive(isUrgent, urgentUntil);

  function handleGrant() {
    setError(null);
    startTransition(async () => {
      const result = await adminGrantUrgent(listingId, 7);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  function handleRevoke() {
    setError(null);
    startTransition(async () => {
      const result = await adminRevokeUrgent(listingId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  return (
    <div>
      {error && <p className="text-xs text-ember mb-2">{error}</p>}
      {active ? (
        <button
          onClick={handleRevoke}
          disabled={isPending}
          className="px-4 py-2 rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] border border-terracotta text-terracotta hover:bg-terracotta/5 transition disabled:opacity-50"
        >
          {isPending ? 'İşleniyor...' : '🔥 Acil etiketini kaldır'}
        </button>
      ) : (
        <button
          onClick={handleGrant}
          disabled={isPending}
          className="px-4 py-2 rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] border border-line text-ink-72 hover:border-terracotta hover:text-terracotta transition disabled:opacity-50"
        >
          {isPending ? 'İşleniyor...' : '🔥 Acil yap (7 gün)'}
        </button>
      )}
    </div>
  );
}