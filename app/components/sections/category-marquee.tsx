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
    <div className="max-w-7xl mx-auto px-6 md:px-12 my-2">
      <div className="bg-gradient-brand overflow-hidden py-5 md:py-6 relative rounded-2xl">
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
                      className="w-7 h-7 md:w-8 md:h-8 object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                      style={{
                        filter: "brightness(0) invert(1)",
                      }}
                    />
                  )}
                  <span className="font-display font-semibold text-xl md:text-3xl text-white whitespace-nowrap group-hover:opacity-80 transition-opacity">
                    {cat.name_tr}
                  </span>
                </a>
                <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}