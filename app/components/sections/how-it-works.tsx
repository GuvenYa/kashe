import { Eyebrow } from "@/app/components/ui/eyebrow";
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
    <section id="nasil-calisir" className="bg-paper border-t border-line">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-24">
        {/* Section header */}
        <div className="mb-12 md:mb-16 max-w-2xl">
          <Eyebrow variant="inline" className="mb-4">
            Nasıl çalışır
          </Eyebrow>
          <h2 className="font-display font-light text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-ink mb-6">
            3 adımda <em>doğru kişiye</em> ulaş.
          </h2>
          <p className="text-lg text-ink-72 leading-[1.55]">
            İhtiyacını yaz, teklif al, güvenle öde. Bütün süreç ortalama 48 saat.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-t border-line">
          {steps.map((step, index) => (
            <Reveal
              key={step.number}
              delay={index * 180}
              className={`p-8 md:p-10 ${
                index < steps.length - 1 ? "md:border-r border-line" : ""
              } ${index < steps.length - 1 ? "border-b md:border-b-0 border-line" : ""}`}
            >
              {/* Number + eyebrow */}
              <div className="flex items-baseline gap-3 mb-6 font-mono text-[11px] uppercase tracking-[0.18em]">
                <span className="text-terracotta font-semibold">{step.number}</span>
                <span className="w-3 h-px bg-terracotta inline-block"></span>
                <span className="text-terracotta">{step.eyebrow}</span>
              </div>

              {/* Title */}
              <h3 className="font-display font-normal text-2xl md:text-3xl text-ink mb-3 leading-tight tracking-[-0.02em]">
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-base text-ink-72 leading-[1.55]">
                {step.description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}