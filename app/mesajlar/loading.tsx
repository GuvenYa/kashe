import { TopNav } from "@/app/components/sections/top-nav";
import { Loading } from "@/app/components/sections/loading";

export default function MesajlarLoading() {
  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <Loading
            messages={[
              "Konuşmaların yükleniyor...",
              "Backstage düzenleniyor...",
              "Mesajlar getiriliyor...",
            ]}
          />
        </div>
      </main>
    </>
  );
}