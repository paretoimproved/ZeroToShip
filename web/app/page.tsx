"use client";

import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import SourceStrip from "@/components/landing/SourceStrip";
import HowItWorks from "@/components/landing/HowItWorks";
import SampleBriefPreview from "@/components/landing/SampleBriefPreview";
import FeatureTabs from "@/components/landing/FeatureTabs";
import ComparisonTable from "@/components/landing/ComparisonTable";
import PricingSection from "@/components/landing/PricingSection";
import FAQSection from "@/components/landing/FAQSection";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      <div id="main-content">
        <HeroSection />
        <SourceStrip />
        <HowItWorks />
        <SampleBriefPreview />
        <FeatureTabs />
        <ComparisonTable />
        <PricingSection />
        <FAQSection />
        <FinalCTA />
      </div>
      <Footer />
    </div>
  );
}
