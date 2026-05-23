export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full bg-ink text-paper">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <a href="/" className="flex items-center gap-2.5 mb-4">
              <span className="w-8 h-8 bg-terracotta flex items-center justify-center text-paper font-display font-semibold italic text-xl leading-none">
                k
              </span>
              <span className="font-display font-semibold text-2xl text-paper tracking-tight">
                Kashe
              </span>
            </a>
            <p className="text-paper/70 max-w-xs leading-relaxed">
              Türkiye&apos;nin etkinlik pazaryeri. Doğru profesyoneli ajanssız, şeffaf fiyatla bul.
            </p>
          </div>

          {/* Keşfet linkleri */}
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-paper/50 mb-4">
              Keşfet
            </p>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="/kesfet" className="text-paper/80 hover:text-paper transition-colors">
                  Tüm profesyoneller
                </a>
              </li>
              <li>
                <a href="/kesfet?kategori=1" className="text-paper/80 hover:text-paper transition-colors">
                  DJ&apos;ler
                </a>
              </li>
              <li>
                <a href="/kesfet?kategori=6" className="text-paper/80 hover:text-paper transition-colors">
                  Fotoğrafçılar
                </a>
              </li>
              <li>
                <a href="/kesfet?kategori=4" className="text-paper/80 hover:text-paper transition-colors">
                  Sunucular
                </a>
              </li>
            </ul>
          </div>

          {/* Kurumsal linkleri */}
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-paper/50 mb-4">
              Kurumsal
            </p>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="/#hakkimizda" className="text-paper/80 hover:text-paper transition-colors">
                  Hakkımızda
                </a>
              </li>
              <li>
                <a href="/#nasil-calisir" className="text-paper/80 hover:text-paper transition-colors">
                  Nasıl çalışır
                </a>
              </li>
              <li>
                <a href="/uye-ol" className="text-paper/80 hover:text-paper transition-colors">
                  Profesyonel ol
                </a>
              </li>
              <li>
                <a href="mailto:info@kashe.app" className="text-paper/80 hover:text-paper transition-colors">
                  İletişim
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-paper/15 mt-12 pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm text-paper/50">
          <p>© {year} Kashe. Tüm hakları saklıdır.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-paper transition-colors">
              Gizlilik
            </a>
            <a href="#" className="hover:text-paper transition-colors">
              Kullanım koşulları
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}