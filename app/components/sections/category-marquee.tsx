import { getCategoryIcon } from "@/app/lib/category-icon";
import { getMarqueeProfiles } from "./marquee-profiles";

// Avatarsız profiller için 3D hero'nun optimize webp'leri (dönüşümlü atanır).
// Sıra hero-3d ile aynı (kategoriler harmanlı) → komşu profiller farklı sahne alır.
const HERO_FALLBACK_IMAGES = [
  "/images/hero/dj-mertkan.webp",
  "/images/hero/ece-yildiz.webp",
  "/images/hero/hero-event.webp",
  "/images/hero/selin-aksoy.webp",
  "/images/hero/vibes-band.webp",
  "/images/hero/dans-01.webp",
  "/images/hero/dj-02.webp",
  "/images/hero/dugun-01.webp",
  "/images/hero/dugun-02.webp",
  "/images/hero/isik-01.webp",
  "/images/hero/konser-01.webp",
  "/images/hero/konser-02.webp",
  "/images/hero/parti-01.webp",
  "/images/hero/parti-02.webp",
  "/images/hero/parti-03.webp",
  "/images/hero/sahne-01.webp",
  "/images/hero/sahne-02.webp",
];

export async function CategoryMarquee() {
  const profiles = await getMarqueeProfiles();
  if (profiles.length === 0) return null; // Yayında profil yoksa bant hiç görünmesin

  // Kesintisiz akış için listeyi iki kez bas
  const loop = [...profiles, ...profiles];

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-9 mt-8 mb-10">
      {/* Zümrüt gradyan bant — öne çıkan profilleri vitrin marquee olarak gösterir */}
      <div
        className="overflow-hidden py-4 md:py-5 relative rounded-2xl"
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="kashe-marquee flex items-center gap-8 md:gap-12 w-max">
          {loop.map((p, i) => {
            // İkinci kopya (klon) yalnızca görsel doldurma — a11y ağacından ve tab
            // sırasından gizlenir; yoksa her link iki kez okunur/sekmelenir.
            const isClone = i >= profiles.length;
            // Avatarsız profile dönüşümlü hero görseli — orijinal sıraya göre (klon aynı görseli alır)
            const heroImg =
              HERO_FALLBACK_IMAGES[
                (i % profiles.length) % HERO_FALLBACK_IMAGES.length
              ];
            // İsim seçimi featured-profiles ile birebir (rol-koşullu: company yalnız iş/ajansta)
            const name =
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
              <div
                key={`${p.id}-${i}`}
                className="flex items-center gap-8 md:gap-12"
                aria-hidden={isClone || undefined}
              >
                <a
                  href={`/p/${p.id}`}
                  tabIndex={isClone ? -1 : undefined}
                  className="flex items-center gap-3 group shrink-0"
                >
                  {/* Avatar → hero görseli (dönüşümlü) → kategori ikonu → baş harf */}
                  <span className="w-10 h-10 md:w-11 md:h-11 rounded-full overflow-hidden bg-paper/90 border-2 border-paper/70 shadow-sm flex items-center justify-center shrink-0">
                    {p.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.avatar_url}
                        alt={name}
                        className="w-full h-full object-cover"
                      />
                    ) : heroImg ? (
                      /* Avatarı olmayan profil — hero görseli, avatarla aynı stil (dekoratif).
                         lazy+async: dekoratif olduğundan kritik yoldan çıkar, LCP hero ile yarışmaz. */
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={heroImg}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : iconUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={iconUrl}
                        alt=""
                        aria-hidden="true"
                        className="w-6 h-6 object-contain opacity-80"
                      />
                    ) : (
                      <span className="font-display text-sm font-semibold text-terracotta">
                        {initials}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-display font-semibold text-base md:text-lg text-white whitespace-nowrap group-hover:opacity-80 transition-opacity tracking-[-0.02em]">
                      {name}
                    </span>
                    {p.category && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/70 whitespace-nowrap">
                        {p.category}
                      </span>
                    )}
                  </span>
                </a>
                {/* Ayırıcı nokta */}
                <span className="w-1 h-1 rounded-full bg-white/30 shrink-0" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
