import { HeroAiSearch } from "./hero-ai-search";
import { Hero3DWrapper } from "./hero-3d-wrapper";
import { StatCounter } from "./stat-counter";

type Category = { id: number; slug: string; name_tr: string };
type PopularLink = { label: string; slug: string };

export type HeroSayac = { key: string; value: number; label: string };

type Props = {
  categories: Category[];
  popularLinks: PopularLink[];
  sayaclar: HeroSayac[];
};

/**
 * MOBİL HERO (<lg) — davul ARKADA (z-0) + metin ÖNDE ortada (z-3).
 * Masaüstü grid'inden tamamen izole; sadece hero.tsx'in lg:hidden dalında render edilir.
 * Hero3D mobilde kendini fill + camZ 10.0 + parallax/hover kapalı + scroll-itme'ye ayarlar.
 *
 * BASLIK: masaustu hero ile mobil hero DOM'da AYNI ANDA bulunur. Sayfada tek <h1>
 * kalsin diye buradaki baslik <p>'dir (gorsel olarak ayni; masaustundeki h1 tek).
 *
 * PERDE (T11): 375 px'te metin fotograf halkasinin uzerine biniyordu. Iki perde
 * katmani guclendirildi; renk degeri de `paper` token'ina (#F7F9FC) cekildi —
 * dosya eski sicak kagit degerini (251,248,244) tasiyordu, soguk zeminde sari
 * bir leke birakiyordu.
 */
export function HeroMobile({
  categories,
  popularLinks,
  sayaclar,
}: Props) {
  return (
    <div className="bg-paper">
      {/* ── DAVUL BANDI: davul arka (z-0) + metin önde (z-3) ── */}
      <div className="relative overflow-hidden" style={{ minHeight: "52vh" }}>
        {/* z-0 — davul (mobilde fill) */}
        <Hero3DWrapper />

        {/* z-1 — tek-tip paper perdesi (davul solsun) */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            zIndex: 1,
            background: "rgba(247,249,252,0.30)",
            pointerEvents: "none",
          }}
        />

        {/* z-2 — geniş glow (başlık bloğunun arkası okunur kalsın) */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            zIndex: 2,
            background:
              "radial-gradient(ellipse 100% 58% at 50% 46%, rgba(247,249,252,0.98) 0%, rgba(247,249,252,0.90) 52%, transparent 86%)",
            pointerEvents: "none",
          }}
        />

        {/* z-3 — metin merkezi (eyebrow + başlık + paragraf) */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
          style={{ zIndex: 3, pointerEvents: "none" }}
        >
          {/* Eyebrow */}
          <div className="kashe-rise inline-flex items-center gap-2.5 mb-5">
            <span
              className="inline-block h-px w-6 shrink-0"
              style={{ background: "var(--color-brand-accent)" }}
            />
            <span className="font-body font-semibold text-[11px] uppercase tracking-[0.2em] text-brand-ink">
              Etkinlik ve Yetenek Pazaryeri
            </span>
          </div>

          <p
            className="kashe-rise font-display font-semibold leading-[1.02] tracking-[-0.035em] text-ink mb-5"
            style={{
              fontSize: "clamp(40px, 12vw, 56px)",
              animationDelay: "80ms",
              textShadow:
                "0 1px 3px rgba(247,249,252,0.95), 0 0 14px rgba(247,249,252,0.75)",
            }}
          >
            Türkiye&apos;nin <em>yetenek</em> sahnesi.
          </p>

          <p
            className="kashe-rise font-body font-medium text-[16px] leading-[1.55] max-w-[42ch]"
            style={{
              color: "var(--color-ink)",
              animationDelay: "160ms",
              textShadow:
                "0 1px 3px rgba(247,249,252,0.95), 0 0 14px rgba(247,249,252,0.75)",
            }}
          >
            Düğün, kurumsal etkinlik ya da özel bir kutlama. Türkiye&apos;nin en
            yetenekli profesyonelleri, ekipleri ve organizasyon firmaları —
            şeffaf fiyatla, tek platformda.
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
          <HeroAiSearch />
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
                className="font-body text-[13px] text-ink-50 hover:text-brand-ink transition-colors underline-offset-4 hover:underline"
              >
                {link.label}
              </a>
            );
          })}
        </div>

        {/* İstatistikler — değeri olmayan sayaç basılmaz */}
        {sayaclar.length > 0 && (
          <div className="kashe-rise flex items-center justify-center gap-6 mt-7 pt-6 border-t border-line w-full max-w-[420px]">
            {sayaclar.map((s, i) => (
              <div key={s.key} className="flex items-center gap-6">
                {i > 0 && <div className="w-px h-7 bg-line shrink-0" />}
                <div className="text-center">
                  <StatCounter
                    value={s.value}
                    className="font-display font-semibold text-[24px] text-ink leading-none block"
                  />
                  <small className="font-body text-[10px] text-ink-50 mt-1.5 block uppercase tracking-[0.08em]">
                    {s.label}
                  </small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
