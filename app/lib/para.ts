/**
 * Para bicimi — TEK KAYNAK (D1b-2).
 *
 * 'use client' YOKTUR: sunucu sayfalari ve istemci bilesenleri ayni dosyayi okur.
 *
 * KURAL: "12.000 TL" — binlik nokta, kurus YOK, birim SONDA ve "TL" yazisiyla.
 * Aralik: "2.500 – 3.000 TL" (tek birim, sonda). Baslangic: "48.000 TL'den".
 *
 * NEDEN LIRA ISARETI DEGIL: urun uc farkli bicim tasiyordu — Intl currency
 * cikti (isaret ONDE), elle yazilan isaret SONDA ve aralik bicimi. Ayni ekranda
 * iki bicim yan yana dusuyordu. Lira isareti ayrica bazi Windows/Android yazi
 * tiplerinde kutu olarak ciziliyor; "TL" her yerde okunur.
 *
 * TRY DISI PARA BIRIMI: bugun yok (`events.currency` CHECK 'TRY',
 * `bookings.currency` default 'TRY'). Yine de kolonu olan yerler
 * `paraBirimliMetin` ile yazilir; bilinmeyen birim kodu oldugu gibi gosterilir,
 * uydurma sembol uretilmez.
 */

/** Ham sayi: 12000 -> "12.000" (kurus yok). */
export function sayiMetni(deger: number): string {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(
    deger
  );
}

/** 12000 -> "12.000 TL". Bos deger icin bos dizge. */
export function formatTL(deger: number | null | undefined): string {
  if (deger === null || deger === undefined || Number.isNaN(deger)) return '';
  return `${sayiMetni(deger)} TL`;
}

/**
 * Aralik: "2.500 – 3.000 TL" (birim BIR KEZ, sonda).
 * Iki deger esitse tek deger yazilir; biri eksikse dolu olan tek deger olur.
 */
export function formatTLAralik(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  const a = min ?? null;
  const b = max ?? null;
  if (a === null && b === null) return '';
  if (a === null) return formatTL(b);
  if (b === null) return formatTL(a);
  if (a === b) return formatTL(a);
  return `${sayiMetni(a)} – ${sayiMetni(b)} TL`;
}

/**
 * Para birimi kolonu olan yerler (rezervasyon, teklif surumu).
 * 'TRY' -> "12.000 TL"; baska kod -> "12.000 USD" (sembol UYDURULMAZ).
 */
export function paraBirimliMetin(
  deger: number | null | undefined,
  birim: string | null | undefined
): string {
  if (deger === null || deger === undefined || Number.isNaN(deger)) return '';
  const kod = (birim ?? 'TRY').toUpperCase();
  if (kod === 'TRY') return formatTL(deger);
  return `${sayiMetni(deger)} ${kod}`;
}
