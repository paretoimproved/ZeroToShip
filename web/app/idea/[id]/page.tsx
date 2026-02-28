"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import IdeaBriefCard from "@/components/IdeaBriefCard";
import AgentSpecDisplay, { formatSpecAsMarkdown } from "@/components/AgentSpecDisplay";
import GenerateSpecCta from "@/components/GenerateSpecCta";
import ProtectedLayout from "@/components/ProtectedLayout";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { trackIdeaViewed } from "@/lib/analytics";
import type { IdeaBrief, AgentSpec } from "@/lib/types";

// Mock data for fallback when API is unavailable
const mockBrief: IdeaBrief = {
  id: "1",
  name: "DevOps Dashboard",
  tagline: "Unified monitoring for indie developers",
  priorityScore: 87,
  effortEstimate: "weekend",
  revenueEstimate: "$5K-15K per month",
  problemStatement:
    "Solo developers and small teams struggle to monitor multiple services across different cloud providers. Enterprise tools like Datadog and New Relic are expensive ($100+/month) and overkill for simple projects. Developers end up either ignoring monitoring entirely or cobbling together free tiers from multiple services, leading to alert fatigue and missed issues.",
  targetAudience:
    "Indie hackers, solo developers, and small development teams (2-5 people) running side projects or early-stage startups. They typically have 3-10 services to monitor across 1-3 cloud providers.",
  marketSize:
    "$2B developer tools market. Estimated 5M+ indie developers worldwide, with 500K+ actively running production services.",
  existingSolutions:
    "Datadog (enterprise, $15+/host/month), New Relic (complex, expensive), Grafana Cloud (free tier limited), Better Uptime (monitoring only), Checkly (synthetic monitoring focus)",
  gaps: "No affordable all-in-one solution for small teams. Existing tools require significant setup time. Free tiers are heavily limited. Most tools assume enterprise scale and budgets.",
  proposedSolution:
    "A simple, affordable monitoring dashboard that aggregates metrics from multiple cloud providers in one place. One-click integrations, sensible defaults, and pricing that makes sense for indie developers.",
  keyFeatures: [
    "Multi-cloud support (AWS, GCP, Vercel, Railway, Render)",
    "One-click setup with pre-configured dashboards",
    "Smart alerting with noise reduction",
    "Affordable pricing starting at $9/month",
    "Mobile app for on-the-go monitoring",
  ],
  mvpScope:
    "Focus on 3 integrations (Vercel, Railway, AWS Lambda), basic metrics dashboard, email/Slack alerts. Skip mobile app and advanced analytics for v1.",
  technicalSpec: {
    stack: ["Next.js", "PostgreSQL", "Redis", "Tailwind CSS", "Vercel"],
    architecture:
      "Serverless architecture on Vercel with edge functions for low-latency metric ingestion. PostgreSQL for metric storage (time-series optimized). Redis for real-time alerting and rate limiting.",
    estimatedEffort: "weekend",
  },
  businessModel: {
    pricing:
      "$9/mo Hobby (5 services, 7-day retention), $29/mo Pro (unlimited services, 30-day retention, priority support)",
    revenueProjection:
      "Target 100 paying users in month 1 ($1K per month), 500 users by month 6 ($10K per month)",
    monetizationPath:
      "Free tier with 2 services and 1-day retention to drive adoption. Convert to paid through retention limits and service count.",
  },
  goToMarket: {
    launchStrategy:
      "Product Hunt launch with Indie Hackers cross-post. Focus on building in public to attract target audience.",
    channels: ["Indie Hackers", "Reddit r/SideProject", "Dev.to", "Hacker News"],
    firstCustomers:
      "Reach out to indie hackers on Reddit and Hacker News who have complained about monitoring costs. Offer lifetime deals to first 50 customers for testimonials.",
  },
  risks: [
    "Competition from free tools and generous free tiers",
    "Cloud provider API changes could break integrations",
    "Scaling costs if metric volume grows faster than revenue",
    "Enterprise players could launch indie-focused tiers",
  ],
  sources: [
    { platform: 'reddit', title: 'Why is monitoring so expensive?', url: 'https://reddit.com/r/devops/example', score: 234, commentCount: 89, postedAt: new Date().toISOString() },
    { platform: 'hn', title: 'Ask HN: Affordable monitoring for side projects?', url: 'https://news.ycombinator.com/item?id=example', score: 156, commentCount: 67, postedAt: new Date().toISOString() },
  ],
  generatedAt: new Date().toISOString(),
};

export default function IdeaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [brief, setBrief] = useState<IdeaBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [spec, setSpec] = useState<AgentSpec | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [specUsage, setSpecUsage] = useState<{ used: number; limit: number } | null>(null);
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    async function fetchIdea() {
      if (!isAuthenticated) return;
      try {
        const data = await api.getIdea(id);
        setBrief(data);
        trackIdeaViewed({
          ideaId: data.id,
          source: "detail_page",
          score: data.priorityScore,
        });
      } catch (error) {
        console.log("API unavailable, using mock data:", error);
        setBrief({ ...mockBrief, id });
      } finally {
        setLoading(false);
      }
    }

    fetchIdea();
  }, [id, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.getSpecUsage().then(setSpecUsage).catch(() => {});
  }, [isAuthenticated]);

  function copySpecToClipboard() {
    if (!spec) return;
    const markdown = formatSpecAsMarkdown(spec);
    navigator.clipboard.writeText(markdown);
  }

  return (
    <ProtectedLayout>
      <main id="main-content" className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <h1 className="sr-only">{brief ? brief.name : "Idea Details"}</h1>
        {loading ? (
          <>
            {/* Back link skeleton */}
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-6 animate-pulse" />

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden animate-pulse">
              {/* Header skeleton */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-3">
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
                {[1, 2, 3, 4, 5].map((j) => (
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
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
              </div>
            </div>
          </>
        ) : !brief ? null : (
          <>
            <Link
              href="/dashboard"
              className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 mb-6 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Today&apos;s Ideas
            </Link>

            <IdeaBriefCard
              brief={brief}
              gated={!isAuthenticated}
              specCta={
                <GenerateSpecCta
                  ideaId={brief.id}
                  ideaName={brief.name}
                  isAuthenticated={isAuthenticated}
                  userTier={user?.tier}
                  specUsage={specUsage ?? undefined}
                  onSpecGenerated={(newSpec, id) => {
                    setSpec(newSpec);
                    setGenerationId(id);
                    setSpecUsage((prev) => prev ? { ...prev, used: prev.used + 1 } : prev);
                  }}
                />
              }
            />

            {spec && (
              <div className="mt-8">
                <AgentSpecDisplay spec={spec} onCopy={copySpecToClipboard} />
                {generationId && (
                  <div className="mt-4 text-center">
                    <Link
                      href={`/specs/${generationId}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                    >
                      View in My Specs
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </ProtectedLayout>
  );
}
