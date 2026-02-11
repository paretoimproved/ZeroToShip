"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import IdeaBriefCard from "@/components/IdeaBriefCard";
import BookmarkButton from "@/components/BookmarkButton";
import { Spinner } from "@/components/icons";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { normalizeIdeas } from "@/lib/normalize";
import {
  trackIdeaViewed,
  trackArchiveFiltered,
  trackUpgradeClicked,
} from "@/lib/analytics";
import type { IdeaBrief, EffortLevel } from "@/lib/types";

const PAGE_SIZE = 24;

type Platform = "reddit" | "hn" | "github";
const ALL_PLATFORMS: Platform[] = ["reddit", "hn", "github"];

type DateRange = "all" | "7d" | "30d" | "90d";

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
];

type SortOption = "newest" | "top-scored" | "lowest-effort" | "a-z";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "top-scored", label: "Top Scored" },
  { value: "lowest-effort", label: "Lowest Effort" },
  { value: "a-z", label: "A → Z" },
];

const effortOptions: { value: EffortLevel | "all"; label: string }[] = [
  { value: "all", label: "All Efforts" },
  { value: "weekend", label: "Weekend" },
  { value: "week", label: "1 Week" },
  { value: "month", label: "1 Month" },
  { value: "quarter", label: "Quarter+" },
];

const platformConfig: Record<
  Platform,
  { letter: string; label: string; activeColor: string }
> = {
  reddit: {
    letter: "R",
    label: "Reddit",
    activeColor:
      "bg-orange-100 text-orange-800 border-orange-400 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-600",
  },
  hn: {
    letter: "Y",
    label: "HN",
    activeColor:
      "bg-orange-100 text-orange-800 border-orange-400 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-600",
  },
  github: {
    letter: "G",
    label: "GitHub",
    activeColor:
      "bg-gray-200 text-gray-800 border-gray-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-500",
  },
};

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

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}

function MiniPlatformBadge({ platform }: { platform: Platform }) {
  const config = platformConfig[platform];
  if (!config) return null;
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${config.activeColor}`}
      title={config.label}
    >
      {config.letter}
    </span>
  );
}

function SourceToggle({
  platform,
  active,
  onToggle,
}: {
  platform: Platform;
  active: boolean;
  onToggle: () => void;
}) {
  const config = platformConfig[platform];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors ${
        active
          ? config.activeColor
          : "bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700"
      }`}
    >
      <span className="font-bold">{config.letter}</span>
      <span className="hidden sm:inline">{config.label}</span>
    </button>
  );
}

function dateRangeToFromTo(range: DateRange): { from?: string; to?: string } {
  if (range === "all") return {};
  const now = new Date();
  const to = now.toISOString();
  const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
  const days = daysMap[range];
  const from = new Date(now.getTime() - days * 86400000).toISOString();
  return { from, to };
}

