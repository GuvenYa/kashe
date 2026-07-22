/**
 * Pano (ilan panosu) için deterministik hash altyapısı.
 * Aynı id → aynı görsel (eğim, stil, renk, iğne köşesi) → SSR/CSR ve yeniden
 * render'da KARARLI kalır (sayfa yenilenince kart zıplamaz).
 *
 * TEK generator, ardışık çağrılar: 1=tilt, 2=styleIndex, 3=pinCorner, 4=colorIndex.
 * SIRA, tasarım sözleşmesindeki panoProps ile BİREBİR aynı — React ve HTML aynı
 * id'ye aynı kartı verir.
 */

// mulberry32 — hızlı, tohumlu PRNG (devir notundaki teklif dağıtımıyla aynı algoritma).
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// String id → deterministik sayısal seed (FNV-1a benzeri char-code karışımı).
export function hashStringToSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Renk paleti — pembe / cyan + kağıt-tint açık versiyonlar (case 6 tint zemin).
export const PANO_COLORS = ['#FA0B96', '#00ACE2'] as const; // 0 pembe, 1 cyan
export const PANO_TINTS = ['#FBEAF3', '#E5F6FC'] as const; //  0 pembe-tint, 1 cyan-tint

export type PinCorner = 'tl' | 'tr' | 'bl' | 'br';
export type PanoProps = {
  tilt: number; // -4° .. +4° (sözleşme: gen()*8-4)
  styleIndex: number; // 0..7 (8 kabuk stili)
  pinCorner: PinCorner; // köşe-iğne stili için (case 3)
  colorIndex: 0 | 1; // pembe / cyan
};

// Tek hash → tüm görsel kararlar (ardışık, bağımsız; sözleşme sırası).
export function getPanoProps(id: string): PanoProps {
  const gen = mulberry32(hashStringToSeed(id));
  const tilt = Math.round((gen() * 8 - 4) * 10) / 10; // 1. çağrı (-4..+4)
  const styleIndex = Math.floor(gen() * 8); //            2. çağrı
  const corners: PinCorner[] = ['tl', 'tr', 'bl', 'br'];
  const pinCorner = corners[Math.floor(gen() * 4)]; //    3. çağrı
  const colorIndex = (gen() < 0.5 ? 0 : 1) as 0 | 1; //   4. çağrı
  return { tilt, styleIndex, pinCorner, colorIndex };
}
