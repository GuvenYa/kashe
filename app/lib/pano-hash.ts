/**
 * Pano (ilan panosu) için deterministik hash altyapısı.
 * Aynı id → aynı görsel (eğim, ileride renk/boyut/stil) → SSR/CSR ve yeniden
 * render'da KARARLI kalır (rastgele flicker yok).
 *
 * Commit A: yalnız getPanoTilt kullanılır. Stil/renk/boyut seçimi Commit B'de
 * AYNI hash'ten türetilecek — altyapı burada kuruldu.
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

// id'den -3° ile +3° arası deterministik eğim (1 ondalık).
export function getPanoTilt(id: string): number {
  const rand = mulberry32(hashStringToSeed(id))();
  return Math.round((rand * 6 - 3) * 10) / 10;
}
