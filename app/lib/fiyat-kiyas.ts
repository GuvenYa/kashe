import { formatTLAralik, sayiMetni } from '@/app/lib/para';

/**
 * FIYAT KIYASLARI — ortak tipler ve bicimleyiciler (FAZ 9b).
 *
 * 'use client' YOKTUR ve DB erisimi de YOKTUR: hem sunucu sayfalari hem istemci
 * bilesenleri buradan okur. Sorgu `fiyat-kiyas-data.ts`'de (yalniz sunucu) ya
 * da istemcide dogrudan RPC ile.
 *
 * ILKE — FIYAT UYDURULMAZ: bu modul YALNIZ RPC'nin dondurdugu p25/medyan/p75
 * degerlerini bicimlendirir. Tahmin, yuvarlama, "yaklasik" turetme yok. Tek
 * turetme sihirbazdaki `adet x medyan` toplamidir ve orada "~" ile yazilir.
 *
 * YAYINLI HUCRE YOKSA HICBIR SEY CIZILMEZ (karar: esik alti gorunmez) — "veri
 * yok" yazisi bile yok. Bu yuzden her yuzey `undefined` kiyasta erken doner.
 */

export type KiyasKapsami = 'role_city_type' | 'role_city' | 'role';

export type PazarKiyasi = {
  roleId: number;
  median: number;
  p25: number;
  p75: number;
  sampleSize: number;
  periodEnd: string;
  granularity: KiyasKapsami;
};

/**
 * Cumle ici kapsam etiketi: "... bu sehirde genelde 4.750 - 12.250 TL".
 * Baslik/tablo etiketleri AYRI (`zeka.ts` `AILE_ETIKETI`) — biri cumleye
 * girer, oteki sutun basligi olur.
 */
export const GRANULARITY_ETIKETI: Record<KiyasKapsami, string> = {
  role_city_type: 'bu şehir ve etkinlik türünde',
  role_city: 'bu şehirde',
  role: 'Türkiye genelinde',
};

/** Kapsam darligi (genis -> dar). Toplam satirinda EN KABA kapsam yazilir. */
const KAPSAM_SIRASI: Record<KiyasKapsami, number> = {
  role: 0,
  role_city: 1,
  role_city_type: 2,
};

/**
 * Birden fazla kiyasin EN KABA kapsamı — sihirbaz toplam satiri icin.
 * Roller farkli kapsamda yayinli olabilir; toplamin etiketi en zayif olana
 * gore yazilir, aksi halde metin oldugundan dar bir iddia tasirdi.
 */
export function enKabaKapsam(kiyaslar: PazarKiyasi[]): KiyasKapsami {
  let en: KiyasKapsami = 'role_city_type';
  for (const k of kiyaslar) {
    if (KAPSAM_SIRASI[k.granularity] < KAPSAM_SIRASI[en]) en = k.granularity;
  }
  return en;
}

/** RPC satiri -> `PazarKiyasi`. `numeric` sutunlar METIN gelebilir. */
export function kiyasSatirindan(row: {
  role_id?: number | string | null;
  median: number | string;
  p25: number | string;
  p75: number | string;
  sample_size: number | string;
  period_end: string;
  granularity: string;
}): PazarKiyasi | null {
  const median = Number(row.median);
  const p25 = Number(row.p25);
  const p75 = Number(row.p75);
  const sampleSize = Number(row.sample_size);
  if (![median, p25, p75, sampleSize].every((n) => Number.isFinite(n))) {
    return null;
  }
  const kapsam = row.granularity as KiyasKapsami;
  if (!(kapsam in GRANULARITY_ETIKETI)) return null;
  return {
    roleId: Number(row.role_id ?? 0),
    median,
    p25,
    p75,
    sampleSize,
    periodEnd: row.period_end,
    granularity: kapsam,
  };
}

/** "4.750 – 12.250 TL" (birim bir kez, sonda — `para.ts` kurali). */
export function pazarAraligi(k: PazarKiyasi): string {
  return formatTLAralik(k.p25, k.p75);
}

/** "son 90 gün · 23 işlem" — kiyasin dayandigi orneklem. */
export function ornekMetni(k: PazarKiyasi): string {
  return `son 90 gün · ${sayiMetni(k.sampleSize)} işlem`;
}

export type KiyasKonumu = 'altinda' | 'icinde' | 'ustunde';

/**
 * Verilen fiyatin pazar aralığına gore yeri. Fiyat yoksa `null` — "aralikta"
 * demek YANLIS olurdu (olculmemis bir seyi olculmus gibi gostermek).
 */
export function konum(
  fiyat: number | null | undefined,
  k: PazarKiyasi
): KiyasKonumu | null {
  if (fiyat === null || fiyat === undefined || !Number.isFinite(fiyat)) {
    return null;
  }
  if (fiyat < k.p25) return 'altinda';
  if (fiyat > k.p75) return 'ustunde';
  return 'icinde';
}

export const KONUM_ETIKETI: Record<KiyasKonumu, string> = {
  altinda: 'pazarın altında',
  icinde: 'pazar aralığında',
  ustunde: 'pazarın üstünde',
};

/** Konum rozeti rengi — `icinde` moss (uyum), `ustunde` pembe (dikkat). */
export const KONUM_SINIFI: Record<KiyasKonumu, string> = {
  altinda: 'text-ink-72',
  icinde: 'text-moss',
  ustunde: 'text-brand-accent',
};
