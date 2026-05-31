'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-browser';

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
        <Link href="/" className="inline-block mb-8">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 bg-[#C8442A] rounded flex items-center justify-center">
              <span className="font-serif text-[#FAF7F0] text-xl font-bold">k</span>
            </div>
            <span className="font-serif text-[#1A120E] text-2xl font-bold italic">Kashe</span>
          </div>
        </Link>
        <h1 className="font-serif text-3xl md:text-4xl text-[#1A120E] mb-3">
          Tekrar <em className="text-[#C8442A] not-italic italic font-medium">hoş geldin</em>.
        </h1>
        <p className="text-[#1A120E]/70">Hesabına giriş yap ve devam et.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-mono uppercase tracking-wider text-[#1A120E]/60 mb-2"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-[#1A120E]/15 rounded-lg text-[#1A120E] placeholder:text-[#1A120E]/30 focus:outline-none focus:border-[#C8442A] focus:ring-2 focus:ring-[#C8442A]/20 transition"
            placeholder="seninadin@email.com"
            autoComplete="email"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="sifre"
              className="block text-xs font-mono uppercase tracking-wider text-[#1A120E]/60"
            >
              Şifre
            </label>
            <Link
              href="/sifremi-unuttum"
              className="text-sm text-[#C8442A] hover:underline"
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
              className="w-full px-4 py-3 pr-12 bg-white border border-[#1A120E]/15 rounded-lg text-[#1A120E] placeholder:text-[#1A120E]/30 focus:outline-none focus:border-[#C8442A] focus:ring-2 focus:ring-[#C8442A]/20 transition"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowSifre((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A120E]/40 hover:text-[#1A120E]/70 transition-colors"
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
          <div className="px-4 py-3 bg-[#C8442A]/10 border border-[#C8442A]/30 rounded-lg text-sm text-[#C8442A]">
            {hata}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3.5 bg-[#C8442A] text-[#FAF7F0] rounded-lg font-medium hover:bg-[#a8381f] disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
        </button>
      </form>

      <p className="text-center text-sm text-[#1A120E]/60 mt-8">
        Hesabın yok mu?{' '}
        <Link href="/uye-ol" className="text-[#C8442A] hover:underline font-medium">
          Üye ol
        </Link>
      </p>
    </div>
  );
}