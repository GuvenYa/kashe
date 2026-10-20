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

export const metadata = {
  title: 'Kurumsal panel — Kashe',
};

/**
 * KURUMSAL GOSTERGE (D1a) — kurum kurulusunun calisma merkezi.
 *
 * Alici koltugu: kurum teklif TOPLAR, teklif SATMAZ (satici yalniz ajans —
 * CLAUDE.md FAZ 7a). Bu yuzden "Teklifler" degil "Teklif talepleri" ve gelen
 * teklif SAYISI gosterilir; teklif tutarlari ve hicbir ic maliyet okunmaz.
 */
type RfpSatiri = {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  created_at: string;
  event: { title: string | null; start_date: string | null } | null;
  proposals: { id: string; status: string }[] | null;
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

/** Hala yanit toplayan talep. */
const ACIK_RFP = ['sent', 'collecting', 'evaluating'];
/** Aliciya ULASMIS teklif (taslak surum aliciya kapali — FAZ 7b). */
const GELEN_TEKLIF = ['sent', 'viewed', 'approved', 'revision_requested'];

const RFP_DURUM: Record<string, string> = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  collecting: 'Toplanıyor',
  evaluating: 'Değerlendirmede',
  awarded: 'Sonuçlandı',
  cancelled: 'İptal edildi',
};

