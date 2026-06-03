import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { AdminNav } from './admin-nav';

export const metadata = {
  title: 'Admin — Kashe',
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Admin layout — erişim koruması burada yapılır.
 * /admin/* altındaki tüm sayfalar bu layout'tan geçer.
 *
 * Sadece is_admin=true olan kullanıcılar erişebilir.
 * Diğerleri /'a yönlendirilir (404 yerine sessiz yönlendirme —
 * admin sayfasının varlığını dışarıya sızdırmamak için).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, full_name, avatar_url')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    redirect('/');
  }

  const adminName = profile.full_name || user.email || 'Admin';

  return (
    <div className="min-h-screen bg-paper">
      <AdminNav adminName={adminName} avatarUrl={profile.avatar_url ?? null} />
      <main className="md:ml-60 px-6 md:px-12 py-8 md:py-10">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
