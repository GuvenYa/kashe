import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { IlanlarimListesi } from './ilanlarim-listesi';
import type { ListingWithRelations } from '../ilanlar/listings-data';

type SearchParams = Promise<{ durum?: string }>;

export default async function IlanlarimPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  console.log('[ilanlarim] page rendering');

  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log('[ilanlarim] user:', user?.id, user?.email);

  if (!user) {
    console.log('[ilanlarim] redirecting to giris');
    redirect('/giris?redirect=/ilanlarim');
  }

  // Rol kontrolü
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  console.log('[ilanlarim] role:', profile?.role);

  const role = profile?.role;
  if (role !== 'client' && role !== 'business') {
    console.log('[ilanlarim] redirecting to profil (wrong role)');
    redirect('/profil');
  }

  console.log('[ilanlarim] passed checks, fetching listings');

  // Tüm kendi ilanları
  const { data: listingsData } = await supabase
    .from('listings')
    .select(
      `
      *,
      service_categories (id, name_tr, emoji),
      turkish_cities (id, name)
    `
    )
    .eq('creator_id', user.id)
    .order('updated_at', { ascending: false });

  const allListings = (listingsData ??
    []) as unknown as ListingWithRelations[];

  // Başvuru sayılarını topla (her listing için ayrı count)
  // Optimize: tek sorguda all ids → group by
  const listingIds = allListings.map((l) => l.id);
  const applicationCounts: Record<string, number> = {};

  if (listingIds.length > 0) {
    const { data: apps } = await supabase
      .from('applications')
      .select('listing_id')
      .in('listing_id', listingIds);

    (apps ?? []).forEach((a) => {
      applicationCounts[a.listing_id] =
        (applicationCounts[a.listing_id] ?? 0) + 1;
    });
  }

  // Her listing'e application_count alanını ekle
  const listingsWithCounts = allListings.map((l) => ({
    ...l,
    application_count: applicationCounts[l.id] ?? 0,
  }));

  return (
    <div className="bg-paper min-h-screen">
      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12">
        {/* Hero */}
        <div className="flex items-start justify-between gap-4 mb-10 flex-wrap">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
              Yönetim
            </p>
            <h1 className="font-display text-4xl text-ink leading-tight">
              <em className="text-terracotta not-italic italic font-medium">
                İlanlarım
              </em>
            </h1>
            <p className="mt-2 text-ink-72 text-sm">
              Açtığın ilanları yönet, başvuruları gör.
            </p>
          </div>
          <Link
            href="/ilanlar/yeni"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all whitespace-nowrap"
          >
            <span className="text-base leading-none">+</span>
            Yeni ilan aç
          </Link>
        </div>

        <IlanlarimListesi
          listings={listingsWithCounts}
          activeStatus={params.durum ?? null}
        />
      </div>
    </div>
  );
}