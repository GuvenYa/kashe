import Image from 'next/image'

/**
 * Bakim kapisindaki vitrin sayfasi (proxy.ts, NEXT_PUBLIC_BAKIM_MODU).
 * Urun kapali kalir; buraya bakan bir dogrulayici Kashe'nin ne oldugunu,
 * nerede oldugunu ve nasil ulasacagini gorebilir. Onizleme cerezi ve
 * BAKIM_ANAHTARI mantigina dokunulmaz.
 */
const OZET_EN =
  'Kashe is an AI-powered marketplace and operations platform for the event and creative-services industry. Based in Istanbul, Turkiye. Founded 2026.'

export const metadata = {
  title: 'Kashe — Etkinlik sektörü için yapay zeka destekli pazaryeri',
  description:
    "Kashe, etkinlik ve yaratıcı hizmet sektörü için yapay zeka destekli pazaryeri ve operasyon platformudur. İstanbul merkezli, 2026'da kuruldu.",
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Kashe — Etkinlik sektörü için yapay zeka destekli pazaryeri',
    description: OZET_EN,
  },
}

export default function Yakinda() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-card">
      <div className="max-w-xl text-center">
        {/* Logo işaret ve "kashe" yazısını tek görselde taşıyor; ayrı bir h1 tekrar olurdu */}
        <Image
          src="/kashe-lockup.png"
          alt="Kashe"
          width={144}
          height={55}
          preload
          className="mx-auto"
        />

        <p className="mt-8 font-display text-xl md:text-2xl text-ink leading-snug">
          Etkinlik ve yaratıcı hizmet sektörü için yapay zeka destekli
          pazaryeri ve operasyon platformu
        </p>

        <p className="mt-6 text-base text-ink-72 leading-relaxed">
          Kashe; hizmet alan bireyleri ve kurumları, bağımsız profesyonelleri
          ve organizasyon firmalarını tek platformda buluşturur. Serbest
          metinle anlatılan etkinlik ihtiyacını yapılandırır, uygun
          profesyonelleri getirir ve çok rollü ekipleri bütçe, tarih ve
          müsaitlik kısıtları altında kurar.
        </p>

        <p className="mt-6 text-base text-ink">
          Platform şu anda özel önizlemede. Genel kullanıma yakında açılacak.
        </p>

        <p className="mt-10 text-sm text-ink-72">Görüş ve önerileriniz için</p>
        <a
          href="mailto:info@kashe.net"
          className="mt-1 inline-block text-base font-medium text-ink underline underline-offset-4"
        >
          info@kashe.net
        </a>

        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-72">
          İstanbul, Türkiye · 2026
        </p>

        {/* Dogrulama icin Ingilizce ozet; "Turkiye" bilerek sapkasiz */}
        <p className="mt-10 pt-6 border-t border-line text-xs text-ink-72 leading-relaxed">
          {OZET_EN} Currently in private preview. Contact: info@kashe.net
        </p>
      </div>
    </main>
  )
}
