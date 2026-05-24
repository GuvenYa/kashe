'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createQuoteRequest } from './actions';
import {
  getBriefFields,
  getBriefIntro,
  type BriefField,
} from '@/app/lib/brief-config';

type Category = { id: number; slug: string; name_tr: string };
type City = { id: number; name: string };

const RECIPIENT_OPTIONS = [
  { value: 5, label: '5 profesyonel', hint: 'Dar ve kontrollü' },
  { value: 10, label: '10 profesyonel', hint: 'Önerilen' },
  { value: 20, label: '20 profesyonel', hint: 'Daha fazla teklif' },
];

const DEADLINE_OPTIONS = [
  { value: 1, label: '24 saat' },
  { value: 2, label: '48 saat' },
  { value: 3, label: '3 gün' },
  { value: 7, label: '1 hafta' },
];

export function TeklifToplaFormu({
  categories,
  cities,
}: {
  categories: Category[];
  cities: City[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [cityId, setCityId] = useState<number | ''>('');
  const [briefValues, setBriefValues] = useState<Record<string, string>>({});
  const [recipientCount, setRecipientCount] = useState(10);
  const [deadlineDays, setDeadlineDays] = useState(3);
  const [shareBudget, setShareBudget] = useState(true);

  const selectedSlug =
    categoryId === ''
      ? null
      : categories.find((c) => c.id === categoryId)?.slug ?? null;
  const briefFields: BriefField[] = getBriefFields(selectedSlug);
  const briefIntro = getBriefIntro(selectedSlug);

  function setField(key: string, value: string) {
    setBriefValues((prev) => ({ ...prev, [key]: value }));
  }

  const todayStr = new Date().toISOString().split('T')[0];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (categoryId === '') {
      setError('Önce bir kategori seç.');
      return;
    }

    for (const f of briefFields) {
      if (f.required && !(briefValues[f.key] && briefValues[f.key].trim())) {
        setError(`"${f.label}" alanı zorunlu.`);
        return;
      }
    }

    let legacyEventType: string | null = null;
    let legacyEventDate: string | null = null;

    for (const f of briefFields) {
      const raw = briefValues[f.key]?.trim();
      if (!raw || !f.legacyColumn) continue;
      if (f.legacyColumn === 'event_type') legacyEventType = raw;
      if (f.legacyColumn === 'event_date') legacyEventDate = raw;
    }

    const cleanBrief: Record<string, string> = {};
    for (const f of briefFields) {
      const raw = briefValues[f.key]?.trim();
      if (raw) cleanBrief[f.key] = raw;
    }

    startTransition(async () => {
      const result = await createQuoteRequest({
        category_id: categoryId,
        city_id: cityId === '' ? null : cityId,
        brief_data: Object.keys(cleanBrief).length > 0 ? cleanBrief : null,
        event_date: legacyEventDate,
        event_type: legacyEventType,
        budget_min: null,
        budget_max: null,
        share_budget: shareBudget,
        response_deadline_days: deadlineDays,
        recipient_count: recipientCount,
      });

      if (result.success && result.data) {
        router.push('/teklif-taleplerim');
      } else if (!result.success) {
        setError(result.error);
      }
    });
  }

  const inputClass =
    'w-full px-4 py-3 bg-white border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Bölüm 1: Kategori + şehir */}
      <section className="bg-white border border-line rounded-lg p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-5">
          Ne arıyorsun?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
              Kategori <span className="text-terracotta">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(
                  e.target.value ? parseInt(e.target.value, 10) : ''
                );
                setBriefValues({});
              }}
              required
              className={inputClass}
            >
              <option value="">Kategori seç...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name_tr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
              Şehir
            </label>
            <select
              value={cityId}
              onChange={(e) =>
                setCityId(e.target.value ? parseInt(e.target.value, 10) : '')
              }
              className={inputClass}
            >
              <option value="">Tüm şehirler</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              Şehir seçersen sadece o şehirdeki profesyonellere gider
            </p>
          </div>
        </div>
      </section>

      {/* Bölüm 2: Brief */}
      {categoryId !== '' && (
        <section className="bg-white border border-line rounded-lg p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
            Etkinlik detayları
          </p>
          {briefIntro && (
            <p className="text-sm text-ink-72 mb-4 -mt-1">{briefIntro}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {briefFields.map((field) => {
              const value = briefValues[field.key] ?? '';
              const wrapperClass =
                field.type === 'textarea' ? 'md:col-span-2' : '';
              return (
                <div key={field.key} className={wrapperClass}>
                  <label
                    htmlFor={`brief-${field.key}`}
                    className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2"
                  >
                    {field.label}
                    {field.required && (
                      <span className="text-terracotta"> *</span>
                    )}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      id={`brief-${field.key}`}
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Seç...</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      id={`brief-${field.key}`}
                      rows={3}
                      maxLength={1000}
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={`${inputClass} resize-none`}
                    />
                  ) : field.type === 'date' ? (
                    <input
                      id={`brief-${field.key}`}
                      type="date"
                      min={todayStr}
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className={inputClass}
                    />
                  ) : field.type === 'number' ? (
                    <input
                      id={`brief-${field.key}`}
                      type="number"
                      min={0}
                      max={100000}
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={inputClass}
                    />
                  ) : (
                    <input
                      id={`brief-${field.key}`}
                      type="text"
                      maxLength={200}
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={inputClass}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-ink-72 mt-3">
            Yıldızlı (*) alanlar zorunlu — diğerlerini bildiğin kadar doldur.
          </p>
        </section>
      )}

      {/* Bölüm 3: Gönderim ayarları */}
      {categoryId !== '' && (
        <section className="bg-white border border-line rounded-lg p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-5">
            Gönderim ayarları
          </p>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                Kaç profesyonele gönderilsin?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {RECIPIENT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`block bg-paper border rounded-lg p-3 cursor-pointer transition ${
                      recipientCount === opt.value
                        ? 'border-terracotta'
                        : 'border-line hover:border-terracotta/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="recipientCount"
                        checked={recipientCount === opt.value}
                        onChange={() => setRecipientCount(opt.value)}
                        className="accent-terracotta"
                      />
                      <span className="text-sm text-ink font-medium">
                        {opt.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-72 mt-1 ml-6 font-mono uppercase tracking-[0.1em]">
                      {opt.hint}
                    </p>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                Teklif dönüş süresi
              </label>
              <select
                value={deadlineDays}
                onChange={(e) => setDeadlineDays(parseInt(e.target.value, 10))}
                className={inputClass}
              >
                {DEADLINE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shareBudget}
                onChange={(e) => setShareBudget(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-terracotta cursor-pointer"
              />
              <span className="text-sm text-ink-72 leading-snug">
                Bütçe bilgimi profesyonellerle paylaş. Kapatırsan teklifler
                bütçeni görmeden gelir.
              </span>
            </label>
          </div>
        </section>
      )}

      {error && (
        <div className="bg-terracotta/10 border border-terracotta/30 text-terracotta text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {categoryId !== '' && (
        <div className="flex gap-3 sticky bottom-4 bg-paper/95 backdrop-blur-sm border border-line rounded-lg p-3">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] disabled:opacity-50 transition-all"
          >
            {isPending ? 'Gönderiliyor...' : 'Teklif talebini gönder'}
          </button>
        </div>
      )}
    </form>
  );
}