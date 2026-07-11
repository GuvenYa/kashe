// =============================================================================
// KATEGORİ ALAN KONFİGÜRASYONU — /p/[id] redesign (tek kaynak, tip-güvenli)
// category-content.ts kalıbı: config-driven, migration'sız alan eklenebilir.
//
// Kategoriye özel profil verisi iki yerde yaşar:
//   1) profiles.category_attributes (JSONB) — quickInfo değerleri, modül verileri,
//      ortak alanlar (aşağıdaki şema).
//   2) public.profile_experiences (tablo) — work/education/award satırları.
//
// -----------------------------------------------------------------------------
// profiles.category_attributes JSONB ŞEMASI (kategori bağımsız ortak anahtarlar):
// {
//   "service_region": "Türkiye geneli + çevrimiçi",   // Şehir dışına çıkar | Türkiye geneli | Türkiye geneli + çevrimiçi
//   "experience_label": "9 yıl · 400+ etkinlik",        // rozet/başlık için serbest metin — DENEYİM tek kaynağı
//   "summary": { "title": "...", "body": "...", "stats": [{ "label": "...", "value": "..." }] },
//                                                       // yalnız 'uzmanlik' arketipinde medya hero yerine zümrüt özet bandı
//                                                       // (başlık + kısa metin + stat çipleri)
//   "logistics": { "ehliyet": true, "sehir_disi": true }, // logisticsChecks key -> boolean
//   "skills": [{ "name": "Vals", "level": 3 }],           // seviyeli yetenekler (1-3); cast kategorileri
//   "section_taglines": { "performans": "..." },          // modül key -> kategoriye özel tagline override (kullanıcı)
//   "quick": { "<quickInfoKey>": "<değer>" },             // Hakkımda altı 4'lü hızlı bilgi değerleri
//                                                       // NOT: quick.deneyim TÜRETİLMİŞTİR — experience_label'dan
//                                                       // kayıtta yazılır; formda ayrı girdisi yoktur (drift önlenir).
//   "modules": {                                          // modül key -> modüle özel veri (ModuleDefinition.fields şekline göre)
//     "repertuar": { "genres": ["House","Techno"], "notes": "..." },
//     "sosyal_erisim": { "platforms": [{ "platform": "instagram", "followers_range": "10k-50k" }] },
//     "fiziksel": { "height": "180", "size": "M", "shoe": "42", "hair": "Kahve", "eyes": "Yeşil" },
//     "diller_belgeler": { "language_pairs": [...], "documents": [{ "name": "...", "status": "uploaded" }] }
//   }
// }
// NOT: JSONB serbest/genişletilebilir; UI yalnız config'te tanımlı key'leri render eder.
// NOT: sosyal_erisim'de LINK alanı YOKTUR (SIRA1 kuralı) — yalnız takipçi ARALIĞI.
// NOT: fiziksel opt-in'dir ve UI'da "Kullanıcı beyanı" etiketi ZORUNLUDUR (KVKK).
// NOT: belge durumu "Belge yüklendi" olarak gösterilir — "doğrulandı" DEĞİL (Fahri kararı).
// =============================================================================

// ---- Arketipler ----
export type Archetype = 'sahne' | 'cast' | 'produksiyon' | 'uzmanlik';

// ---- Modül anahtarları ----
export type ModuleKey =
  | 'repertuar'
  | 'ekipman'
  | 'performans'
  | 'fiziksel'
  | 'sosyal_erisim'
  | 'diller_belgeler'
  | 'uzmanlik_alanlari'
  | 'calisma_parametreleri'
  | 'teknik_teslimat';

// ---- Modül alan tipleri (UI render'ı ADIM 2/3'te bunu okur) ----
export type ModuleFieldType =
  | 'chips' // çipler
  | 'text' // serbest paragraf / not
  | 'bullet_list' // madde listesi
  | 'key_value' // anahtar-değer satırları
  | 'physical' // Boy/Beden/Ayak/Saç/Göz
  | 'social_reach' // platform + takipçi aralığı (link YOK)
  | 'language_pairs' // dil çifti kartları
  | 'documents'; // belge satırı ("Belge yüklendi")

export interface ModuleFieldDef {
  key: string;
  type: ModuleFieldType;
  label: string;
  note?: string;
}

export interface ModuleDefinition {
  key: ModuleKey;
  defaultTitle: string;
  fields: ModuleFieldDef[];
  // Fahri/KVKK zorunlu UI etiketi/uyarısı
  disclaimer?: string;
}

