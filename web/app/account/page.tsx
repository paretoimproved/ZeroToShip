"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import ProtectedLayout from "@/components/ProtectedLayout";
import { Spinner } from "@/components/icons";
import {
  createCheckoutSession,
  openBillingPortal,
  type PriceKey,
} from "@/lib/billing";
import { trackUpgradeClicked } from "@/lib/analytics";

interface Subscription {
  id: string;
  plan: "free" | "pro" | "enterprise";
  status: "active" | "canceled" | "past_due";
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

type EmailFrequency = "daily" | "weekly" | "never";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    priceKey: null as PriceKey | null,
    features: [
      "Top 3 ideas daily",
      "Basic brief summaries",
      "7-day archive access",
      "Email digest (weekly)",
    ],
    cta: "Free Forever",
  },
  {
    id: "pro",
    name: "Builder",
    price: "$19",
    period: "per month",
    priceKey: "pro_monthly" as PriceKey,
    yearlyPriceKey: "pro_yearly" as PriceKey,
    yearlyPrice: "$190/year (save 2 months)",
    features: [
      "All 10 daily ideas",
      "Full business briefs",
      "Unlimited archive access",
      "Daily email digest",
      "Export to PDF/Notion",
      "Priority support",
    ],
    cta: "Upgrade to Builder",
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$99",
    period: "per month",
    priceKey: "enterprise_monthly" as PriceKey,
    yearlyPriceKey: "enterprise_yearly" as PriceKey,
    yearlyPrice: "$990/year (save 2 months)",
    features: [
      "Everything in Builder",
      "Custom idea categories",
      "API access",
      "Team sharing (up to 10)",
      "White-label reports",
      "Dedicated support",
    ],
    cta: "Upgrade to Enterprise",
  },
];

const TIER_LABELS: Record<Subscription["plan"], string> = {
  free: "Free",
  pro: "Builder",
  enterprise: "Enterprise",
};

function getTierLabel(plan: Subscription["plan"]): string {
  return TIER_LABELS[plan];
}

