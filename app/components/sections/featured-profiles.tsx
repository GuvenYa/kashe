import Link from "next/link";
import { createClient } from "@/app/lib/supabase-server";
import { Eyebrow } from "@/app/components/ui/eyebrow";
import { getCategoryIcon } from "@/app/lib/category-icon";

// Üst filtre çıtası için popüler kategoriler (slug'larla)
const TOP_CATEGORIES = [
  { slug: "fotografci", label: "Fotoğrafçı" },
  { slug: "dj", label: "DJ" },
  { slug: "muzisyen", label: "Müzisyen" },
  { slug: "sunucu", label: "Sunucu" },
];

// Renk rotasyonu (categories/trust ile tutarlı)
const TONES = [
  { bg: "rgba(200,68,42,0.10)", bgHover: "rgba(200,68,42,0.18)" },
  { bg: "rgba(107,46,92,0.10)", bgHover: "rgba(107,46,92,0.18)" },
  { bg: "rgba(63,107,71,0.10)", bgHover: "rgba(63,107,71,0.18)" },
  { bg: "rgba(168,52,30,0.10)", bgHover: "rgba(168,52,30,0.18)" },
];

type FeaturedProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  role: string;
  city: string | null;
  category: string | null;
  categorySlug: string | null;
  rating: number | null;
  reviewCount: number;
  priceFrom: number | null;
  isNew: boolean;
};

function formatPrice(n: number): string {
  if (n >= 1000) {
    const k = Math.floor(n / 100) / 10;
    return `₺${k.toLocaleString("tr-TR")}K`;
  }
  return `₺${n.toLocaleString("tr-TR")}`;
}

