// app/lib/category-content.ts
//
// Kategori bazlı EDİTÖRYEL İÇERİK (hero sloganı, açıklama, alt hizmetler, SEO, landing).
// Kalıp: filter-config.ts / brief-config.ts ile AYNI — slug anahtarlı, kod içi config.
// Neden DB değil: bu içerik sabit/nadir değişir; kod içi tutulunca migration drift
// yaratmaz ve deploy ile güncellenir.
//
// Kaynak: Fahri'nin "Kategori Profil Sayfaları" dokümanı (11 kategori, 16 bölüm).
//
// >>> ŞABLON FAZI <<<
// Şu an YALNIZCA "fotografci" tam doludur. Diğer kategoriler getCategoryContent()
// ile null döner → kategori sayfası mevcut GENERIC davranışına düşer (boşluk/çökme yok).
// İçerik dokümanda hazır; bu kalıp onaylandıkça diğer 10 kategori doldurulacak.

/** §4 — Alt hizmet kalemi */
export interface SubService {
  name: string;
  description: string;
}

/** Kategori başına editöryel içerik */
export interface CategoryContent {
  /** §2 Hero sloganı — kategoriye ÖZEL büyük başlık */
  heroHeadline: string;
  /** §3 Kategori açıklaması — editöryel üst metin */
  description: string;
  /** §4 Alt hizmetler — kategori sayfasında liste/grid */
  subServices: SubService[];
  /** §14 SEO başlığı (generateMetadata) */
  seoTitle: string;
  /** §14 SEO açıklaması (generateMetadata) */
  seoDescription: string;
  /** §15 Kısa landing metni (opsiyonel; yoksa description kullanılabilir) */
  landingText?: string;
}

/**
 * §5 — KULLANIM SENARYOLARI.
 * Dokümanda TÜM kategorilerde BİREBİR AYNI olduğu için kategori başına değil,
 * PAYLAŞILAN sabit. Kategori sayfası bunu tek bir "Kimler kullanır?" bölümünde gösterir.
 */
export const USE_CASES: { role: string; text: string }[] = [
  {
    role: "Bireysel kullanıcılar",
    text: "Etkinlik, çekim veya özel gün ihtiyaçları için doğrudan arama yapabilir, profilleri karşılaştırabilir ve teklif alabilir.",
  },
  {
    role: "Kurumsal kullanıcılar",
    text: "Lansman, fuar, kurumsal etkinlik, kampanya, prodüksiyon veya marka aktivasyonu gibi işlerde profesyonel hizmet sağlayıcıları değerlendirebilir.",
  },
  {
    role: "Ajanslar",
    text: "Proje veya etkinlik bazlı ihtiyaçlar için ilan açabilir, başvuru toplayabilir, uygun profilleri davet edebilir ve paket hizmet kurgulayabilir.",
  },
];

/** Tüm kategori sayfalarında ortak kapanış sloganı (doküman §15). */
export const CATEGORY_TAGLINE = "Doğru yetenekler, unutulmaz etkinlikler.";

/**
 * KATEGORİ İÇERİK HARİTASI.
 * Anahtar = kategori slug (filter-config.ts ile AYNI slug seti):
 *   dj, fotografci, muzisyen, sunucu, hostes, videograf,
 *   oyuncu, model, illuzyonist, palyaco, organizasyon, ses-isik
 *
 * ŞABLON: yalnızca fotografci dolu. Diğerleri sonra doldurulacak (içerik dokümanda hazır).
 */
export const CATEGORY_CONTENT: Record<string, CategoryContent> = {
  fotografci: {
    heroHeadline:
      "Etkinliğin En Özel Anlarını Profesyonel Fotoğrafçılarla Ölümsüzleştir",
    description:
      "Fotoğrafçılar kategorisi; bireysel ve kurumsal kullanıcıların düğün, nişan, kına, doğum günü, kurumsal etkinlik, açılış, lansman, fuar, ürün çekimi, katalog çekimi, sosyal medya içerik çekimi ve özel gün fotoğrafçılığı gibi ihtiyaçları için profesyonel fotoğrafçılara ulaşmasını sağlar. Kullanıcılar portföy, şehir, fiyat aralığı, puan, yorum, müsaitlik ve uzmanlık alanlarına göre fotoğrafçıları karşılaştırabilir.",
    subServices: [
      { name: "Düğün Fotoğrafçısı", description: "Düğün günü, dış çekim, hikaye çekimi ve çift çekimleri" },
      { name: "Nişan / Kına Fotoğrafçısı", description: "Nişan, söz, kına gecesi ve aile etkinlikleri" },
      { name: "Doğum Günü Fotoğrafçısı", description: "Çocuk ve yetişkin doğum günü organizasyonları" },
      { name: "Kurumsal Etkinlik Fotoğrafçısı", description: "Lansman, toplantı, gala, konferans ve şirket içi etkinlikler" },
      { name: "Fuar ve Stand Fotoğrafçısı", description: "Fuar katılımı, stand etkinliği ve marka aktivasyonları" },
      { name: "Ürün Fotoğrafçısı", description: "E-ticaret, katalog, marka ve ürün tanıtım çekimleri" },
      { name: "Katalog / Moda Fotoğrafçısı", description: "Model, giyim, aksesuar ve kampanya çekimleri" },
      { name: "Sosyal Medya İçerik Fotoğrafçısı", description: "Instagram, TikTok, LinkedIn ve marka içerik çekimleri" },
      { name: "Drone Fotoğrafçısı", description: "Havadan çekim, açık hava etkinlikleri ve mekan tanıtımı" },
      { name: "Etkinlik Anı Fotoğrafçısı", description: "Özel parti, mezuniyet, baby shower, yıl dönümü vb." },
    ],
    seoTitle: "Fotoğrafçılar Bul | Kashe",
    seoDescription:
      "Fotoğrafçılar kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Fotoğrafçılar kategorisi; bireysel ve kurumsal kullanıcıların düğün, nişan, kına, doğum günü, kurumsal etkinlik, ürün ve katalog çekimi gibi ihtiyaçları için profesyonel fotoğrafçılara ulaşmasını sağlar.",
  },

  // --- ŞABLON FAZINDA BOŞ (generic fallback'e düşerler) ---
  // İçerik dokümanda hazır; kalıp onaylanınca doldurulacak:
  // dj, muzisyen, sunucu, hostes, videograf, oyuncu, model,
  // illuzyonist, palyaco, organizasyon, ses-isik
};

/**
 * Kategori içeriğini güvenle getirir.
 * İçerik tanımlı DEĞİLSE null döner → kategori sayfası mevcut generic davranışına
 * düşmeli (boşluk göstermek yerine bugünkü gibi davranmalı).
 */
export function getCategoryContent(slug: string): CategoryContent | null {
  return CATEGORY_CONTENT[slug] ?? null;
}
