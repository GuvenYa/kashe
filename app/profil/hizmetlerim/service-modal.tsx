'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { createService, updateService, type ServiceFormData } from './actions';
import { generateServiceDescription } from '@/app/lib/ai-actions';
import type { Service, ServiceCategory, PriceUnit } from '@/app/lib/types';

type Props = {
  open: boolean;
  onClose: () => void;
  categories: ServiceCategory[];
  service?: Service | null; // edit mode için
  defaultCategoryId?: number | null;
};

export function ServiceModal({
  open,
  onClose,
  categories,
  service,
  defaultCategoryId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // AI hizmet açıklaması yardımcısı
  const [aiSvcKeywords, setAiSvcKeywords] = useState('');
  const [aiSvcLoading, setAiSvcLoading] = useState(false);
  const [aiSvcError, setAiSvcError] = useState<string | null>(null);

  async function handleGenerateServiceDesc() {
    setAiSvcError(null);
    setAiSvcLoading(true);
    const result = await generateServiceDescription({
      serviceTitle: title.trim(),
      keywords: aiSvcKeywords.trim(),
    });
    if (result.success) {
      setDescription(result.text);
    } else {
      setAiSvcError(result.error);
    }
    setAiSvcLoading(false);
  }

  const [categoryId, setCategoryId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceOnRequest, setPriceOnRequest] = useState(false);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('total');
  const [priceStarting, setPriceStarting] = useState(false);
  const [durationHours, setDurationHours] = useState('');

  // §11: tek-fiyat modu (birim≠total VEYA başlangıç) → aralık yerine tek fiyat alanı
  const isSinglePrice = priceUnit !== 'total' || priceStarting;

  const isEdit = !!service;

  // Modal açıldığında alanları doldur (edit) veya sıfırla (create)
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (service) {
      setCategoryId(String(service.category_id));
      setTitle(service.title);
      setDescription(service.description || '');
      setPriceOnRequest(service.price_on_request);
      setPriceMin(service.price_min !== null ? String(service.price_min) : '');
      setPriceMax(service.price_max !== null ? String(service.price_max) : '');
      setPriceUnit(service.price_unit ?? 'total');
      setPriceStarting(service.price_starting ?? false);
      setDurationHours(
        service.duration_hours !== null ? String(service.duration_hours) : ''
      );
    } else {
      setCategoryId(defaultCategoryId ? String(defaultCategoryId) : '');
      setTitle('');
      setDescription('');
      setPriceOnRequest(false);
      setPriceMin('');
      setPriceMax('');
      setPriceUnit('total');
      setPriceStarting(false);
      setDurationHours('');
    }
  }, [open, service, defaultCategoryId]);

  // ESC ile kapatma
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Modal açıkken body scroll kapat
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const data: ServiceFormData = {
      category_id: parseInt(categoryId, 10),
      title: title.trim(),
      description: description.trim() || null,
      price_on_request: priceOnRequest,
      price_min: priceOnRequest ? null : parseNumber(priceMin),
      price_max: priceOnRequest ? null : parseNumber(priceMax),
      price_unit: priceUnit,
      price_starting: priceStarting,
      duration_hours: parseNumber(durationHours),
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateService(service!.id, data)
        : await createService(data);

      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  const inputClass =
    'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition';

  const labelClass =
    'block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal */}
      <div
        className="relative bg-paper rounded-lg shadow-xl max-w-xl w-full my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-paper border-b border-line px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-display font-semibold text-xl text-ink">
            {isEdit ? 'Hizmeti düzenle' : 'Yeni hizmet ekle'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-72 hover:text-ink p-2 -mr-2 transition-colors"
            aria-label="Kapat"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
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
          <div>
            <label htmlFor="modal-category" className={labelClass}>
              Kategori <span className="text-danger">*</span>
            </label>
            <select
              id="modal-category"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">Kategori seç</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.emoji ? `${cat.emoji} ${cat.name_tr}` : cat.name_tr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="modal-title" className={labelClass}>
              Başlık <span className="text-danger">*</span>
            </label>
            <input
              id="modal-title"
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Örn: Düğün Sunuculuğu Paketi"
            />
          </div>

          <div>
              <label htmlFor="modal-description" className={labelClass}>
                Açıklama
              </label>
              <div className="mb-3 bg-card border border-line rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-terracotta" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
                    AI ile açıklama yaz
                  </span>
                </div>
                <p className="text-[11px] text-ink-72 mb-2 leading-relaxed">
                  Başlığı doldur, istersen birkaç detay ekle (kapsam, süre, dahil
                  olanlar). Yapay zekâ bir taslak yazsın — sonra düzenleyebilirsin.
                </p>
                <input
                  type="text"
                  value={aiSvcKeywords}
                  onChange={(e) => setAiSvcKeywords(e.target.value)}
                  placeholder="Örn: 4 saat, ekipman dahil, 2 fotoğrafçı, dijital teslim"
                  maxLength={500}
                  className={`${inputClass} mb-2`}
                />
                <button
                  type="button"
                  onClick={handleGenerateServiceDesc}
                  disabled={aiSvcLoading}
                  className="kashe-tap inline-flex items-center gap-1.5 px-3 py-2 rounded bg-terracotta text-paper font-mono text-[10px] uppercase tracking-[0.16em] hover:bg-ember transition disabled:opacity-50"
                >
                  <Sparkles size={13} />
                  {aiSvcLoading ? 'Yazıyor…' : 'AI ile yaz'}
                </button>
                {aiSvcError && (
                  <p className="text-[11px] text-danger mt-2">{aiSvcError}</p>
                )}
              </div>
              <textarea
                id="modal-description"
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${inputClass} resize-none`}
                placeholder="Bu hizmette neler yapıyorsun, neyi kapsıyor..."
              />
            <p className="text-xs text-ink-72 mt-1.5">{description.length}/1000</p>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={priceOnRequest}
                onChange={(e) => setPriceOnRequest(e.target.checked)}
                className="w-4 h-4 accent-terracotta"
              />
              <span className="text-sm text-ink">
                Fiyat görüşülür olarak işaretle
              </span>
            </label>
            <p className="text-xs text-ink-72 mt-1.5 ml-7">
              Müşteri seni mesajla aradığında fiyatı sen verirsin.
            </p>
          </div>

          {/* §11 — Fiyat birimi + başlangıç (görüşülür iken devre dışı) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-price-unit" className={labelClass}>
                Fiyat birimi
              </label>
              <select
                id="modal-price-unit"
                value={priceUnit}
                onChange={(e) => setPriceUnit(e.target.value as PriceUnit)}
                disabled={priceOnRequest}
                className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="total">Toplam</option>
                <option value="hourly">Saatlik</option>
                <option value="half_day">Yarım gün</option>
                <option value="full_day">Tam gün</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label
                className={`flex items-center gap-2.5 ${
                  priceOnRequest ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={priceStarting}
                  onChange={(e) => setPriceStarting(e.target.checked)}
                  disabled={priceOnRequest}
                  className="w-4 h-4 accent-terracotta"
                />
                <span className="text-sm text-ink">Bu fiyattan başlar</span>
              </label>
            </div>
          </div>

          {!priceOnRequest &&
            (isSinglePrice ? (
              /* Tek-fiyat modu (birim≠total VEYA başlangıç): tek alan → min'e yazılır */
              <div>
                <label htmlFor="modal-price-single" className={labelClass}>
                  Fiyat (₺) <span className="text-danger">*</span>
                </label>
                <input
                  id="modal-price-single"
                  type="text"
                  inputMode="decimal"
                  required
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className={inputClass}
                  placeholder="1500"
                />
                <p className="text-xs text-ink-72 mt-1.5">
                  {priceStarting
                    ? '"…\'den başlar" olarak gösterilir.'
                    : 'Seçtiğin birimle birlikte tek fiyat gösterilir.'}
                </p>
              </div>
            ) : (
              /* total + not-starting → mevcut min/max aralık (bugünkü) */
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modal-price-min" className={labelClass}>
                    Min fiyat (₺) <span className="text-danger">*</span>
                  </label>
                  <input
                    id="modal-price-min"
                    type="text"
                    inputMode="decimal"
                    required
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    className={inputClass}
                    placeholder="5000"
                  />
                </div>
                <div>
                  <label htmlFor="modal-price-max" className={labelClass}>
                    Max fiyat (₺) <span className="text-danger">*</span>
                  </label>
                  <input
                    id="modal-price-max"
                    type="text"
                    inputMode="decimal"
                    required
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    className={inputClass}
                    placeholder="15000"
                  />
                </div>
              </div>
            ))}

          <div>
            <label htmlFor="modal-duration" className={labelClass}>
              Süre (saat)
            </label>
            <input
              id="modal-duration"
              type="text"
              inputMode="decimal"
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              className={inputClass}
              placeholder="4"
            />
            <p className="text-xs text-ink-72 mt-1.5">
              Boş bırakabilirsin. Ondalık için virgül kullan (örn: 2,5).
            </p>
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
              className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isPending
                ? 'Kaydediliyor...'
                : isEdit
                ? 'Kaydet'
                : 'Hizmet ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}