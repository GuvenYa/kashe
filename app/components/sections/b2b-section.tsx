import { Button } from "@/app/components/ui/button";
import { Eyebrow } from "@/app/components/ui/eyebrow";

type Feature = {
  number: string;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    number: "1",
    title: "Toplu iş ilanı.",
    description: "Tek seferde 5-50 profesyonele aynı brief'i ilet.",
  },
  {
    number: "2",
    title: "Çoklu kullanıcı erişimi.",
    description: "Ekibinden farklı kişiler aynı hesabı yönetir.",
  },
  {
    number: "3",
    title: "Konsolide fatura.",
    description: "Aylık tek fatura, vergi dahil; muhasebe için hazır.",
  },
  {
    number: "4",
    title: "Özel komisyon.",
    description: "Yıllık 100K+ TL hacim için %8'e kadar inen oranlar.",
  },
];

export function B2BSection() {
  return (
    <section
      id="kurumsal"
      className="dark-section bg-ink relative overflow-hidden"
    >
      {/* Atmosferik terracotta glow */}
      <div
        aria-hidden
        className="absolute top-1/4 -left-32 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(200, 68, 42, 0.18) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(107, 46, 92, 0.20) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Sol kolon — içerik */}
          <div>
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-terracotta">
                <span className="w-6 h-px bg-terracotta inline-block"></span>
                Kurumsal · Faz 1.5
              </span>
            </div>

            <h2 className="font-display font-light text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-paper mb-6">
              Kurumsal etkinlikler için <em>tek panel.</em>
            </h2>

            <p className="text-lg text-paper-72 leading-[1.55] mb-10 max-w-xl">
              Otel, fuar şirketi, etkinlik ajansı veya kurumsal pazarlama ekibi misin?
              İş ilanı oluştur, profesyonelleri toplu davet et, fatura yönetimini
              tek yerden yap.
            </p>

            <div className="space-y-5 mb-10">
              {features.map((feat) => (
                <div key={feat.number} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full border border-terracotta text-terracotta flex items-center justify-center font-mono text-xs">
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

            <Button variant="primary" size="lg">
              Kurumsal hesap aç →
            </Button>
          </div>

          {/* Sağ kolon — mockup */}
          <div className="relative">
            <div className="bg-ink-2 border border-paper-14 p-6 md:p-8">
              {/* Mockup üst bar */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-paper-14">
                <span className="font-display text-base text-paper">
                  İlan #4231 · Hilton İstanbul
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-terracotta px-2 py-1 bg-terracotta-12">
                  Aktif
                </span>
              </div>

              {/* Mockup satırları */}
              <div className="space-y-4">
                <MockupRow label="Etkinlik" value="Yıllık iftar daveti" />
                <MockupRow label="Tarih" value="22 Mart 2026" />
                <MockupRow label="Aranan" value="8 hostes · 1 sunucu" />
                <MockupRow label="Davet edilen" value="42 profesyonel" />
                <div className="pt-2">
                  <MockupRow label="Bütçe" value="28.000 ₺" highlight />
                </div>
              </div>
            </div>

            {/* Mockup altı: ince Vercel-style bilgi */}
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
            ? "font-display italic text-2xl text-terracotta"
            : "text-paper font-medium text-base"
        }`}
        style={
          highlight
            ? { fontVariationSettings: '"SOFT" 100' }
            : undefined
        }
      >
        {value}
      </span>
    </div>
  );
}