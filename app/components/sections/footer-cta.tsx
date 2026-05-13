import { Eyebrow } from "@/app/components/ui/eyebrow";
import { Button } from "@/app/components/ui/button";

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
            <Eyebrow variant="pill">Hemen başla</Eyebrow>
          </div>

          {/* Headline */}
          <h2 className="font-display font-light text-4xl md:text-6xl lg:text-7xl leading-[0.95] tracking-[-0.04em] text-ink mb-8">
            Profilini <em>aç</em>, çalışmaya başla.
          </h2>

          {/* Subhead */}
          <p className="text-lg md:text-xl text-ink-72 leading-[1.55] mb-10 max-w-2xl mx-auto">
            Ücretsiz hesap aç, kendi profilini oluştur, hizmet ver ya da ihtiyacın
            olan profesyoneli bul. Komisyon sadece iş tamamlanınca.
          </p>

          {/* İki CTA buton */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/uye-ol?rol=profesyonel">
              <Button variant="primary" size="lg">
                Hizmet ver →
              </Button>
            </a>
            <a href="/uye-ol?rol=musteri">
              <Button variant="secondary" size="lg">
                Hizmet ara
              </Button>
            </a>
          </div>

          {/* Trust line */}
          <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50">
            Ücretsiz kayıt · KVKK uyumlu · İstediğin zaman çıkış
          </p>
        </div>
      </div>
    </section>
  );
}