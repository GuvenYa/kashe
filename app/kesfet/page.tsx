import { createClient } from '@/app/lib/supabase-server';
import Link from 'next/link';
import { SearchX, Users } from 'lucide-react';
import { TopNav } from '@/app/components/sections/top-nav';
import { ProfileCard } from './profile-card';
import { KesfetFilters } from './kesfet-filters';
import { SortDropdown } from './sort-dropdown';
import { EmptyState } from '@/app/components/EmptyState';
import { getFavoritedIds } from '@/app/favoriler/actions';
import { orderCities } from '@/app/lib/city-order';
import type {
  ServiceCategory,
  TurkishCity,
} from '@/app/lib/types';

export const metadata = {
  title: 'Keşfet — Kashe',
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
  turkish_cities: { name: string } | null;
  service_categories: { name_tr: string; emoji: string | null; slug: string } | null;
};

type ServicePriceInfo = {
  price_min: number | null;
  price_max: number | null;
  price_on_request: boolean;
};

type SearchParams = {
  kategori?: string;
  sehir?: string;
  q?: string;
  sirala?: 'yeni' | 'puan';
  tip?: 'profesyonel' | 'ajans';
};

export default async function KesfetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const categoryId = params.kategori ? parseInt(params.kategori, 10) : null;
  const cityId = params.sehir ? parseInt(params.sehir, 10) : null;
  const searchQuery = params.q?.trim() || '';
  const sortBy: 'yeni' | 'puan' = params.sirala === 'puan' ? 'puan' : 'yeni';
  const typeFilter: 'profesyonel' | 'ajans' | null =
    params.tip === 'profesyonel' || params.tip === 'ajans'
      ? params.tip
      : null;

  const [{ data: categories }, { data: cities }] = await Promise.all([
    supabase
      .from('service_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.from('turkish_cities').select('*').order('name'),
  ]);

  let query = supabase
    .from('profiles')
    .select(
      `
      id, full_name, avatar_url, bio, city_id, primary_category_id, company_name, role,
      turkish_cities(name),
      service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)
    `
    )
    .eq('is_published', true)
    .in('role', ['professional', 'agency'])
    .order('updated_at', { ascending: false });

  // Tip filtresi (profesyonel / ajans)
  if (typeFilter === 'profesyonel') {
    query = query.eq('role', 'professional');
  } else if (typeFilter === 'ajans') {
    query = query.eq('role', 'agency');
  }

  if (categoryId) {
    query = query.eq('primary_category_id', categoryId);
  }
  if (cityId) {
    query = query.eq('city_id', cityId);
  }
  if (searchQuery) {
    // Serbest metin: isim + firma adı + kategori adında ara.
    // Kategori adı eşleşmesini önce kategori listesinde bulup, eşleşen
    // kategori id'lerini sorguya ekliyoruz (ilişkili-tablo ilike'ından kaçınmak için).
    const lowerQuery = searchQuery.toLocaleLowerCase('tr');
    const matchedCategoryIds = (categories || [])
      .filter((c) =>
        c.name_tr.toLocaleLowerCase('tr').includes(lowerQuery)
      )
      .map((c) => c.id);

    const orConditions = [
      `full_name.ilike.%${searchQuery}%`,
      `company_name.ilike.%${searchQuery}%`,
    ];

    if (matchedCategoryIds.length > 0) {
      // primary_category_id IN (...) — profiles'ın kendi kolonu, join gerektirmez
      orConditions.push(
        `primary_category_id.in.(${matchedCategoryIds.join(',')})`
      );
    }

    query = query.or(orConditions.join(','));
  }

  const { data: profilesData, error } = await query;
  const profiles = (profilesData || []) as unknown as PublishedProfile[];

  const profileIds = profiles.map((p) => p.id);
  const servicesByProfile: Record<string, ServicePriceInfo[]> = {};

  if (profileIds.length > 0) {
    const { data: servicesData } = await supabase
      .from('services')
      .select('profile_id, price_min, price_max, price_on_request')
      .eq('is_active', true)
      .in('profile_id', profileIds);

    (servicesData || []).forEach((svc) => {
      if (!servicesByProfile[svc.profile_id]) {
        servicesByProfile[svc.profile_id] = [];
      }
      servicesByProfile[svc.profile_id].push({
        price_min: svc.price_min,
        price_max: svc.price_max,
        price_on_request: svc.price_on_request,
      });
    });
  }

  // Rating özetlerini topla
  const ratingsByProfile: Record<
    string,
    { count: number; average: number }
  > = {};

  if (profileIds.length > 0) {
    const { data: ratingsData } = await supabase
      .from('professional_rating_summary')
      .select('professional_id, review_count, average_rating')
      .in('professional_id', profileIds);

    (ratingsData || []).forEach((r) => {
      ratingsByProfile[r.professional_id] = {
        count: r.review_count,
        average: r.average_rating,
      };
    });
  }

  // Puana göre sırala (yüksekten alçağa). Yorumu olmayanlar sona.
  // Aynı puanlı profiller arasında daha çok yorumu olan üstte.
  if (sortBy === 'puan') {
    profiles.sort((a, b) => {
      const ra = ratingsByProfile[a.id];
      const rb = ratingsByProfile[b.id];
      const avgA = ra?.average ?? -1;
      const avgB = rb?.average ?? -1;
      if (avgA !== avgB) return avgB - avgA;
      const countA = ra?.count ?? 0;
      const countB = rb?.count ?? 0;
      return countB - countA;
    });
  }

  const hasFilters = !!(categoryId || cityId || searchQuery);

  // Mevcut kullanıcı + favori ID'leri (sadece müşteri rolünde anlamlı)
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

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
              Keşfet
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">
              Profesyonelleri{' '}
              <em className="text-terracotta not-italic italic font-medium">
                keşfet
              </em>
              .
            </h1>
            <p className="text-ink-72 text-lg mt-4 max-w-2xl">
              Etkinliğin için doğru profesyoneli burada bulacaksın.
            </p>
          </div>

          <KesfetFilters
            categories={(categories || []) as ServiceCategory[]}
            cities={orderCities((cities || []) as TurkishCity[])}
            currentCategory={categoryId}
            currentCity={cityId}
            currentSearch={searchQuery}
          />

          {/* Tip filtresi: Hepsi / Profesyoneller / Ajanslar */}
          <div className="flex gap-2 mt-6">
            {[
              { key: null, label: 'Hepsi' },
              { key: 'profesyonel', label: 'Profesyoneller' },
              { key: 'ajans', label: 'Ajanslar' },
            ].map((opt) => {
              const isActive = typeFilter === opt.key;
              const sp = new URLSearchParams();
              if (categoryId) sp.set('kategori', String(categoryId));
              if (cityId) sp.set('sehir', String(cityId));
              if (searchQuery) sp.set('q', searchQuery);
              if (sortBy === 'puan') sp.set('sirala', 'puan');
              if (opt.key) sp.set('tip', opt.key);
              const href = sp.toString()
                ? `/kesfet?${sp.toString()}`
                : '/kesfet';
              return (
                <Link
                  key={opt.label}
                  href={href}
                  className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-[0.1em] border transition ${
                    isActive
                      ? 'bg-ink text-paper border-ink'
                      : 'bg-transparent text-ink-72 border-line hover:border-ink'
                  }`}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>

          {error ? (
            <div className="bg-terracotta/10 border border-terracotta/30 rounded-lg p-6 mt-8">
              <p className="text-terracotta text-sm">
                Bir sorun oluştu, lütfen sayfayı yenile.
              </p>
            </div>
          ) : profiles.length === 0 ? (
            <div className="mt-8">
              {hasFilters ? (
                <EmptyState
                  icon={SearchX}
                  title="Bu kriterlere uygun sonuç bulunamadı"
                  description="Filtreleri değiştirip tekrar dene veya tüm filtreleri temizle."
                  action={{ label: 'Filtreleri temizle', href: '/kesfet' }}
                />
              ) : (
                <EmptyState
                  icon={Users}
                  title="Henüz yayında profil yok"
                  description="İlk profesyoneller ve ajanslar kayıt sürecinde. Yakında burada olacaklar."
                />
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap mt-8 mb-4">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72">
                  {profiles.length} sonuç
                </p>
                <SortDropdown currentSort={sortBy} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>
      </main>
    </>
  );
}