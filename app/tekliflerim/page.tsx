import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { PanelKabugu, PanelBaslik } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { getCachedUser } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase-server';
import { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
import { etiketle } from '@/app/lib/etkinlik-turu';
import { etkinlikTurleri } from '@/app/lib/etkinlik-turleri';
import {
  formatQuoteAmount,
  getQuoteStatusLabel,
  teklifTarihiMetni,
  teklifSaatiMetni,
  type QuoteStatus,
} from '@/app/mesajlar/quotes-data';

export const metadata = {
  title: 'Verdiğim teklifler — Kashe',
};

/**
 * VERDIGIM TEKLIFLER (Duzeltme 12-D, bulgu 119).
 *
 * Profesyonel verdigi teklifleri yalniz tek tek sohbetlerde goruyordu
 * (Fahri satir 25). Burada hepsi tek listede: tutar, durum, musteri, tarih ve
 * sohbete / rezervasyona baglanti. Okuma RLS ile: teklif sohbetin tarafina
 * gorunur; musteri adi Guvenlik 04 kuraliyla (sohbet tarafi) okunur.
 */

type Satir = {
  id: string;
  conversation_id: string;
  total_amount: number;
  currency: string;
  status: QuoteStatus;
  created_at: string;
  expires_at: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  request_no: number | null;
  conversations: {
    customer_id: string;
    event_type: string | null;
    request_count: number | null;
    customer: {
      full_name: string | null;
      company_name: string | null;
      role: string;
    } | null;
  } | null;
};

/**
 * Teklif kartiyla ayni kural (Duzeltme 03-B): gunluk is 'expired' yazana kadar
 * suresi gecmis bekleyen teklif "Suresi doldu" gorunur. Bilesen disinda: saat
 * okumasi render saflik kuralina takilmasin.
 */
function gorunenDurum(status: QuoteStatus, expiresAt: string): QuoteStatus {
  return status === 'pending' && new Date(expiresAt).getTime() < Date.now()
    ? 'expired'
    : status;
}

const SEKMELER = [
  { anahtar: 'bekleyen', etiket: 'Bekleyen' },
  { anahtar: 'onaylanan', etiket: 'Onaylanan' },
  { anahtar: 'diger', etiket: 'Reddedilen / süresi dolan' },
  { anahtar: 'tumu', etiket: 'Tümü' },
] as const;

type Sekme = (typeof SEKMELER)[number]['anahtar'];

function sekmeyeUyar(durum: QuoteStatus, sekme: Sekme): boolean {
  if (sekme === 'tumu') return true;
  if (sekme === 'bekleyen') return durum === 'pending';
  if (sekme === 'onaylanan') return durum === 'accepted';
  return durum !== 'pending' && durum !== 'accepted';
}

export default async function TekliflerimPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const { durum: durumParam } = await searchParams;
  const sekme: Sekme = SEKMELER.some((s) => s.anahtar === durumParam)
    ? (durumParam as Sekme)
    : 'bekleyen';

  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/tekliflerim');

  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  const turler = await etkinlikTurleri({ hepsi: true });

  // Teklifin gondereni her zaman sohbetin profesyonelidir (atanan uye de
  // sahibi adina gonderir), bu yuzden sender_id = kendisi.
  const { data: veri } = await supabase
    .from('quotes')
    .select(
      `
      id, conversation_id, total_amount, currency, status, created_at,
      expires_at, event_date, start_time, end_time, location, request_no,
      conversations!inner (
        customer_id, event_type, request_count,
        customer:profiles!conversations_customer_id_fkey (full_name, company_name, role)
      )
    `
    )
    .eq('sender_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  const satirlar = ((veri ?? []) as unknown as Satir[]).map((q) => ({
    ...q,
    durum: gorunenDurum(q.status, q.expires_at),
  }));

  // Onaylanan tekliflerin rezervasyonlari (baglanti icin)
  const onaylananIdler = satirlar
    .filter((q) => q.status === 'accepted')
    .map((q) => q.id);
  const rezervasyonByTeklif: Record<
    string,
    {
      id: string;
      status: string;
      event_date: string | null;
      event_type: string | null;
    }
  > = {};
  if (onaylananIdler.length > 0) {
    const { data: rezervasyonlar } = await supabase
      .from('bookings')
      .select('id, quote_id, status, event_date, event_type')
      .in('quote_id', onaylananIdler);
    for (const b of rezervasyonlar ?? []) {
      if (b.quote_id) {
        rezervasyonByTeklif[b.quote_id] = {
          id: b.id,
          status: b.status,
          event_date: b.event_date,
          event_type: b.event_type,
        };
      }
    }
  }

  const sayilar: Record<Sekme, number> = {
    bekleyen: satirlar.filter((q) => sekmeyeUyar(q.durum, 'bekleyen')).length,
    onaylanan: satirlar.filter((q) => sekmeyeUyar(q.durum, 'onaylanan')).length,
    diger: satirlar.filter((q) => sekmeyeUyar(q.durum, 'diger')).length,
    tumu: satirlar.length,
  };
  const bekleyenToplam = satirlar
    .filter((q) => q.durum === 'pending')
    .reduce((t, q) => t + Number(q.total_amount ?? 0), 0);
  const gorunen = satirlar.filter((q) => sekmeyeUyar(q.durum, sekme));

  const kabuk = await panelKabukProps();

  return (
    <PanelKabugu {...kabuk}>
      <div className="max-w-3xl">
        <PanelBaslik
          eyebrow="Verdiğim teklifler"
          altNot="Sohbetlerde gönderdiğin tüm teklifler; durum, tutar ve müşteri tek listede."
        >
          <em className="not-italic font-medium text-brand-accent">Verdiğin</em>{' '}
          teklifler
        </PanelBaslik>

        {sayilar.bekleyen > 0 && (
          <p className="text-sm text-ink-72 mb-5">
            {sayilar.bekleyen} teklif yanıt bekliyor · toplam{' '}
            <span className="font-semibold text-ink">
              {formatQuoteAmount(bekleyenToplam)}
            </span>
          </p>
        )}

        {/* Sekmeler */}
        <nav className="flex flex-wrap gap-2 mb-6" aria-label="Teklif durumu">
          {SEKMELER.map((s) => (
            <Link
              key={s.anahtar}
              href={s.anahtar === 'bekleyen' ? '/tekliflerim' : `/tekliflerim?durum=${s.anahtar}`}
              aria-current={sekme === s.anahtar ? 'page' : undefined}
              className={`kashe-tap px-3.5 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-[0.12em] border transition ${
                sekme === s.anahtar
                  ? 'bg-brand-ink text-paper border-brand-ink'
                  : 'bg-card text-ink-72 border-line hover:border-brand-ink hover:text-brand-ink'
              }`}
            >
              {s.etiket} · {sayilar[s.anahtar]}
            </Link>
          ))}
        </nav>

        {gorunen.length === 0 ? (
          <div className="bg-card border border-line rounded-lg p-10 text-center">
            <p className="font-display text-lg text-ink mb-1.5">
              {satirlar.length === 0
                ? 'Henüz teklif göndermedin'
                : 'Bu sekmede teklif yok'}
            </p>
            <p className="text-sm text-ink-72">
              Teklifleri sohbetteki &quot;Teklif oluştur&quot; düğmesinden ya da
              gelen teklif taleplerinden gönderebilirsin.
            </p>
            <Link
              href="/teklif-talepleri"
              className="inline-block mt-5 font-display font-semibold text-sm text-brand-ink hover:underline"
            >
              Teklif taleplerine git →
            </Link>
          </div>
        ) : (
          <ul className="bg-card border border-line rounded-lg divide-y divide-line">
            {gorunen.map((q) => {
              const musteri = q.conversations?.customer ?? null;
              const musteriAdi =
                (musteri?.role === 'business' || musteri?.role === 'agency') &&
                musteri?.company_name
                  ? musteri.company_name
                  : musteri?.full_name || 'Müşteri';
              const rezervasyon = rezervasyonByTeklif[q.id] ?? null;
              // Etkinlik turu: rezervasyon olustuysa onunki (kabul anindaki
              // talep); yoksa yalniz sohbetin GUNCEL talebindeki teklifte
              // sohbetinki. Eski talebin teklifine yeni talebin turu yazilmaz.
              const turAnahtari =
                rezervasyon?.event_type ??
                ((q.request_no ?? 1) === (q.conversations?.request_count ?? 1)
                  ? q.conversations?.event_type ?? null
                  : null);
              const tur = turAnahtari ? etiketle(turler, turAnahtari) : null;
              // Duzeltme 12 oncesi tekliflerde tarih yok; onaylandiysa
              // rezervasyonun tarihi gosterilir.
              const tarih =
                teklifTarihiMetni(q.event_date) ??
                teklifTarihiMetni(rezervasyon?.event_date ?? null);
              const saat = teklifSaatiMetni(q.start_time, q.end_time);
              return (
                <li key={q.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-sm text-ink truncate">
                        {musteriAdi}
                        {q.request_no && q.request_no > 1 ? (
                          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-50 ml-2">
                            Talep #{q.request_no}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink-72 mt-0.5">
                        {[tur, tarih ?? 'Tarih belirtilmedi', saat, q.location]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-50 mt-1">
                        Gönderildi{' '}
                        {new Date(q.created_at).toLocaleDateString('tr-TR', {
                          timeZone: KASHE_SAAT_DILIMI,
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display font-semibold text-base text-ink">
                        {formatQuoteAmount(q.total_amount, q.currency)}
                      </p>
                      <p
                        className={`font-mono text-[10px] uppercase tracking-[0.12em] mt-0.5 ${
                          q.durum === 'pending'
                            ? 'text-brand-accent'
                            : q.durum === 'accepted'
                              ? 'text-moss'
                              : 'text-ink-50'
                        }`}
                      >
                        {getQuoteStatusLabel(q.durum)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2.5 text-sm">
                    <Link
                      href={`/mesajlar/${q.conversation_id}`}
                      className="kashe-tap text-brand-ink hover:underline"
                    >
                      Sohbete git →
                    </Link>
                    {rezervasyon && (
                      <Link
                        href={`/rezervasyon/${rezervasyon.id}`}
                        className="kashe-tap text-moss hover:underline"
                      >
                        Rezervasyon
                        {rezervasyon.status === 'cancelled'
                          ? ' (iptal)'
                          : rezervasyon.status === 'completed'
                            ? ' (tamamlandı)'
                            : ''}{' '}
                        →
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PanelKabugu>
  );
}
