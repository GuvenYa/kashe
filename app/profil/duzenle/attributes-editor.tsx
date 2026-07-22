'use client';

import type { FilterField } from '@/app/lib/filter-config';

type Props = {
  fields: FilterField[];
  values: Record<string, string | string[]>;
  onChange: (key: string, value: string | string[]) => void;
};

export function AttributesEditor({ fields, values, onChange }: Props) {
  if (fields.length === 0) return null;

  function toggleMulti(key: string, optValue: string) {
    const current = Array.isArray(values[key]) ? (values[key] as string[]) : [];
    const next = current.includes(optValue)
      ? current.filter((v) => v !== optValue)
      : [...current, optValue];
    onChange(key, next);
  }

  const inputClass =
    'w-full px-4 py-3 bg-card border border-line rounded-xl text-ink focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';

  return (
    <div className="bg-card border border-line rounded-2xl p-7 md:p-8">
      {/* Bölüm başlığı */}
      <div className="mb-7 pb-5 border-b border-line">
        <p className="font-display text-xl text-ink">Kategorine özel bilgiler</p>
        <p className="text-sm text-ink-72 mt-1.5 leading-relaxed">
          Bu bilgiler müşterilerin seni keşfederken doğru filtrelemesini sağlar.
          Ne kadar doldurursan o kadar görünür olursun.
        </p>
      </div>

      <div className="space-y-7">
        {fields.map((field, idx) => {
          if (field.type === 'multi') {
            const selected = Array.isArray(values[field.key])
              ? (values[field.key] as string[])
              : [];
            return (
              <div
                key={field.key}
                className={idx > 0 ? 'pt-7 border-t border-line/60' : ''}
              >
                {/* Başlık + seçili sayısı */}
                <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                  <p className="font-display text-base text-ink">
                    {field.label}
                  </p>
                  {selected.length > 0 && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink bg-brand-ink-08 px-2 py-0.5 rounded-full">
                      {selected.length} seçili
                    </span>
                  )}
                </div>
                {field.hint && (
                  <p className="text-sm text-ink-72 mb-4 leading-relaxed">
                    {field.hint}
                  </p>
                )}
                {/* İki sütunlu liste + checkbox */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                  {field.options.map((opt) => {
                    const isOn = selected.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleMulti(field.key, opt.value)}
                        aria-pressed={isOn}
                        className={`kashe-tap group flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          isOn
                            ? 'bg-brand-ink-08 text-ink'
                            : 'bg-transparent text-ink-72 hover:bg-paper-2 hover:text-ink'
                        }`}
                      >
                        <span
                          className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            isOn
                              ? 'bg-brand-ink border-brand-ink'
                              : 'bg-card border-line group-hover:border-ink-72'
                          }`}
                          aria-hidden="true"
                        >
                          {isOn && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M5 12l4 4 10-10"
                                stroke="var(--color-paper)"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                        <span className="text-sm leading-tight">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          // single → dropdown
          const current =
            typeof values[field.key] === 'string'
              ? (values[field.key] as string)
              : '';
          return (
            <div
              key={field.key}
              className={idx > 0 ? 'pt-7 border-t border-line/60' : ''}
            >
              <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                <label
                  htmlFor={`attr_${field.key}`}
                  className="font-display text-base text-ink"
                >
                  {field.label}
                </label>
                {current && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink bg-brand-ink-08 px-2 py-0.5 rounded-full">
                    Seçili
                  </span>
                )}
              </div>
              {field.hint && (
                <p className="text-sm text-ink-72 mb-4 leading-relaxed">
                  {field.hint}
                </p>
              )}
              <select
                id={`attr_${field.key}`}
                value={current}
                onChange={(e) => onChange(field.key, e.target.value)}
                className={inputClass}
              >
                <option value="">Seç...</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
