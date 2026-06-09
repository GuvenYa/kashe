import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { HizmetlerimClient } from './hizmetlerim-client';
import { isProfessional } from '@/app/lib/profile-helpers';
import type {
  Profile,
  ServiceCategory,
  ServiceWithCategory,
} from '@/app/lib/types';

export const metadata = {
  title: 'Hizmetlerim — Kashe',
};

export default async function HizmetlerimPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris');
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

  const [{ data: services }, { data: categories }] = await Promise.all([
    supabase
      .from('services')
      .select('*, service_categories(name_tr, emoji)')
      .eq('profile_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('service_categories')
      .select('*')
      .eq('is_active', true)
      .order('name_tr'),
  ]);

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="mb-10">
            <Link
              href="/profil"
              className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors inline-flex items-center gap-1.5 mb-3"
            >
              ← Profilime dön
            </Link>
            <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
              <em className="text-terracotta not-italic italic font-medium">
                Hizmetlerim
              </em>
            </h1>
            <p className="text-ink-72 mt-3 max-w-xl">
              Sunduğun her hizmeti ayrı bir kalem olarak ekle. Müşteriler
              keşfet sayfasında bu hizmetleri görecek.
            </p>
          </div>

          <HizmetlerimClient
            services={(services || []) as ServiceWithCategory[]}
            categories={(categories || []) as ServiceCategory[]}
            primaryCategoryId={profile.primary_category_id}
          />
        </div>
      </main>
    </>
  );
}