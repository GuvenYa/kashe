import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/app/components/sections/top-nav';
import { DuzenleForm } from './duzenle-form';
import { orderCities } from '@/app/lib/city-order';
import type { Profile, Service, TurkishCity, ServiceCategory } from '@/app/lib/types';
import Link from 'next/link';
import { DurumKarti } from '@/app/components/panel/durum-karti';
import { VurguEtiketi } from '@/app/components/ui/vurgu-etiketi';
import {
  getCompletenessPercent,
  getMissingPublishFields,
} from '@/app/lib/profile-helpers';
import { fetchOwnProfile } from '@/app/lib/own-profile';

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
    fetchOwnProfile(supabase, user.id), // select('*') değil — PII adım 2b
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

  /**
   * PROFIL TAMLIGI (Duzeltme 24-B; gorsel dil). Paneldeki kartla AYNI kaynak
   * (`getCompletenessPercent`, `getMissingPublishFields`). Profesyonelde
   * "en az 1 aktif hizmet" kurali icin hizmetlerin yalniz etkinlik bayragi
   * okunur (tek kucuk sorgu); diger rollerde sorgu yok.
   */
  const p = profile as Profile;
  let hizmetler: Service[] = [];
  if (p.role === 'professional') {
    const { data: hizmetData } = await supabase
      .from('services')
      .select('id, is_active')
      .eq('provider_id', user.id);
    hizmetler = (hizmetData ?? []) as unknown as Service[];
  }
  const tamlik = getCompletenessPercent(p, hizmetler);
  const eksikler = getMissingPublishFields(p, hizmetler);

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <VurguEtiketi>Profil düzenle</VurguEtiketi>
            <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight mt-3">
              Bilgilerini{' '}
              <em className="not-italic font-medium text-brand-accent">
                güncelle
              </em>
              .
            </h1>
          </div>

          {tamlik < 100 && (
            <div className="mb-8">
              <DurumKarti
                baslik="Profilini tamamla"
                tamam={false}
                ilerleme={tamlik}
                satirlar={eksikler.map((alan) => ({
                  tamam: false,
                  metin: alan.toLocaleLowerCase('tr').includes('hizmet') ? (
                    <Link
                      href="/profil/hizmetlerim"
                      className="kashe-tap hover:text-brand-ink transition-colors"
                    >
                      {alan}
                      <span className="text-brand-ink"> · Hizmetlerim →</span>
                    </Link>
                  ) : (
                    alan
                  ),
                }))}
                kutular={[
                  { etiket: 'Tamlık', deger: `%${tamlik}` },
                  { etiket: 'Eksik', deger: eksikler.length },
                ]}
              />
            </div>
          )}

          <DuzenleForm
            profile={p}
            cities={orderCities((cities || []) as TurkishCity[])}
            categories={(categories || []) as ServiceCategory[]}
          />
        </div>
      </main>
    </>
  );
}