import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/app/lib/site';

/**
 * ROBOTS — sitemap işaretçisi + özel alanların taranmaya kapatılması.
 *
 * Disallow listesi giriş gerektiren ya da kişiye özel her yüzeyi kapsar.
 * Bu sayfalar zaten oturum kontrolüyle korunuyor; buradaki amaç tarama
 * bütçesini boşa harcamamak ve arama sonuçlarında "giriş yap" ekranlarının
 * görünmemesi.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/profil',
        '/mesajlar',
        '/bildirimler',
        '/favoriler',
        '/ilanlarim',
        '/basvurularim',
        '/davetlerim',
        '/rezervasyonlarim',
        '/teklif-taleplerim',
        '/teklif-talepleri',
        '/kazanclarim',
        '/odemelerim',
        '/takvimim',
        '/giris',
        '/uye-ol',
        '/sifre-sifirla',
        '/sifremi-unuttum',
        '/askiya-alindi',
        '/api/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
