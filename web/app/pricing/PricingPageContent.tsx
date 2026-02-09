"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types & data                                                      */
/* ------------------------------------------------------------------ */

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
  highlighted: boolean;
  priceKey: { monthly: string; annual: string } | null;
  ctaAction: "signup" | "checkout" | "contact";
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
      { text: "1 featured brief per email", included: true },
      { text: "Problem + audience summary", included: true },
      { text: "Daily email delivery", included: true },
      { text: "Full briefs for all ideas", included: false },
      { text: "Archive & search", included: false },
    ],
    cta: "Get Started Free",
    highlighted: false,
    priceKey: null,
    ctaAction: "signup",
  },
  {
    name: "Builder",
    monthlyPrice: 19,
    annualPrice: 12.42,
    annualTotal: 149,
    annualSavingsPercent: 35,
    description: "Full briefs for every idea, every day",
    features: [
      { text: "10 full briefs per day", included: true },
      { text: "Complete market analysis", included: true },
      { text: "Tech stack recommendations", included: true },
      { text: "Go-to-market playbook", included: true },
      { text: "Full archive access", included: true },
      { text: "Search across all ideas", included: true },
      { text: "CSV export", included: true },
    ],
    cta: "Start Building",
    highlighted: true,
    priceKey: { monthly: "pro_monthly", annual: "pro_yearly" },
    ctaAction: "checkout",
  },
  {
    name: "Team",
    monthlyPrice: 99,
    annualPrice: 82.5,
    annualTotal: 990,
    annualSavingsPercent: 17,
    description: "For agencies and serial builders",
    features: [
      { text: "Everything in Builder", included: true },
      { text: "Unlimited ideas", included: true },
      { text: "API access & keys", included: true },
      { text: "JSON & CSV export", included: true },
      { text: "Team sharing (coming soon)", included: true },
      { text: "Priority support", included: true },
    ],
    cta: "Contact Us",
    highlighted: false,
    priceKey: { monthly: "enterprise_monthly", annual: "enterprise_yearly" },
    ctaAction: "contact",
  },
];

/* ------------------------------------------------------------------ */
/*  Icons                                                             */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatPrice(price: number): string {
  if (price === 0) return "$0";
  if (Number.isInteger(price)) return `$${price}`;
  return `$${price.toFixed(2)}`;
}

const focusRingClasses =
  "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900";

/* ------------------------------------------------------------------ */
/*  Nav (standalone, matches LandingNav style)                        */
/* ------------------------------------------------------------------ */

function PricingNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileMenuOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen || !mobileMenuRef.current) return;
    const menuElement = mobileMenuRef.current;
    const focusableSelectors =
      'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])';
    const focusableElements =
      menuElement.querySelectorAll<HTMLElement>(focusableSelectors);
    if (focusableElements.length === 0) return;
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    firstFocusable.focus();
    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };
    document.addEventListener("keydown", handleTabTrap);
    return () => document.removeEventListener("keydown", handleTabTrap);
  }, [isMobileMenuOpen]);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
    hamburgerRef.current?.focus();
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 h-16 transition-colors duration-200 ${
          isScrolled
            ? "backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800"
            : "bg-transparent"
        }`}
      >
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6"
        >
          <Link
            href="/"
            className={`text-xl font-bold text-gray-900 dark:text-white rounded-md ${focusRingClasses}`}
          >
            ZeroToShip
          </Link>

          {/* Desktop */}
          <div className="hidden items-center gap-1 md:flex">
            <Link
              href="/login"
              className={`rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white ${focusRingClasses}`}
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className={`ml-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 ${focusRingClasses}`}
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            ref={hamburgerRef}
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="pricing-mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className={`inline-flex items-center justify-center rounded-md p-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white md:hidden ${focusRingClasses}`}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </nav>
      </header>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          id="pricing-mobile-menu"
          role="dialog"
          aria-label="Navigation menu"
          className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-gray-900 md:hidden"
        >
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              ZeroToShip
            </span>
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={closeMobileMenu}
              className={`inline-flex items-center justify-center rounded-md p-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white ${focusRingClasses}`}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-2 px-4 pt-4 sm:px-6">
            <Link
              href="/login"
              onClick={closeMobileMenu}
              className={`rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 ${focusRingClasses}`}
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={closeMobileMenu}
              className={`mt-2 rounded-lg bg-primary-600 px-4 py-3 text-center text-lg font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 ${focusRingClasses}`}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main content                                                      */
/* ------------------------------------------------------------------ */

export default function PricingPageContent() {
  const router = useRouter();
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [priceVisible, setPriceVisible] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setPriceVisible(false);
      timeoutRef.current = setTimeout(() => {
        setBilling(cycle);
        setPriceVisible(true);
      }, 150);
    },
    [billing],
  );

  async function handleCheckout(priceKey: string) {
    setCheckoutLoading(priceKey);
    try {
      const res = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceKey }),
      });

      if (res.status === 401) {
        const plan = priceKey.startsWith("pro") ? "pro" : "enterprise";
        router.push(`/signup?plan=${plan}`);
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      router.push("/signup?plan=pro");
    } finally {
      setCheckoutLoading(null);
    }
  }

  function handleCta(plan: Plan) {
    if (plan.ctaAction === "signup") {
      router.push("/signup");
    } else if (plan.ctaAction === "contact") {
      window.location.href = "mailto:hello@zerotoship.dev";
    } else if (plan.ctaAction === "checkout" && plan.priceKey) {
      const key =
        billing === "monthly" ? plan.priceKey.monthly : plan.priceKey.annual;
      handleCheckout(key);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PricingNav />

      {/* Spacer for fixed nav */}
      <div className="h-16" />

      {/* Main pricing content */}
      <section
        aria-labelledby="pricing-heading"
        className="flex-1 py-20 px-4"
      >
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <h1
            id="pricing-heading"
            className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4"
          >
            Simple Pricing, Serious Value
          </h1>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto text-lg">
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
              const isLoading =
                plan.priceKey !== null &&
                checkoutLoading ===
                  (billing === "monthly"
                    ? plan.priceKey.monthly
                    : plan.priceKey.annual);

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
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {plan.name}
                    </h2>
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
                    disabled={isLoading}
                    onClick={() => handleCta(plan)}
                    className={[
                      "w-full py-3 px-4 rounded-lg text-sm font-semibold transition-colors mb-8",
                      plan.highlighted
                        ? "bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
                        : "border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60",
                    ].join(" ")}
                  >
                    {isLoading ? "Redirecting..." : plan.cta}
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

          {/* Guarantee */}
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-10">
            All plans include a 14-day money-back guarantee.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} ZeroToShip. All rights reserved.
          </p>
          <div className="mt-3 flex justify-center gap-4 text-sm">
            <a
              href="#"
              className="hover:text-white transition-colors"
            >
              Privacy
            </a>
            <a
              href="#"
              className="hover:text-white transition-colors"
            >
              Terms
            </a>
            <a
              href="mailto:hello@zerotoship.dev"
              className="hover:text-white transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
