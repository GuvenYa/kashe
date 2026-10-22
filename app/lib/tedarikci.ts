/**
 * FAZ 8c — tedarikci defteri ve kisa liste sozlugu: etiketler, rozet siniflari
 * ve DB hata eslemesi. TEK KAYNAK.
 *
 * 'use client' YOKTUR ve DB erisimi de YOKTUR: hem sunucu sayfalari hem istemci
 * formlari buradan okur (8b `crm.ts` kalibi). Sorgular `tedarikci-data.ts`'de,
 * yazma `tedarikci-actions.ts`'de.
 *
 * ILKE: kurallar veritabaninda (`20261023120000_faz8c_01_tedarikciler.sql`
 * tetikleyicileri ve CHECK'leri), bu dosya yalniz onlarin ciktisini Turkceye
 * cevirir. Buraya yeni bir KURAL yazilmaz.
 */

// -----------------------------------------------------------------------------
// Kategoriler — `suppliers_category_check` ile AYNI sira
// -----------------------------------------------------------------------------

export const TEDARIKCI_KATEGORILERI = [
  'sound_light',
  'stage_technical',
  'catering',
  'venue',
  'transport',
  'print_promo',
  'decor',
  'security',
  'talent',
  'other',
] as const;

export type TedarikciKategorisi = (typeof TEDARIKCI_KATEGORILERI)[number];

export const KATEGORI_ETIKETLERI: Record<TedarikciKategorisi, string> = {
  sound_light: 'Ses ve ışık',
  stage_technical: 'Sahne ve teknik',
  catering: 'Catering',
  venue: 'Mekan',
  transport: 'Ulaşım',
  print_promo: 'Baskı ve promosyon',
  decor: 'Dekor',
  security: 'Güvenlik',
  talent: 'Yetenek',
  other: 'Diğer',
};

export function kategoriEtiketi(kategori: string): string {
  return KATEGORI_ETIKETLERI[kategori as TedarikciKategorisi] ?? 'Diğer';
}

// -----------------------------------------------------------------------------
// Atama durumlari — `event_suppliers_status_check`
// -----------------------------------------------------------------------------

export const ATAMA_DURUMLARI = ['planned', 'confirmed', 'cancelled'] as const;
export type AtamaDurumu = (typeof ATAMA_DURUMLARI)[number];

export const DURUM_ETIKETLERI: Record<AtamaDurumu, string> = {
  planned: 'Planlandı',
  confirmed: 'Onaylandı',
  cancelled: 'İptal',
};

/** Rozet siniflari — 8b `ASAMA_SINIFLARI` kalibi. */
export const DURUM_SINIFLARI: Record<AtamaDurumu, string> = {
  planned: 'text-ink-72 bg-paper border-line',
  confirmed: 'text-moss bg-moss/10 border-moss/25',
  cancelled: 'text-ink-50 bg-paper border-line',
};

/** Toplam ve "aktif atama" sayiminda hesaba GIREN durumlar. */
export const AKTIF_DURUMLAR: AtamaDurumu[] = ['planned', 'confirmed'];

export function durumEtiketi(durum: string): string {
  return DURUM_ETIKETLERI[durum as AtamaDurumu] ?? durum;
}

export function durumSinifi(durum: string): string {
  return (
    DURUM_SINIFLARI[durum as AtamaDurumu] ?? 'text-ink-72 bg-paper border-line'
  );
}

