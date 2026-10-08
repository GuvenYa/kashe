import { Button } from "@/app/components/ui/button";
import { OrnekRozeti } from "@/app/components/ui/ornek-rozeti";

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
      className="bg-paper-2"
    >
      {/* T6: md kiriliminda bolum dolgusu kisaldi (py-28 → py-20); lg'de eski
          comert bosluk korunur. Ust uste binen py-28'ler 807 px'te ~220 px bos
          bant birakiyordu. */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-brand-accent">
                <span className="w-6 h-px bg-brand-accent inline-block"></span>
                Kurumsal müşteriler için
              </span>
            </div>

            <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-brand-ink mb-6">
              Kurumsal etkinlikler için{" "}
              <span className="text-brand-accent">tek panel.</span>
            </h2>

            <p className="text-lg text-ink-72 leading-[1.55] mb-10 max-w-xl">
              Lansman, konferans, bayi toplantısı, gala, fuar ya da marka
              etkinliği düzenleyen pazarlama, kurumsal iletişim, insan kaynakları
              ve satın alma ekipleri için. Şirket adınızla ilan açın, tek brief
              ile çok sayıda profesyonelden teklif toplayın, süreci ekipçe
              yönetin.
            </p>

            <div className="space-y-5 mb-10">
              {features.map((feat, i) => (
                <div key={feat.number} className="flex gap-4 items-start">
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center font-mono text-xs ${
                      i === 1
                        ? "border-brand-accent text-brand-accent"
                        : "border-sky text-sky"
                    }`}
                  >
                    {feat.number}
                  </div>
                  <div className="pt-1">
                    <p className="text-base text-brand-ink leading-[1.5]">
                      <span className="font-medium">{feat.title}</span>{" "}
                      <span className="text-ink-72">{feat.description}</span>
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
              <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-paper-14">
                <span className="font-display text-base text-paper">
                  İlan · Yıllık bayi toplantısı
                </span>
                <OrnekRozeti ton="koyu" />
              </div>

              <div className="space-y-4">
                <MockupRow label="Tarih" value="14 Mayıs 2027" />
                <MockupRow label="Aranan" value="6 hostes · 1 sunucu · 1 DJ" />
                <MockupRow label="Teklif istenen" value="18 profesyonel" />
                <div className="pt-2">
                  <MockupRow label="Bütçe" value="28.000 ₺" highlight />
                </div>
              </div>
            </div>
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
    <div className="flex items-center justify-between gap-4">
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
