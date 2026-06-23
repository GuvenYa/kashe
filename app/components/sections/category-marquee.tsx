import { createClient } from "@/app/lib/supabase-server";
import { getCategoryIcon } from "@/app/lib/category-icon";

export async function CategoryMarquee() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_categories")
    .select("id, slug, name_tr")
    .eq("is_active", true)
    .order("sort_order");

  const categories = data || [];
  if (categories.length === 0) return null;

  // Kesintisiz akış için listeyi iki kez bas
  const loop = [...categories, ...categories];

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-9 mt-8 mb-10">
      {/* Zümrüt gradyan bant — kategori adlarını editöryel marquee olarak gösterir */}
      <div
        className="overflow-hidden py-5 md:py-6 relative rounded-2xl"
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="kashe-marquee flex items-center gap-10 md:gap-14 w-max">
          {loop.map((cat, i) => {
            const icon = getCategoryIcon(cat.slug);
            return (
              <div key={`${cat.id}-${i}`} className="flex items-center gap-10 md:gap-14">
                <a
                  href={`/kategori/${cat.slug}`}
                  className="flex items-center gap-3 group shrink-0"
                >
                  {icon && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={icon}
                      alt=""
                      aria-hidden="true"
                      className="w-6 h-6 md:w-7 md:h-7 object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                      style={{ filter: "brightness(0) invert(1)" }}
                    />
                  )}
                  <span className="font-display font-semibold text-lg md:text-2xl text-white whitespace-nowrap group-hover:opacity-80 transition-opacity tracking-[-0.02em]">
                    {cat.name_tr}
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
