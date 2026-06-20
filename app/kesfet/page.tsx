import { createClient } from '@/app/lib/supabase-server';
import { SearchX, Users } from 'lucide-react';
import { TopNav } from '@/app/components/sections/top-nav';
import { ProfileCard } from './profile-card';
import { KesfetFilters } from './kesfet-filters';
import { SortDropdown } from './sort-dropdown';
import { EmptyState } from '@/app/components/EmptyState';
import { getFavoritedIds } from '@/app/favoriler/actions';
import { orderCities } from '@/app/lib/city-order';
import { getFilterFields } from '@/app/lib/filter-config';
import {
  matchesAnyBadge,
  isBusy as computeBusy,
  busyWindowKeys,
} from '@/app/lib/badges';
import type { ServiceCategory, TurkishCity } from '@/app/lib/types';
import { getCachedUser } from '@/app/lib/auth';

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

type SearchParams = {
  kategori?: string;
  sehir?: string;
  q?: string;
  sirala?: 'yeni' | 'puan';
  tip?: 'profesyonel' | 'ajans';
  fiyat?: string;
  puan?: string;
  // Sıra 3 — gelişmiş filtreler
  premium?: string; // '1' → sadece premium
  dogrulanmis?: string; // '1' → sadece doğrulanmış
  yuksekpuan?: string; // '1' → "Yüksek Puanlı" rozeti
  coktercih?: string; // '1' → "Çok Tercih Edilen" rozeti
  musait?: string; // '1' → yoğun olanları gizle (AND kısıt)
  deneyim?: string; // 'junior,senior' → bu deneyimdekiler önce (sıralama)
  [key: `attr_${string}`]: string | undefined;
};

