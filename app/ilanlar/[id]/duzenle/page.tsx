import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { YeniIlanFormu } from '../../yeni/yeni-ilan-formu';
import { canEditListing, type Listing, type ListingStatus } from '../../listings-data';

type Params = Promise<{ id: string }>;

export default async function IlanDuzenlePage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/giris?redirect=/ilanlar/${id}/duzenle`);
  }

  // İlanı çek
  const { data: listingData } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single();

  if (!listingData) {
    notFound();
  }

  const listing = listingData as Listing;

  // Admin mi? (admin başkasının ilanını her statusde düzenleyebilir)
  const { data: editorProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  const isAdmin = editorProfile?.is_admin ?? false;

  // Sahibi veya admin mi?
  if (listing.creator_id !== user.id && !isAdmin) {
    notFound();
  }

  // Düzenlenebilir mi? (admin her durumda düzenleyebilir, sahip için kısıt)
  if (!isAdmin && !canEditListing(listing.status as ListingStatus)) {
    redirect(`/ilanlar/${id}`);
  }

  // Kategoriler + şehirler
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

  // event_date'i HTML date input'a uyumlu format'a çevir (YYYY-MM-DD)
  const sanitizedListing: Listing = {
    ...listing,
    event_date: listing.event_date
      ? listing.event_date.split('T')[0]
      : null,
  };

  return (
    <div className="bg-paper min-h-screen">
      <div className="max-w-3xl mx-auto px-6 md:px-12 py-12">
        <Link
          href={`/ilanlar/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.1em] text-ink-72 hover:text-terracotta mb-8 transition-colors"
        >
          <span>←</span> İlan detayı
        </Link>

        <header className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
            Düzenle
          </p>
          <h1 className="font-display text-4xl text-ink leading-tight">
            <em className="text-terracotta not-italic italic font-medium">
              İlanını
            </em>{' '}
            güncelle
          </h1>
          <p className="mt-3 text-ink-72 text-base">
            Değişikliklerin anında yansır. Yayında olan ilanlar başvuru kabul
            etmeye devam eder.
          </p>
        </header>

        <YeniIlanFormu
          categories={categoriesResult.data || []}
          cities={citiesResult.data || []}
          initialData={sanitizedListing}
        />
      </div>
    </div>
  );
}