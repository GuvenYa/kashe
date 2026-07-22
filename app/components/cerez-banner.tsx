'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Kashe çerez banner'ı.
 *
 * Yaklaşım: Sadece "zorunlu çerezler" kullanıldığını bildiren,
 * kabul-only bir banner. KVKK ve Türkiye uygulaması için yeterli;
 * şu an pazarlama/analitik çerezi kullanmadığımız için kullanıcıya
 * çoklu seçenek sunmaya gerek yok. (Analitik araç eklendiğinde
 * banner reddet/kabul'a evrilir.)
 *
 * Kararı localStorage'da saklar; sonraki ziyaretlerde gösterilmez.
 * SSR uyumlu: client-side mount sonrası kontrol eder.
 */

const STORAGE_KEY = 'kashe_cookie_consent_v1';

export function CerezBanner() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // localStorage'a güvenli erişim (private mode'da hata verebilir)
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setVisible(true);
      }
    } catch {
      // localStorage erişilemiyorsa banner göster, kullanıcı kabul edince
      // sessiz fail (sayfa başına banner görünür ama işlevsel kayıp yok)
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accepted: true,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!mounted || !visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cerez-banner-title"
      aria-describedby="cerez-banner-description"
      className="fixed inset-x-0 bottom-0 z-[90] p-4 md:p-6 pointer-events-none"
    >
      <div className="max-w-4xl mx-auto bg-card border border-line rounded-2xl shadow-[0_18px_40px_-16px_rgba(26,18,14,0.22)] p-5 md:p-6 pointer-events-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
          <div className="flex-1 min-w-0">
            <p
              id="cerez-banner-title"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-ink mb-1.5"
            >
              Çerez bildirimi
            </p>
            <p
              id="cerez-banner-description"
              className="text-[14px] text-ink-72 leading-relaxed"
            >
              Kashe; oturum yönetimi ve güvenlik için zorunlu çerezler
              kullanır. Pazarlama veya reklam çerezi kullanmıyoruz.{' '}
              <Link
                href="/gizlilik"
                className="text-brand-ink hover:underline"
              >
                Gizlilik Politikası
              </Link>
              .
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={handleAccept}
              className="kashe-tap flex-1 md:flex-none px-5 py-2.5 bg-ink text-paper rounded-xl font-display font-semibold text-sm hover:bg-ink/85 transition shadow-[3px_3px_0_rgba(26,18,14,0.12)]"
            >
              Anladım
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