/** Puan — yildiz dizisi olarak doner; mono yazi tabloda hizali kalir. */
export function puanMetni(puan: number | null | undefined): string {
  if (puan === null || puan === undefined) return '—';
  const n = Math.max(1, Math.min(5, Math.round(puan)));
  return `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
}

// -----------------------------------------------------------------------------
// DB hata eslemesi
// -----------------------------------------------------------------------------

/**
 * Tetikleyici ve kisit metinlerini Turkce cumleye cevirir. Metinler
 * migration'daki `RAISE EXCEPTION` govdeleriyle BIREBIR eslesir (DB metni
 * ASCII, UI metni Turkce karakterli).
 *
 * KURAL KOPYALANMAZ: "tedarikci arsivde", "kendi saglayicin eklenemez" gibi
 * kontroller action'da TEKRAR edilmez; tetikleyici reddeder, mesaji burada
 * cevrilir. Iki yerde yazilan bir kural kayar.
 */
const HATA_ESLEMESI: { parca: string; mesaj: string }[] = [
  {
    parca: 'suppliers modulu bu kurulusta kapali',
    mesaj: 'Tedarikçiler modülü bu kuruluşta kapalı.',
  },
  {
    parca: 'supplier_search modulu bu kurulusta kapali',
    mesaj: 'Kısa liste modülü bu kuruluşta kapalı.',
  },
  {
    parca: 'tedarikci kendi kurulusunun saglayicisi olamaz',
    mesaj: 'Kendi kuruluşunun Kashe kaydı tedarikçi olarak bağlanamaz.',
  },
  {
    parca: 'kendi saglayicin kisa listeye eklenemez',
    mesaj: 'Kendi Kashe kaydını kısa listeye ekleyemezsin.',
  },
  {
    parca: 'etkinlik bu kurulusa ait degil',
    mesaj: 'Seçilen etkinlik bu kuruluşa ait değil.',
  },
  {
    parca: 'tedarikci bu kurulusa ait degil',
    mesaj: 'Seçilen tedarikçi bu kuruluşa ait değil.',
  },
  {
    parca: 'tedarikci arsivde',
    mesaj: 'Bu tedarikçi arşivde; önce arşivden çıkar.',
  },
  {
    parca: 'tedarikcinin kurulusu degistirilemez',
    mesaj: 'Tedarikçinin kuruluşu değiştirilemez.',
  },
  {
    parca: 'atamanin kurulusu degistirilemez',
    mesaj: 'Atamanın kuruluşu değiştirilemez.',
  },
  {
    parca: 'kisa listenin kurulusu degistirilemez',
    mesaj: 'Kısa listenin kuruluşu değiştirilemez.',
  },
  {
    parca: 'kalem baska listeye tasinamaz',
    mesaj: 'Kalem başka bir listeye taşınamaz.',
  },
  { parca: 'kisa liste yok', mesaj: 'Kısa liste bulunamadı.' },
  {
    parca: 'kurulussuz etkinlikte ic goruntu yok',
    mesaj: 'Kuruluşsuz etkinlikte iç maliyet görüntüsü yok.',
  },
  {
    parca: 'etkinlik tedarikcisi yok',
    mesaj: 'Atama bulunamadı; sayfayı yenile.',
  },
  {
    parca: 'tutar 0 veya daha buyuk olmali',
    mesaj: 'Tutar 0 veya daha büyük olmalı.',
  },
  { parca: 'suppliers_name_check', mesaj: 'Ad 2–200 karakter olmalı.' },
  {
    parca: 'suppliers_category_check',
    mesaj: 'Kategori geçersiz.',
  },
  {
    parca: 'suppliers_contact_name_check',
    mesaj: 'Yetkili adı en fazla 120 karakter olabilir.',
  },
  { parca: 'suppliers_email_check', mesaj: 'E-posta biçimi geçersiz.' },
  {
    parca: 'suppliers_phone_check',
    mesaj: 'Telefon en fazla 40 karakter olabilir.',
  },
  {
    parca: 'suppliers_website_check',
    mesaj: 'Web adresi en fazla 300 karakter olabilir.',
  },
  { parca: 'suppliers_rating_check', mesaj: 'Puan 1 ile 5 arasında olmalı.' },
  {
    parca: 'suppliers_notes_check',
    mesaj: 'Not en fazla 4000 karakter olabilir.',
  },
  {
    parca: 'event_suppliers_service_check',
    mesaj: 'Hizmet en fazla 200 karakter olabilir.',
  },
  { parca: 'event_suppliers_status_check', mesaj: 'Durum geçersiz.' },
  {
    parca: 'event_suppliers_notes_check',
    mesaj: 'Not en fazla 2000 karakter olabilir.',
  },
  {
    parca: 'supplier_shortlists_name_check',
    mesaj: 'Liste adı 2–120 karakter olmalı.',
  },
  {
    parca: 'supplier_shortlists_notes_check',
    mesaj: 'Not en fazla 2000 karakter olabilir.',
  },
  {
    parca: 'supplier_shortlist_items_note_check',
    mesaj: 'Not en fazla 500 karakter olabilir.',
  },
];

export function tedarikciHataMetni(
  hata: { code?: string | null; message?: string | null } | null
): string {
  if (!hata) return 'Beklenmeyen bir hata oldu.';
  const ham = (hata.message ?? '').toLowerCase();
  for (const { parca, mesaj } of HATA_ESLEMESI) {
    if (ham.includes(parca.toLowerCase())) return mesaj;
  }
  if (hata.code === '42501') return 'Bu işlem için yetkin yok.';
  if (hata.code === '23505') {
    // Tekillik kisitlari: ayni tedarikci ayni etkinlikte, ayni saglayici ayni
    // listede, ayni saglayici kurulusta baska bir tedarikciye bagli.
    if (ham.includes('event_suppliers_event_supplier_key')) {
      return 'Bu tedarikçi zaten etkinlikte.';
    }
    if (ham.includes('supplier_shortlist_items_key')) {
      return 'Bu sağlayıcı zaten listede.';
    }
    if (ham.includes('suppliers_org_provider_uidx')) {
      return 'Bu sağlayıcı başka bir tedarikçiye bağlı.';
    }
    return 'Bu kayıt zaten var.';
  }
  if (hata.code === '23503') {
    // `event_suppliers.supplier_id` RESTRICT: atanmis tedarikci silinemez.
    if (ham.includes('event_suppliers')) {
      return 'Etkinliklere atanmış tedarikçi silinemez; önce arşivle.';
    }
    return 'Seçilen kayıt bulunamadı.';
  }
  if (hata.code === '23514') {
    return 'Alan değeri geçersiz; sınırları kontrol et.';
  }
  if (hata.code === 'P0002') return 'Kayıt bulunamadı.';
  return 'İşlem tamamlanamadı. Alanları kontrol edip yeniden dene.';
}
