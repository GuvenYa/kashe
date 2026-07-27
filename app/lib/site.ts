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
