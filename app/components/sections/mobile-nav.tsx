'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-browser';
import { UnreadBadge } from './unread-badge';

type Props = {
  isLoggedIn: boolean;
  isProfessional: boolean;
  isClient: boolean;
  userId: string | null;
  notificationCount: number;
};

export function MobileNav({
  isLoggedIn,
  isProfessional,
  isClient,
  userId,
  notificationCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Sayfa değişince menüyü kapat
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // ESC ile kapat
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Açıkken body scroll kapat
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
    'py-3 font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-ink transition-colors inline-flex items-center gap-2';

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

      {/* Slide-down panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 top-[73px] bg-ink/20 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="md:hidden fixed top-[73px] left-0 right-0 bg-paper border-b border-line z-50 shadow-lg">
            <nav className="px-6 py-4">
              <a href="/kesfet" className={linkClass}>
                Keşfet
              </a>
              <a href="/ilanlar" className={linkClass}>
                İlanlar
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
                  {isProfessional && (
                    <a href="/profil/hizmetlerim" className={linkClass}>
                      Hizmetlerim
                    </a>
                  )}
                  {isProfessional && (
                    <a href="/profil/portfoy" className={linkClass}>
                      Portföyüm
                    </a>
                  )}
                  {isClient && (
                    <a href="/favoriler" className={linkClass}>
                      Favoriler
                    </a>
                  )}

                  <a href="/mesajlar" className={linkClassInlineBadge}>
                    Mesajlar
                    {userId && <UnreadBadge userId={userId} />}
                  </a>

                  <a href="/bildirimler" className={linkClassInlineBadge}>
                    Bildirimler
                    {notificationCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1.5 bg-terracotta text-paper text-[10px] font-mono font-bold rounded-full flex items-center justify-center leading-none">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                  </a>

                  <a href="/profil" className={linkClass}>
                    Profilim
                  </a>
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