"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import BriefView from "@/components/BriefView";
import { isAuthenticated } from "@/lib/auth";
import type { IdeaBrief } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

// Mock data for fallback when API is unavailable
const mockBrief: IdeaBrief = {
  id: "1",
  name: "DevOps Dashboard",
  tagline: "Unified monitoring for indie developers",
  priorityScore: 87,
  effortEstimate: "weekend",
  revenueEstimate: "$5K-15K MRR",
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
      "Target 100 paying users in month 1 ($1K MRR), 500 users by month 6 ($10K MRR)",
    monetizationPath:
      "Free tier with 2 services and 1-day retention to drive adoption. Convert to paid through retention limits and service count.",
  },
  goToMarket: {
    launchStrategy:
      "Soft launch on Twitter to build waitlist, then Product Hunt launch with Indie Hackers cross-post. Focus on building in public to attract target audience.",
    channels: ["Twitter/X", "Indie Hackers", "Reddit r/SideProject", "Dev.to", "Hacker News"],
    firstCustomers:
      "Reach out to indie hackers on Twitter who have complained about monitoring costs. Offer lifetime deals to first 50 customers for testimonials.",
  },
  risks: [
    "Competition from free tools and generous free tiers",
    "Cloud provider API changes could break integrations",
    "Scaling costs if metric volume grows faster than revenue",
    "Enterprise players could launch indie-focused tiers",
  ],
  generatedAt: new Date().toISOString(),
};

export default function IdeaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [brief, setBrief] = useState<IdeaBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    setIsAuth(isAuthenticated());
  }, []);

  useEffect(() => {
    async function fetchIdea() {
      try {
        const res = await fetch(`${API_URL}/ideas/${id}`);
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = await res.json();

        const idea: IdeaBrief = {
          id: data.id,
          name: data.name,
          tagline: data.tagline,
          priorityScore: data.priorityScore,
          effortEstimate: data.effortEstimate || "week",
          revenueEstimate: data.revenueEstimate || "TBD",
          problemStatement: data.problemStatement || data.tagline,
          targetAudience: data.targetAudience || "TBD",
          marketSize: data.marketSize || "TBD",
          existingSolutions: data.existingSolutions || "TBD",
          gaps: data.gaps || "TBD",
          proposedSolution: data.proposedSolution || data.tagline,
          keyFeatures: data.keyFeatures || [],
          mvpScope: data.mvpScope || "TBD",
          technicalSpec: data.technicalSpec || { stack: [], architecture: "TBD", estimatedEffort: "TBD" },
          businessModel: data.businessModel || { pricing: "TBD", revenueProjection: "TBD", monetizationPath: "TBD" },
          goToMarket: data.goToMarket || { launchStrategy: "TBD", channels: [], firstCustomers: "TBD" },
          risks: data.risks || [],
          generatedAt: data.generatedAt,
        };

        setBrief(idea);
      } catch (error) {
        console.log("API unavailable, using mock data:", error);
        setBrief({ ...mockBrief, id });
      } finally {
        setLoading(false);
      }
    }

    fetchIdea();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-6 animate-pulse" />
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            </div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 animate-pulse"
              >
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!brief) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-6"
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

      <BriefView brief={brief} gated={!isAuth} />
    </div>
  );
}
