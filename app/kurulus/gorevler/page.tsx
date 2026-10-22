import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { getCrewContext } from '@/app/lib/org-context';
import { panelMenusu } from '@/app/lib/panel-menu';
import {
  PanelKabugu,
  PanelKart,
  KpiKutu,
  KpiSatir,
} from '@/app/components/panel';
import { GorevListesi } from '@/app/components/gorevler/gorev-listesi';
import { GorevModuluKapali } from '@/app/components/gorevler/gorev-modul-kapali';
import {
  gorevleriGetir,
  gorevSayilari,
  atanabilirler,
} from '@/app/lib/gorev-data';
import { etkinlikEtiketi } from '@/app/lib/secim-etiketi';

export const metadata = {
  title: 'Görevler — Kashe',
};

/**
 * FAZ 8a — kurulus gorev listesi (`/kurulus/gorevler`).
 *
 * `?kurulus=<orgId>`: parametre yoksa kullanicinin `tasks` modulu ACIK ilk
 * kurulusu secilir; hic kurulusu yoksa `/profil`e gider. Adres yolu `/ajans` ya
 * da `/kurumsal` ALTINA konmadi: ayni sayfa iki hesap turunde de ayni isi
 * yapiyor, iki kopya olmasin.
 *
 * `?gorev=<id>`: bildirim baglantisi (tetikleyici bu adresi yaziyor) — o satir
 * listede vurgulanir.
 */
export default async function KurulusGorevlerPage({
  searchParams,
}: {
  searchParams: Promise<{ kurulus?: string; gorev?: string; bana?: string }>;
}) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/kurulus/gorevler');

  const { data: profil } = await supabase
    .from('profiles')
    .select('suspended_at, avatar_url, is_admin')
    .eq('id', user.id)
    .single();
  if (profil?.suspended_at) return <SuspendedNotice />;

  const params = await searchParams;
  const { orgs } = await getCrewContext();
  const gorebilenler = orgs.filter((o) => o.canViewEvents);
  if (gorebilenler.length === 0) redirect('/profil');

  const kurulus =
    gorebilenler.find((o) => o.id === params.kurulus) ??
    gorebilenler.find((o) => o.tasksEnabled) ??
    gorebilenler[0];

  const menu = await panelMenusu();
  const kabukProps = {
    menu,
    yonetici: !!profil?.is_admin,
    hesap: {
      ad: kurulus.name,
      altSatir:
        kurulus.accountType === 'agency' ? 'Ajans hesabı' : 'Kurumsal hesap',
      avatarUrl: profil?.avatar_url ?? null,
      rozet: kurulus.accountType === 'agency' ? 'Ajans' : 'Kurumsal',
    },
    ustBaslik: {
      eyebrow: `${kurulus.name} · Görevler`,
      baslik: (
        <>
          <em className="not-italic text-brand-accent">Görevler</em>
        </>
      ),
    },
  };

  if (!kurulus.tasksEnabled) {
    return (
      <PanelKabugu {...kabukProps}>
        <GorevModuluKapali ayarlarAcilabilir={kurulus.canManageSettings} />
      </PanelKabugu>
    );
  }

  const [gorevler, sayilar, atananlar, etkinlikSonuc] = await Promise.all([
    gorevleriGetir({
      orgId: kurulus.id,
      banaAtanan: params.bana === '1',
    }),
    gorevSayilari(kurulus.id),
    atanabilirler(
      kurulus.id,
      kurulus.canViewTalent && kurulus.talentPoolEnabled
    ),
    supabase
      .from('events')
      .select('id, title, event_type, start_date')
      .eq('organization_id', kurulus.id)
      .order('start_date', { ascending: false })
      .limit(100),
  ]);

  const etkinlikSecenekleri = (
    (etkinlikSonuc.data ?? []) as {
      id: string;
      title: string | null;
      event_type: string;
    }[]
  ).map((e) => ({
    id: e.id,
    ad: etkinlikEtiketi(e),
  }));

  return (
    <PanelKabugu {...kabukProps}>
      <KpiSatir>
        <KpiKutu
          etiket="Açık görev"
          deger={sayilar.acik}
          altNot="Tamamlanmamış"
          vurgu={sayilar.acik > 0 ? 'accent' : 'none'}
        />
        <KpiKutu
          etiket="Bana atanan"
          deger={sayilar.banaAtanan}
          altNot="Açık görev"
        />
        <KpiKutu
          etiket="Gecikmiş"
          deger={sayilar.gecikmis}
          altNot="Son tarihi geçti"
          vurgu={sayilar.gecikmis > 0 ? 'accent' : 'none'}
        />
        <KpiKutu
          etiket="Bu hafta biten"
          deger={sayilar.buHaftaBiten}
          altNot="Son 7 gün"
          vurgu={sayilar.buHaftaBiten > 0 ? 'moss' : 'none'}
        />
      </KpiSatir>

      <PanelKart baslik="Tüm görevler">
        <GorevListesi
          organizationId={kurulus.id}
          gorevler={gorevler}
          yazabilir={kurulus.canManageEvents}
          atanabilirler={atananlar}
          etkinlikSecenekleri={etkinlikSecenekleri}
          kullaniciId={user.id}
          vurgulananGorevId={params.gorev ?? null}
        />
      </PanelKart>
    </PanelKabugu>
  );
}
