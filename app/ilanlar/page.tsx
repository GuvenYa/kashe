import { createClient } from '@/app/lib/supabase-server';
import { TopNav } from '@/app/components/sections/top-nav';
import { IlanlarListesi } from './ilanlar-listesi';
import { getListingBoostWeight } from './listings-data';
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
  kategori?: string;
  sehir?: string;
  etkinlik?: string;
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

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const currentUserId = currentUser?.id ?? null;

  // Kategorileri ve şehirleri filtreler için çek
  const [categoriesResult, citiesResult] = await Promise.all([
    supabase
      .from('service_categories')
      .select('id, slug, name_tr, emoji')
      .eq('is_active', true)
      .order('name_tr'),
    supabase
      .from('turkish_cities')
      .select('id, name')
      .order('name'),
  ]);

  const categories = categoriesResult.data || [];
  const cities = citiesResult.data || [];

  // Listings sorgusu — filtreli
  let query = supabase
    .from('listings')
    .select(
      `
      *,
      service_categories (name_tr, emoji, slug),
      turkish_cities (name),
      creator:profiles!listings_creator_id_fkey (
        id, full_name, avatar_url, company_name, role
      )
    `
    )
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  // Filtre: kategori
  if (params.kategori) {
    const cat = categories.find((c) => c.slug === params.kategori);
    if (cat) {
      query = query.eq('category_id', cat.id);
    }
  }

  // Filtre: şehir
  if (params.sehir) {
    const cityId = parseInt(params.sehir, 10);
    if (!isNaN(cityId)) {
      query = query.eq('city_id', cityId);
    }
  }

  // Filtre: etkinlik tipi
  if (params.etkinlik) {
    query = query.eq('event_type', params.etkinlik);
  }

  const { data: listingsData } = await query;
  const listings = (listingsData ?? []) as unknown as ListingWithRelations[];

  // Öne çıkan ilanlar üstte (stable sort published_at sırasını korur)
  listings.sort(
    (a, b) => getListingBoostWeight(b) - getListingBoostWeight(a)
  );

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
          <h1 className="font-display text-5xl text-ink leading-tight max-w-3xl">
            Profesyonel arayan{' '}
            <em className="text-terracotta not-italic italic font-medium">
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
          activeFilters={{
            kategori: params.kategori ?? null,
            sehir: params.sehir ?? null,
            etkinlik: params.etkinlik ?? null,
          }}
          canCreateListing={canCreateListing}
          currentUserId={currentUserId}
        />
      </div>
    </div>
    </>
  );
}