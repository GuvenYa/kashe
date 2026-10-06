import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * FAZ 7a / P2 — misafir portali kabugu.
 *
 * TopNav/footer YOKTUR: portal AYRI YUZEY (02 bolum 6). Oturum gerekmez,
 * pazaryeri gezinmesi sunulmaz; yalniz jetonla gelen kaynak gosterilir.
 *
 * `referrer: no-referrer`: URL'deki jeton Referer basligiyla disariya SIZMAZ
 * (sayfadaki gizlilik baglantisi tiklandiginda bile).
 */
export const metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="px-6 md:px-12 py-5 border-b border-line">
        <span className="font-display font-semibold text-lg text-ink">
          Kashe
        </span>
      </header>

      <main className="flex-1 px-6 md:px-12 py-10">{children}</main>

      <footer className="px-6 md:px-12 py-6 border-t border-line">
        <p className="text-xs text-ink-72 leading-relaxed max-w-3xl">
          Bu sayfa Kashe üzerinden size iletilen bir teklifi gösterir. Bağlantı
          kişiseldir, paylaşmayın.{' '}
          <Link href="/gizlilik" className="text-brand-ink hover:underline">
            Gizlilik ve KVKK
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}
