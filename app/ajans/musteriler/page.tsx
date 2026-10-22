import Link from 'next/link';
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
  VeriTablosu,
  type VeriSatiri,
  type VeriSutunu,
} from '@/app/components/panel';
import { CrmModuluKapali } from '@/app/components/crm/crm-modul-kapali';
import { FirsatPanosu } from '@/app/components/crm/firsat-panosu';
import { KisiArama } from '@/app/components/crm/kisi-arama';
import { OnerilerSeridi } from '@/app/components/crm/oneriler-seridi';
import { YeniKayitDugmeleri } from '@/app/components/crm/yeni-kayit-dugmeleri';
import { YeniKayitFormu } from '@/app/components/crm/yeni-kayit-formu';
import {
  crmSayilari,
  firsatlariListele,
  kisileriListele,
  teklifOnerileri,
  uyeSecenekleri,
} from '@/app/lib/crm-data';
import { kisiTuruEtiketi } from '@/app/lib/crm';
import { formatTL } from '@/app/lib/para';
import { goreliZaman, tarihMetni } from '@/app/lib/tarih';
import {
  etkinlikEtiketi,
  teklifEtiketi,
} from '@/app/lib/secim-etiketi';

export const metadata = {
  title: 'Müşteriler — Kashe',
};

/**
 * FAZ 8b / P1 — kurulus musteri ve firsat yuzeyi (`/ajans/musteriler`).
 *
 * `?kurulus=<orgId>`: 8a `kurulus/gorevler` kalibi — parametre yoksa CRM'i ACIK
 * ilk kurulus secilir. CRM AJANSA OZEL (karar, 21 Ekim): `crmEnabled` hesap
 * turunu de kontrol ediyor, bu yuzden adres `/ajans` altinda.
 *
 * `?firsat=<id>`: firsat paneli (bildirim baglantisi bu adresi yaziyor).
 * `?sekme=firsatlar|kisiler`, `?q=` arama, `?yeni=kisi|firsat` form.
 *
 * YETKI: `crm.view` olmayan uye buraya GIRMEZ (403 karti). RLS de keserdi ama
 * bos bir ekran yerine ne oldugunu yazan bir yuzey gosterilir.
 */
