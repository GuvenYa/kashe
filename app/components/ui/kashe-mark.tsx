'use client';

import { useId } from 'react';

// Kashe işareti — Design V2 (mask'lı GERÇEK negatif-alan "k"). Daire boyanır,
// k şekilleri mask ile OYULUR (zemin görünür); mercan nokta kol ucunda, üstte.
// Inline SVG → her boyutta keskin, tema-farkında (variant).
type Variant = 'default' | 'dark' | 'mono';

const COLORS: Record<Variant, { circle: string; dot: string }> = {
  default: { circle: '#1F5C4A', dot: '#E2674A' }, // açık zeminler
  dark: { circle: '#F3EEE3', dot: '#E2674A' }, // koyu zeminler
  mono: { circle: '#141414', dot: '#141414' }, // tek renk / baskı
};

export function KasheMark({
  variant = 'default',
  className,
  title = 'Kashe',
}: {
  variant?: Variant;
  className?: string;
  title?: string;
}) {
  const c = COLORS[variant];
  // Aynı sayfada birden çok logo render edilebilir → mask id benzersiz olmalı.
  const maskId = 'kashe-k-' + useId().replace(/[^a-zA-Z0-9]/g, '');
  // Boş title → dekoratif (aria-hidden). Yanında görünür "Kashe" metni olan
  // kullanımlar (footer) böyle işaretlenir; standalone kullanımda etiketli kalır.
  const a11y = title
    ? { role: 'img' as const, 'aria-label': title }
    : { 'aria-hidden': true };
  return (
    <svg
      viewBox="0 0 96 96"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...a11y}
    >
      <defs>
        <mask id={maskId}>
          <circle cx="48" cy="48" r="44" fill="white" />
          <rect x="31" y="20" width="12" height="56" rx="2" fill="black" />
          <polygon points="47,44 60,16 82,28 54,52" fill="black" />
          <polygon points="47,49 76,71 67,83 47,61" fill="black" />
        </mask>
      </defs>
      <circle cx="48" cy="48" r="44" fill={c.circle} mask={`url(#${maskId})`} />
      <circle cx="71" cy="23" r="4.5" fill={c.dot} />
    </svg>
  );
}
