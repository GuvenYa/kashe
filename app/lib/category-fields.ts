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
//   "calisma_sekli": "Freelance + Ajansa bağlı",        // ORTAK alan (rail meta). Eski quick.calisma_sekli
//                                                       // OKUMA sırasında buraya fallback edilir (tek yön; çift yazma YOK).
//   "summary": { "title": "...", "body": "...", "stats": [{ "label": "...", "value": "..." }] },
//                                                       // yalnız 'uzmanlik' arketipinde medya hero yerine zümrüt özet bandı
//                                                       // (başlık + kısa metin + stat çipleri)
//   "logistics": { "ehliyet": true, "sehir_disi": true }, // logisticsChecks key -> boolean
//   "skills": [{ "name": "Vals", "level": 3 }],           // seviyeli yetenekler (1-3); cast kategorileri
//   "section_taglines": { "performans": "..." },          // modül key -> kategoriye özel tagline override (kullanıcı)
//   "quick": { "<quickInfoKey>": "<değer>" },             // Hakkımda altı hızlı bilgi değerleri
//                                                       // NOT: 'deneyim' quick anahtarı YOK (rail experience_label tek kaynak);
//                                                       // 'boy' / 'oynayabildigi_yas_araligi' render'da fiziksel modülünden okunur (C1).
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
  | 'age_range' // yaş aralığı (iki sayı: min–max) — kesin yaş YOK
  | 'documents'; // belge satırı ("Belge yüklendi")

