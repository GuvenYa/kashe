'use client';

import { useState, useTransition } from 'react';
import { addProviderToTalentPool } from '@/app/ajans/havuz/havuz-actions';

/**
 * FAZ 5 / P3 — kesfet kartindaki havuz kisa yolu.
 *
 * Sunucu bu bileseni ANCAK tek yonetilebilir kurulus varsa gonderir; kurulus
 * secimi ve roller `/p/[id]` panelinde. Iliski turu burada sorulmaz: `occasional`
 * ile eklenir, sonradan `/ajans/havuz`'da duzenlenir.
 *
 * Kart geneli bir stretched link oldugu icin tiklama YUKARI TASINMAZ
 * (preventDefault + stopPropagation) — karta gidilmez.
 */
export function HavuzKisaYol({
  providerId,
  orgId,
  durum,
}: {
  providerId: string;
  orgId: string;
  durum: 'havuzda' | 'eklenebilir';
}) {
  const [isPending, startTransition] = useTransition();
  const [eklendi, setEklendi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  // Prop ile state ayrismasin: sunucu tazelendiginde `durum` zaten 'havuzda' olur.
  const havuzda = durum === 'havuzda' || eklendi;

  if (havuzda) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 bg-paper border border-line px-2 py-1 rounded">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-brand-ink)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <polyline points="4 12.5 9.5 18 20 6.5" />
        </svg>
        Havuzda
      </span>
    );
  }

  function ekle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setHata(null);
    startTransition(async () => {
      const res = await addProviderToTalentPool({
        organizationId: orgId,
        providerId,
        relationshipType: 'occasional',
      });
      if (res.success) setEklendi(true);
      else setHata(res.error);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={ekle}
        disabled={isPending}
        className="kashe-tap font-mono text-[10px] uppercase tracking-[0.12em] text-brand-ink bg-paper border border-brand-ink/40 px-2 py-1 rounded hover:bg-brand-ink hover:text-paper transition-colors disabled:opacity-50"
      >
        {isPending ? 'Ekleniyor…' : 'Havuza ekle'}
      </button>
      {hata && <span className="text-[11px] text-danger">{hata}</span>}
    </span>
  );
}
