'use client';

import { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { reportContent, type ReportResult } from './actions';
import type { ReportReason, ReportTargetType } from '@/app/lib/types';

type Props = {
  targetType: ReportTargetType;
  targetId: string;
  isLoggedIn: boolean;
  /** Görsel varyant: 'link' (metin), 'icon' (yorum kartı), 'button' (çerçeveli) */
  variant?: 'link' | 'icon' | 'button';
  /** Buton etiketi (link/button için) */
  label?: string;
};

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam / reklam' },
  { value: 'inappropriate', label: 'Uygunsuz içerik' },
  { value: 'fake', label: 'Sahte / yanıltıcı' },
  { value: 'harassment', label: 'Taciz / hakaret' },
  { value: 'other', label: 'Diğer' },
];

export function SikayetButton({
  targetType,
  targetId,
  isLoggedIn,
  variant = 'link',
  label = 'Şikayet et',
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  function handleOpen() {
    if (!isLoggedIn) {
      setError('Şikayet için giriş yapmalısın.');
      setOpen(true);
      return;
    }
    setError(null);
    setDone(false);
    setReason('');
    setDetails('');
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reason) {
      setError('Bir sebep seç.');
      return;
    }
    startTransition(async () => {
      const result: ReportResult = await reportContent({
        targetType,
        targetId,
        reason,
        details,
      });
      if (result.success) {
        setDone(true);
      } else {
        setError(result.error);
      }
    });
  }

  const trigger =
    variant === 'icon' ? (
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Şikayet et"
        title="Şikayet et"
        className="text-ink-32 hover:text-danger transition-colors p-1"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      </button>
    ) : variant === 'button' ? (
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line rounded-lg text-xs font-mono uppercase tracking-[0.14em] text-ink-72 hover:text-danger hover:border-danger/40 transition-colors"
      >
        {label}
      </button>
    ) : (
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs font-mono uppercase tracking-[0.14em] text-ink-32 hover:text-danger transition-colors"
      >
        {label}
      </button>
    );

  return (
    <>
      {trigger}

      {open && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" aria-hidden="true" />
          <div
            className="relative bg-paper rounded-lg shadow-xl max-w-md w-full my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-line px-6 py-4 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">Şikayet et</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink-72 hover:text-ink p-2 -mr-2 transition-colors"
                aria-label="Kapat"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {done ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-moss/10 flex items-center justify-center mx-auto mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-moss)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                </div>
                <p className="font-display text-lg text-ink mb-1">Şikayetin alındı</p>
                <p className="text-sm text-ink-72 mb-5">
                  Ekibimiz en kısa sürede inceleyecek. Teşekkürler.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  Kapat
                </button>
              </div>
            ) : !isLoggedIn ? (
              <div className="p-6 text-center">
                <p className="text-ink-72 mb-5">
                  Şikayet göndermek için giriş yapmalısın.
                </p>
                <a
                  href="/giris"
                  className="inline-block px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  Giriş yap
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                    Sebep <span className="text-danger">*</span>
                  </label>
                  <div className="space-y-1.5">
                    {REASONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setReason(r.value)}
                        className="flex items-center gap-2.5 w-full text-left group"
                      >
                        <span
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            reason === r.value
                              ? 'border-terracotta'
                              : 'border-line group-hover:border-ink-72'
                          }`}
                        >
                          {reason === r.value && (
                            <span className="w-2 h-2 rounded-full bg-terracotta" />
                          )}
                        </span>
                        <span
                          className={`text-sm transition-colors ${
                            reason === r.value ? 'text-ink' : 'text-ink-72 group-hover:text-ink'
                          }`}
                        >
                          {r.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="report-details" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                    Açıklama (opsiyonel)
                  </label>
                  <textarea
                    id="report-details"
                    rows={3}
                    maxLength={1000}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition resize-none"
                    placeholder="Durumu kısaca açıkla..."
                  />
                </div>

                {error && (
                  <div className="px-4 py-3 bg-danger-08 border border-danger/30 rounded-lg text-sm text-danger">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={isPending}
                    className="px-5 py-2.5 text-ink-72 hover:text-ink font-display font-medium transition-colors disabled:opacity-50"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || !reason}
                    className="px-5 py-2.5 bg-danger text-paper rounded-lg font-display font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {isPending ? 'Gönderiliyor...' : 'Şikayeti gönder'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}