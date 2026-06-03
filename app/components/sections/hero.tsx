import { Eyebrow } from "@/app/components/ui/eyebrow";
import { Button } from "@/app/components/ui/button";
import { createClient } from "@/app/lib/supabase-server";
import { orderCities } from "@/app/lib/city-order";
import { getCategoryIcon } from "@/app/lib/category-icon";
import { QuickSearch } from "./quick-search";
import { HeroStats } from "./hero-stats";
import { CursorGlow } from "./cursor-glow";

// Temsili profil kartları (gerçek profil sayısı artınca gerçek veriye geçilecek)
const SHOWCASE_CARDS = [
  {
    name: "Elif Demir",
    cat: "Fotoğrafçı",
    slug: "fotografci",
    city: "İstanbul",
    rating: "5.0",
    price: "₺4.200",
    tone: "rgba(200,68,42,0.1)",
    top: "2%",
    left: "44%",
    size: 188,
    rotate: "4deg",
    delay: "0s",
  },
  {
    name: "Can Yılmaz",
    cat: "DJ",
    slug: "dj",
    city: "Ankara",
    rating: "4.9",
    price: "₺3.500",
    tone: "rgba(107,46,92,0.1)",
    top: "32%",
    left: "2%",
    size: 192,
    rotate: "-5deg",
    delay: "0.8s",
  },
  {
    name: "Deniz Kaya",
    cat: "Sunucu",
    slug: "sunucu",
    city: "İzmir",
    rating: "4.8",
    price: "₺2.800",
    tone: "rgba(63,107,71,0.1)",
    top: "64%",
    left: "42%",
    size: 188,
    rotate: "3deg",
    delay: "1.4s",
  },
];

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
      <CursorGlow />
      {/* Atmosferik glow */}
      <div
        aria-hidden
        className="absolute -top-40 -right-32 w-[560px] h-[560px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(200, 68, 42, 0.16) 0%, transparent 70%)",
          filter: "blur(90px)",
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-[-20%] left-[-10%] w-[440px] h-[440px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(107, 46, 92, 0.10) 0%, transparent 70%)",
          filter: "blur(90px)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.035] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-12 md:pb-16">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-8 items-center">
          {/* SOL */}
          <div>
            <div className="kashe-rise" style={{ animationDelay: "0ms" }}>
              <Eyebrow variant="pill">
                Türkiye&apos;nin etkinlik pazaryeri
              </Eyebrow>
            </div>

            <h1
              className="kashe-rise font-display font-light text-5xl md:text-7xl lg:text-[5.25rem] leading-[0.95] tracking-[-0.04em] text-ink mt-8 mb-6"
              style={{ animationDelay: "80ms" }}
            >
              Doğru kişiye
              <br />
              <em>direkt</em> ulaş.
            </h1>

            <p
              className="kashe-rise text-lg md:text-xl text-ink-72 leading-[1.55] mb-8 max-w-xl"
              style={{ animationDelay: "160ms" }}
            >
              Hostes, DJ, fotoğrafçı, sunucu, müzisyen, oyuncu. Etkinlik ve
              yetenek hizmetlerini ajanssız, şeffaf fiyatla buluşturuyoruz.
            </p>

            <div className="kashe-rise relative z-30 mb-4" style={{ animationDelay: "240ms" }}>
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

          {/* SAĞ — temsili profil kartları */}
          <div
            aria-hidden
            className="hidden lg:block relative h-[480px] kashe-fade"
            style={{ animationDelay: "300ms" }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border border-terracotta-12 pointer-events-none" />

            {SHOWCASE_CARDS.map((c) => {
              const initials = c.name
                .split(" ")
                .map((s) => s[0])
                .join("");
              const icon = getCategoryIcon(c.slug);
              return (
                <div
                  key={c.name}
                  className="absolute group transition-transform duration-300 hover:!rotate-0 hover:scale-105 hover:z-20"
                  style={{
                    top: c.top,
                    left: c.left,
                    width: c.size,
                    transform: `rotate(${c.rotate})`,
                  }}
                >
                  <div
                    className="kashe-float bg-card border border-line rounded-2xl shadow-[0_16px_48px_-12px_rgba(26,18,14,0.20)] overflow-hidden group-hover:shadow-[0_24px_60px_-12px_rgba(26,18,14,0.32)] transition-shadow"
                    style={{ animationDelay: c.delay }}
                  >
                    {/* Üst: büyük ikon alanı (renkli zemin) */}
                    <div
                      className="h-24 flex items-center justify-center"
                      style={{ background: c.tone }}
                    >
                      {icon ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={icon}
                          alt=""
                          className="w-14 h-14 object-contain"
                        />
                      ) : (
                        <span className="font-display font-semibold text-3xl text-terracotta">
                          {initials}
                        </span>
                      )}
                    </div>
                    {/* Alt: bilgi */}
                    <div className="p-4">
                      <p className="font-display font-semibold text-ink leading-tight truncate">
                        {c.name}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-50 mb-3">
                        {c.cat} · {c.city}
                      </p>
                      <div className="flex items-center justify-between pt-3 border-t border-line">
                        <span className="flex items-center gap-1 text-sm">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="var(--color-terracotta)"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                          </svg>
                          <span className="font-display font-semibold text-ink">
                            {c.rating}
                          </span>
                        </span>
                        <span className="font-display text-ink-72 text-sm">
                          {c.price}&apos;den
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
