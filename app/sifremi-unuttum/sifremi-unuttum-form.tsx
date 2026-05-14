'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-browser';

function translateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Çok fazla deneme yaptın. Birkaç dakika sonra tekrar dene.';
  if (m.includes('invalid email')) return 'Geçerli bir email adresi gir.';
  if (m.includes('network')) return 'Bağlantı hatası. İnternetini kontrol et.';
  return message;
}

export function SifremiUnuttumForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setHata(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/sifre-sifirla`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      setHata(translateError(error.message));
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
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

        <div className="inline-flex px-4 py-1.5 rounded-full border border-terracotta/30 mb-6">
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta">
            + Email gönderildi
          </span>
        </div>

        <h1 className="font-display text-3xl md:text-4xl text-ink mb-4 tracking-tight">
          Gelen kutunu{' '}
          <em className="text-terracotta not-italic italic font-medium">
            kontrol et
          </em>
          .
        </h1>

        <p className="text-ink-72 leading-relaxed mb-2">
          <span className="text-ink font-medium">{email}</span> adresine şifre
          sıfırlama bağlantısı gönderdik.
        </p>
        <p className="text-ink-72 text-sm leading-relaxed mb-8">
          Emaildeki butona tıklayarak yeni şifreni belirleyebilirsin.
        </p>

        <p className="text-xs text-ink-72/70">
          Email gelmediyse spam klasörünü kontrol et.
        </p>

        <div className="mt-8 pt-8 border-t border-line">
          <Link
            href="/giris"
            className="text-sm text-terracotta hover:underline font-medium"
          >
            ← Giriş sayfasına dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-10">
        <Link href="/" className="inline-block mb-8">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 bg-terracotta rounded flex items-center justify-center">
              <span className="font-serif text-paper text-xl font-bold">k</span>
            </div>
            <span className="font-serif text-ink text-2xl font-bold">Kashe</span>
          </div>
        </Link>
        <h1 className="font-display text-3xl md:text-4xl text-ink mb-3 tracking-tight">
          Şifreni{' '}
          <em className="text-terracotta not-italic italic font-medium">
            sıfırla
          </em>
          .
        </h1>
        <p className="text-ink-72">
          Email adresini gir, sana sıfırlama bağlantısı yollayalım.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
            placeholder="seninadin@email.com"
            autoComplete="email"
          />
        </div>

        {hata && (
          <div className="px-4 py-3 bg-terracotta/10 border border-terracotta/30 rounded-lg text-sm text-terracotta">
            {hata}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3.5 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Gönderiliyor...' : 'Sıfırlama bağlantısı gönder'}
        </button>
      </form>

      <p className="text-center text-sm text-ink-72 mt-8">
        Şifreni hatırladın mı?{' '}
        <Link
          href="/giris"
          className="text-terracotta hover:underline font-medium"
        >
          Giriş yap
        </Link>
      </p>
    </div>
  );
}