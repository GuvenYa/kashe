import type { ReactNode } from 'react';

/**
 * OZET SERIT — telefonda sayfanin altinda duran yapiskan serit (D1b-3).
 *
 * `md` ALTINDA gorunur, masaustunde YOK: genis ekranda ayni bilgi ve ayni
 * birincil dugme baslik kartinda zaten duruyor, serit tekrar olurdu. Telefonda
 * ise uzun bir tablonun dibine inen kullanici "toplam ne, simdi ne yapacagim"
 * sorusunun yanitini kaydirma yapmadan goruyor.
 *
 * Dugme EYLEM URETMEZ: `aksiyon` olarak verilen dugme cagiranin kendi dugmesidir
 * (ayni action, ayni onay kapisi). Serit yalniz kabuktur.
 */
export function OzetSerit({
  etiket,
  deger,
  altNot,
  aksiyon,
}: {
  etiket?: string;
  deger: string;
  altNot?: string;
  aksiyon?: ReactNode;
}) {
  return (
    <>
      {/* Serit sabit konumda durdugu icin sayfanin son icerigini kapatmasin:
          ayni yukseklikte bos bir alan birakilir. */}
      <div className="h-20 md:hidden" aria-hidden />
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-line-strong px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {etiket && (
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
              {etiket}
            </p>
          )}
          <p className="font-display font-semibold text-ink tabular-nums leading-tight truncate">
            {deger}
          </p>
          {altNot && <p className="text-[11px] text-ink-72">{altNot}</p>}
        </div>
        {aksiyon && <div className="shrink-0">{aksiyon}</div>}
      </div>
    </>
  );
}
