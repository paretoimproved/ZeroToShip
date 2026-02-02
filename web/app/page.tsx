import IdeaCard from "@/components/IdeaCard";
import type { IdeaBrief } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

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

// Fetch ideas from API with fallback to mock data
async function getIdeas(): Promise<{ ideas: IdeaBrief[]; source: "api" | "mock" }> {
  try {
    const res = await fetch(`${API_URL}/ideas/today`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();

    // Map API response to full IdeaBrief format
    const ideas: IdeaBrief[] = data.ideas.map((idea: Record<string, unknown>) => ({
      id: idea.id,
      name: idea.name,
      tagline: idea.tagline,
      priorityScore: idea.priorityScore,
      effortEstimate: idea.effortEstimate || "week",
      revenueEstimate: idea.revenueEstimate || "TBD",
      problemStatement: idea.problemStatement || idea.tagline,
      targetAudience: idea.targetAudience || "TBD",
      marketSize: idea.marketSize || `${idea.category} market`,
      existingSolutions: idea.existingSolutions || "TBD",
      gaps: idea.gaps || "TBD",
      proposedSolution: idea.proposedSolution || idea.tagline,
      keyFeatures: idea.keyFeatures || [],
      mvpScope: idea.mvpScope || "TBD",
      technicalSpec: idea.technicalSpec || { stack: [], architecture: "TBD", estimatedEffort: "TBD" },
      businessModel: idea.businessModel || { pricing: "TBD", revenueProjection: "TBD", monetizationPath: "TBD" },
      goToMarket: idea.goToMarket || { launchStrategy: "TBD", channels: [], firstCustomers: "TBD" },
      risks: idea.risks || [],
      generatedAt: idea.generatedAt,
    }));

    return { ideas, source: "api" };
  } catch (error) {
    console.log("API unavailable, using mock data:", error);
    return { ideas: mockIdeas, source: "mock" };
  }
}

export default async function HomePage() {
  const { ideas, source } = await getIdeas();

  return (
    <div>
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
    </div>
  );
}
