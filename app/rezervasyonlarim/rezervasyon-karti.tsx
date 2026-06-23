import Link from 'next/link';
import { getEventTypeLabel } from '@/app/mesajlar/data';
import { getCategoryIcon } from '@/app/lib/category-icon';

type Booking = {
  id: string;
  conversation_id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  event_type: string | null;
  location: string | null;
  guest_count: number | null;
  total_amount: number;
  currency: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  professional?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
    service_categories: { name_tr: string; slug: string } | null;
  } | null;
  customer?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
  } | null;
};

const TONES = [
  { bg: 'rgba(31,92,74,0.12)',   fg: '#1F5C4A' },
  { bg: 'rgba(226,103,74,0.12)', fg: '#E2674A' },
  { bg: 'rgba(45,111,184,0.12)', fg: '#2D6FB8' },
  { bg: 'rgba(181,133,31,0.12)', fg: '#B5851F' },
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

// "14:00:00" → "14:00"; başlangıç+bitiş → "14:00–18:00"; sadece başlangıç → "14:00"
function formatEventTime(
  start: string | null,
  end: string | null
): string | null {
  if (!start) return null;
  const s = start.slice(0, 5);
  if (end) return `${s}–${end.slice(0, 5)}`;
  return s;
}

const STATUS_STYLES: Record<
  Booking['status'],
  { label: string; classes: string }
> = {
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
};

export function RezervasyonKarti({
  booking: b,
  viewer,
}: {
  booking: Booking;
  viewer: 'customer' | 'professional';
}) {
  const otherParty = viewer === 'customer' ? b.professional : b.customer;

  const displayName = otherParty
    ? (otherParty.role === 'business' || otherParty.role === 'agency') &&
      otherParty.company_name
      ? otherParty.company_name
      : otherParty.full_name || 'İsimsiz'
    : 'İsimsiz';

  const initials = displayName
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const tone = pickTone(otherParty?.id ?? b.id);
  const categoryLabel =
    viewer === 'customer' && b.professional?.service_categories
      ? b.professional.service_categories.name_tr
      : null;

  const statusStyle = STATUS_STYLES[b.status];

  return (
    <Link
      href={`/rezervasyon/${b.id}`}
      className="kashe-tap group block bg-card border border-line rounded-2xl p-5 md:p-6 transition-all hover:border-terracotta hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-16px_rgba(26,18,14,0.18)]"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="shrink-0">
          {otherParty?.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={otherParty.avatar_url}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover border border-line"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-display font-semibold text-sm"
              style={{ background: tone.bg, color: tone.fg }}
            >
              {initials}
            </div>
          )}
        </div>

        {/* İçerik */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-display font-semibold text-lg text-ink leading-tight truncate group-hover:text-terracotta transition-colors">
                {displayName}
              </p>
              {categoryLabel && (
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mt-0.5">
                  {categoryLabel}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] border ${statusStyle.classes}`}
            >
              {statusStyle.label}
            </span>
          </div>

          {/* Etkinlik özeti — kompakt satır */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-72">
            <span className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="font-medium text-ink">{formatEventDate(b.event_date)}</span>
            </span>
            {formatEventTime(b.start_time, b.end_time) && (
              <span className="flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-medium text-ink">{formatEventTime(b.start_time, b.end_time)}</span>
              </span>
            )}
            {b.event_type && (
              <span>{getEventTypeLabel(b.event_type) ?? b.event_type}</span>
            )}
            {b.location && (
              <span className="truncate max-w-[200px]">{b.location}</span>
            )}
            {b.guest_count !== null && b.guest_count !== undefined && (
              <span>{b.guest_count} kişi</span>
            )}
          </div>

          {/* Alt satır — fiyat + detaya git oku */}
          <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
            <span className="font-display font-semibold text-base text-ink">
              {formatPrice(b.total_amount, b.currency)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta inline-flex items-center gap-1 transition-transform group-hover:translate-x-1">
              Detay
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
