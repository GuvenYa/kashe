/**
 * FAZ 8b — CRM ortak sabitleri, etiketleri ve DB hata eslemesi.
 *
 * 'use client' YOKTUR ve DB erisimi de YOKTUR: hem sunucu sayfalari hem istemci
 * formlari/panolari buradan okur. Sorgular `crm-data.ts`'de, yazma
 * `crm-actions.ts`'de — bu dosya ikisinden de bagimsiz kalir ki istemci
 * paketine sunucu kodu girmesin (CLAUDE.md: `'use client'` modulunden sunucu
 * bilesenine sabit/veri import edilmez; tersi de ayni sebeple ayrilir).
 *
 * Kaynak: `20261022120000_faz8b_01_crm.sql` — enum `crm_lead_stage`,
 * CHECK'ler ve tetikleyicilerin `RAISE EXCEPTION` govdeleri.
 */

// -----------------------------------------------------------------------------
// Asamalar
// -----------------------------------------------------------------------------

/** Enum sirasi (`public.crm_lead_stage`) — pano sutunlari bu sirayi izler. */
export const FIRSAT_ASAMALARI = [
  'new',
  'contacted',
  'proposal_sent',
  'won',
  'lost',
] as const;

export type FirsatAsamasi = (typeof FIRSAT_ASAMALARI)[number];

export const ASAMA_ETIKETLERI: Record<FirsatAsamasi, string> = {
  new: 'Yeni',
  contacted: 'İletişimde',
  proposal_sent: 'Teklif verildi',
  won: 'Kazanıldı',
  lost: 'Kaybedildi',
};

/**
 * Rozet siniflari. `won` moss, `lost` soluk, arasi notr; `proposal_sent`
 * lacivert cunku o asamada kurulus bir is yapmis durumda.
 */
export const ASAMA_SINIFLARI: Record<FirsatAsamasi, string> = {
  new: 'text-ink-72 bg-paper border-line',
  contacted: 'text-sky bg-sky-12 border-sky/25',
  proposal_sent: 'text-paper bg-brand-ink border-brand-ink',
  won: 'text-moss bg-moss/10 border-moss/25',
  lost: 'text-ink-50 bg-paper border-line',
};

/** Kapanmamis asamalar — "acik firsat" sayimi ve beklenen tutar bunlardan. */
export const ACIK_ASAMALAR: FirsatAsamasi[] = [
  'new',
  'contacted',
  'proposal_sent',
];

export function asamaEtiketi(asama: string): string {
  return ASAMA_ETIKETLERI[asama as FirsatAsamasi] ?? asama;
}

export function asamaSinifi(asama: string): string {
  return (
    ASAMA_SINIFLARI[asama as FirsatAsamasi] ?? 'text-ink-72 bg-paper border-line'
  );
}

// -----------------------------------------------------------------------------
// Kisi turu
// -----------------------------------------------------------------------------

/**
 * `crm.view` yetkisi olan roller — DB `org_role_permissions` ile AYNI
 * (20261022120000_faz8b_01_crm.sql bolum 2). Firsat sahibi secimi bu rollerle
 * sinirlidir: CRM'i goremeyen bir uye sahip yapilirsa bildirimi alir ama
 * sayfayi acamaz (403). Matris degisirse once o fonksiyon, sonra burasi.
 */
export const CRM_GOREN_ROLLER = [
  'owner',
  'admin',
  'sales',
  'project_manager',
  'finance',
] as const;

export const KISI_TURLERI = ['person', 'company'] as const;
export type KisiTuru = (typeof KISI_TURLERI)[number];

export const KISI_TURU_ETIKETLERI: Record<KisiTuru, string> = {
  person: 'Kişi',
  company: 'Firma',
};

export function kisiTuruEtiketi(tur: string): string {
  return KISI_TURU_ETIKETLERI[tur as KisiTuru] ?? 'Kişi';
}

// -----------------------------------------------------------------------------
// DB hata eslemesi
// -----------------------------------------------------------------------------

/**
 * Tetikleyici ve kisit metinlerini kullaniciya gosterilecek Turkce cumleye
 * cevirir. Metinler migration'daki `RAISE EXCEPTION` govdeleriyle BIREBIR
 * eslesir (DB metni ASCII, UI metni Turkce karakterli).
 *
 * KURAL KOPYALANMAZ: ornegin "sahip kurulusun aktif uyesi mi" kontrolu
 * `crm-actions.ts`'de TEKRAR edilmez; tetikleyici reddeder, mesaji burada
 * cevrilir. Iki yerde yazilan bir kural kayar.
 *
 * Eslesmeyen hata icin genel bir cumle doner; ham DB metni kullaniciya
 * SIZDIRILMAZ (gelistirici konsolda gorur).
 */
