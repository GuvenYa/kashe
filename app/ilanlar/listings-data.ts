/**
 * Listings (İlanlar) + Applications (Başvurular) için type'lar ve sabitler.
 * 'use server' OLMAYAN dosya — async olmayan export'lar burada yaşar.
 */

import { EVENT_TYPES, type EventTypeKey } from '../mesajlar/data';

// =============================================================================
// Status enums
// =============================================================================

export type ListingStatus =
  | 'draft'
  | 'pending_approval'
  | 'revision'
  | 'rejected'
  | 'published'
  | 'closed'
  | 'filled'
  | 'cancelled';

export type ApplicationStatus =
  | 'pending'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

// =============================================================================
// Row types (DB shape)
// =============================================================================

export type Listing = {
  id: string;
  creator_id: string;
  category_id: number;
  title: string;
  description: string;
  requirements: string | null;
  event_date: string | null;
  event_type: EventTypeKey | null;
  location: string | null;
  city_id: number | null;
  guest_count: number | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  status: ListingStatus;
  expires_at: string | null;
  views_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  approval_note: string | null;
};

export type Application = {
  id: string;
  listing_id: string;
  applicant_id: string;
  cover_message: string;
  proposed_amount: number | null;
  currency: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
};

// Joined types (UI'da kullanılan)

export type ListingWithRelations = Listing & {
  service_categories: { name_tr: string; emoji: string | null; slug: string } | null;
  turkish_cities: { name: string } | null;
  creator: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
  } | null;
  application_count?: number;
};

export type ApplicationWithRelations = Application & {
  applicant: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
    bio: string | null;
  } | null;
  listing?: Pick<Listing, 'id' | 'title' | 'status' | 'creator_id'> | null;
};

// =============================================================================
// Constants — UI dropdown / filter için
// =============================================================================

export const LISTING_STATUS_OPTIONS: { key: ListingStatus; label: string }[] = [
  { key: 'draft', label: 'Taslak' },
  { key: 'pending_approval', label: 'Onay bekliyor' },
  { key: 'revision', label: 'Revizyon istendi' },
  { key: 'rejected', label: 'Reddedildi' },
  { key: 'published', label: 'Yayında' },
  { key: 'closed', label: 'Kapatıldı' },
  { key: 'filled', label: 'Dolduruldu' },
  { key: 'cancelled', label: 'İptal' },
];

export const APPLICATION_STATUS_OPTIONS: {
  key: ApplicationStatus;
  label: string;
}[] = [
  { key: 'pending', label: 'Bekliyor' },
  { key: 'shortlisted', label: 'Kısa listede' },
  { key: 'accepted', label: 'Kabul edildi' },
  { key: 'rejected', label: 'Reddedildi' },
  { key: 'withdrawn', label: 'Geri çekildi' },
];

// =============================================================================
// Bütçe için hızlı seçenekler (form dropdown'larında)
// =============================================================================

export const BUDGET_PRESETS = [
  { key: 'open', label: 'Bütçeni belirtmek istemiyorum', min: null, max: null },
  { key: '0_5k', label: '0 - 5.000 TL', min: 0, max: 5000 },
  { key: '5k_15k', label: '5.000 - 15.000 TL', min: 5000, max: 15000 },
  { key: '15k_30k', label: '15.000 - 30.000 TL', min: 15000, max: 30000 },
  { key: '30k_60k', label: '30.000 - 60.000 TL', min: 30000, max: 60000 },
  { key: '60k_100k', label: '60.000 - 100.000 TL', min: 60000, max: 100000 },
  { key: '100k_plus', label: '100.000 TL+', min: 100000, max: null },
  { key: 'custom', label: 'Özel bir aralık gir', min: null, max: null },
] as const;

export type BudgetPresetKey = (typeof BUDGET_PRESETS)[number]['key'];

// =============================================================================
// Helpers — UI formatting
// =============================================================================

/**
 * Status için Türkçe label
 */
export function getListingStatusLabel(status: ListingStatus): string {
  return (
    LISTING_STATUS_OPTIONS.find((s) => s.key === status)?.label ?? status
  );
}

export function getApplicationStatusLabel(status: ApplicationStatus): string {
  return (
    APPLICATION_STATUS_OPTIONS.find((s) => s.key === status)?.label ?? status
  );
}

/**
 * Status için görsel ton (UI rozetlerinde renk seçimi için)
 */
export function getListingStatusTone(
  status: ListingStatus
): 'pending' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'draft':
      return 'neutral';
    case 'pending_approval':
    case 'revision':
      return 'pending';
    case 'rejected':
      return 'danger';
    case 'published':
      return 'success';
    case 'closed':
    case 'cancelled':
      return 'danger';
    case 'filled':
      return 'success';
  }
}

export function getApplicationStatusTone(
  status: ApplicationStatus
): 'pending' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'shortlisted':
      return 'pending';
    case 'accepted':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'withdrawn':
      return 'neutral';
  }
}

