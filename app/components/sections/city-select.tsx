"use client";

import { useState, useRef, useEffect } from "react";

type CityOption = { id: number; name: string };

export function CitySelect({
  cities,
  value,
  onChange,
}: {
  cities: CityOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = cities.find((c) => String(c.id) === value) || null;

  const lower = query.trim().toLocaleLowerCase("tr");
  const filtered =
    lower.length > 0
      ? cities.filter((c) => c.name.toLocaleLowerCase("tr").includes(lower))
      : cities;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    if (open) setHighlight(0);
  }, [open]);

  function select(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight === 0) {
        select("");
      } else {
        const c = filtered[highlight - 1];
        if (c) select(String(c.id));
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div className="relative h-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-paper-2/40 transition-colors h-full flex flex-col justify-center"
      >
        <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-0.5">
          Nerede?
        </span>
        <span className="flex items-center justify-between">
          <span className={`text-base ${selected ? "text-ink" : "text-ink-32"}`}>
            {selected ? selected.name : "Tüm şehirler"}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`text-ink-32 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-card border border-line rounded-xl shadow-[0_12px_40px_-12px_rgba(26,18,14,0.22)] overflow-hidden min-w-[220px]">
          <div className="p-2 border-b border-line">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Şehir ara..."
              className="w-full px-3 py-2 bg-paper-2/40 rounded-lg text-sm text-ink placeholder:text-ink-32 focus:outline-none focus:ring-2 focus:ring-terracotta/20"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => select("")}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  highlight === 0
                    ? "bg-terracotta-08 text-terracotta"
                    : "text-ink-72 hover:bg-terracotta-08 hover:text-terracotta"
                }`}
              >
                Tüm şehirler
              </button>
            </li>
            {filtered.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => select(String(c.id))}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    highlight === i + 1
                      ? "bg-terracotta-08 text-terracotta"
                      : "text-ink hover:bg-terracotta-08 hover:text-terracotta"
                  }`}
                >
                  {c.name}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-ink-32 text-center">
                Şehir bulunamadı
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
