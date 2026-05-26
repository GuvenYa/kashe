import { Eyebrow } from "@/app/components/ui/eyebrow";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase-server";
import { getCategoryIcon } from "@/app/lib/category-icon";

type CategoryRow = {
  id: number;
  slug: string;
  name_tr: string;
};

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {categories.map((cat) => {
            const iconUrl = getCategoryIcon(cat.slug);
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
                className="group bg-card border border-line p-6 transition-all duration-200 hover:border-terracotta hover:-translate-y-0.5"
              >
                {/* Icon / placeholder container */}
                <div className="w-20 h-20 bg-terracotta-08 flex items-center justify-center mb-5 rounded-lg transition-colors group-hover:bg-terracotta-12 overflow-hidden">
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

                {/* Title */}
                <h3 className="font-display font-medium text-xl text-ink mb-2 leading-tight">
                  {cat.name_tr}
                </h3>

                {/* Link */}
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 mt-2">
                  Keşfet →
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}