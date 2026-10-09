import { createClient } from "@/app/lib/supabase-server";
import { HeroAiSearch } from "./hero-ai-search";
import { Hero3DWrapper } from "./hero-3d-wrapper";
import { HeroMobile, type HeroSayac } from "./hero-mobile";
import { StatCounter } from "./stat-counter";

export async function Hero() {
  const supabase = await createClient();
  const [
    { data: categoriesData },
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
    // FAZ 2c: yayinda saglayici sayaci gorunumden; filtreler ayni.
    supabase
      .from("v_providers_public")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true)
      .in("role", ["professional", "agency"]),
    supabase.from("turkish_cities").select("id", { count: "exact", head: true }),
    supabase.auth.getUser(),
  ]);

  const categories = categoriesData || [];

  const popularLinks = [
    { label: "Düğün fotoğrafçısı", slug: "fotografci" },
    { label: "DJ", slug: "dj" },
    { label: "Sunucu", slug: "sunucu" },
    { label: "Oyuncu", slug: "oyuncu" },
    { label: "Dansçı", slug: "dansci" },
    { label: "Müzisyen", slug: "muzisyen" },
  ];

  // Istatistikler — UCU DE GERCEK veri; yedek sabit YOK. Degeri olmayan sayac
  // (null ya da 0) hic render edilmez; uydurma rakam gosterilmez.
  const sayaclar: HeroSayac[] = [
    { key: "pro", value: proCount ?? 0, label: "Profesyonel" },
    { key: "city", value: cityCount ?? 0, label: "Şehir" },
    { key: "cat", value: categories.length, label: "Kategori" },
  ].filter((s) => s.value > 0);

  return (
    <section className="relative bg-paper">
      {/* ═══ MOBİL (<lg): davul arka + metin önde (ayrı izole parça) ═══ */}
      <div className="lg:hidden">
        <HeroMobile
          categories={categories}
          popularLinks={popularLinks}
          sayaclar={sayaclar}
        />
      </div>

      {/* ═══ MASAÜSTÜ (lg+): mevcut grid — BİREBİR korundu ═══ */}
      <div className="hidden lg:block max-w-7xl mx-auto px-6 md:px-9 pt-14 md:pt-20 pb-12 md:pb-16">
        {/* Hero ızgarası: sol metin | sağ kolaj — HERO-REF.md §4 */}
        <div className="grid lg:grid-cols-[1fr_1.05fr] gap-[54px] items-center">

          {/* ——— SOL SÜTUN: metin ——— */}
          <div className="max-w-[580px]">

            {/* Eyebrow: brand-accent çizgi + brand-ink etiket */}
            <div
              className="kashe-rise inline-flex items-center gap-2.5 mb-6"
              style={{ animationDelay: "0ms" }}
            >
              <span
                className="inline-block h-px w-6 shrink-0"
                style={{ background: "var(--color-brand-accent)" }}
              />
              <span className="font-body font-semibold text-[11px] uppercase tracking-[0.2em] text-brand-ink">
                Etkinlik ve Yetenek Pazaryeri
              </span>
            </div>

            {/* H1 — "yetenek" em ile brand-ink */}
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
              style={{ color: "var(--color-ink-50)", maxWidth: "44ch", animationDelay: "160ms" }}
            >
              Düğün, kurumsal etkinlik ya da özel bir kutlama. Türkiye&apos;nin en
              yetenekli profesyonelleri, ekipleri ve organizasyon firmaları —
              şeffaf fiyatla, tek platformda.
            </p>

            {/* Arama — birincil yol Kashe AI (serbest metin). Yapisal arama
                (kategori + sehir) #hizmetler bolumunde. */}
            <div
              className="kashe-rise relative z-30 mb-4"
              style={{ animationDelay: "240ms" }}
            >
              <HeroAiSearch />
            </div>

            {/* Yapisal aramaya gecis — tek satir, mevcut duzeni bozmaz. */}
            <div
              className="kashe-rise mb-4 text-sm text-ink-72"
              style={{ animationDelay: "260ms" }}
            >
              Kimi aradığını biliyor musun?{' '}
              {/* Hero yalniz ana sayfada render edilir -> sayfa ici capa.
                  "/#hizmetler" yazmak Next'te rota gezinmesi sayilir. */}
              <a
                href="#hizmetler"
                className="font-display font-semibold text-brand-ink hover:underline"
              >
                Kategoriye göre ara →
              </a>
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
                    className="font-body text-[13px] text-ink-50 hover:text-brand-ink transition-colors underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </a>
                );
              })}
            </div>

            {/* İstatistikler — ince ayırıcılar; değeri olmayan sayaç basılmaz */}
            {sayaclar.length > 0 && (
              <div
                className="kashe-rise flex items-center gap-6 pt-6 border-t border-line"
                style={{ animationDelay: "320ms" }}
              >
                {sayaclar.map((s, i) => (
                  <div key={s.key} className="flex items-center gap-6">
                    {i > 0 && <div className="w-px h-7 bg-line shrink-0" />}
                    <div>
                      <StatCounter
                        value={s.value}
                        className="font-display font-semibold text-[28px] text-ink leading-none block"
                      />
                      <small className="font-body text-[11px] text-ink-50 mt-1.5 block uppercase tracking-[0.08em]">
                        {s.label}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
