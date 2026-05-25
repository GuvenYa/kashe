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
      attrTags = vals
        .slice(0, 3)
        .map(
          (v) =>
            firstMulti.options.find((o) => o.value === v)?.label ?? v
        );
    }
  }

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

  return (
    <div className="relative group transition-all hover:-translate-y-0.5">
      <Link
        href={`/p/${profile.id}`}
        className="block bg-white border border-line rounded-lg p-6 group-hover:border-terracotta group-hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
      >
        <div className="flex items-start gap-4 pr-12">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-line shrink-0"
            />
          ) : (
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center text-paper font-display font-semibold text-xl shrink-0 ${
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
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-1 flex items-center gap-1.5">
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
                </p>
              )
            )}
            <h3 className="font-display text-xl text-ink group-hover:text-terracotta transition-colors truncate">
              {displayName}
            </h3>
            {cityName && (
              <p className="text-sm text-ink-72 mt-0.5">{cityName}</p>
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
          <p className="text-sm text-ink-72 mt-4 leading-relaxed line-clamp-2">
            {profile.bio}
          </p>
        )}

        {attrTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {attrTags.map((tag) => (
              <span
                key={tag}
                className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-72 bg-paper border border-line px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {priceLabel && (
          <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72">
              Fiyat aralığı
            </p>
            <p className="text-ink font-display font-semibold text-sm">
              {priceLabel}
            </p>
          </div>
        )}
      </Link>

      {/* Kalp ikonu — Link DIŞINDA, üst-sağda absolute */}
      {showFavoriteButton && (
        <div className="absolute top-5 right-5 z-10">
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