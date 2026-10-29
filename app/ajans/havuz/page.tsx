import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PanelKabugu, PanelBaslik } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { getTalentPoolContext } from '@/app/lib/org-context';
import { orderCities } from '@/app/lib/city-order';
import { HavuzPaneli } from './havuz-paneli';
import type {
  HavuzKaydi,
  HavuzRolSecenegi,
  HavuzSaglayici,
  HavuzSehir,
} from './havuz-data';

export const metadata = {
  title: 'Yetenek Havuzu — Kashe',
};

export default async function AjansHavuzPage({
  searchParams,
}: {
  searchParams: Promise<{ kurulus?: string }>;
}) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/ajans/havuz');

  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  // D1b-2: calisma sayfasi panel kabugunda; menu ve hesap karti tek
  // yerden (app/lib/panel-kabuk.ts).
  const kabuk = await panelKabukProps();

  const { orgs } = await getTalentPoolContext();

  if (orgs.length === 0) {
    return (
      <PanelKabugu {...kabuk}>
        <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-ink mb-4">
              Erişim yok
            </p>
            <h1 className="font-display text-4xl text-ink mb-3">
              Yetenek havuzu{' '}
              <em className="not-italic font-medium text-brand-accent">
                ajans hesapları
              </em>{' '}
              içindir
            </h1>
            <p className="text-ink-72 mb-8">
              Bu sayfayı görmek için bir ajans kuruluşunda yetenek havuzu yetkin
              olması gerekiyor.
            </p>
            <Link
              href="/profil"
              className="inline-block px-6 py-3 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
            >
              Profile dön
            </Link>
          </div>
      </PanelKabugu>
  );
  }

  const params = await searchParams;
  const secili = orgs.find((o) => o.id === params.kurulus) ?? orgs[0];

  // Kendi kendini onarma: Ekibim uyelerinin havuz kaydi eksikse tamamlanir.
  // Hata akisi KESMEZ (yalniz loglanir); yetkisi olmayan icin RPC 42501 doner.
  let eklenenSayisi = 0;
  if (secili.canManage) {
    const { data: eklenen, error: syncHatasi } = await supabase.rpc(
      'sync_org_talent_pool',
      { p_org_id: secili.id }
    );
    if (syncHatasi) console.error('[havuz] sync', syncHatasi);
    else if (typeof eklenen === 'number') eklenenSayisi = eklenen;
  }

  // `invitation_token` SECILMEZ — sutun yetkisi yok (secilirse 42501).
  const [kayitRes, rolRes, sehirRes] = await Promise.all([
    supabase
      .from('organization_talent_records')
      .select(
        `
        id, talent_id, name, email, phone, city_id, instagram, notes, source,
        relationship_type, status, invitation_status, invitation_sent_at, linked_at, created_at,
        legacy_agency_member_id,
        turkish_cities(name),
        talents(user_id),
        organization_talent_record_roles(id, role_id, is_primary, service_roles(slug, name_tr))
      `
      )
      .eq('organization_id', secili.id)
      .order('name'),
    supabase
      .from('service_roles')
      .select('id, slug, name_tr')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.from('turkish_cities').select('id, name').order('name'),
  ]);

  if (kayitRes.error) console.error('[havuz] kayit listesi', kayitRes.error);

  // FAZ 5/P3-ek — "Ekibim'den yonetilir" (Sil gizli) yalniz AKTIF Ekibim uyeliginde:
  // `legacy_agency_member_id` dolu VE o satir Ekibim uyeligi
  // (`organization_memberships`) olarak hala var. Tek sorgu.
  //
  // FAZ 10a: kaynak eski uyelik tablosu DEGIL, kurulus uyeligi. Sutun adi
  // `legacy_agency_member_id` kaldi ama uyelik kimligini tasiyor (ayna
  // doneminde iki id ayniydi; ad Hijyen 05'te duzelir).
  //
  // RLS satiri gizlerse kume bos doner -> Sil GORUNUR. O yoldan yanlis silinen
  // kayit, sayfa acilisindaki `sync_org_talent_pool` ile kendini onarir.
  const hamKayitlar = (kayitRes.data ?? []) as unknown as Omit<
    HavuzKaydi,
    'ekibimUyesi'
  >[];

  const legacyIdler = [
    ...new Set(
      hamKayitlar
        .map((k) => k.legacy_agency_member_id)
        .filter((v): v is string => !!v)
    ),
  ];

  let aktifUyelikIdleri = new Set<string>();
  if (legacyIdler.length > 0) {
    const { data: uyelikler, error: uyelikHatasi } = await supabase
      .from('organization_memberships')
      .select('id')
      .in('id', legacyIdler)
      .eq('status', 'active');
    if (uyelikHatasi) console.error('[havuz] ekibim uyelikleri', uyelikHatasi);
    aktifUyelikIdleri = new Set(
      ((uyelikler ?? []) as { id: string }[]).map((u) => u.id)
    );
  }

  const kayitlar: HavuzKaydi[] = hamKayitlar.map((k) => ({
    ...k,
    ekibimUyesi:
      !!k.legacy_agency_member_id &&
      aktifUyelikIdleri.has(k.legacy_agency_member_id),
  }));
  const roller = (rolRes.data ?? []) as unknown as HavuzRolSecenegi[];
  const sehirler = orderCities(
    (sehirRes.data ?? []) as { id: number; name: string }[]
  ) as HavuzSehir[];

  // Kashe uyesi satirlar icin pazaryeri bilgisi (ad/avatar/link).
  // DIKKAT: `talents.id` != `profiles.id`; kullanici id'si `talents(user_id)` embed'inden.
  const kullaniciIdleri = kayitlar
    .map((k) => k.talents?.user_id)
    .filter((v): v is string => !!v);

  let saglayicilar: HavuzSaglayici[] = [];
  if (kullaniciIdleri.length > 0) {
    const { data: sagRes, error: sagHatasi } = await supabase
      .from('v_providers_public')
      .select('id, display_name, avatar_url, provider_slug, city_id, is_published')
      .in('id', kullaniciIdleri);
    if (sagHatasi) console.error('[havuz] saglayici bilgisi', sagHatasi);
    saglayicilar = (sagRes ?? []) as unknown as HavuzSaglayici[];
  }


  return (
    <PanelKabugu {...kabuk}>
      <div className="max-w-5xl">
          <PanelBaslik
            eyebrow={<>{secili.name}</>}
            altNot="Ekibin, Kashe üyeleri ve Kashe hesabı olmayan harici kişiler tek listede. Roller ve ilişki türü kişi başına tutulur."
          >
            <em className="not-italic font-medium text-brand-accent">
              Yetenek
            </em>{' '}
            havuzu
          </PanelBaslik>

          <div className="mb-8">
            {eklenenSayisi > 0 && (
              <p className="mt-4 px-4 py-2.5 bg-brand-ink-08 border border-brand-ink/25 rounded-lg text-sm text-ink">
                {eklenenSayisi} Ekibim üyesi havuza eklendi.
              </p>
            )}

            {orgs.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {orgs.map((o) => (
                  <Link
                    key={o.id}
                    href={`/ajans/havuz?kurulus=${o.id}`}
                    className={
                      o.id === secili.id
                        ? 'kashe-tap px-4 py-2 rounded-full border text-sm font-medium bg-brand-ink border-brand-ink text-paper'
                        : 'kashe-tap px-4 py-2 rounded-full border text-sm font-medium bg-card border-line text-ink-72 hover:border-brand-ink hover:text-brand-ink transition-colors'
                    }
                  >
                    {o.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <HavuzPaneli
            organizationId={secili.id}
            canManage={secili.canManage}
            canSeeRates={secili.canSeeRates}
            canManageRates={secili.canManageRates}
            kayitlar={kayitlar}
            roller={roller}
            sehirler={sehirler}
            saglayicilar={saglayicilar}
          />
        </div>
    </PanelKabugu>
  );
}
