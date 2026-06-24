'use client';

import { Component, useRef, useMemo, useEffect, useState } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { HeroCollage } from './hero-collage';

/* ─── Sahneler ─── */
const CARD_W = 1.1;
const CARD_H = 1.4;
const RADIUS = 1.8;
const Y_STEP = 0.55;
const CARD_COUNT = 10;

/* 5 gerçek görsel — 10 kart döngüyle */
const BASE_IMAGES = [
  '/images/hero-event.jpg',
  '/images/dj-mertkan.jpg',
  '/images/selin-aksoy.jpg',
  '/images/vibes-band.jpg',
  '/images/ece-yildiz.jpg',
] as const;

/* ─── Error Boundary: WebGL yoksa kolaj göster ─── */
class Hero3DErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(_: Error, __: ErrorInfo) {}
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/* ─── Tek kart mesh ─── */
function SpiralCard({
  texture,
  angle,
  yPos,
  index,
}: {
  texture: THREE.Texture;
  angle: number;
  yPos: number;
  index: number;
}) {
  const x = Math.sin(angle) * RADIUS;
  const z = Math.cos(angle) * RADIUS;
  const rotY = angle + Math.PI; // dışa bak (merkeze ters)

  /* Derinlik hissi: arka kartlar soluk + küçük */
  const depthFactor = (Math.cos(angle) + 1) / 2; // 0..1
  const opacity = 0.5 + depthFactor * 0.5;
  const scale = 0.8 + depthFactor * 0.2;

  const imgMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity,
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, opacity]);

  const borderMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: Math.min(opacity * 0.95, 1),
      }),
    [opacity]
  );

  return (
    <group position={[x, yPos, z]} rotation={[0, rotY, 0]} scale={scale}>
      {/* Beyaz çerçeve */}
      <mesh renderOrder={index}>
        <planeGeometry args={[CARD_W + 0.08, CARD_H + 0.08]} />
        <primitive object={borderMat} attach="material" />
      </mesh>
      {/* Fotoğraf — çerçevenin 1mm önünde */}
      <mesh renderOrder={index + 100} position={[0, 0, 0.002]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <primitive object={imgMat} attach="material" />
      </mesh>
    </group>
  );
}

/* ─── Spiral grup + animasyon ─── */
function SpiralScene({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);
  const mouseRef = useRef({ x: 0, y: 0 });
  const tiltRef = useRef({ x: 0, y: 0 });

  /* Sadece 5 benzersiz texture yükle */
  const baseTextures = useTexture([...BASE_IMAGES]);

  /* Textures optimize — büyük görseller için mipmap kapat */
  useMemo(() => {
    const arr = Array.isArray(baseTextures) ? baseTextures : [baseTextures];
    arr.forEach((t) => {
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
    });
  }, [baseTextures]);

  /* 10 kart — 5 texture döngüyle */
  const cards = useMemo(() => {
    const texArr = Array.isArray(baseTextures) ? baseTextures : [baseTextures];
    return Array.from({ length: CARD_COUNT }, (_, i) => {
      const t = i / (CARD_COUNT - 1);
      const angle = t * Math.PI * 2;
      const yPos = (i - (CARD_COUNT - 1) / 2) * Y_STEP;
      return { angle, yPos, texture: texArr[i % texArr.length] };
    });
  }, [baseTextures]);

  /* Fare parallax */
  useEffect(() => {
    if (reducedMotion) return;
    const onMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: -(e.clientY / window.innerHeight - 0.5) * 2,
      };
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [reducedMotion]);

  useFrame((_, delta) => {
    if (!groupRef.current || reducedMotion) return;

    /* Auto-rotate Y */
    groupRef.current.rotation.y += delta * 0.15;

    /* Smooth parallax tilt */
    tiltRef.current.x += (mouseRef.current.y * 0.12 - tiltRef.current.x) * 0.05;
    tiltRef.current.y += (mouseRef.current.x * 0.08 - tiltRef.current.y) * 0.05;
    groupRef.current.rotation.x = tiltRef.current.x;
  });

  return (
    <group ref={groupRef}>
      {cards.map((card, i) => (
        <SpiralCard
          key={i}
          index={i}
          texture={card.texture}
          angle={card.angle}
          yPos={card.yPos}
        />
      ))}
    </group>
  );
}

/* ─── Canvas ─── */
function Hero3DCanvas({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={reducedMotion ? 'demand' : 'always'}
      camera={{ fov: 35, position: [0, 0, 6] }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      gl={{ alpha: true, antialias: false }}
    >
      <fog attach="fog" args={['#fbf8f4', 8, 14]} />
      <ambientLight intensity={1} />
      <SpiralScene reducedMotion={reducedMotion} />
    </Canvas>
  );
}

/* ─── ★4.9 mercan rozeti ─── */
function CoralBadge() {
  return (
    <div
      style={{
        position: 'absolute',
        top: '-14px',
        right: '-14px',
        background: 'var(--color-plum)',
        color: '#fff',
        width: '84px',
        height: '84px',
        borderRadius: '50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'rotate(8deg)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        zIndex: 10,
        fontFamily: 'var(--font-display)',
      }}
    >
      <span style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1 }}>★4.9</span>
      <small style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '3px' }}>
        puan
      </small>
    </div>
  );
}

/* ─── Dışa aktarılan bileşen ─── */
export default function Hero3D() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="relative" style={{ height: '540px' }}>
      {/* Zümrüt zemin gradyanı */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(31,92,74,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <CoralBadge />

      <Hero3DErrorBoundary fallback={<HeroCollage />}>
        <Hero3DCanvas reducedMotion={reducedMotion} />
      </Hero3DErrorBoundary>
    </div>
  );
}
