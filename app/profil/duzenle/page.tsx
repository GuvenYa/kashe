import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/app/components/sections/top-nav';
import { DuzenleForm } from './duzenle-form';
import { orderCities } from '@/app/lib/city-order';
import type { Profile, TurkishCity, ServiceCategory } from '@/app/lib/types';

export const metadata = {
  title: 'Profili düzenle — Kashe',
};

export default async function ProfilDuzenlePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris?redirect=/profil/duzenle');
  }

  const [{ data: profile }, { data: cities }, { data: categories }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('turkish_cities').select('*').order('name'),
    supabase
      .from('service_categories')
      .select('*')
      .eq('is_active', true)
      .order('name_tr'),
  ]);

  if (!profile) {
    redirect('/giris');
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
              Profil düzenle
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
              Bilgilerini{' '}
              <em className="text-terracotta not-italic italic font-medium">
                güncelle
              </em>
              .
            </h1>
          </div>

          <DuzenleForm
            profile={profile as Profile}
            cities={orderCities((cities || []) as TurkishCity[])}
            categories={(categories || []) as ServiceCategory[]}
          />
        </div>
      </main>
    </>
  );
}