export default async function KesfetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Çoklu kategori: "5,12,3" → [5,12,3]
  const categoryIds = params.kategori
    ? params.kategori
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n))
    : [];
  const cityId = params.sehir ? parseInt(params.sehir, 10) : null;
  const searchQuery = params.q?.trim() || '';
  const sortBy: 'yeni' | 'puan' = params.sirala === 'puan' ? 'puan' : 'yeni';
  const typeFilter: 'profesyonel' | 'ajans' | null =
    params.tip === 'profesyonel' || params.tip === 'ajans' ? params.tip : null;
  // Fiyat tavanı (başlangıç fiyatı bu değerin altındakiler) ve min puan
  const maxPrice = params.fiyat ? parseInt(params.fiyat, 10) : null;
  const minRating = params.puan ? parseFloat(params.puan) : null;

  // Sıra 3 — rozet havuzu (VEYA): seçili olanlardan birine sahip olan geçer
  const badgeKeys: string[] = [];
  if (params.premium === '1') badgeKeys.push('premium');
  if (params.dogrulanmis === '1') badgeKeys.push('verified');
  if (params.yuksekpuan === '1') badgeKeys.push('topRated');
  if (params.coktercih === '1') badgeKeys.push('popular');

  // Müsaitlik (AND kısıt): true ise yoğun olanlar listeden çıkar
  const onlyAvailable = params.musait === '1';

  // Deneyim (sıralama, eleme değil): bu değerlere sahip olanlar üste
  const wantedExperience = params.deneyim
    ? params.deneyim.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const [{ data: categories }, { data: cities }] = await Promise.all([
    supabase
      .from('service_categories')
      .select('*')
      .eq('is_active', true)
      .order('name_tr'),
    supabase.from('turkish_cities').select('*').order('name'),
  ]);

  let query = supabase
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
    .order('updated_at', { ascending: false });

  if (typeFilter === 'profesyonel') {
    query = query.eq('role', 'professional');
  } else if (typeFilter === 'ajans') {
    query = query.eq('role', 'agency');
  }

  // Çoklu kategori: tek seçim → eq, çoklu → in
  if (categoryIds.length === 1) {
    query = query.eq('primary_category_id', categoryIds[0]);
  } else if (categoryIds.length > 1) {
    query = query.in('primary_category_id', categoryIds);
  }
  if (cityId) {
    query = query.eq('city_id', cityId);
  }
  if (searchQuery) {
    const lowerQuery = searchQuery.toLocaleLowerCase('tr');
    const matchedCategoryIds = (categories || [])
      .filter((c) => c.name_tr.toLocaleLowerCase('tr').includes(lowerQuery))
      .map((c) => c.id);

    const orConditions = [
      `full_name.ilike.%${searchQuery}%`,
      `company_name.ilike.%${searchQuery}%`,
    ];
    if (matchedCategoryIds.length > 0) {
      orConditions.push(`primary_category_id.in.(${matchedCategoryIds.join(',')})`);
    }
    query = query.or(orConditions.join(','));
  }

  const { data: profilesData, error } = await query;
  let profiles = (profilesData || []) as unknown as PublishedProfile[];

  // Detaylı filtreler SADECE tam 1 kategori seçiliyken (A kararı)
  let selectedCategorySlug: string | null = null;
  if (categoryIds.length === 1) {
    selectedCategorySlug =
      (categories || []).find((c) => c.id === categoryIds[0])?.slug ?? null;
  }

  const activeAttrFilters: Record<string, string[]> = {};
  if (selectedCategorySlug) {
    const fields = getFilterFields(selectedCategorySlug);
    for (const field of fields) {
      const raw = params[`attr_${field.key}`];
      if (raw && typeof raw === 'string') {
        const vals = raw.split(',').map((v) => v.trim()).filter(Boolean);
        if (vals.length > 0) activeAttrFilters[field.key] = vals;
      }
    }
  }

  const hasAttrFilters = Object.keys(activeAttrFilters).length > 0;

  if (hasAttrFilters) {
    profiles = profiles.filter((p) => {
      const attrs = p.attributes || {};
      return Object.entries(activeAttrFilters).every(([key, wantedVals]) => {
        const profileVal = attrs[key];
        if (profileVal === undefined || profileVal === null) return false;
        const profileArr = Array.isArray(profileVal) ? profileVal : [profileVal];
        return wantedVals.some((w) => profileArr.includes(w));
      });
    });
  }

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

  const ratingsByProfile: Record<string, { count: number; average: number }> = {};

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

  // ---- MÜSAİTLİK (Sıra 3): önümüzdeki 7 gün dolu mu? ----
  // Dolu gün = availability_blocks (manuel) ∪ onaylı bookings event_date.
  // Pencere dışındaki kayıtları çekmemek için tarih aralığıyla sınırlıyoruz.
  const busyByProfile: Record<string, boolean> = {};
  if (profileIds.length > 0) {
    const windowKeys = busyWindowKeys();
    const windowStart = windowKeys[0];
    const windowEnd = windowKeys[windowKeys.length - 1];

    const blockedByProfile: Record<string, Set<string>> = {};
    const addDay = (pid: string, day: string) => {
      if (!blockedByProfile[pid]) blockedByProfile[pid] = new Set();
      blockedByProfile[pid].add(day);
    };

    const [{ data: blocksData }, { data: bookingsData }] = await Promise.all([
      supabase
        .from('availability_blocks')
        .select('profile_id, blocked_date')
        .in('profile_id', profileIds)
        .gte('blocked_date', windowStart)
        .lte('blocked_date', windowEnd),
      supabase
        .from('bookings')
        .select('professional_id, event_date, status')
        .in('professional_id', profileIds)
        .in('status', ['confirmed', 'completed'])
        .gte('event_date', windowStart)
        .lte('event_date', windowEnd),
    ]);

    (blocksData || []).forEach((b) => {
      if (b.blocked_date) addDay(b.profile_id, b.blocked_date as string);
    });
    (bookingsData || []).forEach((bk) => {
      if (bk.event_date) addDay(bk.professional_id, bk.event_date as string);
    });

    for (const pid of profileIds) {
      busyByProfile[pid] = computeBusy(blockedByProfile[pid] ?? new Set());
    }
  }

  // Fiyat filtresi: profilin en düşük başlangıç fiyatı maxPrice altında mı?
  // "Talep üzerine" hizmetler fiyat bilinmediği için filtre aktifken elenir.
  if (maxPrice !== null) {
    profiles = profiles.filter((p) => {
      const svcs = servicesByProfile[p.id] || [];
      const numeric = svcs.filter(
        (s) => !s.price_on_request && s.price_min !== null
      );
      if (numeric.length === 0) return false;
      const lowest = Math.min(...numeric.map((s) => s.price_min as number));
      return lowest <= maxPrice;
    });
  }

  // Puan filtresi: ortalama puanı minRating ve üzeri olanlar
  if (minRating !== null) {
    profiles = profiles.filter((p) => {
      const r = ratingsByProfile[p.id];
      return r && r.count > 0 && r.average >= minRating;
    });
  }

  // Rozet havuzu (VEYA): seçili rozetlerden birine sahip olanlar
  if (badgeKeys.length > 0) {
    profiles = profiles.filter((p) =>
      matchesAnyBadge(
        {
          approvalStatus: p.approval_status,
          createdAt: p.created_at,
          rating: ratingsByProfile[p.id] ?? null,
          premiumTier: (p.premium_tier ?? null) as
            | 'none'
            | 'premium'
            | 'plus'
            | 'agency'
            | null,
          premiumUntil: p.premium_until ?? null,
        },
        badgeKeys
      )
    );
  }

  // Müsaitlik (AND kısıt): yoğun olanları gizle
  if (onlyAvailable) {
    profiles = profiles.filter((p) => !busyByProfile[p.id]);
  }

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

  // Deneyim sıralaması (Sıra 3, ELEME DEĞİL): seçili deneyimdekiler üste,
  // doldurmayan dahil kimse kaybolmaz. Stable sort sırayı korur.
  if (wantedExperience.length > 0) {
    const expMatch = (p: PublishedProfile): number => {
      const raw = p.attributes?.experience;
      const val = Array.isArray(raw) ? raw[0] : raw;
      return val && wantedExperience.includes(val) ? 1 : 0;
    };
    profiles.sort((a, b) => expMatch(b) - expMatch(a));
  }

  // Premium profiller üstte — Tier: agency(3) > plus(2) > premium(1) > none(0).
  const tierWeight = (tier: string | null, until: string | null): number => {
    if (!tier || tier === 'none') return 0;
    if (until && new Date(until).getTime() <= Date.now()) return 0; // süresi geçmiş
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

  // EN SON: yoğun olanları dibe at (premium bile olsa müsait olanların altında).
  // Müsaitlik filtresi aktifse zaten elenmişlerdir; bu, filtre kapalıyken
  // "Yoğun" rozetli profilleri sona koyar.
  profiles.sort((a, b) => {
    const ba = busyByProfile[a.id] ? 1 : 0;
    const bb = busyByProfile[b.id] ? 1 : 0;
    return ba - bb;
  });

  const hasFilters = !!(
    categoryIds.length > 0 ||
    cityId ||
    searchQuery ||
    typeFilter ||
    hasAttrFilters ||
    maxPrice !== null ||
    minRating !== null ||
    badgeKeys.length > 0 ||
    onlyAvailable ||
    wantedExperience.length > 0
  );

  const user = await getCachedUser();

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
      <main className="min-h-screen bg-paper px-6 md:px-12 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
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

          {/* İki sütun: sol sidebar (filtreler) + sağ sonuçlar */}
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sol — filtre sidebar (mobilde drawer) */}
            <aside className="lg:w-64 lg:shrink-0">
              <KesfetFilters
                categories={(categories || []) as ServiceCategory[]}
                cities={orderCities((cities || []) as TurkishCity[])}
                currentCategories={categoryIds}
                currentCity={cityId}
                currentSearch={searchQuery}
                currentAttrs={activeAttrFilters}
                currentType={typeFilter}
                currentMaxPrice={maxPrice}
                currentMinRating={minRating}
                currentBadgeKeys={badgeKeys}
                currentOnlyAvailable={onlyAvailable}
                currentExperience={wantedExperience}
                resultCount={profiles.length}
                isLoggedIn={isLoggedIn}
              />
            </aside>

            {/* Sağ — sonuçlar */}
            <div className="flex-1 min-w-0">
              {error ? (
                <div className="bg-terracotta/10 border border-terracotta/30 rounded-lg p-6">
                  <p className="text-terracotta text-sm">
                    Bir sorun oluştu, lütfen sayfayı yenile.
                  </p>
                </div>
              ) : profiles.length === 0 ? (
                <div>
                  {hasFilters ? (
                    <EmptyState
                      icon={SearchX}
                      title="Bu sahnede kimse yok"
                      description="Aradığın kriterlere uyan profil çıkmadı. Filtreleri biraz gevşet, daha fazla yetenek görünsün."
                      action={{ label: 'Filtreleri temizle', href: '/kesfet' }}
                    />
                  ) : (
                    <EmptyState
                      icon={Users}
                      title="Perde yeni açılıyor"
                      description="İlk yetenekler kayıt sürecinde. Çok yakında bu sahne dolacak."
                    />
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72">
                      {profiles.length} sonuç
                    </p>
                    <SortDropdown currentSort={sortBy} />
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
                        isBusy={busyByProfile[profile.id] ?? false}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
