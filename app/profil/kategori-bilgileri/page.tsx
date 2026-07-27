import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { isProfessional } from '@/app/lib/profile-helpers';
import { getCategoryFields } from '@/app/lib/category-fields';
import { KategoriForm } from './kategori-form';
import type { Profile } from '@/app/lib/types';

export const metadata = {
  title: 'Kategori Bilgileri — Kashe',
};

export default async function KategoriBilgileriPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/giris?redirect=/profil/kategori-bilgileri');
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select(
      '*, service_categories!profiles_primary_category_id_fkey(slug, name_tr)'
    )
    .eq('id', user.id)
    .single();
  if (!profileData) {
    redirect('/giris');
  }
  const profile = profileData as Profile & {
    service_categories: { slug: string; name_tr: string } | null;
    category_attributes: Record<string, unknown> | null;
  };
  if (!isProfessional(profile)) {
    redirect('/profil');
  }

  const slug = profile.service_categories?.slug ?? null;
  const preset = getCategoryFields(slug);

  const backLink = (
    <Link
      href="/profil"
      className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-brand-ink transition-colors inline-flex items-center gap-1.5 mb-3"
    >
      ← Profilime dön
    </Link>
  );

  // İKİ AYRI DURUM — tek mesaja indirilemez:
  //  (a) kategori HİÇ seçilmemiş → kullanıcı gidip seçebilir (eylem var)
  //  (b) kategori seçili ama preset YOK (yetim kategori / preset'i gecikmiş yeni
  //      kategori) → "kategorini seç" demek ÇIKMAZ DÖNGÜ üretir: kullanıcı
  //      /profil/duzenle'ye gider, kategorisinin yerinde durduğunu görür, döner,
  //      aynı ekranı görür. Bu dalda yapabileceği bir şey yok; dürüst mesaj + çıkış.
  if (!slug || !preset) {
    const categoryMissing = !slug;
    return (
      <>
        <TopNav />
        <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
          <div className="max-w-3xl mx-auto">
            {backLink}
            <div className="bg-card border border-line rounded-xl p-8 text-center mt-4">
              <h1 className="font-display text-2xl text-ink mb-2">
                {categoryMissing
                  ? 'Önce hizmet kategorini seç'
                  : 'Bu kategori için özel alanlar hazırlanıyor'}
              </h1>
              <p className="text-ink-72 text-sm mb-5 max-w-md mx-auto">
                {categoryMissing
                  ? 'Kategori bilgileri formu, kategorine göre şekillenir. Ana hizmet kategorini belirledikten sonra buraya dönebilirsin.'
                  : 'Profilinin diğer bölümlerini doldurmaya devam edebilirsin. Bu kategoriye özel alanlar hazır olduğunda burada görünecek.'}
              </p>
              <Link
                href={categoryMissing ? '/profil/duzenle' : '/profil'}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
              >
                {categoryMissing ? 'Profili düzenle →' : 'Profilime dön →'}
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="mb-10">
            {backLink}
            <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight">
              <em className="text-brand-ink not-italic italic font-medium">
                Kategori Bilgileri
              </em>
            </h1>
            <p className="text-ink-72 mt-3 max-w-xl">
              {profile.service_categories?.name_tr} profilin için özel alanlar.
              Doldurduğun bilgiler public profilinde ilgili bölümlerde görünür;
              boş bıraktıkların hiç gösterilmez.
            </p>
          </div>

          <KategoriForm
            slug={slug}
            initialAttributes={
              (profile.category_attributes as Record<string, unknown>) ?? {}
            }
          />
        </div>
      </main>
    </>
  );
}
