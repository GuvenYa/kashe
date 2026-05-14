import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';

export const metadata = {
  title: 'Sayfa bulunamadı — Kashe',
};

export default function NotFound() {
  return (
    <>
      <TopNav />
      <main className="min-h-[70vh] bg-paper px-6 md:px-12 py-16 flex items-center justify-center">
        <div className="max-w-md text-center">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-4">
            404
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight mb-4">
            Aradığın sayfa{' '}
            <em className="text-terracotta not-italic italic font-medium">
              bulunamadı
            </em>
            .
          </h1>
          <p className="text-ink-72 mb-8 leading-relaxed">
            Bu sayfa silinmiş, taşınmış veya adresini yanlış girmiş olabilirsin. Aşağıdaki bağlantılardan devam edebilirsin.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
            >
              Ana sayfaya dön
            </Link>
            <Link
              href="/kesfet"
              className="px-6 py-3 border border-ink text-ink rounded-lg font-display font-medium hover:bg-ink hover:text-paper transition-colors"
            >
              Profesyonelleri keşfet
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}