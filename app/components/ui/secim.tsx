'use client';

import { useId } from 'react';

/**
 * SECIM BILESENLERI — tek secimli uc gorunum (Duzeltme 15, gorsel dil).
 *
 * Ucu de yerel `<input type="radio">` kullanir (gorunmez, etiketin icinde):
 * klavye (ok tuslari, sekme) ve ekran okuyucu davranisi tarayicidan gelir,
 * form icinde de calisir. Gorunum ekip kurma ekranindaki kaliplarla ayni:
 *   - SegmentSecici : tek satir segment (Tekil ekip / Ajans / Hibrit gibi)
 *   - SecimKutulari : aciklamali kutular; secili kutu koyu cerceve + isaret
 *   - SecimCipleri  : kisa degerler icin yuvarlak cipler (sure, adet)
 */
export type Secenek<T extends string | number> = {
  deger: T;
  etiket: string;
  /** Kutu gorunumunde etiketin altindaki kisa aciklama. */
  ipucu?: string;
};

type OrtakProps<T extends string | number> = {
  secenekler: readonly Secenek<T>[];
  deger: T;
  onDegis: (deger: T) => void;
  /** Grubun ekran okuyucu adi. */
  etiket: string;
  /** Radyo grubunun adi; verilmezse benzersiz uretilir. */
  ad?: string;
};

export function SegmentSecici<T extends string | number>({
  secenekler,
  deger,
  onDegis,
  etiket,
  ad,
}: OrtakProps<T>) {
  const kimlik = useId();
  return (
    <div
      role="radiogroup"
      aria-label={etiket}
      className="max-w-full inline-flex items-center gap-1 bg-paper-2 border border-line rounded-xl p-1 flex-wrap"
    >
      {secenekler.map((s) => {
        const secili = s.deger === deger;
        return (
          <label
            key={String(s.deger)}
            className={`kashe-tap cursor-pointer px-3 py-1.5 rounded-lg border text-xs font-display font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-ink ${
              secili
                ? 'bg-card border-line-strong text-ink'
                : 'border-transparent text-ink-72 hover:text-ink'
            }`}
          >
            <input
              type="radio"
              name={ad ?? kimlik}
              checked={secili}
              onChange={() => onDegis(s.deger)}
              className="sr-only"
            />
            {s.etiket}
          </label>
        );
      })}
    </div>
  );
}

export function SecimKutulari<T extends string | number>({
  secenekler,
  deger,
  onDegis,
  etiket,
  ad,
}: OrtakProps<T>) {
  const kimlik = useId();
  return (
    <div
      role="radiogroup"
      aria-label={etiket}
      className="grid grid-cols-1 sm:grid-cols-3 gap-2"
    >
      {secenekler.map((s) => {
        const secili = s.deger === deger;
        return (
          <label
            key={String(s.deger)}
            className={`kashe-tap relative block cursor-pointer rounded-xl border p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-ink ${
              secili
                ? 'border-brand-ink bg-brand-ink/[0.05] ring-2 ring-brand-ink'
                : 'border-line bg-card hover:border-brand-ink/50'
            }`}
          >
            <input
              type="radio"
              name={ad ?? kimlik}
              checked={secili}
              onChange={() => onDegis(s.deger)}
              className="sr-only"
            />
            <span className="flex items-center justify-between gap-2">
              <span className="font-display font-semibold text-sm text-ink">
                {s.etiket}
              </span>
              {secili && (
                <span
                  className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-brand-ink"
                  aria-hidden="true"
                >
                  ✓ Seçili
                </span>
              )}
            </span>
            {s.ipucu && (
              <span className="block text-xs text-ink-72 mt-0.5">{s.ipucu}</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

export function SecimCipleri<T extends string | number>({
  secenekler,
  deger,
  onDegis,
  etiket,
  ad,
}: OrtakProps<T>) {
  const kimlik = useId();
  return (
    <div role="radiogroup" aria-label={etiket} className="flex flex-wrap gap-2">
      {secenekler.map((s) => {
        const secili = s.deger === deger;
        return (
          <label
            key={String(s.deger)}
            className={`kashe-tap cursor-pointer px-3.5 py-1.5 rounded-full border text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-ink has-[:focus-visible]:ring-offset-1 ${
              secili
                ? 'bg-brand-ink text-paper border-brand-ink font-semibold'
                : 'bg-card text-ink-72 border-line hover:border-brand-ink hover:text-brand-ink'
            }`}
          >
            <input
              type="radio"
              name={ad ?? kimlik}
              checked={secili}
              onChange={() => onDegis(s.deger)}
              className="sr-only"
            />
            {s.etiket}
          </label>
        );
      })}
    </div>
  );
}
