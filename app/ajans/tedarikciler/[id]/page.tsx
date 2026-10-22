import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { getCrewContext } from '@/app/lib/org-context';
import { panelMenusu } from '@/app/lib/panel-menu';
import {
  PanelKabugu,
  PanelKart,
  VeriTablosu,
  type VeriSatiri,
  type VeriSutunu,
} from '@/app/components/panel';
import { AktiviteAkisi } from '@/app/components/gorevler/aktivite-akisi';
import { TedarikciDuzenle } from '@/app/components/tedarikci/tedarikci-duzenle';
import { tedarikciDetay } from '@/app/lib/tedarikci-data';
import {
  durumEtiketi,
  durumSinifi,
  kategoriEtiketi,
  puanMetni,
} from '@/app/lib/tedarikci';
import { tarihMetni } from '@/app/lib/tarih';

export const metadata = {
  title: 'Tedarikçi — Kashe',
};

/**
 * FAZ 8c / P1 — tedarikci sayfasi (`/ajans/tedarikciler/[id]`).
 *
 * Kurulus `?kurulus=` ile GELMEZ: tedarikci hangi kurulusun ise o kurulustan
 * okunur. Kullanicinin defteri acik kuruluslari sirayla denenir ve kayit
 * HANGISINDE bulunursa o baglam kullanilir — RLS zaten baska kurulusun
 * kaydini dondurmez, yani dongu bir yetki kapisi DEGIL, dogru baglami bulur
 * (8b kisi sayfasiyla ayni cozum).
 *
 * E-posta, telefon ve yetkili BURADA gorunur (kurulus ici yuzey); bu alanlar
 * baska bir kurulusa ya da pazaryeri sorgusuna TASINMAZ.
 */
