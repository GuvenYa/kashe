'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitOffer, declineQuoteRequest } from '@/app/teklif-topla/actions';
import {
  QUOTE_EXPIRY_OPTIONS,
  CANCELLATION_POLICY_TEMPLATES,
  type QuoteExpiryKey,
} from '@/app/mesajlar/quotes-data';

type Props = {
  recipientId: string;
  customerName: string;
  onClose: () => void;
};

export function TeklifVerModal({ recipientId, customerName, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [servicesDescription, setServicesDescription] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');
  const [expiryKey, setExpiryKey] = useState<QuoteExpiryKey>('3d');
  const [message, setMessage] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(amountNum) || amountNum < 0) {
      setError('Geçerli bir fiyat gir.');
      return;
    }
    if (servicesDescription.trim().length < 10) {
      setError('Hizmet açıklaması en az 10 karakter olmalı.');
      return;
    }
    if (!message.trim()) {
      setError('Bir mesaj yaz.');
      return;
    }

    startTransition(async () => {
      const result = await submitOffer({
        recipient_id: recipientId,
        message: message.trim(),
        total_amount: amountNum,
        services_description: servicesDescription.trim(),
        cancellation_policy: cancellationPolicy.trim() || null,
        expiry_key: expiryKey,
      });

      if (result.success && result.data) {
        router.push(`/mesajlar/${result.data.conversationId}`);
      } else if (!result.success) {
        setError(result.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" aria-hidden="true" />

      <div
        className="relative bg-paper rounded-lg shadow-xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-paper border-b border-line px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-display text-xl text-ink">
            <em className="text-terracotta not-italic italic font-medium">
              {customerName}
            </em>
            &apos;a teklif ver
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-72 hover:text-ink p-2 -mr-2 transition-colors"
            aria-label="Kapat"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5L15 15M5 15L15 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Fiyat */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
              Toplam fiyat (TL) <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Örn: 15.000"
              className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
            />
          </div>

          {/* Hizmet açıklaması */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
              Hizmet açıklaması <span className="text-danger">*</span>
            </label>
            <textarea
              rows={4}
              maxLength={2000}
              value={servicesDescription}
              onChange={(e) => setServicesDescription(e.target.value)}
              placeholder="Teklife neler dahil? Süre, kapsam, ekipman, teslimat vb."
              className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition resize-none"
            />
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              {servicesDescription.length}/2000
            </p>
          </div>

          {/* İptal politikası (şablonlar) */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
              İptal politikası{' '}
              <span className="text-ink-72 normal-case tracking-normal">
                (opsiyonel)
              </span>
            </label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {CANCELLATION_POLICY_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setCancellationPolicy(t.text)}
                  className="px-3 py-1.5 border border-line rounded-lg text-xs text-ink-72 hover:border-terracotta hover:text-terracotta transition"
                >
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              maxLength={1000}
              value={cancellationPolicy}
              onChange={(e) => setCancellationPolicy(e.target.value)}
              placeholder="İade ve iptal koşulların..."
              className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition resize-none"
            />
          </div>

          {/* Geçerlilik süresi */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
              Teklif geçerlilik süresi
            </label>
            <select
              value={expiryKey}
              onChange={(e) => setExpiryKey(e.target.value as QuoteExpiryKey)}
              className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
            >
              {QUOTE_EXPIRY_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Mesaj */}
          <div className="pt-4 border-t border-line">
            <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
              Mesajın <span className="text-danger">*</span>
            </label>
            <textarea
              rows={4}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Merhaba, talebinizi inceledim. Şöyle bir teklif sunuyorum..."
              className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition resize-none"
            />
          </div>

          {error && (
            <div className="px-4 py-3 bg-danger-08 border border-danger/30 rounded-lg text-sm text-danger">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-5 py-2.5 text-ink-72 hover:text-ink font-display font-medium transition-colors disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 transition-all"
            >
              {isPending ? 'Gönderiliyor...' : 'Teklifi gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}