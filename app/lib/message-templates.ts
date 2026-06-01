/**
 * Hazır mesaj şablonları — sabit liste.
 *
 * İki kullanım alanı:
 *   1) Mesajlaşma ekranı (konusma-detay) — hızlı yanıt çubuğu
 *   2) Başvuru modalı (apply-modal) — başvuru mesajı taslağı
 *
 * Rol ayrımı:
 *   - 'customer'      → hizmet alan (client/business): soru soran taraf
 *   - 'professional'  → hizmet veren (professional/agency): cevaplayan taraf
 *
 * Kategori-özel şablonlar slug bazlı eklenir; genel şablonlarla birleştirilir.
 */

export type TemplateRole = 'customer' | 'professional';

// ============================================================================
// MESAJLAŞMA ŞABLONLARI — kısa, sohbette tek tıkla basılır
// ============================================================================

// Her iki rol için, her kategoride geçerli genel mesajlar
const CHAT_GENERAL: Record<TemplateRole, string[]> = {
  customer: [
    'Merhaba, etkinliğim için müsaitliğinizi öğrenebilir miyim?',
    'Tarih ve detayları paylaşabilirim, uygun musunuz?',
    'Fiyatlandırma hakkında bilgi alabilir miyim?',
    'Daha önce benzer bir etkinlikte çalıştınız mı?',
    'Teşekkürler, değerlendirip size döneceğim.',
    'Anlaştık, süreç için sonraki adımı söyler misiniz?',
  ],
  professional: [
    'Merhaba, ilginiz için teşekkürler. Etkinliğinizin tarihini paylaşır mısınız?',
    'Bu tarih için müsaitim, detayları konuşabiliriz.',
    'Size en uygun teklifi hazırlayıp ileteceğim.',
    'Etkinlik lokasyonu ve süresi hakkında bilgi verebilir misiniz?',
    'Portföyümü ve önceki çalışmalarımı inceleyebilirsiniz.',
    'Teşekkürler, sizinle çalışmaktan memnuniyet duyarım.',
  ],
};

// Kategori-özel sohbet mesajları — slug → rol → mesajlar
const CHAT_BY_CATEGORY: Record<string, Partial<Record<TemplateRole, string[]>>> = {
  dj: {
    customer: [
      'Hangi müzik türlerinde çalıyorsunuz?',
      'Ekipmanı (ses sistemi) siz mi getiriyorsunuz?',
      'Yaklaşık kaç saatlik bir performans olacak?',
    ],
    professional: [
      'Hangi müzik türlerini tercih ediyorsunuz? (pop, remix, slow vb.)',
      'Ses ve ışık ekipmanını ben getiriyorum, ek ücret yok.',
      'İstek parça listesi paylaşırsanız sete ekleyebilirim.',
    ],
  },
  muzisyen: {
    customer: [
      'Akustik mi yoksa grup performansı mı sunuyorsunuz?',
      'Repertuvarınızda Türkçe ve yabancı parçalar var mı?',
    ],
    professional: [
      'Akustik veya grup, ihtiyacınıza göre uyarlayabiliriz.',
      'Repertuvar ve sahne kurulum ihtiyacımı paylaşabilirim.',
    ],
  },
  fotografci: {
    customer: [
      'Çekim kaç saat sürecek ve kaç kare teslim ediyorsunuz?',
      'Dış çekim ve albüm seçeneğiniz var mı?',
      'Fotoğraflar yaklaşık ne kadar sürede teslim edilir?',
    ],
    professional: [
      'Çekim süresi ve teslim adedini etkinliğe göre netleştirebiliriz.',
      'Dış çekim, tören ve after party paketlerim mevcut.',
      'Teslim süresi ortalama 2 haftadır, acil teslim de mümkün.',
    ],
  },
  videograf: {
    customer: [
      '4K çekim ve kısa kurgu video sunuyor musunuz?',
      'Drone çekimi paketinize dahil mi?',
    ],
    professional: [
      '4K çekim + kurgu videoyu standart sunuyorum.',
      'Drone çekimi ekleyebilirim, detayını konuşalım.',
    ],
  },
  sunucu: {
    customer: [
      'Kurumsal etkinlik akışı yönetiminde deneyiminiz var mı?',
      'Etkinlik yaklaşık kaç saat sürecek?',
    ],
    professional: [
      'Etkinlik akışını baştan sona yönetirim, deneyimliyim.',
      'Akış senaryosunu önceden birlikte hazırlayabiliriz.',
    ],
  },
  hostes: {
    customer: [
      'Kaç kişilik hostes/host ekibine ihtiyacım var, sağlayabilir misiniz?',
      'İngilizce bilen personel mevcut mu?',
    ],
    professional: [
      'İhtiyacınıza göre ekip sayısını ayarlayabilirim.',
      'İngilizce bilen, sunum yeteneği güçlü personelim mevcut.',
    ],
  },
  oyuncu: {
    customer: [
      'Showreel veya önceki çalışmalarınızı paylaşabilir misiniz?',
      'Çekim İstanbul içinde, 1 günlük. Uygun musunuz?',
    ],
    professional: [
      'Showreel ve portföyümü hemen paylaşabilirim.',
      'Çekim tarihi ve lokasyonu netleşince planlayabiliriz.',
    ],
  },
  model: {
    customer: [
      'Katalog çekimi için ölçü ve portföy bilgisi paylaşabilir misiniz?',
      'Çekim 1 günlük stüdyo işi, uygun musunuz?',
    ],
    professional: [
      'Ölçülerimi ve portföyümü paylaşabilirim.',
      'Stüdyo çekimi için uygunum, tarihi netleştirelim.',
    ],
  },
  palyaco: {
    customer: [
      'Çocuk partisi için kaç saatlik gösteri sunuyorsunuz?',
      'Balon ve animasyon gösteriye dahil mi?',
    ],
    professional: [
      'Gösteri süresini yaş grubuna göre ayarlıyorum.',
      'Balon, animasyon ve oyunlar gösteriye dahildir.',
    ],
  },
  illuzyonist: {
    customer: [
      'Sahne gösterisi mi masalar arası gösteri mi sunuyorsunuz?',
      'Yaklaşık ne kadarlık bir performans olacak?',
    ],
    professional: [
      'Hem sahne hem masa arası gösteri sunabilirim.',
      'Performans süresini etkinliğe göre planlayabiliriz.',
    ],
  },
  organizasyon: {
    customer: [
      'Etkinliğin komple organizasyonunu üstleniyor musunuz?',
      'Mekan, ikram ve dekor dahil paket sunuyor musunuz?',
    ],
    professional: [
      'Baştan sona komple organizasyon hizmeti veriyorum.',
      'Mekan, ikram, dekor ve koordinasyon dahil paketlerim var.',
    ],
  },
  'ses-isik': {
    customer: [
      'Etkinlik mekanı için keşif yapabilir misiniz?',
      'Ses ve ışık sistemini siz kuruyor musunuz?',
    ],
    professional: [
      'Mekan keşfi yapıp kurulumu ekibimle gerçekleştiririm.',
      'Ses ve ışık operasyonunu baştan sona yönetiyorum.',
    ],
  },
};

