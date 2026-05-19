'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { createListing } from '../listings-actions';
import { BUDGET_PRESETS, type BudgetPresetKey } from '../listings-data';

type Category = {
  id: number;
  name_tr: string;
  emoji: string | null;
};

type City = {
  id: number;
  name: string;
};

type Props = {
  categories: Category[];
  cities: City[];
};

const EVENT_TYPE_OPTIONS = [
  { key: 'wedding', label: 'Düğün' },
  { key: 'engagement', label: 'Nişan' },
  { key: 'birthday', label: 'Doğum günü' },
  { key: 'baby_shower', label: 'Baby shower' },
  { key: 'graduation', label: 'Mezuniyet' },
  { key: 'circumcision', label: 'Sünnet' },
  { key: 'corporate', label: 'Kurumsal' },
  { key: 'other', label: 'Diğer' },
];

export function YeniIlanFormu({ categories, cities }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState<string>('');
  const [location, setLocation] = useState('');
  const [cityId, setCityId] = useState<number | ''>('');
  const [guestCount, setGuestCount] = useState('');
  const [budgetPreset, setBudgetPreset] = useState<BudgetPresetKey>('open');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [publishImmediately, setPublishImmediately] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (categoryId === '') {
      setError('Kategori seçmelisin');
      return;
    }
    if (title.trim().length < 10) {
      setError('Başlık en az 10 karakter olmalı');
      return;
    }
    if (description.trim().length < 30) {
      setError('Açıklama en az 30 karakter olmalı');
      return;
    }

    // Bütçe hesapla
    let finalMin: number | null = null;
    let finalMax: number | null = null;
    const preset = BUDGET_PRESETS.find((p) => p.key === budgetPreset);

    if (budgetPreset === 'custom') {
      if (budgetMin) {
        const v = parseFloat(budgetMin.replace(/\./g, '').replace(',', '.'));
        if (isNaN(v) || v < 0) {
          setError('Geçerli bir minimum bütçe gir');
          return;
        }
        finalMin = v;
      }
      if (budgetMax) {
        const v = parseFloat(budgetMax.replace(/\./g, '').replace(',', '.'));
        if (isNaN(v) || v < 0) {
          setError('Geçerli bir maksimum bütçe gir');
          return;
        }
        finalMax = v;
      }
      if (finalMin !== null && finalMax !== null && finalMin > finalMax) {
        setError('Minimum bütçe maksimumdan büyük olamaz');
        return;
      }
    } else if (preset) {
      finalMin = preset.min;
      finalMax = preset.max;
    }

    let finalGuestCount: number | null = null;
    if (guestCount) {
      const v = parseInt(guestCount, 10);
      if (isNaN(v) || v < 0 || v > 100000) {
        setError('Kişi sayısı 0-100.000 arasında olmalı');
        return;
      }
      finalGuestCount = v;
    }

    startTransition(async () => {
      const result = await createListing({
        category_id: categoryId,
        title: title.trim(),
        description: description.trim(),
        requirements: requirements.trim() || null,
        event_date: eventDate || null,
        event_type: eventType || null,
        location: location.trim() || null,
        city_id: cityId === '' ? null : cityId,
        guest_count: finalGuestCount,
        budget_min: finalMin,
        budget_max: finalMax,
        publish_immediately: publishImmediately,
      });

      if (result.success && result.data) {
        router.push(`/ilanlar/${result.data.id}`);
      } else if (!result.success) {
        setError(result.error);
      }
    });
  }

  const showCustomBudget = budgetPreset === 'custom';
  const showPresetInfo = budgetPreset !== 'open' && budgetPreset !== 'custom';
  const selectedPreset = BUDGET_PRESETS.find((p) => p.key === budgetPreset);

  // Bugünün tarihi (min validation için)
  const today = new Date().toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Bölüm 1: Temel */}
      <section className="bg-white border border-line rounded-lg p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-5">
          Temel bilgiler
        </p>

        <div className="space-y-5">
          {/* Kategori */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Kategori <span className="text-terracotta">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) =>
                setCategoryId(e.target.value ? parseInt(e.target.value, 10) : '')
              }
              required
              className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
            >
              <option value="">Kategori seç...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.emoji ? `${cat.emoji} ` : ''}
                  {cat.name_tr}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              Hangi tür profesyonel arıyorsun?
            </p>
          </div>

          {/* Başlık */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Başlık <span className="text-terracotta">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Maltepe'de düğün için fotoğrafçı"
              maxLength={200}
              required
              className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
            />
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              {title.length} / 200 karakter (en az 10)
            </p>
          </div>

          {/* Açıklama */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Açıklama <span className="text-terracotta">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Etkinliğin detayları, neye ihtiyacın olduğu, beklediğin sonuç. Net yazılan ilan kaliteli başvuru çeker."
              rows={6}
              maxLength={5000}
              required
              className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition resize-none"
            />
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              {description.length} / 5000 karakter (en az 30)
            </p>
          </div>

          {/* Gereksinimler */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Gereksinimler{' '}
              <span className="text-ink-72 normal-case tracking-normal">
                (opsiyonel)
              </span>
            </label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Profesyonelin sahip olması gereken nitelikler, deneyim, sertifika, ekipman vs."
              rows={3}
              maxLength={2000}
              className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition resize-none"
            />
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              {requirements.length} / 2000 karakter
            </p>
          </div>
        </div>
      </section>

      {/* Bölüm 2: Etkinlik */}
      <section className="bg-white border border-line rounded-lg p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-5">
          Etkinlik detayları{' '}
          <span className="normal-case tracking-normal">(hepsi opsiyonel)</span>
        </p>

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
                Etkinlik türü
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
              >
                <option value="">Seç...</option>
                {EVENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
                Etkinlik tarihi
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                min={today}
                className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
                Lokasyon
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Örn: Maltepe Sahil Düğün Salonu"
                maxLength={200}
                className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
                Şehir
              </label>
              <select
                value={cityId}
                onChange={(e) =>
                  setCityId(e.target.value ? parseInt(e.target.value, 10) : '')
                }
                className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
              >
                <option value="">Seç...</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Kişi sayısı
            </label>
            <input
              type="number"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="Örn: 100"
              min={0}
              max={100000}
              className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
            />
          </div>
        </div>
      </section>

      {/* Bölüm 3: Bütçe */}
      <section className="bg-white border border-line rounded-lg p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-5">
          Bütçe
        </p>

        <div className="space-y-3">
          {BUDGET_PRESETS.map((preset) => (
            <label
              key={preset.key}
              className={`block bg-paper border rounded-lg p-3 cursor-pointer transition ${
                budgetPreset === preset.key
                  ? 'border-terracotta'
                  : 'border-line hover:border-terracotta/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="budget"
                  checked={budgetPreset === preset.key}
                  onChange={() => setBudgetPreset(preset.key)}
                  className="accent-terracotta"
                />
                <span className="text-sm text-ink">{preset.label}</span>
              </div>
            </label>
          ))}

          {showCustomBudget && (
            <div className="grid grid-cols-2 gap-3 mt-3 pl-6">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-72 block mb-1.5">
                  Minimum (TL)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  placeholder="5.000"
                  className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-72 block mb-1.5">
                  Maksimum (TL)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  placeholder="15.000"
                  className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
                />
              </div>
            </div>
          )}

          {showPresetInfo && selectedPreset && (
            <p className="text-xs text-ink-72 italic pl-6 pt-1">
              Profesyoneller bu aralığı görecek
            </p>
          )}
        </div>
      </section>

      {/* Bölüm 4: Yayınla / Taslak */}
      <section className="bg-white border border-line rounded-lg p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-4">
          Durum
        </p>
        <div className="space-y-2">
          <label
            className={`block bg-paper border rounded-lg p-4 cursor-pointer transition ${
              publishImmediately
                ? 'border-terracotta'
                : 'border-line hover:border-terracotta/50'
            }`}
          >
            <div className="flex items-start gap-2">
              <input
                type="radio"
                checked={publishImmediately}
                onChange={() => setPublishImmediately(true)}
                className="mt-1 accent-terracotta"
              />
              <div>
                <p className="font-medium text-ink text-sm">Hemen yayınla</p>
                <p className="text-xs text-ink-72 mt-0.5">
                  İlan anında ilan tahtasında görünür, başvuru kabul eder.
                </p>
              </div>
            </div>
          </label>
          <label
            className={`block bg-paper border rounded-lg p-4 cursor-pointer transition ${
              !publishImmediately
                ? 'border-terracotta'
                : 'border-line hover:border-terracotta/50'
            }`}
          >
            <div className="flex items-start gap-2">
              <input
                type="radio"
                checked={!publishImmediately}
                onChange={() => setPublishImmediately(false)}
                className="mt-1 accent-terracotta"
              />
              <div>
                <p className="font-medium text-ink text-sm">
                  Taslak olarak kaydet
                </p>
                <p className="text-xs text-ink-72 mt-0.5">
                  Daha sonra düzenleyip yayınlayabilirsin.
                </p>
              </div>
            </div>
          </label>
        </div>
      </section>

      {error && (
        <div className="bg-terracotta/10 border border-terracotta/30 text-terracotta text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-3 sticky bottom-4 bg-paper/95 backdrop-blur-sm border border-line rounded-lg p-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Send size={14} strokeWidth={1.75} />
          {isPending
            ? 'Kaydediliyor...'
            : publishImmediately
              ? 'Yayınla'
              : 'Taslak olarak kaydet'}
        </button>
      </div>
    </form>
  );
}