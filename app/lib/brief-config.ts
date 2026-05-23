// app/lib/brief-config.ts
// Kategoriye göre dinamik brief (teklif talebi) form tanımları.
// Faz 11 — config-driven. İçerik kaynağı: Kashe Kategori Profil Sayfaları dokümanı.
//
// Mimari:
// - Her kategori slug'ı bir alan listesi tanımlar.
// - Tanımsız kategoriler DEFAULT_BRIEF_FIELDS'e düşer (fallback).
// - Cevaplar conversations.brief_data (jsonb) içinde { [key]: value } olarak saklanır.
// - 'message' alanı her formda zorunlu ve sabittir (config'e koymuyoruz, modal kendi ekler).

export type BriefFieldType =
  | 'select'
  | 'text'
  | 'textarea'
  | 'number'
  | 'date';

export type BriefFieldOption = {
  value: string;
  label: string;
};

export type BriefField = {
  key: string; // brief_data içindeki anahtar (örn. 'event_type', 'style')
  label: string; // kullanıcıya görünen etiket
  type: BriefFieldType;
  required: boolean;
  options?: BriefFieldOption[]; // sadece 'select' için
  placeholder?: string; // text/textarea/number için
  // Bazı alanlar mevcut sabit kolonlara da yazılır (geriye uyumluluk için).
  // Örn. event_type/budget_range/event_date/location/guest_count.
  // legacyColumn doluysa, action bu değeri ilgili conversations kolonuna da yazar.
  legacyColumn?:
    | 'event_type'
    | 'event_date'
    | 'location'
    | 'guest_count'
    | 'budget_range';
};

export type CategoryBrief = {
  slug: string; // service_categories.slug ile birebir eşleşir
  intro?: string; // form üstünde gösterilecek kısa açıklama
  fields: BriefField[];
};

// -----------------------------------------------------------------------------
// Ortak opsiyon setleri (tekrar kullanılan)
// -----------------------------------------------------------------------------

const BUDGET_OPTIONS: BriefFieldOption[] = [
  { value: 'under_5k', label: '5.000 TL altı' },
  { value: '5k_15k', label: '5.000 - 15.000 TL' },
  { value: '15k_30k', label: '15.000 - 30.000 TL' },
  { value: '30k_50k', label: '30.000 - 50.000 TL' },
  { value: 'over_50k', label: '50.000 TL üzeri' },
  { value: 'open', label: 'Açık / Görüşülecek' },
];

const EVENT_TYPE_OPTIONS: BriefFieldOption[] = [
  { value: 'wedding', label: 'Düğün' },
  { value: 'engagement', label: 'Nişan' },
  { value: 'henna', label: 'Kına' },
  { value: 'birthday', label: 'Doğum günü' },
  { value: 'corporate', label: 'Kurumsal etkinlik' },
  { value: 'launch', label: 'Açılış / Lansman' },
  { value: 'fair', label: 'Fuar' },
  { value: 'other', label: 'Diğer' },
];

// -----------------------------------------------------------------------------
// Default fallback — config'de tanımsız kategoriler bunu kullanır
// (mevcut sabit 5 alan + mesaj modal'da)
// -----------------------------------------------------------------------------

export const DEFAULT_BRIEF_FIELDS: BriefField[] = [
  {
    key: 'event_type',
    label: 'Etkinlik türü',
    type: 'select',
    required: false,
    options: EVENT_TYPE_OPTIONS,
    legacyColumn: 'event_type',
  },
  {
    key: 'event_date',
    label: 'Etkinlik tarihi',
    type: 'date',
    required: false,
    legacyColumn: 'event_date',
  },
  {
    key: 'location',
    label: 'Lokasyon',
    type: 'text',
    required: false,
    placeholder: 'Beşiktaş, İstanbul',
    legacyColumn: 'location',
  },
  {
    key: 'guest_count',
    label: 'Kişi sayısı (yaklaşık)',
    type: 'number',
    required: false,
    placeholder: 'örn. 80',
    legacyColumn: 'guest_count',
  },
  {
    key: 'budget_range',
    label: 'Bütçe aralığı',
    type: 'select',
    required: false,
    options: BUDGET_OPTIONS,
    legacyColumn: 'budget_range',
  },
];

// -----------------------------------------------------------------------------
// Kategori-özel brief tanımları
// -----------------------------------------------------------------------------

