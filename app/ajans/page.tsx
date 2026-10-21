import { redirect } from 'next/navigation';
import Link from 'next/link';
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
  VeriTablosu,
  type VeriSatiri,
} from '@/app/components/panel';
import { selamlama, tarihMetni, zamanMetni } from '@/app/lib/tarih';
import { etkinlikTuruEtiketi } from '@/app/lib/etkinlik-turu';
import { formatPrice } from '@/app/lib/profile-helpers';
import { gunMetni, ayAraligi, panelGunBugun } from '@/app/lib/panel-gosterge-data';
import { gorevSayilari, gecikmisGorevler } from '@/app/lib/gorev-data';
import { acikFirsatSayisi } from '@/app/lib/crm-data';
import { gorevDurumEtiketi } from '@/app/lib/gorevler';

export const metadata = {
  title: 'Ajans paneli — Kashe',
};

/**
 * AJANS GOSTERGESI (D1a) — ajans kurulusunun calisma merkezi.
 *
 * Yeni bir yetki ya da yazma yolu ACMAZ: tum sayilar RLS'in zaten gosterdigi
 * satirlardan sayilir (`rfp_invites`, `proposals`, `events`, `crews`,
 * `organization_memberships`, `organization_talent_records`). Ic maliyet ve
 * marj OKUNMAZ — `internal.*` bu sayfaya girmez.
 *
 * SAYMA JS'TE: sayilar `count: 'exact', head: true` ile degil, RLS'in dondurdugu
 * satirlar uzerinde hesaplanir. Neden: olcutlerin bir kismi GOMULU kolona bakiyor
 * (davetin bagli oldugu RFP'nin durumu) ve PostgREST'te gomulu kolonla sayim
 * `!inner` + yol suzgeci gerektiriyor; satir sayisi kurulus basina kucuk oldugu
 * icin okunur olani sectik.
 */
type DavetSatiri = {
  id: string;
  status: string;
  proposal_id: string | null;
  provider_id: string;
  rfp: {
    id: string;
    title: string;
    status: string;
    deadline: string | null;
    buyer: { display_name: string | null } | null;
  } | null;
};

type TeklifSatiri = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  rfp_id: string | null;
  client_name: string | null;
  buyer: { display_name: string | null } | null;
  current_version: { total_amount: number | null } | null;
};

type EtkinlikSatiri = {
  id: string;
  title: string | null;
  event_type: string;
  start_date: string | null;
  end_date: string | null;
  event_types: { name_tr: string } | null;
  turkish_cities: { name: string } | null;
};

/** Yanit bekleyen davet: talep acik + ajans henuz yanitlamamis. */
const ACIK_RFP_DURUMU = ['sent', 'collecting'];
const YANITSIZ_DAVET = ['sent', 'viewed'];
/** Gonderilmis ama sonuclanmamis teklif. */
const BEKLEYEN_TEKLIF = ['sent', 'viewed'];

