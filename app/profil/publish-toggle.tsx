'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { togglePublish } from './duzenle/actions';

type Props = {
  isPublished: boolean;
  canPublish: boolean;
  missingFields: string[];
};

export function PublishToggle({ isPublished, canPublish, missingFields }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await togglePublish(!isPublished);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  return (
    <div
      className={`rounded-lg border p-6 ${
        isPublished
          ? 'bg-green-50 border-green-300'
          : 'bg-terracotta/8 border-terracotta/20'
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p
            className={`font-mono text-xs uppercase tracking-[0.16em] mb-2 ${
              isPublished ? 'text-green-700' : 'text-terracotta'
            }`}
          >
            {isPublished ? 'Profilin yayında' : 'Profilin yayında değil'}
          </p>
          <p className="text-ink-72 text-sm">
            {isPublished
              ? 'Profilin keşfet sayfasında görünür. Müşteriler seni bulabilir.'
              : canPublish
              ? 'Yayınla butonuna basınca profilin keşfet sayfasında görünür.'
              : 'Yayınlamak için profilini tamamlaman gerekiyor.'}
          </p>

          {!canPublish && missingFields.length > 0 && (
            <ul className="mt-3 space-y-1">
              {missingFields.map((field) => (
                <li
                  key={field}
                  className="text-sm text-terracotta flex items-center gap-2"
                >
                  <span className="w-1 h-1 rounded-full bg-terracotta" />
                  {field}
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="mt-3 text-sm text-terracotta">{error}</p>
          )}
        </div>

        <button
          onClick={handleToggle}
          disabled={isPending || (!isPublished && !canPublish)}
          className={`shrink-0 px-5 py-2.5 rounded-lg font-display font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isPublished
              ? 'border border-ink text-ink hover:bg-ink hover:text-paper'
              : 'bg-terracotta text-paper hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)]'
          }`}
        >
          {isPending
            ? 'İşleniyor...'
            : isPublished
            ? 'Yayından kaldır'
            : 'Yayınla'}
        </button>
      </div>
    </div>
  );
}