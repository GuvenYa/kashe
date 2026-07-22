import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '@/app/lib/supabase-server';
import { TopNav } from '@/app/components/sections/top-nav';
import type { BlogPost } from '@/app/lib/types';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

async function getPost(slug: string): Promise<BlogPost | null> {
  const supabase = await createClient();
  // RLS published-only; ekstra .eq('status','published') savunma amaçlı
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  return (data as BlogPost) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: 'Yazı bulunamadı — Kashe' };

  return {
    title: `${post.title} — Kashe Blog`,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
      type: 'article',
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.cover_image_url ?? undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at,
  };

  return (
    <>
      <TopNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-paper">
        <article className="max-w-3xl mx-auto px-6 md:px-12 py-12 md:py-16">
          <Link
            href="/blog"
            className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-brand-ink transition-colors inline-flex items-center gap-1.5 mb-8"
          >
            ← Tüm yazılar
          </Link>

          {post.published_at && (
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-ink mb-3">
              {formatDate(post.published_at)}
            </p>
          )}

          <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight leading-[1.08] mb-6">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-lg text-ink-72 leading-relaxed mb-8">
              {post.excerpt}
            </p>
          )}

          {post.cover_image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full rounded-2xl border border-line mb-10 object-cover"
            />
          )}

          <div className="kashe-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </div>

          {/* Alt CTA */}
          <div className="mt-14 pt-8 border-t border-line text-center">
            <p className="font-display text-2xl text-ink mb-2">
              Etkinliğin için <em>doğru profesyoneli</em> bul
            </p>
            <p className="text-ink-72 mb-5">
              Yüzlerce doğrulanmış profesyonel Kashe&apos;de.
            </p>
            <Link
              href="/kesfet"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
            >
              Keşfet&apos;e git
            </Link>
          </div>
        </article>
      </main>
    </>
  );
}