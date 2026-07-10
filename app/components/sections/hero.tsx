import { createClient } from "@/app/lib/supabase-server";
import { orderCities } from "@/app/lib/city-order";
import { QuickSearch } from "./quick-search";
import { Hero3DWrapper } from "./hero-3d-wrapper";
import { HeroMobile } from "./hero-mobile";
import { StatCounter } from "./stat-counter";

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

  const categories = categoriesData || [];
  const cities = orderCities(citiesData || []);

  const popularLinks = [
    { label: "Düğün fotoğrafçısı", slug: "fotografci" },
    { label: "DJ", slug: "dj" },
    { label: "Sunucu", slug: "sunucu" },
    { label: "Müzisyen", slug: "muzisyen" },
    { label: "Hostes", slug: "hostes" },
  ];

  // İstatistik değerleri — tek kaynak (mobil + masaüstü aynı), ileride güncellenecek.
  const proNum = (proCount ?? 0) > 0 ? (proCount ?? 0) : 2400;
  const cityNum = cityCount ?? 81;
  const eventNum = 12000;

  return (
    <section className="relative bg-paper">
      {/* ═══ MOBİL (<lg): davul arka + metin önde (ayrı izole parça) ═══ */}
      <div className="lg:hidden">
        <HeroMobile
          categories={categories}
          cities={cities}
          popularLinks={popularLinks}
          proCount={proNum}
          cityCount={cityNum}
          eventCount={eventNum}
        />
      </div>

      {/* ═══ MASAÜSTÜ (lg+): mevcut grid — BİREBİR korundu ═══ */}
      <div className="hidden lg:block max-w-7xl mx-auto px-6 md:px-9 pt-14 md:pt-20 pb-12 md:pb-16">
        {/* Hero ızgarası: sol metin | sağ kolaj — HERO-REF.md §4 */}
        <div className="grid lg:grid-cols-[1fr_1.05fr] gap-[54px] items-center">

          {/* ——— SOL SÜTUN: metin ——— */}
          <div className="max-w-[580px]">

            {/* Eyebrow: mercan çizgi + zümrüt etiket */}
            <div
              className="kashe-rise inline-flex items-center gap-2.5 mb-6"
              style={{ animationDelay: "0ms" }}
            >
              <span
                className="inline-block h-px w-6 shrink-0"
                style={{ background: "var(--color-plum)" }}
              />
              <span className="font-body font-semibold text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Etkinlik &amp; Yetenek Pazaryeri
              </span>
            </div>

            {/* H1 — "yetenek" em ile zümrüt */}
            <h1
              className="kashe-rise font-display font-semibold leading-[1] tracking-[-0.035em] text-ink mb-6"
              style={{
                fontSize: "clamp(40px, 8vw, 72px)",
                animationDelay: "80ms",
              }}
            >
              Türkiye&apos;nin <em>yetenek</em> sahnesi.
            </h1>

            {/* Alt metin */}
            <p
              className="kashe-rise font-body text-[18px] leading-[1.6] mb-8"
              style={{ color: "var(--color-ink-50)", maxWidth: "40ch", animationDelay: "160ms" }}
            >
              Düğün, kurumsal etkinlik ya da özel bir kutlama. Türkiye&apos;nin en
              yetenekli profesyonelleri — ajanssız, şeffaf fiyatla.
            </p>

            {/* Arama çubuğu */}
            <div
              className="kashe-rise relative z-30 mb-4"
              style={{ animationDelay: "240ms" }}
            >
              <QuickSearch categories={categories} cities={cities} />
            </div>

            {/* Popüler hızlı linkler */}
            <div
              className="kashe-rise flex flex-wrap items-center gap-x-3 gap-y-2 mb-8"
              style={{ animationDelay: "280ms" }}
            >
              <span className="font-body text-[10px] uppercase tracking-[0.16em] text-ink-32">
                Popüler:
              </span>
              {popularLinks.map((link) => {
                const cat = categories.find((c) => c.slug === link.slug);
                if (!cat) return null;
                return (
                  <a
                    key={link.slug}
                    href={`/kesfet?kategori=${cat.id}`}
                    className="font-body text-[13px] text-ink-50 hover:text-terracotta transition-colors underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </a>
                );
              })}
            </div>

            {/* İstatistikler — 3 kolon, ince ayırıcılar */}
            <div
              className="kashe-rise flex items-center gap-6 pt-6 border-t border-line"
              style={{ animationDelay: "320ms" }}
            >
              <div>
                <StatCounter
                  value={proNum}
                  suffix="+"
                  className="font-display font-semibold text-[28px] text-ink leading-none block"
                />
                <small className="font-body text-[11px] text-ink-50 mt-1.5 block uppercase tracking-[0.08em]">
                  Profesyonel
                </small>
              </div>
              <div className="w-px h-7 bg-line shrink-0" />
              <div>
                <StatCounter
                  value={cityNum}
                  suffix="+"
                  className="font-display font-semibold text-[28px] text-ink leading-none block"
                />
                <small className="font-body text-[11px] text-ink-50 mt-1.5 block uppercase tracking-[0.08em]">
                  Şehir
                </small>
              </div>
              <div className="w-px h-7 bg-line shrink-0" />
              <div>
                <StatCounter
                  value={eventNum}
                  suffix="+"
                  className="font-display font-semibold text-[28px] text-ink leading-none block"
                />
                <small className="font-body text-[11px] text-ink-50 mt-1.5 block uppercase tracking-[0.08em]">
                  Etkinlik
                </small>
              </div>
            </div>
          </div>

          {/* ——— SAĞ SÜTUN: 3D helix (lg+) / kolaj fallback (mobil) ——— */}
          <div
            className="kashe-fade hidden lg:block"
            style={{ animationDelay: "300ms" }}
          >
            <Hero3DWrapper />
          </div>

        </div>
      </div>
    </section>
  );
}
