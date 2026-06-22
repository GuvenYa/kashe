'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Users,
  Calendar,
  Globe,
  Lock,
  Trash2,
  Pencil,
} from 'lucide-react';
import {
  getListingStatusLabel,
  getListingStatusTone,
  formatListingAge,
  canPublishListing,
  canCloseListing,
  canCancelListing,
  type ListingWithRelations,
} from '../ilanlar/listings-data';
import {
  publishListing,
  closeListing,
  cancelListing,
  deleteListing,
  activateUrgentSimulation,
  cancelUrgentSimulation,
} from '../ilanlar/listings-actions';
import { isUrgent } from '../ilanlar/listings-data';
import { getPromotionPlan } from '@/app/lib/promotion';
import { formatTRY } from '@/app/lib/premium';

type Props = {
  listing: ListingWithRelations & { application_count: number };
};

export function IlanSatiri({ listing }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const statusTone = getListingStatusTone(listing.status);
  const statusLabel = getListingStatusLabel(listing.status);
  const categoryEmoji = listing.service_categories?.emoji;
  const categoryName = listing.service_categories?.name_tr ?? 'Kategori';

  const isDraft = listing.status === 'draft';
  const isCancelled = listing.status === 'cancelled';
  const canDelete = isDraft || isCancelled;

  function withConfirm(key: string, action: () => Promise<void>) {
    if (confirming !== key) {
      setConfirming(key);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setConfirming(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Hata');
        setConfirming(null);
      }
    });
  }

  async function handlePublish() {
    const r = await publishListing(listing.id);
    if (!r.success) throw new Error(r.error);
    router.refresh();
  }

  async function handleClose() {
    const r = await closeListing(listing.id);
    if (!r.success) throw new Error(r.error);
    router.refresh();
  }

  async function handleCancel() {
    const r = await cancelListing(listing.id);
    if (!r.success) throw new Error(r.error);
    router.refresh();
  }

  async function handleDelete() {
    const r = await deleteListing(listing.id);
    if (!r.success) throw new Error(r.error);
    router.push('/ilanlarim');
  }

  async function handleUrgent() {
    const r = await activateUrgentSimulation(listing.id);
    if (!r.success) throw new Error(r.error);
    router.refresh();
  }

  async function handleUrgentCancel() {
    const r = await cancelUrgentSimulation(listing.id);
    if (!r.success) throw new Error(r.error);
    router.refresh();
  }

  const urgentActive = isUrgent(listing);
  const urgentPlan = getPromotionPlan('urgent');
  // Öne çıkarma sadece yayında/dolu ilan için
  const canPromote =
    listing.status === 'published' || listing.status === 'filled';

  const badgeStyles: Record<typeof statusTone, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    success: 'bg-[#1E3A5F] text-white border-[#1E3A5F]',
    danger: 'bg-terracotta/10 text-terracotta border-terracotta/30',
    neutral: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
  };

  return (
    <div className="bg-white border border-line rounded-lg p-5">
      {/* Header: kategori + status */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-terracotta/8 text-terracotta rounded-full text-[10px] font-mono uppercase tracking-[0.1em]">
          {categoryName}
        </span>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] font-medium border ${badgeStyles[statusTone]}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Başlık */}
      <Link
        href={`/ilanlar/${listing.id}`}
        className="block mb-3 group"
      >
        <h3 className="font-display text-lg text-ink leading-snug group-hover:text-terracotta transition-colors line-clamp-2">
          {listing.title}
        </h3>
      </Link>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-72 mb-4">
        <span className="flex items-center gap-1">
          <Calendar size={12} strokeWidth={1.75} />
          {listing.published_at
            ? formatListingAge(listing.published_at)
            : `Oluşturuldu: ${new Date(listing.created_at).toLocaleDateString(
                'tr-TR',
                { day: 'numeric', month: 'short' }
              )}`}
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} strokeWidth={1.75} />
          {listing.application_count} başvuru
        </span>
        <span className="flex items-center gap-1">
          <Eye size={12} strokeWidth={1.75} />
          {listing.views_count} görüntülenme
        </span>
      </div>

      {/* Admin notu — revizyon veya red durumunda */}
      {(listing.status === 'revision' || listing.status === 'rejected') &&
        listing.approval_note && (
          <div
            className={`mb-4 p-3 rounded-lg border text-sm ${
              listing.status === 'revision'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-terracotta/5 border-terracotta/30 text-ink'
            }`}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] mb-1">
              {listing.status === 'revision'
                ? 'Revizyon istendi'
                : 'Reddedildi'}
            </p>
            <p>{listing.approval_note}</p>
            {listing.status === 'revision' && (
              <p className="text-xs mt-2 opacity-80">
                Düzenleyip kaydedince ilan tekrar onaya gönderilir.
              </p>
            )}
          </div>
        )}

      {error && (
        <p className="text-xs text-terracotta mb-2">{error}</p>
      )}

      {confirming === 'urgent' && urgentPlan && (
        <div className="mb-3 p-3 bg-terracotta/5 border border-terracotta/20 rounded-lg">
          <p className="text-sm text-ink font-medium mb-0.5">
            {urgentPlan.label} · {urgentPlan.durationDays} gün ·{' '}
            {formatTRY(urgentPlan.price)}
          </p>
          <p className="text-xs text-ink-72 leading-relaxed">
            {urgentPlan.desc} İyzico ödeme entegrasyonu yakında — şimdilik
            ücretsiz deneyebilirsin. Onaylamak için tekrar tıkla.
          </p>
        </div>
      )}

      {/* Aksiyonlar */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-line">
        <Link
          href={`/ilanlar/${listing.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border border-line text-ink-72 hover:border-terracotta hover:text-terracotta transition"
        >
          <Eye size={12} strokeWidth={1.75} />
          Detay
        </Link>

        {canPromote && !urgentActive && (
          <button
            onClick={() => withConfirm('urgent', handleUrgent)}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
              confirming === 'urgent'
                ? 'bg-terracotta text-paper border-terracotta'
                : 'border-terracotta/40 text-terracotta hover:border-terracotta hover:bg-terracotta/5'
            } disabled:opacity-50`}
          >
            🔥
            {confirming === 'urgent'
              ? `Onayla (${urgentPlan ? formatTRY(urgentPlan.price) : ''})`
              : 'Öne çıkar'}
          </button>
        )}

        {canPromote && urgentActive && (
          <button
            onClick={() => withConfirm('urgent-cancel', handleUrgentCancel)}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
              confirming === 'urgent-cancel'
                ? 'bg-ink text-paper border-ink'
                : 'bg-terracotta/10 border-terracotta/40 text-terracotta hover:border-terracotta'
            } disabled:opacity-50`}
          >
            🔥
            {confirming === 'urgent-cancel' ? 'Kaldır onayla' : 'Acil aktif'}
          </button>
        )}

        {canPublishListing(listing.status) && (
          <button
            onClick={() => withConfirm('publish', handlePublish)}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border text-white transition ${
              confirming === 'publish'
                ? 'bg-[#142745] border-[#142745]'
                : 'bg-[#1E3A5F] border-[#1E3A5F] hover:bg-[#142745]'
            } disabled:opacity-50`}
          >
            <Globe size={12} strokeWidth={1.75} />
            {confirming === 'publish' ? 'Onayla' : 'Yayınla'}
          </button>
        )}

        {(listing.status === 'draft' ||
          listing.status === 'published' ||
          listing.status === 'revision' ||
          listing.status === 'rejected') && (
          <Link
            href={`/ilanlar/${listing.id}/duzenle`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border border-line text-ink-72 hover:border-terracotta hover:text-terracotta transition"
          >
            <Pencil size={12} strokeWidth={1.75} />
            Düzenle
          </Link>
        )}

        {canCloseListing(listing.status) && (
          <button
            onClick={() => withConfirm('close', handleClose)}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
              confirming === 'close'
                ? 'bg-ink text-paper border-ink'
                : 'border-line text-ink-72 hover:border-ink hover:text-ink'
            } disabled:opacity-50`}
          >
            <Lock size={12} strokeWidth={1.75} />
            {confirming === 'close' ? 'Onayla' : 'Kapat'}
          </button>
        )}

        {canCancelListing(listing.status) && (
          <button
            onClick={() => withConfirm('cancel', handleCancel)}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
              confirming === 'cancel'
                ? 'bg-terracotta text-paper border-terracotta'
                : 'border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
            } disabled:opacity-50`}
          >
            <Trash2 size={12} strokeWidth={1.75} />
            {confirming === 'cancel' ? 'Onayla' : 'İptal et'}
          </button>
        )}

        {canDelete && (
          <button
            onClick={() => withConfirm('delete', handleDelete)}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
              confirming === 'delete'
                ? 'bg-terracotta text-paper border-terracotta'
                : 'border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
            } disabled:opacity-50`}
          >
            <Trash2 size={12} strokeWidth={1.75} />
            {confirming === 'delete' ? 'Sil onayla' : 'Sil'}
          </button>
        )}
      </div>
    </div>
  );
}