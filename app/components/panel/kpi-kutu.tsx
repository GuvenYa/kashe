import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * KPI KUTUSU — panel gostergelerinin tek sayisal kutusu.
 *
 * Kaynak desen: `app/admin/page.tsx` StatCard. Burada token'lar DESIGN.md'den,
 * vurgu uc degerle sinirli (rastgele renk yok).
 *
 * `deger` string de olabilir (para, yuzde) — bicimleme CAGIRANIN isi; bu bilesen
 * rakam uretmez, aldigini yazar.
 */
const VURGU_KENAR: Record<string, string> = {
  none: 'border-line bg-card',
  accent: 'border-brand-accent/30 bg-brand-accent/[0.04]',
  moss: 'border-moss/30 bg-moss/[0.04]',
};

const VURGU_ETIKET: Record<string, string> = {
  none: 'text-ink-50',
  accent: 'text-brand-accent',
  moss: 'text-moss',
};

export function KpiKutu({
  etiket,
  deger,
  altNot,
  vurgu = 'none',
  href,
}: {
  etiket: string;
  deger: string | number;
  altNot?: ReactNode;
  vurgu?: 'accent' | 'moss' | 'none';
  href?: string;
}) {
  const govde = (
    <div
      className={
        href
          ? `relative rounded-xl border p-4 md:p-5 h-full transition-colors hover:border-brand-ink/40 ${VURGU_KENAR[vurgu]}`
          : `relative rounded-xl border p-4 md:p-5 h-full ${VURGU_KENAR[vurgu]}`
      }
    >
      <p
        className={`font-mono text-[10px] uppercase tracking-[0.16em] mb-1.5 pr-5 ${VURGU_ETIKET[vurgu]}`}
      >
        {etiket}
      </p>
      <p className="font-display text-3xl text-ink tabular-nums leading-none">
        {typeof deger === 'number' ? deger.toLocaleString('tr-TR') : deger}
      </p>
      {altNot && <p className="text-[11px] text-ink-72 mt-2">{altNot}</p>}
      {href && (
        <span
          className="absolute top-3 right-3 text-ink-50 text-xs"
          aria-hidden
        >
          →
        </span>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {govde}
    </Link>
  ) : (
    govde
  );
}

/** KPI satiri — telefonda iki, lg'de dort sutun. */
export function KpiSatir({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">{children}</div>
  );
}
