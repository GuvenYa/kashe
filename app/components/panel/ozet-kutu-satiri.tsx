import type { ReactNode } from 'react';

/**
 * OZET KUTU SATIRI — 2-3 kutuluk ozet bandi; biri `hero` olarak one cikar
 * (lacivert zemin, acik metin).
 *
 * Kullanim: tek bir sayinin ekranin anlamini tasidigi yerler (gosterge ozeti,
 * D1b'de teklif editorunun "Musteriye teklif" toplami). KPI satirindan farki:
 * iki-uc kutu, biri agirlikli; KpiSatir dort esit kutudur.
 *
 * Tutar/oran bicimlemesi CAGIRANIN isi — bu bilesen rakam uretmez.
 */
export type OzetKutusu = {
  etiket: string;
  deger: string;
  altNot?: ReactNode;
  hero?: boolean;
};

export function OzetKutuSatiri({ kutular }: { kutular: OzetKutusu[] }) {
  const sutun =
    kutular.length >= 3
      ? 'grid grid-cols-1 sm:grid-cols-3 gap-4'
      : 'grid grid-cols-1 sm:grid-cols-2 gap-4';

  return (
    <div className={sutun}>
      {kutular.map((k) => (
        <div
          key={k.etiket}
          className={
            k.hero
              ? 'rounded-2xl border border-brand-ink bg-brand-ink p-5 md:p-6'
              : 'rounded-2xl border border-line bg-card p-5 md:p-6'
          }
        >
          <p
            className={
              k.hero
                ? 'font-mono text-[10px] uppercase tracking-[0.16em] text-paper/72 mb-2'
                : 'font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-2'
            }
          >
            {k.etiket}
          </p>
          <p
            className={
              k.hero
                ? 'font-display text-3xl md:text-4xl text-paper tabular-nums leading-none'
                : 'font-display text-3xl md:text-4xl text-ink tabular-nums leading-none'
            }
          >
            {k.deger}
          </p>
          {k.altNot && (
            <p
              className={
                k.hero
                  ? 'text-xs text-paper/72 mt-2.5'
                  : 'text-xs text-ink-72 mt-2.5'
              }
            >
              {k.altNot}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
