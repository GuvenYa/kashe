'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createOrUpdateReply, deleteReply } from '@/app/yorumlar/actions';

type Props = {
  reviewId: string;
  existingReply: {
    id: string;
    body: string;
  } | null;
};

export function ReplyButton({ reviewId, existingReply }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="text-xs font-mono uppercase tracking-[0.12em] text-brand-ink hover:text-ink transition-colors"
      >
        {existingReply ? 'Yanıtı düzenle' : 'Yanıtla'}
      </button>

      <ReplyModal
        reviewId={reviewId}
        existingReply={existingReply}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

type ModalProps = {
  reviewId: string;
  existingReply: { id: string; body: string } | null;
  open: boolean;
  onClose: () => void;
};

function ReplyModal({ reviewId, existingReply, open, onClose }: ModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [body, setBody] = useState<string>(existingReply?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setBody(existingReply?.body ?? '');
      setError(null);
      setConfirmDelete(false);
    }
  }, [open, existingReply]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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

    const trimmed = body.trim();
    if (trimmed.length === 0) {
      setError('Yanıt boş olamaz.');
      return;
    }

    startTransition(async () => {
      const result = await createOrUpdateReply({
        reviewId,
        body: trimmed,
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
    if (!existingReply) return;
    setError(null);

    startDeleting(async () => {
      const result = await deleteReply(reviewId);
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  const isEditing = existingReply !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-paper border border-line rounded-lg max-w-lg w-full max-h-[90dvh] overflow-y-auto p-6 md:p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
            {isEditing ? 'Yanıtı Düzenle' : 'Yoruma Yanıt'}
          </p>
          <h2 className="font-display text-2xl text-ink tracking-tight">
            Müşteriye{' '}
            <em className="text-brand-ink not-italic italic font-medium">
              yanıt ver
            </em>
            .
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={5}
            placeholder="Müşterine bir teşekkür et veya yorumuna açıklama getir..."
            className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition resize-none text-sm leading-relaxed"
          />
          <p className="text-xs text-ink-72 mt-1.5 text-right mb-4">
            {body.length} / 1000
          </p>

          {error && (
            <p className="text-sm text-danger mb-4">{error}</p>
          )}

          <div className="flex flex-col-reverse md:flex-row gap-3 md:items-center md:justify-between">
            {isEditing ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-2 text-xs font-mono uppercase tracking-[0.12em] text-brand-ink border border-brand-ink rounded hover:bg-brand-ink hover:text-paper transition-colors disabled:opacity-50"
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
                  className="text-xs font-mono uppercase tracking-[0.12em] text-ink-72 hover:text-brand-ink transition-colors self-start md:self-auto"
                >
                  Yanıtı Sil
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
                disabled={isPending || isDeleting || body.trim().length === 0}
                className="px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-brand-ink)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isPending ? '...' : isEditing ? 'Güncelle' : 'Yanıtı Gönder'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
