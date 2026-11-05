import { getBriefFields, type BriefField } from './brief-config';
import {
  BRIEF_ACIKLAMA_SONEKI,
  BRIEF_ESNEK_SONEKI,
  aciklamaAnaAnahtari,
  esnekAnaAnahtari,
} from './brief-anahtarlari';

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

/**
 * Alan tanimi OLMAYAN ama anlami bilinen anahtarlar (Duzeltme 10).
 * `hizmet`: modaldeki "Hangi hizmet ya da paket?" secimi (F3).
 */
const OZEL_ETIKETLER: Record<string, string> = {
  hizmet: 'Seçilen hizmet',
};

/** "delivery_time" -> "Delivery time" (alan tanimi yoksa yedek etiket). */
function hamEtiket(anahtar: string): string {
  const ozel = OZEL_ETIKETLER[anahtar];
  if (ozel) return ozel;
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

  /**
   * Duzeltme 10-E4: iki EK anahtar ana alanla birlikte okunur:
   *   `<key>_aciklama` -> "<Alan etiketi> açıklaması" (ana alanin HEMEN
   *      arkasinda; "Diger" secildiginde yazilan kisa metin),
   *   `<key>_esnek`    -> "<Alan etiketi>: Esnek / belli değil".
   * Ham anahtar ("Event type aciklama") HICBIR yuzeyde gorunmez.
   */
  function anaEtiket(anahtar: string): string {
    const alan = alanHaritasi.get(anahtar);
    return alan?.label ?? hamEtiket(anahtar);
  }

  function ekAnahtarlar(anahtar: string) {
    // aciklama
    const aciklamaAnahtari = `${anahtar}${BRIEF_ACIKLAMA_SONEKI}`;
    if (!yazilan.has(aciklamaAnahtari)) {
      const metin = degerMetni(undefined, briefData![aciklamaAnahtari]);
      if (metin !== null) {
        yazilan.add(aciklamaAnahtari);
        satirlar.push({
          etiket: `${anaEtiket(anahtar)} açıklaması`,
          deger: metin,
        });
      }
    }
    // esnek tarih
    const esnekAnahtari = `${anahtar}${BRIEF_ESNEK_SONEKI}`;
    if (!yazilan.has(esnekAnahtari)) {
      const ham = briefData![esnekAnahtari];
      const acik = ham === true || ham === '1' || ham === 'true';
      if (acik) {
        yazilan.add(esnekAnahtari);
        satirlar.push({
          etiket: anaEtiket(anahtar),
          deger: 'Esnek / belli değil',
        });
      }
    }
  }

  function ekle(anahtar: string) {
    // Ek anahtarlar KENDI BASINA satir olmaz: ana alanin arkasinda yazilir.
    if (aciklamaAnaAnahtari(anahtar) || esnekAnaAnahtari(anahtar)) return;
    if (ATLANAN_ANAHTARLAR.has(anahtar)) {
      // Seritte olan alanlarin KENDISI atlanir ama ek anahtarlari yazilir
      // (ornek: tarih seritte var; "Esnek / belli degil" notu burada).
      ekAnahtarlar(anahtar);
      return;
    }
    if (yazilan.has(anahtar)) return;
    const alan = alanHaritasi.get(anahtar);
    const deger = degerMetni(alan, briefData![anahtar]);
    if (deger === null) {
      ekAnahtarlar(anahtar);
      return;
    }
    yazilan.add(anahtar);
    satirlar.push({ etiket: alan?.label ?? hamEtiket(anahtar), deger });
    ekAnahtarlar(anahtar);
  }

  for (const alan of alanlar) ekle(alan.key);
  for (const anahtar of Object.keys(briefData)) ekle(anahtar);

  return satirlar;
}
