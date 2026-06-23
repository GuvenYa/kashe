import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { BlogRowActions } from './blog-row-actions';
import type { BlogPost } from '@/app/lib/types';

export const metadata = { title: 'Blog — Admin' };

export default async function AdminBlogPage() {
  const supabase = await createClient();

  // RLS admin'e taslak dahil her şeyi gösterir (blog_admin_read policy)
  const { data: postsData } = await supabase
    .from('blog_posts')
    .select(
      'id, slug, title, excerpt, status, published_at, created_at, updated_at, cover_image_url'
    )
    .order('updated_at', { ascending: false });

  const posts = (postsData || []) as BlogPost[];

  const published = posts.filter((p) => p.status === 'published').length;
  const drafts = posts.length - published;

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-3xl text-ink tracking-tight">Blog</h1>
          <p className="text-sm text-ink-72 mt-1">
            {posts.length} yazı · {published} yayında · {drafts} taslak
          </p>
        </div>
        <Link
          href="/admin/blog/yeni"
          className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
        >
          + Yeni yazı
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="bg-card border border-line rounded-lg p-12 text-center">
          <p className="font-display text-lg text-ink mb-2">Henüz yazı yok</p>
          <p className="text-sm text-ink-72 mb-5">
            İlk blog yazını oluştur — yayınlanınca /blog sayfasında görünür.
          </p>
          <Link
            href="/admin/blog/yeni"
            className="inline-block px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            + Yeni yazı
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-card border border-line rounded-lg p-4 flex items-center gap-4"
            >
              {/* Kapak küçük önizleme */}
              <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-paper-2 border border-line flex items-center justify-center">
                {post.cover_image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={post.cover_image_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-32">
                    Kapaksız
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`font-mono text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded border ${
                      post.status === 'published'
                        ? 'text-moss bg-moss/10 border-moss/30'
                        : 'text-ink-72 bg-ink-72/10 border-ink-72/20'
                    }`}
                  >
                    {post.status === 'published' ? 'Yayında' : 'Taslak'}
                  </span>
                  <span className="font-mono text-[10px] text-ink-32 truncate">
                    /blog/{post.slug}
                  </span>
                </div>
                <h3 className="font-display text-lg text-ink truncate">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="text-sm text-ink-72 truncate">{post.excerpt}</p>
                )}
              </div>

              <BlogRowActions
                postId={post.id}
                slug={post.slug}
                status={post.status}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}