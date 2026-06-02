'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/app/lib/supabase-browser';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/profiller', label: 'Profiller' },
  { href: '/admin/ilanlar', label: 'İlanlar' },
  { href: '/admin/kullanicilar', label: 'Kullanıcılar' },
  { href: '/admin/kategori-talepleri', label: 'Kategori Talepleri' },
  { href: '/admin/yorumlar', label: 'Yorumlar' },
  { href: '/admin/istatistikler', label: 'İstatistikler' },
];

export function AdminNav({
  adminName,
  avatarUrl,
}: {
  adminName: string;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = adminName
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  }

  return (
    <nav className="w-full border-b border-line bg-ink text-paper sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-3 flex items-center justify-between gap-6">
        {/* Logo + admin badge */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="w-7 h-7 bg-terracotta flex items-center justify-center text-paper font-display font-semibold italic text-lg leading-none rounded">
              k
            </span>
            <span className="font-display font-semibold text-xl text-paper tracking-tight">
              Kashe
            </span>
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta bg-terracotta/10 px-2 py-1 rounded-full border border-terracotta/30">
            Admin
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2 rounded transition-colors ${
                isActive(item.href)
                  ? 'bg-terracotta text-paper'
                  : 'text-paper/70 hover:text-paper hover:bg-paper/5'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Sağ — admin profil + çıkış */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/60 hover:text-paper transition-colors"
          >
            ← Siteye dön
          </Link>
          <div className="flex items-center gap-2">
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrl}
                alt={adminName}
                className="w-7 h-7 rounded-full object-cover border border-paper/20"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-xs">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/60 hover:text-paper transition-colors"
            >
              Çıkış
            </button>
          </div>
        </div>

        {/* Mobil hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 -mr-2 text-paper"
          aria-label="Menü"
        >
          {mobileOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobil menü */}
      {mobileOpen && (
        <div className="md:hidden border-t border-paper/10 bg-ink">
          <div className="px-6 py-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`block font-mono text-xs uppercase tracking-[0.14em] px-3 py-2.5 rounded transition-colors ${
                  isActive(item.href)
                    ? 'bg-terracotta text-paper'
                    : 'text-paper/70 hover:text-paper hover:bg-paper/5'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t border-paper/10 my-2" />
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="block font-mono text-xs uppercase tracking-[0.14em] px-3 py-2.5 text-paper/60 hover:text-paper transition-colors"
            >
              ← Siteye dön
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="block w-full text-left font-mono text-xs uppercase tracking-[0.14em] px-3 py-2.5 text-paper/60 hover:text-paper transition-colors"
            >
              Çıkış yap
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
