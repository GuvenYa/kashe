import type { ReactNode } from 'react';

/**
 * PANEL BASLIGI — eyebrow + h1 + sagda serbest alan (tarih / CTA).
 *
 * Vurgu kelimesi cagiran tarafta `<em className="not-italic text-brand-accent">`
 * ile isaretlenir (DESIGN.md bolum 9): calisma yuzeylerinde vurgu PEMBE, vitrinde
 * lacivert kalir.
 */
export function PanelBaslik({
  eyebrow,
  sagAlan,
  altNot,
  children,
}: {
  eyebrow: string;
  sagAlan?: ReactNode;
  altNot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand-ink mb-2">
          {eyebrow}
        </p>
        <h1 className="font-display text-3xl md:text-4xl text-ink tracking-[-0.02em] leading-tight">
          {children}
        </h1>
        {altNot && <p className="text-sm text-ink-72 mt-2">{altNot}</p>}
      </div>
      {sagAlan && <div className="shrink-0 sm:text-right">{sagAlan}</div>}
    </div>
  );
}
