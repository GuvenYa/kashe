import { TopNav } from "@/app/components/sections/top-nav";
import { Hero } from "@/app/components/sections/hero";
import { Categories } from "@/app/components/sections/categories";
import { HowItWorks } from "@/app/components/sections/how-it-works";

export default function Home() {
  return (
    <>
      <TopNav />
      <main>
        <Hero />
        <Categories />
        <HowItWorks />
      </main>
    </>
  );
}