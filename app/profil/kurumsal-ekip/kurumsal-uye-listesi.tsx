'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/app/components/EmptyState';
import { Users, Trash2 } from 'lucide-react';
import { removeTeamMember } from '@/app/kurumsal/business-actions';
import { KurulusRolSecici } from '@/app/components/ui/kurulus-rol-secici';
import type { OrgRole } from '@/app/lib/org-roles';
import type { BusinessMemberWithProfile } from '@/app/kurumsal/business-data';

type Props = {
  members: BusinessMemberWithProfile[];
  /** FAZ 8-U: uye id -> kurulus rolu (satir yoksa anahtar yok -> viewer). */
  kurulusRolleri: Record<string, string>;
};

export function KurumsalUyeListesi({ members, kurulusRolleri }: Props) {
  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Ekibinde henüz üye yok"
        description="Ekip üyelerini email ile davet et. Kabul edince kurum hesabını birlikte yönetebilirsiniz."
      />
    );
  }

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <UyeSatiri
          key={member.id}
          member={member}
          kurulusRolu={kurulusRolleri[member.id]}
        />
      ))}
    </div>
  );
}

function UyeSatiri({
  member,
  kurulusRolu,
}: {
  member: BusinessMemberWithProfile;
  kurulusRolu: string | undefined;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const profile = member.member;
  // Üye herhangi bir kullanıcı — şirket adı varsa o, yoksa ad soyad
  const name = profile?.company_name || profile?.full_name || 'İsimsiz';

  function handleRemove() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await removeTeamMember(member.id);
      if (!r.success) {
        setError(r.error);
        setConfirming(false);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-card border border-line rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {profile?.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.avatar_url}
              alt={name}
              className="w-12 h-12 rounded-full object-cover border border-line shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-brand-ink flex items-center justify-center text-paper font-display font-semibold shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-ink truncate">
              {name}
            </p>
          </div>
        </div>

        {/* FAZ 8-U: kurulus rolu tek gercek; eski rol rozeti kalkti. */}
        <KurulusRolSecici
          membershipId={member.id}
          rol={(kurulusRolu ?? 'viewer') as OrgRole}
          aynalanmamis={kurulusRolu === undefined}
          yuzey="kurumsal"
        />

        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleRemove}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition ${
              confirming
                ? 'bg-brand-ink text-paper border-brand-ink'
                : 'border-line text-ink-72 hover:border-brand-ink hover:text-brand-ink'
            } disabled:opacity-50`}
          >
            <Trash2 size={12} strokeWidth={1.75} />
            {confirming ? 'Onayla' : 'Çıkar'}
          </button>
          {error && <p className="text-[10px] text-danger mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}
