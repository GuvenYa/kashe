import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { IlanlarimListesi } from './ilanlarim-listesi';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { TopNav } from '@/app/components/sections/top-nav';
import { getCachedUser } from '@/app/lib/auth';
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

  const user = await getCachedUser();

  console.log('[ilanlarim] user:', user?.id, user?.email);

  if (!user) {
    console.log('[ilanlarim] redirecting to giris');
    redirect('/giris?redirect=/ilanlarim');
  }

  // Rol + suspension kontrolü
  // Rol + suspension kontrolü
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .single();

  // Suspension kontrolü — askıdaki kullanıcı ilanlarını yönetemez
  if (profile?.suspended_at) return <SuspendedNotice />;

  const role = profile?.role;

  // Kurumsal ekip üyeliği — owner OLMAYAN üyelikler, üyesi olunan kurumun
  // ilanlarını (read-only) ayrı grupta göstermek için
  const { data: memberships } = await supabase
    .from('business_members')
    .select('business_id, member_role')
    .eq('member_user_id', user.id);

  const teamBusinessIds = (memberships ?? [])
    .filter((m) => m.member_role !== 'owner')
    .map((m) => m.business_id);

  const hasTeamAccess = teamBusinessIds.length > 0;

  // client/business değilse ama bir kurumun ekip üyesiyse geçsin
  // (professional bir üye de buraya girip kurum ilanlarını görebilmeli)
  if (role !== 'client' && role !== 'business' && !hasTeamAccess) {
    redirect('/profil');
  }

  // Kendi ilanları + üyesi olunan kurumların ilanları
  // (RLS: kendi ilanlar sahip politikasından, kurum ilanları business üye SELECT'inden geçer)
  const creatorIds = [user.id, ...teamBusinessIds];
  const { data: listingsData } = await supabase
    .from('listings')
    .select(
      `
      *,
      service_categories (id, name_tr, emoji),
      turkish_cities (id, name)
    `
    )
    .in('creator_id', creatorIds)
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

  // Üyesi olunan kurumların adları (kurum ilanlarını gruplamak için)
  const businessProfiles: Record<string, { name: string }> = {};
  if (teamBusinessIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, company_name')
      .in('id', teamBusinessIds);
    (profs ?? []).forEach((p) => {
      businessProfiles[p.id] = {
        name: p.company_name || p.full_name || 'Kurum',
      };
    });
  }

  // Her listing'e application_count + sahiplik/kaynak bilgisi ekle
  const listingsWithCounts = allListings.map((l) => {
    const isOwn = l.creator_id === user.id;
    return {
      ...l,
      application_count: applicationCounts[l.id] ?? 0,
      is_own: isOwn,
      owner_business_name: isOwn
        ? null
        : businessProfiles[l.creator_id]?.name ?? 'Kurum',
    };
  });

  return (
    <>
    <TopNav />
    <div className="bg-paper min-h-screen">
      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12">
        {/* Hero */}
        <div className="flex items-start justify-between gap-4 mb-10 flex-wrap">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
              Yönetim
            </p>
            <h1 className="font-display font-semibold text-4xl text-ink leading-tight">
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
    </>
  );
}