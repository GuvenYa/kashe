import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { PublishToggle } from './publish-toggle';
import { getUserFavorites } from '@/app/favoriler/actions';
import {
  isProfessional,
  isClient,
  isBusiness,
  getRoleLabel,
  getMissingPublishFields,
  canPublish,
  getCompletenessPercent,
  formatPriceRange,
  formatDuration,
} from '@/app/lib/profile-helpers';
import type { Profile, ServiceWithCategory, PortfolioItem } from '@/app/lib/types';

export const metadata = {
  title: 'Profilim — Kashe',
};

export default async function ProfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris');
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select(
      '*, turkish_cities(name), service_categories!profiles_primary_category_id_fkey(name_tr, emoji)'
    )
    .eq('id', user.id)
    .single();

  if (!profileData) {
    redirect('/giris');
  }

  const profile = profileData as Profile & {
    turkish_cities: { name: string } | null;
    service_categories: { name_tr: string; emoji: string | null } | null;
  };

  const isPro = isProfessional(profile);
  const isClientUser = isClient(profile);
  const isBusinessUser = isBusiness(profile);

  // Müşteri ise favorilerini çek (en yeni 4 + toplam sayı için)
  type FavoritePreview = {
    id: string;
    professional: {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      role: string;
      company_name: string | null;
    } | null;
  };

  let favoritesPreview: FavoritePreview[] = [];
  let favoritesTotal = 0;

  if (isClientUser) {
    const { favorites } = await getUserFavorites();
    favoritesTotal = favorites.length;
    favoritesPreview = favorites.slice(0, 4) as unknown as FavoritePreview[];
  }

  // Profesyonel ise hizmetleri + portfolio'yu da çek
  let services: ServiceWithCategory[] = [];
  let portfolioItems: PortfolioItem[] = [];
  if (isPro) {
    const [{ data: servicesData }, { data: portfolioData }] = await Promise.all([
      supabase
        .from('services')
        .select('*, service_categories(name_tr, emoji)')
        .eq('profile_id', user.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase
        .from('portfolio_items')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4),
    ]);
    services = (servicesData || []) as ServiceWithCategory[];
    portfolioItems = (portfolioData || []) as PortfolioItem[];
  }

  const cityName = profile.turkish_cities?.name;
  const categoryLabel = profile.service_categories
    ? `${profile.service_categories.emoji || ''} ${profile.service_categories.name_tr}`.trim()
    : null;

  const missingFields = getMissingPublishFields(profile, services);
  const canPub = canPublish(profile, services);
  const completeness = getCompletenessPercent(profile, services);

  const initials = (profile.full_name || '')
    .split(' ')
    .map((s: string) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const displayName =
    isBusinessUser && profile.company_name
      ? profile.company_name
      : profile.full_name || 'Kullanıcı';

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          {/* HEADER */}
          <div className="flex items-start justify-between mb-12 gap-4">
            <div className="flex items-center gap-5">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover border-2 border-line"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-2xl">
                  {initials || '?'}
                </div>
              )}
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  {getRoleLabel(profile.role)}
                </p>
                <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
                  {displayName}
                </h1>
                {isBusinessUser && profile.company_name && profile.full_name && (
                  <p className="text-ink-72 text-sm mt-1">
                    İletişim: {profile.full_name}
                  </p>
                )}
                {isPro && categoryLabel && (
                  <p className="text-ink-72 text-sm mt-1">{categoryLabel}</p>
                )}
              </div>
            </div>
            <Link
              href="/profil/duzenle"
              className="shrink-0 px-5 py-2.5 border border-ink text-ink rounded-lg font-display font-medium hover:bg-ink hover:text-paper transition-colors"
            >
              Düzenle
            </Link>
          </div>

          {/* PUBLISH TOGGLE */}
          {(isPro || isBusinessUser) && (
            <div className="mb-8">
              <PublishToggle
                isPublished={profile.is_published}
                canPublish={canPub}
                missingFields={missingFields}
              />
            </div>
          )}

          {/* COMPLETENESS BAR */}
          {completeness < 100 && (
            <div className="mb-8 bg-white border border-line rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72">
                  Profil tamlığı
                </p>
                <p className="font-display font-semibold text-ink text-sm">
                  %{completeness}
                </p>
              </div>
              <div className="w-full h-2 bg-paper rounded-full overflow-hidden">
                <div
                  className="h-full bg-terracotta transition-all"
                  style={{ width: `${completeness}%` }}
                />
              </div>
            </div>
          )}

          {/* INFO CARD */}
          <div className="bg-white border border-line rounded-lg p-8 space-y-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                Email
              </p>
              <p className="text-ink text-lg">{user.email}</p>
            </div>

            {profile.phone && (
              <div className="border-t border-line pt-6">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Telefon
                </p>
                <p className="text-ink text-lg">{profile.phone}</p>
              </div>
            )}

            {cityName && (
              <div className="border-t border-line pt-6">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Şehir
                </p>
                <p className="text-ink text-lg">{cityName}</p>
              </div>
            )}

            {profile.bio && (
              <div className="border-t border-line pt-6">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Hakkımda
                </p>
                <p className="text-ink text-base leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </div>
            )}
          </div>

          {/* PROFESYONEL: Hizmetler */}
          {isPro && (
            <div className="mt-8 bg-white border border-line rounded-lg p-8">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display text-2xl text-ink">Hizmetlerim</h2>
                <Link
                  href="/profil/hizmetlerim"
                  className="text-sm font-display font-medium text-terracotta hover:underline"
                >
                  {services.length === 0 ? 'Hizmet ekle →' : 'Tümünü yönet →'}
                </Link>
              </div>

              {services.length === 0 ? (
                <p className="text-ink-72">
                  Henüz hizmet eklemedin. Yayınlamak için en az 1 aktif hizmet gerekli.
                </p>
              ) : (
                <div className="space-y-4">
                  {services.slice(0, 3).map((service) => {
                    const priceLabel = formatPriceRange(
                      service.price_min,
                      service.price_max,
                      service.price_on_request
                    );
                    const durationLabel = formatDuration(service.duration_hours);
                    return (
                      <div
                        key={service.id}
                        className={`border-l-2 pl-4 py-1 ${
                          service.is_active
                            ? 'border-terracotta'
                            : 'border-line opacity-60'
                        }`}
                      >
                        <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-1">
                          {service.service_categories
                            ? `${service.service_categories.emoji || ''} ${service.service_categories.name_tr}`.trim()
                            : ''}
                          {!service.is_active && (
                            <span className="ml-2 text-terracotta">· Pasif</span>
                          )}
                        </p>
                        <p className="font-display text-base text-ink">
                          {service.title}
                        </p>
                        <p className="text-sm text-ink-72 mt-0.5">
                          {[durationLabel, priceLabel].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    );
                  })}
                  {services.length > 3 && (
                    <p className="text-sm text-ink-72 pt-2">
                      ve {services.length - 3} hizmet daha...
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PROFESYONEL: Portföy */}
          {isPro && (
            <div className="mt-6 bg-white border border-line rounded-lg p-8">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display text-2xl text-ink">Portföy</h2>
                <Link
                  href="/profil/portfoy"
                  className="text-sm font-display font-medium text-terracotta hover:underline"
                >
                  {portfolioItems.length === 0
                    ? 'Fotoğraf ekle →'
                    : 'Tümünü yönet →'}
                </Link>
              </div>

              {portfolioItems.length === 0 ? (
                <p className="text-ink-72">
                  Henüz portföy fotoğrafı eklemedin.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {portfolioItems.map((item) => (
                    <div
                      key={item.id}
                      className="aspect-square bg-paper rounded-lg overflow-hidden border border-line"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.media_url}
                        alt={item.caption || 'Portfolio'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* KURUMSAL / MÜŞTERİ: İlanlarım */}
          {(isBusinessUser || isClientUser) && (
            <div className="mt-8 bg-white border border-line rounded-lg p-8">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display text-2xl text-ink">İlanlarım</h2>
                <div className="flex items-center gap-4">
                  <Link
                    href="/ilanlarim"
                    className="text-sm font-display font-medium text-terracotta hover:underline"
                  >
                    Tümünü yönet →
                  </Link>
                  <Link
                    href="/ilanlar/yeni"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
                  >
                    <span className="text-base leading-none">+</span>
                    Yeni ilan aç
                  </Link>
                </div>
              </div>
              <p className="text-ink-72 text-sm">
                Etkinliğin için açtığın ilanlara gelen başvuruları görüntüle, kısa
                liste yap, ilanlarını yönet.
              </p>
            </div>
          )}

          {/* PROFESYONEL: Başvurularım */}
          {isPro && (
            <div className="mt-8 bg-white border border-line rounded-lg p-8">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display text-2xl text-ink">Başvurularım</h2>
                <Link
                  href="/basvurularim"
                  className="text-sm font-display font-medium text-terracotta hover:underline"
                >
                  Tümünü gör →
                </Link>
              </div>
              <p className="text-ink-72 text-sm">
                İlan tahtasından başvurduğun ilanları ve başvuru durumlarını
                buradan takip et.
              </p>
            </div>
          )}

          {/* MÜŞTERİ: Favorilerim */}
          {isClientUser && (
            <div className="mt-8 bg-white border border-line rounded-lg p-8">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display text-2xl text-ink">Favorilerim</h2>
                <Link
                  href="/favoriler"
                  className="text-sm font-display font-medium text-terracotta hover:underline"
                >
                  {favoritesTotal === 0 ? 'Keşfet\'e git →' : 'Tümünü gör →'}
                </Link>
              </div>

              {favoritesTotal === 0 ? (
                <p className="text-ink-72">
                  Henüz favorin yok. Beğendiğin profesyonelleri favorilerine ekle,
                  buradan kolayca ulaş.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {favoritesPreview.map((fav) => {
                      const pro = fav.professional;
                      if (!pro) return null;
                      const displayName =
                        pro.role === 'business' && pro.company_name
                          ? pro.company_name
                          : pro.full_name || 'İsimsiz';
                      const proInitials = (displayName || 'K')
                        .split(' ')
                        .map((s) => s[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();
                      return (
                        <Link
                          key={fav.id}
                          href={`/p/${pro.id}`}
                          className="group flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-paper transition-colors"
                        >
                          {pro.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={pro.avatar_url}
                              alt={displayName}
                              className="w-16 h-16 rounded-full object-cover border-2 border-line group-hover:border-terracotta transition-colors"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-lg">
                              {proInitials}
                            </div>
                          )}
                          <p className="font-display text-sm text-ink text-center line-clamp-1 group-hover:text-terracotta transition-colors">
                            {displayName}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                  {favoritesTotal > 4 && (
                    <p className="text-sm text-ink-72 mt-3">
                      ve {favoritesTotal - 4} favori daha...
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* USER ID */}
          <div className="mt-12 pt-8 border-t border-line">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72/60 mb-1">
              Kullanıcı ID
            </p>
            <p className="text-ink-72/60 text-xs font-mono break-all">
              {profile.id}
            </p>
          </div>
        </div>
      </main>
    </>
  );
}