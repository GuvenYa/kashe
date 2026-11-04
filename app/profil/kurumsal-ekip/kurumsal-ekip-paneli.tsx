'use client';

import { useState } from 'react';
import { KurumsalUyeDavetFormu } from './kurumsal-uye-davet-formu';
import { KurumsalUyeListesi } from './kurumsal-uye-listesi';
import { KurumsalDavetListesi } from './kurumsal-davet-listesi';
import type {
  BusinessMemberWithProfile,
  BusinessInvitation,
} from '@/app/kurumsal/business-data';

type Props = {
  members: BusinessMemberWithProfile[];
  invitations: BusinessInvitation[];
  currentUserId: string;
  /** A7: sayfanin sectigi kurulus — davet eylemi bu kimlige gider. */
  orgId: string;
};

// FAZ 10a: kurulus rolu uyelik satirinin kendisinde (member.role).
export function KurumsalEkipPaneli({ members, invitations, orgId }: Props) {
  const [showInviteForm, setShowInviteForm] = useState(false);
  /** Duzeltme 05-A: gonderilen davetin geri bildirimi (bulgu 63). */
  const [basari, setBasari] = useState<{
    email: string;
    rolEtiketi: string;
  } | null>(null);

  const pendingInvitations = invitations.filter(
    (i) => i.status === 'pending'
  );
  const pastInvitations = invitations.filter((i) => i.status !== 'pending');

  return (
    <div className="space-y-8">
      {/* Davet gönderildi — panelin EN ÜSTÜ: kullanıcı aşağı kaydırmadan görür */}
      {basari && (
        <div
          role="status"
          aria-live="polite"
          className="bg-ink-blue/5 border-2 border-ink-blue/15 rounded-lg p-5 flex items-start justify-between gap-4"
        >
          <div>
            <p className="font-display text-base text-ink">
              Davet gönderildi: {basari.email} ({basari.rolEtiketi})
            </p>
            <p className="text-sm text-ink-72 mt-1">
              Kashe&apos;de kayıtlıysa bildirim alır, değilse email ile davet
              edilir. Bekleyen davetler listesinde görünür.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBasari(null)}
            className="text-ink-72 hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center shrink-0"
            aria-label="Mesajı kapat"
          >
            ×
          </button>
        </div>
      )}

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
            onClick={() => {
              setBasari(null); // yeni davet aciliyor: eski mesaj kalkar
              setShowInviteForm(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
          >
            <span className="text-base leading-none">+</span>
            Davet gönder
          </button>
        </div>
      )}

      {/* Davet formu (toggle) */}
      {showInviteForm && (
        <KurumsalUyeDavetFormu
          orgId={orgId}
          onClose={() => setShowInviteForm(false)}
          onSuccess={(bilgi) => {
            setBasari(bilgi);
            setShowInviteForm(false);
          }}
        />
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
          <KurumsalDavetListesi
            invitations={pendingInvitations}
            mode="pending"
          />
        </section>
      )}

      {/* Mevcut üyeler */}
      <section>
        <h2 className="font-display text-xl text-ink mb-3">
          Ekip üyeleri{' '}
          <span className="text-ink-72 text-base">({members.length})</span>
        </h2>
        <KurumsalUyeListesi members={members} />
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
          <KurumsalDavetListesi invitations={pastInvitations} mode="past" />
        </section>
      )}
    </div>
  );
}
