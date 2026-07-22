import { TopNav } from '@/app/components/sections/top-nav';
import { Eyebrow } from '@/app/components/ui/eyebrow';
import { FaqSection } from '@/app/components/sections/faq-section';
import Link from 'next/link';

export const metadata = {
  title: 'Yardım ve SSS — Kashe',
  description:
    'Kashe hakkında merak ettiklerin. Hesap, mesajlaşma, teklif, rezervasyon ve daha fazlası.',
};

type FaqGroup = {
  id: string;
  eyebrow: string;
  title: string;
  questions: { q: string; a: string }[];
};

// Yardım sayfası — tüm SSS'ler kategorize edilmiş halde.
// Landing'deki FaqSection ile çakışma yok — orası kısa 6 soruluk teaser,
// burası kapsamlı tam liste.
const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 'genel',
    eyebrow: 'Başlangıç',
    title: 'Genel sorular',
    questions: [
      {
        q: 'Kashe nedir?',
        a: 'Kashe; etkinlik, eğlence, medya ve prodüksiyon profesyonellerini hizmet arayan bireysel ve kurumsal kullanıcılarla buluşturan bir dijital pazaryeridir. Doğrudan profesyonele teklif gönderebilir, mesajlaşabilir ve rezervasyon yapabilirsin.',
      },
      {
        q: 'Üyelik ücretli mi?',
        a: 'Şu an Kashe’deki tüm temel özellikler ücretsizdir: kayıt, profil oluşturma, arama, mesajlaşma, teklif alma/verme ve rezervasyon. İlerleyen dönemde komisyon ve premium üyelik paketleri eklenecek; bu değişiklikler kullanıcılara önceden duyurulacaktır.',
      },
      {
        q: 'Kashe kimlere uygun?',
        a: 'İki tarafa hitap eder: (1) Etkinlik düzenleyen bireyler ve kurumsal firmalar — düğün, doğum günü, açılış, kurumsal toplantı vb. için profesyonel arayanlar. (2) Etkinlik, eğlence ve medya sektöründe çalışan profesyoneller, ajanslar ve menajerler — yeni iş fırsatlarına ulaşmak isteyenler.',
      },
      {
        q: 'Üye olmadan da gezebilir miyim?',
        a: 'Evet. Profesyonelleri keşfedebilir, profilleri inceleyebilir, hizmetleri görebilirsin. Ancak mesajlaşma, teklif gönderme, favorilere ekleme gibi etkileşimli işlemler için üye olman gerekir.',
      },
      {
        q: 'Hangi şehirlerde hizmet veriyorsunuz?',
        a: 'Lansman aşamasında İstanbul, Ankara ve İzmir öncelikli pilot şehirlerdir. Profesyoneller Türkiye genelinde kayıt olabilir; kullanıcılar profesyonelin belirttiği hizmet bölgesine göre arama yapar.',
      },
    ],
  },
  {
    id: 'hesap',
    eyebrow: 'Hesap',
    title: 'Hesap ve profil',
    questions: [
      {
        q: 'Hangi rolde kayıt olmalıyım?',
        a: 'Dört seçenek var: (1) Hizmet alan kullanıcı (bireysel — düğün, doğum günü, kurumsal etkinlik için profesyonel arıyorsan), (2) İşletme (kurumsal etkinlik düzenleyen firma), (3) Profesyonel hizmet sağlayıcı (kendi adına çalışan fotoğrafçı, DJ, sunucu vb.), (4) Ajans/menajer (birden fazla profesyoneli temsil eden yapı).',
      },
      {
        q: 'Sonradan rol değiştirebilir miyim?',
        a: 'Şu an rol değişikliği otomatik değil. Eğer rolünü değiştirmek istersen kasheofficial@gmail.com adresinden bizimle iletişime geç, yardımcı olalım.',
      },
      {
        q: 'Profilimi nasıl yayına alırım?',
        a: 'Profesyonel veya ajans olarak kayıt olduktan sonra profil bilgilerini doldur (kategori, şehir, hizmet açıklaması, fiyat aralığı, portföy). Tamamlanan profiller otomatik yayına geçer.',
      },
      {
        q: 'Profil fotoğrafımı/portföyümü nasıl güncellerim?',
        a: 'Sağ üst köşedeki menüden “Profilim” bölümüne git. Buradan profil fotoğrafı, biyografi ve portföy içeriğini düzenleyebilirsin.',
      },
      {
        q: 'Hesabımı nasıl silerim?',
        a: 'Hesap silme şu an otomatik bir akış değil. kasheofficial@gmail.com adresinden talep gönderdiğinde verilerini Gizlilik Politikası’nda belirtilen süreler içinde sileriz.',
      },
    ],
  },
  {
    id: 'mesajlasma',
    eyebrow: 'İletişim',
    title: 'Mesajlaşma ve teklif',
    questions: [
      {
        q: 'Bir profesyonelle nasıl iletişime geçerim?',
        a: 'Profile gir, “İletişime geç” butonuna tıkla. Etkinlik bilgilerini ve ilk mesajını gönder, profesyonel dakikalar/saatler içinde geri dönüş yapar.',
      },
      {
        q: 'Neden telefon numarası veya e-posta paylaşamıyorum?',
        a: 'Kashe içinde tüm iletişim platform üzerinden yapılır. Bu hem seni dolandırıcılığa karşı korur, hem anlaşmazlık durumunda yaşananların kaydı kalmasını sağlar, hem de hizmet kalitesinin izlenebilmesini mümkün kılar. Mesajlarda telefon/IBAN/e-posta paylaşımı otomatik engellenir.',
      },
      {
        q: 'Teklif nasıl gönderilir?',
        a: 'Profesyoneller, mesajlaşma sırasında “+” butonuna basarak teklif gönderebilir. Teklif; toplam tutar, hizmet kapsamı ve iptal politikasını içerir. Müşteri teklifi onayladığında otomatik rezervasyon oluşur.',
      },
      {
        q: 'Onayladığım bir teklifi iptal edebilir miyim?',
        a: 'Evet. Rezervasyonlarım sayfasından ilgili rezervasyonun detayına gir, “Rezervasyonu iptal et” butonuna tıkla. Profesyonelin belirttiği iptal politikası gösterilir; iptal halinde karşı tarafa bildirim ve e-posta gider.',
      },
      {
        q: 'Mesajlarım okundu mu nasıl görürüm?',
        a: 'Mesajının altında saat bilgisi var; karşı taraf mesajı görüntülediğinde okundu bilgisi güncellenir. Profesyonellerin son aktiflik bilgisi profillerinde gösterilir.',
      },
    ],
  },
  {
    id: 'rezervasyon',
    eyebrow: 'Rezervasyon',
    title: 'Rezervasyon ve ödeme',
    questions: [
      {
        q: 'Ödeme nasıl yapılır?',
        a: 'Şu an platform içi ödeme aktif değil. Müşteri ve profesyonel ödemeyi kendi aralarında belirledikleri yöntemle yapar. Lansman sonrası iyzico ile güvenli ödeme altyapısı entegre edilecek, %10 komisyon platform tarafından kesilecektir.',
      },
      {
        q: 'Rezervasyonum onaylandı, sonra ne olacak?',
        a: 'Onaylanan rezervasyon “Rezervasyonlarım” sayfanda görünür. Etkinlik tarihinde profesyonel ile anlaşılan kapsamda hizmet alırsın. İş bittiğinde profesyonel rezervasyonu “tamamlandı” olarak işaretler ve sen yorum bırakabilir hale gelirsin.',
      },
      {
        q: 'İş tamamlandı dedikten sonra ne oluyor?',
        a: 'Profesyonel rezervasyonu tamamlandı olarak işaretlediğinde müşteri e-posta ile bilgilendirilir ve profesyonelin profil sayfasından yorum bırakabilir.',
      },
      {
        q: 'Profesyonel rezervasyonu iptal ederse ne olur?',
        a: 'Karşı tarafa bildirim ve e-posta gider, iptal sebebi (varsa) kaydedilir. Profesyonelin tekrarlanan veya gerekçesiz iptalleri hesap performansını etkiler. Lansman sonrası ödeme altyapısı aktif olduğunda iade akışı da otomatikleşecek.',
      },
    ],
  },
  {
    id: 'guvenlik',
    eyebrow: 'Güven',
    title: 'Güvenlik ve şikayet',
    questions: [
      {
        q: 'Kashe verilerimi koruyor mu?',
        a: 'Evet. Tüm bağlantılar HTTPS ile şifrelenir, parolaların güvenli şekilde hashlenir, veritabanı seviyesinde RLS (satır seviyesi güvenlik) ile sadece sana ait verilere erişebilirsin. Detaylar için Gizlilik Politikası’na bakabilirsin.',
      },
      {
        q: 'Sahte profil veya kötü niyetli kullanıcı bildirebilir miyim?',
        a: 'Evet. kasheofficial@gmail.com adresinden bize ulaş, durumu inceleyip gerekli aksiyonu alalım. Lansman sonrası profil bazlı şikayet butonu eklenecek.',
      },
      {
        q: 'Bir profesyonelin gerçekten o kişi olduğunu nasıl bilirim?',
        a: 'Şu an temel kimlik doğrulama yok. İlerleyen dönemde doğrulama rozetleri eklenecek. Şimdilik portföy, yorumlar ve mesajlaşma deneyimine güvenmen önerilir. Şüpheli bir durumla karşılaşırsan bizimle iletişime geç.',
      },
    ],
  },
  {
    id: 'kategori',
    eyebrow: 'Hizmet',
    title: 'Kategoriler ve hizmetler',
    questions: [
      {
        q: 'Hangi kategoriler var?',
        a: 'Etkinlik hizmetleri (düğün, açılış, lansman), eğlence ve sahne (müzisyen, DJ, palyaço, sihirbaz, dansçı, sunucu), medya ve prodüksiyon (fotoğrafçı, videograf, oyuncu, model, figüran, seslendirme), etkinlik personeli ve teknik ekip (hostes, garson, ses-ışık), ajanslar ve kurumsal hizmetler. Tam liste için Keşfet sayfasına bakabilirsin.',
      },
      {
        q: 'Aradığım kategori yok, ne yapabilirim?',
        a: 'Hem ana sayfada kategori grid’inin altında, hem de Keşfet sidebar’ında “Aradığın kategori yok mu? Bize öner” linki bulunur. Tıklayıp öneri formunu doldur; talep yoğunluğuna göre yeni kategori ekliyoruz.',
      },
      {
        q: 'Çoklu kategori arayabilir miyim?',
        a: 'Evet. Keşfet sayfasında birden fazla kategoriyi aynı anda seçebilir, sonuçları o kategorilerin birleşimi olarak görebilirsin.',
      },
    ],
  },
];

