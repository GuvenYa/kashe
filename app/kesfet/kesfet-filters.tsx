'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { ServiceCategory, TurkishCity } from '@/app/lib/types';
import { getFilterFields } from '@/app/lib/filter-config';

type Props = {
  categories: ServiceCategory[];
  cities: TurkishCity[];
  currentCategory: number | null;
  currentCity: number | null;
  currentSearch: string;
  currentAttrs: Record<string, string[]>;
};

export function KesfetFilters({
  categories,
  cities,
  currentCategory,
  currentCity,
  currentSearch,
  currentAttrs
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(currentSearch);
  const [category, setCategory] = useState<string>(
    currentCategory ? String(currentCategory) : ''
  );
  const [city, setCity] = useState<string>(currentCity ? String(currentCity) : '');
  const initialAttrs: Record<string, string[]> = currentAttrs;
  const [attrs, setAttrs] = useState(initialAttrs);


  // Seçili kategorinin slug'ı → kategoriye özel filtre alanları
  const selectedSlug = category
    ? categories.find((c) => String(c.id) === category)?.slug ?? null
    : null;
  const filterFields = getFilterFields(selectedSlug);

  function toggleAttr(key: string, value: string) {
    setAttrs((prev) => {
      const cur = prev[key] || [];
      const next = cur.includes(value)
        ? cur.filter((v) => v !== value)
        : [...cur, value];
      const updated = { ...prev };
      if (next.length > 0) updated[key] = next;
      else delete updated[key];
      return updated;
    });
  }

  function setAttrSingle(key: string, value: string) {
    setAttrs((prev) => {
      const updated = { ...prev };
      if (value) updated[key] = [value];
      else delete updated[key];
      return updated;
    });
  }

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (category) params.set('kategori', category);
    if (city) params.set('sehir', city);
    // kategoriye özel filtreler → attr_KEY=val1,val2
    for (const [key, vals] of Object.entries(attrs)) {
      if (vals.length > 0) params.set(`attr_${key}`, vals.join(','));
    }

    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function clearAll() {
    setSearch('');
    setCategory('');
    setCity('');
    setAttrs({});
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasActiveFilters = !!(currentCategory || currentCity || currentSearch);

  const inputClass =
    'w-full px-4 py-2.5 bg-white border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition text-sm';

  return (
    <form
      onSubmit={applyFilters}
      className="bg-white border border-line rounded-lg p-5"
    >
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="İsim ile ara..."
          className={inputClass}
        />

        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setAttrs({}); // kategori değişince özel filtreleri sıfırla
          }}
          className={inputClass}
        >
          <option value="">Tüm kategoriler</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name_tr}
            </option>
          ))}
        </select>

        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className={inputClass}
        >
          <option value="">Tüm şehirler</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 transition-all whitespace-nowrap"
        >
          {isPending ? 'Aranıyor...' : 'Filtrele'}
        </button>
      </div>

      {/* Kategoriye özel detaylı filtreler — kategori seçilince belirir */}
      {filterFields.length > 0 && (
        <div className="mt-4 pt-4 border-t border-line space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
            Detaylı filtreler
          </p>
          {filterFields.map((field) => {
            const selected = attrs[field.key] || [];
            if (field.type === 'multi') {
              return (
                <div key={field.key}>
                  <label className="block text-xs text-ink-72 mb-1.5">
                    {field.label}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {field.options.map((opt) => {
                      const on = selected.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleAttr(field.key, opt.value)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                            on
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
            const cur = selected[0] || '';
            return (
              <div key={field.key}>
                <label className="block text-xs text-ink-72 mb-1.5">
                  {field.label}
                </label>
                <select
                  value={cur}
                  onChange={(e) => setAttrSingle(field.key, e.target.value)}
                  className={inputClass + ' max-w-xs'}
                >
                  <option value="">Hepsi</option>
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
      )}

      {hasActiveFilters && (
        <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
          <p className="text-xs text-ink-72">Aktif filtreler var</p>
          <button
            type="button"
            onClick={clearAll}
            disabled={isPending}
            className="text-xs text-terracotta hover:underline disabled:opacity-50"
          >
            Tümünü temizle
          </button>
        </div>
      )}
    </form>
  );
}