import Link from "next/link";
import { TopNav } from "@/app/components/sections/top-nav";
import { Button } from "@/app/components/ui/button";
import { Eyebrow } from "@/app/components/ui/eyebrow";

export const metadata = {
  title: "Sayfa bulunamadı — Kashe",
};

export default function NotFound() {
  return (
    <>
      <TopNav />
      <main className="relative overflow-hidden bg-paper min-h-[calc(100vh-80px)] flex items-center">
        {/* Atmosferik glow — Hero diliyle */}
        <div
          aria-hidden
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(200, 68, 42, 0.14) 0%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(107, 46, 92, 0.10) 0%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />

        <div className="relative max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24 text-center">
          <div className="mb-6 flex justify-center">
            <Eyebrow variant="pill">404 · Sahnenin kıyısı</Eyebrow>
          </div>

          <h1 className="font-display font-light text-5xl md:text-7xl leading-[0.95] tracking-[-0.04em] text-ink mb-6">
            Bu <em>perde</em> hiç açılmamış.
          </h1>

          <p className="text-lg md:text-xl text-ink-72 leading-[1.55] mb-10 max-w-2xl mx-auto">
            Aradığın sayfa burada değil. Belki taşındı, belki hiç var olmadı.
            Hadi ana sahneye dönelim.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button variant="primary" size="lg">
                Ana sayfaya dön →
              </Button>
            </Link>
            <Link href="/kesfet">
              <Button variant="secondary" size="lg">
                Profesyonelleri keşfet
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
