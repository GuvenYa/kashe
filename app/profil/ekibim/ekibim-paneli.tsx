'use client';

import { useState } from 'react';
import { UyeDavetFormu } from './uye-davet-formu';
import { UyeListesi } from './uye-listesi';
import { DavetListesi } from './davet-listesi';
import type {
  AgencyMemberWithProfile,
  AgencyInvitation,
} from '@/app/ajans/agency-data';

type Props = {
  members: AgencyMemberWithProfile[];
  invitations: AgencyInvitation[];
  currentUserId: string;
};

export function EkibimPaneli({ members, invitations, currentUserId }: Props) {
  const [showInviteForm, setShowInviteForm] = useState(false);

  const pendingInvitations = invitations.filter(
    (i) => i.status === 'pending'
  );
  const pastInvitations = invitations.filter((i) => i.status !== 'pending');

  return (
    <div className="space-y-8">
      {/* Üst CTA — Yeni üye davet et */}
      {!showInviteForm && (
        <div className="bg-card border border-line rounded-lg p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-display text-lg text-ink">Yeni üye davet et</p>
            <p className="text-sm text-ink-72 mt-0.5">
              Email ile davet gönder, kabul edince ekibinde yer alsınlar.
            </p>
          </div>
          <button
            onClick={() => setShowInviteForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
          >
            <span className="text-base leading-none">+</span>
            Davet gönder
          </button>
        </div>
      )}

      {/* Davet formu (toggle) */}
      {showInviteForm && (
        <UyeDavetFormu onClose={() => setShowInviteForm(false)} />
      )}

      {/* Bekleyen davetler */}
      {pendingInvitations.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-ink mb-3">
            Bekleyen davetler{' '}
            <span className="text-ink-72 text-base">
              ({pendingInvitations.length})
            </span>
          </h2>
          <DavetListesi invitations={pendingInvitations} mode="pending" />
        </section>
      )}

      {/* Mevcut üyeler */}
      <section>
        <h2 className="font-display text-xl text-ink mb-3">
          Ekip üyeleri{' '}
          <span className="text-ink-72 text-base">({members.length})</span>
        </h2>
        <UyeListesi members={members} />
      </section>

      {/* Geçmiş davetler */}
      {pastInvitations.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-ink mb-3">
            Davet geçmişi{' '}
            <span className="text-ink-72 text-base">
              ({pastInvitations.length})
            </span>
          </h2>
          <DavetListesi invitations={pastInvitations} mode="past" />
        </section>
      )}
    </div>
  );
}