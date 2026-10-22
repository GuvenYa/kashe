import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { getCrewContext } from '@/app/lib/org-context';
import { panelMenusu } from '@/app/lib/panel-menu';
import { PanelKabugu } from '@/app/components/panel';
import { ModulKapali } from '@/app/components/tedarikci/modul-kapali';
import { YetkinYok } from '@/app/components/tedarikci/yetkin-yok';
import {
  KisaListeYonetimi,
  YeniListeDugmesi,
} from '@/app/components/tedarikci/kisa-liste-yonetimi';
import {
  kisaListeDetay,
  kisaListeleriListele,
} from '@/app/lib/tedarikci-data';
import { etkinlikTuruEtiketi } from '@/app/lib/etkinlik-turu';

export const metadata = {
  title: 'Kısa liste — Kashe',
};

/**
 * FAZ 8c / P1 — alici kisa listesi (`/kurumsal/kisa-liste`).
 *
 * `?kurulus=<orgId>` · `?liste=<id>` (varsayilan en yeni).
 *
 * YETKI: ayri bir anahtar YOK — kisa liste bir etkinlik hazirligi aracidir,
 * `events.view` okur, `events.manage` yazar (RLS boyle kurulu). Modul kapisi
 * `supplier_search`; hesap turu suzgeci YOK (ajans da alici olabilir).
 *
 * Saglayici bilgisi YALNIZ `v_providers_public`'ten gelir; iletisim bilgisi
 * okunmaz (bu bir pazaryeri secki listesi, PII deposu degil).
 */
