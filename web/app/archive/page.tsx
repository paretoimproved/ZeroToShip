"use client";

import { useState, useEffect } from "react";
import IdeaCard from "@/components/IdeaCard";
import type { IdeaBrief, EffortLevel } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

const effortOptions: { value: EffortLevel | "all"; label: string }[] = [
  { value: "all", label: "All Efforts" },
  { value: "weekend", label: "Weekend" },
  { value: "week", label: "1 Week" },
  { value: "month", label: "1 Month" },
  { value: "quarter", label: "Quarter+" },
];

export default function ArchivePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [effortFilter, setEffortFilter] = useState<EffortLevel | "all">("all");
  const [minScore, setMinScore] = useState(0);
  const [ideas, setIdeas] = useState<IdeaBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function fetchArchive() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set("q", searchQuery);
        if (effortFilter !== "all") params.set("effort", effortFilter);
        if (minScore > 0) params.set("minScore", minScore.toString());
        params.set("pageSize", "50");

        const res = await fetch(`${API_URL}/ideas/archive?${params.toString()}`);
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = await res.json();

        const mapped: IdeaBrief[] = (data.data || data.ideas || []).map(
          (idea: Record<string, unknown>) => ({
            id: idea.id,
            name: idea.name,
            tagline: idea.tagline,
            priorityScore: idea.priorityScore,
            effortEstimate: idea.effortEstimate || "week",
            revenueEstimate: idea.revenueEstimate || "TBD",
            problemStatement: idea.problemStatement || idea.tagline,
            targetAudience: idea.targetAudience || "TBD",
            marketSize: idea.marketSize || "TBD",
            existingSolutions: idea.existingSolutions || "TBD",
            gaps: idea.gaps || "TBD",
            proposedSolution: idea.proposedSolution || idea.tagline,
            keyFeatures: idea.keyFeatures || [],
            mvpScope: idea.mvpScope || "TBD",
            technicalSpec: idea.technicalSpec || {
              stack: [],
              architecture: "TBD",
              estimatedEffort: "TBD",
            },
            businessModel: idea.businessModel || {
              pricing: "TBD",
              revenueProjection: "TBD",
              monetizationPath: "TBD",
            },
            goToMarket: idea.goToMarket || {
              launchStrategy: "TBD",
              channels: [],
              firstCustomers: "TBD",
            },
            risks: idea.risks || [],
            generatedAt: idea.generatedAt,
          })
        );

        setIdeas(mapped);
        setTotal(data.total ?? mapped.length);
      } catch (err) {
        console.error("Failed to fetch archive:", err);
        setError("Failed to load archive. Please try again later.");
        setIdeas([]);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(fetchArchive, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, effortFilter, minScore]);

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Idea Archive
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Browse past ideas and find hidden gems
        </p>
      </header>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search ideas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="effort"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Effort Level
            </label>
            <select
              id="effort"
              value={effortFilter}
              onChange={(e) => setEffortFilter(e.target.value as EffortLevel | "all")}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {effortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="score"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Min Score: {minScore}
            </label>
            <input
              id="score"
              type="range"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Results */}
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
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => setMinScore((s) => s)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>

          {ideas.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No ideas match your filters. Try adjusting your search criteria.
              </p>
            </div>
          )}

          {ideas.length > 0 && (
            <div className="mt-8 flex justify-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {ideas.length} of {total} ideas
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
