import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Hızlı sayaçlar — onay bekleyenler
  const [
    { count: pendingProfiles },
    { count: pendingListings },
    { count: totalUsers },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending'),
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_approval'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ]);

  const cards = [
    {
      label: 'Onay bekleyen profiller',
      value: pendingProfiles ?? 0,
      href: '/admin/profiller',
    },
    {
      label: 'Onay bekleyen ilanlar',
      value: pendingListings ?? 0,
      href: '/admin/ilanlar',
    },
    {
      label: 'Toplam kullanıcı',
      value: totalUsers ?? 0,
      href: '/admin/kullanicilar',
    },
  ];

  return (
    <div>
      <div className="mb-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-72 mb-2">
          Admin
        </p>
        <h1 className="font-display text-4xl text-ink tracking-tight">
          Genel bakış
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white border border-line rounded-lg p-6 hover:border-terracotta hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
          >
            <p className="font-display text-4xl text-ink mb-2">{card.value}</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-72">
              {card.label}
            </p>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-ink-72 text-sm">
        Profil ve ilan onay modülleri sıradaki adımlarda eklenecek.
      </p>
    </div>
  );
}