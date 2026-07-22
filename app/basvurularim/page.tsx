import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { BasvurularimListesi } from './basvurularim-listesi';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { TopNav } from '@/app/components/sections/top-nav';
import { getCachedUser } from '@/app/lib/auth';
import type { ApplicationWithRelations } from '../ilanlar/listings-data';

type SearchParams = Promise<{ durum?: string }>;

export default async function BasvurularimPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const user = await getCachedUser();

  if (!user) {
    redirect('/giris?redirect=/basvurularim');
  }

  // Rol + suspension kontrolü
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .single();

  // Suspension kontrolü — askıdaki kullanıcı başvurularını yönetemez
  if (profile?.suspended_at) return <SuspendedNotice />;

  if (profile?.role !== 'professional' && profile?.role !== 'agency') {
    redirect('/profil');
  }

  // Tüm kendi başvurular + ilan özet bilgisi
  const { data: appsData } = await supabase
    .from('applications')
    .select(
      `
      *,
      listing:listings (
        id, title, status, creator_id, category_id, event_date, location,
        service_categories (id, name_tr, emoji)
      )
    `
    )
    .eq('applicant_id', user.id)
    .order('updated_at', { ascending: false });

  const applications = (appsData ??
    []) as unknown as ApplicationWithRelations[];

  return (
    <>
    <TopNav />
    <div className="bg-paper min-h-screen">
      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12">
        <div className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
            Takip
          </p>
          <h1 className="font-display text-4xl text-ink leading-tight">
            <em className="text-brand-ink not-italic italic font-medium">
              Başvurularım
            </em>
          </h1>
          <p className="mt-2 text-ink-72 text-sm">
            İlan tahtasından gönderdiğin başvuruların durumunu buradan takip
            et.
          </p>
        </div>

        <BasvurularimListesi
          applications={applications}
          activeStatus={params.durum ?? null}
        />
      </div>
    </div>
    </>
  );
}