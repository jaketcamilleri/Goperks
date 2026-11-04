import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/Marquee";
import { Bento } from "@/components/landing/Bento";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Featured } from "@/components/landing/Featured";
import { Pricing } from "@/components/landing/Pricing";
import { Testimonials, BusinessCta } from "@/components/landing/Testimonials";

export default function Landing() {
  return (
    <div data-testid="landing-page">
      <Hero />
      <Marquee />
      <Bento />
      <HowItWorks />
      <Featured />
      <Pricing />
      <Testimonials />
      <BusinessCta />
    </div>
  );
}
