import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { getCrewContext } from '@/app/lib/org-context';
import { panelMenusu } from '@/app/lib/panel-menu';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import {
  PanelKabugu,
  PanelKart,
  KpiKutu,
  KpiSatir,
  VeriTablosu,
  type VeriSatiri,
  type VeriSutunu,
} from '@/app/components/panel';
import { ModulKapali } from '@/app/components/tedarikci/modul-kapali';
import { YetkinYok } from '@/app/components/tedarikci/yetkin-yok';
import { TedarikciFiltreleri } from '@/app/components/tedarikci/tedarikci-filtreleri';
import {
  TedarikciFormKabi,
  YeniTedarikciDugmesi,
} from '@/app/components/tedarikci/tedarikci-form-kabi';
import {
  tedarikcileriListele,
  tedarikciSayilari,
} from '@/app/lib/tedarikci-data';
import { kategoriEtiketi, puanMetni } from '@/app/lib/tedarikci';

export const metadata = {
  title: 'Tedarikçiler — Kashe',
};

/**
 * FAZ 8c / P1 — tedarikci defteri (`/ajans/tedarikciler`).
 *
 * `?kurulus=<orgId>`: 8b kalibi — parametre yoksa defteri ACIK ilk kurulus.
 * Defter AJANSA OZEL (karar): `suppliersEnabled` hesap turunu de kontrol
 * ediyor, bu yuzden adres `/ajans` altinda ve kurumsal menude yok.
 *
 * `?q=` arama · `?kategori=` · `?arsiv=1` · `?yeni=tedarikci` form.
 *
 * YETKI: `suppliers.view` olmayan uye buraya GIRMEZ. RLS de keserdi ama bos
 * ekran yerine ne oldugunu yazan bir yuzey gosterilir.
 */
