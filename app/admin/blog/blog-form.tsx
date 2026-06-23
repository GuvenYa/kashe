'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '@/app/lib/supabase-browser';
import {
  createBlogPost,
  updateBlogPost,
  type BlogFormData,
} from './actions';
import type { BlogPost } from '@/app/lib/types';

type Props = {
  post?: BlogPost | null; // edit mode
};

const MAX_COVER_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function BlogForm({ post }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!post;

  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [coverUrl, setCoverUrl] = useState<string | null>(
    post?.cover_image_url ?? null
  );
  const [status, setStatus] = useState<'draft' | 'published'>(
    post?.status ?? 'draft'
  );

  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setError(null);

    if (!ALLOWED_COVER_TYPES.includes(file.type)) {
      setError('Kapak için JPG, PNG veya WebP yükleyebilirsin.');
      return;
    }
    if (file.size > MAX_COVER_SIZE) {
      setError("Kapak görseli 5 MB'dan büyük olamaz.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Oturum bulunamadı.');
        return;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('blog')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (upErr) {
        setError('Yükleme başarısız: ' + upErr.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('blog').getPublicUrl(path);

      setCoverUrl(publicUrl);
    } catch (err) {
      setError(
        'Bir hata oluştu: ' + (err instanceof Error ? err.message : 'bilinmeyen')
      );
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const data: BlogFormData = {
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim() || null,
      content,
      cover_image_url: coverUrl,
      status,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateBlogPost(post!.id, data)
        : await createBlogPost(data);

      if (result.success) {
        router.push('/admin/blog');
        router.refresh();
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  const inputClass =
    'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition';
  const labelClass =
    'block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Başlık */}
      <div>
        <label htmlFor="blog-title" className={labelClass}>
          Başlık <span className="text-danger">*</span>
        </label>
        <input
          id="blog-title"
          type="text"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          placeholder="Örn: Düğününüz için doğru DJ nasıl seçilir?"
        />
      </div>

      {/* Slug */}
      <div>
        <label htmlFor="blog-slug" className={labelClass}>
          URL (slug)
        </label>
        <input
          id="blog-slug"
          type="text"
          maxLength={80}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className={inputClass}
          placeholder="Boş bırak — başlıktan otomatik üretilir"
        />
        <p className="text-xs text-ink-72 mt-1.5">
          Adres: /blog/<span className="text-ink">{slug.trim() || '...'}</span>{' '}
          · Boş bırakırsan başlıktan üretilir.
        </p>
      </div>

      {/* Özet */}
      <div>
        <label htmlFor="blog-excerpt" className={labelClass}>
          Özet
        </label>
        <textarea
          id="blog-excerpt"
          rows={2}
          maxLength={500}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          className={`${inputClass} resize-none`}
          placeholder="Liste sayfasında ve önizlemede görünen kısa açıklama."
        />
        <p className="text-xs text-ink-72 mt-1.5">{excerpt.length}/500</p>
      </div>

      {/* Kapak görseli */}
      <div>
        <label className={labelClass}>Kapak görseli (opsiyonel)</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleCoverChange}
          className="hidden"
        />
        {coverUrl ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt="Kapak"
              className="w-full max-w-md rounded-lg border border-line object-cover"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-sm text-ink hover:text-terracotta transition-colors disabled:opacity-50"
              >
                {uploading ? 'Yükleniyor...' : 'Değiştir'}
              </button>
              <button
                type="button"
                onClick={() => setCoverUrl(null)}
                className="text-sm text-ink-72 hover:text-terracotta transition-colors"
              >
                Kaldır
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-line rounded-lg text-sm text-ink-72 hover:text-terracotta hover:border-terracotta transition-colors disabled:opacity-50"
          >
            {uploading ? 'Yükleniyor...' : '+ Kapak yükle'}
          </button>
        )}
        <p className="text-xs text-ink-72 mt-1.5">JPG, PNG, WebP · max 5 MB</p>
      </div>

      {/* İçerik — Yaz / Önizle sekmeli */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={`${labelClass} mb-0`}>
            İçerik (Markdown) <span className="text-danger">*</span>
          </label>
          <div className="flex gap-1 bg-paper-2/40 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setTab('write')}
              className={`px-3 py-1 rounded text-xs font-mono uppercase tracking-[0.12em] transition-colors ${
                tab === 'write'
                  ? 'bg-card text-ink shadow-sm'
                  : 'text-ink-72 hover:text-ink'
              }`}
            >
              Yaz
            </button>
            <button
              type="button"
              onClick={() => setTab('preview')}
              className={`px-3 py-1 rounded text-xs font-mono uppercase tracking-[0.12em] transition-colors ${
                tab === 'preview'
                  ? 'bg-card text-ink shadow-sm'
                  : 'text-ink-72 hover:text-ink'
              }`}
            >
              Önizle
            </button>
          </div>
        </div>

        {tab === 'write' ? (
          <textarea
            id="blog-content"
            rows={18}
            maxLength={100000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`${inputClass} resize-y font-mono text-sm leading-relaxed`}
            placeholder={'# Başlık\n\nParagraf metni. **Kalın**, *italik*, [link](https://...).\n\n- Madde 1\n- Madde 2'}
          />
        ) : (
          <div className="min-h-[200px] px-5 py-4 bg-card border border-line rounded-lg">
            {content.trim() ? (
              <div className="kashe-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-ink-72 text-sm">
                Önizlemek için içerik yaz.
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-ink-72 mt-1.5">
          Markdown desteklenir: başlık (#), kalın (**), liste (-), link, tablo.
        </p>
      </div>

      {/* Durum */}
      <div>
        <label className={labelClass}>Durum</label>
        <div className="flex gap-3">
          {[
            { key: 'draft', label: 'Taslak' },
            { key: 'published', label: 'Yayında' },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setStatus(opt.key as 'draft' | 'published')}
              className={`px-4 py-2 rounded-lg text-sm font-display font-medium border transition-colors ${
                status === opt.key
                  ? 'bg-terracotta text-paper border-terracotta'
                  : 'bg-card text-ink-72 border-line hover:border-ink-72'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-72 mt-1.5">
          Taslak yalnızca adminlere görünür. Yayında olan herkese açıktır.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 bg-danger-08 border border-danger/30 rounded-lg text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-line">
        <button
          type="submit"
          disabled={isPending || uploading}
          className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPending
            ? 'Kaydediliyor...'
            : isEdit
              ? 'Değişiklikleri kaydet'
              : 'Yazıyı oluştur'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/blog')}
          disabled={isPending}
          className="px-5 py-2.5 text-ink-72 hover:text-ink font-display font-medium transition-colors disabled:opacity-50"
        >
          İptal
        </button>
      </div>
    </form>
  );
}