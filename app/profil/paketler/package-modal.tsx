'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPackage, updatePackage, type PackageFormData } from './actions';
import type { ServicePackage } from '@/app/lib/types';

type Props = {
  open: boolean;
  onClose: () => void;
  pkg?: ServicePackage | null; // edit mode
};

export function PackageModal({ open, onClose, pkg }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [includes, setIncludes] = useState<string[]>(['']);
  // Fiyat modu: 'fixed' (tek sabit) | 'range' (min-max) | 'request' (talep üzerine)
  const [priceMode, setPriceMode] = useState<'fixed' | 'range' | 'request'>(
    'fixed'
  );
  const [priceFixed, setPriceFixed] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [priceStarting, setPriceStarting] = useState(false); // §11 "başlangıç"

  const isEdit = !!pkg;

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (pkg) {
      setTitle(pkg.title);
      setDescription(pkg.description || '');
      setIncludes(pkg.includes && pkg.includes.length > 0 ? [...pkg.includes] : ['']);
      setPriceStarting(pkg.price_starting ?? false);
      if (pkg.price_on_request) {
        setPriceMode('request');
        setPriceFixed('');
        setPriceMin('');
        setPriceMax('');
      } else if (
        pkg.price_min !== null &&
        pkg.price_max !== null &&
        pkg.price_min === pkg.price_max
      ) {
        // min===max → sabit fiyat olarak yorumla
        setPriceMode('fixed');
        setPriceFixed(String(pkg.price_min));
        setPriceMin('');
        setPriceMax('');
      } else {
        setPriceMode('range');
        setPriceFixed('');
        setPriceMin(pkg.price_min !== null ? String(pkg.price_min) : '');
        setPriceMax(pkg.price_max !== null ? String(pkg.price_max) : '');
      }
    } else {
      setTitle('');
      setDescription('');
      setIncludes(['']);
      setPriceMode('fixed');
      setPriceFixed('');
      setPriceMin('');
      setPriceMax('');
      setPriceStarting(false);
    }
  }, [open, pkg]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  if (!open) return null;

  function parseNumber(s: string): number | null {
    const cleaned = s.trim().replace(/\./g, '').replace(',', '.');
    if (cleaned === '') return null;
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }

  // Madde listesi yardımcıları
  function updateInclude(index: number, value: string) {
    setIncludes((prev) => prev.map((it, i) => (i === index ? value : it)));
  }
  function addInclude() {
    setIncludes((prev) => (prev.length >= 20 ? prev : [...prev, '']));
  }
  function removeInclude(index: number) {
    setIncludes((prev) =>
      prev.length === 1 ? [''] : prev.filter((_, i) => i !== index)
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let outMin: number | null = null;
    let outMax: number | null = null;
    if (priceMode === 'fixed') {
      const f = parseNumber(priceFixed);
      outMin = f;
      outMax = f; // sabit fiyat: min=max (DB'de aralık olarak saklanır, gösterimde tek)
    } else if (priceMode === 'range') {
      outMin = parseNumber(priceMin);
      outMax = parseNumber(priceMax);
    }

    const data: PackageFormData = {
      title: title.trim(),
      description: description.trim() || null,
      includes: includes,
      price_on_request: priceMode === 'request',
      price_min: outMin,
      price_max: outMax,
      price_starting: priceMode === 'request' ? false : priceStarting,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updatePackage(pkg!.id, data)
        : await createPackage(data);

      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  const inputClass =
    'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';

  const labelClass =
    'block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" aria-hidden="true" />

      <div
        className="relative bg-paper rounded-lg shadow-xl max-w-xl w-full my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-paper border-b border-line px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-display text-xl text-ink">
            {isEdit ? 'Paketi düzenle' : 'Yeni paket oluştur'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-72 hover:text-ink p-2 -mr-2 transition-colors"
            aria-label="Kapat"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="pkg-title" className={labelClass}>
              Paket adı <span className="text-danger">*</span>
            </label>
            <input
              id="pkg-title"
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Örn: Düğün Paketi"
            />
          </div>

          <div>
            <label htmlFor="pkg-description" className={labelClass}>
              Açıklama
            </label>
            <textarea
              id="pkg-description"
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} resize-none`}
              placeholder="Bu paket kimler için, ne sunuyor..."
            />
            <p className="text-xs text-ink-72 mt-1.5">{description.length}/1000</p>
          </div>

          {/* Dahil olanlar — madde listesi */}
          <div>
            <label className={labelClass}>
              Pakete dahil olanlar <span className="text-danger">*</span>
            </label>
            <div className="space-y-2">
              {includes.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="shrink-0 text-moss" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={item}
                    maxLength={200}
                    onChange={(e) => updateInclude(i, e.target.value)}
                    className={inputClass}
                    placeholder="Örn: 6 saat canlı performans"
                  />
                  <button
                    type="button"
                    onClick={() => removeInclude(i)}
                    className="shrink-0 w-9 h-9 flex items-center justify-center text-ink-72 hover:text-brand-ink transition-colors"
                    aria-label="Maddeyi kaldır"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            {includes.length < 20 && (
              <button
                type="button"
                onClick={addInclude}
                className="mt-2 text-sm text-brand-ink hover:underline inline-flex items-center gap-1"
              >
                + Madde ekle
              </button>
            )}
            <p className="text-xs text-ink-72 mt-1.5">
              Paketin neleri kapsadığını madde madde yaz (en fazla 20).
            </p>
          </div>

          <div>
            <label className={labelClass}>Fiyatlandırma</label>
            <div className="space-y-1.5">
              {[
                { key: 'fixed', label: 'Sabit fiyat' },
                { key: 'range', label: 'Fiyat aralığı' },
                { key: 'request', label: 'Fiyat görüşülür' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    setPriceMode(opt.key as 'fixed' | 'range' | 'request')
                  }
                  className="flex items-center gap-2.5 w-full text-left group"
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      priceMode === opt.key
                        ? 'border-brand-ink'
                        : 'border-line group-hover:border-ink-72'
                    }`}
                  >
                    {priceMode === opt.key && (
                      <span className="w-2 h-2 rounded-full bg-brand-ink" />
                    )}
                  </span>
                  <span
                    className={`text-sm transition-colors ${
                      priceMode === opt.key ? 'text-ink' : 'text-ink-72 group-hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
            {priceMode === 'request' && (
              <p className="text-xs text-ink-72 mt-2">
                Müşteri seni mesajla aradığında fiyatı sen verirsin.
              </p>
            )}
          </div>

          {/* §11 — başlangıç fiyatı (görüşülür dışında aktif) */}
          <div>
            <label
              className={`flex items-center gap-2.5 ${
                priceMode === 'request'
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                checked={priceStarting}
                onChange={(e) => setPriceStarting(e.target.checked)}
                disabled={priceMode === 'request'}
                className="w-4 h-4 accent-brand-ink"
              />
              <span className="text-sm text-ink">Bu fiyattan başlar</span>
            </label>
            <p className="text-xs text-ink-72 mt-1.5 ml-7">
              İşaretlersen &quot;…&apos;den başlar&quot; olarak gösterilir.
            </p>
          </div>

          {priceMode === 'fixed' && (
            <div>
              <label htmlFor="pkg-price-fixed" className={labelClass}>
                Fiyat (₺) <span className="text-danger">*</span>
              </label>
              <input
                id="pkg-price-fixed"
                type="text"
                inputMode="decimal"
                required
                value={priceFixed}
                onChange={(e) => setPriceFixed(e.target.value)}
                className={inputClass}
                placeholder="20000"
              />
              <p className="text-xs text-ink-72 mt-1.5">
                Bu paketin net fiyatı. Tek bir tutar gösterilir.
              </p>
            </div>
          )}

          {priceMode === 'range' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="pkg-price-min" className={labelClass}>
                  Min fiyat (₺) <span className="text-danger">*</span>
                </label>
                <input
                  id="pkg-price-min"
                  type="text"
                  inputMode="decimal"
                  required
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className={inputClass}
                  placeholder="15000"
                />
              </div>
              <div>
                <label htmlFor="pkg-price-max" className={labelClass}>
                  Max fiyat (₺) <span className="text-danger">*</span>
                </label>
                <input
                  id="pkg-price-max"
                  type="text"
                  inputMode="decimal"
                  required
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className={inputClass}
                  placeholder="25000"
                />
              </div>
            </div>
          )}

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
              className="px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-brand-ink)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isPending ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Paket oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
