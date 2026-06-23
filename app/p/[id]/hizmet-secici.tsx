'use client';

import { useState } from 'react';
import { formatPriceRange, formatDuration } from '@/app/lib/profile-helpers';
import { IletisimButton } from './iletisim-button';
import type { ServiceWithCategory } from '@/app/lib/types';

type Props = {
  service: ServiceWithCategory;
  professionalId: string;
  professionalName: string;
  categorySlug: string | null;
  isLoggedIn: boolean;
  currentUserIsProfessional: boolean;
  isOwnProfile: boolean;
};

function formatPrice(price: number): string {
  return `₺${Math.round(price).toLocaleString('tr-TR')}`;
}

export function HizmetSecici({
  service,
  professionalId,
  professionalName,
  categorySlug,
  isLoggedIn,
  currentUserIsProfessional,
  isOwnProfile,
}: Props) {
  // Sadece aktif ekstralar
  const addons = (service.service_addons || []).filter((a) => a.is_active);
  const hasAddons = addons.length > 0;
   console.log('HizmetSecici', service.title, 'addons:', service.service_addons, 'aktif:', addons.length);

  // Seçili ekstra id'leri
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const priceLabel = formatPriceRange(
    service.price_min,
    service.price_max,
    service.price_on_request
  );
  const durationLabel = formatDuration(service.duration_hours);
  const catLabel = service.service_categories
    ? `${service.service_categories.emoji || ''} ${service.service_categories.name_tr}`.trim()
    : '';

  // Seçili ekstraların toplamı
  const selectedAddons = addons.filter((a) => selected.has(a.id));
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + Number(a.price), 0);

  // Tahmini taban fiyat (hizmet min/max ortalaması veya min) — sadece sabit fiyatlıysa
  const baseEstimate =
    !service.price_on_request && service.price_min !== null
      ? service.price_min
      : null;
  const estimatedTotal =
    baseEstimate !== null ? baseEstimate + addonsTotal : null;

  // İletişim butonuna geçecek özet (Aşama 4'te kullanılacak)
  const addonSummary =
    selectedAddons.length > 0
      ? selectedAddons.map((a) => a.title).join(', ')
      : null;

  return (
    <div className="border-l-2 border-terracotta pl-5 py-1">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-1">
        {catLabel}
      </p>
      <h3 className="font-display text-lg text-ink mb-1">{service.title}</h3>
      <p className="text-sm text-ink-72 mb-2">
        {[durationLabel, priceLabel].filter(Boolean).join(' · ')}
      </p>
      {service.description && (
        <p className="text-sm text-ink-72 leading-relaxed whitespace-pre-wrap mb-3">
          {service.description}
        </p>
      )}

      {/* Ekstralar — interaktif seçici */}
      {hasAddons && (
        <div className="mt-3 bg-paper rounded-lg p-4 border border-line">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2.5">
            Ekstralar
          </p>
          <div className="space-y-2">
            {addons.map((addon) => {
              const isSel = selected.has(addon.id);
              return (
                <label
                  key={addon.id}
                  className={`flex items-start gap-3 cursor-pointer p-2 rounded-lg transition ${
                    isSel ? 'bg-terracotta/8' : 'hover:bg-card'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(addon.id)}
                    className="mt-0.5 w-4 h-4 shrink-0 accent-terracotta cursor-pointer"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="text-sm text-ink">{addon.title}</span>
                    {addon.description && (
                      <span className="block text-[11px] text-ink-72">
                        {addon.description}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-medium text-ink shrink-0">
                    {Number(addon.price) > 0
                      ? `+${formatPrice(Number(addon.price))}`
                      : 'Ücretsiz'}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Canlı toplam */}
          {selectedAddons.length > 0 && (
            <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
              <span className="text-sm text-ink-72">
                {selectedAddons.length} ekstra seçildi
              </span>
              <span className="text-sm text-ink">
                {estimatedTotal !== null ? (
                  <>
                    Tahmini toplam:{' '}
                    <span className="font-display font-semibold text-terracotta">
                      ~{formatPrice(estimatedTotal)}
                    </span>
                  </>
                ) : (
                  <>
                    Ekstralar:{' '}
                    <span className="font-display font-semibold text-terracotta">
                      +{formatPrice(addonsTotal)}
                    </span>
                  </>
                )}
              </span>
            </div>
          )}

          {/* İletişim — seçili ekstralarla */}
          {!isOwnProfile && !currentUserIsProfessional && (
            <div className="mt-3">
              <IletisimButton
                professionalId={professionalId}
                professionalName={professionalName}
                categorySlug={categorySlug}
                isLoggedIn={isLoggedIn}
                currentUserIsProfessional={currentUserIsProfessional}
                isOwnProfile={isOwnProfile}
                serviceContext={{
                  title: service.title,
                  addons: selectedAddons.map((a) => ({
                    title: a.title,
                    price: Number(a.price),
                  })),
                  estimatedTotal,
                }}
                variant="package"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}