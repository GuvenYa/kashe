import { Eyebrow } from "@/app/components/ui/eyebrow";
import {
  ShieldCheck,
  CreditCard,
  FileCheck2,
  HeadphonesIcon,
  type LucideIcon,
} from "lucide-react";

type TrustItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const trustItems: TrustItem[] = [
  {
    icon: ShieldCheck,
    title: "Kimlik doğrulama",
    description:
      "Tüm profesyoneller e-Devlet üzerinden doğrulanır, sahte profil yok.",
  },
  {
    icon: CreditCard,
    title: "Güvenli ödeme",
    description: "iyzico altyapısıyla PCI-DSS uyumlu kart bilgileri korunur.",
  },
  {
    icon: FileCheck2,
    title: "Sözleşme & koruma",
    description:
      "Rezervasyon platform güvencesi altında, iş bitince ödeme transferi.",
  },
  {
    icon: HeadphonesIcon,
    title: "7/24 destek",
    description:
      "Her adımda yanındayız. Sorularınız için bize her zaman yazabilirsiniz.",
  },
];

// İkon zemin/ön plan renkleri — DESIGN.md §1 çok renkli sistem, categories ile tutarlı.
const TONES = [
  { iconBg: "#EAF0F8", iconFg: "#040D26", cardHover: "rgba(4,13,38,0.06)"    }, // zümrüt
  { iconBg: "#FCEAE4", iconFg: "#FA0B96", cardHover: "rgba(250,11,150,0.06)"  }, // mercan
  { iconBg: "#E2EEFB", iconFg: "#2D6FB8", cardHover: "rgba(45,111,184,0.06)"  }, // mavi
  { iconBg: "#FFF1DC", iconFg: "#B5851F", cardHover: "rgba(181,133,31,0.06)"  }, // altın
];

export function TrustSection() {
  return (
    <section className="bg-paper border-t border-line">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-24">
        {/* Section header */}
        <div className="mb-12 md:mb-16 max-w-2xl">
          <Eyebrow variant="inline" className="mb-4">
            Güvenliğin bizim için önemli
          </Eyebrow>
          <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-ink">
            Her aşamada <em>güvende</em> ol.
          </h2>
        </div>

        {/* Trust grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {trustItems.map((item, i) => {
            const Icon = item.icon;
            const tone = TONES[i % TONES.length];
            return (
              <div
                key={item.title}
                className="group relative bg-card border border-line rounded-2xl p-6 md:p-7 transition-all duration-300 hover:border-terracotta hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgba(26,18,14,0.22)] overflow-hidden"
              >
                {/* Hover renk yıkaması */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: tone.cardHover }}
                  aria-hidden="true"
                />
                <div className="relative">
                  {/* İkon — renk rotasyonlu zemin */}
                  <div
                    className="w-16 h-16 flex items-center justify-center mb-5 rounded-xl transition-transform duration-300 group-hover:scale-105"
                    style={{ background: tone.iconBg }}
                  >
                    <Icon
                      className="w-7 h-7"
                      strokeWidth={1.5}
                      style={{ color: tone.iconFg }}
                    />
                  </div>
                  <h3 className="font-display font-medium text-lg text-ink mb-2 leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm text-ink-72 leading-[1.55]">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
