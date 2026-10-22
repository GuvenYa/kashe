import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { getCrewContext } from '@/app/lib/org-context';
import { panelMenusu } from '@/app/lib/panel-menu';
import { PanelKabugu, PanelKart } from '@/app/components/panel';
import { ModulSatiri } from './modul-satiri';

export const metadata = {
  title: 'Kurumsal ayarlar — Kashe',
};

/**
 * FAZ 8a — kurumsal ayarlar: modul ac/kapat (`settings.manage`).
 *
 * AJANSTA BU SAYFA YOK: `tasks` ajans kuruluslarinda varsayilan ACIK (migration
 * dolumu + yeni ajansa tetikleyici), kapatilacak bir sey sunulmuyor. Kurum
 * hesabinda modul kapali dogar ve sahip/yonetici buradan acar.
 */
export default async function KurumsalAyarlarPage() {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/kurumsal/ayarlar');

  const { data: profil } = await supabase
    .from('profiles')
    .select('suspended_at, avatar_url, is_admin')
    .eq('id', user.id)
    .single();
  if (profil?.suspended_at) return <SuspendedNotice />;

  const { orgs } = await getCrewContext();
  const kurulus =
    orgs.find((o) => o.accountType === 'business' && o.canManageSettings) ??
    null;
  if (!kurulus) redirect('/profil');

  const menu = await panelMenusu();

  return (
    <PanelKabugu
      menu={menu}
      yonetici={!!profil?.is_admin}
      hesap={{
        ad: kurulus.name,
        altSatir: 'Kurumsal hesap',
        avatarUrl: profil?.avatar_url ?? null,
        rozet: 'Kurumsal',
      }}
      ustBaslik={{
        eyebrow: `${kurulus.name} · Ayarlar`,
        baslik: (
          <>
            Kuruluş{' '}
            <em className="not-italic text-brand-accent">ayarları</em>
          </>
        ),
      }}
    >
      <div className="max-w-2xl">
        <PanelKart baslik="Modüller">
          <div className="divide-y divide-line">
            <ModulSatiri
              orgId={kurulus.id}
              modulAnahtari="tasks"
              baslik="Görevler"
              aciklama="Etkinliklere ve kuruluş geneline görev ekle, ekibe ata, son tarih takibi yap."
              acik={kurulus.tasksEnabled}
            />
            {/* FAZ 8c: alici kisa listesi. Ajansta ayar yuzeyi YOK
                (`suppliers` varsayilan acik; 8b ile ayni karar). */}
            <ModulSatiri
              orgId={kurulus.id}
              modulAnahtari="supplier_search"
              baslik="Kısa liste"
              aciklama="Keşfet'te beğendiğin ajans ve profesyonelleri listeye al, teklif talebine oradan davet et."
              acik={kurulus.shortlistEnabled}
            />
          </div>
          <p className="mt-4 pt-4 border-t border-line text-[12px] text-ink-50">
            Modül kapatıldığında mevcut kayıtlar silinmez; yalnız yeni kayıt
            eklenmesi ve ilgili yüzey kapanır.
          </p>
        </PanelKart>
      </div>
    </PanelKabugu>
  );
}
