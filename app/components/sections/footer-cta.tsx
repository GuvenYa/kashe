export function FooterCTA() {
  return (
    /* Dış bölüm: bg-paper, içinde rounded-3xl zümrüt gradyan kart */
    <section className="bg-paper py-14 md:py-20">
      <div className="max-w-7xl mx-auto px-6 md:px-9">
        <div
          className="rounded-3xl text-center px-8 md:px-16 lg:px-24 py-16 md:py-20"
          style={{ background: "var(--gradient-brand)" }}
        >
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 mb-8">
            <span className="inline-block h-px w-6 shrink-0 bg-white/30" />
            <span className="font-body font-semibold text-[11px] uppercase tracking-[0.2em] text-white/60">
              Hemen başla
            </span>
            <span className="inline-block h-px w-6 shrink-0 bg-white/30" />
          </div>

          {/* Başlık — <span className="text-brand-accent"> kullan, em (zümrüt) koyu zeminde görünmez */}
          <h2 className="font-display font-semibold text-4xl md:text-6xl lg:text-7xl leading-[0.95] tracking-[-0.04em] text-white mb-6 max-w-3xl mx-auto">
            Profilini{" "}
            <span className="text-brand-accent">aç</span>
            , çalışmaya başla.
          </h2>

          {/* Alt metin */}
          <p className="font-body text-lg md:text-xl text-white/65 leading-[1.55] mb-10 max-w-xl mx-auto">
            Ücretsiz hesap aç, profilini oluştur, hizmet ver ya da ihtiyacın
            olan profesyoneli bul. Lansman döneminde komisyonsuz; sonrasında
            yalnız tamamlanan işten.
          </p>

          {/* CTA butonları */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="/uye-ol?rol=profesyonel"
              className="inline-flex items-center gap-2 bg-white text-ink font-display font-semibold rounded-lg px-8 py-3.5 text-base hover:bg-paper transition-colors"
            >
              Hizmet ver →
            </a>
            <a
              href="/uye-ol?rol=musteri"
              className="inline-flex items-center gap-2 font-body text-white/75 hover:text-white text-base underline-offset-4 hover:underline transition-colors px-4 py-3.5"
            >
              Hizmet ara
            </a>
          </div>

          {/* Trust line */}
          <p className="mt-10 font-body text-[11px] uppercase tracking-[0.18em] text-white/35">
            Ücretsiz kayıt · KVKK uyumlu · İstediğin zaman çıkış
          </p>
        </div>
      </div>
    </section>
  );
}
