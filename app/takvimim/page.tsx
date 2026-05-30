import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { Calendar } from 'lucide-react';
import { TopNav } from '@/app/components/sections/top-nav';
import { Eyebrow } from '@/app/components/ui/eyebrow';
import { EmptyState } from '@/app/components/EmptyState';
import { RezervasyonKarti } from '@/app/rezervasyonlarim/rezervasyon-karti';

type BookingRow = {
  id: string;
  quote_id: string;
  conversation_id: string;
  customer_id: string;
  event_date: string | null;
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      event_date, event_type, location, guest_count,
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
              Onaylanan rezervasyonların ve geçmiş işlerin burada.
            </p>
          </div>

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