export default async function MusterilerPage({
  searchParams,
}: {
  searchParams: Promise<{
    kurulus?: string;
    sekme?: string;
    firsat?: string;
    q?: string;
    yeni?: string;
  }>;
}) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/ajans/musteriler');

  const { data: profil } = await supabase
    .from('profiles')
    .select('suspended_at, avatar_url, is_admin')
    .eq('id', user.id)
    .single();
  if (profil?.suspended_at) return <SuspendedNotice />;

  const params = await searchParams;
  const { orgs } = await getCrewContext();

  // Listeye yalniz CRM modulu acik kuruluslar girer; yetki ayrica kontrol
  // edilir (modul acik ama `crm.view` yoksa 403 yuzeyi cikar).
  const crmliler = orgs.filter((o) => o.crmEnabled);
  if (crmliler.length === 0 && orgs.length === 0) redirect('/profil');

  const kurulus =
    crmliler.find((o) => o.id === params.kurulus) ??
    orgs.find((o) => o.id === params.kurulus) ??
    crmliler[0] ??
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
  };

  // --- Kapilar: yetki, sonra modul ---
  if (!kurulus.canViewCrm) {
    return (
      <PanelKabugu
        {...kabukProps}
        ustBaslik={{
          eyebrow: `${kurulus.name} · Müşteriler`,
          baslik: <em className="not-italic text-brand-accent">Müşteriler</em>,
        }}
      >
        <div className="bg-card border border-line rounded-xl p-6">
          <p className="text-sm text-ink">
            Bu sayfayı görmek için yetkin yok.
          </p>
          <p className="text-sm text-ink-72 mt-1.5">
            Müşteri ve fırsat kayıtları kuruluş içi veridir; erişim için
            kuruluş yöneticisinden rol değişikliği istemelisin.
          </p>
          <Link
            href="/ajans"
            className="kashe-tap mt-4 inline-block text-sm text-brand-ink hover:underline"
          >
            Göstergeye dön →
          </Link>
        </div>
      </PanelKabugu>
    );
  }

  if (!kurulus.crmEnabled) {
    return (
      <PanelKabugu
        {...kabukProps}
        ustBaslik={{
          eyebrow: `${kurulus.name} · Müşteriler`,
          baslik: <em className="not-italic text-brand-accent">Müşteriler</em>,
        }}
      >
        <CrmModuluKapali ayarlarAcilabilir={kurulus.canManageSettings} />
      </PanelKabugu>
    );
  }

  const sekme = params.sekme === 'kisiler' ? 'kisiler' : 'firsatlar';
  const arama = params.q ?? '';

  const [
    sayilar,
    firsatlar,
    kisiler,
    uyeler,
    oneriler,
    etkinlikSonuc,
    teklifSonuc,
  ] = await Promise.all([
    crmSayilari(kurulus.id),
    firsatlariListele(kurulus.id),
    kisileriListele(kurulus.id, { q: arama }),
    uyeSecenekleri(kurulus.id),
    kurulus.canManageCrm ? teklifOnerileri(kurulus.id) : Promise.resolve([]),
    supabase
      .from('events')
      .select('id, title, event_type, start_date')
      .eq('organization_id', kurulus.id)
      .order('start_date', { ascending: false })
      .limit(100),
    supabase
      .from('proposals')
      .select('id, title, status, created_at')
      .eq('seller_organization_id', kurulus.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  // Etiketler ortak yardimciyla (hijyen 04): ayni baslikli iki kayit secim
  // kutusunda birbirinin aynisi gorunmesin.
  const etkinlikSecenekleri = (
    (etkinlikSonuc.data ?? []) as {
      id: string;
      title: string | null;
      event_type: string;
      start_date: string | null;
    }[]
  ).map((e) => ({ id: e.id, ad: etkinlikEtiketi(e) }));

  const teklifSecenekleri = (
    (teklifSonuc.data ?? []) as {
      id: string;
      title: string | null;
      status: string;
      created_at: string;
    }[]
  ).map((t) => ({ id: t.id, ad: teklifEtiketi(t) }));

  // Form icin kisi listesi — ARAMADAN BAGIMSIZ olmali: kullanici tabloda
  // arama yaparken yeni firsat formundaki kisi listesi daralmasin.
  const formKisileri =
    arama.trim().length >= 2
      ? (await kisileriListele(kurulus.id)).map((k) => ({
          id: k.id,
          ad: k.fullName,
          firma: k.companyName,
        }))
      : kisiler.map((k) => ({
          id: k.id,
          ad: k.fullName,
          firma: k.companyName,
        }));

  const sutunlar: VeriSutunu[] = [
    { anahtar: 'ad', baslik: 'Ad', kartEtiketiGizle: true },
    { anahtar: 'eposta', baslik: 'E-posta' },
    { anahtar: 'telefon', baslik: 'Telefon', dar: true },
    { anahtar: 'firsat', baslik: 'Açık fırsat', sayisal: true },
    { anahtar: 'aktivite', baslik: 'Son aktivite', dar: true },
  ];

  const satirlar: VeriSatiri[] = kisiler.map((k) => ({
    anahtar: k.id,
    href: `/ajans/musteriler/${k.id}`,
    hucreler: {
      ad: (
        <span className="block min-w-0">
          <span className="block font-display font-semibold text-ink break-words">
            {k.fullName}
          </span>
          <span className="block text-xs text-ink-72 break-words">
            {[k.companyName, kisiTuruEtiketi(k.kind)]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      ),
      eposta: k.email ?? '—',
      telefon: k.phone ?? '—',
      firsat: k.acikFirsat > 0 ? k.acikFirsat : '—',
      aktivite: k.sonAktivite ? goreliZaman(k.sonAktivite) : '—',
    },
  }));

  return (
    <PanelKabugu
      {...kabukProps}
      ustBaslik={{
        eyebrow: `${kurulus.name} · Müşteriler`,
        baslik: (
          <>
            <em className="not-italic text-brand-accent">Müşteriler</em> ve
            fırsatlar
          </>
        ),
        sagAlan: kurulus.canManageCrm ? <YeniKayitDugmeleri /> : undefined,
      }}
    >
      <KpiSatir>
        <KpiKutu
          etiket="Açık fırsat"
          deger={sayilar.acikFirsat}
          altNot="Kapanmamış"
        />
        <KpiKutu
          etiket="Beklenen tutar"
          deger={formatTL(sayilar.beklenenTutar) || '—'}
          altNot="Açık fırsatların tahmini"
          vurgu="accent"
        />
        <KpiKutu
          etiket="Bu ay kazanılan"
          deger={sayilar.buAyKazanilanAdet}
          altNot={
            sayilar.buAyKazanilanTutar > 0
              ? formatTL(sayilar.buAyKazanilanTutar)
              : 'Tutar girilmedi'
          }
          vurgu={sayilar.buAyKazanilanAdet > 0 ? 'moss' : 'none'}
        />
        <KpiKutu etiket="Kişi" deger={sayilar.kisiSayisi} altNot="Toplam" />
      </KpiSatir>

      {kurulus.canManageCrm && (
        <YeniKayitFormu
          organizationId={kurulus.id}
          kisiler={formKisileri}
          uyeler={uyeler}
          etkinlikler={etkinlikSecenekleri}
          teklifler={teklifSecenekleri}
          kullaniciId={user.id}
        />
      )}

      {/* Sekmeler — URL'ye bagli (8a deseni); `firsat` paneli sekme degisince
          kapanir, cunku panel yalniz firsat panosunun yaninda anlamli. */}
      <div className="flex items-center gap-1 border-b border-line mb-6">
        {(
          [
            { anahtar: 'firsatlar', etiket: 'Fırsatlar', sayi: firsatlar.length },
            { anahtar: 'kisiler', etiket: 'Kişiler', sayi: sayilar.kisiSayisi },
          ] as const
        ).map((t) => {
          const etkin = sekme === t.anahtar;
          const hedef = new URLSearchParams();
          hedef.set('kurulus', kurulus.id);
          if (t.anahtar !== 'firsatlar') hedef.set('sekme', t.anahtar);
          return (
            <Link
              key={t.anahtar}
              href={`/ajans/musteriler?${hedef.toString()}`}
              className={
                etkin
                  ? 'kashe-tap px-4 py-2.5 font-display font-semibold text-sm text-ink border-b-2 border-brand-accent -mb-px'
                  : 'kashe-tap px-4 py-2.5 font-display font-semibold text-sm text-ink-72 hover:text-ink border-b-2 border-transparent -mb-px'
              }
            >
              {t.etiket}
              <span className="ml-1.5 font-mono text-[10px] text-ink-50 tabular-nums">
                {t.sayi}
              </span>
            </Link>
          );
        })}
      </div>

      {sekme === 'firsatlar' ? (
        firsatlar.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-6">
            <p className="text-sm text-ink">Henüz fırsat yok.</p>
            <p className="text-sm text-ink-72 mt-1.5">
              Bir kişi ekleyip ona fırsat açtığında burada aşamalara göre
              görünür.
            </p>
          </div>
        ) : (
          <FirsatPanosu
            firsatlar={firsatlar}
            uyeler={uyeler}
            etkinlikler={etkinlikSecenekleri}
            teklifler={teklifSecenekleri}
            yazabilir={kurulus.canManageCrm}
          />
        )
      ) : (
        <>
          {kurulus.canManageCrm && oneriler.length > 0 && (
            <OnerilerSeridi
              organizationId={kurulus.id}
              oneriler={oneriler}
            />
          )}
          <PanelKart baslik="Kişiler">
            <KisiArama baslangic={arama} />
            <VeriTablosu
              sutunlar={sutunlar}
              satirlar={satirlar}
              bosMetin={
                arama.trim()
                  ? 'Aramaya uyan kişi yok.'
                  : 'Henüz kişi yok. "Yeni kişi" ile ekleyebilirsin.'
              }
            />
          </PanelKart>
        </>
      )}

      {/* Gecikmis sonraki adimlar — panodan bagimsiz kucuk hatirlatma satiri. */}
      {sekme === 'firsatlar' &&
        (() => {
          const gecikmis = firsatlar.filter(
            (f) =>
              f.nextStepAt &&
              new Date(f.nextStepAt).getTime() < Date.now() &&
              f.stage !== 'won' &&
              f.stage !== 'lost'
          );
          if (gecikmis.length === 0) return null;
          return (
            <p className="text-xs text-ink-50 mt-5 leading-relaxed">
              Sonraki adım tarihi geçmiş {gecikmis.length} fırsat var; kartlarda
              &quot;Gecikti&quot; rozetiyle işaretli. En yakını{' '}
              {tarihMetni(gecikmis[0].nextStepAt) ?? '—'}.
            </p>
          );
        })()}
    </PanelKabugu>
  );
}
