'use client';

import { useState } from 'react';
import { YorumModal } from '@/app/yorumlar/yorum-modal';

type ExistingReview = {
  id: string;
  rating: number;
  body: string | null;
} | null;

type Props = {
  professionalId: string;
  professionalName: string;
  /** Müşteri ile profesyonel arasında konuşma var mı (mesajlaşma şartı) */
  hasConversation: boolean;
  /** Mevcut kullanıcının (müşteri) bu profesyonele yazdığı yorum (varsa) */
  existingReview: ExistingReview;
  /** Yorum yazma butonunu gösterip göstermeme kararı parent'ta alınır;
   *  bu component sadece müşteri + giriş yapmış + kendi profili değil durumda render edilir. */
  enabled: boolean;
};

export function YorumButton({
  professionalId,
  professionalName,
  hasConversation,
  existingReview,
  enabled,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!enabled) return null;

  const isEditing = existingReview !== null;
  const canWrite = hasConversation;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (canWrite) setModalOpen(true);
        }}
        disabled={!canWrite}
        title={
          !canWrite
            ? 'Yorum bırakabilmek için tamamlanmış bir rezervasyonun olmalı.'
            : undefined
        }
        className={`px-5 py-3 rounded-lg font-display font-semibold text-sm border-2 transition-all ${
          canWrite
            ? 'border-brand-ink text-brand-ink hover:bg-brand-ink hover:text-paper hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-brand-ink)]'
            : 'border-line text-ink-72/50 cursor-not-allowed'
        }`}
      >
        {isEditing ? 'Yorumumu düzenle' : 'Yorum yaz'}
      </button>

      {!canWrite && (
        <p className="text-xs text-ink-72 mt-2 font-mono uppercase tracking-[0.12em]">
          Tamamlanan rezervasyon sonrası yorum bırakabilirsin
        </p>
      )}

      <YorumModal
        professionalId={professionalId}
        professionalName={professionalName}
        existingReview={existingReview}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
