import { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { Calendar } from 'lucide-react';
import { PanelKabugu, PanelBaslik } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { EmptyState } from '@/app/components/EmptyState';
import { RezervasyonKarti } from '@/app/rezervasyonlarim/rezervasyon-karti';
import { getCachedUser } from '@/app/lib/auth';
import { AvailabilityCalendar } from '@/app/components/availability-calendar';

/**
 * Takvim satiri — IKI REZERVASYON SEKLI (CLAUDE.md FAZ 7c; A8).
 *
 * Eski sekil: `quote_id` + `conversation_id` + `customer_id` dolu, karsi
 * taraf `customer` embed'inden. Teklif sekli: `proposal_version_id` +
 * `seller_provider_id` dolu, dort eski sutun NULL olabilir; karsi taraf
 * teklifin `client_name`i ya da alici kurulusun adi.
 *
 * `teklifSekli` alani UYGULAMADA turetilir (DB sutunu degil): kart hangi
 * sekli cizecegini acikca bilsin, `null` kontrolu her yere dagilmasin.
 */
type BookingRow = {
  id: string;
  quote_id: string | null;
  conversation_id: string | null;
  customer_id: string | null;
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
  /** A8: teklif dosyasindan dogan rezervasyon mu. */
  teklifSekli?: boolean;
  /** A8: teklif seklinde karsi tarafin adi (musteri ya da alici kurulus). */
  karsiTarafAdi?: string | null;
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
    redirect('/giris?redirect=/takvimim');
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

  /**
   * A8 — TEKLIF SEKLI rezervasyonlar (FAZ 7c).
   *
   * Ajansin teklif dosyasindan dogan rezervasyon `professional_id` TASIMIYOR;
   * satici `seller_provider_id`de duruyor. `providers.id = profiles.id`
   * (FAZ 2a) oldugu icin kurulus sahibinin saglayici kimligi kendi kullanici
   * kimligidir — kisisel takvim bu kapsamda dogru.
   */
  const { data: teklifData, error: teklifHatasi } = await supabase
    .from('bookings')
    .select(
      `
      id, quote_id, conversation_id, customer_id, proposal_version_id,
      event_date, start_time, end_time, event_type, location, guest_count,
      total_amount, currency, status,
      created_at, completed_at, cancelled_at,
      alici:organizations_public!bookings_buyer_organization_id_fkey (
        display_name
      ),
      surum:proposal_versions!bookings_proposal_version_id_fkey (
        proposal:proposals!proposal_versions_proposal_id_fkey (
          client_name
        )
      )
    `
    )
    .eq('seller_provider_id', user.id)
    .order('event_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (teklifHatasi) console.error('[takvim] teklif sekli', teklifHatasi);

  type TeklifSatiri = Omit<BookingRow, 'customer'> & {
    alici: { display_name: string | null } | null;
    surum: { proposal: { client_name: string | null } | null } | null;
  };

  const teklifSatirlari: BookingRow[] = (
    (teklifData ?? []) as unknown as TeklifSatiri[]
  ).map((t) => ({
    ...t,
    teklifSekli: true,
    karsiTarafAdi:
      t.surum?.proposal?.client_name?.trim() ||
      t.alici?.display_name?.trim() ||
      null,
    customer: null,
  }));

  const bookings = [
    ...((bookingsData ?? []) as unknown as BookingRow[]),
    ...teklifSatirlari,
  ].sort((a, b) => {
    // Tarihsiz satirlar sona; digerleri tarihe gore artan (iki sorgu ayri
    // siralanmis halde geliyor, birlesince yeniden siralanir).
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    return a.event_date.localeCompare(b.event_date);
  });

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

  // D1b-2: calisma sayfasi panel kabugunda; menu ve hesap karti tek
  // yerden (app/lib/panel-kabuk.ts).
  const kabuk = await panelKabukProps();

  return (
    <PanelKabugu {...kabuk}>
      <div className="max-w-5xl">
          <PanelBaslik
            eyebrow="İşin"
            altNot="Müsaitliğini yönet, onaylanan rezervasyonlarını ve geçmiş işlerini gör."
          >
            <em className="not-italic font-medium text-brand-accent">Takvimim</em>.
          </PanelBaslik>

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
                <div className="bg-card border border-line rounded-2xl p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-4">
                    Bu ay
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-display text-3xl text-brand-ink leading-none">
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
                  <div className="bg-card border border-line rounded-2xl p-5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
                      Sıradaki işler
                    </p>
                    <ul className="space-y-2.5">
                      {upcoming.slice(0, 4).map((b) => {
                        // A8: teklif seklinde karsi taraf sunucuda cozuldu.
                        const customerName = b.teklifSekli
                          ? b.karsiTarafAdi || 'Müşteri'
                          : b.customer?.company_name ||
                            b.customer?.full_name ||
                            'Müşteri';
                        const dateLabel = b.event_date
                          ? new Date(b.event_date).toLocaleDateString('tr-TR', {
                              timeZone: KASHE_SAAT_DILIMI,
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
                            <span className="font-mono text-xs text-brand-ink shrink-0">
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
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-ink mb-5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-ink inline-block kashe-pulse" />
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
    </PanelKabugu>
  );
}
