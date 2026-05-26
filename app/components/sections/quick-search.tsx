"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CitySelect } from "./city-select";

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

  const trimmed = query.trim();
  const lowerQuery = trimmed.toLocaleLowerCase("tr");
  const suggestions =
    trimmed.length > 0
      ? categories
          .filter((c) =>
            c.name_tr.toLocaleLowerCase("tr").includes(lowerQuery)
          )
          .slice(0, 5)
      : [];

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
    if (trimmed) params.set("q", trimmed);
    if (categoryId) params.set("kategori", categoryId);
    if (cityId) params.set("sehir", cityId);
    const qs = params.toString();
    router.push(qs ? `/kesfet?${qs}` : "/kesfet");
  }

  return (
    <form
      onSubmit={handleSearch}
      className="relative z-40 bg-card border-2 border-ink rounded-2xl shadow-[6px_6px_0_var(--color-terracotta)] p-2 flex flex-col md:flex-row md:items-stretch gap-1.5"
    >
      {/* Serbest metin + autocomplete */}
      <div className="relative flex-[1.4]" ref={containerRef}>
        <div className="px-4 py-2.5 rounded-xl hover:bg-paper-2/40 transition-colors h-full flex flex-col justify-center">
          <label
            htmlFor="qs-query"
            className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-0.5"
          >
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
            placeholder="örn. düğün fotoğrafçısı"
            className="w-full bg-transparent text-ink text-base placeholder:text-ink-32 focus:outline-none"
          />
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-50 left-0 right-0 mt-2 bg-card border border-line rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((cat) => (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => goToCategory(cat.id)}
                  className="w-full text-left px-4 py-2.5 text-ink hover:bg-terracotta-08 hover:text-terracotta transition-colors flex items-center gap-2"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-32">
                    Kategori
                  </span>
                  <span className="font-display">{cat.name_tr}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hidden md:block w-px bg-line self-stretch my-2" />

      {/* Şehir */}
      <div className="flex-1">
        <CitySelect cities={cities} value={cityId} onChange={setCityId} />
      </div>

      {/* Ara butonu */}
      <button
        type="submit"
        className="shrink-0 bg-terracotta text-paper rounded-xl px-7 py-4 md:py-0 font-display font-semibold hover:bg-ember transition-colors flex items-center justify-center gap-2"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path
            d="M21 21L16.5 16.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        Ara
      </button>
    </form>
  );
}
