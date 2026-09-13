export const metadata = {
  title: 'Kashe — Yakında',
  description: 'Etkinlik sektörü için yapay zeka destekli yetenek eşleştirme platformu.',
  robots: { index: false, follow: false },
}

export default function Yakinda() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-white">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
          Kashe
        </h1>
        <p className="mt-6 text-lg text-neutral-600">
          Etkinlik sektörü için yapay zeka destekli yetenek eşleştirme
          platformu çok yakında yayında.
        </p>
        <p className="mt-8 text-sm text-neutral-500">
          Görüş ve önerileriniz için
        </p>
        
          href="mailto:info@kashe.net"
          className="mt-1 inline-block text-base font-medium text-neutral-900 underline underline-offset-4"
        >
          info@kashe.net
        </a>
      </div>
    </main>
  )
}