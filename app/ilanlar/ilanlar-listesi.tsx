'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { EmptyState } from '@/app/components/EmptyState';
import { SearchX, Briefcase, MapPin, Calendar, Users } from 'lucide-react';
import {
  formatBudgetRange,
  formatListingAge,
  getEventTypeLabel,
  isUrgent,
  isFeaturedHome,
  isFeaturedCategory,
  type ListingWithRelations,
} from './listings-data';
import { getCategoryIcon } from '@/app/lib/category-icon';

type Category = {
  id: number;
  slug: string;
  name_tr: string;
  emoji: string | null;
};

type City = {
  id: number;
  name: string;
};

type Filters = {
  kategori: string | null;
  sehir: string | null;
  etkinlik: string | null;
};

type Props = {
  listings: ListingWithRelations[];
  categories: Category[];
  cities: City[];
  activeFilters: Filters;
  canCreateListing: boolean;
  currentUserId: string | null;
};

const EVENT_TYPE_OPTIONS = [
  { key: 'wedding', label: 'Düğün' },
  { key: 'engagement', label: 'Nişan' },
  { key: 'birthday', label: 'Doğum günü' },
  { key: 'baby_shower', label: 'Baby shower' },
  { key: 'graduation', label: 'Mezuniyet' },
  { key: 'circumcision', label: 'Sünnet' },
  { key: 'corporate', label: 'Kurumsal' },
  { key: 'other', label: 'Diğer' },
];

