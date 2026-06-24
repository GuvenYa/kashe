'use client';

import { Component, useRef, useMemo, useEffect, useState, useCallback } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { HeroCollage } from './hero-collage';

/* Hover etiketi için kart meta: kategori adı + keşfet arama terimi.
   NOT: /kesfet 'kategori' param'ı NUMERIC ID ister (slug değil). Bu yüzden
   click-through 'q' (metin arama) kullanır — q, kategori adını (name_tr) de
   arar, böylece doğru filtreli sayfaya gider. */
type CardMeta = { src: string; kategori: string; q: string };

/* ─── LAYOUT: satırlı huni-davul (ref: studiodialect) ─── */
const LAYOUT = 'sik' as 'sik' | 'ferah'; // tek sabitle anında geçiş

const PRESETS = {
  // kenar-kenara KAPALI duvar, referans yoğunluğu
  sik: {
    ROWS: 4, COLS: 16, ROW_GAP: 1.25, ANGLE_OFFSET: 0.28,
    RADIUS_TOP: 3.1, RADIUS_BOTTOM: 2.6, FILL: 1.03,
    CAM_Z: 8.5, FOG_NEAR: 7.5, FOG_FAR: 13,
  },
  // biraz daha ferah ama yine kapalı duvar
  ferah: {
    ROWS: 3, COLS: 9, ROW_GAP: 1.45, ANGLE_OFFSET: 0.4,
    RADIUS_TOP: 3.3, RADIUS_BOTTOM: 2.6, FILL: 1.0,
    CAM_Z: 8, FOG_NEAR: 7, FOG_FAR: 12.5,
  },
} as const;

const P = PRESETS[LAYOUT];
const {
  ROWS, COLS, ROW_GAP, ANGLE_OFFSET,
  RADIUS_TOP, RADIUS_BOTTOM, FILL,
  CAM_Z, FOG_NEAR, FOG_FAR,
} = P;

const ASPECT = 1.25;         // kart oran (h = w × 1.25) → 4:5
const BASE_TILT_X = 0.12;    // taban tilt — neredeyse göz hizası (top değil duvar)
const FOV = 42;              // kamera görüş açısı
const BORDER = 0.025;        // beyaz bordür kalınlığı (her kenar — ince polaroid)

/* Ortası delik beyaz çerçeve — fotoğrafla ÇAKIŞMAZ, iki yüzden de doğru görünür.
   Boyut artık per-row türetildiği için satır başına bir geo üretilir. */
function makeFrameGeo(cardW: number, cardH: number) {
  const FW = cardW + BORDER * 2;
  const FH = cardH + BORDER * 2;
  const shape = new THREE.Shape();
  shape.moveTo(-FW / 2, -FH / 2);
  shape.lineTo(FW / 2, -FH / 2);
  shape.lineTo(FW / 2, FH / 2);
  shape.lineTo(-FW / 2, FH / 2);
  shape.lineTo(-FW / 2, -FH / 2);
  const hole = new THREE.Path();
  hole.moveTo(-cardW / 2, -cardH / 2);
  hole.lineTo(cardW / 2, -cardH / 2);
  hole.lineTo(cardW / 2, cardH / 2);
  hole.lineTo(-cardW / 2, cardH / 2);
  hole.lineTo(-cardW / 2, -cardH / 2);
  shape.holes.push(hole);
  return new THREE.ShapeGeometry(shape);
}

