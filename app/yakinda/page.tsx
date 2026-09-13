import Image from 'next/image'

export const metadata = {
  title: 'Kashe — Yakında',
  description: 'Etkinlik sektörü için yapay zeka destekli yetenek eşleştirme platformu.',
  robots: { index: false, follow: false },
}

export default function Yakinda() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-card">
      <div className="max-w-md text-center">
        {/* Logo işaret ve "kashe" yazısını tek görselde taşıyor; ayrı bir h1 tekrar olurdu */}
        <Image
          src="/kashe-lockup.png"
          alt="Kashe"
          width={144}
          height={55}
          preload
          className="mx-auto"
        />
        <p className="mt-8 text-lg text-ink">
          Kashe çok yakında yayında...
        </p>
        <p className="mt-10 text-sm text-ink-72">
          Görüş ve önerileriniz için
        </p>
        <a
          href="mailto:info@kashe.net"
          className="mt-1 inline-block text-base font-medium text-ink underline underline-offset-4"
        >
          info@kashe.net
        </a>
      </div>
    </main>
  )
}