export default async function KisaListePage({
  searchParams,
}: {
  searchParams: Promise<{ kurulus?: string; liste?: string }>;
}) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/kurumsal/kisa-liste');

  const { data: profil } = await supabase
    .from('profiles')
    .select('suspended_at, avatar_url, is_admin')
    .eq('id', user.id)
    .single();
  if (profil?.suspended_at) return <SuspendedNotice />;

  const params = await searchParams;
  const { orgs } = await getCrewContext();
  if (orgs.length === 0) redirect('/profil');

  const modullu = orgs.filter((o) => o.shortlistEnabled);
  const kurulus =
    modullu.find((o) => o.id === params.kurulus) ??
    orgs.find((o) => o.id === params.kurulus) ??
    modullu[0] ??
    orgs[0];

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
      eyebrow: `${kurulus.name} · Kısa liste`,
      baslik: (
        <>
          <em className="not-italic text-brand-accent">Kısa</em> liste
        </>
      ) as React.ReactNode,
    },
  };

  if (!kurulus.canViewEvents) {
    return (
      <PanelKabugu {...kabukProps}>
        <YetkinYok
          aciklama="Kısa liste kuruluşun etkinlik hazırlığıdır; erişim için kuruluş yöneticisinden rol değişikliği istemelisin."
          donusHref="/kurumsal"
        />
      </PanelKabugu>
    );
  }

  if (!kurulus.shortlistEnabled) {
    return (
      <PanelKabugu {...kabukProps}>
        <ModulKapali
          baslik="Kısa liste modülü bu kuruluşta kapalı."
          aciklama="Açıldığında Keşfet'te beğendiğin ajans ve profesyonelleri listeye alabilir, teklif talebine oradan davet edebilirsin."
          ayarlarAcilabilir={kurulus.canManageSettings}
        />
      </PanelKabugu>
    );
  }

  const listeler = await kisaListeleriListele(kurulus.id);
  const seciliId =
    listeler.find((l) => l.id === params.liste)?.id ?? listeler[0]?.id ?? null;

  const [detay, etkinlikSonuc, saglayiciSonuc] = await Promise.all([
    seciliId ? kisaListeDetay(kurulus.id, seciliId) : Promise.resolve(null),
    supabase
      .from('events')
      .select('id, title, event_type')
      .eq('organization_id', kurulus.id)
      .order('start_date', { ascending: false })
      .limit(100),
    // Secim listesi pazaryeri GORUNUMUNDEN (FAZ 2c sozlesmesi); iletisim YOK.
    kurulus.canManageEvents
      ? supabase
          .from('v_providers_public')
          .select('id, display_name, provider_type, city_id')
          .eq('is_published', true)
          .order('display_name')
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const etkinlikler = (
    (etkinlikSonuc.data ?? []) as {
      id: string;
      title: string | null;
      event_type: string;
    }[]
  ).map((e) => ({
    id: e.id,
    ad: e.title?.trim() || etkinlikTuruEtiketi(e.event_type) || 'Etkinlik',
  }));

  const hamSaglayicilar = (saglayiciSonuc.data ?? []) as {
    id: string;
    display_name: string | null;
    provider_type: string;
    city_id: number | null;
  }[];

  const sehirIdleri = [
    ...new Set(
      hamSaglayicilar
        .map((s) => s.city_id)
        .filter((v): v is number => typeof v === 'number')
    ),
  ];
  const sehirMap = new Map<number, string>();
  if (sehirIdleri.length > 0) {
    const { data: sehirData } = await supabase
      .from('turkish_cities')
      .select('id, name')
      .in('id', sehirIdleri);
    for (const s of (sehirData ?? []) as { id: number; name: string }[]) {
      sehirMap.set(s.id, s.name);
    }
  }

  const saglayicilar = hamSaglayicilar.map((s) => ({
    id: s.id,
    ad: s.display_name?.trim() || 'İsimsiz profil',
    tur: s.provider_type,
    sehir: s.city_id != null ? (sehirMap.get(s.city_id) ?? null) : null,
  }));

  return (
    <PanelKabugu
      {...kabukProps}
      ustBaslik={{
        ...kabukProps.ustBaslik,
        sagAlan: kurulus.canManageEvents ? (
          <YeniListeDugmesi
            organizationId={kurulus.id}
            etkinlikler={etkinlikler}
          />
        ) : undefined,
      }}
    >
      {listeler.length === 0 ? (
        <div className="bg-card border border-line rounded-xl p-6">
          <p className="text-sm text-ink">Henüz kısa liste yok.</p>
          <p className="text-sm text-ink-72 mt-1.5">
            Keşfet&apos;te bir ajans ya da profesyonelin kartındaki &quot;Kısa
            listeye ekle&quot; ile başlayabilir, ya da buradan boş bir liste
            oluşturabilirsin.
          </p>
          <Link
            href="/kesfet"
            className="kashe-tap mt-4 inline-block text-sm text-brand-ink hover:underline"
          >
            Keşfet&apos;e git →
          </Link>
        </div>
      ) : (
        <>
          {/* Liste secimi — sekme seridi; telefonda yatay kaydirilir. */}
          <div className="flex items-center gap-1 border-b border-line mb-6 overflow-x-auto">
            {listeler.map((l) => {
              const etkin = l.id === seciliId;
              return (
                <Link
                  key={l.id}
                  href={`/kurumsal/kisa-liste?kurulus=${kurulus.id}&liste=${l.id}`}
                  className={
                    etkin
                      ? 'kashe-tap shrink-0 px-4 py-2.5 font-display font-semibold text-sm text-ink border-b-2 border-brand-accent -mb-px'
                      : 'kashe-tap shrink-0 px-4 py-2.5 font-display font-semibold text-sm text-ink-72 hover:text-ink border-b-2 border-transparent -mb-px'
                  }
                >
                  {l.name}
                  <span className="ml-1.5 font-mono text-[10px] text-ink-50 tabular-nums">
                    {l.kalemSayisi}
                  </span>
                </Link>
              );
            })}
          </div>

          {detay ? (
            <KisaListeYonetimi
              organizationId={kurulus.id}
              liste={detay.liste}
              kalemler={detay.kalemler}
              saglayicilar={saglayicilar}
              etkinlikler={etkinlikler}
              yazabilir={kurulus.canManageEvents}
            />
          ) : (
            <div className="bg-card border border-line rounded-xl p-5 text-sm text-ink-72">
              Liste bulunamadı.
            </div>
          )}
        </>
      )}
    </PanelKabugu>
  );
}
