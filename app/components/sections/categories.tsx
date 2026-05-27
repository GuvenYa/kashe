import { Eyebrow } from "@/app/components/ui/eyebrow";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase-server";
import { getCategoryIcon } from "@/app/lib/category-icon";

type CategoryRow = {
  id: number;
  slug: string;
  name_tr: string;
};

// Kategori zeminleri için renk rotasyonu (Kashe paleti).
// Tailwind dinamik class purge ettiği için inline rgba kullanıyoruz.
const TONES = [
  { bg: "rgba(200,68,42,0.10)", bgHover: "rgba(200,68,42,0.18)" }, // terracotta
  { bg: "rgba(107,46,92,0.10)", bgHover: "rgba(107,46,92,0.18)" }, // plum
  { bg: "rgba(63,107,71,0.10)", bgHover: "rgba(63,107,71,0.18)" }, // moss
  { bg: "rgba(168,52,30,0.10)", bgHover: "rgba(168,52,30,0.18)" }, // ember
];

export async function Categories() {
  const supabase = await createClient();
  const { data: categoriesData } = await supabase
    .from("service_categories")
    .select("id, slug, name_tr")
    .eq("is_active", true)
    .order("sort_order");

  const categories = (categoriesData || []) as CategoryRow[];

  return (
    <section id="hizmetler" className="bg-paper border-t border-line">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-24">
        {/* Section header */}
        <div className="mb-12 md:mb-16 max-w-2xl">
          <Eyebrow variant="inline" className="mb-4">
            Popüler kategoriler
          </Eyebrow>
          <h2 className="font-display font-light text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-ink">
            Hangi <em>yeteneği</em> arıyorsun?
          </h2>
        </div>

        {/* Categories grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {categories.map((cat, i) => {
            const iconUrl = getCategoryIcon(cat.slug);
            const tone = TONES[i % TONES.length];
            const initials = cat.name_tr
              .split(" ")
              .map((s) => s[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <Link
                key={cat.id}
                href={`/kesfet?kategori=${cat.id}`}
                className="group relative bg-card border border-line rounded-2xl p-6 transition-all duration-300 hover:border-terracotta hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgba(26,18,14,0.22)] overflow-hidden"
              >
                {/* Hover'da hafif renk yıkaması (zemin) */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: tone.bg }}
                  aria-hidden="true"
                />

                <div className="relative">
                  {/* İkon — renk rotasyonlu zemin */}
                  <div
                    className="w-20 h-20 flex items-center justify-center mb-5 rounded-xl transition-colors duration-300 overflow-hidden"
                    style={{ background: tone.bg }}
                  >
                    {iconUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={iconUrl}
                        alt={cat.name_tr}
                        className="w-full h-full object-contain p-1 kashe-icon-pop"
                      />
                    ) : (
                      <span className="font-display font-medium text-terracotta text-2xl">
                        {initials}
                      </span>
                    )}
                  </div>

                  {/* Başlık */}
                  <h3 className="font-display font-medium text-xl text-ink mb-2 leading-tight">
                    {cat.name_tr}
                  </h3>

                  {/* Link */}
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta inline-flex items-center gap-1 mt-2 transition-transform duration-200 group-hover:translate-x-1">
                    Keşfet
                    <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
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
