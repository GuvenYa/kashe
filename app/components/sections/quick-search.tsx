"use client";

import { useState } from "react";
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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    const q = query.trim();
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
        {/* Serbest metin arama */}
        <div>
          <label
            htmlFor="qs-query"
            className="sr-only"
          >
            Ne arıyorsun?
          </label>
          <input
            id="qs-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ne arıyorsun? (örn. düğün fotoğrafçısı)"
            className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
          />
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