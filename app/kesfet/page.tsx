import { createClient } from '@/app/lib/supabase-server';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { ProfileCard } from './profile-card';
import { KesfetFilters } from './kesfet-filters';
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
  service_categories: { name_tr: string; emoji: string | null } | null;
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
      service_categories!profiles_primary_category_id_fkey(name_tr, emoji)
    `
    )
    .eq('is_published', true)
    .order('updated_at', { ascending: false });

  if (categoryId) {
    query = query.eq('primary_category_id', categoryId);
  }
  if (cityId) {
    query = query.eq('city_id', cityId);
  }
  if (searchQuery) {
    query = query.or(
      `full_name.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%`
    );
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

  const hasFilters = !!(categoryId || cityId || searchQuery);

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
            cities={(cities || []) as TurkishCity[]}
            currentCategory={categoryId}
            currentCity={cityId}
            currentSearch={searchQuery}
          />

          {error ? (
            <div className="bg-terracotta/10 border border-terracotta/30 rounded-lg p-6 mt-8">
              <p className="text-terracotta text-sm">
                Bir sorun oluştu, lütfen sayfayı yenile.
              </p>
            </div>
          ) : profiles.length === 0 ? (
            <div className="bg-white border border-line rounded-lg p-12 text-center mt-8">
              <p className="font-display text-2xl text-ink mb-3">
                {hasFilters
                  ? 'Bu kriterlere uygun profesyonel bulunamadı.'
                  : 'Henüz yayında profesyonel yok.'}
              </p>
              <p className="text-ink-72 max-w-md mx-auto">
                {hasFilters ? (
                  <>
                    Filtreleri değiştirip tekrar dene.{' '}
                    <Link
                      href="/kesfet"
                      className="text-terracotta hover:underline"
                    >
                      Tüm filtreleri temizle
                    </Link>
                    .
                  </>
                ) : (
                  'İlk profesyoneller kayıt sürecinde. Yakında burada olacaklar.'
                )}
              </p>
            </div>
          ) : (
            <>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mt-8 mb-4">
                {profiles.length} sonuç
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    services={servicesByProfile[profile.id] || []}
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