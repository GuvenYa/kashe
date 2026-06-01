'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  Users,
  Tag,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  Star,
  Send,
  Pencil,
  Lock,
  Trash2,
} from 'lucide-react';
import {
  formatBudgetRange,
  formatListingAge,
  formatApplicationDeadline,
  isApplicationOpen,
  getEventTypeLabel,
  getListingStatusLabel,
  getListingStatusTone,
  getApplicationStatusLabel,
  getApplicationStatusTone,
  formatProposedAmount,
  canApplyToListing,
  canCloseListing,
  canCancelListing,
  canShortlistApplication,
  canAcceptApplication,
  canRejectApplication,
  type ListingWithRelations,
  type Application,
  type ApplicationWithRelations,
} from '../listings-data';
import {
  closeListing,
  cancelListing,
  shortlistApplication,
  acceptApplication,
  rejectApplication,
} from '../listings-actions';
import { ApplyModal } from './apply-modal';

type Props = {
  listing: ListingWithRelations;
  currentUserId: string | null;
  isOwner: boolean;
  isProfessional: boolean;
  myApplication: Application | null;
  applications: ApplicationWithRelations[];
};

export function IlanDetay({
  listing,
  currentUserId,
  isOwner,
  isProfessional,
  myApplication,
  applications,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  const statusTone = getListingStatusTone(listing.status);
  const statusLabel = getListingStatusLabel(listing.status);
  const cityName = listing.turkish_cities?.name;
  const categoryLabel = listing.service_categories?.name_tr ?? 'Kategori';
  const categoryEmoji = listing.service_categories?.emoji;
  const creatorName =
    listing.creator?.role === 'business' && listing.creator?.company_name
      ? listing.creator.company_name
      : listing.creator?.full_name || 'İsimsiz';

  const eventTypeLabel = listing.event_type
    ? getEventTypeLabel(listing.event_type)
    : null;

  const eventDateFormatted = listing.event_date
    ? new Date(listing.event_date).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const deadlineInfo = formatApplicationDeadline(listing.application_deadline);
  const applicationOpen = isApplicationOpen(
    listing.status,
    listing.application_deadline
  );

  // Action handlers
  function withConfirm(actionKey: string, action: () => Promise<void>) {
    if (confirming !== actionKey) {
      setConfirming(actionKey);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setConfirming(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Bir hata oluştu');
        setConfirming(null);
      }
    });
  }

  async function handleClose() {
    const result = await closeListing(listing.id);
    if (!result.success) throw new Error(result.error);
    router.refresh();
  }

  async function handleCancel() {
    const result = await cancelListing(listing.id);
    if (!result.success) throw new Error(result.error);
    router.refresh();
  }

  // Status badge styles
  const badgeStyles: Record<typeof statusTone, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    success: 'bg-[#1E3A5F] text-white border-[#1E3A5F]',
    danger: 'bg-terracotta/10 text-terracotta border-terracotta/30',
    neutral: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
  };

  return (
    <div className="bg-paper min-h-screen">
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-12">
        {/* Geri linki */}
        <Link
          href="/ilanlar"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.1em] text-ink-72 hover:text-terracotta mb-8 transition-colors"
        >
          <span>←</span> Tüm ilanlar
        </Link>

        {/* Hero */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-terracotta/8 text-terracotta rounded-full text-xs font-mono uppercase tracking-[0.1em]">
              {categoryEmoji && <span>{categoryEmoji}</span>}
              {categoryLabel}
            </span>
            {listing.status !== 'published' && (
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] font-medium border ${badgeStyles[statusTone]}`}
              >
                {statusLabel}
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl md:text-4xl text-ink leading-tight mb-3">
            {listing.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-72 font-mono">
            <span className="flex items-center gap-1">
              <Clock size={12} strokeWidth={1.75} />
              {formatListingAge(listing.published_at)}
            </span>
            <span className="flex items-center gap-1">
              <Eye size={12} strokeWidth={1.75} />
              {listing.views_count} görüntülenme
            </span>
            {deadlineInfo && (
              <span
                className={`flex items-center gap-1 ${
                  deadlineInfo.passed ? 'text-terracotta' : ''
                }`}
              >
                <Clock size={12} strokeWidth={1.75} />
                {deadlineInfo.label}
              </span>
            )}
          </div>
        </header>

        {/* Etkinlik özeti kartı */}
        {(eventTypeLabel ||
          eventDateFormatted ||
          listing.location ||
          listing.guest_count !== null) && (
          <div className="bg-white border border-line rounded-lg p-5 mb-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
              Etkinlik özeti
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {eventTypeLabel && (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-0.5">
                    Tür
                  </p>
                  <p className="text-ink font-medium">{eventTypeLabel}</p>
                </div>
              )}
              {eventDateFormatted && (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-0.5">
                    Tarih
                  </p>
                  <p className="text-ink font-medium">
                    {eventDateFormatted}
                  </p>
                </div>
              )}
              {listing.location && (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-0.5">
                    Lokasyon
                  </p>
                  <p className="text-ink font-medium">{listing.location}</p>
                  {cityName && (
                    <p className="text-xs text-ink-72">{cityName}</p>
                  )}
                </div>
              )}
              {listing.guest_count !== null && (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-0.5">
                    Kişi sayısı
                  </p>
                  <p className="text-ink font-medium">
                    {listing.guest_count}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bütçe + Açıklama */}
        <div className="bg-white border border-line rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-line">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
              Bütçe
            </p>
            <p className="font-display text-2xl text-ink font-medium">
              {formatBudgetRange(
                listing.budget_min,
                listing.budget_max,
                listing.currency
              )}
            </p>
          </div>

          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
            Açıklama
          </p>
          <p className="text-ink text-sm leading-relaxed whitespace-pre-wrap">
            {listing.description}
          </p>

          {listing.requirements && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mt-6 mb-2">
                Gereksinimler
              </p>
              <p className="text-ink text-sm leading-relaxed whitespace-pre-wrap">
                {listing.requirements}
              </p>
            </>
          )}
        </div>

        {/* İlan sahibi kartı */}
        {listing.creator && (
          <div className="bg-white border border-line rounded-lg p-5 mb-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
              İlan sahibi
            </p>
            <div className="flex items-center gap-3">
              {listing.creator.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={listing.creator.avatar_url}
                  alt={creatorName}
                  className="w-12 h-12 rounded-full object-cover border border-line"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold">
                  {creatorName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-display font-semibold text-ink">
                  {creatorName}
                </p>
                <p className="text-xs text-ink-72 font-mono uppercase tracking-[0.1em]">
                  {listing.creator.role === 'business'
                    ? 'Kurumsal'
                    : 'Müşteri'}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-terracotta/10 border border-terracotta/30 text-terracotta text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Aksiyonlar — koşullu */}
        <div className="mb-8">
          {/* ANONIM */}
          {!currentUserId && (
            <div className="bg-white border-2 border-terracotta/20 rounded-lg p-5 text-center">
              <p className="text-sm text-ink mb-3">
                Bu ilana başvurmak için giriş yapmalısın.
              </p>
              <Link
                href="/giris"
                className="inline-block px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
              >
                Giriş yap
              </Link>
            </div>
          )}

          {/* SAHIBI */}
          {isOwner && (
            <div className="bg-white border border-line rounded-lg p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
                İlanını yönet
              </p>
              <div className="flex flex-wrap gap-2">
                {canCloseListing(listing.status) && (
                  <button
                    onClick={() => withConfirm('close', handleClose)}
                    disabled={isPending}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-display font-semibold text-sm border transition ${
                      confirming === 'close'
                        ? 'bg-ink text-paper border-ink'
                        : 'border-line text-ink-72 hover:border-ink hover:text-ink'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Lock size={14} strokeWidth={1.75} />
                    {confirming === 'close'
                      ? 'Eminsen tekrar tıkla'
                      : 'Başvuruları kapat'}
                  </button>
                )}
                {canCancelListing(listing.status) && (
                  <button
                    onClick={() => withConfirm('cancel', handleCancel)}
                    disabled={isPending}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-display font-semibold text-sm border transition ${
                      confirming === 'cancel'
                        ? 'bg-terracotta text-paper border-terracotta'
                        : 'border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                    {confirming === 'cancel'
                      ? 'Eminsen tekrar tıkla'
                      : 'İlanı iptal et'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PROFESYONEL — BAŞVURMAMIŞ */}
          {isProfessional && !isOwner && !myApplication && applicationOpen && (
            <div className="bg-[#1E3A5F]/5 border-2 border-[#1E3A5F]/15 rounded-lg p-5">
              <p className="text-sm text-ink mb-4">
                Bu ilana başvurmak ister misin? İlan sahibine başvuru
                mesajın ve (varsa) fiyat teklifini iletilir.
              </p>
              <button
                onClick={() => setApplyModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#1E3A5F] text-white rounded-lg font-display font-semibold text-sm hover:bg-[#142745] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
              >
                <Send size={14} strokeWidth={1.75} />
                Başvur
              </button>
            </div>
          )}

          {/* PROFESYONEL — BAŞVURMUŞ */}
          {isProfessional && myApplication && (
            <div className="bg-[#1E3A5F]/5 border-2 border-[#1E3A5F]/15 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#1E3A5F]">
                  Başvurun
                </p>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] font-medium border ${
                    badgeStyles[
                      getApplicationStatusTone(myApplication.status)
                    ]
                  }`}
                >
                  {getApplicationStatusLabel(myApplication.status)}
                </span>
              </div>
              <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap mb-2">
                {myApplication.cover_message}
              </p>
              {myApplication.proposed_amount !== null && (
                <p className="text-sm text-ink mt-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 block mb-0.5">
                    Fiyat teklifin
                  </span>
                  <span className="font-display text-lg font-medium text-[#1E3A5F]">
                    {formatProposedAmount(
                      myApplication.proposed_amount,
                      myApplication.currency
                    )}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* PROFESYONEL — İlan published değil veya kendi ilanı veya başvuramıyor */}
          {isProfessional &&
            !isOwner &&
            !myApplication &&
            !applicationOpen && (
              <div className="bg-ink-72/5 border border-line rounded-lg p-5 text-center">
                <p className="text-sm text-ink-72">
                  {deadlineInfo?.passed
                    ? 'Bu ilanın başvuru süresi doldu.'
                    : 'Bu ilan artık başvuru kabul etmiyor.'}
                </p>
              </div>
            )}
        </div>

        {/* Başvurular bölümü — SADECE SAHİBİ GÖRÜR */}
        {isOwner && (
          <div className="mt-12">
            <h2 className="font-display text-2xl text-ink mb-4">
              Gelen başvurular{' '}
              <span className="text-ink-72 text-lg">
                ({applications.length})
              </span>
            </h2>

            {applications.length === 0 ? (
              <div className="bg-white border border-line rounded-lg p-8 text-center">
                <p className="text-sm text-ink-72">
                  Henüz başvuru yok. İlanın yayında, profesyoneller görüp
                  başvurabilir.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    application={app}
                    onAction={() => router.refresh()}
                  />
                ))}
              </div>
          )}
        </div>
      )}
      </div>

      {/* Apply Modal */}
      {isProfessional && !isOwner && !myApplication && (
        <ApplyModal
          listingId={listing.id}
          listingTitle={listing.title}
          open={applyModalOpen}
          onClose={() => setApplyModalOpen(false)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Application Card — sahibi için, başvuruları yönetme
// =============================================================================

function ApplicationCard({
  application,
  onAction,
}: {
  application: ApplicationWithRelations;
  onAction: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const applicant = application.applicant;
  const name =
    applicant?.role === 'business' && applicant?.company_name
      ? applicant.company_name
      : applicant?.full_name || 'İsimsiz';

  const tone = getApplicationStatusTone(application.status);
  const badgeStyles: Record<typeof tone, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    success: 'bg-[#1E3A5F] text-white border-[#1E3A5F]',
    danger: 'bg-terracotta/10 text-terracotta border-terracotta/30',
    neutral: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
  };

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
        onAction();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Hata');
        setConfirming(null);
      }
    });
  }

  async function handleShortlist() {
    const r = await shortlistApplication(application.id);
    if (!r.success) throw new Error(r.error);
  }
  async function handleAccept() {
    const r = await acceptApplication(application.id);
    if (!r.success) throw new Error(r.error);
  }
  async function handleReject() {
    const r = await rejectApplication(application.id);
    if (!r.success) throw new Error(r.error);
  }

  return (
    <div className="bg-white border border-line rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <Link
          href={applicant ? `/p/${applicant.id}` : '#'}
          className="flex items-center gap-3 group flex-1 min-w-0"
        >
          {applicant?.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={applicant.avatar_url}
              alt={name}
              className="w-10 h-10 rounded-full object-cover border border-line shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-sm shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display font-semibold text-ink group-hover:text-terracotta transition-colors truncate">
              {name}
            </p>
            <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72">
              {new Date(application.created_at).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </Link>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] font-medium border whitespace-nowrap ${badgeStyles[tone]}`}
        >
          {getApplicationStatusLabel(application.status)}
        </span>
      </div>

      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap mb-3">
        {application.cover_message}
      </p>

      {application.proposed_amount !== null && (
        <div className="flex items-center justify-between text-sm bg-paper/40 rounded-lg px-3 py-2 mb-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72">
            Fiyat teklifi
          </span>
          <span className="font-display font-medium text-[#1E3A5F]">
            {formatProposedAmount(
              application.proposed_amount,
              application.currency
            )}
          </span>
        </div>
      )}

      {error && (
        <p className="text-xs text-terracotta mb-2">{error}</p>
      )}

      {/* Aksiyon butonları */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-line">
        {canShortlistApplication(application.status) && (
          <button
            onClick={() => withConfirm('shortlist', handleShortlist)}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
              confirming === 'shortlist'
                ? 'bg-amber-500 text-white border-amber-500'
                : 'border-line text-ink-72 hover:border-amber-500 hover:text-amber-700'
            } disabled:opacity-50`}
          >
            <Star size={12} strokeWidth={1.75} />
            {confirming === 'shortlist' ? 'Onayla' : 'Kısa listeye al'}
          </button>
        )}
        {canAcceptApplication(application.status) && (
          <button
            onClick={() => withConfirm('accept', handleAccept)}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border text-white transition ${
              confirming === 'accept'
                ? 'bg-[#142745] border-[#142745]'
                : 'bg-[#1E3A5F] border-[#1E3A5F] hover:bg-[#142745]'
            } disabled:opacity-50`}
          >
            <CheckCircle2 size={12} strokeWidth={1.75} />
            {confirming === 'accept' ? 'Onayla' : 'Kabul et'}
          </button>
        )}
        {canRejectApplication(application.status) && (
          <button
            onClick={() => withConfirm('reject', handleReject)}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
              confirming === 'reject'
                ? 'bg-terracotta text-paper border-terracotta'
                : 'border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
            } disabled:opacity-50`}
          >
            <XCircle size={12} strokeWidth={1.75} />
            {confirming === 'reject' ? 'Onayla' : 'Reddet'}
          </button>
        )}
      </div> 
      
</div>
  );


}
