import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminUser } from '@/app/lib/admin';

export const metadata = {
  title: 'Admin — Kashe',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin } = await getAdminUser();

  // Admin değilse anasayfaya yönlendir (admin paneli varlığını gizle)
  if (!isAdmin) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Admin üst bar */}
      <header className="border-b border-line bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="w-7 h-7 bg-ink flex items-center justify-center text-paper font-display font-semibold italic text-base leading-none rounded">
                k
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
                Admin Panel
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-5">
              <Link
                href="/admin"
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-72 hover:text-terracotta transition-colors"
              >
                Genel
              </Link>
              <Link
                href="/admin/profiller"
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-72 hover:text-terracotta transition-colors"
              >
                Profil Onayları
              </Link>
              <Link
                href="/admin/ilanlar"
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-72 hover:text-terracotta transition-colors"
              >
                İlan Onayları
              </Link>
              <Link
                href="/admin/kullanicilar"
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-72 hover:text-terracotta transition-colors"
              >
                Kullanıcılar
              </Link>
            </nav>
          </div>
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-72 hover:text-ink transition-colors"
          >
            ← Siteye dön
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-12 py-10">{children}</main>
    </div>
  );
}