// ---- Deneyim grubu (work türü) ----
export interface ExperienceGroup {
  key: string;
  label: string;
}

// ---- Açıklamalı lojistik onay satırı ----
export interface LogisticsCheck {
  key: string;
  label: string;
  description: string;
}

// ---- Kategoriye özel modül referansı (başlık/tagline override) ----
export interface ModuleRef {
  key: ModuleKey;
  title?: string; // kategoriye özel başlık (ör. DJ → "Sahne Bilgileri")
  tagline?: string; // kategoriye özel alt açıklama
}

// ---- Kategori preset'i ----
export interface CategoryFieldConfig {
  archetype: Archetype;
  /** Hakkımda altı 4'lü hızlı bilgi satırının alan key'leri */
  quickInfo: string[];
  /** Sıralı modül listesi (başlık/tagline override'ı ile) */
  modules: ModuleRef[];
  /** 'work' türü deneyim grupları */
  experienceGroups: ExperienceGroup[];
  /** Açıklamalı onay satırları (kategoriye özel açıklama) */
  logisticsChecks: LogisticsCheck[];
  /** Seviyeli yetenekler bölümü açık mı (cast kategorileri) */
  skillsWithLevels: boolean;
  /** Hibrit: cast'ten portföy grid'i açık mı (ör. karikatürist) */
  portfolioGrid?: boolean;
}

