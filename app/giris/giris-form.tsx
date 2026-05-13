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

export default function GirisForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setHata(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: sifre,
    });

    if (error) {
      setHata(translateError(error.message));
      setLoading(false);
      return;
    }

    router.push('/profil');
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
            <span className="font-serif text-[#1A120E] text-2xl font-bold">Kashe</span>
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
          <input
            id="sifre"
            type="password"
            required
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-[#1A120E]/15 rounded-lg text-[#1A120E] placeholder:text-[#1A120E]/30 focus:outline-none focus:border-[#C8442A] focus:ring-2 focus:ring-[#C8442A]/20 transition"
            placeholder="••••••••"
            autoComplete="current-password"
          />
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