const HATA_ESLEMESI: { parca: string; mesaj: string }[] = [
  {
    parca: 'crm modulu bu kurulusta kapali',
    mesaj: 'Müşteriler modülü bu kuruluşta kapalı.',
  },
  {
    parca: 'kisinin kurulusu degistirilemez',
    mesaj: 'Kişinin kuruluşu değiştirilemez.',
  },
  {
    parca: 'firsatin kurulusu degistirilemez',
    mesaj: 'Fırsatın kuruluşu değiştirilemez.',
  },
  {
    parca: 'kisi kendi kurulusuna baglanamaz',
    mesaj: 'Kişi kendi kuruluşuna bağlanamaz.',
  },
  {
    parca: 'kisi bu kurulusa ait degil',
    mesaj: 'Seçilen kişi bu kuruluşa ait değil.',
  },
  {
    parca: 'etkinlik bu kurulusa ait degil',
    mesaj: 'Seçilen etkinlik bu kuruluşa ait değil.',
  },
  {
    parca: 'teklif bu kurulusa ait degil',
    mesaj: 'Seçilen teklif bu kuruluşa ait değil.',
  },
  {
    parca: 'sahip kurulusun aktif uyesi degil',
    mesaj: 'Sahip kuruluşun aktif üyesi değil.',
  },
  {
    parca: 'kisi teklifin satici kurulusuna ait degil',
    mesaj: 'Kişi teklifin satıcı kuruluşuna ait değil.',
  },
  {
    parca: 'contacts_org_email_uidx',
    mesaj: 'Bu e-posta ile kayıtlı bir kişi zaten var.',
  },
  {
    parca: 'contacts_full_name_check',
    mesaj: 'Ad 2–200 karakter olmalı.',
  },
  {
    parca: 'contacts_company_name_check',
    mesaj: 'Firma adı en fazla 200 karakter olabilir.',
  },
  {
    parca: 'contacts_email_check',
    mesaj: 'E-posta biçimi geçersiz.',
  },
  {
    parca: 'contacts_phone_check',
    mesaj: 'Telefon en fazla 40 karakter olabilir.',
  },
  {
    parca: 'contacts_notes_check',
    mesaj: 'Not en fazla 4000 karakter olabilir.',
  },
  {
    parca: 'contacts_kind_check',
    mesaj: 'Kişi türü geçersiz.',
  },
  {
    parca: 'crm_leads_title_check',
    mesaj: 'Başlık 2–200 karakter olmalı.',
  },
  {
    parca: 'crm_leads_value_check',
    mesaj: 'Tahmini değer sıfırdan küçük olamaz.',
  },
  {
    parca: 'crm_leads_next_step_check',
    mesaj: 'Sonraki adım en fazla 500 karakter olabilir.',
  },
  {
    parca: 'crm_leads_lost_reason_check',
    mesaj: 'Kaybedilme nedeni en fazla 500 karakter olabilir.',
  },
  {
    parca: 'crm_leads_currency_check',
    mesaj: 'Para birimi yalnız TRY olabilir.',
  },
];

export function crmHataMetni(
  hata: { code?: string | null; message?: string | null } | null
): string {
  if (!hata) return 'Beklenmeyen bir hata oldu.';
  const ham = (hata.message ?? '').toLowerCase();
  for (const { parca, mesaj } of HATA_ESLEMESI) {
    if (ham.includes(parca.toLowerCase())) return mesaj;
  }
  if (hata.code === '42501') return 'Bu işlem için yetkin yok.';
  // `crm_leads.contact_id` RESTRICT: firsati olan kisi silinemez.
  if (hata.code === '23503') {
    return ham.includes('crm_leads')
      ? 'Bu kişinin fırsatları var. Önce fırsatları sil ya da taşı.'
      : 'Seçilen kayıt bulunamadı.';
  }
  if (hata.code === '23505') {
    return 'Bu e-posta ile kayıtlı bir kişi zaten var.';
  }
  return 'İşlem tamamlanamadı. Alanları kontrol edip yeniden dene.';
}
