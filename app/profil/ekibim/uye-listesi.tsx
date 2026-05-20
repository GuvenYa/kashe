'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/app/components/EmptyState';
import { Users, Trash2 } from 'lucide-react';
import { removeMember } from '@/app/ajans/agency-actions';
import {
  getMemberRoleLabel,
  type AgencyMemberWithProfile,
} from '@/app/ajans/agency-data';

type Props = {
  members: AgencyMemberWithProfile[];
};

export function UyeListesi({ members }: Props) {
  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Ekibinde henüz üye yok"
        description="Profesyonelleri email ile davet et. Kabul edince ekibinde yer alacaklar."
      />
    );
  }

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <UyeSatiri key={member.id} member={member} />
      ))}
    </div>
  );
}

function UyeSatiri({ member }: { member: AgencyMemberWithProfile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const professional = member.professional;
  const name = professional?.full_name || 'İsimsiz';
  const categoryEmoji = professional?.service_categories?.emoji;
  const categoryName = professional?.service_categories?.name_tr;

  function handleRemove() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await removeMember(member.id);
      if (!r.success) {
        setError(r.error);
        setConfirming(false);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-white border border-line rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <Link
          href={professional ? `/p/${professional.id}` : '#'}
          className="flex items-center gap-3 group flex-1 min-w-0"
        >
          {professional?.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={professional.avatar_url}
              alt={name}
              className="w-12 h-12 rounded-full object-cover border border-line shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display font-semibold text-ink group-hover:text-terracotta transition-colors truncate">
              {name}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {categoryName && (
                <span className="text-xs text-ink-72">
                  {categoryEmoji && <span>{categoryEmoji} </span>}
                  {categoryName}
                </span>
              )}
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 bg-paper px-2 py-0.5 rounded">
                {getMemberRoleLabel(member.member_role)}
              </span>
            </div>
          </div>
        </Link>

        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleRemove}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
              confirming
                ? 'bg-terracotta text-paper border-terracotta'
                : 'border-line text-ink-72 hover:border-terracotta hover:text-terracotta'
            } disabled:opacity-50`}
          >
            <Trash2 size={12} strokeWidth={1.75} />
            {confirming ? 'Onayla' : 'Çıkar'}
          </button>
          {error && (
            <p className="text-[10px] text-terracotta mt-1">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}