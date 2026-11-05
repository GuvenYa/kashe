// TEK KAYNAK — masaüstü üst bar + mobil hamburger ortak public nav linkleri.
// Parite kuralı: her iki yüzey de BU listelerden türer; elle kopya tutulmaz.
// (Kisisel/rol linkleri ayri tek kaynakta: app/lib/panel-menu.ts.)

export type NavLink = {
  href: string;
  label: string;
  ai?: boolean;
};

/**
 * Islevsel kesif — TUM kullanicilara (girisli + girissiz), her iki yuzeyde.
 *
 * Duzeltme 11-A1 (bulgu 73): girissiz ust barda 9 baglanti vardi ve hicbiri
 * kullaniciyi planlamaya itmiyordu. Kesif artik iki satir: Kesfet ve Ilanlar.
 * Blog ve Kashe AI buradan cikti — Blog `HAKKINDA_LINKS`'e, Kashe AI ise
 * `PLANLA_LINK` olarak one cikan dugmeye tasindi.
 */
export const DISCOVERY_LINKS: NavLink[] = [
  { href: '/kesfet', label: 'Keşfet' },
  { href: '/ilanlar', label: 'İlanlar' },
];

/**
 * Ana eylem — `/kashe-ai` (tek AI girisi). Girissizde sag ustte birincil
 * vurgu dugmesi, girislide orta nav'da isiltili baglanti, mobilde menunun
 * en ustunde tam genislik dugme. Metin ve hedef TEK yerde.
 */
export const PLANLA_LINK: NavLink = {
  href: '/kashe-ai',
  label: 'Etkinliğini planla',
  ai: true,
};

/**
 * Pazarlama — yalniz GIRISSIZ ust barda. Duzeltme 11-A1 ile tek satir kaldi;
 * sayfa ici capalar `HAKKINDA_LINKS`'e gecti.
 */
export const MARKETING_LINKS: NavLink[] = [
  { href: '/fiyatlandirma', label: 'Fiyatlandırma' },
];

/**
 * "Kashe hakkinda" — ana sayfa bolum capalari + Blog. Ust barda GORUNMEZ;
 * yalniz mobil menude (grup) ve alt bilgide listelenir.
 */
export const HAKKINDA_LINKS: NavLink[] = [
  { href: '/#hizmetler', label: 'Hizmetler' },
  { href: '/#nasil-calisir', label: 'Nasıl çalışır' },
  { href: '/#kurumsal', label: 'Kurumsal' },
  // Duzeltme 09-B1: etiket "Saglayicilar" — bolum basligi ve alt bilgi
  // zaten "Kurumsal hizmet sağlayıcılar"; hedef (`/#ajanslar`) DEGISMEZ.
  { href: '/#ajanslar', label: 'Sağlayıcılar' },
  { href: '/blog', label: 'Blog' },
];
