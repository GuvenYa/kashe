import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { PortfolioUpload } from './portfolio-upload';
import { PortfolioItemCard } from './portfolio-item-card';
import { isProfessional } from '@/app/lib/profile-helpers';
import type { Profile, PortfolioItem } from '@/app/lib/types';

export const metadata = {
  title: 'Portföyüm — Kashe',
};

const MAX_PORTFOLIO_ITEMS = 24;

export default async function PortfoyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris?redirect=/profil/portfoy');
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

  if (!isProfessional(profile)) {
    redirect('/profil');
  }

  const { data: itemsData } = await supabase
    .from('portfolio_items')
    .select('*')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false });

  const items = (itemsData || []) as PortfolioItem[];

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <Link
              href="/profil"
              className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors inline-flex items-center gap-1.5 mb-3"
            >
              ← Profilime dön
            </Link>
            <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
              <em className="text-terracotta not-italic italic font-medium">
                Portföyüm
              </em>
            </h1>
            <p className="text-ink-72 mt-3 max-w-xl">
              Önceki işlerinden fotoğraf ve videolar ekle. Müşteriler profil
              sayfanda bu galeriyi görecek.
            </p>
          </div>

          <div className="mb-8">
            <PortfolioUpload
              userId={user.id}
              currentCount={items.length}
              maxItems={MAX_PORTFOLIO_ITEMS}
            />
          </div>

          {items.length === 0 ? (
            <div className="bg-card border border-line rounded-lg p-12 text-center">
              <p className="font-display text-2xl text-ink mb-3">
                İlk işini yükle.
              </p>
              <p className="text-ink-72 max-w-md mx-auto">
                Önceki etkinliklerinden, sahne performanslarından, projelerinden
                en güzel kareleri ve videoları ekle.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => (
                <PortfolioItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}