import { TopNav } from "@/app/components/sections/top-nav";
import { UyeOlForm } from "./uye-ol-form";
import { createClient } from "@/app/lib/supabase-server";
import { orderCities } from "@/app/lib/city-order";

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

  const supabase = await createClient();
  const { data: citiesData } = await supabase
    .from("turkish_cities")
    .select("id, name")
    .order("name");

  const cities = orderCities(citiesData || []);

  return (
    <>
      <TopNav />
      <main className="min-h-[80vh] bg-paper px-6 md:px-12 py-12 md:py-20">
        <UyeOlForm initialRole={rol} cities={cities} />
      </main>
    </>
  );
}