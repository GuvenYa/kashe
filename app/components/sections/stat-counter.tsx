'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Hero istatistik sayacı — viewport'a girince 0'dan hedefe ease-out sayar (~1.5sn).
 * "+" gibi ekler suffix ile sabit kalır. prefers-reduced-motion'da direkt hedef değer.
 * Sayı tr-TR binlik ayracıyla biçimlenir (12000 → "12.000").
 */
export function StatCounter({
  value,
  suffix = '',
  className,
  durationMs = 1500,
}: {
  value: number;
  suffix?: string;
  className?: string;
  durationMs?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || started.current) return;
        started.current = true;
        io.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
          setDisplay(Math.round(value * eased));
          if (t < 1) requestAnimationFrame(step);
          else setDisplay(value);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString('tr-TR')}
      {suffix}
    </span>
  );
}
