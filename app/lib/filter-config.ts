// app/lib/filter-config.ts
// Kategoriye özel profesyonel ÖZELLİKLERİ (attributes) ve keşfet FİLTRELERİ.
// Faz 14 — config-driven, brief-config.ts'e paralel.
//
// Fark:
// - brief-config.ts → MÜŞTERİ ne istiyor (talep, çoğunlukla tekli seçim)
// - filter-config.ts → PROFESYONEL ne sunuyor (yetenek, çoğunlukla çoklu seçim)
//
// Veri akışı:
// - Profesyonel profil düzenlemede bu alanları doldurur → profiles.attributes (jsonb)
//   Örn: { "music_style": ["pop","electronic"], "extras": ["sound","lighting"] }
// - Keşfet'te kullanıcı bu alanlarla filtreler → jsonb sorgusu (attributes @> ...)
//
// Saklama biçimi (profiles.attributes içinde):
// - multi  → string[]   (örn. ["pop","electronic"])
// - single → string     (örn. "team")

export type FilterFieldType = 'multi' | 'single';

export type FilterFieldOption = {
  value: string;
  label: string;
};

export type FilterField = {
  key: string; // attributes içindeki anahtar (örn. 'music_style')
  label: string; // kullanıcıya görünen etiket
  type: FilterFieldType;
  options: FilterFieldOption[];
  hint?: string; // profil düzenlemede kısa yardım metni (opsiyonel)
};

export type CategoryFilters = {
  slug: string; // service_categories.slug ile birebir
  fields: FilterField[];
};

// -----------------------------------------------------------------------------
// Pilot kategoriler: DJ + Fotoğrafçı
// -----------------------------------------------------------------------------

