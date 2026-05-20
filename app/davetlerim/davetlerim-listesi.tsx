'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EmptyState } from '@/app/components/EmptyState';
import { Mail, CheckCircle2, XCircle } from 'lucide-react';
import {
  acceptInvitation,
  declineInvitation,
} from '@/app/ajans/agency-actions';
import {
  getInvitationStatusLabel,
  getInvitationStatusTone,
  getMemberRoleLabel,
  formatInvitationAge,
  formatInvitationExpiry,
  canAcceptInvitation,
  canDeclineInvitation,
  type AgencyInvitationWithRelations,
} from '@/app/ajans/agency-data';

type Props = {
  invitations: AgencyInvitationWithRelations[];
  canAccept: boolean;
};

export function DavetlerimListesi({ invitations, canAccept }: Props) {
  const pending = invitations.filter((i) => i.status === 'pending');
  const past = invitations.filter((i) => i.status !== 'pending');

  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="Henüz davetin yok"
        description="Sana bir ajans davet gönderdiğinde burada görünür."
      />
    );
  }

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-ink mb-3">
            Bekleyen davetler{' '}
            <span className="text-ink-72 text-base">({pending.length})</span>
          </h2>
          <div className="space-y-3">
            {pending.map((inv) => (
              <DavetKarti
                key={inv.id}
                invitation={inv}
                canAccept={canAccept}
              />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-ink mb-3">
            Geçmiş davetler{' '}
            <span className="text-ink-72 text-base">({past.length})</span>
          </h2>
          <div className="space-y-3">
            {past.map((inv) => (
              <DavetKarti
                key={inv.id}
                invitation={inv}
                canAccept={false}
                isPast
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DavetKarti({
  invitation,
  canAccept,
  isPast = false,
}: {
  invitation: AgencyInvitationWithRelations;
  canAccept: boolean;
  isPast?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'accept' | 'decline' | null>(
    null
  );

  const agency = invitation.agency;
  const agencyName =
    agency?.company_name || agency?.full_name || 'Bir ajans';

  const tone = getInvitationStatusTone(invitation.status);
  const badgeStyles: Record<typeof tone, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    success: 'bg-[#1E3A5F] text-white border-[#1E3A5F]',
    danger: 'bg-terracotta/10 text-terracotta border-terracotta/30',
    neutral: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
  };

  function withConfirm(
    key: 'accept' | 'decline',
    action: () => Promise<void>
  ) {
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

  async function handleAccept() {
    const r = await acceptInvitation(invitation.id);
    if (!r.success) throw new Error(r.error);
    router.refresh();
  }

  async function handleDecline() {
    const r = await declineInvitation(invitation.id);
    if (!r.success) throw new Error(r.error);
    router.refresh();
  }

  const showActions =
    !isPast &&
    canAccept &&
    canAcceptInvitation(invitation.status) &&
    canDeclineInvitation(invitation.status);

  return (
    <div
      className={`border-2 rounded-lg p-5 ${
        isPast
          ? 'bg-paper/40 border-line/60'
          : 'bg-[#1E3A5F]/5 border-[#1E3A5F]/15'
      }`}
    >
      {/* Header — ajans bilgisi */}
      <div className="flex items-start gap-3 mb-4">
        <Link
          href={agency ? `/p/${agency.id}` : '#'}
          className="flex items-center gap-3 group flex-1 min-w-0"
        >
          {agency?.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={agency.avatar_url}
              alt={agencyName}
              className="w-12 h-12 rounded-full object-cover border border-line shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white font-display font-semibold shrink-0">
              {agencyName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-0.5">
              Ajans
            </p>
            <p className="font-display text-lg text-ink group-hover:text-terracotta transition-colors truncate">
              {agencyName}
            </p>
          </div>
        </Link>

        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] font-medium border whitespace-nowrap ${badgeStyles[tone]}`}
        >
          {getInvitationStatusLabel(invitation.status)}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-72 mb-3">
        <span>
          Rol önerilen:{' '}
          <strong className="text-ink">
            {getMemberRoleLabel(invitation.member_role)}
          </strong>
        </span>
        <span>{formatInvitationAge(invitation.created_at)}</span>
        {invitation.status === 'pending' && (
          <span>{formatInvitationExpiry(invitation.expires_at)}</span>
        )}
      </div>

      {/* Mesaj */}
      {invitation.invitation_message && (
        <div className="bg-white/60 rounded-lg p-3 mb-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1">
            Mesaj
          </p>
          <p className="text-sm text-ink leading-relaxed italic">
            &ldquo;{invitation.invitation_message}&rdquo;
          </p>
        </div>
      )}

      {error && (
        <div className="bg-terracotta/10 border border-terracotta/30 text-terracotta text-sm rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {/* Aksiyonlar */}
      {showActions && (
        <div className="flex gap-2 pt-3 border-t border-[#1E3A5F]/15">
          <button
            onClick={() => withConfirm('decline', handleDecline)}
            disabled={isPending}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-display font-semibold border transition ${
              confirming === 'decline'
                ? 'bg-terracotta text-paper border-terracotta'
                : 'border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
            } disabled:opacity-50`}
          >
            <XCircle size={14} strokeWidth={1.75} />
            {confirming === 'decline' ? 'Onayla' : 'Reddet'}
          </button>
          <button
            onClick={() => withConfirm('accept', handleAccept)}
            disabled={isPending}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-display font-semibold text-white transition ${
              confirming === 'accept'
                ? 'bg-[#142745]'
                : 'bg-[#1E3A5F] hover:bg-[#142745]'
            } disabled:opacity-50`}
          >
            <CheckCircle2 size={14} strokeWidth={1.75} />
            {confirming === 'accept' ? 'Onayla' : 'Kabul et'}
          </button>
        </div>
      )}

      {!showActions && invitation.status === 'pending' && !canAccept && (
        <div className="pt-3 border-t border-line/40">
          <p className="text-xs text-ink-72 text-center italic">
            Profesyonel hesap gerek
          </p>
        </div>
      )}
    </div>
  );
}