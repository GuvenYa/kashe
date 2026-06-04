import { notFound } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { IlanDetay } from './ilan-detay';
import { incrementListingViews } from '../listings-actions';
import { TopNav } from '@/app/components/sections/top-nav';
import { getBadges } from '@/app/lib/badges';
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

  // Başvurabilen roller: profesyonel + ajans
  const canApply = userRole === 'professional' || userRole === 'agency';

  // Başvurabilen kullanıcı ise: bu ilana başvurusu var mı?
  let myApplication: Application | null = null;
  if (user && canApply) {
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
          id, full_name, avatar_url, company_name, role, bio, approval_status, created_at
        )
      `
      )
      .eq('listing_id', id)
      .order('created_at', { ascending: false });

    let apps = (appsData as unknown as ApplicationWithRelations[]) ?? [];

    // Başvuranların puan özetlerini topluca çek, her başvuruya puan + rozet iliştir
    const applicantIds = apps
      .map((a) => a.applicant?.id)
      .filter((x): x is string => !!x);

    if (applicantIds.length > 0) {
      const { data: ratingsData } = await supabase
        .from('professional_rating_summary')
        .select('professional_id, review_count, average_rating')
        .in('professional_id', applicantIds);

      const ratingMap = new Map<string, { count: number; average: number }>();
      (ratingsData ?? []).forEach((r) => {
        ratingMap.set(r.professional_id, {
          count: r.review_count ?? 0,
          average: r.average_rating ?? 0,
        });
      });

      apps = apps.map((a) => {
        if (!a.applicant) return a;
        const rating = ratingMap.get(a.applicant.id) ?? {
          count: 0,
          average: 0,
        };
        const badgeInput = {
          approvalStatus: a.applicant.approval_status ?? null,
          createdAt: a.applicant.created_at ?? null,
          rating,
        };
        return {
          ...a,
          applicantRating: rating,
          applicantBadges: getBadges(badgeInput),
        };
      });
    }

    applications = apps;
  }

  // View counter (fire-and-forget, sahibi kendi sayfasını sayılmaz)
  incrementListingViews(id).catch(() => {
    // sessiz fail
  });

  return (
    <>
      <TopNav />
      <IlanDetay
        listing={listing}
        currentUserId={user?.id ?? null}
        isOwner={isOwner}
        isProfessional={canApply}
        myApplication={myApplication}
        applications={applications}
      />
    </>
  );
}