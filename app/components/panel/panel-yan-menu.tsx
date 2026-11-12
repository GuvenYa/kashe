'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  ArrowLeft,
  Bell,
  Briefcase,
  Contact,
  Truck,
  Building2,
  Calendar,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  ClipboardList,
  Compass,
  CreditCard,
  Crown,
  FileText,
  Flag,
  FolderOpen,
  GraduationCap,
  Heart,
  Images,
  Inbox,
  LayoutDashboard,
  ListChecks,
  ListFilter,
  LogOut,
  Megaphone,
  MessageSquare,
  Newspaper,
  Package,
  Pencil,
  Quote,
  Receipt,
  Settings,
  Shield,
  Sparkles,
  Star,
  Tags,
  UsersRound,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/app/lib/supabase-browser';
import { KasheMark } from '@/app/components/ui/kashe-mark';
import { KasheWordmark } from '@/app/components/ui/kashe-wordmark';
import {
  BOLUM_ETIKETLERI,
  BOLUM_SIRASI,
  type PanelMenuBolumu,
  type PanelMenuGrubu,
} from '@/app/lib/panel-menu-tipler';

/**
 * Panel yan menusu — TEK istemci parcasi (gerisi sunucu bileseni).
 *
 * NEDEN ISTEMCI: aktif maddeyi `usePathname` belirler, mobil cekmece durumu ve
 * cikis islemi tarayicida calisir.
 *
 * IKON NEDEN STRING: menu modeli (`app/lib/panel-menu.ts`) bir SUNUCU modulu;
 * React bileseni sunucudan istemciye prop olarak GECIRILEMEZ. Model ikonun
 * ADINI tasir, eslemeyi burada yapariz. Bilinmeyen ad ikonsuz cizilir.
 */
const IKONLAR: Record<string, LucideIcon> = {
  gosterge: LayoutDashboard,
  etkinlik: CalendarDays,
  takvim: Calendar,
  rfp: Inbox,
  teklif: FileText,
  havuz: UsersRound,
  ekip: Briefcase,
  kazanc: Wallet,
  rezervasyon: ClipboardList,
  ilan: Megaphone,
  basvuru: Star,
  odeme: Receipt,
  kurumsal: Building2,
  kesfet: Compass,
  ai: Sparkles,
  bildirim: Bell,
  mesaj: MessageSquare,
  premium: Crown,
  profil: Pencil,
  hizmet: Wrench,
  paket: Package,
  portfoy: Images,
  deneyim: GraduationCap,
  kategori: Tags,
  favori: Heart,
  kart: CreditCard,
  klasor: FolderOpen,
  yonetici: Shield,
  gorev: ListChecks,
  musteri: Contact,
  tedarikci: Truck,
  kisaliste: ListFilter,
  ayar: Settings,
  istatistik: ChartColumn,
  zeka: Sparkles,
  sikayet: Flag,
  blog: Newspaper,
  gorus: Quote,
};

/**
 * KATLANABILIR BOLUMLER (Duzeltme 02) — durum `localStorage`'da.
 *
 * Okuma EFEKTSIZ: `useSyncExternalStore` ile yapilir (efekt icinde setState
 * cascading render demek; ayni desen `cerez-banner.tsx`). Anlik goruntu METIN
 * doner — React deger esitligiyle karsilastirir, her cagrida yeni nesne donmek
 * sonsuz render olurdu. Okunamazsa (gizli sekme, kapali site verisi) varsayilan
 * gecerli olur.
 */
const DEPO_ONEKI = 'kashe.panel-menu.';

/** Katlanir grubun tek bolumu icin kullanilan anahtar eki. */
const GRUP_BOLUMU = 'grup';

function depoAnahtari(grupBasligi: string, bolum: string): string {
  return DEPO_ONEKI + grupBasligi + '.' + bolum;
}

/** Grupta maddesi olan bolum sayisi. */
function bolumSayisi(grup: PanelMenuGrubu): number {
  return BOLUM_SIRASI.filter((b) => grup.maddeler.some((m) => m.bolum === b))
    .length;
}

function depoOku(anahtar: string): string {
  try {
    return window.localStorage.getItem(anahtar) ?? '';
  } catch {
    return '';
  }
}

function depoYaz(anahtar: string, acik: boolean): void {
  try {
    window.localStorage.setItem(anahtar, acik ? '1' : '0');
  } catch {
    // Sessiz: durum yalniz bir kolaylik, akis bozulmaz.
  }
}

// localStorage ayni sekmede olay yayinlamaz; abonelige gerek yok — deger
// yalniz kullanicinin tiklamasiyla degisir, o da ayri state'te tutulur.
function abone(): () => void {
  return () => {};
}

export type PanelHesap = {
  ad: string;
  altSatir: string;
  avatarUrl?: string | null;
  rozet?: string | null;
};

