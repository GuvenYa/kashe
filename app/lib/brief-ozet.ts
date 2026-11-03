import { getBriefFields, type BriefField } from './brief-config';

/**
 * BRIEF OZETI (Duzeltme 03-A / A2) — kategoriye ozel brief cevaplarini
 * okunur satirlara cevirir.
 *
 * NEDEN: sohbet seridi yalniz bes sabit alani (tur, tarih, lokasyon, kisi,
 * butce) gosteriyordu; musterinin formda doldurdugu kategoriye ozel alanlar
 * (stil tercihi, drone, cekim suresi, cizim turu, teslim...) `brief_data`
 * icinde duruyor ve HIC gorunmuyordu — profesyonel ayni soruyu tekrar
 * soruyordu.
 *
 * 'use client' YOKTUR ve DB erisimi de YOKTUR: sunucu sayfasi cagirir, hazir
 * `{ etiket, deger }[]` istemciye prop olarak gider (CLAUDE.md: istemci
 * modulunden sunucu modulu import edilmez).
 *
 * DEGER UYDURULMAZ: etiket `brief-config.ts`ten gelir, deger kullanicinin
 * yazdigidir. Alan tanimi yoksa anahtar okunur hale getirilir; bos deger
 * atlanir.
 */

export type BriefSatiri = { etiket: string; deger: string };

/**
 * Seritte ZATEN olan alanlar — ikinci kez yazilmaz. `message` de atlanir
 * (serbest metin; sohbetin ilk mesaji olarak gonderiliyor).
 */
const ATLANAN_ANAHTARLAR = new Set([
  'message',
  'event_type',
  'event_date',
  'location',
  'guest_count',
  'budget_range',
]);

/** "delivery_time" -> "Delivery time" (alan tanimi yoksa yedek etiket). */
function hamEtiket(anahtar: string): string {
  const bosluklu = anahtar.replace(/_/g, ' ').trim();
  if (!bosluklu) return anahtar;
  return bosluklu.charAt(0).toLocaleUpperCase('tr') + bosluklu.slice(1);
}

/** Secenek kodunu (`no_pref` gibi) etikete cevirir; yoksa degeri aynen verir. */
function secenekEtiketi(alan: BriefField | undefined, deger: string): string {
  const secenek = alan?.options?.find((o) => o.value === deger);
  return secenek ? secenek.label : deger;
}

/** jsonb degerini tek satir metne cevirir; bos sayilan deger `null` doner. */
function degerMetni(alan: BriefField | undefined, deger: unknown): string | null {
  if (deger === null || deger === undefined) return null;
  if (typeof deger === 'boolean') return deger ? 'Evet' : 'Hayır';
  if (Array.isArray(deger)) {
    const parcalar = deger
      .map((d) => (d === null || d === undefined ? '' : String(d).trim()))
      .filter(Boolean)
      .map((d) => secenekEtiketi(alan, d));
    return parcalar.length > 0 ? parcalar.join(', ') : null;
  }
  if (typeof deger === 'object') return null; // ic ice nesne gosterilmez
  const metin = String(deger).trim();
  if (!metin) return null;
  return secenekEtiketi(alan, metin);
}

/**
 * Brief cevaplarini satirlara cevirir.
 *
 * SIRA: kategori tanimindaki alan sirasi (form sirasi); tanimda olmayan
 * anahtarlar sonda, geldikleri sirada.
 */
export function briefSatirlari(
  briefData: Record<string, unknown> | null | undefined,
  kategoriSlug: string | null
): BriefSatiri[] {
  if (!briefData || typeof briefData !== 'object') return [];

  const alanlar = getBriefFields(kategoriSlug);
  const alanHaritasi = new Map(alanlar.map((a) => [a.key, a]));
  const satirlar: BriefSatiri[] = [];
  const yazilan = new Set<string>();

  function ekle(anahtar: string) {
    if (ATLANAN_ANAHTARLAR.has(anahtar) || yazilan.has(anahtar)) return;
    const alan = alanHaritasi.get(anahtar);
    const deger = degerMetni(alan, briefData![anahtar]);
    if (deger === null) return;
    yazilan.add(anahtar);
    satirlar.push({ etiket: alan?.label ?? hamEtiket(anahtar), deger });
  }

  for (const alan of alanlar) ekle(alan.key);
  for (const anahtar of Object.keys(briefData)) ekle(anahtar);

  return satirlar;
}
