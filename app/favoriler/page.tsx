import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { TopNav } from '@/app/components/sections/top-nav';
import { ProfileCard } from '../kesfet/profile-card';
import { EmptyState } from '@/app/components/EmptyState';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { getCachedUser } from '@/app/lib/auth';
import { getUserFavorites, getFavoritedIds } from './actions';

export const metadata = {
  title: 'Favorilerim — Kashe',
};

type FavoritedProfessional = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  company_name: string | null;
  role: string;
  city_id: number | null;
  primary_category_id: number | null;
  is_published: boolean;
};

type ServicePriceInfo = {
  price_min: number | null;
  price_max: number | null;
  price_on_request: boolean;
};

export default async function FavorilerPage() {
  const supabase = await createClient();

  // Auth kontrol
const user = await getCachedUser();

  // Durum 1: Giriş yapmamış
  if (!user) {
    return (
      <>
        <TopNav />
        <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
          <div className="max-w-3xl mx-auto">
            <div className="mb-10">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
                Favorilerim
              </p>
              <h1 className="font-display font-semibold text-4xl md:text-5xl text-ink tracking-tight">
                Önce{' '}
                <em className="text-brand-ink not-italic italic font-medium">
                  giriş yap
                </em>
                .
              </h1>
            </div>
            <div className="bg-card border border-line rounded-lg p-12 text-center">
              <p className="font-display text-xl text-ink mb-3">
                Favorilerini görmek için giriş yapmalısın.
              </p>
              <p className="text-ink-72 max-w-md mx-auto mb-6">
                Beğendiğin profesyonelleri kaydet, sonra kolayca geri dön.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link
                  href="/giris"
                  className="inline-block px-6 py-3 bg-brand-ink text-paper font-mono text-xs uppercase tracking-[0.16em] rounded hover:bg-brand-ink/90 transition-colors"
                >
                  Giriş yap
                </Link>
                <Link
                  href="/uye-ol"
                  className="inline-block px-6 py-3 border border-line text-ink font-mono text-xs uppercase tracking-[0.16em] rounded hover:border-brand-ink hover:text-brand-ink transition-colors"
                >
                  Kayıt ol
                </Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Kullanıcı rolü + suspension kontrolü
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .single();

  // Suspension kontrolü — askıdaki kullanıcı favorileri göremez
  if (profile?.suspended_at) return <SuspendedNotice />;

  const userRole = profile?.role ?? null;


  // Durum 2: Müşteri değil
  if (userRole !== 'client') {
    return (
      <>
        <TopNav />
        <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
          <div className="max-w-3xl mx-auto">
            <div className="mb-10">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
                Favorilerim
              </p>
              <h1 className="font-display font-semibold text-4xl md:text-5xl text-ink tracking-tight">
                Bu sayfa{' '}
                <em className="text-brand-ink not-italic italic font-medium">
                  müşterilere özel
                </em>
                .
              </h1>
            </div>
            <div className="bg-card border border-line rounded-lg p-12 text-center">
              <p className="font-display text-xl text-ink mb-3">
                Favoriler sadece müşteri hesaplarında çalışıyor.
              </p>
              <p className="text-ink-72 max-w-md mx-auto">
                Profesyonel ve kurumsal hesaplar profilleri keşfedebilir ama
                favoriye ekleyemez.
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Durum 3: Müşteri — favorileri çek
  const { favorites, error } = await getUserFavorites();

  // Durum 3a: Hata
  if (error) {
    return (
      <>
        <TopNav />
        <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
          <div className="max-w-3xl mx-auto">
            <div className="bg-danger-08 border border-danger/30 rounded-lg p-6">
              <p className="text-danger text-sm">
                Bir sorun oluştu, lütfen sayfayı yenile.
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Durum 3b: Boş
  if (favorites.length === 0) {
    return (
      <>
        <TopNav />
        <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
          <div className="max-w-3xl mx-auto">
            <div className="mb-10">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
                Favorilerim
              </p>
              <h1 className="font-display font-semibold text-4xl md:text-5xl text-ink tracking-tight">
                Henüz favorin{' '}
                <em className="text-brand-ink not-italic italic font-medium">
                  yok
                </em>
                .
              </h1>
            </div>
            <EmptyState
              icon={Heart}
              title="Beğeni listen boş"
              description="Beğendiğin yetenekleri burada topla. Bir profilin kalbine dokun, favorilerinde belirsin."
              action={{ label: "Keşfet'e git", href: '/kesfet' }}
            />
          </div>
        </main>
      </>
    );
  }

  // Durum 3c: Müşteri + favorileri var — listeyi göster
  // Profil ID'lerini çıkar, gerekli ek verileri çek (city, kategori, services, ratings)
  const professionals = favorites
    .map((f) => f.professional)
    .filter(Boolean) as unknown as FavoritedProfessional[];

  const professionalIds = professionals.map((p) => p.id);

  // city + kategori detaylarını profillerden çek (favorites query'sinde join yok, ayrı çekiyoruz)
  const { data: profilesDetailData } = await supabase
    .from('profiles')
    .select(
      `
      id, city_id, primary_category_id,
      approval_status, premium_tier, premium_until, created_at, attributes,
      turkish_cities(name),
      service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)
    `
    )
    .in('id', professionalIds);

  const cityCategoryMap = new Map<
    string,
    {
      turkish_cities: { name: string } | null;
      service_categories: { name_tr: string; emoji: string | null; slug: string } | null;
      approval_status: string | null;
      premium_tier: string | null;
      premium_until: string | null;
      created_at: string | null;
      attributes: Record<string, string | string[]> | null;
    }
  >();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (profilesDetailData || []).forEach((p: any) => {
    cityCategoryMap.set(p.id, {
      turkish_cities: p.turkish_cities,
      service_categories: p.service_categories,
      approval_status: p.approval_status ?? null,
      premium_tier: p.premium_tier ?? null,
      premium_until: p.premium_until ?? null,
      created_at: p.created_at ?? null,
      attributes: p.attributes ?? null,
    });
  });

  // Services
  const { data: servicesData } = await supabase
    .from('services')
    .select('profile_id, price_min, price_max, price_on_request')
    .eq('is_active', true)
    .in('profile_id', professionalIds);

  const servicesByProfile: Record<string, ServicePriceInfo[]> = {};
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

  // Ratings
  const { data: ratingsData } = await supabase
    .from('professional_rating_summary')
    .select('professional_id, review_count, average_rating')
    .in('professional_id', professionalIds);

  const ratingsByProfile: Record<
    string,
    { count: number; average: number }
  > = {};
  (ratingsData || []).forEach((r) => {
    ratingsByProfile[r.professional_id] = {
      count: r.review_count,
      average: r.average_rating,
    };
  });

  // Favori ID'leri (ProfileCard initialFavorited prop için)
  const favoritedIds = await getFavoritedIds();

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
              Favorilerim
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">
              Kaydettiğin{' '}
              <em className="text-brand-ink not-italic italic font-medium">
                profiller
              </em>
              .
            </h1>
            <p className="text-ink-72 text-lg mt-4 max-w-2xl">
              Beğendiğin profiller burada. Kalp simgesine tekrar tıklayarak
              listeden çıkarabilirsin.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72">
              {professionals.length} favori
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {professionals.map((p) => {
              const cityCat = cityCategoryMap.get(p.id);
              return (
                <ProfileCard
                  key={p.id}
                  profile={{
                    id: p.id,
                    full_name: p.full_name,
                    avatar_url: p.avatar_url,
                    bio: p.bio,
                    company_name: p.company_name,
                    role: p.role,
                    approval_status: cityCat?.approval_status ?? null,
                    premium_tier: cityCat?.premium_tier ?? null,
                    premium_until: cityCat?.premium_until ?? null,
                    created_at: cityCat?.created_at ?? null,
                    attributes: cityCat?.attributes ?? null,
                    turkish_cities: cityCat?.turkish_cities ?? null,
                    service_categories: cityCat?.service_categories ?? null,
                  }}
                  services={servicesByProfile[p.id] || []}
                  rating={ratingsByProfile[p.id] || null}
                  isFavorited={favoritedIds.has(p.id)}
                  isLoggedIn={true}
                  currentUserRole="client"
                />
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}