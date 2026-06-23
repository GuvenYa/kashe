'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { togglePackageActive, deletePackage } from './actions';
import { formatPriceRange } from '@/app/lib/profile-helpers';
import type { ServicePackage } from '@/app/lib/types';

type Props = {
  pkg: ServicePackage;
  onEdit: () => void;
};

export function PackageCard({ pkg, onEdit }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggleActive() {
    setError(null);
    startTransition(async () => {
      const result = await togglePackageActive(pkg.id, !pkg.is_active);
      if (!result.success) setError(result.error || 'Hata');
      else router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`"${pkg.title}" paketini silmek istediğine emin misin?`))
      return;
    setError(null);
    startTransition(async () => {
      const result = await deletePackage(pkg.id);
      if (!result.success) setError(result.error || 'Hata');
      else router.refresh();
    });
  }

  const priceLabel = formatPriceRange(
    pkg.price_min,
    pkg.price_max,
    pkg.price_on_request
  );

  return (
    <div
      className={`bg-card border rounded-lg p-6 transition-opacity ${
        pkg.is_active ? 'border-line' : 'border-line opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
            Paket
            {!pkg.is_active && (
              <span className="ml-2 text-terracotta">· Pasif</span>
            )}
          </p>
          <h3 className="font-display text-xl text-ink mb-2">{pkg.title}</h3>

          {priceLabel && (
            <p className="text-ink font-medium text-sm mb-3">{priceLabel}</p>
          )}

          {pkg.description && (
            <p className="text-ink-72 text-sm leading-relaxed whitespace-pre-wrap mb-3">
              {pkg.description}
            </p>
          )}

          {/* Dahil olanlar */}
          {pkg.includes && pkg.includes.length > 0 && (
            <ul className="space-y-1.5 mt-3">
              {pkg.includes.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-ink-72"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="shrink-0 mt-0.5 text-moss"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5 12l4 4 10-10"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="text-sm text-danger mt-3">{error}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={isPending}
            className="text-sm text-ink-72 hover:text-ink px-2 py-1 transition-colors disabled:opacity-50"
            title={pkg.is_active ? 'Pasife al' : 'Aktife al'}
          >
            {pkg.is_active ? 'Pasife al' : 'Aktife al'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={isPending}
            className="text-sm text-ink hover:text-terracotta px-2 py-1 transition-colors disabled:opacity-50"
          >
            Düzenle
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="text-sm text-ink-72 hover:text-terracotta px-2 py-1 transition-colors disabled:opacity-50"
          >
            Sil
          </button>
        </div>
      </div>
    </div>
  );
}
