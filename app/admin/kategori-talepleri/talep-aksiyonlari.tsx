'use client';

import { useState, useTransition } from 'react';
import {
  markCategoryRequestReviewing,
  approveCategoryRequest,
  declineCategoryRequest,
} from '@/app/admin/actions';

type Props = {
  requestId: string;
  status: 'pending' | 'reviewing' | 'approved' | 'declined';
  categoryName: string;
};

type ActionKey = 'reviewing' | 'approve' | 'decline';

export function TalepAksiyonlari({ requestId, status, categoryName }: Props) {
  const [confirming, setConfirming] = useState<ActionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function withConfirm(key: ActionKey, action: () => Promise<void>) {
    if (confirming !== key) {
      setConfirming(key);
      setError(null);
      return;
    }
    startTransition(async () => {
      try {
        await action();
        setConfirming(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Bir hata oluştu.');
        setConfirming(null);
      }
    });
  }

  async function handleReviewing() {
    const r = await markCategoryRequestReviewing(requestId);
    if (!r.success) throw new Error(r.error);
  }

  async function handleApprove() {
    const r = await approveCategoryRequest(requestId);
    if (!r.success) throw new Error(r.error);
  }

  async function handleDecline() {
    const r = await declineCategoryRequest(requestId);
    if (!r.success) throw new Error(r.error);
  }

  // Status'a göre hangi aksiyonlar gösterilecek
  const showReviewing = status === 'pending';
  const showApprove = status === 'pending' || status === 'reviewing';
  const showDecline = status === 'pending' || status === 'reviewing';
  const showReopen = status === 'approved' || status === 'declined';

  if (
    !showReviewing &&
    !showApprove &&
    !showDecline &&
    !showReopen
  ) {
    return null;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {/* İncelemeye al */}
        {showReviewing && (
          <button
            type="button"
            onClick={() => withConfirm('reviewing', handleReviewing)}
            disabled={isPending}
            className={`kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition disabled:opacity-50 ${
              confirming === 'reviewing'
                ? 'bg-plum text-paper border-plum'
                : 'border-line text-ink-72 hover:border-plum hover:text-plum'
            }`}
          >
            {confirming === 'reviewing' ? 'Onayla' : 'İncelemeye al'}
          </button>
        )}

        {/* Onayla */}
        {showApprove && (
          <button
            type="button"
            onClick={() => withConfirm('approve', handleApprove)}
            disabled={isPending}
            className={`kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition disabled:opacity-50 ${
              confirming === 'approve'
                ? 'bg-moss text-paper border-moss'
                : 'border-line text-ink-72 hover:border-moss hover:text-moss'
            }`}
          >
            {confirming === 'approve' ? 'Eminim — Onayla' : 'Onayla'}
          </button>
        )}

        {/* Reddet */}
        {showDecline && (
          <button
            type="button"
            onClick={() => withConfirm('decline', handleDecline)}
            disabled={isPending}
            className={`kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition disabled:opacity-50 ${
              confirming === 'decline'
                ? 'bg-terracotta text-paper border-terracotta'
                : 'border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
            }`}
          >
            {confirming === 'decline' ? 'Eminim — Reddet' : 'Reddet'}
          </button>
        )}

        {/* Yeniden aç (approved veya declined ise) */}
        {showReopen && (
          <button
            type="button"
            onClick={() => withConfirm('reviewing', handleReviewing)}
            disabled={isPending}
            className={`kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition disabled:opacity-50 ${
              confirming === 'reviewing'
                ? 'bg-plum text-paper border-plum'
                : 'border-line text-ink-72 hover:border-plum hover:text-plum'
            }`}
          >
            {confirming === 'reviewing'
              ? 'Onayla — Yeniden incele'
              : 'Yeniden incele'}
          </button>
        )}

        {/* Vazgeç (onay modunda iken) */}
        {confirming !== null && (
          <button
            type="button"
            onClick={() => {
              setConfirming(null);
              setError(null);
            }}
            disabled={isPending}
            className="kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-[0.14em] text-ink-50 hover:text-ink transition disabled:opacity-50"
          >
            Vazgeç
          </button>
        )}

        {isPending && (
          <span className="inline-flex items-center text-[11px] font-mono uppercase tracking-[0.14em] text-ink-50 self-center">
            ...
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-terracotta mt-2 bg-terracotta/8 border border-terracotta/20 rounded-lg p-2">
          {error}
        </p>
      )}
    </div>
  );
}