export default async function TedarikcilerPage({
  searchParams,
}: {
  searchParams: Promise<{
    kurulus?: string;
    q?: string;
    kategori?: string;
    arsiv?: string;
    yeni?: string;
  }>;
}) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/ajans/tedarikciler');

  const { data: profil } = await supabase
    .from('profiles')
    .select('suspended_at, avatar_url, is_admin')
    .eq('id', user.id)
    .single();
  if (profil?.suspended_at) return <SuspendedNotice />;

  const params = await searchParams;
  const { orgs } = await getCrewContext();

  const defterliler = orgs.filter((o) => o.suppliersEnabled);
  if (defterliler.length === 0 && orgs.length === 0) redirect('/profil');

  const kurulus =
    defterliler.find((o) => o.id === params.kurulus) ??
    orgs.find((o) => o.id === params.kurulus) ??
    defterliler[0] ??
    orgs[0];

  const menu = await panelMenusu();
  // Hesap karti TEK KAYNAK (hijyen 04): kisi adi ustte, kurulus alt satirda.
  const { hesap } = await panelKabukProps(kurulus.id);
  const kabukProps = {
    menu,
    yonetici: !!profil?.is_admin,
    hesap,
    ustBaslik: {
      eyebrow: `${kurulus.name} · Tedarikçiler`,
      baslik: (
        <em className="not-italic text-brand-accent">Tedarikçiler</em>
      ) as React.ReactNode,
    },
  };

  // --- Kapilar: yetki, sonra modul ---
  if (!kurulus.canViewSuppliers) {
    return (
      <PanelKabugu {...kabukProps}>
        <YetkinYok
          aciklama="Tedarikçi defteri kuruluş içi veridir; erişim için kuruluş yöneticisinden rol değişikliği istemelisin."
        />
      </PanelKabugu>
    );
  }

  if (!kurulus.suppliersEnabled) {
    return (
      <PanelKabugu {...kabukProps}>
        <ModulKapali
          baslik="Tedarikçiler modülü bu kuruluşta kapalı."
          aciklama="Açıldığında ses, ışık, catering gibi tedarikçileri deftere kaydedebilir, etkinliklere atayabilir ve anlaşılan tutarı iç maliyet olarak tutabilirsin."
          ayarlarAcilabilir={kurulus.canManageSettings}
        />
      </PanelKabugu>
    );
  }

  const arama = params.q ?? '';
  const kategoriFiltresi = params.kategori ?? '';
  const arsivGoster = params.arsiv === '1';

  const [kayitlar, sayilar, sehirSonuc, saglayiciSonuc] = await Promise.all([
    tedarikcileriListele(kurulus.id, {
      q: arama,
      kategori: kategoriFiltresi || null,
      arsiv: arsivGoster,
    }),
    tedarikciSayilari(kurulus.id),
    supabase.from('turkish_cities').select('id, name').order('name'),
    // Kashe bagi secimi — pazaryeri GORUNUMUNDEN (FAZ 2c sozlesmesi).
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
    { anahtar: 'ad', baslik: 'Ad', kartEtiketiGizle: true },
    { anahtar: 'yetkili', baslik: 'Yetkili' },
    { anahtar: 'telefon', baslik: 'Telefon', dar: true },
    { anahtar: 'puan', baslik: 'Puan' },
    { anahtar: 'etkinlik', baslik: 'Etkinlik', sayisal: true },
  ];

  const satirlar: VeriSatiri[] = kayitlar.map((t) => ({
    anahtar: t.id,
    href: `/ajans/tedarikciler/${t.id}`,
    hucreler: {
      ad: (
        <span className="block min-w-0">
          <span
            className={
              t.isActive
                ? 'block font-display font-semibold text-ink break-words'
                : 'block font-display font-semibold text-ink-50 break-words'
            }
          >
            {t.name}
          </span>
          <span className="block text-xs text-ink-72 break-words">
            {[kategoriEtiketi(t.category), t.cityName]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <span className="flex items-center gap-1.5 flex-wrap mt-1">
            {t.linkedProviderId && (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-sky bg-sky-12 border border-sky/25 px-1.5 py-0.5 rounded">
                Kashe
              </span>
            )}
            {!t.isActive && (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-50 bg-paper border border-line px-1.5 py-0.5 rounded">
                Arşiv
              </span>
            )}
          </span>
        </span>
      ),
      yetkili: t.contactName ?? '—',
      telefon: t.phone ?? '—',
      puan: (
        <span className="font-mono text-xs text-ink-72">
          {puanMetni(t.rating)}
        </span>
      ),
      etkinlik: t.etkinlikSayisi > 0 ? t.etkinlikSayisi : '—',
    },
  }));

  return (
    <PanelKabugu
      {...kabukProps}
      ustBaslik={{
        ...kabukProps.ustBaslik,
        sagAlan: kurulus.canManageSuppliers ? <YeniTedarikciDugmesi /> : undefined,
      }}
    >
      <KpiSatir>
        <KpiKutu etiket="Tedarikçi" deger={sayilar.aktif} altNot="Aktif kayıt" />
        <KpiKutu
          etiket="Kategori"
          deger={sayilar.kategori}
          altNot="Kullanılan"
        />
        <KpiKutu
          etiket="Aktif atama"
          deger={sayilar.aktifAtama}
          altNot="Planlandı + onaylandı"
          vurgu={sayilar.aktifAtama > 0 ? 'accent' : 'none'}
        />
        <KpiKutu etiket="Arşiv" deger={sayilar.arsiv} altNot="Pasif kayıt" />
      </KpiSatir>

      {kurulus.canManageSuppliers && (
        <TedarikciFormKabi
          organizationId={kurulus.id}
          sehirler={sehirler}
          saglayicilar={saglayicilar}
        />
      )}

      <PanelKart baslik="Defter">
        <TedarikciFiltreleri
          baslangicQ={arama}
          kategori={kategoriFiltresi}
          arsiv={arsivGoster}
        />
        <VeriTablosu
          sutunlar={sutunlar}
          satirlar={satirlar}
          bosMetin={
            arama.trim() || kategoriFiltresi
              ? 'Filtreye uyan tedarikçi yok.'
              : 'Henüz tedarikçi yok. "Yeni tedarikçi" ile ekleyebilirsin.'
          }
        />
      </PanelKart>

      <p className="text-xs text-ink-50 mt-5 leading-relaxed">
        E-posta, telefon ve yetkili bilgisi kuruluş içi bilgidir; pazaryeri
        sayfalarında ya da başka kuruluşlarda görünmez. Arşivdeki tedarikçi yeni
        etkinliklere atanamaz.{' '}
        <Link
          href={`/ajans?kurulus=${kurulus.id}`}
          className="text-brand-ink hover:underline"
        >
          Göstergeye dön →
        </Link>
      </p>
    </PanelKabugu>
  );
}
