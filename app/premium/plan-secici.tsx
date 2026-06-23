'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  activatePremiumSimulation,
  cancelPremiumSimulation,
} from './actions';
import {
  PREMIUM_PLANS,
  PREMIUM_DURATIONS,
  formatTRY,
  tierLabel,
  type PremiumPlan,
} from '@/app/lib/premium';
import type { PremiumTier } from '@/app/lib/badges';

type Props = {
  userRole: string;
  currentTier: PremiumTier;
  premiumActive: boolean;
  premiumUntil: string | null;
};

export function PlanSecici({
  userRole,
  currentTier,
  premiumActive,
  premiumUntil,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<PremiumPlan | null>(null);
  const [months, setMonths] = useState(6);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  // Kullanıcının rolüne uygun planlar
  const availablePlans = PREMIUM_PLANS.filter(
    (p) => p.forRoles.length === 0 || p.forRoles.includes(userRole)
  );

  function handleActivate() {
    if (!confirmPlan) return;
    setError(null);
    startTransition(async () => {
      const result = await activatePremiumSimulation(confirmPlan.tier, months);
      if (result.success) {
        setConfirmPlan(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelPremiumSimulation();
      if (result.success) {
        setCancelConfirm(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const untilFormatted = premiumUntil
    ? new Date(premiumUntil).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div>
      {/* Simülasyon uyarısı */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-start gap-3">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#92400e"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 mt-0.5"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <p className="font-display font-semibold text-sm text-amber-900 mb-0.5">
            Ödeme sistemi yakında
          </p>
          <p className="text-sm text-amber-800 leading-relaxed">
            Online ödeme (iyzico) entegrasyonu hazırlanıyor. Şimdilik premium
            özellikleri test amaçlı, ücretsiz aktifleştirebilirsin. Lansman
            döneminde premium üyelik zaten ücretsizdir.
          </p>
        </div>
      </div>

      {/* Mevcut durum */}
      {premiumActive && (
        <div className="bg-[#F4E9C8] border border-[#D9C179] rounded-xl p-5 mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8A6D1F] mb-1">
              Aktif üyelik
            </p>
            <p className="font-display text-lg text-ink">
              {tierLabel(currentTier)} Premium
              {untilFormatted && (
                <span className="text-sm text-ink-72 font-body ml-2">
                  · {untilFormatted} tarihine kadar
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCancelConfirm(true)}
            disabled={isPending}
            className="text-sm font-mono uppercase tracking-[0.14em] text-ink-72 hover:text-danger transition-colors disabled:opacity-50"
          >
            Üyeliği iptal et
          </button>
        </div>
      )}

      {error && !confirmPlan && !cancelConfirm && (
        <div className="bg-danger-08 border border-danger/30 rounded-lg p-3 mb-6 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Plan kartları */}
      {availablePlans.length === 0 ? (
        <div className="bg-card border border-line rounded-2xl p-8 text-center">
          <p className="text-ink-72">
            Hesap türün için şu an premium plan bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {availablePlans.map((plan) => {
            const isCurrent = premiumActive && currentTier === plan.tier;
            return (
              <div
                key={plan.tier}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  plan.highlighted
                    ? 'border-terracotta shadow-[0_8px_30px_-12px_rgba(147,51,234,0.3)]'
                    : 'border-line'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-6 bg-gradient-brand text-paper font-mono text-[9px] uppercase tracking-[0.16em] px-3 py-1 rounded-full">
                    En popüler
                  </span>
                )}
                <h3 className="font-display text-2xl text-ink mb-1">
                  {plan.label}
                </h3>
                <p className="mb-4">
                  <span className="font-display text-3xl text-ink">
                    {formatTRY(plan.monthlyPrice)}
                  </span>
                  <span className="text-sm text-ink-72"> / ay</span>
                </p>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f, i) => (
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
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="text-center py-3 rounded-lg bg-[#F4E9C8] border border-[#D9C179] font-display font-semibold text-sm text-[#8A6D1F]">
                    Aktif planın
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmPlan(plan);
                      setMonths(6);
                      setError(null);
                    }}
                    disabled={isPending}
                    className={`w-full py-3 rounded-lg font-display font-semibold text-sm transition-all disabled:opacity-50 ${
                      plan.highlighted
                        ? 'bg-terracotta text-paper hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)]'
                        : 'border border-ink text-ink hover:bg-ink hover:text-paper'
                    }`}
                  >
                    {premiumActive ? 'Bu plana geç' : 'Premium\'a geç'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Aktivasyon onay modalı */}
      {confirmPlan && (
        <div
          className="fixed inset-0 z-[100] bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !isPending && setConfirmPlan(null)}
        >
          <div
            className="bg-card border border-line rounded-2xl max-w-md w-full p-6 md:p-7 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-2">
              Premium aktivasyonu (simülasyon)
            </p>
            <h3 className="font-display font-semibold text-xl text-ink mb-2 leading-tight">
              <em className="text-terracotta">{confirmPlan.label}</em> planını
              aktifleştir
            </h3>
            <p className="text-sm text-ink-72 leading-relaxed mb-4">
              Bu bir test aktivasyonudur — ödeme alınmaz. Seçtiğin süre sonunda
              üyelik otomatik biter.
            </p>

            <label className="block mb-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 block mb-1.5">
                Süre
              </span>
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                disabled={isPending}
                className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition disabled:opacity-60"
              >
                {PREMIUM_DURATIONS.map((d) => (
                  <option key={d.months} value={d.months}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>

            {error && (
              <p className="text-xs text-danger mb-4 bg-danger-08 border border-danger/30 rounded-lg p-3">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmPlan(null)}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 border border-line text-ink-72 rounded-xl font-display font-semibold text-sm hover:bg-paper-2 transition disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleActivate}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 bg-terracotta text-paper rounded-xl font-display font-semibold text-sm hover:bg-ember transition disabled:opacity-60"
              >
                {isPending ? '...' : 'Aktifleştir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* İptal onay modalı */}
      {cancelConfirm && (
        <div
          className="fixed inset-0 z-[100] bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !isPending && setCancelConfirm(false)}
        >
          <div
            className="bg-card border border-line rounded-2xl max-w-md w-full p-6 md:p-7 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-danger mb-2">
              Üyeliği iptal et
            </p>
            <h3 className="font-display font-semibold text-xl text-ink mb-2 leading-tight">
              Premium üyeliğin iptal edilsin mi?
            </h3>
            <p className="text-sm text-ink-72 leading-relaxed mb-5">
              Profil Standart seviyeye döner. Keşfet önceliği ve premium rozeti
              kaldırılır.
            </p>

            {error && (
              <p className="text-xs text-danger mb-4 bg-danger-08 border border-danger/30 rounded-lg p-3">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCancelConfirm(false)}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 border border-line text-ink-72 rounded-xl font-display font-semibold text-sm hover:bg-paper-2 transition disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 bg-danger text-paper rounded-xl font-display font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
              >
                {isPending ? '...' : 'İptal et'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}