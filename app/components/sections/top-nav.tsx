import { Button } from "@/app/components/ui/button";
import { createClient } from "@/app/lib/supabase-server";
import { MobileNav } from "./mobile-nav";
import { UnreadBadge } from "./unread-badge";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { getUnreadNotificationCount } from "@/app/bildirimler/actions";
import { getCachedUser } from "@/app/lib/auth";

export async function TopNav() {
  const supabase = await createClient();
  const user = await getCachedUser();

  let role: string | null = null;
  let fullName: string | null = null;
  let avatarUrl: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, avatar_url")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
    fullName = profile?.full_name ?? null;
    avatarUrl = profile?.avatar_url ?? null;
  }

  const isProfessional = role === "professional";
  const isClient = role === "client";
  const isAgency = role === "agency";
  const isBusiness = role === "business";
  const canReceiveOffers = isProfessional || isAgency;
  const canCollectOffers = isClient || isBusiness;

  const notificationCount = user ? await getUnreadNotificationCount() : 0;

  // Avatar baş harfleri
  const initials = (fullName || user?.email || "K")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Avatar menüsüne giden kişisel linkler (role göre)
  const menuLinks: { href: string; label: string }[] = [
    { href: "/profil", label: "Profilim" },
  ];
  // Profesyonel/ajans → Takvimim + Kazançlarım, profilim'in hemen ardına
  if (isProfessional || isAgency) {
    menuLinks.push({ href: "/takvimim", label: "Takvimim" });
    menuLinks.push({ href: "/kazanclarim", label: "Kazançlarım" });
  }
  // Müşteri/işletme → İlanlarım + Rezervasyonlarım + Teklif Taleplerim
  if (isClient || isBusiness) {
    menuLinks.push({ href: "/ilanlarim", label: "İlanlarım" });
    menuLinks.push({ href: "/rezervasyonlarim", label: "Rezervasyonlarım" });
    menuLinks.push({ href: "/odemelerim", label: "Ödeme Geçmişi" });
    menuLinks.push({ href: "/teklif-taleplerim", label: "Teklif Taleplerim" });
  }
  if (isProfessional || isAgency) {
    menuLinks.push({ href: "/basvurularim", label: "Başvurularım" });
    menuLinks.push({ href: "/davetlerim", label: "Davetlerim" });
    menuLinks.push({ href: "/teklif-talepleri", label: "Teklif Talepleri" });
  }
  if (isProfessional) {
    menuLinks.push({ href: "/profil/hizmetlerim", label: "Hizmetlerim" });
    menuLinks.push({ href: "/profil/portfoy", label: "Portföyüm" });
  }
  if (isClient) {
    menuLinks.push({ href: "/favoriler", label: "Favoriler" });
  }
  if (isProfessional || isAgency) {
    menuLinks.push({ href: "/premium", label: "Premium" });
  }
  menuLinks.push({ href: "/bildirimler", label: "Bildirimler" });

  const navLinkClass =
    "font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-ink transition-colors";

  return (
    <nav className="w-full border-b border-line bg-paper/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between gap-6">
        {/* Logo */}
        <a href="/" className="kashe-logo flex items-center gap-2.5 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-192.png"
              alt="Kashe"
              className="w-8 h-8 rounded-md"
            />
          <span className="font-display font-semibold text-2xl text-ink tracking-tight">
            Kashe
          </span>
        </a>

        {/* Orta nav */}
        <div className="hidden md:flex items-center gap-7">
          <a href="/kesfet" className={navLinkClass}>
            Keşfet
          </a>
          <a href="/ilanlar" className={navLinkClass}>
            İlanlar
          </a>
          <a href="/blog" className={navLinkClass}>
              Blog
            </a>
            <a href="/kashe-ai" className={navLinkClass + " inline-flex items-center gap-1.5"}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terracotta">
                <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
              </svg>
              Kashe AI
            </a>
          {user ? (
            <>
              {canReceiveOffers && (
                <a href="/teklif-talepleri" className={navLinkClass}>
                  Teklif Talepleri
                </a>
              )}
              {canCollectOffers && (
                <a href="/teklif-topla" className={navLinkClass}>
                  Teklif Topla
                </a>
              )}
            </>
          ) : (
            <>
              <a href="/#hizmetler" className={navLinkClass}>
                Hizmetler
              </a>
              <a href="/#nasil-calisir" className={navLinkClass}>
                Nasıl çalışır
              </a>
              <a href="/#kurumsal" className={navLinkClass}>
                Kurumsal
              </a>
              <a href="/fiyatlandirma" className={navLinkClass}>
                Fiyatlandırma
              </a>
            </>
          )}
        </div>

        {/* Sağ */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          {user ? (
            <>
              <a href="/mesajlar" className={navLinkClass + " inline-flex items-center gap-1.5"}>
                Mesajlar
                <UnreadBadge userId={user.id} />
              </a>
              <NotificationBell userId={user.id} initialCount={notificationCount} />
              <UserMenu
                initials={initials}
                avatarUrl={avatarUrl}
                links={menuLinks}
              />
            </>
          ) : (
            <>
              <a href="/giris" className={navLinkClass}>
                Giriş yap
              </a>
              <a href="/uye-ol">
                <Button variant="primary" size="md">
                  Üye ol
                </Button>
              </a>
            </>
          )}
        </div>

        {/* Mobil */}
        <MobileNav
          isLoggedIn={!!user}
          isProfessional={isProfessional}
          isClient={isClient}
          isAgency={isAgency}
          isBusiness={isBusiness}
          canReceiveOffers={canReceiveOffers}
          canCollectOffers={canCollectOffers}
          userId={user?.id ?? null}
          notificationCount={notificationCount}
          menuLinks={menuLinks}
        />
      </div>
    </nav>
  );
}