function AccountPageContent() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [billingYearly, setBillingYearly] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const apiKeyDialogRef = useRef<HTMLDialogElement>(null);
  const searchParams = useSearchParams();
  const [showSuccess, setShowSuccess] = useState(false);
  const [successPlan, setSuccessPlan] = useState("");
  const [emailFrequency, setEmailFrequency] = useState<EmailFrequency>("daily");
  const [emailPreferenceUpdating, setEmailPreferenceUpdating] = useState(false);

  // Fetch subscription on mount
  useEffect(() => {
    async function fetchSubscription() {
      try {
        const sub = await api.getSubscription();
        setSubscription(sub);
      } catch (err) {
        // If no subscription found, default to free
        setSubscription({
          id: "",
          plan: "free",
          status: "active",
          cancelAtPeriodEnd: false,
        });
      } finally {
        setLoading(false);
      }
    }
    fetchSubscription();
  }, []);

  useEffect(() => {
    async function fetchEmailFrequency() {
      try {
        const user = await api.getCurrentUser();
        if (user.preferences?.emailFrequency) {
          setEmailFrequency(user.preferences.emailFrequency as EmailFrequency);
        }
      } catch {
        // Keep default if user fetch fails
      }
    }

    fetchEmailFrequency();
  }, []);

  // Detect checkout success and poll for subscription update
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;

    setShowSuccess(true);

    // Poll for subscription update (handles webhook race condition)
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const sub = await api.getSubscription();
        if (sub.plan !== "free") {
          setSubscription(sub);
          setSuccessPlan(getTierLabel(sub.plan));
          clearInterval(poll);
        }
      } catch {
        /* ignore polling errors */
      }
      if (attempts >= 10) clearInterval(poll);
    }, 2000);

    // Clean session_id from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", url.pathname + url.search);

    return () => clearInterval(poll);
  }, [searchParams]);

  const handleUpgrade = async (priceKey: PriceKey) => {
    setUpgradeLoading(priceKey);
    setError(null);
    try {
      const toTier = priceKey.startsWith("pro") ? "pro" : "enterprise";
      const fromTier = (subscription?.plan ?? "free") as
        | "free"
        | "pro"
        | "enterprise";
      trackUpgradeClicked({
        from_tier: fromTier,
        to_tier: toTier,
        location: "account_page",
      });
      await createCheckoutSession(priceKey);
      // Redirect happens in createCheckoutSession
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
      setUpgradeLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setError(null);
    try {
      await openBillingPortal();
      // Redirect happens in openBillingPortal
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to open billing portal"
      );
    }
  };

  const handleEmailSubscriptionToggle = async () => {
    const nextFrequency: EmailFrequency =
      emailFrequency === "never" ? "daily" : "never";

    setError(null);
    setEmailPreferenceUpdating(true);

    try {
      const updatedUser = await api.updatePreferences({
        emailFrequency: nextFrequency,
      });
      const savedFrequency =
        updatedUser.preferences?.emailFrequency ?? nextFrequency;
      setEmailFrequency(savedFrequency as EmailFrequency);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update email preferences"
      );
    } finally {
      setEmailPreferenceUpdating(false);
    }
  };

  if (loading) {
    return (
      <ProtectedLayout>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-8">
          <div>
            <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg w-40 mb-3"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
            <div className="p-6 space-y-4">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 space-y-4">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                </div>
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </ProtectedLayout>
    );
  }

  const currentPlan = (subscription?.plan ?? "free") as
    | "free"
    | "pro"
    | "enterprise";
  const currentPlanLabel = getTierLabel(currentPlan);
  const isEmailUnsubscribed = emailFrequency === "never";

  return (
    <ProtectedLayout>
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl mb-2">
          Account
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your subscription and billing
        </p>
      </header>

      {showSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">
                Welcome to {successPlan || "your new plan"}!
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Your subscription is active. Enjoy your new features.
              </p>
            </div>
            <button
              onClick={() => setShowSuccess(false)}
              className="ml-auto text-green-500 hover:text-green-700"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Current Plan Status */}
      <div className="overflow-hidden rounded-xl mb-8">
        <div className="h-1 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600" />
        <section className="bg-white dark:bg-gray-800 p-6 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Current Plan
          </h2>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {currentPlanLabel}
                </span>
                {subscription && (
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      subscription.status === "active"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : subscription.status === "past_due"
                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {subscription.status.replace("_", " ")}
                  </span>
                )}
              </div>
              {subscription?.currentPeriodEnd && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {subscription.cancelAtPeriodEnd
                    ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                    : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                </p>
              )}
            </div>

            {currentPlan !== "free" && (
              <button
                onClick={handleManageBilling}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                Manage Subscription
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center mb-6">
        <div role="radiogroup" aria-label="Billing cycle" className="inline-flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-full">
          <button
            type="button"
            role="radio"
            aria-checked={!billingYearly}
            onClick={() => setBillingYearly(false)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              !billingYearly
                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={billingYearly}
            onClick={() => setBillingYearly(true)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all inline-flex items-center gap-2 ${
              billingYearly
                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            Annual
            <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-semibold px-2 py-0.5 rounded-full">
              Save 2 months
            </span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Available Plans
        </h2>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const priceKey = billingYearly
              ? plan.yearlyPriceKey || plan.priceKey
              : plan.priceKey;
            const isLoading = priceKey !== null && upgradeLoading === priceKey;

            return (
              <div
                key={plan.id}
                className={[
                  "relative bg-white dark:bg-gray-900 rounded-2xl p-8",
                  plan.highlighted
                    ? "ring-2 ring-primary-500 shadow-xl order-first md:order-none"
                    : "border border-gray-200 dark:border-gray-700",
                ].join(" ")}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}

                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {plan.name}
                </h3>

                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {billingYearly && plan.yearlyPrice
                      ? plan.yearlyPrice.split("/")[0]
                      : plan.price}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    /{billingYearly && plan.yearlyPrice ? "year" : plan.period}
                  </span>
                </div>

                {billingYearly && plan.yearlyPrice && (
                  <p className="text-xs text-green-600 dark:text-green-400 mb-4">
                    Save 2 months with yearly billing
                  </p>
                )}

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, index) => (
                    <li
                      key={index}
                      className="flex items-start text-sm text-gray-700 dark:text-gray-300"
                    >
                      <svg
                        className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => priceKey && handleUpgrade(priceKey)}
                  disabled={isCurrentPlan || !priceKey || isLoading}
                  className={`w-full py-2.5 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                    isCurrentPlan
                      ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-default"
                      : plan.highlighted
                      ? "bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                      : "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 disabled:opacity-50"
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner className="h-4 w-4" />
                      Processing...
                    </span>
                  ) : isCurrentPlan ? (
                    "Current Plan"
                  ) : (
                    plan.cta
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Billing Portal Link */}
      {currentPlan !== "free" && (
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Billing & Invoices
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-4">
            View invoices, update payment methods, or cancel your subscription
            through the billing portal.
          </p>

          <button
            onClick={handleManageBilling}
            className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            Open Billing Portal
          </button>
        </section>
      )}

      {/* Email Subscription */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Email Subscription
        </h2>

        <p className="text-gray-600 dark:text-gray-400 mb-2">
          Stop all ZeroToShip digest emails. You can turn them back on anytime.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Status: {isEmailUnsubscribed ? "Unsubscribed" : "Subscribed"}
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleEmailSubscriptionToggle}
            disabled={emailPreferenceUpdating}
            className={`rounded-lg px-6 py-3 text-sm font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-60 ${
              isEmailUnsubscribed
                ? "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500"
                : "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
            }`}
          >
            {emailPreferenceUpdating ? (
              <span className="flex items-center gap-2">
                <Spinner className="h-4 w-4" />
                Saving...
              </span>
            ) : isEmailUnsubscribed ? (
              "Resume Emails"
            ) : (
              "Unsubscribe from Emails"
            )}
          </button>

          <a
            href="/settings"
            className="rounded-lg bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            Manage in Settings
          </a>
        </div>
      </section>

      {/* API Keys */}
      <section
        data-testid="api-keys-section"
        className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mt-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            API Keys
          </h2>
        </div>

        <div data-testid="api-key-list">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No API keys yet. Create your first API key to get started.
          </p>
        </div>

        <button
          onClick={() => {
            setShowApiKeyDialog(true);
            setTimeout(() => apiKeyDialogRef.current?.showModal(), 0);
          }}
          className="mt-4 rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          Create API Key
        </button>

        {showApiKeyDialog && (
          <dialog
            ref={apiKeyDialogRef}
            data-testid="api-key-dialog"
            className="rounded-2xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 backdrop:bg-black/50 max-w-md w-full shadow-xl"
            onClose={() => {
              setShowApiKeyDialog(false);
              setNewKeyName("");
            }}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New API Key
            </h3>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Key Name
            </label>
            <input
              type="text"
              name="name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. Production Key"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors mb-4"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  apiKeyDialogRef.current?.close();
                  setShowApiKeyDialog(false);
                  setNewKeyName("");
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newKeyName.trim()) return;
                  try {
                    const token = localStorage.getItem('zerotoship_token');
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
                    const response = await fetch(`${apiUrl}/user/api-keys`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({ name: newKeyName.trim() }),
                    });
                    if (!response.ok) {
                      const err = await response.json().catch(() => ({ message: 'Failed to create API key' }));
                      throw new Error(err.message);
                    }
                    const result = await response.json();
                    alert(`API Key created! Save this key - you won't see it again:\n\n${result.key}`);
                    apiKeyDialogRef.current?.close();
                    setShowApiKeyDialog(false);
                    setNewKeyName("");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to create API key');
                    apiKeyDialogRef.current?.close();
                    setShowApiKeyDialog(false);
                    setNewKeyName("");
                  }
                }}
                className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                Create
              </button>
            </div>
          </dialog>
        )}
      </section>
    </div>
    </ProtectedLayout>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 sm:px-6 py-8"><Spinner /></div>}>
      <AccountPageContent />
    </Suspense>
  );
}
