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
//                                                       // yalnız 'uzmanlik' arketipinde medya hero yerine brand-ink özet bandı
//                                                       // (başlık + kısa metin + stat çipleri)
//   "logistics": { "ehliyet": true, "kendi_ekipmani": true }, // logisticsChecks key -> boolean
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
  period_label: string | null; // ESKİ serbest metin (okuma-yalnız miras)
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  is_current: boolean;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** TR ay kısaltmaları (deneyim tarih etiketleri). */
const EXP_MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function fmtYm(year: number | null, month: number | null): string {
  if (!year) return '';
  const m = month && month >= 1 && month <= 12 ? `${EXP_MONTHS_TR[month - 1]} ` : '';
  return `${m}${year}`;
}

/**
 * Deneyim dönem etiketini türetir. Tarih kolonları doluysa TR etiket:
 * ay varsa "Mar 2024", yoksa "2024"; is_current → "– Halen"; award tek tarih.
 * Kolonlar boşsa eski period_label AYNEN döner (okuma-yalnız miras).
 */
export function formatExperiencePeriod(exp: {
  kind: string;
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  is_current: boolean;
  period_label: string | null;
}): string {
  const hasDates =
    exp.start_year != null || exp.end_year != null || exp.is_current === true;
  if (!hasDates) return exp.period_label ?? '';
  const start = fmtYm(exp.start_year, exp.start_month);
  if (exp.kind === 'award') return start || exp.period_label || '';
  const end = exp.is_current ? 'Halen' : fmtYm(exp.end_year, exp.end_month);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return `– ${end}`;
  return exp.period_label ?? '';
}

// ---- category_attributes içindeki ortak yapı ----
export interface LeveledSkill {
  name: string;
  level: 1 | 2 | 3;
}

