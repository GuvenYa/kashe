import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PublishToggle } from './publish-toggle';
import { PortfolioGallery } from '@/app/components/portfolio-gallery';
import { getUserFavorites } from '@/app/favoriler/actions';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { isPremiumActive } from '@/app/lib/badges';
import {
  isProfessional,
  isClient,
  isBusiness,
  isAgency,
  getRoleLabel,
  getMissingPublishFields,
  canPublish,
  getCompletenessPercent,
  formatPriceRange,
  formatDuration,
} from '@/app/lib/profile-helpers';
import type { Profile, ServiceWithCategory, PortfolioItem } from '@/app/lib/types';
import { getCachedUser } from '@/app/lib/auth';
import { fetchOwnProfile } from '@/app/lib/own-profile';
import { HavuzBandi, type HavuzBandiSatiri } from './havuz-bandi';
import { getCrewContext } from '@/app/lib/org-context';
import { panelMenusu } from '@/app/lib/panel-menu';
import { orgRolEtiketi } from '@/app/lib/org-roles';
import {
  PanelKabugu,
  PanelKart,
  KpiKutu,
  KpiSatir,
} from '@/app/components/panel';
import { selamlama } from '@/app/lib/tarih';
import { panelGunBugun, ayAraligi } from '@/app/lib/panel-gosterge-data';
import { calcCommission, formatTRY } from '@/app/lib/premium';
import { banaAtananGorevler } from '@/app/lib/gorev-data';
import { gorevDurumEtiketi } from '@/app/lib/gorevler';

export const metadata = {
  title: 'Profilim — Kashe',
};

