import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { TopNav } from '@/app/components/sections/top-nav';
import { EmptyState } from '@/app/components/EmptyState';
import { Newspaper } from 'lucide-react';
import type { BlogPost } from '@/app/lib/types';

export const metadata = {
  title: 'Blog — Kashe',
  description:
    'Etkinlik, eğlence ve organizasyon dünyasından rehberler, ipuçları ve haberler.',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function BlogPage() {
  const supabase = await createClient();

  const { data: postsData } = await supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, cover_image_url, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  const posts = (postsData || []) as BlogPost[];

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper">
        <section className="border-b border-line bg-card relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-24 -right-24 w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(31,92,74,0.10) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />
          <div className="max-w-5xl mx-auto px-6 md:px-12 py-14 md:py-20 relative">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-3">
              Blog
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
              Etkinlik dünyasından <em>rehberler ve ipuçları</em>
            </h1>
            <p className="text-ink-72 text-lg mt-4 max-w-2xl leading-relaxed">
              Doğru profesyoneli seçmekten etkinlik planlamaya — bilmen
              gerekenler burada.
            </p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 md:px-12 py-12">
          {posts.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="Henüz yazı yok"
              description="Çok yakında bu alanda etkinlik ve organizasyon rehberleri paylaşacağız."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col bg-card border border-line rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-terracotta hover:shadow-[0_12px_28px_-14px_rgba(26,18,14,0.20)]"
                >
                  <div className="aspect-[16/10] bg-paper-2 overflow-hidden">
                    {post.cover_image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-brand opacity-[0.08]">
                        <span className="font-display text-4xl text-ink">k</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col flex-1 p-5">
                    {post.published_at && (
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-2">
                        {formatDate(post.published_at)}
                      </p>
                    )}
                    <h2 className="font-display text-xl text-ink leading-tight group-hover:text-terracotta transition-colors">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-ink-72 mt-2 leading-relaxed line-clamp-3">
                        {post.excerpt}
                      </p>
                    )}
                    <span className="mt-auto pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                      Oku
                      <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}