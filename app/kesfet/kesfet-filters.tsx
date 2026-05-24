'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { ServiceCategory, TurkishCity } from '@/app/lib/types';

type Props = {
  categories: ServiceCategory[];
  cities: TurkishCity[];
  currentCategory: number | null;
  currentCity: number | null;
  currentSearch: string;
};

export function KesfetFilters({
  categories,
  cities,
  currentCategory,
  currentCity,
  currentSearch,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(currentSearch);
  const [category, setCategory] = useState<string>(
    currentCategory ? String(currentCategory) : ''
  );
  const [city, setCity] = useState<string>(currentCity ? String(currentCity) : '');

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (category) params.set('kategori', category);
    if (city) params.set('sehir', city);

    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function clearAll() {
    setSearch('');
    setCategory('');
    setCity('');
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
          onChange={(e) => setCategory(e.target.value)}
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