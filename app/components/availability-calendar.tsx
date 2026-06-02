'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { blockDate, unblockDate } from '@/app/takvimim/availability-actions';

type Props = {
  /** Manuel bloklu günler: ["2026-06-14", ...] */
  blockedDates: string[];
  /** Onaylı booking günleri (otomatik dolu, kaldırılamaz): ["2026-06-20", ...] */
  bookedDates: string[];
  /** true → profesyonel yönetir (tıkla-blokla); false → salt görüntüleme (müşteri) */
  editable: boolean;
};

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

// Date → "YYYY-MM-DD" (yerel, UTC kaymasız)
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function AvailabilityCalendar({
  blockedDates,
  bookedDates,
  editable,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Görüntülenen ay (bugünün ayıyla başla)
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-11

  const blockedSet = new Set(blockedDates);
  const bookedSet = new Set(bookedDates);

  const todayStr = toDateStr(new Date());

  // Ayın günlerini hesapla
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  // Pazartesi=0 olacak şekilde başlangıç ofseti (JS: Pazar=0)
  const startOffset = (firstDay.getDay() + 6) % 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewYear, viewMonth, d));
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleDayClick(dateStr: string, isBooked: boolean, isPast: boolean) {
    if (!editable || isBooked || isPast || isPending) return;
    setError(null);
    const isBlocked = blockedSet.has(dateStr);
    startTransition(async () => {
      const result = isBlocked
        ? await unblockDate(dateStr)
        : await blockDate(dateStr);
      if (!result.success) {
        setError(result.error || 'Hata');
      } else {
        router.refresh();
      }
    });
  }

  // Geçmiş ay'a gidişi engelle (yönetimde anlamsız, görüntülemede de gereksiz)
  const viewingPastMonth =
    viewYear < now.getFullYear() ||
    (viewYear === now.getFullYear() && viewMonth < now.getMonth());

  return (
    <div className="bg-white border border-line rounded-2xl p-5 md:p-6 max-w-md">
      {/* Ay navigasyonu */}
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={prevMonth}
          disabled={viewingPastMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-line text-ink-72 hover:text-ink hover:border-ink-72 transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Önceki ay"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="font-display text-lg text-ink">
          {MONTHS_TR[viewMonth]} {viewYear}
        </p>
        <button
          type="button"
          onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-line text-ink-72 hover:text-ink hover:border-ink-72 transition"
          aria-label="Sonraki ay"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Gün başlıkları */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS_TR.map((d) => (
          <div
            key={d}
            className="text-center font-mono text-[10px] uppercase tracking-[0.08em] text-ink-72/70"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Gün hücreleri */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const dateStr = toDateStr(date);
          const isBooked = bookedSet.has(dateStr);
          const isBlocked = blockedSet.has(dateStr);
          const isPast = dateStr < todayStr;
          const isToday = dateStr === todayStr;
          const isFull = isBooked || isBlocked;

          // Görsel sınıflar
          let cls = 'relative h-10 w-full flex items-center justify-center rounded-lg text-sm transition';
          if (isPast) {
            cls += ' text-ink-72/30';
          } else if (isBooked) {
            // Rezervasyon — gri/kilitli (kaldırılamaz)
            cls += ' bg-ink-72/10 text-ink-72 font-medium';
          } else if (isBlocked) {
            // Manuel dolu — terracotta
            cls += ' bg-terracotta/12 text-terracotta font-medium';
          } else {
            cls += ' text-ink';
            if (editable) cls += ' hover:bg-moss/10 cursor-pointer';
          }
          if (isToday) cls += ' ring-1 ring-inset ring-ink-72/40';

          const clickable = editable && !isBooked && !isPast;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => handleDayClick(dateStr, isBooked, isPast)}
              disabled={!clickable}
              className={cls}
              title={
                isBooked
                  ? 'Rezervasyon var'
                  : isBlocked
                    ? 'Dolu (işaretledin)'
                    : editable && !isPast
                      ? 'Müsait — dolu işaretlemek için tıkla'
                      : undefined
              }
            >
              {date.getDate()}
              {isFull && !isPast && (
                <span
                  className={`absolute bottom-1 w-1 h-1 rounded-full ${
                    isBooked ? 'bg-ink-72' : 'bg-terracotta'
                  }`}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Açıklama (legend) */}
      <div className="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t border-line">
        <span className="flex items-center gap-1.5 text-xs text-ink-72">
          <span className="w-3 h-3 rounded bg-terracotta/12 border border-terracotta/30" />
          Dolu (sen)
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-72">
          <span className="w-3 h-3 rounded bg-ink-72/10 border border-ink-72/20" />
          Rezervasyon
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-72">
          <span className="w-3 h-3 rounded border border-line" />
          Müsait
        </span>
      </div>

      {editable && (
        <p className="text-xs text-ink-72 mt-3">
          Bir güne tıklayarak &quot;dolu&quot; işaretle. Rezervasyonlu günler
          otomatik dolu görünür, kaldırılamaz.
        </p>
      )}

      {error && <p className="text-sm text-terracotta mt-3">{error}</p>}
    </div>
  );
}
