'use client';

import { useState } from 'react';

/**
 * Kategori ikonu — /icons/<slug>.png yüklenemezse (dosya yok/kırık) baş harfe düşer.
 * getCategoryIcon her zaman bir path döndürdüğü için <img> onError fallback şart.
 */
export function CategoryIcon({
  src,
  name,
  initials,
}: {
  src: string;
  name: string;
  initials: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="font-display font-medium text-terracotta text-2xl">
        {initials}
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className="w-full h-full object-contain p-1 kashe-icon-pop"
    />
  );
}
