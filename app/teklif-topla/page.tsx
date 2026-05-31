import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { orderCities } from '@/app/lib/city-order';
import { TeklifToplaFormu } from './teklif-topla-formu';

export const metadata = {
  title: 'Teklif Topla — Kashe',
};

export default async function TeklifToplaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris?redirect=/teklif-topla');
  }

  // Rol + suspension kontrolü — sadece client/business teklif toplayabilir
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .single();

  // Suspension kontrolü
  if (profile?.suspended_at) redirect('/askiya-alindi');

  const role = profile?.role;
  if (role !== 'client' && role !== 'business') {
    return (
      <div className="bg-paper min-h-screen">
        <div className="max-w-2xl mx-auto px-6 md:px-12 py-20 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-4">
            Erişim yok
          </p>
          <h1 className="font-display text-4xl text-ink mb-3">
            Teklif toplamak için{' '}
            <em className="text-terracotta not-italic italic font-medium">
              müşteri
            </em>{' '}
            hesabı gerek
          </h1>
          <p className="text-ink-72 mb-8">
            Profesyonel ve ajans hesapları teklif talebi alır, oluşturamaz.
          </p>
          <Link
            href="/kesfet"
            className="inline-block px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
          >
            Profesyonelleri keşfet
          </Link>
        </div>
      </div>
    );
  }

  const [categoriesResult, citiesResult] = await Promise.all([
    supabase
      .from('service_categories')
      .select('id, slug, name_tr')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.from('turkish_cities').select('id, name').order('name'),
  ]);

  return (
    <div className="bg-paper min-h-screen">
      <div className="max-w-3xl mx-auto px-6 md:px-12 py-12">
        <header className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
            Teklif Topla
          </p>
          <h1 className="font-display text-4xl text-ink leading-tight">
            Birden fazla profesyonelden{' '}
            <em className="text-terracotta not-italic italic font-medium">
              özel teklif
            </em>{' '}
            al
          </h1>
          <p className="mt-3 text-ink-72 text-base max-w-2xl">
            İhtiyacını bir kez anlat, sistem uygun profesyonellere özel olarak
            iletsin. Talebin ilan tahtasında görünmez — sadece seçilen
            profesyoneller görür ve sana teklif verir.
          </p>
        </header>

        <TeklifToplaFormu
          categories={categoriesResult.data || []}
          cities={orderCities(citiesResult.data || [])}
        />
      </div>
    </div>
  );
}