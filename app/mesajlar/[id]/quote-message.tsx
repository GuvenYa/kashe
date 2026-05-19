'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  type Quote,
  formatQuoteAmount,
  formatExpiresIn,
  canAcceptQuote,
  canWithdrawQuote,
  getQuoteStatusLabel,
  getQuoteStatusTone,
} from '../quotes-data';
import { acceptQuote, declineQuote, withdrawQuote } from '../quote-actions';

type QuoteCardProps = {
  quote: Quote;
  currentUserId: string;
};

export function QuoteCard({ quote, currentUserId }: QuoteCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<
    'accept' | 'decline' | 'withdraw' | null
  >(null);

  const canAccept = canAcceptQuote(quote, currentUserId);
  const canWithdraw = canWithdrawQuote(quote, currentUserId);
  const isPendingStatus = quote.status === 'pending';
  const tone = getQuoteStatusTone(quote.status);
  const isMine = quote.sender_id === currentUserId;

  function handleAccept() {
    if (confirmingAction !== 'accept') {
      setConfirmingAction('accept');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await acceptQuote(quote.id);
      if (!result.success) {
        setError(result.error);
        setConfirmingAction(null);
      } else {
        router.refresh();
      }
    });
  }

  function handleDecline() {
    if (confirmingAction !== 'decline') {
      setConfirmingAction('decline');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await declineQuote(quote.id);
      if (!result.success) {
        setError(result.error);
        setConfirmingAction(null);
      } else {
        router.refresh();
      }
    });
  }

  function handleWithdraw() {
    if (confirmingAction !== 'withdraw') {
      setConfirmingAction('withdraw');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await withdrawQuote(quote.id);
      if (!result.success) {
        setError(result.error);
        setConfirmingAction(null);
      } else {
        router.refresh();
      }
    });
  }

  // Status rozeti renkleri
  const badgeStyles: Record<typeof tone, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    success: 'bg-[#1E3A5F] text-white border-[#1E3A5F]',
    danger: 'bg-terracotta/10 text-terracotta border-terracotta/30',
    neutral: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
  };

  const expiresDate = new Date(quote.expires_at);
  const expiresFormatted = expiresDate.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="my-4 mx-auto max-w-[480px]">
      <div className="bg-white border-2 border-[#1E3A5F]/15 rounded-xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-[#1E3A5F]/5 border-b border-[#1E3A5F]/10 px-5 py-3 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#1E3A5F]">
            Teklif
          </p>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] font-medium border ${badgeStyles[tone]}`}
          >
            {getQuoteStatusLabel(quote.status)}
          </span>
        </div>

        {/* Fiyat */}
        <div className="px-5 pt-5 pb-3">
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1">
            Toplam
          </p>
          <p className="font-display text-3xl text-[#1E3A5F] font-medium tracking-tight">
            {formatQuoteAmount(quote.total_amount, quote.currency)}
          </p>
        </div>

        {/* Hizmet kapsamı */}
        <div className="px-5 pb-4">
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1.5">
            Hizmet kapsamı
          </p>
          <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
            {quote.services_description}
          </p>
        </div>

        {/* İptal politikası (varsa) */}
        {quote.cancellation_policy && (
          <details className="px-5 pb-4 group">
            <summary className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-72 cursor-pointer hover:text-ink transition list-none flex items-center gap-1.5">
              <span className="group-open:rotate-90 transition-transform inline-block">
                ▸
              </span>
              İptal politikası
            </summary>
            <p className="text-xs text-ink-72 leading-relaxed mt-2 pl-3.5 whitespace-pre-wrap">
              {quote.cancellation_policy}
            </p>
          </details>
        )}

        {/* Geçerlilik */}
        <div className="px-5 pb-4 border-t border-line/50 pt-3">
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1">
            Geçerlilik
          </p>
          {isPendingStatus ? (
            <>
              <p className="text-base text-ink font-medium">
                {formatExpiresIn(quote.expires_at)}
              </p>
              <p className="text-[10px] text-ink-72 font-mono mt-0.5">
                {expiresFormatted}
              </p>
            </>
          ) : (
            <p className="text-xs text-ink-72 font-mono">{expiresFormatted}</p>
          )}
        </div>

        {error && (
          <div className="mx-5 mb-3 bg-terracotta/10 border border-terracotta/30 text-terracotta text-xs rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Aksiyonlar */}
        {(canAccept || canWithdraw) && (
          <div className="border-t border-line/50 p-3 bg-paper/30">
            {canAccept && (
              <div className="flex gap-2">
                <button
                  onClick={handleDecline}
                  disabled={isPending}
                  className={`flex-1 px-4 py-2.5 border rounded-lg font-display font-semibold text-sm transition ${
                    confirmingAction === 'decline'
                      ? 'bg-terracotta text-paper border-terracotta'
                      : 'border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {confirmingAction === 'decline'
                    ? 'Eminsen tekrar tıkla'
                    : 'Reddet'}
                </button>
                <button
                  onClick={handleAccept}
                  disabled={isPending}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-display font-semibold text-sm text-white transition ${
                    confirmingAction === 'accept'
                      ? 'bg-[#142745] hover:bg-[#0d1d36]'
                      : 'bg-[#1E3A5F] hover:bg-[#142745]'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isPending && confirmingAction === 'accept'
                    ? 'Onaylanıyor...'
                    : confirmingAction === 'accept'
                      ? 'Eminsen tekrar tıkla'
                      : 'Onayla'}
                </button>
              </div>
            )}

            {canWithdraw && !canAccept && (
              <button
                onClick={handleWithdraw}
                disabled={isPending}
                className={`w-full px-4 py-2.5 border rounded-lg font-display font-semibold text-sm transition ${
                  confirmingAction === 'withdraw'
                    ? 'bg-terracotta text-paper border-terracotta'
                    : 'border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isPending && confirmingAction === 'withdraw'
                  ? 'Geri çekiliyor...'
                  : confirmingAction === 'withdraw'
                    ? 'Eminsen tekrar tıkla'
                    : 'Teklifi geri çek'}
              </button>
            )}
          </div>
        )}

        {/* Hem profesyonel hem müşteri için status açıklaması */}
        {!isPendingStatus && (
          <div className="border-t border-line/50 px-5 py-3 bg-paper/30">
            <p className="text-xs text-ink-72 text-center">
              {quote.status === 'accepted' &&
                (isMine
                  ? '🎉 Müşteri teklifi onayladı'
                  : 'Bu teklifi onayladın')}
              {quote.status === 'declined' &&
                (isMine ? 'Müşteri teklifi reddetti' : 'Bu teklifi reddettin')}
              {quote.status === 'expired' &&
                'Teklif onaylanmadan süresi doldu'}
              {quote.status === 'withdrawn' &&
                (isMine ? 'Teklifi geri çektin' : 'Profesyonel teklifi geri çekti')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Sistem mesajları için — sade, ortalı satır
 */
type SystemMessageProps = {
  body: string;
  createdAt: string;
};

export function SystemMessage({ body, createdAt }: SystemMessageProps) {
  const date = new Date(createdAt);
  const time = date.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex justify-center my-2">
      <p className="text-xs text-ink-72 font-mono">
        <span className="text-ink">{body}</span>
        <span className="mx-2 opacity-50">·</span>
        <span>{time}</span>
      </p>
    </div>
  );
}