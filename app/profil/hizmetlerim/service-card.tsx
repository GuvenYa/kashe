'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleServiceActive, deleteService } from './actions';
import { formatPriceRange, formatDuration } from '@/app/lib/profile-helpers';
import { AddonManager } from './addon-manager';
import type { ServiceWithCategory } from '@/app/lib/types';

type Props = {
  service: ServiceWithCategory;
  onEdit: () => void;
};

export function ServiceCard({ service, onEdit }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggleActive() {
    setError(null);
    startTransition(async () => {
      const result = await toggleServiceActive(service.id, !service.is_active);
      if (!result.success) setError(result.error || 'Hata');
      else router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`"${service.title}" hizmetini silmek istediğine emin misin?`))
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteService(service.id);
      if (!result.success) setError(result.error || 'Hata');
      else router.refresh();
    });
  }

  const priceLabel = formatPriceRange(
    service.price_min,
    service.price_max,
    service.price_on_request
  );
  const durationLabel = formatDuration(service.duration_hours);
  const categoryLabel = service.service_categories
    ? `${service.service_categories.emoji || ''} ${service.service_categories.name_tr}`.trim()
    : '';

  return (
    <div
      className={`bg-white border rounded-lg p-6 transition-opacity ${
        service.is_active ? 'border-line' : 'border-line opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
            {categoryLabel}
            {!service.is_active && (
              <span className="ml-2 text-terracotta">· Pasif</span>
            )}
          </p>
          <h3 className="font-display text-xl text-ink mb-2">{service.title}</h3>

          <div className="flex items-center gap-4 flex-wrap text-sm text-ink-72 mb-3">
            {durationLabel && <span>{durationLabel}</span>}
            {durationLabel && priceLabel && <span>·</span>}
            {priceLabel && (
              <span className="text-ink font-medium">{priceLabel}</span>
            )}
          </div>

          {service.description && (
            <p className="text-ink-72 text-sm leading-relaxed whitespace-pre-wrap">
              {service.description}
            </p>
          )}

          <AddonManager
            serviceId={service.id}
            addons={service.service_addons || []}
          />

          {error && (
            <p className="text-sm text-terracotta mt-3">{error}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={isPending}
            className="text-sm text-ink-72 hover:text-ink px-2 py-1 transition-colors disabled:opacity-50"
            title={service.is_active ? 'Pasife al' : 'Aktife al'}
          >
            {service.is_active ? 'Pasife al' : 'Aktife al'}
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