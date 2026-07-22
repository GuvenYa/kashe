'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, X } from 'lucide-react';
import { cancelTeamInvitation } from '@/app/kurumsal/business-actions';
import {
  getInvitationStatusLabel,
  getInvitationStatusTone,
  getMemberRoleLabel,
  formatInvitationAge,
  formatInvitationExpiry,
  canCancelInvitation,
  type BusinessInvitation,
} from '@/app/kurumsal/business-data';

type Props = {
  invitations: BusinessInvitation[];
  mode: 'pending' | 'past';
};

export function KurumsalDavetListesi({ invitations, mode }: Props) {
  return (
    <div className="space-y-3">
      {invitations.map((inv) => (
        <DavetSatiri key={inv.id} invitation={inv} mode={mode} />
      ))}
    </div>
  );
}

function DavetSatiri({
  invitation,
  mode,
}: {
  invitation: BusinessInvitation;
  mode: 'pending' | 'past';
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const tone = getInvitationStatusTone(invitation.status);
  const badgeStyles: Record<typeof tone, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    success: 'bg-[#1E3A5F] text-white border-[#1E3A5F]',
    danger: 'bg-brand-ink/10 text-brand-ink border-brand-ink/30',
    neutral: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
  };

  function handleCancel() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await cancelTeamInvitation(invitation.id);
      if (!r.success) {
        setError(r.error);
        setConfirming(false);
      } else {
        router.refresh();
      }
    });
  }

  const isPast = mode === 'past';

  return (
    <div
      className={`border rounded-lg p-4 ${
        isPast ? 'bg-paper/40 border-line/60' : 'bg-card border-line'
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isPast ? 'bg-ink-72/10' : 'bg-[#1E3A5F]/10'
            }`}
          >
            <Mail
              size={16}
              strokeWidth={1.75}
              className={isPast ? 'text-ink-72' : 'text-[#1E3A5F]'}
            />
          </div>
          <div className="min-w-0">
            <p className="font-display text-ink truncate">
              {invitation.invited_email}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] font-medium border ${badgeStyles[tone]}`}
              >
                {getInvitationStatusLabel(invitation.status)}
              </span>
              <span className="text-[10px] font-mono text-ink-72">
                Rol: {getMemberRoleLabel(invitation.member_role)}
              </span>
              <span className="text-[10px] font-mono text-ink-72">
                {formatInvitationAge(invitation.created_at)}
              </span>
              {invitation.status === 'pending' && (
                <span className="text-[10px] font-mono text-ink-72">
                  {formatInvitationExpiry(invitation.expires_at)}
                </span>
              )}
            </div>
            {invitation.invitation_message && (
              <p className="text-xs text-ink-72 mt-2 italic line-clamp-2">
                &ldquo;{invitation.invitation_message}&rdquo;
              </p>
            )}
          </div>
        </div>

        {canCancelInvitation(invitation.status) && (
          <button
            onClick={handleCancel}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition shrink-0 ${
              confirming
                ? 'bg-brand-ink text-paper border-brand-ink'
                : 'border-line text-ink-72 hover:border-brand-ink hover:text-brand-ink'
            } disabled:opacity-50`}
          >
            <X size={12} strokeWidth={1.75} />
            {confirming ? 'Onayla' : 'İptal et'}
          </button>
        )}
      </div>
      {error && <p className="text-[10px] text-danger mt-2">{error}</p>}
    </div>
  );
}
