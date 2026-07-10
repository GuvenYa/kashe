import { createClient } from '@/app/lib/supabase-server';
import { TopNav } from '@/app/components/sections/top-nav';
import { IlanlarListesi } from './ilanlar-listesi';
import { getListingBoostWeight } from './listings-data';
import { getCachedUser } from '@/app/lib/auth';
import { orderCities } from '@/app/lib/city-order';
import type { ListingWithRelations } from './listings-data';

async function getUserRole(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  return profile?.role ?? null;
}

type SearchParams = Promise<{
  kategori?: string; // virgülle ayrık kategori id'leri (Keşfet deseni)
  sehir?: string; // şehir id
  etkinlik?: string; // event_type
  fiyat?: string; // budget_max tavanı
  acik?: string; // "0" → süresi dolanları da göster; yoksa varsayılan yalnız açık
  sirala?: string; // yeni | deadline | butce
}>;

export default async function IlanlarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Kullanıcı rolü (CTA için) + id (kendi ilanlarını ayırmak için)
  const userRole = await getUserRole();
  const canCreateListing = userRole === 'client' || userRole === 'business';

  const user = await getCachedUser();
  const currentUserId = user?.id ?? null;

  // Kategorileri ve şehirleri filtreler için çek
  const [categoriesResult, citiesResult] = await Promise.all([
    supabase
      .from('service_categories')
      .select('id, slug, name_tr, emoji')
      .eq('is_active', true)
      .order('name_tr'),
    supabase.from('turkish_cities').select('id, name').order('name'),
  ]);

  const categories = categoriesResult.data || [];
  // Büyük iller önce (İstanbul, Ankara, İzmir), gerisi alfabetik — paylaşılan util
  const cities = orderCities(citiesResult.data || []);

  // ---- Filtre parametreleri ----
  const categoryIds = (params.kategori ?? '')
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));
  const cityId = params.sehir ? parseInt(params.sehir, 10) : null;
  const eventType = params.etkinlik || null;
  const maxPrice = params.fiyat ? parseInt(params.fiyat, 10) : null;
  const onlyOpen = params.acik !== '0'; // VARSAYILAN açık
  const sort =
    params.sirala === 'deadline' || params.sirala === 'butce'
      ? params.sirala
      : 'yeni';

  // ---- Listings sorgusu ----
  let query = supabase
    .from('listings')
    .select(
      `
      *,
      service_categories (name_tr, emoji, slug),
      turkish_cities (name),
      creator:profiles!listings_creator_id_fkey (
        id, full_name, avatar_url, company_name, role, approval_status
      )
    `
    )
    .eq('status', 'published');

  if (categoryIds.length > 0) query = query.in('category_id', categoryIds);
  if (cityId !== null && !Number.isNaN(cityId))
    query = query.eq('city_id', cityId);
  if (eventType) query = query.eq('event_type', eventType);
  if (maxPrice !== null && !Number.isNaN(maxPrice))
    query = query.lte('budget_max', maxPrice);
  if (onlyOpen) {
    // ms'siz ISO — PostgREST or() değerinde nokta ayıracıyla çakışmasın
    const nowIso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    query = query.or(
      `application_deadline.is.null,application_deadline.gt.${nowIso}`
    );
  }

  // Sıralama
  if (sort === 'deadline') {
    query = query.order('application_deadline', {
      ascending: true,
      nullsFirst: false,
    });
  } else if (sort === 'butce') {
    query = query.order('budget_max', { ascending: false, nullsFirst: false });
  } else {
    query = query.order('published_at', { ascending: false });
  }

  const { data: listingsData } = await query;
  const listings = (listingsData ?? []) as unknown as ListingWithRelations[];

  // Öne çıkan ilanlar üstte — YALNIZ varsayılan sıralamada (kullanıcı açık bir
  // sıralama seçtiyse onun niyetine saygı; stable sort published_at'i korur).
  if (sort === 'yeni') {
    listings.sort((a, b) => getListingBoostWeight(b) - getListingBoostWeight(a));
  }

  // ---- Başvuru sayıları (SECURITY DEFINER RPC — public, tek çağrı, N+1 yok) ----
  const applicationCounts: Record<string, number> = {};
  const listingIds = listings.map((l) => l.id);
  if (listingIds.length > 0) {
    const { data: counts } = await supabase.rpc(
      'listing_application_counts',
      { listing_ids: listingIds }
    );
    (counts as { listing_id: string; cnt: number }[] | null)?.forEach((r) => {
      applicationCounts[r.listing_id] = r.cnt;
    });
    // RPC henüz uygulanmadıysa error döner + counts null → sayılar 0 kalır (sorunsuz).
  }

  return (
    <>
      <TopNav />
      <div className="bg-paper min-h-screen">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
          {/* Header */}
          <header className="mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
              İlan Tahtası
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink leading-tight max-w-3xl">
              Profesyonel arayan{' '}
              <em className="text-terracotta not-italic font-medium">
                etkinlik sahipleri
              </em>
            </h1>
            <p className="mt-3 text-ink-72 text-base max-w-2xl">
              Etkinliği için profesyonel arayanların açık ilanları. Sen
              profesyonelsen başvurabilir, müşteriysen kendi ilanını
              açabilirsin.
            </p>
          </header>

          <IlanlarListesi
            listings={listings}
            categories={categories}
            cities={cities}
            applicationCounts={applicationCounts}
            activeFilters={{
              categoryIds,
              sehir: cityId !== null && !Number.isNaN(cityId) ? String(cityId) : null,
              etkinlik: eventType,
              fiyat: maxPrice !== null && !Number.isNaN(maxPrice) ? String(maxPrice) : null,
              onlyOpen,
              sirala: sort,
            }}
            canCreateListing={canCreateListing}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </>
  );
}
