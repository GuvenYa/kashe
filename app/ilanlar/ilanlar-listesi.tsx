'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useTransition } from 'react';
import { EmptyState } from '@/app/components/EmptyState';
import {
  SearchX,
  Briefcase,
  MapPin,
  Calendar,
  Users,
  BadgeCheck,
} from 'lucide-react';
import {
  formatBudgetRange,
  formatListingAge,
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

type City = { id: number; name: string };

type ActiveFilters = {
  categoryIds: number[];
  sehir: string | null;
  etkinlik: string | null;
  fiyat: string | null;
  onlyOpen: boolean;
  sirala: string;
};

// URL query string'i filtre değerlerinden kurar (Keşfet ile aynı desen) — debounce
// REPLACE (local state) ve prop-sync karşılaştırması (props) aynı mantığı paylaşır.
function buildQs(v: {
  cats: number[];
  city: string;
  etkinlik: string;
  fiyat: string;
  onlyOpen: boolean;
  sirala: string;
}): string {
  const params = new URLSearchParams();
  if (v.cats.length > 0) params.set('kategori', v.cats.join(','));
  if (v.city) params.set('sehir', v.city);
  if (v.etkinlik) params.set('etkinlik', v.etkinlik);
  if (v.fiyat) params.set('fiyat', v.fiyat);
  if (!v.onlyOpen) params.set('acik', '0');
  if (v.sirala !== 'yeni') params.set('sirala', v.sirala);
  return params.toString();
}

type Props = {
  listings: ListingWithRelations[];
  categories: Category[];
  cities: City[];
  applicationCounts: Record<string, number>;
  activeFilters: ActiveFilters;
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

// Bütçe tavanı (budget_max bazlı) — Keşfet fiyat kalıbı
const PRICE_OPTIONS = [
  { value: '5000', label: "5.000 ₺'ye kadar" },
  { value: '15000', label: "15.000 ₺'ye kadar" },
  { value: '30000', label: "30.000 ₺'ye kadar" },
  { value: '60000', label: "60.000 ₺'ye kadar" },
  { value: '100000', label: "100.000 ₺'ye kadar" },
];

const SORT_OPTIONS = [
  { value: 'yeni', label: 'En yeni' },
  { value: 'deadline', label: 'Son başvuruya göre' },
  { value: 'butce', label: 'Bütçe (yüksek → düşük)' },
];

// ---- Küçük filtre öğeleri ----
function CheckItem({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 w-full text-left group"
    >
      <span
        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          on
            ? 'bg-terracotta border-terracotta'
            : 'border-line-strong group-hover:border-ink-50'
        }`}
      >
        {on && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 12l5 5L20 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span
        className={`text-sm transition-colors ${
          on ? 'text-ink' : 'text-ink-72 group-hover:text-ink'
        }`}
      >
        {label}
      </span>
    </button>
  );
}

function RadioItem({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 w-full text-left group"
    >
      <span
        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          on ? 'border-terracotta' : 'border-line-strong group-hover:border-ink-50'
        }`}
      >
        {on && <span className="w-2 h-2 rounded-full bg-terracotta" />}
      </span>
      <span
        className={`text-sm transition-colors ${
          on ? 'text-ink' : 'text-ink-72 group-hover:text-ink'
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function IlanlarListesi({
  listings,
  categories,
  cities,
  applicationCounts,
  activeFilters,
  canCreateListing,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [cats, setCats] = useState<number[]>(activeFilters.categoryIds);
  const [city, setCity] = useState<string>(activeFilters.sehir ?? '');
  const [etkinlik, setEtkinlik] = useState<string>(activeFilters.etkinlik ?? '');
  const [fiyat, setFiyat] = useState<string>(activeFilters.fiyat ?? '');
  const [onlyOpen, setOnlyOpen] = useState<boolean>(activeFilters.onlyOpen);
  const [sirala, setSirala] = useState<string>(activeFilters.sirala);

  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const cityRef = useRef<HTMLDivElement>(null);
  const isFirst = useRef(true);
  // Kendi push'umuzun ürettiği qs — prop-sync'te "bizim yankımız mı?" ayrımı için.
  const lastPushedRef = useRef<string | null>(null);

  // Anlık filtreleme — debounce'lu URL REPLACE (Keşfet ile aynı desen).
  // REPLACE (push değil): ara filtre halleri history'ye yazılmaz.
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const t = setTimeout(() => {
      const qs = buildQs({ cats, city, etkinlik, fiyat, onlyOpen, sirala });
      lastPushedRef.current = qs; // kendi yankımızı prop-sync'te tanımak için
      startTransition(() => {
        router.replace(qs ? `/ilanlar?${qs}` : '/ilanlar', { scroll: false });
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, city, etkinlik, fiyat, onlyOpen, sirala]);

  // Prop (URL) → local state re-sync (Geri/İleri/link). GUARD: gelen qs bizim son
  // push'umuzun yankısıysa ATLA — kullanıcının o an yazmakta olduğunu ezme.
  const propQs = buildQs({
    cats: activeFilters.categoryIds,
    city: activeFilters.sehir ?? '',
    etkinlik: activeFilters.etkinlik ?? '',
    fiyat: activeFilters.fiyat ?? '',
    onlyOpen: activeFilters.onlyOpen,
    sirala: activeFilters.sirala,
  });
  useEffect(() => {
    if (propQs === lastPushedRef.current) return; // kendi yankımız → dokunma
    setCats(activeFilters.categoryIds);
    setCity(activeFilters.sehir ?? '');
    setEtkinlik(activeFilters.etkinlik ?? '');
    setFiyat(activeFilters.fiyat ?? '');
    setOnlyOpen(activeFilters.onlyOpen);
    setSirala(activeFilters.sirala);
    lastPushedRef.current = propQs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propQs]);

  // Şehir dropdown dışarı tıklama
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setCityOpen(false);
        setCityQuery('');
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Mobil drawer scroll kilidi
  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  function toggleCat(id: number) {
    setCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function clearAll() {
    setCats([]);
    setCity('');
    setEtkinlik('');
    setFiyat('');
    setOnlyOpen(true);
    setSirala('yeni');
  }

  const selectedCity = cities.find((c) => String(c.id) === city);
  const lowerCityQ = cityQuery.trim().toLocaleLowerCase('tr');
  const filteredCities =
    lowerCityQ.length > 0
      ? cities.filter((c) => c.name.toLocaleLowerCase('tr').includes(lowerCityQ))
      : cities;

  const activeCount =
    cats.length +
    (city ? 1 : 0) +
    (etkinlik ? 1 : 0) +
    (fiyat ? 1 : 0) +
    (onlyOpen ? 0 : 1); // "açık" varsayılan olduğu için kapalıyken 1 sayılır

  // ===== Sidebar içeriği (masaüstü + mobil drawer) =====
  const filterBody = (
    <div className="space-y-7">
      {/* Kategori — çoklu checkbox */}
      <div>
        <p className="font-display text-base text-ink mb-3">Kategori</p>
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {categories.map((cat) => (
            <CheckItem
              key={cat.id}
              on={cats.includes(cat.id)}
              label={cat.name_tr}
              onClick={() => toggleCat(cat.id)}
            />
          ))}
        </div>
      </div>

      {/* Şehir — arama'lı dropdown */}
      <div>
        <p className="font-display text-base text-ink mb-3">Şehir</p>
        <div className="relative" ref={cityRef}>
          <button
            type="button"
            onClick={() => setCityOpen((v) => !v)}
            className="w-full text-left px-4 py-2.5 bg-card border border-line rounded-lg text-sm flex items-center justify-between hover:border-ink-50 transition-colors"
          >
            <span className={selectedCity ? 'text-ink' : 'text-ink-32'}>
              {selectedCity ? selectedCity.name : 'Tüm şehirler'}
            </span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`text-ink-32 transition-transform ${cityOpen ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {cityOpen && (
            <div className="absolute z-20 left-0 right-0 mt-2 bg-card border border-line rounded-xl shadow-[0_12px_40px_-12px_rgba(26,18,14,0.22)] overflow-hidden">
              <div className="p-2 border-b border-line">
                <input
                  type="text"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  placeholder="Şehir ara..."
                  autoFocus
                  className="w-full px-3 py-2 bg-paper-2/40 rounded-lg text-sm text-ink placeholder:text-ink-32 focus:outline-none focus:ring-2 focus:ring-terracotta-08"
                />
              </div>
              <ul className="max-h-56 overflow-y-auto py-1">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setCity('');
                      setCityOpen(false);
                      setCityQuery('');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-ink-72 hover:bg-terracotta-08 hover:text-terracotta transition-colors"
                  >
                    Tüm şehirler
                  </button>
                </li>
                {filteredCities.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCity(String(c.id));
                        setCityOpen(false);
                        setCityQuery('');
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        String(c.id) === city
                          ? 'bg-terracotta-08 text-terracotta'
                          : 'text-ink hover:bg-terracotta-08 hover:text-terracotta'
                      }`}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
                {filteredCities.length === 0 && (
                  <li className="px-4 py-3 text-sm text-ink-32 text-center">
                    Şehir bulunamadı
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Etkinlik türü — tekli radio */}
      <div>
        <p className="font-display text-base text-ink mb-3">Etkinlik türü</p>
        <div className="space-y-1.5">
          <RadioItem
            on={etkinlik === ''}
            label="Hepsi"
            onClick={() => setEtkinlik('')}
          />
          {EVENT_TYPE_OPTIONS.map((opt) => (
            <RadioItem
              key={opt.key}
              on={etkinlik === opt.key}
              label={opt.label}
              onClick={() => setEtkinlik(opt.key)}
            />
          ))}
        </div>
      </div>

      {/* Bütçe — tavan (budget_max bazlı) */}
      <div>
        <p className="font-display text-base text-ink mb-3">Bütçe</p>
        <div className="space-y-1.5">
          <RadioItem
            on={fiyat === ''}
            label="Fark etmez"
            onClick={() => setFiyat('')}
          />
          {PRICE_OPTIONS.map((opt) => (
            <RadioItem
              key={opt.value}
              on={fiyat === opt.value}
              label={opt.label}
              onClick={() => setFiyat(opt.value)}
            />
          ))}
        </div>
      </div>

      {/* Yalnız açık ilanlar — toggle (varsayılan açık) */}
      <div className="border-t border-line pt-5">
        <CheckItem
          on={onlyOpen}
          label="Yalnız açık ilanlar"
          onClick={() => setOnlyOpen((v) => !v)}
        />
        <p className="text-xs text-ink-32 mt-1.5 ml-[26px]">
          Süresi dolanları gizler
        </p>
      </div>

      {/* Temizle */}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="kashe-tap text-xs text-terracotta hover:underline"
        >
          Tümünü temizle ({activeCount})
        </button>
      )}
    </div>
  );

  // ===== Sonuç bölümü =====
  const myListings = currentUserId
    ? listings.filter((l) => l.creator_id === currentUserId)
    : [];
  const otherListings = currentUserId
    ? listings.filter((l) => l.creator_id !== currentUserId)
    : listings;

  return (
    <div>
      {/* CTA — Yeni ilan aç (client/business) */}
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

      <div className="flex flex-col lg:flex-row gap-8">
        {/* SOL — filtre sidebar */}
        <aside className="lg:w-64 lg:shrink-0">
          {/* Masaüstü sticky */}
          <div className="hidden lg:block sticky top-24">{filterBody}</div>

          {/* Mobil — Filtreler butonu */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="kashe-tap w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-card border border-line-strong rounded-lg text-ink font-display font-semibold text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Filtreler
              {activeCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 bg-terracotta text-paper text-xs font-mono rounded-full flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </button>
          </div>
        </aside>

        {/* SAĞ — sonuçlar */}
        <div className="flex-1 min-w-0">
          {listings.length === 0 ? (
            <EmptyState
              icon={activeCount > 0 ? SearchX : Briefcase}
              title={
                activeCount > 0
                  ? 'Bu filtrelere uygun ilan yok'
                  : 'Henüz ilan açılmamış'
              }
              description={
                activeCount > 0
                  ? 'Farklı filtreler dene veya tümünü temizle.'
                  : 'İlk ilan eklendiğinde burada görünecek.'
              }
              action={
                activeCount > 0
                  ? { label: 'Filtreleri temizle', href: '/ilanlar' }
                  : undefined
              }
            />
          ) : (
            <>
              {/* Sonuç sayısı + sıralama */}
              <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72">
                  {listings.length} ilan
                </p>
                <label className="inline-flex items-center gap-2 text-sm">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-72">
                    Sırala
                  </span>
                  <select
                    value={sirala}
                    onChange={(e) => setSirala(e.target.value)}
                    disabled={isPending}
                    className="px-3 py-2 bg-card border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Kendi ilanların */}
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
                      <IlanCard
                        key={listing.id}
                        listing={listing}
                        count={applicationCounts[listing.id] ?? 0}
                        isOwn
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Diğer ilanlar */}
              {otherListings.length > 0 && (
                <>
                  {myListings.length > 0 && (
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-4">
                      Diğer ilanlar
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {otherListings.map((listing) => (
                      <IlanCard
                        key={listing.id}
                        listing={listing}
                        count={applicationCounts[listing.id] ?? 0}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* MOBİL drawer */}
      {mobileOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 bg-ink/40 z-50 kashe-fade"
            style={{ animationDuration: '0.2s' }}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-sm bg-paper shadow-2xl flex flex-col kashe-drawer">
            <div className="flex items-center justify-between px-6 py-5 border-b border-line shrink-0">
              <h2 className="font-display text-xl text-ink">Filtreler</h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="kashe-tap p-2 -mr-2 text-ink-72 hover:text-ink"
                aria-label="Kapat"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{filterBody}</div>
            <div className="border-t border-line px-6 py-4 shrink-0">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="kashe-tap w-full px-4 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:bg-ember transition-colors"
              >
                {isPending ? 'Yükleniyor...' : `${listings.length} ilanı göster`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// İlan kartı — zenginleştirilmiş (başvuru sayısı + deadline rozeti + doğrulanmış)
// =============================================================================

function IlanCard({
  listing,
  count,
  isOwn = false,
}: {
  listing: ListingWithRelations;
  count: number;
  isOwn?: boolean;
}) {
  const categoryLabel = listing.service_categories?.name_tr ?? 'Kategori';
  const categoryIcon = getCategoryIcon(listing.service_categories?.slug);
  const cityName = listing.turkish_cities?.name;
  const eventDateLabel = listing.event_date
    ? new Date(listing.event_date).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;
  const budgetText = formatBudgetRange(
    listing.budget_min,
    listing.budget_max,
    listing.currency
  );

  const urgent = isUrgent(listing);
  const featured = isFeaturedHome(listing) || isFeaturedCategory(listing);

  // Son başvuru rozeti: geçmiş → gri "Kapandı"; ≤7 gün → mercan "Son X gün"
  let deadlineBadge: { text: string; passed: boolean } | null = null;
  if (listing.application_deadline) {
    const diff = new Date(listing.application_deadline).getTime() - Date.now();
    if (diff < 0) {
      deadlineBadge = { text: 'Kapandı', passed: true };
    } else {
      const days = Math.ceil(diff / 86400000);
      if (days <= 7) {
        deadlineBadge = {
          text: days <= 1 ? 'Son gün' : `Son ${days} gün`,
          passed: false,
        };
      }
    }
  }

  // İlan veren — kamuya görünen ad/avatar DAİMA creator_id profili (attribution).
  const creator = listing.creator;
  const creatorName =
    creator?.company_name || creator?.full_name || 'İlan sahibi';
  const creatorRoleLabel =
    creator?.role === 'business'
      ? 'Kurumsal'
      : creator?.role === 'agency'
        ? 'Ajans'
        : null;
  const creatorVerified = creator?.approval_status === 'approved';

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
      {/* Rozet satırı: kendi / öne çıkan / acil / deadline */}
      {(isOwn || featured || urgent || deadlineBadge) && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {isOwn && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.1em] text-terracotta bg-terracotta/10 border border-terracotta/30">
              Senin ilanın
            </span>
          )}
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
          {deadlineBadge && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.1em] border ${
                deadlineBadge.passed
                  ? 'text-ink-72 bg-ink-72/10 border-ink-72/25'
                  : 'text-[#E2674A] bg-[#E2674A]/10 border-[#E2674A]/30'
              }`}
            >
              {deadlineBadge.text}
            </span>
          )}
        </div>
      )}

      {/* Kategori + yayın zamanı */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-terracotta/8 text-terracotta rounded-full text-[10px] font-mono uppercase tracking-[0.1em] min-w-0">
          {categoryIcon && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={categoryIcon}
              alt=""
              className="w-5 h-5 object-contain shrink-0"
              aria-hidden="true"
            />
          )}
          <span className="truncate">{categoryLabel}</span>
        </span>
        <span className="text-[10px] font-mono text-ink-72 shrink-0">
          {formatListingAge(listing.published_at)}
        </span>
      </div>

      {/* Başlık */}
      <h3 className="font-display text-lg font-semibold text-ink leading-snug mb-3 line-clamp-2">
        {listing.title}
      </h3>

      {/* İlan veren */}
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
          {creatorVerified && (
            <BadgeCheck
              size={13}
              strokeWidth={2}
              className="text-[#1F5C4A] shrink-0"
              aria-label="Doğrulanmış"
            />
          )}
          {creatorRoleLabel && (
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-72 border border-line rounded-full px-1.5 py-0.5 shrink-0">
              {creatorRoleLabel}
            </span>
          )}
        </div>
      )}

      {/* Meta: şehir · etkinlik tarihi · kişi */}
      {(cityName || eventDateLabel || listing.guest_count !== null) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-72 mb-3">
          {cityName && (
            <span className="flex items-center gap-1">
              <MapPin size={12} strokeWidth={1.75} />
              {cityName}
            </span>
          )}
          {eventDateLabel && (
            <span className="flex items-center gap-1">
              <Calendar size={12} strokeWidth={1.75} />
              {eventDateLabel}
            </span>
          )}
          {listing.guest_count !== null && (
            <span className="flex items-center gap-1">
              <Users size={12} strokeWidth={1.75} />
              {listing.guest_count} kişi
            </span>
          )}
        </div>
      )}

      {/* Başvuru sayısı */}
      <div className="mb-3">
        {count > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <Users size={12} strokeWidth={1.75} className="text-terracotta" />
            {count} başvuru
          </span>
        ) : (
          <span className="text-xs text-ink-72 italic">İlk başvuran sen ol</span>
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
