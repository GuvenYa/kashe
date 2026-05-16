import { createClient } from '@/app/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { ReviewCard } from '@/app/yorumlar/review-card';

type PublicProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  role: string;
  is_published: boolean;
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

  if (!data || !data.is_published) {
    return { title: 'Yorumlar bulunamadı — Kashe' };
  }

  const name =
    data.role === 'business' && data.company_name
      ? data.company_name
      : data.full_name || 'Profil';

  return {
    title: `${name} — Yorumlar — Kashe`,
  };
}

export default async function YorumlarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, company_name, role, is_published')
    .eq('id', id)
    .single();

  if (!profileData) {
    notFound();
  }

  const profile = profileData as PublicProfile;

  if (!profile.is_published) {
    notFound();
  }

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

  // Rating özeti + tüm yorumlar
  const [
    { data: ratingData },
    { data: reviewsData },
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
      .order('created_at', { ascending: false }),
  ]);

  const reviewCount = ratingData?.review_count ?? 0;
  const averageRating = ratingData?.average_rating ?? 0;
  const reviews = reviewsData ?? [];

  // Müşteri profilleri + yanıtlar
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

  const customerMap = new Map<string, CustomerMini>();
  const replyMap = new Map<string, ReplyMini>();

  if (reviews.length > 0) {
    const customerIds = reviews.map((r) => r.customer_id);
    const reviewIds = reviews.map((r) => r.id);

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

  // Mevcut kullanıcı bilgisi (profesyonel kendi sayfasında mı?)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwnedByProfessional = user?.id === profile.id;

  // Rating dağılımı (5★: kaç adet, 4★: kaç adet, vs.)
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((r) => {
    distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
  });

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <Link
            href={`/p/${profile.id}`}
            className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors inline-flex items-center gap-1.5 mb-6"
          >
            ← {displayName}&apos;in profiline dön
          </Link>

          {/* HEADER: küçük avatar + isim + büyük rating */}
          <div className="bg-white border border-line rounded-lg p-8 mb-6">
            <div className="flex items-start gap-6 flex-wrap">
              {profile.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover border border-line shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-2xl shrink-0">
                  {initials}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Tüm Yorumlar
                </p>
                <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
                  {displayName}
                </h1>

                {reviewCount > 0 ? (
                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <BigStar />
                      <span className="font-display font-semibold text-2xl text-ink">
                        {averageRating}
                      </span>
                    </div>
                    <span className="text-ink-72">·</span>
                    <span className="text-ink-72">
                      {reviewCount} yorum
                    </span>
                  </div>
                ) : (
                  <p className="mt-4 text-ink-72">Henüz yorum yok.</p>
                )}
              </div>
            </div>

            {/* RATING DAĞILIMI */}
            {reviewCount > 0 && (
              <div className="mt-6 pt-6 border-t border-line space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = distribution[star] ?? 0;
                  const percentage =
                    reviewCount > 0 ? (count / reviewCount) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-3 text-sm">
                      <span className="font-mono text-xs text-ink-72 w-6">
                        {star}★
                      </span>
                      <div className="flex-1 h-2 bg-paper rounded-full overflow-hidden border border-line">
                        <div
                          className="h-full bg-terracotta transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-ink-72 w-8 text-right">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* YORUMLAR LİSTESİ */}
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((r) => (
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
          ) : (
            <div className="bg-white border border-line rounded-lg p-12 text-center">
              <p className="font-display text-2xl text-ink mb-3">
                Henüz yorum yok.
              </p>
              <p className="text-ink-72 max-w-md mx-auto">
                {displayName} için ilk yorumu sen yazabilirsin.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function BigStar() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="var(--color-terracotta)"
      stroke="var(--color-terracotta)"
      strokeWidth="1.5"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );
}