/* 17 optimize WEBP + kategori meta — ROWS×COLS karta serpiştirilir */
const BASE_IMAGES: CardMeta[] = [
  { src: '/images/hero/dj-mertkan.webp', kategori: 'DJ Performans', q: 'DJ' },
  { src: '/images/hero/ece-yildiz.webp', kategori: 'Fotoğraf & Video', q: 'Fotoğraf' },
  { src: '/images/hero/hero-event.webp', kategori: 'Müzik & Etkinlik', q: 'Müzik' },
  { src: '/images/hero/selin-aksoy.webp', kategori: 'Fotoğraf & Video', q: 'Fotoğraf' },
  { src: '/images/hero/vibes-band.webp', kategori: 'Müzik & Etkinlik', q: 'Müzik' },
  { src: '/images/hero/dans-01.webp', kategori: 'Dans & Şov', q: 'Dans' },
  { src: '/images/hero/dj-02.webp', kategori: 'DJ Performans', q: 'DJ' },
  { src: '/images/hero/dugun-01.webp', kategori: 'Düğün Fotoğrafçılığı', q: 'Düğün' },
  { src: '/images/hero/dugun-02.webp', kategori: 'Düğün Fotoğrafçılığı', q: 'Düğün' },
  { src: '/images/hero/isik-01.webp', kategori: 'Sahne & Işık', q: 'Işık' },
  { src: '/images/hero/konser-01.webp', kategori: 'Konser & Sahne', q: 'Konser' },
  { src: '/images/hero/konser-02.webp', kategori: 'Konser & Sahne', q: 'Konser' },
  { src: '/images/hero/parti-01.webp', kategori: 'Parti & Kutlama', q: 'Parti' },
  { src: '/images/hero/parti-02.webp', kategori: 'Parti & Kutlama', q: 'Parti' },
  { src: '/images/hero/parti-03.webp', kategori: 'Parti & Kutlama', q: 'Parti' },
  { src: '/images/hero/sahne-01.webp', kategori: 'Konser & Sahne', q: 'Konser' },
  { src: '/images/hero/sahne-02.webp', kategori: 'Konser & Sahne', q: 'Konser' },
];
const IMAGE_SRCS = BASE_IMAGES.map((b) => b.src);

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
  radius,
  cardW,
  cardH,
  frameGeo,
  meta,
  index,
  hovered,
  onOver,
  onOut,
  onClick,
}: {
  texture: THREE.Texture;
  angle: number;
  yPos: number;
  radius: number;
  cardW: number;
  cardH: number;
  frameGeo: THREE.ShapeGeometry;
  meta: CardMeta;
  index: number;
  hovered: boolean;
  onOver: (meta: CardMeta, clientX: number, clientY: number) => void;
  onOut: () => void;
  onClick: (meta: CardMeta) => void;
}) {
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius;
  const rotY = angle + Math.PI; // tanjant: radyal dışa bakış (duvar)

  /* Derinlik hissi: scale ile (geniş aralık → arka kartlar küçük kalır, temiz derinlik) */
  const depthFactor = (Math.cos(angle) + 1) / 2; // 0..1
  const baseScale = 0.72 + depthFactor * 0.33; // 0.72 (arka) → 1.05 (ön)
  const scale = hovered ? baseScale * 1.05 : baseScale; // hover'da ince vurgu

  const imgMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: false, // OPAK → depthWrite güvenilir, polygonOffset düzgün
      opacity: 1,
      depthWrite: true,
      toneMapped: false, // ACES tone mapping'i kapat → renkler canlı
      side: THREE.DoubleSide, // tüpün içi + dışı texture gösterir
    });
    return m;
  }, [texture]);

  const borderMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: false,
        opacity: 1,
        depthWrite: true,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    []
  );

  return (
    <group
      position={[x, yPos, z]}
      rotation={[0, rotY, 0]}
      scale={scale}
      onPointerOver={(e) => {
        e.stopPropagation();
        onOver(meta, e.nativeEvent.clientX, e.nativeEvent.clientY);
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        onOver(meta, e.nativeEvent.clientX, e.nativeEvent.clientY); // pill imleci takip eder
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onOut();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(meta);
      }}
    >
      {/* Ortası delik beyaz çerçeve — doğal depth sıralaması (manuel renderOrder yok) */}
      <mesh geometry={frameGeo}>
        <primitive object={borderMat} attach="material" />
      </mesh>
      {/* Fotoğraf — delik iç ölçüsünün %99'u (ince hairline bordür payı, taşma yok),
          deliğin hafif gerisinde (-0.006). Doğal depth → öne fırlamaz. */}
      <mesh position={[0, 0, -0.006]}>
        <planeGeometry args={[cardW * 0.99, cardH * 0.99]} />
        <primitive object={imgMat} attach="material" />
      </mesh>
    </group>
  );
}

