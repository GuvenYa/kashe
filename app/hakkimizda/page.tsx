import { TopNav } from '@/app/components/sections/top-nav';

export const metadata = {
  title: 'Hakkımızda — Kashe',
  description:
    "Kashe, etkinlik düzenleyenlerle sahne profesyonellerini doğrudan buluşturan Türkiye'nin etkinlik ve yetenek pazaryeri.",
};

type Section = { title: string; body: string; email?: string };

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
    title: 'Profesyoneller için',
    body: 'Kashe, yeteneğin vitrini: profilini aç, portfolyonu yükle, müşterin sana doğrudan ulaşsın. Emeğinin karşılığını aracısız al; yorumların ve çalışma geçmişin hep seninle.',
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
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta mb-4">
              Hakkımızda
            </p>
            <h1 className="font-display font-semibold text-4xl md:text-6xl text-ink tracking-tight leading-[1.05]">
              Etkinlik ve yeteneği{' '}
              <em className="text-terracotta not-italic font-medium">
                buluşturuyoruz
              </em>
              .
            </h1>
          </div>
        </section>

        {/* İÇERİK */}
        <section className="max-w-3xl mx-auto px-6 md:px-12 py-14 md:py-20">
          <div className="space-y-12">
            {SECTIONS.map((s) => (
              <div key={s.title}>
                <h2 className="font-display font-semibold text-2xl md:text-3xl text-ink tracking-tight mb-3">
                  {s.title}
                </h2>
                <p className="text-ink-72 text-lg leading-relaxed">
                  {s.body}
                  {s.email && (
                    <a
                      href={`mailto:${s.email}`}
                      className="text-terracotta font-medium hover:underline underline-offset-4"
                    >
                      {s.email}
                    </a>
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
