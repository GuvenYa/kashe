import { notFound } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { IlanDetay } from './ilan-detay';
import { incrementListingViews } from '../listings-actions';
import type {
  ListingWithRelations,
  ApplicationWithRelations,
  Application,
} from '../listings-data';

type Params = Promise<{ id: string }>;

export default async function IlanDetayPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // İlanı + relation'ları getir
  const { data: listingData } = await supabase
    .from('listings')
    .select(
      `
      *,
      service_categories (id, slug, name_tr, emoji),
      turkish_cities (id, name),
      creator:profiles!listings_creator_id_fkey (
        id, full_name, avatar_url, company_name, role, bio
      )
    `
    )
    .eq('id', id)
    .single();

  if (!listingData) {
    notFound();
  }

  const listing = listingData as unknown as ListingWithRelations;

  // İzin kontrolü: published değilse sadece sahibi görebilir
  const isOwner = !!user && listing.creator_id === user.id;
  if (listing.status !== 'published' && !isOwner) {
    notFound();
  }

  // Kullanıcı profili (role tespiti)
  let userRole: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    userRole = profile?.role ?? null;
  }

  const isProfessional = userRole === 'professional';

  // Profesyonel ise: bu ilana başvurusu var mı?
  let myApplication: Application | null = null;
  if (user && isProfessional) {
    const { data: app } = await supabase
      .from('applications')
      .select('*')
      .eq('listing_id', id)
      .eq('applicant_id', user.id)
      .maybeSingle();
    myApplication = (app as Application) ?? null;
  }

  // Sahibi ise: gelen başvurular
  let applications: ApplicationWithRelations[] = [];
  if (isOwner) {
    const { data: appsData } = await supabase
      .from('applications')
      .select(
        `
        *,
        applicant:profiles!applications_applicant_id_fkey (
          id, full_name, avatar_url, company_name, role, bio
        )
      `
      )
      .eq('listing_id', id)
      .order('created_at', { ascending: false });

    applications =
      (appsData as unknown as ApplicationWithRelations[]) ?? [];
  }

  // View counter (fire-and-forget, sahibi kendi sayfasını sayılmaz)
  incrementListingViews(id).catch(() => {
    // sessiz fail
  });

  return (
    <IlanDetay
      listing={listing}
      currentUserId={user?.id ?? null}
      isOwner={isOwner}
      isProfessional={isProfessional}
      myApplication={myApplication}
      applications={applications}
    />
  );
}