'use client';

import { useState } from 'react';

/**
 * Keşfet kart kapak görseli. src yoksa VEYA görsel yüklenemezse (onError) placeholder'a
 * düşer — böylece yanlış/eksik path'te kart beyaz kalmaz (koyu zümrüt + baş harfler).
 * onError bir client olay olduğundan bu küçük bileşen 'use client'.
 */
export function CoverMedia({
  src,
  alt,
  initials,
}: {
  src: string | null;
  alt: string;
  initials: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="absolute inset-0 bg-[#0D1F4E] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, rgba(255,255,255,0.10), rgba(255,255,255,0) 58%)',
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full ring-1 ring-white/15 bg-white/[0.03] flex items-center justify-center">
            <span className="font-display font-semibold text-3xl md:text-4xl text-[#EAF0F8]">
              {initials}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}