const CATEGORY_BRIEFS: CategoryBrief[] = [
  // --- FOTOĞRAFÇILAR ---
  {
    slug: 'fotografci',
    intro:
      'Çekim ihtiyacını paylaş, fotoğrafçı sana net ve hızlı bir teklif versin.',
    fields: [
      {
        key: 'event_type',
        label: 'Etkinlik / çekim türü',
        type: 'select',
        required: true,
        legacyColumn: 'event_type',
        options: [
          { value: 'wedding', label: 'Düğün' },
          { value: 'engagement', label: 'Nişan / Kına' },
          { value: 'birthday', label: 'Doğum günü' },
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'product', label: 'Ürün / Katalog çekimi' },
          { value: 'fashion', label: 'Moda / Model çekimi' },
          { value: 'social', label: 'Sosyal medya içeriği' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'event_date',
        label: 'Tarih',
        type: 'date',
        required: false,
        legacyColumn: 'event_date',
      },
      {
        key: 'location',
        label: 'Şehir / lokasyon',
        type: 'text',
        required: false,
        placeholder: 'Kadıköy, İstanbul',
        legacyColumn: 'location',
      },
      {
        key: 'duration',
        label: 'Çekim süresi',
        type: 'select',
        required: false,
        options: [
          { value: '1_2h', label: '1-2 saat' },
          { value: 'half_day', label: 'Yarım gün' },
          { value: 'full_day', label: 'Tam gün' },
          { value: 'multi_day', label: 'Birden fazla gün' },
        ],
      },
      {
        key: 'style',
        label: 'Stil tercihi',
        type: 'select',
        required: false,
        options: [
          { value: 'classic', label: 'Klasik' },
          { value: 'natural', label: 'Doğal / Belgesel' },
          { value: 'artistic', label: 'Sanatsal' },
          { value: 'no_pref', label: 'Fark etmez' },
        ],
      },
      {
        key: 'drone',
        label: 'Drone çekimi gerekli mi?',
        type: 'select',
        required: false,
        options: [
          { value: 'yes', label: 'Evet' },
          { value: 'no', label: 'Hayır' },
          { value: 'maybe', label: 'Belki / Görüşelim' },
        ],
      },
      {
        key: 'budget_range',
        label: 'Bütçe aralığı',
        type: 'select',
        required: false,
        options: BUDGET_OPTIONS,
        legacyColumn: 'budget_range',
      },
    ],
  },

  // --- DJ'LER ---
  {
    slug: 'dj',
    intro:
      'Etkinliğinin detaylarını paylaş, DJ sana uygun bir teklif hazırlasın.',
    fields: [
      {
        key: 'event_type',
        label: 'Etkinlik türü',
        type: 'select',
        required: true,
        legacyColumn: 'event_type',
        options: EVENT_TYPE_OPTIONS,
      },
      {
        key: 'event_date',
        label: 'Tarih',
        type: 'date',
        required: false,
        legacyColumn: 'event_date',
      },
      {
        key: 'location',
        label: 'Şehir / mekan',
        type: 'text',
        required: false,
        placeholder: 'Şişli, İstanbul',
        legacyColumn: 'location',
      },
      {
        key: 'guest_count',
        label: 'Katılımcı sayısı (yaklaşık)',
        type: 'number',
        required: false,
        placeholder: 'örn. 150',
        legacyColumn: 'guest_count',
      },
      {
        key: 'music_style',
        label: 'Müzik tarzı tercihi',
        type: 'select',
        required: false,
        options: [
          { value: 'pop', label: 'Pop / Türkçe Pop' },
          { value: 'electronic', label: 'Elektronik / House' },
          { value: 'retro', label: '90lar / Retro' },
          { value: 'mixed', label: 'Karışık' },
          { value: 'no_pref', label: 'Fark etmez' },
        ],
      },
      {
        key: 'sound_light',
        label: 'Ses / ışık sistemi ihtiyacı',
        type: 'select',
        required: false,
        options: [
          { value: 'both', label: 'Ses + ışık ikisi de' },
          { value: 'sound', label: 'Sadece ses' },
          { value: 'none', label: 'Gerekmez, mekanda var' },
        ],
      },
      {
        key: 'mc_role',
        label: 'Mikrofon / sunuculuk rolü olsun mu?',
        type: 'select',
        required: false,
        options: [
          { value: 'yes', label: 'Evet' },
          { value: 'no', label: 'Hayır' },
        ],
      },
      {
        key: 'budget_range',
        label: 'Bütçe aralığı',
        type: 'select',
        required: false,
        options: BUDGET_OPTIONS,
        legacyColumn: 'budget_range',
      },
    ],
  },

  // --- MÜZİSYENLER ---
  {
    slug: 'muzisyen',
    intro:
      'Etkinliğinin detaylarını paylaş, müzisyen sana uygun bir teklif hazırlasın.',
    fields: [
      {
        key: 'event_type',
        label: 'Etkinlik türü',
        type: 'select',
        required: true,
        legacyColumn: 'event_type',
        options: EVENT_TYPE_OPTIONS,
      },
      {
        key: 'event_date',
        label: 'Tarih',
        type: 'date',
        required: false,
        legacyColumn: 'event_date',
      },
      {
        key: 'location',
        label: 'Şehir / mekan',
        type: 'text',
        required: false,
        placeholder: 'Beşiktaş, İstanbul',
        legacyColumn: 'location',
      },
      {
        key: 'guest_count',
        label: 'Katılımcı sayısı (yaklaşık)',
        type: 'number',
        required: false,
        placeholder: 'örn. 100',
        legacyColumn: 'guest_count',
      },
      {
        key: 'performance_type',
        label: 'Performans tipi',
        type: 'select',
        required: false,
        options: [
          { value: 'solo', label: 'Solo müzisyen' },
          { value: 'duo_trio', label: 'Akustik duo / trio' },
          { value: 'band', label: 'Canlı müzik grubu' },
          { value: 'orchestra', label: 'Orkestra' },
          { value: 'no_pref', label: 'Fark etmez' },
        ],
      },
      {
        key: 'music_genre',
        label: 'Müzik türü tercihi',
        type: 'select',
        required: false,
        options: [
          { value: 'pop', label: 'Pop' },
          { value: 'jazz_lounge', label: 'Caz / Lounge' },
          { value: 'acoustic', label: 'Akustik' },
          { value: 'thm_tsm', label: 'Türk Halk / Sanat Müziği' },
          { value: 'mixed', label: 'Karışık' },
          { value: 'no_pref', label: 'Fark etmez' },
        ],
      },
      {
        key: 'sound_system',
        label: 'Ses sistemi ihtiyacı',
        type: 'select',
        required: false,
        options: [
          { value: 'yes', label: 'Evet, gerekli' },
          { value: 'no', label: 'Hayır, mekanda var' },
        ],
      },
      {
        key: 'repertoire_request',
        label: 'Özel şarkı / repertuvar talebi',
        type: 'textarea',
        required: false,
        placeholder: 'Çalınmasını istediğin özel şarkılar veya tarz...',
      },
      {
        key: 'budget_range',
        label: 'Bütçe aralığı',
        type: 'select',
        required: false,
        options: BUDGET_OPTIONS,
        legacyColumn: 'budget_range',
      },
    ],
  },

  // --- SUNUCULAR / MODERATÖRLER ---
  {
    slug: 'sunucu',
    intro:
      'Etkinliğinin akışını ve beklentilerini paylaş, sunucu sana uygun teklif versin.',
    fields: [
      {
        key: 'event_type',
        label: 'Etkinlik türü',
        type: 'select',
        required: true,
        legacyColumn: 'event_type',
        options: [
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'conference', label: 'Konferans / Panel' },
          { value: 'gala', label: 'Gala / Ödül töreni' },
          { value: 'launch', label: 'Açılış / Lansman' },
          { value: 'wedding', label: 'Düğün / Nişan' },
          { value: 'fair', label: 'Fuar / Stand' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'event_date',
        label: 'Tarih',
        type: 'date',
        required: false,
        legacyColumn: 'event_date',
      },
      {
        key: 'location',
        label: 'Şehir / mekan',
        type: 'text',
        required: false,
        placeholder: 'Levent, İstanbul',
        legacyColumn: 'location',
      },
      {
        key: 'event_format',
        label: 'Etkinlik formatı',
        type: 'select',
        required: false,
        options: [
          { value: 'physical', label: 'Yüz yüze' },
          { value: 'online', label: 'Çevrim içi' },
          { value: 'hybrid', label: 'Hibrit' },
        ],
      },
      {
        key: 'duration',
        label: 'Etkinlik süresi',
        type: 'select',
        required: false,
        options: [
          { value: '1_2h', label: '1-2 saat' },
          { value: 'half_day', label: 'Yarım gün' },
          { value: 'full_day', label: 'Tam gün' },
        ],
      },
      {
        key: 'presentation_lang',
        label: 'Sunum dili',
        type: 'select',
        required: false,
        options: [
          { value: 'tr', label: 'Türkçe' },
          { value: 'en', label: 'İngilizce' },
          { value: 'tr_en', label: 'Türkçe + İngilizce' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'presentation_style',
        label: 'Sunum tarzı',
        type: 'select',
        required: false,
        options: [
          { value: 'formal', label: 'Resmi / Protokol' },
          { value: 'corporate', label: 'Kurumsal' },
          { value: 'energetic', label: 'Enerjik / Eğlenceli' },
          { value: 'no_pref', label: 'Fark etmez' },
        ],
      },
      {
        key: 'program_flow',
        label: 'Program akışı / brief',
        type: 'textarea',
        required: false,
        placeholder: 'Etkinliğin akışı, bölümleri ve sunucudan beklentilerin...',
      },
      {
        key: 'budget_range',
        label: 'Bütçe aralığı',
        type: 'select',
        required: false,
        options: BUDGET_OPTIONS,
        legacyColumn: 'budget_range',
      },
    ],
  },

  // --- HOST / HOSTESLER ---
  {
    slug: 'hostes',
    intro:
      'Personel ihtiyacını paylaş, sana uygun host/hostes teklifi hazırlansın.',
    fields: [
      {
        key: 'event_type',
        label: 'Etkinlik türü',
        type: 'select',
        required: true,
        legacyColumn: 'event_type',
        options: [
          { value: 'fair', label: 'Fuar / Stand' },
          { value: 'launch', label: 'Lansman / Açılış' },
          { value: 'congress', label: 'Kongre / Konferans' },
          { value: 'gala', label: 'Gala / Davet' },
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'activation', label: 'Marka aktivasyonu' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'event_date',
        label: 'Tarih',
        type: 'date',
        required: false,
        legacyColumn: 'event_date',
      },
      {
        key: 'location',
        label: 'Şehir / mekan',
        type: 'text',
        required: false,
        placeholder: 'Fuar alanı, İstanbul',
        legacyColumn: 'location',
      },
      {
        key: 'staff_count',
        label: 'Personel sayısı',
        type: 'number',
        required: false,
        placeholder: 'örn. 4',
      },
      {
        key: 'work_duration',
        label: 'Çalışma süresi',
        type: 'select',
        required: false,
        options: [
          { value: 'hourly', label: 'Birkaç saat' },
          { value: 'full_day', label: 'Tam gün' },
          { value: 'multi_day', label: 'Birden fazla gün' },
        ],
      },
      {
        key: 'task_type',
        label: 'Görev tanımı',
        type: 'select',
        required: false,
        options: [
          { value: 'welcome', label: 'Karşılama' },
          { value: 'registration', label: 'Kayıt masası' },
          { value: 'promotion', label: 'Tanıtım / Stand' },
          { value: 'vip', label: 'VIP karşılama' },
          { value: 'service', label: 'Servis desteği' },
          { value: 'mixed', label: 'Karışık / Görüşelim' },
        ],
      },
      {
        key: 'language_need',
        label: 'Dil beklentisi',
        type: 'select',
        required: false,
        options: [
          { value: 'tr', label: 'Türkçe yeterli' },
          { value: 'en', label: 'İngilizce gerekli' },
          { value: 'other', label: 'Başka dil gerekli' },
        ],
      },
      {
        key: 'dress_code',
        label: 'Kıyafet / dress code',
        type: 'text',
        required: false,
        placeholder: 'örn. siyah takım, kurumsal',
      },
      {
        key: 'budget_range',
        label: 'Bütçe aralığı',
        type: 'select',
        required: false,
        options: BUDGET_OPTIONS,
        legacyColumn: 'budget_range',
      },
    ],
  },

  // --- VİDEOGRAFLAR ---
  {
    slug: 'videograf',
    intro:
      'Video çekim ihtiyacını paylaş, videograf sana net bir teklif versin.',
    fields: [
      {
        key: 'event_type',
        label: 'Çekim / etkinlik türü',
        type: 'select',
        required: true,
        legacyColumn: 'event_type',
        options: [
          { value: 'wedding', label: 'Düğün' },
          { value: 'engagement', label: 'Nişan / Kına' },
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'promo', label: 'Tanıtım filmi' },
          { value: 'social', label: 'Sosyal medya içeriği' },
          { value: 'product', label: 'Ürün / Katalog' },
          { value: 'ad', label: 'Reklam filmi' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'event_date',
        label: 'Tarih',
        type: 'date',
        required: false,
        legacyColumn: 'event_date',
      },
      {
        key: 'location',
        label: 'Şehir / lokasyon',
        type: 'text',
        required: false,
        placeholder: 'Kadıköy, İstanbul',
        legacyColumn: 'location',
      },
      {
        key: 'duration',
        label: 'Çekim süresi',
        type: 'select',
        required: false,
        options: [
          { value: '1_2h', label: '1-2 saat' },
          { value: 'half_day', label: 'Yarım gün' },
          { value: 'full_day', label: 'Tam gün' },
          { value: 'multi_day', label: 'Birden fazla gün' },
        ],
      },
      {
        key: 'editing',
        label: 'Kurgu / montaj dahil mi?',
        type: 'select',
        required: false,
        options: [
          { value: 'yes', label: 'Evet, kurgulu teslim' },
          { value: 'no', label: 'Hayır, ham kayıt' },
          { value: 'discuss', label: 'Görüşelim' },
        ],
      },
      {
        key: 'drone',
        label: 'Drone çekimi gerekli mi?',
        type: 'select',
        required: false,
        options: [
          { value: 'yes', label: 'Evet' },
          { value: 'no', label: 'Hayır' },
          { value: 'maybe', label: 'Belki / Görüşelim' },
        ],
      },
      {
        key: 'delivery_time',
        label: 'Teslim süresi beklentisi',
        type: 'select',
        required: false,
        options: [
          { value: 'urgent', label: 'Acil (birkaç gün)' },
          { value: 'normal', label: '1-2 hafta' },
          { value: 'flexible', label: 'Esnek' },
        ],
      },
      {
        key: 'budget_range',
        label: 'Bütçe aralığı',
        type: 'select',
        required: false,
        options: BUDGET_OPTIONS,
        legacyColumn: 'budget_range',
      },
    ],
  },

  // --- OYUNCULAR / FİGÜRANLAR ---
  {
    slug: 'oyuncu',
    intro:
      'Proje ve rol detaylarını paylaş, uygun oyuncu/figüran teklifi hazırlansın.',
    fields: [
      {
        key: 'project_type',
        label: 'Proje türü',
        type: 'select',
        required: true,
        options: [
          { value: 'ad', label: 'Reklam' },
          { value: 'series_film', label: 'Dizi / Film' },
          { value: 'short', label: 'Kısa film' },
          { value: 'theater', label: 'Tiyatro / Sahne' },
          { value: 'social', label: 'Sosyal medya içeriği' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'event_date',
        label: 'Çekim tarihi',
        type: 'date',
        required: false,
        legacyColumn: 'event_date',
      },
      {
        key: 'location',
        label: 'Şehir / lokasyon',
        type: 'text',
        required: false,
        placeholder: 'İstanbul',
        legacyColumn: 'location',
      },
      {
        key: 'profile_type',
        label: 'İhtiyaç duyulan profil türü',
        type: 'select',
        required: false,
        options: [
          { value: 'lead', label: 'Ana rol oyuncusu' },
          { value: 'support', label: 'Yardımcı oyuncu' },
          { value: 'extra', label: 'Figüran' },
          { value: 'theater', label: 'Tiyatrocu' },
          { value: 'special', label: 'Özel yetenekli oyuncu' },
        ],
      },
      {
        key: 'role_description',
        label: 'Rol / görev tanımı',
        type: 'textarea',
        required: false,
        placeholder: 'Karakter, sahne ve rol beklentileri...',
      },
      {
        key: 'person_count',
        label: 'Kişi sayısı',
        type: 'number',
        required: false,
        placeholder: 'örn. 3',
        legacyColumn: 'guest_count',
      },
      {
        key: 'age_range',
        label: 'Yaş aralığı',
        type: 'text',
        required: false,
        placeholder: 'örn. 25-35',
      },
      {
        key: 'physical_criteria',
        label: 'Fiziksel kriterler',
        type: 'text',
        required: false,
        placeholder: 'Boy, beden, görünüm vb.',
      },
      {
        key: 'experience',
        label: 'Deneyim beklentisi',
        type: 'select',
        required: false,
        options: [
          { value: 'any', label: 'Fark etmez' },
          { value: 'some', label: 'Biraz deneyimli' },
          { value: 'experienced', label: 'Deneyimli / Profesyonel' },
        ],
      },
      {
        key: 'special_skills',
        label: 'Özel yetenek / dil beklentisi',
        type: 'text',
        required: false,
        placeholder: 'Dans, spor, yabancı dil, aksan...',
      },
      {
        key: 'usage_medium',
        label: 'Kullanım mecrası',
        type: 'select',
        required: false,
        options: [
          { value: 'tv', label: 'TV' },
          { value: 'digital', label: 'Dijital / Sosyal medya' },
          { value: 'cinema', label: 'Sinema' },
          { value: 'internal', label: 'Kurum içi' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'budget_range',
        label: 'Bütçe / günlük ücret aralığı',
        type: 'select',
        required: false,
        options: BUDGET_OPTIONS,
        legacyColumn: 'budget_range',
      },
    ],
  },

  // --- MODELLER ---
  {
    slug: 'model',
    intro:
      'Çekim ve profil ihtiyacını paylaş, uygun model teklifi hazırlansın.',
    fields: [
      {
        key: 'project_type',
        label: 'Proje türü',
        type: 'select',
        required: true,
        options: [
          { value: 'catalog', label: 'Katalog / E-ticaret' },
          { value: 'fashion', label: 'Moda / Kampanya' },
          { value: 'photo', label: 'Fotoğraf çekimi' },
          { value: 'runway', label: 'Defile / Podyum' },
          { value: 'promo', label: 'Fuar / Tanıtım' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'event_date',
        label: 'Çekim / etkinlik tarihi',
        type: 'date',
        required: false,
        legacyColumn: 'event_date',
      },
      {
        key: 'location',
        label: 'Şehir / lokasyon',
        type: 'text',
        required: false,
        placeholder: 'İstanbul',
        legacyColumn: 'location',
      },
      {
        key: 'person_count',
        label: 'Kişi sayısı',
        type: 'number',
        required: false,
        placeholder: 'örn. 2',
        legacyColumn: 'guest_count',
      },
      {
        key: 'gender',
        label: 'Cinsiyet / görünüm kriteri',
        type: 'select',
        required: false,
        options: [
          { value: 'female', label: 'Kadın' },
          { value: 'male', label: 'Erkek' },
          { value: 'any', label: 'Fark etmez' },
          { value: 'other', label: 'Belirteceğim' },
        ],
      },
      {
        key: 'age_range',
        label: 'Yaş aralığı',
        type: 'text',
        required: false,
        placeholder: 'örn. 20-30',
      },
      {
        key: 'physical_criteria',
        label: 'Boy / beden / ölçü bilgisi',
        type: 'text',
        required: false,
        placeholder: 'örn. 175 cm, 38 beden',
      },
      {
        key: 'experience',
        label: 'Deneyim beklentisi',
        type: 'select',
        required: false,
        options: [
          { value: 'any', label: 'Fark etmez' },
          { value: 'some', label: 'Biraz deneyimli' },
          { value: 'experienced', label: 'Deneyimli / Profesyonel' },
        ],
      },
      {
        key: 'usage_medium',
        label: 'Kullanım mecrası',
        type: 'select',
        required: false,
        options: [
          { value: 'ecommerce', label: 'E-ticaret / Katalog' },
          { value: 'digital', label: 'Dijital / Sosyal medya' },
          { value: 'print', label: 'Basılı / Outdoor' },
          { value: 'runway', label: 'Defile' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'brief',
        label: 'Brief / detaylar',
        type: 'textarea',
        required: false,
        placeholder: 'Çekim konsepti, beklentiler, referanslar...',
      },
      {
        key: 'budget_range',
        label: 'Bütçe / günlük ücret aralığı',
        type: 'select',
        required: false,
        options: BUDGET_OPTIONS,
        legacyColumn: 'budget_range',
      },
    ],
  },

  // --- İLLÜZYONİST ---
  {
    slug: 'illuzyonist',
    intro:
      'Etkinlik detaylarını paylaş, illüzyonist sana uygun bir gösteri teklifi versin.',
    fields: [
      {
        key: 'event_type',
        label: 'Etkinlik türü',
        type: 'select',
        required: true,
        legacyColumn: 'event_type',
        options: [
          { value: 'birthday', label: 'Doğum günü' },
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'wedding', label: 'Düğün / Nişan' },
          { value: 'kids', label: 'Çocuk etkinliği' },
          { value: 'stage', label: 'Sahne gösterisi' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'event_date',
        label: 'Tarih',
        type: 'date',
        required: false,
        legacyColumn: 'event_date',
      },
      {
        key: 'location',
        label: 'Şehir / mekan',
        type: 'text',
        required: false,
        placeholder: 'İstanbul',
        legacyColumn: 'location',
      },
      {
        key: 'guest_count',
        label: 'Katılımcı sayısı (yaklaşık)',
        type: 'number',
        required: false,
        placeholder: 'örn. 40',
        legacyColumn: 'guest_count',
      },
      {
        key: 'show_type',
        label: 'Gösteri tipi',
        type: 'select',
        required: false,
        options: [
          { value: 'stage', label: 'Sahne gösterisi' },
          { value: 'close_up', label: 'Masa başı / yakın plan' },
          { value: 'mixed', label: 'Karışık' },
          { value: 'no_pref', label: 'Fark etmez' },
        ],
      },
      {
        key: 'duration',
        label: 'Performans süresi',
        type: 'select',
        required: false,
        options: [
          { value: '30m', label: '~30 dakika' },
          { value: '1h', label: '~1 saat' },
          { value: 'flexible', label: 'Esnek / Görüşelim' },
        ],
      },
      {
        key: 'audience',
        label: 'Hedef kitle',
        type: 'select',
        required: false,
        options: [
          { value: 'kids', label: 'Çocuklar' },
          { value: 'adults', label: 'Yetişkinler' },
          { value: 'mixed', label: 'Karışık' },
        ],
      },
      {
        key: 'budget_range',
        label: 'Bütçe aralığı',
        type: 'select',
        required: false,
        options: BUDGET_OPTIONS,
        legacyColumn: 'budget_range',
      },
    ],
  },

  // --- PALYAÇO ---
  {
    slug: 'palyaco',
    intro:
      'Çocuk etkinliğinin detaylarını paylaş, palyaço sana uygun bir teklif versin.',
    fields: [
      {
        key: 'event_type',
        label: 'Etkinlik türü',
        type: 'select',
        required: true,
        legacyColumn: 'event_type',
        options: [
          { value: 'birthday', label: 'Doğum günü' },
          { value: 'school', label: 'Okul etkinliği' },
          { value: 'mall', label: 'AVM / Kurumsal çocuk etkinliği' },
          { value: 'family', label: 'Aile günü' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'event_date',
        label: 'Tarih',
        type: 'date',
        required: false,
        legacyColumn: 'event_date',
      },
      {
        key: 'location',
        label: 'Şehir / mekan',
        type: 'text',
        required: false,
        placeholder: 'İstanbul',
        legacyColumn: 'location',
      },
      {
        key: 'child_count',
        label: 'Çocuk sayısı (yaklaşık)',
        type: 'number',
        required: false,
        placeholder: 'örn. 15',
        legacyColumn: 'guest_count',
      },
      {
        key: 'age_group',
        label: 'Yaş grubu',
        type: 'select',
        required: false,
        options: [
          { value: '0_3', label: '0-3 yaş' },
          { value: '4_6', label: '4-6 yaş' },
          { value: '7_10', label: '7-10 yaş' },
          { value: '10_plus', label: '10+ yaş' },
          { value: 'mixed', label: 'Karışık' },
        ],
      },
      {
        key: 'show_type',
        label: 'Talep edilen gösteri / hizmet',
        type: 'select',
        required: false,
        options: [
          { value: 'clown', label: 'Palyaço gösterisi' },
          { value: 'animation', label: 'Çocuk animasyonu / oyun' },
          { value: 'face_paint', label: 'Yüz boyama' },
          { value: 'balloon', label: 'Balon şekillendirme' },
          { value: 'mixed', label: 'Karışık / Paket' },
        ],
      },
      {
        key: 'duration',
        label: 'Etkinlik süresi',
        type: 'select',
        required: false,
        options: [
          { value: '1h', label: '~1 saat' },
          { value: '2h', label: '~2 saat' },
          { value: 'flexible', label: 'Esnek / Görüşelim' },
        ],
      },
      {
        key: 'budget_range',
        label: 'Bütçe aralığı',
        type: 'select',
        required: false,
        options: BUDGET_OPTIONS,
        legacyColumn: 'budget_range',
      },
    ],
  },

  // --- ORGANİZASYON HİZMETLERİ ---
  {
    slug: 'organizasyon',
    intro:
      'Etkinliğinin kapsamını paylaş, organizasyon ekibi sana uygun bir teklif hazırlasın.',
    fields: [
      {
        key: 'event_type',
        label: 'Etkinlik türü',
        type: 'select',
        required: true,
        legacyColumn: 'event_type',
        options: [
          { value: 'wedding', label: 'Düğün' },
          { value: 'engagement', label: 'Nişan / Kına' },
          { value: 'birthday', label: 'Doğum günü' },
          { value: 'baby_shower', label: 'Baby shower / Gender reveal' },
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'launch', label: 'Açılış / Lansman' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'event_date',
        label: 'Tarih',
        type: 'date',
        required: false,
        legacyColumn: 'event_date',
      },
      {
        key: 'location',
        label: 'Şehir / mekan',
        type: 'text',
        required: false,
        placeholder: 'İstanbul',
        legacyColumn: 'location',
      },
      {
        key: 'guest_count',
        label: 'Katılımcı sayısı (yaklaşık)',
        type: 'number',
        required: false,
        placeholder: 'örn. 200',
        legacyColumn: 'guest_count',
      },
      {
        key: 'scope',
        label: 'Hizmet kapsamı',
        type: 'select',
        required: false,
        options: [
          { value: 'full', label: 'Tam organizasyon (her şey dahil)' },
          { value: 'coordination', label: 'Sadece etkinlik günü koordinasyon' },
          { value: 'concept', label: 'Konsept / dekorasyon tasarımı' },
          { value: 'partial', label: 'Kısmi / Görüşelim' },
        ],
      },
      {
        key: 'concept',
        label: 'Konsept / tema beklentisi',
        type: 'textarea',
        required: false,
        placeholder: 'Tema, renk paleti, tarz, ilham referansları...',
      },
      {
        key: 'extra_services',
        label: 'İhtiyaç duyulan ek hizmetler',
        type: 'text',
        required: false,
        placeholder: 'Fotoğraf, DJ, ikram, sahne vb.',
      },
      {
        key: 'budget_range',
        label: 'Bütçe aralığı',
        type: 'select',
        required: false,
        options: BUDGET_OPTIONS,
        legacyColumn: 'budget_range',
      },
    ],
  },

  // --- TEKNİK EKİP / SES-IŞIK ---
  {
    slug: 'ses-isik',
    intro:
      'Teknik ihtiyaçlarını paylaş, ekip sana uygun bir kurulum teklifi versin.',
    fields: [
      {
        key: 'event_type',
        label: 'Etkinlik türü',
        type: 'select',
        required: true,
        legacyColumn: 'event_type',
        options: [
          { value: 'wedding', label: 'Düğün' },
          { value: 'concert', label: 'Konser / Sahne' },
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'conference', label: 'Konferans / Panel' },
          { value: 'fair', label: 'Fuar / Lansman' },
          { value: 'outdoor', label: 'Açık hava etkinliği' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'event_date',
        label: 'Tarih',
        type: 'date',
        required: false,
        legacyColumn: 'event_date',
      },
      {
        key: 'location',
        label: 'Şehir / mekan',
        type: 'text',
        required: false,
        placeholder: 'İstanbul',
        legacyColumn: 'location',
      },
      {
        key: 'venue_type',
        label: 'Mekan türü',
        type: 'select',
        required: false,
        options: [
          { value: 'indoor', label: 'Kapalı mekan' },
          { value: 'outdoor', label: 'Açık hava' },
          { value: 'both', label: 'İkisi de' },
        ],
      },
      {
        key: 'guest_count',
        label: 'Katılımcı sayısı (yaklaşık)',
        type: 'number',
        required: false,
        placeholder: 'örn. 300',
        legacyColumn: 'guest_count',
      },
      {
        key: 'services_needed',
        label: 'Talep edilen teknik hizmetler',
        type: 'text',
        required: false,
        placeholder: 'Ses, ışık, sahne, LED ekran, mikrofon...',
      },
      {
        key: 'operation_support',
        label: 'Operasyon desteği gerekli mi?',
        type: 'select',
        required: false,
        options: [
          { value: 'full', label: 'Evet, etkinlik boyunca teknik ekip' },
          { value: 'setup', label: 'Sadece kurulum / söküm' },
          { value: 'none', label: 'Gerekmez' },
        ],
      },
      {
        key: 'technical_brief',
        label: 'Teknik brief / rider',
        type: 'textarea',
        required: false,
        placeholder: 'Sanatçı/konuşmacı sayısı, sahne ölçüsü, özel ihtiyaçlar...',
      },
      {
        key: 'budget_range',
        label: 'Bütçe aralığı',
        type: 'select',
        required: false,
        options: BUDGET_OPTIONS,
        legacyColumn: 'budget_range',
      },
    ],
  },
];

// -----------------------------------------------------------------------------
// Erişim yardımcısı
// -----------------------------------------------------------------------------

/**
 * Verilen kategori slug'ına ait brief alanlarını döndürür.
 * Tanımsız slug → DEFAULT_BRIEF_FIELDS (fallback).
 */
export function getBriefFields(categorySlug: string | null): BriefField[] {
  if (!categorySlug) return DEFAULT_BRIEF_FIELDS;
  const found = CATEGORY_BRIEFS.find((c) => c.slug === categorySlug);
  return found ? found.fields : DEFAULT_BRIEF_FIELDS;
}

/**
 * Kategori intro metnini döndürür (varsa).
 */
export function getBriefIntro(categorySlug: string | null): string | null {
  if (!categorySlug) return null;
  return CATEGORY_BRIEFS.find((c) => c.slug === categorySlug)?.intro ?? null;
}

export { CATEGORY_BRIEFS, BUDGET_OPTIONS, EVENT_TYPE_OPTIONS };