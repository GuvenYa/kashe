// TEK KAYNAK — masaüstü üst bar + mobil hamburger ortak public nav linkleri.
// Parite kuralı: her iki yüzey de BU listelerden türer; elle kopya tutulmaz.
// (Kişisel/rol linkleri ayrı tek kaynakta: top-nav.tsx → menuLinks.)

export type NavLink = { href: string; label: string; ai?: boolean };

// İşlevsel keşif — TÜM kullanıcılara (girişli + girişsiz), her iki yüzeyde.
export const DISCOVERY_LINKS: NavLink[] = [
  { href: '/kesfet', label: 'Keşfet' },
  { href: '/ilanlar', label: 'İlanlar' },
  { href: '/blog', label: 'Blog' },
  { href: '/kashe-ai', label: 'Kashe AI', ai: true },
];

// Pazarlama — yalnız GİRİŞSİZ kullanıcıya, her iki yüzeyde.
// Hedefler ana sayfa section anchor'larıdır (categories#hizmetler,
// how-it-works#nasil-calisir, b2b-section#kurumsal) + /fiyatlandirma sayfası.
export const MARKETING_LINKS: NavLink[] = [
  { href: '/#hizmetler', label: 'Hizmetler' },
  { href: '/#nasil-calisir', label: 'Nasıl çalışır' },
  { href: '/#kurumsal', label: 'Kurumsal' },
  { href: '/fiyatlandirma', label: 'Fiyatlandırma' },
];
