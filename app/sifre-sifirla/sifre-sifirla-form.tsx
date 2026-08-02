'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-browser';
import { BrandMark } from '@/app/components/ui/brand-mark';

function translateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('weak password') || m.includes('should be at least'))
    return 'Şifren en az 8 karakter olmalı, daha güçlü bir şifre seç.';
  if (m.includes('same as the old password') || m.includes('different from the old'))
    return 'Yeni şifre, eski şifreden farklı olmalı.';
  if (m.includes('pwned') || m.includes('breach') || m.includes('leaked'))
    return 'Bu şifre veri sızıntılarında geçiyor. Farklı bir şifre seç.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Çok fazla deneme. Birkaç dakika sonra tekrar dene.';
  if (m.includes('expired') || m.includes('invalid'))
    return 'Sıfırlama bağlantın geçersiz veya süresi doldu. Yeni bir sıfırlama isteği gönder.';
  if (m.includes('network')) return 'Bağlantı hatası. İnternetini kontrol et.';
  return message;
}

export function SifreSifirlaForm() {
  const router = useRouter();
  const [sifre, setSifre] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // İki alan için AYRI görünürlük durumu: kullanıcı yalnız birini açmak isteyebilir
  // (ör. tekrar alanını kontrol ederken ilkini gizli tutmak).
  const [showSifre, setShowSifre] = useState(false);
  const [showTekrar, setShowTekrar] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);

    if (sifre.length < 8) {
      setHata('Şifren en az 8 karakter olmalı.');
      return;
    }
    if (sifre !== sifreTekrar) {
      setHata('Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: sifre });

    if (error) {
      setHata(translateError(error.message));
      setLoading(false);
      return;
    }

    // Şifre değişti → OTURUMU KAPAT, kullanıcı yeni şifresiyle giriş yapsın.
    // Sıfırlama linki bir posta kutusundan gelir; o kutuya erişen biri şifreyi
    // değiştirip doğrudan oturum açabiliyordu. Giriş istemek kullanıcının şifreyi
    // gerçekten bildiğini doğrular. scope 'global': diğer cihazlardaki oturumlar da
    // düşer — parolası ele geçmiş bir hesapta saldırganın açık oturumu kalmasın.
    await supabase.auth.signOut({ scope: 'global' });

    setSuccess(true);
    setLoading(false);

    setTimeout(() => {
      router.push('/giris?sifirlandi=1');
      router.refresh();
    }, 1500);
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="inline-flex px-4 py-1.5 rounded-full border border-green-500/30 mb-6 bg-green-50">
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-green-700">
            ✓ Şifre güncellendi
          </span>
        </div>
        <h1 className="font-display text-3xl text-ink mb-3 tracking-tight">
          Hazırsın!
        </h1>
        <p className="text-ink-72">
          Güvenlik için tüm oturumlar kapatıldı. Giriş sayfasına
          yönlendiriliyorsun...
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-10">
        <div className="inline-block mb-8">
          <BrandMark size="lg" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-3 tracking-tight">
          Yeni{' '}
          <em className="text-brand-ink not-italic italic font-medium">
            şifreni
          </em>{' '}
          belirle.
        </h1>
        <p className="text-ink-72">
          Güçlü bir şifre seç ve aşağıya iki kez gir.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="sifre"
            className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2"
          >
            Yeni şifre
          </label>
          {/* Göster/gizle — /giris ve /uye-ol'daki kalıbın aynısı (relative sarmalayıcı
              + pr-12 input + mutlak konumlu type="button" göz düğmesi). */}
          <div className="relative">
            <input
              id="sifre"
              type={showSifre ? 'text' : 'password'}
              required
              minLength={8}
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              className="w-full px-4 py-3 pr-12 bg-card border border-line rounded-lg text-ink focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition"
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowSifre((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-32 hover:text-ink-72 transition-colors"
              aria-label={showSifre ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              {showSifre ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-ink-72 mt-1.5">
            En az 8 karakter, yaygın şifreleri kullanma.
          </p>
        </div>

        <div>
          <label
            htmlFor="sifre-tekrar"
            className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2"
          >
            Yeni şifre (tekrar)
          </label>
          <div className="relative">
            <input
              id="sifre-tekrar"
              type={showTekrar ? 'text' : 'password'}
              required
              minLength={8}
              value={sifreTekrar}
              onChange={(e) => setSifreTekrar(e.target.value)}
              className="w-full px-4 py-3 pr-12 bg-card border border-line rounded-lg text-ink focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition"
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowTekrar((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-32 hover:text-ink-72 transition-colors"
              aria-label={showTekrar ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              {showTekrar ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {hata && (
          <div className="px-4 py-3 bg-danger-08 border border-danger/30 rounded-lg text-sm text-danger">
            {hata}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3.5 bg-gradient-brand text-white rounded-lg font-display font-semibold hover:shadow-[0_10px_28px_-8px_rgba(4,13,38,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Kaydediliyor...' : 'Şifreyi güncelle'}
        </button>
      </form>
    </div>
  );
}