export default async function KurumsalPanelPage() {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/kurumsal');

  const { data: profil } = await supabase
    .from('profiles')
    .select('suspended_at, avatar_url, is_admin')
    .eq('id', user.id)
    .single();
  if (profil?.suspended_at) return <SuspendedNotice />;

  const { orgs } = await getCrewContext();
  const kurulus = orgs.find((o) => o.accountType === 'business') ?? null;
  if (!kurulus) redirect('/profil');

  const bugun = panelGunBugun();
  const { ilk: ayIlk, son: aySon } = ayAraligi();

  const [rfpSonuc, ayEtkinlikSonuc, yaklasanSonuc, rezervasyonSonuc, uyeSonuc] =
    await Promise.all([
      supabase
        .from('rfps')
        .select(
          `id, title, status, deadline, created_at,
           event:events(title, start_date),
           proposals:proposals!proposals_rfp_id_fkey(id, status)`
        )
        .eq('organization_id', kurulus.id)
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
        .from('bookings')
        .select('id, status, total_amount')
        .eq('buyer_organization_id', kurulus.id),
      supabase
        .from('organization_memberships')
        .select('id')
        .eq('organization_id', kurulus.id)
        .eq('status', 'active'),
    ]);

  if (rfpSonuc.error) console.error('[kurumsal panel] rfp', rfpSonuc.error);
  if (rezervasyonSonuc.error) {
    console.error('[kurumsal panel] rezervasyon', rezervasyonSonuc.error);
  }

  const rfpler = (rfpSonuc.data ?? []) as unknown as RfpSatiri[];
  const yaklasan = (yaklasanSonuc.data ?? []) as unknown as EtkinlikSatiri[];
  const rezervasyonlar = (rezervasyonSonuc.data ?? []) as {
    id: string;
    status: string;
    total_amount: number | null;
  }[];

  const acikRfpSayisi = rfpler.filter((r) => ACIK_RFP.includes(r.status)).length;
  const gelenTeklifSayisi = rfpler.reduce(
    (toplam, r) =>
      toplam +
      (r.proposals ?? []).filter((p) => GELEN_TEKLIF.includes(p.status)).length,
    0
  );
  const ayEtkinlikSayisi = (ayEtkinlikSonuc.data ?? []).length;
  const onayliRezervasyonlar = rezervasyonlar.filter(
    (b) => b.status === 'confirmed'
  );
  const onayliTutar = onayliRezervasyonlar.reduce(
    (toplam, b) => toplam + (b.total_amount ?? 0),
    0
  );
  const uyeSayisi = (uyeSonuc.data ?? []).length;

  const rfpSatirlar: VeriSatiri[] = rfpler.slice(0, 5).map((r) => {
    const gelen = (r.proposals ?? []).filter((p) =>
      GELEN_TEKLIF.includes(p.status)
    ).length;
    return {
      anahtar: r.id,
      href: `/kurumsal/rfp/${r.id}`,
      hucreler: {
        baslik: r.title,
        etkinlik: r.event?.title?.trim() || '—',
        teklif: gelen,
        tarih: r.deadline ? zamanMetni(r.deadline) : '—',
        durum: RFP_DURUM[r.status] ?? r.status,
      },
      vurgu: ACIK_RFP.includes(r.status) && gelen > 0,
    };
  });

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
        altSatir: `Kurumsal hesap · ${uyeSayisi} kişilik ekip`,
        avatarUrl: profil?.avatar_url ?? null,
        rozet: 'Kurumsal',
      }}
      ustBaslik={{
        eyebrow: 'Kurumsal panel · Gösterge',
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
          etiket="Açık teklif talebi"
          deger={acikRfpSayisi}
          altNot="Yanıt toplanıyor"
          vurgu={acikRfpSayisi > 0 ? 'accent' : 'none'}
          href={kurulus.canViewEvents ? '/kurumsal/rfp' : undefined}
        />
        <KpiKutu
          etiket="Gelen teklif"
          deger={gelenTeklifSayisi}
          altNot="Taleplere gönderilen"
          href={kurulus.canViewEvents ? '/kurumsal/rfp' : undefined}
        />
        <KpiKutu
          etiket="Yaklaşan etkinlik"
          deger={ayEtkinlikSayisi}
          altNot="Bu ay"
          href={kurulus.canViewEvents ? '/etkinliklerim' : undefined}
        />
        <KpiKutu
          etiket="Onaylı rezervasyon"
          deger={onayliRezervasyonlar.length}
          altNot={
            onayliTutar > 0 ? `Toplam ${formatPrice(onayliTutar)}` : 'Tutar yok'
          }
          vurgu={onayliRezervasyonlar.length > 0 ? 'moss' : 'none'}
          href="/rezervasyonlarim"
        />
      </KpiSatir>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <PanelKart
            baslik="Teklif talepleri"
            tumuHref={kurulus.canViewEvents ? '/kurumsal/rfp' : undefined}
          >
            <VeriTablosu
              sutunlar={[
                { anahtar: 'baslik', baslik: 'Talep', kartEtiketiGizle: true },
                { anahtar: 'etkinlik', baslik: 'Etkinlik' },
                { anahtar: 'teklif', baslik: 'Teklif', sayisal: true },
                { anahtar: 'tarih', baslik: 'Son tarih' },
                { anahtar: 'durum', baslik: 'Durum' },
              ]}
              satirlar={rfpSatirlar}
              bosMetin="Henüz teklif talebi yok. Bir etkinlikten başlayabilirsin."
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
          <PanelKart baslik="Hızlı başlangıç">
            <div className="space-y-1.5">
              <Link
                href="/etkinlik-sihirbazi"
                className="kashe-tap block text-sm text-brand-ink hover:underline"
              >
                Yeni etkinlik tanımla →
              </Link>
              {kurulus.canManageEvents && (
                <Link
                  href="/kurumsal/rfp"
                  className="kashe-tap block text-sm text-brand-ink hover:underline"
                >
                  Teklif talebi aç →
                </Link>
              )}
              <Link
                href="/ilanlar/yeni"
                className="kashe-tap block text-sm text-brand-ink hover:underline"
              >
                İlan yayınla →
              </Link>
            </div>
          </PanelKart>

          <PanelKart baslik="Ekip">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-ink-72">Kuruluş üyesi</p>
              <p className="font-display text-xl text-ink tabular-nums">
                {uyeSayisi}
              </p>
            </div>
          </PanelKart>
        </aside>
      </div>
    </PanelKabugu>
  );
}
