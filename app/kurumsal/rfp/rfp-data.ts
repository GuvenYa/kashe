// FAZ 7b / P1 — RFP (teklif talebi) ortak tipler ve etiketler.
//
// 'use client' YOKTUR: hem sunucu sayfalari hem istemci editorleri buradan
// import eder. (CLAUDE.md: istemci modulunden sunucu bilesenine veri import edilmez.)
//
// ADLANDIRMA: kullaniciya "RFP" / "Teklif talebi (RFP)" diye gorunur; eski
// pazaryeri akisi `/teklif-taleplerim` (quote_requests) ile KARISTIRILMAZ.
//
// Butce ipucu (`budget_hint_min/max`) YALNIZ alici ekranindadir: `rfp_items`
// tablosunda bu sutunlarin SELECT yetkisi yok; alici degerleri `rfp_detail`
// JSON'undan okur, satici JSON'unda alan HIC bulunmaz.

export const RFP_DURUM_ETIKETLERI: Record<string, string> = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  collecting: 'Yanıt toplanıyor',
  evaluating: 'Değerlendiriliyor',
  awarded: 'Seçim yapıldı',
  cancelled: 'İptal',
};

export const RFP_DURUM_SINIFLARI: Record<string, string> = {
  draft: 'bg-paper-2 border-line text-ink-72',
  sent: 'bg-brand-ink-08 border-brand-ink/25 text-brand-ink',
  collecting: 'bg-brand-ink-08 border-brand-ink/25 text-brand-ink',
  evaluating: 'bg-amber-500/10 border-amber-500/40 text-ink',
  awarded: 'bg-moss/10 border-moss/40 text-ink',
  cancelled: 'bg-paper-2 border-line text-ink-72',
};

export const DAVET_DURUM_ETIKETLERI: Record<string, string> = {
  sent: 'Davet edildi',
  viewed: 'Görüntüledi',
  responded: 'Yanıtladı',
  declined: 'Reddetti',
  not_selected: 'Seçilmedi',
};

/** `/kurumsal/rfp` liste satiri (RLS: kurulusun talepleri). */
export type RfpListeSatiri = {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  created_at: string;
  organization_id: string;
  event: { id: string; title: string | null; start_date: string | null } | null;
};

/** `rfp_detail` kalem alani (ipucu alanlari YALNIZ alicida gelir). */
export type RfpKalem = {
  id: string;
  role_id: number;
  role: string;
  quantity: number | string;
  is_required: boolean;
  notes: string | null;
  sort_order: number;
  budget_hint_min?: number | string | null;
  budget_hint_max?: number | string | null;
};

/** `rfp_detail` davet alani (yalniz alicida). */
export type RfpDavet = {
  id: string;
  provider_id: string;
  seller_name: string | null;
  status: string;
  proposal_id: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  proposal_status: string | null;
  version_no: number | null;
  subtotal: number | string | null;
  tax_amount: number | string | null;
  total_amount: number | string | null;
  valid_until: string | null;
  sent_at: string | null;
};

/** `rfp_detail` donusu (role gore: alici `invites`, satici `my_invite`). */
export type RfpDetay = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  deadline: string | null;
  organization_id: string;
  buyer_name: string | null;
  event: {
    id: string;
    title: string | null;
    event_type: string | null;
    start_date: string | null;
    end_date: string | null;
    city: string | null;
    district: string | null;
    participant_count: number | null;
  } | null;
  items: RfpKalem[];
  awarded_proposal_id: string | null;
  created_at: string;
  is_buyer: boolean;
  invites?: RfpDavet[];
  my_invite?: {
    id: string;
    status: string;
    proposal_id: string | null;
    viewed_at: string | null;
    responded_at: string | null;
  };
};

export type RolSecenegi = { id: number; name_tr: string };

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

/** Butce ipucu araligi metni (yalniz alici ekraninda). */
export function ipucuMetni(
  min: number | string | null | undefined,
  max: number | string | null | undefined
): string | null {
  const a = paraMetni(min);
  const b = paraMetni(max);
  if (a && b) return `${a} – ${b}`;
  return a ?? b ?? null;
}

/** Son tarih gecmis mi. */
export function sonTarihGecti(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}
