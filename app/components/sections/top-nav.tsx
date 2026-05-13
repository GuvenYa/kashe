import { Button } from "@/app/components/ui/button";

export function TopNav() {
  return (
    <nav className="w-full border-b border-line bg-paper sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <span className="w-8 h-8 bg-terracotta flex items-center justify-center text-paper font-display font-semibold text-xl leading-none">
            k
          </span>
          <span className="font-display font-semibold text-2xl text-ink tracking-tight">
            Kashe
          </span>
        </a>
        <div className="hidden md:flex items-center gap-8">
          <a href="#hizmetler" className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-ink transition-colors">
            Hizmetler
          </a>
          <a href="#nasil-calisir" className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-ink transition-colors">
            Nasıl çalışır
          </a>
          <a href="#kurumsal" className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-ink transition-colors">
            Kurumsal
          </a>
          <a href="#hakkimizda" className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-ink transition-colors">
            Hakkımızda
          </a>
        </div>
        <a href="/uye-ol">
  <Button variant="primary" size="md">
    Üye ol
  </Button>
</a>
      </div>
    </nav>
  );
}