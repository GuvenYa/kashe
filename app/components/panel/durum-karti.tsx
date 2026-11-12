import type { ReactNode } from 'react';

/**
 * DURUM KARTI — "Eslesme hazir" kartinin ortak hali (Duzeltme 15, gorsel dil).
 *
 * Solda durum basligi, marka gecisli ilerleme cizgisi ve kontrol satirlari;
 * sagda kucuk sayi kutulari. Etkinlik sayfasindaki eslesme karti bu kalibin
 * ilk ornegi; teklif topla formu ve is merkezleri ayni karti kullanir.
 *
 * Saf gorunum: durum tasimaz, sunucu ve istemci bilesenlerinden cagrilabilir.
 */
export type DurumSatiri = {
  metin: ReactNode;
  /** Tamamlanan satir yesil isaret, bekleyen satir soluk halka alir. */
  tamam: boolean;
};

export type DurumKutusu = {
  etiket: string;
  deger: ReactNode;
};

export function DurumKarti({
  baslik,
  tamam,
  ilerleme,
  satirlar,
  kutular = [],
  altAlan,
}: {
  baslik: string;
  /** Tumu tamam: nokta yesil; degilse pembe (suruyor). */
  tamam: boolean;
  /** 0-100. */
  ilerleme: number;
  satirlar: DurumSatiri[];
  kutular?: DurumKutusu[];
  altAlan?: ReactNode;
}) {
  const oran = Math.max(0, Math.min(100, Math.round(ilerleme)));
  return (
    <div className="bg-card border border-line rounded-xl p-5">
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div className="min-w-0 flex-1 basis-72">
          <p className="font-display font-semibold text-ink flex items-center gap-2">
            <span
              className={tamam ? 'text-moss' : 'text-brand-accent'}
              aria-hidden="true"
            >
              ●
            </span>
            {baslik}
          </p>

          <div
            className="w-full h-1.5 bg-paper-2 border border-line rounded-full overflow-hidden mt-3"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={oran}
            aria-label={baslik}
          >
            <div
              className="h-full bg-gradient-brand transition-all"
              style={{ width: `${oran}%` }}
            />
          </div>

          <ul className="mt-3 space-y-1">
            {satirlar.map((s, i) => (
              <li
                key={i}
                className={`text-sm flex items-start gap-2 ${
                  s.tamam ? 'text-ink-72' : 'text-ink-50'
                }`}
              >
                <span
                  className={`shrink-0 ${s.tamam ? 'text-moss' : 'text-ink-32'}`}
                  aria-hidden="true"
                >
                  {s.tamam ? '✓' : '○'}
                </span>
                <span className="min-w-0 break-words">{s.metin}</span>
              </li>
            ))}
          </ul>
        </div>

        {kutular.length > 0 && (
          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
            {kutular.map((k) => (
              <div
                key={k.etiket}
                className="rounded-xl border border-line px-3 py-2.5 sm:min-w-24"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
                  {k.etiket}
                </p>
                <p className="font-display text-lg sm:text-xl text-ink mt-1 leading-tight break-words tabular-nums">
                  {k.deger}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      {altAlan && <div className="mt-4 pt-4 border-t border-line">{altAlan}</div>}
    </div>
  );
}
