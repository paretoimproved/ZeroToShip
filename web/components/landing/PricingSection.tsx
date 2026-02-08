"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type BillingCycle = "monthly" | "annual";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  annualTotal: number;
  annualSavingsPercent: number;
  description: string;
  features: PlanFeature[];
  cta: string;
  ctaRoute: string;
  highlighted: boolean;
}

const plans: Plan[] = [
  {
    name: "Starter",
    monthlyPrice: 0,
    annualPrice: 0,
    annualTotal: 0,
    annualSavingsPercent: 0,
    description: "Perfect for exploring what's possible",
    features: [
      { text: "3 ideas per day", included: true },
      { text: "Problem + solution summary", included: true },
      { text: "Email delivery", included: true },
      { text: "Basic categories", included: true },
      { text: "No full technical specs", included: false },
      { text: "No competitor analysis", included: false },
      { text: "No archive access", included: false },
    ],
    cta: "Get Started Free",
    ctaRoute: "/signup",
    highlighted: false,
  },
  {
    name: "Builder",
    monthlyPrice: 19,
    annualPrice: 12.42,
    annualTotal: 149,
    annualSavingsPercent: 35,
    description: "Everything you need to find and validate ideas",
    features: [
      { text: "10 ideas per day", included: true },
      { text: "Full technical specs", included: true },
      { text: "Competitor analysis", included: true },
      { text: "Business model & pricing", included: true },
      { text: "Go-to-market strategy", included: true },
      { text: "Full archive access", included: true },
      { text: "Priority email delivery", included: true },
    ],
    cta: "Start Building",
    ctaRoute: "/signup?plan=pro",
    highlighted: true,
  },
  {
    name: "Team",
    monthlyPrice: 99,
    annualPrice: 82.5,
    annualTotal: 990,
    annualSavingsPercent: 17,
    description: "For agencies and serial builders",
    features: [
      { text: "Unlimited ideas", included: true },
      { text: "API access", included: true },
      { text: "Custom category filters", included: true },
      { text: "Idea validation reports", included: true },
      { text: "Export to Notion/CSV", included: true },
      { text: "Team sharing (coming soon)", included: true },
      { text: "Priority support", included: true },
    ],
    cta: "Contact Us",
    ctaRoute: "/signup?plan=enterprise",
    highlighted: false,
  },
];

function CheckIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="text-green-500 flex-shrink-0"
    >
      <path
        d="M5 10l3.5 3.5L15 7"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="text-gray-400 flex-shrink-0"
    >
      <path
        d="M6 6l8 8M14 6l-8 8"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatPrice(price: number): string {
  if (price === 0) return "$0";
  if (Number.isInteger(price)) return `$${price}`;
  return `$${price.toFixed(2)}`;
}

export default function PricingSection() {
  const router = useRouter();
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [priceVisible, setPriceVisible] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleBillingChange = useCallback(
    (cycle: BillingCycle) => {
      if (cycle === billing) return;

      // Fade out, swap, fade in
      setPriceVisible(false);
      timeoutRef.current = setTimeout(() => {
        setBilling(cycle);
        setPriceVisible(true);
      }, 150);
    },
    [billing],
  );

  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <h2
          id="pricing-heading"
          className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4"
        >
          Simple Pricing, Serious Value
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
          Start free. Upgrade when you&apos;re ready to ship faster.
        </p>

        {/* Billing toggle */}
        <div className="flex justify-center mb-12">
          <div
            role="radiogroup"
            aria-label="Billing cycle"
            className="inline-flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-full"
          >
            <button
              type="button"
              role="radio"
              aria-checked={billing === "monthly"}
              onClick={() => handleBillingChange("monthly")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                billing === "monthly"
                  ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={billing === "annual"}
              onClick={() => handleBillingChange("annual")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billing === "annual"
                  ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              Annual
              <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">
                Save up to 35%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const price =
              billing === "monthly" ? plan.monthlyPrice : plan.annualPrice;
            const showAnnualBadge =
              billing === "annual" && plan.annualSavingsPercent > 0;

            return (
              <div
                key={plan.name}
                className={[
                  "relative bg-white dark:bg-gray-900 rounded-2xl p-8",
                  plan.highlighted
                    ? "ring-2 ring-primary-500 shadow-xl order-first md:order-none"
                    : "border border-gray-200 dark:border-gray-700",
                ].join(" ")}
              >
                {/* Most Popular badge */}
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}

                {/* Plan name + savings badge */}
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {plan.name}
                  </h3>
                  {showAnnualBadge && (
                    <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">
                      Save {plan.annualSavingsPercent}%
                    </span>
                  )}
                </div>

                {/* Price */}
                <div aria-live="polite" className="mb-1">
                  <span
                    className={`text-4xl font-bold text-gray-900 dark:text-white transition-opacity duration-300 ${
                      priceVisible ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {formatPrice(price)}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">
                    /month
                  </span>
                </div>

                {/* Annual billing subtext */}
                {billing === "annual" && plan.annualTotal > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    billed at ${plan.annualTotal}/year
                  </p>
                )}
                {(billing === "monthly" || plan.annualTotal === 0) && (
                  <div className="mb-4" />
                )}

                {/* Description */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {plan.description}
                </p>

                {/* CTA */}
                <button
                  type="button"
                  onClick={() => router.push(plan.ctaRoute)}
                  className={[
                    "w-full py-3 px-4 rounded-lg text-sm font-semibold transition-colors mb-8",
                    plan.highlighted
                      ? "bg-primary-600 text-white hover:bg-primary-700"
                      : "border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800",
                  ].join(" ")}
                >
                  {plan.cta}
                </button>

                {/* Features */}
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature.text}
                      className="flex items-start gap-2 text-sm"
                    >
                      {feature.included ? <CheckIcon /> : <XIcon />}
                      <span
                        className={
                          feature.included
                            ? "text-gray-700 dark:text-gray-300"
                            : "text-gray-400 dark:text-gray-500"
                        }
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
