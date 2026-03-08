import type { Metadata } from "next";
import Link from "next/link";
import LandingNav from "@/components/landing/LandingNav";
import Footer from "@/components/landing/Footer";
import ExploreGrid from "@/components/explore/ExploreGrid";
import type { IdeaBrief, EffortLevel } from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export const metadata: Metadata = {
  title: "Explore Startup Ideas - ZeroToShip",
  description:
    "Browse hundreds of AI-scored startup ideas sourced from Reddit, Hacker News, and GitHub. Updated daily with fresh opportunities.",
  openGraph: {
    title: "Explore Startup Ideas — ZeroToShip",
    description:
      "Hundreds of scored startup ideas updated daily. Find your next project.",
    type: "website",
  },
};

interface IdeaSummary {
  id: string;
  name: string;
  tagline: string;
  priorityScore: number;
  effortEstimate: EffortLevel;
  revenueEstimate: string;
  generatedAt?: string;
  brief?: IdeaBrief;
}

async function fetchIdeas(): Promise<IdeaSummary[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/ideas/archive?pageSize=50&sort=top-scored`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || data.ideas || [];
  } catch {
    return [];
  }
}

export default async function ExplorePage() {
  const ideas = await fetchIdeas();

  return (
    <>
      <LandingNav />
      <main id="main-content" className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* Hero */}
        <section className="pt-28 pb-12 px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
              Startup Ideas Worth Building
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Updated daily from Reddit, Hacker News, and GitHub. Each idea is
              AI-scored for opportunity, effort, and revenue potential.
            </p>
          </div>
        </section>

        {/* Idea Grid */}
        <section className="max-w-6xl mx-auto px-4 pb-16">
          <ExploreGrid ideas={ideas} />
        </section>

        {/* CTA */}
        <section className="bg-gray-900 dark:bg-gray-800 py-16 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Get Fresh Ideas Daily
            </h2>
            <p className="text-gray-300 mb-8 text-lg">
              Sign up to get 10 new scored ideas delivered to your inbox every
              morning, save your favorites, and generate agent-ready specs you
              can hand to Claude Code or Cursor.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center rounded-lg bg-primary-600 px-8 py-3 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              Start Free
            </Link>
          </div>
        </section>

        {/* SEO Content */}
        <section className="max-w-4xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            What Are AI-Scored Startup Ideas?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Every day, ZeroToShip scrapes hundreds of posts from Reddit, Hacker
            News, and GitHub to find real problems people are talking about. Our
            AI clusters similar complaints, scores them by frequency, severity,
            and market size, then generates complete startup idea briefs — each
            with a priority score from 0 to 100. Higher scores mean bigger
            opportunities with clearer demand signals.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            How We Find Startup Opportunities
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Instead of guessing what to build, we listen to what people
            actually need. Our pipeline monitors 8+ subreddits, all of Hacker
            News, and trending GitHub issues daily. When the same pain point
            shows up across multiple communities, that&apos;s a signal worth
            paying attention to. Each idea includes effort estimates, revenue
            projections, and a suggested tech stack so you can go from concept
            to code faster.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            From Idea to Launch
          </h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Browse the ideas above to find SaaS ideas, developer tool concepts,
            and weekend project inspiration. Each idea page includes a full
            business brief with market analysis, competitive landscape, MVP
            scope, and go-to-market strategy. Whether you&apos;re looking for
            your next side project or a venture-scale startup idea, ZeroToShip
            helps you ship ideas, not guesses.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
