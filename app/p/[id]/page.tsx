import type { ReactNode } from 'react';
import { GuvenCipleri } from '@/app/components/guven-cipleri';
import { FiyatTakvimKarti } from '@/app/components/fiyat-takvim-karti';
import { ProfilIslemSaglayici } from './profil-islem-baglami';
import { createClient } from '@/app/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/app/components/sections/top-nav';
import { IletisimButton } from './iletisim-button';
import {
  getOwnedBusinessIds,
  getWritableBusinesses,
} from '@/app/lib/business-write';
import { HizmetSecici } from './hizmet-secici';
import { DavetButton } from './davet-button';
import { YorumButton } from './yorum-button';
import FavoriteButton from '@/app/components/FavoriteButton';
import { isFavorited as checkIsFavorited, getFavoritedIds } from '@/app/favoriler/actions';
import { ReviewCard } from '@/app/yorumlar/review-card';
import { ProfileCard } from '@/app/kesfet/profile-card';
import { SikayetButton } from '@/app/sikayet/sikayet-button';
import {
  formatPriceRange,
  getRoleLabel,
  formatLastSeen,
  getLastSeenTone,
} from '@/app/lib/profile-helpers';
import {
  PROVIDER_LISTING_COLUMNS,
  type CategoryEmbed,
  type CityEmbed,
  type ProviderPage,
  type ProviderPublic,
  type ServiceWithCategory,
  type PortfolioItem,
  type ServicePackage,
} from '@/app/lib/types';
import {
  getFilterFields,
  getFilterSource,
  readFilterFieldValues,
} from '@/app/lib/filter-config';
import { getBadges, isVerified, getBadgeCards, isPremiumActive, isBusy } from '@/app/lib/badges';
import type { PremiumTier } from '@/app/lib/badges';
import { ProfessionalProfile } from './professional-profile';
import { HavuzaEkle } from './havuza-ekle';
import { KisaListeyeEkle } from './kisa-listeye-ekle';
import {
  getTalentPoolContext,
  getCrewContext,
} from '@/app/lib/org-context';
import { kisaListedekiKuruluslar } from '@/app/lib/tedarikci-data';
import type { ProfileExperience } from '@/app/lib/category-fields';
import { PortfolioGallery } from '@/app/components/portfolio-gallery';
import { incrementProfileViews } from './profile-views-actions';

