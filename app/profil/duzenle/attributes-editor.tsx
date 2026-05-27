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
    'w-full px-4 py-3 bg-card border border-line rounded-xl text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition';

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
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta bg-terracotta-08 px-2 py-0.5 rounded-full">
                      {selected.length} seçili
                    </span>
                  )}
                </div>
                {field.hint && (
                  <p className="text-sm text-ink-72 mb-4 leading-relaxed">
                    {field.hint}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {field.options.map((opt) => {
                    const isOn = selected.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleMulti(field.key, opt.value)}
                        className={`kashe-tap px-3.5 py-1.5 rounded-full text-sm border transition-colors ${
                          isOn
                            ? 'bg-terracotta text-paper border-terracotta'
                            : 'bg-transparent text-ink-72 border-line hover:border-ink hover:text-ink'
                        }`}
                      >
                        {opt.label}
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
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta bg-terracotta-08 px-2 py-0.5 rounded-full">
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
