'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Archetype } from '@/app/lib/category-fields';

export type HeroMedia = {
  id: string;
  type: 'image' | 'video';
  url: string;
  caption: string | null;
};

/**
 * Arketipe göre medya hero. Tüm tile'lar tıklamada SAYFA İÇİ lightbox açar
 * (yeni sekme YOK) — createPortal, z-[100], backdrop/Esc/ok tuşlarıyla gezinme.
 *  - sahne: video öncelikli sekmeler; foto sekmesi grid (lightbox'a bağlı)
 *  - cast / karikatürist: 1 büyük + 2 kare (sabit yükseklik, object-cover kırpma)
 *  - produksiyon: 4:3 grid; taşan adet son karede "+n" overlay
 * (uzmanlik'te hero yok — professional-profile summary bandını render eder.)
 */
export function ProfileMediaHero({
  items,
  archetype,
  useCastLayout = false,
}: {
  items: HeroMedia[];
  archetype: Archetype;
  useCastLayout?: boolean;
}) {
  const videos = items.filter((m) => m.type === 'video');
  const photos = items.filter((m) => m.type === 'image');

  const isSahne = archetype === 'sahne';
  const isCast = archetype === 'cast' || useCastLayout;
  const isProduksiyon = archetype === 'produksiyon';

  const [tab, setTab] = useState<'video' | 'foto'>(
    videos.length > 0 ? 'video' : 'foto'
  );
  const [activeVideo, setActiveVideo] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [lbIndex, setLbIndex] = useState<number | null>(null);

  const openById = (id: string) => {
    const idx = items.findIndex((m) => m.id === id);
    if (idx >= 0) setLbIndex(idx);
  };
  const lightbox =
    lbIndex !== null ? (
      <Lightbox
        items={items}
        index={lbIndex}
        onClose={() => setLbIndex(null)}
        onNav={(d) =>
          setLbIndex((i) =>
            i === null ? i : (i + d + items.length) % items.length
          )
        }
      />
    ) : null;

  // ---- SAHNE ----
  if (isSahne) {
    const showVideo = tab === 'video' && videos.length > 0;
    return (
      <section>
        {(videos.length > 0 || photos.length > 0) && (
          <div className="flex gap-2 mb-3">
            {videos.length > 0 && (
              <Pill active={tab === 'video'} onClick={() => setTab('video')}>
                Video ({videos.length})
              </Pill>
            )}
            {photos.length > 0 && (
              <Pill active={tab === 'foto'} onClick={() => setTab('foto')}>
                Fotoğraf ({photos.length})
              </Pill>
            )}
          </div>
        )}

        {showVideo ? (
          <>
            <div className="relative rounded-2xl overflow-hidden bg-[#DED7C6] aspect-video">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                key={videos[activeVideo]?.id}
                src={videos[activeVideo]?.url}
                controls
                preload="metadata"
                className="w-full h-full object-cover"
              />
            </div>
            {videos.length > 1 && (
              <div className="grid grid-cols-4 gap-2.5 mt-3">
                {videos.slice(0, 8).map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setActiveVideo(i)}
                    className={`relative h-[76px] rounded-lg overflow-hidden bg-[#E4DECF] flex items-center justify-center ${
                      i === activeVideo
                        ? 'outline outline-2 -outline-offset-2 outline-brand-ink'
                        : ''
                    }`}
                  >
                    <PlayGlyph small />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <PhotoGrid photos={photos} onOpen={openById} />
        )}
        {lightbox}
      </section>
    );
  }

  // ---- CAST: 1 büyük + 2 kare (sabit satır yüksekliği, object-cover) ----
  if (isCast) {
    const big = photos[0] ?? items[0] ?? null;
    const small1 = photos[1] ?? videos[0] ?? null;
    const small2 = photos[2] ?? videos[1] ?? videos[0] ?? null;
    return (
      <section>
        <div className="flex gap-3 items-stretch">
          <MediaTile
            media={big}
            onOpen={openById}
            className="flex-[1.7] rounded-2xl"
          />
          <div className="flex-1 flex flex-col gap-3">
            <MediaTile
              media={small1}
              onOpen={openById}
              className="aspect-square rounded-2xl"
            />
            <MediaTile
              media={small2}
              onOpen={openById}
              className="aspect-square rounded-2xl"
            />
          </div>
        </div>
        {expanded && items.length > 3 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3">
            {items.slice(3).map((m) => (
              <MediaTile
                key={m.id}
                media={m}
                onOpen={openById}
                className="aspect-square rounded-xl"
              />
            ))}
          </div>
        )}
        {items.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 text-sm font-display font-semibold text-brand-ink hover:text-brand-ink-deep transition-colors"
          >
            {expanded ? 'Daha az göster' : `Tüm medyayı gör (${items.length}) →`}
          </button>
        )}
        {lightbox}
      </section>
    );
  }

  // ---- PRODÜKSİYON: 4:3 grid, taşan adet "+n" overlay ----
  if (isProduksiyon) {
    const LIMIT = 6;
    const shown = items.slice(0, LIMIT);
    const extra = items.length - shown.length;
    return (
      <section>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {shown.map((m, i) => (
            <MediaTile
              key={m.id}
              media={m}
              onOpen={openById}
              className="aspect-[4/3] rounded-xl"
              overlayCount={i === shown.length - 1 && extra > 0 ? extra : 0}
            />
          ))}
        </div>
        {lightbox}
      </section>
    );
  }

  return null;
}

