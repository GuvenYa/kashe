'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createOrUpdateReview, deleteReview } from '@/app/yorumlar/actions';

type Props = {
  professionalId: string;
  professionalName: string;
  existingReview: {
    id: string;
    rating: number;
    body: string | null;
  } | null;
  open: boolean;
  onClose: () => void;
};

export function YorumModal({
  professionalId,
  professionalName,
  existingReview,
  open,
  onClose,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [rating, setRating] = useState<number>(existingReview?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [body, setBody] = useState<string>(existingReview?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Modal açılınca state'i mevcut yoruma göre sıfırla
  useEffect(() => {
    if (open) {
      setRating(existingReview?.rating ?? 0);
      setBody(existingReview?.body ?? '');
      setError(null);
      setConfirmDelete(false);
    }
  }, [open, existingReview]);

  // ESC ile kapat
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Body scroll kapatma
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (rating < 1) {
      setError('Lütfen bir puan seç (1-5 yıldız).');
      return;
    }

    startTransition(async () => {
      const result = await createOrUpdateReview({
        professionalId,
        rating,
        body: body.trim() || null,
      });

      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    if (!existingReview) return;
    setError(null);

    startDeleting(async () => {
      const result = await deleteReview(existingReview.id);
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  const isEditing = existingReview !== null;
  const displayRating = hoverRating > 0 ? hoverRating : rating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="yorum-modal-title"
    >
      <div
        className="bg-paper border border-line rounded-lg max-w-lg w-full p-6 md:p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="mb-6">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
            {isEditing ? 'Yorumu Düzenle' : 'Yorum Yaz'}
          </p>
          <h2
            id="yorum-modal-title"
            className="font-display text-2xl text-ink tracking-tight"
          >
            <em className="text-terracotta not-italic italic font-medium">
              {professionalName}
            </em>
            {' '}için deneyimini paylaş.
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
          {/* YILDIZ SEÇİMİ */}
          <div className="mb-6">
            <label className="block font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
              Puanın
            </label>
            <div
              className="flex items-center gap-1"
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  className="p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-terracotta/40 rounded"
                  aria-label={`${star} yıldız ver`}
                >
                  <Star filled={star <= displayRating} />
                </button>
              ))}
              {displayRating > 0 && (
                <span className="ml-3 font-display text-sm text-ink-72">
                  {displayRating} / 5
                </span>
              )}
            </div>
          </div>

          {/* METIN */}
          <div className="mb-6">
            <label
              htmlFor="review-body"
              className="block font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2"
            >
              Yaşadığın deneyim (opsiyonel)
            </label>
            <textarea
              id="review-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder="Profesyonelle nasıl bir deneyim yaşadın? Diğer müşterilere yardımcı olur."
              className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition resize-none text-sm leading-relaxed"
            />
            <p className="text-xs text-ink-72 mt-1.5 text-right">
              {body.length} / 1000
            </p>
          </div>

          {/* ERROR */}
          {error && (
            <p className="text-sm text-danger mb-4">{error}</p>
          )}

          {/* ACTIONS */}
          <div className="flex flex-col-reverse md:flex-row gap-3 md:items-center md:justify-between">
            {isEditing ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-2 text-xs font-mono uppercase tracking-[0.12em] text-terracotta border border-terracotta rounded hover:bg-terracotta hover:text-paper transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Siliniyor...' : 'Evet, sil'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isDeleting}
                    className="px-3 py-2 text-xs font-mono uppercase tracking-[0.12em] text-ink-72 hover:text-ink transition-colors"
                  >
                    Vazgeç
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs font-mono uppercase tracking-[0.12em] text-ink-72 hover:text-terracotta transition-colors self-start md:self-auto"
                >
                  Yorumu Sil
                </button>
              )
            ) : (
              <span />
            )}

            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending || isDeleting}
                className="px-4 py-2.5 text-sm font-display font-medium text-ink-72 hover:text-ink transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={isPending || isDeleting || rating < 1}
                className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isPending
                  ? '...'
                  : isEditing
                    ? 'Güncelle'
                    : 'Yorumu Gönder'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill={filled ? 'var(--color-plum)' : 'none'}
      stroke={filled ? 'var(--color-plum)' : 'var(--color-ink-72)'}
      strokeWidth="1.5"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );
}