function CompactCard({
  idea,
  index,
  onClick,
  isSaved,
  onToggleSave,
  showBookmark,
}: {
  idea: IdeaBrief;
  index: number;
  onClick: () => void;
  isSaved: boolean;
  onToggleSave: (saved: boolean) => void;
  showBookmark: boolean;
}) {
  const delay = Math.min(index, 8) * 150;

  // Deduplicated source platforms
  const sourcePlatforms: Platform[] = useMemo(() => {
    if (!idea.sources || idea.sources.length === 0) return [];
    const seen = new Set<Platform>();
    return idea.sources.reduce<Platform[]>((acc, s) => {
      if (!seen.has(s.platform)) {
        seen.add(s.platform);
        acc.push(s.platform);
      }
      return acc;
    }, []);
  }, [idea.sources]);

  return (
    <article
      onClick={onClick}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:border-primary-400 dark:hover:border-primary-500 transition-all duration-200 animate-fade-in-up opacity-0"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      {/* Top: score circle + name + bookmark */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${getScoreCircleColor(idea.priorityScore)}`}
        >
          {idea.priorityScore.toFixed(0)}
        </div>
        <h3 className="font-mono text-sm font-bold text-gray-900 dark:text-white truncate flex-1">
          {idea.name}
        </h3>
        {showBookmark && (
          <BookmarkButton
            ideaId={idea.id}
            initialSaved={isSaved}
            onToggle={onToggleSave}
            size="sm"
          />
        )}
      </div>

      {/* Tagline */}
      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
        {idea.tagline}
      </p>

      {/* Source badges + relative date */}
      {(sourcePlatforms.length > 0 || idea.generatedAt) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1">
            {sourcePlatforms.map((p) => (
              <MiniPlatformBadge key={p} platform={p} />
            ))}
          </div>
          {idea.generatedAt && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {relativeTime(idea.generatedAt)}
            </span>
          )}
        </div>
      )}

      {/* Bottom: effort badge + revenue */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span
          className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${getEffortBadgeColor(idea.effortEstimate)}`}
        >
          {getEffortLabel(idea.effortEstimate)}
        </span>
        <span
          title={idea.revenueEstimate}
          className="text-xs font-medium text-emerald-700 dark:text-emerald-300 truncate min-w-0"
        >
          {idea.revenueEstimate}
        </span>
      </div>
    </article>
  );
}

export default function ArchivePage() {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [effortFilter, setEffortFilter] = useState<EffortLevel | "all">("all");
  const [minScoreInput, setMinScoreInput] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [selectedSources, setSelectedSources] = useState<Set<Platform>>(
    () => new Set(ALL_PLATFORMS)
  );
  const [allIdeas, setAllIdeas] = useState<IdeaBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<IdeaBrief | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [preview, setPreview] = useState(false);
  const [savedIdeaIds, setSavedIdeaIds] = useState<Set<string>>(new Set());
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const { isAuthenticated, user } = useAuth();

  // Fetch saved idea IDs for the logged-in user
  useEffect(() => {
    if (!isAuthenticated) {
      setSavedIdeaIds(new Set());
      return;
    }
    let cancelled = false;
    async function fetchSaved() {
      try {
        const saved = await api.getSavedIdeas();
        if (cancelled) return;
        const normalized = normalizeIdeas(saved);
        setSavedIdeaIds(new Set(normalized.map((idea) => idea.id)));
      } catch {
        // Silently fail — bookmark state is non-critical
      }
    }
    fetchSaved();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Callback for toggling a saved idea
  const handleToggleSave = useCallback((ideaId: string, saved: boolean) => {
    setSavedIdeaIds((prev) => {
      const next = new Set(prev);
      if (saved) {
        next.add(ideaId);
      } else {
        next.delete(ideaId);
      }
      return next;
    });
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Debounce minScore slider
  useEffect(() => {
    const timer = setTimeout(() => setMinScore(minScoreInput), 500);
    return () => clearTimeout(timer);
  }, [minScoreInput]);

  // Derive server params from server-side filters
  const serverParams = useMemo(() => {
    const params: {
      effort?: EffortLevel;
      minScore?: number;
      from?: string;
      to?: string;
      sort?: string;
    } = {};
    if (effortFilter !== "all") params.effort = effortFilter;
    if (minScore > 0) params.minScore = minScore;
    const { from, to } = dateRangeToFromTo(dateRange);
    if (from) params.from = from;
    if (to) params.to = to;
    if (sortBy !== "newest") params.sort = sortBy;
    return params;
  }, [effortFilter, minScore, dateRange, sortBy]);

  // Client-side filtering on accumulated ideas (search + source + saved)
  const filteredIdeas = useMemo(() => {
    let results = allIdeas;
    if (showSavedOnly) {
      results = results.filter((idea) => savedIdeaIds.has(idea.id));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (idea) =>
          idea.name.toLowerCase().includes(q) ||
          idea.tagline.toLowerCase().includes(q)
      );
    }
    // Source filter: idea must have at least one source from a selected platform
    // Ideas with no sources are always shown (don't penalize missing metadata)
    if (selectedSources.size < ALL_PLATFORMS.length) {
      results = results.filter((idea) => {
        if (!idea.sources || idea.sources.length === 0) return true;
        return idea.sources.some((s) => selectedSources.has(s.platform));
      });
    }
    return results;
  }, [allIdeas, searchQuery, selectedSources, showSavedOnly, savedIdeaIds]);

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

  // Toggle source platform
  const toggleSource = useCallback((platform: Platform) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  }, []);

  // Initial fetch (page 1) — re-runs when serverParams change
  useEffect(() => {
    let cancelled = false;
    async function fetchInitial() {
      setLoading(true);
      setError(null);
      setAllIdeas([]);
      setPage(1);
      setHasMore(true);
      setPreview(false);
      try {
        const data = await api.getArchive({
          page: 1,
          pageSize: PAGE_SIZE,
          ...serverParams,
        });
        if (cancelled) return;
        const results = normalizeIdeas(data);
        setAllIdeas(results);
        setTotal(data.total ?? results.length);
        setHasMore(data.hasMore ?? results.length >= PAGE_SIZE);
        setPreview(!!(data as unknown as Record<string, unknown>).preview);
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
    return () => {
      cancelled = true;
    };
  }, [fetchKey, serverParams]);

  // Load next page
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getArchive({
        page,
        pageSize: PAGE_SIZE,
        ...serverParams,
      });
      const results = normalizeIdeas(data);
      setAllIdeas((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = results.filter((i) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
      setTotal(data.total ?? allIdeas.length + results.length);
      setHasMore(data.hasMore ?? results.length >= PAGE_SIZE);
      setPage((p) => p + 1);
    } catch (err) {
      console.error("Failed to load more ideas:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [page, hasMore, loadingMore, allIdeas.length, serverParams]);

  // Ref to always have the latest loadMore (avoids stale closures in scroll handler)
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  // Infinite scroll via scroll handler (disabled in preview mode)
  useEffect(() => {
    if (loading || preview) return;

    function checkScroll() {
      const scrollBottom = window.innerHeight + window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      if (scrollBottom >= docHeight - 400) {
        loadMoreRef.current();
      }
    }

    window.addEventListener("scroll", checkScroll, { passive: true });
    // Check immediately — if content doesn't fill the viewport, load more right away
    checkScroll();

    return () => window.removeEventListener("scroll", checkScroll);
  }, [loading, loadingMore, preview]);

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
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6 space-y-4">
        {/* Row 1: Search (full width) */}
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
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 pl-10 pr-4 py-3 text-sm shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            />
          </div>
        </div>

        {/* Saved filter toggle (only shown when authenticated) */}
        {isAuthenticated && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSavedOnly((prev) => !prev)}
              aria-pressed={showSavedOnly}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                showSavedOnly
                  ? "bg-primary-100 text-primary-800 border-primary-400 dark:bg-primary-900 dark:text-primary-200 dark:border-primary-600"
                  : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill={showSavedOnly ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              Saved Only
            </button>
          </div>
        )}

        {/* Row 2: Date, Sources, Effort, Score, Sort */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Date Range */}
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date Range
            </span>
            <div className="flex flex-wrap gap-1">
              {dateRangeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setDateRange(opt.value);
                    trackArchiveFiltered({ filter_type: "date_range", filter_value: opt.value });
                  }}
                  className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                    dateRange === opt.value
                      ? "bg-primary-100 text-primary-800 border-primary-400 dark:bg-primary-900 dark:text-primary-200 dark:border-primary-600"
                      : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sources */}
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sources
            </span>
            <div className="flex flex-wrap gap-1">
              {ALL_PLATFORMS.map((p) => (
                <SourceToggle
                  key={p}
                  platform={p}
                  active={selectedSources.has(p)}
                  onToggle={() => toggleSource(p)}
                />
              ))}
            </div>
          </div>

          {/* Effort Level */}
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
              onChange={(e) => {
                const value = e.target.value as EffortLevel | "all";
                setEffortFilter(value);
                trackArchiveFiltered({ filter_type: "effort", filter_value: value });
              }}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            >
              {effortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Min Score */}
          <div>
            <label
              htmlFor="score"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Min Score: {minScoreInput}
            </label>
            <input
              id="score"
              type="range"
              min="0"
              max="100"
              value={minScoreInput}
              onChange={(e) => setMinScoreInput(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-2"
            />
          </div>

          {/* Sort */}
          <div>
            <label
              htmlFor="sort"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Sort By
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
                onClick={() => {
                  setSelectedIdea(idea);
                  trackIdeaViewed({
                    ideaId: idea.id,
                    source: "archive_modal",
                    score: idea.priorityScore,
                  });
                }}
                isSaved={savedIdeaIds.has(idea.id)}
                onToggleSave={(saved) => handleToggleSave(idea.id, saved)}
                showBookmark={isAuthenticated}
              />
            ))}
          </div>

          {preview && filteredIdeas.length > 0 && (
            <>
              <ArchiveUpgradeWall total={total} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <GhostCard />
                <GhostCard />
                <GhostCard />
              </div>
            </>
          )}

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

          {loadingMore && (
            <div className="flex justify-center py-8">
              <Spinner className="h-6 w-6 text-primary-500" />
            </div>
          )}

          {filteredIdeas.length > 0 && !preview && (
            <div className="mt-4 flex justify-center">
              <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                Showing {filteredIdeas.length} of {total} ideas
              </span>
            </div>
          )}

          {filteredIdeas.length > 0 && preview && (
            <div className="mt-4 flex justify-center">
              <span className="inline-flex items-center rounded-full bg-primary-100 dark:bg-primary-900 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-300">
                Previewing {filteredIdeas.length} of {total} ideas
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
            {/* Modal action buttons */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              {isAuthenticated && (
                <BookmarkButton
                  ideaId={selectedIdea.id}
                  initialSaved={savedIdeaIds.has(selectedIdea.id)}
                  onToggle={(saved) => handleToggleSave(selectedIdea.id, saved)}
                  size="sm"
                />
              )}
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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
            </div>

            <IdeaBriefCard
              brief={selectedIdea}
              gated={!isAuthenticated || user?.tier === "free"}
              gatedAction={isAuthenticated ? "upgrade" : "signup"}
              defaultTab="problem"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ArchiveUpgradeWall({ total }: { total: number }) {
  return (
    <div className="relative mt-8 rounded-2xl border border-primary-200 dark:border-primary-800 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 p-8 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-4">
        <svg
          className="w-7 h-7 text-primary-600 dark:text-primary-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Unlock the Full Archive
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-lg mx-auto">
        You&apos;re previewing a small sample. Upgrade to Builder to browse all{" "}
        <span className="font-semibold text-gray-900 dark:text-white">
          {total.toLocaleString()}
        </span>{" "}
        ideas with full search, filters, and detailed briefs.
      </p>
      <Link
        href="/pricing"
        onClick={() => trackUpgradeClicked({ from_tier: "free", to_tier: "pro", location: "archive_wall" })}
        className="inline-block rounded-lg bg-primary-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
      >
        Upgrade to Builder
      </Link>
    </div>
  );
}

function GhostCard() {
  return (
    <div
      aria-hidden="true"
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 select-none pointer-events-none"
      style={{ filter: "blur(6px)", opacity: 0.5 }}
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
  );
}
