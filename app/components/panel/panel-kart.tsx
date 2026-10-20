import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * PANEL KARTI — gosterge listelerinin ortak kabu (baslik + "Tumu" baglantisi).
 *
 * Briefte ayri madde degil; uc gosterge ayni kart kabugunu uc kez yazmasin diye
 * cikarildi (listeler `VeriTablosu` ile bunun icine girer).
 */
export function PanelKart({
  baslik,
  tumuHref,
  tumuEtiket = 'Tümü',
  children,
}: {
  baslik: string;
  tumuHref?: string;
  tumuEtiket?: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-card border border-line rounded-2xl p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-display font-medium text-lg text-ink">{baslik}</h2>
        {tumuHref && (
          <Link
            href={tumuHref}
            className="kashe-tap shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink hover:underline"
          >
            {tumuEtiket} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
