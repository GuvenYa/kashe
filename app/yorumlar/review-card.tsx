import Link from 'next/link';
import { ReplyButton } from './reply-button';
import { SikayetButton } from '@/app/sikayet/sikayet-button';

type Customer = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type Reply = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  review: {
    id: string;
    rating: number;
    body: string | null;
    created_at: string;
  };
  customer: Customer | null;
  reply: Reply | null;
  /** Mevcut kullanıcı bu yorumun ait olduğu profesyonel mi?
   *  True ise "Yanıtla / Yanıtı düzenle" butonu görünür. */
  isOwnedByProfessional: boolean;
  /** Şikayet butonu için giriş durumu */
  isLoggedIn?: boolean;
};

function formatReviewDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ReviewCard({
  review,
  customer,
  reply,
  isOwnedByProfessional,
  isLoggedIn = false,
}: Props) {
  const customerName = customer?.full_name ?? 'İsimsiz';

  const initials = customerName
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <article className="bg-card border border-line rounded-lg p-6">
      {/* HEADER: avatar + isim + tarih + yıldız */}
      <header className="flex items-start gap-4 mb-4">
        {customer?.avatar_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={customer.avatar_url}
            alt={customerName}
            className="w-12 h-12 rounded-full object-cover border border-line shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-brand-ink flex items-center justify-center text-paper font-display font-semibold shrink-0">
            {initials || 'K'}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {customer ? (
              <Link
                href={`/p/${customer.id}`}
                className="font-display font-semibold text-ink hover:text-brand-ink transition-colors truncate"
              >
                {customerName}
              </Link>
            ) : (
              <p className="font-display font-semibold text-ink truncate">
                {customerName}
              </p>
            )}
            <div className="flex items-center gap-2 shrink-0">
              <p className="text-xs text-ink-72 font-mono uppercase tracking-[0.12em]">
                {formatReviewDate(review.created_at)}
              </p>
              <SikayetButton
                targetType="review"
                targetId={review.id}
                isLoggedIn={isLoggedIn}
                variant="icon"
              />
            </div>
          </div>

          <StarDisplay rating={review.rating} />
        </div>
      </header>

      {/* YORUM METNİ */}
      {review.body && (
        <p className="text-ink leading-relaxed whitespace-pre-wrap break-words">
          {review.body}
        </p>
      )}

      {/* PROFESYONEL YANITI */}
      {reply && (
        <div className="mt-5 pl-5 border-l-2 border-brand-ink/40">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-brand-ink mb-2">
            Profesyonelin yanıtı · {formatReviewDate(reply.created_at)}
          </p>
          <p className="text-sm text-ink-72 leading-relaxed whitespace-pre-wrap break-words">
            {reply.body}
          </p>
        </div>
      )}

      {/* PROFESYONEL YANIT BUTONU */}
      {isOwnedByProfessional && (
        <div className="mt-4 pt-4 border-t border-line">
          <ReplyButton
            reviewId={review.id}
            existingReply={
              reply
                ? { id: reply.id, body: reply.body }
                : null
            }
          />
        </div>
      )}
    </article>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-0.5 mt-1"
      aria-label={`${rating} yıldız`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} filled={star <= rating} />
      ))}
    </div>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'var(--color-brand-accent)' : 'none'}
      stroke={filled ? 'var(--color-brand-accent)' : 'var(--color-ink-72)'}
      strokeWidth="1.5"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );
}