export default function YardimPage() {
  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          {/* Geri linki */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-72 hover:text-brand-ink transition-colors mb-6"
          >
            <span>←</span>
            Ana sayfa
          </Link>

          {/* Header */}
          <div className="mb-12 md:mb-16">
            <Eyebrow variant="inline" className="mb-3">
              Yardım merkezi
            </Eyebrow>
            <h1 className="font-display font-light text-4xl md:text-5xl lg:text-6xl text-ink tracking-[-0.03em] leading-[1.05]">
              <em>Yardım</em> ve sık sorulanlar.
            </h1>
            <p className="text-base md:text-lg text-ink-72 mt-4 max-w-2xl leading-relaxed">
              Kashe hakkında merak ettiklerin. Aradığını bulamazsan{' '}
              <a
                href="mailto:kasheofficial@gmail.com"
                className="text-brand-ink hover:underline"
              >
                kasheofficial@gmail.com
              </a>{' '}
              adresinden bize ulaşabilirsin.
            </p>
          </div>

          {/* Hızlı geçiş — kategori linkleri */}
          <nav
            aria-label="Yardım kategorileri"
            className="mb-12 flex flex-wrap gap-2"
          >
            {FAQ_GROUPS.map((g) => (
              <a
                key={g.id}
                href={`#${g.id}`}
                className="kashe-tap inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-card border border-line rounded-full text-[12px] text-ink-72 hover:text-ink hover:border-brand-ink transition-colors"
              >
                {g.title}
              </a>
            ))}
          </nav>

          {/* Gruplar */}
          <div className="space-y-16">
            {FAQ_GROUPS.map((group) => (
              <YardimGrup key={group.id} group={group} />
            ))}
          </div>

          {/* Alt iletişim */}
          <div className="mt-20 pt-10 border-t border-line text-center">
            <Eyebrow variant="inline" className="mb-3 justify-center">
              Hala mı arıyorsun?
            </Eyebrow>
            <h2 className="font-display font-light text-2xl md:text-3xl text-ink tracking-tight leading-tight mb-3">
              Cevabını burada bulamadıysan,{' '}
              <em className="text-brand-ink">bize yaz</em>.
            </h2>
            <p className="text-ink-72 mb-6 max-w-md mx-auto leading-relaxed">
              Mümkün olduğunca hızlı dönüş yapıyoruz.
            </p>
            <a
              href="mailto:kasheofficial@gmail.com"
              className="kashe-tap inline-flex items-center gap-2 px-6 py-3 bg-brand-ink text-paper rounded-xl font-display font-semibold text-sm hover:bg-brand-ink-deep transition shadow-[3px_3px_0_var(--color-brand-ink-12)]"
            >
              kasheofficial@gmail.com
              <span>→</span>
            </a>
          </div>
        </div>
      </main>
    </>
  );
}

