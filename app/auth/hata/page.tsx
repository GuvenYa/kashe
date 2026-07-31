import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { BrandMark } from '@/app/components/ui/brand-mark';

export const metadata = {
  title: 'Bağlantı doğrulanamadı — Kashe',
  description: 'E-posta bağlantısı doğrulanamadı.',
  robots: { index: false, follow: false },
};

type Cta = { label: string; href: string };

type Content = {
  title: string;
  body: string;
  primary: Cta;
  secondary?: Cta;
};

/**
 * /auth/confirm hatalarını 4 duruma ayırır.
 *
 * ÖNEMLİ: "süresi dolmuş" · "zaten kullanılmış" · "e-posta zaten doğrulanmış" üçü
 * SUNUCUDA AYIRT EDİLEMİYOR — verifyOtp üçüne de aynı hatayı döndürüyor ve elde
 * kullanıcının e-postası yok (linkte taşınmıyor). Bu yüzden signup durumunda üçü TEK
 * ekranda birleştirilip iki çıkış birden sunuluyor; metin kesinlik iddia etmiyor.
 *
 * Süre: Dashboard'daki Email OTP ömrü 3600s olarak DOĞRULANDI → metinlerde "1 saat".
 * Kesinlik kuralı bozulmuyor: süre kesin, "kullanılmış OLABİLİR" belirsizliği duruyor.
 */
function resolve(type: string | undefined, reason: string | undefined): Content {
  const girisYap: Cta = { label: 'Giriş yap', href: '/giris' };

  // 3 — Parametre eksik/bozuk ya da bilinmeyen tip (allowlist dışı).
  if (reason === 'invalid') {
    return {
      title: 'Bağlantı doğrulanamadı.',
      body: 'Bağlantı eksik ya da bozuk görünüyor. E-postadaki bağlantıyı tam olarak açtığından emin ol, sonra tekrar dene.',
      primary: girisYap,
    };
  }

  // 2 — Şifre sıfırlama: süresi dolmuş / kullanılmış.
  if (type === 'recovery') {
    return {
      title: 'Şifre sıfırlama bağlantısı kullanılamadı.',
      body: 'Bu bağlantı tek kullanımlık ve 1 saat geçerli. Daha önce kullanılmış ya da süresi dolmuş olabilir. Yeni bir sıfırlama bağlantısı iste.',
      primary: { label: 'Yeni bağlantı iste', href: '/sifremi-unuttum' },
      secondary: girisYap,
    };
  }

  // 1 — Kayıt onayı: süresi dolmuş / kullanılmış / zaten doğrulanmış (BİRLEŞİK).
  if (type === 'signup') {
    return {
      title: 'Doğrulama bağlantısı kullanılamadı.',
      body: 'Bu bağlantı tek kullanımlık ve 1 saat geçerli. Daha önce kullanılmış ya da süresi dolmuş olabilir — e-postan çoktan doğrulanmış da olabilir. Önce giriş yapmayı dene; olmazsa yeni bir doğrulama e-postası iste.',
      primary: girisYap,
      // resend=1 → /giris'te YALNIZ "yeniden gönder" arayüzünü açar, hata metni BASMAZ.
      // (?error= kullanılmıyordu: kullanıcı üst üste iki hata ekranı görürdü, üstelik o
      // metin PKCE'ye özgü "aynı tarayıcı" uyarısı taşıyor — token_hash akışında yanlış.)
      secondary: {
        label: 'Yeni doğrulama e-postası',
        href: '/giris?resend=1',
      },
    };
  }

  // 4 — Bilinmeyen / teknik.
  return {
    title: 'Bağlantı doğrulanamadı.',
    body: 'Beklenmedik bir sorun oluştu. Tekrar dene; sürerse bize yaz.',
    primary: girisYap,
    secondary: { label: 'Yardım', href: '/yardim' },
  };
}

export default async function AuthHataPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; reason?: string }>;
}) {
  const { type, reason } = await searchParams;
  const { title, body, primary, secondary } = resolve(type, reason);

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <div className="inline-block mb-8">
            <BrandMark size="lg" />
          </div>

          <h1 className="font-display text-3xl text-ink mb-4 tracking-tight">
            {title}
          </h1>
          <p className="text-ink-72 leading-relaxed mb-8">{body}</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={primary.href}
              className="w-full sm:w-auto inline-block px-6 py-3 bg-gradient-brand text-white rounded-lg font-display font-semibold hover:shadow-[0_10px_28px_-8px_rgba(4,13,38,0.5)] transition-all"
            >
              {primary.label}
            </Link>
            {secondary && (
              <Link
                href={secondary.href}
                className="w-full sm:w-auto inline-block px-6 py-3 border border-line-strong text-ink rounded-lg font-display font-semibold hover:border-brand-ink hover:text-brand-ink transition-colors"
              >
                {secondary.label}
              </Link>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
