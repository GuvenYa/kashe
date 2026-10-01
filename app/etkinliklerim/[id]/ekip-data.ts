// FAZ 6 / P2 — ekip ortak tipler ve etiketler.
//
// 'use client' YOKTUR: hem sunucu sayfasi hem istemci paneli buradan import eder.
// (CLAUDE.md: istemci modulunden sunucu bilesenine sabit/veri import edilmez.)

export const EKIP_DURUM_ETIKETLERI: Record<string, string> = {
  draft: 'Taslak',
  proposed: 'Önerildi',
  confirmed: 'Onaylandı',
  cancelled: 'İptal',
};

export const UYE_DURUM_ETIKETLERI: Record<string, string> = {
  proposed: 'Önerildi',
  contacted: 'İletişime geçildi',
  confirmed: 'Onaylandı',
  declined: 'Reddetti',
  replaced: 'Değiştirildi',
};

export const UYE_DURUM_SECENEKLERI = [
  'proposed',
  'contacted',
  'confirmed',
  'declined',
  'replaced',
] as const;

export type UyeDurum = (typeof UYE_DURUM_SECENEKLERI)[number];

/** `crew_members.pool_origin` — tetikleyici yazar, istemci GONDERMEZ. */
export const KAYNAK_ETIKETLERI: Record<string, string> = {
  private: 'Havuz',
  marketplace: 'Pazaryeri',
  external: 'Harici',
};

/** Ic maliyet birimi (`talent_cost_basis`). */
export const MALIYET_BIRIM_SECENEKLERI = [
  'per_job',
  'per_hour',
  'per_day',
] as const;

export type MaliyetBirimi = (typeof MALIYET_BIRIM_SECENEKLERI)[number];

export const MALIYET_BIRIM_ETIKETLERI: Record<string, string> = {
  per_job: 'iş başı',
  per_hour: 'saatlik',
  per_day: 'günlük',
};

/** `crew_rate_source` */
export const MALIYET_KAYNAK_ETIKETLERI: Record<string, string> = {
  default: 'Varsayılan oran',
  manual_override: 'Elle',
  marketplace_quote: 'Pazaryeri teklifi',
};

export type EkipSatiri = {
  id: string;
  event_id: string;
  organization_id: string | null;
  name: string;
  status: string;
  source_policy: string;
  objective: string;
  created_at: string;
};

export type EkipUyesi = {
  id: string;
  crew_id: string;
  role_id: number;
  talent_record_id: string | null;
  provider_id: string | null;
  pool_origin: string;
  status: string;
  is_locked: boolean;
  sort_order: number;
  note: string | null;
  match_candidate_id: string | null;
  created_at: string;
};

/** Panelin gosterdigi uye — sunucuda kurulur (istemci birlestirme yapmaz). */
export type UyeKarti = {
  id: string;
  roleId: number;
  rolAdi: string;
  ad: string;
  sehir: string | null;
  kaynak: string;
  durum: string;
  kilitli: boolean;
  not: string | null;
  /** Pazaryeri saglayicisi varsa profil linki icin. */
  providerId: string | null;
  /** Havuz kaydindan geldiyse "Varsayilan orandan al" anlamli olur. */
  havuzKaydiVar: boolean;
};

/** Kapsam ozeti satiri. */
export type KapsamSatiri = {
  roleId: number;
  rolAdi: string;
  gereken: number;
  onaylanan: number;
  zorunlu: boolean;
};

/** Havuzdan ekleme listesi satiri. */
export type HavuzSecenegi = {
  recordId: string;
  ad: string;
  /** O rol kayitta atanmis mi (atanmislar listede once). */
  roldeVar: boolean;
};

/** Ekip bolumunde rol basina blok: kapsam + aday/havuz secenekleri. */
export type EkipRolBloku = {
  roleId: number;
  rolAdi: string;
  gereken: number;
  zorunlu: boolean;
  /** P1 kosusunun o roldeki profesyonel adaylari (ajans adaylari ekibe eklenmez). */
  adaylar: {
    candidateId: string;
    providerId: string;
    ad: string;
    uyum: number;
    /** Ayni saglayici bu rolde ekipte zaten var mi. */
    ekipte: boolean;
  }[];
  /** Kurulusun havuz kayitlari (yalniz kurulus ekibi + talent.view). */
  havuz: HavuzSecenegi[];
};

/** `internal_crew_commercials_list` satiri (gizli; yalniz RPC). */
export type MaliyetSatiri = {
  crew_member_id: string;
  role_id: number;
  agreed_cost: number | string;
  cost_basis: string;
  currency: string;
  client_price: number | string | null;
  markup_amount: number | string | null;
  margin_rate: number | string | null;
  rate_source: string;
  snapshot_at: string;
  private_note: string | null;
};

/** Tutar gosterimi — TL, Turkce bicim. */
export function tutarMetni(
  tutar: number | string | null | undefined,
  currency = 'TRY'
): string | null {
  if (tutar === null || tutar === undefined || tutar === '') return null;
  const n = Number(tutar);
  if (!Number.isFinite(n)) return null;
  const bicim = new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 2,
  }).format(n);
  return currency === 'TRY' ? `${bicim} TL` : `${bicim} ${currency}`;
}

/** `margin_rate` (0-1 numeric) -> tam sayi yuzde; yoksa null. */
export function marjYuzdesi(
  oran: number | string | null | undefined
): number | null {
  if (oran === null || oran === undefined || oran === '') return null;
  const n = Number(oran);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