// ============================================================================
// BAŞVURU ŞABLONLARI — daha uzun, başvuru mesajı taslağı (apply-modal)
// Başvuran = professional/agency olduğu için tek rol yeterli.
// ============================================================================

const APPLICATION_GENERAL: string[] = [
  'Merhaba, ilanınızı inceledim ve bu iş için uygun olduğumu düşünüyorum. Benzer etkinliklerde deneyimim var; detayları konuşmak için sizinle iletişime geçmekten memnuniyet duyarım.',
  'İlanınız ilgimi çekti. Etkinliğinizin gereksinimlerini karşılayabileceğime eminim. Portföyümü ve önceki çalışmalarımı inceleyebilirsiniz; uygunsanız detayları görüşelim.',
];

const APPLICATION_BY_CATEGORY: Record<string, string[]> = {
  dj: [
    'Merhaba, ilanınız için başvuruyorum. Farklı müzik türlerinde performans veriyor, kendi ses ve ışık ekipmanımı getiriyorum. Etkinliğinizin tarzına uygun bir set hazırlayabilirim.',
  ],
  fotografci: [
    'Merhaba, ilanınız için başvuruyorum. Dış çekim, tören ve after party dahil deneyimliyim. Çalışmalarımı portföyümde görebilirsiniz; teslim sürem ortalama 2 haftadır.',
  ],
  videograf: [
    'Merhaba, ilanınız için başvuruyorum. 4K çekim ve kurgu video sunuyorum, talep ederseniz drone çekimi de ekleyebilirim. Önceki işlerimi paylaşmaktan memnuniyet duyarım.',
  ],
  sunucu: [
    'Merhaba, ilanınız için başvuruyorum. Etkinlik akışı yönetiminde deneyimliyim; diksiyon ve sahne hakimiyetiyle programınızı sorunsuz yürütürüm.',
  ],
  hostes: [
    'Merhaba, ilanınız için başvuruyorum. Karşılama ve yönlendirme konusunda deneyimliyim, ekip ihtiyacınızı karşılayabilirim. İngilizce iletişim kurabilirim.',
  ],
  organizasyon: [
    'Merhaba, ilanınız için başvuruyoruz. Etkinliğinizin baştan sona organizasyonunu üstlenebiliriz; mekan, ikram, dekor ve koordinasyon dahil komple hizmet sunuyoruz.',
  ],
  'ses-isik': [
    'Merhaba, ilanınız için başvuruyorum. Ses ve ışık sistemini kurup operasyonunu yönetebilirim. Gerekirse mekan keşfi yapabilirim.',
  ],
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Mesajlaşma ekranı için şablonlar: genel + (varsa) kategori-özel.
 * @param role - viewer'ın rolü ('customer' | 'professional')
 * @param categorySlug - konuşmanın kategorisi (karşı tarafın kategorisi)
 */
export function getChatTemplates(
  role: TemplateRole,
  categorySlug: string | null
): string[] {
  const general = CHAT_GENERAL[role] ?? [];
  const categorySpecific =
    (categorySlug && CHAT_BY_CATEGORY[categorySlug]?.[role]) || [];
  // Kategori-özel önce (daha alakalı), sonra genel
  return [...categorySpecific, ...general];
}

/**
 * Başvuru modalı için taslak metinler: genel + (varsa) kategori-özel.
 * @param categorySlug - ilanın kategorisi
 */
export function getApplicationTemplates(categorySlug: string | null): string[] {
  const categorySpecific =
    (categorySlug && APPLICATION_BY_CATEGORY[categorySlug]) || [];
  return [...categorySpecific, ...APPLICATION_GENERAL];
}