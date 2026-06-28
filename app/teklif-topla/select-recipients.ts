// Teklif Topla — KOTALI alıcı seçimi (saf, deterministik, test edilebilir).
//
// Premium %30 + Kalite %40 + Keşif(yeni) %20 + Rotasyon %10.
// Kotalar floor + kalan→rotasyon (toplam = count). Çakışma yok (bir kişi tek kotaya).
// Dolmayan kontenjan en sonda KALİTE sırasıyla (rating DESC) tamamlanır → havuz≥count
// ise her zaman tam count. Küçük havuz (≤count) → herkes döner.
//
// Determinizm: rotasyon seed'li PRNG (mulberry32) — Math.random YOK.
// Zaman bağımlı kontroller (premium süresi, "yeni" eşiği) Date.now() okur.

import { NEW_BADGE_DAYS } from '@/app/lib/badges';

export type PoolItem = {
  id: string;
  premiumTier: string | null;
  premiumUntil: string | null;
  createdAt: string;
  rating: { count: number; average: number } | null;
};

/** Premium ağırlığı: agency=3, plus=2, premium=1; yok/süresi geçmiş=0. */
function tierWeight(
  tier: string | null,
  until: string | null,
  now: number
): number {
  if (!tier || tier === 'none') return 0;
  if (until && new Date(until).getTime() <= now) return 0;
  if (tier === 'agency') return 3;
  if (tier === 'plus') return 2;
  if (tier === 'premium') return 1;
  return 0;
}

/** Küçük deterministik PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed'li Fisher-Yates karıştırma (saf — verilen diziyi kopyalar). */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ratingAvg = (p: PoolItem) => p.rating?.average ?? 0;
const ratingCount = (p: PoolItem) => p.rating?.count ?? 0;

/**
 * Havuzdan kotalı, çakışmasız, deterministik N alıcı seçer.
 * @returns seçilen id dizisi (uzunluk = min(count, pool.length))
 */
export function selectQuoteRecipients(
  pool: PoolItem[],
  count: number,
  seed: number
): string[] {
  // Küçük havuz → herkes
  if (pool.length <= count) {
    return pool.map((p) => p.id);
  }

  const now = Date.now();
  const targetTotal = Math.min(count, pool.length);

  // Kota hesabı: floor + kalan → rotasyon (toplam tam count)
  const premiumQuota = Math.floor(count * 0.3);
  const kaliteQuota = Math.floor(count * 0.4);
  const kesifQuota = Math.floor(count * 0.2);
  const rotasyonQuota = count - (premiumQuota + kaliteQuota + kesifQuota);

  const remaining = new Map(pool.map((p) => [p.id, p]));
  const selected: string[] = [];
  const remList = () => Array.from(remaining.values());

  // Sıralı adaylardan kota kadar al (havuzda kalanlardan, targetTotal'ı aşmadan)
  function take(candidates: PoolItem[], quota: number) {
    let q = quota;
    for (const c of candidates) {
      if (selected.length >= targetTotal || q <= 0) break;
      if (remaining.has(c.id)) {
        selected.push(c.id);
        remaining.delete(c.id);
        q--;
      }
    }
  }

  // Kalite sıralaması (rating DESC, eşitlikte yorum sayısı DESC)
  const byQuality = (list: PoolItem[]) =>
    list.slice().sort((a, b) => {
      const d = ratingAvg(b) - ratingAvg(a);
      if (d !== 0) return d;
      return ratingCount(b) - ratingCount(a);
    });

  // 1) PREMIUM: tierWeight DESC, eşitlikte rating DESC
  const premiumCands = remList()
    .filter((p) => tierWeight(p.premiumTier, p.premiumUntil, now) > 0)
    .sort((a, b) => {
      const tw =
        tierWeight(b.premiumTier, b.premiumUntil, now) -
        tierWeight(a.premiumTier, a.premiumUntil, now);
      if (tw !== 0) return tw;
      return ratingAvg(b) - ratingAvg(a);
    });
  take(premiumCands, premiumQuota);

  // 2) KALİTE: rating DESC
  take(byQuality(remList()), kaliteQuota);

  // 3) KEŞİF (yeni): NEW_BADGE_DAYS içinde, en yeni önce
  const kesifCands = remList()
    .filter(
      (p) => (now - new Date(p.createdAt).getTime()) / 86400000 <= NEW_BADGE_DAYS
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  take(kesifCands, kesifQuota);

  // 4) ROTASYON: id'ye göre stabil → seed'li karıştır
  const rotasyonBase = remList().sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
  take(seededShuffle(rotasyonBase, seed), rotasyonQuota);

  // 5) DEVİR/TAMAMLAMA: eksik kontenjanı kalite sırasıyla doldur (asla boş bırakma)
  if (selected.length < targetTotal) {
    take(byQuality(remList()), targetTotal - selected.length);
  }

  return selected;
}
