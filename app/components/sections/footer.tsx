import Link from "next/link";
import { KasheMark } from "@/app/components/ui/kashe-mark";
import { KasheWordmark } from "@/app/components/ui/kashe-wordmark";
import { HAKKINDA_LINKS } from "@/app/lib/nav-links";

const LINK_CLASS = "text-paper/80 hover:text-paper transition-colors";

type AltLink = { href: string; label: string; mail?: boolean };

/**
 * Alt bilgi sutunu — baslik + baglanti listesi.
 *
 * Duzeltme 11-A4: sutun sayisi ikiden uce cikti (Kesfet, Kurumsal, Kashe
 * hakkinda) ve ayni `<li><Link>` blogu 19 kez tekrarlanacakti; tek yerde.
 */
function Sutun({ baslik, linkler }: { baslik: string; linkler: AltLink[] }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-paper/50 mb-4">
        {baslik}
      </p>
      <ul className="space-y-3 text-sm">
        {linkler.map((l) => (
          <li key={l.href}>
            {l.mail ? (
              <a href={l.href} className={LINK_CLASS}>
                {l.label}
              </a>
            ) : (
              <Link href={l.href} prefetch={false} className={LINK_CLASS}>
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Kesfet sutunu — Duzeltme 11-A4 (bulgu 73).
 *
 * Eski uc baglanti `/kesfet?kategori=1|6|4` idi: SABIT KIMLIK, ortama gore
 * degisiyor (dalda yanlis kategoriye gidiyordu). Artik slug'li kategori
 * sayfalari kullanilir. "Tüm profesyoneller" -> "Tüm sağlayıcılar" (ajanslar
 * da listede), ayrica Ilanlar ve ana eylem buraya girdi.
 */
const KESFET_LINKLERI: AltLink[] = [
  { href: "/kesfet", label: "Tüm sağlayıcılar" },
  { href: "/kategori/dj", label: "DJ'ler" },
  { href: "/kategori/fotografci", label: "Fotoğrafçılar" },
  { href: "/kategori/sunucu", label: "Sunucular" },
  { href: "/kesfet?tip=ajans", label: "Kurumsal hizmet sağlayıcılar" },
  { href: "/ilanlar", label: "İlanlar" },
  { href: "/kashe-ai", label: "Etkinliğini planla" },
];

/**
 * Kurumsal sutunu. `/#nasil-calisir` ve `/#ajanslar` buradan CIKTI — ikisi de
 * "Kashe hakkında" sutununda (`HAKKINDA_LINKS`); ayni hedef iki kez listelenmez.
 */
const KURUMSAL_LINKLERI: AltLink[] = [
  { href: "/hakkimizda", label: "Hakkımızda" },
  { href: "/hakkimizda#kurumsal", label: "Kurumsal müşteriler" },
  { href: "/hakkimizda#ajanslar", label: "Kurumsal hizmet sağlayıcılar için" },
  { href: "/#profesyoneller", label: "Profesyoneller için" },
  { href: "/fiyatlandirma", label: "Fiyatlandırma" },
  { href: "/yardim", label: "Yardım" },
  { href: "mailto:info@kashe.net", label: "İletişim", mail: true },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full bg-ink text-paper">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-8">
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

          <Sutun baslik="Keşfet" linkler={KESFET_LINKLERI} />
          <Sutun baslik="Kurumsal" linkler={KURUMSAL_LINKLERI} />
          {/* Sayfa ici capalar + Blog — ust barda yok, burada ve mobil menude */}
          <Sutun baslik="Kashe hakkında" linkler={HAKKINDA_LINKS} />
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
