"use client";

import { useState, useEffect } from "react";

// Skeleton'ların üstünde gösterilen, sırayla dönen eğlenceli yükleme mesajı.
// Halka/spinner yok — skeleton zaten "yükleniyor" hissini veriyor, sadece neşeli metin.
export function LoadingMessage({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setI((prev) => (prev + 1) % messages.length);
    }, 1400);
    return () => clearInterval(t);
  }, [messages.length]);

  return (
    <div className="flex items-center gap-2.5 mb-6" role="status" aria-live="polite">
      <span className="w-1.5 h-1.5 rounded-full bg-brand-ink kashe-pulse inline-block" />
      <p key={i} className="kashe-page-fade font-display italic text-brand-ink">
        {messages[i]}
      </p>
    </div>
  );
}
