'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  QUOTE_EXPIRY_OPTIONS,
  CANCELLATION_POLICY_TEMPLATES,
  type QuoteExpiryKey,
} from '../quotes-data';
import { createQuote } from '../quote-actions';
import { getQuoteTemplates } from '@/app/lib/message-templates';

type Props = {
  conversationId: string;
  categorySlug: string | null;
  open: boolean;
  onClose: () => void;
};

export function QuoteModal({ conversationId, categorySlug, open, onClose }: Props) {
  const quoteTemplates = getQuoteTemplates(categorySlug);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expiryKey, setExpiryKey] = useState<QuoteExpiryKey>('7d');
  const [policyKey, setPolicyKey] = useState<string>('standard');
  const [customPolicy, setCustomPolicy] = useState('');
  const [useCustomPolicy, setUseCustomPolicy] = useState(false);

  if (!open) return null;

  function resetForm() {
    setAmount('');
    setDescription('');
    setExpiryKey('7d');
    setPolicyKey('standard');
    setCustomPolicy('');
    setUseCustomPolicy(false);
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Geçerli bir fiyat gir');
      return;
    }
    if (description.trim().length < 10) {
      setError('Hizmet açıklaması en az 10 karakter olmalı');
      return;
    }

    const policyText = useCustomPolicy
      ? customPolicy.trim()
      : CANCELLATION_POLICY_TEMPLATES.find((p) => p.key === policyKey)?.text ?? null;

    startTransition(async () => {
      const result = await createQuote({
        conversationId,
        totalAmount: amountNum,
        servicesDescription: description.trim(),
        cancellationPolicy: policyText || null,
        expiryKey,
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
              Yeni teklif
            </p>
            <h2 className="font-display text-2xl text-ink">
              <em className="text-terracotta not-italic italic font-medium">
                Teklif
              </em>{' '}
              gönder
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-ink-72 hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Fiyat */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Toplam fiyat (TL)
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5.000"
                className="w-full px-4 py-3 pr-12 bg-white border border-line rounded-lg text-ink text-lg font-medium focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-72 text-sm font-mono">
                TL
              </span>
            </div>
          </div>

          {/* Hizmet açıklaması */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Hizmet kapsamı
            </label>
            {quoteTemplates.length > 0 && (
              <div className="mb-2.5 rounded-lg border border-terracotta/20 bg-terracotta/[0.05] p-2.5">
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-terracotta mb-1.5 flex items-center gap-1">
                  <span aria-hidden="true">✎</span>
                  Hazır taslak — tıkla, sonra düzenle
                </p>
                <div className="flex flex-col gap-1.5">
                  {quoteTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDescription(tpl)}
                      className="text-left text-[12px] leading-snug text-ink bg-white border border-line rounded-lg px-3 py-2 hover:border-terracotta hover:shadow-[2px_2px_0_var(--color-terracotta-12)] hover:-translate-y-0.5 transition-all line-clamp-2"
                    >
                      {tpl}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ne yapacağını net şekilde yaz. Örn: 4 saatlik canlı performans, akustik gitar ve vokal. 2 set, ara verilerek..."
              rows={5}
              maxLength={2000}
              className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition resize-none"
              required
            />
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              {description.length} / 2000 karakter
            </p>
          </div>

          {/* Geçerlilik süresi */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Geçerlilik süresi
            </label>
            <div className="flex flex-wrap gap-2">
              {QUOTE_EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setExpiryKey(opt.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    expiryKey === opt.key
                      ? 'bg-terracotta text-paper border-terracotta'
                      : 'bg-white text-ink-72 border-line hover:border-terracotta/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* İptal politikası */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              İptal politikası (opsiyonel)
            </label>

            {!useCustomPolicy ? (
              <>
                <div className="space-y-2">
                  {CANCELLATION_POLICY_TEMPLATES.map((tmpl) => (
                    <label
                      key={tmpl.key}
                      className={`block bg-white border rounded-lg p-3 cursor-pointer transition ${
                        policyKey === tmpl.key
                          ? 'border-terracotta'
                          : 'border-line hover:border-terracotta/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="policy"
                          checked={policyKey === tmpl.key}
                          onChange={() => setPolicyKey(tmpl.key)}
                          className="mt-1 accent-terracotta"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-ink text-sm">
                            {tmpl.label}
                          </p>
                          <p className="text-xs text-ink-72 mt-1 leading-relaxed">
                            {tmpl.text}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setUseCustomPolicy(true)}
                  className="text-xs text-terracotta hover:underline mt-2"
                >
                  Kendi politikamı yazayım →
                </button>
              </>
            ) : (
              <>
                <textarea
                  value={customPolicy}
                  onChange={(e) => setCustomPolicy(e.target.value)}
                  placeholder="İptal politikanı buraya yaz..."
                  rows={4}
                  maxLength={1000}
                  className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition resize-none"
                />
                <button
                  type="button"
                  onClick={() => setUseCustomPolicy(false)}
                  className="text-xs text-terracotta hover:underline mt-2"
                >
                  ← Şablonları kullan
                </button>
              </>
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
              className="flex-1 px-5 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isPending ? 'Gönderiliyor...' : 'Teklifi gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}