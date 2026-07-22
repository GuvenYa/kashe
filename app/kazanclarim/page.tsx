import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/app/components/sections/top-nav';
import { getCachedUser } from '@/app/lib/auth';
import { calcCommission, formatTRY, COMMISSION_RATE } from '@/app/lib/premium';

export const metadata = {
  title: 'Kazançlarım — Kashe',
};

type BookingRow = {
  id: string;
  customer_id: string;
  event_type: string | null;
  event_date: string | null;
  total_amount: number | null;
  status: string;
  completed_at: string | null;
  created_at: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function KazanclarimPage() {
  const supabase = await createClient();

  const user = await getCachedUser();

  if (!user) {
    redirect('/giris?redirect=/kazanclarim');
  }

  // Rol + suspension kontrolü — kazançlarım sadece profesyonel/ajans için
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .single();

  if (profile?.suspended_at) {
    redirect('/askiya-alindi');
  }

  const isProvider =
    profile?.role === 'professional' || profile?.role === 'agency';

  // Bu sağlayıcının rezervasyonları
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select(
      'id, customer_id, event_type, event_date, total_amount, status, completed_at, created_at'
    )
    .eq('professional_id', user.id)
    .order('event_date', { ascending: false });

  const bookings = (bookingsData ?? []) as BookingRow[];

  const completed = bookings.filter((b) => b.status === 'completed');
  const upcoming = bookings.filter((b) => b.status === 'confirmed');

  // Müşteri isimleri (toplu çek)
  const customerIds = Array.from(new Set(bookings.map((b) => b.customer_id)));
  const customerMap = new Map<string, string>();
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, role')
      .in('id', customerIds);
    (customers ?? []).forEach((c) => {
      const name =
        (c.role === 'business' || c.role === 'agency') && c.company_name
          ? c.company_name
          : c.full_name || 'Müşteri';
      customerMap.set(c.id, name);
    });
  }

  // Toplam özet (sadece completed = gerçekleşmiş kazanç)
  const totalGross = completed.reduce(
    (sum, b) => sum + (b.total_amount ?? 0),
    0
  );
  const summary = calcCommission(totalGross);

  // Beklenen (confirmed) brüt
  const upcomingGross = upcoming.reduce(
    (sum, b) => sum + (b.total_amount ?? 0),
    0
  );

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-ink mb-3">
              Kazançlarım
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
              Kazançlarım
            </h1>
            <p className="text-ink-72 text-lg mt-4 max-w-2xl leading-relaxed">
              Tamamlanan rezervasyonlardan elde ettiğin gelir. Platform
              komisyonu %{Math.round(COMMISSION_RATE * 100)} olarak hesaplanır.
            </p>
          </div>

          {!isProvider ? (
            <div className="bg-card border border-line rounded-2xl p-8 text-center">
              <p className="text-ink-72">
                Kazançlar yalnızca hizmet veren profesyonel ve ajans hesapları
                için görüntülenir.
              </p>
            </div>
          ) : (
            <>
              {/* Komisyon bilgi notu */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
                <p className="text-sm text-amber-800 leading-relaxed">
                  Ödeme sistemi (iyzico) entegrasyonu tamamlandığında ödemeler
                  otomatik tahsil edilip komisyon kesintisiyle hesabına
                  aktarılacaktır. Aşağıdaki tutarlar bilgilendirme amaçlıdır.
                </p>
              </div>

              {/* Özet kartları */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                <div className="bg-card border border-line rounded-2xl p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-1.5">
                    Toplam brüt
                  </p>
                  <p className="font-display text-3xl text-ink tabular-nums leading-none">
                    {formatTRY(summary.gross)}
                  </p>
                </div>
                <div className="bg-card border border-line rounded-2xl p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-1.5">
                    Komisyon (%{Math.round(COMMISSION_RATE * 100)})
                  </p>
                  <p className="font-display text-3xl text-brand-ink-deep tabular-nums leading-none">
                    −{formatTRY(summary.commission)}
                  </p>
                </div>
                <div className="bg-[#F0F7F0] border border-moss/30 rounded-2xl p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss mb-1.5">
                    Net kazanç
                  </p>
                  <p className="font-display text-3xl text-moss tabular-nums leading-none">
                    {formatTRY(summary.net)}
                  </p>
                </div>
              </div>

              {/* Tamamlanan rezervasyonlar */}
              <div className="mb-10">
                <h2 className="font-display font-medium text-xl text-ink mb-4">
                  Tamamlanan işler ({completed.length})
                </h2>
                {completed.length === 0 ? (
                  <div className="bg-card border border-line rounded-2xl p-8 text-center">
                    <p className="text-ink-72">
                      Henüz tamamlanmış rezervasyonun yok. İşler tamamlandıkça
                      kazançların burada görünecek.
                    </p>
                  </div>
                ) : (
                  <div className="bg-card border border-line rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-paper-2/50 border-b border-line">
                          <tr>
                            <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                              Müşteri / Etkinlik
                            </th>
                            <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 whitespace-nowrap">
                              Tarih
                            </th>
                            <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                              Brüt
                            </th>
                            <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                              Komisyon
                            </th>
                            <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                              Net
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {completed.map((b) => {
                            const c = calcCommission(b.total_amount ?? 0);
                            return (
                              <tr key={b.id} className="hover:bg-paper-2/30">
                                <td className="px-4 py-3">
                                  <p className="text-sm text-ink font-medium">
                                    {customerMap.get(b.customer_id) ?? 'Müşteri'}
                                  </p>
                                  {b.event_type && (
                                    <p className="text-[12px] text-ink-50">
                                      {b.event_type}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-[12px] text-ink-72 font-mono whitespace-nowrap">
                                  {formatDate(b.event_date)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-ink tabular-nums whitespace-nowrap">
                                  {formatTRY(c.gross)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-brand-ink-deep tabular-nums whitespace-nowrap">
                                  −{formatTRY(c.commission)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-semibold text-moss tabular-nums whitespace-nowrap">
                                  {formatTRY(c.net)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Yaklaşan (confirmed) */}
              {upcoming.length > 0 && (
                <div>
                  <h2 className="font-display font-medium text-xl text-ink mb-1">
                    Yaklaşan işler ({upcoming.length})
                  </h2>
                  <p className="text-sm text-ink-72 mb-4">
                    Onaylı ama henüz tamamlanmamış rezervasyonlar. Beklenen brüt:{' '}
                    <span className="font-semibold text-ink">
                      {formatTRY(upcomingGross)}
                    </span>
                  </p>
                  <div className="bg-card border border-line rounded-2xl overflow-hidden">
                    <div className="divide-y divide-line">
                      {upcoming.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-ink font-medium truncate">
                              {customerMap.get(b.customer_id) ?? 'Müşteri'}
                            </p>
                            <p className="text-[12px] text-ink-50">
                              {b.event_type || 'Etkinlik'} ·{' '}
                              {formatDate(b.event_date)}
                            </p>
                          </div>
                          <p className="text-sm text-ink tabular-nums whitespace-nowrap shrink-0">
                            {formatTRY(b.total_amount ?? 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}