'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveProfile,
  rejectProfile,
  requestProfileRevision,
} from '../actions';

type Mode = 'idle' | 'reject' | 'revision';

export function ProfilOnayAksiyonlari({
  profileId,
  status,
}: {
  profileId: string;
  status: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>('idle');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveProfile(profileId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  function handleSubmitNote() {
    setError(null);
    if (!note.trim()) {
      setError('Gerekçe yazmalısın.');
      return;
    }
    startTransition(async () => {
      const result =
        mode === 'reject'
          ? await rejectProfile(profileId, note)
          : await requestProfileRevision(profileId, note);
      if (result.success) {
        // Başarı → formu kapat + textarea'yı temizle (satır yeni durumla yeniden çizilir).
        // (router.refresh sonrası aynı key'li bileşen state'i koruduğundan explicit reset şart.)
        setMode('idle');
        setNote('');
        setError(null);
        router.refresh();
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  if (mode === 'reject' || mode === 'revision') {
    return (
      <div className="space-y-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          disabled={isPending}
          placeholder={
            mode === 'reject'
              ? 'Red gerekçesi (kullanıcıya gösterilecek)...'
              : 'Revizyon notu (kullanıcıya gösterilecek)...'
          }
          className="w-full px-3 py-2 bg-card border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition resize-none"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSubmitNote}
            disabled={isPending}
            className="px-4 py-2 bg-ink text-paper rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] hover:bg-ink/90 disabled:opacity-50 transition"
          >
            {isPending
              ? 'İşleniyor...'
              : mode === 'reject'
              ? 'Reddet'
              : 'Revizyon iste'}
          </button>
          <button
            onClick={() => {
              setMode('idle');
              setNote('');
              setError(null);
            }}
            disabled={isPending}
            className="px-4 py-2 text-ink-72 hover:text-ink font-mono text-[11px] uppercase tracking-[0.1em] transition"
          >
            İptal
          </button>
        </div>
      </div>
    );
  }

  // Duruma göre buton seti (backend her durumdan çalışır; UI yalnız anlamlı olanları gösterir):
  //  pending  → Onayla(primary) + Revizyon + Reddet
  //  revision → Onayla(primary) + Reddet
  //  rejected → Onayla ("Yeniden değerlendir")
  //  approved → primary YOK; yalnız Revizyon iste + Reddet
  const showApprove = status !== 'approved';
  const approveLabel = status === 'rejected' ? 'Yeniden değerlendir' : 'Onayla';
  const showRevision = status === 'pending' || status === 'approved';
  const showReject = status !== 'rejected';

  return (
    <div>
      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {showApprove && (
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="px-4 py-2 bg-moss text-paper rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] hover:opacity-90 disabled:opacity-50 transition"
          >
            {isPending ? 'İşleniyor...' : approveLabel}
          </button>
        )}
        {showRevision && (
          <button
            onClick={() => setMode('revision')}
            disabled={isPending}
            className="px-4 py-2 border border-line text-ink rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] hover:border-ink disabled:opacity-50 transition"
          >
            Revizyon iste
          </button>
        )}
        {showReject && (
          <button
            onClick={() => setMode('reject')}
            disabled={isPending}
            className="px-4 py-2 border border-danger text-danger rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] hover:bg-danger-08 disabled:opacity-50 transition"
          >
            Reddet
          </button>
        )}
      </div>
    </div>
  );
}