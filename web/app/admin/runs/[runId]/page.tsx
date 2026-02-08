"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { PipelineRunRow } from "@/lib/types";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

const PHASE_ORDER = ["scrape", "analyze", "generate", "deliver"];
const PHASE_LABELS: Record<string, string> = {
  scrape: "Scrape",
  analyze: "Analyze",
  generate: "Generate",
  deliver: "Deliver",
};

function PhaseTimeline({ phases }: { phases: Record<string, string> }) {
  return (
    <div className="flex items-center justify-between max-w-lg">
      {PHASE_ORDER.map((phase, i) => {
        const status = phases[phase];
        let circleColor = "bg-gray-300 dark:bg-gray-600 border-gray-400 dark:border-gray-500";
        if (status === "completed") circleColor = "bg-green-500 border-green-600";
        else if (status === "failed") circleColor = "bg-red-500 border-red-600";

        return (
          <div key={phase} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full border-2 ${circleColor}`} />
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {PHASE_LABELS[phase]}
              </span>
            </div>
            {i < PHASE_ORDER.length - 1 && (
              <div className="w-12 h-0.5 bg-gray-300 dark:bg-gray-600 mx-1 -mt-4" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
    </div>
  );
}

function priorityColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
}

function severityColor(severity?: string): string {
  if (severity === "fatal") return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  if (severity === "degraded") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
}

function phaseColor(phase: string): string {
  const colors: Record<string, string> = {
    scrape: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    analyze: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    generate: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    deliver: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  };
  return colors[phase] || "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
}

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<PipelineRunRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configExpanded, setConfigExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getRunDetail(runId);
        setRun(data.run);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load run details");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [runId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-40" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!run) return null;

  const isDryRun = Boolean(run.config.dryRun);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/runs"
        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        &larr; Back to Run History
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 font-mono">
              {run.runId}
            </h1>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p>
                <span className="font-medium">Started:</span> {formatDate(run.startedAt)}
              </p>
              <p>
                <span className="font-medium">Completed:</span>{" "}
                {run.completedAt ? formatDate(run.completedAt) : "In progress"}
              </p>
              <p>
                <span className="font-medium">Duration:</span> {formatDuration(run.totalDuration)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                run.success
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
              }`}
            >
              {run.success ? "Success" : "Failed"}
            </span>
            {isDryRun && (
              <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Dry Run
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Phase Timeline
        </h2>
        <PhaseTimeline phases={run.phases} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Posts Scraped" value={run.stats.postsScraped} />
        <StatCard label="Clusters Created" value={run.stats.clustersCreated} />
        <StatCard label="Ideas Generated" value={run.stats.ideasGenerated} />
        <StatCard label="Emails Sent" value={run.stats.emailsSent} />
      </div>

      {/* API Metrics */}
      {run.apiMetrics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            API Usage & Cost
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Calls</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatNumber(run.apiMetrics.totalCalls)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Input Tokens</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatNumber(run.apiMetrics.totalInputTokens)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Output Tokens</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatNumber(run.apiMetrics.totalOutputTokens)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Estimated Cost</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                ${run.apiMetrics.estimatedCost.toFixed(2)}
              </p>
            </div>
          </div>

          {Object.keys(run.apiMetrics.callsByModel).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Calls by Model
              </h3>
              <div className="space-y-1">
                {Object.entries(run.apiMetrics.callsByModel).map(([model, count]) => (
                  <div
                    key={model}
                    className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400"
                  >
                    <span className="font-mono">{model}</span>
                    <span>{formatNumber(count)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Errors */}
      {run.errors.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-red-200 dark:border-red-800">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-4">
            Errors
          </h2>
          <div className="space-y-3">
            {run.errors.map((err, i) => (
              <div
                key={i}
                className="p-3 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${phaseColor(err.phase)}`}
                  >
                    {err.phase}
                  </span>
                  {err.severity && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColor(err.severity)}`}
                    >
                      {err.severity}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {err.recoverable ? "Recoverable" : "Non-recoverable"}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{err.message}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {formatDate(err.timestamp)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Brief Previews */}
      {run.briefSummaries && run.briefSummaries.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Generated Briefs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {run.briefSummaries.map((brief, i) => (
              <div
                key={i}
                className="p-4 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {brief.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {brief.tagline}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor(brief.priorityScore)}`}
                  >
                    Score: {brief.priorityScore}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {brief.effortEstimate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Config (collapsible) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setConfigExpanded(!configExpanded)}
          className="w-full flex items-center justify-between p-6 text-left"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Run Configuration
          </h2>
          <span className="text-gray-400 dark:text-gray-500 text-sm">
            {configExpanded ? "Collapse" : "Expand"}
          </span>
        </button>
        {configExpanded && (
          <div className="px-6 pb-6">
            <pre className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-700 dark:text-gray-300 overflow-x-auto border border-gray-200 dark:border-gray-700">
              {JSON.stringify(run.config, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
