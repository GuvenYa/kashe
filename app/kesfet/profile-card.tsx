import Link from 'next/link';
import { formatPriceRange } from '@/app/lib/profile-helpers';
import FavoriteButton from '@/app/components/FavoriteButton';
import { getCategoryIcon } from '@/app/lib/category-icon';
import { getFilterFields } from '@/app/lib/filter-config';

type Props = {
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    company_name: string | null;
    role: string;
    created_at?: string | null;
    attributes?: Record<string, string | string[]> | null;
    turkish_cities: { name: string } | null;
    service_categories: { name_tr: string; emoji: string | null; slug: string } | null;
  };
  services: {
    price_min: number | null;
    price_max: number | null;
    price_on_request: boolean;
  }[];
  rating: {
    count: number;
    average: number;
  } | null;
  isFavorited: boolean;
  isLoggedIn: boolean;
  currentUserRole: string | null;
};

export function ProfileCard({
  profile,
  services,
  rating,
  isFavorited,
  isLoggedIn,
  currentUserRole,
}: Props) {
  const isAgencyCard = profile.role === 'agency';

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
  const categoryIcon = getCategoryIcon(profile.service_categories?.slug);

  const cityName = profile.turkish_cities?.name;

  // Kategoriye özel özelliklerden özet etiketler (ilk multi alanın ilk 3 değeri)
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

  // Kartta en fazla 2 chip göster, kalanı "+N" rozeti olarak özetle
  const MAX_VISIBLE_TAGS = 2;
  const visibleTags = attrTags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = attrTags.length - visibleTags.length;

  // Fiyat aralığı: tüm aktif hizmetlerden min/max çek
  const numericServices = services.filter(
    (s) => !s.price_on_request && s.price_min !== null && s.price_max !== null
  );
  let priceLabel: string | null = null;

  if (services.length > 0) {
    if (numericServices.length === 0) {
      priceLabel = 'Talep üzerine';
    } else {
      const allMins = numericServices.map((s) => s.price_min as number);
      const allMaxs = numericServices.map((s) => s.price_max as number);
      const overallMin = Math.min(...allMins);
      const overallMax = Math.max(...allMaxs);
      priceLabel = formatPriceRange(overallMin, overallMax, false);
    }
  }

  // Kalp ikonu sadece profesyonel profillerinde gösterilir
  const showFavoriteButton = profile.role === 'professional';

  // Teklif isteyebilen roller: hizmet alan hesaplar (client / business)
  // Bu kartlar zaten sadece professional/agency profillerini gösterir,
  // yani kendi kartı sorunu oluşmaz. Sadece görüntüleyenin rolüne bakıyoruz.
  const canRequestQuote =
    currentUserRole === 'client' || currentUserRole === 'business';

  // "Yeni" rozeti: profil son 30 günde oluşturulduysa
  const isNew = (() => {
    if (!profile.created_at) return false;
    const created = new Date(profile.created_at).getTime();
    const days = (Date.now() - created) / (1000 * 60 * 60 * 24);
    return days <= 30;
  })();

  return (
    <div className="relative group h-full transition-all duration-300 hover:-translate-y-1">
      <Link
        href={`/p/${profile.id}`}
        className="flex flex-col h-full bg-card border border-line rounded-xl p-4 group-hover:border-terracotta group-hover:shadow-[0_12px_28px_-14px_rgba(26,18,14,0.20)] transition-all duration-300"
      >
        <div className="flex items-start gap-3 pr-9">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover border-2 border-line shrink-0"
            />
          ) : (
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-paper font-display font-semibold text-base shrink-0 ${
                isAgencyCard ? 'bg-[#1E3A5F]' : 'bg-terracotta'
              }`}
            >
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            {isAgencyCard ? (
              <span className="inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-[#1E3A5F] bg-[#1E3A5F]/10 px-2 py-0.5 rounded mb-1.5">
                Ajans
              </span>
            ) : (
              categoryName && (
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-1 flex items-center gap-1.5 flex-wrap">
                  {categoryIcon && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={categoryIcon}
                      alt=""
                      className="w-4 h-4 object-contain"
                      aria-hidden="true"
                    />
                  )}
                  {categoryName}
                  {isNew && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-moss bg-moss/10 border border-moss/30 px-1.5 py-0.5 rounded">
                      Yeni
                    </span>
                  )}
                </p>
              )
            )}
            <h3 className="font-display text-lg text-ink group-hover:text-terracotta transition-colors truncate leading-tight">
              {displayName}
            </h3>
            {cityName && (
              <p className="text-xs text-ink-72 mt-0.5">{cityName}</p>
            )}
            {rating && rating.count > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="var(--color-terracotta)"
                  stroke="var(--color-terracotta)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className="kashe-star"
                >
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
                <span className="font-display font-semibold text-sm text-ink">
                  {rating.average}
                </span>
                <span className="text-xs text-ink-72">({rating.count})</span>
              </div>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="text-sm text-ink-72 mt-3 leading-relaxed line-clamp-1">
            {profile.bio}
          </p>
        )}

        {visibleTags.length > 0 && (
          <div className="flex gap-1.5 mt-3 overflow-hidden h-[26px]">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-72 bg-paper border border-line px-2 py-1 rounded whitespace-nowrap shrink-0 truncate max-w-[120px]"
              >
                {tag}
              </span>
            ))}
            {hiddenTagCount > 0 && (
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-terracotta bg-terracotta/8 border border-terracotta/25 px-2 py-1 rounded whitespace-nowrap shrink-0">
                +{hiddenTagCount}
              </span>
            )}
          </div>
        )}

        {priceLabel && (
          <div className="mt-auto pt-3 border-t border-line flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
              Fiyat
            </p>
            <div className="flex items-center gap-3">
              <p className="text-ink font-display font-semibold text-sm">
                {priceLabel}
              </p>
              {canRequestQuote && (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta flex items-center gap-1 group-hover:gap-1.5 transition-all">
                  Teklif al
                  <span aria-hidden="true">→</span>
                </span>
              )}
            </div>
          </div>
        )}

        {!priceLabel && canRequestQuote && (
          <p className="mt-auto pt-3 border-t border-line font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta flex items-center justify-end gap-1 group-hover:gap-1.5 transition-all">
            Teklif al
            <span aria-hidden="true">→</span>
          </p>
        )}
      </Link>

      {/* Kalp ikonu — Link DIŞINDA, üst-sağda absolute */}
      {showFavoriteButton && (
        <div className="absolute top-3 right-3 z-10">
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
  );
}