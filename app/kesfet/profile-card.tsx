import Link from 'next/link';
import FavoriteButton from '@/app/components/FavoriteButton';
import { getFilterFields } from '@/app/lib/filter-config';
import { isVerified, isPremiumActive } from '@/app/lib/badges';
import { CoverMedia } from './cover-media';

type Props = {
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    company_name: string | null;
    role: string;
    created_at?: string | null;
    approval_status?: string | null;
    premium_tier?: string | null;
    premium_until?: string | null;
    attributes?: Record<string, string | string[]> | null;
    turkish_cities: { name: string } | null;
    service_categories: { name_tr: string; emoji: string | null; slug: string } | null;
  };
  /** Kapak görseli: page.tsx'te çözülmüş (avatar → portföy ilk görsel → null=placeholder).
   *  Verilmezse (diğer sayfalar) profile.avatar_url'e düşer. */
  cover?: string | null;
  rating: { count: number; average: number } | null;
  /** Onaylı/tamamlanan iş sayısı (0/undefined → gizlenir). */
  jobsCount?: number;
  /** En iyi yorum alıntısı (yoksa/undefined → alıntı kutusu render edilmez, panel kısalır). */
  quote?: { text: string; author: string } | null;
  /** 'default' = Keşfet/favoriler/kategori/p[id] (mobil+masaüstü hover paneli, favori kalbi).
   *  'compact' = ana sayfa öne çıkanlar (tek foto-hero, hover paneli/kalp YOK, whole-card link). */
  variant?: 'default' | 'compact';
  /** default varyantta favori kalbi için; compact'ta kullanılmaz (opsiyonel). */
  isFavorited?: boolean;
  isLoggedIn?: boolean;
  currentUserRole?: string | null;
  /** Geriye dönük uyum: eski çağıranlar (favoriler/kategori/benzer profiller) fiyat için
   *  geçiyordu; kartta ARTIK kullanılmıyor (fiyat karttan kalktı). */
  services?: {
    price_min: number | null;
    price_max: number | null;
    price_on_request: boolean;
  }[];
  isBusy?: boolean;
};

const QUOTE_MAX = 90;

function StarIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );
}

function VerifiedIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M12 2l2.4 1.8 3 -.2 .9 2.9 2.4 1.8 -1 2.9 1 2.9 -2.4 1.8 -.9 2.9 -3 -.2L12 22l-2.4-1.8-3 .2-.9-2.9L3.3 15.7l1-2.9-1-2.9 2.4-1.8.9-2.9 3 .2z"
        fill="var(--color-moss)"
      />
      <path
        d="M8.5 12l2.2 2.2 4.3-4.4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** ★ puan (n) · X iş · şehir — açık (foto üzeri beyaz) / koyu (gövde) ton. */
function MetaRow({
  light,
  rating,
  jobsCount,
  cityName,
}: {
  light: boolean;
  rating: { count: number; average: number } | null;
  jobsCount: number;
  cityName: string | null | undefined;
}) {
  const hasRating = !!rating && rating.count > 0;
  return (
    <div
      className={`flex items-center gap-1.5 text-xs flex-wrap ${
        light ? 'text-white/90' : 'text-ink-72'
      }`}
    >
      {hasRating ? (
        <span className="inline-flex items-center gap-1">
          <StarIcon className={light ? 'text-[#F2C879]' : 'text-brand-accent'} />
          <span
            className={`font-display font-semibold ${
              light ? 'text-white' : 'text-ink'
            }`}
          >
            {rating!.average}
          </span>
          <span>({rating!.count})</span>
        </span>
      ) : (
        <span className="font-mono uppercase tracking-[0.12em] text-[11px]">
          Yeni
        </span>
      )}
      {jobsCount > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span>{jobsCount} iş</span>
        </>
      )}
      {cityName && (
        <>
          <span aria-hidden="true">·</span>
          <span>{cityName}</span>
        </>
      )}
    </div>
  );
}

/** Foto üstü sol overlay: (ajansta) AJANS rozeti + kategori chip'i (nokta + ad). */
function TopChips({
  isAgency,
  categoryName,
}: {
  isAgency: boolean;
  categoryName: string | null;
}) {
  return (
    <div className="absolute top-3 left-3 flex items-center gap-2 max-w-[calc(100%-4.5rem)]">
      {isAgency && (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] bg-[#0D1F4E] text-[#EAF0F8] px-2 py-1 rounded-md shrink-0">
          Ajans
        </span>
      )}
      {categoryName && (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] bg-paper/95 text-ink px-2 py-1 rounded-md inline-flex items-center gap-1.5 shrink-0 shadow-sm">
          <span
            className="w-1.5 h-1.5 rounded-full bg-brand-accent shrink-0"
            aria-hidden="true"
          />
          <span className="truncate max-w-[130px]">{categoryName}</span>
        </span>
      )}
    </div>
  );
}

function ServiceChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex gap-1.5 flex-wrap">
      {tags.map((tag) => (
        <span
          key={tag}
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-72 bg-paper border border-line px-2 py-1 rounded whitespace-nowrap truncate max-w-[130px]"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export function ProfileCard({
  profile,
  cover,
  rating,
  jobsCount = 0,
  quote = null,
  variant = 'default',
  isFavorited = false,
  isLoggedIn = false,
  currentUserRole = null,
}: Props) {
  const isAgencyCard = profile.role === 'agency';

  // Kapak: prop verilmişse onu (null=placeholder dahil), verilmemişse avatar'a düş.
  const coverUrl = cover !== undefined ? cover : profile.avatar_url ?? null;

  const displayName =
    (profile.role === 'business' || profile.role === 'agency') &&
    profile.company_name
      ? profile.company_name
      : profile.full_name || 'İsimsiz';

  const initials = (profile.full_name || profile.company_name || 'K')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const categoryName = profile.service_categories?.name_tr ?? null;
  const cityName = profile.turkish_cities?.name ?? null;

  // Hizmet etiketi chip'leri: kategoriye özel ilk multi alanın ilk 3 değeri
  const categorySlug = profile.service_categories?.slug ?? null;
  let attrTags: string[] = [];
  if (categorySlug && profile.attributes) {
    const fields = getFilterFields(categorySlug);
    const firstMulti = fields.find((f) => f.type === 'multi');
    if (firstMulti) {
      const raw = profile.attributes[firstMulti.key];
      const vals = Array.isArray(raw) ? raw : [];
      attrTags = vals.map(
        (v) => firstMulti.options.find((o) => o.value === v)?.label ?? v
      );
    }
  }
  const tags = attrTags.slice(0, 3);

  const badgeInput = {
    approvalStatus: profile.approval_status,
    createdAt: profile.created_at,
    rating,
    premiumTier: (profile.premium_tier ?? null) as
      | 'none'
      | 'premium'
      | 'plus'
      | 'agency'
      | null,
    premiumUntil: profile.premium_until ?? null,
  };
  const verified = isVerified(badgeInput);
  const isPremium = isPremiumActive(
    badgeInput.premiumTier,
    badgeInput.premiumUntil
  );

  const showFavoriteButton =
    profile.role === 'professional' || profile.role === 'agency';

  const quoteText = quote
    ? quote.text.length > QUOTE_MAX
      ? quote.text.slice(0, QUOTE_MAX).trimEnd() + '…'
      : quote.text
    : null;

  const profileHref = `/p/${profile.id}`;

  const PremiumBadge = isPremium ? (
    <span className="absolute top-3 right-14 font-mono text-[10px] uppercase tracking-[0.14em] bg-brand-accent text-paper px-2 py-1 rounded-md shadow-sm">
      Premium
    </span>
  ) : null;

  // ===================== KOMPAKT (ana sayfa öne çıkanlar) =====================
  // Tek foto-hero: tam-kanvas foto + alt gradient şerit (ad + doğrulanmış + ★puan(n)·şehir).
  // Favori kalbi YOK, hover paneli YOK, iş sayısı YOK; kartın TAMAMI profil linki.
  if (variant === 'compact') {
    return (
      <Link
        href={profileHref}
        aria-label={displayName}
        className={`group relative block rounded-2xl overflow-hidden bg-card border transition-all duration-300 hover:-translate-y-1 ${
          isPremium
            ? 'border-[#D9C179] ring-1 ring-[#D9C179]/40 hover:border-[#C9AE5F] hover:shadow-[0_16px_36px_-16px_rgba(138,109,31,0.35)]'
            : 'border-line hover:border-brand-ink hover:shadow-[0_16px_36px_-18px_rgba(20,61,49,0.35)]'
        }`}
      >
        <div className="relative aspect-[4/5]">
          <CoverMedia src={coverUrl} alt={displayName} initials={initials} />
          <div
            className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
            aria-hidden="true"
          />
          <TopChips isAgency={isAgencyCard} categoryName={categoryName} />
          {isPremium && (
            <span className="absolute top-3 right-3 font-mono text-[10px] uppercase tracking-[0.14em] bg-brand-accent text-paper px-2 py-1 rounded-md shadow-sm">
              Premium
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3 className="font-display text-lg text-white font-semibold leading-tight flex items-center gap-1.5">
              <span className="truncate">{displayName}</span>
              {verified && <VerifiedIcon size={15} />}
            </h3>
            <div className="mt-1">
              <MetaRow light rating={rating} jobsCount={0} cityName={cityName} />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="relative group">
      <div
        className={`relative rounded-2xl overflow-hidden bg-card border transition-shadow duration-300 ${
          isPremium
            ? 'border-[#D9C179] ring-1 ring-[#D9C179]/40 group-hover:shadow-[0_16px_36px_-16px_rgba(138,109,31,0.35)]'
            : 'border-line group-hover:shadow-[0_16px_36px_-18px_rgba(20,61,49,0.35)]'
        }`}
      >
        {/* ======================= MOBİL (≤768px) ======================= */}
        <div className="md:hidden flex flex-col">
          {/* Foto (üst) */}
          <div className="relative aspect-[16/10] shrink-0">
            <CoverMedia src={coverUrl} alt={displayName} initials={initials} />
            <div
              className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
              aria-hidden="true"
            />
            <TopChips isAgency={isAgencyCard} categoryName={categoryName} />
            {PremiumBadge}
            {/* Ad + doğrulanmış (fotonun altında, gradient üstünde) */}
            <div className="absolute inset-x-0 bottom-0 p-4">
              <h3 className="font-display text-xl text-white font-semibold leading-tight flex items-center gap-1.5">
                <span className="truncate">{displayName}</span>
                {verified && <VerifiedIcon size={15} />}
              </h3>
            </div>
          </div>

          {/* Beyaz gövde */}
          <div className="flex flex-col flex-1 p-4 gap-2.5">
            <MetaRow
              light={false}
              rating={rating}
              jobsCount={jobsCount}
              cityName={cityName}
            />
            {profile.bio && (
              <p className="text-sm text-ink-72 leading-relaxed line-clamp-1">
                {profile.bio}
              </p>
            )}
            {quoteText && (
              <div className="rounded-lg bg-paper-2/60 border border-line px-3 py-2">
                <p className="text-xs text-ink-72 italic leading-snug">
                  “{quoteText}”{' '}
                  <span className="not-italic font-medium text-ink">
                    — {quote!.author}
                  </span>
                </p>
              </div>
            )}
            <ServiceChips tags={tags} />
            {/* Teklif Al — mobilde HER ZAMAN görünür, zümrüt, tam genişlik */}
            <Link
              href={profileHref}
              className="relative z-20 mt-auto block w-full text-center bg-brand-ink text-paper rounded-lg py-2.5 font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors"
            >
              Teklif Al
            </Link>
          </div>
        </div>

        {/* ===================== MASAÜSTÜ (>768px) ===================== */}
        <div className="hidden md:block relative aspect-[3/4]">
          <CoverMedia src={coverUrl} alt={displayName} initials={initials} />

          <TopChips isAgency={isAgencyCard} categoryName={categoryName} />
          {PremiumBadge}

          {/* Varsayılan alt şerit — hover'da kaybolur */}
          <div className="absolute inset-x-0 bottom-0 p-4 pt-16 bg-gradient-to-t from-black/75 via-black/30 to-transparent transition-opacity duration-300 group-hover:opacity-0">
            <h3 className="font-display text-xl text-white font-semibold leading-tight flex items-center gap-1.5">
              <span className="truncate">{displayName}</span>
              {verified && <VerifiedIcon size={16} />}
            </h3>
            <div className="mt-1">
              <MetaRow
                light
                rating={rating}
                jobsCount={jobsCount}
                cityName={cityName}
              />
            </div>
          </div>

          {/* Hover paneli — alttan yukarı kayar (z-20: kart linkinin üstünde).
              Dar 4-kolon kartlarda taşmasın diye kompakt boşluk/font. */}
          <div className="absolute inset-x-0 bottom-0 z-20 bg-paper rounded-t-2xl p-3.5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out shadow-[0_-10px_28px_-14px_rgba(20,61,49,0.35)]">
            <h3 className="font-display text-base text-ink font-semibold leading-tight flex items-center gap-1.5">
              <span className="truncate">{displayName}</span>
              {verified && <VerifiedIcon size={14} />}
            </h3>
            <div className="mt-1">
              <MetaRow
                light={false}
                rating={rating}
                jobsCount={jobsCount}
                cityName={cityName}
              />
            </div>
            {profile.bio && (
              <p className="text-sm text-ink-72 leading-relaxed line-clamp-1 mt-1.5">
                {profile.bio}
              </p>
            )}
            {tags.length > 0 && (
              <div className="mt-2">
                <ServiceChips tags={tags} />
              </div>
            )}
            {quoteText && (
              <div className="mt-2 rounded-lg bg-paper-2/60 border border-line px-3 py-1.5">
                <p className="text-xs text-ink-72 italic leading-snug line-clamp-2">
                  “{quoteText}”{' '}
                  <span className="not-italic font-medium text-ink">
                    — {quote!.author}
                  </span>
                </p>
              </div>
            )}
            {/* Teklif Al — Zümrüt (mobil ile tutarlı), tam genişlik */}
            <Link
              href={profileHref}
              className="mt-2.5 block w-full text-center bg-brand-ink text-paper rounded-lg py-2 font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors"
            >
              Teklif Al
            </Link>
          </div>
        </div>

        {/* Kart geneli tıklama → profil (stretched link, z-10; interaktifler z-20) */}
        <Link
          href={profileHref}
          className="absolute inset-0 z-10"
          aria-label={displayName}
        />

        {/* Favori kalbi — üst-sağ, z-20 (mevcut favori işlevi korunur) */}
        {showFavoriteButton && (
          <div className="absolute top-3 right-3 z-20">
            <FavoriteButton
              professionalId={profile.id}
              initialFavorited={isFavorited}
              isLoggedIn={isLoggedIn}
              userRole={currentUserRole}
              variant="card"
            />
          </div>
        )}
      </div>
    </div>
  );
}
