import { Eyebrow } from "@/app/components/ui/eyebrow";

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  city: string;
  tone: { bg: string; fg: string };
};

const TONES = {
  terracotta: { bg: "rgba(200,68,42,0.10)", fg: "#C8442A" },
  plum: { bg: "rgba(107,46,92,0.10)", fg: "#6B2E5C" },
  moss: { bg: "rgba(63,107,71,0.10)", fg: "#3F6B47" },
};

// NOT: Bu yorumlar şu an temsilidir — gerçek müşteri/profesyonel
// yorumları toplandığında değiştirilecek.
const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Düğünüm için fotoğrafçı ararken birkaç farklı platforma baktım. Kashe'de birkaç saatte istediğim tarzda biriyle anlaşmıştım. Aracı yok, fiyat baştan belli.",
    name: "Selin A.",
    role: "Müşteri",
    city: "İstanbul",
    tone: TONES.terracotta,
  },
  {
    quote:
      "Daha önce sosyal medyadan iş alıyordum, çoğu zaman fiyat pazarlığında günler geçiyordu. Kashe'de profilim hazır, brief'i okuyup teklif veriyorum. Süreç çok daha temiz.",
    name: "Mert K.",
    role: "DJ",
    city: "Ankara",
    tone: TONES.plum,
  },
  {
    quote:
      "Yıllık iftar organizasyonu için bir günde 12 profesyonelden teklif aldım. Kurumsal tarafın gerçek anlamda işine yarayan, düşünülmüş bir platform.",
    name: "Ayşe T.",
    role: "Etkinlik Yöneticisi",
    city: "İzmir",
    tone: TONES.moss,
  },
];

function StarRow() {
  return (
    <div className="flex gap-0.5 mb-4" aria-label="5 yıldız">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="var(--color-terracotta)"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="bg-paper border-t border-line">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-24">
        {/* Header */}
        <div className="mb-12 md:mb-16 max-w-2xl">
          <Eyebrow variant="inline" className="mb-4">
            Kashe deneyimi
          </Eyebrow>
          <h2 className="font-display font-light text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-[-0.03em] text-ink">
            Kullanıcılar <em>ne diyor?</em>
          </h2>
        </div>

        {/* Yorum kartları */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {TESTIMONIALS.map((t) => {
            const initials = t.name
              .split(" ")
              .map((s) => s[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <div
                key={t.name}
                className="group bg-card border border-line rounded-2xl p-6 md:p-7 transition-all duration-300 hover:border-terracotta hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgba(26,18,14,0.22)] flex flex-col"
              >
                <StarRow />

                {/* Alıntı */}
                <blockquote className="font-display text-lg leading-[1.5] text-ink mb-6 flex-1">
                  <span
                    aria-hidden="true"
                    className="font-display italic text-3xl leading-none text-terracotta mr-1 align-top"
                  >
                    “
                  </span>
                  {t.quote}
                </blockquote>

                {/* Yazar */}
                <div className="flex items-center gap-3 pt-5 border-t border-line">
                  <span
                    className="w-10 h-10 rounded-full flex items-center justify-center font-display font-semibold text-sm shrink-0"
                    style={{ background: t.tone.bg, color: t.tone.fg }}
                  >
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-sm text-ink truncate">
                      {t.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 truncate">
                      {t.role} · {t.city}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
