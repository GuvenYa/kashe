import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { isProfessional } from '@/app/lib/profile-helpers';
import { getCategoryFields, type ProfileExperience } from '@/app/lib/category-fields';
import { DeneyimClient } from './deneyim-client';
import type { Profile } from '@/app/lib/types';

export const metadata = {
  title: 'Deneyim & Eğitim — Kashe',
};

export default async function DeneyimPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/giris?redirect=/profil/deneyim');
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*, service_categories!profiles_primary_category_id_fkey(slug)')
    .eq('id', user.id)
    .single();
  if (!profileData) {
    redirect('/giris');
  }
  const profile = profileData as Profile & {
    service_categories: { slug: string } | null;
  };
  // Yalnız profesyonel — diğer roller /profil'e döner
  if (!isProfessional(profile)) {
    redirect('/profil');
  }

  const { data: expData } = await supabase
    .from('profile_experiences')
    .select('*')
    .eq('profile_id', user.id)
    .order('kind', { ascending: true })
    .order('sort_order', { ascending: true });
  const experiences = (expData ?? []) as ProfileExperience[];

  const preset = getCategoryFields(profile.service_categories?.slug ?? null);
  const workGroups = preset?.experienceGroups ?? [];
  const archetype = preset?.archetype ?? null;

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
                Deneyim &amp; Eğitim
              </em>
            </h1>
            <p className="text-ink-72 mt-3 max-w-xl">
              İş deneyimlerin, eğitimlerin ve ödüllerin profilinde kronolojik
              olarak görünür. Her bölümü ekle, düzenle ve sırala.
            </p>
          </div>

          <DeneyimClient
            experiences={experiences}
            workGroups={workGroups}
            archetype={archetype}
          />
        </div>
      </main>
    </>
  );
}
