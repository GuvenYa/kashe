import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { orderCities } from '@/app/lib/city-order';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { TopNav } from '@/app/components/sections/top-nav';
import { getCachedUser } from '@/app/lib/auth';
import { TeklifToplaFormu } from './teklif-topla-formu';
import { getWritableBusinesses } from '@/app/lib/business-write';

export const metadata = {
  title: 'Teklif Topla — Kashe',
};

type OnDolduParams = {
  /** EVENT_TYPES key'i — brief 'event_type' alanına düşer. */
  tur?: string;
  /** turkish_cities.id */
  sehir?: string;
  /** ISO tarih — brief 'event_date' alanına düşer. */
  tarih?: string;
  /** service_categories.id — YALNIZ tek değer ön-doldurulur (form tekil seçim). */
  kategori?: string;
};

export default async function TeklifToplaPage({
  searchParams,
}: {
  searchParams: Promise<OnDolduParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const user = await getCachedUser();

  if (!user) {
    // Kayıt duvarı: MEVCUT kalıp (?redirect=) korunur, yeni mekanizma icat edilmez.
    // Sihirbazdan gelen ön-doldurma parametreleri redirect'e GÖMÜLÜR ki giriş
    // sonrasında kullanıcının seçimleri kaybolmasın.
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === 'string' && v) qs.set(k, v);
    }
    const hedef = qs.toString() ? `/teklif-topla?${qs.toString()}` : '/teklif-topla';
    redirect(`/giris?redirect=${encodeURIComponent(hedef)}`);
  }

  // Rol + suspension kontrolü — sadece client/business teklif toplayabilir
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .single();

  // Suspension kontrolü
  if (profile?.suspended_at) return <SuspendedNotice />;

  const role = profile?.role;
  // manager+ kurum üyesi (profil rolü ne olursa olsun) kurum adına talep açabilir
  const writableBusinesses = await getWritableBusinesses();
  const canSelfCreate = role === 'client' || role === 'business';

  if (!canSelfCreate && writableBusinesses.length === 0) {
    return (
      <>
      <TopNav />
      <div className="bg-paper min-h-screen">
        <div className="max-w-2xl mx-auto px-6 md:px-12 py-20 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-ink mb-4">
            Erişim yok
          </p>
          <h1 className="font-display text-4xl text-ink mb-3">
            Teklif toplamak için{' '}
            <em className="text-brand-ink not-italic italic font-medium">
              müşteri
            </em>{' '}
            hesabı gerek
          </h1>
          <p className="text-ink-72 mb-8">
            Profesyonel ve ajans hesapları teklif talebi alır, oluşturamaz.
          </p>
          <Link
            href="/kesfet"
            className="inline-block px-6 py-3 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
          >
            Profesyonelleri keşfet
          </Link>
        </div>
      </div>
      </>
    );
  }

  const [categoriesResult, citiesResult] = await Promise.all([
    supabase
      .from('service_categories')
      .select('id, slug, name_tr')
      .eq('is_active', true)
      .order('name_tr'),
    supabase.from('turkish_cities').select('id, name').order('name'),
  ]);

  return (
    <>
    <TopNav />
    <div className="bg-paper min-h-screen">
      <div className="max-w-3xl mx-auto px-6 md:px-12 py-12">
        <header className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
            Teklif Topla
          </p>
          <h1 className="font-display text-4xl text-ink leading-tight">
            Birden fazla profesyonelden{' '}
            <em className="text-brand-ink not-italic italic font-medium">
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
          writableBusinesses={writableBusinesses}
          canSelfCreate={canSelfCreate}
          onDoldur={{
            kategoriId: params.kategori ? Number(params.kategori) : null,
            sehirId: params.sehir ? Number(params.sehir) : null,
            etkinlikTuru: params.tur ?? null,
            etkinlikTarihi: params.tarih ?? null,
          }}
        />
      </div>
    </div>
    </>
  );
}