export default async function AjansPanelPage() {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/ajans');

  const { data: profil } = await supabase
    .from('profiles')
    .select('suspended_at, full_name, avatar_url, is_admin')
    .eq('id', user.id)
    .single();
  if (profil?.suspended_at) return <SuspendedNotice />;

  const { orgs } = await getCrewContext();
  const kurulus = orgs.find((o) => o.accountType === 'agency') ?? null;
  // Ajans baglami yoksa panelin gosterecegi bir sey yok.
  if (!kurulus) redirect('/profil');

  const bugun = panelGunBugun();
  const { ilk: ayIlk, son: aySon } = ayAraligi();

  const [
    davetSonuc,
    teklifSonuc,
    ayEtkinlikSonuc,
    yaklasanSonuc,
    ekipSonuc,
    uyeSonuc,
  ] = await Promise.all([
    supabase
      .from('rfp_invites')
      .select(
        `id, status, proposal_id, provider_id,
         rfp:rfps(
           id, title, status, deadline,
           buyer:organizations_public!rfps_organization_id_fkey(display_name)
         )`
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('proposals')
      .select(
        `id, title, status, created_at, rfp_id, client_name,
         buyer:organizations_public!proposals_buyer_organization_id_fkey(display_name),
         current_version:proposal_versions!proposals_current_version_fkey(total_amount)`
      )
      .eq('seller_organization_id', kurulus.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('events')
      .select('id')
      .eq('organization_id', kurulus.id)
      .gte('start_date', ayIlk)
      .lte('start_date', aySon),
    supabase
      .from('events')
      .select(
        `id, title, event_type, start_date, end_date,
         event_types(name_tr), turkish_cities(name)`
      )
      .eq('organization_id', kurulus.id)
      .gte('start_date', bugun)
      .order('start_date', { ascending: true })
      .limit(5),
    supabase
      .from('crews')
      .select('id, status')
      .eq('organization_id', kurulus.id),
    supabase
      .from('organization_memberships')
      .select('id')
      .eq('organization_id', kurulus.id)
      .eq('status', 'active'),
  ]);

  if (davetSonuc.error) console.error('[ajans panel] davetler', davetSonuc.error);
  if (teklifSonuc.error) console.error('[ajans panel] teklifler', teklifSonuc.error);

  // D1b notu 2: `rfp_invites` RLS kurulusun saglayicisina gelen davetleri
  // aciyor ama kullanici birden cok kurulusun uyesi olabilir; sayim BU
  // kurulusun saglayici kaydiyla (`legacy_profile_id`) suzulur. Kopru alan
  // yok ise (eski kurulus) suzgec uygulanmaz ve RLS kapsami gecerli kalir.
  const tumDavetler = (davetSonuc.data ?? []) as unknown as DavetSatiri[];
  const davetler = kurulus.legacyProfileId
    ? tumDavetler.filter((d) => d.provider_id === kurulus.legacyProfileId)
    : tumDavetler;
  const teklifler = (teklifSonuc.data ?? []) as unknown as TeklifSatiri[];
  const ekipler = (ekipSonuc.data ?? []) as { id: string; status: string }[];
  const yaklasan = (yaklasanSonuc.data ?? []) as unknown as EtkinlikSatiri[];

  // Havuz sayisi yalniz modul acik ve `talent.view` varsa okunur.
  let havuzSayisi: number | null = null;
  if (kurulus.canViewTalent && kurulus.talentPoolEnabled) {
    const { data: havuz } = await supabase
      .from('organization_talent_records')
      .select('id')
      .eq('organization_id', kurulus.id);
    havuzSayisi = (havuz ?? []).length;
  }

  // FAZ 8a — gorev sayilari ve gecikmis gorevler (modul acikken).
  const gorevSayi = kurulus.tasksEnabled
    ? await gorevSayilari(kurulus.id)
    : null;
  const gecikmisler = kurulus.tasksEnabled
    ? await gecikmisGorevler(kurulus.id, 5)
    : [];

  // FAZ 8b — acik firsat sayisi (modul acik VE `crm.view` iken; tek `count`).
  const acikFirsat =
    kurulus.crmEnabled && kurulus.canViewCrm
      ? await acikFirsatSayisi(kurulus.id)
      : null;

  const acikDavetler = davetler.filter(
    (d) =>
      !!d.rfp &&
      ACIK_RFP_DURUMU.includes(d.rfp.status) &&
      YANITSIZ_DAVET.includes(d.status)
  );
  const bekleyenTeklifler = teklifler.filter((t) =>
    BEKLEYEN_TEKLIF.includes(t.status)
  );
  const taslakSayisi = teklifler.filter((t) => t.status === 'draft').length;
  const ayEtkinlikSayisi = (ayEtkinlikSonuc.data ?? []).length;
  const aktifEkipSayisi = ekipler.filter((e) => e.status === 'confirmed').length;
  const uyeSayisi = (uyeSonuc.data ?? []).length;

  // "Acik isler" — gelen davetler ve yanit bekleyen teklifler TEK listede.
  const acikIsler: VeriSatiri[] = [
    ...acikDavetler.map((d) => ({
      anahtar: 'davet-' + d.id,
      href: `/ajans/rfp/${d.rfp!.id}`,
      hucreler: {
        baslik: d.rfp!.title,
        tur: 'Teklif talebi',
        taraf: d.rfp!.buyer?.display_name?.trim() || 'Kuruluş',
        tarih: d.rfp!.deadline ? zamanMetni(d.rfp!.deadline) : '—',
        durum: d.status === 'viewed' ? 'Görüldü' : 'Yeni',
      },
    })),
    ...bekleyenTeklifler.map((t) => ({
      anahtar: 'teklif-' + t.id,
      href: `/ajans/teklifler/${t.id}`,
      hucreler: {
        baslik: t.title,
        tur: t.rfp_id ? 'RFP yanıtı' : 'Teklif',
        taraf:
          t.buyer?.display_name?.trim() || t.client_name?.trim() || 'Müşteri',
        tarih: tarihMetni(t.created_at) ?? '—',
        durum: t.status === 'viewed' ? 'Görüldü' : 'Gönderildi',
      },
    })),
  ];

  const yaklasanSatirlar: VeriSatiri[] = yaklasan.map((e) => ({
    anahtar: e.id,
    href: `/etkinliklerim/${e.id}`,
    hucreler: {
      baslik:
        e.title?.trim() ||
        e.event_types?.name_tr ||
        etkinlikTuruEtiketi(e.event_type) ||
        'Etkinlik',
      tarih: gunMetni(e.start_date, e.end_date),
      sehir: e.turkish_cities?.name ?? '—',
    },
  }));

  const menu = await panelMenusu();

  return (
    <PanelKabugu
      menu={menu}
      yonetici={!!profil?.is_admin}
      hesap={{
        ad: kurulus.name,
        altSatir: `Ajans hesabı · ${uyeSayisi} kişilik ekip`,
        avatarUrl: profil?.avatar_url ?? null,
        rozet: 'Ajans',
      }}
      ustBaslik={{
        eyebrow: 'Ajans paneli · Gösterge',
        baslik: (
          <>
            {selamlama()},{' '}
            <em className="not-italic text-brand-accent">{kurulus.name}</em>
          </>
        ),
        sagAlan: (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-50">
            {tarihMetni(new Date().toISOString())}
          </p>
        ),
      }}
    >
      <KpiSatir>
        <KpiKutu
          etiket="Açık RFP"
          deger={acikDavetler.length}
          altNot="Yanıt bekleyen davet"
          vurgu={acikDavetler.length > 0 ? 'accent' : 'none'}
          href={kurulus.canViewProposals ? '/ajans/rfp' : undefined}
        />
        <KpiKutu
          etiket="Bekleyen teklif"
          deger={bekleyenTeklifler.length}
          altNot={
            taslakSayisi > 0 ? `${taslakSayisi} taslak ayrıca var` : 'Taslak yok'
          }
          href={kurulus.canViewProposals ? '/ajans/teklifler' : undefined}
        />
        <KpiKutu
          etiket="Bu ay etkinlik"
          deger={ayEtkinlikSayisi}
          altNot="Kuruluş adına"
          href={kurulus.canViewEvents ? '/etkinliklerim' : undefined}
        />
        <KpiKutu
          etiket="Aktif ekip"
          deger={aktifEkipSayisi}
          altNot="Onaylı ekip"
          vurgu={aktifEkipSayisi > 0 ? 'moss' : 'none'}
          href={kurulus.canViewCrew ? '/ajans/ekipler' : undefined}
        />
      </KpiSatir>

      {/* FAZ 8a — gorev kutusu ayri satirda: KPI satiri dort kutuluk bir
          desen (DESIGN.md bolum 9), besinci kutu duzeni bozardi. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {gorevSayi ? (
          <>
            <KpiKutu
              etiket="Açık görev"
              deger={gorevSayi.acik}
              altNot="Tamamlanmamış"
              vurgu={gorevSayi.acik > 0 ? 'accent' : 'none'}
              href={`/kurulus/gorevler?kurulus=${kurulus.id}`}
            />
            <KpiKutu
              etiket="Gecikmiş görev"
              deger={gorevSayi.gecikmis}
              altNot="Son tarihi geçti"
              vurgu={gorevSayi.gecikmis > 0 ? 'accent' : 'none'}
              href={`/kurulus/gorevler?kurulus=${kurulus.id}`}
            />
          </>
        ) : (
          <KpiKutu
            etiket="Görevler"
            deger="Kapalı"
            altNot={
              kurulus.canManageSettings ? (
                <Link
                  href="/kurumsal/ayarlar"
                  className="text-brand-ink hover:underline"
                >
                  Ayarlar →
                </Link>
              ) : (
                'Modül kapalı'
              )
            }
          />
        )}

        {/* FAZ 8b — acik firsat. Modul kapali ya da yetki yoksa kutu HIC
            cizilmez: "Kapalı" yazmak CRM olmayan bir kurulusta kafa
            karistirirdi (gorev modulu kurumda acilabilir, CRM ajansa ozel). */}
        {acikFirsat !== null && (
          <KpiKutu
            etiket="Açık fırsat"
            deger={acikFirsat}
            altNot="Kapanmamış"
            vurgu={acikFirsat > 0 ? 'accent' : 'none'}
            href={`/ajans/musteriler?kurulus=${kurulus.id}`}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <PanelKart
            baslik="Açık işler"
            tumuHref={kurulus.canViewProposals ? '/ajans/teklifler' : undefined}
          >
            <VeriTablosu
              sutunlar={[
                { anahtar: 'baslik', baslik: 'Başlık', kartEtiketiGizle: true },
                { anahtar: 'tur', baslik: 'Tür' },
                { anahtar: 'taraf', baslik: 'Karşı taraf' },
                { anahtar: 'tarih', baslik: 'Son tarih' },
                { anahtar: 'durum', baslik: 'Durum' },
              ]}
              satirlar={acikIsler}
              bosMetin="Açık iş yok. Gelen talepler ve gönderilmiş teklifler burada görünür."
            />
          </PanelKart>

          <PanelKart
            baslik="Yaklaşan etkinlikler"
            tumuHref={kurulus.canViewEvents ? '/etkinliklerim' : undefined}
          >
            <VeriTablosu
              sutunlar={[
                { anahtar: 'baslik', baslik: 'Etkinlik', kartEtiketiGizle: true },
                { anahtar: 'tarih', baslik: 'Tarih' },
                { anahtar: 'sehir', baslik: 'Şehir' },
              ]}
              satirlar={yaklasanSatirlar}
              bosMetin="Yaklaşan etkinlik yok."
            />
          </PanelKart>
        </div>

        <aside className="space-y-5">
          <PanelKart baslik="Ekip ve havuz">
            <dl className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-ink-72">Kuruluş üyesi</dt>
                <dd className="font-display text-xl text-ink tabular-nums">
                  {uyeSayisi}
                </dd>
              </div>
              {havuzSayisi !== null && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-ink-72">Havuz kaydı</dt>
                  <dd className="font-display text-xl text-ink tabular-nums">
                    {havuzSayisi}
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-4 pt-4 border-t border-line space-y-1.5">
              {kurulus.canViewTalent && kurulus.talentPoolEnabled && (
                <Link
                  href="/ajans/havuz"
                  className="kashe-tap block text-sm text-brand-ink hover:underline"
                >
                  Yetenek havuzu →
                </Link>
              )}
              {kurulus.canViewCrew && (
                <Link
                  href="/ajans/ekipler"
                  className="kashe-tap block text-sm text-brand-ink hover:underline"
                >
                  Ekipler →
                </Link>
              )}
            </div>
          </PanelKart>

          {gecikmisler.length > 0 && (
            <PanelKart
              baslik="Gecikmiş görevler"
              tumuHref={`/kurulus/gorevler?kurulus=${kurulus.id}`}
            >
              <ul className="divide-y divide-line">
                {gecikmisler.map((g) => (
                  <li key={g.id} className="py-2 first:pt-0 last:pb-0">
                    <p className="text-sm text-ink truncate">{g.title}</p>
                    <p className="text-[11px] text-danger">
                      {gorevDurumEtiketi(g.status)}
                      {g.assignee?.full_name
                        ? ` · ${g.assignee.full_name}`
                        : g.havuz?.name
                          ? ` · ${g.havuz.name}`
                          : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </PanelKart>
          )}

          {kurulus.canViewFinance && (
            <PanelKart baslik="Kazançlar">
              <p className="text-sm text-ink-72">
                Tamamlanan işlerin geliri ve komisyon dökümü kazançlar
                sayfasında.
              </p>
              <Link
                href="/kazanclarim"
                className="kashe-tap mt-3 inline-block text-sm text-brand-ink hover:underline"
              >
                Kazançlarım →
              </Link>
            </PanelKart>
          )}
        </aside>
      </div>

      {/* Bekleyen teklif tutarlari burada TOPLANMAZ: gonderilmis teklifin
          toplami surumde duruyor, ama "beklenen gelir" gibi bir rakam uretmek
          tahmin olurdu (teklif kabul edilmedi). Tutar teklif sayfasinda. */}
      {bekleyenTeklifler.length > 0 && bekleyenTeklifler[0].current_version && (
        <p className="mt-6 text-xs text-ink-50">
          En son gönderilen teklif:{' '}
          {formatPrice(bekleyenTeklifler[0].current_version.total_amount ?? 0)}{' '}
          (KDV dahil)
        </p>
      )}
    </PanelKabugu>
  );
}
