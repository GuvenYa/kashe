'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Trash2, Calendar, MapPin } from 'lucide-react';
import {
  getApplicationStatusLabel,
  getApplicationStatusTone,
  formatProposedAmount,
  canWithdrawApplication,
  type ApplicationWithRelations,
} from '../ilanlar/listings-data';
import { withdrawApplication } from '../ilanlar/listings-actions';

type Props = {
  application: ApplicationWithRelations;
};

export function BasvuruSatiri({ application }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const tone = getApplicationStatusTone(application.status);
  const listing = application.listing;
  const categoryEmoji = (listing as unknown as {
    service_categories?: { name_tr: string; emoji: string | null } | null;
  })?.service_categories?.emoji;
  const categoryName =
    (listing as unknown as {
      service_categories?: { name_tr: string; emoji: string | null } | null;
    })?.service_categories?.name_tr ?? 'Kategori';

  function handleWithdraw() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await withdrawApplication(application.id);
      if (!r.success) {
        setError(r.error);
        setConfirming(false);
      } else {
        router.refresh();
        setConfirming(false);
      }
    });
  }

  const badgeStyles: Record<typeof tone, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    success: 'bg-[#1E3A5F] text-white border-[#1E3A5F]',
    danger: 'bg-terracotta/10 text-terracotta border-terracotta/30',
    neutral: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
  };

  const appDate = new Date(application.created_at);

  return (
    <div className="bg-white border border-line rounded-lg p-5">
      {/* Header: kategori + status */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-terracotta/8 text-terracotta rounded-full text-[10px] font-mono uppercase tracking-[0.1em]">
          {categoryEmoji && <span>{categoryEmoji}</span>}
          {categoryName}
        </span>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] font-medium border ${badgeStyles[tone]}`}
        >
          {getApplicationStatusLabel(application.status)}
        </span>
      </div>

      {/* İlan başlığı */}
      {listing && (
        <Link
          href={`/ilanlar/${listing.id}`}
          className="block mb-3 group"
        >
          <h3 className="font-display text-lg text-ink leading-snug group-hover:text-terracotta transition-colors line-clamp-2">
            {listing.title}
          </h3>
        </Link>
      )}

      {/* İlan meta */}
      {listing && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-72 mb-3">
          {(listing as unknown as { event_date?: string | null })?.event_date && (
            <span className="flex items-center gap-1">
              <Calendar size={12} strokeWidth={1.75} />
              {new Date(
                (listing as unknown as { event_date: string }).event_date
              ).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
          {(listing as unknown as { location?: string | null })?.location && (
            <span className="flex items-center gap-1">
              <MapPin size={12} strokeWidth={1.75} />
              {(listing as unknown as { location: string }).location}
            </span>
          )}
        </div>
      )}

      {/* Başvuru mesajı */}
      <div className="bg-paper/40 rounded-lg p-3 mb-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1">
          Başvuru mesajım
        </p>
        <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap line-clamp-3">
          {application.cover_message}
        </p>
      </div>

      {/* Fiyat teklifi */}
      {application.proposed_amount !== null && (
        <div className="flex items-center justify-between text-sm bg-[#1E3A5F]/5 rounded-lg px-3 py-2 mb-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72">
            Fiyat teklifim
          </span>
          <span className="font-display font-medium text-[#1E3A5F]">
            {formatProposedAmount(
              application.proposed_amount,
              application.currency
            )}
          </span>
        </div>
      )}

      {/* Tarih */}
      <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-3">
        Başvuru: {appDate.toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>

      {error && (
        <p className="text-xs text-terracotta mb-2">{error}</p>
      )}

      {/* Aksiyonlar */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-line">
        {listing && (
          <Link
            href={`/ilanlar/${listing.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border border-line text-ink-72 hover:border-terracotta hover:text-terracotta transition"
          >
            <Eye size={12} strokeWidth={1.75} />
            İlanı gör
          </Link>
        )}

        {canWithdrawApplication(application.status) && (
          <button
            onClick={handleWithdraw}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
              confirming
                ? 'bg-terracotta text-paper border-terracotta'
                : 'border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
            } disabled:opacity-50`}
          >
            <Trash2 size={12} strokeWidth={1.75} />
            {confirming ? 'Onayla' : 'Geri çek'}
          </button>
        )}
      </div>
    </div>
  );
}