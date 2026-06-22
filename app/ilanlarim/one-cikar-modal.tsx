'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Flame, Star, Gem, Check } from 'lucide-react';
import {
  activateUrgentSimulation,
  cancelUrgentSimulation,
  activateFeaturedCategorySimulation,
  cancelFeaturedCategory,
  activateFeaturedHomeSimulation,
  cancelFeaturedHome,
} from '../ilanlar/listings-actions';
import {
  isUrgent,
  isFeaturedCategory,
  isFeaturedHome,
  type ListingWithRelations,
} from '../ilanlar/listings-data';
import { PROMOTION_PLANS, type PromotionType } from '@/app/lib/promotion';
import { formatTRY } from '@/app/lib/premium';

type Props = {
  listing: ListingWithRelations;
  onClose: () => void;
};

const ICONS: Record<string, typeof Flame> = {
  urgent: Flame,
  featured_category: Star,
  featured_home: Gem,
};

export function OneCikarModal({ listing, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Yalnızca bu üç tarife şu an aktif (bildirim ayrı/sonra)
  const plans = PROMOTION_PLANS.filter((p) => p.type !== 'notify');

  function isActive(type: PromotionType): boolean {
    if (type === 'urgent') return isUrgent(listing);
    if (type === 'featured_category') return isFeaturedCategory(listing);
    if (type === 'featured_home') return isFeaturedHome(listing);
    return false;
  }

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (r.success) {
        router.refresh();
        onClose();
      } else {
        setError(r.error || 'Bir hata oluştu.');
      }
    });
  }

  function activate(type: PromotionType) {
    if (type === 'urgent') return run(() => activateUrgentSimulation(listing.id));
    if (type === 'featured_category')
      return run(() => activateFeaturedCategorySimulation(listing.id));
    if (type === 'featured_home')
      return run(() => activateFeaturedHomeSimulation(listing.id));
  }

  function deactivate(type: PromotionType) {
    if (type === 'urgent') return run(() => cancelUrgentSimulation(listing.id));
    if (type === 'featured_category')
      return run(() => cancelFeaturedCategory(listing.id));
    if (type === 'featured_home')
      return run(() => cancelFeaturedHome(listing.id));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" aria-hidden="true" />

      <div
        className="relative bg-paper rounded-2xl shadow-xl max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-paper border-b border-line px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-display text-xl text-ink">İlanı öne çıkar</h2>
            <p className="text-xs text-ink-72 mt-0.5 line-clamp-1">
              {listing.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-72 hover:text-ink p-2 -mr-2 transition-colors"
            aria-label="Kapat"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {error && (
            <div className="px-4 py-3 bg-terracotta/10 border border-terracotta/30 rounded-lg text-sm text-terracotta">
              {error}
            </div>
          )}

          {plans.map((plan) => {
            const Icon = ICONS[plan.type] ?? Star;
            const active = isActive(plan.type);
            return (
              <div
                key={plan.type}
                className={`border rounded-xl p-4 transition ${
                  active
                    ? 'border-terracotta bg-terracotta/5'
                    : 'border-line bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-terracotta/10 flex items-center justify-center">
                    <Icon size={18} className="text-terracotta" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-display font-semibold text-ink">
                        {plan.label}
                      </p>
                      <span className="font-display font-semibold text-terracotta text-sm">
                        {formatTRY(plan.price)}
                        <span className="text-ink-72 font-normal text-xs">
                          {' '}
                          / {plan.durationDays} gün
                        </span>
                      </span>
                    </div>
                    <p className="text-sm text-ink-72 leading-relaxed mt-1">
                      {plan.desc}
                    </p>

                    <div className="mt-3">
                      {active ? (
                        <button
                          onClick={() => deactivate(plan.type)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border border-terracotta/40 text-terracotta hover:bg-terracotta/5 transition disabled:opacity-50"
                        >
                          <Check size={13} />
                          Aktif — kaldır
                        </button>
                      ) : (
                        <button
                          onClick={() => activate(plan.type)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-display font-semibold bg-terracotta text-paper hover:bg-ember transition disabled:opacity-50"
                        >
                          {isPending ? 'İşleniyor…' : 'Öne çıkar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <p className="text-[11px] text-ink-72 leading-relaxed pt-1">
            İyzico ödeme entegrasyonu yakında. Şu an öne çıkarma özelliklerini
            ücretsiz deneyebilirsin. Süreler dolduğunda etiketler otomatik kalkar.
          </p>
        </div>
      </div>
    </div>
  );
}