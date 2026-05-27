"use client";

import { useEffect, useRef, useState } from "react";

type Stat = {
  key: string;
  target: number | null; // null → metin (sayaç yok)
  suffix?: string;
  text?: string; // target null ise gösterilecek metin
  label: string;
  color: string; // inline renk
  icon: React.ReactNode;
};

function useCountUp(target: number, run: boolean, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const start = performance.now();
    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setValue(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);
  return value;
}

function StatItem({ stat, run }: { stat: Stat; run: boolean }) {
  const counted = useCountUp(stat.target ?? 0, run && stat.target !== null);
  return (
    <div className="group bg-card border border-line rounded-2xl p-5 md:p-6 transition-all hover:-translate-y-0.5 hover:border-terracotta hover:shadow-[0_12px_30px_-14px_rgba(26,18,14,0.2)]">
      <div className="mb-3" style={{ color: stat.color }}>
        {stat.icon}
      </div>
      <p
        className="font-display font-light text-4xl md:text-5xl leading-none tracking-tight"
        style={{ color: stat.color }}
      >
        {stat.target !== null ? (
          <>
            {counted}
            {stat.suffix}
          </>
        ) : (
          <span className="text-3xl md:text-4xl">{stat.text}</span>
        )}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mt-2 flex items-center gap-1.5">
        {stat.key === "pro" && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 kashe-pulse inline-block" />
        )}
        {stat.label}
      </p>
    </div>
  );
}

export function HeroStats({
  proCount,
  categoryCount,
  cityCount,
}: {
  proCount: number;
  categoryCount: number;
  cityCount: number;
}) {
  const [run, setRun] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Mobilde direkt göster — observer mobilde takılabiliyor
    if (window.innerWidth < 768) {
      el.classList.add('kashe-revealed');
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRun(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const stats: Stat[] = [
    {
      key: "pro",
      target: proCount,
      suffix: "+",
      label: "Profesyonel",
      color: "var(--color-terracotta)",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M16 14.2c2.4 0.1 4.5 1.8 4.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: "cat",
      target: categoryCount,
      label: "Kategori",
      color: "#6B2E5C",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ),
    },
    {
      key: "city",
      target: cityCount,
      label: "Şehir",
      color: "#3F6B47",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ),
    },
    {
      key: "pay",
      target: null,
      text: "Güvenli",
      label: "Ödeme",
      color: "var(--color-ink)",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <div
      ref={ref}
      className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
    >
      {stats.map((s) => (
        <StatItem key={s.key} stat={s} run={run} />
      ))}
    </div>
  );
}
