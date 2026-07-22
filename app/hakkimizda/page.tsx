import { TopNav } from '@/app/components/sections/top-nav';

export const metadata = {
  title: 'Hakkımızda — Kashe',
  description:
    "Kashe, etkinlik düzenleyenlerle sahne profesyonellerini doğrudan buluşturan Türkiye'nin etkinlik ve yetenek pazaryeri.",
};

type Cta = { label: string; href: string };
type Section = {
  id?: string;
  title: string;
  body: string | string[];
  email?: string;
  ctas?: Cta[];
};

const SECTIONS: Section[] = [
  {
    title: 'Kashe nedir?',
    body: "Kashe, etkinlik düzenleyenlerle sahne profesyonellerini doğrudan buluşturan Türkiye'nin etkinlik ve yetenek pazaryeri. Düğünden kurumsal lansmana, DJ'den fotoğrafçıya — doğru profesyoneli aracısız, şeffaf fiyatla bulursun.",
  },
  {
    title: 'Neden Kashe?',
    body: 'Etkinlik sektöründe işler çoğu zaman tanıdık tavsiyesi ve telefon trafiğiyle döner: fiyatlar belirsiz, portfolyo dağınık, güvence yok. Kashe bu süreci tek çatı altında toplar — doğrulanmış profiller, gerçek yorumlar, karşılaştırılabilir teklifler ve platform içinde güvenli iletişim.',
  },
  {
    id: 'etkinlik-sahipleri',
    title: 'Etkinlik sahipleri için',
    body: [
      `Bir düğün, bir doğum günü, bir mezuniyet... İyi bir etkinliğin arkasında doğru insanlar vardır. DJ'den fotoğrafçıya, sunucudan illüzyoniste 16 kategorideki profesyonelleri Kashe'de tek yerden keşfedersin. Şehre, bütçene, müsaitliğe ve etkinlik türüne göre filtrele. Profillerde fiyat aralıklarını, geçmiş işleri, deneyim ve eğitim kayıtlarını gör.`,
      `Karar vermeden önce iki yolun var: beğendiğin profesyonelden doğrudan teklif iste ya da Teklif Topla ile ihtiyacını bir kez yaz, teklifler sana gelsin. Tarihini seç, rezervasyon talebini gönder, tüm süreci Kashe mesajları üzerinden yürüt.`,
      `Ne arayacağından emin değilsen Kashe AI etkinlik planlayıcısı ihtiyaç listeni saniyeler içinde çıkarır.`,
      `Güvenin altyapısı da hazır: her profil yayına alınmadan önce ekibimiz tarafından incelenir. Gerçekleşmiş çalışmalardan gelen değerlendirmeler "Onaylı yorum" rozetiyle ayrışır. İletişim platform üzerinde, kayıt altında ilerler.`,
    ],
    ctas: [
      { label: 'Profesyonelleri keşfet', href: '/kesfet' },
      { label: 'Etkinliğini planla', href: '/etkinlik-planla' },
    ],
  },
  {
    id: 'kurumsal',
    title: 'Kurumsal müşteriler için',
    body: [
      `Lansman, bayi toplantısı, yıl sonu daveti, fuar... Kurumsal etkinlikler ritim ister. Kurumsal hesabınla ekip arkadaşlarını Kashe'ye davet et. Teklifleri ve rezervasyon taleplerini ekipçe tek yerden takip edin. Aynı anda birden çok etkinlik yürütsen de hangi talebin hangi aşamada olduğu herkes için görünür kalır.`,
      `Profesyonellerin deneyim geçmişleri, kurumsal sahne referansları ve etkinlik türü beyanları kararlarını hızlandırır. Kurumsal davet deneyimi olan profesyonelleri etkinlik türü filtresiyle ayrıca listeleyebilirsin.`,
    ],
    ctas: [{ label: 'Kurumsal hesap aç', href: '/uye-ol?rol=kurumsal' }],
  },
  {
    id: 'profesyoneller',
    title: 'Profesyoneller için',
    body: [
      `Kashe'de profilin bir ilan değil, bir vitrin. Kategorine özel alanlarla kendini tam anlatırsın: DJ'sen repertuarın ve sahne bilgilerin, modelsen ölçülerin ve çalışma şeklin, tercümansan dil çiftlerin. Deneyimlerini, eğitimlerini ve ödüllerini ekle, portföyünü yükle. Hizmetlerini ister sabit fiyatla, ister aralıkla, ister "fiyat görüşülür" olarak yayınla. Birden çok hizmeti tek pakette topla.`,
      `Müşteriler sana Teklif Al ve Rezervasyon Talebi ile ulaşır. İlan tahtasındaki işlere sen de başvurursun. "Doğrulanmış" ve "Tekrar tercih ediliyor" gibi rozetler gerçek performansından beslenir. Profil metnin için Kashe AI'dan destek al; daha fazla görünürlük istersen Premium seni keşfetin üst sıralarına taşır.`,
      `Telefonun ve e-postan, anlaşma netleşene kadar gizli kalır — vitrindesin ama kontrol sende.`,
    ],
    ctas: [
      { label: 'Profilini aç', href: '/uye-ol?rol=profesyonel' },
      { label: "Premium'u incele", href: '/premium' },
    ],
  },
  {
    id: 'ajanslar',
    title: 'Ajanslar için',
    body: [
      `Ekibin tek çatı altında. Ajans profili aç, profesyonellerini davet et. Kabul eden her üyenin profilinde ajansın görünür, ajans sayfanda ekibin listelenir. Müşteriler hem tek tek profesyonellerini hem ajansını keşfedebilir. Davetleri ve üyelikleri ajans panelinden yönetirsin.`,
    ],
    ctas: [{ label: 'Ajans hesabı oluştur', href: '/uye-ol/ajans' }],
  },
  {
    title: 'Yolculuğun başındayız',
    body: 'Kashe genç bir platform ve her gün gelişiyor. Aklındaki soru, öneri ya da iş birliği için bize yaz: ',
    email: 'kasheofficial@gmail.com',
  },
];

