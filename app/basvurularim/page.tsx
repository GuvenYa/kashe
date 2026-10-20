import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { BasvurularimListesi } from './basvurularim-listesi';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { PanelKabugu, PanelBaslik } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { getCachedUser } from '@/app/lib/auth';
import type { ApplicationWithRelations } from '../ilanlar/listings-data';

type SearchParams = Promise<{ durum?: string }>;

export const metadata = {
  title: 'Başvurularım — Kashe',
};

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

  // D1b-2: calisma sayfasi panel kabugunda; menu ve hesap karti tek
  // yerden (app/lib/panel-kabuk.ts).
  const kabuk = await panelKabukProps();

  return (
    <PanelKabugu {...kabuk}>
      <div className="max-w-5xl">
        <PanelBaslik
          eyebrow="Takip"
          altNot="İlan tahtasından gönderdiğin başvuruların durumunu buradan takip et."
        >
          <em className="not-italic font-medium text-brand-accent">
          Başvurularım
          </em>
        </PanelBaslik>

        <BasvurularimListesi
          applications={applications}
          activeStatus={params.durum ?? null}
        />
      </div>
    </PanelKabugu>
  );
}