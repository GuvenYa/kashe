'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';

type SortValue = 'yeni' | 'puan';

type Props = {
  currentSort: SortValue;
};

const OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'yeni', label: 'En yeni' },
  { value: 'puan', label: 'En yüksek puanlı' },
];

export function SortDropdown({ currentSort }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newSort = e.target.value as SortValue;
    const params = new URLSearchParams(searchParams.toString());

    if (newSort === 'yeni') {
      // Default → parametreyi URL'den kaldır
      params.delete('sirala');
    } else {
      params.set('sirala', newSort);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  }

  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink-72">
        Sırala:
      </span>
      <select
        value={currentSort}
        onChange={handleChange}
        disabled={isPending}
        className="text-sm font-display text-ink bg-card border border-line rounded px-2 py-1.5 focus:outline-none focus:border-terracotta cursor-pointer disabled:opacity-50"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
