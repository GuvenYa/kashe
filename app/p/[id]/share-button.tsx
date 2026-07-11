'use client';

import { useState } from 'react';

/**
 * Paylaş — navigator.share (mobil) varsa native, yoksa panoya kopyala + toast.
 * Profil rail'indeki ikon sırasında kullanılır (dikey ikon + etiket).
 */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* kullanıcı iptal etti */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* pano erişimi yok */
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-ink-72 hover:text-terracotta hover:bg-terracotta/5 transition-colors"
      aria-label="Paylaş"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" />
      </svg>
      <span className="text-[10.5px]">{copied ? 'Kopyalandı' : 'Paylaş'}</span>
    </button>
  );
}
