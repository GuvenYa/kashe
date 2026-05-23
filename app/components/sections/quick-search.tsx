"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type CategoryOption = {
  id: number;
  name_tr: string;
};

type CityOption = {
  id: number;
  name: string;
};

export function QuickSearch({
  categories,
  cities,
}: {
  categories: CategoryOption[];
  cities: CityOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cityId, setCityId] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Türkçe locale-aware kategori eşleşmesi
  const trimmed = query.trim();
  const lowerQuery = trimmed.toLocaleLowerCase("tr");
  const suggestions =
    trimmed.length > 0
      ? categories.filter((c) =>
          c.name_tr.toLocaleLowerCase("tr").includes(lowerQuery)
        )
      : [];

  // Dışarı tıklayınca öneri listesini kapat
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function goToCategory(catId: number) {
    setShowSuggestions(false);
    const params = new URLSearchParams();
    params.set("kategori", String(catId));
    if (cityId) params.set("sehir", cityId);
    router.push(`/kesfet?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setShowSuggestions(false);
    const params = new URLSearchParams();
    const q = trimmed;
    if (q) params.set("q", q);
    if (categoryId) params.set("kategori", categoryId);
    if (cityId) params.set("sehir", cityId);
    const qs = params.toString();
    router.push(qs ? `/kesfet?${qs}` : "/kesfet");
  }

  const selectClass =
    "w-full px-4 py-3 bg-white border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition appearance-none cursor-pointer";

  return (
    <form
      onSubmit={handleSearch}
      className="bg-white/80 backdrop-blur-sm border border-line rounded-xl p-4 md:p-5 shadow-[0_2px_20px_rgba(26,18,14,0.06)]"
    >
      <div className="flex flex-col gap-3">
        {/* Serbest metin arama + autocomplete */}
        <div className="relative" ref={containerRef}>
          <label htmlFor="qs-query" className="sr-only">
            Ne arıyorsun?
          </label>
          <input
            id="qs-query"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            autoComplete="off"
            placeholder="Ne arıyorsun? (örn. düğün fotoğrafçısı)"
            className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
          />

          {/* Öneri listesi */}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-line rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {suggestions.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => goToCategory(cat.id)}
                    className="w-full text-left px-4 py-2.5 text-ink hover:bg-terracotta/8 hover:text-terracotta transition-colors flex items-center gap-2"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72/60">
                      Kategori
                    </span>
                    <span className="font-display">{cat.name_tr}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Kategori + Şehir dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={selectClass}
            aria-label="Kategori"
          >
            <option value="">Tüm kategoriler</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name_tr}
              </option>
            ))}
          </select>

          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className={selectClass}
            aria-label="Şehir"
          >
            <option value="">Tüm şehirler</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        {/* Ara butonu */}
        <button
          type="submit"
          className="w-full px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
        >
          Keşfet →
        </button>
      </div>
    </form>
  );
}