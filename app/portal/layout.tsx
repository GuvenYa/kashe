import Link from 'next/link';
import type { ReactNode } from 'react';
import { KasheMark } from '@/app/components/ui/kashe-mark';

/**
 * FAZ 7a / P2 — misafir portali kabugu.
 *
 * TopNav/Footer bilesenleri KULLANILMAZ: ikisi de oturum ve pazaryeri
 * gezinmesi tasiyor; portal AYRI YUZEY (02 bolum 6). Burada yalniz marka
 * blogu ve iki tanitim baglantisi var — musteri Kashe'nin ne oldugunu
 * gorebilsin diye (P2-ek canli turu bulgusu).
 *
 * `referrer: no-referrer`: URL'deki jeton Referer basligiyla disariya SIZMAZ
 * (ust bardaki ya da alt bilgideki baglantilar tiklandiginda bile).
 */
export const metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};

const UST_BAGLANTI =
  'text-xs md:text-sm text-ink-72 hover:text-brand-ink transition-colors whitespace-nowrap';
const ALT_BAGLANTI = 'hover:text-brand-ink transition-colors';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="px-5 md:px-12 py-4 border-b border-line">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          {/* TopNav ile ayni logo blogu (bilesen degil, yalniz gorunum) */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <KasheMark className="w-8 h-8" />
            <span className="font-display font-semibold text-lg md:text-xl text-ink tracking-tight">
              Kashe
            </span>
          </Link>

          <nav className="flex items-center gap-3 md:gap-5">
            <Link href="/hakkimizda" className={UST_BAGLANTI}>
              Kashe nedir?
            </Link>
            <Link href="/yardim" className={UST_BAGLANTI}>
              Yardım
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-5 md:px-12 py-8 md:py-12">{children}</main>

      <footer className="px-5 md:px-12 py-6 border-t border-line">
        <div className="max-w-3xl mx-auto space-y-2">
          <p className="text-xs text-ink-72 leading-relaxed">
            Bu sayfa Kashe üzerinden size iletilen bir teklifi gösterir.
            Bağlantı kişiseldir, paylaşmayın.
          </p>
          <p className="text-xs text-ink-72 flex items-center gap-2 flex-wrap">
            <Link href="/gizlilik" className={ALT_BAGLANTI}>
              Gizlilik
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/kvkk" className={ALT_BAGLANTI}>
              KVKK
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/kullanim-kosullari" className={ALT_BAGLANTI}>
              Kullanım koşulları
            </Link>
            <span aria-hidden="true">·</span>
            <a href="mailto:info@kashe.net" className={ALT_BAGLANTI}>
              İletişim
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
