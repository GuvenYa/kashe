'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-browser';
import { UnreadBadge } from './unread-badge';
import { DISCOVERY_LINKS, MARKETING_LINKS } from '@/app/lib/nav-links';

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

  const groupLabel =
    'font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50 pt-1 pb-1.5';

  // menuLinks (tek kaynak) → gruplara ayrım:
  //  - Profilim: İşlerim BAŞINA (özgün düzen)  - Premium: Hesap
  //  - Bildirimler: Hesap'ta badge'li ayrı render  - kalanı: İşlerim
  const profileLink = menuLinks.find((l) => l.href === '/profil');
  const premiumLink = menuLinks.find((l) => l.href === '/premium');
  const workLinks = menuLinks.filter(
    (l) => !['/profil', '/premium', '/bildirimler'].includes(l.href)
  );

  // Keşif linkleri (tek kaynak nav-links; üst bar ile parite) — iki dalda da kullanılır
  const discoveryItems = DISCOVERY_LINKS.map((link) => (
    <a
      key={link.href}
      href={link.href}
      className={
        link.ai ? linkClass + ' inline-flex items-center gap-1.5' : linkClass
      }
    >
      {link.ai && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terracotta">
          <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
        </svg>
      )}
      {link.label}
    </a>
  ));

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

          <div className="md:hidden fixed top-[73px] left-0 right-0 max-h-[calc(100dvh-73px)] overflow-y-auto overscroll-contain bg-paper border-b border-line z-50 shadow-lg">
            <nav className="px-6 py-4">
              {isLoggedIn ? (
                <>
                  {/* İŞLERİM — Profilim başta (özgün düzen), sonra çalışma yüzeyleri.
                      Pazarlama linkleri girişli kullanıcıda YOK. */}
                  <p className={groupLabel}>İşlerim</p>
                  {profileLink && (
                    <a href={profileLink.href} className={linkClass}>
                      {profileLink.label}
                    </a>
                  )}
                  <a href="/mesajlar" className={linkClassInlineBadge}>
                    Mesajlar
                    {userId && <UnreadBadge userId={userId} />}
                  </a>
                  {/* Teklif Topla: yalnız teklif toplayabilen roller (client/business/manager).
                      Pro/ajans canCollectOffers=false → zaten gizli (v1 kararı). */}
                  {canCollectOffers && (
                    <a href="/teklif-topla" className={linkClass}>
                      Teklif Topla
                    </a>
                  )}
                  {workLinks.map((link) => (
                    <a key={link.href} href={link.href} className={linkClass}>
                      {link.label}
                    </a>
                  ))}

                  <div className="border-t border-line my-3" />

                  {/* KEŞİF — tek kaynak (nav-links); üst bar ile parite (Blog dahil) */}
                  <p className={groupLabel}>Keşif</p>
                  {discoveryItems}

                  <div className="border-t border-line my-3" />

                  {/* HESAP — Premium + Bildirimler + Admin + Çıkış */}
                  <p className={groupLabel}>Hesap</p>
                  {premiumLink && (
                    <a href={premiumLink.href} className={linkClass}>
                      {premiumLink.label}
                    </a>
                  )}
                  <a href="/bildirimler" className={linkClassInlineBadge}>
                    Bildirimler
                    {notificationCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1.5 bg-terracotta text-paper text-[10px] font-mono font-bold italic rounded-full flex items-center justify-center leading-none">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                  </a>
                  {isAdmin && (
                    <a href="/admin" className={linkClass}>
                      Admin Paneli
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className={linkClass + ' w-full text-left'}
                  >
                    Çıkış yap
                  </button>
                </>
              ) : (
                <>
                  {/* PUBLIC — tek kaynak (nav-links); üst bar girişsiz seti ile birebir */}
                  {discoveryItems}
                  {MARKETING_LINKS.map((link) => (
                    <a key={link.href} href={link.href} className={linkClass}>
                      {link.label}
                    </a>
                  ))}

                  <div className="border-t border-line my-3" />

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
                </>
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
