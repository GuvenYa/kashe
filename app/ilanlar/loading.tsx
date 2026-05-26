import { TopNav } from "@/app/components/sections/top-nav";
import { Loading } from "@/app/components/sections/loading";

export default function IlanlarLoading() {
  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-7xl mx-auto">
          <Loading
            messages={[
              "İlan tahtası hazırlanıyor...",
              "Açık ilanlar toplanıyor...",
              "Perde açılıyor...",
            ]}
          />
        </div>
      </main>
    </>
  );
}