// ---- DB satırı: public.profile_experiences ----
export interface ProfileExperience {
  id: string;
  profile_id: string;
  kind: 'work' | 'education' | 'award';
  group_key: string | null;
  title: string;
  subtitle: string | null;
  organization: string | null;
  location: string | null;
  period_label: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ---- category_attributes içindeki ortak yapı ----
export interface LeveledSkill {
  name: string;
  level: 1 | 2 | 3;
}

export const SERVICE_REGION_OPTIONS = [
  'Şehir dışına çıkar',
  'Türkiye geneli',
  'Türkiye geneli + çevrimiçi',
] as const;

// =============================================================================
// FORM OPTION SABİTLERİ — tek doğruluk kaynağı (form + public render + actions ortak)
// NOT: 'use server' dosyalarından sabit export ETME; Next onları server-action
// referansına çevirir → client'ta ".map is not a function". Sabitler BURADA yaşar.
// =============================================================================

/** Sosyal erişim takipçi ARALIĞI seçenekleri (C3 — kesin sayı/URL yok). */
export const FOLLOWERS_RANGES = ['10B altı', '10–50B', '50–250B', '250B+'] as const;

/** Seviyeli yetenek seçenekleri (cast kategorileri formu). */
export const SKILL_LEVELS = [
  { value: 1, label: '1 · Temel' },
  { value: 2, label: '2 · İyi' },
  { value: 3, label: '3 · Uzman' },
] as const;

/** quickInfo alan key → görünen (normal case) etiket. Public render + form ortak sözlük. */
export const QUICK_LABELS: Record<string, string> = {
  turler: 'Türler', deneyim: 'Deneyim', set_suresi: 'Set süresi',
  ekipman_durumu: 'Ekipman', enstruman: 'Enstrüman', ekip_boyutu: 'Ekip',
  dans_turleri: 'Dans türleri', gosteri_suresi: 'Gösteri süresi',
  gosteri_turu: 'Gösteri türü', dil: 'Dil', yas_grubu: 'Yaş grubu',
  sunuculuk_turu: 'Sunuculuk türü', etkinlik_turleri: 'Etkinlik türleri',
  oynayabildigi_yas_araligi: 'Oynayabildiği yaş aralığı', boy: 'Boy',
  calisma_sekli: 'Çalışma şekli', uzmanlik: 'Uzmanlık',
  teslim_suresi: 'Teslim süresi', drone: 'Drone', hizmet_turu: 'Hizmet türü',
  ekipman_kapasitesi: 'Ekipman kapasitesi', kurulum_suresi: 'Kurulum süresi',
  dil_cifti: 'Dil çifti', ceviri_turleri: 'Çeviri türleri', yeminli: 'Yeminli',
  cizim_turu: 'Çizim türü',
};

// =============================================================================
// MODÜL KAYIT DEFTERİ — 9 modül
// =============================================================================
export const MODULE_REGISTRY: Record<ModuleKey, ModuleDefinition> = {
  repertuar: {
    key: 'repertuar',
    defaultTitle: 'Repertuar',
    fields: [
      { key: 'genres', type: 'chips', label: 'Türler / stiller' },
      { key: 'notes', type: 'text', label: 'Serbest açıklama' },
    ],
  },
  ekipman: {
    key: 'ekipman',
    defaultTitle: 'Ekipman',
    fields: [
      { key: 'items', type: 'bullet_list', label: 'Ekipman listesi' },
      {
        key: 'venue_requirements',
        type: 'text',
        label: 'Mekan gereksinimleri',
      },
    ],
  },
  performans: {
    key: 'performans',
    // Başlık kategoriye göre override edilir (DJ: "Sahne Bilgileri",
    // palyaço/illüzyonist: "Gösteri Bilgileri" vb.)
    defaultTitle: 'Performans Bilgileri',
    fields: [
      { key: 'details', type: 'key_value', label: 'Anahtar bilgiler' },
      { key: 'what_to_expect', type: 'text', label: 'Sizi ne bekliyor' },
      {
        key: 'setup_logistics',
        type: 'text',
        label: 'Kurulum / lojistik notları',
      },
    ],
  },
  fiziksel: {
    key: 'fiziksel',
    defaultTitle: 'Fiziksel Özellikler',
    fields: [
      { key: 'height', type: 'physical', label: 'Boy' },
      { key: 'size', type: 'physical', label: 'Beden' },
      { key: 'shoe', type: 'physical', label: 'Ayak' },
      { key: 'hair', type: 'physical', label: 'Saç' },
      { key: 'eyes', type: 'physical', label: 'Göz' },
    ],
    disclaimer: 'Kullanıcı beyanı', // KVKK — UI'da zorunlu etiket
  },
  sosyal_erisim: {
    key: 'sosyal_erisim',
    defaultTitle: 'Sosyal Erişim',
    fields: [
      {
        key: 'platforms',
        type: 'social_reach',
        label: 'Platformlar',
        note: 'Takipçi aralığı — link alanı YOK (SIRA1)',
      },
    ],
  },
  diller_belgeler: {
    key: 'diller_belgeler',
    defaultTitle: 'Diller & Belgeler',
    fields: [
      { key: 'language_pairs', type: 'language_pairs', label: 'Dil çiftleri' },
      { key: 'documents', type: 'documents', label: 'Belgeler' },
    ],
    disclaimer: 'Belge yüklendi', // "doğrulandı" DEĞİL (Fahri kararı)
  },
  uzmanlik_alanlari: {
    key: 'uzmanlik_alanlari',
    defaultTitle: 'Uzmanlık Alanları',
    fields: [{ key: 'areas', type: 'chips', label: 'Alanlar' }],
  },
  calisma_parametreleri: {
    key: 'calisma_parametreleri',
    defaultTitle: 'Çalışma Parametreleri',
    fields: [
      { key: 'params', type: 'key_value', label: 'Parametreler' },
      { key: 'notes', type: 'text', label: 'Not' },
    ],
  },
  teknik_teslimat: {
    key: 'teknik_teslimat',
    defaultTitle: 'Teknik & Teslimat',
    fields: [
      {
        key: 'delivery',
        type: 'key_value',
        label: 'Teslim / kapasite bilgileri', // teslim süresi, drone, kapasite vb.
      },
    ],
  },
};

// =============================================================================
// KATEGORİ PRESET'LERİ — 16 kategori (GERÇEK slug'lar)
// =============================================================================
export const CATEGORY_FIELDS: Record<string, CategoryFieldConfig> = {
  // ---------------------------- SAHNE ----------------------------
  dj: {
    archetype: 'sahne',
    quickInfo: ['turler', 'deneyim', 'set_suresi', 'ekipman_durumu'],
    modules: [
      { key: 'repertuar' },
      { key: 'ekipman' },
      { key: 'performans', title: 'Sahne Bilgileri' },
      { key: 'sosyal_erisim' },
    ],
    experienceGroups: [
      { key: 'kulup_mekan', label: 'Kulüp & Mekan' },
      { key: 'festival', label: 'Festival' },
      { key: 'kurumsal_ozel', label: 'Kurumsal & Özel Davet' },
    ],
    logisticsChecks: [
      { key: 'ehliyet', label: 'Ehliyet', description: 'Kendi ekipmanını taşır' },
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı etkinliklere gider' },
      { key: 'kendi_ekipmani', label: 'Kendi ekipmanı', description: 'Kendi ses sistemiyle gelebilir' },
    ],
    skillsWithLevels: false,
  },
  muzisyen: {
    archetype: 'sahne',
    quickInfo: ['turler', 'enstruman', 'deneyim', 'ekip_boyutu'],
    modules: [
      { key: 'repertuar' },
      { key: 'ekipman' },
      { key: 'performans', title: 'Sahne Bilgileri' },
      { key: 'sosyal_erisim' },
    ],
    experienceGroups: [
      { key: 'sahne_konser', label: 'Sahne & Konser' },
      { key: 'kurumsal_ozel', label: 'Kurumsal & Özel Davet' },
      { key: 'studyo_kayit', label: 'Stüdyo & Kayıt' },
    ],
    logisticsChecks: [
      { key: 'ehliyet', label: 'Ehliyet', description: 'Enstrüman/ekipman ulaşımı' },
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı sahnelere gider' },
      { key: 'kendi_ekipmani', label: 'Kendi ekipmanı', description: 'Kendi enstrüman/ekipmanı ile' },
    ],
    skillsWithLevels: false,
  },
  dansci: {
    archetype: 'sahne',
    quickInfo: ['dans_turleri', 'deneyim', 'ekip_boyutu', 'gosteri_suresi'],
    modules: [
      { key: 'performans', title: 'Gösteri Bilgileri' },
      { key: 'uzmanlik_alanlari', title: 'Dans Türleri' },
      { key: 'sosyal_erisim' },
    ],
    experienceGroups: [
      { key: 'sahne_gosteri', label: 'Sahne Gösterisi' },
      { key: 'festival_etkinlik', label: 'Festival & Etkinlik' },
      { key: 'kurumsal_ozel', label: 'Kurumsal & Özel Davet' },
    ],
    logisticsChecks: [
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı gösterilere gider' },
      { key: 'kostum', label: 'Kostüm', description: 'Kendi kostümüyle gelir' },
    ],
    skillsWithLevels: false,
  },
  'stand-up-komedyen': {
    archetype: 'sahne',
    quickInfo: ['gosteri_turu', 'deneyim', 'gosteri_suresi', 'dil'],
    modules: [
      { key: 'performans', title: 'Gösteri Bilgileri' },
      { key: 'sosyal_erisim' },
    ],
    experienceGroups: [
      { key: 'sahne_gosteri', label: 'Sahne Gösterisi' },
      { key: 'kurumsal_etkinlik', label: 'Kurumsal Etkinlik' },
      { key: 'ozel_davet', label: 'Özel Davet' },
    ],
    logisticsChecks: [
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı sahnelere gider' },
    ],
    skillsWithLevels: false,
  },
  illuzyonist: {
    archetype: 'sahne',
    quickInfo: ['gosteri_turu', 'deneyim', 'gosteri_suresi', 'yas_grubu'],
    modules: [
      { key: 'performans', title: 'Gösteri Bilgileri' },
      { key: 'ekipman' },
    ],
    experienceGroups: [
      { key: 'sahne_gosteri', label: 'Sahne Gösterisi' },
      { key: 'yakin_plan', label: 'Yakın Plan (Close-up)' },
      { key: 'kurumsal_ozel', label: 'Kurumsal & Özel Davet' },
    ],
    logisticsChecks: [
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı gösterilere gider' },
      { key: 'kendi_ekipmani', label: 'Kendi ekipmanı', description: 'Sahne düzenini kendi kurar' },
    ],
    skillsWithLevels: false,
  },
  palyaco: {
    archetype: 'sahne',
    quickInfo: ['gosteri_turu', 'deneyim', 'gosteri_suresi', 'yas_grubu'],
    modules: [{ key: 'performans', title: 'Gösteri Bilgileri' }],
    experienceGroups: [
      { key: 'cocuk_etkinligi', label: 'Çocuk Etkinliği' },
      { key: 'festival_fuar', label: 'Festival & Fuar' },
      { key: 'ozel_davet', label: 'Özel Davet' },
    ],
    logisticsChecks: [
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı etkinliklere gider' },
    ],
    skillsWithLevels: false,
  },
  sunucu: {
    archetype: 'sahne',
    quickInfo: ['sunuculuk_turu', 'deneyim', 'dil', 'etkinlik_turleri'],
    modules: [
      { key: 'performans', title: 'Sunum Bilgileri' },
      { key: 'diller_belgeler', title: 'Diller' },
      { key: 'sosyal_erisim' },
    ],
    experienceGroups: [
      { key: 'kurumsal_etkinlik', label: 'Kurumsal Etkinlik' },
      { key: 'dugun_ozel', label: 'Düğün & Özel Davet' },
      { key: 'sahne_festival', label: 'Sahne & Festival' },
    ],
    logisticsChecks: [
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı etkinliklere gider' },
    ],
    skillsWithLevels: false,
  },

  // ---------------------------- CAST ----------------------------
  model: {
    archetype: 'cast',
    quickInfo: ['oynayabildigi_yas_araligi', 'boy', 'deneyim', 'calisma_sekli'],
    modules: [
      { key: 'fiziksel' },
      { key: 'uzmanlik_alanlari', title: 'Çalışma Alanları' },
      { key: 'sosyal_erisim' },
    ],
    experienceGroups: [
      { key: 'defile', label: 'Defile' },
      { key: 'katalog_kampanya', label: 'Katalog & Kampanya' },
      { key: 'editoryal', label: 'Editoryal' },
    ],
    logisticsChecks: [
      { key: 'ulasim', label: 'Ulaşım', description: 'Set lokasyonlarına ulaşım' },
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı çekimlere katılır' },
    ],
    skillsWithLevels: true,
  },
  oyuncu: {
    archetype: 'cast',
    quickInfo: ['oynayabildigi_yas_araligi', 'deneyim', 'uzmanlik', 'dil'],
    modules: [
      { key: 'fiziksel' },
      { key: 'diller_belgeler', title: 'Diller' },
      { key: 'uzmanlik_alanlari', title: 'Özel Yetenekler' },
    ],
    experienceGroups: [
      { key: 'tiyatro', label: 'Tiyatro' },
      { key: 'film', label: 'Film' },
      { key: 'dizi', label: 'Dizi' },
      { key: 'reklam', label: 'Reklam' },
    ],
    logisticsChecks: [
      { key: 'ulasim', label: 'Ulaşım', description: 'Set/prova lokasyonlarına ulaşım' },
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı projelere katılır' },
    ],
    skillsWithLevels: true,
  },
  hostes: {
    archetype: 'cast',
    quickInfo: ['deneyim', 'dil', 'etkinlik_turleri', 'calisma_sekli'],
    modules: [
      { key: 'fiziksel' },
      { key: 'diller_belgeler', title: 'Diller' },
      { key: 'calisma_parametreleri' },
    ],
    experienceGroups: [
      { key: 'kurumsal_etkinlik', label: 'Kurumsal Etkinlik' },
      { key: 'fuar_lansman', label: 'Fuar & Lansman' },
      { key: 'ozel_davet', label: 'Özel Davet' },
    ],
    logisticsChecks: [
      { key: 'ulasim', label: 'Ulaşım', description: 'Etkinlik lokasyonlarına ulaşım' },
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı etkinliklere gider' },
    ],
    skillsWithLevels: true,
  },

  // ------------------------- PRODÜKSİYON -------------------------
  fotografci: {
    archetype: 'produksiyon',
    quickInfo: ['uzmanlik', 'deneyim', 'teslim_suresi', 'ekipman_durumu'],
    modules: [
      { key: 'uzmanlik_alanlari', title: 'Çekim Alanları' },
      { key: 'ekipman' },
      { key: 'teknik_teslimat' },
      { key: 'calisma_parametreleri' },
    ],
    experienceGroups: [
      { key: 'dugun_nisan', label: 'Düğün & Nişan' },
      { key: 'kurumsal_etkinlik', label: 'Kurumsal Etkinlik' },
      { key: 'urun_moda', label: 'Ürün & Moda' },
    ],
    logisticsChecks: [
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı çekimlere gider' },
      { key: 'kendi_ekipmani', label: 'Kendi ekipmanı', description: 'Tam çekim ekipmanı ile gelir' },
    ],
    skillsWithLevels: false,
  },
  videograf: {
    archetype: 'produksiyon',
    quickInfo: ['uzmanlik', 'deneyim', 'teslim_suresi', 'drone'],
    modules: [
      { key: 'uzmanlik_alanlari', title: 'Çekim Alanları' },
      { key: 'ekipman' },
      { key: 'teknik_teslimat' },
      { key: 'calisma_parametreleri' },
    ],
    experienceGroups: [
      { key: 'dugun_nisan', label: 'Düğün & Nişan' },
      { key: 'kurumsal_tanitim', label: 'Kurumsal & Tanıtım' },
      { key: 'reklam_klip', label: 'Reklam & Klip' },
    ],
    logisticsChecks: [
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı çekimlere gider' },
      { key: 'drone', label: 'Drone', description: 'Drone çekimi yapabilir' },
      { key: 'kendi_ekipmani', label: 'Kendi ekipmanı', description: 'Tam video ekipmanı ile gelir' },
    ],
    skillsWithLevels: false,
  },
  'ses-isik': {
    archetype: 'produksiyon',
    quickInfo: ['hizmet_turu', 'deneyim', 'ekipman_kapasitesi', 'kurulum_suresi'],
    modules: [
      { key: 'ekipman' },
      { key: 'teknik_teslimat', title: 'Teknik Kapasite' },
      { key: 'calisma_parametreleri' },
    ],
    experienceGroups: [
      { key: 'konser_festival', label: 'Konser & Festival' },
      { key: 'kurumsal_etkinlik', label: 'Kurumsal Etkinlik' },
      { key: 'dugun_ozel', label: 'Düğün & Özel Davet' },
    ],
    logisticsChecks: [
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı kurulum yapar' },
      { key: 'kurulum_ekibi', label: 'Kurulum ekibi', description: 'Kurulum/söküm ekibiyle gelir' },
    ],
    skillsWithLevels: false,
  },

  // --------------------------- UZMANLIK ---------------------------
  tercuman: {
    archetype: 'uzmanlik',
    quickInfo: ['dil_cifti', 'ceviri_turleri', 'yeminli', 'deneyim'],
    modules: [
      { key: 'diller_belgeler' },
      { key: 'uzmanlik_alanlari', title: 'Çeviri Alanları' },
      { key: 'calisma_parametreleri' },
    ],
    experienceGroups: [
      { key: 'konferans', label: 'Konferans' },
      { key: 'kurumsal', label: 'Kurumsal' },
      { key: 'yayin', label: 'Yayın' },
    ],
    logisticsChecks: [
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı görevlere gider' },
      { key: 'cevrimici', label: 'Çevrimiçi', description: 'Uzaktan/çevrimiçi çeviri yapar' },
    ],
    skillsWithLevels: false,
  },
  organizasyon: {
    archetype: 'uzmanlik',
    quickInfo: ['hizmet_turu', 'deneyim', 'ekip_boyutu', 'etkinlik_turleri'],
    modules: [
      { key: 'uzmanlik_alanlari', title: 'Hizmet Alanları' },
      { key: 'calisma_parametreleri' },
    ],
    experienceGroups: [
      { key: 'dugun_nisan', label: 'Düğün & Nişan' },
      { key: 'kurumsal_etkinlik', label: 'Kurumsal Etkinlik' },
      { key: 'festival_konser', label: 'Festival & Konser' },
    ],
    logisticsChecks: [
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı organizasyon yürütür' },
      { key: 'tedarikci_agi', label: 'Tedarikçi ağı', description: 'Kendi tedarikçi ağıyla çalışır' },
    ],
    skillsWithLevels: false,
  },
  // Karikatürist HİBRİT: uzmanlik arketipi + portföy grid (cast) + performans (sahne)
  karikaturist: {
    archetype: 'uzmanlik',
    quickInfo: ['cizim_turu', 'deneyim', 'teslim_suresi', 'calisma_sekli'],
    modules: [
      { key: 'uzmanlik_alanlari', title: 'Çizim Alanları' },
      { key: 'performans', title: 'Etkinlik / Canlı Çizim Bilgileri' },
      { key: 'calisma_parametreleri' },
    ],
    experienceGroups: [
      { key: 'etkinlik_canli', label: 'Etkinlik & Canlı Çizim' },
      { key: 'kurumsal', label: 'Kurumsal' },
      { key: 'dijital_illustrasyon', label: 'Dijital & İllüstrasyon' },
    ],
    logisticsChecks: [
      { key: 'sehir_disi', label: 'Şehir dışı', description: 'Şehir dışı etkinliklere gider' },
      { key: 'canli_cizim', label: 'Canlı çizim', description: 'Etkinlikte canlı çizim yapar' },
    ],
    skillsWithLevels: false,
    portfolioGrid: true, // cast'ten portföy grid'i açık
  },
};

// =============================================================================
// Yardımcılar
// =============================================================================
export function getCategoryFields(
  slug: string | null | undefined
): CategoryFieldConfig | null {
  if (!slug) return null;
  return CATEGORY_FIELDS[slug] ?? null;
}

export function getModuleDefinition(key: ModuleKey): ModuleDefinition {
  return MODULE_REGISTRY[key];
}

/** Bir modülün kategoriye göre efektif başlığı (override varsa onu döndürür). */
export function getModuleTitle(ref: ModuleRef): string {
  return ref.title ?? MODULE_REGISTRY[ref.key].defaultTitle;
}