export async function FeaturedProfiles() {
  const supabase = await createClient();

  // Kategorileri çek — filtre çıtası için slug → id eşlemesi
  const { data: categoriesData } = await supabase
    .from("service_categories")
    .select("id, slug")
    .eq("is_active", true);
  const slugToId: Record<string, number> = {};
  (categoriesData || []).forEach((c) => {
    slugToId[c.slug] = c.id;
  });

  // Top 6 profil: rating ortalamasına göre, yoksa en yeni
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      `
      id, full_name, avatar_url, company_name, role, created_at,
      turkish_cities(name),
      service_categories!profiles_primary_category_id_fkey(name_tr, slug)
    `
    )
    .eq("is_published", true)
    .in("role", ["professional", "agency"])
    .order("updated_at", { ascending: false })
    .limit(6);

  const list = (profiles || []) as unknown as Array<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
    created_at: string | null;
    turkish_cities: { name: string } | null;
    service_categories: { name_tr: string; slug: string } | null;
  }>;

  if (list.length === 0) return null; // Boş ise bölüm hiç görünmesin

  const ids = list.map((p) => p.id);

  // Ratings
  const { data: ratingsData } = await supabase
    .from("professional_rating_summary")
    .select("professional_id, review_count, average_rating")
    .in("professional_id", ids);

  const ratingsByProfile: Record<string, { count: number; average: number }> = {};
  (ratingsData || []).forEach((r) => {
    ratingsByProfile[r.professional_id] = {
      count: r.review_count,
      average: r.average_rating,
    };
  });

  // En düşük fiyat (services'tan)
  const { data: servicesData } = await supabase
    .from("services")
    .select("profile_id, price_min, price_on_request")
    .eq("is_active", true)
    .in("profile_id", ids);

  const priceFromByProfile: Record<string, number> = {};
  (servicesData || []).forEach((s) => {
    if (s.price_on_request || s.price_min === null) return;
    const cur = priceFromByProfile[s.profile_id];
    if (cur === undefined || s.price_min < cur) {
      priceFromByProfile[s.profile_id] = s.price_min;
    }
  });

  const featured: FeaturedProfile[] = list.map((p) => {
    let isNew = false;
    if (p.created_at) {
      const days = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24);
      isNew = days <= 30;
    }
    return {
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      company_name: p.company_name,
      role: p.role,
      city: p.turkish_cities?.name ?? null,
      category: p.service_categories?.name_tr ?? null,
      categorySlug: p.service_categories?.slug ?? null,
      rating: ratingsByProfile[p.id]?.average ?? null,
      reviewCount: ratingsByProfile[p.id]?.count ?? 0,
      priceFrom: priceFromByProfile[p.id] ?? null,
      isNew,
    };
  });

  return (
    <section className="bg-paper border-t border-line">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-24">
        {/* Header */}
        <div className="mb-10 md:mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-2xl">
            <Eyebrow variant="inline" className="mb-4">
              Öne çıkanlar
            </Eyebrow>
            <h2 className="font-display font-light text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-ink">
              Bu hafta <em>en çok tercih edilenler</em>.
            </h2>
          </div>
          <Link
            href="/kesfet"
            className="kashe-tap shrink-0 font-mono text-xs uppercase tracking-[0.16em] text-terracotta hover:underline inline-flex items-center gap-1.5 self-start md:self-auto"
          >
            Tümünü keşfet →
          </Link>
        </div>

        {/* Kategori filtre çıtası */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Link
            href="/kesfet"
            className="kashe-tap px-4 py-2 rounded-full text-xs font-mono uppercase tracking-[0.14em] bg-ink text-paper border border-ink hover:bg-ink-2 transition-colors"
          >
            Tümü
          </Link>
          {TOP_CATEGORIES.map((c) => {
            const catId = slugToId[c.slug];
            if (!catId) return null;
            return (
              <Link
                key={c.slug}
                href={`/kesfet?kategori=${catId}`}
                className="kashe-tap px-4 py-2 rounded-full text-xs font-mono uppercase tracking-[0.14em] bg-transparent text-ink-72 border border-line hover:border-ink hover:text-ink transition-colors"
              >
                {c.label}
              </Link>
            );
          })}
        </div>

        {/* Profil kartları — 3'lü grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featured.map((p, i) => {
            const tone = TONES[i % TONES.length];
            const displayName =
              (p.role === "business" || p.role === "agency") && p.company_name
                ? p.company_name
                : p.full_name || "İsimsiz";
            const initials = (p.full_name || p.company_name || "K")
              .split(" ")
              .map((s) => s[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase();
            const iconUrl = getCategoryIcon(p.categorySlug);

            return (
              <Link
                key={p.id}
                href={`/p/${p.id}`}
                className="group bg-card border border-line rounded-2xl overflow-hidden transition-all duration-300 hover:border-terracotta hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgba(26,18,14,0.22)]"
              >
                {/* Üst — renkli ikon/avatar zemini (hero kartlarındaki gibi) */}
                <div
                  className="h-28 flex items-center justify-center transition-colors duration-300"
                  style={{ background: tone.bg }}
                >
                  {p.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.avatar_url}
                      alt={displayName}
                      className="w-16 h-16 rounded-full object-cover border-2 border-paper shadow-sm"
                    />
                  ) : iconUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={iconUrl}
                      alt=""
                      className="w-14 h-14 object-contain kashe-icon-pop"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="font-display text-2xl text-terracotta">{initials}</span>
                  )}
                </div>

                {/* Alt — isim/kategori/puan/fiyat */}
                <div className="p-5">
                  <h3 className="font-display text-lg text-ink leading-tight truncate group-hover:text-terracotta transition-colors">
                    {displayName}
                  </h3>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mt-1.5 flex items-center gap-2 flex-wrap">
                    <span>
                      {p.category ?? "Profesyonel"}
                      {p.city ? ` · ${p.city}` : ""}
                    </span>
                    {p.isNew && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-moss bg-moss/10 border border-moss/30 px-1.5 py-0.5 rounded">
                        Yeni
                      </span>
                    )}
                  </p>

                  <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
                    {p.rating !== null && p.reviewCount > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <svg
                          width="13" height="13" viewBox="0 0 24 24"
                          fill="var(--color-terracotta)" stroke="var(--color-terracotta)"
                          strokeWidth="1.5" strokeLinejoin="round"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                          className="kashe-star"
                        >
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                        </svg>
                        <span className="font-display font-semibold text-sm text-ink">{p.rating}</span>
                        <span className="text-xs text-ink-50">({p.reviewCount})</span>
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">Yeni</span>
                    )}
                    {p.priceFrom !== null ? (
                      <span className="font-display font-semibold text-sm text-ink">
                        {formatPrice(p.priceFrom)}<span className="text-ink-50 font-normal">'den</span>
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">Talep üzerine</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