export const SERVICE_REGION_OPTIONS = [
  'Yalnızca kendi şehri',
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
// 'Grup (4+)' → 'Grup 4+': parantez PostgREST or=(...) dilbilgisinde grup
// karakteri; containment filtresine bağlı değerlerde kullanılamaz (dansci).
// Eski kayıtlar 20260727150000 migration'ı ile taşınır.
export const EKIP_BOYUTU_OPTIONS = ['Solo', 'Duo', 'Trio', 'Grup 4+'] as const;
export const EKIPMAN_DURUMU_OPTIONS = ['Kendi ekipmanı', 'Kısmi', 'Mekandan bekler'] as const;
export const YAS_GRUBU_OPTIONS = ['Çocuk', 'Yetişkin', 'Her yaş'] as const;
export const EKIPMAN_KAPASITESI_OPTIONS = ['200 kişi altı', '200–500', '500–1000', '1000+'] as const;
export const KURULUM_SURESI_OPTIONS = ['1 saat altı', '1–2 saat', '2–4 saat', '4+ saat'] as const;

// Çoklu-çip setleri (ceviri_turleri kalıbı — değerler " · " ile birleşir).
// Kategori artık "Çevirmenler VE Etkinlik Rehberleri" (kaynak doküman §14):
// son üç değer rehberlik hizmetleri. Etiket labelOverrides ile "Hizmet türleri".
export const CEVIRI_OPTIONS = [
  'Simultane',
  'Ardıl',
  'Yazılı',
  'Fısıltı',
  'Fuar çevirmenliği',
  'Etkinlik rehberliği',
  'VIP refakat',
] as const;

// ---- DALGA 1 — 4 yeni kategorinin kontrollü sözlükleri ----
// Hepsi filtreye bağlı → allowCustom KAPALI, değerler PostgREST-güvenli
// (virgül/parantez/tırnak/ters bölü YOK; boşluk, +, –, /, & güvenli).

/** akrobat — gösteri disiplinleri (kaynak doküman §18 alt hizmetleri). */
export const GOSTERI_TURLERI_OPTIONS = [
  'Akrobasi',
  'Jonglörlük',
  'Ateş gösterisi',
  'LED/Işık show',
  'Bubble show',
  'Pandomim',
  'Stilt walker',
  'Canlı heykel',
  'Sirk performansı',
] as const;

/** sac-makyaj-styling — hizmet türleri (kaynak doküman §15 alt hizmetleri). */
export const SAC_MAKYAJ_HIZMET_OPTIONS = [
  'Gelin saçı',
  'Gelin makyajı',
  'Kına/nişan makyajı',
  'Sahne makyajı',
  'Çekim makyajı',
  'Model/oyuncu makyajı',
  'Moda styling',
  'Özel efekt makyajı',
] as const;

/** etkinlik-koordinatoru — saha rolleri (kaynak doküman §22 alt hizmetleri). */
export const KOORDINATOR_GOREV_OPTIONS = [
  'Saha koordinasyonu',
  'Backstage',
  'Konuk akışı',
  'Protokol',
  'Zaman akışı',
  'Ekip/gönüllü koordinasyonu',
  'Prodüksiyon asistanlığı',
] as const;

/** konusmaci — konuşma formatları (kaynak doküman §16 alt hizmetleri). */
export const KONUSMA_TURLERI_OPTIONS = [
  'Keynote',
  'Motivasyon',
  'Sektörel',
  'Girişimcilik',
  'Teknoloji',
  'Panelist',
  'Kurumsal eğitim',
  'Workshop',
  'Yaratıcı atölye',
] as const;

// ---- DALGA 2 / TUR 1 — canli-yayin · influencer · drone-pilotu ----
// Hepsi filtreye bağlı → allowCustom KAPALI, değerler PostgREST-güvenli
// (virgül/parantez/tırnak/ters bölü YOK).

/** canli-yayin — yayın platformları (kaynak doküman §21). */
export const YAYIN_PLATFORM_OPTIONS = [
  'Zoom',
  'YouTube Live',
  'Instagram Live',
  'Microsoft Teams',
  'Webex',
  'Twitch',
  'Özel RTMP',
] as const;

/** influencer — içerik türleri (kaynak doküman §19 alt hizmetleri). */
export const ICERIK_TURLERI_OPTIONS = [
  'Instagram post/reels',
  'YouTube video',
  'TikTok video',
  'Story serisi',
  'Canlı yayın',
  'Ürün tanıtımı',
  'Etkinlik içeriği',
  'Marka elçiliği',
] as const;

/** drone-pilotu — drone tipleri (kaynak doküman §20). */
export const DRONE_TIPI_OPTIONS = [
  'Standart drone',
  'FPV drone',
  'Sinema drone',
  'Mini drone',
] as const;

/** drone-pilotu — çekim lokasyon tipleri. */
export const LOKASYON_TIPI_OPTIONS = [
  'Açık alan',
  'Kentsel',
  'Kıyı ve su',
  'Dağ ve orman',
] as const;

/** Tekli select setleri — Dalga 2. */
export const KAMERA_SAYISI_OPTIONS = ['1 kamera', '2–3 kamera', '4+ kamera'] as const;
export const ETKINLIK_FORMATI_OPTIONS = ['Fiziksel', 'Çevrimiçi', 'Hibrit'] as const;
export const ICERIK_TESLIM_FORMATI_OPTIONS = [
  'Ham çekim',
  'Kurgulu video',
  'Foto seti',
  'Karma',
] as const;
export const DRONE_TESLIM_BICIMI_OPTIONS = [
  'Video',
  'Fotoğraf',
  'Video + Fotoğraf',
] as const;

/** Tekli select setleri — Dalga 1. */
export const PROVA_OPTIONS = ['Dahil', 'Ücretli', 'Yok'] as const;
export const KISI_KAPASITESI_OPTIONS = [
  '1 kişi',
  '2–4 kişi',
  '5–10 kişi',
  '10+ kişi',
] as const;
export const CALISMA_SURESI_OPTIONS = [
  'Yarım gün',
  'Tam gün',
  'Çok günlü',
  'Esnek',
] as const;
export const KONUSMA_SURESI_OPTIONS = [
  '30 dk altı',
  '30–60 dk',
  'Yarım gün',
  'Tam gün',
] as const;
export const HEDEF_KITLE_OPTIONS = ['Kurumsal', 'Öğrenci & genç', 'Karma'] as const;

// Dans türleri — dansci quick_array (kaynak doküman §12 alt hizmetleri).
export const DANS_TURLERI_OPTIONS = [
  'Modern/Show',
  'Latin',
  'Hip-hop/Sokak',
  'Halk oyunları',
  'Oryantal',
  'Zeybek',
  'Kına',
  'Flash mob',
  'Koreografi',
] as const;

/**
 * DİLLER — kapalı sözlük (diller_belgeler.language_pairs).
 *
 * VERİ ŞEKLİ: düz dil listesi (string[]), dil ÇİFTİ DEĞİL. Çift modellemesi
 * kombinatoryal patlama üretir (18 dil → 306 yön) ve filtrenin sorduğu soru
 * "hangi dilleri biliyor"dur, "hangi yönde çeviriyor" değil.
 *
 * allowCustom KAPALI: bu alan keşfet filtresine bağlı; serbest giriş filtre
 * seçenekleriyle veriyi ayrıştırır ("türkçe" yazan profil "Türkçe" filtresinde
 * görünmez). Eksik dil talebi gelirse sözlüğe eklenir.
 */
export const LANGUAGE_OPTIONS = [
  'Türkçe',
  'İngilizce',
  'Almanca',
  'Fransızca',
  'Arapça',
  'Rusça',
  'İspanyolca',
  'İtalyanca',
  'Rumca',
  'Farsça',
  'Çince',
  'Japonca',
  'Korece',
  'Ukraynaca',
  'Bulgarca',
  'Gürcüce',
  'Kürtçe',
  'Azerbaycan Türkçesi',
] as const;
export const ENSTRUMAN_OPTIONS = ['Gitar', 'Piyano', 'Keman', 'Vokal', 'Bateri', 'Bas', 'Saksafon', 'Perküsyon'] as const;
// NOT: etkinlik türleri artık ORTAK bir alan (category_attributes.etkinlik_turleri) ve
// değer kümesi ilanlar taksonomisinden (app/mesajlar/data → EVENT_TYPES) TEK KAYNAK gelir.
// Eski quick-kopya listesi (ETKINLIK_TURLERI_OPTIONS) kaldırıldı (iki kopya yasak).

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
  // Kapsam genişledi: "Stand-up Komedyenleri VE Sahne Anlatıcıları" (kaynak doküman §17).
  'stand-up-komedyen': {
    gosteri_turu: [
      'Kısa set',
      'Tam gösteri',
      'Doğaçlama',
      'Hikâye anlatımı',
      'Roast/özel konsept',
    ],
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
  // ---- Dalga 1 ----
  akrobat: { gosteri_suresi: GOSTERI_SURESI_OPTIONS, yas_grubu: YAS_GRUBU_OPTIONS },
  'sac-makyaj-styling': {
    prova: PROVA_OPTIONS,
    kisi_kapasitesi: KISI_KAPASITESI_OPTIONS,
  },
  'etkinlik-koordinatoru': { calisma_suresi: CALISMA_SURESI_OPTIONS },
  konusmaci: {
    konusma_suresi: KONUSMA_SURESI_OPTIONS,
    hedef_kitle: HEDEF_KITLE_OPTIONS,
  },
  // ---- Dalga 2 ----
  'canli-yayin': {
    kamera_sayisi: KAMERA_SAYISI_OPTIONS,
    etkinlik_formati: ETKINLIK_FORMATI_OPTIONS,
  },
  influencer: {
    hedef_kitle: HEDEF_KITLE_OPTIONS,
    teslim_formati: ICERIK_TESLIM_FORMATI_OPTIONS,
  },
  'drone-pilotu': {
    teslim_suresi: ['1–3 gün', '1 hafta', '2 hafta', '1 ay+'],
    teslim_bicimi: DRONE_TESLIM_BICIMI_OPTIONS,
  },
  karikaturist: {
    cizim_turu: ['Portre karikatür', 'Canlı çizim', 'Dijital illüstrasyon', 'Karma'],
    // 'Anında (canlı)' → 'Anında': parantez PostgREST or=(...) dilbilgisinde grup
    // karakteri; containment filtresine bağlanan değerlerde kullanılamaz.
    // Eski kayıtlar 20260727130000 migration'ı ile taşınır.
    teslim_suresi: ['Anında', '1–3 gün', '1 hafta'],
  },
};

// Çoklu-çip quick anahtarları (slug bağımsız). allowCustom → serbest çip ekleme.
// SAKLAMA: string[] (etkinlik_turleri ile AYNI şekil) — jsonb containment (@>) ile
// filtrelenebilmesi için zorunlu. Eski " · " birleşik string kayıtları OKUMA sırasında
// toQuickList() ile diziye çevrilir (tek yön; çift yazma YOK).
export const QUICK_MULTI_OPTIONS: Record<
  string,
  { options: readonly string[]; allowCustom?: boolean }
> = {
  ceviri_turleri: { options: CEVIRI_OPTIONS },
  enstruman: { options: ENSTRUMAN_OPTIONS, allowCustom: true },
  // allowCustom KAPALI — hepsi keşfet filtresine bağlı (serbest giriş
  // filtre seçenekleriyle veriyi ayrıştırır).
  dans_turleri: { options: DANS_TURLERI_OPTIONS },
  gosteri_turleri: { options: GOSTERI_TURLERI_OPTIONS },
  hizmet_turleri: { options: SAC_MAKYAJ_HIZMET_OPTIONS },
  gorev_turleri: { options: KOORDINATOR_GOREV_OPTIONS },
  konusma_turleri: { options: KONUSMA_TURLERI_OPTIONS },
  // ---- Dalga 2 ----
  yayin_platformlari: { options: YAYIN_PLATFORM_OPTIONS },
  icerik_turleri: { options: ICERIK_TURLERI_OPTIONS },
  drone_tipi: { options: DRONE_TIPI_OPTIONS },
  lokasyon_tipi: { options: LOKASYON_TIPI_OPTIONS },
};

/** Bir quick anahtarı çoklu-çip mi? (saklama dizi, gösterim " · " ile birleşik) */
export function isMultiQuickKey(key: string): boolean {
  return key in QUICK_MULTI_OPTIONS;
}

/**
 * Çoklu-çip quick değerini DİZİYE normalize eder — TEK okuma yardımcısı.
 * Yeni kayıtlar zaten string[]; eski kayıtlar " · " (veya "·") ile birleşik tek string.
 * Backfill migration'ı eski kayıtları çevirir; bu fallback göç öncesi/kaçak satırlar için.
 */
export function toQuickList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split('·')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Quick değerinin GÖSTERİM metni. Çoklu-çip → " · " ile birleşir (görsel sözleşme
 * değişmedi); tekli select/serbest metin → kendisi. Boş → ''.
 */
export function formatQuickValue(value: unknown): string {
  if (Array.isArray(value)) return toQuickList(value).join(' · ');
  return typeof value === 'string' ? value.trim() : '';
}

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
  // ---- Dalga 1 ----
  gosteri_turleri: 'Gösteri türleri', hizmet_turleri: 'Hizmet türleri',
  gorev_turleri: 'Görev türleri', konusma_turleri: 'Konuşma türleri',
  prova: 'Prova', kisi_kapasitesi: 'Kişi kapasitesi',
  calisma_suresi: 'Çalışma süresi', konusma_suresi: 'Konuşma süresi',
  hedef_kitle: 'Hedef kitle',
  // ---- Dalga 2 ----
  yayin_platformlari: 'Yayın platformları', kamera_sayisi: 'Kamera sayısı',
  etkinlik_formati: 'Etkinlik formatı', icerik_turleri: 'İçerik türleri',
  teslim_formati: 'Teslim formatı', drone_tipi: 'Drone tipi',
  lokasyon_tipi: 'Lokasyon tipi', teslim_bicimi: 'Teslim biçimi',
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
      // Düz dil listesi (string[]) — LANGUAGE_OPTIONS kapalı sözlüğünden çoklu çip.
      // Eski serbest metin / "TR ↔ EN" çift kayıtları 20260727140000 ile taşındı.
      { key: 'language_pairs', type: 'language_pairs', label: 'Diller' },
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
      { key: 'kendi_ekipmani', label: 'Kendi ekipmanı', description: 'Kendi enstrüman/ekipmanı ile' },
    ],
    skillsWithLevels: false,
  },
  dansci: {
    archetype: 'sahne',
    // dans_turleri: kontrollü çoklu çip (filtrelenebilir). Serbest dans türü
    // metni uzmanlik_alanlari'nda DEĞİL — orası artık deneyim/bağlam beyanı.
    quickInfo: ['dans_turleri', 'ekip_boyutu', 'gosteri_suresi'],
    modules: [
      { key: 'performans', title: 'Gösteri Bilgileri' },
      { key: 'uzmanlik_alanlari', title: 'Deneyim Alanları' },
      { key: 'sosyal_erisim' },
    ],
    experienceGroups: [
      { key: 'sahne_gosteri', label: 'Sahne Gösterisi' },
      { key: 'festival_etkinlik', label: 'Festival & Etkinlik' },
      { key: 'kurumsal_ozel', label: 'Kurumsal & Özel Davet' },
    ],
    logisticsChecks: [
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
      {
        key: 'kurumsal_dil',
        label: 'Kurumsal dile uygun',
        description: 'Kurum içi etkinliğe uygun, temiz içerik sunar',
      },
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
    ],
    skillsWithLevels: false,
  },
  sunucu: {
    archetype: 'sahne',
    quickInfo: ['sunuculuk_turu'],
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
    ],
    skillsWithLevels: false,
  },

  // Dalga 1 — Akrobatlar, Jonglörler ve Performans Sanatçıları (§18).
  // Kalıp: illuzyonist + palyaco kardeşi. gosteri_turleri KONTROLLÜ çoklu çip
  // (filtrelenir); uzmanlik_alanlari ise deneyim/bağlam beyanı (filtrelenmez).
  akrobat: {
    archetype: 'sahne',
    quickInfo: ['gosteri_turleri', 'gosteri_suresi', 'yas_grubu'],
    modules: [
      { key: 'performans', title: 'Gösteri Bilgileri' },
      { key: 'ekipman' },
      { key: 'uzmanlik_alanlari', title: 'Deneyim Alanları' },
    ],
    experienceGroups: [
      { key: 'festival_etkinlik', label: 'Festival & Etkinlik' },
      { key: 'kurumsal_lansman', label: 'Kurumsal & Lansman' },
      { key: 'cocuk_aile', label: 'Çocuk & Aile Etkinliği' },
    ],
    logisticsChecks: [
      { key: 'dis_mekan', label: 'Açık hava', description: 'Açık havada performans verebilir' },
      { key: 'kostum', label: 'Kostüm', description: 'Kendi kostümüyle gelir' },
      { key: 'kendi_ekipmani', label: 'Kendi ekipmanı', description: 'Sahne malzemesini kendi getirir' },
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
    ],
    skillsWithLevels: true,
  },
  hostes: {
    archetype: 'cast',
    quickInfo: [],
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
      { key: 'kurulum_ekibi', label: 'Kurulum ekibi', description: 'Kurulum/söküm ekibiyle gelir' },
    ],
    skillsWithLevels: false,
  },

  // Dalga 1 — Saç, Makyaj ve Styling Profesyonelleri (§15).
  // Kalıp: fotografci kardeşi (portföy ağırlıklı produksiyon).
  'sac-makyaj-styling': {
    archetype: 'produksiyon',
    quickInfo: ['hizmet_turleri', 'prova', 'kisi_kapasitesi'],
    modules: [
      { key: 'ekipman', title: 'Ürün & Kit' },
      { key: 'uzmanlik_alanlari', title: 'Deneyim Alanları' },
      { key: 'calisma_parametreleri' },
    ],
    experienceGroups: [
      { key: 'dugun_nisan', label: 'Düğün & Nişan' },
      { key: 'cekim_set', label: 'Çekim & Set' },
      { key: 'sahne_gosteri', label: 'Sahne & Gösteri' },
    ],
    logisticsChecks: [
      { key: 'mekanda_hizmet', label: 'Mekânda hizmet', description: 'Gelin evi, otel veya sette hizmet verir' },
      { key: 'kendi_urunleri', label: 'Kendi ürünleri', description: 'Kendi ürün ve kitiyle gelir' },
      { key: 'ekiple_gelir', label: 'Ekiple gelir', description: 'Kalabalık hazırlıkta ekiple çalışır' },
    ],
    skillsWithLevels: false,
  },

  // Dalga 2 — Canlı Yayın, Reji ve Yayın Operasyon Profesyonelleri (§21).
  // Kalıp: ses-isik kardeşi. (C) kovası — "reji deneyimi", "teknik ekip ile
  // çalışma deneyimi", "kurumsal referans" doğrulanamaz beyan → uzmanlik_alanlari
  // çipi, FİLTREYE BAĞLANMAZ.
  'canli-yayin': {
    archetype: 'produksiyon',
    quickInfo: ['yayin_platformlari', 'kamera_sayisi', 'etkinlik_formati'],
    modules: [
      { key: 'ekipman' },
      { key: 'teknik_teslimat', title: 'Teknik Kapasite' },
      { key: 'uzmanlik_alanlari', title: 'Deneyim Alanları' },
      { key: 'calisma_parametreleri' },
    ],
    experienceGroups: [
      { key: 'webinar_online', label: 'Webinar & Online Yayın' },
      { key: 'hibrit_konferans', label: 'Hibrit Konferans & Panel' },
      { key: 'lansman_basin', label: 'Lansman & Basın Toplantısı' },
    ],
    logisticsChecks: [
      { key: 'kendi_ekipmani', label: 'Kendi ekipmanı', description: 'Kamera, encoder ve yayın setiyle gelir' },
      { key: 'teknik_ekip', label: 'Teknik ekip', description: 'Çok kameralı işlerde ekibiyle çalışır' },
      { key: 'yedek_baglanti', label: 'Yedek bağlantı', description: 'Yedek internet bağlantısı getirir' },
    ],
    skillsWithLevels: false,
  },

  // Dalga 2 — Drone Pilotları ve Hava Çekim Operatörleri (§20).
  // ⚠️ ucus_izni ÖZ-BEYANDIR: belge yükleme/doğrulama YOK, "Belge yüklendi"
  // ibaresi hiçbir yerde geçmez (kilitli karar 1.1).
  'drone-pilotu': {
    archetype: 'produksiyon',
    quickInfo: ['drone_tipi', 'lokasyon_tipi', 'teslim_bicimi', 'teslim_suresi'],
    modules: [
      { key: 'ekipman' },
      { key: 'teknik_teslimat' },
      { key: 'uzmanlik_alanlari', title: 'Deneyim Alanları' },
      { key: 'calisma_parametreleri' },
    ],
    experienceGroups: [
      { key: 'dugun_ozel', label: 'Düğün & Özel Davet' },
      { key: 'kurumsal_tanitim', label: 'Kurumsal & Tanıtım' },
      { key: 'festival_spor', label: 'Festival & Spor' },
    ],
    logisticsChecks: [
      { key: 'ucus_izni', label: 'Uçuş izni', description: 'Geçerli uçuş izni beyanı' },
      { key: 'kurgu_dahil', label: 'Kurgu dahil', description: 'Çekim sonrası kurgu ve renk yapar' },
      { key: 'kendi_ekipmani', label: 'Kendi ekipmanı', description: 'Drone ve yedek bataryayla gelir' },
    ],
    skillsWithLevels: false,
  },

  // --------------------------- UZMANLIK ---------------------------
  tercuman: {
    archetype: 'uzmanlik',
    quickInfo: ['ceviri_turleri', 'yeminli'],
    // Kapsam genişledi: "Çevirmenler ve Etkinlik Rehberleri" (kaynak doküman §14)
    // → ceviri_turleri etiketi "Hizmet türleri" (rehberlik değerlerini de kapsar).
    labelOverrides: { ceviri_turleri: 'Hizmet türleri' },
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
      { key: 'cevrimici', label: 'Çevrimiçi', description: 'Uzaktan/çevrimiçi çeviri yapar' },
    ],
    skillsWithLevels: false,
  },
  organizasyon: {
    archetype: 'uzmanlik',
    quickInfo: ['hizmet_turu', 'ekip_boyutu'],
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
    ],
    skillsWithLevels: false,
  },
  // Dalga 1 — Etkinlik Koordinatörleri ve Saha Sorumluları (§22).
  // Kalıp: organizasyon kardeşi. gorev_turleri = ROL (filtrelenir);
  // uzmanlik_alanlari = deneyim beyanı — (C) kovasındaki doğrulanamaz
  // iddialar (kurumsal deneyim, protokol, kriz yönetimi) FİLTREYE DEĞİL buraya.
  'etkinlik-koordinatoru': {
    archetype: 'uzmanlik',
    quickInfo: ['gorev_turleri', 'calisma_suresi'],
    modules: [
      { key: 'uzmanlik_alanlari', title: 'Deneyim Alanları' },
      { key: 'diller_belgeler', title: 'Diller' },
      { key: 'calisma_parametreleri' },
    ],
    experienceGroups: [
      { key: 'kurumsal_etkinlik', label: 'Kurumsal Etkinlik' },
      { key: 'festival_fuar', label: 'Festival & Fuar' },
      { key: 'dugun_ozel', label: 'Düğün & Özel Davet' },
    ],
    logisticsChecks: [
      { key: 'ekip_yonetimi', label: 'Ekip yönetimi', description: 'Saha ekibi ve gönüllü yönetir' },
      { key: 'sehir_disi_cok_gunlu', label: 'Çok günlü saha', description: 'Şehir dışı ve çok günlü işlere gider' },
    ],
    skillsWithLevels: false,
  },

  // Dalga 1 — Konuşmacılar ve Eğitmenler (§16).
  // Kalıp: tercuman + sunucu melezi. uzmanlik_alanlari burada KONU ALANI
  // ekseninde (Liderlik, Dijital dönüşüm…) — diğer üç Dalga 1 kategorisinde
  // "deneyim beyanı" ekseni kullanıldı; konuşmacıda konu alanı daha değerli.
  konusmaci: {
    archetype: 'uzmanlik',
    quickInfo: ['konusma_turleri', 'konusma_suresi', 'hedef_kitle'],
    modules: [
      { key: 'uzmanlik_alanlari', title: 'Uzmanlık Alanları' },
      { key: 'diller_belgeler', title: 'Diller' },
      { key: 'calisma_parametreleri' },
    ],
    experienceGroups: [
      { key: 'konferans_zirve', label: 'Konferans & Zirve' },
      { key: 'kurumsal_egitim', label: 'Kurumsal Eğitim' },
      { key: 'panel_oturum', label: 'Panel & Oturum' },
    ],
    logisticsChecks: [
      { key: 'cevrimici', label: 'Çevrimiçi', description: 'Uzaktan/çevrimiçi katılır' },
      { key: 'materyal', label: 'Materyal', description: 'Eğitim materyali ve katılım sertifikası sağlar' },
    ],
    skillsWithLevels: false,
  },

  // Dalga 2 — Influencer, YouTuber ve İçerik Üreticileri (§19).
  // HİBRİT: uzmanlik arketipi + portfolioGrid (karikaturist kalıbı) — içerik
  // üreticisinin vitrini görsel.
  // ⚠️ ETKİLEŞİM ORANI ALINMAZ (kilitli karar 1.2): doğrulanamaz. Takipçi ARALIĞI
  // sosyal_erisim modülünde yaşar; link alanı YOK (SIRA1).
  influencer: {
    archetype: 'uzmanlik',
    quickInfo: ['icerik_turleri', 'hedef_kitle', 'teslim_formati'],
    modules: [
      { key: 'sosyal_erisim' },
      { key: 'uzmanlik_alanlari', title: 'İçerik Alanları' },
      { key: 'calisma_parametreleri' },
    ],
    experienceGroups: [
      { key: 'marka_isbirligi', label: 'Marka İşbirliği' },
      { key: 'etkinlik_icerigi', label: 'Etkinlik İçeriği' },
      { key: 'urun_tanitimi', label: 'Ürün Tanıtımı' },
    ],
    logisticsChecks: [
      { key: 'fiziksel_katilim', label: 'Etkinliğe katılım', description: 'Etkinliğe fiziksel olarak katılır' },
      { key: 'canli_yayin', label: 'Canlı yayın', description: 'Etkinlikten canlı yayın yapar' },
    ],
    skillsWithLevels: false,
    portfolioGrid: true, // cast'ten portföy grid'i açık
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
    // Dans TÜRÜ artık quick_array (kontrollü). Burası deneyim/bağlam beyanı.
    areas: 'Kına gecesi, Kurumsal lansman, Klip/reklam, Festival sahnesi',
    what_to_expect: 'Koreografi + kostümlü sahne gösterisi',
  },
  'stand-up-komedyen': {
    what_to_expect: 'Etkileşimli, güncel, doğaçlamaya açık gösteri',
    language_pairs: 'Türkçe, İngilizce',
    // Kapsam genişledi: mizah + sahne anlatıcılığı (kaynak doküman §17).
    areas: 'Kurumsal etkinlik, Gala, Üniversite, Hikâye anlatımı',
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
    // Düz dil listesi (çift DEĞİL) — LANGUAGE_OPTIONS sözlüğünden seçilir.
    language_pairs: 'Türkçe, İngilizce, Almanca',
    // summary_stats: tanıtım bandındaki çip örnekleri (virgülle 3 tane).
    summary_stats: '300+ konferans, 12 yıl deneyim, 8 dil',
  },
  organizasyon: {
    areas: 'Düğün, Kurumsal etkinlik, Konser, Fuar',
    summary_stats: '250+ etkinlik, 15 yıl deneyim, 40 kişilik ekip',
  },
  karikaturist: {
    areas: 'Portre karikatür, Canlı çizim, Dijital illüstrasyon',
    what_to_expect: 'Etkinlikte canlı çizim; misafirlere hediyelik',
    summary_stats: '500+ portre, 9 yıl deneyim, 120+ etkinlik',
  },
  // ---- Dalga 1 ----
  akrobat: {
    // Gösteri TÜRÜ artık quick_array (kontrollü). Burası deneyim/bağlam beyanı.
    areas: 'Festival sahnesi, Kurumsal lansman, AVM aktivasyonu, Çocuk etkinliği',
    what_to_expect: 'Kısa odak performans + alanda dolaşan gösteri',
    items: 'Ateş ekipmanı, LED kostüm, stilt, jonglörlük seti',
    setup_logistics: 'Zemin düz olmalı; ateş gösterisinde 3 m güvenlik mesafesi',
  },
  'sac-makyaj-styling': {
    areas: 'Gelin, Set/çekim, Sahne, Editoryal, Hijyen standartlı',
    items: 'Airbrush seti, profesyonel fırça seti, saç şekillendirici, aydınlatmalı ayna',
    venue_requirements: 'Priz, iyi aydınlatma ve 1 masa yeterli',
    notes: 'Gelin hazırlığında prova ayrıca planlanır',
  },
  'etkinlik-koordinatoru': {
    // (C) kovası — filtreye ALINMAYAN doğrulanamaz beyanlar buraya çip olarak girer.
    areas: 'Kurumsal etkinlik, Protokol, Kriz yönetimi, Çok paydaşlı festival',
    language_pairs: 'Türkçe, İngilizce',
    notes: 'Etkinlik öncesi ön keşif ve akış provası önerilir',
    summary_stats: '180+ etkinlik, 10 yıl saha, 30 kişilik ekip',
  },
  konusmaci: {
    // Burada KONU ALANI ekseni (rol/format quick_array'de).
    areas: 'Liderlik, Dijital dönüşüm, Girişimcilik, Satış, Yapay zekâ',
    language_pairs: 'Türkçe, İngilizce',
    notes: 'Kuruma özel içerik için ön görüşme yapılır',
    summary_stats: '200+ konuşma, 14 yıl deneyim, 40 kurum',
  },
  // ---- Dalga 2 ----
  'canli-yayin': {
    // (C) kovası — filtreye ALINMAYAN doğrulanamaz beyanlar buraya çip olarak girer.
    areas: 'Reji deneyimi, Kurumsal referans, Teknik ekip yönetimi, Çok kameralı yayın',
    items: 'Blackmagic ATEM switcher, 3× kamera, encoder, telsiz mikrofon seti',
    venue_requirements: 'Kablolu internet (min 20 Mbps upload) ve 2 topraklı priz',
    delivery: 'Yayın kaydı, çok kameralı ham dosya, kısa özet kurgu',
    notes: 'Etkinlik öncesi teknik prova ve bağlantı testi önerilir',
  },
  influencer: {
    // İçerik ALANI ekseni (format quick_array'de). ETKİLEŞİM ORANI GEÇMEZ.
    areas: 'Yaşam tarzı, Gastronomi, Seyahat, Teknoloji, Moda',
    notes: 'Kullanım hakkı süresi ve mecra teklif içinde netleşir',
    summary_stats: '120+ marka işbirliği, 6 yıl içerik, 3 platform',
  },
  'drone-pilotu': {
    areas: 'Düğün, Kurumsal tesis, Festival, Spor/aksiyon, FPV dinamik çekim',
    items: 'DJI Mavic 3 Cine, FPV seti, ND filtre, 6 yedek batarya',
    venue_requirements: 'Uçuşa kapalı bölge kontrolü ve kalkış için düz zemin',
    delivery: 'Ham 4K dosya, renk düzenlemeli kurgu, dikey sosyal medya versiyonu',
    notes: 'Hava koşulu nedeniyle yedek tarih planlanması önerilir',
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
  // ---- Dalga 1 ----
  akrobat: {
    details: ['Alan ihtiyacı', 'Tavan yüksekliği', 'Güvenlik mesafesi', 'Set sayısı'],
  },
  'sac-makyaj-styling': {
    params: ['Hazırlık süresi', 'Kişi başı süre', 'Touch-up', 'Ekip'],
  },
  'etkinlik-koordinatoru': {
    params: ['Saha başlangıç saati', 'Ekip büyüklüğü', 'Telsiz/iletişim', 'Ön keşif'],
  },
  konusmaci: {
    params: ['Hazırlık görüşmesi', 'Materyal', 'Katılım sertifikası', 'Seyahat & konaklama'],
  },
  // ---- Dalga 2 ----
  'canli-yayin': {
    params: ['Ekip', 'Teknik prova', 'Yayın süresi', 'Yedek bağlantı'],
    delivery: ['Yayın kaydı', 'Ham dosya', 'Özet kurgu', 'Platform sayısı'],
  },
  influencer: {
    params: ['İçerik sayısı', 'Yayın takvimi', 'Revizyon', 'Kullanım hakkı süresi'],
  },
  'drone-pilotu': {
    params: ['Uçuş süresi', 'Yedek batarya', 'Ekip', 'Yedek tarih'],
    delivery: ['Çözünürlük', 'Kurgu süresi', 'Format', 'Ham dosya'],
  },
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
