'use client';

import { useEffect, useCallback } from 'react';

export type LightboxMedia = {
  url: string;
  type: 'image' | 'video';
  caption?: string | null;
};

type Props = {
  items: LightboxMedia[];
  /** Açık olan öğenin index'i; null ise kapalı */
  index: number | null;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
};

/**
 * Ortak medya lightbox. Resim ve video destekler.
 * Profil portföyü, mesaj ekleri, başvuru ekleri gibi her yerde kullanılır.
 */
export function MediaLightbox({ items, index, onClose, onNavigate }: Props) {
  const isOpen = index !== null && index >= 0 && index < items.length;

  const goPrev = useCallback(() => {
    if (index === null) return;
    onNavigate((index - 1 + items.length) % items.length);
  }, [index, items.length, onNavigate]);

  const goNext = useCallback(() => {
    if (index === null) return;
    onNavigate((index + 1) % items.length);
  }, [index, items.length, onNavigate]);

  // Klavye: ESC kapat, ok tuşları gezin
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, goPrev, goNext]);

  if (!isOpen || index === null) return null;

  const current = items[index];
  const hasMultiple = items.length > 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/85 backdrop-blur-sm p-4 md:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Kapat */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Kapat"
        className="absolute top-4 right-4 md:top-6 md:right-6 w-11 h-11 flex items-center justify-center rounded-full bg-paper/10 hover:bg-paper/20 text-paper text-2xl leading-none transition z-10"
      >
        ×
      </button>

      {/* Önceki */}
      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Önceki"
          className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-paper/10 hover:bg-paper/20 text-paper transition z-10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Sonraki */}
      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Sonraki"
          className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-paper/10 hover:bg-paper/20 text-paper transition z-10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* İçerik */}
      <div
        className="max-w-5xl w-full max-h-full flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {current.type === 'video' ? (
          <video
            src={current.url}
            controls
            autoPlay
            className="max-w-full max-h-[80vh] rounded-lg"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={current.url}
            alt={current.caption || 'Medya'}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
        )}

        {current.caption && (
          <p className="text-paper/80 text-sm mt-4 text-center max-w-2xl">
            {current.caption}
          </p>
        )}

        {hasMultiple && (
          <p className="text-paper/50 font-mono text-xs uppercase tracking-[0.16em] mt-3">
            {index + 1} / {items.length}
          </p>
        )}
      </div>
    </div>
  );
}
