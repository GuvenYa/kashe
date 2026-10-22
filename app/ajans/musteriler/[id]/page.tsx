import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { getCrewContext } from '@/app/lib/org-context';
import { panelMenusu } from '@/app/lib/panel-menu';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import {
  PanelKabugu,
  PanelKart,
  VeriTablosu,
  type VeriSatiri,
  type VeriSutunu,
} from '@/app/components/panel';
import { AktiviteAkisi } from '@/app/components/gorevler/aktivite-akisi';
import { KisiDuzenle } from '@/app/components/crm/kisi-duzenle';
import { kisiDetay } from '@/app/lib/crm-data';
import { asamaEtiketi, asamaSinifi, kisiTuruEtiketi } from '@/app/lib/crm';
import { formatTL } from '@/app/lib/para';
import { tarihMetni } from '@/app/lib/tarih';
import { TEKLIF_DURUM_ETIKETLERI } from '@/app/ajans/teklifler/teklif-data';

export const metadata = {
  title: 'Kişi — Kashe',
};

/**
 * FAZ 8b / P1 — kisi sayfasi (`/ajans/musteriler/[id]`).
 *
 * Kurulus `?kurulus=` ile GELMEZ: kisi hangi kurulusun ise o kurulustan okunur.
 * Kullanicinin CRM'i acik kuruluslari sirayla denenir ve kisi HANGISINDE
 * bulunursa o baglam kullanilir — RLS zaten baska kurulusun kisisini
 * dondurmez, yani dongu bir yetki kapisi DEGIL, yalniz dogru baglami bulur.
 *
 * E-posta/telefon BURADA gorunur (kurulus ici yuzey); bu alanlar baska bir
 * kurulusa ya da pazaryeri sorgusuna TASINMAZ.
 */
