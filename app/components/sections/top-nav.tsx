import { Button } from "@/app/components/ui/button";
import { createClient } from "@/app/lib/supabase-server";
import { LogoutButton } from "./logout-button";
import { MobileNav } from "./mobile-nav";
import { UnreadBadge } from "./unread-badge";

export async function TopNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Login varsa profilden role bilgisi al (TopNav'da Hizmetlerim linki için)
  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    role = profile?.role ?? null;
  }

  const isProfessional = role === 'professional';

  return (
    <nav className="w-full border-b border-line bg-paper sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-5 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5">
          <span className="w-8 h-8 bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-xl leading-none">
            k
          </span>
          <span className="font-display font-semibold text-2xl text-ink tracking-tight">
            Kashe
          </span>
        </a>

        {/* Desktop center nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="/kesfet" className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-ink transition-colors">
            Keşfet
          </a>
          <a href="/#hizmetler" className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-ink transition-colors">
            Hizmetler
          </a>
          <a href="/#nasil-calisir" className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-ink transition-colors">
            Nasıl çalışır
          </a>
          <a href="/#kurumsal" className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-ink transition-colors">
            Kurumsal
          </a>
        </div>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              {isProfessional && (
                <a
                  href="/profil/hizmetlerim"
                  className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors"
                >
                  Hizmetlerim
                </a>
              )}
              {isProfessional && (
                <a
                  href="/profil/portfoy"
                  className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors"
                >
                  Portföyüm
                </a>
              )}
              <a
                href="/mesajlar"
                className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors"
              >
                Mesajlar
                <UnreadBadge userId={user.id} />
              </a>
              <a
                href="/profil"
                className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors"
              >
                Profilim
              </a>
              <LogoutButton />
            </>
          ) : (
            <>
              <a
                href="/giris"
                className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-terracotta transition-colors"
              >
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

        {/* Mobile hamburger */}
        <MobileNav isLoggedIn={!!user} isProfessional={isProfessional} userId={user?.id ?? null} />
      </div>
    </nav>
  );
}