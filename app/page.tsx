import { TopNav } from "@/app/components/sections/top-nav";
import { Hero } from "@/app/components/sections/hero";
import { CategoryMarquee } from "@/app/components/sections/category-marquee";
import { FeaturedProfiles } from "@/app/components/sections/featured-profiles";
import { Categories } from "@/app/components/sections/categories";
import { HowItWorks } from "@/app/components/sections/how-it-works";
import { B2BSection } from "@/app/components/sections/b2b-section";
import { ProCtaSection } from "@/app/components/sections/pro-cta-section";
import { TrustSection } from "@/app/components/sections/trust-section";
import { Testimonials } from "@/app/components/sections/testimonials";
import { FaqSection } from "@/app/components/sections/faq-section";
import { FooterCTA } from "@/app/components/sections/footer-cta";
import { Footer } from "@/app/components/sections/footer";
import { Reveal } from "@/app/components/sections/reveal";

export default function Home() {
  return (
    <>
      <TopNav />
      <main>
        <Hero />
        <CategoryMarquee />
        <Reveal>
          <FeaturedProfiles />
        </Reveal>
        <Reveal>
          <Categories />
        </Reveal>
        <HowItWorks />
        <Reveal>
          <B2BSection />
        </Reveal>
        <Reveal>
          <ProCtaSection />
        </Reveal>
        <Reveal>
          <TrustSection />
        </Reveal>
        <Reveal>
          <Testimonials />
        </Reveal>
        <Reveal>
          <FaqSection />
        </Reveal>
        <Reveal>
          <FooterCTA />
        </Reveal>
      </main>
      <Footer />
    </>
  );
}