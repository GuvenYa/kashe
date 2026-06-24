import { QuickSearch } from "./quick-search";
import { Hero3DWrapper } from "./hero-3d-wrapper";

type Category = { id: number; slug: string; name_tr: string };
type City = { id: number; name: string };
type PopularLink = { label: string; slug: string };

type Props = {
  categories: Category[];
  cities: City[];
  popularLinks: PopularLink[];
  formattedProCount: string;
  cityCount: number;
};

/**
 * MOBİL HERO (<lg) — davul ARKADA (z-0) + metin ÖNDE ortada (z-3).
 * Masaüstü grid'inden tamamen izole; sadece hero.tsx'in lg:hidden dalında render edilir.
 * Hero3D mobilde kendini fill + camZ 11.5 + parallax/hover kapalı + scroll-itme'ye ayarlar.
 */
export function HeroMobile({
  categories,
  cities,
  popularLinks,
  formattedProCount,
  cityCount,
}: Props) {
  return (
    <div className="bg-paper">
      {/* ── DAVUL BANDI: davul arka (z-0) + metin önde (z-3) ── */}
      <div className="relative overflow-hidden" style={{ minHeight: "52vh" }}>
        {/* z-0 — davul (mobilde fill) */}
        <Hero3DWrapper />

        {/* z-1 — hafif tek-tip paper perdesi (davul biraz solsun) */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            zIndex: 1,
            background: "rgba(251,248,244,0.1)",
            pointerEvents: "none",
          }}
        />

        {/* z-2 — güçlü geniş glow (başlık ekranın çoğunu kaplar) */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            zIndex: 2,
            background:
              "radial-gradient(ellipse 90% 50% at 50% 45%, rgba(251,248,244,0.95) 0%, rgba(251,248,244,0.8) 50%, transparent 85%)",
            pointerEvents: "none",
          }}
        />

        {/* z-3 — metin merkezi (eyebrow + h1 + paragraf) */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
          style={{ zIndex: 3, pointerEvents: "none" }}
        >
          {/* Eyebrow */}
          <div className="kashe-rise inline-flex items-center gap-2.5 mb-5">
            <span
              className="inline-block h-px w-6 shrink-0"
              style={{ background: "var(--color-plum)" }}
            />
            <span className="font-body font-semibold text-[11px] uppercase tracking-[0.2em] text-terracotta">
              Etkinlik &amp; Yetenek Pazaryeri
            </span>
          </div>

          <h1
            className="kashe-rise font-display font-semibold leading-[1.02] tracking-[-0.035em] text-ink mb-5"
            style={{
              fontSize: "clamp(40px, 12vw, 56px)",
              animationDelay: "80ms",
              textShadow:
                "0 1px 3px rgba(251,248,244,0.9), 0 0 12px rgba(251,248,244,0.6)",
            }}
          >
            Türkiye&apos;nin <em>yetenek</em> sahnesi.
          </h1>

          <p
            className="kashe-rise font-body font-medium text-[16px] leading-[1.55] max-w-[42ch]"
            style={{
              color: "var(--color-ink)",
              animationDelay: "160ms",
              textShadow:
                "0 1px 3px rgba(251,248,244,0.9), 0 0 12px rgba(251,248,244,0.6)",
            }}
          >
            Düğün, kurumsal etkinlik ya da özel bir kutlama. Türkiye&apos;nin en
            yetenekli profesyonelleri — ajanssız, şeffaf fiyatla.
          </p>
        </div>
      </div>

      {/* ── ALT ŞERİT: arama + popüler + istatistik (davulun ALTINDA, açık zemin) ── */}
      <div className="px-6 pt-3 pb-12 flex flex-col items-center">
        {/* Arama */}
        <div
          className="kashe-rise relative z-30 w-full max-w-[480px]"
          style={{ animationDelay: "240ms" }}
        >
          <QuickSearch categories={categories} cities={cities} />
        </div>

        {/* Popüler linkler */}
        <div className="kashe-rise flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mt-4">
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

        {/* İstatistikler */}
        <div className="kashe-rise flex items-center justify-center gap-6 mt-7 pt-6 border-t border-line w-full max-w-[420px]">
          <div className="text-center">
            <span className="font-display font-semibold text-[24px] text-ink leading-none block">
              {formattedProCount}
            </span>
            <small className="font-body text-[10px] text-ink-50 mt-1.5 block uppercase tracking-[0.08em]">
              Profesyonel
            </small>
          </div>
          <div className="w-px h-7 bg-line shrink-0" />
          <div className="text-center">
            <span className="font-display font-semibold text-[24px] text-ink leading-none block">
              {cityCount}+
            </span>
            <small className="font-body text-[10px] text-ink-50 mt-1.5 block uppercase tracking-[0.08em]">
              Şehir
            </small>
          </div>
          <div className="w-px h-7 bg-line shrink-0" />
          <div className="text-center">
            <span className="font-display font-semibold text-[24px] text-ink leading-none block">
              12.000+
            </span>
            <small className="font-body text-[10px] text-ink-50 mt-1.5 block uppercase tracking-[0.08em]">
              Etkinlik
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
