import Link from 'next/link';
import { getAllTestimonials } from '@/app/lib/testimonials';
import { GorusRowActions } from './gorus-row-actions';

export const metadata = { title: 'Görüşler — Admin' };

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[13px] leading-none"
      aria-label={`${rating} yıldız`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? 'text-brand-accent' : 'text-ink-50/30'}>
          ★
        </span>
      ))}
    </span>
  );
}

export default async function AdminGoruslerPage() {
  // RLS admin dalı taslak dahil hepsini döndürür (testimonials_admin_all).
  const testimonials = await getAllTestimonials();

  const published = testimonials.filter((t) => t.is_published).length;
  const drafts = testimonials.length - published;

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div>
          <h1 className="font-display text-3xl text-ink tracking-tight">
            Görüşler
          </h1>
          <p className="text-sm text-ink-72 mt-1">
            {testimonials.length} görüş · {published} yayında · {drafts} taslak
          </p>
        </div>
        <Link
          href="/admin/gorusler/yeni"
          className="px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-brand-ink)] transition-all"
        >
          + Yeni görüş
        </Link>
      </div>

      <p className="text-xs text-ink-72 mb-6">
        Ana sayfadaki “Kullanıcılar ne diyor?” bölümünde gösterilen platform
        görüşleri. Yayındakiler sort_order’a göre sıralanır (ilk 3 gösterilir).
      </p>

      {testimonials.length === 0 ? (
        <div className="bg-card border border-line rounded-lg p-12 text-center">
          <p className="font-display text-lg text-ink mb-2">Henüz görüş yok</p>
          <p className="text-sm text-ink-72 mb-5">
            İlk görüşü ekle — yayına alındığında ana sayfada görünmeye hazır olur.
          </p>
          <Link
            href="/admin/gorusler/yeni"
            className="inline-block px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            + Yeni görüş
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="bg-card border border-line rounded-lg p-4 flex items-start gap-4"
            >
              {/* Sıra numarası */}
              <div className="shrink-0 w-9 h-9 rounded-lg bg-paper-2 border border-line flex items-center justify-center font-mono text-[12px] tabular-nums text-ink-72">
                {t.sort_order}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className={`font-mono text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded border ${
                      t.is_published
                        ? 'text-moss bg-moss/10 border-moss/30'
                        : 'text-ink-72 bg-ink-72/10 border-ink-72/20'
                    }`}
                  >
                    {t.is_published ? 'Yayında' : 'Taslak'}
                  </span>
                  <Stars rating={t.rating} />
                </div>
                <p className="font-display text-base text-ink truncate">
                  <span className="font-semibold">{t.author_name}</span>
                  {t.author_role && (
                    <span className="text-ink-72 font-normal">
                      {' '}
                      · {t.author_role}
                    </span>
                  )}
                </p>
                <p className="text-sm text-ink-72 line-clamp-2 mt-0.5">
                  {t.body}
                </p>
                {t.source_note && (
                  <p className="text-[11px] text-ink-50 mt-1 font-mono truncate">
                    iç not: {t.source_note}
                  </p>
                )}
              </div>

              <GorusRowActions id={t.id} isPublished={t.is_published} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
