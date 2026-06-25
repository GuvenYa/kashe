import { createClient } from '@/app/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { IletisimButton } from './iletisim-button';
import { RezervasyonButton } from './rezervasyon-button';
import { HizmetSecici } from './hizmet-secici';
import { DavetButton } from './davet-button';
import { YorumButton } from './yorum-button';
import FavoriteButton from '@/app/components/FavoriteButton';
import { isFavorited as checkIsFavorited, getFavoritedIds } from '@/app/favoriler/actions';
import { ReviewCard } from '@/app/yorumlar/review-card';
import { ProfileCard } from '@/app/kesfet/profile-card';
import { SikayetButton } from '@/app/sikayet/sikayet-button';
import {
  formatPriceRange,
  formatDuration,
  getRoleLabel,
  formatLastSeen,
  getLastSeenTone,
} from '@/app/lib/profile-helpers';
import type { ServiceWithCategory, PortfolioItem, ServicePackage } from '@/app/lib/types';
import { getFilterFields } from '@/app/lib/filter-config';
import { getBadges, isVerified, BADGE_TONE_CLASS } from '@/app/lib/badges';
import { PortfolioGallery } from '@/app/components/portfolio-gallery';
import { AvailabilityCalendar } from '@/app/components/availability-calendar';
import { incrementProfileViews } from './profile-views-actions';

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
  approval_status: string | null;
  created_at: string | null;
  attributes: Record<string, string | string[]> | null;
  turkish_cities: { name: string } | null;
  service_categories: { name_tr: string; emoji: string | null; slug: string } | null;
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
    (data.role !== 'professional' &&
      data.role !== 'business' &&
      data.role !== 'agency')
  ) {
    return { title: 'Profil bulunamadı — Kashe' };
  }

  const name =
    (data.role === 'business' || data.role === 'agency') && data.company_name
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
      id, full_name, avatar_url, bio, city_id, primary_category_id, company_name, role, is_published, last_seen_at, attributes, approval_status, created_at,
      turkish_cities(name),
      service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)
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
  if (
    profile.role !== 'professional' &&
    profile.role !== 'business' &&
    profile.role !== 'agency'
  ) {
    notFound();
  }

  // Görüntülenme say (fire-and-forget, sahibi kendi profilini saymaz)
  incrementProfileViews(profile.id).catch(() => {
    // sessiz fail
  });

  const isAgencyProfile = profile.role === 'agency';

  // Ajans ise: barındırdığı profesyonelleri çek
  type AgencyTeamMember = {
    id: string;
    member_role: string;
    professional: {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      bio: string | null;
      service_categories: { name_tr: string; emoji: string | null } | null;
    } | null;
  };

  let agencyTeam: AgencyTeamMember[] = [];
  if (isAgencyProfile) {
    const { data: teamData } = await supabase
      .from('agency_members')
      .select(
        `
        id, member_role,
        professional:profiles!agency_members_professional_id_fkey (
          id, full_name, avatar_url, bio,
          service_categories!profiles_primary_category_id_fkey (name_tr, emoji)
        )
      `
      )
      .eq('agency_id', profile.id)
      .order('joined_at', { ascending: false });

    agencyTeam = (teamData ?? []) as unknown as AgencyTeamMember[];
  }

  // Profesyonel ise: temsil eden ajanslar
  type RepresentingAgency = {
    id: string;
    agency: {
      id: string;
      full_name: string | null;
      company_name: string | null;
      avatar_url: string | null;
    } | null;
  };
  let representingAgencies: RepresentingAgency[] = [];
  if (profile.role === 'professional') {
    const { data: repData } = await supabase
      .from('agency_members')
      .select(
        `
        id,
        agency:profiles!agency_members_agency_id_fkey (
          id, full_name, company_name, avatar_url
        )
      `
      )
      .eq('professional_id', profile.id)
      .order('joined_at', { ascending: false });

    representingAgencies = (repData ?? []) as unknown as RepresentingAgency[];
  }
  // Hizmetler + Portföy + Paketler + Müsaitlik
  const [
    { data: servicesData },
    { data: portfolioData },
    { data: packagesData },
    { data: blocksData },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('*, service_categories(name_tr, emoji), service_addons(*)')
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('portfolio_items')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('service_packages')
      .select('*')
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('availability_blocks')
      .select('blocked_date')
      .eq('profile_id', profile.id),
  ]);

  const services = (servicesData || []) as ServiceWithCategory[];
  const portfolioItems = (portfolioData || []) as PortfolioItem[];
  const packages = (packagesData || []) as ServicePackage[];
  const blockedDates = (blocksData || []).map(
    (b) => b.blocked_date as string
  );

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

  // Favori durumu — başkasının profesyonel veya ajans profilinde anlamlı
  const showFavoriteButton =
    !isOwnProfile &&
    (profile.role === 'professional' || profile.role === 'agency');
  let initialFavorited = false;
  if (showFavoriteButton && isLoggedIn && currentUserRole === 'client') {
    initialFavorited = await checkIsFavorited(profile.id);
  }

  // Yorum sistemi için: mesajlaşma var mı + mevcut yorum
  // Yorum sistemi için: tamamlanmış rezervasyon var mı + mevcut yorum
  // Eski: hasConversation (sadece mesajlaşma yeterdi). Yeni: hasCompletedBooking.
  // Mevcut yorumlar veritabanında korunur (recentReviews listesinde görünmeye devam eder),
  // ama yeni yorum bırakma akışı tamamlanmış iş şartına bağlandı — daha güvenilir.
  let hasCompletedBooking = false;
  let existingReview: {
    id: string;
    rating: number;
    body: string | null;
  } | null = null;

  const canReview =
    isLoggedIn && !isOwnProfile && currentUserRole === 'client';

  if (canReview) {
    const [{ data: bookingData }, { data: reviewData }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id')
        .eq('customer_id', user!.id)
        .eq('professional_id', profile.id)
        .eq('status', 'completed')
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

    hasCompletedBooking = !!bookingData;
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

  const badgeInput = {
    approvalStatus: profile.approval_status,
    createdAt: profile.created_at,
    rating: { count: reviewCount, average: averageRating },
  };
  const profileBadges = getBadges(badgeInput);
  const profileVerified = isVerified(badgeInput);

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
    (profile.role === 'business' || profile.role === 'agency') &&
    profile.company_name
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

  // Kategoriye özel özellikleri grupla (gösterim için)
  const categorySlug = profile.service_categories?.slug ?? null;
  const attrGroups: { label: string; values: string[] }[] = [];
  if (categorySlug && profile.attributes) {
    const fields = getFilterFields(categorySlug);
    for (const field of fields) {
      const raw = profile.attributes[field.key];
      const vals = Array.isArray(raw) ? raw : raw ? [raw] : [];
      if (vals.length === 0) continue;
      const labels = vals.map(
        (v) => field.options.find((o) => o.value === v)?.label ?? v
      );
      attrGroups.push({ label: field.label, values: labels });
    }
  }

  // ---- BENZER PROFİLLER (additive) ----
  // Aynı kategorideki diğer YAYINDA + ONAYLI hizmet sağlayıcılar (professional/agency).
  // ProfileCard yeniden kullanılır; aynı şehir önce, sonra yüksek puan; ilk 6.
  type SimilarCandidate = {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    company_name: string | null;
    role: string;
    created_at: string | null;
    approval_status: string | null;
    premium_tier: string | null;
    premium_until: string | null;
    attributes: Record<string, string | string[]> | null;
    city_id: number | null;
    turkish_cities: { name: string } | null;
    service_categories: { name_tr: string; emoji: string | null; slug: string } | null;
  };

  let similarProfiles: SimilarCandidate[] = [];
  const similarServicesByProfile: Record<
    string,
    { price_min: number | null; price_max: number | null; price_on_request: boolean }[]
  > = {};
  const similarRatingsByProfile: Record<string, { count: number; average: number }> = {};
  let similarFavoritedIds = new Set<string>();

  if (profile.primary_category_id != null) {
    const { data: candidatesData } = await supabase
      .from('profiles')
      .select(
        `
        id, full_name, avatar_url, bio, company_name, role, created_at, approval_status, premium_tier, premium_until, attributes, city_id,
        turkish_cities(name),
        service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)
      `
      )
      .eq('primary_category_id', profile.primary_category_id)
      .eq('is_published', true)
      .eq('approval_status', 'approved')
      .in('role', ['professional', 'agency'])
      .neq('id', profile.id)
      .limit(12); // over-fetch; JS'te şehir+puan sıralanıp 6'ya inilir

    const candidates = (candidatesData ?? []) as unknown as SimilarCandidate[];

    if (candidates.length > 0) {
      const candidateIds = candidates.map((c) => c.id);

      // Fiyat + puan + favori (paralel)
      const [{ data: simServices }, { data: simRatings }, favIds] = await Promise.all([
        supabase
          .from('services')
          .select('profile_id, price_min, price_max, price_on_request')
          .eq('is_active', true)
          .in('profile_id', candidateIds),
        supabase
          .from('professional_rating_summary')
          .select('professional_id, review_count, average_rating')
          .in('professional_id', candidateIds),
        isLoggedIn && currentUserRole === 'client'
          ? getFavoritedIds()
          : Promise.resolve(new Set<string>()),
      ]);

      (simServices ?? []).forEach((svc) => {
        if (!similarServicesByProfile[svc.profile_id])
          similarServicesByProfile[svc.profile_id] = [];
        similarServicesByProfile[svc.profile_id].push({
          price_min: svc.price_min,
          price_max: svc.price_max,
          price_on_request: svc.price_on_request,
        });
      });

      (simRatings ?? []).forEach((r) => {
        similarRatingsByProfile[r.professional_id] = {
          count: r.review_count,
          average: r.average_rating,
        };
      });

      similarFavoritedIds = favIds;

      // Sıralama: aynı şehir önce, sonra yüksek puan (null = 0) → ilk 6
      similarProfiles = candidates
        .sort((a, b) => {
          const aCity = a.city_id === profile.city_id ? 1 : 0;
          const bCity = b.city_id === profile.city_id ? 1 : 0;
          if (aCity !== bCity) return bCity - aCity;
          const aRating = similarRatingsByProfile[a.id]?.average ?? 0;
          const bRating = similarRatingsByProfile[b.id]?.average ?? 0;
          return bRating - aRating;
        })
        .slice(0, 6);
    }
  }

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
          <div className="bg-card border border-line rounded-2xl p-8 mb-6">
            <div>
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
                <div
                  className={`w-28 h-28 rounded-full flex items-center justify-center text-paper font-display font-semibold text-4xl shrink-0 ${
                    isAgencyProfile ? 'bg-[#1E3A5F]' : 'bg-terracotta'
                  }`}
                >
                  {initials}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  {getRoleLabel(profile.role)}
                </p>
                <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight flex items-center gap-2">
                  <span>{displayName}</span>
                  {profileVerified && (
                    <span
                      title="Doğrulanmış"
                      aria-label="Doğrulanmış"
                      className="shrink-0 inline-flex"
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path
                          d="M12 2l2.4 1.8 3 -.2 .9 2.9 2.4 1.8 -1 2.9 1 2.9 -2.4 1.8 -.9 2.9 -3 -.2L12 22l-2.4-1.8-3 .2-.9-2.9L3.3 15.7l1-2.9-1-2.9 2.4-1.8.9-2.9 3 .2z"
                          fill="var(--color-moss)"
                        />
                        <path d="M8.5 12l2.2 2.2 4.3-4.4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </h1>
                {categoryLabel && (
                  <p className="text-ink-72 mt-1.5">{categoryLabel}</p>
                )}
                {profileBadges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {profileBadges.map((b) => (
                      <span
                        key={b.key}
                        className={`font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${BADGE_TONE_CLASS[b.tone]}`}
                      >
                        {b.label}
                      </span>
                    ))}
                  </div>
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-plum)" stroke="var(--color-plum)" strokeWidth="1.5" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
          </div>

          {/* KATEGORİYE ÖZEL ÖZELLİKLER */}
          {attrGroups.length > 0 && (
            <div className="bg-card border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-6">Özellikler</h2>
              <div className="space-y-5">
                {attrGroups.map((group) => (
                  <div key={group.label}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.values.map((val) => (
                        <span
                          key={val}
                          className="text-sm text-ink bg-paper border border-line px-3 py-1.5 rounded-lg"
                        >
                          {val}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EKİBİMİZ (ajans) */}
          {isAgencyProfile && (
            <div className="bg-card border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-1">Ekibimiz</h2>
              <p className="text-sm text-ink-72 mb-6">
                Bu ajansın çatısı altındaki profesyoneller.
              </p>
              {agencyTeam.length === 0 ? (
                <p className="text-ink-72 text-sm">
                  Bu ajans henüz ekibini oluşturuyor.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {agencyTeam.map((member) => {
                    const pro = member.professional;
                    if (!pro) return null;
                    const proName = pro.full_name || 'İsimsiz';
                    const proInitials = proName
                      .split(' ')
                      .map((s) => s[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    const proCategoryLabel = pro.service_categories
                      ? `${pro.service_categories.emoji || ''} ${pro.service_categories.name_tr}`.trim()
                      : null;
                    return (
                      <Link
                        key={member.id}
                        href={`/p/${pro.id}`}
                        className="flex items-center gap-3 border border-line rounded-lg p-4 hover:border-terracotta hover:shadow-[3px_3px_0_var(--color-terracotta)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all group"
                      >
                        {pro.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={pro.avatar_url}
                            alt={proName}
                            className="w-12 h-12 rounded-full object-cover border border-line shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold shrink-0">
                            {proInitials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-ink group-hover:text-terracotta transition-colors truncate">
                            {proName}
                          </p>
                          {proCategoryLabel && (
                            <p className="text-xs text-ink-72 truncate">
                              {proCategoryLabel}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TEMSİL EDEN AJANSLAR (profesyonel) */}
          {profile.role === 'professional' &&
            representingAgencies.length > 0 && (
              <div className="bg-[#1E3A5F]/5 border border-[#1E3A5F]/15 rounded-lg p-6 mb-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#1E3A5F] mb-3">
                  Ajans temsili
                </p>
                <p className="text-sm text-ink-72 mb-4">
                  Bu profesyonel şu ajans
                  {representingAgencies.length > 1 ? 'lar' : ''} tarafından
                  temsil ediliyor:
                </p>
                <div className="flex flex-wrap gap-2">
                  {representingAgencies.map((r) => {
                    const ag = r.agency;
                    if (!ag) return null;
                    const agName =
                      ag.company_name || ag.full_name || 'İsimsiz ajans';
                    const agInitials = agName
                      .split(' ')
                      .map((s) => s[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    return (
                      <Link
                        key={r.id}
                        href={`/p/${ag.id}`}
                        className="inline-flex items-center gap-2 bg-card border border-[#1E3A5F]/20 rounded-full pl-1.5 pr-4 py-1.5 hover:border-[#1E3A5F] hover:shadow-[2px_2px_0_#1E3A5F] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all group"
                      >
                        {ag.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={ag.avatar_url}
                            alt={agName}
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white font-display font-semibold text-xs shrink-0">
                            {agInitials}
                          </div>
                        )}
                        <span className="font-display font-medium text-sm text-ink group-hover:text-[#1E3A5F] transition-colors">
                          {agName}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

          {/* PORTFÖY GALERİ */}
          {portfolioItems.length > 0 && (
            <div className="bg-card border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-6">Portföy</h2>
              <PortfolioGallery
                items={portfolioItems}
                gridClassName="grid grid-cols-2 md:grid-cols-3 gap-3"
              />
            </div>
          )}

          {/* PAKETLER */}
          {packages.length > 0 && (
            <div className="bg-card border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-1">Paketler</h2>
              <p className="text-sm text-ink-72 mb-6">
                Hazır paketler — ihtiyacına en yakınını seçip doğrudan iletişime
                geç.
              </p>
              <div className="space-y-4">
                {packages.map((pkg) => {
                  const pkgPrice = formatPriceRange(
                    pkg.price_min,
                    pkg.price_max,
                    pkg.price_on_request
                  );
                  return (
                    <div
                      key={pkg.id}
                      className="border border-line rounded-xl p-5 hover:border-terracotta/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
                        <h3 className="font-display text-xl text-ink">
                          {pkg.title}
                        </h3>
                        {pkgPrice && (
                          <span className="font-display font-semibold text-terracotta text-lg shrink-0">
                            {pkgPrice}
                          </span>
                        )}
                      </div>
                      {pkg.description && (
                        <p className="text-sm text-ink-72 leading-relaxed whitespace-pre-wrap mb-3">
                          {pkg.description}
                        </p>
                      )}
                      {pkg.includes && pkg.includes.length > 0 && (
                        <ul className="space-y-1.5 mb-4">
                          {pkg.includes.map((item, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-ink"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5 text-moss" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {!isOwnProfile && (
                        <IletisimButton
                          professionalId={profile.id}
                          professionalName={displayName}
                          categorySlug={profile.service_categories?.slug ?? null}
                          isLoggedIn={isLoggedIn}
                          currentUserIsProfessional={currentUserIsProfessional}
                          isOwnProfile={isOwnProfile}
                          packageContext={{
                            title: pkg.title,
                            price: pkgPrice,
                          }}
                          variant="package"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* HİZMETLER */}
          {services.length > 0 && (
            <div className="bg-card border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-6">
                Sunulan hizmetler
              </h2>
              <div className="space-y-5">
                {services.map((service) => (
                  <HizmetSecici
                    key={service.id}
                    service={service}
                    professionalId={profile.id}
                    professionalName={displayName}
                    categorySlug={profile.service_categories?.slug ?? null}
                    isLoggedIn={isLoggedIn}
                    currentUserIsProfessional={currentUserIsProfessional}
                    isOwnProfile={isOwnProfile}
                  />
                ))}
              </div>
            </div>
          )}
{/* MÜSAİTLİK (varsa) — salt görüntüleme */}
          {blockedDates.length > 0 && (
            <div className="bg-card border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-1">Müsaitlik</h2>
              <p className="text-sm text-ink-72 mb-6">
                İşaretli günler dolu. Diğer günler için iletişime geçebilirsin.
              </p>
              <AvailabilityCalendar
                blockedDates={blockedDates}
                bookedDates={[]}
                editable={false}
              />
            </div>
          )}

          {/* YORUMLAR (varsa) */}
          {recentReviews.length > 0 && (
            <div className="bg-card border border-line rounded-lg p-8 mb-6">
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
                    isLoggedIn={isLoggedIn}
                  />
                ))}
              </div>
            </div>
          )}

          {/* İLETİŞİM & YORUM BUTONLARI */}
          <div className="flex flex-col gap-3">
            {/* Kendi profili veya profesyonel değilse: 3 aksiyon kutusu */}
            {!isOwnProfile && !currentUserIsProfessional ? (
              <div className="bg-terracotta/8 border border-terracotta/20 rounded-lg p-6 md:p-8">
                <h2 className="font-display text-xl text-ink mb-2">
                  Bu profesyonelle çalış
                </h2>
                <p className="text-ink-72 text-sm mb-4">
                  İhtiyacına göre teklif al, doğrudan rezervasyon iste ya da
                  açık ilanına davet et.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <IletisimButton
                    professionalId={profile.id}
                    professionalName={displayName}
                    categorySlug={profile.service_categories?.slug ?? null}
                    isLoggedIn={isLoggedIn}
                    currentUserIsProfessional={currentUserIsProfessional}
                    isOwnProfile={isOwnProfile}
                    variant="inline"
                  />
                  <RezervasyonButton
                    professionalId={profile.id}
                    professionalName={displayName}
                    isLoggedIn={isLoggedIn}
                    currentUserIsProfessional={currentUserIsProfessional}
                    isOwnProfile={isOwnProfile}
                  />
                  <DavetButton
                    professionalId={profile.id}
                    professionalName={displayName}
                    isLoggedIn={isLoggedIn}
                    currentUserIsProfessional={currentUserIsProfessional}
                    isOwnProfile={isOwnProfile}
                  />
                </div>
              </div>
            ) : (
              /* Kendi profili / profesyonel: mevcut IletisimButton bilgi kutusunu göster */
              <IletisimButton
                professionalId={profile.id}
                professionalName={displayName}
                categorySlug={profile.service_categories?.slug ?? null}
                isLoggedIn={isLoggedIn}
                currentUserIsProfessional={currentUserIsProfessional}
                isOwnProfile={isOwnProfile}
              />
            )}
            <YorumButton
              professionalId={profile.id}
              professionalName={displayName}
              hasConversation={hasCompletedBooking}
              existingReview={existingReview}
              enabled={canReview}
            />
          </div>

          {/* Profili şikayet et — sahibi olmayan herkese */}
          {!isOwnProfile && (
            <div className="mt-6 flex justify-center">
              <SikayetButton
                targetType="profile"
                targetId={profile.id}
                isLoggedIn={isLoggedIn}
                variant="link"
                label="Bu profili şikayet et"
              />
            </div>
          )}
        </div>

        {/* BENZER PROFİLLER — aynı kategorideki diğer profesyoneller (additive; boşsa gizli) */}
        {similarProfiles.length > 0 && (
          <section className="max-w-3xl mx-auto mt-14">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-2">
              Benzer profiller
            </p>
            <h2 className="font-display font-semibold text-2xl md:text-3xl text-ink tracking-tight mb-1.5">
              Aynı kategoride{' '}
              <em className="text-terracotta not-italic italic font-medium">
                diğer profesyoneller
              </em>
            </h2>
            <p className="text-ink-72 text-sm mb-6">
              {profile.service_categories?.name_tr ?? 'Bu kategori'} alanındaki diğer
              profiller
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-fr">
              {similarProfiles.map((p) => (
                <ProfileCard
                  key={p.id}
                  profile={p}
                  services={similarServicesByProfile[p.id] || []}
                  rating={similarRatingsByProfile[p.id] || null}
                  isFavorited={similarFavoritedIds.has(p.id)}
                  isLoggedIn={isLoggedIn}
                  currentUserRole={currentUserRole}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}