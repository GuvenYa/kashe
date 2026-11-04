import type { EventSpecV1 } from '@/app/lib/eventspec';

/**
 * SPEC -> SIHIRBAZ URL'SI (Duzeltme 06-D1).
 *
 * Analizden cikan EventSpec'i sihirbazin URL durumuna cevirir. Mantik eskiden
 * yalniz `sihirbaz-client.tsx` `analizEt` icindeydi; `/kashe-ai` de ayni
 * donusumu yaptigi icin ORTAK SAF FONKSIYONA tasindi — iki yuzey ayrisamaz
 * ve `/kashe-ai` ikinci bir analiz yapmak zorunda kalmaz.
 *
 * SAF: sorgu atmaz, tarayici / sunucu API'si kullanmaz (istemciden de sunucudan
 * da cagrilir). Kategori eslemesi cagiranin verdigi listeden yapilir; listede
 * olmayan rol ATLANIR (uydurma kategori kimligi uretilmez).
 *
 * `metin` her zaman yazilir (kullanicinin anlattigi korunur). `brief` / `surum`
 * yalniz verildiyse eklenir — girissiz analizde ikisi de yoktur.
 */

/** Sihirbazin "Anlat" adiminda URL'ye yazilan/temizlenen tum anahtarlar. */
export const ANLAT_ANAHTARLARI = [
  'tur',
  'sehir',
  'ilce',
  'tarih',
  'bitis',
  'esnek',
  'katilimci',
  'butce_min',
  'butce_max',
  'mekan',
  'baslik',
  'kategoriler',
  'adet',
  'opsiyonel',
  'brief',
  'surum',
  'tarih_notu',
  'sehir_notu',
  // EK-4: analizde dolan adimlar atlandiysa '1' olur; "Brief'ten
  // anladiklarimiz" seridi bu bayrakla gorunur. Yeni analizde sifirlanir.
  'atlanan',
] as const;

export type SihirbazKategori = { id: number; slug: string };

/**
 * Spec'ten URL YAMASI (anahtar -> deger | null).
 *
 * `null` deger "bu anahtari URL'den SIL" demektir: sihirbazin `guncelle`
 * fonksiyonu bunu bekliyor, onceki analizden kalan degerler boyle temizlenir.
 */
export function spectenSihirbazYamasi(
  spec: EventSpecV1,
  kategoriler: SihirbazKategori[],
  metin: string,
  kayit?: { briefId?: string; specVersionId?: string }
): Record<string, string | null> {
  const yama: Record<string, string | null> = { metin };
  for (const k of ANLAT_ANAHTARLARI) yama[k] = null;

  const s = spec;
  if (s.event_type) yama.tur = s.event_type;
  if (s.city_id != null) yama.sehir = String(s.city_id);
  if (s.district) yama.ilce = s.district;
  if (s.start_date) yama.tarih = s.start_date;
  if (s.end_date) yama.bitis = s.end_date;
  if (s.is_date_flexible) yama.esnek = '1';
  if (s.participant_count != null)
    yama.katilimci = String(s.participant_count);
  if (s.budget_min != null) yama.butce_min = String(s.budget_min);
  if (s.budget_max != null) yama.butce_max = String(s.budget_max);
  if (s.venue_status) yama.mekan = s.venue_status;
  if (s.title) yama.baslik = s.title;

  const roller = s.suggested_roles ?? [];
  const idler: number[] = [];
  const adetler: string[] = [];
  const opsiyoneller: string[] = [];
  for (const r of roller) {
    const kat = kategoriler.find((k) => k.slug === r.slug);
    if (!kat) continue; // eslesmeyen rol atlanir
    idler.push(kat.id);
    if (r.quantity && r.quantity > 1) adetler.push(`${kat.id}:${r.quantity}`);
    if (r.is_required === false) opsiyoneller.push(String(kat.id));
  }
  if (idler.length > 0) yama.kategoriler = idler.join(',');
  if (adetler.length > 0) yama.adet = adetler.join(',');
  if (opsiyoneller.length > 0) yama.opsiyonel = opsiyoneller.join(',');

  if (kayit?.briefId) yama.brief = kayit.briefId;
  if (kayit?.specVersionId) yama.surum = kayit.specVersionId;

  const ekstra = (s.extra ?? {}) as Record<string, unknown>;
  if (typeof ekstra.date_note === 'string') yama.tarih_notu = ekstra.date_note;
  if (typeof ekstra.city_note === 'string') yama.sehir_notu = ekstra.city_note;

  /**
   * DOLU ADIMLARI ATLA (EK-4): kullanici zaten anlattigi seyi tekrar
   * onaylamasin. Ilk EKSIK adima gidilir; eksik yoksa Ihtiyac adimina.
   * Atlananlar kaybolmaz: serit cipleriyle gorunur ve duzenlenebilir kalir.
   */
  const turTamam = !!yama.tur;
  const sehirTamam = !!yama.sehir;
  const tarihTamam = (!!yama.tarih || yama.esnek === '1') && !!yama.katilimci;
  const ilkEksik = !turTamam ? 1 : !sehirTamam ? 2 : !tarihTamam ? 3 : 4;
  yama.adim = String(ilkEksik);
  if (ilkEksik > 1) yama.atlanan = '1';

  return yama;
}

/**
 * Ayni yamanin `URLSearchParams` hali — `/kashe-ai` sihirbaza BAGLANTI kurarken
 * kullanir (orada temizlenecek eski durum yok, `null` degerler atlanir).
 */
export function spectenSihirbazParametreleri(
  spec: EventSpecV1,
  kategoriler: SihirbazKategori[],
  metin: string,
  kayit?: { briefId?: string; specVersionId?: string }
): URLSearchParams {
  const yama = spectenSihirbazYamasi(spec, kategoriler, metin, kayit);
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(yama)) {
    if (v !== null && v !== '') p.set(k, v);
  }
  return p;
}
