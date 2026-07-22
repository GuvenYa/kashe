"use client";

import { useState, useEffect } from "react";

// Eğlence sektörüne özgü, sırayla dönen yükleme mesajları.
const MESSAGES = [
  "Sahne hazırlanıyor...",
  "Yetenekler toplanıyor...",
  "Perde açılıyor...",
  "Spot ışıkları yanıyor...",
  "Backstage düzenleniyor...",
  "Mikrofon test ediliyor...",
];

export function Loading({
  messages = MESSAGES,
  className = "",
}: {
  messages?: string[];
  className?: string;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setI((prev) => (prev + 1) % messages.length);
    }, 1400);
    return () => clearInterval(t);
  }, [messages.length]);

  return (
    <div
      className={`flex flex-col items-center justify-center py-16 ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Dönen brand-ink halka */}
      <div className="relative w-12 h-12 mb-5">
        <div className="absolute inset-0 rounded-full border-2 border-brand-ink-12" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-ink kashe-spin" />
      </div>
      {/* Dönen mesaj */}
      <p
        key={i}
        className="kashe-page-fade font-display italic text-lg text-ink-72"
      >
        {messages[i]}
      </p>
    </div>
  );
}
