import Link from 'next/link';

export function SifreSifirlaInvalid() {
  return (
    <div className="text-center">
      <Link href="/" className="inline-block mb-8">
        <div className="flex items-center justify-center gap-2">
          <div className="w-10 h-10 bg-terracotta rounded flex items-center justify-center">
            <span className="font-serif text-paper text-xl font-bold">k</span>
          </div>
          <span className="font-serif text-ink text-2xl font-bold">Kashe</span>
        </div>
      </Link>

      <h1 className="font-display text-3xl text-ink mb-4 tracking-tight">
        Bağlantı geçersiz.
      </h1>
      <p className="text-ink-72 leading-relaxed mb-8">
        Şifre sıfırlama bağlantın geçersiz veya süresi dolmuş olabilir.
        Bağlantılar tek kullanımlık ve 1 saat içinde geçerlidir. Yeni bir
        sıfırlama isteği gönder.
      </p>

      <Link
        href="/sifremi-unuttum"
        className="inline-block px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
      >
        Yeni bağlantı iste
      </Link>
    </div>
  );
}