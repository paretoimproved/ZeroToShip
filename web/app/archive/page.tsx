"use client";

import { useState, useEffect } from "react";
import IdeaBriefCard from "@/components/IdeaBriefCard";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import type { IdeaBrief, EffortLevel } from "@/lib/types";

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
  const { isAuthenticated } = useAuth();

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

        const data = await api.getArchive({ pageSize: 50 });

        // API returns { ideas: IdeaSummary[] } — unwrap nested brief field
        type IdeaSummaryResponse = IdeaBrief & { brief?: IdeaBrief };
        type ApiResponse = IdeaSummaryResponse[] | { ideas: IdeaSummaryResponse[]; data?: IdeaSummaryResponse[] };
        const response = data as unknown as ApiResponse;
        const rawItems: IdeaSummaryResponse[] = Array.isArray(response)
          ? response
          : response.ideas ?? response.data ?? [];
        let results: IdeaBrief[] = rawItems.map((d) => {
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
        // Client-side filtering (archive endpoint returns all ideas)
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          results = results.filter(
            (idea) =>
              idea.name.toLowerCase().includes(q) ||
              idea.tagline.toLowerCase().includes(q)
          );
        }
        if (effortFilter !== "all") {
          results = results.filter((idea) => idea.effortEstimate === effortFilter);
        }
        if (minScore > 0) {
          results = results.filter((idea) => idea.priorityScore >= minScore);
        }

        setIdeas(results);
        setTotal(data.total ?? results.length);
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
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl mb-2">
          Idea Archive
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-balance">
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
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-4 w-4 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                id="search"
                type="text"
                placeholder="Search ideas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 pl-10 pr-4 py-3 text-sm shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
              />
            </div>
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
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
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
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-3"
            />
          </div>
        </div>
      </div>

      {/* Results */}
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
      ) : error ? (
        <div className="text-center py-16">
          <svg
            className="mx-auto h-12 w-12 text-red-400 dark:text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            Something went wrong
          </h3>
          <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>
          <div className="mt-6">
            <button
              onClick={() => setMinScore((s) => s)}
              className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {ideas.map((idea, index) => (
              <IdeaBriefCard
                key={idea.id}
                brief={idea}
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                No matching ideas
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Try adjusting your search or filter criteria.
              </p>
            </div>
          )}

          {ideas.length > 0 && (
            <div className="mt-8 flex justify-center">
              <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                Showing {ideas.length} of {total} ideas
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
