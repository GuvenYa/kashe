import { TopNav } from "@/app/components/sections/top-nav";

export const metadata = {
  title: "Kullanım Şartları — Kashe",
};

export default function KullanimSartlariPage() {
  return (
    <>
      <TopNav />
      <main className="min-h-[60vh] bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight mb-6">
            Kullanım Şartları
          </h1>
          <p className="text-ink-72 leading-relaxed">
            Bu sayfanın içeriği yakında eklenecektir.
          </p>
        </div>
      </main>
    </>
  );
}