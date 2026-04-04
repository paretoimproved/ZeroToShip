import type { Metadata } from "next";
import PricingPageContent from "./PricingPageContent";

export const metadata: Metadata = {
  title: "Pricing - ZeroToShip",
  description:
    "Simple pricing for startup idea discovery. Start free, upgrade when you're ready.",
};

export default function PricingPage() {
  return <PricingPageContent />;
}
