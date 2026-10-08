/**
 * ORNEK ROZETI — vitrindeki ornek kartlarin sag ustunde durur.
 *
 * Neden tek bilesen: ana sayfada uc ornek kart var (kurumsal ilan, ajans teklifi,
 * profesyonel profili). Hepsi ayni rozeti tasir; metni ya da tonu degisirse tek
 * yerde degisir. Rozet "bu gercek bir kayit degil" der — uretim verisi gibi
 * okunmalarini onler.
 */
export function OrnekRozeti({ ton = 'acik' }: { ton?: 'acik' | 'koyu' }) {
  const sinif =
    ton === 'koyu'
      ? 'bg-paper-14 text-paper-72 border-paper-14'
      : 'bg-paper-2 text-ink-72 border-line';

  return (
    <span
      className={`font-mono text-[9px] uppercase tracking-[0.18em] border px-2 py-1 rounded-full shrink-0 ${sinif}`}
    >
      Örnek
    </span>
  );
}
