import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { BlogForm } from '../blog-form';
import type { BlogPost } from '@/app/lib/types';

export const metadata = { title: 'Yazıyı düzenle — Admin' };

export default async function BlogDuzenlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .single();

  if (!data) notFound();

  const post = data as BlogPost;

  return (
    <div className="px-5 md:px-8 py-6 md:py-8">
      <Link
        href="/admin/blog"
        className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-brand-ink transition-colors inline-flex items-center gap-1.5 mb-5"
      >
        ← Blog
      </Link>
      <h1 className="font-display text-3xl text-ink tracking-tight mb-6">
        Yazıyı düzenle
      </h1>
      <BlogForm post={post} />
    </div>
  );
}