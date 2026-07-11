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
  Share2,
  BadgeCheck,
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
  canEditListing,
  canCloseListing,
  canCancelListing,
  canRestoreListing,
  canDeleteListing,
  canShortlistApplication,
  canAcceptApplication,
  canRejectApplication,
  canUnrejectApplication,
  canReopenListing,
  type ListingWithRelations,
  type Application,
  type ApplicationWithRelations,
  type SimilarListing,
} from '../listings-data';
import { BADGE_TONE_CLASS } from '@/app/lib/badges';
import {
  closeListing,
  cancelListing,
  restoreListing,
  deleteListing,
  reopenListing,
  shortlistApplication,
  acceptApplication,
  rejectApplication,
  unrejectApplication,
} from '../listings-actions';
import { cancelListingInvitation } from '../invitations-actions';
import { ApplyModal } from './apply-modal';
import { ApplicationAttachment } from '@/app/components/application-attachment';
import { SikayetButton } from '@/app/sikayet/sikayet-button';

// Gönderilen davet satırı (KALEM 1) — ilanın listing_invitations kaydı + davet edilen pro
export type SentInvitation = {
  id: string;
  status: string;
  created_at: string;
  professional: {
    id: string;
    full_name: string | null;
    company_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Props = {
  listing: ListingWithRelations;
  currentUserId: string | null;
  isOwner: boolean;
  /** Başvuru kararı (kabul/red/shortlist) verebilir mi: sahip VEYA kurum ilanında
   *  manager+ üye. */
  canDecide: boolean;
  /** "İlanını yönet" (close/cancel/reopen/restore/delete): sahip VEYA kurum
   *  ilanında owner-ROL üye (dilim 3b). manager YAPAMAZ. */
  canOwnerManage: boolean;
  isProfessional: boolean;
  myApplication: Application | null;
  applications: ApplicationWithRelations[];
  /** İlanın gönderdiği davetler (sahip + manager+ görür — KALEM 1) */
  sentInvitations: SentInvitation[];
  acceptedConversationId: string | null;
  myConversationId: string | null;
  /** Benzer ilanlar (aynı kategori, published, kendisi hariç — en fazla 3) */
  similarListings: SimilarListing[];
  /** İlan sahibinin yayında ilan sayısı (sahip kartı sinyali) */
  ownerListingCount: number;
};

export function IlanDetay({
  listing,
  currentUserId,
  isOwner,
  canDecide,
  canOwnerManage,
  isProfessional,
  myApplication,
  applications,
  sentInvitations,
  acceptedConversationId,
  myConversationId,
  similarListings,
  ownerListingCount,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [appViewMode, setAppViewMode] = useState<'list' | 'compare'>('list');

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
  const budgetLabel = formatBudgetRange(
    listing.budget_min,
    listing.budget_max,
    listing.currency
  );
  const publishedDateLabel = listing.published_at
    ? new Date(listing.published_at).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';
  const deadlineDateOnly = listing.application_deadline
    ? new Date(listing.application_deadline).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

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

  async function handleRestore() {
    const result = await restoreListing(listing.id);
    if (!result.success) throw new Error(result.error);
    router.refresh();
  }

  async function handleReopen() {
    const result = await reopenListing(listing.id);
    if (!result.success) throw new Error(result.error);
    router.refresh();
  }

  async function handleDelete() {
    const result = await deleteListing(listing.id);
    if (!result.success) throw new Error(result.error);
    router.push('/ilanlarim');
  }

  // Status badge styles
  const badgeStyles: Record<typeof statusTone, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    success: 'bg-[#1E3A5F] text-white border-[#1E3A5F]',
    danger: 'bg-terracotta/10 text-terracotta border-terracotta/30',
    neutral: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
  };

  // Owner kartı (masaüstü sağ kolon + mobil içerik sonu, aynı içerik)
  const ownerCard = listing.creator ? (
    <OwnerInfoCard
      creator={listing.creator}
      creatorName={creatorName}
      listingId={listing.id}
      isOwner={isOwner}
      isLoggedIn={!!currentUserId}
      listingCount={ownerListingCount}
    />
  ) : null;

  // Mercan (mockup) birincil CTA sınıfı
  const mercanCta =
    'inline-flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-[#E2674A] text-white rounded-lg font-display font-semibold text-sm hover:bg-[#cc5636] transition-colors';

  return (
    <div className="bg-paper min-h-screen pb-24 lg:pb-12">
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-8 md:py-10">
        {/* Geri linki */}
        <Link
          href="/ilanlar"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.1em] text-ink-72 hover:text-terracotta transition-colors"
        >
          <span>←</span> Tüm ilanlar
        </Link>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ═══════════ SOL KOLON (2/3) ═══════════ */}
          <div className="lg:col-span-2 min-w-0 space-y-6">
            {/* Hero */}
            <header>
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

              <h1 className="font-display text-3xl md:text-4xl font-bold text-ink leading-tight mb-3">
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
              </div>
            </header>

            {/* Etkinlik özeti */}
            {(eventTypeLabel ||
              eventDateFormatted ||
              listing.location ||
              listing.guest_count !== null) && (
              <div className="bg-card border border-line rounded-lg p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-3">
                  Etkinlik özeti
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {eventTypeLabel && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-0.5 flex items-center gap-1">
                        <Tag size={11} strokeWidth={1.75} /> Tür
                      </p>
                      <p className="text-ink font-semibold">{eventTypeLabel}</p>
                    </div>
                  )}
                  {eventDateFormatted && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-0.5 flex items-center gap-1">
                        <Calendar size={11} strokeWidth={1.75} /> Tarih
                      </p>
                      <p className="text-ink font-semibold">{eventDateFormatted}</p>
                    </div>
                  )}
                  {listing.location && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-0.5 flex items-center gap-1">
                        <MapPin size={11} strokeWidth={1.75} /> Lokasyon
                      </p>
                      <p className="text-ink font-semibold">{listing.location}</p>
                      {cityName && (
                        <p className="text-xs text-ink-72">{cityName}</p>
                      )}
                    </div>
                  )}
                  {listing.guest_count !== null && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-0.5 flex items-center gap-1">
                        <Users size={11} strokeWidth={1.75} /> Kişi sayısı
                      </p>
                      <p className="text-ink font-semibold">
                        {listing.guest_count}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Genel açıklama */}
            <div className="bg-card border border-line rounded-lg p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-2">
                Genel açıklama
              </p>
              <p className="text-ink text-sm leading-relaxed whitespace-pre-wrap">
                {listing.description}
              </p>
            </div>

            {/* Yapılandırılmış bölümler — koşullu (NULL/boşsa hiç render edilmez) */}
            <StructuredSection
              label="Proje detayları"
              content={listing.project_details}
            />
            <StructuredSection
              label="Aranan nitelikler"
              content={listing.requirements}
            />
            <StructuredSection
              label="Çalışma koşulları"
              content={listing.work_conditions}
            />

            {/* Başvurular bölümü — sahip VEYA kurum ilanında manager+ üye görür */}
            {canDecide && (
              <div id="basvurular" className="scroll-mt-24 pt-2">
                {acceptedConversationId && (
                  <div className="bg-[#1E3A5F]/5 border-2 border-[#1E3A5F]/15 rounded-lg p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#1E3A5F] mb-1">
                        Başvuru kabul edildi
                      </p>
                      <p className="text-sm text-ink">
                        Kabul ettiğin profesyonelle mesajlaşarak detayları
                        konuşabilirsin.
                      </p>
                    </div>
                    <Link
                      href={`/mesajlar/${acceptedConversationId}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E3A5F] text-white rounded-lg font-display font-semibold text-sm hover:bg-[#142745] transition-all shrink-0"
                    >
                      <Send size={14} strokeWidth={1.75} />
                      Konuşmaya git
                    </Link>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                  <h2 className="font-display text-2xl text-ink">
                    Gelen başvurular{' '}
                    <span className="text-ink-72 text-lg">
                      ({applications.length})
                    </span>
                  </h2>
                  {applications.length > 1 && (
                    <div className="inline-flex rounded-lg border border-line overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setAppViewMode('list')}
                        className={`px-3 py-1.5 text-xs font-display font-semibold transition ${
                          appViewMode === 'list'
                            ? 'bg-ink text-paper'
                            : 'bg-card text-ink-72 hover:text-ink'
                        }`}
                      >
                        Liste
                      </button>
                      <button
                        type="button"
                        onClick={() => setAppViewMode('compare')}
                        className={`px-3 py-1.5 text-xs font-display font-semibold transition ${
                          appViewMode === 'compare'
                            ? 'bg-ink text-paper'
                            : 'bg-card text-ink-72 hover:text-ink'
                        }`}
                      >
                        Karşılaştır
                      </button>
                    </div>
                  )}
                </div>

                {applications.length === 0 ? (
                  <div className="bg-card border border-line rounded-lg p-8 text-center">
                    <p className="text-sm text-ink-72">
                      Henüz başvuru yok. İlanın yayında, profesyoneller görüp
                      başvurabilir.
                    </p>
                  </div>
                ) : appViewMode === 'compare' ? (
                  <div className="-mx-6 md:mx-0 px-6 md:px-0 overflow-x-auto">
                    <div className="flex gap-4 min-w-min pb-2">
                      {applications.map((app) => (
                        <ApplicationCompareColumn
                          key={app.id}
                          application={app}
                          onAction={() => router.refresh()}
                        />
                      ))}
                    </div>
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

            {/* Gönderilen davetler (sahip + manager+ görür) — KALEM 1 */}
            {canDecide && sentInvitations.length > 0 && (
              <GonderilenDavetler invitations={sentInvitations} />
            )}

            {/* Benzer ilanlar — 0 ise gizli */}
            {similarListings.length > 0 && (
              <SimilarListingsBlock listings={similarListings} />
            )}

            {/* Sahip kartı — MOBİLDE içerik sonunda */}
            {ownerCard && <div className="lg:hidden">{ownerCard}</div>}
          </div>

          {/* ═══════════ SAĞ KOLON (1/3, sticky) ═══════════ */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 space-y-4">
              {/* Bütçe + tarihler + CTA/yönetim */}
              <div className="bg-card border border-line rounded-lg p-5">
                {/* Bütçe */}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-1">
                    Bütçe
                  </p>
                  <p className="font-display text-2xl md:text-[28px] leading-tight text-ink font-medium">
                    {budgetLabel}
                  </p>
                </div>

                {/* Tarihler */}
                <div className="mt-4 pt-4 border-t border-line space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink-72">İlan tarihi</span>
                    <span className="text-ink">{publishedDateLabel}</span>
                  </div>
                  {deadlineDateOnly && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-ink-72">Son başvuru</span>
                      <span className="text-[#E2674A] font-medium">
                        {deadlineDateOnly}
                      </span>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="mt-4 bg-danger-08 border border-danger/30 text-danger text-sm rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                {/* CTA / yönetim paneli / kapalı bandı */}
                <div className="mt-4 pt-4 border-t border-line">
                  {canDecide ? (
                    /* ── YÖNETİM PANELİ (mockup 1d) — sahip/manager+ ── */
                    <div>
                      <p className="font-display font-semibold text-ink mb-1">
                        Bu senin ilanın
                      </p>
                      <p className="text-xs text-ink-72 mb-3">
                        Başvuruları değerlendir, ilanını yönet.
                      </p>
                      <div className="space-y-2">
                        <a
                          href="#basvurular"
                          className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-ink/90 transition-colors"
                        >
                          <Users size={14} strokeWidth={1.75} />
                          Başvuruları görüntüle ({applications.length})
                        </a>
                        {canEditListing(listing.status) && (
                          <Link
                            href={`/ilanlar/${listing.id}/duzenle`}
                            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-line text-ink-72 rounded-lg font-display font-semibold text-sm hover:border-ink hover:text-ink transition-colors"
                          >
                            <Pencil size={14} strokeWidth={1.75} />
                            Düzenle
                          </Link>
                        )}
                      </div>

                      {/* Owner-rol aksiyonları (close/cancel/reopen/restore/delete) —
                          canOwnerManage koşulu ve mevcut yetki kuralları AYNEN. */}
                      {canOwnerManage &&
                        (canCloseListing(listing.status) ||
                          canReopenListing(listing.status) ||
                          canCancelListing(listing.status) ||
                          canRestoreListing(listing.status) ||
                          canDeleteListing(listing.status)) && (
                          <div className="mt-3 pt-3 border-t border-line">
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-2">
                              İlanını yönet
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {canCloseListing(listing.status) && (
                                <button
                                  onClick={() => withConfirm('close', handleClose)}
                                  disabled={isPending}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-display font-semibold text-xs border transition ${
                                    confirming === 'close'
                                      ? 'bg-ink text-paper border-ink'
                                      : 'border-line text-ink-72 hover:border-ink hover:text-ink'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  <Lock size={13} strokeWidth={1.75} />
                                  {confirming === 'close'
                                    ? 'Eminsen tekrar tıkla'
                                    : 'Başvuruları kapat'}
                                </button>
                              )}
                              {canReopenListing(listing.status) && (
                                <button
                                  onClick={() => withConfirm('reopen', handleReopen)}
                                  disabled={isPending}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-display font-semibold text-xs border transition ${
                                    confirming === 'reopen'
                                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                                      : 'border-line text-ink-72 hover:border-[#1E3A5F] hover:text-[#1E3A5F]'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  <Send size={13} strokeWidth={1.75} />
                                  {confirming === 'reopen'
                                    ? 'Eminsen tekrar tıkla'
                                    : 'Tekrar aç'}
                                </button>
                              )}
                              {canCancelListing(listing.status) && (
                                <button
                                  onClick={() => withConfirm('cancel', handleCancel)}
                                  disabled={isPending}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-display font-semibold text-xs border transition ${
                                    confirming === 'cancel'
                                      ? 'bg-terracotta text-paper border-terracotta'
                                      : 'border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  <Trash2 size={13} strokeWidth={1.75} />
                                  {confirming === 'cancel'
                                    ? 'Eminsen tekrar tıkla'
                                    : 'İlanı iptal et'}
                                </button>
                              )}
                              {canRestoreListing(listing.status) && (
                                <button
                                  onClick={() => withConfirm('restore', handleRestore)}
                                  disabled={isPending}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-display font-semibold text-xs border transition ${
                                    confirming === 'restore'
                                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                                      : 'border-line text-ink-72 hover:border-[#1E3A5F] hover:text-[#1E3A5F]'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  <Pencil size={13} strokeWidth={1.75} />
                                  {confirming === 'restore'
                                    ? 'Eminsen tekrar tıkla'
                                    : 'Taslağa geri al'}
                                </button>
                              )}
                              {canDeleteListing(listing.status) && (
                                <button
                                  onClick={() => withConfirm('delete', handleDelete)}
                                  disabled={isPending}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-display font-semibold text-xs border transition ${
                                    confirming === 'delete'
                                      ? 'bg-danger text-paper border-danger'
                                      : 'border-line text-ink-72 hover:border-danger hover:text-danger'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  <Trash2 size={13} strokeWidth={1.75} />
                                  {confirming === 'delete'
                                    ? 'Kalıcı olarak sil'
                                    : 'İlanı sil'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  ) : isProfessional && myApplication ? (
                    /* ── PROFESYONEL — BAŞVURMUŞ ── */
                    <div>
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
                      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                        {myApplication.cover_message}
                      </p>
                      {myApplication.proposed_amount !== null && (
                        <p className="text-sm text-ink mt-3">
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
                      {myApplication.status === 'accepted' &&
                        myConversationId && (
                          <Link
                            href={`/mesajlar/${myConversationId}`}
                            className="mt-4 inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 bg-[#1E3A5F] text-white rounded-lg font-display font-semibold text-sm hover:bg-[#142745] transition-all"
                          >
                            <Send size={14} strokeWidth={1.75} />
                            Konuşmaya git
                          </Link>
                        )}
                    </div>
                  ) : !applicationOpen ? (
                    /* ── KAPALI/DOLU İLAN BANDI (Design rötuşu: belirgin) ── */
                    <div className="bg-terracotta/8 border border-terracotta/25 rounded-lg px-4 py-3.5 text-center">
                      <p className="font-display font-semibold text-terracotta text-sm">
                        {deadlineInfo?.passed
                          ? 'Başvurular kapandı'
                          : 'Bu ilan başvuru kabul etmiyor'}
                      </p>
                      {deadlineInfo?.passed && deadlineDateOnly && (
                        <p className="text-xs text-ink-72 mt-1">
                          Son başvuru: {deadlineDateOnly}
                        </p>
                      )}
                    </div>
                  ) : !currentUserId ? (
                    /* ── ANONİM ── */
                    <div className="text-center">
                      <p className="text-sm text-ink mb-3">
                        Bu ilana başvurmak için giriş yapmalısın.
                      </p>
                      <Link href="/giris" className={mercanCta}>
                        Giriş yap
                      </Link>
                    </div>
                  ) : isProfessional ? (
                    /* ── PROFESYONEL — BAŞVURABİLİR ── */
                    <div>
                      <button
                        onClick={() => setApplyModalOpen(true)}
                        className={mercanCta}
                      >
                        <Send size={15} strokeWidth={1.75} />
                        Başvur
                      </button>
                      <p className="text-xs text-ink-72 text-center mt-2">
                        Başvurun ilan sahibine iletilir.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Sahip kartı — masaüstünde sağ kolonda */}
              {ownerCard && <div className="hidden lg:block">{ownerCard}</div>}

              {/* Paylaş */}
              <ShareButton title={listing.title} />
            </div>
          </aside>
        </div>
      </div>

      {/* MOBİL — alta sabit çubuk (mockup 1c) */}
      {(canDecide ||
        isProfessional ||
        !currentUserId ||
        !applicationOpen) && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-line px-4 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-mono uppercase tracking-[0.12em] text-ink-72">
              Bütçe
            </p>
            <p className="font-display text-ink font-medium truncate leading-tight">
              {budgetLabel}
            </p>
          </div>
          {canDecide ? (
            <a
              href="#basvurular"
              className="inline-flex items-center gap-1.5 px-5 py-3 bg-ink text-paper rounded-lg font-display font-semibold text-sm shrink-0"
            >
              Başvurular ({applications.length})
            </a>
          ) : isProfessional && myApplication ? (
            <span
              className={`px-3 py-2 rounded-full text-[11px] font-mono uppercase tracking-[0.08em] font-medium border shrink-0 ${
                badgeStyles[getApplicationStatusTone(myApplication.status)]
              }`}
            >
              {getApplicationStatusLabel(myApplication.status)}
            </span>
          ) : !applicationOpen ? (
            <span className="px-4 py-2.5 rounded-lg text-xs font-display font-semibold bg-terracotta/10 text-terracotta border border-terracotta/30 shrink-0">
              {deadlineInfo?.passed ? 'Kapandı' : 'Kapalı'}
            </span>
          ) : !currentUserId ? (
            <Link
              href="/giris"
              className="inline-flex items-center gap-1.5 px-6 py-3 bg-[#E2674A] text-white rounded-lg font-display font-semibold text-sm shrink-0"
            >
              Giriş yap
            </Link>
          ) : isProfessional ? (
            <button
              onClick={() => setApplyModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-6 py-3 bg-[#E2674A] text-white rounded-lg font-display font-semibold text-sm shrink-0"
            >
              <Send size={15} strokeWidth={1.75} />
              Başvur
            </button>
          ) : null}
        </div>
      )}

      {/* Apply Modal — canDecide olan (sahip/manager+) için render edilmez */}
      {isProfessional && !canDecide && !myApplication && (
        <ApplyModal
          listingId={listing.id}
          listingTitle={listing.title}
          categorySlug={listing.service_categories?.slug ?? null}
          open={applyModalOpen}
          onClose={() => setApplyModalOpen(false)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Yapılandırılmış bölüm — satırlara böl, boş olmayan her satır madde
// =============================================================================

function StructuredSection({
  label,
  content,
}: {
  label: string;
  content: string | null;
}) {
  if (!content || !content.trim()) return null;
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  return (
    <div className="bg-card border border-line rounded-lg p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-3">
        {label}
      </p>
      <ul className="space-y-2">
        {lines.map((line, i) => (
          <li
            key={i}
            className="flex gap-2.5 text-sm text-ink leading-relaxed"
          >
            <span
              className="shrink-0 select-none text-[#E2674A]"
              aria-hidden="true"
            >
              —
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// Benzer ilanlar — masaüstü 3'lü grid, mobil yatay kaydırma
// =============================================================================

function SimilarListingsBlock({ listings }: { listings: SimilarListing[] }) {
  return (
    <div className="pt-2">
      <h2 className="font-display text-xl text-ink mb-4">Benzer ilanlar</h2>
      <div className="-mx-6 md:mx-0 px-6 md:px-0 flex md:grid md:grid-cols-3 gap-4 overflow-x-auto pb-2 snap-x">
        {listings.map((l) => (
          <Link
            key={l.id}
            href={`/ilanlar/${l.id}`}
            className="snap-start shrink-0 w-64 md:w-auto bg-card border border-line rounded-lg p-4 hover:border-terracotta hover:-translate-y-0.5 transition-all flex flex-col"
          >
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.1em] text-terracotta mb-2">
              {l.service_categories?.emoji && (
                <span>{l.service_categories.emoji}</span>
              )}
              {l.service_categories?.name_tr ?? 'Kategori'}
            </span>
            <p className="font-display font-medium text-ink leading-tight line-clamp-2 mb-3 flex-1">
              {l.title}
            </p>
            <p className="font-display text-sm text-ink font-medium">
              {formatBudgetRange(l.budget_min, l.budget_max, l.currency)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Paylaş — navigator.share varsa native, yoksa panoya kopyala
// =============================================================================

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    // Native paylaşım (mobil) — iptal edilirse sessizce çık
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* kullanıcı iptal etti */
      }
      return;
    }
    // Fallback: panoya kopyala
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* pano erişimi yok — sessiz */
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-line rounded-lg font-mono text-[11px] uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta hover:border-terracotta transition-colors"
    >
      <Share2 size={13} strokeWidth={1.75} />
      {copied ? 'Kopyalandı ✓' : 'İlanı paylaş'}
    </button>
  );
}

// =============================================================================
// İlan sahibi kartı — avatar + ad + doğrulanmış + tip + sinyaller
// =============================================================================

function OwnerInfoCard({
  creator,
  creatorName,
  listingId,
  isOwner,
  isLoggedIn,
  listingCount,
}: {
  creator: NonNullable<ListingWithRelations['creator']>;
  creatorName: string;
  listingId: string;
  isOwner: boolean;
  isLoggedIn: boolean;
  listingCount: number;
}) {
  const isVerified = creator.approval_status === 'approved';
  const typeLabel = creator.role === 'business' ? 'Kurumsal' : 'Müşteri';
  const memberSince = creator.created_at
    ? new Date(creator.created_at).toLocaleDateString('tr-TR', {
        month: 'long',
        year: 'numeric',
      })
    : null;
  // Kamuya açık profil sayfası olan hesaplar (kurumsal) için profil linki
  const showProfileLink = creator.role === 'business';

  return (
    <div className="bg-card border border-line rounded-lg p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-3">
        İlan sahibi
      </p>
      <div className="flex items-center gap-3">
        {creator.avatar_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={creator.avatar_url}
            alt={creatorName}
            className="w-12 h-12 rounded-full object-cover border border-line shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold shrink-0">
            {creatorName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-display font-semibold text-ink flex items-center gap-1.5">
            <span className="truncate">{creatorName}</span>
            {isVerified && (
              <BadgeCheck
                size={15}
                strokeWidth={2}
                className="text-[#1F5C4A] shrink-0"
                aria-label="Doğrulanmış"
              />
            )}
          </p>
          <p className="text-[10px] text-ink-72 font-mono uppercase tracking-[0.1em]">
            {typeLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-line text-xs text-ink-72">
        {listingCount} ilan yayınladı
        {memberSince && ` · Üye: ${memberSince}`}
      </div>

      {showProfileLink && (
        <Link
          href={`/p/${creator.id}`}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:text-ember transition-colors"
        >
          Profili görüntüle →
        </Link>
      )}

      {/* Şikayet — sahibi olmayan herkese */}
      {!isOwner && (
        <div className="mt-4 pt-4 border-t border-line flex justify-end">
          <SikayetButton
            targetType="listing"
            targetId={listingId}
            isLoggedIn={isLoggedIn}
            variant="link"
            label="İlanı şikayet et"
          />
        </div>
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
  async function handleUnreject() {
    const r = await unrejectApplication(application.id);
    if (!r.success) throw new Error(r.error);
  }

  return (
    <div className="bg-card border border-line rounded-lg p-5">
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

      {application.attachment_path && (
        <div className="mb-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1.5">
            Eklenen dosya
          </p>
          <ApplicationAttachment
            applicationId={application.id}
            attachmentPath={application.attachment_path}
            attachmentType={application.attachment_type}
            attachmentName={application.attachment_name}
          />
        </div>
      )}

      {error && <p className="text-xs text-danger mb-2">{error}</p>}

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
        {canUnrejectApplication(application.status) && (
          <button
            onClick={() => withConfirm('unreject', handleUnreject)}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
              confirming === 'unreject'
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'border-line text-ink-72 hover:border-[#1E3A5F] hover:text-[#1E3A5F]'
            } disabled:opacity-50`}
          >
            <Send size={12} strokeWidth={1.75} />
            {confirming === 'unreject' ? 'Onayla' : 'Geri al'}
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Application Compare Column — yan yana karşılaştırma sütunu
// =============================================================================

function ApplicationCompareColumn({
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

  const rating = application.applicantRating;
  const proBadges = application.applicantBadges ?? [];

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
    <div className="bg-card border border-line rounded-lg p-4 w-72 shrink-0 flex flex-col">
      {/* Başvuran */}
      <Link
        href={applicant ? `/p/${applicant.id}` : '#'}
        className="flex flex-col items-center text-center gap-2 group pb-3 border-b border-line"
      >
        {applicant?.avatar_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={applicant.avatar_url}
            alt={name}
            className="w-14 h-14 rounded-full object-cover border border-line"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-lg">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <p className="font-display font-semibold text-ink group-hover:text-terracotta transition-colors leading-tight">
          {name}
        </p>
      </Link>

      {/* Puan */}
      <div className="py-2.5 border-b border-line text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1">
          Puan
        </p>
        {rating && rating.count > 0 ? (
          <p className="text-sm text-ink flex items-center justify-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-plum)" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <span className="font-display font-semibold">{rating.average}</span>
            <span className="text-ink-72">({rating.count})</span>
          </p>
        ) : (
          <p className="text-sm text-ink-72">Henüz yok</p>
        )}
      </div>

      {/* Rozetler */}
      {proBadges.length > 0 && (
        <div className="py-2.5 border-b border-line">
          <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1.5 text-center">
            Rozetler
          </p>
          <div className="flex flex-wrap gap-1 justify-center">
            {proBadges.map((b) => (
              <span
                key={b.key}
                className={`font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full border ${BADGE_TONE_CLASS[b.tone]}`}
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fiyat */}
      <div className="py-2.5 border-b border-line text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1">
          Fiyat teklifi
        </p>
        {application.proposed_amount !== null ? (
          <p className="font-display text-lg font-medium text-[#1E3A5F]">
            {formatProposedAmount(
              application.proposed_amount,
              application.currency
            )}
          </p>
        ) : (
          <p className="text-sm text-ink-72">Belirtmedi</p>
        )}
      </div>

      {/* Durum */}
      <div className="py-2.5 border-b border-line text-center">
        <span
          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] font-medium border ${badgeStyles[tone]}`}
        >
          {getApplicationStatusLabel(application.status)}
        </span>
      </div>

      {/* Mesaj */}
      <div className="py-2.5 border-b border-line flex-1">
        <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1">
          Mesaj
        </p>
        <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap line-clamp-6">
          {application.cover_message}
        </p>
      </div>

      {/* Ek */}
      <div className="py-2.5 border-b border-line text-center">
        {application.attachment_path ? (
          <span className="inline-flex items-center gap-1 text-xs text-moss">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dosya ekli
          </span>
        ) : (
          <span className="text-xs text-ink-72">Ek yok</span>
        )}
      </div>

      {error && <p className="text-xs text-danger mt-2">{error}</p>}

      {/* Aksiyonlar */}
      <div className="flex flex-col gap-1.5 pt-3">
        {canAcceptApplication(application.status) && (
          <button
            onClick={() => withConfirm('accept', handleAccept)}
            disabled={isPending}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border text-white transition ${
              confirming === 'accept'
                ? 'bg-[#142745] border-[#142745]'
                : 'bg-[#1E3A5F] border-[#1E3A5F] hover:bg-[#142745]'
            } disabled:opacity-50`}
          >
            <CheckCircle2 size={12} strokeWidth={1.75} />
            {confirming === 'accept' ? 'Onayla' : 'Kabul et'}
          </button>
        )}
        {canShortlistApplication(application.status) && (
          <button
            onClick={() => withConfirm('shortlist', handleShortlist)}
            disabled={isPending}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
              confirming === 'shortlist'
                ? 'bg-amber-500 text-white border-amber-500'
                : 'border-line text-ink-72 hover:border-amber-500 hover:text-amber-700'
            } disabled:opacity-50`}
          >
            <Star size={12} strokeWidth={1.75} />
            {confirming === 'shortlist' ? 'Onayla' : 'Kısa listeye al'}
          </button>
        )}
        {canRejectApplication(application.status) && (
          <button
            onClick={() => withConfirm('reject', handleReject)}
            disabled={isPending}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
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

// =============================================================================
// Gönderilen davetler — sahip + manager+ için (KALEM 1)
// =============================================================================

const INVITATION_STATUS_LABEL: Record<string, string> = {
  pending: 'Bekliyor',
  accepted: 'Kabul edildi',
  declined: 'Reddedildi',
  expired: 'Süresi doldu',
  cancelled: 'İptal edildi',
};

const INVITATION_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  accepted: 'bg-[#1E3A5F] text-white border-[#1E3A5F]',
  declined: 'bg-terracotta/10 text-terracotta border-terracotta/30',
  expired: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
  cancelled: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
};

function GonderilenDavetler({
  invitations,
}: {
  invitations: SentInvitation[];
}) {
  return (
    <div className="pt-2">
      <h2 className="font-display text-2xl text-ink mb-4">
        Gönderilen davetler{' '}
        <span className="text-ink-72 text-lg">({invitations.length})</span>
      </h2>
      <div className="space-y-3">
        {invitations.map((inv) => (
          <DavetSatiri key={inv.id} invitation={inv} />
        ))}
      </div>
    </div>
  );
}

function DavetSatiri({ invitation }: { invitation: SentInvitation }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const pro = invitation.professional;
  const proName = pro?.company_name || pro?.full_name || 'Profesyonel';
  const statusClass =
    INVITATION_STATUS_CLASS[invitation.status] ??
    INVITATION_STATUS_CLASS.expired;

  function handleCancel() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await cancelListingInvitation(invitation.id);
      if (r.success) {
        router.refresh();
      } else {
        setError(r.error || 'İptal edilemedi.');
        setConfirming(false);
      }
    });
  }

  return (
    <div className="bg-card border border-line rounded-lg p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          href={pro ? `/p/${pro.id}` : '#'}
          className="flex items-center gap-3 group min-w-0"
        >
          {pro?.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={pro.avatar_url}
              alt={proName}
              className="w-9 h-9 rounded-full object-cover border border-line shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-xs shrink-0">
              {proName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display font-semibold text-ink group-hover:text-terracotta transition-colors truncate">
              {proName}
            </p>
            <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72">
              {new Date(invitation.created_at).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] font-medium border whitespace-nowrap ${statusClass}`}
          >
            {INVITATION_STATUS_LABEL[invitation.status] ?? invitation.status}
          </span>
          {invitation.status === 'pending' && (
            <button
              onClick={handleCancel}
              disabled={isPending}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
                confirming
                  ? 'bg-terracotta text-paper border-terracotta'
                  : 'border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
              } disabled:opacity-50`}
            >
              {confirming ? 'Onayla' : 'İptal et'}
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </div>
  );
}
