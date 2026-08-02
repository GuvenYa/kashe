/**
 * Metin boşluk denetimi — İSTEMCİ VE SUNUCU İÇİN TEK KAYNAK.
 *
 * NEDEN: `String.prototype.trim()` ECMAScript WhiteSpace kümesini temizler —
 * boşluk, tab, NBSP (U+00A0), ZWNBSP (U+FEFF), tüm Zs kategorisi. AMA sıfır
 * genişlikli biçimlendirme karakterlerini (Cf kategorisi) temizlemez:
 *   U+200B ZWSP · U+200C ZWNJ · U+200D ZWJ · U+2060 WORD JOINER
 * Bunlardan biri tek başına bir alanda dururken kutu GÖZLE BOŞ görünür ama
 * uzunluk 1 olduğu için kod "dolu" sayar. Kopyala-yapıştır (web, Word, PDF) bu
 * karakterleri sessizce taşır.
 *
 * Bu modül direktifsizdir: 'use client' bileşenleri de 'use server' action'ları da
 * aynı fonksiyonu import eder. İki taraf ayrışırsa istemci "boş" derken sunucu
 * "dolu" der (veya tersi) ve satır sessizce kaybolur.
 */

/** Sıfır genişlikli biçimlendirme karakterleri — trim() bunları temizlemez.
 *  Kaçış dizisiyle yazılır: literal görünmez karakter kaynağa KONMAZ (okunmaz olur). */
const INVISIBLE_FORMAT = /[\u200B-\u200D\u2060]/g;

/**
 * Görünmez biçimlendirme karakterlerini atar, sonra kırpar.
 * String olmayan girdi (null/undefined/sayı/nesne) → '' döner.
 */
export function stripInvisible(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(INVISIBLE_FORMAT, '').trim();
}

/** Değer "boş" mu? null · undefined · '' · yalnız boşluk · yalnız görünmez karakter. */
export function isBlankText(value: unknown): boolean {
  return stripInvisible(value).length === 0;
}
