import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { ValueProps } from "@/components/landing/value-props";
import { PredictabilityShowcase } from "@/components/landing/predictability-showcase";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col">
      <LandingHeader />
      <LandingHero />
      <ValueProps />
      <PredictabilityShowcase />
      <FeatureShowcase />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}
