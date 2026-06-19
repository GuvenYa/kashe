'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  markReportReviewing,
  resolveReport,
  dismissReport,
} from './actions';
import type { ReportStatus } from '@/app/lib/types';

type Props = {
  reportId: string;
  status: ReportStatus;
};

export function SikayetAksiyonlari({ reportId, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Hangi aksiyon için not giriliyor: 'resolve' | 'dismiss' | null
  const [noteMode, setNoteMode] = useState<'resolve' | 'dismiss' | null>(null);
  const [note, setNote] = useState('');

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.success) {
        setError(r.error || 'Hata');
      } else {
        setNoteMode(null);
        setNote('');
        router.refresh();
      }
    });
  }

  // Çözüldü/reddedildi durumunda aksiyon yok (sadece bilgi)
  const isClosed = status === 'resolved' || status === 'dismissed';

  if (isClosed) {
    return (
      <p className="text-xs font-mono uppercase tracking-[0.14em] text-ink-50">
        {status === 'resolved' ? 'Çözüldü' : 'Reddedildi'} — işlem tamamlandı
      </p>
    );
  }

  return (
    <div>
      {noteMode ? (
        <div className="space-y-2">
          <textarea
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition resize-none"
            placeholder={
              noteMode === 'resolve'
                ? 'Çözüm notu (opsiyonel) — ne yapıldı?'
                : 'Red notu (opsiyonel) — neden geçersiz?'
            }
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                run(() =>
                  noteMode === 'resolve'
                    ? resolveReport(reportId, note)
                    : dismissReport(reportId, note)
                )
              }
              disabled={isPending}
              className={`kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border text-paper transition disabled:opacity-50 ${
                noteMode === 'resolve'
                  ? 'bg-moss border-moss'
                  : 'bg-ink-72 border-ink-72'
              }`}
            >
              {isPending
                ? '...'
                : noteMode === 'resolve'
                  ? 'Çözüldü olarak işaretle'
                  : 'Reddet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setNoteMode(null);
                setNote('');
                setError(null);
              }}
              disabled={isPending}
              className="kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-[0.14em] text-ink-50 hover:text-ink transition disabled:opacity-50"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {status === 'pending' && (
            <button
              type="button"
              onClick={() => run(() => markReportReviewing(reportId))}
              disabled={isPending}
              className="kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border border-line text-ink-72 hover:border-ink hover:text-ink transition disabled:opacity-50"
            >
              İncelemeye al
            </button>
          )}
          <button
            type="button"
            onClick={() => setNoteMode('resolve')}
            disabled={isPending}
            className="kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border border-line text-ink-72 hover:border-moss hover:text-moss transition disabled:opacity-50"
          >
            Çözüldü
          </button>
          <button
            type="button"
            onClick={() => setNoteMode('dismiss')}
            disabled={isPending}
            className="kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border border-line text-ink-72 hover:border-ink hover:text-ink transition disabled:opacity-50"
          >
            Reddet
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-terracotta mt-2 bg-terracotta/8 border border-terracotta/20 rounded-lg p-2">
          {error}
        </p>
      )}
    </div>
  );
}