/* ─── Spiral grup + animasyon ─── */
function SpiralScene({
  reducedMotion,
  onHover,
  onHoverOut,
  onPick,
}: {
  reducedMotion: boolean;
  onHover: (meta: CardMeta, clientX: number, clientY: number) => void;
  onHoverOut: () => void;
  onPick: (meta: CardMeta) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const mouseRef = useRef({ x: 0, y: 0 });
  const tiltRef = useRef({ x: 0, y: 0 });
  const spinVelRef = useRef(0); // scroll-itme ivmesi (sönümlü)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const { gl } = useThree();

  /* 17 benzersiz texture yükle */
  const baseTextures = useTexture(IMAGE_SRCS);

  /* Textures optimize — mipmap kapat + sRGB renk uzayı (canlı renk) */
  useMemo(() => {
    const arr = Array.isArray(baseTextures) ? baseTextures : [baseTextures];
    arr.forEach((t) => {
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace;
    });
  }, [baseTextures]);

  /* SATIRLI KAPALI DAVUL DUVARI: ROWS satır × COLS sütun.
     Kart genişliği her satırın ÇEVRESİNDEN türetilir → kenar-kenara kapalı duvar:
       cardW = (2π·rowRadius / COLS) × FILL  (FILL>1 → komşular azıcık örter, delik yok)
       cardH = cardW × ASPECT (4:5)
     Üst satır geniş yarıçap → geniş kartlar; alt dar → küçük (huni doğal).
     Texture stride (7, 17 ile asal) → yan yana/alt alta aynı görsel gelmez. */
  const cards = useMemo(() => {
    const texArr = Array.isArray(baseTextures) ? baseTextures : [baseTextures];
    const len = texArr.length;
    const out: {
      angle: number;
      yPos: number;
      radius: number;
      cardW: number;
      cardH: number;
      frameGeo: THREE.ShapeGeometry;
      texture: THREE.Texture;
      meta: CardMeta;
    }[] = [];
    let k = 0;
    for (let r = 0; r < ROWS; r++) {
      const rowT = ROWS > 1 ? r / (ROWS - 1) : 0;
      const rowRadius = THREE.MathUtils.lerp(RADIUS_TOP, RADIUS_BOTTOM, rowT);
      const circumference = 2 * Math.PI * rowRadius;
      const cardW = (circumference / COLS) * FILL;
      const cardH = cardW * ASPECT;
      const frameGeo = makeFrameGeo(cardW, cardH); // satır başına bir geo
      const rowY = ((ROWS - 1) / 2) * ROW_GAP - r * ROW_GAP; // üstten alta, 0 merkezli
      for (let c = 0; c < COLS; c++) {
        const angle = (c / COLS) * Math.PI * 2 + r * ANGLE_OFFSET;
        const imgIndex = (k * 7) % len; // texture + meta aynı indeksten
        out.push({
          angle,
          yPos: rowY,
          radius: rowRadius,
          cardW,
          cardH,
          frameGeo,
          texture: texArr[imgIndex],
          meta: BASE_IMAGES[imgIndex],
        });
        k++;
      }
    }
    return out;
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

  /* Scroll-itme: tekerlek → dönüş ivmesi (sayfa scroll'unu ELE GEÇİRMEZ) */
  useEffect(() => {
    if (reducedMotion) return;
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      spinVelRef.current = THREE.MathUtils.clamp(
        spinVelRef.current + e.deltaY * 0.0008,
        -0.5,
        0.5
      );
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, [gl, reducedMotion]);

  useFrame((_, delta) => {
    if (!groupRef.current || reducedMotion) return;

    /* Idle auto-rotate — hover sırasında DURAKLAT (kullanıcı kartı okur/tıklar) */
    if (hoveredIdx === null) {
      groupRef.current.rotation.y += delta * 0.15;
    }

    /* Scroll-itme ivmesi (sönümlü) → idle hıza geri döner */
    if (Math.abs(spinVelRef.current) > 0.0001) {
      groupRef.current.rotation.y += spinVelRef.current;
      spinVelRef.current *= 0.94;
    }

    /* Smooth parallax tilt — taban tilt'in ÜSTÜNE eklenir */
    tiltRef.current.x += (mouseRef.current.y * 0.12 - tiltRef.current.x) * 0.05;
    tiltRef.current.y += (mouseRef.current.x * 0.08 - tiltRef.current.y) * 0.05;
    groupRef.current.rotation.x = BASE_TILT_X + tiltRef.current.x;
  });

  return (
    /* Taban tilt JSX'te → reduced-motion'da da huni eğimi korunur.
       y=-0.4: davulu hafif aşağı al → üst kenar kırpılması yumuşar */
    <group ref={groupRef} position={[0, -0.4, 0]} rotation={[BASE_TILT_X, 0, 0]}>
      {cards.map((card, i) => (
        <SpiralCard
          key={i}
          index={i}
          texture={card.texture}
          angle={card.angle}
          yPos={card.yPos}
          radius={card.radius}
          cardW={card.cardW}
          cardH={card.cardH}
          frameGeo={card.frameGeo}
          meta={card.meta}
          hovered={hoveredIdx === i}
          onOver={(meta, x, y) => {
            setHoveredIdx(i);
            onHover(meta, x, y);
          }}
          onOut={() => {
            setHoveredIdx(null);
            onHoverOut();
          }}
          onClick={(meta) => onPick(meta)}
        />
      ))}
    </group>
  );
}

/* ─── Canvas ─── */
function Hero3DCanvas({
  reducedMotion,
  onHover,
  onHoverOut,
  onPick,
}: {
  reducedMotion: boolean;
  onHover: (meta: CardMeta, clientX: number, clientY: number) => void;
  onHoverOut: () => void;
  onPick: (meta: CardMeta) => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={reducedMotion ? 'demand' : 'always'}
      camera={{ fov: FOV, position: [0, 0, CAM_Z] }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      gl={{ alpha: true, antialias: false }}
    >
      <fog attach="fog" args={['#fbf8f4', FOG_NEAR, FOG_FAR]} />
      <ambientLight intensity={1} />
      <SpiralScene
        reducedMotion={reducedMotion}
        onHover={onHover}
        onHoverOut={onHoverOut}
        onPick={onPick}
      />
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

/* ─── Hover kategori etiketi (canvas ÜSTÜNDE 2D overlay) ─── */
function CategoryLabel({ label, x, y }: { label: string; x: number; y: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, calc(-100% - 14px))', // imlecin hemen üstünde
        background: 'var(--color-terracotta)', // zümrüt #1F5C4A
        color: '#fff',
        fontFamily: 'var(--font-body)', // Inter
        fontSize: '13px',
        fontWeight: 600,
        lineHeight: 1,
        padding: '5px 10px',
        borderRadius: '8px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none', // imleç olayını engellemesin
        zIndex: 20,
      }}
    >
      {label}
    </div>
  );
}

/* ─── Dışa aktarılan bileşen ─── */
export default function Hero3D() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hover, setHover] = useState<{ label: string; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /* Hover: client koordinatını container'a göreceli pill konumuna çevir */
  const handleHover = useCallback(
    (meta: CardMeta, clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setHover({ label: meta.kategori, x: clientX - rect.left, y: clientY - rect.top });
      document.body.style.cursor = 'pointer';
    },
    []
  );

  const handleHoverOut = useCallback(() => {
    setHover(null);
    document.body.style.cursor = 'default';
  }, []);

  const handlePick = useCallback(
    (meta: CardMeta) => {
      document.body.style.cursor = 'default';
      router.push(`/kesfet?q=${encodeURIComponent(meta.q)}`);
    },
    [router]
  );

  return (
    <div ref={containerRef} className="relative" style={{ height: '540px' }}>
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
        <Hero3DCanvas
          reducedMotion={reducedMotion}
          onHover={handleHover}
          onHoverOut={handleHoverOut}
          onPick={handlePick}
        />
      </Hero3DErrorBoundary>

      {hover && <CategoryLabel label={hover.label} x={hover.x} y={hover.y} />}
    </div>
  );
}