/**
 * Aktif madde: pathname'i KAPSAYAN en uzun yol kazanir.
 *
 * Boylece `/profil` ile `/profil/duzenle` ayni anda aktif gorunmez ve madde
 * basina "tam eslesme mi" bayragi tasimak gerekmez.
 *
 * SORGU DIZESI AYRI TUTULUR: menudeki href `?kurulus=<id>` tasiyabiliyor;
 * eslesme yol uzerinden yapilir, sorgu ise AYNI YOLU paylasan maddeleri ayirt
 * etmek icin kullanilir (bkz. `aktifAnahtar`).
 */
function yolu(href: string): string {
  const i = href.indexOf('?');
  return i < 0 ? href : href.slice(0, i);
}

function aktifHref(pathname: string, hrefler: string[]): string | null {
  let kazanan: string | null = null;
  for (const h of hrefler) {
    const y = yolu(h);
    if (pathname !== y && !pathname.startsWith(y + '/')) continue;
    if (!kazanan || y.length > yolu(kazanan).length) kazanan = y;
  }
  return kazanan;
}

export function PanelYanMenu({
  menu,
  hesap,
  yonetici = false,
}: {
  menu: PanelMenuGrubu[];
  hesap: PanelHesap;
  yonetici?: boolean;
}) {
  const pathname = usePathname();
  const arama = useSearchParams();
  const router = useRouter();
  const [acik, setAcik] = useState(false);

  const tumHrefler = menu.flatMap((g) => g.maddeler.map((m) => m.href));
  const aktif = aktifHref(pathname, tumHrefler);

  // AYNI YOL BIRDEN COK GRUPTA olabilir (ornek: iki kurulusun grubunda da
  // "Etkinlikler"). `aria-current` TEK olmali: adresteki `?kurulus=` ile
  // eslesen madde kazanir, yoksa ilk grupta geceni.
  const kurulusParam = arama.get('kurulus');
  const aktifAnahtar = (() => {
    if (!aktif) return null;
    const adaylar: { grup: string; href: string }[] = [];
    for (const g of menu) {
      for (const m of g.maddeler) {
        if (yolu(m.href) === aktif) adaylar.push({ grup: g.baslik, href: m.href });
      }
    }
    if (adaylar.length === 0) return null;
    if (kurulusParam) {
      const eslesen = adaylar.find((a) => a.href.includes(kurulusParam));
      if (eslesen) return eslesen.grup + String.fromCharCode(0) + eslesen.href;
    }
    return adaylar[0].grup + String.fromCharCode(0) + adaylar[0].href;
  })();

  /**
   * Hangi bolumler var: grup basina yalniz MADDESI OLAN bolumler.
   * Katlanir grup (Profil icerigi) tek anahtar tasir.
   */
  const bolumAnahtarlari = useMemo(() => {
    const liste: string[] = [];
    for (const grup of menu) {
      if (grup.katlanir) {
        liste.push(depoAnahtari(grup.baslik, GRUP_BOLUMU));
        continue;
      }
      for (const bolum of BOLUM_SIRASI) {
        if (grup.maddeler.some((m) => m.bolum === bolum)) {
          liste.push(depoAnahtari(grup.baslik, bolum));
        }
      }
    }
    return liste;
  }, [menu]);

  // Sunucu anlik goruntusu bos ('' x N): hidrasyondan sonra gercek deger gelir.
  const depoAnlik = useSyncExternalStore(
    abone,
    () => bolumAnahtarlari.map((a) => depoOku(a)).join('|'),
    () => bolumAnahtarlari.map(() => '').join('|')
  );

  const kayitli = useMemo(() => {
    const harita = new Map<string, boolean>();
    const parcalar = depoAnlik.split('|');
    bolumAnahtarlari.forEach((anahtar, i) => {
      const deger = parcalar[i];
      if (deger === '1' || deger === '0') harita.set(anahtar, deger === '1');
    });
    return harita;
  }, [depoAnlik, bolumAnahtarlari]);

  /** Bu oturumda kullanicinin eliyle degistirdigi bolumler (depoyu ezer). */
  const [elleAcilan, setElleAcilan] = useState<Record<string, boolean>>({});

  /** Aktif maddenin bulundugu grup + bolum: o bolum acik gelir. */
  const aktifBolum = useMemo(() => {
    if (!aktifAnahtar) return null;
    const [grupBasligi, href] = aktifAnahtar.split(String.fromCharCode(0));
    const grup = menu.find((g) => g.baslik === grupBasligi);
    if (!grup) return null;
    if (grup.katlanir) return depoAnahtari(grup.baslik, GRUP_BOLUMU);
    const madde = grup.maddeler.find((m) => m.href === href);
    if (!madde?.bolum) return null;
    return depoAnahtari(grup.baslik, madde.bolum);
  }, [aktifAnahtar, menu]);

  /**
   * Bolum acik mi: kullanicinin bu oturumdaki tiklamasi > aktif sayfa kurali >
   * `localStorage` > varsayilan (`calisma` acik, digerleri kapali).
   */
  function bolumAcikMi(anahtar: string, bolum: PanelMenuBolumu | null): boolean {
    const elle = elleAcilan[anahtar];
    if (elle !== undefined) return elle;
    if (anahtar === aktifBolum) return true;
    const depo = kayitli.get(anahtar);
    if (depo !== undefined) return depo;
    return bolum === 'calisma';
  }

  function bolumuDegistir(anahtar: string, suAnAcik: boolean): void {
    const yeni = !suAnAcik;
    setElleAcilan((o) => ({ ...o, [anahtar]: yeni }));
    depoYaz(anahtar, yeni);
  }

  const basHarfler = hesap.ad
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function cikisYap() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  /** Tek menu satiri — bolumsuz, bolumlu ve katlanir grupta ayni cizim. */
  function maddeSatiri(grupBasligi: string, madde: PanelMenuGrubu['maddeler'][number]) {
    const Ikon = IKONLAR[madde.ikon];
    const seciliMi =
      aktifAnahtar === grupBasligi + String.fromCharCode(0) + madde.href;
    return (
      <Link
        key={madde.href}
        href={madde.href}
        onClick={() => setAcik(false)}
        aria-current={seciliMi ? 'page' : undefined}
        className={
          seciliMi
            ? 'flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2.5 rounded-lg transition-colors bg-paper/10 text-paper'
            : 'flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2.5 rounded-lg transition-colors text-paper/55 hover:text-paper hover:bg-paper/5'
        }
      >
        {Ikon && <Ikon size={16} className="shrink-0" aria-hidden />}
        <span className="min-w-0 truncate">{madde.etiket}</span>
        {!!madde.rozet && madde.rozet > 0 && (
          <span className="ml-auto min-w-[18px] h-[18px] px-1.5 bg-brand-accent text-paper text-[10px] font-mono font-bold rounded-full flex items-center justify-center leading-none shrink-0">
            {madde.rozet > 99 ? '99+' : madde.rozet}
          </span>
        )}
      </Link>
    );
  }

  const ALT_BAGLANTI =
    'flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/55 hover:text-paper hover:bg-paper/5 px-3 py-2 rounded-lg transition-colors';

  const govde = (
    <>
      {/* Logo + hesap turu rozeti */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-paper/10">
        <Link
          href="/"
          className="flex items-center gap-2.5 min-w-0"
          onClick={() => setAcik(false)}
        >
          <KasheMark variant="dark" className="w-7 h-7 shrink-0" title="" />
          <KasheWordmark variant="dark" className="h-3.5 shrink-0" />
        </Link>
        {hesap.rozet && (
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-paper/72 bg-paper/10 px-2 py-0.5 rounded-full border border-paper/20 shrink-0">
            {hesap.rozet}
          </span>
        )}
      </div>

      {/* Gruplar */}
      <nav
        aria-label="Panel"
        className="flex-1 overflow-y-auto py-4 px-3 space-y-4"
      >
        {menu.map((grup) => {
          // Bolumsuz maddeler (Pazaryeri, Hesap) grup basliginin hemen
          // altinda, bolumlerden ONCE cizilir.
          const bolumsuz = grup.maddeler.filter((m) => !m.bolum);
          const grupAnahtari = depoAnahtari(grup.baslik, GRUP_BOLUMU);
          const grupAcik = grup.katlanir
            ? bolumAcikMi(grupAnahtari, null)
            : true;

          return (
            <div key={grup.baslik} className="space-y-1">
              {grup.katlanir ? (
                // Tek parca katlanir grup: baslik dugme (Profil icerigi).
                <button
                  type="button"
                  onClick={() => bolumuDegistir(grupAnahtari, grupAcik)}
                  aria-expanded={grupAcik}
                  className="w-full flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-paper/40 hover:text-paper/72 px-3 pb-1 transition-colors"
                >
                  <span className="min-w-0 truncate">{grup.baslik}</span>
                  <ChevronDown
                    size={12}
                    aria-hidden
                    className={
                      grupAcik
                        ? 'shrink-0 ml-auto rotate-180 transition-transform'
                        : 'shrink-0 ml-auto transition-transform'
                    }
                  />
                </button>
              ) : grup.baslikHref ? (
                // Duzeltme 15-C (bulgu 131): kurulus adi tiklanir -> uyeligim.
                <Link
                  href={grup.baslikHref}
                  onClick={() => setAcik(false)}
                  title={`${grup.baslik}: üyeliğin ve kuruluş bilgisi`}
                  className="group flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-paper/40 hover:text-paper/72 px-3 pb-1 transition-colors"
                >
                  <span className="min-w-0 truncate">{grup.baslik}</span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 ml-auto opacity-60 group-hover:opacity-100"
                  >
                    →
                  </span>
                </Link>
              ) : (
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/40 px-3 pb-1">
                  {grup.baslik}
                </p>
              )}

              {grupAcik && bolumsuz.map((madde) => maddeSatiri(grup.baslik, madde))}

              {grupAcik &&
                !grup.katlanir &&
                BOLUM_SIRASI.map((bolum) => {
                  const maddeler = grup.maddeler.filter(
                    (m) => m.bolum === bolum
                  );
                  if (maddeler.length === 0) return null;
                  // Grupta tek bolum varsa (izleyici uye, dar yetki) baslik
                  // gurultu olur: maddeler dogrudan, katlanmadan cizilir.
                  if (bolumSayisi(grup) === 1) {
                    return (
                      <div key={bolum} className="space-y-1">
                        {maddeler.map((madde) => maddeSatiri(grup.baslik, madde))}
                      </div>
                    );
                  }
                  const anahtar = depoAnahtari(grup.baslik, bolum);
                  const bolumAcik = bolumAcikMi(anahtar, bolum);
                  return (
                    <div key={bolum} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => bolumuDegistir(anahtar, bolumAcik)}
                        aria-expanded={bolumAcik}
                        className="w-full flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-paper/35 hover:text-paper/60 px-3 py-2 transition-colors"
                      >
                        <span className="min-w-0 truncate">
                          {BOLUM_ETIKETLERI[bolum]}
                        </span>
                        <ChevronDown
                          size={12}
                          aria-hidden
                          className={
                            bolumAcik
                              ? 'shrink-0 ml-auto rotate-180 transition-transform'
                              : 'shrink-0 ml-auto transition-transform'
                          }
                        />
                      </button>
                      {bolumAcik &&
                        maddeler.map((madde) =>
                          maddeSatiri(grup.baslik, madde)
                        )}
                    </div>
                  );
                })}

              {grupAcik &&
                grup.katlanir &&
                grup.maddeler
                  .filter((m) => m.bolum)
                  .map((madde) => maddeSatiri(grup.baslik, madde))}
            </div>
          );
        })}
      </nav>

      {/* Hesap karti + cikislar */}
      <div className="border-t border-paper/10 px-3 py-4 space-y-1">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1 min-w-0">
          {hesap.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={hesap.avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover border border-paper/20 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-paper/10 border border-paper/20 flex items-center justify-center text-paper font-display font-semibold text-xs shrink-0">
              {basHarfler || 'K'}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-sm text-paper truncate">
              {hesap.ad}
            </p>
            <p className="text-[11px] text-paper/50 truncate">
              {hesap.altSatir}
            </p>
          </div>
        </div>

        {yonetici && (
          <Link
            href="/admin"
            onClick={() => setAcik(false)}
            className={ALT_BAGLANTI}
          >
            <Shield size={14} className="shrink-0" aria-hidden />
            Admin paneli
          </Link>
        )}
        <Link href="/" onClick={() => setAcik(false)} className={ALT_BAGLANTI}>
          <ArrowLeft size={14} className="shrink-0" aria-hidden />
          Siteye dön
        </Link>
        <button type="button" onClick={cikisYap} className={ALT_BAGLANTI + ' w-full text-left'}>
          <LogOut size={14} className="shrink-0" aria-hidden />
          Çıkış yap
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Masaustu — sabit sol sutun */}
      <aside className="hidden lg:flex lg:flex-col fixed top-0 left-0 h-screen w-60 bg-ink border-r border-paper/10 z-40">
        {govde}
      </aside>

      {/* Mobil — ust cubuk */}
      <div className="lg:hidden sticky top-0 z-40 bg-ink border-b border-paper/10 flex items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <KasheMark variant="dark" className="w-7 h-7 shrink-0" title="" />
          <KasheWordmark variant="dark" className="h-3.5 shrink-0" />
          {hesap.rozet && (
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-paper/72 bg-paper/10 px-2 py-0.5 rounded-full border border-paper/20 shrink-0">
              {hesap.rozet}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setAcik(!acik)}
          className="p-2 -mr-2 text-paper"
          aria-label={acik ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={acik}
        >
          {acik ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobil — cekmece */}
      {acik && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-ink/50 z-40"
            onClick={() => setAcik(false)}
            aria-hidden="true"
          />
          <aside className="lg:hidden fixed top-0 left-0 h-screen w-64 bg-ink z-50 flex flex-col">
            {govde}
          </aside>
        </>
      )}
    </>
  );
}
