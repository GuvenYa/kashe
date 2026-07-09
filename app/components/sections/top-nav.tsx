import { Button } from "@/app/components/ui/button";
import { KasheMark } from "@/app/components/ui/kashe-mark";
import { createClient } from "@/app/lib/supabase-server";
import { MobileNav } from "./mobile-nav";
import { UnreadBadge } from "./unread-badge";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { getUnreadNotificationCount } from "@/app/bildirimler/actions";
import { getCachedUser } from "@/app/lib/auth";
import { getWritableBusinesses } from "@/app/lib/business-write";

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

  // Avatar menüsüne giden kişisel linkler (role göre)
  const menuLinks: { href: string; label: string }[] = [
    { href: "/profil", label: "Profilim" },
  ];
  // MENÜ SADELEŞTİRME: /profil'de bölümü/giriş-linki OLAN sayfalar menüde TEKRAR
  // ETMEZ; karşılığı OLMAYANLAR kalır. (Yetki/sayfa değişmez — yalnız menü içeriği.)

  // Profesyonel/ajans → Takvimim + Kazançlarım (profilde bölüm yok → kalır)
  if (isProfessional || isAgency) {
    menuLinks.push({ href: "/takvimim", label: "Takvimim" });
    menuLinks.push({ href: "/kazanclarim", label: "Kazançlarım" });
  }
  // Müşteri/işletme → İlanlarım (bilinçli korunur — asıl çalışma alanı) + profilde
  // karşılığı olmayan Rezervasyonlarım/Ödeme/Teklif Taleplerim.
  if (isClient || isBusiness) {
    menuLinks.push({ href: "/ilanlarim", label: "İlanlarım" });
    menuLinks.push({ href: "/rezervasyonlarim", label: "Rezervasyonlarım" });
    menuLinks.push({ href: "/odemelerim", label: "Ödeme Geçmişi" });
    menuLinks.push({ href: "/teklif-taleplerim", label: "Teklif Taleplerim" });
  }
  // Kurum manager+ üyesi (client/business değilse) → İlanlarım (profilde karşılığı YOK,
  // tek erişim menü). Üyelik-farkındalıklı görünürlük korunur.
  if (isBusinessManager && !isClient && !isBusiness) {
    menuLinks.push({ href: "/ilanlarim", label: "İlanlarım" });
  }
  // Ajans → Başvurularım: ajans /profil'inde Başvurularım bölümü YOK ({isPro && ...} pro'ya
  // özel) → menüde kalır. Pro'da bölüm olduğundan pro'nun menüsünden çıkarıldı.
  if (isAgency) {
    menuLinks.push({ href: "/basvurularim", label: "Başvurularım" });
  }
  // Profesyonel/ajans → Teklif Talepleri (profilde bölüm yok → kalır)
  if (isProfessional || isAgency) {
    menuLinks.push({ href: "/teklif-talepleri", label: "Teklif Talepleri" });
  }
  // ÇIKARILDI (profilde bölüm/link var): pro'da Hizmetlerim (/profil/hizmetlerim),
  // Portföyüm (/profil/portfoy), Paketlerim (/profil/paketler), Başvurularım; client'ta
  // Favoriler; ayrıca TÜM rollerde Davetlerim (profildeki "Davetlerim →" + bildirimler
  // yeterli). business'ta Kurumsal Ekip zaten menüde link olarak yoktu.
  if (isProfessional || isAgency) {
    menuLinks.push({ href: "/premium", label: "Premium" });
  }
  menuLinks.push({ href: "/bildirimler", label: "Bildirimler" });

  const navLinkClass =
    "font-body text-xs uppercase tracking-[0.16em] text-ink-50 hover:text-ink transition-colors duration-200";

  return (
    <nav className="w-full border-b border-line bg-paper/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between gap-6">
        {/* Logo */}
        <a href="/" className="kashe-logo flex items-center gap-2.5 shrink-0">
          <KasheMark className="w-8 h-8 kashe-logo-mark" />
          <span className="font-display font-semibold text-xl text-ink tracking-tight">
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
              {/* "Teklif Talepleri" desktop orta nav'dan çıkarıldı — avatar/hamburger
                  menüde (menuLinks, pro/agency) kalır. Teklif Topla burada kalır. */}
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
                isAdmin={isAdmin}
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
          isAdmin={isAdmin}
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
