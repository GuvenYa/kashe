'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-browser';
import type { PanelMenuMaddesi } from '@/app/lib/panel-menu-tipler';

/**
 * AVATAR MENUSU — kisa BASLATICI (Duzeltme 02).
 *
 * Eskiden panel yan menusunun tum maddeleri duz listeye dokuluyordu (ajans
 * sahibinde 16 satir + Admin + Cikis). Artik yalniz: ad + rol satiri, "Panel"
 * + en cok kullanilan maddeler, hesap satirlari, (yonetici ise) Admin paneli,
 * Cikis. Gerisi panel yan menusunde durur.
 *
 * SATIR SINIRI 8 (tiklanabilir satir; baslik haric). Oncelikli maddeler
 * modelde dortle sinirli oldugu icin ust sinir 1 + 4 + 3 + 1 + 1 = 10 olabilir;
 * asilirsa hesaptan "Profili duzenle" dusurulur (profesyonelde o yuzey "Profil
 * icerigi" olarak yan menude zaten var).
 */
const SATIR_SINIRI = 8;

export function UserMenu({
  initials,
  avatarUrl,
  baslik,
  panel,
  oncelikli,
  hesap,
  isAdmin = false,
}: {
  initials: string;
  avatarUrl: string | null;
  /** Ust blok: ad ve rol satiri. */
  baslik: { ad: string; rol: string };
  panel: PanelMenuMaddesi | null;
  oncelikli: PanelMenuMaddesi[];
  hesap: PanelMenuMaddesi[];
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ilkMadde = useRef<HTMLAnchorElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Escape kapatir; acilista odak ilk maddeye gecer.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    ilkMadde.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push('/');
    router.refresh();
  }

  // Satir sayisi: Panel + oncelikli + hesap + (Admin) + Cikis.
  const panelSatiri = panel ? 1 : 0;
  const toplam =
    panelSatiri + oncelikli.length + hesap.length + (isAdmin ? 1 : 0) + 1;
  const hesapSatirlari =
    toplam > SATIR_SINIRI
      ? hesap.filter((m) => m.href !== '/profil/duzenle')
      : hesap;

  const MADDE =
    'block px-4 py-2.5 text-sm font-body text-ink hover:bg-brand-ink-08 hover:text-brand-ink transition-colors';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 group"
        aria-label="Hesap menüsü"
        aria-expanded={open}
      >
        {avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={avatarUrl}
            alt=""
            className="w-9 h-9 rounded-full object-cover border border-line group-hover:border-brand-ink transition-colors"
          />
        ) : (
          <span className="w-9 h-9 rounded-full bg-brand-ink text-paper font-display font-semibold text-sm flex items-center justify-center group-hover:bg-brand-ink-deep transition-colors">
            {initials}
          </span>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`text-ink-50 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Hesap menüsü"
          className="absolute right-0 mt-2 w-64 bg-card border border-line rounded-xl shadow-[0_12px_40px_-12px_rgba(26,18,14,0.22)] overflow-hidden py-1.5 z-50"
        >
          {/* Kim olarak gezdigini soyler: ad + rol (kurulus uyeligi dahil). */}
          <div className="px-4 py-2.5">
            <p className="font-display font-semibold text-sm text-ink truncate">
              {baslik.ad}
            </p>
            <p className="text-xs text-ink-50 truncate">{baslik.rol}</p>
          </div>

          <div className="border-t border-line my-1.5" />

          {panel && (
            <a
              ref={ilkMadde}
              role="menuitem"
              href={panel.href}
              className={MADDE}
            >
              Panel
            </a>
          )}
          {oncelikli.map((madde) => (
            <a
              key={madde.href}
              role="menuitem"
              href={madde.href}
              className={MADDE}
            >
              {madde.etiket}
            </a>
          ))}

          {hesapSatirlari.length > 0 && (
            <>
              <div className="border-t border-line my-1.5" />
              {hesapSatirlari.map((madde) => (
                <a
                  key={madde.href}
                  role="menuitem"
                  href={madde.href}
                  className={MADDE}
                >
                  {madde.etiket}
                </a>
              ))}
            </>
          )}

          {isAdmin && (
            <>
              <div className="border-t border-line my-1.5" />
              <a role="menuitem" href="/admin" className={MADDE}>
                Admin paneli
              </a>
            </>
          )}

          <div className="border-t border-line my-1.5" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="w-full text-left px-4 py-2.5 text-sm font-body text-ink-72 hover:bg-brand-ink-08 hover:text-brand-ink transition-colors"
          >
            Çıkış yap
          </button>
        </div>
      )}
    </div>
  );
}
