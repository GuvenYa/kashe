import { Eyebrow } from "@/app/components/ui/eyebrow";
import { Button } from "@/app/components/ui/button";
import { getCategoryIcon } from "@/app/lib/category-icon";

type Promise = {
  number: string;
  title: string;
  description: string;
};

const PROMISES: Promise[] = [
  {
    number: "1",
    title: "Komisyonsuz başlangıç.",
    description:
      "Lansman döneminde komisyon yok; sonrasında yalnız tamamlanan işten alınır.",
  },
  {
    number: "2",
    title: "Aracısız iletişim.",
    description:
      "Müşteriyle doğrudan konuş. Ajans kesintisi, aracı pazarlığı yok.",
  },
  {
    number: "3",
    title: "Profil senindir, taşınır.",
    description:
      "Yorumların, portfolyon, çalışma geçmişin — hepsi senin, hep yanında.",
  },
];

export function ProCtaSection() {
  const fotograf = getCategoryIcon("fotografci");

  return (
    <section className="relative overflow-hidden bg-paper-2 border-t border-line">
      {/* Atmosferik glow — Hero/FooterCTA diliyle */}
      <div
        aria-hidden
        className="absolute top-0 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(63, 107, 71, 0.10) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(200, 68, 42, 0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* SOL — metin */}
          <div>
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-brand-ink">
                <span className="w-6 h-px bg-brand-ink inline-block"></span>
                Profesyoneller için
              </span>
            </div>

            <h2 className="font-display font-light text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-ink mb-6">
              Yeteneğin <em>vitrini</em> burada.
            </h2>

            <p className="text-lg text-ink-72 leading-[1.55] mb-10 max-w-xl">
              DJ, fotoğrafçı, sunucu, müzisyen, hostes ya da organizasyon —
              profilini aç, portfolyonu yükle, sana doğrudan ulaşılsın.
              Aracısız, şeffaf, kontrol sende.
            </p>

            <div className="space-y-5 mb-10">
              {PROMISES.map((p) => (
                <div key={p.number} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full border border-brand-ink text-brand-ink flex items-center justify-center font-mono text-xs">
                    {p.number}
                  </div>
                  <div className="pt-1">
                    <p className="text-base text-ink leading-[1.5]">
                      <span className="font-medium">{p.title}</span>{" "}
                      <span className="text-ink-72">{p.description}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href="/uye-ol?rol=profesyonel">
                <Button variant="primary" size="lg">
                  Profilini aç →
                </Button>
              </a>
              <a href="/#nasil-calisir">
                <Button variant="secondary" size="lg">
                  Nasıl çalışır?
                </Button>
              </a>
            </div>
          </div>

          {/* SAĞ — örnek profil kartı (hero kartları diliyle) */}
          <div className="relative">
            <div className="bg-card border border-line rounded-2xl shadow-[0_24px_60px_-16px_rgba(26,18,14,0.22)] overflow-hidden max-w-sm mx-auto">
              {/* Üst — renkli ikon zemini */}
              <div
                className="h-32 flex items-center justify-center"
                style={{ background: "rgba(200,68,42,0.12)" }}
              >
                {fotograf ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={fotograf}
                    alt=""
                    className="w-20 h-20 object-contain"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="font-display text-4xl text-brand-ink">A</span>
                )}
              </div>

              {/* Alt — bilgi */}
              <div className="p-6">
                <p className="font-display font-semibold text-xl text-ink leading-tight">
                  Aslı Yılmaz
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mt-1.5">
                  Fotoğrafçı · İstanbul
                </p>

                <p className="text-sm text-ink-72 leading-relaxed mt-4 line-clamp-2">
                  10 yıllık deneyim, düğün ve etkinlik fotoğrafçılığında uzman.
                  Sade ve doğal kareler.
                </p>

                <div className="flex flex-wrap gap-1.5 mt-4">
                  {["Düğün", "Doğal ışık", "Belgesel tarz"].map((tag) => (
                    <span
                      key={tag}
                      className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-72 bg-paper border border-line px-2 py-1 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-5 pt-5 border-t border-line flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <svg
                      width="13" height="13" viewBox="0 0 24 24"
                      fill="var(--color-brand-accent)" stroke="var(--color-brand-accent)"
                      strokeWidth="1.5" strokeLinejoin="round"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                    </svg>
                    <span className="font-display font-semibold text-sm text-ink">5.0</span>
                    <span className="text-xs text-ink-50">(24)</span>
                  </div>
                  <span className="font-display font-semibold text-sm text-ink">
                    ₺4.200<span className="text-ink-50 font-normal">'den</span>
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50 text-center">
              ↑ Profilin müşteriye böyle görünür
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
