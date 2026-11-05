/**
 * OZET BANDI CIPLERI — jsonb'den gelen degeri GUVENLE metne cevirir
 * (Duzeltme 10-A, bulgu 78).
 *
 * `category_attributes.summary.stats` iki bicimde yazilmis olabilir:
 *   - bugunku duzenleyici: `["9 yil deneyim", "400+ etkinlik"]` (string[])
 *   - eski sema / Sahne ureteci: `[{ "label": "Etkinlik", "value": "160+" }]`
 *
 * Nesne hali React cocugu olarak cizilince sayfa ISTEMCIDE cokuyordu
 * (React #31: "Objects are not valid as a React child"); sunucu 200 donuyor,
 * kullanici "This page couldn't load" goruyor. Bu yuzden cizim yolu ARTIK
 * dogrudan jsonb okumuyor: once bu saf fonksiyondan geciyor.
 *
 * KURAL: dizi degilse bos liste; metin `trim`; `{ label, value }` nesnesi
 * "<value> <label kucuk harf>" olur; bos / tanimsiz / baska tip (sayi disinda)
 * atlanir; en fazla 3 cip.
 */

/** En fazla cip sayisi (serit tek satirda kalsin). */
const EN_FAZLA = 3;

/** Nesne alanini (metin ya da sayi) metne cevirir; digerleri bos. */
function parca(deger: unknown): string {
  if (typeof deger === 'string') return deger.trim();
  if (typeof deger === 'number' && Number.isFinite(deger)) return String(deger);
  return '';
}

/** Tek bir ham ogeyi metne cevirir; cevrilemezse `null`. */
function cipMetni(oge: unknown): string | null {
  if (typeof oge === 'string') {
    const t = oge.trim();
    return t || null;
  }
  if (typeof oge === 'number' && Number.isFinite(oge)) {
    return String(oge);
  }
  if (oge && typeof oge === 'object' && !Array.isArray(oge)) {
    const o = oge as Record<string, unknown>;
    const deger = parca(o.value);
    const etiket = parca(o.label);
    if (deger && etiket) return `${deger} ${etiket.toLocaleLowerCase('tr')}`;
    return deger || etiket || null;
  }
  return null;
}

/**
 * `summary.stats` -> gosterilecek metin cipleri.
 *
 * Cagiran bu listeyi dogrudan cizebilir; nesne ya da bos deger GECMEZ.
 */
export function ozetCipleri(ham: unknown): string[] {
  if (!Array.isArray(ham)) return [];
  const cikti: string[] = [];
  for (const oge of ham) {
    const metin = cipMetni(oge);
    if (metin) cikti.push(metin);
    if (cikti.length >= EN_FAZLA) break;
  }
  return cikti;
}

/**
 * jsonb'den gelen herhangi bir degeri CIZILEBILIR metne cevirir.
 *
 * `professional-profile.tsx` icinde jsonb'den okunup dogrudan `{...}` ile
 * cizilen alanlar (quick degerleri, modul alanlari, yetenek adlari) icin
 * ortak koruma: metin / sayi / mantiksal deger metne doner, nesne ve dizi
 * ATLANIR (`null`) — sayfa asla cokmez.
 */
export function cizilebilirMetin(ham: unknown): string | null {
  if (typeof ham === 'string') {
    const t = ham.trim();
    return t || null;
  }
  if (typeof ham === 'number' && Number.isFinite(ham)) return String(ham);
  if (typeof ham === 'boolean') return ham ? 'Var' : null;
  return null;
}
