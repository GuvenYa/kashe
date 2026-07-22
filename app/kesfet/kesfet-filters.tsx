'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { ServiceCategory, TurkishCity } from '@/app/lib/types';
import { getFilterFields } from '@/app/lib/filter-config';
import { KategoriTalepCta } from '@/app/components/kategori-talep-cta';
import { EVENT_TYPES } from '@/app/mesajlar/data';

const PRICE_OPTIONS = [
  { value: '5000', label: "5.000 ₺'ye kadar" },
  { value: '15000', label: "15.000 ₺'ye kadar" },
  { value: '30000', label: "30.000 ₺'ye kadar" },
  { value: '60000', label: "60.000 ₺'ye kadar" },
  { value: '100000', label: "100.000 ₺'ye kadar" },
];

const RATING_OPTIONS = [
  { value: '4.5', label: '4,5 ve üzeri' },
  { value: '4', label: '4 ve üzeri' },
  { value: '3', label: '3 ve üzeri' },
];

// URL query string'i filtre değerlerinden kurar — hem debounce REPLACE (local state)
// hem prop-sync karşılaştırması (props) AYNI mantığı kullansın diye tek yerde.
function buildQs(v: {
  search: string;
  cats: number[];
  city: string;
  type: string;
  attrs: Record<string, string[]>;
  maxPrice: string;
  minRating: string;
  badgeKeys: string[];
  onlyAvailable: boolean;
  experience: string[];
  eventTypes: string[];
}): string {
  const params = new URLSearchParams();
  if (v.search.trim()) params.set('q', v.search.trim());
  if (v.cats.length > 0) params.set('kategori', v.cats.join(','));
  if (v.city) params.set('sehir', v.city);
  if (v.type) params.set('tip', v.type);
  if (v.maxPrice) params.set('fiyat', v.maxPrice);
  if (v.minRating) params.set('puan', v.minRating);
  if (v.badgeKeys.includes('premium')) params.set('premium', '1');
  if (v.badgeKeys.includes('verified')) params.set('dogrulanmis', '1');
  if (v.badgeKeys.includes('topRated')) params.set('yuksekpuan', '1');
  if (v.badgeKeys.includes('popular')) params.set('coktercih', '1');
  if (v.onlyAvailable) params.set('musait', '1');
  if (v.experience.length > 0) params.set('deneyim', v.experience.join(','));
  if (v.eventTypes.length > 0) params.set('etkinlik', v.eventTypes.join(','));
  for (const [key, vals] of Object.entries(v.attrs)) {
    if (vals.length > 0) params.set(`attr_${key}`, vals.join(','));
  }
  return params.toString();
}

type Props = {
  categories: ServiceCategory[];
  cities: TurkishCity[];
  currentCategories: number[];
  currentCity: number | null;
  currentSearch: string;
  currentAttrs: Record<string, string[]>;
  currentType: 'profesyonel' | 'ajans' | null;
  currentMaxPrice: number | null;
  currentMinRating: number | null;
  currentBadgeKeys: string[];
  currentOnlyAvailable: boolean;
  currentExperience: string[];
  currentEventTypes: string[];
  resultCount: number;
  isLoggedIn: boolean;
};

