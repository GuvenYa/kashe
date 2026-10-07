import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { orderCities } from '@/app/lib/city-order';
import { TopNav } from '@/app/components/sections/top-nav';
import { YeniIlanFormu } from './yeni-ilan-formu';
import { getWritableBusinesses } from '@/app/lib/business-write';
import { gorunenEtkinlikId } from '@/app/lib/eventspec-server';

type YeniIlanParams = {
  /** FAZ 4c/P3: events.id — ilan bu etkinlige baglanir (sunucuda dogrulanir). */
  etkinlik?: string;
  /** service_categories.id — etkinlik detayindaki rol satirindan gelir. */
  kategori?: string;
};

export default async function YeniIlanPage({
  searchParams,
}: {
  searchParams: Promise<YeniIlanParams>;
}) {
  const params = await searchParams;
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
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-ink mb-4">
              Hesap askıda
            </p>
            <h1 className="font-display text-4xl text-ink mb-3">
              Hesabın şu an{' '}
              <em className="text-brand-ink not-italic italic font-medium">
                askıya alınmış
              </em>
            </h1>
            <p className="text-ink-72 mb-8">
              Bu durumda yeni ilan açamazsın. Sorularınız için destek ekibiyle
              iletişime geçebilirsin.
            </p>
            <a
              href="mailto:info@kashe.net"
              className="inline-block px-6 py-3 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
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
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-ink mb-4">
              Erişim yok
            </p>
            <h1 className="font-display text-4xl text-ink mb-3">
              İlan açmak için{' '}
              <em className="text-brand-ink not-italic italic font-medium">
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
              className="inline-block px-6 py-3 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
            >
              İlanları gör
            </Link>
          </div>
        </div>
      </>
    );
  }

  // FAZ 4c/P3 — etkinlikten acilan ilan: id dogrulanir (RLS), alanlar on dolum
  // ONERISI olarak forma gecer; kullanici hepsini degistirebilir.
  const etkinlikId = await gorunenEtkinlikId(supabase, params.etkinlik);
  let onDoldur: {
    etkinlikId: string;
    kategoriId: number | null;
    eventType: string | null;
    eventDate: string | null;
    cityId: number | null;
    guestCount: number | null;
    budgetMin: number | null;
    budgetMax: number | null;
    title: string | null;
  } | null = null;

  if (etkinlikId) {
    const { data: etkinlik } = await supabase
      .from('events')
      .select(
        'id, title, event_type, start_date, city_id, participant_count, budget_min, budget_max, event_types(name_tr), turkish_cities(name)'
      )
      .eq('id', etkinlikId)
      .maybeSingle();
    if (etkinlik) {
      const e = etkinlik as unknown as {
        title: string | null;
        event_type: string;
        start_date: string | null;
        city_id: number | null;
        participant_count: number | null;
        budget_min: number | null;
        budget_max: number | null;
        event_types: { name_tr: string } | null;
        turkish_cities: { name: string } | null;
      };
      const onerilenBaslik =
        e.title ||
        [e.event_types?.name_tr ?? e.event_type, e.turkish_cities?.name]
          .filter(Boolean)
          .join(' — ');
      onDoldur = {
        etkinlikId,
        kategoriId: params.kategori ? Number(params.kategori) : null,
        eventType: e.event_type,
        eventDate: e.start_date,
        cityId: e.city_id,
        guestCount: e.participant_count,
        budgetMin: e.budget_min,
        budgetMax: e.budget_max,
        title: onerilenBaslik || null,
      };
    }
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
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.1em] text-ink-72 hover:text-brand-ink mb-8 transition-colors"
          >
            <span>←</span> Tüm ilanlar
          </Link>

          <header className="mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
              Yeni ilan
            </p>
            <h1 className="font-display text-4xl text-ink leading-tight">
              <em className="text-brand-ink not-italic italic font-medium">
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
            onDoldur={onDoldur}
          />
        </div>
      </div>
    </>
  );
}