export default function HakkimizdaPage() {
  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper">
        {/* HERO */}
        <section className="border-b border-line">
          <div className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-ink mb-4">
              Hakkımızda
            </p>
            <h1 className="font-display font-semibold text-4xl md:text-6xl text-ink tracking-tight leading-[1.05]">
              Etkinlik ve yeteneği{' '}
              <em className="text-brand-ink not-italic font-medium">
                buluşturuyoruz
              </em>
              .
            </h1>
          </div>
        </section>

        {/* İÇERİK */}
        <section className="max-w-3xl mx-auto px-6 md:px-12 py-14 md:py-20">
          <div className="space-y-12">
            {SECTIONS.map((s) => {
              const paras = Array.isArray(s.body) ? s.body : [s.body];
              return (
                <div key={s.title} id={s.id} className="scroll-mt-24">
                  <h2 className="font-display font-semibold text-2xl md:text-3xl text-ink tracking-tight mb-4 text-balance">
                    {s.title}
                  </h2>
                  {/* Okuma kolonu (~65ch) + paragraf ritmi; başlık tam hizada kalır */}
                  <div className="max-w-2xl space-y-5">
                    {paras.map((para, i) => (
                      <p
                        key={i}
                        className="text-ink-72 text-base md:text-lg leading-relaxed text-pretty"
                      >
                      {para}
                      {i === paras.length - 1 && s.email && (
                        <a
                          href={`mailto:${s.email}`}
                          className="text-brand-ink font-medium hover:underline underline-offset-4"
                        >
                          {s.email}
                        </a>
                      )}
                      </p>
                    ))}
                  </div>
                  {s.ctas && s.ctas.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                      {s.ctas.map((c) => (
                        <a
                          key={c.label}
                          href={c.href}
                          className="font-display font-semibold text-brand-ink hover:text-brand-ink-deep transition-colors"
                        >
                          {c.label} →
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
