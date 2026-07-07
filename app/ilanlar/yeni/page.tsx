import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { orderCities } from '@/app/lib/city-order';
import { TopNav } from '@/app/components/sections/top-nav';
import { YeniIlanFormu } from './yeni-ilan-formu';
import { getWritableBusinesses } from '@/app/lib/business-write';

export default async function YeniIlanPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris?redirect=/ilanlar/yeni');
  }

  // Rol + suspension kontrolü — sadece client/business açabilir
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .single();

  // Suspension kontrolü — askıdaki kullanıcı yeni ilan açamaz.
  if (profile?.suspended_at) {
    return (
      <>
        <TopNav />
        <div className="bg-paper min-h-screen">
          <div className="max-w-2xl mx-auto px-6 md:px-12 py-20 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-4">
              Hesap askıda
            </p>
            <h1 className="font-display text-4xl text-ink mb-3">
              Hesabın şu an{' '}
              <em className="text-terracotta not-italic italic font-medium">
                askıya alınmış
              </em>
            </h1>
            <p className="text-ink-72 mb-8">
              Bu durumda yeni ilan açamazsın. Sorularınız için destek ekibiyle
              iletişime geçebilirsin.
            </p>
            <a
              href="mailto:kasheofficial@gmail.com"
              className="inline-block px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
            >
              Destek ekibine yaz
            </a>
          </div>
        </div>
      </>
    );
  }

  const role = profile?.role;
  const canSelfCreate = role === 'client' || role === 'business';
  // manager+ kurum üyesi (profil rolü ne olursa olsun) kurum adına ilan açabilir
  const writableBusinesses = await getWritableBusinesses();
  const canCreate = canSelfCreate || writableBusinesses.length > 0;

  if (!canCreate) {
    return (
      <>
        <TopNav />
        <div className="bg-paper min-h-screen">
          <div className="max-w-2xl mx-auto px-6 md:px-12 py-20 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-4">
              Erişim yok
            </p>
            <h1 className="font-display text-4xl text-ink mb-3">
              İlan açmak için{' '}
              <em className="text-terracotta not-italic italic font-medium">
                müşteri
              </em>{' '}
              hesabı gerek
            </h1>
            <p className="text-ink-72 mb-8">
              Profesyonel hesaplar ilanlara başvurabilir ama yeni ilan açamaz.
              İlan açmak istiyorsan ayrı bir müşteri hesabı oluşturabilirsin.
            </p>
            <Link
              href="/ilanlar"
              className="inline-block px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
            >
              İlanları gör
            </Link>
          </div>
        </div>
      </>
    );
  }

  // Kategoriler ve şehirler
  const [categoriesResult, citiesResult] = await Promise.all([
    supabase
      .from('service_categories')
      .select('id, name_tr, emoji')
      .eq('is_active', true)
      .order('name_tr'),
    supabase
      .from('turkish_cities')
      .select('id, name')
      .order('name'),
  ]);

  return (
    <>
      <TopNav />
      <div className="bg-paper min-h-screen">
        <div className="max-w-3xl mx-auto px-6 md:px-12 py-12">
          <Link
            href="/ilanlar"
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.1em] text-ink-72 hover:text-terracotta mb-8 transition-colors"
          >
            <span>←</span> Tüm ilanlar
          </Link>

          <header className="mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
              Yeni ilan
            </p>
            <h1 className="font-display text-4xl text-ink leading-tight">
              <em className="text-terracotta not-italic italic font-medium">
                Etkinliğin
              </em>{' '}
              için profesyonel ara
            </h1>
            <p className="mt-3 text-ink-72 text-base max-w-2xl">
              İlanını detaylı yaz — profesyoneller başvururken neye ihtiyacın
              olduğunu net görmeli. Bütçe ve tarih opsiyonel ama belirtirsen
              daha hedefli başvurular alırsın.
            </p>
          </header>

          <YeniIlanFormu
            categories={categoriesResult.data || []}
            cities={orderCities(citiesResult.data || [])}
            writableBusinesses={writableBusinesses}
            canSelfCreate={canSelfCreate}
          />
        </div>
      </div>
    </>
  );
}