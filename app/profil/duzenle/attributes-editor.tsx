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

  const labelClass =
    'block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2';

  const inputClass =
    'w-full px-4 py-3 bg-white border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition';

  return (
    <div className="bg-white border border-line rounded-lg p-6 space-y-6">
      <div>
        <p className="font-display text-lg text-ink">Kategorine özel bilgiler</p>
        <p className="text-xs text-ink-72 mt-1">
          Bu bilgiler, müşterilerin seni keşfederken filtrelemesini sağlar. Ne
          kadar doldurursan o kadar görünür olursun.
        </p>
      </div>

      {fields.map((field) => {
        if (field.type === 'multi') {
          const selected = Array.isArray(values[field.key])
            ? (values[field.key] as string[])
            : [];
          return (
            <div key={field.key}>
              <label className={labelClass}>{field.label}</label>
              {field.hint && (
                <p className="text-xs text-ink-72 mb-2 -mt-1">{field.hint}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {field.options.map((opt) => {
                  const isOn = selected.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleMulti(field.key, opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                        isOn
                          ? 'bg-terracotta text-paper border-terracotta'
                          : 'bg-transparent text-ink-72 border-line hover:border-ink'
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
          <div key={field.key}>
            <label htmlFor={`attr_${field.key}`} className={labelClass}>
              {field.label}
            </label>
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
  );
}