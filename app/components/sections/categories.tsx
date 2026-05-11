import { Eyebrow } from "@/app/components/ui/eyebrow";
import {
  Music,
  Camera,
  Film,
  Disc,
  Mic2,
  Users,
  Wine,
  Smile,
  type LucideIcon,
} from "lucide-react";

type Category = {
  icon: LucideIcon;
  name: string;
  description: string;
};

const categories: Category[] = [
  { icon: Music, name: "Müzisyenler", description: "Solo, grup, orkestra ve daha fazlası" },
  { icon: Camera, name: "Fotoğrafçılar", description: "Düğün, doğum günü, etkinlik çekimi" },
  { icon: Film, name: "Oyuncular", description: "Tiyatro, reklam, film, dizi ve sahne" },
  { icon: Disc, name: "DJ'ler", description: "Profesyonel DJ, ekipman ve ışık" },
  { icon: Mic2, name: "Sunucular", description: "Etkinlik, organizasyon ve sunum" },
  { icon: Users, name: "Hostesler", description: "Karşılama, tanıtım, davet organizasyonu" },
  { icon: Wine, name: "Barmenler", description: "Profesyonel bar, kokteyl servisi" },
  { icon: Smile, name: "Palyaçolar", description: "Çocuk etkinlikleri, animasyon" },
];

export function Categories() {
  return (
    <section id="hizmetler" className="bg-paper border-t border-line">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-24">
        {/* Section header */}
        <div className="mb-12 md:mb-16 max-w-2xl">
          <Eyebrow variant="inline" className="mb-4">
            Popüler kategoriler
          </Eyebrow>
          <h2 className="font-display font-light text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-ink">
            Hangi <em>yeteneği</em> arıyorsun?
          </h2>
        </div>

        {/* Categories grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.name}
                className="group bg-card border border-line p-6 transition-all duration-200 hover:border-terracotta hover:-translate-y-0.5 cursor-pointer"
              >
                {/* Icon container */}
                <div className="w-12 h-12 bg-terracotta-08 flex items-center justify-center mb-5 transition-colors group-hover:bg-terracotta-12">
                  <Icon
                    className="w-6 h-6 text-terracotta"
                    strokeWidth={1.5}
                  />
                </div>

                {/* Title */}
                <h3 className="font-display font-medium text-xl text-ink mb-2 leading-tight">
                  {cat.name}
                </h3>

                {/* Description */}
                <p className="text-sm text-ink-72 leading-[1.5] mb-4">
                  {cat.description}
                </p>

                {/* Link */}
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  Keşfet →
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}