export interface ModuleFieldDef {
  key: string;
  type: ModuleFieldType;
  label: string;
  note?: string;
  /** Kategoriye özel örnek/placeholder metni (preset.examples ile de override edilebilir). */
  example?: string;
  /** 'physical' alanları için select seçenekleri (hair/eyes). */
  options?: readonly string[];
  /** options ile birlikte: seçenek dışı serbest giriş (datalist) izinli mi (hair). */
  allowCustom?: boolean;
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
  /** Quick/modül alan etiketi override (key -> etiket). Ör. model: oynayabildigi_yas_araligi -> "Görünüm yaş aralığı" */
  labelOverrides?: Record<string, string>;
  /** Serbest-metin/çip modül alanları için kategoriye özel örnek (fieldKey -> örnek metin). */
  examples?: Record<string, string>;
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

/** Çalışma şekli — ORTAK alan (rail meta). Eski quick.calisma_sekli kayıtları okuma sırasında buraya fallback edilir. */
export const CALISMA_SEKLI_OPTIONS = [
  'Freelance',
  'Ajansa bağlı',
  'Freelance + Ajansa bağlı',
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

// =============================================================================
// QUICK ALAN SEÇENEK SETLERİ (B — select/çip dönüşümleri; tek doğruluk kaynağı)
// Sayfada boş değer ÇİZİLMEZ (anayasa); formda tüm select'lerde "Belirtilmemiş".
// =============================================================================
export const SET_SURESI_OPTIONS = ['1–2 saat', '2–4 saat', '4–6 saat', '6+ saat'] as const;
export const GOSTERI_SURESI_OPTIONS = ['30 dk altı', '30–60 dk', '60–90 dk', '90+ dk'] as const;
export const EKIP_BOYUTU_OPTIONS = ['Solo', 'Duo', 'Trio', 'Grup (4+)'] as const;
export const EKIPMAN_DURUMU_OPTIONS = ['Kendi ekipmanı', 'Kısmi', 'Mekandan bekler'] as const;
export const YAS_GRUBU_OPTIONS = ['Çocuk', 'Yetişkin', 'Her yaş'] as const;
export const EKIPMAN_KAPASITESI_OPTIONS = ['200 kişi altı', '200–500', '500–1000', '1000+'] as const;
export const KURULUM_SURESI_OPTIONS = ['1 saat altı', '1–2 saat', '2–4 saat', '4+ saat'] as const;

// Çoklu-çip setleri (ceviri_turleri kalıbı — değerler " · " ile birleşir).
export const CEVIRI_OPTIONS = ['Simultane', 'Ardıl', 'Yazılı', 'Fısıltı'] as const;
export const ENSTRUMAN_OPTIONS = ['Gitar', 'Piyano', 'Keman', 'Vokal', 'Bateri', 'Bas', 'Saksafon', 'Perküsyon'] as const;
export const ETKINLIK_TURLERI_OPTIONS = ['Düğün', 'Kurumsal', 'Fuar/Lansman', 'Konser/Festival', 'Özel davet'] as const;

// Fiziksel modül select setleri (hair serbest eklemeye açık; eyes sabit).
export const HAIR_OPTIONS = ['Siyah', 'Kahverengi', 'Sarı', 'Kızıl', 'Gri/Beyaz'] as const;
export const EYES_OPTIONS = ['Kahverengi', 'Yeşil', 'Mavi', 'Ela'] as const;

// Sosyal erişim platform seçenekleri (link YOK; kapalı küme + "Diğer").
export const PLATFORM_OPTIONS = ['Instagram', 'TikTok', 'YouTube', 'X', 'Diğer'] as const;

// Kategori-bağımlı quick SELECT setleri (slug -> quickKey -> seçenekler).
export const QUICK_OPTIONS_BY_SLUG: Record<string, Record<string, readonly string[]>> = {
  dj: { set_suresi: SET_SURESI_OPTIONS, ekipman_durumu: EKIPMAN_DURUMU_OPTIONS },
  muzisyen: { ekip_boyutu: EKIP_BOYUTU_OPTIONS },
  dansci: { ekip_boyutu: EKIP_BOYUTU_OPTIONS, gosteri_suresi: GOSTERI_SURESI_OPTIONS },
  'stand-up-komedyen': {
    gosteri_turu: ['Kısa set', 'Tam gösteri', 'Doğaçlama'],
    gosteri_suresi: GOSTERI_SURESI_OPTIONS,
  },
  illuzyonist: {
    gosteri_turu: ['Sahne', 'Close-up', 'Mentalizm'],
    gosteri_suresi: GOSTERI_SURESI_OPTIONS,
    yas_grubu: YAS_GRUBU_OPTIONS,
  },
  palyaco: {
    gosteri_turu: ['Çocuk şovu', 'Balon/Yüz boyama', 'Maskot'],
    gosteri_suresi: GOSTERI_SURESI_OPTIONS,
    yas_grubu: YAS_GRUBU_OPTIONS,
  },
  sunucu: { sunuculuk_turu: ['Kurumsal', 'Düğün', 'Sahne/Festival', 'TV/Yayın'] },
  fotografci: {
    teslim_suresi: ['1–3 gün', '1 hafta', '2 hafta', '1 ay+'],
    ekipman_durumu: EKIPMAN_DURUMU_OPTIONS,
  },
  videograf: {
    teslim_suresi: ['1–3 gün', '1 hafta', '2 hafta', '1 ay+'],
    ekipman_durumu: EKIPMAN_DURUMU_OPTIONS,
  },
  'ses-isik': {
    hizmet_turu: ['Ses', 'Işık', 'Ses+Işık', 'Sahne/LED'],
    ekipman_kapasitesi: EKIPMAN_KAPASITESI_OPTIONS,
    kurulum_suresi: KURULUM_SURESI_OPTIONS,
  },
  organizasyon: {
    hizmet_turu: ['Düğün', 'Kurumsal', 'Festival', 'Full kapsam'],
    ekip_boyutu: ['1–5 kişi', '5–15 kişi', '15+ kişi'],
  },
  karikaturist: {
    cizim_turu: ['Portre karikatür', 'Canlı çizim', 'Dijital illüstrasyon', 'Karma'],
    teslim_suresi: ['Anında (canlı)', '1–3 gün', '1 hafta'],
  },
};

// Çoklu-çip quick anahtarları (slug bağımsız). allowCustom → serbest çip ekleme.
export const QUICK_MULTI_OPTIONS: Record<
  string,
  { options: readonly string[]; allowCustom?: boolean }
> = {
  ceviri_turleri: { options: CEVIRI_OPTIONS },
  enstruman: { options: ENSTRUMAN_OPTIONS, allowCustom: true },
  etkinlik_turleri: { options: ETKINLIK_TURLERI_OPTIONS },
};

export type QuickInput =
  | { kind: 'multi'; options: readonly string[]; allowCustom: boolean }
  | { kind: 'select'; options: readonly string[] }
  | { kind: 'text' };

/** Quick alanının giriş tipini çözer (form + gelecekte doğrulama ortak). */
export function getQuickInput(
  slug: string | null | undefined,
  key: string
): QuickInput {
  if (key === 'yeminli') return { kind: 'select', options: ['Evet', 'Hayır'] };
  const multi = QUICK_MULTI_OPTIONS[key];
  if (multi)
    return { kind: 'multi', options: multi.options, allowCustom: !!multi.allowCustom };
  const bySlug = slug ? QUICK_OPTIONS_BY_SLUG[slug]?.[key] : undefined;
  if (bySlug) return { kind: 'select', options: bySlug };
  return { kind: 'text' };
}

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
      // Yaş ARALIĞI (kesin yaş YOK). Etiket kategoriye göre override edilir (model → "Görünüm yaş aralığı").
      { key: 'oynayabildigi_yas_araligi', type: 'age_range', label: 'Oynayabildiği yaş aralığı' },
      { key: 'height', type: 'physical', label: 'Boy' },
      { key: 'size', type: 'physical', label: 'Beden' },
      { key: 'shoe', type: 'physical', label: 'Ayak' },
      { key: 'hair', type: 'physical', label: 'Saç', options: HAIR_OPTIONS, allowCustom: true },
      { key: 'eyes', type: 'physical', label: 'Göz', options: EYES_OPTIONS },
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
    quickInfo: ['set_suresi', 'ekipman_durumu'],
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
    quickInfo: ['enstruman', 'ekip_boyutu'],
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
    quickInfo: ['ekip_boyutu', 'gosteri_suresi'],
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
    quickInfo: ['gosteri_turu', 'gosteri_suresi'],
    modules: [
      { key: 'performans', title: 'Gösteri Bilgileri' },
      { key: 'diller_belgeler', title: 'Diller' },
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
    quickInfo: ['gosteri_turu', 'gosteri_suresi', 'yas_grubu'],
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
    quickInfo: ['gosteri_turu', 'gosteri_suresi', 'yas_grubu'],
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
    quickInfo: ['sunuculuk_turu', 'etkinlik_turleri'],
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
    quickInfo: [],
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
    // A2 — model yaş aralığı etiketi "Görünüm yaş aralığı" (oyuncu/hostes default "Oynayabildiği...").
    labelOverrides: { oynayabildigi_yas_araligi: 'Görünüm yaş aralığı' },
  },
  oyuncu: {
    archetype: 'cast',
    quickInfo: [],
    modules: [
      { key: 'fiziksel' },
      { key: 'diller_belgeler', title: 'Diller' },
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
    quickInfo: [],
    modules: [
      { key: 'fiziksel' },
      { key: 'diller_belgeler', title: 'Diller' },
      { key: 'uzmanlik_alanlari', title: 'Etkinlik Türleri' },
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
    quickInfo: ['teslim_suresi', 'ekipman_durumu'],
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
    quickInfo: ['teslim_suresi', 'ekipman_durumu'],
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
    quickInfo: ['hizmet_turu', 'ekipman_kapasitesi', 'kurulum_suresi'],
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
    quickInfo: ['ceviri_turleri', 'yeminli'],
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
    quickInfo: ['hizmet_turu', 'ekip_boyutu', 'etkinlik_turleri'],
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
    ],
    skillsWithLevels: false,
  },
  // Karikatürist HİBRİT: uzmanlik arketipi + portföy grid (cast) + performans (sahne)
  karikaturist: {
    archetype: 'uzmanlik',
    quickInfo: ['cizim_turu', 'teslim_suresi'],
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

// TEK-YER KURALI: quick hücreleri YALNIZ quick{} içindeki kendi anahtarlarını gösterir.
// Değeri kendi modül bölümünde girilip görünen anahtarlar quickInfo'da yer ALMAZ
// (boy/yaş → Fiziksel, dil_cifti → Diller & Belgeler). Modül-fallback mekanizması YOK.

/** Quick/alan etiketi — preset override varsa onu, yoksa QUICK_LABELS, yoksa key. */
export function getQuickLabel(
  preset: CategoryFieldConfig | null,
  key: string
): string {
  return preset?.labelOverrides?.[key] ?? QUICK_LABELS[key] ?? key;
}

// =============================================================================
// A4 — Kategoriye özel örnek/placeholder metinleri (slug -> fieldKey -> örnek).
// Serbest-metin/çip modül alanlarına kategoriye uygun örnek; DJ örneği YALNIZ DJ'de.
// =============================================================================
export const CATEGORY_EXAMPLES: Record<string, Record<string, string>> = {
  dj: {
    genres: 'House, Techno, Deep House, Melodic',
    notes: 'Açılıştan peak-time geçişi; mekana göre özelleştirilmiş set',
    items: 'Pioneer CDJ-3000 x2, DJM-900NXS2 mikser, monitör kulaklık',
    venue_requirements: '2 kanal DI + topraklı priz yeterli; kalan ekipman bende',
    what_to_expect: 'Kalabalığı okuyan, akışı bozmayan bir gece',
  },
  muzisyen: {
    genres: 'Pop, Jazz, Akustik, Türkçe',
    items: 'Akustik gitar, vokal mikrofonu, kombo amfi',
    what_to_expect: 'Canlı, esnek repertuar; isteklere açık',
  },
  dansci: {
    areas: 'Modern, Hip-hop, Latin, Show dans',
    what_to_expect: 'Koreografi + kostümlü sahne gösterisi',
  },
  'stand-up-komedyen': {
    what_to_expect: 'Etkileşimli, güncel, doğaçlamaya açık gösteri',
    language_pairs: 'Türkçe, İngilizce',
  },
  illuzyonist: {
    what_to_expect: 'Sahne illüzyonu + close-up + mentalizm',
    items: 'Kendi sahne düzeni ve malzemeleri',
  },
  palyaco: {
    what_to_expect: 'Balon, yüz boyama, interaktif çocuk oyunları',
  },
  sunucu: {
    what_to_expect: 'Akışı yöneten, sahne hakimiyeti yüksek sunum',
    language_pairs: 'Türkçe, İngilizce',
  },
  model: {
    areas: 'Defile, Katalog, Editoryal, Reklam',
  },
  oyuncu: {
    areas: 'Dövüş, at binme, dans, aksan',
    language_pairs: 'Türkçe, İngilizce',
  },
  hostes: {
    notes: 'Karşılama, yönlendirme, protokol; kurumsal görünüm',
    areas: 'Kurumsal, Fuar, Lansman, Özel davet',
    language_pairs: 'Türkçe, İngilizce',
  },
  fotografci: {
    areas: 'Düğün, Ürün, Portre, Moda',
    items: 'Full-frame gövde, 24-70mm, flaş seti',
  },
  videograf: {
    areas: 'Düğün, Reklam, Klip, Kurumsal tanıtım',
    items: 'Sinema kamera, gimbal, ışık seti',
  },
  'ses-isik': {
    items: 'Line-array ses, hareketli ışık, LED ekran',
  },
  tercuman: {
    areas: 'Hukuki, Tıbbi, Teknik, Ticari',
    language_pairs: 'TR ↔ EN, TR ↔ DE',
  },
  organizasyon: {
    areas: 'Düğün, Kurumsal etkinlik, Konser, Fuar',
  },
  karikaturist: {
    areas: 'Portre karikatür, Canlı çizim, Dijital illüstrasyon',
    what_to_expect: 'Etkinlikte canlı çizim; misafirlere hediyelik',
  },
};

/** Bir alanın kategoriye özel örneğini döndürür (yoksa modül-default example). */
export function getFieldExample(
  slug: string | null | undefined,
  field: ModuleFieldDef
): string | undefined {
  if (slug && CATEGORY_EXAMPLES[slug]?.[field.key]) {
    return CATEGORY_EXAMPLES[slug][field.key];
  }
  return field.example;
}

// =============================================================================
// C4 — calisma_parametreleri (params) için kategoriye önerilen ETİKET setleri.
// Formda tek tıkla satır ekler (etiket ön-dolu, değer boş). calisma_parametreleri
// modülü olan kategoriler: hostes, fotografci, videograf, ses-isik, tercuman,
// organizasyon, karikaturist.
// =============================================================================
// slug -> fieldKey -> önerilen etiketler. Alanlar: performans.details (sahne),
// calisma_parametreleri.params (cast/produksiyon/uzmanlik).
export const CATEGORY_PARAM_SUGGESTIONS: Record<
  string,
  Record<string, string[]>
> = {
  // ---- sahne: performans.details (quick'te/lojistikte evlenen etiketler ayıklandı) ----
  dj: { details: ['Ekip', 'Tarz', 'Kurulum süresi', 'Elektrik'] },
  muzisyen: { details: ['Set süresi', 'Ses ihtiyacı', 'Prova'] },
  dansci: { details: ['Sahne ihtiyacı', 'Kostüm'] },
  'stand-up-komedyen': { details: ['Sahne ihtiyacı', 'Mikrofon', 'İçerik/tema'] },
  illuzyonist: { details: ['Sahne düzeni', 'Malzeme', 'Asistan'] },
  palyaco: { details: ['Malzeme', 'Aktiviteler', 'Kostüm'] },
  sunucu: { details: ['Süre', 'Prompter', 'Akış'] },
  // ---- calisma_parametreleri.params + teknik_teslimat.delivery (ayrık: çalışma vs teslimat) ----
  hostes: { params: ['Vardiya süresi', 'Kıyafet', 'Ekip'] },
  fotografci: {
    params: ['Çekim süresi', 'Ekip', 'İkinci fotoğrafçı'],
    delivery: ['Fotoğraf sayısı', 'Albüm', 'Ham dosya'],
  },
  videograf: {
    params: ['Çekim süresi', 'Kurgu', 'Ekip'],
    delivery: ['Video süresi', 'Format', 'Revizyon'],
  },
  'ses-isik': {
    params: ['Ekip', 'Jeneratör', 'Teknik rider'],
    delivery: ['Sahne boyutu', 'Yedek ekipman', 'Hat/kanal sayısı'],
  },
  tercuman: { params: ['Kabin deneyimi', 'Minimum süre', 'Ekipman', 'Fısıltı çeviri'] },
  organizasyon: { params: ['Tedarikçi ağı', 'Minimum bütçe', 'Planlama süresi'] },
  karikaturist: { params: ['Çizim süresi', 'Kişi/saat', 'Format'] },
};

/** section_taglines placeholder'ları — arketip × tagline anahtarı (4×4). */
export const ARCHETYPE_TAGLINE_EXAMPLES: Record<
  Archetype,
  Record<string, string>
> = {
  sahne: {
    hakkimda: 'Sahneye çıktığı an salonun enerjisini yükselten bir isim.',
    hizmetler: 'Kulüpten kurumsala, her sahnenin kendi kurgusu.',
    deneyim: 'Yüzlerce gece, dolu sahneler.',
    egitim: 'Tekniğini sürekli tazeleyen bir icra.',
  },
  cast: {
    hakkimda: 'Kadraja girdiği anda hikâyeyi taşıyan bir yüz.',
    hizmetler: 'Defileden kampanyaya, her projede doğru duruş.',
    deneyim: 'Sezonlara yayılan çekimler ve podyumlar.',
    egitim: 'Kamera ve sahne önünde eğitimli bir hazırlık.',
  },
  produksiyon: {
    hakkimda: 'Anı en doğru ışıkla kadraja alan bir bakış.',
    hizmetler: 'Düğünden reklama, teslimde titiz bir prodüksiyon.',
    deneyim: 'Yüzlerce proje, zamanında teslim.',
    egitim: 'Ekipman ve tekniğe hâkim, sertifikalı bir altyapı.',
  },
  uzmanlik: {
    hakkimda: 'Kelimenin değil anlamın çevirisi.',
    hizmetler: 'Konferanstan kurumsala, doğru tonla aktarım.',
    deneyim: 'Yıllara dayanan saha ve kabin deneyimi.',
    egitim: 'Alanında sertifikalı, sürekli gelişen bir uzmanlık.',
  },
};
