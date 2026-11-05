'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-browser';
import { UnreadBadge } from './unread-badge';
import {
  DISCOVERY_LINKS,
  HAKKINDA_LINKS,
  MARKETING_LINKS,
  PLANLA_LINK,
} from '@/app/lib/nav-links';
import { IsiltiIkonu } from '@/app/components/ui/isilti-ikonu';
import type { BaslaticiMenusu } from '@/app/lib/panel-menu-tipler';

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
  /**
   * Kisa baslatici (Duzeltme 02) — avatar menusuyle AYNI model.
   * Eski duz liste prop'u kalkti: 16 satirlik "Islerim" yerine
   * Panel + en cok kullanilan maddeler + hesap satirlari.
   */
  baslatici: BaslaticiMenusu;
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
  baslatici,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Adres cubugu (dis sistem) ile esitleme: gezinme olunca acik menu kapanir.
  // Alternatif `key` ile sifirlama ebeveyni sunucu bileseni oldugu icin
  // pathname'e erisemiyor; kapatmayi onlarca baglantinin onClick'ine dagitmak
  // ayni davranisi daha kirilgan yazar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route degisimi dis sistem esitlemesi
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

  /**
   * Menuyu kapatir — her baglantida cagrilir (Duzeltme 09-B2).
   *
   * `pathname` efekti gezinmede kapatiyor; ama AYNI sayfadaki `/#...`
   * baglantisinda pathname DEGISMEZ ve menu acik kalirdi.
   */
  function kapat() {
    setOpen(false);
  }

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

  // Grup başlıkları: brand-ink eyebrow tonu (link renginden ayrışır; profil bölüm
  // eyebrow'larıyla aynı) — link renkleri değişmez.
  const groupLabel =
    'font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-brand-ink pt-1 pb-1.5';

  // Keşif linkleri (tek kaynak nav-links; üst bar ile parite) — iki dalda da kullanılır
  const discoveryItems = DISCOVERY_LINKS.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      prefetch={false}
      onClick={kapat}
      className={linkClass}
    >
      {link.label}
    </Link>
  ));

  /**
   * Duzeltme 11-A3 (bulgu 73): ana eylem menunun EN USTUNDE tam genislik
   * dugme — iki dalda da ayni. Eskiden "Kashe AI" kesif listesinde sirada
   * dorduncu satirdi.
   */
  const planlaDugmesi = (
    <Link
      href={PLANLA_LINK.href}
      prefetch={false}
      onClick={kapat}
      className="flex items-center justify-center gap-2 px-4 py-3 mb-3 bg-brand-ink text-paper rounded-lg font-display font-semibold text-center hover:opacity-90 transition-opacity"
    >
      <IsiltiIkonu size={16} />
      {PLANLA_LINK.label}
    </Link>
  );

  // "Kashe hakkında" — sayfa ici capalar + Blog (ust barda yok, burada var)
  const hakkindaGrubu = (
    <>
      <p className={groupLabel}>Kashe hakkında</p>
      {HAKKINDA_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch={false}
          onClick={kapat}
          className={linkClass}
        >
          {link.label}
        </Link>
      ))}
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="lg:hidden p-2 -mr-2 text-ink"
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

      {open &&
        createPortal(
        <>
          {/* Portal → document.body: üst bardaki backdrop-filter'ın fixed
              containing-block etkisinden kaç → viewport-göreli konumlan. */}
          <div
            className="lg:hidden fixed inset-0 top-[73px] bg-ink/40 backdrop-blur-sm z-[90]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div className="lg:hidden fixed top-[73px] left-0 right-0 max-h-[calc(100dvh-73px)] overflow-y-auto overscroll-contain bg-paper border-b border-line z-[100] shadow-lg">
            <nav className="px-6 py-4">
              {isLoggedIn ? (
                <>
                  {planlaDugmesi}

                  {/* PANEL — kisa baslatici (Duzeltme 02): gosterge + en cok
                      kullanilan maddeler. Gerisi panel yan menusunde.
                      Pazarlama linkleri girişli kullanıcıda YOK. */}
                  <p className={groupLabel}>Panel</p>
                  {baslatici.panel && (
                    <Link
                      href={baslatici.panel.href}
                      prefetch={false}
                      onClick={kapat}
                      className={linkClass}
                    >
                      Panel
                    </Link>
                  )}
                  {baslatici.oncelikli.map((madde) => (
                    <Link
                      key={madde.href}
                      href={madde.href}
                      prefetch={false}
                      onClick={kapat}
                      className={linkClass}
                    >
                      {madde.etiket}
                    </Link>
                  ))}
                  {/* Teklif Topla: yalnız teklif toplayabilen roller (client/business/manager).
                      Pro/ajans canCollectOffers=false → zaten gizli (v1 kararı). */}
                  {canCollectOffers && (
                    <Link
                      href="/teklif-topla"
                      prefetch={false}
                      onClick={kapat}
                      className={linkClass}
                    >
                      Teklif Topla
                    </Link>
                  )}

                  <div className="border-t border-line my-3" />

                  {/* KEŞİF — tek kaynak (nav-links); üst bar ile parite */}
                  <p className={groupLabel}>Keşif</p>
                  {discoveryItems}

                  <div className="border-t border-line my-3" />

                  {hakkindaGrubu}

                  <div className="border-t border-line my-3" />

                  {/* HESAP — Mesajlar + Bildirimler (rozetli) + hesap satirlari
                      + Admin + Çıkış. Rozetli satirlar baslaticida YOK, burada. */}
                  <p className={groupLabel}>Hesap</p>
                  <Link
                    href="/mesajlar"
                    prefetch={false}
                    onClick={kapat}
                    className={linkClassInlineBadge}
                  >
                    Mesajlar
                    {userId && <UnreadBadge userId={userId} />}
                  </Link>
                  <Link
                    href="/bildirimler"
                    prefetch={false}
                    onClick={kapat}
                    className={linkClassInlineBadge}
                  >
                    Bildirimler
                    {notificationCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1.5 bg-brand-ink text-paper text-[10px] font-mono font-bold italic rounded-full flex items-center justify-center leading-none">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                  </Link>
                  {baslatici.hesap.map((madde) => (
                    <Link
                      key={madde.href}
                      href={madde.href}
                      prefetch={false}
                      onClick={kapat}
                      className={linkClass}
                    >
                      {madde.etiket}
                    </Link>
                  ))}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      prefetch={false}
                      onClick={kapat}
                      className={linkClass}
                    >
                      Admin paneli
                    </Link>
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
                  {planlaDugmesi}
                  {discoveryItems}
                  {MARKETING_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      prefetch={false}
                      onClick={kapat}
                      className={linkClass}
                    >
                      {link.label}
                    </Link>
                  ))}

                  <div className="border-t border-line my-3" />

                  {hakkindaGrubu}

                  <div className="border-t border-line my-3" />

                  <div className="flex flex-col gap-3 pt-2">
                    <Link
                      href="/giris"
                      prefetch={false}
                      onClick={kapat}
                      className="px-4 py-3 border border-line text-ink rounded-lg font-display font-medium text-center hover:bg-line transition-colors"
                    >
                      Giriş yap
                    </Link>
                    <Link
                      href="/uye-ol"
                      prefetch={false}
                      onClick={kapat}
                      className="px-4 py-3 bg-brand-ink text-paper rounded-lg font-display font-semibold text-center hover:opacity-90 transition-opacity"
                    >
                      Üye ol
                    </Link>
                  </div>
                </>
              )}
            </nav>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
