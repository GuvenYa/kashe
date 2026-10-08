import type { Metadata } from "next";
import { TopNav } from "@/app/components/sections/top-nav";
import { Hero } from "@/app/components/sections/hero";
import { CategoryMarquee } from "@/app/components/sections/category-marquee";
import { KasheAiSection } from "@/app/components/sections/kashe-ai-section";
import { FeaturedProfiles } from "@/app/components/sections/featured-profiles";
import { Categories } from "@/app/components/sections/categories";
import { HowItWorks } from "@/app/components/sections/how-it-works";
import { B2BSection } from "@/app/components/sections/b2b-section";
import { AjanslarSection } from "@/app/components/sections/ajanslar-section";
import { ProCtaSection } from "@/app/components/sections/pro-cta-section";
import { TrustSection } from "@/app/components/sections/trust-section";
import { Testimonials } from "@/app/components/sections/testimonials";
import { FaqSection } from "@/app/components/sections/faq-section";
import { FooterCTA } from "@/app/components/sections/footer-cta";
import { Footer } from "@/app/components/sections/footer";
import { Reveal } from "@/app/components/sections/reveal";
import { SITE_URL } from "@/app/lib/site";
import { getCachedUser } from "@/app/lib/auth";
import { hasProposalAccess } from "@/app/lib/org-context";

// Canonical YALNIZ burada: layout'a yazilirsa tum alt sayfalar "/" kanonigini
// miras alirdi. Baslik/aciklama/OG layout'tan gelir.
export const metadata: Metadata = {
  // Next 16 kok yolun sondaki egik cizgisini KIRPAR: hem '/' hem `${SITE_URL}/`
  // ciktida "https://kashe.net" veriyor (olculdu). Ayni kaynak; '/' birakildi.
  alternates: { canonical: "/" },
};

// Organization JSON-LD — sirket unvani YAZILMAZ (karar: 9 Ekim 2026).
const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Kashe",
  url: SITE_URL,
  logo: `${SITE_URL}/kashe-lockup.png`,
  email: "info@kashe.net",
  foundingDate: "2026",
  areaServed: "TR",
  address: {
    "@type": "PostalAddress",
    addressLocality: "İstanbul",
    addressCountry: "TR",
  },
};

export default async function Home() {
  // Ajanslar bolumunun birincil dugmesi role gore degisir: paneli olan kullaniciyi
  // kayit sayfasina gondermek yanlis olur. hasProposalAccess = proposals.view
  // yetkili ajans kurulusu (top-nav ile ayni kaynak).
  const user = await getCachedUser();
  const ajansPaneli = !!user && (await hasProposalAccess());

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(ORGANIZATION_JSONLD),
        }}
      />
      <TopNav />
      <main>
        <Hero />
        <CategoryMarquee />
        <Reveal>
          <FeaturedProfiles />
        </Reveal>
        <Reveal>
          <KasheAiSection />
        </Reveal>
        <Reveal>
          <Categories />
        </Reveal>
        <HowItWorks />
        <Reveal>
          <B2BSection />
        </Reveal>
        <Reveal>
          <AjanslarSection ajansPaneli={ajansPaneli} />
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
