'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelBooking, completeBooking, confirmCompletion } from './actions';

type Props = {
  bookingId: string;
  viewer: 'customer' | 'professional';
  cancellationPolicy: string | null;
  /**
   * Duzeltme 12-F: etkinlik tarihi geldi mi (Istanbul gunu). Gelmediyse
   * profesyonelin "Is tamamlandi"si musteriden onay ister.
   */
  tarihGeldi?: boolean;
  /** Profesyonel tamamlanma onayi istedi, musteri henuz onaylamadi. */
  tamamlamaIstendi?: boolean;
  /** Musteri tarafi onaylayabilir mi (musteri ya da alici kurulus yoneticisi). */
  onaylayabilir?: boolean;
};

export function RezervasyonAksiyonlari({
  bookingId,
  viewer,
  cancellationPolicy,
  tarihGeldi = true,
  tamamlamaIstendi = false,
  onaylayabilir = false,
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

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmCompletion(bookingId);
      if (result.success) {
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
        {/* Duzeltme 12-F: tamamlanma onayi bekleniyor */}
        {tamamlamaIstendi && (
          <div className="mb-4 rounded-xl border border-moss/30 bg-moss/[0.06] px-4 py-3">
            <p className="text-sm text-ink font-medium">
              {viewer === 'professional'
                ? 'Müşterinin onayı bekleniyor.'
                : 'Profesyonel işin tamamlandığını bildirdi.'}
            </p>
            <p className="text-xs text-ink-72 mt-1 leading-relaxed">
              {viewer === 'professional'
                ? 'Etkinlik tarihi gelmeden bildirdiğin için iş, müşteri onaylayınca tamamlanır.'
                : 'Hizmeti aldıysan onayla; iş tamamlanır ve yorum bırakabilirsin. Bir sorun varsa önce sohbetten yaz.'}
            </p>
            {viewer === 'customer' && onaylayabilir && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="kashe-tap mt-3 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-ink text-paper rounded-xl font-display font-semibold text-sm hover:bg-ink/85 transition disabled:opacity-60 shadow-[3px_3px_0_rgba(26,18,14,0.12)]"
              >
                {isPending ? '...' : 'Tamamlandığını onayla'}
              </button>
            )}
            {error && !cancelOpen && !completeOpen && (
              <p className="text-xs text-danger mt-2">{error}</p>
            )}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Profesyonel "İş tamamlandı" diyebilir (onay istendiyse bekler) */}
          {viewer === 'professional' && !tamamlamaIstendi && (
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
            className="kashe-tap inline-flex items-center justify-center px-5 py-3 border border-brand-ink/40 text-brand-ink hover:bg-brand-ink/8 rounded-xl font-display font-semibold text-sm transition"
          >
            Rezervasyonu iptal et
          </button>
        </div>
      </div>

      {/* İPTAL MODAL */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 md:p-7 shadow-xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-ink mb-2">
              İptal onayı
            </p>
            <h3 className="font-display font-semibold text-xl text-ink mb-3 leading-tight">
              Rezervasyonu iptal etmek istediğinden emin misin?
            </h3>
            <p className="text-sm text-ink-72 leading-relaxed mb-4">
              Bu işlem geri alınamaz. Karşı tarafa bildirim gönderilecek.
            </p>

            {/* Duzeltme 12-G (bulgu 117): saglayici iptalinin sonucu acik yazilir */}
            {viewer === 'professional' && (
              <div className="rounded-xl border border-brand-ink/25 bg-brand-ink/[0.05] px-4 py-3 mb-4">
                <p className="text-xs text-ink leading-relaxed">
                  Onaylı rezervasyonu iptal etmek <strong>güven puanını düşürür</strong>{' '}
                  ve müşteri bu rezervasyon için <strong>deneyimini yorumlayabilir</strong>.
                </p>
              </div>
            )}

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
                className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition resize-none"
              />
            </label>

            {error && (
              <p className="text-xs text-danger mt-3">{error}</p>
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
                className="kashe-tap flex-1 px-4 py-2.5 bg-brand-ink text-paper rounded-xl font-display font-semibold text-sm hover:bg-brand-ink-deep transition disabled:opacity-60 shadow-[3px_3px_0_var(--color-brand-ink-12)]"
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
          <div className="bg-card border border-line rounded-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 md:p-7 shadow-xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss mb-2">
              Tamamlama
            </p>
            <h3 className="font-display font-semibold text-xl text-ink mb-3 leading-tight">
              {tarihGeldi
                ? 'İşi tamamlandı olarak işaretle.'
                : 'Müşteriden tamamlanma onayı iste.'}
            </h3>
            <p className="text-sm text-ink-72 leading-relaxed mb-2">
              {tarihGeldi
                ? 'Bu işlem geri alınamaz. Müşteriye bildirim gönderilecek ve senin için yorum bırakabilir hale gelecek.'
                : 'Etkinlik tarihi henüz gelmedi (ya da tarih belirlenmedi). Müşteriye onay isteği gider; müşteri onaylayınca iş tamamlanır ve yorum bırakabilir.'}
            </p>

            {error && (
              <p className="text-xs text-danger mt-3">{error}</p>
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
                {isPending ? '...' : tarihGeldi ? 'Tamamlandı' : 'Onay iste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
