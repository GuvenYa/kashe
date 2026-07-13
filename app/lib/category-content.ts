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

  dj: {
    heroHeadline: "Etkinliğinin Ritmini Profesyonel DJ'lerle Yükselt",
    description:
      "DJ'ler kategorisi; düğün, nişan, kına, doğum günü, mezuniyet, kurumsal etkinlik, açılış, lansman, fuar, gala, özel parti, beach party ve marka etkinlikleri için profesyonel DJ performansı sunabilecek kişilere ulaşmayı sağlar. Kullanıcılar müzik tarzı, şehir, fiyat, etkinlik türü, ekipman desteği, yorum, müsaitlik ve deneyim seviyesine göre karşılaştırma yapabilir.",
    subServices: [
      { name: "Düğün DJ'i", description: "Düğün, after party, kokteyl ve eğlence bölümleri" },
      { name: "Nişan / Kına DJ'i", description: "Aile organizasyonlarına özel müzik akışı" },
      { name: "Doğum Günü DJ'i", description: "Çocuk, genç ve yetişkin doğum günleri" },
      { name: "Kurumsal Etkinlik DJ'i", description: "Lansman, gala, şirket partisi ve marka etkinlikleri" },
      { name: "Fuar / Stand DJ'i", description: "Marka aktivasyonları ve fuar alanı performansları" },
      { name: "Parti DJ'i", description: "Özel parti, mezuniyet, yılbaşı ve konsept etkinlikler" },
      { name: "Elektronik Müzik DJ'i", description: "House, techno, deep house, EDM vb." },
      { name: "Pop / Türkçe Pop DJ'i", description: "Geniş kitlelere hitap eden popüler müzik" },
      { name: "90'lar / Retro DJ'i", description: "Konsept parti ve nostalji geceleri" },
      { name: "DJ + Ses/Işık Paketi", description: "DJ performansı ile ses, ışık ve teknik ekipman" },
    ],
    seoTitle: "DJ'ler Bul | Kashe",
    seoDescription:
      "DJ'ler kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "DJ'ler kategorisi; düğün, doğum günü, mezuniyet, kurumsal etkinlik, gala ve özel partiler için profesyonel DJ performansı sunan kişilere ulaşmayı sağlar.",
  },

  muzisyen: {
    heroHeadline: "Etkinliğine Canlı Müzik Dokunuşu Kat",
    description:
      "Müzisyenler kategorisi; solo müzisyenler, canlı müzik grupları, orkestralar, akustik ekipler, düğün/kına müzisyenleri, kurumsal etkinlik müzisyenleri, caz/lounge ekipleri ve geleneksel müzik gruplarını kapsar. Kullanıcılar müzik türü, şehir, fiyat aralığı, etkinlik türü, ekipman ihtiyacı, puan, yorum, müsaitlik ve deneyim seviyesine göre profilleri karşılaştırabilir.",
    subServices: [
      { name: "Solo Müzisyen", description: "Gitarist, piyanist, kemancı, saksofoncu, vokalist gibi tek kişilik performanslar" },
      { name: "Canlı Müzik Grubu", description: "Düğün, kurumsal etkinlik ve özel partiler için grup performansı" },
      { name: "Orkestra", description: "Geniş ekipli düğün, gala ve özel organizasyon performansı" },
      { name: "Akustik Performans", description: "Kokteyl, butik davet, restoran ve özel etkinlikler" },
      { name: "Düğün Orkestrası", description: "Düğün ve nişan için sahne, repertuvar ve eğlence akışı" },
      { name: "Kına / Nişan Müzisyenleri", description: "Geleneksel veya modern konseptlere uygun performans" },
      { name: "Kurumsal Etkinlik Müzisyenleri", description: "Lansman, gala, şirket yemeği ve marka etkinlikleri" },
      { name: "Caz / Lounge Müzik", description: "Gala, kokteyl, otel ve kurumsal davetler" },
      { name: "Türk Halk Müziği / Türk Sanat Müziği", description: "Geleneksel etkinlikler ve kültürel geceler" },
      { name: "Bando / Karşılama Ekibi", description: "Açılış, kortej, sokak etkinliği ve özel kutlamalar" },
      { name: "Müzisyen + Ses Sistemi Paketi", description: "Performansla birlikte temel ses sistemi ve teknik destek" },
    ],
    seoTitle: "Müzisyenler Bul | Kashe",
    seoDescription:
      "Müzisyenler kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Müzisyenler kategorisi; solo müzisyenler, canlı müzik grupları, orkestralar ve akustik ekipleri etkinliklerinle buluşturur.",
  },

  sunucu: {
    heroHeadline: "Etkinliğini Profesyonel Sunucularla Akıcı ve Etkili Hale Getir",
    description:
      "Sunucular / Moderatörler kategorisi; lansman, konferans, panel, gala, ödül töreni, açılış, fuar etkinliği, düğün, nişan, kına, özel parti, sahne etkinliği, marka aktivasyonu ve hibrit/çevrim içi etkinliklerde akışı yönetecek profesyonelleri kapsar. Sunum tarzı, dil yetkinliği, deneyim ve referanslar bu kategoride öne çıkar.",
    subServices: [
      { name: "Kurumsal Etkinlik Sunucusu", description: "Lansman, şirket toplantısı, bayi buluşması, gala ve marka etkinlikleri" },
      { name: "Konferans / Panel Moderatörü", description: "Panel, seminer, zirve, çalıştay ve resmi toplantılarda oturum yönetimi" },
      { name: "Gala / Ödül Töreni Sunucusu", description: "Prestijli davet, ödül töreni ve özel geceler" },
      { name: "Açılış / Lansman Sunucusu", description: "Mağaza açılışı, ürün lansmanı ve tanıtım etkinlikleri" },
      { name: "Fuar / Stand Etkinliği Sunucusu", description: "Marka aktivasyonu, sahne anonsları ve fuar içi etkinlik yönetimi" },
      { name: "Düğün / Nişan Sunucusu", description: "Program akışı, anons ve eğlence yönlendirmesi" },
      { name: "Eğlence Sunucusu", description: "Parti, doğum günü, sahne gösterisi ve interaktif etkinlik" },
      { name: "Çevrim İçi / Hibrit Etkinlik Moderatörü", description: "Webinar, online panel, canlı yayın ve hibrit toplantı" },
      { name: "Çok Dilli Sunucu", description: "Türkçe, İngilizce veya farklı dillerde sunum" },
      { name: "Protokol / Resmi Etkinlik Sunucusu", description: "Kamu, kurum, dernek ve üst düzey resmi programlar" },
    ],
    seoTitle: "Sunucular / Moderatörler Bul | Kashe",
    seoDescription:
      "Sunucular / Moderatörler kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Sunucular / Moderatörler kategorisi; lansman, konferans, gala, ödül töreni ve düğünlerde akışı yönetecek profesyonelleri etkinliklerinle buluşturur.",
  },

  hostes: {
    heroHeadline: "Etkinliğinde Profesyonel Karşılama ve Operasyon Desteği Sağla",
    description:
      "Host / Hostesler kategorisi; fuar, lansman, kongre, gala, mağaza açılışı, kurumsal etkinlik, bayi toplantısı, düğün, özel davet, marka aktivasyonu ve tanıtım etkinliklerinde karşılama, kayıt, stand, ürün tanıtımı, servis, rehberlik ve çeviri görevleri için personel teminini kapsar.",
    subServices: [
      { name: "Karşılama Host / Hostesi", description: "Etkinlik girişinde misafir karşılama ve yönlendirme" },
      { name: "Kayıt Masası Personeli", description: "Kongre, seminer, konferans ve kurumsal etkinliklerde kayıt alma" },
      { name: "Fuar / Stand Hostesi", description: "Fuar standında ziyaretçi karşılama ve ürün/hizmet tanıtımı" },
      { name: "Tanıtım Hostesi", description: "Marka aktivasyonu, saha tanıtımı ve ürün lansmanları" },
      { name: "VIP Karşılama Personeli", description: "Protokol, özel davet ve üst düzey konuk karşılama" },
      { name: "Servis Personeli", description: "Catering, ikram ve davet servisinde görev alma" },
      { name: "Yönlendirme Personeli", description: "Salon, oturum, alan ve akış yönlendirmesi" },
      { name: "Çevirmen / Rehber Hostes", description: "Yabancı konuklar için dil desteği ve rehberlik" },
      { name: "Sahne / Backstage Destek Personeli", description: "Konuşmacı, sanatçı veya etkinlik akışına operasyonel destek" },
      { name: "Marka Elçisi", description: "Etkinlik boyunca marka temsilini üstlenen tanıtım personeli" },
    ],
    seoTitle: "Host / Hostesler Bul | Kashe",
    seoDescription:
      "Host / Hostesler kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Host / Hostesler kategorisi; fuar, lansman, gala ve kurumsal etkinliklerde karşılama, kayıt ve tanıtım için profesyonel personel teminini sağlar.",
  },

  videograf: {
    heroHeadline: "Etkinliğini Profesyonel Video Çekimleriyle Kalıcı Hale Getir",
    description:
      "Videograflar kategorisi; düğün, nişan, kına, doğum günü, lansman, gala, fuar, kurumsal etkinlik, reklam, tanıtım filmi, sosyal medya içeriği, katalog ve ürün çekimleri için profesyonel video çekimi hizmeti sunar. Portföy, çekim tarzı, kurgu/montaj, ekipman, teslim süresi ve fiyat bu kategorinin temel karşılaştırma alanlarıdır.",
    subServices: [
      { name: "Düğün Videografı", description: "Düğün günü, dış çekim, hikaye klibi ve düğün filmi" },
      { name: "Nişan / Kına Videografı", description: "Nişan, söz, kına gecesi ve aile etkinlikleri" },
      { name: "Etkinlik Videografı", description: "Doğum günü, gala, açılış, özel parti ve sosyal etkinlik" },
      { name: "Kurumsal Etkinlik Videosu", description: "Lansman, toplantı, konferans, bayi buluşması ve gala" },
      { name: "Tanıtım Filmi Çekimi", description: "Firma, marka, ürün, hizmet veya kurum tanıtımı" },
      { name: "Sosyal Medya Video İçeriği", description: "Instagram Reels, TikTok, Shorts ve LinkedIn videoları" },
      { name: "Ürün / Katalog Videosu", description: "E-ticaret, katalog, moda, ürün ve kampanya çekimleri" },
      { name: "Drone Video Çekimi", description: "Açık hava etkinlikleri, mekan tanıtımı ve havadan çekim" },
      { name: "Reklam Filmi Çekimi", description: "Marka kampanyaları, dijital reklamlar ve kısa tanıtım videoları" },
      { name: "Kurgu / Montaj Hizmeti", description: "Video düzenleme, renk, ses, altyazı ve teslim formatları" },
      { name: "Canlı Yayın Video Desteği", description: "Etkinlik, panel, webinar ve hibrit organizasyonlar" },
    ],
    seoTitle: "Videograflar Bul | Kashe",
    seoDescription:
      "Videograflar kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Videograflar kategorisi; düğün, kurumsal etkinlik, reklam ve tanıtım filmi için profesyonel video çekimi hizmeti sunar.",
  },

  organizasyon: {
    heroHeadline: "Etkinliğini Baştan Sona Profesyonel Organizasyon Hizmetleriyle Planla",
    description:
      "Organizasyon Hizmetleri kategorisi; bireysel ve kurumsal kullanıcıların etkinliklerini planlama, koordinasyon, dekorasyon, tedarikçi yönetimi, program akışı, teknik ihtiyaçlar, ikram, sahne ve operasyonel süreçlerle birlikte profesyonel şekilde yönetmesini sağlar.",
    subServices: [
      { name: "Düğün Organizasyonu", description: "Düğün konsepti, akış planı, dekorasyon, tedarikçi ve operasyon yönetimi" },
      { name: "Nişan / Söz Organizasyonu", description: "Ev, salon veya açık alan nişan organizasyonları" },
      { name: "Kına Organizasyonu", description: "Geleneksel veya modern kına gecesi planlama" },
      { name: "Doğum Günü Organizasyonu", description: "Çocuk ve yetişkin doğum günü etkinlikleri" },
      { name: "Baby Shower / Gender Reveal", description: "Bebek kutlamaları ve konsept dekorasyon" },
      { name: "Kurumsal Etkinlik Organizasyonu", description: "Lansman, gala, şirket yemeği, bayi toplantısı" },
      { name: "Açılış / Lansman Organizasyonu", description: "Mağaza açılışı, ürün tanıtımı ve marka etkinlikleri" },
      { name: "Fuar / Stand Etkinliği Organizasyonu", description: "Fuar katılımı, stand etkinliği ve marka aktivasyon yönetimi" },
      { name: "Özel Parti / Sosyal Etkinlik Organizasyonu", description: "Mezuniyet, yıl dönümü, sürpriz parti ve konsept etkinlikler" },
      { name: "Etkinlik Koordinatörlüğü", description: "Etkinlik günü akış, ekip, zaman ve tedarikçi koordinasyonu" },
      { name: "Konsept ve Dekorasyon Planlama", description: "Tema, renk paleti, masa düzeni, sahne ve ambiyans tasarımı" },
    ],
    seoTitle: "Organizasyon Hizmetleri Bul | Kashe",
    seoDescription:
      "Organizasyon Hizmetleri kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Organizasyon Hizmetleri kategorisi; düğün, kurumsal etkinlik ve özel kutlamaları planlama, dekorasyon ve operasyon yönetimiyle baştan sona profesyonelce yürütür.",
  },

  "ses-isik": {
    heroHeadline: "Etkinliğinin Teknik Altyapısını Profesyonel Ekiplere Teslim Et",
    description:
      "Teknik Ekip / Ses-Işık kategorisi; etkinliklerin teknik kurulum, ses, ışık, görüntü, sahne, mikrofon, projeksiyon, LED ekran, canlı yayın ve operasyon ihtiyaçlarını karşılayan profesyonelleri ve ekipman sağlayıcılarını kapsar. Düğün, konser, kurumsal etkinlik, panel, konferans, fuar, gala, lansman ve açık hava etkinlikleri için kritik bir kategoridir.",
    subServices: [
      { name: "Ses Sistemi Kurulumu", description: "Hoparlör, mikser, monitör ve ses ekipmanı kurulumu" },
      { name: "Işık Sistemi Kurulumu", description: "Sahne, ambiyans, dekoratif ışık ve özel efekt aydınlatmaları" },
      { name: "Sahne Kurulumu", description: "Konser, panel, sunum, gala ve açık hava etkinlikleri" },
      { name: "Mikrofon ve Seslendirme", description: "Kablosuz mikrofon, yaka mikrofonu, masa mikrofonu ve anons" },
      { name: "Projeksiyon / Perde Kiralama", description: "Seminer, sunum, konferans ve eğitim etkinlikleri" },
      { name: "LED Ekran / Görüntü Sistemi", description: "Büyük ölçekli etkinliklerde görüntü aktarım çözümleri" },
      { name: "Canlı Yayın / Hibrit Etkinlik Desteği", description: "Webinar, online panel ve hibrit toplantı altyapısı" },
      { name: "DJ / Müzisyen Teknik Desteği", description: "Performans için sahne, ses, ışık ve operasyon" },
      { name: "Jeneratör / Enerji Desteği", description: "Açık hava etkinlikleri için güç kaynağı" },
      { name: "Fotoğraf Kabini / Eğlence Ekipmanları", description: "Etkinliklerde teknik ve eğlence ekipmanları" },
      { name: "Teknik Operasyon Ekibi", description: "Etkinlik boyunca ses, ışık, görüntü ve sahne yönetimi" },
    ],
    seoTitle: "Teknik Ekip / Ses-Işık Bul | Kashe",
    seoDescription:
      "Teknik Ekip / Ses-Işık kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Teknik Ekip / Ses-Işık kategorisi; etkinliklerin ses, ışık, sahne, görüntü ve canlı yayın altyapısını profesyonel ekiplere teslim etmeni sağlar.",
  },

  palyaco: {
    heroHeadline: "Çocuk Partileri ve Özel Etkinlikler İçin Eğlenceli Gösteriler Bul",
    description:
      "Palyaço ve çocuk animasyonu kategorisi; çocuk etkinlikleri, doğum günleri, okul organizasyonları, aile günleri, AVM etkinlikleri ve özel kutlamalar için eğlence odaklı profesyonellere ulaşmayı sağlar. Palyaço gösterisi, yüz boyama, balon şekillendirme, jonglörlük, çocuk animasyonu, maskot ve interaktif sahne gösterileri bu kategoriye dahildir.",
    subServices: [
      { name: "Palyaço Gösterisi", description: "Çocuk doğum günü, okul etkinliği ve özel kutlamalar" },
      { name: "Yüz Boyama Sanatçısı", description: "Çocuk partileri, AVM etkinlikleri ve okul organizasyonları" },
      { name: "Balon Şekillendirme", description: "Çocuklara özel balon figürleri ve animasyon" },
      { name: "Çocuk Animatörü", description: "Oyun, yarışma, dans ve interaktif etkinlik yönetimi" },
      { name: "Jonglör Gösterisi", description: "Sahne, sokak etkinliği veya açık alan organizasyonları" },
      { name: "Maskot Karakter", description: "Çizgi film, süper kahraman veya tematik karakter kostümü" },
      { name: "Bubble Show / Köpük Gösterisi", description: "Çocuk etkinlikleri için görsel ve interaktif gösteri" },
      { name: "Mini Sahne Gösterisi", description: "Doğum günü, okul veya kurumsal aile günü için kısa performans" },
    ],
    seoTitle: "Palyaço ve Çocuk Animasyonu Bul | Kashe",
    seoDescription:
      "Palyaço ve çocuk animasyonu kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Palyaço ve çocuk animasyonu kategorisi; doğum günleri, okul etkinlikleri ve özel kutlamalar için eğlence odaklı profesyonellere ulaşmayı sağlar.",
  },

  illuzyonist: {
    heroHeadline: "Etkinliğine Şaşırtan Sihirbazlık ve İllüzyon Gösterileri Kat",
    description:
      "Sihirbazlar ve illüzyonistler kategorisi; doğum günleri, kurumsal etkinlikler, galalar, özel davetler ve sahne organizasyonları için profesyonel sihirbazlık ve illüzyon gösterileri sunan performansçılara ulaşmayı sağlar. Sahne sihirbazlığı, masa başı (close-up) illüzyon, mentalizm, çocuk sihirbaz gösterisi ve büyük ölçekli illüzyon şovları bu kategoriye dahildir.",
    subServices: [
      { name: "Sahne Sihirbazlığı", description: "Doğum günü, kurumsal etkinlik ve özel davetler için sahne gösterisi" },
      { name: "Masa Başı (Close-up) Sihirbazlık", description: "Davet, kokteyl ve masa arası yakın plan illüzyon" },
      { name: "Çocuk Sihirbaz Gösterisi", description: "Çocuk doğum günleri ve okul etkinlikleri için interaktif gösteri" },
      { name: "Mentalizm / Akıl Okuma", description: "Kurumsal etkinlik ve özel davetler için zihin gösterileri" },
      { name: "İllüzyon Şovu", description: "Büyük ölçekli sahne illüzyonları ve görsel efektli gösteriler" },
      { name: "Kurumsal Etkinlik Sihirbazı", description: "Lansman, gala ve marka etkinlikleri için profesyonel performans" },
      { name: "Palyaço + Sihirbaz Paketi", description: "Birden fazla eğlence unsurunun birlikte sunulduğu paket" },
    ],
    seoTitle: "Sihirbazlar ve İllüzyonistler Bul | Kashe",
    seoDescription:
      "Sihirbazlar ve illüzyonistler kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Sihirbazlar ve illüzyonistler kategorisi; doğum günleri, kurumsal etkinlikler ve özel davetler için profesyonel sihirbazlık ve illüzyon gösterileri sunar.",
  },

  oyuncu: {
    heroHeadline: "Reklam, Dizi, Film ve Çekim Projelerin İçin Doğru Yüzleri Bul",
    description:
      "Oyuncular ve figüranlar kategorisi; reklam, dizi, film, kısa film, tanıtım filmi, sahne performansı ve etkinlik projeleri için oyuncu, figüran, tiyatrocu ve performans profesyonellerine ulaşmayı sağlar. Bu kategori Kashe'nin medya ve prodüksiyon tarafındaki en stratejik dikeylerinden biridir.",
    subServices: [
      { name: "Reklam Oyuncusu", description: "Reklam filmi, dijital reklam, ürün tanıtımı ve marka kampanyaları" },
      { name: "Dizi / Film Oyuncusu", description: "Kısa film, dizi, uzun metraj ve bağımsız yapımlar" },
      { name: "Figüran", description: "Dizi, film, reklam, klip ve kalabalık sahne çekimleri" },
      { name: "Tiyatrocu", description: "Sahne performansı, drama, doğaçlama ve etkinlik içi performans" },
      { name: "Sesli / Görsel Performans Oyuncusu", description: "Kamera önü anlatım, tanıtım videosu ve sosyal medya içerikleri" },
      { name: "Çocuk Oyuncu", description: "Reklam, katalog ve sosyal medya projeleri için çocuk profilleri; yasal izin süreçleri ayrıca yönetilmelidir" },
      { name: "Özel Yetenekli Oyuncu", description: "Dans, spor, dövüş, müzik, yabancı dil, aksan veya özel beceri gerektiren roller" },
    ],
    seoTitle: "Oyuncular ve Figüranlar Bul | Kashe",
    seoDescription:
      "Oyuncular ve figüranlar kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Oyuncular ve figüranlar kategorisi; reklam, dizi, film ve tanıtım projeleri için oyuncu, figüran ve performans profesyonellerine ulaşmayı sağlar.",
  },

  model: {
    heroHeadline: "Çekim, Kampanya ve Defile Projelerin İçin Profesyonel Modeller Bul",
    description:
      "Modeller ve mankenler kategorisi; katalog, moda çekimi, ürün tanıtımı, sosyal medya kampanyası, defile ve etkinlik projeleri için katalog modeli, fotoğraf modeli, defile mankeni ve tanıtım modeli profesyonellerine ulaşmayı sağlar.",
    subServices: [
      { name: "Katalog Modeli", description: "Moda, giyim, aksesuar, ürün ve e-ticaret katalog çekimleri" },
      { name: "Fotoğraf Modeli", description: "Kampanya, portre, lifestyle ve sosyal medya çekimleri" },
      { name: "Defile Mankeni", description: "Moda defilesi, podyum, lansman ve showroom etkinlikleri" },
      { name: "Tanıtım Modeli", description: "Fuar, lansman, marka aktivasyonu ve ürün tanıtımı" },
      { name: "Çocuk Model", description: "Reklam, katalog ve sosyal medya projeleri için çocuk profilleri; yasal izin süreçleri ayrıca yönetilmelidir" },
      { name: "Özel Yetenekli Model", description: "Dans, spor, özel görünüm veya özel beceri gerektiren çekimler" },
    ],
    seoTitle: "Modeller ve Mankenler Bul | Kashe",
    seoDescription:
      "Modeller ve mankenler kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Modeller ve mankenler kategorisi; katalog, moda çekimi, defile ve marka kampanyaları için profesyonel model ve mankenlere ulaşmayı sağlar.",
  },

  dansci: {
    heroHeadline: "Sahneni Profesyonel Dansçı ve Gösteri Ekipleriyle Hareketlendir",
    description:
      "Dansçılar kategorisi; düğün, kına, açılış, lansman, kurumsal etkinlik, festival, konser, sahne gösterisi, gala ve özel davetlerde performans sunacak solo dansçı, dans ekibi ve koreograf profesyonellerini kapsar. Kullanıcılar dans türü, ekip boyutu, gösteri süresi, şehir, fiyat aralığı, puan, yorum ve müsaitliğe göre profilleri karşılaştırabilir.",
    subServices: [
      { name: "Modern / Show Dans Ekibi", description: "Sahne gösterisi, açılış ve kurumsal etkinlik koreografileri" },
      { name: "Latin Dans Performansı", description: "Salsa, bachata, tango ve sosyal dans gösterileri" },
      { name: "Hip-hop / Sokak Dansı", description: "Konser, festival ve marka etkinliği performansları" },
      { name: "Halk Oyunları Ekibi", description: "Düğün, kına ve kültürel etkinlikler için yöresel gösteriler" },
      { name: "Oryantal / Sahne Dansı", description: "Özel davet, gece kulübü ve sahne programları" },
      { name: "Düğün Açılış Dansı Koreografisi", description: "Çiftlere özel ilk dans hazırlığı ve prova" },
      { name: "Karşılama / Animasyon Ekibi", description: "Açılış, kortej, fuar ve marka aktivasyonu" },
      { name: "Koreograf", description: "Etkinlik, klip ve sahne projeleri için koreografi tasarımı" },
    ],
    seoTitle: "Dansçılar Bul | Kashe",
    seoDescription:
      "Dansçılar kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Dansçılar kategorisi; düğün, festival, konser, kurumsal etkinlik ve özel davetler için solo dansçı, dans ekibi ve koreograflara ulaşmayı sağlar.",
  },

  "stand-up-komedyen": {
    heroHeadline: "Etkinliğine Kahkahayı Profesyonel Stand-up Komedyenlerle Getir",
    description:
      "Stand-up komedyenler kategorisi; kurumsal etkinlik, gala, açılış, lansman, özel davet, sahne programı, üniversite etkinliği ve eğlence geceleri için sahne alacak stand-up sanatçısı ve doğaçlama komedyenlerini kapsar. Kullanıcılar gösteri türü, süre, dil, şehir, fiyat aralığı, puan, yorum ve müsaitliğe göre profilleri karşılaştırabilir.",
    subServices: [
      { name: "Kurumsal Etkinlik Komedyeni", description: "Gala, bayi buluşması, şirket partisi ve marka etkinlikleri" },
      { name: "Özel Davet Stand-up'ı", description: "Doğum günü, yıl dönümü ve özel kutlamalar" },
      { name: "Sahne / Kulüp Programı", description: "Biletli gösteri, komedi kulübü ve turne performansı" },
      { name: "Doğaçlama (Improv) Gösterisi", description: "Etkileşimli, seyirciyle kurgulanan doğaçlama sahne" },
      { name: "Üniversite / Topluluk Etkinliği", description: "Kampüs etkinlikleri, festival ve öğrenci organizasyonları" },
      { name: "Çok Dilli Stand-up", description: "Türkçe veya İngilizce sahne gösterisi" },
      { name: "MC / Sahne Aracısı Komedyen", description: "Program aralarında akışı canlı tutan sahne performansı" },
    ],
    seoTitle: "Stand-up Komedyenler Bul | Kashe",
    seoDescription:
      "Stand-up komedyenler kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Stand-up komedyenler kategorisi; kurumsal etkinlik, gala, özel davet ve sahne programları için stand-up sanatçısı ve doğaçlama komedyenlerine ulaşmayı sağlar.",
  },

  tercuman: {
    heroHeadline: "Toplantı ve Etkinliklerini Profesyonel Tercümanlarla Dile Getir",
    description:
      "Tercümanlar / çevirmenler kategorisi; konferans, panel, zirve, kurumsal toplantı, fuar, resmi görüşme, canlı yayın ve hibrit etkinliklerde simultane, ardıl, fısıltı ve yazılı çeviri sağlayacak profesyonelleri kapsar. Kullanıcılar dil çifti, çeviri türü, yeminli belgesi, uzmanlık alanı, şehir, fiyat aralığı ve müsaitliğe göre profilleri karşılaştırabilir.",
    subServices: [
      { name: "Simultane Tercüman", description: "Konferans, zirve ve büyük ölçekli etkinliklerde eşzamanlı çeviri" },
      { name: "Ardıl Tercüman", description: "Toplantı, görüşme, basın ve resmi programlarda ardışık çeviri" },
      { name: "Fısıltı (Chuchotage) Tercümanı", description: "Küçük gruplar ve ikili görüşmeler için sessiz çeviri" },
      { name: "Yeminli Tercüman", description: "Noter onaylı, resmi ve hukuki belge çevirileri" },
      { name: "Yazılı Çeviri / Editör", description: "Sözleşme, katalog, teknik doküman ve kurumsal metinler" },
      { name: "Hukuki / Tıbbi Uzman Tercüman", description: "Terminoloji gerektiren uzmanlık alanı çevirileri" },
      { name: "Çevrim İçi / Hibrit Etkinlik Tercümanı", description: "Uzaktan simultane ve canlı yayın çevirisi" },
    ],
    seoTitle: "Tercümanlar / Çevirmenler Bul | Kashe",
    seoDescription:
      "Tercümanlar / çevirmenler kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Tercümanlar / çevirmenler kategorisi; konferans, kurumsal toplantı, fuar ve resmi görüşmeler için simultane, ardıl ve yeminli çeviri sağlayan profesyonellere ulaşmayı sağlar.",
  },

  karikaturist: {
    heroHeadline: "Etkinliğine Renk Katacak Profesyonel Karikatürist ve Çizerleri Bul",
    description:
      "Karikatüristler kategorisi; düğün, kına, doğum günü, kurumsal etkinlik, fuar, lansman, marka aktivasyonu ve özel davetlerde canlı çizim yapacak ya da dijital illüstrasyon üretecek karikatürist ve çizer profesyonellerini kapsar. Kullanıcılar çizim türü, teslim süresi, şehir, fiyat aralığı, puan, yorum ve müsaitliğe göre profilleri karşılaştırabilir.",
    subServices: [
      { name: "Etkinlik Canlı Çizim", description: "Misafirlere anında portre karikatür; düğün, kına ve özel davet" },
      { name: "Kurumsal Etkinlik Karikatüristi", description: "Fuar, lansman, stand ve marka aktivasyonu için canlı çizim" },
      { name: "Portre Karikatür", description: "Hediyelik ve kişiye özel portre karikatür çalışmaları" },
      { name: "Dijital Karikatür / İllüstrasyon", description: "Tablet üzerinde dijital çizim ve baskıya hazır teslim" },
      { name: "Marka / Ürün İllüstrasyonu", description: "Kampanya, ambalaj ve içerik için özgün çizim" },
      { name: "Etkinlik Hediyelik Çizim Standı", description: "Konuklara anlık hediyelik üreten çizim köşesi kurulumu" },
    ],
    seoTitle: "Karikatüristler Bul | Kashe",
    seoDescription:
      "Karikatüristler kategorisindeki profesyonelleri Kashe'de keşfet. Profilleri incele, fiyatları karşılaştır, teklif al ve etkinliğin ya da projen için doğru profesyonelle çalış.",
    landingText:
      "Karikatüristler kategorisi; düğün, kurumsal etkinlik, fuar ve özel davetler için canlı çizim ve dijital illüstrasyon üreten karikatüristlere ulaşmayı sağlar.",
  },
};

/**
 * Kategori içeriğini güvenle getirir.
 * İçerik tanımlı DEĞİLSE null döner → kategori sayfası mevcut generic davranışına
 * düşmeli (boşluk göstermek yerine bugünkü gibi davranmalı).
 */
export function getCategoryContent(slug: string): CategoryContent | null {
  return CATEGORY_CONTENT[slug] ?? null;
}
