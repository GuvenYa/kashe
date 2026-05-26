'use client';

import { useEffect, useRef } from 'react';

// Scroll-reveal sarmalayıcı: görünür olunca içeriği yumuşakça belirtir.
// Kullanım: <Reveal><Bölüm/></Reveal>  ya da  <Reveal delay={120}>...</Reveal>
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add('kashe-revealed'), delay);
          obs.disconnect();
        }
      },
      { threshold: 0, rootMargin: '0px 0px -120px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`kashe-reveal ${className}`}>
      {children}
    </div>
  );
}
