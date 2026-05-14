'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deletePortfolioItem, updatePortfolioCaption } from './actions';
import type { PortfolioItem } from '@/app/lib/types';

type Props = {
  item: PortfolioItem;
};

export function PortfolioItemCard({ item }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingCaption, setEditingCaption] = useState(false);
  const [caption, setCaption] = useState(item.caption || '');
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm('Bu fotoğrafı silmek istediğine emin misin?')) return;
    setError(null);
    startTransition(async () => {
      const result = await deletePortfolioItem(item.id);
      if (!result.success) setError(result.error || 'Hata');
      else router.refresh();
    });
  }

  function handleSaveCaption() {
    setError(null);
    startTransition(async () => {
      const result = await updatePortfolioCaption(item.id, caption);
      if (!result.success) {
        setError(result.error || 'Hata');
      } else {
        setEditingCaption(false);
        router.refresh();
      }
    });
  }

  function handleCancelCaption() {
    setCaption(item.caption || '');
    setEditingCaption(false);
    setError(null);
  }

  return (
    <div className="group relative bg-white border border-line rounded-lg overflow-hidden">
      <div className="aspect-square bg-paper relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.media_url}
          alt={item.caption || 'Portfolio'}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Hover overlay - sil butonu */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="absolute top-3 right-3 w-9 h-9 bg-ink/70 hover:bg-terracotta text-paper rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 flex items-center justify-center"
          title="Sil"
          aria-label="Fotoğrafı sil"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4H13M6 4V3C6 2.4 6.4 2 7 2H9C9.6 2 10 2.4 10 3V4M11 4V13C11 13.6 10.6 14 10 14H6C5.4 14 5 13.6 5 13V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        {editingCaption ? (
          <div className="space-y-2">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
              autoFocus
              className="w-full px-3 py-2 bg-paper border border-line rounded text-sm text-ink focus:outline-none focus:border-terracotta transition"
              placeholder="Açıklama ekle (opsiyonel)"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveCaption}
                disabled={isPending}
                className="text-xs text-terracotta hover:underline disabled:opacity-50"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={handleCancelCaption}
                disabled={isPending}
                className="text-xs text-ink-72 hover:text-ink disabled:opacity-50"
              >
                İptal
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingCaption(true)}
            className="block w-full text-left text-sm text-ink-72 hover:text-ink transition-colors"
          >
            {item.caption || (
              <span className="italic text-ink-72/60">+ Açıklama ekle</span>
            )}
          </button>
        )}

        {error && (
          <p className="text-xs text-terracotta mt-2">{error}</p>
        )}
      </div>
    </div>
  );
}