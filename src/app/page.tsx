import { siteConfig } from "@/config/site.config";
import { JsonLd } from "@/components/seo/json-ld";
import { About } from "@/components/sections/about";
import { Booking } from "@/components/sections/booking";
import { Contact } from "@/components/sections/contact";
import { Faq } from "@/components/sections/faq";
import { GallerySection } from "@/components/sections/gallery-section";
import { Hero } from "@/components/sections/hero";
import { Pricing } from "@/components/sections/pricing";
import { Services } from "@/components/sections/services";
import { Team } from "@/components/sections/team";
import { getFeatures, getServicesWithPage, isBookingSystemEnabled } from "@/lib/plan";
import { buildFaqJsonLd, buildLocalBusinessJsonLd } from "@/lib/site";
import { getTexts } from "@/lib/texts";

export default function HomePage() {
  const texts = getTexts(siteConfig);
  const features = getFeatures(siteConfig);
  const pageIds = new Set(getServicesWithPage(siteConfig).map((s) => s.id));
  const showFaq = features.faq && siteConfig.faq.length > 0;
  const showTeam = features.team && siteConfig.team.length > 0;

  return (
    <>
      <JsonLd data={buildLocalBusinessJsonLd(siteConfig)} />
      {showFaq && <JsonLd data={buildFaqJsonLd(siteConfig)} />}
      <Hero config={siteConfig} texts={texts} />
      <About config={siteConfig} />
      <Services config={siteConfig} texts={texts} pageIds={pageIds} />
      <Pricing config={siteConfig} texts={texts} />
      {showTeam && <Team config={siteConfig} texts={texts} />}
      <GallerySection config={siteConfig} texts={texts} />
      <Booking config={siteConfig} texts={texts} withForm={features.bookingForm} onlineBooking={isBookingSystemEnabled(siteConfig)} />
      {showFaq && <Faq config={siteConfig} texts={texts} />}
      <Contact config={siteConfig} texts={texts} />
    </>
  );
}
