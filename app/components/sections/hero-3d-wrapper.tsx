'use client';

import dynamic from 'next/dynamic';
import { HeroCollage } from './hero-collage';

const Hero3D = dynamic(() => import('./hero-3d'), {
  ssr: false,
  loading: () => <HeroCollage />,
});

export function Hero3DWrapper() {
  return <Hero3D />;
}
