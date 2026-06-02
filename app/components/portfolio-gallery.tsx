'use client';

import { useState } from 'react';
import { MediaLightbox, type LightboxMedia } from '@/app/components/media-lightbox';

type PortfolioMedia = {
  id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
};

type Props = {
  items: PortfolioMedia[];
  /** Tailwind grid sınıfları — sayfaya göre değişir */
  gridClassName?: string;
};

/**
 * Salt-görüntüleme portföy galerisi (profil + profil detay).
 * Resim ve video destekler, tıklayınca çoklu-gezinmeli lightbox açar.
 */
export function PortfolioGallery({
  items,
  gridClassName = 'grid grid-cols-2 md:grid-cols-4 gap-3',
}: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  const lightboxItems: LightboxMedia[] = items.map((item) => ({
    url: item.media_url,
    type: item.media_type === 'video' ? 'video' : 'image',
    caption: item.caption,
  }));

  return (
    <>
      <div className={gridClassName}>
        {items.map((item, i) => {
          const isVideo = item.media_type === 'video';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="aspect-square bg-paper rounded-lg overflow-hidden border border-line relative group"
              aria-label="Büyüt"
            >
              {isVideo ? (
                <>
                  <video
                    src={item.media_url}
                    className="w-full h-full object-cover pointer-events-none"
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="w-11 h-11 rounded-full bg-ink/60 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-paper)" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </span>
                </>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.media_url}
                  alt={item.caption || 'Portfolio'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              )}
            </button>
          );
        })}
      </div>

      <MediaLightbox
        items={lightboxItems}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onNavigate={setOpenIndex}
      />
    </>
  );
}
