import { TopNav } from "@/app/components/sections/top-nav";
import { UyeOlForm } from "./uye-ol-form";

export const metadata = {
  title: "Üye ol — Kashe",
};

export default async function UyeOlPage({
  searchParams,
}: {
  searchParams: Promise<{ rol?: string }>;
}) {
  const params = await searchParams;
  const rol = params.rol || "musteri";

  return (
    <>
      <TopNav />
      <main className="min-h-[80vh] bg-paper px-6 md:px-12 py-12 md:py-20">
        <UyeOlForm initialRole={rol} />
      </main>
    </>
  );
}