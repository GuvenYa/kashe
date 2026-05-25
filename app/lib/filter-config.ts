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
// - Keşfet'te kullanıcı bu alanlarla filtreler → JS tarafında eşleştirme
//
// Saklama biçimi (profiles.attributes içinde):
// - multi  → string[]   (örn. ["pop","electronic"])
// - single → string     (örn. "team")
//
// Not: Her kategorinin İLK 'multi' alanı, keşfet kartında özet etiket olarak
// gösterilir. Bu yüzden en ayırt edici alanı ilk sıraya koy.

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
// Ortak opsiyon setleri (tekrar kullanılan)
// -----------------------------------------------------------------------------

const EXPERIENCE_OPTIONS: FilterFieldOption[] = [
  { value: 'junior', label: '0-2 yıl' },
  { value: 'mid', label: '3-5 yıl' },
  { value: 'senior', label: '6-10 yıl' },
  { value: 'expert', label: '10+ yıl' },
];

const TEAM_OPTIONS: FilterFieldOption[] = [
  { value: 'solo', label: 'Bireysel' },
  { value: 'team', label: 'Ekip' },
  { value: 'both', label: 'Duruma göre' },
];

const LANGUAGE_OPTIONS: FilterFieldOption[] = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'İngilizce' },
  { value: 'tr_en', label: 'Türkçe + İngilizce' },
  { value: 'other', label: 'Diğer diller' },
];

