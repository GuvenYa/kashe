'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelBooking, completeBooking } from './actions';

type Props = {
  bookingId: string;
  viewer: 'customer' | 'professional';
  cancellationPolicy: string | null;
};

export function RezervasyonAksiyonlari({
  bookingId,
  viewer,
  cancellationPolicy,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelBooking(bookingId, reason || null);
      if (result.success) {
        setCancelOpen(false);
        setReason('');
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleComplete() {
    setError(null);
    startTransition(async () => {
      const result = await completeBooking(bookingId);
      if (result.success) {
        setCompleteOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <div className="bg-card border border-line rounded-2xl p-6 md:p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-4">
          Aksiyonlar
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Profesyonel "İş tamamlandı" diyebilir */}
          {viewer === 'professional' && (
            <button
              type="button"
              onClick={() => setCompleteOpen(true)}
              className="kashe-tap inline-flex items-center justify-center gap-2 px-5 py-3 bg-ink text-paper rounded-xl font-display font-semibold text-sm hover:bg-ink/85 transition shadow-[3px_3px_0_rgba(26,18,14,0.12)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              İş tamamlandı
            </button>
          )}
          {/* Her iki taraf da iptal edebilir */}
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="kashe-tap inline-flex items-center justify-center px-5 py-3 border border-terracotta/40 text-terracotta hover:bg-terracotta/8 rounded-xl font-display font-semibold text-sm transition"
          >
            Rezervasyonu iptal et
          </button>
        </div>
      </div>

      {/* İPTAL MODAL */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-2xl max-w-md w-full p-6 md:p-7 shadow-xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-2">
              İptal onayı
            </p>
            <h3 className="font-display font-semibold text-xl text-ink mb-3 leading-tight">
              Rezervasyonu iptal etmek istediğinden emin misin?
            </h3>
            <p className="text-sm text-ink-72 leading-relaxed mb-4">
              Bu işlem geri alınamaz. Karşı tarafa bildirim ve e-posta
              gönderilecek.
            </p>

            {cancellationPolicy && (
              <div className="bg-paper-2 rounded-xl p-4 mb-4 border border-line">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 mb-1.5">
                  İptal politikası
                </p>
                <p className="text-xs text-ink-72 leading-relaxed whitespace-pre-wrap">
                  {cancellationPolicy}
                </p>
              </div>
            )}

            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 block mb-1.5">
                Sebep (opsiyonel)
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Kısa bir açıklama yazabilirsin..."
                className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition resize-none"
              />
            </label>

            {error && (
              <p className="text-xs text-terracotta mt-3">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => {
                  setCancelOpen(false);
                  setReason('');
                  setError(null);
                }}
                disabled={isPending}
                className="kashe-tap flex-1 px-4 py-2.5 border border-line text-ink-72 rounded-xl font-display font-semibold text-sm hover:bg-paper-2 transition disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="kashe-tap flex-1 px-4 py-2.5 bg-terracotta text-paper rounded-xl font-display font-semibold text-sm hover:bg-ember transition disabled:opacity-60 shadow-[3px_3px_0_var(--color-terracotta-12)]"
              >
                {isPending ? '...' : 'İptal et'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAMAMLAMA MODAL */}
      {completeOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-2xl max-w-md w-full p-6 md:p-7 shadow-xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss mb-2">
              Tamamlama
            </p>
            <h3 className="font-display font-semibold text-xl text-ink mb-3 leading-tight">
              İşi tamamlandı olarak işaretle.
            </h3>
            <p className="text-sm text-ink-72 leading-relaxed mb-2">
              Bu işlem geri alınamaz. Müşteriye e-posta ile bildirilecek ve
              senin için yorum bırakabilir hale gelecek.
            </p>

            {error && (
              <p className="text-xs text-terracotta mt-3">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => {
                  setCompleteOpen(false);
                  setError(null);
                }}
                disabled={isPending}
                className="kashe-tap flex-1 px-4 py-2.5 border border-line text-ink-72 rounded-xl font-display font-semibold text-sm hover:bg-paper-2 transition disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={isPending}
                className="kashe-tap flex-1 px-4 py-2.5 bg-ink text-paper rounded-xl font-display font-semibold text-sm hover:bg-ink/85 transition disabled:opacity-60 shadow-[3px_3px_0_rgba(26,18,14,0.12)]"
              >
                {isPending ? '...' : 'Tamamlandı'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
