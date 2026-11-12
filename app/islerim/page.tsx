import { redirect } from 'next/navigation';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { PanelKabugu } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { getCachedUser } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase-server';
import {
  ajansPanelindeMerkez,
  saticiMerkeziAcik,
} from '@/app/lib/satici-merkezi';
import { teklifYonlendirmeleri } from '@/app/lib/teklif-yonlendirme';
import { saticiIsleri } from './satici-isleri';
import { SaticiMerkezi } from './satici-merkezi';

export const metadata = {
  title: 'İşlerim — Kashe',
};

/**
 * ISLERIM (Duzeltme 15-B, bulgu 129 - Fahri satir 34) — `/islerim`.
 *
 * Profesyonelin is merkezi: gelen talepler, verdigi teklifler ve
 * rezervasyonlar tek sayfada, sekmelerle. Kimde acik oldugu tek yerde
 * (`app/lib/satici-merkezi.ts`); digerleri kendi merkezine doner.
 * Duzeltme 16-A: ajansin kendi hesabi da ayni sayfayi kullanir.
 */
export default async function IslerimPage({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string }>;
}) {
  const { sekme } = await searchParams;
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/islerim');

  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  if (!(await saticiMerkeziAcik())) redirect('/profil');

  const [veri, kabuk, yonlendirmeler, ajansHesabi] = await Promise.all([
    saticiIsleri(supabase, user.id),
    panelKabukProps(),
    // Duzeltme 15-E: yeni talepler ajans uzerinden geliyorsa merkezde yazar.
    teklifYonlendirmeleri(supabase, [user.id]),
    // Duzeltme 16-A: ajansin kendi hesabi (ajans panelinden acildi).
    ajansPanelindeMerkez(),
  ]);

  return (
    <PanelKabugu {...kabuk}>
      <SaticiMerkezi
        veri={veri}
        sekme={sekme}
        ajansUzerinden={yonlendirmeler.get(user.id)?.ajansAdi ?? null}
        ajansHesabi={ajansHesabi}
      />
    </PanelKabugu>
  );
}
