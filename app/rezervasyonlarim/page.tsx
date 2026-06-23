import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { Eyebrow } from '@/app/components/ui/eyebrow';
import { EmptyState } from '@/app/components/EmptyState';
import { RezervasyonKarti } from './rezervasyon-karti';
import { Calendar } from 'lucide-react';
import { getCachedUser } from '@/app/lib/auth';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { getEventTypeLabel } from '@/app/mesajlar/data';

type BookingRow = {
  id: string;
  quote_id: string;
  conversation_id: string;
  professional_id: string;
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
  professional: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
    service_categories: { name_tr: string; slug: string } | null;
  } | null;
};

export const metadata = {
  title: 'Rezervasyonlarım — Kashe',
};

export default async function RezervasyonlarimPage() {
  const supabase = await createClient();

  const user = await getCachedUser();

  if (!user) {
    redirect('/giris');
  }

  // Suspension kontrolü — askıdaki kullanıcı rezervasyon göremez
  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  const { data: bookingsData } = await supabase
    .from('bookings')
    .select(
      `
      id, quote_id, conversation_id, professional_id,
      event_date, start_time, end_time, event_type, location, guest_count,
      total_amount, currency, status,
      created_at, completed_at, cancelled_at,
      professional:profiles!bookings_professional_id_fkey (
        id, full_name, avatar_url, company_name, role,
        service_categories!profiles_primary_category_id_fkey (name_tr, slug)
      )
    `
    )
    .eq('customer_id', user.id)
    .order('event_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  const bookings = (bookingsData ?? []) as unknown as BookingRow[];

  // Bugün ve geleceğe ait (confirmed) — yaklaşan
  // Geçmiş ve tamamlanmış/iptal — geçmiş
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming: BookingRow[] = [];
  const past: BookingRow[] = [];

  for (const b of bookings) {
    if (b.status === 'cancelled') {
      past.push(b);
      continue;
    }
    if (b.status === 'completed') {
      past.push(b);
      continue;
    }
    // confirmed
    if (b.event_date) {
      const ed = new Date(b.event_date);
      ed.setHours(0, 0, 0, 0);
      if (ed >= today) upcoming.push(b);
      else past.push(b);
    } else {
      // event_date yoksa "yaklaşan"a koy (henüz tarih netleşmemiş olabilir)
      upcoming.push(b);
    }
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-10 md:mb-12">
            <Eyebrow variant="inline" className="mb-3">
              Sahnen
            </Eyebrow>
            <h1 className="font-display font-semibold text-4xl md:text-5xl text-ink tracking-[-0.03em] leading-[1.05]">
              <em>Rezervasyonlarım</em>.
            </h1>
            <p className="text-base text-ink-72 mt-3 max-w-xl leading-relaxed">
              Onayladığın teklifler, yaklaşan ve geçmiş işlerin burada.
            </p>
          </div>

          {bookings.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Henüz rezervasyon yok"
              description="Bir profesyonelden teklif al, onayladığında burada görünür."
              action={{ label: 'Profesyonelleri keşfet', href: '/kesfet' }}
            />
          ) : (
            <div className="space-y-12">
              {/* Yaklaşan */}
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
                        viewer="customer"
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Geçmiş */}
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
                        viewer="customer"
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
