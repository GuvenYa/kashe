import Link from 'next/link';
import { IletisimButton } from './iletisim-button';
import { RezervasyonButton } from './rezervasyon-button';
import { DavetButton } from './davet-button';
import FavoriteButton from '@/app/components/FavoriteButton';
import { SikayetButton } from '@/app/sikayet/sikayet-button';
import { YorumButton } from './yorum-button';
import { ShareButton } from './share-button';
import { type OnBehalfBusiness } from '@/app/components/on-behalf-selector';
import { ProfileMediaHero, type HeroMedia } from './profile-media-hero';
import { formatPriceRange } from '@/app/lib/profile-helpers';
import type { BadgeCard } from '@/app/lib/badges';
import {
  getCategoryFields,
  getModuleTitle,
  getQuickLabel,
  MODULE_REGISTRY,
  type LeveledSkill,
  type ProfileExperience,
} from '@/app/lib/category-fields';
import type {
  ServiceWithCategory,
  ServicePackage,
  PortfolioItem,
} from '@/app/lib/types';

type AttrRecord = Record<string, unknown>;

export type ProfessionalProfileProps = {
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    role: string;
    approval_status: string | null;
    category_attributes: AttrRecord | null;
    service_categories: { name_tr: string; emoji: string | null; slug: string } | null;
  };
  displayName: string;
  initials: string;
  categorySubtitle: string;
  cityName: string | undefined;
  averageRating: number;
  reviewCount: number;
  badgeCards: BadgeCard[];
  isBusyNow: boolean;
  services: ServiceWithCategory[];
  packages: ServicePackage[];
  portfolioItems: PortfolioItem[];
  experiences: ProfileExperience[];
  representingAgency: { id: string; name: string; initials: string } | null;
  recentReviews: { id: string; rating: number; body: string | null; created_at: string; customer_id: string }[];
  /** Gerçek anlaşması (deal-confirmed) olan müşteri id'leri — yalnız bu kartlarda "Onaylı yorum". */
  verifiedCustomerIds: Set<string>;
  customerMap: Map<string, { id: string; full_name: string | null; avatar_url: string | null }>;
  replyMap: Map<string, { id: string; review_id: string; body: string; created_at: string; updated_at: string }>;
  reviewsHref: string;
  // etkileşim
  isLoggedIn: boolean;
  isOwnProfile: boolean;
  currentUserIsProfessional: boolean;
  currentUserRole: string | null;
  writableBusinesses: OnBehalfBusiness[];
  showFavoriteButton: boolean;
  initialFavorited: boolean;
  canReview: boolean;
  hasCompletedBooking: boolean;
  existingReview: { id: string; rating: number; body: string | null } | null;
};

const EYEBROW =
  'font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta';
const CARD = 'bg-card border border-line rounded-2xl';

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

function Stars({ rating, size = 15 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-px" aria-label={`${rating} yıldız`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(rating) ? 'var(--color-plum)' : '#D9D2C2'} aria-hidden="true">
          <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
        </svg>
      ))}
    </span>
  );
}