export default async function TedarikciPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect(`/giris?redirect=/ajans/tedarikciler/${id}`);

  const { data: profil } = await supabase
    .from('profiles')
    .select('suspended_at, avatar_url, is_admin')
    .eq('id', user.id)
    .single();
  if (profil?.suspended_at) return <SuspendedNotice />;

  const { orgs } = await getCrewContext();
  const adaylar = orgs.filter((o) => o.suppliersEnabled && o.canViewSuppliers);
  if (adaylar.length === 0) redirect('/profil');

  let kurulus = adaylar[0];
  let detay = await tedarikciDetay(kurulus.id, id);
  if (!detay) {
    for (const o of adaylar.slice(1)) {
      const d = await tedarikciDetay(o.id, id);
      if (d) {
        kurulus = o;
        detay = d;
        break;
      }
    }
  }
  if (!detay) notFound();

  const { tedarikci, bagliSaglayiciAdi, etkinlikler, aktiviteKimlikleri } =
    detay;
  const menu = await panelMenusu();

  // Duzenleme formunun secenekleri — yalniz yazma yetkisi varken okunur.
  const [sehirSonuc, saglayiciSonuc] = await Promise.all([
    kurulus.canManageSuppliers
      ? supabase.from('turkish_cities').select('id, name').order('name')
      : Promise.resolve({ data: [], error: null }),
    kurulus.canManageSuppliers
      ? supabase
          .from('v_providers_public')
          .select('id, display_name, provider_type')
          .eq('is_published', true)
          .order('display_name')
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const sehirler = (
    (sehirSonuc.data ?? []) as { id: number; name: string }[]
  ).map((s) => ({ id: s.id, ad: s.name }));

  const saglayicilar = (
    (saglayiciSonuc.data ?? []) as {
      id: string;
      display_name: string | null;
      provider_type: string;
    }[]
  ).map((s) => ({
    id: s.id,
    ad: s.display_name?.trim() || 'İsimsiz profil',
    tur: s.provider_type,
  }));

  const sutunlar: VeriSutunu[] = [
    { anahtar: 'etkinlik', baslik: 'Etkinlik', kartEtiketiGizle: true },
    { anahtar: 'tarih', baslik: 'Tarih', dar: true },
    { anahtar: 'hizmet', baslik: 'Hizmet' },
    { anahtar: 'durum', baslik: 'Durum' },
  ];

  const satirlar: VeriSatiri[] = etkinlikler.map((e) => ({
    anahtar: e.atamaId,
    href: `/etkinliklerim/${e.eventId}?sekme=tedarikciler`,
    hucreler: {
      etkinlik: (
        <span className="block font-display font-semibold text-ink break-words">
          {e.eventTitle ?? 'Etkinlik'}
        </span>
      ),
      tarih: e.startDate ? (tarihMetni(e.startDate) ?? '—') : '—',
      hizmet: e.service ?? '—',
      durum: (
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.12em] border px-2 py-0.5 rounded ${durumSinifi(e.status)}`}
        >
          {durumEtiketi(e.status)}
        </span>
      ),
    },
  }));

  const bilgiSatirlari: { etiket: string; deger: React.ReactNode }[] = [
    { etiket: 'Kategori', deger: kategoriEtiketi(tedarikci.category) },
    { etiket: 'Yetkili', deger: tedarikci.contactName ?? 'Belirtilmedi' },
    { etiket: 'E-posta', deger: tedarikci.email ?? 'Belirtilmedi' },
    { etiket: 'Telefon', deger: tedarikci.phone ?? 'Belirtilmedi' },
    { etiket: 'Şehir', deger: tedarikci.cityName ?? 'Belirtilmedi' },
    { etiket: 'Puan', deger: puanMetni(tedarikci.rating) },
  ];
  if (tedarikci.website) {
    bilgiSatirlari.push({
      etiket: 'Web',
      deger: (
        <a
          href={
            tedarikci.website.startsWith('http')
              ? tedarikci.website
              : `https://${tedarikci.website}`
          }
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-brand-ink hover:underline break-all"
        >
          {tedarikci.website}
        </a>
      ),
    });
  }
  if (tedarikci.linkedProviderId) {
    bilgiSatirlari.push({
      etiket: 'Kashe kaydı',
      deger: (
        // `v_providers_public.id` PROFIL kimligidir — baglanti kalibi
        // Kesfet'teki gibi `/p/<id>`.
        <Link
          href={`/p/${tedarikci.linkedProviderId}`}
          className="text-brand-ink hover:underline break-words"
        >
          {bagliSaglayiciAdi ?? 'Profili gör'} →
        </Link>
      ),
    });
  }

  return (
    <PanelKabugu
      menu={menu}
      yonetici={!!profil?.is_admin}
      hesap={{
        ad: kurulus.name,
        altSatir:
          kurulus.accountType === 'agency' ? 'Ajans hesabı' : 'Kurumsal hesap',
        avatarUrl: profil?.avatar_url ?? null,
        rozet: kurulus.accountType === 'agency' ? 'Ajans' : 'Kurumsal',
      }}
      ustBaslik={{
        eyebrow: [kategoriEtiketi(tedarikci.category), tedarikci.cityName]
          .filter(Boolean)
          .join(' · '),
        baslik: (
          <span className="flex items-center gap-2.5 flex-wrap">
            <span>{tedarikci.name}</span>
            {!tedarikci.isActive && (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-50 bg-paper border border-line px-2 py-0.5 rounded">
                Arşiv
              </span>
            )}
          </span>
        ),
        sagAlan: (
          <Link
            href={`/ajans/tedarikciler?kurulus=${kurulus.id}`}
            className="kashe-tap px-4 py-2 border border-line text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink transition-colors"
          >
            Defter →
          </Link>
        ),
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-6">
        <div className="min-w-0 space-y-6">
          <PanelKart baslik="Etkinlikler">
            <VeriTablosu
              sutunlar={sutunlar}
              satirlar={satirlar}
              bosMetin="Bu tedarikçi henüz bir etkinliğe atanmadı."
            />
          </PanelKart>

          <PanelKart baslik="Aktivite">
            {/* Kapsam: tedarikcinin kendi kaydi + atamalari (aktivite satirlari
                atamanin kimligini tasiyor, tedarikcinin degil). */}
            <AktiviteAkisi
              orgId={kurulus.id}
              entityIds={aktiviteKimlikleri}
              bosMetin="Henüz aktivite yok. Tedarikçi ve atama değişiklikleri burada görünür."
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

            {tedarikci.notes && (
              <div className="mt-4 pt-4 border-t border-line">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1.5">
                  Not
                </p>
                <p className="text-sm text-ink-72 whitespace-pre-wrap break-words">
                  {tedarikci.notes}
                </p>
              </div>
            )}
          </PanelKart>

          {kurulus.canManageSuppliers && (
            <PanelKart baslik="Yönet">
              <TedarikciDuzenle
                organizationId={kurulus.id}
                tedarikci={{
                  id: tedarikci.id,
                  isActive: tedarikci.isActive,
                  name: tedarikci.name,
                  category: tedarikci.category,
                  contactName: tedarikci.contactName ?? '',
                  email: tedarikci.email ?? '',
                  phone: tedarikci.phone ?? '',
                  website: tedarikci.website ?? '',
                  cityId: tedarikci.cityId ? String(tedarikci.cityId) : '',
                  rating: tedarikci.rating ? String(tedarikci.rating) : '',
                  notes: tedarikci.notes ?? '',
                  linkedProviderId: tedarikci.linkedProviderId ?? '',
                  linkedProviderName: bagliSaglayiciAdi,
                }}
                sehirler={sehirler}
                saglayicilar={saglayicilar}
                atamaSayisi={etkinlikler.length}
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
