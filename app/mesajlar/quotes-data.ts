/**
 * Quote system için type'lar ve sabitler.
 * 'use server' OLMAYAN dosya — burada async olmayan export'lar yaşar.
 */

export type QuoteStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'withdrawn';

export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';

export type MessageType = 'text' | 'quote' | 'system';

export type Quote = {
  id: string;
  conversation_id: string;
  sender_id: string;
  total_amount: number;
  currency: string;
  services_description: string;
  cancellation_policy: string | null;
  expires_at: string;
  status: QuoteStatus;
  created_at: string;
  responded_at: string | null;
};

export type Booking = {
  id: string;
  quote_id: string;
  conversation_id: string;
  customer_id: string;
  professional_id: string;
  event_date: string | null;
  event_type: string | null;
  location: string | null;
  guest_count: number | null;
  total_amount: number;
  platform_fee: number;
  currency: string;
  status: BookingStatus;
  created_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
  cancellation_reason: string | null;
};

/**
 * Geçerlilik süresi seçenekleri (modal dropdown için)
 */
export const QUOTE_EXPIRY_OPTIONS = [
  { key: '24h', label: '24 saat', hours: 24 },
  { key: '3d', label: '3 gün', hours: 72 },
  { key: '7d', label: '7 gün', hours: 168 },
  { key: '14d', label: '14 gün', hours: 336 },
  { key: '30d', label: '30 gün', hours: 720 },
] as const;

export type QuoteExpiryKey = (typeof QUOTE_EXPIRY_OPTIONS)[number]['key'];

/**
 * Standart iptal politikası şablonları
 */
export const CANCELLATION_POLICY_TEMPLATES = [
  {
    key: 'standard',
    label: 'Standart',
    text: 'Rezervasyon tarihinden 14 gün öncesine kadar iptal edilirse %50 iade. 14 günden sonra iade yapılmaz.',
  },
  {
    key: 'flexible',
    label: 'Esnek',
    text: 'Etkinlik tarihinden 7 gün öncesine kadar tam iade. Sonrasında iade yapılmaz.',
  },
  {
    key: 'strict',
    label: 'Sıkı',
    text: 'Onaylanmış rezervasyon iade edilmez. Tarih değişikliği müsaitlik durumuna göre yapılabilir.',
  },
] as const;

/**
 * Status için Türkçe label ve görsel ton
 */
export function getQuoteStatusLabel(status: QuoteStatus): string {
  const labels: Record<QuoteStatus, string> = {
    pending: 'Bekliyor',
    accepted: 'Onaylandı',
    declined: 'Reddedildi',
    expired: 'Süresi doldu',
    withdrawn: 'Geri çekildi',
  };
  return labels[status];
}

export function getQuoteStatusTone(
  status: QuoteStatus
): 'pending' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'accepted':
      return 'success';
    case 'declined':
      return 'danger';
    case 'expired':
    case 'withdrawn':
      return 'neutral';
  }
}

/**
 * Para formatla: 5000 → "5.000 TL"
 */
export function formatQuoteAmount(amount: number, currency = 'TRY'): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * "X saat sonra sona eriyor" / "Süresi doldu"
 */
export function formatExpiresIn(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs < 0) return 'Süresi doldu';

  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 60) return `${diffMin} dakika kaldı`;
  if (diffHour < 24) return `${diffHour} saat kaldı`;
  return `${diffDay} gün kaldı`;
}

/**
 * Teklif client tarafından onaylanabilir mi?
 */
export function canAcceptQuote(quote: Quote, currentUserId: string): boolean {
  return (
    quote.status === 'pending' &&
    new Date(quote.expires_at) > new Date() &&
    quote.sender_id !== currentUserId // gönderen onaylayamaz
  );
}

/**
 * Teklif gönderen profesyonel tarafından geri çekilebilir mi?
 */
export function canWithdrawQuote(quote: Quote, currentUserId: string): boolean {
  return quote.status === 'pending' && quote.sender_id === currentUserId;
}