export function ProfessionalProfile(props: ProfessionalProfileProps) {
  const {
    profile, displayName, initials, categorySubtitle, cityName,
    averageRating, reviewCount, badgeCards, isBusyNow, services, packages,
    portfolioItems, experiences, representingAgency, recentReviews,
    verifiedCustomerIds, customerMap, replyMap, reviewsHref, isLoggedIn, isOwnProfile,
    currentUserIsProfessional, currentUserRole, writableBusinesses,
    showFavoriteButton, initialFavorited, canReview, hasCompletedBooking,
    existingReview,
  } = props;

  const slug = profile.service_categories?.slug ?? null;
  const preset = getCategoryFields(slug);
  const attrs = (profile.category_attributes ?? {}) as AttrRecord;
  const quick = (attrs.quick as Record<string, string>) ?? {};
  const skills = (attrs.skills as LeveledSkill[]) ?? [];
  const logistics = (attrs.logistics as Record<string, boolean>) ?? {};
  const serviceRegion = attrs.service_region as string | undefined;
  const experienceLabel = attrs.experience_label as string | undefined;
  // Çalışma şekli — ORTAK alan; yoksa eski quick.calisma_sekli'den OKU (tek yön; anayasa: boşsa satır yok).
  const calismaSekli =
    (attrs.calisma_sekli as string | undefined) ??
    ((attrs.quick as Record<string, unknown> | undefined)?.calisma_sekli as
      | string
      | undefined);
  const taglines = (attrs.section_taglines as Record<string, string>) ?? {};
  const modulesData = (attrs.modules as Record<string, AttrRecord>) ?? {};
  const summary = attrs.summary as { title?: string; body?: string; stats?: string[] } | undefined;
  const archetype = preset?.archetype ?? 'produksiyon';

  // ---- Fiyat aralığı (yayındaki hizmetler; tümü talep-üzerine ise gizle) ----
  const priceable = services.filter((s) => !s.price_on_request && s.price_min !== null);
  let priceRange: string | null = null;
  if (priceable.length > 0) {
    const min = Math.min(...priceable.map((s) => s.price_min as number));
    const max = Math.max(...priceable.map((s) => (s.price_max ?? s.price_min) as number));
    // C4 — para birimi SONDA (formatPriceRange tek kaynak). Tek fiyat noktası → "X ₺'den başlar";
    // gerçek aralık → "min – max ₺". (min===max'ta leading-₺ formatPrice'tan kaçınılır.)
    priceRange =
      min === max
        ? formatPriceRange(min, min, false, 'total', true)
        : formatPriceRange(min, max, false);
  }

  // ---- Hero medyası ----
  const heroMedia: HeroMedia[] = portfolioItems.map((p) => ({
    id: p.id, type: p.media_type, url: p.media_url, caption: p.caption,
  }));

  // ---- quickInfo hücreleri — TEK-YER: yalnız quick{} kendi değerleri (modül-fallback YOK).
  //      Eşik: 2'den az dolu hücre → quick satırı hiç çizilmez.
  const quickCells = (preset?.quickInfo ?? [])
    .map((k) => ({ key: k, label: getQuickLabel(preset, k), value: quick[k] as unknown }))
    .filter((c) => {
      if (c.key === 'yeminli') return c.value === 'Evet'; // yalnız "Evet" gösterilir
      return c.value && String(c.value).trim();
    });
  const showQuick = quickCells.length >= 2;

  // ---- Lojistik satırları (logistics{} ∩ preset açıklamaları) ----
  const logisticsRows = (preset?.logisticsChecks ?? []).filter((c) => logistics[c.key]);

  // ---- Deneyim grupları (ÇİZİLEBİLİR satıra göre) / eğitim / ödül ----
  // preset grupları preset sırasıyla; preset'te karşılığı olmayan (veya null) group_key'li
  // kayıtlar tek "Diğer" grubu altında toplanır — yutulmaz. Toplam çizilebilir satır 0 ise
  // bölüm hiç render edilmez (aşağıda totalWorkRows ile).
  const workItems = experiences.filter((x) => x.kind === 'work');
  const workByGroup = new Map<string, ProfileExperience[]>();
  for (const e of workItems) {
    if (!e.group_key) continue;
    if (!workByGroup.has(e.group_key)) workByGroup.set(e.group_key, []);
    workByGroup.get(e.group_key)!.push(e);
  }
  const presetGroupKeys = new Set((preset?.experienceGroups ?? []).map((g) => g.key));
  const experienceGroupsToRender: {
    key: string;
    label: string;
    items: ProfileExperience[];
  }[] = (preset?.experienceGroups ?? [])
    .map((g) => ({ key: g.key, label: g.label, items: workByGroup.get(g.key) ?? [] }))
    .filter((g) => g.items.length > 0);
  const otherWork = workItems.filter(
    (w) => !w.group_key || !presetGroupKeys.has(w.group_key)
  );
  if (otherWork.length > 0) {
    experienceGroupsToRender.push({ key: '__other', label: 'Diğer', items: otherWork });
  }
  const totalWorkRows = experienceGroupsToRender.reduce((n, g) => n + g.items.length, 0);

  const educationRows = experiences.filter((x) => x.kind === 'education');
  const awardRows = experiences.filter((x) => x.kind === 'award');

  // ---- Bölüm başlıkları: section_taglines doluysa onu, yoksa generic default ----
  const servicesTitle = taglines.hizmetler || 'Çalışma modelleri';
  const experienceTitle = taglines.deneyim || 'Seçili krediler';
  const educationTitle = taglines.egitim || 'Teknik altyapı';

  const showMediaHero =
    archetype !== 'uzmanlik' || preset?.portfolioGrid === true;

  // Medya hero — mobilde rail'de (badge'lerden sonra), masaüstünde main'de (üstte).
  // Aynı JSX iki sarmalayıcıda; görünürlük breakpoint ile ayrılır.
  const mediaHeroEl =
    showMediaHero && heroMedia.length > 0 ? (
      <ProfileMediaHero
        items={heroMedia}
        archetype={archetype}
        useCastLayout={preset?.portfolioGrid === true}
      />
    ) : null;

  // ---- CTA blok ----
  // İşlem yetkisi: kendi profili DEĞİL + (müşteri VEYA manager+ kurum üyesi).
  // Üyeliksiz professional ziyaretçi → yalnız bilgi kutusu (mevcut davranış korunur).
  const canTransact =
    !isOwnProfile && (!currentUserIsProfessional || writableBusinesses.length > 0);

  // ── Aksiyon çubuğu: Davet / Favori / Paylaş / Şikayet — tek tutarlı dizi, eşit ağırlık
  //    (flex-1 hücreler + ayırıcı). Her bileşen kendi 'bare' varyantını render eder →
  //    hücrenin TAMAMI (ikon + etiket) tıklanabilir tetik. Sarmalayıcı hack / !important YOK.
  const actionBar = !isOwnProfile ? (
    <div className="flex items-stretch rounded-xl border border-line overflow-hidden bg-card divide-x divide-line">
      {canTransact && (
        <DavetButton
          professionalId={profile.id}
          professionalName={displayName}
          isLoggedIn={isLoggedIn}
          currentUserIsProfessional={currentUserIsProfessional}
          isOwnProfile={isOwnProfile}
          writableBusinesses={writableBusinesses}
          variant="bare-icon"
        />
      )}
      {showFavoriteButton && (
        <FavoriteButton
          professionalId={profile.id}
          initialFavorited={initialFavorited}
          isLoggedIn={isLoggedIn}
          userRole={currentUserRole}
          variant="bare"
        />
      )}
      <ShareButton title={displayName} />
      <SikayetButton
        targetType="profile"
        targetId={profile.id}
        isLoggedIn={isLoggedIn}
        variant="bare"
      />
    </div>
  ) : null;

  // Birincil CTA'lar variant prop'uyla (MOCKUP): Teklif Al = mercan dolgu (primary-coral),
  // Rezervasyon = zümrüt outline (outline-emerald). Sarmalayıcı override YOK.
  const ctaBlock = canTransact ? (
    <div className="flex flex-col gap-2.5">
      <IletisimButton
        professionalId={profile.id}
        professionalName={displayName}
        categorySlug={slug}
        isLoggedIn={isLoggedIn}
        currentUserIsProfessional={currentUserIsProfessional}
        isOwnProfile={isOwnProfile}
        writableBusinesses={writableBusinesses}
        variant="primary-coral"
      />
      <RezervasyonButton
        professionalId={profile.id}
        professionalName={displayName}
        isLoggedIn={isLoggedIn}
        currentUserIsProfessional={currentUserIsProfessional}
        isOwnProfile={isOwnProfile}
        writableBusinesses={writableBusinesses}
        variant="outline-emerald"
      />
      {actionBar}
    </div>
  ) : !isOwnProfile ? (
    <div className="flex flex-col gap-2.5">
      <IletisimButton
        professionalId={profile.id}
        professionalName={displayName}
        categorySlug={slug}
        isLoggedIn={isLoggedIn}
        currentUserIsProfessional={currentUserIsProfessional}
        isOwnProfile={isOwnProfile}
      />
      {actionBar}
    </div>
  ) : (
    // D4 — sahibi kendi public sayfasına bakarken CTA yerine tek düzenle linki
    <Link
      href="/profil"
      className="block w-full text-center px-5 py-3 bg-transparent border-[1.5px] border-terracotta text-terracotta rounded-xl font-display font-semibold text-[15px] hover:bg-terracotta/5 transition-colors"
    >
      Profilini düzenle →
    </Link>
  );

  return (
    <div className="bg-paper min-h-screen pb-24 lg:pb-12">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            mainEntity: {
              '@type': 'Person',
              name: displayName,
              jobTitle: profile.service_categories?.name_tr ?? undefined,
              address: cityName ? { '@type': 'PostalAddress', addressLocality: cityName } : undefined,
              ...(reviewCount > 0
                ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: averageRating, reviewCount } }
                : {}),
            },
          }),
        }}
      />

      <div className="max-w-6xl mx-auto px-6 md:px-12 py-8 md:py-10">
        <Link
          href="/kesfet"
          className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors inline-flex items-center gap-1.5 mb-6"
        >
          ← Keşfet&apos;e dön
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-7">
          {/* ═══════════ SOL RAIL ═══════════ */}
          <aside className="lg:sticky lg:top-24 lg:self-start flex flex-col gap-4">
            {/* ── KİMLİK — mobil: küçük portre solda + isim/kategori/yıldız sağda ── */}
            <div className="flex items-center gap-4 lg:hidden">
              {profile.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={profile.avatar_url} alt={displayName} className="w-20 h-20 rounded-2xl object-cover border border-line shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-terracotta flex items-center justify-center text-paper font-display font-bold text-2xl shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-display text-[21px] font-bold tracking-tight leading-tight text-ink">{displayName}</h1>
                <p className="text-[13px] text-ink-72 mt-0.5 truncate">{categorySubtitle}</p>
                {reviewCount > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Stars rating={averageRating} size={13} />
                    <span className="text-[13px] font-semibold text-ink">{averageRating}</span>
                    <span className="text-[13px] text-ink-72">({reviewCount})</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── KİMLİK — masaüstü: büyük dikey portre + isim bloğu ── */}
            <div className="hidden lg:block">
              {profile.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={profile.avatar_url} alt={displayName} className="w-full aspect-[4/5] object-cover rounded-2xl border border-line" />
              ) : (
                <div className="w-full aspect-[4/5] rounded-2xl bg-terracotta flex items-center justify-center text-paper font-display font-bold text-6xl">
                  {initials}
                </div>
              )}
              <div className="mt-4">
                <h1 className="font-display text-[27px] font-bold tracking-tight leading-tight text-ink">{displayName}</h1>
                <p className="text-sm text-ink-72 mt-1">{categorySubtitle}</p>
                {reviewCount > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <Stars rating={averageRating} />
                    <span className="text-sm font-semibold text-ink">{averageRating}</span>
                    <span className="text-sm text-ink-72">({reviewCount} yorum)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Rozet kartları (max 2) — mobil: yatay kaydırma (snap + peek); masaüstü: dikey yığın */}
            {badgeCards.length > 0 && (
              <div
                className={`flex gap-2 lg:flex-col ${
                  badgeCards.length > 1
                    ? 'overflow-x-auto lg:overflow-visible snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                    : ''
                }`}
              >
                {badgeCards.map((b) => (
                  <div
                    key={b.key}
                    className={`flex gap-3 px-3.5 py-3 bg-terracotta/5 border border-terracotta/15 rounded-xl snap-start ${
                      badgeCards.length > 1 ? 'shrink-0 w-[80%] lg:w-auto' : 'w-full'
                    }`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
                      <path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                    <div>
                      <div className="font-display text-[13.5px] font-semibold text-ink">{b.label}</div>
                      <div className="text-xs text-ink-72 leading-snug">{b.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MEDYA HERO — mobilde badge'lerden hemen sonra (ajans kartından önce) */}
            {mediaHeroEl && <div className="lg:hidden">{mediaHeroEl}</div>}

            {/* Meta kart */}
            <div className="bg-card border border-line rounded-2xl px-4 py-1.5">
              <MetaRow label="Şehir" value={cityName} />
              <MetaRow label="Hizmet bölgesi" value={serviceRegion} />
              <MetaRow label="Çalışma şekli" value={calismaSekli} />
              <MetaRow label="Fiyat aralığı" value={priceRange} />
              <MetaRow label="Deneyim" value={experienceLabel} />
              <MetaRow
                label="Müsaitlik"
                value={`Önümüzdeki 7 gün: ${isBusyNow ? 'yoğun' : 'müsait'}`}
                dot={isBusyNow ? 'amber' : 'green'}
                last
              />
            </div>

            {/* Lojistik */}
            {logisticsRows.length > 0 && (
              <div className="flex flex-col gap-1.5 px-0.5">
                {logisticsRows.map((c) => (
                  <div key={c.key} className="flex items-center gap-2 text-[13px] text-ink-72">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                      <polyline points="4 12.5 9.5 18 20 6.5" />
                    </svg>
                    {c.label} — {c.description}
                  </div>
                ))}
              </div>
            )}

            {/* CTA — masaüstü tam blok; mobilde primer'ler alt sabit bara taşınır,
                ikon satırı (favori/paylaş/şikayet) rail sonunda (ajanstan sonra) kalır. */}
            <div className="hidden lg:block">{ctaBlock}</div>

            {/* Yetenekler */}
            {skills.length > 0 && (
              <div>
                <div className={`${EYEBROW} mb-2.5`}>Yetenekler</div>
                <div className="flex flex-wrap gap-2">
                  {skills.map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-line rounded-full text-[12.5px] font-medium text-ink">
                      {s.name}
                      {s.level > 0 && (
                        <span className="inline-flex gap-[3px]" aria-label={`Seviye ${Math.min(3, s.level)}/3`}>
                          {Array.from({ length: Math.min(3, s.level) }).map((_, j) => (
                            <span key={j} className="w-[5px] h-[5px] rounded-full bg-plum" />
                          ))}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Ajans mini */}
            {representingAgency && (
              <Link href={`/p/${representingAgency.id}`} className="flex items-center gap-3 bg-card border border-line rounded-2xl px-4 py-3 hover:border-terracotta transition-colors">
                <span className="w-9 h-9 rounded-full bg-terracotta text-paper flex items-center justify-center font-display font-semibold text-[13px] shrink-0">
                  {representingAgency.initials}
                </span>
                <div>
                  <div className="text-[11.5px] text-ink-72">Üye olduğu ajans</div>
                  <div className="text-[13.5px] font-semibold text-ink">{representingAgency.name}</div>
                </div>
              </Link>
            )}

            {/* Mobil ikon satırı — rail sonunda (favori/paylaş/şikayet); masaüstünde CTA bloğunda */}
            {actionBar && <div className="lg:hidden">{actionBar}</div>}
          </aside>

          {/* ═══════════ SAĞ İÇERİK ═══════════ */}
          <main className="min-w-0 flex flex-col gap-7">
            {/* 1. Medya hero — masaüstünde main üstünde (mobilde rail'e taşındı) */}
            {mediaHeroEl && <div className="hidden lg:block">{mediaHeroEl}</div>}
            {/* uzmanlik özet bandı */}
            {archetype === 'uzmanlik' && !preset?.portfolioGrid && summary?.body && (
              <div className="bg-terracotta text-paper rounded-2xl p-7">
                {summary.title && <h2 className="font-display text-2xl font-bold mb-2">{summary.title}</h2>}
                <p className="text-paper/85 leading-relaxed">{summary.body}</p>
                {summary.stats && summary.stats.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {summary.stats.map((st, i) => (
                      <span key={i} className="inline-flex items-center bg-white/12 rounded-full px-3 py-1 text-sm font-semibold">
                        {st}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. Hakkımda + quickInfo */}
            {(profile.bio || taglines.hakkimda) && (
              <section>
                <div className={EYEBROW}>Hakkımda</div>
                {taglines.hakkimda && (
                  <h2 className="font-display text-[22px] font-bold mt-1 mb-3 text-ink">{taglines.hakkimda}</h2>
                )}
                {profile.bio && (
                  <p className="text-[14.5px] leading-[1.7] text-ink-72 whitespace-pre-wrap">{profile.bio}</p>
                )}
                {showQuick && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                    {quickCells.map((c) => (
                      <div key={c.label} className="bg-card border border-line rounded-xl px-4 py-3.5">
                        <div className="text-xs text-ink-72">{c.label}</div>
                        {c.key === 'yeminli' ? (
                          <div className="flex items-center gap-1.5 font-display text-[15px] font-semibold text-ink mt-1">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-moss)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="4 12.5 9.5 18 20 6.5" /></svg>
                            Yeminli
                          </div>
                        ) : (
                          <div className="font-display text-[15px] font-semibold text-ink mt-1">{String(c.value)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 3. Kategori modülleri (preset sırasıyla, koşullu) */}
            {(preset?.modules ?? []).map((ref) => (
              <ModuleSection
                key={ref.key}
                title={getModuleTitle(ref)}
                moduleKey={ref.key}
                data={modulesData[ref.key] ?? null}
                labelOverrides={preset?.labelOverrides}
              />
            ))}

            {/* 4. Hizmetler & Paketler */}
            {(services.length > 0 || packages.length > 0) && (
              <section>
                <div className={EYEBROW}>Hizmetler &amp; Paketler</div>
                <h2 className="font-display text-[22px] font-bold mt-1 mb-4 text-ink">{servicesTitle}</h2>
                <div className="flex flex-col gap-3">
                  {packages.map((pkg) => (
                    <OfferRow
                      key={`pkg-${pkg.id}`}
                      title={pkg.title}
                      description={pkg.description}
                      price={formatPriceRange(pkg.price_min, pkg.price_max, pkg.price_on_request, 'total', pkg.price_starting)}
                    />
                  ))}
                  {services.map((s) => (
                    <OfferRow
                      key={`svc-${s.id}`}
                      title={s.title}
                      description={s.description}
                      price={formatPriceRange(s.price_min, s.price_max, s.price_on_request, s.price_unit ?? 'total', s.price_starting)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 5. Deneyim (work) — çizilebilir gruplar; eşleşmeyenler "Diğer" altında; 0 satırda yok */}
            {totalWorkRows > 0 && (
              <section>
                <div className={EYEBROW}>Deneyim</div>
                <h2 className="font-display text-[22px] font-bold mt-1 mb-4 text-ink">{experienceTitle}</h2>
                {experienceGroupsToRender.map((g) => (
                  <div key={g.key} className="mb-5">
                    <div className={`${EYEBROW} opacity-75 mb-2`}>{g.label}</div>
                    <div className="bg-card border border-line rounded-2xl px-5">
                      {g.items.map((e, i, arr) => (
                        <ExperienceRow key={e.id} exp={e} last={i === arr.length - 1} />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* 6. Eğitim & Sertifikalar */}
            {educationRows.length > 0 && (
              <section>
                <div className={EYEBROW}>Eğitim &amp; Sertifikalar</div>
                <h2 className="font-display text-[22px] font-bold mt-1 mb-4 text-ink">{educationTitle}</h2>
                <div className="bg-card border border-line rounded-2xl px-5">
                  {educationRows.map((e, i) => (
                    <ExperienceRow key={e.id} exp={e} last={i === educationRows.length - 1} />
                  ))}
                </div>
              </section>
            )}

            {/* 7. Yorumlar */}
            {recentReviews.length > 0 && (
              <section>
                <div className={EYEBROW}>Yorumlar</div>
                <h2 className="font-display text-[22px] font-bold mt-1 mb-4 text-ink">
                  {averageRating} ortalama · {reviewCount} yorum
                </h2>
                <div className="flex flex-col gap-3">
                  {recentReviews.map((r) => {
                    const c = customerMap.get(r.customer_id) ?? null;
                    const reply = replyMap.get(r.id) ?? null;
                    const cName = c?.full_name ?? 'Müşteri';
                    const cInitials = cName.split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                    return (
                      <div key={r.id} className={`${CARD} p-5`}>
                        <div className="flex items-center gap-3">
                          {c?.avatar_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={c.avatar_url} alt={cName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                          ) : (
                            <span className="w-10 h-10 rounded-full bg-terracotta text-paper flex items-center justify-center font-display font-semibold text-[13px] shrink-0">{cInitials}</span>
                          )}
                          <div className="min-w-0">
                            <div className="text-[14px] font-semibold text-ink">{cName}</div>
                            <div className="text-[11.5px] text-ink-72">{formatReviewDate(r.created_at)}</div>
                          </div>
                          <div className="ml-auto flex items-center gap-2 shrink-0">
                            <Stars rating={r.rating} size={13} />
                          </div>
                        </div>
                        {verifiedCustomerIds.has(r.customer_id) && (
                          <div className="flex items-center gap-1.5 mt-2.5 text-[11.5px] font-medium text-moss">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" /><polyline points="9 12 11 14 15 10" />
                            </svg>
                            Onaylı yorum
                          </div>
                        )}
                        {r.body && <p className="text-[13.5px] text-ink-72 leading-relaxed mt-2.5 whitespace-pre-wrap">{r.body}</p>}
                        {reply && (
                          <div className="mt-3 pl-3.5 border-l-2 border-terracotta/30">
                            <div className="text-[11.5px] font-semibold text-terracotta mb-0.5">{displayName} yanıtladı</div>
                            <p className="text-[13px] text-ink-72 leading-relaxed whitespace-pre-wrap">{reply.body}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {reviewCount > 3 && (
                  <Link href={reviewsHref} className="inline-block mt-4 text-sm font-display font-semibold text-terracotta hover:text-ember transition-colors">
                    Tüm yorumları gör ({reviewCount}) →
                  </Link>
                )}
              </section>
            )}

            {/* 8. Öne çıkanlar / Ödüller */}
            {awardRows.length > 0 && (
              <section>
                <div className={EYEBROW}>Öne Çıkanlar &amp; Ödüller</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {awardRows.map((a) => (
                    <div key={a.id} className={`${CARD} p-4`}>
                      <div className="font-display font-semibold text-ink">{a.title}</div>
                      {a.organization && <div className="text-sm text-ink-72 mt-0.5">{a.organization}</div>}
                      {a.period_label && <div className="text-xs text-ink-72 mt-1 font-mono">{a.period_label}</div>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Yorum bırakma (mevcut akış) */}
            <YorumButton
              professionalId={profile.id}
              professionalName={displayName}
              hasConversation={hasCompletedBooking}
              existingReview={existingReview}
              enabled={canReview}
            />
          </main>
        </div>
      </div>

      {/* MOBİL — alta sabit CTA çubuğu (yalnız işlem yetkisi varsa) */}
      {canTransact && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-line px-4 py-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <IletisimButton
                professionalId={profile.id}
                professionalName={displayName}
                categorySlug={slug}
                isLoggedIn={isLoggedIn}
                currentUserIsProfessional={currentUserIsProfessional}
                isOwnProfile={isOwnProfile}
                writableBusinesses={writableBusinesses}
                variant="primary-coral"
              />
            </div>
            <div className="flex-1">
              <RezervasyonButton
                professionalId={profile.id}
                professionalName={displayName}
                isLoggedIn={isLoggedIn}
                currentUserIsProfessional={currentUserIsProfessional}
                isOwnProfile={isOwnProfile}
                writableBusinesses={writableBusinesses}
                variant="outline-emerald"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Alt bileşenler ----
function MetaRow({ label, value, dot, last }: { label: string; value: string | null | undefined; dot?: 'green' | 'amber'; last?: boolean }) {
  if (!value) return null;
  return (
    <div className={`flex items-center gap-2.5 py-2.5 ${last ? '' : 'border-b border-line'}`}>
      {dot ? (
        <span className={`w-2 h-2 rounded-full shrink-0 mx-[3px] ${dot === 'green' ? 'bg-[#2E9E5B]' : 'bg-amber-500'}`} />
      ) : (
        <span className="w-[15px] shrink-0" />
      )}
      <span className="text-[13px] text-ink-72 w-[104px] shrink-0">{label}</span>
      <span className="text-[13.5px] font-semibold text-ink">{value}</span>
    </div>
  );
}

function OfferRow({ title, description, price }: { title: string; description: string | null; price: string }) {
  return (
    <div className="flex justify-between items-center gap-5 bg-card border border-line border-l-[3px] border-l-terracotta rounded-xl px-5 py-4">
      <div className="min-w-0">
        <div className="font-display text-[15.5px] font-semibold text-ink">{title}</div>
        {description && <div className="text-[13px] text-ink-72 mt-1 leading-snug line-clamp-2">{description}</div>}
      </div>
      {price && <div className="font-display text-[15px] font-bold text-terracotta whitespace-nowrap shrink-0">{price}</div>}
    </div>
  );
}

function ExperienceRow({ exp, last }: { exp: ProfileExperience; last: boolean }) {
  const orgText = [exp.organization, exp.location].filter(Boolean).join(', ');
  const border = last ? '' : 'border-b border-line';
  const metaLine = [exp.period_label, orgText].filter(Boolean).join(' · ');
  return (
    <>
      {/* Mobil (md altı): dikey yığın — üst satır tarih · organizasyon, sonra başlık/alt başlık/açıklama */}
      <div className={`md:hidden py-3.5 ${border}`}>
        {metaLine && <div className="text-[12px] text-ink-72">{metaLine}</div>}
        <div className="text-[14.5px] font-bold text-ink mt-1">{exp.title}</div>
        {exp.subtitle && <div className="text-[13px] text-ink-72 mt-0.5">{exp.subtitle}</div>}
        {exp.description && <p className="text-[13px] text-ink-72 leading-relaxed mt-1.5">{exp.description}</p>}
      </div>
      {/* md ve üzeri: mevcut üç kolon aynen */}
      <div className={`hidden md:grid grid-cols-[92px_1fr_auto] gap-4 items-start py-3.5 ${border}`}>
        <div className="text-[12.5px] text-ink-72 pt-0.5">{exp.period_label}</div>
        <div>
          <div className="text-[14.5px] font-bold text-ink">{exp.title}</div>
          {exp.subtitle && <div className="text-[13px] text-ink-72 mt-0.5">{exp.subtitle}</div>}
          {exp.description && <p className="text-[13px] text-ink-72 leading-relaxed mt-2 max-w-[520px]">{exp.description}</p>}
        </div>
        <div className="text-[13px] text-ink-72 text-right pt-0.5">{orgText}</div>
      </div>
    </>
  );
}

// ---- Modül renderer (koşullu; veri yoksa null) ----
function ModuleSection({ title, moduleKey, data, labelOverrides }: { title: string; moduleKey: string; data: AttrRecord | null; labelOverrides?: Record<string, string> }) {
  if (!data || Object.keys(data).length === 0) return null;
  const def = MODULE_REGISTRY[moduleKey as keyof typeof MODULE_REGISTRY];
  const eyebrow = <div className={EYEBROW}>{title}</div>;

  const chips = (arr: unknown) =>
    Array.isArray(arr) && arr.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {(arr as string[]).map((c, i) => (
          <span key={i} className="px-3.5 py-1.5 bg-terracotta/5 border border-terracotta/15 rounded-full text-[12.5px] font-medium text-ink">{c}</span>
        ))}
      </div>
    ) : null;

  const kv = (obj: unknown, cols = 3) =>
    obj && typeof obj === 'object' && Object.keys(obj as object).length > 0 ? (
      <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {Object.entries(obj as Record<string, string>).map(([k, v]) => (
          <div key={k} className="bg-paper rounded-xl px-4 py-3">
            <div className="text-xs text-ink-72">{k}</div>
            <div className="text-[14.5px] font-semibold text-ink mt-1">{v}</div>
          </div>
        ))}
      </div>
    ) : null;

  let body: React.ReactNode = null;
  if (moduleKey === 'repertuar') {
    const g = chips(data.genres);
    const hasNotes = typeof data.notes === 'string' && data.notes.trim().length > 0;
    body =
      g || hasNotes ? (
        <>
          {g}
          {hasNotes && <p className="text-[13.5px] text-ink-72 leading-relaxed mt-3.5">{data.notes as string}</p>}
        </>
      ) : null;
  } else if (moduleKey === 'ekipman') {
    const hasItems = Array.isArray(data.items) && (data.items as unknown[]).length > 0;
    const hasVenue = typeof data.venue_requirements === 'string' && data.venue_requirements.trim().length > 0;
    body =
      hasItems || hasVenue ? (
        <>
          {hasItems && (
            <div className="flex flex-col gap-2 text-sm text-ink-72">
              {(data.items as string[]).map((it, i) => (
                <div key={i} className="flex gap-2.5"><span className="text-terracotta font-bold shrink-0">—</span>{it}</div>
              ))}
            </div>
          )}
          {hasVenue && (
            <div className="mt-4 px-4 py-3 bg-paper rounded-lg text-[12.5px] text-ink-72 leading-relaxed">
              <span className="font-semibold text-ink">Mekan gereksinimleri: </span>{data.venue_requirements as string}
            </div>
          )}
        </>
      ) : null;
  } else if (moduleKey === 'performans') {
    const detailsEl = kv(data.details, 3);
    const hasExpect = typeof data.what_to_expect === 'string' && data.what_to_expect.trim().length > 0;
    const hasSetup = typeof data.setup_logistics === 'string' && data.setup_logistics.trim().length > 0;
    body =
      detailsEl || hasExpect || hasSetup ? (
        <>
          {detailsEl}
          {hasExpect && <p className="text-[13.5px] text-ink-72 leading-relaxed mt-4">{data.what_to_expect as string}</p>}
          {hasSetup && (
            <div className="mt-3.5 border border-dashed border-terracotta/25 rounded-lg px-4 py-3 text-[13px] text-ink-72 leading-relaxed">
              <span className="font-semibold text-ink">Kurulum &amp; lojistik notları: </span>{data.setup_logistics as string}
            </div>
          )}
        </>
      ) : null;
  } else if (moduleKey === 'fiziksel') {
    // Yaş aralığı (etiket override: model → "Görünüm yaş aralığı") + boy/beden/... — boş olanlar elenir.
    const yasLabel = labelOverrides?.['oynayabildigi_yas_araligi'] ?? 'Oynayabildiği yaş aralığı';
    const fz: Record<string, string> = {};
    const put = (label: string, v: unknown) => {
      if (typeof v === 'string' && v.trim()) fz[label] = v;
    };
    put(yasLabel, data.oynayabildigi_yas_araligi);
    put('Boy', data.height);
    put('Beden', data.size);
    put('Ayak', data.shoe);
    put('Saç', data.hair);
    put('Göz', data.eyes);
    body = kv(fz, 5);
  } else if (moduleKey === 'sosyal_erisim') {
    const platforms = Array.isArray(data.platforms) ? (data.platforms as { platform: string; followers_range: string }[]) : [];
    body = platforms.length > 0 ? (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {platforms.map((p, i) => (
            <div key={i} className="flex justify-between items-center px-4 py-3.5 bg-paper rounded-lg">
              <span className="text-[13.5px] font-semibold text-ink">{p.platform}</span>
              <span className="text-[13.5px] text-ink-72">{p.followers_range} takipçi</span>
            </div>
          ))}
        </div>
        <div className="text-[11.5px] text-ink-72/70 mt-2.5">Takipçi sayıları aralık olarak gösterilir; hesap bağlantıları profil üzerinden paylaşılmaz.</div>
      </>
    ) : null;
  } else if (moduleKey === 'diller_belgeler') {
    const pairs = Array.isArray(data.language_pairs) ? (data.language_pairs as unknown[]) : [];
    const docs = Array.isArray(data.documents) ? (data.documents as { name: string; date?: string }[]) : [];
    // Dil çifti kartları (mockup 1c anatomisi). Boş → başlık dahil hiçbir şey.
    body =
      pairs.length > 0 || docs.length > 0 ? (
        <>
          {pairs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
              {pairs.map((p, i) => (
                <div key={i} className="px-4 py-3 bg-paper border border-line rounded-xl text-[13.5px] font-semibold text-ink text-center">{String(p)}</div>
              ))}
            </div>
          )}
          {docs.length > 0 && (
            <div className="flex flex-col gap-2">
              {docs.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-[13.5px] text-ink-72">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-moss)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="4 12.5 9.5 18 20 6.5" /></svg>
                  {d.name} — <span className="text-ink">Belge yüklendi{d.date ? ` · ${d.date}` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null;
  } else if (moduleKey === 'uzmanlik_alanlari') {
    body = chips(data.areas);
  } else if (moduleKey === 'calisma_parametreleri') {
    const paramsEl = kv(data.params, 3);
    const hasNotes = typeof data.notes === 'string' && data.notes.trim().length > 0;
    body =
      paramsEl || hasNotes ? (
        <>{paramsEl}{hasNotes && <p className="text-[13.5px] text-ink-72 leading-relaxed mt-3.5">{data.notes as string}</p>}</>
      ) : null;
  } else if (moduleKey === 'teknik_teslimat') {
    body = kv(data.delivery, 3);
  }

  if (!body) return null;
  const isFiziksel = moduleKey === 'fiziksel';
  return (
    <section className={`${CARD} p-6`}>
      <div className="flex justify-between items-baseline">
        {eyebrow}
        {isFiziksel && def?.disclaimer && (
          <span className="text-[11.5px] text-ink-72/70">{def.disclaimer}</span>
        )}
      </div>
      <div className="mt-3">{body}</div>
    </section>
  );
}
