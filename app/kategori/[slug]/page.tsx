import { createClient } from '@/app/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { TopNav } from '@/app/components/sections/top-nav';
import { ProfileCard } from '@/app/kesfet/profile-card';
import { EmptyState } from '@/app/components/EmptyState';
import { getFavoritedIds } from '@/app/favoriler/actions';
import { getCategoryIcon } from '@/app/lib/category-icon';

type Props = {
  params: Promise<{ slug: string }>;
};

type CategoryRow = {
  id: number;
  slug: string;
  name_tr: string;
  emoji: string | null;
  description: string | null;
  seo_title: string | null;
};

type PublishedProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city_id: number | null;
  primary_category_id: number | null;
  company_name: string | null;
  role: string;
  created_at: string | null;
  approval_status: string | null;
  premium_tier: string | null;
  premium_until: string | null;
  attributes: Record<string, string | string[]> | null;
  turkish_cities: { name: string } | null;
  service_categories: { name_tr: string; emoji: string | null; slug: string } | null;
};

type ServicePriceInfo = {
  price_min: number | null;
  price_max: number | null;
  price_on_request: boolean;
};

async function getCategory(slug: string): Promise<CategoryRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('service_categories')
    .select('id, slug, name_tr, emoji, description, seo_title')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  return (data as CategoryRow) ?? null;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: 'Kategori bulunamadı — Kashe' };

  const title = category.seo_title || `${category.name_tr} — Kashe`;
  return {
    title,
    description:
      category.description ??
      `${category.name_tr} kategorisinde doğrulanmış profesyonelleri Kashe'de keşfedin.`,
  };
}

export default async function KategoriPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const category = await getCategory(slug);
  if (!category) {
    notFound();
  }

  // Bu kategorideki yayında profiller
  const { data: profilesData } = await supabase
    .from('profiles')
    .select(
      `
      id, full_name, avatar_url, bio, city_id, primary_category_id, company_name, role, attributes, created_at, approval_status, premium_tier, premium_until,
      turkish_cities(name),
      service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)
    `
    )
    .eq('is_published', true)
    .in('role', ['professional', 'agency'])
    .eq('primary_category_id', category.id)
    .order('updated_at', { ascending: false });

  const profiles = (profilesData || []) as unknown as PublishedProfile[];

  // Premium profiller üstte — keşfetle aynı mantık (stable sort sırayı korur)
  const tierWeight = (tier: string | null, until: string | null): number => {
    if (!tier || tier === 'none') return 0;
    if (until && new Date(until).getTime() <= Date.now()) return 0;
    if (tier === 'agency') return 3;
    if (tier === 'plus') return 2;
    if (tier === 'premium') return 1;
    return 0;
  };
  profiles.sort(
    (a, b) =>
      tierWeight(b.premium_tier, b.premium_until) -
      tierWeight(a.premium_tier, a.premium_until)
  );
  const profileIds = profiles.map((p) => p.id);

  // Fiyat + puan verisi (kart için)
  const servicesByProfile: Record<string, ServicePriceInfo[]> = {};
  const ratingsByProfile: Record<string, { count: number; average: number }> = {};

  if (profileIds.length > 0) {
    const [{ data: servicesData }, { data: ratingsData }] = await Promise.all([
      supabase
        .from('services')
        .select('profile_id, price_min, price_max, price_on_request')
        .eq('is_active', true)
        .in('profile_id', profileIds),
      supabase
        .from('professional_rating_summary')
        .select('professional_id, review_count, average_rating')
        .in('professional_id', profileIds),
    ]);

    (servicesData || []).forEach((svc) => {
      if (!servicesByProfile[svc.profile_id]) servicesByProfile[svc.profile_id] = [];
      servicesByProfile[svc.profile_id].push({
        price_min: svc.price_min,
        price_max: svc.price_max,
        price_on_request: svc.price_on_request,
      });
    });

    (ratingsData || []).forEach((r) => {
      ratingsByProfile[r.professional_id] = {
        count: r.review_count,
        average: r.average_rating,
      };
    });
  }

  // Kullanıcı durumu (favori + rol)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserRole: string | null = null;
  let favoritedIds = new Set<string>();

  if (user) {
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    currentUserRole = currentProfile?.role ?? null;
    if (currentUserRole === 'client') {
      favoritedIds = await getFavoritedIds();
    }
  }

  const isLoggedIn = !!user;
  const iconUrl = getCategoryIcon(category.slug);

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper">
        {/* HERO */}
        <section className="border-b border-line bg-card relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-24 -right-24 w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(200,68,42,0.12) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />
          <div className="max-w-5xl mx-auto px-6 md:px-12 py-14 md:py-20 relative">
            <Link
              href="/kesfet"
              className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors inline-flex items-center gap-1.5 mb-8"
            >
              ← Tüm kategoriler
            </Link>

            <div className="flex items-start gap-5 flex-wrap">
              {iconUrl && (
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(200,68,42,0.10)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={iconUrl}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-contain p-2"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-3">
                  Kategori
                </p>
                <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
                  {category.name_tr}
                </h1>
                {category.description && (
                  <p className="text-ink-72 text-lg mt-4 max-w-2xl leading-relaxed">
                    {category.description}
                  </p>
                )}
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mt-5">
                  {profiles.length} profesyonel
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PROFİLLER */}
        <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
          {profiles.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Bu kategoride henüz profil yok"
              description="Bu alanda yetenekler kayıt sürecinde. Çok yakında burası dolacak. Diğer kategorilere göz atabilirsin."
              action={{ label: 'Tüm kategorileri keşfet', href: '/kesfet' }}
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
                <h2 className="font-display text-2xl text-ink">
                  {category.name_tr}{' '}
                  <span className="text-ink-72">profesyonelleri</span>
                </h2>
                <Link
                  href={`/kesfet?kategori=${category.id}`}
                  className="font-mono text-xs uppercase tracking-[0.14em] text-terracotta hover:underline"
                >
                  Filtrele ve ara →
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 auto-rows-fr">
                {profiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    services={servicesByProfile[profile.id] || []}
                    rating={ratingsByProfile[profile.id] || null}
                    isFavorited={favoritedIds.has(profile.id)}
                    isLoggedIn={isLoggedIn}
                    currentUserRole={currentUserRole}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* CTA — ilan aç / teklif topla */}
        <section className="border-t border-line bg-card">
          <div className="max-w-5xl mx-auto px-6 md:px-12 py-14 text-center">
            <h2 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
              Aradığını{' '}
              <em className="text-terracotta not-italic italic font-medium">
                bulamadın mı
              </em>
              ?
            </h2>
            <p className="text-ink-72 mt-3 max-w-xl mx-auto">
              İhtiyacını anlat, {category.name_tr.toLocaleLowerCase('tr')}{' '}
              kategorisindeki profesyoneller sana özel teklif göndersin.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
              <Link
                href="/teklif-topla"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
              >
                Teklif topla
              </Link>
              <Link
                href="/ilanlar/yeni"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-transparent border border-ink text-ink rounded-lg font-display font-semibold text-sm hover:bg-ink hover:text-paper transition-all"
              >
                İlan aç
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
