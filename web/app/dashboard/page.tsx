"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import IdeaBriefCard from "@/components/IdeaBriefCard";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import type { IdeaBrief } from "@/lib/types";

// Mock data for fallback when API is unavailable
const mockIdeas: IdeaBrief[] = [
  {
    id: "mock-1",
    name: "DevOps Dashboard",
    tagline: "Unified monitoring for indie developers",
    priorityScore: 87,
    effortEstimate: "weekend",
    revenueEstimate: "$5K-15K MRR",
    problemStatement:
      "Solo developers and small teams struggle to monitor multiple services across different cloud providers without expensive enterprise tools.",
    targetAudience: "Indie hackers and small dev teams",
    marketSize: "$2B developer tools market",
    existingSolutions: "Datadog, New Relic, Grafana",
    gaps: "Too expensive for solo devs, complex setup, overkill features",
    proposedSolution: "Simple, affordable monitoring dashboard",
    keyFeatures: ["Multi-cloud support", "One-click setup", "Affordable pricing"],
    mvpScope: "Basic metrics, alerts, 3 integrations",
    technicalSpec: {
      stack: ["Next.js", "PostgreSQL", "Redis"],
      architecture: "Serverless with edge functions",
      estimatedEffort: "2 weekends",
    },
    businessModel: {
      pricing: "$9/mo hobby, $29/mo pro",
      revenueProjection: "$10K MRR in 6 months",
      monetizationPath: "Freemium to paid",
    },
    goToMarket: {
      launchStrategy: "Product Hunt + Indie Hackers",
      channels: ["Twitter", "Reddit", "Dev.to"],
      firstCustomers: "Indie hackers on Twitter",
    },
    risks: ["Competition from free tools", "Pricing pressure"],
    generatedAt: new Date().toISOString(),
  },
];

export default function HomePage() {
  const [ideas, setIdeas] = useState<IdeaBrief[]>([]);
  const [source, setSource] = useState<"api" | "mock" | null>(null);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    async function fetchIdeas() {
      try {
        const data = await api.getTodayIdeas();

        // getTodayIdeas returns { ideas: IdeaSummary[] } where each summary
        // has an optional `brief` field with the full data (pro/enterprise only)
        type IdeaSummaryResponse = IdeaBrief & { brief?: IdeaBrief };
        type ApiResponse = IdeaSummaryResponse[] | { ideas: IdeaSummaryResponse[] };
        const response = data as unknown as ApiResponse;
        const raw: IdeaSummaryResponse[] = Array.isArray(response) ? response : response.ideas ?? [];

        // Unwrap: if the summary has a nested `brief`, merge it into the top level
        const ideas: IdeaBrief[] = raw.map((d) => {
          const brief = d.brief || d;
          return {
            ...brief,
            id: d.id || brief.id,
            name: d.name || brief.name,
            tagline: d.tagline || brief.tagline,
            priorityScore: d.priorityScore ?? brief.priorityScore,
            effortEstimate: d.effortEstimate || brief.effortEstimate || "week",
            generatedAt: d.generatedAt || brief.generatedAt,
          };
        });

        setIdeas(ideas);
        setSource("api");
      } catch (error) {
        console.log("API unavailable, using mock data:", error);
        setIdeas(mockIdeas);
        setSource("mock");
      } finally {
        setLoading(false);
      }
    }

    fetchIdeas();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl mb-2">
          Today&apos;s Top Ideas
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          {source === "mock" && (
            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1 text-xs font-medium text-yellow-800 dark:text-yellow-300">
              Demo data
            </span>
          )}
          {source === "api" && (
            <span className="ml-2 inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-medium text-green-800 dark:text-green-300">
              Live data
            </span>
          )}
        </p>
      </header>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden animate-pulse"
            >
              {/* Header skeleton */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  </div>
                </div>
              </div>
              {/* Tab bar skeleton */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 px-4 gap-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded my-3" />
                ))}
              </div>
              {/* Panel skeleton */}
              <div className="p-6 space-y-4">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mt-6" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {ideas.map((idea, index) => (
              <IdeaBriefCard
                key={idea.id}
                brief={idea}
                rank={index + 1}
                index={index}
                gated={!isAuthenticated}
              />
            ))}
          </div>

          {ideas.length === 0 && (
            <div className="text-center py-16">
              <svg
                className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.37m5.96 6a14.926 14.926 0 01-5.84 2.58m0 0a14.926 14.926 0 01-5.96-6 14.98 14.98 0 006.16-12.12m5.64 18.12a6 6 0 01-5.84-7.38"
                />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                No ideas yet
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Check back tomorrow or browse the archive for past ideas.
              </p>
              <div className="mt-6">
                <Link
                  href="/archive"
                  className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                >
                  Browse Archive
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
