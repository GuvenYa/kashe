'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  acceptListingInvitation,
  declineListingInvitation,
} from '@/app/ilanlar/invitations-actions';

export type IlanDaveti = {
  id: string;
  status: string;
  invitation_message: string | null;
  created_at: string;
  listing: {
    id: string;
    title: string;
  } | null;
  inviter: {
    id: string;
    full_name: string | null;
    company_name: string | null;
    avatar_url: string | null;
  } | null;
};

export function IlanDavetleriListesi({
  invitations,
}: {
  invitations: IlanDaveti[];
}) {
  const pending = invitations.filter((i) => i.status === 'pending');
  const past = invitations.filter((i) => i.status !== 'pending');

  if (invitations.length === 0) return null;

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-ink mb-3">
            Bekleyen ilan davetleri{' '}
            <span className="text-ink-72 text-base">({pending.length})</span>
          </h2>
          <div className="space-y-3">
            {pending.map((inv) => (
              <IlanDavetKarti key={inv.id} invitation={inv} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-ink mb-3">
            Geçmiş ilan davetleri{' '}
            <span className="text-ink-72 text-base">({past.length})</span>
          </h2>
          <div className="space-y-3">
            {past.map((inv) => (
              <IlanDavetKarti key={inv.id} invitation={inv} isPast />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Bekliyor',
  accepted: 'Kabul edildi',
  declined: 'Reddedildi',
  expired: 'Süresi doldu',
  cancelled: 'İptal edildi',
};

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  accepted: 'bg-moss text-paper border-moss',
  declined: 'bg-terracotta/10 text-terracotta border-terracotta/30',
  expired: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
  cancelled: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
};

function IlanDavetKarti({
  invitation,
  isPast = false,
}: {
  invitation: IlanDaveti;
  isPast?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'accept' | 'decline' | null>(
    null
  );

  const inviter = invitation.inviter;
  const inviterName =
    inviter?.company_name || inviter?.full_name || 'Bir müşteri';
  const listingTitle = invitation.listing?.title || 'Bir ilan';

  function withConfirm(key: 'accept' | 'decline', action: () => Promise<void>) {
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
    const r = await acceptListingInvitation(invitation.id);
    if (!r.success) throw new Error(r.error);
    router.refresh();
  }

  async function handleDecline() {
    const r = await declineListingInvitation(invitation.id);
    if (!r.success) throw new Error(r.error);
    router.refresh();
  }

  const tone = STATUS_TONE[invitation.status] ?? STATUS_TONE.expired;

  return (
    <div
      className={`border-2 rounded-lg p-5 ${
        isPast ? 'bg-paper/40 border-line/60' : 'bg-terracotta/5 border-terracotta/15'
      }`}
    >
      {/* Header — davet eden + ilan */}
      <div className="flex items-start gap-3 mb-4">
        <Link
          href={inviter ? `/p/${inviter.id}` : '#'}
          className="flex items-center gap-3 group flex-1 min-w-0"
        >
          {inviter?.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={inviter.avatar_url}
              alt={inviterName}
              className="w-12 h-12 rounded-full object-cover border border-line shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold shrink-0">
              {inviterName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-0.5">
              Davet eden
            </p>
            <p className="font-display text-lg text-ink group-hover:text-terracotta transition-colors truncate">
              {inviterName}
            </p>
          </div>
        </Link>

        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] font-medium border whitespace-nowrap ${tone}`}
        >
          {STATUS_LABEL[invitation.status] ?? invitation.status}
        </span>
      </div>

      {/* İlan başlığı */}
      <div className="mb-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1">
          İlan
        </p>
        <Link
          href={`/ilanlar/${invitation.listing?.id ?? ''}`}
          className="text-sm font-display font-semibold text-ink hover:text-terracotta transition-colors"
        >
          {listingTitle}
        </Link>
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

      {/* Aksiyonlar — sadece pending */}
      {!isPast && invitation.status === 'pending' && (
        <div className="flex gap-2 pt-3 border-t border-terracotta/15">
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
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-display font-semibold text-paper transition ${
              confirming === 'accept' ? 'bg-ember' : 'bg-terracotta hover:bg-ember'
            } disabled:opacity-50`}
          >
            <CheckCircle2 size={14} strokeWidth={1.75} />
            {confirming === 'accept' ? 'Onayla' : 'Kabul et'}
          </button>
        </div>
      )}

      {invitation.status === 'accepted' && (
        <div className="pt-3 border-t border-line/40">
          <Link
            href="/basvurularim"
            className="text-xs text-terracotta hover:text-ink font-medium transition-colors"
          >
            Başvurularımda gör →
          </Link>
        </div>
      )}
    </div>
  );
}