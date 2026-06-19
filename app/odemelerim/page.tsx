import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/app/components/sections/top-nav';
import { formatTRY } from '@/app/lib/premium';

export const metadata = {
  title: 'Ödeme Geçmişi — Kashe',
};

type BookingRow = {
  id: string;
  professional_id: string;
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

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: {
      label: 'Tamamlandı',
      cls: 'bg-moss/10 text-moss border-moss/30',
    },
    confirmed: {
      label: 'Yaklaşan',
      cls: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    cancelled: {
      label: 'İptal',
      cls: 'bg-ink-72/8 text-ink-72 border-ink-72/20',
    },
  };
  const s = map[status] ?? map.cancelled;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] border ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export default async function OdemelerimPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();

  if (profile?.suspended_at) {
    redirect('/askiya-alindi');
  }

  // Müşterinin rezervasyonları
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select(
      'id, professional_id, event_type, event_date, total_amount, status, completed_at, created_at'
    )
    .eq('customer_id', user.id)
    .order('event_date', { ascending: false });

  const bookings = (bookingsData ?? []) as BookingRow[];

  // Profesyonel isimleri (toplu çek)
  const proIds = Array.from(new Set(bookings.map((b) => b.professional_id)));
  const proMap = new Map<string, string>();
  if (proIds.length > 0) {
    const { data: pros } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, role')
      .in('id', proIds);
    (pros ?? []).forEach((p) => {
      const name =
        (p.role === 'business' || p.role === 'agency') && p.company_name
          ? p.company_name
          : p.full_name || 'Profesyonel';
      proMap.set(p.id, name);
    });
  }

  const completed = bookings.filter((b) => b.status === 'completed');
  const upcoming = bookings.filter((b) => b.status === 'confirmed');

  const totalPaid = completed.reduce((s, b) => s + (b.total_amount ?? 0), 0);
  const totalUpcoming = upcoming.reduce((s, b) => s + (b.total_amount ?? 0), 0);

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-3">
              Ödeme Geçmişi
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight leading-[1.05]">
              Ödeme Geçmişi
            </h1>
            <p className="text-ink-72 text-lg mt-4 max-w-2xl leading-relaxed">
              Rezervasyonların ve ödeme durumları. Tutarlar profesyonelle
              anlaştığın toplam bedeli gösterir.
            </p>
          </div>

          {/* Bilgi notu */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
            <p className="text-sm text-amber-800 leading-relaxed">
              Online ödeme (iyzico) entegrasyonu yakında. Şu an ödemeler
              profesyonelle aranızda gerçekleşir; aşağıdaki kayıtlar
              rezervasyon geçmişin içindir.
            </p>
          </div>

          {bookings.length === 0 ? (
            <div className="bg-card border border-line rounded-2xl p-10 text-center">
              <p className="font-display font-medium text-lg text-ink mb-1">
                Henüz rezervasyonun yok.
              </p>
              <p className="text-sm text-ink-72">
                Bir profesyonelle anlaştığında rezervasyonların burada görünecek.
              </p>
            </div>
          ) : (
            <>
              {/* Özet kartları */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                <div className="bg-[#F0F7F0] border border-moss/30 rounded-2xl p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss mb-1.5">
                    Tamamlanan ödemeler
                  </p>
                  <p className="font-display text-3xl text-moss tabular-nums leading-none">
                    {formatTRY(totalPaid)}
                  </p>
                  <p className="text-[12px] text-ink-72 mt-1.5">
                    {completed.length} tamamlanmış rezervasyon
                  </p>
                </div>
                <div className="bg-card border border-line rounded-2xl p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-1.5">
                    Yaklaşan
                  </p>
                  <p className="font-display text-3xl text-ink tabular-nums leading-none">
                    {formatTRY(totalUpcoming)}
                  </p>
                  <p className="text-[12px] text-ink-72 mt-1.5">
                    {upcoming.length} onaylı rezervasyon
                  </p>
                </div>
              </div>

              {/* Tüm rezervasyonlar tablosu */}
              <div className="bg-card border border-line rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-paper-2/50 border-b border-line">
                      <tr>
                        <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                          Profesyonel / Etkinlik
                        </th>
                        <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 whitespace-nowrap">
                          Tarih
                        </th>
                        <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                          Durum
                        </th>
                        <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                          Tutar
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {bookings.map((b) => (
                        <tr key={b.id} className="hover:bg-paper-2/30">
                          <td className="px-4 py-3">
                            <p className="text-sm text-ink font-medium">
                              {proMap.get(b.professional_id) ?? 'Profesyonel'}
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
                          <td className="px-4 py-3">
                            <StatusPill status={b.status} />
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-ink tabular-nums whitespace-nowrap">
                            {formatTRY(b.total_amount ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}