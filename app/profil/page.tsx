import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
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

export const metadata = {
  title: 'Profilim — Kashe',
};

export default async function ProfilPage() {
  const supabase = await createClient();

  const user = await getCachedUser();

  if (!user) {
    redirect('/giris?redirect=/profil');
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select(
      '*, turkish_cities(name), service_categories!profiles_primary_category_id_fkey(name_tr, emoji)'
    )
    .eq('id', user.id)
    .single();

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

  const initials = (profile.full_name || '')
    .split(' ')
    .map((s: string) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const displayName =
    isBusinessUser && profile.company_name
      ? profile.company_name
      : profile.full_name || 'Kullanıcı';

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          {/* HEADER */}
          <div className="flex items-start justify-between mb-12 gap-4">
            <div className="flex items-center gap-5 min-w-0">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover border-2 border-line shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-2xl shrink-0">
                  {initials || '?'}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72">
                    {getRoleLabel(profile.role)}
                  </p>
                  {/* Yayın durumu ROZETİ — bilgi amaçlı (buton değil); aksiyon dipteki
                      banttadır. Yalnız yayın kavramı olan roller (pro/business). */}
                  {(isPro || isBusinessUser) && (
                    <span
                      className={`font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${
                        profile.is_published
                          ? 'bg-moss/10 text-moss border-moss/40'
                          : 'bg-ink-72/10 text-ink-72 border-ink-72/25'
                      }`}
                    >
                      {profile.is_published ? 'Yayında' : 'Yayında değil'}
                    </span>
                  )}
                </div>
                <h1 className="font-display font-semibold text-3xl md:text-4xl text-ink tracking-tight break-words">
                  {displayName}
                </h1>
                {isBusinessUser && profile.company_name && profile.full_name && (
                  <p className="text-ink-72 text-sm mt-1">
                    İletişim: {profile.full_name}
                  </p>
                )}
                {isPro && categoryLabel && (
                  <p className="text-ink-72 text-sm mt-1">{categoryLabel}</p>
                )}
              </div>
            </div>
            <Link
              href="/profil/duzenle"
              className="shrink-0 whitespace-nowrap px-5 py-2.5 border border-ink text-ink rounded-lg font-display font-medium hover:bg-ink hover:text-paper transition-colors"
            >
              Düzenle
            </Link>
          </div>

          {/* D2 — kendi public profilini görüntüle (professional; normal link) */}
          {isPro && (
            <div className="-mt-8 mb-10">
              <Link
                href={`/p/${user.id}`}
                className="inline-flex items-center gap-1.5 font-display font-semibold text-sm text-terracotta hover:text-ember transition-colors"
              >
                Profilimi görüntüle →
              </Link>
            </div>
          )}

          {/* ONAY DURUMU GÖSTERGESİ — client hariç */}
          {!isClientUser && profile.approval_status !== 'approved' && (
            <div className="mb-8">
              {profile.approval_status === 'pending' && (
                <div className="bg-card border border-line rounded-lg p-5 flex items-start gap-3">
                  <span className="mt-0.5 w-2.5 h-2.5 rounded-full bg-terracotta shrink-0 animate-pulse" />
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
                  className="h-full bg-terracotta transition-all"
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
                            className="group flex items-center gap-2.5 text-sm text-ink-72 hover:text-terracotta transition-colors"
                          >
                            <span
                              className="w-4 h-4 rounded-full border border-ink-72/40 group-hover:border-terracotta shrink-0 transition-colors"
                              aria-hidden="true"
                            />
                            <span className="flex-1">{field}</span>
                            <span
                              className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta opacity-0 group-hover:opacity-100 transition-opacity"
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

          {/* INFO CARD — D1/D3: emerald eyebrow bölüm başı + normal-case alan etiketleri */}
          <div className="bg-card border border-line rounded-xl p-6 space-y-4">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">
              Hesap Bilgileri
            </p>
            <div>
              <p className="text-xs text-ink-72 mb-1">E-posta</p>
              <p className="text-ink text-sm">{user.email}</p>
            </div>

            {profile.phone && (
              <div className="border-t border-line pt-4">
                <p className="text-xs text-ink-72 mb-1">Telefon</p>
                <p className="text-ink text-sm">{profile.phone}</p>
              </div>
            )}

            {cityName && (
              <div className="border-t border-line pt-4">
                <p className="text-xs text-ink-72 mb-1">Şehir</p>
                <p className="text-ink text-sm">{cityName}</p>
              </div>
            )}

            {profile.bio && (
              <div className="border-t border-line pt-4">
                <p className="text-xs text-ink-72 mb-1">Hakkımda</p>
                <p className="text-ink text-sm leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </div>
            )}
          </div>

          {/* D1 — YENİ YÖNETİM KARTLARI: Deneyim & Eğitim + Kategori bilgileri (professional) */}
          {isPro && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Deneyim & Eğitim */}
              <div className="bg-card border border-line rounded-xl p-6 flex flex-col">
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">
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
                      className="font-display font-semibold text-sm text-terracotta hover:text-ember transition-colors"
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
                      className="font-display font-semibold text-sm text-terracotta hover:text-ember transition-colors"
                    >
                      Yönet →
                    </Link>
                  </>
                )}
              </div>

              {/* Kategori bilgileri */}
              <div className="bg-card border border-line rounded-xl p-6 flex flex-col">
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">
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
                      className="font-display font-semibold text-sm text-terracotta hover:text-ember transition-colors"
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
                      className="font-display font-semibold text-sm text-terracotta hover:text-ember transition-colors"
                    >
                      Düzenle →
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}

          {/* PROFESYONEL: Portföy */}
          {isPro && (
            <div className="mt-5 bg-card border border-line rounded-xl p-6">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display font-semibold text-xl text-ink">Portföy</h2>
                <Link
                  href="/profil/portfoy"
                  className="text-sm font-display font-medium text-terracotta hover:underline"
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
                  className="text-sm font-display font-medium text-terracotta hover:underline"
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
                            ? 'border-terracotta'
                            : 'border-line opacity-60'
                        }`}
                      >
                        <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-1">
                          {service.service_categories
                            ? `${service.service_categories.emoji || ''} ${service.service_categories.name_tr}`.trim()
                            : ''}
                          {!service.is_active && (
                            <span className="ml-2 text-terracotta">· Pasif</span>
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
                  className="text-sm font-display font-medium text-terracotta hover:underline"
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
                  className="text-sm font-display font-medium text-terracotta hover:underline"
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
                  className="text-sm font-display font-medium text-[#1E3A5F] hover:underline"
                >
                  Davetlerim →
                </Link>
              </div>

              {myAgencies.length === 0 ? (
                <p className="text-ink-72 text-sm">
                  Henüz bir ajansa üye değilsin. Bir ajans seni davet ettiğinde{' '}
                  <Link
                    href="/davetlerim"
                    className="text-terracotta hover:underline"
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
                        className="flex items-center gap-3 border border-line rounded-lg p-4 hover:border-[#1E3A5F] hover:shadow-[3px_3px_0_#1E3A5F] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all group"
                      >
                        {ag.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={ag.avatar_url}
                            alt={agName}
                            className="w-12 h-12 rounded-full object-cover border border-line shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white font-display font-semibold shrink-0">
                            {agInitials}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-display font-semibold text-ink group-hover:text-[#1E3A5F] transition-colors truncate">
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
                    className="text-sm font-display font-medium text-terracotta hover:underline"
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
            <div className="mt-6 bg-[#1E3A5F]/5 border-2 border-[#1E3A5F]/15 rounded-lg p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#1E3A5F] mb-1">
                    Bekleyen davet
                  </p>
                  <p className="font-display text-lg text-ink">
                    <span className="text-[#1E3A5F] font-medium">
                      {pendingInvitationCount}
                    </span>{' '}
                    davet cevap bekliyor
                  </p>
                </div>
                <Link
                  href="/profil/ekibim"
                  className="text-sm font-display font-medium text-[#1E3A5F] hover:underline"
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
                    className="text-sm font-display font-medium text-terracotta hover:underline"
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
                    className="text-sm font-display font-medium text-terracotta hover:underline"
                  >
                    Tümünü yönet →
                  </Link>
                  <Link
                    href="/ilanlar/yeni"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
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
                  className="text-sm font-display font-medium text-terracotta hover:underline"
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
                              className="w-16 h-16 rounded-full object-cover border-2 border-line group-hover:border-terracotta transition-colors"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-lg">
                              {proInitials}
                            </div>
                          )}
                          <p className="font-display text-sm text-ink text-center line-clamp-1 group-hover:text-terracotta transition-colors">
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
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-plum)" xmlns="http://www.w3.org/2000/svg">
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

          {/* USER ID */}
          <div className="mt-12 pt-8 border-t border-line">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72/60 mb-1">
              Kullanıcı ID
            </p>
            <p className="text-ink-72/60 text-xs font-mono break-all">
              {profile.id}
            </p>
          </div>
        </div>
      </main>
    </>
  );
}