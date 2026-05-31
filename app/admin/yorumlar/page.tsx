import { createClient } from '@/app/lib/supabase-server';
import { Eyebrow } from '@/app/components/ui/eyebrow';
import { YorumAksiyonlari } from './yorum-aksiyonlari';
import Link from 'next/link';

export const metadata = {
  title: 'Yorum Moderasyon — Kashe Admin',
};

type SearchParams = {
  filter?: string;
};

type ReviewRow = {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  professional_id: string;
  customer_id: string;
  customer: {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
    company_name: string | null;
  } | null;
  professional: {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
    company_name: string | null;
  } | null;
  reply: {
    id: string;
    body: string;
    created_at: string;
  } | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 60) return `${diffMins} dk önce`;
  if (diffHours < 24) return `${diffHours} sa önce`;
  if (diffDays < 30) return `${diffDays} gün önce`;
  return formatDate(iso);
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[14px] leading-none"
      aria-label={`${rating} yıldız`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= rating ? 'text-terracotta' : 'text-ink-50/30'}
        >
          ★
        </span>
      ))}
      <span className="ml-1 font-mono text-[11px] text-ink-72">
        {rating}/5
      </span>
    </span>
  );
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const filter = params.filter || 'all';

  // Tüm yorumlar (filtre sayaçları için)
  const { data: allReviewsData } = await supabase
    .from('reviews')
    .select('id, rating, body');

  const allReviews = allReviewsData || [];

  // Filtre sayıları
  const filterCounts: Record<string, number> = {
    all: allReviews.length,
    low: allReviews.filter((r) => r.rating <= 2).length,
    no_body: allReviews.filter((r) => !r.body || r.body.trim().length === 0)
      .length,
    with_body: allReviews.filter((r) => r.body && r.body.trim().length > 0)
      .length,
  };

  // Yanıtlı/yanıtsız sayıları — replies tablosundan id setini çek
  const allReviewIds = allReviews.map((r) => r.id);
  let repliedIds = new Set<string>();
  if (allReviewIds.length > 0) {
    const { data: repliesData } = await supabase
      .from('review_replies')
      .select('review_id')
      .in('review_id', allReviewIds);
    repliedIds = new Set((repliesData || []).map((r) => r.review_id));
  }
  filterCounts.replied = repliedIds.size;
  filterCounts.no_reply = allReviews.length - repliedIds.size;

  // Filtreli sorgu
  let query = supabase
    .from('reviews')
    .select(
      `
      id, rating, body, created_at, professional_id, customer_id,
      customer:profiles!reviews_customer_id_fkey (
        id, full_name, email, role, company_name
      ),
      professional:profiles!reviews_professional_id_fkey (
        id, full_name, email, role, company_name
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (filter === 'low') {
    query = query.lte('rating', 2);
  } else if (filter === 'no_body') {
    query = query.is('body', null);
  } else if (filter === 'with_body') {
    query = query.not('body', 'is', null);
  } else if (filter === 'replied') {
    if (repliedIds.size > 0) {
      query = query.in('id', Array.from(repliedIds));
    } else {
      // Hiç yanıt yok — sonuç boş döner
      query = query.eq('id', '00000000-0000-0000-0000-000000000000');
    }
  } else if (filter === 'no_reply') {
    if (repliedIds.size > 0) {
      query = query.not('id', 'in', `(${Array.from(repliedIds).join(',')})`);
    }
  }

  const { data: reviewsRaw } = await query;
  const reviewsBase = (reviewsRaw ?? []) as unknown as Omit<ReviewRow, 'reply'>[];

  // Yanıtları ayrı sorguyla çek
  const reviewIdsInPage = reviewsBase.map((r) => r.id);
  let repliesMap = new Map<
    string,
    { id: string; body: string; created_at: string }
  >();
  if (reviewIdsInPage.length > 0) {
    const { data: repliesInPage } = await supabase
      .from('review_replies')
      .select('id, review_id, body, created_at')
      .in('review_id', reviewIdsInPage);
    (repliesInPage || []).forEach((rep: { id: string; review_id: string; body: string; created_at: string }) => {
      repliesMap.set(rep.review_id, {
        id: rep.id,
        body: rep.body,
        created_at: rep.created_at,
      });
    });
  }

  const reviews: ReviewRow[] = reviewsBase.map((r) => ({
    ...r,
    reply: repliesMap.get(r.id) ?? null,
  }));

  return (
    <>
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <Eyebrow variant="inline" className="mb-2">
          Admin / Yorum Moderasyon
        </Eyebrow>
        <h1 className="font-display font-light text-3xl md:text-4xl text-ink tracking-[-0.02em] leading-tight">
          Yorumlar
        </h1>
        <p className="text-sm text-ink-72 mt-2">
          Tüm yorumları gözden geçir. Hakaret, spam veya yanıltıcı yorumları
          kaldırabilirsin. Silme işlemi <span className="font-semibold">geri alınamaz</span>.
        </p>
      </div>

      {/* Filtre chip'leri */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { key: 'all', label: 'Tümü' },
          { key: 'low', label: 'Düşük puan (1-2★)' },
          { key: 'with_body', label: 'Metin var' },
          { key: 'no_body', label: 'Sadece puan' },
          { key: 'replied', label: 'Yanıtlı' },
          { key: 'no_reply', label: 'Yanıtsız' },
        ].map((opt) => {
          const count = filterCounts[opt.key] ?? 0;
          const isActive = filter === opt.key;
          return (
            <Link
              key={opt.key}
              href={
                opt.key === 'all'
                  ? '/admin/yorumlar'
                  : `/admin/yorumlar?filter=${opt.key}`
              }
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full border font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                isActive
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-card text-ink-72 border-line hover:border-ink-50 hover:text-ink'
              }`}
            >
              {opt.label}
              <span
                className={`tabular-nums ${
                  isActive ? 'text-paper/70' : 'text-ink-50'
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Liste */}
      {reviews.length === 0 ? (
        <div className="bg-card border border-line rounded-2xl p-10 text-center">
          <p className="font-display font-medium text-lg text-ink mb-1">
            Bu filtrede yorum yok.
          </p>
          <p className="text-sm text-ink-72">
            Diğer filtreleri dene veya tümünü gör.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const customerName =
              (review.customer?.role === 'business' ||
                review.customer?.role === 'agency') &&
              review.customer?.company_name
                ? review.customer.company_name
                : review.customer?.full_name ||
                  review.customer?.email ||
                  'Anonim';

            const professionalName =
              (review.professional?.role === 'business' ||
                review.professional?.role === 'agency') &&
              review.professional?.company_name
                ? review.professional.company_name
                : review.professional?.full_name ||
                  review.professional?.email ||
                  'Profesyonel';

            const hasBody = review.body && review.body.trim().length > 0;
            const isLowRating = review.rating <= 2;

            return (
              <div
                key={review.id}
                className="bg-card border border-line rounded-2xl p-5 md:p-6"
              >
                {/* Üst — kim, kime, puan */}
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <StarRating rating={review.rating} />
                      {isLowRating && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] bg-terracotta/10 text-terracotta border border-terracotta/30">
                          Düşük puan
                        </span>
                      )}
                      {!hasBody && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] bg-ink-72/8 text-ink-72 border border-ink-72/20">
                          Sadece puan
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-ink-72 font-mono">
                      <span className="text-ink">{customerName}</span>
                      <span className="text-ink-50 mx-1">→</span>
                      <Link
                        href={`/p/${review.professional_id}`}
                        className="text-ink underline-offset-2 hover:underline"
                        target="_blank"
                      >
                        {professionalName}
                      </Link>
                      <span className="text-ink-50 mx-2">·</span>
                      {formatRelative(review.created_at)}
                    </p>
                  </div>
                </div>

                {/* Yorum metni */}
                {hasBody && (
                  <div className="bg-paper-2/50 border border-line rounded-xl p-3 mb-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 mb-1">
                      Yorum
                    </p>
                    <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                      {review.body}
                    </p>
                  </div>
                )}

                {/* Yanıt (varsa) */}
                {review.reply && (
                  <div className="bg-plum/[0.06] border border-plum/20 rounded-xl p-3 mb-3 ml-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-plum mb-1">
                      Profesyonelin yanıtı · {formatRelative(review.reply.created_at)}
                    </p>
                    <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                      {review.reply.body}
                    </p>
                  </div>
                )}

                {/* Aksiyonlar */}
                <div className="pt-3 border-t border-line">
                  <YorumAksiyonlari
                    reviewId={review.id}
                    hasReply={!!review.reply}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}