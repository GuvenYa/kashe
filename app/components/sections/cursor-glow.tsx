'use client';

import { useState, useRef, useEffect } from 'react';

// Hero içinde fareyi takip eden çok hafif brand-ink glow.
// Abartısız: sadece sezilen bir sıcaklık. Fare hero dışına çıkınca solar.
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;

    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setVisible(true);
    }
    function onLeave() {
      setVisible(false);
    }

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="absolute inset-0 pointer-events-none hidden lg:block transition-opacity duration-500 z-0"
      style={{
        opacity: visible ? 1 : 0,
        background: `radial-gradient(420px circle at ${pos.x}px ${pos.y}px, rgba(200,68,42,0.14), transparent 70%)`,
      }}
    />
  );
}
