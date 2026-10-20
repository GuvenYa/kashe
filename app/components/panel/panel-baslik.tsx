import type { ReactNode } from 'react';

/**
 * PANEL BASLIGI — eyebrow + h1 + sagda serbest alan (tarih / CTA).
 *
 * Vurgu kelimesi cagiran tarafta `<em className="not-italic text-brand-accent">`
 * ile isaretlenir (DESIGN.md bolum 9): calisma yuzeylerinde vurgu PEMBE, vitrinde
 * lacivert kalir.
 *
 * YERLESIM (D1b-4): sol sutun `min-w-0 flex-1 basis-80` — 20 rem'in altina
 * inmez; yer kalmayinca sag grup `flex-wrap` ile ikinci satira sarar. Baslik
 * `break-words` alir, `truncate` ALMAZ: uzun teklif/etkinlik adlari uc nokta ile
 * kesildiginde ayirt edilemiyordu.
 *
 * `eyebrow` ReactNode: bazi sayfalarda kurulus adlari gibi hesaplanan icerik
 * tasiyor (kurulus adlarini birlestiren bir ifade), duz metin degil.
 */
export function PanelBaslik({
  eyebrow,
  sagAlan,
  altNot,
  children,
}: {
  eyebrow: ReactNode;
  sagAlan?: ReactNode;
  altNot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0 flex-1 basis-80">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand-ink mb-2">
          {eyebrow}
        </p>
        <h1 className="font-display text-3xl md:text-4xl text-ink tracking-[-0.02em] leading-tight break-words">
          {children}
        </h1>
        {altNot && (
          <p className="text-sm text-ink-72 mt-2 max-w-2xl">{altNot}</p>
        )}
      </div>
      {sagAlan && <div className="shrink-0">{sagAlan}</div>}
    </div>
  );
}