// =============================================================================
function Lightbox({
  items,
  index,
  onClose,
  onNav,
}: {
  items: HeroMedia[];
  index: number;
  onClose: () => void;
  onNav: (delta: number) => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onNav(-1);
      else if (e.key === 'ArrowRight') onNav(1);
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, onNav]);

  const m = items[index];
  if (!m) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/85 backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Kapat"
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNav(-1); }}
            aria-label="Önceki"
            className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNav(1); }}
            aria-label="Sonraki"
            className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </>
      )}

      <div
        className="relative max-w-5xl w-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {m.type === 'video' ? (
          /* eslint-disable-next-line jsx-a11y/media-has-caption */
          <video
            key={m.id}
            src={m.url}
            controls
            autoPlay
            className="max-h-[82vh] max-w-full rounded-lg bg-black"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={m.url}
            alt={m.caption ?? ''}
            className="max-h-[82vh] max-w-full rounded-lg object-contain"
          />
        )}
        {m.caption && (
          <div className="mt-3 text-sm text-white/80 text-center">{m.caption}</div>
        )}
      </div>
    </div>,
    document.body
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-xs font-display font-semibold transition-colors ${
        active
          ? 'bg-brand-ink text-white'
          : 'bg-card text-ink-72 border border-line hover:border-brand-ink'
      }`}
    >
      {children}
    </button>
  );
}

function PlayGlyph({ small = false }: { small?: boolean }) {
  const s = small ? 28 : 56;
  return (
    <span
      className="rounded-full bg-white/90 flex items-center justify-center shadow-md"
      style={{ width: s, height: s }}
    >
      <svg
        width={small ? 12 : 22}
        height={small ? 12 : 22}
        viewBox="0 0 24 24"
        fill="var(--color-brand-accent)"
        aria-hidden="true"
      >
        <path d="M8 5.5v13l11-6.5z" />
      </svg>
    </span>
  );
}

/** Tıklanabilir medya karesi — object-cover kırpma; video ise ilk-kare + play glyph. */
function MediaTile({
  media,
  className = '',
  onOpen,
  overlayCount = 0,
}: {
  media: HeroMedia | null;
  className?: string;
  onOpen?: (id: string) => void;
  overlayCount?: number;
}) {
  if (!media) {
    return <div className={`bg-[#E4DECF] ${className}`} aria-hidden="true" />;
  }
  return (
    <button
      type="button"
      onClick={() => onOpen?.(media.id)}
      aria-label={media.caption ?? 'Medyayı büyüt'}
      className={`group relative block overflow-hidden bg-[#E4DECF] ${className}`}
    >
      {media.type === 'video' ? (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={media.url}
            preload="metadata"
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <PlayGlyph />
          </span>
        </>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={media.url}
          alt={media.caption ?? ''}
          className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-[1.03]"
        />
      )}
      {overlayCount > 0 && (
        <span className="absolute inset-0 bg-ink/55 flex items-center justify-center font-display font-bold text-2xl text-white">
          +{overlayCount}
        </span>
      )}
    </button>
  );
}

/** Sahne foto sekmesi — 1 büyük + 4 kare, sabit yükseklik; taşan adet "+n". */
function PhotoGrid({
  photos,
  onOpen,
}: {
  photos: HeroMedia[];
  onOpen: (id: string) => void;
}) {
  const shown = photos.slice(0, 5);
  const extra = photos.length - shown.length;
  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-2.5 h-[320px]">
      {shown.map((p, i) => (
        <MediaTile
          key={p.id}
          media={p}
          onOpen={onOpen}
          className={`rounded-2xl ${i === 0 ? 'row-span-2' : ''}`}
          overlayCount={i === shown.length - 1 && extra > 0 ? extra : 0}
        />
      ))}
    </div>
  );
}
