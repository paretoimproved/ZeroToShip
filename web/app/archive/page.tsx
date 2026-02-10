"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import IdeaBriefCard from "@/components/IdeaBriefCard";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import type { IdeaBrief, EffortLevel } from "@/lib/types";

const PAGE_SIZE = 24;

const effortOptions: { value: EffortLevel | "all"; label: string }[] = [
  { value: "all", label: "All Efforts" },
  { value: "weekend", label: "Weekend" },
  { value: "week", label: "1 Week" },
  { value: "month", label: "1 Month" },
  { value: "quarter", label: "Quarter+" },
];

function getScoreCircleColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-gray-400";
}

function getEffortLabel(effort: EffortLevel) {
  const labels: Record<EffortLevel, string> = {
    weekend: "Weekend",
    week: "1 Week",
    month: "1 Month",
    quarter: "Quarter+",
  };
  return labels[effort] || effort;
}

function getEffortBadgeColor(effort: EffortLevel) {
  const colors: Record<EffortLevel, string> = {
    weekend: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    week: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    month: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    quarter: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return colors[effort] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
}

function CompactCard({
  idea,
  index,
  onClick,
}: {
  idea: IdeaBrief;
  index: number;
  onClick: () => void;
}) {
  const delay = Math.min(index, 8) * 150;

  return (
    <article
      onClick={onClick}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:border-primary-400 dark:hover:border-primary-500 transition-all duration-200 animate-fade-in-up opacity-0"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      {/* Top: score circle + name */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${getScoreCircleColor(idea.priorityScore)}`}
        >
          {idea.priorityScore.toFixed(0)}
        </div>
        <h3 className="font-mono text-sm font-bold text-gray-900 dark:text-white truncate">
          {idea.name}
        </h3>
      </div>

      {/* Tagline */}
      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
        {idea.tagline}
      </p>

      {/* Bottom: effort badge + revenue */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${getEffortBadgeColor(idea.effortEstimate)}`}
        >
          {getEffortLabel(idea.effortEstimate)}
        </span>
        <span
          title={idea.revenueEstimate}
          className="text-xs font-medium text-emerald-700 dark:text-emerald-300 truncate max-w-[120px]"
        >
          {idea.revenueEstimate}
        </span>
      </div>
    </article>
  );
}

export default function ArchivePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [effortFilter, setEffortFilter] = useState<EffortLevel | "all">("all");
  const [minScore, setMinScore] = useState(0);
  const [allIdeas, setAllIdeas] = useState<IdeaBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<IdeaBrief | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const { isAuthenticated } = useAuth();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Client-side filtering on accumulated ideas
  const filteredIdeas = useMemo(() => {
    let results = allIdeas;
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
    return results;
  }, [allIdeas, searchQuery, effortFilter, minScore]);

  // Escape key to close modal
  useEffect(() => {
    if (!selectedIdea) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIdea(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedIdea]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (selectedIdea) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedIdea]);

  const closeModal = useCallback(() => setSelectedIdea(null), []);

  // Parse API response into IdeaBrief[]
  const parseResponse = useCallback((data: unknown): IdeaBrief[] => {
    type IdeaSummaryResponse = IdeaBrief & { brief?: IdeaBrief };
    type ApiResponse = IdeaSummaryResponse[] | { ideas: IdeaSummaryResponse[]; data?: IdeaSummaryResponse[] };
    const response = data as ApiResponse;
    const rawItems: IdeaSummaryResponse[] = Array.isArray(response)
      ? response
      : response.ideas ?? response.data ?? [];
    return rawItems.map((d) => {
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
  }, []);

  // Initial fetch (page 1)
  useEffect(() => {
    let cancelled = false;
    async function fetchInitial() {
      setLoading(true);
      setError(null);
      setAllIdeas([]);
      setPage(1);
      setHasMore(true);
      try {
        const data = await api.getArchive({ page: 1, pageSize: PAGE_SIZE });
        if (cancelled) return;
        const results = parseResponse(data);
        setAllIdeas(results);
        setTotal(data.total ?? results.length);
        setHasMore(data.hasMore ?? results.length >= PAGE_SIZE);
        setPage(2);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch archive:", err);
        setError("Failed to load archive. Please try again later.");
        setAllIdeas([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchInitial();
    return () => { cancelled = true; };
  }, [parseResponse, fetchKey]);

  // Load next page
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getArchive({ page, pageSize: PAGE_SIZE });
      const results = parseResponse(data);
      setAllIdeas((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = results.filter((i) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
      setTotal(data.total ?? (allIdeas.length + results.length));
      setHasMore(data.hasMore ?? results.length >= PAGE_SIZE);
      setPage((p) => p + 1);
    } catch (err) {
      console.error("Failed to load more ideas:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [page, hasMore, loadingMore, parseResponse, allIdeas.length]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
              </div>
              <div className="space-y-2 mb-4">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
              </div>
              <div className="flex items-center justify-between">
                <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
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
              onClick={() => setFetchKey((k) => k + 1)}
              className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIdeas.map((idea, i) => (
              <CompactCard
                key={idea.id}
                idea={idea}
                index={i}
                onClick={() => setSelectedIdea(idea)}
              />
            ))}
          </div>

          {filteredIdeas.length === 0 && (
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

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-1" />

          {loadingMore && (
            <div className="flex justify-center py-8">
              <svg
                className="animate-spin h-6 w-6 text-primary-500"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}

          {filteredIdeas.length > 0 && (
            <div className="mt-4 flex justify-center">
              <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                Showing {filteredIdeas.length} of {total} ideas
              </span>
            </div>
          )}
        </>
      )}

      {/* Modal Overlay */}
      {selectedIdea && (
        <div
          data-testid="idea-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-modal-backdrop"
            onClick={closeModal}
          />

          {/* Card wrapper */}
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl animate-modal-card">
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <IdeaBriefCard
              brief={selectedIdea}
              gated={!isAuthenticated}
              defaultTab="problem"
            />
          </div>
        </div>
      )}
    </div>
  );
}
