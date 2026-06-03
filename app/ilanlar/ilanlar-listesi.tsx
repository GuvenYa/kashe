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
      <div className="bg-white border border-line rounded-lg p-5 mb-8">
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
              className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
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
              className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
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
              className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
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

      {/* Sonuç sayısı */}
      <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-72 mb-6">
        {listings.length} ilan
      </p>

      {/* İlan listesi */}
      {listings.length === 0 ? (
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listings.map((listing) => (
            <IlanCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}

function IlanCard({ listing }: { listing: ListingWithRelations }) {
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

  return (
    <Link
      href={`/ilanlar/${listing.id}`}
      className={`block rounded-lg p-5 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 ${
        featured
          ? 'bg-[#FFFDF6] border border-[#D9C179] ring-1 ring-[#D9C179]/40 hover:border-[#C9AE5F] hover:shadow-[4px_4px_0_#D9C179]'
          : 'bg-white border border-line hover:border-terracotta hover:shadow-[4px_4px_0_var(--color-terracotta)]'
      }`}
    >
      {/* Öne çıkan + acil etiketleri */}
      {(featured || urgent) && (
        <div className="flex items-center gap-2 mb-3">
          {featured && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.1em] text-[#8A6D1F] bg-[#F4E9C8] border border-[#D9C179]">
              ★ Öne çıkan
            </span>
          )}
          {urgent && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.1em] text-ember bg-ember/10 border border-ember/30">
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