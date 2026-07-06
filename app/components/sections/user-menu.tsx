'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-browser';

type MenuLink = { href: string; label: string };

export function UserMenu({
  initials,
  avatarUrl,
  links,
  isAdmin = false,
}: {
  initials: string;
  avatarUrl: string | null;
  links: MenuLink[];
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push('/');
    router.refresh();
  }

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
            className="w-9 h-9 rounded-full object-cover border border-line group-hover:border-terracotta transition-colors"
          />
        ) : (
          <span className="w-9 h-9 rounded-full bg-terracotta text-paper font-display font-semibold text-sm flex items-center justify-center group-hover:bg-ember transition-colors">
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
        <div className="absolute right-0 mt-2 w-56 bg-card border border-line rounded-xl shadow-[0_12px_40px_-12px_rgba(26,18,14,0.22)] overflow-hidden py-1.5 z-50">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block px-4 py-2.5 text-sm font-body text-ink hover:bg-terracotta-08 hover:text-terracotta transition-colors"
            >
              {link.label}
            </a>
          ))}
          {isAdmin && (
            <>
              <div className="border-t border-line my-1.5" />
              <a
                href="/admin"
                className="block px-4 py-2.5 text-sm font-body text-ink hover:bg-terracotta-08 hover:text-terracotta transition-colors"
              >
                Admin Paneli
              </a>
            </>
          )}
          <div className="border-t border-line my-1.5" />
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-4 py-2.5 text-sm font-body text-ink-72 hover:bg-terracotta-08 hover:text-terracotta transition-colors"
          >
            Çıkış yap
          </button>
        </div>
      )}
    </div>
  );
}
