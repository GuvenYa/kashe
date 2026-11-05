import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { KasheMark } from "@/app/components/ui/kashe-mark";
import { KasheWordmark } from "@/app/components/ui/kashe-wordmark";
import { createClient } from "@/app/lib/supabase-server";
import { MobileNav } from "./mobile-nav";
import { UnreadBadge } from "./unread-badge";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { getUnreadNotificationCount } from "@/app/bildirimler/actions";
import { getCachedUser } from "@/app/lib/auth";
import { getWritableBusinesses } from "@/app/lib/business-write";
import {
  DISCOVERY_LINKS,
  MARKETING_LINKS,
  PLANLA_LINK,
} from "@/app/lib/nav-links";
import { IsiltiIkonu } from "@/app/components/ui/isilti-ikonu";
import { panelMenusu, baslaticiMenusu } from "@/app/lib/panel-menu";
import { ORG_ROLE_LABELS, type OrgRole } from "@/app/lib/org-roles";

/** Hesap turu etiketleri — rol satirinin ilk parcasi. */
const HESAP_ROL_ETIKETLERI: Record<string, string> = {
  client: "Müşteri",
  professional: "Profesyonel",
  agency: "Ajans",
  business: "İşletme",
};

export async function TopNav() {
  const supabase = await createClient();
  const user = await getCachedUser();

  let role: string | null = null;
  let fullName: string | null = null;
  let avatarUrl: string | null = null;
  let isAdmin = false;
  // Kurum manager+ üyeliği (owner/manager) — profil rolü ne olursa olsun kurum
  // adına Teklif Topla + İlanlarım erişimi. Server tarafında tek sorgu (helper).
  let isBusinessManager = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, avatar_url, is_admin")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
    fullName = profile?.full_name ?? null;
    avatarUrl = profile?.avatar_url ?? null;
    isAdmin = !!profile?.is_admin;
    isBusinessManager = (await getWritableBusinesses()).length > 0;
  }

  const isProfessional = role === "professional";
  const isClient = role === "client";
  const isAgency = role === "agency";
  const isBusiness = role === "business";
  const canReceiveOffers = isProfessional || isAgency;
  // Teklif Topla: hizmet alan roller VEYA kurum adına yazabilen manager+ üye
  const canCollectOffers = isClient || isBusiness || isBusinessManager;

  const notificationCount = user ? await getUnreadNotificationCount() : 0;

  // Avatar baş harfleri
  const initials = (fullName || user?.email || "K")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // KISA BASLATICI — TEK KAYNAK `app/lib/panel-menu.ts` (Duzeltme 02).
  //
  // Eskiden burada 13 maddelik bir dizi elle kuruluyordu ve rol/izin kurallari
  // bu dosyaya gomuluydu; sonra duzlestirici tum maddeleri duz listeye
  // doktu (ajans sahibinde 16 satir). Artik model kisa baslatici veriyor:
  // Panel + en cok kullanilan dort madde + hesap satirlari.
  const panelGruplari = user ? await panelMenusu() : [];
  const baslatici = baslaticiMenusu(panelGruplari, {
    rol: role,
    kullaniciId: user?.id ?? null,
  });

  // Rol satiri: hesap turu + (uyesi oldugu kurulus varsa) uyelik rolu ve
  // kurulus adi. Ornek: "Musteri - Proje yoneticisi - Akdeniz Gida".
  const rolEtiketi = HESAP_ROL_ETIKETLERI[role ?? ''] ?? 'Hesap';
  const uyelik = baslatici.uyelik;
  const rolSatiri = uyelik
    ? [
        rolEtiketi,
        ORG_ROLE_LABELS[(uyelik.rol ?? '') as OrgRole],
        uyelik.ad,
      ]
        .filter(Boolean)
        .join(' · ')
    : rolEtiketi;

  const navLinkClass =
    "font-body text-xs uppercase tracking-[0.16em] text-ink-50 hover:text-ink transition-colors duration-200 whitespace-nowrap";

  return (
    <nav className="w-full border-b border-line bg-paper/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link
          href="/"
          prefetch={false}
          className="kashe-logo flex items-center gap-2.5 shrink-0"
        >
          <KasheMark className="w-8 h-8 kashe-logo-mark" title="" />
          <KasheWordmark className="h-4" />
        </Link>

        {/* Orta nav — tek kaynak: nav-links (mobil hamburger ile parite) */}
        {/* Duzeltme 11-A2 (bulgu 73): orta nav girissizde uc baglantiya dustu
            (Kesfet · Ilanlar · Fiyatlandirma), girislide dorde (Kesfet ·
            Ilanlar · Etkinligini planla · Teklif Topla). Eskiden girissizde 9
            baglanti vardi, 1024-1279 px'te sigmiyordu ve dordu `xlOnly` ile
            gizleniyordu; o kural ve sinif artik gereksiz. */}
        <div className="hidden lg:flex items-center gap-7">
          {/* İşlevsel keşif — her kullanıcıya */}
          {DISCOVERY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className={navLinkClass}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <>
              {/* Girislide ana eylem orta nav'da isiltili baglanti olarak
                  durur; sag blok (Mesajlar, zil, hesap) DEGISMEZ. */}
              <Link
                href={PLANLA_LINK.href}
                prefetch={false}
                className={
                  navLinkClass +
                  " inline-flex items-center gap-1.5 text-brand-ink hover:text-brand-ink-deep"
                }
              >
                <IsiltiIkonu />
                {PLANLA_LINK.label}
              </Link>
              {/* Teklif Topla: girisli + teklif toplayabilen roller (menu modeliyle tutarli) */}
              {canCollectOffers && (
                <Link href="/teklif-topla" prefetch={false} className={navLinkClass}>
                  Teklif Topla
                </Link>
              )}
            </>
          ) : (
            // Pazarlama — yalnız girişsiz (tek satir: Fiyatlandırma)
            MARKETING_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className={navLinkClass}
              >
                {link.label}
              </Link>
            ))
          )}
        </div>

        {/* Sağ */}
        <div className="hidden lg:flex items-center gap-4 shrink-0">
          {user ? (
            <>
              <Link
                href="/mesajlar"
                prefetch={false}
                className={navLinkClass + " inline-flex items-center gap-1.5"}
              >
                Mesajlar
                <UnreadBadge userId={user.id} />
              </Link>
              <NotificationBell userId={user.id} initialCount={notificationCount} />
              <UserMenu
                initials={initials}
                avatarUrl={avatarUrl}
                baslik={{
                  ad: fullName?.trim() || user.email || 'Hesabım',
                  rol: rolSatiri,
                }}
                panel={baslatici.panel}
                oncelikli={baslatici.oncelikli}
                hesap={baslatici.hesap}
                isAdmin={isAdmin}
              />
            </>
          ) : (
            <>
              {/* Duzeltme 11-A2: girissiz sag blokta uc kademe — metin baglanti,
                  cerceveli "Üye ol", en sagda birincil "Etkinliğini planla".
                  Fahri'nin notu: her sayfada planlamaya giden gorunur bir yol. */}
              <Link href="/giris" prefetch={false} className={navLinkClass}>
                Giriş yap
              </Link>
              <Link href="/uye-ol" prefetch={false}>
                <Button variant="secondary" size="md">
                  Üye ol
                </Button>
              </Link>
              <Link href={PLANLA_LINK.href} prefetch={false}>
                <Button variant="primary" size="md">
                  <IsiltiIkonu />
                  {PLANLA_LINK.label}
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobil */}
        <MobileNav
          isLoggedIn={!!user}
          isAdmin={isAdmin}
          isProfessional={isProfessional}
          isClient={isClient}
          isAgency={isAgency}
          isBusiness={isBusiness}
          canReceiveOffers={canReceiveOffers}
          canCollectOffers={canCollectOffers}
          userId={user?.id ?? null}
          notificationCount={notificationCount}
          baslatici={baslatici}
        />
      </div>
    </nav>
  );
}
