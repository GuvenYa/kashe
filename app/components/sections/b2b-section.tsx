import { Button } from "@/app/components/ui/button";

type Feature = {
  number: string;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    number: "1",
    title: "Şirket adıyla ilan.",
    description: "Kurumsal kimliğinle iş ilanı aç, doğru profesyonellere ulaş.",
  },
  {
    number: "2",
    title: "Tek brief, çok teklif.",
    description: "Aynı brief'i çok sayıda profesyonele ilet, teklifleri topla.",
  },
  {
    number: "3",
    title: "Doğrudan iletişim.",
    description: "Profesyonellerle mesajlaş, tekliflerini tek yerden değerlendir.",
  },
];

export function B2BSection() {
  return (
    <section
      id="kurumsal"
      className="dark-section bg-ink"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-brand-accent">
                <span className="w-6 h-px bg-brand-accent inline-block"></span>
                Kurumsal müşteriler için
              </span>
            </div>

            <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-paper mb-6">
              Kurumsal etkinlikler için{" "}
              <span className="text-brand-accent">tek panel.</span>
            </h2>

            <p className="text-lg text-paper-72 leading-[1.55] mb-10 max-w-xl">
              Otel, fuar şirketi veya kurumsal etkinlik ekibi misiniz? Şirket
              adınızla iş ilanı açın, tek brief ile çok sayıda profesyonelden
              teklif toplayın.
            </p>

            <div className="space-y-5 mb-10">
              {features.map((feat) => (
                <div key={feat.number} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full border border-brand-accent text-brand-accent flex items-center justify-center font-mono text-xs">
                    {feat.number}
                  </div>
                  <div className="pt-1">
                    <p className="text-base text-paper leading-[1.5]">
                      <span className="font-medium">{feat.title}</span>{" "}
                      <span className="text-paper-72">{feat.description}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <a href="/uye-ol?rol=kurumsal">
              <Button variant="primary" size="lg">
                Kurumsal hesap aç →
              </Button>
            </a>
          </div>

          <div className="relative">
            <div className="bg-ink-2 border border-paper-14 rounded-2xl p-6 md:p-8">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-paper-14">
                <span className="font-display text-base text-paper">
                  İlan #4231 · Hilton İstanbul
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-sky px-2 py-1 bg-sky/12">
                  Aktif
                </span>
              </div>

              <div className="space-y-4">
                <MockupRow label="Etkinlik" value="Yıllık iftar daveti" />
                <MockupRow label="Tarih" value="22 Mart 2026" />
                <MockupRow label="Aranan" value="8 hostes · 1 sunucu" />
                <MockupRow label="Teklif istenen" value="18 profesyonel" />
                <div className="pt-2">
                  <MockupRow label="Bütçe" value="28.000 ₺" highlight />
                </div>
              </div>
            </div>

            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-50 text-center">
              ↑ Örnek bir kurumsal ilan kartı
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MockupRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-50">
        {label}
      </span>
      <span
        className={`text-right ${
          highlight
            ? "font-display italic text-2xl text-brand-accent"
            : "text-paper font-medium text-base"
        }`}
      >
        {value}
      </span>
    </div>
  );
}