'use client';

import { useState, useTransition } from 'react';
import {
  removeReview,
  removeReviewReply,
} from '@/app/admin/actions';

type Props = {
  reviewId: string;
  hasReply: boolean;
};

type ActionKey = 'remove_review' | 'remove_reply';

export function YorumAksiyonlari({ reviewId, hasReply }: Props) {
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

  async function handleRemoveReview() {
    const r = await removeReview(reviewId);
    if (!r.success) throw new Error(r.error);
  }

  async function handleRemoveReply() {
    const r = await removeReviewReply(reviewId);
    if (!r.success) throw new Error(r.error);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {/* Yanıtı kaldır (sadece yanıt varsa) */}
        {hasReply && (
          <button
            type="button"
            onClick={() => withConfirm('remove_reply', handleRemoveReply)}
            disabled={isPending}
            className={`kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition disabled:opacity-50 ${
              confirming === 'remove_reply'
                ? 'bg-plum text-paper border-plum'
                : 'border-line text-ink-72 hover:border-plum hover:text-plum'
            }`}
          >
            {confirming === 'remove_reply'
              ? 'Eminim — Yanıtı sil'
              : 'Yanıtı kaldır'}
          </button>
        )}

        {/* Yorumu kaldır */}
        <button
          type="button"
          onClick={() => withConfirm('remove_review', handleRemoveReview)}
          disabled={isPending}
          className={`kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition disabled:opacity-50 ${
            confirming === 'remove_review'
              ? 'bg-terracotta text-paper border-terracotta'
              : 'border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
          }`}
        >
          {confirming === 'remove_review'
            ? 'Eminim — Yorumu sil'
            : 'Yorumu kaldır'}
        </button>

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
        <p className="text-xs text-danger mt-2 bg-danger-08 border border-danger/30 rounded-lg p-2">
          {error}
        </p>
      )}
    </div>
  );
}