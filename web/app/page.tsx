"use client";

import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import SourceStrip from "@/components/landing/SourceStrip";
import SocialProof from "@/components/landing/SocialProof";
import HowItWorks from "@/components/landing/HowItWorks";
import SampleBriefPreview from "@/components/landing/SampleBriefPreview";
import SampleSpecShowcase from "@/components/landing/SampleSpecShowcase";
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
        text: "We scrape 300+ posts daily across 8 subreddits, Hacker News, and GitHub. Then AI clusters similar problems, scores them by opportunity, and generates agent-ready specs. You'd spend hours doing this manually \u2014 we do it in minutes and surface the highest-signal problems in a searchable library.",
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
      name: "Can I filter problems by category?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! Pro members can set category preferences (developer tools, SaaS, AI/ML, consumer apps, etc.) and we'll prioritize matching problems.",
      },
    },
    {
      "@type": "Question",
      name: "How are problems scored?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our AI evaluates frequency (how often mentioned), severity (how painful), market size (how many affected), technical complexity, and time to MVP. The priority score balances opportunity against effort.",
      },
    },
    {
      "@type": "Question",
      name: "What's included in an agent-ready spec?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Problem statement, target audience, existing solutions, market gaps, technical spec (stack, architecture, MVP scope), business model, pricing strategy, go-to-market plan, and risk assessment — structured so you can paste it directly into Claude Code, Cursor, or any AI coding agent.",
      },
    },
    {
      "@type": "Question",
      name: "How fresh are the problems?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The problem library is updated daily with new problems from the previous 24\u201348 hours of posts. Problems are continuously re-scored as new evidence appears.",
      },
    },
    {
      "@type": "Question",
      name: "Is my data private?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolutely. Your preferences, saved problems, and browsing activity are never shared. We scrape publicly available posts \u2014 we don't access any private data.",
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
  description: "AI-powered validated problem discovery and agent-ready spec generation platform",
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
        <SocialProof />
        <HowItWorks />
        <SampleBriefPreview />
        <SampleSpecShowcase />
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