// FAZ 2c: detay sayfasi v_providers_public gorunumunden okunur.
// ProviderListing + is_published + last_seen_at (sorgunun sectigi alanlarla birebir).
type PublicProfile = ProviderPage;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('v_providers_public')
    .select('full_name, company_name, role, is_published')
    .eq('id', id)
    .single();

  // FAZ 2c/P3: business saglayici degil (gorunumde satiri yok); kurum sayfasi
  // FAZ 8 (organizations). Kapi yalniz professional/agency.
  if (
    !data ||
    !data.is_published ||
    (data.role !== 'professional' && data.role !== 'agency')
  ) {
    return { title: 'Profil bulunamadı — Kashe' };
  }

  const name =
    data.role === 'agency' && data.company_name
      ? data.company_name
      : data.full_name || 'Profil';

  return {
    title: `${name} — Kashe`,
  };
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ etkinlik?: string }>;
}) {
  const { id } = await params;
  const { etkinlik: etkinlikParam } = await searchParams;
  // FAZ 4c/P3: etkinlikten gelindiyse sohbete bag tasinir. Burada yalniz bicim
  // kontrolu yapilir; gecerliligi sunucu action'i (gorunenEtkinlikId) dogrular.
  const etkinlikId =
    etkinlikParam &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      etkinlikParam
    )
      ? etkinlikParam
      : null;
  const supabase = await createClient();

  const { data: profileData } = await supabase
    .from('v_providers_public')
    .select(
      `
      ${PROVIDER_LISTING_COLUMNS}, is_published, last_seen_at,
      turkish_cities(name),
      service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)
    `
    )
    .eq('id', id)
    .single();

  if (!profileData) {
    notFound();
  }

  const profile = profileData as unknown as PublicProfile;

  // Mevcut kullanıcı + admin kontrolü — is_published guard'ından ÖNCE (D2 admin önizleme).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let currentUserRole: string | null = null;
  let viewerIsAdmin = false;
  if (user) {
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single();
    currentUserRole = currentProfile?.role ?? null;
    viewerIsAdmin = currentProfile?.is_admin === true;
  }

  // D2 — Admin, yayında OLMAYAN profili ÖNİZLEYEBİLİR (üstte uyarı bandı ile).
  // Non-admin davranışı + SIRA1 AYNEN: yayında değilse 404.
  const isAdminPreview = !profile.is_published && viewerIsAdmin;
  if (!profile.is_published && !viewerIsAdmin) {
    notFound();
  }
  // Kamu profili yalnız profesyonel/ajans (müşteri ve kurumsal profiller kapalı).
  // FAZ 2c/P3: business saglayici degil (gorunumde satiri yok); kurum sayfasi
  // FAZ 8 (organizations).
  if (profile.role !== 'professional' && profile.role !== 'agency') {
    notFound();
  }

  // Görüntülenme say (fire-and-forget, sahibi kendi profilini saymaz)
  incrementProfileViews(profile.id).catch(() => {
    // sessiz fail
  });

  const isAgencyProfile = profile.role === 'agency';

  // Ajans ise: barındırdığı profesyonelleri çek.
  // FAZ 10a: acik yuzeyde uyelik rolu YOK — tipte de rol alani kalmadi.
  type AgencyTeamMember = {
    id: string;
    professional: {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      bio: string | null;
      service_categories: { name_tr: string; emoji: string | null } | null;
    } | null;
  };

  // FAZ 10a: ACIK ekip listesi `organization_team_public` gorunumunden gelir
  // (ajans ve uye pazaryerinde yayinda + onayli + askida degil). Gorunumde ROL
  // SUTUNU YOKTUR: acik yuzeyde uyelik rolu gosterilmez.
  let agencyTeam: AgencyTeamMember[] = [];
  if (isAgencyProfile) {
    const { data: teamData, error: ekipHatasi } = await supabase
      .from('organization_team_public')
      .select('membership_id, user_id, joined_at')
      .eq('agency_id', profile.id)
      .order('joined_at', { ascending: false });
    if (ekipHatasi) console.error('[profil] ajans ekibi', ekipHatasi);

    const ekipSatirlari = (teamData ?? []) as {
      membership_id: string;
      user_id: string;
      joined_at: string | null;
    }[];

    if (ekipSatirlari.length > 0) {
      const { data: uyeProfilleri } = await supabase
        .from('profiles')
        .select(
          `id, full_name, avatar_url, bio,
           service_categories!profiles_primary_category_id_fkey (name_tr, emoji)`
        )
        .in(
          'id',
          ekipSatirlari.map((s) => s.user_id)
        );

      const profilHaritasi = new Map(
        ((uyeProfilleri ?? []) as unknown as AgencyTeamMember['professional'][])
          .filter((p): p is NonNullable<AgencyTeamMember['professional']> => !!p)
          .map((p) => [p.id, p])
      );

      agencyTeam = ekipSatirlari.map((s) => ({
        id: s.membership_id,
        professional: profilHaritasi.get(s.user_id) ?? null,
      }));
    }
  }

  // Profesyonel ise: temsil eden ajanslar
  type RepresentingAgency = {
    id: string;
    agency: {
      id: string;
      full_name: string | null;
      company_name: string | null;
      avatar_url: string | null;
    } | null;
  };
  // FAZ 10a: "temsil eden ajans" da ayni ACIK gorunumden (yalniz yayindaki
  // uyelikler). `agency_id` ajansin pazaryeri profil kimligi.
  let representingAgencies: RepresentingAgency[] = [];
  if (profile.role === 'professional') {
    const { data: repData, error: temsilHatasi } = await supabase
      .from('organization_team_public')
      .select('membership_id, agency_id, joined_at')
      .eq('user_id', profile.id)
      .order('joined_at', { ascending: false });
    if (temsilHatasi) console.error('[profil] temsil eden ajans', temsilHatasi);

    const temsilSatirlari = (repData ?? []) as {
      membership_id: string;
      agency_id: string | null;
      joined_at: string | null;
    }[];
    const ajansIdleri = temsilSatirlari
      .map((s) => s.agency_id)
      .filter((v): v is string => !!v);

    if (ajansIdleri.length > 0) {
      const { data: ajansProfilleri } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, avatar_url')
        .in('id', ajansIdleri);

      const ajansHaritasi = new Map(
        ((ajansProfilleri ?? []) as {
          id: string;
          full_name: string | null;
          company_name: string | null;
          avatar_url: string | null;
        }[]).map((a) => [a.id, a])
      );

      representingAgencies = temsilSatirlari.map((s) => ({
        id: s.membership_id,
        agency: s.agency_id
          ? (ajansHaritasi.get(s.agency_id) ?? null)
          : null,
      }));
    }
  }
  // Hizmetler + Portföy + Paketler + Müsaitlik
  const [
    { data: servicesData },
    { data: portfolioData },
    { data: packagesData },
    { data: blocksData },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('*, service_categories(name_tr, emoji), service_addons(*)')
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('portfolio_items')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('service_packages')
      .select('*')
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('availability_blocks')
      .select('blocked_date')
      .eq('profile_id', profile.id),
  ]);

  const services = (servicesData || []) as ServiceWithCategory[];
  const portfolioItems = (portfolioData || []) as PortfolioItem[];
  const packages = (packagesData || []) as ServicePackage[];
  const blockedDates = (blocksData || []).map(
    (b) => b.blocked_date as string
  );

  // (user + currentUserRole + viewerIsAdmin yukarıda, is_published guard'ından önce alındı)
  const isLoggedIn = !!user;

  // D2 — admin önizleme bandı (yayında olmayan profil; yalnız admin görür)
  const previewBand = isAdminPreview ? (
    <div className="bg-amber-500/15 border-b border-amber-500/40 px-6 md:px-12 py-2.5 text-center text-sm font-medium text-ink">
      Önizleme — profil yayında değil (yalnız admin görebilir)
    </div>
  ) : null;
  const isOwnProfile = user?.id === profile.id;
  const currentUserIsProfessional = currentUserRole === 'professional';
  // manager+ kurum üyeliği — kurum adına rezervasyon/konuşma için
  const writableBusinesses = isLoggedIn ? await getWritableBusinesses() : [];

  // Favori durumu — başkasının profesyonel veya ajans profilinde anlamlı
  const showFavoriteButton =
    !isOwnProfile &&
    (profile.role === 'professional' || profile.role === 'agency');
  let initialFavorited = false;
  if (showFavoriteButton && isLoggedIn && currentUserRole === 'client') {
    initialFavorited = await checkIsFavorited(profile.id);
  }

  // Yorum sistemi için: mesajlaşma var mı + mevcut yorum
  // Yorum sistemi için: tamamlanmış rezervasyon var mı + mevcut yorum
  // Eski: hasConversation (sadece mesajlaşma yeterdi). Yeni: hasCompletedBooking.
  // Mevcut yorumlar veritabanında korunur (recentReviews listesinde görünmeye devam eder),
  // ama yeni yorum bırakma akışı tamamlanmış iş şartına bağlandı — daha güvenilir.
  let hasCompletedBooking = false;
  let existingReview: {
    id: string;
    rating: number;
    body: string | null;
  } | null = null;

  // Yorum bağlamı adayları: kendi adına (client/business) + owner-ROL olunan kurumlar.
  // Kurum adına yorum dilim 3b ile açıldı (bugüne dek yalnız client yazabiliyordu).
  const reviewCandidateIds: string[] = [];
  if (isLoggedIn && !isOwnProfile && user) {
    // Pro-as-buyer: yorum yetkisi ROL değil KOLTUK. Kendi adına (customer_id)
    // tamamlanmış rezervasyonu olan her ziyaretçi (professional dahil) aday olur;
    // gerçek yetki aşağıdaki completed-booking sorgusu + action/RLS ile belirlenir.
    reviewCandidateIds.push(user.id);
    // FAZ 10a: owner-ROL olunan kurum kuruluslari `organization_memberships`'ten
    // (eski rol esdegeri `eskiKurumRolu`; kurulusun kendi hesabi zaten
    // `user.id` ile yukarida eklendi).
    for (const businessId of await getOwnedBusinessIds()) {
      reviewCandidateIds.push(businessId);
    }
  }
  const canReview = reviewCandidateIds.length > 0;

  if (canReview) {
    const [{ data: bookingData }, { data: reviewData }] = await Promise.all([
      supabase
        .from('bookings')
        .select('customer_id')
        .in('customer_id', reviewCandidateIds)
        .eq('professional_id', profile.id)
        .eq('status', 'completed'),
      supabase
        .from('reviews')
        .select('id, rating, body, customer_id')
        .in('customer_id', reviewCandidateIds)
        .eq('professional_id', profile.id)
        .order('created_at', { ascending: false }),
    ]);

    hasCompletedBooking = (bookingData ?? []).length > 0;
    // Bağlam önceliği = aday sırası (self önce, sonra owner kurumlar).
    const reviews = reviewData ?? [];
    const ctxId = reviewCandidateIds.find((id) =>
      reviews.some((r) => r.customer_id === id)
    );
    const ctxReview = ctxId
      ? reviews.find((r) => r.customer_id === ctxId)
      : null;
    existingReview = ctxReview
      ? { id: ctxReview.id, rating: ctxReview.rating, body: ctxReview.body }
      : null;
  }

  // Yorumlar listesi + ortalama puan + profesyonel yanıtları + müşteri profilleri
  const [
    { data: ratingData },
    { data: recentReviewsData },
  ] = await Promise.all([
    supabase
      .from('professional_rating_summary')
      .select('review_count, average_rating')
      .eq('professional_id', profile.id)
      .maybeSingle(),
    supabase
      .from('reviews')
      .select('id, rating, body, created_at, customer_id')
      .eq('professional_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  const reviewCount = ratingData?.review_count ?? 0;
  const averageRating = ratingData?.average_rating ?? 0;
  const recentReviews = recentReviewsData ?? [];

  const badgeInput = {
    approvalStatus: profile.approval_status,
    createdAt: profile.created_at,
    rating: { count: reviewCount, average: averageRating },
  };
  const profileVerified = isVerified(badgeInput);
  // Puan rozetleri (`getBadges`): guven ciplerine 'Yuksek puanli' /
  // 'Cok tercih ediliyor' olarak girer (eski rozet listesinin karsiligi).
  const puanRozetleri = new Set(getBadges(badgeInput).map((b) => b.key));

  // Müşteri profilleri + yanıtları toplu çek
  type CustomerMini = {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  type ReplyMini = {
    id: string;
    review_id: string;
    body: string;
    created_at: string;
    updated_at: string;
  };

  const customerMap = new Map<string, CustomerMini>();
  const replyMap = new Map<string, ReplyMini>();

  if (recentReviews.length > 0) {
    const customerIds = recentReviews.map((r) => r.customer_id);
    const reviewIds = recentReviews.map((r) => r.id);

    const [{ data: customers }, { data: replies }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', customerIds),
      supabase
        .from('review_replies')
        .select('id, review_id, body, created_at, updated_at')
        .in('review_id', reviewIds),
    ]);

    (customers ?? []).forEach((c) => {
      customerMap.set(c.id, c as CustomerMini);
    });
    (replies ?? []).forEach((r) => {
      replyMap.set(r.review_id, r as ReplyMini);
    });
  }

  const isOwnedByProfessional = user?.id === profile.id;
  // Kapi business'i disarida biraktigi icin burada yalniz agency kalir (davranis ayni).
  const displayName =
    profile.role === 'agency' && profile.company_name
      ? profile.company_name
      : profile.full_name || 'İsimsiz';

  const initials = (profile.full_name || profile.company_name || 'K')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const categoryLabel = profile.service_categories
    ? `${profile.service_categories.emoji || ''} ${profile.service_categories.name_tr}`.trim()
    : null;

  const cityName = profile.turkish_cities?.name;

  // Kategoriye özel özellikleri grupla (gösterim için).
  // KAYNAK-FARKINDA: kategori 'category_attributes' sistemindeyse değerler oradan
  // okunur (attributes o kategorilerde BOŞ olur — ayna yazma yok).
  const categorySlug = profile.service_categories?.slug ?? null;
  const attrGroups: { label: string; values: string[] }[] = [];
  if (categorySlug) {
    const source = getFilterSource(categorySlug);
    for (const field of getFilterFields(categorySlug)) {
      const vals = readFilterFieldValues(
        field,
        source,
        profile.attributes,
        profile.category_attributes
      );
      if (vals.length === 0) continue;
      const labels = vals.map(
        (v) => field.options.find((o) => o.value === v)?.label ?? v
      );
      attrGroups.push({ label: field.label, values: labels });
    }
  }

  // ═══════════════ PROFESYONEL REDESIGN DALI (Adım 2) ═══════════════
  // D2-ek — ajans islem kartinin fiyati: paketler ve talep-uzerine OLMAYAN
  // hizmetlerin en dusugu. Fiyat yoksa kart "Fiyat teklifle" der.
  const ajansFiyatAdaylari = [
    ...packages
      .filter((p) => !p.price_on_request && p.price_min != null)
      .map((p) => Number(p.price_min)),
    ...services
      .filter((h) => !h.price_on_request && h.price_min != null)
      .map((h) => Number(h.price_min)),
  ].filter((n) => Number.isFinite(n) && n > 0);
  const ajansEnDusukFiyat =
    ajansFiyatAdaylari.length > 0 ? Math.min(...ajansFiyatAdaylari) : null;

  /**
   * "KISA LISTEYE EKLE" BANDI (hijyen 04, madde 5).
   *
   * HER IKI DALDA da gorunur (ajans ve profesyonel profili), bu yuzden erken
   * return'den ONCE kurulur. Bant yalniz `supplier_search` modulu acik ve
   * `events.manage` yetkili kurulusu olan kullaniciya cizilir; yoksa slot NULL
   * kalir ve DOM'da hicbir sey olmaz.
   *
   * Kullanicinin KENDI profili disarida; kendi kurulusunun saglayici kaydini
   * DB de reddediyor (22023) — burada o kurulus listeden dusurulur ki kullanici
   * calismayacak bir dugme gormesin.
   */
  let kisaListeSlot: ReactNode = null;
  if (isLoggedIn && !isOwnProfile) {
    const { orgs } = await getCrewContext();
    const uygun = orgs.filter(
      (o) =>
        o.shortlistEnabled &&
        o.canManageEvents &&
        // Kurulusun kendi saglayici kaydi listeye eklenemez.
        o.legacyProfileId !== profile.id
    );
    if (uygun.length > 0) {
      const listedekiler = await kisaListedekiKuruluslar(
        uygun.map((o) => o.id),
        profile.id
      );
      kisaListeSlot = (
        <KisaListeyeEkle
          providerId={profile.id}
          kuruluslar={uygun.map((o) => ({
            id: o.id,
            name: o.name,
            durum: listedekiler.has(o.id)
              ? ('listede' as const)
              : ('eklenebilir' as const),
          }))}
        />
      );
    }
  }

  /**
   * AJANS TAMAMLANMIS IS SAYISI (hijyen 04).
   *
   * Profesyonel dalinda bu sayi `bookings.professional_id` uzerinden geliyor;
   * ajansin rezervasyonlari FAZ 7c ile `seller_provider_id` sutununa yaziliyor
   * (teklif sekli). Ikisi birden sayilir: eski akista bir ajans profili
   * `professional_id` ile de rezervasyon almis olabilir.
   *
   * `providers.id = profiles.id` oldugu icin profil kimligi dogrudan kullanilir.
   * Cip 0 iken CIZILMEZ (mevcut kural) — sifir "veri yok" demek degil, "is yok".
   */
  let ajansTamamlanmisIs = 0;
  let ajansTekrarTercih = false;
  if (isAgencyProfile) {
    const { data: ajansDealRows, error: ajansDealHatasi } = await supabase
      .from('bookings')
      .select('customer_id')
      .or(
        `seller_provider_id.eq.${profile.id},professional_id.eq.${profile.id}`
      )
      .eq('status', 'completed');
    if (ajansDealHatasi) {
      console.error('[profil] ajans tamamlanmis is', ajansDealHatasi.message);
    }
    const satirlar = (ajansDealRows ?? []) as { customer_id: string | null }[];
    ajansTamamlanmisIs = satirlar.length;
    // Tekrar tercih AYNI veriden: ayni musteri birden fazla kez calistiysa.
    const sayim = new Map<string, number>();
    for (const d of satirlar) {
      if (!d.customer_id) continue;
      sayim.set(d.customer_id, (sayim.get(d.customer_id) ?? 0) + 1);
    }
    ajansTekrarTercih = [...sayim.values()].some((n) => n > 1);
  }

  // Ajans/kurumsal MEVCUT render'ı aynen korur; yalnız professional yeni 2-kolon
  // düzene geçer. Erken return — benzer-profil sorguları professional'da hiç koşmaz.
  if (profile.role === 'professional') {
    // Deneyim (work / education / award) — kind + sort sırasıyla
    const { data: expData } = await supabase
      .from('profile_experiences')
      .select('*')
      .eq('profile_id', profile.id)
      .order('kind', { ascending: true })
      .order('sort_order', { ascending: true });
    const experiences = (expData ?? []) as ProfileExperience[];

    // Tekrar-tercih sinyali — tamamlanmış rezervasyonları müşteriye göre grupla (indexli).
    // "deal" = completed booking. (Kabul edilmiş teklif birleşimi Faz-2'ye bırakıldı.)
    const { data: dealRows } = await supabase
      .from('bookings')
      .select('customer_id')
      .eq('professional_id', profile.id)
      .eq('status', 'completed');
    const dealCounts = new Map<string, number>();
    for (const d of dealRows ?? []) {
      const cid = d.customer_id as string;
      dealCounts.set(cid, (dealCounts.get(cid) ?? 0) + 1);
    }
    const distinctCustomers = dealCounts.size;
    const repeatCustomers = [...dealCounts.values()].filter((n) => n > 1).length;
    const repeatSignal =
      distinctCustomers > 0
        ? { distinctCustomers, repeatRate: repeatCustomers / distinctCustomers }
        : null;

    const badgeCards = getBadgeCards({
      verified: profileVerified,
      premiumActive: isPremiumActive(
        profile.premium_tier as PremiumTier | null,
        profile.premium_until
      ),
      responseTime: null, // fastResponse Faz-2 (pahalı ilk-yanıt taraması — şimdilik atla)
      repeat: repeatSignal,
    });

    const isBusyNow = isBusy(new Set(blockedDates));

    // D2 — guven cipleri: HEPSI mevcut veriden. `dealRows` yukarida tekrar
    // tercih sinyali icin okundu; tamamlanmis is SAYISI ayni satirlardan
    // gelir, EK SORGU YOK. Ortalama yanit suresi bugun hesaplanmiyor
    // (`getBadgeCards` responseTime: null, FAZ 2) — o yuzden null gecer ve
    // cip cizilmez; sayi UYDURULMAZ.
    const tamamlanmisIsSayisi = (dealRows ?? []).length;
    const guvenSinyalleri = {
      dogrulanmis: profileVerified,
      profilOnayli: profile.approval_status === 'approved',
      tamamlanmisIs: tamamlanmisIsSayisi,
      ortalamaYanitSaati: null as number | null,
      tekrarTercih: badgeCards.some((b) => b.key === 'repeatChoice'),
      yuksekPuanli: puanRozetleri.has('topRated'),
      cokTercihEdilen: puanRozetleri.has('popular'),
      premium: isPremiumActive(
        profile.premium_tier as PremiumTier | null,
        profile.premium_until
      ),
    };

    // En dusuk baslangic fiyati: paketler ve talep-uzerine OLMAYAN hizmetler.
    // Fiyat yoksa null -> kart "Fiyat teklifle" der (uydurma fiyat yok).
    const fiyatAdaylari = [
      ...packages
        .filter((p) => !p.price_on_request && p.price_min != null)
        .map((p) => Number(p.price_min))
        .filter((n) => Number.isFinite(n) && n > 0),
      ...services
        .filter((h) => !h.price_on_request && h.price_min != null)
        .map((h) => Number(h.price_min))
        .filter((n) => Number.isFinite(n) && n > 0),
    ];
    const enDusukFiyat =
      fiyatAdaylari.length > 0 ? Math.min(...fiyatAdaylari) : null;

    // "Onaylı yorum" — gösterilen yorumların müşterilerinden GERÇEK anlaşması olanlar.
    // Deal = SIRA1 tanımı (bookings confirmed/completed; kabul edilmiş teklif trigger ile
    // buraya düşer). bookings RLS üçüncü kişiye kapalı olduğundan public sayfada istemci
    // sorgusu boş döner → SECURITY DEFINER RPC ile TEK batch çağrı (yalnız üyelik döner).
    // Konuşma varlığı (yalnız mesajlaşma) deal DEĞİL → o kartlar rozetsiz kalır.
    // RPC henüz uygulanmamışsa error döner, set boş → hiçbir kartta rozet (güvenli: over-claim yok).
    const verifiedCustomerIds = new Set<string>();
    if (recentReviews.length > 0) {
      const reviewCustomerIds = [
        ...new Set(recentReviews.map((r) => r.customer_id)),
      ];
      const { data: dealIds } = await supabase.rpc(
        'deal_confirmed_customer_ids',
        { p_professional: profile.id, p_customers: reviewCustomerIds }
      );
      for (const row of (dealIds ?? []) as { customer_id: string }[]) {
        if (row.customer_id) verifiedCustomerIds.add(row.customer_id);
      }
    }

    // ---- FAZ 5/P3 — "Havuza ekle" (yalniz `talent.manage` yetkisi olan ajans uyesi) ----
    // Yetkili kurulus yoksa slot NULL kalir: DOM'da hicbir sey yok. `talent_id` ve
    // roller SUNUCUDA okunur, istemciye gitmez (istemci yalniz providerId gonderir).
    let havuzSlot: ReactNode = null;
    if (isLoggedIn && !isOwnProfile) {
      const { orgs } = await getTalentPoolContext();
      const yonetilen = orgs.filter((o) => o.canManage);
      if (yonetilen.length > 0) {
        const { data: saglayiciRow } = await supabase
          .from('providers')
          .select('id, provider_type, talent_id')
          .eq('id', profile.id)
          .maybeSingle();
        const saglayici = saglayiciRow as {
          provider_type: string;
          talent_id: string | null;
        } | null;
        // Ajans profilleri ve talent'siz kayitlar havuza eklenmez.
        const talentId =
          saglayici?.provider_type === 'professional'
            ? (saglayici.talent_id ?? null)
            : null;

        if (talentId) {
          const [{ data: havuzKayitlari }, { data: saglayiciRolleri }] =
            await Promise.all([
              supabase
                .from('organization_talent_records')
                .select('id, status, organization_id')
                .eq('talent_id', talentId)
                .in(
                  'organization_id',
                  yonetilen.map((o) => o.id)
                ),
              supabase
                .from('provider_services')
                .select('role_id, is_primary, service_roles(name_tr)')
                .eq('provider_id', profile.id),
            ]);

          const kayitliOrgIdleri = new Set(
            ((havuzKayitlari ?? []) as { organization_id: string }[]).map(
              (k) => k.organization_id
            )
          );

          type SaglayiciRol = {
            role_id: number;
            is_primary: boolean;
            service_roles: { name_tr: string } | null;
          };
          const rolEtiketleri = (
            (saglayiciRolleri ?? []) as unknown as SaglayiciRol[]
          )
            .slice()
            .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
            .map((r) => {
              const ad = r.service_roles?.name_tr;
              if (!ad) return null;
              return r.is_primary ? `${ad} (birincil)` : ad;
            })
            .filter((v): v is string => !!v);

          havuzSlot = (
            <HavuzaEkle
              providerId={profile.id}
              providerName={displayName}
              kuruluslar={yonetilen.map((o) => ({
                id: o.id,
                name: o.name,
                durum: kayitliOrgIdleri.has(o.id)
                  ? ('havuzda' as const)
                  : ('eklenebilir' as const),
              }))}
              rolEtiketleri={rolEtiketleri}
            />
          );
        }
      }
    }

    // Temsil eden ajans (mini kart) — ilki
    const repAg = representingAgencies[0]?.agency ?? null;
    const representingAgency = repAg
      ? {
          id: repAg.id,
          name: repAg.company_name || repAg.full_name || 'İsimsiz ajans',
          initials: (repAg.company_name || repAg.full_name || 'A')
            .split(' ')
            .map((s) => s[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase(),
        }
      : null;

    return (
      <>
        <TopNav />
        {previewBand}
        <ProfessionalProfile
          profile={{
            id: profile.id,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            bio: profile.bio,
            role: profile.role,
            approval_status: profile.approval_status,
            category_attributes: profile.category_attributes,
            service_categories: profile.service_categories,
          }}
          displayName={displayName}
          initials={initials}
          categorySubtitle={profile.service_categories?.name_tr ?? 'Profesyonel'}
          cityName={cityName}
          averageRating={averageRating}
          reviewCount={reviewCount}
          isBusyNow={isBusyNow}
          services={services}
          packages={packages}
          guvenSinyalleri={guvenSinyalleri}
          blockedDates={blockedDates}
          bookedDates={[]}
          enDusukFiyat={enDusukFiyat}
          portfolioItems={portfolioItems}
          experiences={experiences}
          representingAgency={representingAgency}
          recentReviews={recentReviews}
          verifiedCustomerIds={verifiedCustomerIds}
          customerMap={customerMap}
          replyMap={replyMap}
          reviewsHref={`/p/${profile.id}/yorumlar`}
          isLoggedIn={isLoggedIn}
          isOwnProfile={isOwnProfile}
          currentUserIsProfessional={currentUserIsProfessional}
          currentUserRole={currentUserRole}
          writableBusinesses={writableBusinesses}
          showFavoriteButton={showFavoriteButton}
          initialFavorited={initialFavorited}
          canReview={canReview}
          hasCompletedBooking={hasCompletedBooking}
          existingReview={existingReview}
          havuzSlot={havuzSlot}
          kisaListeSlot={kisaListeSlot}
        />
      </>
    );
  }

  // ---- BENZER PROFİLLER (additive) ----
  // Aynı kategorideki diğer YAYINDA + ONAYLI hizmet sağlayıcılar (professional/agency).
  // ProfileCard yeniden kullanılır; aynı şehir önce, sonra yüksek puan; ilk 6.
  // Sorgunun sectigi 12 sutun + iki embed (category_attributes YOK — sorguya eklenmez).
  type SimilarCandidate = Pick<
    ProviderPublic,
    | 'id'
    | 'full_name'
    | 'avatar_url'
    | 'bio'
    | 'company_name'
    | 'role'
    | 'created_at'
    | 'approval_status'
    | 'premium_tier'
    | 'premium_until'
    | 'attributes'
    | 'city_id'
  > &
    CityEmbed &
    CategoryEmbed;

  let similarProfiles: SimilarCandidate[] = [];
  const similarServicesByProfile: Record<
    string,
    { price_min: number | null; price_max: number | null; price_on_request: boolean }[]
  > = {};
  const similarRatingsByProfile: Record<string, { count: number; average: number }> = {};
  let similarFavoritedIds = new Set<string>();

  if (profile.primary_category_id != null) {
    const { data: candidatesData } = await supabase
      .from('v_providers_public')
      .select(
        `
        id, full_name, avatar_url, bio, company_name, role, created_at, approval_status, premium_tier, premium_until, attributes, city_id,
        turkish_cities(name),
        service_categories!profiles_primary_category_id_fkey(name_tr, emoji, slug)
      `
      )
      .eq('primary_category_id', profile.primary_category_id)
      .eq('is_published', true)
      .eq('approval_status', 'approved')
      .in('role', ['professional', 'agency'])
      .neq('id', profile.id)
      .limit(12); // over-fetch; JS'te şehir+puan sıralanıp 6'ya inilir

    const candidates = (candidatesData ?? []) as unknown as SimilarCandidate[];

    if (candidates.length > 0) {
      const candidateIds = candidates.map((c) => c.id);

      // Fiyat + puan + favori (paralel)
      const [{ data: simServices }, { data: simRatings }, favIds] = await Promise.all([
        supabase
          .from('services')
          .select('profile_id, price_min, price_max, price_on_request')
          .eq('is_active', true)
          .in('profile_id', candidateIds),
        supabase
          .from('professional_rating_summary')
          .select('professional_id, review_count, average_rating')
          .in('professional_id', candidateIds),
        isLoggedIn && currentUserRole === 'client'
          ? getFavoritedIds()
          : Promise.resolve(new Set<string>()),
      ]);

      (simServices ?? []).forEach((svc) => {
        if (!similarServicesByProfile[svc.profile_id])
          similarServicesByProfile[svc.profile_id] = [];
        similarServicesByProfile[svc.profile_id].push({
          price_min: svc.price_min,
          price_max: svc.price_max,
          price_on_request: svc.price_on_request,
        });
      });

      (simRatings ?? []).forEach((r) => {
        similarRatingsByProfile[r.professional_id] = {
          count: r.review_count,
          average: r.average_rating,
        };
      });

      similarFavoritedIds = favIds;

      // Sıralama: aynı şehir önce, sonra yüksek puan (null = 0) → ilk 6
      similarProfiles = candidates
        .sort((a, b) => {
          const aCity = a.city_id === profile.city_id ? 1 : 0;
          const bCity = b.city_id === profile.city_id ? 1 : 0;
          if (aCity !== bCity) return bCity - aCity;
          const aRating = similarRatingsByProfile[a.id]?.average ?? 0;
          const bRating = similarRatingsByProfile[b.id]?.average ?? 0;
          return bRating - aRating;
        })
        .slice(0, 6);
    }
  }

  return (
    // Fiyat/takvim karti Tarih/Sehir/Kisi degerlerini BAGLAMDAN okur; ajans
    // dalinda da saglayici gerekir (sunucu yalniz `children` gecer).
    <ProfilIslemSaglayici varsayilanSehir={cityName ?? null}>
      <TopNav />
      {previewBand}
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-6xl mx-auto">
          {/* EKMEK KIRINTISI (D2) — "geri don" yerine konum: kullanici nerede
              oldugunu ve nereye donebilecegini ayni satirda gorur. */}
          <nav
            aria-label="Konum"
            className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 flex items-center gap-1.5 flex-wrap mb-6"
          >
            <Link href="/kesfet" className="hover:text-brand-ink transition-colors">
              Keşfet
            </Link>
            {profile.service_categories?.slug && (
              <>
                <span aria-hidden="true">·</span>
                <Link
                  href={`/kategori/${profile.service_categories.slug}`}
                  className="hover:text-brand-ink transition-colors"
                >
                  {profile.service_categories.name_tr}
                </Link>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-ink">{displayName}</span>
          </nav>

          {/* IKI SUTUN (D2-ek): profesyonel profiliyle AYNI izgara. Ajans
              sayfasi tek sutun `max-w-3xl` idi; islem kartina yer yoktu ve
              CTA bloğu sayfanin en dibinde kaliyordu. */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-7">
            <div className="min-w-0">

          {/* HEADER */}
          <div className="bg-card border border-line rounded-2xl p-8 mb-6">
            <div>
            {showFavoriteButton && (
              <div className="absolute top-6 right-6 z-10">
                <FavoriteButton
                  professionalId={profile.id}
                  initialFavorited={initialFavorited}
                  isLoggedIn={isLoggedIn}
                  userRole={currentUserRole}
                  variant="detail"
                />
              </div>
            )}
            <div className="flex items-start gap-6 flex-wrap">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-28 h-28 rounded-full object-cover border-2 border-line shrink-0"
                />
              ) : (
                <div
                  className={`w-28 h-28 rounded-full flex items-center justify-center text-paper font-display font-semibold text-4xl shrink-0 ${
                    isAgencyProfile ? 'bg-ink-blue' : 'bg-brand-ink'
                  }`}
                >
                  {initials}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-2">
                  {getRoleLabel(profile.role)}
                </p>
                <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight flex items-center gap-2">
                  <span>{displayName}</span>
                  {profileVerified && (
                    <span
                      title="Doğrulanmış"
                      aria-label="Doğrulanmış"
                      className="shrink-0 inline-flex"
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path
                          d="M12 2l2.4 1.8 3 -.2 .9 2.9 2.4 1.8 -1 2.9 1 2.9 -2.4 1.8 -.9 2.9 -3 -.2L12 22l-2.4-1.8-3 .2-.9-2.9L3.3 15.7l1-2.9-1-2.9 2.4-1.8.9-2.9 3 .2z"
                          fill="var(--color-moss)"
                        />
                        <path d="M8.5 12l2.2 2.2 4.3-4.4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </h1>
                {categoryLabel && (
                  <p className="text-ink-72 mt-1.5">{categoryLabel}</p>
                )}
                {/* GUVEN CIPLERI (D2) — profesyonel profiliyle AYNI bilesen.
                    Premium/onay gibi mevcut rozetler burada tek dille gorunur. */}
                <div className="mt-2.5">
                  <GuvenCipleri
                    dogrulanmis={profileVerified}
                    profilOnayli={profile.approval_status === 'approved'}
                    tamamlanmisIs={ajansTamamlanmisIs}
                    ortalamaYanitSaati={null}
                    tekrarTercih={ajansTekrarTercih}
                    yuksekPuanli={puanRozetleri.has('topRated')}
                    cokTercihEdilen={puanRozetleri.has('popular')}
                    premium={isPremiumActive(
                      profile.premium_tier as PremiumTier | null,
                      profile.premium_until
                    )}
                  />
                </div>
                {cityName && (
                  <p className="text-sm text-ink-72 mt-2 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 12.25C7 12.25 11.375 8.4375 11.375 5.6875C11.375 3.27258 9.41492 1.3125 7 1.3125C4.58508 1.3125 2.625 3.27258 2.625 5.6875C2.625 8.4375 7 12.25 7 12.25Z" stroke="currentColor" strokeWidth="1" />
                      <circle cx="7" cy="5.6875" r="1.3125" stroke="currentColor" strokeWidth="1" />
                    </svg>
                    {cityName}
                  </p>
                )}
                {(() => {
                  const lastSeenText = formatLastSeen(profile.last_seen_at);
                  const tone = getLastSeenTone(profile.last_seen_at);
                  if (!lastSeenText) return null;

                  const dotColor =
                    tone === 'active'
                      ? 'bg-green-500'
                      : tone === 'recent'
                        ? 'bg-amber-500'
                        : 'bg-ink-72/40';
                  const textColor =
                    tone === 'active' ? 'text-ink' : 'text-ink-72';

                  return (
                    <p
                      className={`text-xs ${textColor} mt-1.5 flex items-center gap-1.5`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${dotColor}`}
                        aria-hidden="true"
                      />
                      {lastSeenText}
                    </p>
                  );
                })()}
                {reviewCount > 0 && (
                  <Link
                    href={`/p/${profile.id}/yorumlar`}
                    className="inline-flex items-center gap-2 mt-3 group"
                  >
                    <span className="flex items-center gap-1">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-brand-accent)" stroke="var(--color-brand-accent)" strokeWidth="1.5" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                      <span className="font-display font-semibold text-ink">
                        {averageRating}
                      </span>
                    </span>
                    <span className="text-sm text-ink-72 group-hover:text-brand-ink transition-colors">
                      ({reviewCount} yorum)
                    </span>
                  </Link>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="text-ink mt-6 leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}

            {/* hijyen 04 — "Kisa listeye ekle" banti. Profesyonel dalinda sag
                sutunda duruyor; ajans dalinda sag sutun yok, bu yuzden kimlik
                blogunun altinda ayri bir bant olarak cizilir. */}
            {kisaListeSlot && <div className="mt-6">{kisaListeSlot}</div>}
            </div>
          </div>

          {/* KATEGORİYE ÖZEL ÖZELLİKLER */}
          {attrGroups.length > 0 && (
            <div className="bg-card border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-6">Özellikler</h2>
              <div className="space-y-5">
                {attrGroups.map((group) => (
                  <div key={group.label}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.values.map((val) => (
                        <span
                          key={val}
                          className="text-sm text-ink bg-paper border border-line px-3 py-1.5 rounded-lg"
                        >
                          {val}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EKİBİMİZ (ajans) */}
          {isAgencyProfile && (
            <div className="bg-card border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-1">Ekibimiz</h2>
              <p className="text-sm text-ink-72 mb-6">
                Bu ajansın çatısı altındaki profesyoneller.
              </p>
              {agencyTeam.length === 0 ? (
                <p className="text-ink-72 text-sm">
                  Bu ajans henüz ekibini oluşturuyor.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {agencyTeam.map((member) => {
                    const pro = member.professional;
                    if (!pro) return null;
                    const proName = pro.full_name || 'İsimsiz';
                    const proInitials = proName
                      .split(' ')
                      .map((s) => s[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    const proCategoryLabel = pro.service_categories
                      ? `${pro.service_categories.emoji || ''} ${pro.service_categories.name_tr}`.trim()
                      : null;
                    return (
                      <Link
                        key={member.id}
                        href={`/p/${pro.id}`}
                        className="flex items-center gap-3 border border-line rounded-lg p-4 hover:border-brand-ink hover:shadow-[3px_3px_0_var(--color-brand-ink)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all group"
                      >
                        {pro.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={pro.avatar_url}
                            alt={proName}
                            className="w-12 h-12 rounded-full object-cover border border-line shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-brand-ink flex items-center justify-center text-paper font-display font-semibold shrink-0">
                            {proInitials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-ink group-hover:text-brand-ink transition-colors truncate">
                            {proName}
                          </p>
                          {proCategoryLabel && (
                            <p className="text-xs text-ink-72 truncate">
                              {proCategoryLabel}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* NOT: "Ajans temsili" bloğu professional dalına (yeni redesign) taşındı —
              rail'de mini ajans kartı olarak. Bu fallback yalnız agency/business render eder. */}

          {/* PORTFÖY GALERİ */}
          {portfolioItems.length > 0 && (
            <div className="bg-card border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-6">Portföy</h2>
              <PortfolioGallery
                items={portfolioItems}
                gridClassName="grid grid-cols-2 md:grid-cols-3 gap-3"
              />
            </div>
          )}

          {/* PAKETLER */}
          {packages.length > 0 && (
            <div className="bg-card border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-1">Paketler</h2>
              <p className="text-sm text-ink-72 mb-6">
                Hazır paketler — ihtiyacına en yakınını seçip doğrudan iletişime
                geç.
              </p>
              <div className="space-y-4">
                {packages.map((pkg) => {
                  const pkgPrice = formatPriceRange(
                    pkg.price_min,
                    pkg.price_max,
                    pkg.price_on_request,
                    'total',
                    pkg.price_starting
                  );
                  return (
                    <div
                      key={pkg.id}
                      className="border border-line rounded-xl p-5 hover:border-brand-ink/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
                        <h3 className="font-display text-xl text-ink">
                          {pkg.title}
                        </h3>
                        {pkgPrice && (
                          <span className="font-display font-semibold text-brand-ink text-lg shrink-0">
                            {pkgPrice}
                          </span>
                        )}
                      </div>
                      {pkg.description && (
                        <p className="text-sm text-ink-72 leading-relaxed whitespace-pre-wrap mb-3">
                          {pkg.description}
                        </p>
                      )}
                      {pkg.includes && pkg.includes.length > 0 && (
                        <ul className="space-y-1.5 mb-4">
                          {pkg.includes.map((item, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-ink"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5 text-moss" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {!isOwnProfile && (
                        <IletisimButton
                          professionalId={profile.id}
                          professionalName={displayName}
                          categorySlug={profile.service_categories?.slug ?? null}
                          isLoggedIn={isLoggedIn}
                          currentUserIsProfessional={currentUserIsProfessional}
                          isOwnProfile={isOwnProfile}
                          etkinlikId={etkinlikId}
                          packageContext={{
                            title: pkg.title,
                            price: pkgPrice,
                          }}
                          variant="package"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* HİZMETLER */}
          {services.length > 0 && (
            <div className="bg-card border border-line rounded-lg p-8 mb-6">
              <h2 className="font-display text-2xl text-ink mb-6">
                Sunulan hizmetler
              </h2>
              <div className="space-y-5">
                {services.map((service) => (
                  <HizmetSecici
                    key={service.id}
                    service={service}
                    professionalId={profile.id}
                    professionalName={displayName}
                    categorySlug={profile.service_categories?.slug ?? null}
                    isLoggedIn={isLoggedIn}
                    currentUserIsProfessional={currentUserIsProfessional}
                    isOwnProfile={isOwnProfile}
                  />
                ))}
              </div>
            </div>
          )}
          {/* YORUMLAR (varsa) */}
          {recentReviews.length > 0 && (
            <div className="bg-card border border-line rounded-lg p-8 mb-6">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h2 className="font-display text-2xl text-ink">
                  Yorumlar
                </h2>
                {reviewCount > 3 && (
                  <Link
                    href={`/p/${profile.id}/yorumlar`}
                    className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-brand-ink transition-colors"
                  >
                    Tümünü gör ({reviewCount}) →
                  </Link>
                )}
              </div>
              <div className="space-y-4">
                {recentReviews.map((r) => (
                  <ReviewCard
                    key={r.id}
                    review={{
                      id: r.id,
                      rating: r.rating,
                      body: r.body,
                      created_at: r.created_at,
                    }}
                    customer={customerMap.get(r.customer_id) ?? null}
                    reply={replyMap.get(r.id) ?? null}
                    isOwnedByProfessional={isOwnedByProfessional}
                    isLoggedIn={isLoggedIn}
                  />
                ))}
              </div>
            </div>
          )}

            </div>

            {/* ═══════════ SAG SUTUN — islem karti ═══════════ */}
            <aside className="lg:sticky lg:top-24 lg:self-start flex flex-col gap-4 order-last">
              {/* Takvim ancak dolu gun verisi varsa anlamli; yoksa kart
                  takvimsiz calisir (fiyat + alanlar). */}
              {/* CTA'lar KARTIN ICINDE (D2-ek): Teklif Al / Rezervasyon Talebi
                  karttaki Tarih/Sehir/Kisi degerlerini on-doldurma olarak alir.
                  Ayri bir "Bu profesyonelle calis" kutusunda dursalardi bu
                  degerler onlara ulasmazdi (sunucu bileseni arada). Davet
                  MEVCUT kapisiyla kartin altinda. */}
              <FiyatTakvimKarti
                enDusukFiyat={ajansEnDusukFiyat}
                blockedDates={blockedDates}
                bookedDates={[]}
                cta={
                  !isOwnProfile
                    ? {
                        professionalId: profile.id,
                        professionalName: displayName,
                        categorySlug: profile.service_categories?.slug ?? null,
                        isLoggedIn,
                        currentUserIsProfessional,
                        isOwnProfile,
                        writableBusinesses,
                        etkinlikId,
                      }
                    : undefined
                }
                altAlan={
                  !isOwnProfile &&
                  (!currentUserIsProfessional || writableBusinesses.length > 0) ? (
                    <DavetButton
                      professionalId={profile.id}
                      professionalName={displayName}
                      isLoggedIn={isLoggedIn}
                      currentUserIsProfessional={currentUserIsProfessional}
                      isOwnProfile={isOwnProfile}
                      writableBusinesses={writableBusinesses}
                    />
                  ) : null
                }
              />

          {/* İLETİŞİM & YORUM BUTONLARI */}
          <div className="flex flex-col gap-3">
            {!isOwnProfile ? null : (
              /* Kendi profili / profesyonel: mevcut IletisimButton bilgi kutusunu göster */
              <IletisimButton
                professionalId={profile.id}
                professionalName={displayName}
                categorySlug={profile.service_categories?.slug ?? null}
                isLoggedIn={isLoggedIn}
                currentUserIsProfessional={currentUserIsProfessional}
                isOwnProfile={isOwnProfile}
                etkinlikId={etkinlikId}
              />
            )}
            <YorumButton
              professionalId={profile.id}
              professionalName={displayName}
              hasConversation={hasCompletedBooking}
              existingReview={existingReview}
              enabled={canReview}
            />
          </div>
            </aside>
          </div>

          {/* Profili şikayet et — sahibi olmayan herkese */}
          {!isOwnProfile && (
            <div className="mt-6 flex justify-center">
              <SikayetButton
                targetType="profile"
                targetId={profile.id}
                isLoggedIn={isLoggedIn}
                variant="link"
                label="Bu profili şikayet et"
              />
            </div>
          )}
        </div>

        {/* BENZER PROFİLLER — aynı kategorideki diğer profesyoneller (additive; boşsa gizli) */}
        {similarProfiles.length > 0 && (
          <section className="max-w-3xl mx-auto mt-14">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-ink mb-2">
              Benzer profiller
            </p>
            <h2 className="font-display font-semibold text-2xl md:text-3xl text-ink tracking-tight mb-1.5">
              Aynı kategoride{' '}
              <em className="text-brand-ink not-italic italic font-medium">
                diğer profesyoneller
              </em>
            </h2>
            <p className="text-ink-72 text-sm mb-6">
              {profile.service_categories?.name_tr ?? 'Bu kategori'} alanındaki diğer
              profiller
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-fr">
              {similarProfiles.map((p) => (
                <ProfileCard
                  key={p.id}
                  profile={p}
                  services={similarServicesByProfile[p.id] || []}
                  rating={similarRatingsByProfile[p.id] || null}
                  isFavorited={similarFavoritedIds.has(p.id)}
                  isLoggedIn={isLoggedIn}
                  currentUserRole={currentUserRole}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </ProfilIslemSaglayici>
  );
}