export function IlanlarListesi({
  listings,
  categories,
  cities,
  activeFilters,
  canCreateListing,
  currentUserId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/ilanlar?${qs}` : '/ilanlar');
    });
  }

  function clearAllFilters() {
    startTransition(() => {
      router.push('/ilanlar');
    });
  }

  const hasActiveFilters =
    !!activeFilters.kategori ||
    !!activeFilters.sehir ||
    !!activeFilters.etkinlik;

  return (
    <div>
      {/* CTA — Yeni ilan aç (sadece client/business görür) */}
      {canCreateListing && (
        <div className="flex justify-end mb-6">
          <Link
            href="/ilanlar/yeni"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
          >
            <span className="text-base leading-none">+</span>
            Yeni ilan aç
          </Link>
        </div>
      )}

      {/* Filtreler */}
      <div className="bg-card border border-line rounded-lg p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
            Filtrele
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              disabled={isPending}
              className="text-xs text-terracotta hover:underline font-mono uppercase tracking-[0.1em]"
            >
              Temizle
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Kategori */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1.5">
              Kategori
            </label>
            <select
              value={activeFilters.kategori ?? ''}
              onChange={(e) =>
                setFilter('kategori', e.target.value || null)
              }
              disabled={isPending}
              className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
            >
              <option value="">Tümü</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name_tr}
                </option>
              ))}
            </select>
          </div>

          {/* Şehir */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1.5">
              Şehir
            </label>
            <select
              value={activeFilters.sehir ?? ''}
              onChange={(e) => setFilter('sehir', e.target.value || null)}
              disabled={isPending}
              className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
            >
              <option value="">Tümü</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          {/* Etkinlik türü */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1.5">
              Etkinlik türü
            </label>
            <select
              value={activeFilters.etkinlik ?? ''}
              onChange={(e) =>
                setFilter('etkinlik', e.target.value || null)
              }
              disabled={isPending}
              className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
            >
              <option value="">Tümü</option>
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Kendi ilanları ile diğerlerini ayır */}
      {(() => {
        const myListings = currentUserId
          ? listings.filter((l) => l.creator_id === currentUserId)
          : [];
        const otherListings = currentUserId
          ? listings.filter((l) => l.creator_id !== currentUserId)
          : listings;

        if (listings.length === 0) {
          return (
            <EmptyState
              icon={hasActiveFilters ? SearchX : Briefcase}
              title={
                hasActiveFilters
                  ? 'Bu filtrelere uygun ilan yok'
                  : 'Henüz ilan açılmamış'
              }
              description={
                hasActiveFilters
                  ? 'Farklı filtreler dene veya tümünü temizle.'
                  : 'İlk ilan eklendiğinde burada görünecek.'
              }
              action={
                hasActiveFilters
                  ? { label: 'Filtreleri temizle', href: '/ilanlar' }
                  : undefined
              }
            />
          );
        }

        return (
          <>
            {/* KENDİ İLANLARIN — en üstte ayrı bölüm */}
            {myListings.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta">
                    Senin ilanların
                  </span>
                  <span className="font-mono text-[10px] text-ink-72">
                    ({myListings.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myListings.map((listing) => (
                    <IlanCard key={listing.id} listing={listing} isOwn />
                  ))}
                </div>
              </div>
            )}

            {/* DİĞER İLANLAR */}
            {otherListings.length > 0 && (
              <>
                {myListings.length > 0 && (
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-4">
                    Diğer ilanlar
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {otherListings.map((listing) => (
                    <IlanCard key={listing.id} listing={listing} />
                  ))}
                </div>
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}

function IlanCard({
  listing,
  isOwn = false,
}: {
  listing: ListingWithRelations;
  isOwn?: boolean;
}) {
  const categoryLabel = listing.service_categories?.name_tr ?? 'Kategori';
  const categoryIcon = getCategoryIcon(listing.service_categories?.slug);
  const cityName = listing.turkish_cities?.name;
  const eventTypeLabel = listing.event_type
    ? getEventTypeLabel(listing.event_type)
    : null;
  const budgetText = formatBudgetRange(
    listing.budget_min,
    listing.budget_max,
    listing.currency
  );

  const urgent = isUrgent(listing);
  const featured = isFeaturedHome(listing) || isFeaturedCategory(listing);

  // İlan veren — kamuya görünen ad/avatar DAİMA creator_id profili (kurum/kişi),
  // ASLA created_by (üye) değil (attribution kuralı).
  const creator = listing.creator;
  const creatorName =
    creator?.company_name || creator?.full_name || 'İlan sahibi';
  const creatorRoleLabel =
    creator?.role === 'business'
      ? 'Kurumsal'
      : creator?.role === 'agency'
        ? 'Ajans'
        : null;

  return (
    <Link
      href={`/ilanlar/${listing.id}`}
      className={`block rounded-lg p-5 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 ${
        isOwn
          ? 'bg-terracotta/[0.04] border-2 border-terracotta/30 hover:border-terracotta hover:shadow-[4px_4px_0_var(--color-terracotta)]'
          : featured
          ? 'bg-[#FFFDF6] border border-[#D9C179] ring-1 ring-[#D9C179]/40 hover:border-[#C9AE5F] hover:shadow-[4px_4px_0_#D9C179]'
          : 'bg-card border border-line hover:border-terracotta hover:shadow-[4px_4px_0_var(--color-terracotta)]'
      }`}
    >
      {/* Kendi ilanın etiketi */}
      {isOwn && (
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.1em] text-terracotta bg-terracotta/10 border border-terracotta/30">
            Senin ilanın
          </span>
        </div>
      )}

      {/* Öne çıkan + acil etiketleri */}
      {(featured || urgent) && (
        <div className="flex items-center gap-2 mb-3">
          {featured && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.1em] text-[#8A6D1F] bg-[#F4E9C8] border border-[#D9C179]">
              ★ Öne çıkan
            </span>
          )}
          {urgent && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.1em] text-danger bg-danger-08 border border-danger/30">
              ● Acil
            </span>
          )}
        </div>
      )}

      {/* Kategori + tarih */}
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-terracotta/8 text-terracotta rounded-full text-[10px] font-mono uppercase tracking-[0.1em]">
          {categoryIcon && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={categoryIcon}
              alt=""
              className="w-5 h-5 object-contain"
              aria-hidden="true"
            />
          )}
          {categoryLabel}
        </span>
        <span className="text-[10px] font-mono text-ink-72">
          {formatListingAge(listing.published_at)}
        </span>
      </div>

      {/* Başlık */}
      <h3 className="font-display text-lg text-ink leading-snug mb-3 line-clamp-2">
        {listing.title}
      </h3>

      {/* İlan veren (creator_id profili) — kart tamamı zaten Link olduğundan düz metin */}
      {creator && (
        <div className="flex items-center gap-2 mb-3">
          {creator.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={creator.avatar_url}
              alt=""
              className="w-6 h-6 rounded-full object-cover border border-line shrink-0"
              aria-hidden="true"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-terracotta/80 flex items-center justify-center text-paper font-display font-semibold text-[10px] shrink-0">
              {creatorName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-xs text-ink-72 truncate">{creatorName}</span>
          {creatorRoleLabel && (
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-72 border border-line rounded-full px-1.5 py-0.5 shrink-0">
              {creatorRoleLabel}
            </span>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-72 mb-3">
        {eventTypeLabel && (
          <span className="flex items-center gap-1">
            <Calendar size={12} strokeWidth={1.75} />
            {eventTypeLabel}
          </span>
        )}
        {cityName && (
          <span className="flex items-center gap-1">
            <MapPin size={12} strokeWidth={1.75} />
            {cityName}
          </span>
        )}
        {listing.guest_count !== null && (
          <span className="flex items-center gap-1">
            <Users size={12} strokeWidth={1.75} />
            {listing.guest_count} kişi
          </span>
        )}
      </div>

      {/* Bütçe */}
      <div className="border-t border-line pt-3 mt-3 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72">
          Bütçe
        </span>
        <span className="font-display text-base text-ink font-medium">
          {budgetText}
        </span>
      </div>
    </Link>
  );
}