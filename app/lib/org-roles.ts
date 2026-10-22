/**
 * FAZ 8-U — kurulus uyelik rolleri: etiket ve yetki ozetleri (TEK KAYNAK).
 *
 * 'use client' YOKTUR: hem sunucu sayfalari hem istemci listeleri buradan okur.
 *
 * Ozetler UYDURULMAZ: her biri `org_role_permissions(role)` dizisinin Turkce
 * karsiligidir (bkz. 20260915150100_faz0_02_fonksiyonlar_aynalama.sql ~151).
 * Matris degisirse once o fonksiyon, sonra buradaki ozet guncellenir.
 *
 * Yetki anahtari -> Turkce karsilik:
 *   events.*     etkinlik       crew.*       ekip
 *   talent.*     yetenek havuzu proposals.*  teklif
 *   commercial.* ic maliyet     finance.*    finans
 *   settings.manage ayarlar     members.manage uyeler
 *   billing.manage  faturalama
 */

/** Enum sirasi (`public.organization_member_role`) — secim kutusu bu sirayi izler. */
export const ORG_ROLES = [
  'owner',
  'admin',
  'sales',
  'project_manager',
  'crew_coordinator',
  'finance',
  'viewer',
] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Sahip',
  admin: 'Yönetici',
  sales: 'Satış',
  project_manager: 'Proje yöneticisi',
  crew_coordinator: 'Ekip koordinatörü',
  finance: 'Finans',
  viewer: 'İzleyici',
};

export const ORG_ROLE_SUMMARIES: Record<OrgRole, string> = {
  // 19 izin: tum yetkiler + billing.manage + crm.* + suppliers.*
  owner:
    'Her şeyi yönetir: etkinlik, ekip, havuz, teklif, müşteriler, tedarikçiler, iç maliyet, finans, ayarlar, üyeler ve faturalama.',
  // 18 izin: owner eksi billing.manage
  admin:
    'Faturalama dışında her şeyi yönetir: etkinlik, ekip, havuz, teklif, müşteriler, tedarikçiler, iç maliyet, finans, ayarlar ve üyeler.',
  // events.view/manage, crew.view, talent.view, proposals.view/manage, crm.view/manage, suppliers.view
  sales:
    'Etkinlikleri yönetir, ekibi ve havuzu görür, teklif açar ve gönderir, müşteri ve fırsatları yönetir, tedarikçileri görür. İç maliyeti görmez.',
  // events.view/manage, crew.view/manage, talent.view/manage, proposals.view, crm.view, suppliers.view/manage
  project_manager:
    'Etkinlikleri, ekibi ve tedarikçileri yönetir, havuzu düzenler, teklifleri ve müşterileri görür. İç maliyeti görmez.',
  // events.view, crew.view/manage, talent.view/manage, suppliers.view/manage
  crew_coordinator:
    'Etkinlikleri görür; ekibi, havuzu ve tedarikçileri yönetir. Teklif, müşteri ve iç maliyet yetkisi yoktur.',
  // events.view, crew.view, talent.view, commercial.view/manage, proposals.view, finance.view/manage, crm.view, suppliers.view
  finance:
    'Etkinlik, ekip, havuz ve tedarikçileri görür; teklifleri ve müşterileri görür; iç maliyet ve finansı yönetir.',
  // events.view, crew.view
  viewer: 'Yalnız görür: etkinlikler ve ekip.',
};

/**
 * Kurumsal yuzeyin ozetleri — yetenek havuzu ifadesi CIKARILIR.
 *
 * Havuz (`talent_pool`) modulu YALNIZ ajans kuruluslarinda acik; kurum
 * kullanicisina "havuzu gorur" demek olmayan bir ekrani tarif ederdi. Yetkiler
 * ayni (matris ortak), yalniz anlatim sadelesir.
 */
export const ORG_ROLE_SUMMARIES_KURUMSAL: Record<OrgRole, string> = {
  owner:
    'Her şeyi yönetir: etkinlik, ekip, teklif, iç maliyet, finans, ayarlar, üyeler ve faturalama.',
  admin:
    'Faturalama dışında her şeyi yönetir: etkinlik, ekip, teklif, iç maliyet, finans, ayarlar ve üyeler.',
  sales:
    'Etkinlikleri yönetir, ekibi görür, teklif açar ve gönderir. İç maliyeti görmez.',
  project_manager:
    'Etkinlikleri ve ekibi yönetir, teklifleri görür. İç maliyeti görmez.',
  crew_coordinator:
    'Etkinlikleri görür; ekibi yönetir. Teklif ve iç maliyet yetkisi yoktur.',
  finance:
    'Etkinlik ve ekibi görür; teklifleri görür; iç maliyet ve finansı yönetir.',
  viewer: 'Yalnız görür: etkinlikler ve ekip.',
};

/** Bilinmeyen/eksik deger icin guvenli okuma (ayna gecikmesi vb.). */
export function orgRolEtiketi(role: string | null | undefined): string {
  return ORG_ROLE_LABELS[(role ?? '') as OrgRole] ?? 'İzleyici';
}
