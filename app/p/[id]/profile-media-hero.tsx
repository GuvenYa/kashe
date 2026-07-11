'use client';

import { useState } from 'react';
import type { Archetype } from '@/app/lib/category-fields';

export type HeroMedia = {
  id: string;
  type: 'image' | 'video';
  url: string;
  caption: string | null;
};

/**
 * Arketipe göre medya hero:
 *  - sahne: video öncelikli, "Video (n) / Fotoğraf (n)" pil sekmeleri (video yoksa foto'ya düşer)
 *  - cast / karikaturist(portfolioGrid): 1 büyük + 2 küçük şerit + "Tüm medyayı gör (n)"
 *  - produksiyon: iş örnekleri grid'i
 * (uzmanlik'te hero yok — professional-profile summary bandını render eder.)
 */
export function ProfileMediaHero({
  items,
  archetype,
  useCastLayout = false,
}: {
  items: HeroMedia[];
  archetype: Archetype;
  /** karikaturist hibrit: uzmanlik ama cast hero'su */
  useCastLayout?: boolean;
}) {
  const videos = items.filter((m) => m.type === 'video');
  const photos = items.filter((m) => m.type === 'image');

  const isSahne = archetype === 'sahne';
  const isCast = archetype === 'cast' || useCastLayout;
  const isProduksiyon = archetype === 'produksiyon';

  // ---- SAHNE: sekmeli, video öncelikli ----
  const [tab, setTab] = useState<'video' | 'foto'>(
    videos.length > 0 ? 'video' : 'foto'
  );
  const [activeVideo, setActiveVideo] = useState(0);

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
                        ? 'outline outline-2 -outline-offset-2 outline-terracotta'
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
          <PhotoGrid photos={photos} />
        )}
      </section>
    );
  }

  // ---- CAST: 1 büyük + 2 küçük (biri varsa video) ----
  const [expanded, setExpanded] = useState(false);
  if (isCast) {
    const big = photos[0] ?? items[0] ?? null;
    const small1 = photos[1] ?? null;
    const small2 = videos[0] ?? photos[2] ?? null;
    return (
      <section>
        <div className="grid grid-cols-[1.6fr_1fr] gap-3 h-[400px]">
          <MediaTile media={big} className="rounded-2xl" />
          <div className="grid grid-rows-2 gap-3">
            <MediaTile media={small1} className="rounded-2xl" />
            <MediaTile media={small2} className="rounded-2xl" />
          </div>
        </div>
        {expanded && items.length > 3 && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            {items.slice(3).map((m) => (
              <MediaTile key={m.id} media={m} className="rounded-xl aspect-square" />
            ))}
          </div>
        )}
        {items.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 text-sm font-display font-semibold text-terracotta hover:text-ember transition-colors"
          >
            {expanded ? 'Daha az göster' : `Tüm medyayı gör (${items.length}) →`}
          </button>
        )}
      </section>
    );
  }

  // ---- PRODÜKSİYON: iş örnekleri grid ----
  if (isProduksiyon) {
    return (
      <section>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((m) => (
            <MediaTile key={m.id} media={m} className="rounded-xl aspect-[4/3]" />
          ))}
        </div>
      </section>
    );
  }

  return null;
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
          ? 'bg-terracotta text-white'
          : 'bg-card text-ink-72 border border-line hover:border-terracotta'
      }`}
    >
      {children}
    </button>
  );
}

function PlayGlyph({ small = false }: { small?: boolean }) {
  const s = small ? 28 : 68;
  return (
    <span
      className="rounded-full bg-white/90 flex items-center justify-center shadow-md"
      style={{ width: s, height: s }}
    >
      <svg
        width={small ? 12 : 24}
        height={small ? 12 : 24}
        viewBox="0 0 24 24"
        fill="var(--color-plum)"
        aria-hidden="true"
      >
        <path d="M8 5.5v13l11-6.5z" />
      </svg>
    </span>
  );
}

function MediaTile({
  media,
  className = '',
}: {
  media: HeroMedia | null;
  className?: string;
}) {
  if (!media) {
    return <div className={`bg-[#E4DECF] ${className}`} aria-hidden="true" />;
  }
  if (media.type === 'video') {
    return (
      <div className={`relative overflow-hidden bg-[#DED7C6] ${className}`}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={media.url}
          controls
          preload="metadata"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block overflow-hidden bg-[#E4DECF] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.url}
        alt={media.caption ?? ''}
        className="w-full h-full object-cover"
      />
    </a>
  );
}

function PhotoGrid({ photos }: { photos: HeroMedia[] }) {
  const shown = photos.slice(0, 5);
  const extra = photos.length - shown.length;
  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-2.5 h-[320px]">
      {shown.map((p, i) => (
        <a
          key={p.id}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`relative overflow-hidden rounded-2xl bg-[#E4DECF] ${
            i === 0 ? 'row-span-2' : ''
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt={p.caption ?? ''} className="w-full h-full object-cover" />
          {i === shown.length - 1 && extra > 0 && (
            <span className="absolute inset-0 bg-ink/55 flex items-center justify-center font-display font-bold text-2xl text-white">
              +{extra}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}
