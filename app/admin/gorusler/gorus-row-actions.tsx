'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleTestimonialPublish, deleteTestimonial } from './actions';

type Props = {
  id: string;
  isPublished: boolean;
};

export function GorusRowActions({ id, isPublished }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleTestimonialPublish(id, !isPublished);
      if (!result.success) setError(result.error || 'Hata');
      else router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm('Bu görüşü kalıcı olarak silmek istediğine emin misin?'))
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteTestimonial(id);
      if (!result.success) setError(result.error || 'Hata');
      else router.refresh();
    });
  }

  return (
    <div className="shrink-0 flex items-center gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className="text-sm text-ink-72 hover:text-ink px-2 py-1 transition-colors disabled:opacity-50"
      >
        {isPublished ? 'Taslağa al' : 'Yayınla'}
      </button>
      <Link
        href={`/admin/gorusler/${id}`}
        className="text-sm text-ink hover:text-brand-ink px-2 py-1 transition-colors"
      >
        Düzenle
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-sm text-ink-72 hover:text-danger px-2 py-1 transition-colors disabled:opacity-50"
      >
        Sil
      </button>
      {error && <span className="text-xs text-danger ml-1">{error}</span>}
    </div>
  );
}
