'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-browser';

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

    setSuccess(true);
    setLoading(false);

    setTimeout(() => {
      router.push('/profil');
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
        <p className="text-ink-72">Profilime yönlendiriliyorsun...</p>
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
          Yeni{' '}
          <em className="text-terracotta not-italic italic font-medium">
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
          <input
            id="sifre"
            type="password"
            required
            minLength={8}
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
            placeholder="••••••••"
            autoComplete="new-password"
          />
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
          <input
            id="sifre-tekrar"
            type="password"
            required
            minLength={8}
            value={sifreTekrar}
            onChange={(e) => setSifreTekrar(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
            placeholder="••••••••"
            autoComplete="new-password"
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
          {loading ? 'Kaydediliyor...' : 'Şifreyi güncelle'}
        </button>
      </form>
    </div>
  );
}