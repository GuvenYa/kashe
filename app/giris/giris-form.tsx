'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-browser';
import { BrandMark } from '@/app/components/ui/brand-mark';

function translateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email veya şifre hatalı.';
  if (m.includes('email not confirmed'))
    return 'Email adresini henüz doğrulamadın. Gelen kutunu kontrol et.';
  if (m.includes('too many requests'))
    return 'Çok fazla deneme yaptın. Birkaç dakika sonra tekrar dene.';
  if (m.includes('user not found'))
    return 'Bu email ile kayıtlı bir hesap bulunamadı.';
  if (m.includes('network')) return 'Bağlantı hatası. İnternetini kontrol et.';
  return message;
}

export default function GirisForm({
  redirectTo = '/profil',
}: {
  redirectTo?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [showSifre, setShowSifre] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setHata(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: sifre,
    });

    if (error) {
      setHata(translateError(error.message));
      setLoading(false);
      return;
    }

    // Suspension kontrolü — askıdaki kullanıcı /askiya-alindi'ya yönlendirilir
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('suspended_at')
        .eq('id', data.user.id)
        .single();

      if (profile?.suspended_at) {
        router.push('/askiya-alindi');
        router.refresh();
        return;
      }
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div>
      <div className="text-center mb-10">
        <div className="inline-block mb-8">
          <BrandMark size="lg" />
        </div>
        <h1 className="font-display font-semibold text-3xl md:text-4xl text-ink mb-3">
          Tekrar <em>hoş geldin</em>.
        </h1>
        <p className="text-ink-72">Hesabına giriş yap ve devam et.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-mono uppercase tracking-wider text-ink-50 mb-2"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-32 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
            placeholder="seninadin@email.com"
            autoComplete="email"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="sifre"
              className="block text-xs font-mono uppercase tracking-wider text-ink-50"
            >
              Şifre
            </label>
            <Link
              href="/sifremi-unuttum"
              className="text-sm text-terracotta hover:underline"
            >
              Şifremi unuttum
            </Link>
          </div>
          <div className="relative">
            <input
              id="sifre"
              type={showSifre ? 'text' : 'password'}
              required
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              className="w-full px-4 py-3 pr-12 bg-card border border-line rounded-lg text-ink placeholder:text-ink-32 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
              placeholder="••••••••"
              autoComplete="current-password"
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
        </div>

        {hata && (
          <div className="px-4 py-3 bg-danger-08 border border-danger/30 rounded-lg text-sm text-danger">
            {hata}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3.5 bg-terracotta text-white rounded-lg font-display font-semibold hover:bg-ember disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
        </button>
      </form>

      <p className="text-center text-sm text-ink-50 mt-8">
        Hesabın yok mu?{' '}
        <Link href="/uye-ol" className="text-terracotta hover:underline font-medium">
          Üye ol
        </Link>
      </p>
    </div>
  );
}