import { TopNav } from "@/app/components/sections/top-nav";
import { Hero } from "@/app/components/sections/hero";
import { Categories } from "@/app/components/sections/categories";
import { HowItWorks } from "@/app/components/sections/how-it-works";
import { B2BSection } from "@/app/components/sections/b2b-section";
import { TrustSection } from "@/app/components/sections/trust-section";
import { FooterCTA } from "@/app/components/sections/footer-cta";
import { Footer } from "@/app/components/sections/footer";

export default function Home() {
  return (
    <>
      <TopNav />
      <main>
        <Hero />
        <Categories />
        <HowItWorks />
        <B2BSection />
        <TrustSection />
        <FooterCTA />
      </main>
      <Footer />
    </>
  );
}