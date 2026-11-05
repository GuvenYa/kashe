/**
 * BOLUM GEZINTI SERIDI (Duzeltme 11-D3, bulgu 80)
 *
 * Fahri (#13): "kategoriye gore farklilassin ama ana basliklar her profilde
 * sabit kalsin, bir profili nasil inceleyecegini anlasin." Profil uzun;
 * kullanici hangi bolumlerin VAR oldugunu gormeden kaydirmak zorundaydi.
 *
 * Serit yalniz SAYFADA OLAN bolumlere capa verir (listeyi cagiran kurar),
 * ust menunun hemen altinda yapiskan durur ve mobilde yatay kaydirilir —
 * ekran disina tasmaz. Sunucu bileseni: istemci JS eklemez, capalar duz
 * \`<a href="#...">\`.
 *
 * Yapiskan ofset: ust bar 73 px (mobil menu de \`top-[73px]\` kullanir).
 * Capalarin hedefi seridin ALTINDA kalmasin diye bolumlere
 * \`scroll-mt-[128px]\` verilir (73 + serit yuksekligi).
 */

export type BolumCapasi = { id: string; etiket: string };

/**
 * Bolum capasi sinifi — baslik yapiskan seridin ALTINDA kalmasin.
 * (73 px ust bar + ~44 px serit; iki profil dali ayni degeri kullanir.)
 */
export const BOLUM_CAPA = 'scroll-mt-[128px]';

export function BolumSeridi({ bolumler }: { bolumler: BolumCapasi[] }) {
  // Tek bolumde gezinti anlamsiz.
  if (bolumler.length < 2) return null;

  return (
    <nav
      aria-label="Profil bölümleri"
      className="sticky top-[73px] z-30 bg-paper/95 backdrop-blur-md border-b border-line"
    >
      <ul className="kashe-no-scrollbar flex items-center gap-5 overflow-x-auto py-2.5">
        {bolumler.map((b) => (
          <li key={b.id} className="shrink-0">
            <a
              href={`#${b.id}`}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-72 hover:text-brand-ink transition-colors whitespace-nowrap"
            >
              {b.etiket}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