const CATEGORY_FILTERS: CategoryFilters[] = [
  // --- DJ ---
  {
    slug: 'dj',
    fields: [
      {
        key: 'music_style',
        label: 'Müzik tarzları',
        type: 'multi',
        hint: 'Çaldığın tüm tarzları seç',
        options: [
          { value: 'pop', label: 'Pop / Türkçe Pop' },
          { value: 'electronic', label: 'Elektronik / House' },
          { value: 'hiphop', label: 'Hip-Hop / R&B' },
          { value: 'retro', label: '90lar / Retro' },
          { value: 'arabesk', label: 'Arabesk / Türkü' },
          { value: 'latin', label: 'Latin' },
          { value: 'jazz', label: 'Jazz / Lounge' },
          { value: 'rock', label: 'Rock / Alternatif' },
          { value: 'mixed', label: 'Karışık / Her tarz' },
        ],
      },
      {
        key: 'event_types',
        label: 'Çaldığın etkinlikler',
        type: 'multi',
        hint: 'Hangi etkinliklerde çalıyorsun',
        options: [
          { value: 'wedding', label: 'Düğün' },
          { value: 'engagement', label: 'Nişan / Kına' },
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'club', label: 'Kulüp / Bar' },
          { value: 'birthday', label: 'Doğum günü / Parti' },
          { value: 'festival', label: 'Festival / Konser' },
          { value: 'opening', label: 'Açılış / Lansman' },
        ],
      },
      {
        key: 'extras',
        label: 'Sunduğun ek hizmetler',
        type: 'multi',
        hint: 'Ekipman ve ekstra hizmetler',
        options: [
          { value: 'sound', label: 'Ses sistemi' },
          { value: 'lighting', label: 'Işık sistemi' },
          { value: 'stage', label: 'Sahne / podyum' },
          { value: 'fog', label: 'Sis / efekt makinesi' },
          { value: 'led', label: 'LED ekran' },
          { value: 'mc', label: 'Mikrofon / sunuculuk' },
          { value: 'live', label: 'Canlı enstrüman eşliği' },
        ],
      },
      {
        key: 'language',
        label: 'Repertuvar dili',
        type: 'multi',
        options: [
          { value: 'tr', label: 'Türkçe' },
          { value: 'foreign', label: 'Yabancı' },
          { value: 'mixed', label: 'Karışık' },
        ],
      },
      {
        key: 'team_type',
        label: 'Çalışma şekli',
        type: 'single',
        options: [
          { value: 'solo', label: 'Bireysel' },
          { value: 'team', label: 'Ekip' },
          { value: 'both', label: 'Duruma göre' },
        ],
      },
      {
        key: 'experience',
        label: 'Deneyim',
        type: 'single',
        options: [
          { value: 'junior', label: '0-2 yıl' },
          { value: 'mid', label: '3-5 yıl' },
          { value: 'senior', label: '6-10 yıl' },
          { value: 'expert', label: '10+ yıl' },
        ],
      },
    ],
  },

  // --- FOTOĞRAFÇI ---
  {
    slug: 'fotografci',
    fields: [
      {
        key: 'shoot_types',
        label: 'Çekim türleri',
        type: 'multi',
        hint: 'Yaptığın tüm çekim türlerini seç',
        options: [
          { value: 'wedding', label: 'Düğün / Nişan' },
          { value: 'portrait', label: 'Portre' },
          { value: 'product', label: 'Ürün / Katalog' },
          { value: 'fashion', label: 'Moda / Model' },
          { value: 'event', label: 'Etkinlik / Organizasyon' },
          { value: 'corporate', label: 'Kurumsal' },
          { value: 'newborn', label: 'Yenidoğan / Bebek' },
          { value: 'family', label: 'Aile / Çocuk' },
          { value: 'food', label: 'Yemek' },
          { value: 'architecture', label: 'Mimari / Mekan' },
          { value: 'social', label: 'Sosyal medya içeriği' },
          { value: 'sports', label: 'Spor / Aksiyon' },
        ],
      },
      {
        key: 'style',
        label: 'Çekim stilleri',
        type: 'multi',
        options: [
          { value: 'classic', label: 'Klasik' },
          { value: 'documentary', label: 'Doğal / Belgesel' },
          { value: 'artistic', label: 'Sanatsal / Editöryel' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'vintage', label: 'Vintage / Retro' },
        ],
      },
      {
        key: 'extras',
        label: 'Sunduğun ek hizmetler',
        type: 'multi',
        hint: 'Ekstra hizmet ve imkanlar',
        options: [
          { value: 'drone', label: 'Drone çekimi' },
          { value: 'video', label: 'Video / kurgu' },
          { value: 'album', label: 'Albüm / baskı' },
          { value: 'studio', label: 'Kendi stüdyom var' },
          { value: 'sameday', label: 'Aynı gün teslim' },
          { value: 'makeup', label: 'Makyaj / saç desteği' },
          { value: 'second', label: 'İkinci fotoğrafçı' },
        ],
      },
      {
        key: 'delivery_format',
        label: 'Teslim formatı',
        type: 'multi',
        options: [
          { value: 'digital', label: 'Dijital (yüksek çözünürlük)' },
          { value: 'print', label: 'Baskı' },
          { value: 'album', label: 'Albüm / hatıra kitabı' },
          { value: 'online', label: 'Online galeri' },
        ],
      },
      {
        key: 'team_type',
        label: 'Çalışma şekli',
        type: 'single',
        options: [
          { value: 'solo', label: 'Bireysel' },
          { value: 'team', label: 'Ekip' },
          { value: 'both', label: 'Duruma göre' },
        ],
      },
      {
        key: 'delivery_time',
        label: 'Teslim süresi',
        type: 'single',
        options: [
          { value: 'fast', label: 'Hızlı (birkaç gün)' },
          { value: 'normal', label: '1-2 hafta' },
          { value: 'standard', label: '2-4 hafta' },
        ],
      },
      {
        key: 'experience',
        label: 'Deneyim',
        type: 'single',
        options: [
          { value: 'junior', label: '0-2 yıl' },
          { value: 'mid', label: '3-5 yıl' },
          { value: 'senior', label: '6-10 yıl' },
          { value: 'expert', label: '10+ yıl' },
        ],
      },
    ],
  },
];

// -----------------------------------------------------------------------------
// Erişim yardımcıları
// -----------------------------------------------------------------------------

/**
 * Verilen kategori slug'ına ait filtre/özellik alanlarını döndürür.
 * Tanımsız slug → boş dizi (o kategoride özel filtre yok, sadece kategori+şehir).
 */
export function getFilterFields(categorySlug: string | null): FilterField[] {
  if (!categorySlug) return [];
  const found = CATEGORY_FILTERS.find((c) => c.slug === categorySlug);
  return found ? found.fields : [];
}

/**
 * Kategorinin özel filtresi var mı? (keşfet'te "özel filtreler" bölümünü
 * göstermek/gizlemek için)
 */
export function categoryHasFilters(categorySlug: string | null): boolean {
  if (!categorySlug) return false;
  return CATEGORY_FILTERS.some((c) => c.slug === categorySlug);
}

/**
 * Bir attribute değerini insan-okunur etikete çevirir.
 * (profil/kart üzerinde göstermek için: 'pop' → 'Pop / Türkçe Pop')
 */
export function getAttributeLabel(
  categorySlug: string,
  fieldKey: string,
  value: string
): string {
  const field = getFilterFields(categorySlug).find((f) => f.key === fieldKey);
  if (!field) return value;
  return field.options.find((o) => o.value === value)?.label ?? value;
}

export { CATEGORY_FILTERS };