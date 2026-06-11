import { Eyebrow } from "@/app/components/ui/eyebrow";
import { Button } from "@/app/components/ui/button";
import { createClient } from "@/app/lib/supabase-server";
import { orderCities } from "@/app/lib/city-order";
import { QuickSearch } from "./quick-search";
import { HeroStats } from "./hero-stats";
import { HeroGallery } from "./hero-gallery";

export async function Hero() {
  const supabase = await createClient();
  const [
    { data: categoriesData },
    { data: citiesData },
    { count: proCount },
    { count: cityCount },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("service_categories")
      .select("id, slug, name_tr")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("turkish_cities").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true)
      .in("role", ["professional", "agency"]),
    supabase.from("turkish_cities").select("id", { count: "exact", head: true }),
    supabase.auth.getUser(),
  ]);
  const isLoggedIn = !!user;

  const categories = categoriesData || [];
  const cities = orderCities(citiesData || []);

  return (
    <section className="relative overflow-hidden bg-paper">
      {/* Atmosferik glow — mor & pembe */}
      <div
        aria-hidden
        className="absolute -top-40 -right-32 w-[560px] h-[560px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(147, 51, 234, 0.14) 0%, transparent 70%)",
          filter: "blur(90px)",
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-[-20%] left-[-10%] w-[440px] h-[440px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(236, 72, 153, 0.10) 0%, transparent 70%)",
          filter: "blur(90px)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-12 md:pb-16">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-10 items-center">
          {/* SOL */}
          <div>
            <div className="kashe-rise" style={{ animationDelay: "0ms" }}>
              <Eyebrow variant="pill">
                Türkiye&apos;nin etkinlik pazaryeri
              </Eyebrow>
            </div>

            <h1
              className="kashe-rise font-display font-extrabold text-5xl md:text-7xl lg:text-[5rem] leading-[0.96] tracking-[-0.04em] text-ink mt-8 mb-6"
              style={{ animationDelay: "80ms" }}
            >
              Doğru kişiye
              <br />
              <span className="text-gradient-brand">direkt</span> ulaş.
            </h1>

            <p
              className="kashe-rise text-lg md:text-xl text-ink-72 leading-[1.55] mb-8 max-w-xl"
              style={{ animationDelay: "160ms" }}
            >
              Hostes, DJ, fotoğrafçı, sunucu, müzisyen, oyuncu. Etkinlik ve
              yetenek hizmetlerini ajanssız, şeffaf fiyatla buluşturuyoruz.
            </p>

            <div
              className="kashe-rise relative z-30 mb-4"
              style={{ animationDelay: "240ms" }}
            >
              <QuickSearch categories={categories} cities={cities} />
            </div>

            {/* Popüler hızlı linkler */}
            <div
              className="kashe-rise flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 text-sm"
              style={{ animationDelay: "280ms" }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                Popüler:
              </span>
              {[
                { label: "Düğün fotoğrafçısı", slug: "fotografci" },
                { label: "DJ", slug: "dj" },
                { label: "Sunucu", slug: "sunucu" },
                { label: "Müzisyen", slug: "muzisyen" },
                { label: "Hostes", slug: "hostes" },
              ].map((link) => {
                const cat = categories.find((c) => c.slug === link.slug);
                if (!cat) return null;
                return (
                  <a
                    key={link.slug}
                    href={`/kesfet?kategori=${cat.id}`}
                    className="text-ink-72 hover:text-terracotta transition-colors underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </a>
                );
              })}
            </div>

            {/* CTA — girişli/girişsiz durumuna göre */}
            <div
              className="kashe-rise relative z-0 flex flex-col sm:flex-row gap-3"
              style={{ animationDelay: "320ms" }}
            >
              {isLoggedIn ? (
                <>
                  <a href="/kesfet">
                    <Button variant="primary" size="lg">
                      Profesyonelleri keşfet →
                    </Button>
                  </a>
                  <a href="/ilanlar">
                    <Button variant="secondary" size="lg">
                      İlanlara göz at
                    </Button>
                  </a>
                </>
              ) : (
                <>
                  <a href="/uye-ol?rol=musteri">
                    <Button variant="primary" size="lg">
                      Hizmet ara →
                    </Button>
                  </a>
                  <a href="/uye-ol?rol=profesyonel">
                    <Button variant="secondary" size="lg">
                      Hizmet ver
                    </Button>
                  </a>
                </>
              )}
            </div>
          </div>

          {/* SAĞ — kayan profesyonel foto galerisi */}
          <div
            className="hidden lg:block kashe-fade"
            style={{ animationDelay: "300ms" }}
          >
            <HeroGallery />
          </div>
        </div>

        {/* İSTATİSTİK */}
        <div className="mt-14 md:mt-16">
          <HeroStats
            proCount={proCount ?? 0}
            categoryCount={categories.length}
            cityCount={cityCount ?? 81}
          />
        </div>
      </div>
    </section>
  );
}