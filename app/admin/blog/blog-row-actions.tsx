'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleBlogStatus, deleteBlogPost } from './actions';

type Props = {
  postId: string;
  slug: string;
  status: 'draft' | 'published';
};

export function BlogRowActions({ postId, slug, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleBlogStatus(postId, status !== 'published');
      if (!result.success) setError(result.error || 'Hata');
      else router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm('Bu yazıyı kalıcı olarak silmek istediğine emin misin?'))
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteBlogPost(postId);
      if (!result.success) setError(result.error || 'Hata');
      else router.refresh();
    });
  }

  return (
    <div className="shrink-0 flex items-center gap-1">
      {status === 'published' && (
        <a
          href={`/blog/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-ink-72 hover:text-terracotta px-2 py-1 transition-colors"
          title="Yayındaki yazıyı gör"
        >
          Gör
        </a>
      )}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className="text-sm text-ink-72 hover:text-ink px-2 py-1 transition-colors disabled:opacity-50"
      >
        {status === 'published' ? 'Taslağa al' : 'Yayınla'}
      </button>
      <Link
        href={`/admin/blog/${postId}`}
        className="text-sm text-ink hover:text-terracotta px-2 py-1 transition-colors"
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