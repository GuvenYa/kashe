// TEK KAYNAK — masaüstü üst bar + mobil hamburger ortak public nav linkleri.
// Parite kuralı: her iki yüzey de BU listelerden türer; elle kopya tutulmaz.
// (Kişisel/rol linkleri ayrı tek kaynakta: top-nav.tsx → menuLinks.)

export type NavLink = {
  href: string;
  label: string;
  ai?: boolean;
  /**
   * 1024-1279 px arasinda orta nav'a sigmiyor (olculdu: 1920 px'te orta nav'a
   * kalan alan 874 px, 9 baglantinin tek satir ihtiyaci 894 px; lg'de kalan alan
   * ~618 px). Bu baglantilar xl'den itibaren gosterilir; sayfa-ici capalar
   * kaydirmayla zaten ulasilir ve hamburger hepsini listeler.
   */
  xlOnly?: boolean;
};

// İşlevsel keşif — TÜM kullanıcılara (girişli + girişsiz), her iki yüzeyde.
export const DISCOVERY_LINKS: NavLink[] = [
  { href: '/kesfet', label: 'Keşfet' },
  { href: '/ilanlar', label: 'İlanlar' },
  { href: '/blog', label: 'Blog' },
  { href: '/kashe-ai', label: 'Kashe AI', ai: true },
];

// Pazarlama — yalnız GİRİŞSİZ kullanıcıya, her iki yüzeyde.
// Hedefler ana sayfa section anchor'larıdır (categories#hizmetler,
// how-it-works#nasil-calisir, b2b-section#kurumsal, ajanslar-section#ajanslar)
// + /fiyatlandirma sayfası.
export const MARKETING_LINKS: NavLink[] = [
  { href: '/#hizmetler', label: 'Hizmetler', xlOnly: true },
  { href: '/#nasil-calisir', label: 'Nasıl çalışır', xlOnly: true },
  { href: '/#kurumsal', label: 'Kurumsal', xlOnly: true },
  { href: '/#ajanslar', label: 'Ajanslar', xlOnly: true },
  { href: '/fiyatlandirma', label: 'Fiyatlandırma' },
];
