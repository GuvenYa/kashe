/**
 * Kashe yasal metin sabitleri.
 * Lansman öncesi (şirket kuruluşu + domain alımı + KVKK avukat reviewu sonrası)
 * burada güncellenecek değerler.
 *
 * Bu dosya değiştirilince hem gizlilik hem kullanım koşulları sayfaları
 * otomatik güncellenir — taşıma yapma.
 */

// Veri Sorumlusu — şirket kurulunca güncellenecek
export const LEGAL_OPERATOR = {
  // Kuruluş aşaması: bireysel girişimci
  legalEntity: 'Fahri Dağlar — Bireysel Girişimci',
  // Lansman öncesi şirket kurulduğunda buraya MERSIS, ticaret sicil ve adres eklenecek
  // mersisNo: 'XXXXXXXXXXXXXXX',
  // ticaretSicilNo: 'XXXXXXXX',
  // adres: '...',
  isPreLaunch: true, // sayfada "kuruluş aşaması" uyarısı için
};

// İletişim adresleri — domain alınınca kvkk@kashe.app olacak
export const LEGAL_CONTACT = {
  general: 'kasheofficial@gmail.com',
  privacy: 'kasheofficial@gmail.com', // domain sonrası: kvkk@kashe.app
  // Domain alımı sonrası: kvkk@kashe.app + bildirim@kashe.app aktif olacak
  isTemporaryEmail: true,
};

// 3. taraf hizmet sağlayıcılar (KVKK aydınlatma için)
export const THIRD_PARTY_PROCESSORS = [
  {
    name: 'Supabase Inc.',
    purpose: 'Veritabanı ve kimlik doğrulama',
    location: 'Frankfurt, Almanya (AB içi)',
    privacyUrl: 'https://supabase.com/privacy',
  },
  {
    name: 'Vercel Inc.',
    purpose: 'Web sitesi barındırma (hosting)',
    location: 'ABD',
    privacyUrl: 'https://vercel.com/legal/privacy-policy',
  },
  {
    name: 'Resend Inc.',
    purpose: 'İşlemsel e-posta gönderimi (bildirimler)',
    location: 'ABD',
    privacyUrl: 'https://resend.com/legal/privacy-policy',
  },
];

// Son güncelleme tarihi — yasal metinler değişince güncelle
export const LEGAL_LAST_UPDATED = '31 Mayıs 2026';

// Yaş sınırı
export const MIN_USER_AGE = 18;
