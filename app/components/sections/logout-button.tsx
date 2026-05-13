'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/app/lib/supabase-browser';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors disabled:opacity-50"
    >
      {loading ? 'Çıkılıyor...' : 'Çıkış yap'}
    </button>
  );
}