"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import {
  createCheckoutSession,
  openBillingPortal,
  type PriceKey,
} from "@/lib/billing";

interface Subscription {
  id: string;
  plan: "free" | "pro" | "enterprise";
  status: "active" | "canceled" | "past_due";
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

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
    cta: "Current Plan",
  },
  {
    id: "pro",
    name: "Pro",
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
    cta: "Upgrade to Pro",
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
      "Everything in Pro",
      "Custom idea categories",
      "API access",
      "Team sharing (up to 10)",
      "White-label reports",
      "Dedicated support",
    ],
    cta: "Upgrade to Enterprise",
  },
];

export default function AccountPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [billingYearly, setBillingYearly] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const apiKeyDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setIsAuth(isAuthenticated());
  }, []);

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

  const handleUpgrade = async (priceKey: PriceKey) => {
    setUpgradeLoading(priceKey);
    setError(null);
    try {
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

  if (!isAuth) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Account
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Sign in to manage your account and subscription.
        </p>
        <Link
          href="/signup"
          className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Sign Up
        </Link>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
            Sign In
          </Link>
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-8"></div>
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded mb-8"></div>
        </div>
      </div>
    );
  }

  const currentPlan = subscription?.plan || "free";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Account
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your subscription and billing
        </p>
      </header>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Current Plan Status */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Current Plan
        </h2>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                {currentPlan}
              </span>
              {subscription && (
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
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
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Manage Subscription
            </button>
          )}
        </div>
      </section>

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <span
          className={`text-sm ${!billingYearly ? "text-gray-900 dark:text-white font-medium" : "text-gray-500"}`}
        >
          Monthly
        </span>
        <button
          onClick={() => setBillingYearly(!billingYearly)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            billingYearly ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              billingYearly ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span
          className={`text-sm ${billingYearly ? "text-gray-900 dark:text-white font-medium" : "text-gray-500"}`}
        >
          Yearly{" "}
          <span className="text-green-600 dark:text-green-400">
            (2 months free)
          </span>
        </span>
      </div>

      {/* Plans */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Available Plans
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const priceKey = billingYearly
              ? plan.yearlyPriceKey || plan.priceKey
              : plan.priceKey;
            const isLoading = upgradeLoading === priceKey;

            return (
              <div
                key={plan.id}
                className={`bg-white dark:bg-gray-800 rounded-xl p-6 border-2 ${
                  plan.highlighted
                    ? "border-primary-500"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                {plan.highlighted && (
                  <div className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-2">
                    MOST POPULAR
                  </div>
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
                  className={`w-full py-2 rounded-lg font-medium transition-colors ${
                    isCurrentPlan
                      ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-default"
                      : plan.highlighted
                      ? "bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                      : "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 disabled:opacity-50"
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
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
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Open Billing Portal
          </button>
        </section>
      )}

      {/* API Keys */}
      <section
        data-testid="api-keys-section"
        className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mt-8"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          API Keys
        </h2>

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
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Create API Key
        </button>

        {showApiKeyDialog && (
          <dialog
            ref={apiKeyDialogRef}
            data-testid="api-key-dialog"
            className="rounded-xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 backdrop:bg-black/50 max-w-md w-full"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  apiKeyDialogRef.current?.close();
                  setShowApiKeyDialog(false);
                  setNewKeyName("");
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newKeyName.trim()) return;
                  try {
                    const token = localStorage.getItem('ideaforge_token');
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
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Create
              </button>
            </div>
          </dialog>
        )}
      </section>
    </div>
  );
}
