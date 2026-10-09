"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Hero'nun birincil aramasi Kashe AI (9 Ekim 2026): serbest metin sihirbaza
// tasinir; yapisal arama #hizmetler'de (QuickSearch). Kabuk QuickSearch ile
// AYNI (beyaz kart, sol etiket + girdi, sagda koyu dugme) — iki arama ayni
// gorsel dili konussun diye.

/** Top-nav'daki 4 kollu yildiz — Kashe AI isareti. */
function AiYildiz({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
    </svg>
  );
}

export function HeroAiSearch() {
  const router = useRouter();
  const [metin, setMetin] = useState("");

  function gonder(e: React.FormEvent) {
    e.preventDefault();
    const m = metin.trim();
    const p = new URLSearchParams();
    if (m) p.set("metin", m);
    // Sihirbazin analiz esigi 10 karakter; altinda otomatik baslatma istenmez.
    if (m.length >= 10) p.set("otomatik", "1");
    const qs = p.toString();
    router.push(qs ? `/etkinlik-sihirbazi?${qs}` : "/etkinlik-sihirbazi");
  }

  return (
    <form
      onSubmit={gonder}
      className="relative z-40 bg-card border border-line rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] p-2 flex flex-col md:flex-row md:items-stretch gap-1.5"
    >
      <div className="flex-1">
        <div className="px-4 py-2.5 rounded-xl hover:bg-paper-2/40 transition-colors h-full flex flex-col justify-center">
          <label
            htmlFor="hero-ai"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-ink mb-1 inline-flex items-center gap-1.5"
          >
            <AiYildiz size={14} />
            Kashe AI
          </label>
          <input
            id="hero-ai"
            type="text"
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            autoComplete="off"
            maxLength={400}
            placeholder="Etkinliğini anlat: tür, tarih, şehir, kişi sayısı…"
            className="w-full bg-transparent text-ink text-base placeholder:text-ink-32 focus:outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        className="shrink-0 bg-brand-ink text-white rounded-lg px-7 py-4 md:py-0 font-display font-semibold transition-all hover:bg-brand-ink-deep flex items-center justify-center gap-2"
      >
        <AiYildiz size={18} />
        Başlayalım →
      </button>
    </form>
  );
}
