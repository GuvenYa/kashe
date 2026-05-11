import { TopNav } from "@/app/components/sections/top-nav";
import { Hero } from "@/app/components/sections/hero";
import { Categories } from "@/app/components/sections/categories";

export default function Home() {
  return (
    <>
      <TopNav />
      <main>
        <Hero />
        <Categories />
      </main>
    </>
  );
}