export default async function ProfilPage() {
  const supabase = await createClient();

  const user = await getCachedUser();

  if (!user) {
    redirect('/giris?redirect=/profil');
  }

  // select('*') değil: kapalı 7 sütun (phone, approval_note…) PII adım 2b'den sonra
  // yalnız get_own_private_profile() ile okunur; fetchOwnProfile ikisini birleştirir.
  const { data: profileData } = await fetchOwnProfile(
    supabase,
    user.id,
    'turkish_cities(name), service_categories!profiles_primary_category_id_fkey(name_tr, emoji)'
  );

  if (!profileData) {
    redirect('/giris');
  }

  // Suspension kontrolü — askıdaki kullanıcı profile gelmemeli
  if (profileData.suspended_at) {
    return <SuspendedNotice />;
  }

  const profile = profileData as Profile & {
    turkish_cities: { name: string } | null;
    service_categories: { name_tr: string; emoji: string | null } | null;
    category_attributes: Record<string, unknown> | null;
  };

  const isPro = isProfessional(profile);
  const isClientUser = isClient(profile);
  const isBusinessUser = isBusiness(profile);
  const isAgencyUser = isAgency(profile);

  // D1a — kurulus baglami: hem yonlendirme hem "Kuruluslarim" karti icin.
  const { orgs } = await getCrewContext();
  const ajansKurulusu =
    orgs.find((o) => o.accountType === 'agency' && o.canViewProposals) ?? null;
  const kurumKurulusu =
    orgs.find((o) => o.accountType === 'business' && o.canViewEvents) ?? null;

  // Kendi hesabi ajans/kurum olan kullanicinin MERKEZI panelidir: /profil onu
  // oraya gonderir (profil icerigi duzenlemesi /profil/duzenle'de kalir).
  //
  // Kapi ROLE de bakar, yalniz izne DEGIL: baska bir kurulusun izleyicisi olan
  // bir profesyonelin `events.view` izni var ama onun merkezi /profil'dir —
  // yalnizca izne bakmak onu kurumsal panele atardi.
  if (isAgencyUser && ajansKurulusu) redirect('/ajans');
  if (isBusinessUser && kurumKurulusu) redirect('/kurumsal');

  // FAZ 5/P2 — "seni havuzuna ekledi" bandi. RPC yalniz e-postasi eslesen ve henuz
  // bagli olmayan kayitlari doner. Musteri hesabinda CAGRILMAZ: satir donse de
  // sahiplenemez (claim `talents` satiri ister).
  let havuzDavetleri: HavuzBandiSatiri[] = [];
  if (isPro || isAgencyUser) {
    const { data: davetler, error: davetHatasi } = await supabase.rpc(
      'claimable_talent_records_for_me'
    );
    if (davetHatasi) console.error('[havuz] band', davetHatasi);
    else {
      havuzDavetleri = (
        (davetler ?? []) as { record_id: string; organization_name: string | null }[]
      ).map((d) => ({
        recordId: d.record_id,
        organizationName: d.organization_name?.trim() || 'Bir kuruluş',
      }));
    }
  }

  // Ajans ise: üye sayısı + bekleyen davet sayısı
  let agencyMemberCount = 0;
  let pendingInvitationCount = 0;
  if (isAgencyUser) {
    const [membersCountResult, invitationsCountResult] = await Promise.all([
      supabase
        .from('agency_members')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', user.id),
      supabase
        .from('agency_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', user.id)
        .eq('status', 'pending'),
    ]);
    agencyMemberCount = membersCountResult.count ?? 0;
    pendingInvitationCount = invitationsCountResult.count ?? 0;
  }

  // Kurum ise: ekip üye sayısı
  let businessMemberCount = 0;
  if (isBusinessUser) {
    const businessMembersResult = await supabase
      .from('business_members')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', user.id);
    businessMemberCount = businessMembersResult.count ?? 0;
  }

  // Profesyonel ise: üye olduğu ajanslar
  type MyAgency = {
    id: string;
    member_role: string;
    agency: {
      id: string;
      full_name: string | null;
      company_name: string | null;
      avatar_url: string | null;
    } | null;
  };
  let myAgencies: MyAgency[] = [];
  if (isPro) {
    const { data: myAgenciesData } = await supabase
      .from('agency_members')
      .select(
        `
        id, member_role,
        agency:profiles!agency_members_agency_id_fkey (
          id, full_name, company_name, avatar_url
        )
      `
      )
      .eq('professional_id', user.id)
      .order('joined_at', { ascending: false });

    myAgencies = (myAgenciesData ?? []) as unknown as MyAgency[];
  }

  // Müşteri ise favorilerini çek (en yeni 4 + toplam sayı için)
  type FavoritePreview = {
    id: string;
    professional: {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      role: string;
      company_name: string | null;
    } | null;
  };

  let favoritesPreview: FavoritePreview[] = [];
  let favoritesTotal = 0;

  if (isClientUser) {
    const { favorites } = await getUserFavorites();
    favoritesTotal = favorites.length;
    favoritesPreview = favorites.slice(0, 4) as unknown as FavoritePreview[];
  }

  // Profesyonel ise hizmetleri + portfolio'yu da çek
  let services: ServiceWithCategory[] = [];
  let portfolioItems: PortfolioItem[] = [];
  let packageCount = 0;
  // Premium istatistikleri
  let stats = {
    views: 0,
    favorites: 0,
    applications: 0,
    accepted: 0,
    completedJobs: 0,
    reviewCount: 0,
    averageRating: 0,
  };
  const proIsPremium = isPro
    ? isPremiumActive(
        (profile.premium_tier ?? null) as
          | 'none'
          | 'premium'
          | 'plus'
          | 'agency'
          | null,
        profile.premium_until ?? null
      )
    : false;

  if (isPro) {
    const [{ data: servicesData }, { data: portfolioData }, { count: pkgCount }] =
      await Promise.all([
        supabase
          .from('services')
          .select('*, service_categories(name_tr, emoji)')
          .eq('profile_id', user.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false }),
        supabase
          .from('portfolio_items')
          .select('*')
          .eq('profile_id', user.id)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('service_packages')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', user.id),
      ]);
    services = (servicesData || []) as ServiceWithCategory[];
    portfolioItems = (portfolioData || []) as PortfolioItem[];
    packageCount = pkgCount ?? 0;

    // İstatistikler — sadece premium kullanıcı için topla (gereksiz sorgu önle)
    if (proIsPremium) {
      const [
        { count: favCount },
        { count: appCount },
        { count: acceptedCount },
        { count: completedCount },
        { data: ratingData },
      ] = await Promise.all([
        supabase
          .from('favorites')
          .select('id', { count: 'exact', head: true })
          .eq('professional_id', user.id),
        supabase
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .eq('applicant_id', user.id),
        supabase
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .eq('applicant_id', user.id)
          .eq('status', 'accepted'),
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('professional_id', user.id)
          .eq('status', 'completed'),
        supabase
          .from('professional_rating_summary')
          .select('review_count, average_rating')
          .eq('professional_id', user.id)
          .maybeSingle(),
      ]);

      stats = {
        views: (profile.views_count as number) ?? 0,
        favorites: favCount ?? 0,
        applications: appCount ?? 0,
        accepted: acceptedCount ?? 0,
        completedJobs: completedCount ?? 0,
        reviewCount: ratingData?.review_count ?? 0,
        averageRating: ratingData?.average_rating ?? 0,
      };
    }
  }

  const cityName = profile.turkish_cities?.name;
  const categoryLabel = profile.service_categories
    ? `${profile.service_categories.emoji || ''} ${profile.service_categories.name_tr}`.trim()
    : null;

  const missingFields = getMissingPublishFields(profile, services);
  const canPub = canPublish(profile, services);
  const completeness = getCompletenessPercent(profile, services);

  // D1/D5 — professional yönetim kartları: deneyim sayıları + kategori doluluk + portföy
  const expCounts = { work: 0, education: 0, award: 0 };
  if (isPro) {
    const { data: expRows } = await supabase
      .from('profile_experiences')
      .select('kind')
      .eq('profile_id', user.id);
    for (const r of expRows ?? []) {
      const k = r.kind as 'work' | 'education' | 'award';
      if (k in expCounts) expCounts[k] += 1;
    }
  }
  const expTotal = expCounts.work + expCounts.education + expCounts.award;
  const catFilledCount = Object.values(
    (profile.category_attributes ?? {}) as Record<string, unknown>
  ).filter((v) => {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v as object).length > 0;
    return true;
  }).length;

  // Etkinlik türleri — ORTAK alan (category_attributes.etkinlik_turleri), 23 kategoride
  // aynı. TAVSİYE kartı için: alan hiç yoksa DA boş diziyse DE "boş" sayılır.
  const hasEventTypes = (() => {
    const raw = (profile.category_attributes as Record<string, unknown> | null)
      ?.etkinlik_turleri;
    return Array.isArray(raw) && raw.length > 0;
  })();

  // D1a — merkez KPI'lari. Hepsi RLS'in zaten gosterdigi satirlardan sayilir;
  // yeni yetki ya da yazma yolu yok. Rakamlar SUNUCUDA hesaplanir.
  const bugunGun = panelGunBugun();
  const { ilk: ayIlk, son: aySon } = ayAraligi();

  let kpiBekleyenTalep = 0;
  let kpiYaklasanRezervasyon = 0;
  let kpiAyKazanc = 0;
  let kpiAcikIlan = 0;
  let kpiGelenTeklif = 0;
  let kpiEtkinlik = 0;

  if (isPro || isAgencyUser) {
    const [talepSonuc, rezervasyonSonuc] = await Promise.all([
      supabase
        .from('quote_request_recipients')
        .select('id, status')
        .eq('professional_id', user.id)
        .in('status', ['sent', 'viewed']),
      supabase
        .from('bookings')
        .select('id, status, event_date, total_amount, completed_at')
        .eq('professional_id', user.id),
    ]);
    kpiBekleyenTalep = (talepSonuc.data ?? []).length;
    const rezervasyonlar = (rezervasyonSonuc.data ?? []) as {
      status: string;
      event_date: string | null;
      total_amount: number | null;
    }[];
    kpiYaklasanRezervasyon = rezervasyonlar.filter(
      (b) =>
        b.status === 'confirmed' &&
        !!b.event_date &&
        b.event_date.slice(0, 10) >= bugunGun
    ).length;
    // "Bu ay kazanc" = TAMAMLANMIS islerin NET'i (komisyon dusulmus).
    // Olcut etkinlik gunu: kazancin hangi aya yazildigi is yapilan gundur.
    const ayBrut = rezervasyonlar
      .filter(
        (b) =>
          b.status === 'completed' &&
          !!b.event_date &&
          b.event_date.slice(0, 10) >= ayIlk &&
          b.event_date.slice(0, 10) <= aySon
      )
      .reduce((toplam, b) => toplam + (b.total_amount ?? 0), 0);
    kpiAyKazanc = calcCommission(ayBrut).net;
  }

  if (isClientUser) {
    const [ilanSonuc, talepSonuc, rezervasyonSonuc, etkinlikSonuc] =
      await Promise.all([
        supabase
          .from('listings')
          .select('id')
          .eq('creator_id', user.id)
          .eq('status', 'published'),
        supabase
          .from('quote_requests')
          .select('id, quote_request_recipients(id, status)')
          .eq('customer_id', user.id),
        supabase
          .from('bookings')
          .select('id, status, event_date')
          .eq('customer_id', user.id),
        supabase.from('events').select('id').eq('owner_user_id', user.id),
      ]);
    kpiAcikIlan = (ilanSonuc.data ?? []).length;
    // Gelen teklif = taleplerine YANIT vermis profesyonel sayisi.
    kpiGelenTeklif = (
      (talepSonuc.data ?? []) as unknown as {
        quote_request_recipients: { status: string }[] | null;
      }[]
    ).reduce(
      (toplam, t) =>
        toplam +
        (t.quote_request_recipients ?? []).filter(
          (r) => r.status === 'responded'
        ).length,
      0
    );
    kpiYaklasanRezervasyon = (
      (rezervasyonSonuc.data ?? []) as {
        status: string;
        event_date: string | null;
      }[]
    ).filter(
      (b) =>
        b.status === 'confirmed' &&
        !!b.event_date &&
        b.event_date.slice(0, 10) >= bugunGun
    ).length;
    kpiEtkinlik = (etkinlikSonuc.data ?? []).length;
  }

  // FAZ 8a — bana atanan acik gorevler (TUM kuruluslar; RLS kapsami).
  // Kurulus uyeligi olmayan kullanicida sorgu bos doner, kart cizilmez.
  const banaAtanan = orgs.length > 0 ? await banaAtananGorevler(5) : [];

  const menu = await panelMenusu();


  const displayName =
    isBusinessUser && profile.company_name
      ? profile.company_name
      : profile.full_name || 'Kullanıcı';

  return (
    <PanelKabugu
      menu={menu}
      yonetici={!!profile.is_admin}
      hesap={{
        ad: displayName,
        altSatir: categoryLabel
          ? getRoleLabel(profile.role) + ' · ' + categoryLabel
          : getRoleLabel(profile.role),
        avatarUrl: profile.avatar_url ?? null,
      }}
      ustBaslik={{
        eyebrow: isPro ? 'Profesyonel · Merkez' : 'Hesabım · Merkez',
        baslik: (
          <>
            {selamlama()},{' '}
            <em className="not-italic text-brand-accent">{displayName}</em>
          </>
        ),
        sagAlan: (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {/* Yayın durumu ROZETİ — bilgi amaçlı (buton değil); aksiyon dipteki
                banttadır. Yalnız yayın kavramı olan roller (pro/business). */}
            {(isPro || isBusinessUser) && (
              <span
                className={
                  profile.is_published
                    ? 'font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border bg-moss/10 text-moss border-moss/40'
                    : 'font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border bg-ink-72/10 text-ink-72 border-ink-72/25'
                }
              >
                {profile.is_published ? 'Yayında' : 'Yayında değil'}
              </span>
            )}
            {isPro && (
              <Link
                href={`/p/${user.id}`}
                className="kashe-tap font-display font-semibold text-sm text-brand-ink hover:text-brand-ink-deep transition-colors"
              >
                Profilimi görüntüle →
              </Link>
            )}
            <Link
              href="/profil/duzenle"
              className="shrink-0 whitespace-nowrap px-4 py-2 border border-ink text-ink rounded-lg font-display font-medium text-sm hover:bg-ink hover:text-paper transition-colors"
            >
              Düzenle
            </Link>
          </div>
        ),
      }}
    >
      {havuzDavetleri.length > 0 && <HavuzBandi satirlar={havuzDavetleri} />}

      {/* KPI — profesyonel/ajans ve musteri icin ayri dort kutu */}
      {(isPro || isAgencyUser) && (
        <KpiSatir>
          <KpiKutu
            etiket="Bekleyen teklif talebi"
            deger={kpiBekleyenTalep}
            altNot="Yanıt bekliyor"
            vurgu={kpiBekleyenTalep > 0 ? 'accent' : 'none'}
            href="/teklif-talepleri"
          />
          <KpiKutu
            etiket="Yaklaşan rezervasyon"
            deger={kpiYaklasanRezervasyon}
            altNot="Onaylı, tarihi gelmemiş"
            href="/rezervasyonlarim"
          />
          <KpiKutu
            etiket="Bu ay kazanç"
            deger={formatTRY(kpiAyKazanc)}
            altNot="Tamamlanan işler, net"
            vurgu={kpiAyKazanc > 0 ? 'moss' : 'none'}
            href="/kazanclarim"
          />
          <KpiKutu
            etiket="Profil tamlığı"
            deger={`%${completeness}`}
            altNot={
              completeness < 100
                ? `${missingFields.length} madde eksik`
                : 'Tamamlandı'
            }
            href={completeness < 100 ? '/profil/duzenle' : undefined}
          />
        </KpiSatir>
      )}

      {isClientUser && (
        <KpiSatir>
          <KpiKutu
            etiket="Açık ilan"
            deger={kpiAcikIlan}
            altNot="Yayında"
            href="/ilanlarim"
          />
          <KpiKutu
            etiket="Gelen teklif"
            deger={kpiGelenTeklif}
            altNot="Taleplerine yanıt"
            vurgu={kpiGelenTeklif > 0 ? 'accent' : 'none'}
            href="/teklif-taleplerim"
          />
          <KpiKutu
            etiket="Yaklaşan rezervasyon"
            deger={kpiYaklasanRezervasyon}
            altNot="Onaylı, tarihi gelmemiş"
            href="/rezervasyonlarim"
          />
          <KpiKutu
            etiket="Etkinlik"
            deger={kpiEtkinlik}
            altNot="Tanımladığın"
            href="/etkinliklerim"
          />
        </KpiSatir>
      )}

      {/* FAZ 8a — bana atanan gorevler. Kurulus bazli degil KISI bazli:
          kullanici birden cok kurulusta gorev tasiyor olabilir. */}
      {banaAtanan.length > 0 && (
        <div className="mb-8">
          <PanelKart
            baslik="Bana atanan görevler"
            tumuHref={`/kurulus/gorevler?kurulus=${banaAtanan[0].organization_id}&bana=1`}
          >
            <ul className="divide-y divide-line">
              {banaAtanan.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{g.title}</p>
                    <p className="text-[11px] text-ink-50">
                      {gorevDurumEtiketi(g.status)}
                      {g.event?.title ? ` · ${g.event.title}` : ""}
                    </p>
                  </div>
                  {g.event_id && (
                    <Link
                      href={`/etkinliklerim/${g.event_id}?sekme=gorevler`}
                      className="kashe-tap shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink hover:underline"
                    >
                      Aç →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </PanelKart>
        </div>
      )}

      {/* KURULUSLARIM — ajans VE kurumsal uyelikler. Rol etiketi uyelik
          rolunden (`ORG_ROLE_LABELS`); "Panele git" yalniz ilgili izin varsa. */}
      {orgs.length > 0 && (
        <div className="mb-8">
          <PanelKart baslik="Kuruluşlarım">
            <ul className="divide-y divide-line">
              {orgs.map((org) => {
                const paneliVar =
                  org.accountType === 'agency'
                    ? org.canViewProposals
                    : org.canViewEvents;
                const panelHref =
                  org.accountType === 'agency' ? '/ajans' : '/kurumsal';
                return (
                  <li
                    key={org.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-ink font-medium truncate">
                        {org.name}
                      </p>
                      <p className="text-[11px] text-ink-50">
                        {org.accountType === 'agency' ? 'Ajans' : 'Kurumsal'} ·{' '}
                        {orgRolEtiketi(org.role)}
                      </p>
                    </div>
                    {paneliVar && (
                      <Link
                        href={panelHref}
                        className="kashe-tap shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink hover:underline"
                      >
                        Panele git →
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </PanelKart>
        </div>
      )}

      <div className="max-w-3xl">

          {/* ONAY DURUMU GÖSTERGESİ — client hariç */}
          {!isClientUser && profile.approval_status !== 'approved' && (
            <div className="mb-8">
              {profile.approval_status === 'pending' && (
                <div className="bg-card border border-line rounded-lg p-5 flex items-start gap-3">
                  <span className="mt-0.5 w-2.5 h-2.5 rounded-full bg-brand-ink shrink-0 animate-pulse" />
                  <div>
                    <p className="font-display text-base text-ink">
                      Profilin onay bekliyor
                    </p>
                    <p className="text-sm text-ink-72 mt-1">
                      Ekibimiz profilini inceliyor. Onaylandığında otomatik olarak
                      yayına alınacak. Bu sırada bilgilerini düzenlemeye devam
                      edebilirsin.
                    </p>
                  </div>
                </div>
              )}

              {profile.approval_status === 'revision' && (
                <div className="bg-danger-08 border border-danger/30 rounded-lg p-5">
                  <p className="font-display text-base text-ink mb-1">
                    Revizyon istendi
                  </p>
                  <p className="text-sm text-ink-72">
                    Profilin yayına alınabilmesi için bazı düzenlemeler gerekiyor:
                  </p>
                  {profile.approval_note && (
                    <p className="text-sm text-ink mt-2 p-3 bg-card border border-line rounded">
                      {profile.approval_note}
                    </p>
                  )}
                  <p className="text-sm text-ink-72 mt-3">
                    Düzenlemeleri yaptıktan sonra profilin tekrar incelenecek.
                  </p>
                </div>
              )}

              {profile.approval_status === 'rejected' && (
                <div className="bg-danger-08 border border-danger/30 rounded-lg p-5">
                  <p className="font-display text-base text-ink mb-1">
                    Profil reddedildi
                  </p>
                  {profile.approval_note && (
                    <p className="text-sm text-ink mt-2 p-3 bg-card border border-line rounded">
                      {profile.approval_note}
                    </p>
                  )}
                  <p className="text-sm text-ink-72 mt-3">
                    Sorularınız için destek ekibiyle iletişime geçebilirsin.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* D1a — bugunku yonetim kartlari IKI SUTUNA toplandi: solda yapilacaklar
              (gorunurluk uyarilari + tamlik eksikleri), sagda profil icerigi.
              Iki sutun yalniz profesyonelde acilir; diger rollerde sag sutunun
              icerigi olmadigi icin tek sutun kalir (bos yariyi gostermemek icin). */}
          <div
            className={
              isPro
                ? 'grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8 items-start'
                : 'mb-8'
            }
          >
            <div className="space-y-5">
              {isPro && (
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50">
                  Yapılacaklar
                </p>
              )}

          {/* ANA KATEGORİ ÇAĞRISI — kategori seçmemiş profesyonele.
              Seçici /profil/duzenle formunun ortasında gömülü kaldığı için burada
              doğrudan bir giriş noktası veriliyor. Kapatma düğmesi YOK: kart yalnız
              kategori seçilince kaybolur (tamamlanma = tek çıkış yolu). */}
          {isPro && profile.primary_category_id == null && (
            <div className="mb-8 rounded-xl border border-brand-ink/25 bg-brand-ink-08 p-6">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink">
                İlk adım
              </p>
              <h2 className="font-display font-semibold text-xl text-ink mt-1">
                Ana hizmet kategorini seç
              </h2>
              <p className="text-ink-72 text-sm mt-2 leading-relaxed">
                Kategorin, Keşfet&apos;te hangi filtrelerle bulunacağını ve
                profilinde hangi alanları dolduracağını belirler. Seçmeden
                profilini yayına alamazsın.
              </p>
              <Link
                href="/profil/duzenle#primary_category_id"
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors"
              >
                Kategori seç →
              </Link>
            </div>
          )}

          {/* ETKİNLİK TÜRLERİ ÇAĞRISI — TAVSİYE, yayın şartı DEĞİL.
              getMissingPublishFields tek kademe ve tamamı sert kapı; oraya madde
              eklemek alanı otomatik yayın şartı yapardı ve yayındaki profilleri
              vurarak "tamamlanması gereken" listesine düşürürdü. Bu kart bunun
              yerine profile-helpers'a HİÇ dokunmadan uyarır.
              Kategori kartıyla aynı anda ÇIKMAZ: /profil/kategori-bilgileri kategori
              seçilmemişken kendisi /profil'e geri gönderiyor (kategori-bilgileri/
              page.tsx:60) — kategori yokken bu CTA çıkmaz döngü olurdu. */}
          {isPro &&
            profile.primary_category_id != null &&
            !hasEventTypes && (
              <div className="mb-8 rounded-xl border border-brand-ink/25 bg-brand-ink-08 p-6">
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink">
                  Görünürlük
                </p>
                <h2 className="font-display font-semibold text-xl text-ink mt-1">
                  Etkinlik türlerini işaretle
                </h2>
                <p className="text-ink-72 text-sm mt-2 leading-relaxed">
                  Keşfet&apos;te &quot;Etkinlik türü&quot; filtresi kullanıldığında
                  yalnızca bu alanı doldurmuş profiller listeleniyor. Boş bırakırsan
                  o aramalarda çıkmazsın. Yayına almanı engellemez.
                </p>
                <Link
                  href="/profil/kategori-bilgileri#etkinlik-turleri"
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors"
                >
                  Etkinlik türlerini seç →
                </Link>
              </div>
            )}

          {/* PROFİL TAMLIĞI — yalnız yayın gereksinimleri + yüzde */}
          {completeness < 100 && (
            <div className="mb-8 bg-card border border-line rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72">
                  Profil tamlığı
                </p>
                <p className="font-display font-semibold text-ink text-sm">
                  %{completeness}
                </p>
              </div>
              <div className="w-full h-2 bg-paper rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-ink transition-all"
                  style={{ width: `${completeness}%` }}
                />
              </div>

              {missingFields.length > 0 && (
                <div className="mt-4 pt-4 border-t border-line">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2.5">
                    Tamamlanması gerekenler
                  </p>
                  <ul className="space-y-1.5">
                    {missingFields.map((field) => {
                      // Hizmet maddesi hizmetler sayfasına, gerisi düzenleme sayfasına
                      const href = field.toLocaleLowerCase('tr').includes('hizmet')
                        ? '/profil/hizmetlerim'
                        : '/profil/duzenle';
                      return (
                        <li key={field}>
                          <Link
                            href={href}
                            className="group flex items-center gap-2.5 text-sm text-ink-72 hover:text-brand-ink transition-colors"
                          >
                            <span
                              className="w-4 h-4 rounded-full border border-ink-72/40 group-hover:border-brand-ink shrink-0 transition-colors"
                              aria-hidden="true"
                            />
                            <span className="flex-1">{field}</span>
                            <span
                              className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-hidden="true"
                            >
                              Tamamla →
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

            </div>
          )}

            </div>

            {/* Sag sutun — profil icerigi (yalniz profesyonel) */}
            {isPro && (
              <div className="space-y-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50">
                  Profil içeriği
                </p>

          {/* D1 — YENİ YÖNETİM KARTLARI: Deneyim & Eğitim + Kategori bilgileri (professional) */}
          {isPro && (
            <div className="space-y-5">
              {/* Deneyim & Eğitim */}
              <div className="bg-card border border-line rounded-xl p-6 flex flex-col">
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink">
                  Profil İçeriği
                </p>
                <h2 className="font-display font-semibold text-xl text-ink mt-1">
                  Deneyim &amp; Eğitim
                </h2>
                {expTotal === 0 ? (
                  <>
                    <p className="text-ink-72 text-sm mt-2 mb-4 flex-1">
                      Henüz deneyim, eğitim veya ödül eklemedin.
                    </p>
                    <Link
                      href="/profil/deneyim"
                      className="font-display font-semibold text-sm text-brand-ink hover:text-brand-ink-deep transition-colors"
                    >
                      İlk kaydını ekle →
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-ink-72 text-sm mt-2 mb-4 flex-1">
                      {expCounts.work} iş · {expCounts.education} eğitim ·{' '}
                      {expCounts.award} ödül
                    </p>
                    <Link
                      href="/profil/deneyim"
                      className="font-display font-semibold text-sm text-brand-ink hover:text-brand-ink-deep transition-colors"
                    >
                      Yönet →
                    </Link>
                  </>
                )}
              </div>

              {/* Kategori bilgileri */}
              <div className="bg-card border border-line rounded-xl p-6 flex flex-col">
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink">
                  Profil İçeriği
                </p>
                <h2 className="font-display font-semibold text-xl text-ink mt-1">
                  Kategori bilgileri
                </h2>
                {catFilledCount === 0 ? (
                  <>
                    <p className="text-ink-72 text-sm mt-2 mb-4 flex-1">
                      Kategorine özel alanlar (hızlı bilgiler, modüller) henüz boş.
                    </p>
                    <Link
                      href="/profil/kategori-bilgileri"
                      className="font-display font-semibold text-sm text-brand-ink hover:text-brand-ink-deep transition-colors"
                    >
                      Doldurmaya başla →
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-ink-72 text-sm mt-2 mb-4 flex-1">
                      {catFilledCount} bölüm dolu.
                    </p>
                    <Link
                      href="/profil/kategori-bilgileri"
                      className="font-display font-semibold text-sm text-brand-ink hover:text-brand-ink-deep transition-colors"
                    >
                      Düzenle →
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}

                {/* Portfoy + Hizmetler/Paketler TEK kartta: ayrintili listeler
                    asagida tam genislikte duruyor, burada yalniz durum ve giris. */}
                <div className="bg-card border border-line rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-base text-ink">
                        Portföy
                      </p>
                      <p className="text-ink-72 text-sm">
                        {portfolioItems.length > 0
                          ? `${portfolioItems.length} görsel yüklü`
                          : 'Henüz görsel yok'}
                      </p>
                    </div>
                    <Link
                      href="/profil/portfoy"
                      className="kashe-tap shrink-0 font-display font-semibold text-sm text-brand-ink hover:text-brand-ink-deep transition-colors"
                    >
                      {portfolioItems.length > 0 ? 'Düzenle →' : 'Ekle →'}
                    </Link>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-base text-ink">
                        Hizmetler ve paketler
                      </p>
                      <p className="text-ink-72 text-sm">
                        {services.length} hizmet · {packageCount} paket
                      </p>
                    </div>
                    <Link
                      href="/profil/hizmetlerim"
                      className="kashe-tap shrink-0 font-display font-semibold text-sm text-brand-ink hover:text-brand-ink-deep transition-colors"
                    >
                      Düzenle →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PROFESYONEL: Portföy */}
          {isPro && (
            <div className="mt-5 bg-card border border-line rounded-xl p-6">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display font-semibold text-xl text-ink">Portföy</h2>
                <Link
                  href="/profil/portfoy"
                  className="text-sm font-display font-medium text-brand-ink hover:underline"
                >
                  {portfolioItems.length === 0
                    ? 'Fotoğraf ekle →'
                    : 'Tümünü yönet →'}
                </Link>
              </div>

              {portfolioItems.length === 0 ? (
                <p className="text-ink-72">
                  Henüz portföy öğesi eklemedin.
                </p>
              ) : (
                <PortfolioGallery items={portfolioItems} />
              )}
            </div>
          )}

          {/* PROFESYONEL: Hizmetler */}
          {isPro && (
            <div className="mt-5 bg-card border border-line rounded-xl p-6">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display font-semibold text-xl text-ink">Hizmetlerim</h2>
                <Link
                  href="/profil/hizmetlerim"
                  className="text-sm font-display font-medium text-brand-ink hover:underline"
                >
                  {services.length === 0 ? 'Hizmet ekle →' : 'Tümünü yönet →'}
                </Link>
              </div>

              {services.length === 0 ? (
                <p className="text-ink-72">
                  Henüz hizmet eklemedin. Yayınlamak için en az 1 aktif hizmet gerekli.
                </p>
              ) : (
                <div className="space-y-4">
                  {services.slice(0, 3).map((service) => {
                    const priceLabel = formatPriceRange(
                      service.price_min,
                      service.price_max,
                      service.price_on_request,
                      service.price_unit,
                      service.price_starting
                    );
                    const durationLabel = formatDuration(service.duration_hours);
                    return (
                      <div
                        key={service.id}
                        className={`border-l-2 pl-4 py-1 ${
                          service.is_active
                            ? 'border-brand-ink'
                            : 'border-line opacity-60'
                        }`}
                      >
                        <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-1">
                          {service.service_categories
                            ? `${service.service_categories.emoji || ''} ${service.service_categories.name_tr}`.trim()
                            : ''}
                          {!service.is_active && (
                            <span className="ml-2 text-brand-ink">· Pasif</span>
                          )}
                        </p>
                        <p className="font-display text-base text-ink">
                          {service.title}
                        </p>
                        <p className="text-sm text-ink-72 mt-0.5">
                          {[durationLabel, priceLabel].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    );
                  })}
                  {services.length > 3 && (
                    <p className="text-sm text-ink-72 pt-2">
                      ve {services.length - 3} hizmet daha...
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PROFESYONEL: Paketler */}
          {isPro && (
            <div className="mt-5 bg-card border border-line rounded-xl p-6">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display font-semibold text-xl text-ink">
                  Paketlerim{' '}
                  <span className="text-ink-72 text-lg">({packageCount})</span>
                </h2>
                <Link
                  href="/profil/paketler"
                  className="text-sm font-display font-medium text-brand-ink hover:underline"
                >
                  {packageCount === 0 ? 'Paket oluştur →' : 'Tümünü yönet →'}
                </Link>
              </div>
              {packageCount === 0 ? (
                <p className="text-ink-72 text-sm">
                  Birden çok hizmetini tek pakette topla (örn. &quot;Düğün
                  Paketi&quot;). Müşteriler profilinde paketlerini görüp doğrudan
                  iletişime geçebilir.
                </p>
              ) : (
                <p className="text-ink-72 text-sm">
                  Paketlerini düzenle, yeni paket ekle, aktif/pasif yap.
                </p>
              )}
            </div>
          )}

          {/* PROFESYONEL: Başvurularım */}
          {isPro && (
            <div className="mt-5 bg-card border border-line rounded-xl p-6">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display font-semibold text-xl text-ink">Başvurularım</h2>
                <Link
                  href="/basvurularim"
                  className="text-sm font-display font-medium text-brand-ink hover:underline"
                >
                  Tümünü gör →
                </Link>
              </div>
              <p className="text-ink-72 text-sm">
                İlan tahtasından başvurduğun ilanları ve başvuru durumlarını
                buradan takip et.
              </p>
            </div>
          )}

          {/* PROFESYONEL: Üye olduğum ajanslar */}
          {isPro && (
            <div className="mt-5 bg-card border border-line rounded-xl p-6">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display font-semibold text-xl text-ink">
                  Üye olduğum ajanslar{' '}
                  <span className="text-ink-72 text-lg">
                    ({myAgencies.length})
                  </span>
                </h2>
                <Link
                  href="/davetlerim"
                  className="text-sm font-display font-medium text-ink-blue hover:underline"
                >
                  Davetlerim →
                </Link>
              </div>

              {myAgencies.length === 0 ? (
                <p className="text-ink-72 text-sm">
                  Henüz bir ajansa üye değilsin. Bir ajans seni davet ettiğinde{' '}
                  <Link
                    href="/davetlerim"
                    className="text-brand-ink hover:underline"
                  >
                    Davetlerim
                  </Link>{' '}
                  sayfasından kabul edebilirsin.
                </p>
              ) : (
                <div className="space-y-3">
                  {myAgencies.map((m) => {
                    const ag = m.agency;
                    if (!ag) return null;
                    const agName =
                      ag.company_name || ag.full_name || 'İsimsiz ajans';
                    const agInitials = agName
                      .split(' ')
                      .map((s) => s[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    return (
                      <Link
                        key={m.id}
                        href={`/p/${ag.id}`}
                        className="flex items-center gap-3 border border-line rounded-lg p-4 hover:border-ink-blue hover:shadow-[3px_3px_0_var(--color-ink-blue)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all group"
                      >
                        {ag.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={ag.avatar_url}
                            alt={agName}
                            className="w-12 h-12 rounded-full object-cover border border-line shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-ink-blue flex items-center justify-center text-white font-display font-semibold shrink-0">
                            {agInitials}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-display font-semibold text-ink group-hover:text-ink-blue transition-colors truncate">
                            {agName}
                          </p>
                          <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72">
                            Ajans
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* AJANS: Ekibim */}
          {isAgencyUser && (
            <div className="mt-5 bg-card border border-line rounded-xl p-6">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display font-semibold text-xl text-ink">
                  Ekibim{' '}
                  <span className="text-ink-72 text-lg">
                    ({agencyMemberCount})
                  </span>
                </h2>
                <div className="flex items-center gap-4">
                  <Link
                    href="/profil/ekibim"
                    className="text-sm font-display font-medium text-brand-ink hover:underline"
                  >
                    {agencyMemberCount === 0
                      ? 'İlk üyeyi davet et →'
                      : 'Tümünü yönet →'}
                  </Link>
                </div>
              </div>
              {agencyMemberCount === 0 ? (
                <p className="text-ink-72 text-sm">
                  Ajansının altında henüz profesyonel yok. Profesyonelleri
                  email ile davet et, kabul edince ekibinde yer alsınlar.
                </p>
              ) : (
                <p className="text-ink-72 text-sm">
                  Ekibindeki profesyonelleri yönet, yeni üyeler davet et,
                  rolleri ayarla.
                </p>
              )}
            </div>
          )}

          {/* AJANS: Bekleyen davetler */}
          {isAgencyUser && pendingInvitationCount > 0 && (
            <div className="mt-6 bg-ink-blue/5 border-2 border-ink-blue/15 rounded-lg p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-blue mb-1">
                    Bekleyen davet
                  </p>
                  <p className="font-display text-lg text-ink">
                    <span className="text-ink-blue font-medium">
                      {pendingInvitationCount}
                    </span>{' '}
                    davet cevap bekliyor
                  </p>
                </div>
                <Link
                  href="/profil/ekibim"
                  className="text-sm font-display font-medium text-ink-blue hover:underline"
                >
                  İncele →
                </Link>
              </div>
            </div>
          )}

          {/* KURUMSAL: Ekip */}
          {isBusinessUser && (
            <div className="mt-5 bg-card border border-line rounded-xl p-6">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display font-semibold text-xl text-ink">
                  Kurumsal Ekip{' '}
                  <span className="text-ink-72 text-lg">
                    ({businessMemberCount})
                  </span>
                </h2>
                <div className="flex items-center gap-4">
                  <Link
                    href="/profil/kurumsal-ekip"
                    className="text-sm font-display font-medium text-brand-ink hover:underline"
                  >
                    {businessMemberCount === 0
                      ? 'İlk üyeyi davet et →'
                      : 'Tümünü yönet →'}
                  </Link>
                </div>
              </div>
              {businessMemberCount === 0 ? (
                <p className="text-ink-72 text-sm">
                  Kurum hesabını birlikte yönetecek ekip üyen yok. Email ile
                  davet et, kabul edince ilan ve tekliflerini birlikte
                  yönetebilirsiniz.
                </p>
              ) : (
                <p className="text-ink-72 text-sm">
                  Ekip üyelerini yönet, yeni üyeler davet et, rolleri ayarla.
                </p>
              )}
            </div>
          )}

          {/* KURUMSAL / MÜŞTERİ: İlanlarım */}
          {(isBusinessUser || isClientUser) && (
            <div className="mt-5 bg-card border border-line rounded-xl p-6">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display font-semibold text-xl text-ink">İlanlarım</h2>
                <div className="flex items-center gap-4">
                  <Link
                    href="/ilanlarim"
                    className="text-sm font-display font-medium text-brand-ink hover:underline"
                  >
                    Tümünü yönet →
                  </Link>
                  <Link
                    href="/ilanlar/yeni"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
                  >
                    <span className="text-base leading-none">+</span>
                    Yeni ilan aç
                  </Link>
                </div>
              </div>
              <p className="text-ink-72 text-sm">
                Etkinliğin için açtığın ilanlara gelen başvuruları görüntüle, kısa
                liste yap, ilanlarını yönet.
              </p>
            </div>
          )}

          {/* MÜŞTERİ: Favorilerim */}
          {isClientUser && (
            <div className="mt-5 bg-card border border-line rounded-xl p-6">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display font-semibold text-xl text-ink">Favorilerim</h2>
                <Link
                  href="/favoriler"
                  className="text-sm font-display font-medium text-brand-ink hover:underline"
                >
                  {favoritesTotal === 0 ? 'Keşfet\'e git →' : 'Tümünü gör →'}
                </Link>
              </div>

              {favoritesTotal === 0 ? (
                <p className="text-ink-72">
                  Henüz favorin yok. Beğendiğin profesyonelleri favorilerine ekle,
                  buradan kolayca ulaş.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {favoritesPreview.map((fav) => {
                      const pro = fav.professional;
                      if (!pro) return null;
                      const displayName =
                        pro.role === 'business' && pro.company_name
                          ? pro.company_name
                          : pro.full_name || 'İsimsiz';
                      const proInitials = (displayName || 'K')
                        .split(' ')
                        .map((s) => s[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();
                      return (
                        <Link
                          key={fav.id}
                          href={`/p/${pro.id}`}
                          className="group flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-paper transition-colors"
                        >
                          {pro.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={pro.avatar_url}
                              alt={displayName}
                              className="w-16 h-16 rounded-full object-cover border-2 border-line group-hover:border-brand-ink transition-colors"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-brand-ink flex items-center justify-center text-paper font-display font-semibold text-lg">
                              {proInitials}
                            </div>
                          )}
                          <p className="font-display text-sm text-ink text-center line-clamp-1 group-hover:text-brand-ink transition-colors">
                            {displayName}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                  {favoritesTotal > 4 && (
                    <p className="text-sm text-ink-72 mt-3">
                      ve {favoritesTotal - 4} favori daha...
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* PROFESYONEL: İstatistiklerim (premium) */}
          {isPro && proIsPremium && (
            <div className="mt-5 bg-card border border-line rounded-xl p-6">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display font-semibold text-xl text-ink">
                  İstatistiklerim
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8A6D1F] bg-[#F4E9C8] border border-[#D9C179] px-2 py-0.5 rounded-full">
                  Premium
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-paper rounded-lg p-4">
                  <p className="font-display text-3xl text-ink leading-none">
                    {stats.views}
                  </p>
                  <p className="text-xs text-ink-72 mt-1.5">Profil görüntülenme</p>
                </div>
                <div className="bg-paper rounded-lg p-4">
                  <p className="font-display text-3xl text-ink leading-none">
                    {stats.favorites}
                  </p>
                  <p className="text-xs text-ink-72 mt-1.5">Favoriye eklenme</p>
                </div>
                <div className="bg-paper rounded-lg p-4">
                  <p className="font-display text-3xl text-ink leading-none">
                    {stats.applications}
                  </p>
                  <p className="text-xs text-ink-72 mt-1.5">
                    Yaptığın başvuru
                    {stats.applications > 0 && (
                      <span className="text-moss">
                        {' '}
                        · {stats.accepted} kabul
                      </span>
                    )}
                  </p>
                </div>
                <div className="bg-paper rounded-lg p-4">
                  <p className="font-display text-3xl text-ink leading-none">
                    {stats.completedJobs}
                  </p>
                  <p className="text-xs text-ink-72 mt-1.5">Tamamlanan iş</p>
                </div>
                <div className="bg-paper rounded-lg p-4">
                  <p className="font-display text-3xl text-ink leading-none flex items-center gap-1">
                    {stats.reviewCount > 0 ? stats.averageRating : '—'}
                    {stats.reviewCount > 0 && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-brand-accent)" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                    )}
                  </p>
                  <p className="text-xs text-ink-72 mt-1.5">
                    Ortalama puan
                    {stats.reviewCount > 0 && (
                      <span> · {stats.reviewCount} yorum</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PROFESYONEL: İstatistik teşvik (premium değilse) */}
          {isPro && !proIsPremium && (
            // D3 — yatay düzen: sol metin bloğu + sağda üç stat yan yana (kart yüksekliği düşer)
            <div className="mt-5 bg-gradient-to-br from-[#F4E9C8]/60 to-paper border border-[#D9C179] rounded-lg p-5 flex flex-col md:flex-row md:items-center gap-5">
              <div className="flex-1 min-w-0 max-w-md">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8A6D1F] bg-[#F4E9C8] border border-[#D9C179] px-2 py-0.5 rounded-full">
                  Premium
                </span>
                <h2 className="font-display font-semibold text-xl text-ink mt-2">
                  İstatistiklerini gör
                </h2>
                <p className="text-ink-72 text-sm mt-1.5">
                  Profilin kaç kez görüntülendi, kaç kişi favoriledi, başvuru ve
                  iş performansın nasıl? Premium ile tüm istatistiklerine eriş.
                </p>
              </div>
              <div className="flex gap-2.5 shrink-0 opacity-50 pointer-events-none select-none">
                <div className="bg-paper rounded-lg p-3 w-24">
                  <p className="font-display text-lg text-ink leading-none blur-[3px]">···</p>
                  <p className="text-[11px] text-ink-72 mt-1">Görüntülenme</p>
                </div>
                <div className="bg-paper rounded-lg p-3 w-24">
                  <p className="font-display text-lg text-ink leading-none blur-[3px]">··</p>
                  <p className="text-[11px] text-ink-72 mt-1">Favori</p>
                </div>
                <div className="bg-paper rounded-lg p-3 w-24">
                  <p className="font-display text-lg text-ink leading-none blur-[3px]">···</p>
                  <p className="text-[11px] text-ink-72 mt-1">Başvuru</p>
                </div>
              </div>
            </div>
          )}

          {/* YAYIN DURUMU BANDI — aksiyon (Yayınla / Yayından kaldır). Konum: en dipte,
              ID'nin hemen üstünde (mevcut yeşil/uyarı band tasarımı korunur, yalnız konum). */}
          {(isPro || isBusinessUser) && profile.approval_status === 'approved' && (
            <div className="mb-8">
              <PublishToggle
                isPublished={profile.is_published}
                canPublish={canPub}
                missingFields={missingFields}
              />
            </div>
          )}

          {/* HESAP BILGILERI + KULLANICI ID — en altta, kucuk. Merkezin ustu
              aksiyona ayrildi; bu blok basvuru degil referans bilgisi. */}
          <div className="mt-12 pt-8 border-t border-line">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50 mb-3">
              Hesap bilgileri
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <dt className="text-xs text-ink-72 mb-0.5">E-posta</dt>
                <dd className="text-ink text-sm break-all">{user.email}</dd>
              </div>
              {profile.phone && (
                <div>
                  <dt className="text-xs text-ink-72 mb-0.5">Telefon</dt>
                  <dd className="text-ink text-sm">{profile.phone}</dd>
                </div>
              )}
              {cityName && (
                <div>
                  <dt className="text-xs text-ink-72 mb-0.5">Şehir</dt>
                  <dd className="text-ink text-sm">{cityName}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-ink-72 mb-0.5">Kullanıcı ID</dt>
                <dd className="text-ink-72/60 text-xs font-mono break-all">
                  {profile.id}
                </dd>
              </div>
            </dl>
            {profile.bio && (
              <div className="mt-4 pt-4 border-t border-line">
                <p className="text-xs text-ink-72 mb-1">Hakkımda</p>
                <p className="text-ink text-sm leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </div>
            )}
          </div>
      </div>
    </PanelKabugu>
  );
}