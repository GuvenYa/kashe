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

  // Status rozeti — Kashe paletinde
  const badgeStyles: Record<typeof tone, string> = {
    pending:
      'bg-terracotta-08 text-terracotta border-terracotta/30',
    success: 'bg-moss/10 text-moss border-moss/30',
    danger: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
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
      <div className="bg-card border border-line rounded-2xl overflow-hidden shadow-[0_4px_18px_-8px_rgba(26,18,14,0.15)]">
        {/* Header — Kashe terracotta accent */}
        <div className="bg-terracotta-08 border-b border-terracotta/15 px-5 py-3 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta font-semibold">
            Teklif
          </p>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.12em] font-medium border ${badgeStyles[tone]}`}
          >
            {getQuoteStatusLabel(quote.status)}
          </span>
        </div>

        {/* Fiyat */}
        <div className="px-5 pt-5 pb-3">
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-72 mb-1">
            Toplam
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-display text-3xl text-ink font-medium tracking-tight">
              {formatQuoteAmount(quote.total_amount, quote.currency)}
            </p>
            {quote.over_budget && (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border text-plum bg-plum/10 border-plum/30">
                Bütçe üstü
              </span>
            )}
          </div>
        </div>

        {/* Hizmet kapsamı */}
        <div className="px-5 pb-4">
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-72 mb-1.5">
            Hizmet kapsamı
          </p>
          <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
            {quote.services_description}
          </p>
        </div>

        {/* İptal politikası (varsa) */}
        {quote.cancellation_policy && (
          <details className="px-5 pb-4 group">
            <summary className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-72 cursor-pointer hover:text-terracotta transition list-none flex items-center gap-1.5">
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
        <div className="px-5 pb-4 border-t border-line pt-3">
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-72 mb-1">
            Geçerlilik
          </p>
          {isPendingStatus ? (
            <>
              <p className="text-base text-ink font-medium">
                {formatExpiresIn(quote.expires_at)}
              </p>
              <p className="text-[10px] text-ink-50 font-mono mt-0.5">
                {expiresFormatted}
              </p>
            </>
          ) : (
            <p className="text-xs text-ink-50 font-mono">{expiresFormatted}</p>
          )}
        </div>

        {error && (
          <div className="mx-5 mb-3 bg-danger-08 border border-danger/30 text-danger text-xs rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Aksiyonlar */}
        {(canAccept || canWithdraw) && (
          <div className="border-t border-line p-3 bg-paper-2/60">
            {canAccept && (
              <div className="flex gap-2">
                <button
                  onClick={handleDecline}
                  disabled={isPending}
                  className={`kashe-tap flex-1 px-4 py-2.5 border rounded-xl font-display font-semibold text-sm transition ${
                    confirmingAction === 'decline'
                      ? 'bg-terracotta text-paper border-terracotta'
                      : 'bg-card border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {confirmingAction === 'decline'
                    ? 'Eminsen tekrar tıkla'
                    : 'Reddet'}
                </button>
                <button
                  onClick={handleAccept}
                  disabled={isPending}
                  className={`kashe-tap flex-1 px-4 py-2.5 rounded-xl font-display font-semibold text-sm text-paper transition ${
                    confirmingAction === 'accept'
                      ? 'bg-ink hover:bg-ink/90 shadow-[3px_3px_0_var(--color-terracotta-12)]'
                      : 'bg-ink hover:bg-ink/90'
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
                className={`kashe-tap w-full px-4 py-2.5 border rounded-xl font-display font-semibold text-sm transition ${
                  confirmingAction === 'withdraw'
                    ? 'bg-terracotta text-paper border-terracotta'
                    : 'bg-card border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
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

        {/* Status açıklaması — emoji yok, sade */}
        {!isPendingStatus && (
          <div className="border-t border-line px-5 py-3 bg-paper-2/60">
            <p className="text-xs text-ink-72 text-center flex items-center justify-center gap-1.5">
              {quote.status === 'accepted' && (
                <>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12l4 4 10-10"
                      stroke="var(--color-moss)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-moss font-medium">
                    {isMine ? 'Müşteri teklifi onayladı' : 'Bu teklifi onayladın'}
                  </span>
                </>
              )}
              {quote.status === 'declined' && (
                <span>
                  {isMine
                    ? 'Müşteri teklifi reddetti'
                    : 'Bu teklifi reddettin'}
                </span>
              )}
              {quote.status === 'expired' && (
                <span>Teklif onaylanmadan süresi doldu</span>
              )}
              {quote.status === 'withdrawn' && (
                <span>
                  {isMine
                    ? 'Teklifi geri çektin'
                    : 'Profesyonel teklifi geri çekti'}
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Sistem mesajları — zarif pill, ortalı
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
    <div className="flex justify-center my-3">
      <span className="inline-flex items-center gap-2 bg-line/50 border border-line/60 px-3.5 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] text-ink-72">
        <span className="text-ink">{body}</span>
        <span className="w-1 h-1 rounded-full bg-ink-50" aria-hidden="true" />
        <span>{time}</span>
      </span>
    </div>
  );
}
