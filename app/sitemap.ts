import type { MetadataRoute } from 'next';
import { createClient } from '@/app/lib/supabase-server';
import { SITE_URL } from '@/app/lib/site';

/**
 * SITEMAP — arama motoru keşif yüzeyi.
 *
 * Neden gerekli: /kategori/<slug> sayfaları tam SEO metadata'sına sahip ama
 * onlara giden tek iç link ana sayfa grid'iydi; grid ilk 12'ye kesildikten sonra
 * kalan kategorilerin hiçbir keşif yüzeyi kalmıyordu. Sitemap + /kategoriler hub'ı
 * bu boşluğu kapatır.
 *
 * DİNAMİK: kategori/profil/blog listeleri DB'den CANLI okunur — yeni kategori
 * `is_active=true` olduğu an sitemap'e otomatik girer, ek kod gerekmez.
 *
 * lastModified YALNIZ gerçek sinyali olan kayıtlarda doldurulur (profiles.updated_at,
 * blog_posts.published_at). Kategori ve statik sayfaların içeriği kod içinde yaşıyor
 * ve deploy ile değişiyor — uydurma tarih yazmak yerine alan boş bırakılır.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  // --- Statik, herkese açık sayfalar (giriş gerektirenler HARİÇ) ---
  const staticPaths: { path: string; priority: number }[] = [
    { path: '/', priority: 1.0 },
    { path: '/kesfet', priority: 0.9 },
    { path: '/kategoriler', priority: 0.9 },
    { path: '/ilanlar', priority: 0.8 },
    { path: '/pro-bul', priority: 0.7 },
    { path: '/etkinlik-sihirbazi', priority: 0.7 },
    { path: '/blog', priority: 0.6 },
    { path: '/fiyatlandirma', priority: 0.6 },
    { path: '/premium', priority: 0.6 },
    { path: '/hakkimizda', priority: 0.5 },
    { path: '/yardim', priority: 0.4 },
    { path: '/kullanim-kosullari', priority: 0.2 },
    { path: '/gizlilik', priority: 0.2 },
    { path: '/kvkk', priority: 0.2 },
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: 'weekly',
    priority,
  }));

  const [{ data: categories }, { data: profiles }, { data: posts }] =
    await Promise.all([
      supabase
        .from('service_categories')
        .select('slug')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('profiles')
        .select('id, updated_at')
        .eq('is_published', true)
        .in('role', ['professional', 'agency']),
      supabase
        .from('blog_posts')
        .select('slug, published_at')
        .eq('status', 'published'),
    ]);

  for (const c of categories ?? []) {
    entries.push({
      url: `${SITE_URL}/kategori/${c.slug}`,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  for (const p of profiles ?? []) {
    entries.push({
      url: `${SITE_URL}/p/${p.id}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  for (const b of posts ?? []) {
    entries.push({
      url: `${SITE_URL}/blog/${b.slug}`,
      lastModified: b.published_at ? new Date(b.published_at) : undefined,
      changeFrequency: 'monthly',
      priority: 0.5,
    });
  }

  return entries;
}
