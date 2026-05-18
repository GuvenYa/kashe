import { createClient } from '@/app/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { IletisimButton } from './iletisim-button';
import { YorumButton } from './yorum-button';
import FavoriteButton from '@/app/components/FavoriteButton';
import { isFavorited as checkIsFavorited } from '@/app/favoriler/actions';
import { ReviewCard } from '@/app/yorumlar/review-card';
import {
  formatPriceRange,
  formatDuration,
  getRoleLabel,
  formatLastSeen,
  getLastSeenTone,
} from '@/app/lib/profile-helpers';
import type { ServiceWithCategory, PortfolioItem } from '@/app/lib/types';

type PublicProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city_id: number | null;
  primary_category_id: number | null;
  company_name: string | null;
  role: string;
  is_published: boolean;
  last_seen_at: string | null;
  turkish_cities: { name: string } | null;
  service_categories: { name_tr: string; emoji: string | null } | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('full_name, company_name, role, is_published')
    .eq('id', id)
    .single();

  if (
    !data ||
    !data.is_published ||
    (data.role !== 'professional' && data.role !== 'business')
  ) {
    return { title: 'Profil bulunamadı — Kashe' };
  }

  const name =
    data.role === 'business' && data.company_name
      ? data.company_name
      : data.full_name || 'Profil';

  return {
    title: `${name} — Kashe`,
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profileData } = await supabase
    .from('profiles')
    .select(
      `
      id, full_name, avatar_url, bio, city_id, primary_category_id, company_name, role, is_published, last_seen_at,
      turkish_cities(name),
      service_categories!profiles_primary_category_id_fkey(name_tr, emoji)
    `
    )
    .eq('id', id)
    .single();

  if (!profileData) {
    notFound();
  }

  const profile = profileData as unknown as PublicProfile;

  // Kamu profili sadece profesyonel ve kurumsal için açık
  // Müşteri profilleri kapalı — sadece mesajlaşma sayfasındaki panel üzerinden görünür
  if (!profile.is_published) {
    notFound();
  }
  if (profile.role !== 'professional' && profile.role !== 'business') {
    notFound();
  }

  // Hizmetler + Portföy
  const [{ data: servicesData }, { data: portfolioData }] = await Promise.all([
    supabase
      .from('services')
      .select('*, service_categories(name_tr, emoji)')
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('portfolio_items')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false }),
  ]);

  const services = (servicesData || []) as ServiceWithCategory[];
  const portfolioItems = (portfolioData || []) as PortfolioItem[];

  // Mevcut kullanıcı bilgisi
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserRole: string | null = null;
  if (user) {
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    currentUserRole = currentProfile?.role ?? null;
  }

  const isLoggedIn = !!user;
  const isOwnProfile = user?.id === profile.id;
  const currentUserIsProfessional = currentUserRole === 'professional';

  // Favori durumu — sadece başkasının profesyonel profilinde anlamlı
  const showFavoriteButton =
    !isOwnProfile && profile.role === 'professional';
  let initialFavorited = false;
  if (showFavoriteButton && isLoggedIn && currentUserRole === 'client') {
    initialFavorited = await checkIsFavorited(profile.id);
  }

  // Yorum sistemi için: mesajlaşma var mı + mevcut yorum
  let hasConversation = false;
  let existingReview: {
    id: string;
    rating: number;
    body: string | null;
  } | null = null;

  const canReview =
    isLoggedIn && !isOwnProfile && currentUserRole === 'client';

  if (canReview) {
    const [{ data: convData }, { data: reviewData }] = await Promise.all([
      supabase
        .from('conversations')
        .select('id')
        .eq('customer_id', user!.id)
        .eq('professional_id', profile.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('reviews')
        .select('id, rating, body')
        .eq('customer_id', user!.id)
        .eq('professional_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    hasConversation = !!convData;
    existingReview = reviewData ?? null;
  }

  // Yorumlar listesi + ortalama puan + profesyonel yanıtları + müşteri profilleri
  const [
    { data: ratingData },
    { data: recentReviewsData },
  ] = await Promise.all([
    supabase
      .from('professional_rating_summary')
      .select('review_count, average_rating')
      .eq('professional_id', profile.id)
      .maybeSingle(),
    supabase
      .from('reviews')
      .select('id, rating, body, created_at, customer_id')
      .eq('professional_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  const reviewCount = ratingData?.review_count ?? 0;
  const averageRating = ratingData?.average_rating ?? 0;
  const recentReviews = recentReviewsData ?? [];

  // Müşteri profilleri + yanıtları toplu çek
  type CustomerMini = {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  type ReplyMini = {
    id: string;
    review_id: string;
    body: string;
    created_at: string;
    updated_at: string;
  };

  let customerMap = new Map<string, CustomerMini>();
  let replyMap = new Map<string, ReplyMini>();

  if (recentReviews.length > 0) {
    const customerIds = recentReviews.map((r) => r.customer_id);
    const reviewIds = recentReviews.map((r) => r.id);

    const [{ data: customers }, { data: replies }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', customerIds),
      supabase
        .from('review_replies')
        .select('id, review_id, body, created_at, updated_at')
        .in('review_id', reviewIds),
    ]);

    (customers ?? []).forEach((c) => {
      customerMap.set(c.id, c as CustomerMini);
    });
    (replies ?? []).forEach((r) => {
      replyMap.set(r.review_id, r as ReplyMini);
    });
  }

  const isOwnedByProfessional = user?.id === profile.id;
  const displayName =
    profile.role === 'business' && profile.company_name
      ? profile.company_name
      : profile.full_name || 'İsimsiz';

  const initials = (profile.full_name || profile.company_name || 'K')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const categoryLabel = profile.service_categories
    ? `${profile.service_categories.emoji || ''} ${profile.service_categories.name_tr}`.trim()
    : null;

  const cityName = profile.turkish_cities?.name;

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/kesfet"
            className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors inline-flex items-center gap-1.5 mb-6"
          >
            ← Keşfet&apos;e dön
          </Link>

          {/* HEADER */}
          <div className="bg-white border border-line rounded-lg p-8 mb-6 relative">
            {showFavoriteButton && (
              <div className="absolute top-6 right-6 z-10">
                <FavoriteButton
                  professionalId={profile.id}
                  initialFavorited={initialFavorited}
                  isLoggedIn={isLoggedIn}
                  userRole={currentUserRole}
                  variant="detail"
                />
              </div>
            )}
            <div className="flex items-start gap-6 flex-wrap">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-28 h-28 rounded-full object-cover border-2 border-line shrink-0"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-4xl shrink-0">
                  {initials}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  {getRoleLabel(profile.role)}
                </p>
                <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
                  {displayName}
                </h1>
                {categoryLabel && (
                  <p className="text-ink-72 mt-1.5">{categoryLabel}</p>
                )}
                {cityName && (
                  <p className="text-sm text-ink-72 mt-2 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 12.25C7 12.25 11.375 8.4375 11.375 5.6875C11.375 3.27258 9.41492 1.3125 7 1.3125C4.58508 1.3125 2.625 3.27258 2.625 5.6875C2.625 8.4375 7 12.25 7 12.25Z" stroke="currentColor" strokeWidth="1" />
                      <circle cx="7" cy="5.6875" r="1.3125" stroke="currentColor" strokeWidth="1" />
                    </svg>
                    {cityName}
                  </p>
                )}
                {(() => {
                  const lastSeenText = formatLastSeen(profile.last_seen_at);
                  const tone = getLastSeenTone(profile.last_seen_at);
                  if (!lastSeenText) return null;

                  const dotColor =
                    tone === 'active'
                      ? 'bg-green-500'
                      : tone === 'recent'
                        ? 'bg-amber-500'
                        : 'bg-ink-72/40';
                  const textColor =
                    tone === 'active' ? 'text-ink' : 'text-ink-72';

                  return (
                    <p
                      className={`text-xs ${textColor} mt-1.5 flex items-center gap-1.5`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${dotColor}`}
                        aria-hidden="true"
                      />
                      {lastSeenText}
                    </p>
                  );
                })()}
                {reviewCount > 0 && (
                  <Link
                    href={`/p/${profile.id}/yorumlar`}
                    className="inline-flex items-center gap-2 mt-3 group"
                  >
                    <span className="flex items-center gap-1">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-terracotta)" stroke="var(--color-terracotta)" strokeWidth="1.5" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                      <span className="font-display font-semibold text-ink">
                        {averageRating}
                      </span>
                    </span>
                    <span className="text-sm text-ink-72 group-hover:text-terracotta transition-colors">
                      ({reviewCount} yorum)
                    </span>
                  </Link>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="text-ink mt-6 leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}
          </div>

          {/* PORTFÖY GALERİ */}
          {portfolioItems.length > 0 && (
            <div className="bg-white border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-6">Portföy</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {portfolioItems.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="aspect-square bg-paper rounded-lg overflow-hidden border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.media_url}
                        alt={item.caption || 'Portfolio'}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    {item.caption && (
                      <p className="text-xs text-ink-72 leading-relaxed line-clamp-2">
                        {item.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HİZMETLER */}
          {services.length > 0 && (
            <div className="bg-white border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-6">
                Sunulan hizmetler
              </h2>
              <div className="space-y-5">
                {services.map((service) => {
                  const priceLabel = formatPriceRange(
                    service.price_min,
                    service.price_max,
                    service.price_on_request
                  );
                  const durationLabel = formatDuration(service.duration_hours);
                  const catLabel = service.service_categories
                    ? `${service.service_categories.emoji || ''} ${service.service_categories.name_tr}`.trim()
                    : '';
                  return (
                    <div key={service.id} className="border-l-2 border-terracotta pl-5 py-1">
                      <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-1">
                        {catLabel}
                      </p>
                      <h3 className="font-display text-lg text-ink mb-1">
                        {service.title}
                      </h3>
                      <p className="text-sm text-ink-72 mb-2">
                        {[durationLabel, priceLabel].filter(Boolean).join(' · ')}
                      </p>
                      {service.description && (
                        <p className="text-sm text-ink-72 leading-relaxed whitespace-pre-wrap">
                          {service.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
{/* YORUMLAR (varsa) */}
          {recentReviews.length > 0 && (
            <div className="bg-white border border-line rounded-lg p-8 mb-6">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h2 className="font-display text-2xl text-ink">
                  Yorumlar
                </h2>
                {reviewCount > 3 && (
                  <Link
                    href={`/p/${profile.id}/yorumlar`}
                    className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors"
                  >
                    Tümünü gör ({reviewCount}) →
                  </Link>
                )}
              </div>
              <div className="space-y-4">
                {recentReviews.map((r) => (
                  <ReviewCard
                    key={r.id}
                    review={{
                      id: r.id,
                      rating: r.rating,
                      body: r.body,
                      created_at: r.created_at,
                    }}
                    customer={customerMap.get(r.customer_id) ?? null}
                    reply={replyMap.get(r.id) ?? null}
                    isOwnedByProfessional={isOwnedByProfessional}
                  />
                ))}
              </div>
            </div>
          )}

          {/* İLETİŞİM & YORUM BUTONLARI */}
          <div className="flex flex-col gap-3">
            <IletisimButton
              professionalId={profile.id}
              professionalName={displayName}
              isLoggedIn={isLoggedIn}
              currentUserIsProfessional={currentUserIsProfessional}
              isOwnProfile={isOwnProfile}
            />
            <YorumButton
              professionalId={profile.id}
              professionalName={displayName}
              hasConversation={hasConversation}
              existingReview={existingReview}
              enabled={canReview}
            />
          </div>
        </div>
      </main>
    </>
  );
}