/**
 * Bütçe aralığını formatla:
 *   - min=5000, max=15000 → "5.000 – 15.000 TL"
 *   - min=null, max=null → "Bütçe belirtilmemiş"
 *   - min=100000, max=null → "100.000 TL+"
 *   - min=null, max=5000 → "5.000 TL'ye kadar"
 */
export function formatBudgetRange(
  min: number | null,
  max: number | null,
  currency = 'TRY'
): string {
  if (min === null && max === null) {
    return 'Bütçe belirtilmemiş';
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(v);
  const currencyLabel = currency === 'TRY' ? 'TL' : currency;

  if (min !== null && max !== null) {
    return `${fmt(min)} – ${fmt(max)} ${currencyLabel}`;
  }
  if (min !== null) {
    return `${fmt(min)} ${currencyLabel}+`;
  }
  // max !== null
  return `${fmt(max!)} ${currencyLabel}'ye kadar`;
}

/**
 * "X gün önce yayınlandı" / "Az önce yayınlandı"
 */
export function formatListingAge(publishedAt: string | null): string {
  if (!publishedAt) return '';

  const date = new Date(publishedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Az önce yayınlandı';
  if (diffMin < 60) return `${diffMin} dakika önce yayınlandı`;
  if (diffHour < 24) return `${diffHour} saat önce yayınlandı`;
  if (diffDay < 7) return `${diffDay} gün önce yayınlandı`;
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * "Şu süre kaldı" — expires_at için
 */
export function formatExpiresIn(expiresAt: string | null): string | null {
  if (!expiresAt) return null;

  const date = new Date(expiresAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs < 0) return 'Süresi doldu';

  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 60) return `${diffMin} dakika kaldı`;
  if (diffHour < 24) return `${diffHour} saat kaldı`;
  return `${diffDay} gün kaldı`;
}

/**
 * Listing fiyat teklifi UI'da gösterilebilir mi?
 */
export function formatProposedAmount(
  amount: number | null,
  currency = 'TRY'
): string | null {
  if (amount === null) return null;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Event type label'ı için mesajlar/data.ts'teki helper'ı re-export ediyoruz.
 * Tek noktadan değişim — Türkçe label tek yerden geliyor.
 */
export { getEventTypeLabel } from '../mesajlar/data';

/**
 * Listing oluşturma/güncelleme için minimum doğrulamalar.
 * Form submit öncesi client-side hızlı validate için.
 */
export function validateListingInput(input: {
  title: string;
  description: string;
  category_id: number | null;
}): string | null {
  if (!input.category_id) return 'Kategori seçmelisin';
  if (input.title.trim().length < 3) return 'Başlık en az 3 karakter olmalı';
  if (input.title.length > 200) return 'Başlık 200 karakteri geçemez';
  if (input.description.trim().length < 10)
    return 'Açıklama en az 10 karakter olmalı';
  if (input.description.length > 5000)
    return 'Açıklama 5000 karakteri geçemez';
  return null;
}

/**
 * Başvuru için minimum doğrulamalar
 */
export function validateApplicationInput(input: {
  cover_message: string;
  proposed_amount: number | null;
}): string | null {
  if (input.cover_message.trim().length < 20)
    return 'Başvuru mesajı en az 20 karakter olmalı';
  if (input.cover_message.length > 2000)
    return 'Başvuru mesajı 2000 karakteri geçemez';
  if (input.proposed_amount !== null && input.proposed_amount < 0)
    return 'Fiyat teklifi negatif olamaz';
  return null;
}

/**
 * Status'e göre transition izinleri.
 * UI'da action butonları gösterirken kullan.
 */
// Kullanıcı "yayınla"ya basabilir mi? draft veya revision/rejected'tan tekrar gönderebilir.
export function canPublishListing(status: ListingStatus): boolean {
  return status === 'draft' || status === 'revision' || status === 'rejected';
}

export function canCloseListing(status: ListingStatus): boolean {
  return status === 'published';
}

export function canCancelListing(status: ListingStatus): boolean {
  return (
    status === 'draft' ||
    status === 'published' ||
    status === 'pending_approval' ||
    status === 'revision'
  );
}

// Düzenlenebilir: yayında değilken serbest. published de düzenlenebilir (karar a, yeniden onaya girmez).
export function canEditListing(status: ListingStatus): boolean {
  return (
    status === 'draft' ||
    status === 'published' ||
    status === 'revision' ||
    status === 'rejected' ||
    status === 'pending_approval'
  );
}

// Başvuru sadece yayında ilana yapılır
export function canApplyToListing(status: ListingStatus): boolean {
  return status === 'published';
}

export function canWithdrawApplication(status: ApplicationStatus): boolean {
  return status === 'pending' || status === 'shortlisted';
}

export function canShortlistApplication(status: ApplicationStatus): boolean {
  return status === 'pending';
}

export function canAcceptApplication(status: ApplicationStatus): boolean {
  return status === 'pending' || status === 'shortlisted';
}

export function canRejectApplication(status: ApplicationStatus): boolean {
  return status === 'pending' || status === 'shortlisted';
}