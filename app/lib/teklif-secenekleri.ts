/**
 * TEKLIF MODALI SECENEKLERI — TEK KAYNAK (Duzeltme 11-B, bulgu 76 b/d).
 *
 * Fahri'nin turunda iki sey eksikti: paketi secince ne aldigini gormuyordu
 * ("paketi secince detaylari gelsin") ve ajans uzerinden hangi ekip uyesiyle
 * calisacagini secemiyordu ("kimle anlasacagimi anlamadim").
 *
 * Duzeltme 10'da modal yalniz BASLIK listesi (`string[]`) aliyordu; artik
 * fiyat ve icerik de geliyor — ama `brief_data.hizmet` yine BASLIKTIR
 * (degismedi; ozet etiketi "Seçilen hizmet").
 *
 * Saf modul: 'use client' ve DB erisimi YOK; sunucu sayfasi kurar, istemci
 * bileseni cizer.
 */

export type HizmetSecenegi = {
  baslik: string;
  tur: 'paket' | 'hizmet';
  /** Bicimlenmis fiyat metni ("12.000 TL'den başlar"); yoksa null. */
  fiyat: string | null;
  /** Paket icerigi (`includes`); hizmette bos dizi. */
  icerik: string[];
  /** Hizmetin / paketin kategori slug'i — ekip tercihi gruplamasinda kullanilir. */
  kategoriSlug: string | null;
};

export type EkipSecenegi = {
  /** Uyenin profil kimligi (`brief_data.tercih_uye`). */
  id: string;
  /** Kamu adi ("Ad S.") — `gosterilecekAd` ile uretilir. */
  ad: string;
  /** Birincil kategori adi; yoksa null. */
  rol: string | null;
  kategoriSlug: string | null;
};

/** Modaldeki ozet en fazla kac icerik maddesi gosterir. */
export const HIZMET_ICERIK_EN_FAZLA = 4;

/** Ekip tercihi bos biraktiginda gosterilen secenek metni. */
export const EKIP_TERCIH_YOK = 'Fark etmez — ajans önersin';

/** Baslikla secenegi bulur (modal secimi baslik tasir). */
export function hizmetSecenegiBul(
  secenekler: HizmetSecenegi[],
  baslik: string
): HizmetSecenegi | null {
  const t = baslik.trim();
  if (!t) return null;
  return secenekler.find((s) => s.baslik === t) ?? null;
}

/**
 * Ekip uyelerini secili hizmetin kategorisine gore ikiye ayirir.
 *
 * Kategori yoksa ya da o kategoride uye yoksa hepsi `oncelikli` doner ve
 * cizici grup basligi yazmaz — yapay bir "Diğer" grubu olusmaz.
 */
export function ekipGruplari(
  ekip: EkipSecenegi[],
  kategoriSlug: string | null
): { oncelikli: EkipSecenegi[]; digerleri: EkipSecenegi[] } {
  if (!kategoriSlug) return { oncelikli: ekip, digerleri: [] };
  const oncelikli = ekip.filter((u) => u.kategoriSlug === kategoriSlug);
  if (oncelikli.length === 0) return { oncelikli: ekip, digerleri: [] };
  return {
    oncelikli,
    digerleri: ekip.filter((u) => u.kategoriSlug !== kategoriSlug),
  };
}

/** Secenek etiketi: "Ad S. · Rol" (rol yoksa yalniz ad). */
export function ekipSecenekEtiketi(uye: EkipSecenegi): string {
  return uye.rol ? `${uye.ad} · ${uye.rol}` : uye.ad;
}
