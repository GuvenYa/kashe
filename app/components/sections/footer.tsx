import Link from "next/link";
import { KasheMark } from "@/app/components/ui/kashe-mark";
import { KasheWordmark } from "@/app/components/ui/kashe-wordmark";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full bg-ink text-paper">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" prefetch={false} className="flex items-center gap-2.5 mb-4">
              <KasheMark variant="dark" className="w-8 h-8" title="" />
              <KasheWordmark variant="dark" className="h-4" />
            </Link>
            <p className="text-paper/70 max-w-xs leading-relaxed">
              Türkiye&apos;nin yetenek sahnesi. Etkinliğin için doğru profesyonel,
              ekip ve organizasyon firması — tek yerde.
            </p>
            <p className="text-paper/50 text-sm mt-3">İstanbul, Türkiye</p>
          </div>

          {/* Keşfet linkleri */}
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-paper/50 mb-4">
              Keşfet
            </p>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/kesfet" prefetch={false} className="text-paper/80 hover:text-paper transition-colors">
                  Tüm profesyoneller
                </Link>
              </li>
              <li>
                <Link href="/kesfet?kategori=1" prefetch={false} className="text-paper/80 hover:text-paper transition-colors">
                  DJ&apos;ler
                </Link>
              </li>
              <li>
                <Link href="/kesfet?kategori=6" prefetch={false} className="text-paper/80 hover:text-paper transition-colors">
                  Fotoğrafçılar
                </Link>
              </li>
              <li>
                <Link href="/kesfet?kategori=4" prefetch={false} className="text-paper/80 hover:text-paper transition-colors">
                  Sunucular
                </Link>
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
                <Link href="/hakkimizda" prefetch={false} className="text-paper/80 hover:text-paper transition-colors">
                  Hakkımızda
                </Link>
              </li>
              <li>
                <Link href="/hakkimizda#kurumsal" prefetch={false} className="text-paper/80 hover:text-paper transition-colors">
                  Kurumsal müşteriler
                </Link>
              </li>
              <li>
                <Link href="/#ajanslar" prefetch={false} className="text-paper/80 hover:text-paper transition-colors">
                  Kurumsal hizmet sağlayıcılar
                </Link>
              </li>
              <li>
                <Link href="/hakkimizda#ajanslar" prefetch={false} className="text-paper/80 hover:text-paper transition-colors">
                  Kurumsal hizmet sağlayıcılar için
                </Link>
              </li>
              <li>
                <Link href="/#nasil-calisir" prefetch={false} className="text-paper/80 hover:text-paper transition-colors">
                  Nasıl çalışır
                </Link>
              </li>
              <li>
                <Link href="/#profesyoneller" prefetch={false} className="text-paper/80 hover:text-paper transition-colors">
                  Profesyoneller için
                </Link>
              </li>
              <li>
                <Link href="/fiyatlandirma" prefetch={false} className="text-paper/80 hover:text-paper transition-colors">
                  Fiyatlandırma
                </Link>
              </li>
              <li>
                <Link href="/yardim" prefetch={false} className="text-paper/80 hover:text-paper transition-colors">
                  Yardım
                </Link>
                </li>
              <li>
                <a href="mailto:info@kashe.net" className="text-paper/80 hover:text-paper transition-colors">
                  İletişim
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-paper/15 mt-12 pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm text-paper/50">
          <p>© {year} Kashe. Tüm hakları saklıdır.</p>
          <div className="flex items-center gap-6">
            <Link href="/gizlilik" prefetch={false} className="hover:text-paper transition-colors">
              Gizlilik
            </Link>
            <Link href="/kvkk" prefetch={false} className="hover:text-paper transition-colors">
              KVKK
            </Link>
            <Link href="/kullanim-kosullari" prefetch={false} className="hover:text-paper transition-colors">
              Kullanım koşulları
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}