import { createClient } from '@/app/lib/supabase-server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { Eyebrow } from '@/app/components/ui/eyebrow';
import { getEventTypeLabel } from '@/app/mesajlar/data';
import { RezervasyonAksiyonlari } from './aksiyonlar';

type Props = {
  params: Promise<{ id: string }>;
};

type BookingDetay = {
  id: string;
  quote_id: string;
  conversation_id: string;
  customer_id: string;
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
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  completed_at: string | null;
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
  quote: {
    id: string;
    services_description: string | null;
    cancellation_policy: string | null;
  } | null;
};

const TONES = [
  { bg: 'rgba(109,79,176,0.12)', fg: '#6D4FB0' }, // mor
  { bg: 'rgba(45,111,184,0.12)', fg: '#2D6FB8' }, // mavi
  { bg: 'rgba(181,133,31,0.12)', fg: '#B5851F' }, // altın
  { bg: 'rgba(226,103,74,0.12)', fg: '#E2674A' }, // mercan
  { bg: 'rgba(31,138,95,0.12)', fg: '#1F8A5F' },  // yeşil
];

function pickTone(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return TONES[h % TONES.length];
}

function formatPrice(amount: number, currency: string) {
  const symbol = currency === 'TRY' ? '₺' : currency + ' ';
  return `${symbol}${Math.round(amount).toLocaleString('tr-TR')}`;
}

