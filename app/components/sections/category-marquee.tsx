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
    <div className="bg-ink overflow-hidden py-5 md:py-6 relative rounded-2xl border border-terracotta/15">
      {/* kenar gölgeleri (fade) */}
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
        style={{
          background: "linear-gradient(to right, var(--color-ink), transparent)",
        }}
      />
      <div
        aria-hidden
        className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
        style={{
          background: "linear-gradient(to left, var(--color-ink), transparent)",
        }}
      />

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
                    className="w-7 h-7 md:w-8 md:h-8 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                    style={{
                      filter:
                        "brightness(0) saturate(100%) invert(38%) sepia(67%) saturate(1900%) hue-rotate(345deg) brightness(91%) contrast(89%)",
                    }}
                  />
                )}
                <span className="font-display italic text-xl md:text-3xl text-terracotta whitespace-nowrap group-hover:opacity-80 transition-opacity">
                  {cat.name_tr}
                </span>
              </a>
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta/60 shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}
