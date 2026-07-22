import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { PaketlerClient } from './paketler-client';
import { isProfessional } from '@/app/lib/profile-helpers';
import type { Profile, ServicePackage } from '@/app/lib/types';

export const metadata = {
  title: 'Paketlerim — Kashe',
};

export default async function PaketlerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris?redirect=/profil/paketler');
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profileData) {
    redirect('/giris');
  }

  const profile = profileData as Profile;

  // Sadece profesyoneller bu sayfaya erişebilir
  if (!isProfessional(profile)) {
    redirect('/profil');
  }

  const { data: packages } = await supabase
    .from('service_packages')
    .select('*')
    .eq('profile_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="mb-10">
            <Link
              href="/profil"
              className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-brand-ink transition-colors inline-flex items-center gap-1.5 mb-3"
            >
              ← Profilime dön
            </Link>
            <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
              <em className="text-brand-ink not-italic italic font-medium">
                Paketlerim
              </em>
            </h1>
            <p className="text-ink-72 mt-3 max-w-xl">
              Birden çok hizmetini tek bir pakette topla. Müşteriler profilinde
              bu paketleri görüp doğrudan iletişime geçebilir.
            </p>
          </div>

          <PaketlerClient packages={(packages || []) as ServicePackage[]} />
        </div>
      </main>
    </>
  );
}
