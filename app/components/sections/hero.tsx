import { Eyebrow } from "@/app/components/ui/eyebrow";
import { Button } from "@/app/components/ui/button";
import { createClient } from "@/app/lib/supabase-server";
import { orderCities } from "@/app/lib/city-order";
import { QuickSearch } from "./quick-search";

export async function Hero() {
  const supabase = await createClient();
  const [{ data: categoriesData }, { data: citiesData }] = await Promise.all([
    supabase
      .from("service_categories")
      .select("id, name_tr")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("turkish_cities").select("id, name").order("name"),
  ]);

  const categories = categoriesData || [];
  const cities = orderCities(citiesData || []);

  return (
    <section className="relative overflow-hidden bg-paper">
      {/* Atmosferik terracotta glow — sağ üst */}
      <div
        aria-hidden
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(200, 68, 42, 0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-32">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <div className="mb-8">
            <Eyebrow variant="pill">Türkiye&apos;nin etkinlik pazaryeri</Eyebrow>
          </div>

          {/* Hero headline */}
          <h1 className="font-display font-light text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-[-0.04em] text-ink mb-8">
            Doğru kişiye
            <br />
            <em>direkt</em> ulaş.
          </h1>

          {/* Lede */}
          <p className="text-lg md:text-xl text-ink-72 leading-[1.55] mb-10 max-w-2xl">
            Hostes, DJ, fotoğrafçı, sunucu, müzisyen, oyuncu. Türkiye&apos;de
            etkinlik ve yetenek hizmetlerini ajanssız, şeffaf fiyatla ve güvenli
            ödeme ile buluşturuyoruz.
          </p>

          {/* QUICK SEARCH widget */}
          <div className="mb-8 max-w-2xl">
            <QuickSearch categories={categories} cities={cities} />
          </div>

          {/* İki CTA buton */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="/uye-ol?rol=profesyonel">
              <Button variant="primary" size="lg">
                Hizmet ver →
              </Button>
            </a>
            <a href="/uye-ol?rol=musteri">
              <Button variant="secondary" size="lg">
                Hizmet ara
              </Button>
            </a>
          </div>

          {/* Alt info */}
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-50">
            Ücretsiz kayıt · Komisyon sadece iş tamamlanınca
          </p>
        </div>
      </div>
    </section>
  );
}