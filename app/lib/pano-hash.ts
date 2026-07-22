/**
 * Pano (ilan panosu) için deterministik hash altyapısı.
 * Aynı id → aynı görsel (eğim, stil, renk, iğne köşesi) → SSR/CSR ve yeniden
 * render'da KARARLI kalır (sayfa yenilenince kart zıplamaz).
 *
 * TEK generator, ardışık çağrılar: 1=tilt, 2=styleIndex, 3=pinCorner, 4=colorIndex.
 * Böylece her görsel karar deterministik AMA birbirinden bağımsız.
 * (Boyut hash'ten DEĞİL, karakter sayısından türer — getPanoSize.)
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

// Renk paleti — pembe / cyan (soğuk/canlı marka aksanı) + kağıt-tint açık versiyonlar.
export const PANO_COLORS = ['#FA0B96', '#00ACE2'] as const; // 0 pembe, 1 cyan
export const PANO_TINTS = ['#FBEAF3', '#E5F6FC'] as const; //  0 pembe-tint, 1 cyan-tint

export type PinCorner = 'tl' | 'tr' | 'bl' | 'br';
export type PanoProps = {
  tilt: number; // -3° .. +3°
  styleIndex: number; // 0..7 (8 kabuk stili)
  pinCorner: PinCorner; // köşe-iğne stili için
  colorIndex: 0 | 1; // pembe / cyan
};

// Tek hash → tüm görsel kararlar (ardışık, bağımsız).
export function getPanoProps(id: string): PanoProps {
  const gen = mulberry32(hashStringToSeed(id));
  const tilt = Math.round((gen() * 6 - 3) * 10) / 10; // 1. çağrı
  const styleIndex = Math.floor(gen() * 8); //            2. çağrı
  const corners: PinCorner[] = ['tl', 'tr', 'bl', 'br'];
  const pinCorner = corners[Math.floor(gen() * 4)]; //    3. çağrı
  const colorIndex = (gen() < 0.5 ? 0 : 1) as 0 | 1; //   4. çağrı
  return { tilt, styleIndex, pinCorner, colorIndex };
}

// Boyut KARAKTER SAYISINDAN (hash'ten değil): içerik uzunluğu = kart boyutu.
// Açıklama katkısı ~preview kadar sınırlanır (çeşitlilik için). Featured → daima 'lg'.
export function getPanoSize(
  title: string,
  description: string | null,
  featured: boolean
): 'sm' | 'md' | 'lg' {
  if (featured) return 'lg';
  const previewLen = Math.min(description?.length ?? 0, 80);
  const total = title.length + previewLen;
  if (total < 40) return 'sm';
  if (total <= 90) return 'md';
  return 'lg';
}
