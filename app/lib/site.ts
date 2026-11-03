/**
 * SİTE TABAN ADRESİ — TEK KAYNAK.
 *
 * Mutlak URL üreten her yer (sitemap, robots, e-posta bağlantıları, OG etiketleri)
 * buradan okur. Domain cutover'ında YALNIZ bu dosya (ya da env değişkeni) değişir.
 *
 * Production primary domain: kashe.net (cutover tamamlandı).
 * kashe-rho.vercel.app deploy adresi olarak duruyor ama canonical DEĞİL.
 *
 * NOT: yanlış taban adres SEO'da aktif zarar verir — sitemap'teki mutlak URL'ler
 * canonical sayılır. Fallback bu yüzden primary domain'dir; Vercel'de
 * NEXT_PUBLIC_SITE_URL tanımsızken de doğru adres üretilir.
 * Yerelde .env.local http://localhost:3000 verir (istenen davranış).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://kashe.net'
).replace(/\/+$/, '');

/** Göreli yolu mutlak URL'e çevirir ('/kesfet' → 'https://…/kesfet'). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * ISTEGIN KENDI TABAN ADRESI (Duzeltme 01 / #16).
 *
 * `SITE_URL` CANONICAL adrestir: sitemap, robots, OG ve e-posta sablonlari
 * onu kullanmaya devam eder (onizlemeden uretilmis canonical URL SEO'da zarar
 * verir). Ama ONIZLEMEDE uretilen bir portal baglantisi uretime isaret ederse
 * acilmaz — jeton orada yoktur. Bu yuzden PAYLASILAN baglanti (teklif portali)
 * istegin kendi dagitimindan kurulur.
 *
 * `VERCEL_ENV` 'production' ise her zaman `SITE_URL`. Degilse
 * `VERCEL_BRANCH_URL` (dalin sabit adresi; yoksa `VERCEL_URL` — o dagitima
 * ozel) kullanilir. Yerelde ikisi de yoktur -> `SITE_URL` (localhost).
 */
export function requestSiteUrl(): string {
  if (process.env.VERCEL_ENV === 'production') return SITE_URL;
  const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  if (!host) return SITE_URL;
  const temiz = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return temiz ? `https://${temiz}` : SITE_URL;
}
