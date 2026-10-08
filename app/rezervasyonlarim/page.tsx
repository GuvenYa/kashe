import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/app/components/sections/top-nav';
import { Eyebrow } from '@/app/components/ui/eyebrow';
import { EmptyState } from '@/app/components/EmptyState';
import { RezervasyonKarti } from './rezervasyon-karti';
import { Calendar } from 'lucide-react';
import { getCachedUser } from '@/app/lib/auth';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { getCrewContext } from '@/app/lib/org-context';
import { KurulusKarti, type KurulusRezervasyonu } from './kurulus-karti';

// FAZ 7c: dort eski sutun artik NULLABLE (teklif sekli). Bu sayfadaki iki eski
// bolum yalniz kendi koltugunu suzdugu icin davranis DEGISMEZ.
type BookingRow = {
  id: string;
  quote_id: string | null;
  conversation_id: string | null;
  customer_id: string | null;
  professional_id: string | null;
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
  professional: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
    service_categories: { name_tr: string; slug: string } | null;
  } | null;
};

/**
 * Eski sekil: dort sutun DOLU (teklif kabulu akisi). Eski kart bunu bekler;
 * teklif sekli (FAZ 7c) ayri kartla ve ayri bolumde gosterilir.
 */
type EskiBookingRow = BookingRow & {
  quote_id: string;
  conversation_id: string;
  customer_id: string;
  professional_id: string;
};

function eskiSekilMi(b: BookingRow): b is EskiBookingRow {
  return (
    !!b.quote_id && !!b.conversation_id && !!b.customer_id && !!b.professional_id
  );
}

export const metadata = {
  title: 'Rezervasyonlarım — Kashe',
};

