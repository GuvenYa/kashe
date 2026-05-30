'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { ServiceCategory, TurkishCity } from '@/app/lib/types';
import { getFilterFields } from '@/app/lib/filter-config';
import { KategoriTalepCta } from '@/app/components/kategori-talep-cta';

type Props = {
  categories: ServiceCategory[];
  cities: TurkishCity[];
  currentCategories: number[];
  currentCity: number | null;
  currentSearch: string;
  currentAttrs: Record<string, string[]>;
  currentType: 'profesyonel' | 'ajans' | null;
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

  // Şehir arama dropdown
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const cityRef = useRef<HTMLDivElement>(null);

  // İlk render'da otomatik uygulama yapma (sadece kullanıcı etkileşiminde)
  const isFirst = useRef(true);

  // Sayfa açılır açılmaz başa kaydır (FeaturedProfiles/popüler linklerden gelirken)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Anlık filtreleme — state değişince debounce'lu URL push
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (cats.length > 0) params.set('kategori', cats.join(','));
      if (city) params.set('sehir', city);
      if (type) params.set('tip', type);
      for (const [key, vals] of Object.entries(attrs)) {
        if (vals.length > 0) params.set(`attr_${key}`, vals.join(','));
      }
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, cats, city, type, attrs]);

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
          className="w-full px-4 py-2.5 bg-card border border-line rounded-lg text-ink placeholder:text-ink-32 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition text-sm"
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
                  type === opt.key ? 'border-terracotta' : 'border-line-strong group-hover:border-ink-50'
                }`}
              >
                {type === opt.key && (
                  <span className="w-2 h-2 rounded-full bg-terracotta" />
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
                    on ? 'bg-terracotta border-terracotta' : 'border-line-strong group-hover:border-ink-50'
                  }`}
                >
                  {on && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 12l5 5L20 6" stroke="#FAF7F0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
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
                  className="w-full px-3 py-2 bg-paper-2/40 rounded-lg text-sm text-ink placeholder:text-ink-32 focus:outline-none focus:ring-2 focus:ring-terracotta/20"
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

      {/* Kategoriye özel detaylı filtreler — sadece tek kategori seçiliyken */}
      {filterFields.length > 0 && (
        <div className="pt-5 border-t border-line space-y-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta">
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
                              on ? 'bg-terracotta border-terracotta' : 'border-line-strong group-hover:border-ink-50'
                            }`}
                          >
                            {on && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 12l5 5L20 6" stroke="#FAF7F0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
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
                  className="w-full px-4 py-2.5 bg-card border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
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
          className="kashe-tap text-xs text-terracotta hover:underline"
        >
          Tüm filtreleri temizle ({activeCount})
        </button>
      )}

      {/* Kategori öneri CTA — sidebar'ın sonunda vurgulu kart */}
      <div className="pt-6 border-t border-line">
        <KategoriTalepCta isLoggedIn={isLoggedIn} variant="block" />
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
            <span className="min-w-[20px] h-5 px-1.5 bg-terracotta text-paper text-xs font-mono rounded-full flex items-center justify-center">
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
                onClick={() => setMobileOpen(false)}
                className="kashe-tap w-full px-4 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:bg-ember transition-colors"
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
