'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Admin profil paneli — isim/e-posta araması.
 * Keşfet kalıbı: debounce + router.replace(scroll:false), URL param `q`.
 * Aktif sekme (durum) korunur; arama sayfayı 1'e döndürür (sayfa param'ı düşer).
 * Guard: query URL'deki değerle aynıysa (mount / sekme resync) push YOK.
 */
export function ProfilArama({
  initialQuery,
  durum,
}: {
  initialQuery: string;
  durum: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sekme değişince (dışarıdan URL değişimi) input'u senkronla
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    // URL'dekiyle aynıysa (mount veya sekme resync) hiçbir şey yapma
    if (query.trim() === initialQuery.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (durum !== 'pending') params.set('durum', durum);
      if (query.trim()) params.set('q', query.trim());
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, initialQuery, durum, pathname, router]);

  return (
    <div className="relative max-w-sm">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-72 pointer-events-none"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
      </svg>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="İsim veya e-posta ara…"
        className="w-full pl-9 pr-9 py-2.5 bg-card border border-line rounded-lg text-sm text-ink placeholder:text-ink-72/60 focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-72 hover:text-ink transition-colors"
          aria-label="Aramayı temizle"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {isPending && (
        <span className="absolute -bottom-5 left-0 text-[11px] text-ink-72">
          Aranıyor…
        </span>
      )}
    </div>
  );
}
