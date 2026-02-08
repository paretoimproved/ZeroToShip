"use client";

import { useState, useEffect } from "react";
import IdeaCard from "@/components/IdeaCard";
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

  useEffect(() => {
    async function fetchIdeas() {
      try {
        const data = await api.getTodayIdeas();

        // getTodayIdeas returns the full response; extract ideas array
        const ideas = Array.isArray(data) ? data : (data as unknown as { ideas: IdeaBrief[] }).ideas ?? [];

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
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
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
            <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
              Using mock data (API unavailable)
            </span>
          )}
          {source === "api" && (
            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              Live data
            </span>
          )}
        </p>
      </header>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 animate-pulse"
            >
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {ideas.map((idea, index) => (
              <IdeaCard key={idea.id} idea={idea} rank={index + 1} />
            ))}
          </div>

          {ideas.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No ideas generated yet. Check back tomorrow!
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
