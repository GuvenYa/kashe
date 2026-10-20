import { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
import { etkinlikTuruEtiketi } from '@/app/lib/etkinlik-turu';
import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import {
  PanelKabugu,
  PanelBaslik,
  VeriTablosu,
  type VeriSatiri,
} from '@/app/components/panel';
import { getCrewContext } from '@/app/lib/org-context';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { getCachedUser } from '@/app/lib/auth';
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
    timeZone: KASHE_SAAT_DILIMI,
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

  const user = await getCachedUser();

  if (!user) {
    redirect('/giris?redirect=/odemelerim');
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

  // K12 — KURULUS REZERVASYONLARI.
  //
  // Kullanicinin uyesi oldugu kuruluslar adina alinan rezervasyonlar da bu
  // sayfaya girer: alici kurulus uyesi "ne odedik" sorusunu burada soruyor ve
  // eskiden hic yanit bulamiyordu. Kapi `events.manage` ya da `finance.view`
  // (ticari gorunurluk); RLS zaten `can_access_booking_row` ile siniri koyuyor,
  // bu suzgec KAPSAM daraltmasidir. Yeni RPC YOK.
  const { orgs } = await getCrewContext();
  const kurulusIdleri = orgs
    .filter((o) => o.canManageEvents || o.canViewFinance)
    .map((o) => o.id);

  type KurulusRezervasyonu = {
    id: string;
    event_type: string | null;
    event_date: string | null;
    total_amount: number | null;
    status: string;
    surum: {
      version_no: number;
      proposal: {
        title: string;
        seller: { display_name: string | null } | null;
      } | null;
    } | null;
  };
  let kurulusRezervasyonlari: KurulusRezervasyonu[] = [];
  if (kurulusIdleri.length > 0) {
    const { data: kurumData, error: kurumHatasi } = await supabase
      .from('bookings')
      .select(
        `id, event_type, event_date, total_amount, status,
         surum:proposal_versions!bookings_proposal_version_id_fkey (
           version_no,
           proposal:proposals!proposal_versions_proposal_id_fkey (
             title,
             seller:organizations_public!proposals_seller_organization_id_fkey (
               display_name
             )
           )
         )`
      )
      .in('buyer_organization_id', kurulusIdleri)
      .order('event_date', { ascending: false });
    if (kurumHatasi) {
      console.error('[odeme] kurulus rezervasyonlari', kurumHatasi.code, kurumHatasi.message);
    }
    kurulusRezervasyonlari = (kurumData ?? []) as unknown as KurulusRezervasyonu[];
  }

  // Kisisel ve kurulus satirlari AYNI tabloda: kullanici icin ikisi de
  // "odedigim is"; ayirt edici bilgi karsi tarafin adi.
  type OdemeSatiri = {
    id: string;
    karsiTaraf: string;
    etkinlik: string | null;
    event_date: string | null;
    total_amount: number | null;
    status: string;
    kurulusAdina: boolean;
  };

  const tekilSatirlar = [
    ...bookings.map((b) => ({
      id: b.id,
      karsiTaraf: proMap.get(b.professional_id) ?? 'Profesyonel',
      etkinlik: etkinlikTuruEtiketi(b.event_type),
      event_date: b.event_date,
      total_amount: b.total_amount,
      status: b.status,
      kurulusAdina: false,
    })),
    ...kurulusRezervasyonlari.map((r) => ({
      id: r.id,
      karsiTaraf:
        r.surum?.proposal?.seller?.display_name?.trim() || 'Kuruluş',
      etkinlik:
        r.surum?.proposal?.title?.trim() ||
        etkinlikTuruEtiketi(r.event_type),
      event_date: r.event_date,
      total_amount: r.total_amount,
      status: r.status,
      kurulusAdina: true,
    })),
  ]
    // Ayni rezervasyon iki yoldan gelebilir: teklif kaynakli kayitta
    // `customer_id` teklifin `buyer_user_id`si, `buyer_organization_id` de
    // dolu (FAZ 7c). Kurulus satiri kazanir (karsi taraf adi daha dogru).
    .reduce<Map<string, OdemeSatiri>>((m, s) => {
      const onceki = m.get(s.id);
      if (!onceki || s.kurulusAdina) m.set(s.id, s);
      return m;
    }, new Map());
  const satirlar: OdemeSatiri[] = [...tekilSatirlar.values()].sort((a, b) =>
    (a.event_date ?? '') < (b.event_date ?? '') ? 1 : -1
  );

  const completed = satirlar.filter((b) => b.status === 'completed');
  const upcoming = satirlar.filter((b) => b.status === 'confirmed');

  const totalPaid = completed.reduce((s, b) => s + (b.total_amount ?? 0), 0);
  const totalUpcoming = upcoming.reduce((s, b) => s + (b.total_amount ?? 0), 0);

  const tabloSatirlari: VeriSatiri[] = satirlar.map((b) => ({
    anahtar: b.id,
    href: `/rezervasyon/${b.id}`,
    hucreler: {
      taraf: (
        <span className="block">
          <span className="block text-sm text-ink font-medium">
            {b.karsiTaraf}
          </span>
          {b.etkinlik && (
            <span className="block text-[12px] text-ink-50">{b.etkinlik}</span>
          )}
          {b.kurulusAdina && (
            <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-ink-50">
              kuruluş adına
            </span>
          )}
        </span>
      ),
      tarih: formatDate(b.event_date),
      tutar: formatTRY(b.total_amount ?? 0),
      durum: <StatusPill status={b.status} />,
    },
  }));

  // D1b-2: calisma sayfasi panel kabugunda; menu ve hesap karti tek
  // yerden (app/lib/panel-kabuk.ts).
  const kabuk = await panelKabukProps();

  return (
    <PanelKabugu {...kabuk}>
      <div className="max-w-5xl">
          {/* Header */}
          <PanelBaslik
            eyebrow="Ödeme Geçmişi"
            altNot="Rezervasyonların ve ödeme durumları. Tutarlar profesyonelle anlaştığın toplam bedeli gösterir."
          >
            Ödeme Geçmişi
          </PanelBaslik>

          {/* Bilgi notu */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
            <p className="text-sm text-amber-800 leading-relaxed">
              Online ödeme (iyzico) entegrasyonu yakında. Şu an ödemeler
              profesyonelle aranızda gerçekleşir; aşağıdaki kayıtlar
              rezervasyon geçmişin içindir.
            </p>
          </div>

          {satirlar.length === 0 ? (
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

              {/* Tum rezervasyonlar — kisisel ve kurulus ayni tabloda */}
              <div className="bg-card border border-line rounded-2xl p-5">
                <VeriTablosu
                  sutunlar={[
                    {
                      anahtar: 'taraf',
                      baslik: 'Ajans / Etkinlik',
                      kartEtiketiGizle: true,
                    },
                    { anahtar: 'tarih', baslik: 'Tarih' },
                    { anahtar: 'tutar', baslik: 'Tutar', sayisal: true },
                    { anahtar: 'durum', baslik: 'Durum' },
                  ]}
                  satirlar={tabloSatirlari}
                  bosMetin="Kayıt yok."
                />
              </div>
            </>
          )}
        </div>
    </PanelKabugu>
  );
}