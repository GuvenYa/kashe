'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-browser';
import { UnreadBadge } from './unread-badge';

type Props = {
  isLoggedIn: boolean;
  isAdmin: boolean;
  isProfessional: boolean;
  isClient: boolean;
  isAgency: boolean;
  isBusiness: boolean;
  canReceiveOffers: boolean;
  canCollectOffers: boolean;
  userId: string | null;
  notificationCount: number;
  menuLinks: { href: string; label: string }[];
};

export function MobileNav({
  isLoggedIn,
  isAdmin,
  isProfessional,
  isClient,
  isAgency,
  isBusiness,
  canReceiveOffers,
  canCollectOffers,
  userId,
  notificationCount,
  menuLinks,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push('/');
    router.refresh();
  }

  const linkClass =
    'block py-3 font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-ink transition-colors';

  const linkClassInlineBadge =
    'flex py-3 font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-ink transition-colors items-center gap-2';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="md:hidden p-2 -mr-2 text-ink"
        aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'}
        aria-expanded={open}
      >
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 top-[73px] bg-ink/20 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div className="md:hidden fixed top-[73px] left-0 right-0 max-h-[calc(100vh-73px)] overflow-y-auto overscroll-contain bg-paper border-b border-line z-50 shadow-lg">
            <nav className="px-6 py-4">
              {/* PUBLIC NAV */}
              <a href="/kesfet" className={linkClass}>
                Keşfet
              </a>
              <a href="/ilanlar" className={linkClass}>
                İlanlar
              </a>
              <a href="/blog" className={linkClass}>
                Blog
              </a>
              <a href="/kashe-ai" className={linkClass + " inline-flex items-center gap-1.5"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terracotta">
                  <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
                </svg>
                Kashe AI
              </a>
              <a href="/#hizmetler" className={linkClass}>
                Hizmetler
              </a>
              <a href="/#nasil-calisir" className={linkClass}>
                Nasıl çalışır
              </a>
              <a href="/#kurumsal" className={linkClass}>
                Kurumsal
              </a>

              <div className="border-t border-line my-3" />

              {isLoggedIn ? (
                <>
                  {/* PROFİL GRUBU — tek kaynak: TopNav'dan gelen menuLinks.
                      Bildirimler aşağıda badge'li ayrı render edildiği için hariç tutulur. */}
                  {menuLinks
                    .filter((link) => link.href !== '/bildirimler')
                    .map((link) => (
                      <a key={link.href} href={link.href} className={linkClass}>
                        {link.label}
                      </a>
                    ))}

                  <div className="border-t border-line my-3" />

                  {/* İŞLEMLER GRUBU */}
                  {canReceiveOffers && (
                    <a href="/teklif-talepleri" className={linkClass}>
                      Teklif Talepleri
                    </a>
                  )}
                  {canCollectOffers && (
                    <a href="/teklif-topla" className={linkClass}>
                      Teklif Topla
                    </a>
                  )}

                  <a href="/mesajlar" className={linkClassInlineBadge}>
                    Mesajlar
                    {userId && <UnreadBadge userId={userId} />}
                  </a>

                  <a href="/bildirimler" className={linkClassInlineBadge}>
                    Bildirimler
                    {notificationCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1.5 bg-terracotta text-paper text-[10px] font-mono font-bold italic rounded-full flex items-center justify-center leading-none">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                  </a>

                  {isAdmin && (
                    <>
                      <div className="border-t border-line my-3" />
                      <a href="/admin" className={linkClass}>
                        Admin Paneli
                      </a>
                    </>
                  )}

                  <div className="border-t border-line my-3" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className={linkClass + ' w-full text-left'}
                  >
                    Çıkış yap
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-3 pt-2">
                  <a
                    href="/giris"
                    className="px-4 py-3 border border-line text-ink rounded-lg font-display font-medium text-center hover:bg-line transition-colors"
                  >
                    Giriş yap
                  </a>
                  <a
                    href="/uye-ol"
                    className="px-4 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-center hover:opacity-90 transition-opacity"
                  >
                    Üye ol
                  </a>
                </div>
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
