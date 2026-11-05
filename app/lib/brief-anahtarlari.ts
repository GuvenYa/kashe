import type { BriefField } from '@/app/lib/brief-config';

/**
 * BRIEF EK ANAHTARLARI — TEK KAYNAK (Duzeltme 10-D/E).
 *
 * Form iki yeni tur deger yaziyor; ikisi de ANA ALANIN anahtarindan turetilir,
 * boylece ozet / dogrulama / cizim ayni kurali okur:
 *
 *   `<key>_esnek`    (mantiksal) tarih henuz belli degil  -> E2
 *   `<key>_aciklama` (metin, 120) "Diger" secildiginde    -> E3
 *
 * Sonekler BURADA tanimlidir: cizici, brief ozeti ve kaydeden eylem ayni
 * sabitleri kullanir — anahtar adi uc yerde elle yazilmaz.
 */

export const BRIEF_ESNEK_SONEKI = '_esnek';
export const BRIEF_ACIKLAMA_SONEKI = '_aciklama';

/** `<key>_aciklama` ise ana alanin anahtari, degilse `null`. */
export function aciklamaAnaAnahtari(key: string): string | null {
  return key.endsWith(BRIEF_ACIKLAMA_SONEKI)
    ? key.slice(0, -BRIEF_ACIKLAMA_SONEKI.length)
    : null;
}

/** `<key>_esnek` ise ana alanin anahtari, degilse `null`. */
export function esnekAnaAnahtari(key: string): string | null {
  return key.endsWith(BRIEF_ESNEK_SONEKI)
    ? key.slice(0, -BRIEF_ESNEK_SONEKI.length)
    : null;
}

/** Metin uzunluk siniri (`<key>_aciklama`). */
export const BRIEF_ACIKLAMA_SINIRI = 120;

/** `hizmet` (secilen hizmet / paket basligi) uzunluk siniri. */
const BRIEF_HIZMET_SINIRI = 200;

/**
 * Bu alan IL alani mi? (Duzeltme 10-D)
 *
 * Olcut ANAHTAR: `location` / `city` (ve `_city` ile bitenler). Tur `text`
 * kaliyor — legacy sutun ve `brief_data` anahtari degismesin diye; yalniz
 * GIRIS bicimi secici oluyor.
 */
export function briefIlAlani(field: Pick<BriefField, 'key' | 'type'>): boolean {
  if (field.type !== 'text') return false;
  return (
    field.key === 'location' ||
    field.key === 'city' ||
    field.key.endsWith('_city')
  );
}

/**
 * SUNUCU TARAFI TEMIZLIK (Duzeltme 10-E5).
 *
 * Yeni iki anahtar istemciden METIN olarak geliyor; kaydeden eylem tipi ve
 * uzunlugu burada sabitler:
 *   `<key>_aciklama` -> en fazla 120 karakter, bos ise ANAHTAR DUSER,
 *   `<key>_esnek`    -> MANTIKSAL (`true`); kapali / gecersiz ise anahtar duser.
 *
 * Diger anahtarlar DEGISMEZ (mevcut davranis korunur).
 */
export function briefVeriTemizle(
  ham: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!ham || typeof ham !== 'object') return null;
  const cikti: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ham)) {
    if (k.endsWith(BRIEF_ACIKLAMA_SONEKI)) {
      const metin = typeof v === 'string' ? v.trim().slice(0, BRIEF_ACIKLAMA_SINIRI) : '';
      if (metin) cikti[k] = metin;
      continue;
    }
    if (k.endsWith(BRIEF_ESNEK_SONEKI)) {
      const acik = v === true || v === '1' || v === 'true';
      if (acik) cikti[k] = true;
      continue;
    }
    if (k === 'hizmet') {
      const metin = typeof v === 'string' ? v.trim().slice(0, BRIEF_HIZMET_SINIRI) : '';
      if (metin) cikti[k] = metin;
      continue;
    }
    cikti[k] = v;
  }
  return Object.keys(cikti).length > 0 ? cikti : null;
}
