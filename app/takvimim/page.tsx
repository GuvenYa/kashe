import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { Calendar } from 'lucide-react';
import { TopNav } from '@/app/components/sections/top-nav';
import { Eyebrow } from '@/app/components/ui/eyebrow';
import { EmptyState } from '@/app/components/EmptyState';
import { RezervasyonKarti } from '@/app/rezervasyonlarim/rezervasyon-karti';
import { getCachedUser } from '@/app/lib/auth';
import { AvailabilityCalendar } from '@/app/components/availability-calendar';

type BookingRow = {
  id: string;
  quote_id: string;
  conversation_id: string;
  customer_id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  event_type: string | null;
  location: string | null;
  guest_count: number | null;
  total_amount: number;
  currency: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  customer: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
  } | null;
};

export const metadata = {
  title: 'Takvimim — Kashe',
};

export default async function TakvimimPage() {
  const supabase = await createClient();

  const user = await getCachedUser();

  if (!user) {
    redirect('/giris');
  }

  // Sadece profesyonel/ajans rolleri buraya gelmeli — diğerlerini ana sayfaya yolla
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!myProfile || (myProfile.role !== 'professional' && myProfile.role !== 'agency')) {
    redirect('/');
  }

  const { data: bookingsData } = await supabase
    .from('bookings')
    .select(
      `
      id, quote_id, conversation_id, customer_id,
      event_date, start_time, end_time, event_type, location, guest_count,
      total_amount, currency, status,
      created_at, completed_at, cancelled_at,
      customer:profiles!bookings_customer_id_fkey (
        id, full_name, avatar_url, company_name, role
      )
    `
    )
    .eq('professional_id', user.id)
    .order('event_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  const bookings = (bookingsData ?? []) as unknown as BookingRow[];

  // Manuel bloklu günler
  const { data: blocksData } = await supabase
    .from('availability_blocks')
    .select('blocked_date')
    .eq('profile_id', user.id);
  const blockedDates = (blocksData ?? []).map((b) => b.blocked_date as string);

  // Onaylı/aktif booking günleri (iptal/tamamlanan hariç — sadece confirmed gelecek işler dolu sayılır)
  const bookedDates = bookings
    .filter((b) => b.status === 'confirmed' && b.event_date)
    .map((b) => b.event_date as string);

  // Bu ay manuel dolu işaretlenen gün sayısı (panel özeti için)
  const nowDate = new Date();
  const thisMonthPrefix = `${nowDate.getFullYear()}-${String(
    nowDate.getMonth() + 1
  ).padStart(2, '0')}`;
  const blockedThisMonth = blockedDates.filter((d) =>
    d.startsWith(thisMonthPrefix)
  ).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming: BookingRow[] = [];
  const past: BookingRow[] = [];

  for (const b of bookings) {
    if (b.status === 'cancelled' || b.status === 'completed') {
      past.push(b);
      continue;
    }
    if (b.event_date) {
      const ed = new Date(b.event_date);
      ed.setHours(0, 0, 0, 0);
      if (ed >= today) upcoming.push(b);
      else past.push(b);
    } else {
      upcoming.push(b);
    }
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10 md:mb-12">
            <Eyebrow variant="inline" className="mb-3">
              İşin
            </Eyebrow>
            <h1 className="font-display font-light text-4xl md:text-5xl text-ink tracking-[-0.03em] leading-[1.05]">
              <em>Takvimim</em>.
            </h1>
            <p className="text-base text-ink-72 mt-3 max-w-xl leading-relaxed">
              Müsaitliğini yönet, onaylanan rezervasyonlarını ve geçmiş işlerini gör.
            </p>
          </div>

          {/* MÜSAİTLİK TAKVİMİ */}
          <section className="mb-12">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-72 mb-5">
              Müsaitlik takvimi
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">
              <AvailabilityCalendar
                blockedDates={blockedDates}
                bookedDates={bookedDates}
                editable={true}
              />

              {/* Sağ panel — özet + yaklaşan işler */}
              <div className="space-y-4">
                {/* Özet kartı */}
                <div className="bg-white border border-line rounded-2xl p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-4">
                    Bu ay
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-display text-3xl text-terracotta leading-none">
                        {blockedThisMonth}
                      </p>
                      <p className="text-xs text-ink-72 mt-1.5">
                        dolu işaretledin
                      </p>
                    </div>
                    <div>
                      <p className="font-display text-3xl text-ink leading-none">
                        {upcoming.length}
                      </p>
                      <p className="text-xs text-ink-72 mt-1.5">
                        yaklaşan rezervasyon
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-ink-72 mt-4 pt-4 border-t border-line leading-relaxed">
                    Müşteriler profilinde bu takvimi görüyor — müsait olmadığın
                    günleri işaretle, boşuna teklif gelmesin.
                  </p>
                </div>

                {/* Yaklaşan işler mini listesi */}
                {upcoming.length > 0 && (
                  <div className="bg-white border border-line rounded-2xl p-5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
                      Sıradaki işler
                    </p>
                    <ul className="space-y-2.5">
                      {upcoming.slice(0, 4).map((b) => {
                        const customerName =
                          b.customer?.company_name ||
                          b.customer?.full_name ||
                          'Müşteri';
                        const dateLabel = b.event_date
                          ? new Date(b.event_date).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'long',
                            })
                          : 'Tarih yok';
                        return (
                          <li
                            key={b.id}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="text-ink font-medium truncate">
                                {customerName}
                              </p>
                              <p className="text-xs text-ink-72 truncate">
                                {[b.event_type, b.location]
                                  .filter(Boolean)
                                  .join(' · ') || 'Detay yok'}
                              </p>
                            </div>
                            <span className="font-mono text-xs text-terracotta shrink-0">
                              {dateLabel}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {upcoming.length > 4 && (
                      <p className="text-xs text-ink-72 mt-3 pt-3 border-t border-line">
                        +{upcoming.length - 4} rezervasyon daha aşağıda
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {bookings.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Henüz rezervasyon yok"
              description="Müşteriler teklifini onayladığında rezervasyonlar burada listelenir."
              action={{ label: 'Mesajlara git', href: '/mesajlar' }}
            />
          ) : (
            <div className="space-y-12">
              {upcoming.length > 0 && (
                <section>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta mb-5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-terracotta inline-block kashe-pulse" />
                    Yaklaşan ({upcoming.length})
                  </h2>
                  <div className="space-y-3">
                    {upcoming.map((b) => (
                      <RezervasyonKarti
                        key={b.id}
                        booking={b}
                        viewer="professional"
                      />
                    ))}
                  </div>
                </section>
              )}

              {past.length > 0 && (
                <section>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-50 mb-5">
                    Geçmiş ({past.length})
                  </h2>
                  <div className="space-y-3">
                    {past.map((b) => (
                      <RezervasyonKarti
                        key={b.id}
                        booking={b}
                        viewer="professional"
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
