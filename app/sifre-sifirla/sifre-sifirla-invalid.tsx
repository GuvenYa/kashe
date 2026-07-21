import Link from 'next/link';
import { BrandMark } from '@/app/components/ui/brand-mark';

export function SifreSifirlaInvalid() {
  return (
    <div className="text-center">
      <div className="inline-block mb-8">
        <BrandMark size="lg" />
      </div>

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
        className="inline-block px-6 py-3 bg-gradient-brand text-white rounded-lg font-display font-semibold hover:shadow-[0_10px_28px_-8px_rgba(4,13,38,0.5)] transition-all"
      >
        Yeni bağlantı iste
      </Link>
    </div>
  );
}