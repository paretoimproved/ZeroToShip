"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { PipelineRunRow } from "@/lib/types";

type StatusFilter = "all" | "completed" | "failed";

const LIMIT = 20;

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatCost(run: PipelineRunRow): string {
  const costPerBrief = run.generationDiagnostics?.costPerBriefUsd;
  if (typeof costPerBrief === "number") {
    return `$${costPerBrief.toFixed(3)}/brief`;
  }
  if (!run.apiMetrics) return "\u2014";
  return `$${run.apiMetrics.estimatedCost.toFixed(2)}`;
}

function formatPercent(value?: number | null): string {
  if (typeof value !== "number") return "\u2014";
  return `${(value * 100).toFixed(1)}%`;
}

function modeColor(mode?: string | null): string {
  if (mode === "graph") return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  if (mode === "legacy") return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
}

const PHASE_ORDER = ["scrape", "analyze", "generate", "deliver"];

function PhaseDots({ phases }: { phases: Record<string, string> }) {
  return (
    <div className="flex items-center space-x-1">
      {PHASE_ORDER.map((phase) => {
        const status = phases[phase];
        let color = "bg-gray-300 dark:bg-gray-600";
        if (status === "completed") color = "bg-green-500";
        else if (status === "failed") color = "bg-red-500";
        return (
          <span
            key={phase}
            className={`inline-block w-2.5 h-2.5 rounded-full ${color}`}
            title={`${phase}: ${status || "pending"}`}
          />
        );
      })}
    </div>
  );
}

export default function RunHistoryPage() {
  const [runs, setRuns] = useState<PipelineRunRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRunHistory({
        page,
        limit: LIMIT,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setRuns(data.runs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run history");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  function handleFilterChange(filter: StatusFilter) {
    setStatusFilter(filter);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Pipeline Run History
      </h1>

      {/* Filter Bar */}
      <div className="flex items-center space-x-2">
        {(["all", "completed", "failed"] as StatusFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => handleFilterChange(filter)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === filter
                ? "bg-amber-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-x-auto">
        {loading ? (
          <div className="animate-pulse p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No pipeline runs found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3 font-medium">Run ID</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Phases</th>
                <th className="px-4 py-3 font-medium">Ideas</th>
                <th className="px-4 py-3 font-medium">Quality</th>
                <th className="px-4 py-3 font-medium">Fallback</th>
                <th className="px-4 py-3 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {runs.map((run) => (
                <tr
                  key={run.runId}
                  className="hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/runs/${run.runId}`}
                      className="text-amber-600 dark:text-amber-400 hover:underline font-mono"
                    >
                      ...{run.runId.slice(-8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(run.startedAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDuration(run.totalDuration)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        run.success
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {run.success ? "Success" : "Failed"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${modeColor(run.generationMode)}`}
                    >
                      {run.generationMode || "n/a"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <PhaseDots phases={run.phases} />
                  </td>
                  <td className="px-4 py-3">{run.stats.ideasGenerated}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatPercent(run.generationDiagnostics?.qualityPassRate)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatPercent(run.generationDiagnostics?.fallbackRate)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatCost(run)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && runs.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
