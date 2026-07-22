import { Reveal } from "./reveal";

type Step = {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    number: "01",
    eyebrow: "İhtiyacını belirle",
    title: "Ne, ne zaman, nerede?",
    description:
      "Etkinliğin türünü, tarihini ve ihtiyacın olan hizmeti yaz. 60 saniye sürer.",
  },
  {
    number: "02",
    eyebrow: "Profesyonelleri keşfet",
    title: "Filtrele ve karşılaştır.",
    description:
      "Doğrulanmış profilleri inceleyebilir, portföylerine bakabilir, fiyatları karşılaştırabilirsin.",
  },
  {
    number: "03",
    eyebrow: "Rezervasyon yap",
    title: "Uygun olanı seç, onayla.",
    description:
      "Mesajlaş, detayları konuş, sözleşmeyi onayla. Hepsi platform içinde.",
  },
];

export function HowItWorks() {
  return (
    /* Dış bölüm: sayfa zemini bg-paper, içinde koyu zümrüt kart */
    <section id="nasil-calisir" className="bg-paper py-14 md:py-20">
      <div className="max-w-7xl mx-auto px-6 md:px-9">
        {/* Koyu zümrüt yuvarlak bölüm — DESIGN.md §4 "Nasıl çalışır" */}
        <div
          className="rounded-3xl px-8 md:px-14 lg:px-20 pt-14 md:pt-18 pb-14 md:pb-18"
          style={{ background: "var(--color-brand-ink-deep)" }}
        >
          {/* Section header */}
          <div className="mb-12 md:mb-16 max-w-2xl">
            {/* Eyebrow — ince çizgi + etiket, beyaz üzeri */}
            <div className="inline-flex items-center gap-2.5 mb-6">
              <span className="inline-block h-px w-6 shrink-0 bg-white/30" />
              <span className="font-body font-semibold text-[11px] uppercase tracking-[0.2em] text-white/60">
                Nasıl çalışır
              </span>
            </div>

            <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-[56px] leading-[1.0] tracking-[-0.03em] text-white mb-5">
              3 adımda{" "}
              <span className="text-brand-accent">doğru kişiye</span>{" "}
              ulaş.
            </h2>
            <p className="font-body text-lg text-white/60 leading-[1.6]">
              İhtiyacını yaz, teklif al, güvenle öde. Bütün süreç ortalama 48 saat.
            </p>
          </div>

          {/* Adımlar grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-t border-white/10">
            {steps.map((step, index) => (
              <Reveal
                key={step.number}
                delay={index * 180}
                className={[
                  "pt-10 pb-8",
                  index < steps.length - 1
                    ? "md:pr-10 md:border-r border-white/10 border-b md:border-b-0"
                    : "",
                  index > 0 ? "md:pl-10" : "",
                ].join(" ")}
              >
                {/* Mercan sayı + çizgi + eyebrow */}
                <div className="flex items-baseline gap-3 mb-6 font-body text-[11px] uppercase tracking-[0.18em]">
                  <span className="text-brand-accent font-semibold text-base">{step.number}</span>
                  <span className="w-3 h-px bg-brand-accent inline-block" />
                  <span className="text-white/50">{step.eyebrow}</span>
                </div>

                {/* Başlık */}
                <h3 className="font-display font-semibold text-2xl md:text-[26px] text-white mb-3 leading-tight tracking-[-0.02em]">
                  {step.title}
                </h3>

                {/* Açıklama */}
                <p className="font-body text-base text-white/60 leading-[1.6]">
                  {step.description}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
