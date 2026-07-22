import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';

export const metadata = {
  title: 'Fiyatlandırma — Kashe',
  description:
    "Kashe premium profil paketleri ve ilan öne çıkarma fiyatları. Lansmana özel 6 ay ücretsiz.",
};

// Premium profil paketleri (doküman 12.2)
const PLANS = [
  {
    key: 'standard',
    name: 'Standart',
    price: 'Ücretsiz',
    period: '',
    highlight: false,
    features: [
      'Temel profil',
      'Sınırlı portföy',
      'Standart listelenme',
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    price: '499 TL',
    period: '/ ay',
    highlight: true,
    features: [
      'Arama sonuçlarında öne çıkma',
      'Daha geniş portföy',
      'Profil istatistikleri',
      'Premium rozeti',
    ],
  },
  {
    key: 'plus',
    name: 'Profesyonel Plus',
    price: '999 TL',
    period: '/ ay',
    highlight: false,
    features: [
      'Premium\'un tüm özellikleri',
      'Daha fazla ilan başvurusu',
      'Kategori vitrini',
      'Gelişmiş görünürlük',
    ],
  },
  {
    key: 'agency',
    name: 'Ajans Paketi',
    price: '1.999 TL',
    period: '/ ay',
    highlight: false,
    features: [
      'Çoklu profil yönetimi',
      'Ekip ve portföy alanı',
      'Paket hizmet sunumu',
      'Ajans rozeti',
    ],
  },
];

// İlan öne çıkarma (doküman 12.3)
const BOOSTS = [
  {
    name: 'Acil İlan Etiketi',
    price: '199 TL',
    desc: 'İlanının üzerinde dikkat çeken acil ihtiyaç etiketi.',
  },
  {
    name: 'Kategori Üst Sıra',
    price: '399 TL',
    desc: 'İlanın ilgili kategoride üst sıralarda gösterilir.',
  },
  {
    name: 'Ana Sayfa Vitrini',
    price: '999 TL',
    desc: 'Belirli bir süre ana sayfada öne çıkarılır.',
  },
  {
    name: 'Profesyonellere Bildirim',
    price: '299 TL',
    desc: 'İlgili kategorideki profesyonellere e-posta ile haber verilir.',
  },
];

function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0 mt-0.5 text-moss"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5 12l4 4 10-10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FiyatlandirmaPage() {
  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper">
        {/* HERO */}
        <section className="border-b border-line">
          <div className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-24 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-ink mb-4">
              Fiyatlandırma
            </p>
            <h1 className="font-display font-semibold text-4xl md:text-6xl text-ink tracking-tight leading-[1.05]">
              Görünürlüğünü{' '}
              <em className="text-brand-ink not-italic italic font-medium">
                büyüt
              </em>
              .
            </h1>
            <p className="text-ink-72 text-lg mt-5 max-w-2xl mx-auto leading-relaxed">
              Kashe&apos;de profil oluşturmak her zaman ücretsiz. Daha fazla
              görünürlük ve özellik isteyenler için premium paketler.
            </p>

            {/* Kampanya rozeti */}
            <div className="inline-flex items-center gap-2 mt-7 px-4 py-2 rounded-full bg-[#F4E9C8] border border-[#D9C179] text-[#8A6D1F]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <span className="font-display font-semibold text-sm">
                Lansmana özel: tüm premium paketler 6 ay ücretsiz
              </span>
            </div>
          </div>
        </section>

        {/* PREMIUM PAKETLER */}
        <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-2xl p-6 transition-all ${
                  plan.highlight
                    ? 'bg-card border-2 border-[#D9C179] ring-1 ring-[#D9C179]/40 shadow-[0_18px_40px_-20px_rgba(138,109,31,0.30)]'
                    : 'bg-card border border-line'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#8A6D1F] bg-[#F4E9C8] border border-[#D9C179] px-3 py-1 rounded-full">
                    En popüler
                  </span>
                )}
                <h3 className="font-display text-xl text-ink mb-1">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="font-display text-3xl text-ink font-medium">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-ink-72">{plan.period}</span>
                  )}
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-ink-72"
                    >
                      <Check />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={
                    plan.key === 'agency'
                      ? '/uye-ol/ajans'
                      : '/uye-ol?rol=profesyonel'
                  }
                  className={`inline-flex items-center justify-center px-4 py-2.5 rounded-lg font-display font-semibold text-sm transition-all ${
                    plan.highlight
                      ? 'bg-brand-ink text-paper hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)]'
                      : 'border border-ink text-ink hover:bg-ink hover:text-paper'
                  }`}
                >
                  {plan.key === 'standard' ? 'Ücretsiz başla' : 'Üye ol'}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-ink-72 mt-6">
            Tüm fiyatlara KDV dahil değildir. Lansman kampanyası boyunca premium
            özellikler ücretsiz sunulur.
          </p>
        </section>

        {/* İLAN ÖNE ÇIKARMA */}
        <section className="border-t border-line bg-card">
          <div className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-20">
            <div className="text-center mb-12">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-ink mb-3">
                İlan öne çıkarma
              </p>
              <h2 className="font-display font-semibold text-3xl md:text-4xl text-ink tracking-tight">
                İlanını{' '}
                <em className="text-brand-ink not-italic italic font-medium">
                  öne çıkar
                </em>
              </h2>
              <p className="text-ink-72 mt-3 max-w-xl mx-auto">
                Tek seferlik öne çıkarma seçenekleriyle ilanın daha fazla
                profesyonele ulaşsın.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BOOSTS.map((boost) => (
                <div
                  key={boost.name}
                  className="flex items-start justify-between gap-4 bg-card border border-line rounded-xl p-5"
                >
                  <div className="min-w-0">
                    <h3 className="font-display text-lg text-ink">
                      {boost.name}
                    </h3>
                    <p className="text-sm text-ink-72 mt-1 leading-relaxed">
                      {boost.desc}
                    </p>
                  </div>
                  <span className="font-display text-lg text-brand-ink font-medium shrink-0">
                    {boost.price}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* KOMİSYON NOTU */}
        <section className="max-w-3xl mx-auto px-6 md:px-12 py-14 text-center">
          <p className="text-ink-72 leading-relaxed">
            Kashe üzerinden gerçekleşen rezervasyonlarda, hizmet bedeli üzerinden{' '}
            <span className="text-ink font-medium">%10 komisyon</span> alınır.
            Profil oluşturmak ve teklif almak ücretsizdir.
          </p>
        </section>

        {/* CTA */}
        <section className="border-t border-line bg-card">
          <div className="max-w-4xl mx-auto px-6 md:px-12 py-16 text-center">
            <h2 className="font-display font-semibold text-3xl md:text-4xl text-ink tracking-tight">
              Sahnede{' '}
              <em className="text-brand-ink not-italic italic font-medium">
                yerini al
              </em>
            </h2>
            <p className="text-ink-72 mt-3 max-w-xl mx-auto">
              Profilini oluştur, lansman kampanyasıyla premium özellikleri 6 ay
              ücretsiz dene.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
              <Link
                href="/uye-ol?rol=profesyonel"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
              >
                Ücretsiz üye ol
              </Link>
              <Link
                href="/kesfet"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-transparent border border-ink text-ink rounded-lg font-display font-semibold text-sm hover:bg-ink hover:text-paper transition-all"
              >
                Profesyonelleri keşfet
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