export default async function KisiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect(`/giris?redirect=/ajans/musteriler/${id}`);

  const { data: profil } = await supabase
    .from('profiles')
    .select('suspended_at, avatar_url, is_admin')
    .eq('id', user.id)
    .single();
  if (profil?.suspended_at) return <SuspendedNotice />;

  const { orgs } = await getCrewContext();
  const adaylar = orgs.filter((o) => o.crmEnabled && o.canViewCrm);
  if (adaylar.length === 0) redirect('/profil');

  let kurulus = adaylar[0];
  let detay = await kisiDetay(kurulus.id, id);
  if (!detay) {
    for (const o of adaylar.slice(1)) {
      const d = await kisiDetay(o.id, id);
      if (d) {
        kurulus = o;
        detay = d;
        break;
      }
    }
  }
  if (!detay) notFound();

  const { kisi, firsatlar, teklifler, aktiviteKimlikleri } = detay;
  const menu = await panelMenusu();
  // Hesap karti TEK KAYNAK (hijyen 04).
  const { hesap } = await panelKabukProps(kurulus.id);

  const firsatSutunlari: VeriSutunu[] = [
    { anahtar: 'baslik', baslik: 'Başlık', kartEtiketiGizle: true },
    { anahtar: 'asama', baslik: 'Aşama' },
    { anahtar: 'tutar', baslik: 'Tutar', sayisal: true },
    { anahtar: 'beklenen', baslik: 'Beklenen', dar: true },
    { anahtar: 'sahip', baslik: 'Sahip', dar: true },
  ];

  const firsatSatirlari: VeriSatiri[] = firsatlar.map((f) => ({
    anahtar: f.id,
    href: `/ajans/musteriler?kurulus=${kurulus.id}&firsat=${f.id}`,
    hucreler: {
      baslik: (
        <span className="block font-display font-semibold text-ink break-words">
          {f.title}
        </span>
      ),
      asama: (
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.12em] border px-2 py-0.5 rounded ${asamaSinifi(f.stage)}`}
        >
          {asamaEtiketi(f.stage)}
        </span>
      ),
      tutar: f.estimatedValue !== null ? formatTL(f.estimatedValue) : '—',
      beklenen: f.expectedDate ? (tarihMetni(f.expectedDate) ?? '—') : '—',
      sahip: f.sahipAdi ?? '—',
    },
  }));

  const teklifSutunlari: VeriSutunu[] = [
    { anahtar: 'baslik', baslik: 'Başlık', kartEtiketiGizle: true },
    { anahtar: 'durum', baslik: 'Durum' },
    { anahtar: 'tutar', baslik: 'Tutar', sayisal: true },
  ];

  const teklifSatirlari: VeriSatiri[] = teklifler.map((t) => ({
    anahtar: t.id,
    href: `/ajans/teklifler/${t.id}`,
    hucreler: {
      baslik: (
        <span className="block font-display font-semibold text-ink break-words">
          {t.title}
        </span>
      ),
      durum: TEKLIF_DURUM_ETIKETLERI[t.status] ?? t.status,
      tutar: t.total !== null ? formatTL(t.total) : '—',
    },
  }));

  const bilgiSatirlari: { etiket: string; deger: string }[] = [
    { etiket: 'Tür', deger: kisiTuruEtiketi(kisi.kind) },
    { etiket: 'E-posta', deger: kisi.email ?? 'Belirtilmedi' },
    { etiket: 'Telefon', deger: kisi.phone ?? 'Belirtilmedi' },
  ];
  if (kisi.companyName) {
    bilgiSatirlari.splice(1, 0, {
      etiket: 'Firma',
      deger: kisi.companyName,
    });
  }

  return (
    <PanelKabugu
      menu={menu}
      yonetici={!!profil?.is_admin}
      hesap={hesap}
      ustBaslik={{
        eyebrow: [kisiTuruEtiketi(kisi.kind), kisi.companyName]
          .filter(Boolean)
          .join(' · '),
        baslik: <>{kisi.fullName}</>,
        sagAlan: (
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/ajans/musteriler?kurulus=${kurulus.id}`}
              className="kashe-tap px-4 py-2 border border-line text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink transition-colors"
            >
              Müşteriler →
            </Link>
          </div>
        ),
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-6">
        <div className="min-w-0 space-y-6">
          <PanelKart baslik="Fırsatlar">
            <VeriTablosu
              sutunlar={firsatSutunlari}
              satirlar={firsatSatirlari}
              bosMetin="Bu kişinin fırsatı yok."
            />
            {kurulus.canManageCrm && (
              <Link
                href={`/ajans/musteriler?kurulus=${kurulus.id}&yeni=firsat`}
                className="kashe-tap mt-4 inline-block text-sm text-brand-ink hover:underline"
              >
                + Yeni fırsat
              </Link>
            )}
          </PanelKart>

          <PanelKart baslik="Teklifler">
            <VeriTablosu
              sutunlar={teklifSutunlari}
              satirlar={teklifSatirlari}
              bosMetin="Bu kişiye bağlı teklif yok."
            />
          </PanelKart>

          <PanelKart baslik="Aktivite">
            {/* Kapsam: kisinin kendi kaydi + firsatlari (aktivite satirlari
                firsatin kimligini tasiyor, kisinin degil). */}
            <AktiviteAkisi
              orgId={kurulus.id}
              entityIds={aktiviteKimlikleri}
              bosMetin="Henüz aktivite yok. Kişi ve fırsat değişiklikleri burada görünür."
            />
          </PanelKart>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start space-y-6">
          <PanelKart baslik="Bilgiler">
            <dl className="space-y-3">
              {bilgiSatirlari.map((s) => (
                <div
                  key={s.etiket}
                  className="flex items-start justify-between gap-4 flex-wrap"
                >
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                    {s.etiket}
                  </dt>
                  <dd className="text-sm text-ink text-right break-words min-w-0">
                    {s.deger}
                  </dd>
                </div>
              ))}
            </dl>

            {kisi.notes && (
              <div className="mt-4 pt-4 border-t border-line">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1.5">
                  Not
                </p>
                <p className="text-sm text-ink-72 whitespace-pre-wrap break-words">
                  {kisi.notes}
                </p>
              </div>
            )}

            {(kisi.linkedUserId || kisi.linkedOrganizationId) && (
              <p className="text-xs text-ink-50 mt-4 pt-4 border-t border-line leading-relaxed">
                Bu kayıt bir Kashe
                {kisi.linkedUserId ? ' kullanıcısına' : ' kuruluşuna'} bağlı.
              </p>
            )}
          </PanelKart>

          {kurulus.canManageCrm && (
            <PanelKart baslik="Düzenle">
              <KisiDuzenle
                organizationId={kurulus.id}
                kisi={{
                  id: kisi.id,
                  kind: kisi.kind,
                  fullName: kisi.fullName,
                  companyName: kisi.companyName ?? '',
                  email: kisi.email ?? '',
                  phone: kisi.phone ?? '',
                  notes: kisi.notes ?? '',
                }}
                silinebilir={firsatlar.length === 0}
                kurulusId={kurulus.id}
              />
            </PanelKart>
          )}

          <p className="text-xs text-ink-50 leading-relaxed">
            E-posta ve telefon kuruluş içi bilgidir; pazaryeri sayfalarında ya
            da başka kuruluşlarda görünmez.
          </p>
        </aside>
      </div>
    </PanelKabugu>
  );
}
