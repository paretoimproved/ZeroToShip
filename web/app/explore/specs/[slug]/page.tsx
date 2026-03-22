import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import LandingNav from "@/components/landing/LandingNav";
import Footer from "@/components/landing/Footer";
import { sampleAgentSpec } from "@/lib/sampleSpec";
import type { AgentSpec } from "@/lib/types";
import SpecShowcaseClient from "./SpecShowcaseClient";

/* ── Slug-to-spec map ─────────────────────────────────────────────────────── */

const specsBySlug: Record<string, AgentSpec> = {
  shipwatch: sampleAgentSpec,
};

/* ── Metadata ─────────────────────────────────────────────────────────────── */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const spec = specsBySlug[slug];
  if (!spec) return {};

  const title = `${spec.projectName} — Agent-Ready Spec | ZeroToShip`;
  const description = spec.problem;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function trendLabel(trend: "rising" | "stable" | "falling"): string {
  switch (trend) {
    case "rising":
      return "Rising";
    case "stable":
      return "Stable";
    case "falling":
      return "Falling";
  }
}

function trendColor(trend: "rising" | "stable" | "falling"): string {
  switch (trend) {
    case "rising":
      return "text-green-600 dark:text-green-400";
    case "stable":
      return "text-amber-600 dark:text-amber-400";
    case "falling":
      return "text-red-600 dark:text-red-400";
  }
}

/* ── JSON-LD structured data ──────────────────────────────────────────────── */

function buildJsonLd(spec: AgentSpec, slug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: spec.projectName,
    description: spec.problem,
    applicationCategory: "DeveloperApplication",
    url: `https://zerotoship.dev/explore/specs/${slug}`,
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default async function SpecShowcasePage({ params }: PageProps) {
  const { slug } = await params;
  const spec = specsBySlug[slug];

  if (!spec) {
    notFound();
  }

  const { evidence } = spec;

  return (
    <>
      <LandingNav />
      <main id="main-content" className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildJsonLd(spec, slug)),
          }}
        />

        {/* Context Header */}
        <section className="pt-28 pb-8 px-4">
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <li>
                  <Link
                    href="/explore"
                    className="hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Explore
                  </Link>
                </li>
                <li aria-hidden="true">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </li>
                <li>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {spec.projectName}
                  </span>
                </li>
              </ol>
            </nav>

            {/* Title + provenance */}
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
              {spec.projectName}
            </h1>
            <p className="mt-3 text-lg text-gray-600 dark:text-gray-400 max-w-3xl">
              {spec.problem}
            </p>

            {/* Provenance badges */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {evidence.sourceCount} sources
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Signal: {evidence.signalScore}/100
              </span>
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 ${trendColor(evidence.trend)}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  {evidence.trend === "rising" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  ) : evidence.trend === "falling" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
                  )}
                </svg>
                Trend: {trendLabel(evidence.trend)}
              </span>
            </div>

            {/* Source idea reference */}
            <div className="mt-6 p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Generated from validated idea signals across{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {evidence.platforms.join(", ")}
                </span>
              </p>
              <Link
                href="/explore"
                className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                Browse all ideas
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* Agent Spec Display */}
        <section className="max-w-4xl mx-auto px-4 pb-12">
          <SpecShowcaseClient spec={spec} />
        </section>

        {/* Free-first CTA */}
        <section className="bg-gray-900 dark:bg-gray-800 py-16 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Like What You See?
            </h2>
            <p className="text-gray-300 mb-4 text-lg">
              Sign up free to generate your first agent-ready spec from any idea.
              Hand it to Claude Code or Cursor and start building in minutes.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center rounded-lg bg-primary-600 px-8 py-3 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              Get Started Free
            </Link>
            <p className="mt-4 text-sm text-gray-400">
              Want more?{" "}
              <Link
                href="/pricing"
                className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
              >
                Pro gives you 30 specs/month
              </Link>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
