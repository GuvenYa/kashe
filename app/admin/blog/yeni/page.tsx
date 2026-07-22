import Link from 'next/link';
import { BlogForm } from '../blog-form';

export const metadata = { title: 'Yeni yazı — Admin' };

export default function YeniBlogYazisiPage() {
  return (
    <div className="px-5 md:px-8 py-6 md:py-8">
      <Link
        href="/admin/blog"
        className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-brand-ink transition-colors inline-flex items-center gap-1.5 mb-5"
      >
        ← Blog
      </Link>
      <h1 className="font-display text-3xl text-ink tracking-tight mb-6">
        Yeni yazı
      </h1>
      <BlogForm />
    </div>
  );
}