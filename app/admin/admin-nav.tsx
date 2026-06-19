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
  { href: '/admin/sikayetler', label: 'Şikayetler' },
  { href: '/admin/blog', label: 'Blog' },
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

  // Sidebar içeriği (hem desktop hem mobil drawer kullanır)
  const navContent = (
    <>
      {/* Logo + admin badge */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-paper/10">
        <Link
          href="/admin"
          className="flex items-center gap-2.5"
          onClick={() => setMobileOpen(false)}
        >
          <span className="w-7 h-7 bg-terracotta flex items-center justify-center text-paper font-display font-semibold italic text-lg leading-none rounded">
            k
          </span>
          <span className="font-display font-semibold text-xl text-paper tracking-tight">
            Kashe
          </span>
        </Link>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-terracotta bg-terracotta/10 px-2 py-0.5 rounded-full border border-terracotta/30">
          Admin
        </span>
      </div>

      {/* Nav linkleri */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`block font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2.5 rounded-lg transition-colors ${
              isActive(item.href)
                ? 'bg-terracotta text-paper'
                : 'text-paper/65 hover:text-paper hover:bg-paper/5'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Alt — profil + siteye dön + çıkış */}
      <div className="border-t border-paper/10 px-3 py-4 space-y-1">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt={adminName}
              className="w-8 h-8 rounded-full object-cover border border-paper/20 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-xs shrink-0">
              {initials}
            </div>
          )}
          <span className="font-display text-sm text-paper truncate">
            {adminName}
          </span>
        </div>
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="block font-mono text-[10px] uppercase tracking-[0.14em] text-paper/55 hover:text-paper hover:bg-paper/5 px-3 py-2 rounded-lg transition-colors"
        >
          ← Siteye dön
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="block w-full text-left font-mono text-[10px] uppercase tracking-[0.14em] text-paper/55 hover:text-paper hover:bg-paper/5 px-3 py-2 rounded-lg transition-colors"
        >
          Çıkış yap
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* DESKTOP — sabit sol sidebar */}
      <aside className="hidden md:flex md:flex-col fixed top-0 left-0 h-screen w-60 bg-ink border-r border-paper/10 z-40">
        {navContent}
      </aside>

      {/* MOBİL — üst bar + hamburger */}
      <div className="md:hidden sticky top-0 z-40 bg-ink border-b border-paper/10 flex items-center justify-between px-5 py-3">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="w-7 h-7 bg-terracotta flex items-center justify-center text-paper font-display font-semibold italic text-lg leading-none rounded">
            k
          </span>
          <span className="font-display font-semibold text-xl text-paper tracking-tight">
            Kashe
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-terracotta bg-terracotta/10 px-2 py-0.5 rounded-full border border-terracotta/30">
            Admin
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 -mr-2 text-paper"
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

      {/* MOBİL — açılır drawer */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-ink/50 z-40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="md:hidden fixed top-0 left-0 h-screen w-64 bg-ink z-50 flex flex-col">
            {navContent}
          </aside>
        </>
      )}
    </>
  );
}
