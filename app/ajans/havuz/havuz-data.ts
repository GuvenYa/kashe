// Yetenek havuzu — ortak tipler ve etiketler.
//
// 'use client' YOKTUR: hem sunucu sayfasi hem istemci paneli buradan import eder.
// (CLAUDE.md: istemci modulunden sunucu bilesenine sabit/veri import edilmez.)

export type HavuzRolSatiri = {
  id: string;
  role_id: number;
  is_primary: boolean;
  service_roles: { slug: string; name_tr: string } | null;
};

export type HavuzKaydi = {
  id: string;
  talent_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  city_id: number | null;
  instagram: string | null;
  notes: string | null;
  source: string;
  relationship_type: string;
  status: string;
  invitation_status: string;
  invitation_sent_at: string | null;
  linked_at: string | null;
  created_at: string;
  legacy_agency_member_id: string | null;
  turkish_cities: { name: string } | null;
  organization_talent_record_roles: HavuzRolSatiri[] | null;
  /** `talents.id` != `profiles.id`; pazaryeri bilgisi icin kullanici id'si buradan gelir. */
  talents: { user_id: string } | null;
  /**
   * FAZ 5/P3-ek: kayit AKTIF bir Ekibim uyeliginden geliyor mu (sunucuda turetilir).
   * Yalniz bu durumda Sil gizlenir; `talent_id` dolu olmasi yetmez (P2 sahiplenme ve
   * P3 pazaryeri eklemesi de `talent_id` doldurur).
   */
  ekibimUyesi: boolean;
};

/** `v_providers_public`'ten gelen saglayici bilgisi (yalniz Kashe uyesi satirlar icin). */
export type HavuzSaglayici = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  provider_slug: string;
  city_id: number | null;
  is_published: boolean;
};

export type HavuzRolSecenegi = { id: number; slug: string; name_tr: string };
export type HavuzSehir = { id: number; name: string };

export const ILISKI_ETIKETLERI: Record<string, string> = {
  staff: 'Kadrolu',
  regular_freelancer: 'Düzenli serbest',
  occasional: 'Ara sıra',
  subcontractor: 'Taşeron',
};

export const DURUM_ETIKETLERI: Record<string, string> = {
  active: 'Aktif',
  passive: 'Pasif',
  blocked: 'Engelli',
};

export const DAVET_ETIKETLERI: Record<string, string> = {
  none: 'Davet yok',
  sent: 'Gönderildi',
  accepted: 'Kabul edildi',
  declined: 'Reddedildi',
};

export const ILISKI_SECENEKLERI = [
  'staff',
  'regular_freelancer',
  'occasional',
  'subcontractor',
] as const;

export const DURUM_SECENEKLERI = ['active', 'passive', 'blocked'] as const;

/**
 * Form/action ortak tipleri BURADA durur: `havuz-actions.ts` bir `'use server'`
 * modulu ve yalniz async fonksiyon export etmelidir; istemci paneli tipleri
 * oradan degil buradan alir.
 */
export type HavuzIliskiTuru = (typeof ILISKI_SECENEKLERI)[number];
export type HavuzDurum = (typeof DURUM_SECENEKLERI)[number];
export type HavuzRolGirdisi = { roleId: number; isPrimary: boolean };

/** FAZ 5/P2 — `internal_talent_rates_list` satiri (gizli ic oran). */
export type HavuzOranSatiri = {
  id: string;
  role_id: number;
  role_slug: string;
  role_name: string;
  default_cost: number;
  cost_basis: string;
  currency: string;
  valid_from: string;
  valid_to: string | null;
  private_note: string | null;
  created_at: string;
};

export const ORAN_BIRIM_SECENEKLERI = [
  'per_job',
  'per_hour',
  'per_day',
] as const;

export type HavuzOranBirimi = (typeof ORAN_BIRIM_SECENEKLERI)[number];

export const ORAN_BIRIM_ETIKETLERI: Record<string, string> = {
  per_job: 'iş başı',
  per_hour: 'saatlik',
  per_day: 'günlük',
};

/** Tutar gosterimi — TL, Turkce bicim. */
export function tutarMetni(tutar: number, currency: string): string {
  const bicim = new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 2,
  }).format(tutar);
  return currency === 'TRY' ? `${bicim} TL` : `${bicim} ${currency}`;
}