// Tek grup — başlık + akordeon liste
function YardimGrup({ group }: { group: FaqGroup }) {
  return (
    <section id={group.id} className="scroll-mt-20">
      <div className="mb-6">
        <Eyebrow variant="inline" className="mb-2">
          {group.eyebrow}
        </Eyebrow>
        <h2 className="font-display font-medium text-2xl md:text-3xl text-ink tracking-tight leading-tight">
          {group.title}
        </h2>
      </div>

      <div className="space-y-3">
        {group.questions.map((qa, i) => (
          <details
            key={i}
            className="group bg-card border border-line rounded-2xl overflow-hidden transition-colors hover:border-brand-ink/40"
          >
            <summary className="kashe-tap flex items-center justify-between gap-4 cursor-pointer px-5 py-4 list-none">
              <div className="flex items-start gap-3 min-w-0">
                <span className="font-mono text-[10px] tabular-nums text-brand-ink tracking-[0.14em] mt-1 shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="font-display font-medium text-base text-ink leading-snug">
                  {qa.q}
                </p>
              </div>
              <span
                className="shrink-0 w-7 h-7 rounded-full border border-line group-open:border-brand-ink group-open:bg-brand-ink group-open:text-paper transition-all flex items-center justify-center"
                aria-hidden="true"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="group-open:rotate-45 transition-transform"
                >
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </summary>
            <div className="px-5 pb-5 -mt-1">
              <div className="pl-9 pr-2 text-[15px] text-ink-72 leading-relaxed whitespace-pre-line">
                {qa.a}
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