export function KesfetFilters({
  categories,
  cities,
  currentCategories,
  currentCity,
  currentSearch,
  currentAttrs,
  currentType,
  currentMaxPrice,
  currentMinRating,
  currentBadgeKeys,
  currentOnlyAvailable,
  currentExperience,
  currentEventTypes,
  resultCount,
  isLoggedIn,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState(currentSearch);
  const [cats, setCats] = useState<number[]>(currentCategories);
  const [city, setCity] = useState<string>(currentCity ? String(currentCity) : '');
  const [type, setType] = useState<string>(currentType ?? '');
  const [attrs, setAttrs] = useState<Record<string, string[]>>(currentAttrs);
  const [maxPrice, setMaxPrice] = useState<string>(
    currentMaxPrice !== null ? String(currentMaxPrice) : ''
  );
  const [minRating, setMinRating] = useState<string>(
    currentMinRating !== null ? String(currentMinRating) : ''
  );

  // Sıra 3 — gelişmiş filtreler
  const [badgeKeys, setBadgeKeys] = useState<string[]>(currentBadgeKeys);
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(
    currentOnlyAvailable
  );
  const [experience, setExperience] = useState<string[]>(currentExperience);
  // Etkinlik türleri — ORTAK filtre (tüm kategoriler), ÇOKLU seçim (OR); kategori tickbox kalıbı.
  const [eventTypes, setEventTypes] = useState<string[]>(currentEventTypes);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(
    currentBadgeKeys.length > 0 ||
      currentOnlyAvailable ||
      currentExperience.length > 0
  );

  function toggleBadge(key: string) {
    setBadgeKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleExperience(val: string) {
    setExperience((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }

  function toggleEventType(key: string) {
    setEventTypes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  // Şehir arama dropdown
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const cityRef = useRef<HTMLDivElement>(null);

  // İlk render'da otomatik uygulama yapma (sadece kullanıcı etkileşiminde)
  const isFirst = useRef(true);
  // Kendi push'umuzun ürettiği qs — prop-sync'te "bizim yankımız mı?" ayrımı için.
  const lastPushedRef = useRef<string | null>(null);
  // Bekleyen debounce timer'ı — mobil "göster" flush edebilsin diye ref'te tutulur.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sayfa açılır açılmaz başa kaydır (FeaturedProfiles/popüler linklerden gelirken)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // TEK HAT — buildQs + lastPushedRef + router.replace(scroll:false). Hem debounce
  // hem mobil "göster" apply buradan geçer (ayrı push/qs-kurucu YOK).
  const currentQs = () =>
    buildQs({
      search, cats, city, type, attrs, maxPrice, minRating,
      badgeKeys, onlyAvailable, experience, eventTypes,
    });
  const commit = (qs: string) => {
    lastPushedRef.current = qs; // kendi yankımızı prop-sync'te tanımak için
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };
  // Mobil "N sonucu göster": bekleyen debounce'ı flush edip HEMEN uygula (gecikme/yarış yok).
  function applyNow() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commit(currentQs());
  }

  // Anlık filtreleme — state değişince debounce'lu URL REPLACE.
  // REPLACE (push değil): ara filtre halleri history'ye yazılmaz → profile gidip
  // dönünce tek geri ile son filtreli hale döner, ikinci geri keşfet'ten çıkar.
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    debounceRef.current = setTimeout(() => commit(currentQs()), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search,
    cats,
    city,
    type,
    attrs,
    maxPrice,
    minRating,
    badgeKeys,
    onlyAvailable,
    experience,
    eventTypes,
  ]);

  // Prop (URL) → local state re-sync. Geri/İleri/link ile props değişince sidebar
  // kontrolleri URL/sonuçla tutarlı kalsın (soft-nav'da remount yok).
  // GUARD: gelen qs bizim son push'umuzun yankısıysa ATLA — kullanıcının o an
  // yazmakta olduğu (henüz push edilmemiş) değeri eski URL ile ezme.
  const propQs = buildQs({
    search: currentSearch,
    cats: currentCategories,
    city: currentCity ? String(currentCity) : '',
    type: currentType ?? '',
    attrs: currentAttrs,
    maxPrice: currentMaxPrice !== null ? String(currentMaxPrice) : '',
    minRating: currentMinRating !== null ? String(currentMinRating) : '',
    badgeKeys: currentBadgeKeys,
    onlyAvailable: currentOnlyAvailable,
    experience: currentExperience,
    eventTypes: currentEventTypes,
  });
  useEffect(() => {
    if (propQs === lastPushedRef.current) return; // kendi yankımız → dokunma
    // Dış navigasyon (geri/ileri/link) → local state'i props'a eşitle
    setSearch(currentSearch);
    setCats(currentCategories);
    setCity(currentCity ? String(currentCity) : '');
    setType(currentType ?? '');
    setAttrs(currentAttrs);
    setMaxPrice(currentMaxPrice !== null ? String(currentMaxPrice) : '');
    setMinRating(currentMinRating !== null ? String(currentMinRating) : '');
    setBadgeKeys(currentBadgeKeys);
    setOnlyAvailable(currentOnlyAvailable);
    setExperience(currentExperience);
    setEventTypes(currentEventTypes);
    lastPushedRef.current = propQs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propQs]);

  // BFCACHE tazeleme — tarayıcı Geri/İleri sayfayı bfcache'ten dondurulmuş geri
  // yüklerse (persisted) RSC'yi tazele. Yalnız keşfet kapsamında.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) router.refresh();
    }
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [router]);

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

  // Mobil drawer açıkken scroll kilidi
  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Tek kategori seçiliyse detaylı filtreler
  const selectedSlug =
    cats.length === 1
      ? categories.find((c) => c.id === cats[0])?.slug ?? null
      : null;
  const filterFields = getFilterFields(selectedSlug);

  function toggleCat(id: number) {
    setCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
    setAttrs({}); // kategori değişince detayları sıfırla
  }

  function toggleAttr(key: string, value: string) {
    setAttrs((prev) => {
      const cur = prev[key] || [];
      const next = cur.includes(value)
        ? cur.filter((v) => v !== value)
        : [...cur, value];
      const updated = { ...prev };
      if (next.length > 0) updated[key] = next;
      else delete updated[key];
      return updated;
    });
  }

  function setAttrSingle(key: string, value: string) {
    setAttrs((prev) => {
      const updated = { ...prev };
      if (value) updated[key] = [value];
      else delete updated[key];
      return updated;
    });
  }

  function clearAll() {
    setSearch('');
    setCats([]);
    setCity('');
    setType('');
    setAttrs({});
    setMaxPrice('');
    setMinRating('');
    setBadgeKeys([]);
    setOnlyAvailable(false);
    setExperience([]);
    setEventTypes([]);
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
    (type ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (minRating ? 1 : 0) +
    eventTypes.length +
    badgeKeys.length +
    (onlyAvailable ? 1 : 0) +
    experience.length +
    Object.keys(attrs).length;

  // ===== Sidebar içeriği (hem masaüstü hem mobil drawer kullanır) =====
  const filterBody = (
    <div className="space-y-7">
      {/* Arama */}
      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="İsim ile ara..."
          className="w-full px-4 py-2.5 bg-card border border-line rounded-lg text-ink placeholder:text-ink-32 focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition text-sm"
        />
      </div>

      {/* Kim (tip) */}
      <div>
        <p className="font-display text-base text-ink mb-3">Kim</p>
        <div className="space-y-1.5">
          {[
            { key: '', label: 'Hepsi' },
            { key: 'profesyonel', label: 'Profesyoneller' },
            { key: 'ajans', label: 'Ajanslar' },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setType(opt.key)}
              className="flex items-center gap-2.5 w-full text-left group"
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  type === opt.key ? 'border-brand-ink' : 'border-line-strong group-hover:border-ink-50'
                }`}
              >
                {type === opt.key && (
                  <span className="w-2 h-2 rounded-full bg-brand-ink" />
                )}
              </span>
              <span
                className={`text-sm transition-colors ${
                  type === opt.key ? 'text-ink' : 'text-ink-72 group-hover:text-ink'
                }`}
              >
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Kategori — çoklu checkbox */}
      <div>
        <p className="font-display text-base text-ink mb-3">Kategori</p>
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {categories.map((cat) => {
            const on = cats.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCat(cat.id)}
                className="flex items-center gap-2.5 w-full text-left group"
              >
                <span
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    on ? 'bg-brand-ink border-brand-ink' : 'border-line-strong group-hover:border-ink-50'
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
                  {cat.name_tr}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Etkinlik türü — ORTAK filtre (tüm kategoriler), ÇOKLU tickbox (OR). Kategori kalıbıyla
          birebir aynı davranış. URL param: etkinlik (virgülle ayrık key'ler) */}
      <div>
        <p className="font-display text-base text-ink mb-3">Etkinlik türü</p>
        <div className="space-y-1.5">
          {EVENT_TYPES.map((et) => {
            const on = eventTypes.includes(et.key);
            return (
              <button
                key={et.key}
                type="button"
                onClick={() => toggleEventType(et.key)}
                className="flex items-center gap-2.5 w-full text-left group"
              >
                <span
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    on ? 'bg-brand-ink border-brand-ink' : 'border-line-strong group-hover:border-ink-50'
                  }`}
                >
                  {on && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 12l5 5L20 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className={`text-sm transition-colors ${on ? 'text-ink' : 'text-ink-72 group-hover:text-ink'}`}>
                  {et.label}
                </span>
              </button>
            );
          })}
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
                  className="w-full px-3 py-2 bg-paper-2/40 rounded-lg text-sm text-ink placeholder:text-ink-32 focus:outline-none focus:ring-2 focus:ring-brand-ink-08"
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
                    className="w-full text-left px-4 py-2 text-sm text-ink-72 hover:bg-brand-ink-08 hover:text-brand-ink transition-colors"
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
                          ? 'bg-brand-ink-08 text-brand-ink'
                          : 'text-ink hover:bg-brand-ink-08 hover:text-brand-ink'
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

      {/* Fiyat — başlangıç fiyatı tavanı */}
      <div>
        <p className="font-display text-base text-ink mb-3">Fiyat</p>
        <div className="space-y-1.5">
          {[{ value: '', label: 'Fark etmez' }, ...PRICE_OPTIONS].map((opt) => (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => setMaxPrice(opt.value)}
              className="flex items-center gap-2.5 w-full text-left group"
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  maxPrice === opt.value ? 'border-brand-ink' : 'border-line-strong group-hover:border-ink-50'
                }`}
              >
                {maxPrice === opt.value && (
                  <span className="w-2 h-2 rounded-full bg-brand-ink" />
                )}
              </span>
              <span
                className={`text-sm transition-colors ${
                  maxPrice === opt.value ? 'text-ink' : 'text-ink-72 group-hover:text-ink'
                }`}
              >
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Puan — minimum */}
      <div>
        <p className="font-display text-base text-ink mb-3">Puan</p>
        <div className="space-y-1.5">
          {[{ value: '', label: 'Fark etmez' }, ...RATING_OPTIONS].map((opt) => (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => setMinRating(opt.value)}
              className="flex items-center gap-2.5 w-full text-left group"
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  minRating === opt.value ? 'border-brand-ink' : 'border-line-strong group-hover:border-ink-50'
                }`}
              >
                {minRating === opt.value && (
                  <span className="w-2 h-2 rounded-full bg-brand-ink" />
                )}
              </span>
              <span
                className={`text-sm flex items-center gap-1 transition-colors ${
                  minRating === opt.value ? 'text-ink' : 'text-ink-72 group-hover:text-ink'
                }`}
              >
                {opt.value && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--color-brand-accent)" stroke="var(--color-brand-accent)" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                )}
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Gelişmiş filtreler — akordiyon (Sıra 3) */}
      <div className="border-t border-line pt-5">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center justify-between w-full group"
        >
          <span className="font-display text-base text-ink">
            Daha fazla filtre
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`text-ink-32 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {advancedOpen && (
          <div className="mt-4 space-y-6">
            {/* Rozetler — 4 bağımsız toggle, aralarında VEYA */}
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-72 mb-2.5">
                Rozetler
              </p>
              <p className="text-xs text-ink-32 mb-3 -mt-1">
                Seçtiklerinden en az birine sahip profiller
              </p>
              <div className="space-y-1.5">
                {[
                  { key: 'premium', label: 'Premium' },
                  { key: 'verified', label: 'Doğrulanmış' },
                  { key: 'topRated', label: 'Yüksek Puanlı' },
                  { key: 'popular', label: 'Çok Tercih Edilen' },
                ].map((opt) => {
                  const on = badgeKeys.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleBadge(opt.key)}
                      className="flex items-center gap-2.5 w-full text-left group"
                    >
                      <span
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          on ? 'bg-brand-ink border-brand-ink' : 'border-line-strong group-hover:border-ink-50'
                        }`}
                      >
                        {on && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5 12l5 5L20 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className={`text-sm transition-colors ${on ? 'text-ink' : 'text-ink-72 group-hover:text-ink'}`}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Müsaitlik — tek toggle (AND kısıt) */}
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-72 mb-2.5">
                Müsaitlik
              </p>
              <button
                type="button"
                onClick={() => setOnlyAvailable((v) => !v)}
                className="flex items-center gap-2.5 w-full text-left group"
              >
                <span
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    onlyAvailable ? 'bg-brand-ink border-brand-ink' : 'border-line-strong group-hover:border-ink-50'
                  }`}
                >
                  {onlyAvailable && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 12l5 5L20 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className={`text-sm transition-colors ${onlyAvailable ? 'text-ink' : 'text-ink-72 group-hover:text-ink'}`}>
                  Şu an müsait (yoğun olanları gizle)
                </span>
              </button>
            </div>

            {/* Deneyim — çoklu seçim (sıralama: seçilenler üste, eleme yok) */}
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-72 mb-2.5">
                Deneyim
              </p>
              <p className="text-xs text-ink-32 mb-3 -mt-1">
                Seçtiğin deneyimdekiler üst sıralarda gösterilir
              </p>
              <div className="space-y-1.5">
                {[
                  { value: 'junior', label: '0-2 yıl' },
                  { value: 'mid', label: '3-5 yıl' },
                  { value: 'senior', label: '6-10 yıl' },
                  { value: 'expert', label: '10+ yıl' },
                ].map((opt) => {
                  const on = experience.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleExperience(opt.value)}
                      className="flex items-center gap-2.5 w-full text-left group"
                    >
                      <span
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          on ? 'bg-brand-ink border-brand-ink' : 'border-line-strong group-hover:border-ink-50'
                        }`}
                      >
                        {on && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5 12l5 5L20 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className={`text-sm transition-colors ${on ? 'text-ink' : 'text-ink-72 group-hover:text-ink'}`}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Kategoriye özel detaylı filtreler — sadece tek kategori seçiliyken */}
      {filterFields.length > 0 && (
        <div className="pt-5 border-t border-line space-y-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-ink">
            {categories.find((c) => c.slug === selectedSlug)?.name_tr} detayları
          </p>
          {filterFields.map((field) => {
            const selected = attrs[field.key] || [];
            if (field.type === 'multi') {
              return (
                <div key={field.key}>
                  <label className="block text-xs text-ink-72 mb-2">{field.label}</label>
                  <div className="space-y-1.5">
                    {field.options.map((opt) => {
                      const on = selected.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleAttr(field.key, opt.value)}
                          className="flex items-center gap-2.5 w-full text-left group"
                        >
                          <span
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                              on ? 'bg-brand-ink border-brand-ink' : 'border-line-strong group-hover:border-ink-50'
                            }`}
                          >
                            {on && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 12l5 5L20 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span className={`text-sm transition-colors ${on ? 'text-ink' : 'text-ink-72 group-hover:text-ink'}`}>
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
            const cur = selected[0] || '';
            return (
              <div key={field.key}>
                <label className="block text-xs text-ink-72 mb-2">{field.label}</label>
                <select
                  value={cur}
                  onChange={(e) => setAttrSingle(field.key, e.target.value)}
                  className="w-full px-4 py-2.5 bg-card border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition"
                >
                  <option value="">Hepsi</option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {/* Temizle */}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="kashe-tap text-xs text-brand-ink hover:underline"
        >
          Tüm filtreleri temizle ({activeCount})
        </button>
      )}

      {/* Kategori öneri CTA — sidebar'ın sonunda vurgulu kart */}
      <div className="pt-6 border-t border-line">
        <KategoriTalepCta
          isLoggedIn={isLoggedIn}
          variant="block"
          existingSlugs={categories.map((c) => c.slug)}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* MASAÜSTÜ — kalıcı sidebar */}
      <div className="hidden lg:block sticky top-24">
        {filterBody}
      </div>

      {/* MOBİL — Filtreler butonu */}
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
            <span className="min-w-[20px] h-5 px-1.5 bg-brand-ink text-paper text-xs font-mono rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
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
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {filterBody}
            </div>
            <div className="border-t border-line px-6 py-4 shrink-0">
              <button
                type="button"
                onClick={() => {
                  applyNow(); // bekleyen debounce'ı flush et → anında uygula
                  setMobileOpen(false);
                }}
                className="kashe-tap w-full px-4 py-3 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors"
              >
                {isPending ? 'Yükleniyor...' : `${resultCount} sonucu göster`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