// Yaklaşan / geçmiş ayrımı — koltuktan bağımsız (her grup içinde uygulanır).
function splitByTime(list: EskiBookingRow[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming: EskiBookingRow[] = [];
  const past: EskiBookingRow[] = [];
  for (const b of list) {
    if (b.status === 'cancelled' || b.status === 'completed') {
      past.push(b);
      continue;
    }
    // confirmed
    if (b.event_date) {
      const ed = new Date(b.event_date);
      ed.setHours(0, 0, 0, 0);
      (ed >= today ? upcoming : past).push(b);
    } else {
      // tarih netleşmemiş → yaklaşan
      upcoming.push(b);
    }
  }
  return { upcoming, past };
}

// Bir koltuk grubu ("Aldığın" / "Verdiğin"). Anayasa: boş grup RENDER EDİLMEZ.
function SeatGroup({
  title,
  list,
  viewer,
}: {
  title: string;
  list: EskiBookingRow[];
  viewer: 'customer' | 'professional';
}) {
  if (list.length === 0) return null;
  const { upcoming, past } = splitByTime(list);
  return (
    <section>
      <h2 className="font-display font-semibold text-xl md:text-2xl text-ink tracking-tight mb-5">
        {title}{' '}
        <span className="text-ink-50 font-normal text-base">
          ({list.length})
        </span>
      </h2>
      <div className="space-y-10">
        {upcoming.length > 0 && (
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-ink mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-ink inline-block kashe-pulse" />
              Yaklaşan ({upcoming.length})
            </h3>
            <div className="space-y-3">
              {upcoming.map((b) => (
                <RezervasyonKarti key={b.id} booking={b} viewer={viewer} />
              ))}
            </div>
          </div>
        )}
        {past.length > 0 && (
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-50 mb-4">
              Geçmiş ({past.length})
            </h3>
            <div className="space-y-3">
              {past.map((b) => (
                <RezervasyonKarti key={b.id} booking={b} viewer={viewer} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default async function RezervasyonlarimPage() {
  const supabase = await createClient();

  const user = await getCachedUser();

  if (!user) {
    redirect('/giris?redirect=/rezervasyonlarim');
  }

  // Suspension kontrolü — askıdaki kullanıcı rezervasyon göremez
  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  // KOLTUK-FARKINDA: kullanıcının HER İKİ koltuğu (alıcı=customer VEYA satıcı=professional).
  // RLS zaten katılımcıya kısıtlar; .or() takım rezervasyonlarını dışta bırakıp yalnız
  // kişinin kendi iki koltuğunu getirir. customer + professional join'leri birlikte gelir.
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select(
      `
      id, quote_id, conversation_id, customer_id, professional_id,
      event_date, start_time, end_time, event_type, location, guest_count,
      total_amount, currency, status,
      created_at, completed_at, cancelled_at,
      customer:profiles!bookings_customer_id_fkey (
        id, full_name, avatar_url, company_name, role
      ),
      professional:profiles!bookings_professional_id_fkey (
        id, full_name, avatar_url, company_name, role,
        service_categories!profiles_primary_category_id_fkey (name_tr, slug)
      )
    `
    )
    .or(`customer_id.eq.${user.id},professional_id.eq.${user.id}`)
    .order('event_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  const bookings = (bookingsData ?? []) as unknown as BookingRow[];

  // Koltuk ayrımı (self-guard sayesinde bir kayıt iki koltukta birden olamaz).
  // FAZ 7c: koltuk bolumleri yalniz ESKI sekil satirlarini alir — teklif seklinde
  // conversation_id/professional_id NULL olabilir ve eski kart onlari gosteremez.
  // Teklif sekli "Kuruluş rezervasyonları" bolumunde; cakisma olmaz (ayrik sekiller).
  const eskiSekil = bookings.filter(eskiSekilMi);
  const asBuyer = eskiSekil.filter((b) => b.customer_id === user.id);
  const asSeller = eskiSekil.filter((b) => b.professional_id === user.id);

  // ---- FAZ 7c / P1 — ucuncu bolum: kurulus rezervasyonlari ----
  // Yalniz `proposals.view` yetkili AJANS kurulusu uyesine. Teklif sekli
  // (`proposal_version_id` dolu); embed ipucu ZORUNLU: proposals <-> proposal_versions
  // arasinda iki iliski var (proposal_id ve current_version_id) -> ipucusuz PGRST201.
  const { orgs: teklifKuruluslari } = await getCrewContext();
  const teklifGorenler = teklifKuruluslari.filter((o) => o.canViewProposals);

  const kurulusRezervasyonlari: KurulusRezervasyonu[] = [];
  if (teklifGorenler.length > 0) {
    type OrgBookingRow = {
      id: string;
      status: string;
      event_date: string | null;
      location: string | null;
      total_amount: number | string;
      currency: string;
      created_at: string;
      customer_id: string | null;
      proposal_version_id: string | null;
      surum: {
        version_no: number;
        proposal: {
          id: string;
          title: string;
          client_name: string | null;
          seller_organization_id: string;
          seller: { display_name: string | null } | null;
        } | null;
      } | null;
    };

    const { data: orgData, error: orgHatasi } = await supabase
      .from('bookings')
      .select(
        `
        id, status, event_date, start_time, end_time, event_type, location,
        guest_count, total_amount, currency, created_at, completed_at, cancelled_at,
        customer_id, proposal_version_id,
        surum:proposal_versions!bookings_proposal_version_id_fkey (
          version_no,
          proposal:proposals!proposal_versions_proposal_id_fkey (
            id, title, client_name, seller_organization_id,
            seller:organizations!proposals_seller_organization_id_fkey (display_name)
          )
        )
      `
      )
      .not('proposal_version_id', 'is', null)
      .order('event_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (orgHatasi) console.error('[rezervasyon] kurulus listesi', orgHatasi);

    // Kullanici ayni zamanda aliciysa satir ilk bolumde de cikar; id ile tekillestirilir.
    const gorulen = new Set<string>();
    for (const r of (orgData ?? []) as unknown as OrgBookingRow[]) {
      if (gorulen.has(r.id)) continue;
      gorulen.add(r.id);
      const teklif = r.surum?.proposal ?? null;
      kurulusRezervasyonlari.push({
        id: r.id,
        status: r.status,
        event_date: r.event_date,
        location: r.location,
        total_amount: r.total_amount,
        currency: r.currency,
        created_at: r.created_at,
        teklifBasligi: teklif?.title ?? 'Teklif',
        musteriAdi: teklif?.client_name ?? null,
        kurulusAdi: teklif?.seller?.display_name ?? null,
        versionNo: r.surum?.version_no ?? null,
      });
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
              Aldığın ve verdiğin hizmetler, yaklaşan ve geçmişiyle burada.
            </p>
          </div>

          {bookings.length === 0 && kurulusRezervasyonlari.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Henüz rezervasyon yok"
              description="Aldığın ve verdiğin onaylı hizmetler burada görünür."
              action={{ label: 'Profesyonelleri keşfet', href: '/kesfet' }}
            />
          ) : (
            <div className="space-y-14">
              <SeatGroup
                title="Aldığın hizmetler"
                list={asBuyer}
                viewer="customer"
              />
              <SeatGroup
                title="Verdiğin hizmetler"
                list={asSeller}
                viewer="professional"
              />

              {/* FAZ 7c — kurulus rezervasyonlari (yalniz proposals.view yetkili ajans uyesi) */}
              {kurulusRezervasyonlari.length > 0 && (
                <section>
                  <h2 className="font-display font-semibold text-xl md:text-2xl text-ink tracking-tight mb-1">
                    Kuruluş rezervasyonları{' '}
                    <span className="text-ink-50 font-normal text-base">
                      ({kurulusRezervasyonlari.length})
                    </span>
                  </h2>
                  <p className="text-sm text-ink-72 mb-5">
                    Onaylanan tekliflerden açılan rezervasyonlar.
                  </p>
                  <div className="space-y-3">
                    {kurulusRezervasyonlari.map((r) => (
                      <KurulusKarti key={r.id} rez={r} />
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
