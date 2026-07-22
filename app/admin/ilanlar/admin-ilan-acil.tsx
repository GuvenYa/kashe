'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminGrantUrgent,
  adminRevokeUrgent,
  activateFeaturedCategorySimulation,
  cancelFeaturedCategory,
  activateFeaturedHomeSimulation,
  cancelFeaturedHome,
} from '@/app/ilanlar/listings-actions';
import { isUrgentActive, isPromotionActive } from '@/app/lib/promotion';

type Props = {
  listingId: string;
  isUrgent: boolean;
  urgentUntil: string | null;
  featuredCategoryUntil: string | null;
  featuredHomeUntil: string | null;
};

type ActionResult = { success: boolean; error?: string };

export function AdminIlanAcil({
  listingId,
  isUrgent,
  urgentUntil,
  featuredCategoryUntil,
  featuredHomeUntil,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const urgentOn = isUrgentActive(isUrgent, urgentUntil);
  const categoryOn = isPromotionActive(featuredCategoryUntil);
  const homeOn = isPromotionActive(featuredHomeUntil);

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  const onClass =
    'w-full px-3 py-2 rounded-lg font-mono text-[10px] uppercase tracking-[0.1em] border border-brand-ink text-brand-ink hover:bg-brand-ink/5 transition disabled:opacity-50 text-left';
  const offClass =
    'w-full px-3 py-2 rounded-lg font-mono text-[10px] uppercase tracking-[0.1em] border border-line text-ink-72 hover:border-brand-ink hover:text-brand-ink transition disabled:opacity-50 text-left';

  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
        Öne çıkarma
      </p>

      {error && <p className="text-xs text-danger">{error}</p>}

      {/* Acil */}
      <button
        onClick={() =>
          run(() =>
            urgentOn
              ? adminRevokeUrgent(listingId)
              : adminGrantUrgent(listingId, 7)
          )
        }
        disabled={isPending}
        className={urgentOn ? onClass : offClass}
      >
        {urgentOn ? '🔥 Acil — kaldır' : '🔥 Acil yap (7 gün)'}
      </button>

      {/* Kategori üstü */}
      <button
        onClick={() =>
          run(() =>
            categoryOn
              ? cancelFeaturedCategory(listingId)
              : activateFeaturedCategorySimulation(listingId)
          )
        }
        disabled={isPending}
        className={categoryOn ? onClass : offClass}
      >
        {categoryOn ? '★ Kategori üstü — kaldır' : '★ Kategori üstü (7 gün)'}
      </button>

      {/* Vitrin */}
      <button
        onClick={() =>
          run(() =>
            homeOn
              ? cancelFeaturedHome(listingId)
              : activateFeaturedHomeSimulation(listingId)
          )
        }
        disabled={isPending}
        className={homeOn ? onClass : offClass}
      >
        {homeOn ? '◆ Vitrin — kaldır' : '◆ Vitrin (7 gün)'}
      </button>
    </div>
  );
}