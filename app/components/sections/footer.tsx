const links = {
  product: [
    { label: "Hizmetler", href: "#hizmetler" },
    { label: "Nasıl çalışır", href: "#nasil-calisir" },
    { label: "Kurumsal", href: "#kurumsal" },
  ],
  legal: [
    { label: "Gizlilik politikası", href: "/gizlilik" },
    { label: "Kullanım koşulları", href: "/kosullar" },
    { label: "KVKK aydınlatma", href: "/kvkk" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-paper border-t border-line">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          <div>
            <a href="/" className="inline-flex items-center gap-2.5 mb-4">
              <span className="w-8 h-8 bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-xl leading-none">
                k
              </span>
              <span className="font-display font-semibold text-2xl text-ink tracking-tight">
                Kashe
              </span>
            </a>
            <p className="text-sm text-ink-72 leading-[1.55] max-w-xs">
              Türkiye'nin etkinlik ve yetenek pazaryeri. Doğru kişiye direkt, ajanssız.
            </p>
          </div>

          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.22em] text-terracotta mb-4">
              Ürün
            </h4>
            <ul className="space-y-3">
              {links.product.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-ink-72 hover:text-ink transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.22em] text-terracotta mb-4">
              Yasal
            </h4>
            <ul className="space-y-3">
              {links.legal.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-ink-72 hover:text-ink transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-line flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="font-mono text-[11px] text-ink-50">
            © 2026 Kashe. Tüm hakları saklıdır.
          </p>
          <p className="font-mono text-[11px] text-ink-50">
            Türkiye'de tasarlandı ve geliştirildi.
          </p>
        </div>
      </div>
    </footer>
  );
}