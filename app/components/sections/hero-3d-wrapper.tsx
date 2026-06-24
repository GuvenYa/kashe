'use client';

import dynamic from 'next/dynamic';
import { HeroPlaceholder } from './hero-placeholder';

const Hero3D = dynamic(() => import('./hero-3d'), {
  ssr: false,
  loading: () => <HeroPlaceholder />, // nötr zemin (chunk + texture suspense boyunca)
});

export function Hero3DWrapper() {
  return <Hero3D />;
}
