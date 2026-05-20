import { TopNav } from "@/app/components/sections/top-nav";
import { AjansUyeOlForm } from "./ajans-uye-ol-form";

export const metadata = {
  title: "Ajans olarak üye ol — Kashe",
};

export default function AjansUyeOlPage() {
  return (
    <>
      <TopNav />
      <main className="min-h-[80vh] bg-paper px-6 md:px-12 py-12 md:py-20">
        <AjansUyeOlForm />
      </main>
    </>
  );
}