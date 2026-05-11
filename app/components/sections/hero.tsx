import { Eyebrow } from "@/app/components/ui/eyebrow";
import { WaitlistForm } from "@/app/components/sections/waitlist-form";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-paper">
      {/* Atmosferik terracotta glow — sağ üst */}
      <div
        aria-hidden
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(200, 68, 42, 0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-32">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <div className="mb-8">
            <Eyebrow variant="pill">
              Türkiye'nin etkinlik pazaryeri · Erken erişim
            </Eyebrow>
          </div>

          {/* Hero headline */}
          <h1 className="font-display font-light text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-[-0.04em] text-ink mb-8">
            Doğru kişiye
            <br />
            <em>direkt</em> ulaş.
          </h1>

          {/* Lede */}
          <p className="text-lg md:text-xl text-ink-72 leading-[1.55] mb-10 max-w-2xl">
            Hostes, DJ, fotoğrafçı, sunucu, müzisyen, oyuncu. Türkiye'de etkinlik
            ve yetenek hizmetlerini ajanssız, şeffaf fiyatla ve güvenli ödeme ile
            buluşturuyoruz.
          </p>

          {/* Waitlist form */}
          <WaitlistForm />

          {/* Lansman teaser */}
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
            → İlk 500 kayıt için lansman gününde %50 komisyon indirimi
          </p>
        </div>
      </div>
    </section>
  );
}