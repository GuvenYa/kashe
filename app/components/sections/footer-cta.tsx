import { Eyebrow } from "@/app/components/ui/eyebrow";
import { WaitlistForm } from "@/app/components/sections/waitlist-form";

export function FooterCTA() {
  return (
    <section className="relative overflow-hidden bg-paper-2 border-t border-line">
      {/* Atmosferik terracotta glow — sağ orta */}
      <div
        aria-hidden
        className="absolute top-1/4 -right-32 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(200, 68, 42, 0.10) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-0 -left-32 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(107, 46, 92, 0.08) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32">
        <div className="max-w-3xl mx-auto text-center">
          {/* Eyebrow */}
          <div className="mb-8 flex justify-center">
            <Eyebrow variant="pill">Lansman · Ekim 2026</Eyebrow>
          </div>

          {/* Headline */}
          <h2 className="font-display font-light text-4xl md:text-6xl lg:text-7xl leading-[0.95] tracking-[-0.04em] text-ink mb-8">
            Listede <em>yerini</em> ayır.
          </h2>

          {/* Subhead */}
          <p className="text-lg md:text-xl text-ink-72 leading-[1.55] mb-10 max-w-2xl mx-auto">
            Lansman gününde haber vereceğiz. İlk 500 kayıt için %50 komisyon
            indirimi, ömür boyu geçerli.
          </p>

          {/* Waitlist form */}
          <div className="flex justify-center">
            <div className="w-full max-w-xl">
              <WaitlistForm />
            </div>
          </div>

          {/* Trust line */}
          <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50">
            Spam yok · İstediğin zaman çıkış · KVKK uyumlu
          </p>
        </div>
      </div>
    </section>
  );
}