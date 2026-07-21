import { Eyebrow } from "@/app/components/ui/eyebrow";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase-server";
import { getCategoryIcon } from "@/app/lib/category-icon";
import { CategoryIcon } from "@/app/components/ui/category-icon";
import { KategoriTalepCta } from "@/app/components/kategori-talep-cta";

type CategoryRow = {
  id: number;
  slug: string;
  name_tr: string;
};

// Kategori ikon zemini renk rotasyonu — DESIGN.md §1 çok renkli sistem.
// iconBg: ikon kutusunun dolgu rengi (pastel).
// cardHover: kart hover'ında üst katman overlay (subtle rgba).
const TONES = [
  { iconBg: "#EAE4F5", cardHover: "rgba(109,79,176,0.07)"  }, // DJ          — mor    #6D4FB0
  { iconBg: "#E2EEFB", cardHover: "rgba(45,111,184,0.07)"  }, // Fotoğrafçı  — mavi   #2D6FB8
  { iconBg: "#FFF1DC", cardHover: "rgba(181,133,31,0.07)"  }, // Sunucu      — altın  #B5851F
  { iconBg: "#FCEAE4", cardHover: "rgba(250,11,150,0.07)"  }, // Organizasyon— mercan #FA0B96
  { iconBg: "#E6F6EE", cardHover: "rgba(31,138,95,0.07)"   }, // Müzisyen    — yeşil  #1F8A5F
];

export async function Categories() {
  const supabase = await createClient();

  // Kategori önerisi CTA'sı için kullanıcı durumu
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const { data: categoriesData } = await supabase
    .from("service_categories")
    .select("id, slug, name_tr")
    .eq("is_active", true)
    .order("sort_order");

  const categories = (categoriesData || []) as CategoryRow[];

  // Her kategoride kaç yayında profesyonel var (id -> count)
  const profileCountByCat: Record<number, number> = {};
  if (categories.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("primary_category_id")
      .eq("is_published", true)
      .in("role", ["professional", "agency"]);
    (profileRows || []).forEach((r) => {
      if (r.primary_category_id) {
        profileCountByCat[r.primary_category_id] =
          (profileCountByCat[r.primary_category_id] || 0) + 1;
      }
    });
  }

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
                href={`/kategori/${cat.slug}`}
                className="group relative bg-card border border-line rounded-2xl p-6 transition-all duration-300 hover:border-terracotta hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgba(26,18,14,0.22)] overflow-hidden"
              >
                {/* Hover'da hafif renk yıkaması (zemin) */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: tone.cardHover }}
                  aria-hidden="true"
                />

                <div className="relative">
                  {/* İkon — renk rotasyonlu zemin */}
                  <div
                    className="w-20 h-20 flex items-center justify-center mb-5 rounded-xl transition-colors duration-300 overflow-hidden"
                    style={{ background: tone.iconBg }}
                  >
                    {iconUrl ? (
                      <CategoryIcon
                        src={iconUrl}
                        name={cat.name_tr}
                        initials={initials}
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

                  {/* Link + (boşsa) Yakında etiketi */}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta inline-flex items-center gap-1 transition-transform duration-200 group-hover:translate-x-1">
                      Keşfet
                      <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                    </div>
                    {(profileCountByCat[cat.id] || 0) === 0 && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-50 bg-paper-2 border border-line px-1.5 py-0.5 rounded">
                        Yakında
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Kategori öneri CTA — grid altında, sade inline */}
        <div className="mt-10 flex justify-center">
          <KategoriTalepCta
            isLoggedIn={isLoggedIn}
            variant="inline"
            existingSlugs={categories.map((c) => c.slug)}
          />
        </div>
      </div>
    </section>
  );
}
