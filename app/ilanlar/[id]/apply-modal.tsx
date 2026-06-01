'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { applyToListing } from '../listings-actions';
import { getApplicationTemplates } from '@/app/lib/message-templates';

type Props = {
  listingId: string;
  listingTitle: string;
  categorySlug: string | null;
  open: boolean;
  onClose: () => void;
};

export function ApplyModal({ listingId, listingTitle, categorySlug, open, onClose }: Props) {
  const templates = getApplicationTemplates(categorySlug);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [coverMessage, setCoverMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [includeAmount, setIncludeAmount] = useState(false);

  if (!open) return null;

  function resetForm() {
    setCoverMessage('');
    setAmount('');
    setIncludeAmount(false);
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (coverMessage.trim().length < 20) {
      setError('Başvuru mesajın en az 20 karakter olmalı');
      return;
    }

    let proposedAmount: number | null = null;
    if (includeAmount) {
      const parsed = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
      if (isNaN(parsed) || parsed <= 0) {
        setError('Geçerli bir fiyat gir veya fiyat teklifini kapat');
        return;
      }
      proposedAmount = parsed;
    }

    startTransition(async () => {
      const result = await applyToListing({
        listing_id: listingId,
        cover_message: coverMessage.trim(),
        proposed_amount: proposedAmount,
      });

      if (result.success) {
        resetForm();
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="bg-paper rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-line p-5 sticky top-0 bg-paper z-10 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-1">
              İlana başvur
            </p>
            <h2 className="font-display text-2xl text-ink leading-tight line-clamp-2">
              {listingTitle}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-ink-72 hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center shrink-0 ml-3"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Başvuru mesajı */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Başvuru mesajın
            </label>
            {templates.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-72 w-full mb-0.5">
                  Hazır taslak (tıkla, sonra düzenle)
                </span>
                {templates.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCoverMessage(tpl)}
                    className="text-left text-[11px] leading-snug text-ink bg-white border border-line rounded-lg px-2.5 py-1.5 hover:border-[#1E3A5F] hover:bg-[#1E3A5F]/[0.04] transition max-w-full line-clamp-2"
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={coverMessage}
              onChange={(e) => setCoverMessage(e.target.value)}
              placeholder="Kendini ve neden bu işe uygun olduğunu kısaca anlat. Benzer deneyimlerin, uzmanlıklarını, müsaitlik durumunu belirt."
              rows={6}
              maxLength={2000}
              className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 transition resize-none"
              required
            />
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              {coverMessage.length} / 2000 karakter (en az 20)
            </p>
          </div>

          {/* Fiyat teklifi (opsiyonel) */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={includeAmount}
                onChange={(e) => setIncludeAmount(e.target.checked)}
                className="accent-[#1E3A5F] w-4 h-4"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
                Fiyat teklifim de var
              </span>
            </label>

            {includeAmount && (
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10.000"
                  className="w-full px-4 py-3 pr-12 bg-white border border-line rounded-lg text-ink text-lg font-medium focus:outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 transition"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-72 text-sm font-mono">
                  TL
                </span>
              </div>
            )}

            {!includeAmount && (
              <p className="text-xs text-ink-72">
                Fiyat teklifin opsiyonel. Boş bırakırsan ilan sahibi seninle
                iletişime geçtiğinde konuşabilirsin.
              </p>
            )}
          </div>

          {error && (
            <div className="bg-terracotta/10 border border-terracotta/30 text-terracotta text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Butonlar */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-5 py-3 border border-line text-ink-72 rounded-lg font-display font-semibold text-sm hover:bg-white transition"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#1E3A5F] text-white rounded-lg font-display font-semibold text-sm hover:bg-[#142745] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send size={14} strokeWidth={1.75} />
              {isPending ? 'Gönderiliyor...' : 'Başvuruyu gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}