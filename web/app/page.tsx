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
import { JsonLd } from "@/components/JsonLd";

const faqJsonLd: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How is this different from browsing Reddit or Hacker News myself?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We scrape 300+ posts daily across 8 subreddits, Hacker News, and GitHub. Then AI clusters similar problems, scores them by opportunity, and generates technical specs. You'd spend hours doing this manually \u2014 we do it in minutes and deliver the best ideas to your inbox.",
      },
    },
    {
      "@type": "Question",
      name: "What sources do you scrape?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Reddit (r/startups, r/SideProject, r/webdev, and 5 more), Hacker News (Ask HN, Show HN, comments), and GitHub issues from repos with 500+ stars.",
      },
    },
    {
      "@type": "Question",
      name: "Can I get ideas for specific niches?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! Builder members can set category preferences (developer tools, SaaS, AI/ML, consumer apps, etc.) and we'll prioritize matching ideas.",
      },
    },
    {
      "@type": "Question",
      name: "How are ideas scored?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our AI evaluates frequency (how often mentioned), severity (how painful), market size (how many affected), technical complexity, and time to MVP. The priority score balances opportunity against effort.",
      },
    },
    {
      "@type": "Question",
      name: "What's included in the full brief?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Problem statement, target audience, existing solutions, market gaps, technical spec (stack, architecture, MVP scope), business model, pricing strategy, go-to-market plan, and risk assessment.",
      },
    },
    {
      "@type": "Question",
      name: "How fresh are the ideas?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Ideas are generated fresh every morning based on the previous 24\u201348 hours of posts. You'll never see the same idea twice.",
      },
    },
    {
      "@type": "Question",
      name: "Is my data private?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolutely. Your preferences, saved ideas, and browsing activity are never shared. We scrape publicly available posts \u2014 we don't access any private data.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a refund policy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. If you're not satisfied within the first 14 days, we'll refund your payment in full. No questions asked.",
      },
    },
  ],
};

const organizationJsonLd: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ZeroToShip",
  url: "https://zerotoship.dev",
  logo: "https://zerotoship.dev/favicon.svg",
  description: "AI-powered startup idea discovery platform",
  sameAs: ["https://twitter.com/zerotoship"],
};

const softwareAppJsonLd: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ZeroToShip",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "0",
    highPrice: "99",
    priceCurrency: "USD",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      <main id="main-content" tabIndex={-1}>
        <HeroSection />
        <SourceStrip />
        <HowItWorks />
        <SampleBriefPreview />
        <FeatureTabs />
        <ComparisonTable />
        <PricingSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
      <JsonLd data={faqJsonLd} />
      <JsonLd data={organizationJsonLd} />
      <JsonLd data={softwareAppJsonLd} />
    </div>
  );
}