function formatEventDate(iso: string | null): string {
  if (!iso) return 'Tarih belirlenmedi';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatEventTime(
  start: string | null,
  end: string | null
): string | null {
  if (!start) return null;
  const s = start.slice(0, 5);
  if (end) return `${s}–${end.slice(0, 5)}`;
  return s;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_STYLES = {
  confirmed: {
    label: 'Onaylandı',
    classes: 'bg-moss/10 text-moss border-moss/30',
  },
  completed: {
    label: 'Tamamlandı',
    classes: 'bg-ink-72/10 text-ink-72 border-ink-72/20',
  },
  cancelled: {
    label: 'İptal edildi',
    classes: 'bg-terracotta/10 text-terracotta border-terracotta/30',
  },
} as const;

export async function generateMetadata({ params }: Props) {
  await params;
  return { title: 'Rezervasyon — Kashe' };
}

export default async function RezervasyonDetayPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/giris?redirect=/rezervasyon/${id}`);
  }

  // Suspension kontrolü — askıdaki kullanıcı rezervasyon detayına giremez
  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) redirect('/askiya-alindi');

  const { data: bookingData } = await supabase
    .from('bookings')
    .select(
      `
      id, quote_id, conversation_id, customer_id, professional_id,
      event_date, start_time, end_time, event_type, location, guest_count,
      total_amount, currency, status,
      created_at, cancelled_at, cancelled_by, cancellation_reason, completed_at,
      customer:profiles!bookings_customer_id_fkey (
        id, full_name, avatar_url, company_name, role
      ),
      professional:profiles!bookings_professional_id_fkey (
        id, full_name, avatar_url, company_name, role,
        service_categories!profiles_primary_category_id_fkey (name_tr, slug)
      ),
      quote:quotes!bookings_quote_id_fkey (
        id, services_description, cancellation_policy
      )
    `
    )
    .eq('id', id)
    .single();

  const booking = bookingData as unknown as BookingDetay | null;

  if (!booking) {
    notFound();
  }

  const isCustomer = booking.customer_id === user.id;
  const isProfessional = booking.professional_id === user.id;

  if (!isCustomer && !isProfessional) {
    notFound();
  }

  const viewer = isCustomer ? 'customer' : 'professional';
  const otherParty = viewer === 'customer' ? booking.professional : booking.customer;
  const otherName = otherParty
    ? (otherParty.role === 'business' || otherParty.role === 'agency') &&
      otherParty.company_name
      ? otherParty.company_name
      : otherParty.full_name || 'İsimsiz'
    : 'İsimsiz';

  const initials = otherName
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const tone = pickTone(otherParty?.id ?? booking.id);
  const statusStyle = STATUS_STYLES[booking.status];
  const cancelledByCustomer = booking.cancelled_by === booking.customer_id;
  const backHref = viewer === 'customer' ? '/rezervasyonlarim' : '/takvimim';
  const backLabel = viewer === 'customer' ? 'Rezervasyonlarım' : 'Takvimim';

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-10 md:py-14">
        <div className="max-w-3xl mx-auto">
          {/* Geri linki */}
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-72 hover:text-terracotta transition-colors mb-6"
          >
            <span>←</span>
            {backLabel}
          </Link>

          {/* HEADER */}
          <div className="bg-card border border-line rounded-2xl p-6 md:p-8 mb-6">
            <div className="flex items-start gap-5">
              <div className="shrink-0">
                {otherParty?.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={otherParty.avatar_url}
                    alt={otherName}
                    className="w-16 h-16 rounded-full object-cover border border-line"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center font-display font-semibold text-xl"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Eyebrow variant="inline" className="mb-2">
                  {viewer === 'customer' ? 'Profesyonel' : 'Müşteri'}
                </Eyebrow>
                <Link
                  href={viewer === 'customer' ? `/p/${otherParty?.id}` : '#'}
                  className="font-display font-semibold text-2xl text-ink hover:text-terracotta transition-colors block"
                >
                  {otherName}
                </Link>
                {viewer === 'customer' &&
                  booking.professional?.service_categories && (
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-72 mt-1">
                      {booking.professional.service_categories.name_tr}
                    </p>
                  )}
              </div>
              <span
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-[0.14em] border ${statusStyle.classes}`}
              >
                {statusStyle.label}
              </span>
            </div>
          </div>

          {/* İPTAL DETAYI (varsa) */}
          {booking.status === 'cancelled' && (
            <div className="bg-terracotta/[0.04] border border-terracotta/20 rounded-2xl p-5 md:p-6 mb-6">
              <Eyebrow variant="inline" className="mb-2 text-terracotta">
                İptal kaydı
              </Eyebrow>
              <p className="text-sm text-ink leading-relaxed">
                {cancelledByCustomer ? 'Müşteri' : 'Profesyonel'} bu rezervasyonu
                iptal etti.
                {booking.cancelled_at && (
                  <>
                    {' '}
                    <span className="text-ink-72">
                      ({formatDateTime(booking.cancelled_at)})
                    </span>
                  </>
                )}
              </p>
              {booking.cancellation_reason && (
                <p className="text-sm text-ink-72 mt-2 leading-relaxed">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 block mb-1">
                    Sebep
                  </span>
                  {booking.cancellation_reason}
                </p>
              )}
            </div>
          )}

          {/* TAMAMLANMA KAYDI */}
          {booking.status === 'completed' && booking.completed_at && (
            <div className="bg-moss/[0.06] border border-moss/25 rounded-2xl p-5 md:p-6 mb-6 flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-0.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="var(--color-moss)" strokeWidth="1.5" />
                <path d="M8 12.5l3 3 5-6" stroke="var(--color-moss)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <p className="text-sm text-ink font-medium">
                  İş tamamlandı.
                </p>
                <p className="text-xs text-ink-72 mt-0.5">
                  {formatDateTime(booking.completed_at)}
                </p>
              </div>
            </div>
          )}

          {/* ETKİNLİK DETAY */}
          <div className="bg-card border border-line rounded-2xl p-6 md:p-8 mb-6">
            <Eyebrow variant="inline" className="mb-5">
              Etkinlik
            </Eyebrow>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-1">
                  Tarih
                </dt>
                <dd className="text-base text-ink">
                  {formatEventDate(booking.event_date)}
                </dd>
              </div>
              {formatEventTime(booking.start_time, booking.end_time) && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-1">
                    Saat
                  </dt>
                  <dd className="text-base text-ink">
                    {formatEventTime(booking.start_time, booking.end_time)}
                  </dd>
                </div>
              )}
              {booking.event_type && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-1">
                    Tür
                  </dt>
                  <dd className="text-base text-ink">
                    {getEventTypeLabel(booking.event_type) ?? booking.event_type}
                  </dd>
                </div>
              )}
              {booking.location && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-1">
                    Lokasyon
                  </dt>
                  <dd className="text-base text-ink">{booking.location}</dd>
                </div>
              )}
              {booking.guest_count !== null && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-1">
                    Kişi sayısı
                  </dt>
                  <dd className="text-base text-ink">{booking.guest_count}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* HİZMET AÇIKLAMASI (quote'tan) */}
          {booking.quote?.services_description && (
            <div className="bg-card border border-line rounded-2xl p-6 md:p-8 mb-6">
              <Eyebrow variant="inline" className="mb-3">
                Hizmet kapsamı
              </Eyebrow>
              <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                {booking.quote.services_description}
              </p>
            </div>
          )}

          {/* İPTAL POLİTİKASI (quote'tan) */}
          {booking.quote?.cancellation_policy && (
            <div className="bg-paper-2 border border-line rounded-2xl p-6 md:p-7 mb-6">
              <Eyebrow variant="inline" className="mb-3">
                İptal politikası
              </Eyebrow>
              <p className="text-sm text-ink-72 leading-relaxed whitespace-pre-wrap">
                {booking.quote.cancellation_policy}
              </p>
            </div>
          )}

          {/* FİYAT */}
          <div className="bg-card border border-line rounded-2xl p-6 md:p-8 mb-6">
            <div className="flex items-center justify-between gap-4">
              <Eyebrow variant="inline">Anlaşılan tutar</Eyebrow>
              <p className="font-display font-semibold text-2xl text-ink">
                {formatPrice(booking.total_amount, booking.currency)}
              </p>
            </div>
            <p className="text-xs text-ink-50 mt-3 leading-relaxed">
              Rezervasyon onayı {formatDateTime(booking.created_at)}'de
              gerçekleşti.
            </p>
          </div>

          {/* KONUŞMAYA GİT */}
          <Link
            href={`/mesajlar/${booking.conversation_id}`}
            className="block bg-card border border-line rounded-2xl p-5 mb-6 hover:border-terracotta transition-colors group"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-terracotta/10 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="var(--color-terracotta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="font-display font-semibold text-base text-ink group-hover:text-terracotta transition-colors">
                    Konuşmaya git
                  </p>
                  <p className="text-xs text-ink-72 mt-0.5">
                    Mesajlaşma + teklif geçmişi
                  </p>
                </div>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta inline-flex items-center gap-1 transition-transform group-hover:translate-x-1">
                Aç
                <span>→</span>
              </span>
            </div>
          </Link>

          {/* AKSİYONLAR — iptal/tamamlama */}
          {booking.status === 'confirmed' && (
            <RezervasyonAksiyonlari
              bookingId={booking.id}
              viewer={viewer}
              cancellationPolicy={booking.quote?.cancellation_policy ?? null}
            />
          )}
        </div>
      </main>
    </>
  );
}