// -----------------------------------------------------------------------------
// Kategori-özel filtre tanımları (12 aktif kategori)
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
        options: TEAM_OPTIONS,
      },
      {
        key: 'experience',
        label: 'Deneyim',
        type: 'single',
        options: EXPERIENCE_OPTIONS,
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
        options: TEAM_OPTIONS,
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
        options: EXPERIENCE_OPTIONS,
      },
    ],
  },

  // --- MÜZİSYEN ---
  {
    slug: 'muzisyen',
    fields: [
      {
        key: 'performance_type',
        label: 'Performans tipleri',
        type: 'multi',
        hint: 'Sunduğun tüm performans biçimleri',
        options: [
          { value: 'solo', label: 'Solo müzisyen' },
          { value: 'duo_trio', label: 'Akustik duo / trio' },
          { value: 'band', label: 'Canlı müzik grubu' },
          { value: 'orchestra', label: 'Orkestra' },
          { value: 'dj_live', label: 'DJ + canlı enstrüman' },
        ],
      },
      {
        key: 'music_genre',
        label: 'Müzik türleri',
        type: 'multi',
        options: [
          { value: 'pop', label: 'Pop' },
          { value: 'jazz_lounge', label: 'Caz / Lounge' },
          { value: 'acoustic', label: 'Akustik' },
          { value: 'thm', label: 'Türk Halk Müziği' },
          { value: 'tsm', label: 'Türk Sanat Müziği' },
          { value: 'classical', label: 'Klasik / Senfonik' },
          { value: 'rock', label: 'Rock / Pop-Rock' },
          { value: 'mixed', label: 'Karışık' },
        ],
      },
      {
        key: 'instruments',
        label: 'Enstrümanlar',
        type: 'multi',
        hint: 'Çaldığın enstrümanlar / vokal',
        options: [
          { value: 'vocal', label: 'Vokal / Şan' },
          { value: 'guitar', label: 'Gitar' },
          { value: 'piano', label: 'Piyano / Klavye' },
          { value: 'violin', label: 'Keman' },
          { value: 'percussion', label: 'Perküsyon / Davul' },
          { value: 'wind', label: 'Üflemeli (saksofon vb.)' },
          { value: 'bass', label: 'Bas gitar' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'event_types',
        label: 'Çaldığın etkinlikler',
        type: 'multi',
        options: [
          { value: 'wedding', label: 'Düğün / Nişan' },
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'gala', label: 'Gala / Davet' },
          { value: 'restaurant', label: 'Restoran / Mekan' },
          { value: 'private', label: 'Özel kutlama' },
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
        key: 'own_sound',
        label: 'Ses sistemi durumu',
        type: 'single',
        options: [
          { value: 'yes', label: 'Kendi ses sistemim var' },
          { value: 'no', label: 'Ses sistemi gerekli' },
        ],
      },
      {
        key: 'experience',
        label: 'Deneyim',
        type: 'single',
        options: EXPERIENCE_OPTIONS,
      },
    ],
  },

  // --- SUNUCU / MODERATÖR ---
  {
    slug: 'sunucu',
    fields: [
      {
        key: 'event_types',
        label: 'Sunduğun etkinlikler',
        type: 'multi',
        hint: 'Hangi etkinlikleri sunuyorsun',
        options: [
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'conference', label: 'Konferans / Panel' },
          { value: 'gala', label: 'Gala / Ödül töreni' },
          { value: 'launch', label: 'Açılış / Lansman' },
          { value: 'wedding', label: 'Düğün / Nişan' },
          { value: 'fair', label: 'Fuar / Stand' },
          { value: 'tv', label: 'TV / Yayın' },
          { value: 'sports', label: 'Spor etkinliği' },
        ],
      },
      {
        key: 'style',
        label: 'Sunum tarzları',
        type: 'multi',
        options: [
          { value: 'formal', label: 'Resmi / Protokol' },
          { value: 'corporate', label: 'Kurumsal' },
          { value: 'energetic', label: 'Enerjik / Eğlenceli' },
          { value: 'elegant', label: 'Zarif / Sofistike' },
        ],
      },
      {
        key: 'language',
        label: 'Sunum dilleri',
        type: 'multi',
        hint: 'Hangi dillerde sunabiliyorsun',
        options: LANGUAGE_OPTIONS,
      },
      {
        key: 'format',
        label: 'Etkinlik formatı',
        type: 'multi',
        options: [
          { value: 'physical', label: 'Yüz yüze' },
          { value: 'online', label: 'Çevrim içi' },
          { value: 'hybrid', label: 'Hibrit' },
        ],
      },
      {
        key: 'experience',
        label: 'Deneyim',
        type: 'single',
        options: EXPERIENCE_OPTIONS,
      },
    ],
  },

  // --- HOST / HOSTES ---
  {
    slug: 'hostes',
    fields: [
      {
        key: 'event_types',
        label: 'Çalıştığın etkinlikler',
        type: 'multi',
        hint: 'Hangi etkinliklerde görev alıyorsun',
        options: [
          { value: 'fair', label: 'Fuar / Stand' },
          { value: 'launch', label: 'Lansman / Açılış' },
          { value: 'congress', label: 'Kongre / Konferans' },
          { value: 'gala', label: 'Gala / Davet' },
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'activation', label: 'Marka aktivasyonu' },
          { value: 'sports', label: 'Spor etkinliği' },
        ],
      },
      {
        key: 'task_types',
        label: 'Görev türleri',
        type: 'multi',
        options: [
          { value: 'welcome', label: 'Karşılama' },
          { value: 'registration', label: 'Kayıt masası' },
          { value: 'promotion', label: 'Tanıtım / Stand' },
          { value: 'vip', label: 'VIP karşılama' },
          { value: 'service', label: 'Servis desteği' },
          { value: 'guide', label: 'Yönlendirme / Rehberlik' },
        ],
      },
      {
        key: 'language',
        label: 'Yabancı dil',
        type: 'multi',
        hint: 'Bildiğin diller',
        options: [
          { value: 'en', label: 'İngilizce' },
          { value: 'de', label: 'Almanca' },
          { value: 'ru', label: 'Rusça' },
          { value: 'ar', label: 'Arapça' },
          { value: 'fr', label: 'Fransızca' },
          { value: 'other', label: 'Diğer' },
        ],
      },
      {
        key: 'work_duration',
        label: 'Çalışma süresi tercihi',
        type: 'single',
        options: [
          { value: 'hourly', label: 'Saatlik / kısa' },
          { value: 'full_day', label: 'Tam gün' },
          { value: 'multi_day', label: 'Çok günlük' },
          { value: 'flexible', label: 'Esnek' },
        ],
      },
      {
        key: 'experience',
        label: 'Deneyim',
        type: 'single',
        options: EXPERIENCE_OPTIONS,
      },
    ],
  },

  // --- VİDEOGRAF ---
  {
    slug: 'videograf',
    fields: [
      {
        key: 'shoot_types',
        label: 'Çekim türleri',
        type: 'multi',
        hint: 'Yaptığın tüm video çekim türleri',
        options: [
          { value: 'wedding', label: 'Düğün / Nişan' },
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'promo', label: 'Tanıtım filmi' },
          { value: 'ad', label: 'Reklam filmi' },
          { value: 'social', label: 'Sosyal medya içeriği' },
          { value: 'product', label: 'Ürün / Katalog' },
          { value: 'music_video', label: 'Klip / Müzik videosu' },
          { value: 'event', label: 'Etkinlik / Konser' },
        ],
      },
      {
        key: 'style',
        label: 'Çekim / kurgu tarzı',
        type: 'multi',
        options: [
          { value: 'cinematic', label: 'Sinematik' },
          { value: 'documentary', label: 'Belgesel / Doğal' },
          { value: 'dynamic', label: 'Dinamik / Hızlı kurgu' },
          { value: 'minimal', label: 'Minimal / Sade' },
        ],
      },
      {
        key: 'extras',
        label: 'Sunduğun ek hizmetler',
        type: 'multi',
        hint: 'Ekipman ve ekstra hizmetler',
        options: [
          { value: 'drone', label: 'Drone çekimi' },
          { value: 'editing', label: 'Kurgu / montaj' },
          { value: 'color', label: 'Renk düzenleme' },
          { value: 'multicam', label: 'Çoklu kamera' },
          { value: 'photo', label: 'Fotoğraf da çekiyorum' },
          { value: 'live', label: 'Canlı yayın çekimi' },
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
        key: 'team_type',
        label: 'Çalışma şekli',
        type: 'single',
        options: TEAM_OPTIONS,
      },
      {
        key: 'experience',
        label: 'Deneyim',
        type: 'single',
        options: EXPERIENCE_OPTIONS,
      },
    ],
  },

  // --- OYUNCU / FİGÜRAN ---
  {
    slug: 'oyuncu',
    fields: [
      {
        key: 'profile_types',
        label: 'Oyunculuk türleri',
        type: 'multi',
        hint: 'Hangi rollerde yer alıyorsun',
        options: [
          { value: 'lead', label: 'Ana rol' },
          { value: 'support', label: 'Yardımcı rol' },
          { value: 'extra', label: 'Figüran' },
          { value: 'theater', label: 'Tiyatro' },
          { value: 'voice', label: 'Seslendirme / Dublaj' },
          { value: 'special', label: 'Özel yetenek' },
        ],
      },
      {
        key: 'project_types',
        label: 'Proje türleri',
        type: 'multi',
        options: [
          { value: 'ad', label: 'Reklam' },
          { value: 'series_film', label: 'Dizi / Film' },
          { value: 'short', label: 'Kısa film' },
          { value: 'theater', label: 'Tiyatro / Sahne' },
          { value: 'social', label: 'Sosyal medya içeriği' },
          { value: 'mv', label: 'Klip' },
        ],
      },
      {
        key: 'skills',
        label: 'Özel yetenekler',
        type: 'multi',
        hint: 'Sahip olduğun özel yetenekler',
        options: [
          { value: 'dance', label: 'Dans' },
          { value: 'sing', label: 'Şarkı / Vokal' },
          { value: 'sports', label: 'Spor / Akrobasi' },
          { value: 'instrument', label: 'Enstrüman' },
          { value: 'accent', label: 'Aksan / Şive' },
          { value: 'language', label: 'Yabancı dil' },
          { value: 'horse', label: 'Binicilik' },
          { value: 'martial', label: 'Dövüş sanatları' },
        ],
      },
      {
        key: 'gender',
        label: 'Cinsiyet',
        type: 'single',
        options: [
          { value: 'female', label: 'Kadın' },
          { value: 'male', label: 'Erkek' },
        ],
      },
      {
        key: 'age_group',
        label: 'Yaş grubu',
        type: 'single',
        options: [
          { value: 'child', label: 'Çocuk (0-12)' },
          { value: 'teen', label: 'Genç (13-19)' },
          { value: 'young', label: 'Genç yetişkin (20-30)' },
          { value: 'adult', label: 'Yetişkin (31-45)' },
          { value: 'mature', label: 'Olgun (46+)' },
        ],
      },
      {
        key: 'experience',
        label: 'Deneyim',
        type: 'single',
        options: EXPERIENCE_OPTIONS,
      },
    ],
  },

  // --- MODEL ---
  {
    slug: 'model',
    fields: [
      {
        key: 'model_types',
        label: 'Mankenlik türleri',
        type: 'multi',
        hint: 'Hangi alanlarda çalışıyorsun',
        options: [
          { value: 'catalog', label: 'Katalog / E-ticaret' },
          { value: 'fashion', label: 'Moda / Kampanya' },
          { value: 'runway', label: 'Defile / Podyum' },
          { value: 'beauty', label: 'Güzellik / Kozmetik' },
          { value: 'promo', label: 'Fuar / Tanıtım' },
          { value: 'editorial', label: 'Editöryel / Dergi' },
          { value: 'fitness', label: 'Fitness / Spor' },
          { value: 'hand_foot', label: 'El / Ayak / Detay' },
        ],
      },
      {
        key: 'project_types',
        label: 'Proje türleri',
        type: 'multi',
        options: [
          { value: 'photo', label: 'Fotoğraf çekimi' },
          { value: 'video', label: 'Video / Reklam' },
          { value: 'runway', label: 'Defile' },
          { value: 'event', label: 'Etkinlik / Fuar' },
        ],
      },
      {
        key: 'gender',
        label: 'Cinsiyet',
        type: 'single',
        options: [
          { value: 'female', label: 'Kadın' },
          { value: 'male', label: 'Erkek' },
        ],
      },
      {
        key: 'age_group',
        label: 'Yaş grubu',
        type: 'single',
        options: [
          { value: 'child', label: 'Çocuk (0-12)' },
          { value: 'teen', label: 'Genç (13-19)' },
          { value: 'young', label: 'Genç yetişkin (20-30)' },
          { value: 'adult', label: 'Yetişkin (31-45)' },
          { value: 'mature', label: 'Olgun (46+)' },
        ],
      },
      {
        key: 'experience',
        label: 'Deneyim',
        type: 'single',
        options: EXPERIENCE_OPTIONS,
      },
    ],
  },

  // --- İLLÜZYONİST ---
  {
    slug: 'illuzyonist',
    fields: [
      {
        key: 'show_types',
        label: 'Gösteri türleri',
        type: 'multi',
        hint: 'Sunduğun gösteri biçimleri',
        options: [
          { value: 'stage', label: 'Sahne gösterisi' },
          { value: 'close_up', label: 'Masa başı / yakın plan' },
          { value: 'mentalism', label: 'Zihin okuma / mentalizm' },
          { value: 'comedy', label: 'Komedi sihir' },
          { value: 'illusion', label: 'Büyük illüzyon' },
          { value: 'kids', label: 'Çocuk gösterisi' },
        ],
      },
      {
        key: 'event_types',
        label: 'Sahne aldığın etkinlikler',
        type: 'multi',
        options: [
          { value: 'birthday', label: 'Doğum günü' },
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'wedding', label: 'Düğün / Nişan' },
          { value: 'kids', label: 'Çocuk etkinliği' },
          { value: 'stage', label: 'Sahne / TV' },
        ],
      },
      {
        key: 'audience',
        label: 'Hedef kitle',
        type: 'multi',
        options: [
          { value: 'kids', label: 'Çocuklar' },
          { value: 'adults', label: 'Yetişkinler' },
          { value: 'mixed', label: 'Karışık' },
        ],
      },
      {
        key: 'experience',
        label: 'Deneyim',
        type: 'single',
        options: EXPERIENCE_OPTIONS,
      },
    ],
  },

  // --- PALYAÇO ---
  {
    slug: 'palyaco',
    fields: [
      {
        key: 'show_types',
        label: 'Sunduğun hizmetler',
        type: 'multi',
        hint: 'Yaptığın tüm gösteri / animasyonlar',
        options: [
          { value: 'clown', label: 'Palyaço gösterisi' },
          { value: 'animation', label: 'Çocuk animasyonu / oyun' },
          { value: 'face_paint', label: 'Yüz boyama' },
          { value: 'balloon', label: 'Balon şekillendirme' },
          { value: 'magic', label: 'Sihir gösterisi' },
          { value: 'puppet', label: 'Kukla gösterisi' },
          { value: 'mascot', label: 'Maskot / kostüm' },
        ],
      },
      {
        key: 'event_types',
        label: 'Etkinlik türleri',
        type: 'multi',
        options: [
          { value: 'birthday', label: 'Doğum günü' },
          { value: 'school', label: 'Okul etkinliği' },
          { value: 'mall', label: 'AVM / Kurumsal' },
          { value: 'family', label: 'Aile günü' },
        ],
      },
      {
        key: 'age_group',
        label: 'Yaş grubu',
        type: 'multi',
        options: [
          { value: '0_3', label: '0-3 yaş' },
          { value: '4_6', label: '4-6 yaş' },
          { value: '7_10', label: '7-10 yaş' },
          { value: '10_plus', label: '10+ yaş' },
        ],
      },
      {
        key: 'experience',
        label: 'Deneyim',
        type: 'single',
        options: EXPERIENCE_OPTIONS,
      },
    ],
  },

  // --- ORGANİZASYON HİZMETLERİ ---
  {
    slug: 'organizasyon',
    fields: [
      {
        key: 'event_types',
        label: 'Düzenlediğin etkinlikler',
        type: 'multi',
        hint: 'Hangi etkinlikleri organize ediyorsun',
        options: [
          { value: 'wedding', label: 'Düğün' },
          { value: 'engagement', label: 'Nişan / Kına' },
          { value: 'birthday', label: 'Doğum günü' },
          { value: 'baby', label: 'Baby shower / Gender reveal' },
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'launch', label: 'Açılış / Lansman' },
          { value: 'fair', label: 'Fuar / Kongre' },
          { value: 'concert', label: 'Konser / Festival' },
        ],
      },
      {
        key: 'scope',
        label: 'Hizmet kapsamı',
        type: 'multi',
        options: [
          { value: 'full', label: 'Tam organizasyon' },
          { value: 'coordination', label: 'Gün koordinasyonu' },
          { value: 'concept', label: 'Konsept / tasarım' },
          { value: 'decor', label: 'Dekorasyon' },
          { value: 'catering', label: 'İkram / catering' },
          { value: 'venue', label: 'Mekan bulma' },
        ],
      },
      {
        key: 'extras',
        label: 'Sağladığın ek hizmetler',
        type: 'multi',
        hint: 'Kendi bünyende sunduğun hizmetler',
        options: [
          { value: 'photo', label: 'Fotoğraf / video' },
          { value: 'music', label: 'DJ / müzik' },
          { value: 'sound_light', label: 'Ses / ışık' },
          { value: 'host', label: 'Sunucu / host' },
          { value: 'flower', label: 'Çiçek / süsleme' },
          { value: 'transport', label: 'Ulaşım / transfer' },
        ],
      },
      {
        key: 'experience',
        label: 'Deneyim',
        type: 'single',
        options: EXPERIENCE_OPTIONS,
      },
    ],
  },

  // --- TEKNİK EKİP / SES-IŞIK ---
  {
    slug: 'ses-isik',
    fields: [
      {
        key: 'services',
        label: 'Teknik hizmetler',
        type: 'multi',
        hint: 'Sağladığın tüm teknik hizmetler',
        options: [
          { value: 'sound', label: 'Ses sistemi' },
          { value: 'lighting', label: 'Işık sistemi' },
          { value: 'stage', label: 'Sahne / podyum' },
          { value: 'led', label: 'LED ekran' },
          { value: 'projection', label: 'Projeksiyon / mapping' },
          { value: 'truss', label: 'Truss / rigging' },
          { value: 'generator', label: 'Jeneratör / güç' },
          { value: 'special', label: 'Özel efekt (sis, konfeti)' },
        ],
      },
      {
        key: 'event_types',
        label: 'Hizmet verdiğin etkinlikler',
        type: 'multi',
        options: [
          { value: 'concert', label: 'Konser / Sahne' },
          { value: 'wedding', label: 'Düğün' },
          { value: 'corporate', label: 'Kurumsal etkinlik' },
          { value: 'conference', label: 'Konferans' },
          { value: 'fair', label: 'Fuar / Lansman' },
          { value: 'festival', label: 'Festival' },
        ],
      },
      {
        key: 'venue_type',
        label: 'Mekan türü',
        type: 'multi',
        options: [
          { value: 'indoor', label: 'Kapalı mekan' },
          { value: 'outdoor', label: 'Açık hava' },
        ],
      },
      {
        key: 'operation',
        label: 'Operasyon desteği',
        type: 'single',
        options: [
          { value: 'full', label: 'Etkinlik boyunca teknik ekip' },
          { value: 'setup', label: 'Sadece kurulum / söküm' },
          { value: 'rental', label: 'Sadece ekipman kiralama' },
        ],
      },
      {
        key: 'experience',
        label: 'Deneyim',
        type: 'single',
        options: EXPERIENCE_OPTIONS,
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
