// FAZ 7a / P2 — portal gorunumu ortak tipler ve bicimleyiciler.
//
// 'use client' YOKTUR: hem sunucu sayfasi hem istemci islem paneli buradan
// import eder. (CLAUDE.md: istemci modulunden sunucu bilesenine veri import edilmez.)
//
// Portal AYRI YUZEY: burada tablo tipi yok, yalniz `portal_proposal_view`
// RPC'sinin DONDURDUGU alanlar var. Toplamlar DB'de hesaplandi.

/** `portal_proposal_view(p_token)` donusu (jsonb). */
export type PortalTeklif = {
  seller_name: string | null;
  title: string;
  client_name: string | null;
  event: {
    title: string | null;
    event_type: string | null;
    start_date: string | null;
    city: string | null;
    participant_count: number | null;
  } | null;
  version_no: number;
  items: {
    description: string;
    quantity: number | string;
    unit_client_price: number | string;
    total_client_price: number | string;
    role: string | null;
  }[];
  subtotal: number | string;
  tax_rate: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  currency: string;
  valid_until: string | null;
  notes: string | null;
  status: string;
  approved_by_name: string | null;
  approved_at: string | null;
  client_note: string | null;
  /** Baglantinin izinleri: 'view' | 'approve' | 'request_revision'. */
  scope: string[] | null;
  sent_at: string | null;
};

/** Jeton bicimi: `encode(gen_random_bytes(32), 'hex')` -> 64 hex. */
export const JETON_KALIBI = /^[0-9a-f]{64}$/;

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

/** `tax_rate` (0-1) -> yuzde. */
export function kdvYuzdesi(oran: number | string | null | undefined): number {
  const n = Number(oran);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 10;
}

/** "3 Ekim 2026" */
export function tarihMetni(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "3 Ekim 2026 14:05" */
export function zamanMetni(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Gecerlilik gecmis mi (sunucuda hesaplanir; band rengi icin). */
export function suresiDoldu(validUntil: string | null | undefined): boolean {
  if (!validUntil) return false;
  const d = new Date(validUntil);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

/**
 * RPC hatasini portal durum metnine cevirir.
 * DB metinleri ASCII; eslesme ona gore (bkz. `fn_faz7_portal_link`).
 */
export function portalDurumMesaji(error: {
  code?: string | null;
  message?: string | null;
}): string {
  const kod = error.code ?? '';
  const mesaj = error.message ?? '';

  if (kod === 'P0002') return 'Bu bağlantı geçersiz.';
  if (kod === '22023') {
    if (mesaj.includes('iptal')) {
      return 'Bu bağlantı iptal edilmiş; kuruluştan yeni bağlantı iste.';
    }
    if (mesaj.includes('suresi dolmus')) return 'Bağlantının süresi dolmuş.';
    if (mesaj.includes('goruntuleme hakki')) {
      return 'Bağlantının görüntüleme hakkı bitmiş.';
    }
    if (mesaj.includes('gonderilmis surum yok')) {
      return 'Teklif henüz gönderilmemiş.';
    }
  }
  return 'Teklif şu an görüntülenemiyor, tekrar dene.';
}
