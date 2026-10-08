// FAZ 7a / P1 — teklif ortak tipler, etiketler ve bicimleyiciler.
//
// 'use client' YOKTUR: hem sunucu sayfalari hem istemci editoru buradan import eder.
// (CLAUDE.md: istemci modulunden sunucu bilesenine sabit/veri import edilmez.)
//
// Toplamlar DB'de hesaplanir (`proposal_versions.subtotal/tax_amount/total_amount`,
// tetikleyici); burada YALNIZ gosterim bicimi var — istemci toplam hesaplamaz.

// Saat dilimi sabiti ortak modulde (hijyen H6); eski import yollari kirilmasin.
export { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';

export const TEKLIF_DURUM_ETIKETLERI: Record<string, string> = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  viewed: 'Görüntülendi',
  approved: 'Onaylandı',
  revision_requested: 'Revizyon istendi',
  declined: 'Reddedildi/Kapatıldı',
  expired: 'Süresi doldu',
};

/** `internal_item_source` */
export const IC_KALEM_KAYNAK_ETIKETLERI: Record<string, string> = {
  crew_snapshot: 'Ekipten',
  manual: 'Elle',
};

export type TeklifSatiri = {
  id: string;
  title: string;
  client_name: string | null;
  client_email: string | null;
  status: string;
  current_version_id: string | null;
  event_id: string | null;
  crew_id: string | null;
  seller_organization_id: string;
  created_at: string;
  updated_at: string;
};

export type SurumSatiri = {
  id: string;
  proposal_id: string;
  version_no: number;
  subtotal: number | string;
  tax_rate: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  currency: string;
  valid_until: string | null;
  notes: string | null;
  client_note: string | null;
  sent_at: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
};

export type KalemSatiri = {
  id: string;
  proposal_version_id: string;
  role_id: number | null;
  crew_member_id: string | null;
  description: string;
  quantity: number | string;
  unit_client_price: number | string;
  total_client_price: number | string;
  is_visible_to_client: boolean;
  sort_order: number;
};

/** `portal_access_links` — `token_hash` SECILMEZ (sutun yetkisi yok). */
export type PortalBaglantisi = {
  id: string;
  scope: string[] | null;
  recipient_email: string | null;
  expires_at: string;
  max_views: number | null;
  view_count: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

/** `internal_proposal_items_list` satiri (gizli; yalniz RPC). */
export type IcKalemSatiri = {
  item_id: string;
  description: string;
  quantity: number | string;
  unit_client_price: number | string;
  total_client_price: number | string;
  is_visible_to_client: boolean;
  internal_cost: number | string | null;
  markup_amount: number | string | null;
  margin_rate: number | string | null;
  source: string | null;
  private_note: string | null;
  snapshot_at: string | null;
};

/** Tutar gosterimi — TL, Turkce bicim. */
export function paraMetni(
  tutar: number | string | null | undefined,
  currency = 'TRY'
): string | null {
  if (tutar === null || tutar === undefined || tutar === '') return null;
  const n = Number(tutar);
  if (!Number.isFinite(n)) return null;
  const bicim = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
  return currency === 'TRY' ? `${bicim} TL` : `${bicim} ${currency}`;
}

/** `tax_rate` (0-1) -> yuzde (gosterim/giris icin). */
export function kdvYuzdesi(oran: number | string | null | undefined): number {
  const n = Number(oran);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 10;
}

/** `margin_rate` (0-1) -> tam sayi yuzde; yoksa null. */
export function marjYuzdesi(
  oran: number | string | null | undefined
): number | null {
  if (oran === null || oran === undefined || oran === '') return null;
  const n = Number(oran);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

// Bicimleyiciler ortak modulden gelir (hijyen H6: tek kaynak `app/lib/tarih.ts`).
// Mevcut cagiranlar bu dosyadan import etmeye devam edebilsin diye re-export.
export { tarihMetni, zamanMetni, tarihAlani } from '@/app/lib/tarih';

/**
 * FAZ 7c — onayli tekliften acilan rezervasyon (surum basina tek satir).
 * Rezervasyon YALNIZ `booking_from_proposal` RPC'siyle acilir.
 */
export type TeklifRezervasyonu = {
  id: string;
  status: string;
  created_at: string;
};

export const REZERVASYON_DURUM_ETIKETLERI: Record<string, string> = {
  confirmed: 'Onaylı',
  cancelled: 'İptal',
  completed: 'Tamamlandı',
};
