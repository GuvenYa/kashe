import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { BasvurularimListesi } from './basvurularim-listesi';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { PanelKabugu, PanelBaslik, DurumKarti } from '@/app/components/panel';
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

  /**
   * DURUM OZETI (Duzeltme 25-A; gorsel dil). YENI SORGU YOK: sayilar yukarida
   * okunan basvurulardan. Satirlar yalniz var olan durumu yazar (uydurma
   * sayac yok); basvuru yoksa kart cizilmez.
   */
  const say = (durum: string) =>
    applications.filter((a) => a.status === durum).length;
  const ozBekleyen = say('pending');
  const ozKisaListe = say('shortlisted');
  const ozKabul = say('accepted');
  const ozAcik = ozBekleyen + ozKisaListe + ozKabul;
  const ozBaslik =
    ozKabul > 0
      ? `${ozKabul} başvurun kabul edildi`
      : ozKisaListe > 0
        ? `${ozKisaListe} başvurun kısa listede`
        : ozBekleyen > 0
          ? `${ozBekleyen} başvurun yanıt bekliyor`
          : 'Açık başvurun yok';
  const ozSatirlar = [
    ...(ozKabul > 0
      ? [{ metin: `${ozKabul} başvuru kabul edildi`, tamam: true }]
      : []),
    ...(ozKisaListe > 0
      ? [{ metin: `${ozKisaListe} başvuru kısa listeye alındı`, tamam: true }]
      : []),
    ...(ozBekleyen > 0
      ? [
          {
            metin: `${ozBekleyen} başvuru ilan sahibinin yanıtını bekliyor`,
            tamam: false,
          },
        ]
      : []),
    ...(ozAcik === 0
      ? [{ metin: 'Sonuçlanan başvuruların aşağıdaki listede', tamam: true }]
      : []),
  ];

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

        {applications.length > 0 && (
          <div className="mb-8">
            <DurumKarti
              baslik={ozBaslik}
              tamam={ozKabul > 0 && ozBekleyen + ozKisaListe === 0}
              ilerleme={ozAcik > 0 ? (100 * (ozKabul + ozKisaListe)) / ozAcik : 0}
              satirlar={ozSatirlar}
              kutular={[
                { etiket: 'Bekleyen', deger: ozBekleyen },
                { etiket: 'Kısa liste', deger: ozKisaListe },
                { etiket: 'Kabul', deger: ozKabul },
              ]}
            />
          </div>
        )}

        <BasvurularimListesi
          applications={applications}
          activeStatus={params.durum ?? null}
        />
      </div>
    </PanelKabugu>
  );
}