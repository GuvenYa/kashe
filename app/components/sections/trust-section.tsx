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
    description:
      "iyzico altyapısıyla PCI-DSS uyumlu kart bilgileri korunur.",
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

export function TrustSection() {
  return (
    <section className="bg-paper border-t border-line">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-24">
        {/* Section header */}
        <div className="mb-12 md:mb-16 max-w-2xl">
          <Eyebrow variant="inline" className="mb-4">
            Güvenliğin bizim için önemli
          </Eyebrow>
          <h2 className="font-display font-light text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-ink">
            Her aşamada <em>güvende</em> ol.
          </h2>
        </div>

        {/* Trust grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-card border border-line p-6 md:p-7"
              >
                <div className="w-10 h-10 bg-terracotta-08 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-terracotta" strokeWidth={1.5} />
                </div>
                <h3 className="font-display font-medium text-lg text-ink mb-2 leading-tight">
                  {item.title}
                </h3>
                <p className="text-sm text-ink-72 leading-[1.55]">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}