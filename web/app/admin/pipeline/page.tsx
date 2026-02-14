"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/icons";
import type { PipelineStatus } from "@/lib/types";

const PHASE_ORDER = ["scrape", "analyze", "generate", "deliver"] as const;

const PHASE_META: Record<string, { label: string; icon: string }> = {
  scrape: { label: "Scrape", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  analyze: { label: "Analyze", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  generate: { label: "Generate", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  deliver: { label: "Deliver", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
};

function formatPhaseStat(phase: string, stats: PipelineStatus["phaseStats"]): string | null {
  if (!stats) return null;
  switch (phase) {
    case "scrape":
      return stats.scrape ? `${stats.scrape.totalPosts} posts` : null;
    case "analyze":
      return stats.analyze ? `${stats.analyze.clusterCount} clusters` : null;
    case "generate":
      return stats.generate ? `${stats.generate.briefCount} briefs` : null;
    case "deliver":
      return stats.deliver ? `${stats.deliver.sent} sent` : null;
    default:
      return null;
  }
}

function getPhaseState(
  phase: string,
  phases: Record<string, string> | undefined,
  isRunning: boolean
): "pending" | "running" | "completed" | "failed" {
  if (!phases) return "pending";
  const s = phases[phase];
  if (s === "completed") return "completed";
  if (s === "blocked") return "completed";
  if (s === "failed") return "failed";

  // Only show "running" spinner if we know a pipeline is actively running
  if (!isRunning) return "pending";

  // Determine if this is the running phase: it's pending but the previous phase is completed
  const idx = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);
  if (idx === 0) {
    return "running";
  }
  const prevPhase = PHASE_ORDER[idx - 1];
  if (phases[prevPhase] === "completed" && s === "pending") return "running";
  return "pending";
}

export default function PipelinePage() {
  const router = useRouter();
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const autoNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Basic config
  const [dryRun, setDryRun] = useState(false);
  const [skipDelivery, setSkipDelivery] = useState(false);
  const [hoursBack, setHoursBack] = useState("");
  const [maxBriefs, setMaxBriefs] = useState("");
  const [generationMode, setGenerationMode] = useState<"legacy" | "graph">("graph");

  // Advanced config
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scraperReddit, setScraperReddit] = useState(true);
  const [scraperHN, setScraperHN] = useState(true);
  const [scraperGithub, setScraperGithub] = useState(true);
  const [clusteringThreshold, setClusteringThreshold] = useState("0.75");
  const [minPriorityScore, setMinPriorityScore] = useState("8");
  const [minFrequencyForGap, setMinFrequencyForGap] = useState("1");
  const [publishGateEnabled, setPublishGateEnabled] = useState(false);
  const [publishGateConfidenceThreshold, setPublishGateConfidenceThreshold] = useState("0.85");

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getPipelineStatus();
      setStatus(data);
      return data;
    } catch {
      // Status not available
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll while running — check for completion
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(async () => {
      const data = await fetchStatus();
      if (!data?.phases) return;

      // Only evaluate completion for the run we triggered, not a stale previous run
      if (currentRunId && data.runId !== currentRunId) return;

      const allCompleted = PHASE_ORDER.every((p) => {
        const s = data.phases?.[p];
        return s === "completed" || s === "blocked";
      });
      const anyFailed = PHASE_ORDER.some((p) => data.phases?.[p] === "failed");

      if (allCompleted || anyFailed) {
        setRunning(false);
        if (allCompleted) {
          setToast({ type: "success", text: "Pipeline completed successfully" });
          // Auto-navigate after 2 seconds
          if (currentRunId) {
            autoNavTimerRef.current = setTimeout(() => {
              router.push(`/admin/runs/${currentRunId}`);
            }, 2000);
          }
        } else {
          setToast({ type: "error", text: "Pipeline failed" });
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [running, fetchStatus, currentRunId, router]);

  // Clear auto-nav timer on unmount
  useEffect(() => {
    return () => {
      if (autoNavTimerRef.current) clearTimeout(autoNavTimerRef.current);
    };
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleRun() {
    setRunning(true);
    setMessage(null);
    setToast(null);
    setCurrentRunId(null);
    if (autoNavTimerRef.current) {
      clearTimeout(autoNavTimerRef.current);
      autoNavTimerRef.current = null;
    }

    try {
      const options: Parameters<typeof api.triggerPipeline>[0] = {};
      if (dryRun) options.dryRun = true;
      if (skipDelivery) options.skipDelivery = true;
      if (hoursBack) options.hoursBack = Number(hoursBack);
      if (maxBriefs) options.maxBriefs = Number(maxBriefs);
      options.generationMode = generationMode;

      // Advanced settings
      if (showAdvanced) {
        options.scrapers = {
          reddit: scraperReddit,
          hn: scraperHN,
          github: scraperGithub,
        };
        options.clusteringThreshold = Number(clusteringThreshold);
        options.minPriorityScore = Number(minPriorityScore);
        options.minFrequencyForGap = Number(minFrequencyForGap);
        options.publishGateEnabled = publishGateEnabled;
        options.publishGateConfidenceThreshold = Number(publishGateConfidenceThreshold);
      }

      const result = await api.triggerPipeline(options);
      setMessage(result.message);
      setCurrentRunId(result.runId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to trigger pipeline");
      setRunning(false);
    }
  }

  const isComplete = status?.phases && PHASE_ORDER.every((p) => {
    const s = status.phases?.[p];
    return s === "completed" || s === "blocked";
  });
  const isFailed = status?.phases && PHASE_ORDER.some((p) => status.phases?.[p] === "failed");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Pipeline Control
      </h1>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            toast.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Trigger Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Trigger Pipeline
        </h2>

        <div className="space-y-4">
          <div className="flex items-center space-x-6">
            <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Dry Run</span>
            </label>
            <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={skipDelivery}
                onChange={(e) => setSkipDelivery(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Skip Delivery</span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">Generation Mode</span>
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setGenerationMode("graph")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  generationMode === "graph"
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Graph
              </button>
              <button
                type="button"
                onClick={() => setGenerationMode("legacy")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  generationMode === "legacy"
                    ? "bg-gray-900 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Legacy
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Hours Back
              </label>
              <input
                type="number"
                value={hoursBack}
                onChange={(e) => setHoursBack(e.target.value)}
                placeholder="48"
                className="w-24 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Max Briefs
              </label>
              <input
                type="number"
                value={maxBriefs}
                onChange={(e) => setMaxBriefs(e.target.value)}
                placeholder="10"
                className="w-24 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
          </div>

          {/* Advanced Settings */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>Advanced Settings</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 pl-5 space-y-4 border-l-2 border-gray-200 dark:border-gray-600">
                {/* Publish Gate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Publish Gate (Phase 5)
                  </label>
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center space-x-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={publishGateEnabled}
                        onChange={(e) => setPublishGateEnabled(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span>Require Review Before Delivery</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Confidence Threshold
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={publishGateConfidenceThreshold}
                        onChange={(e) => setPublishGateConfidenceThreshold(e.target.value)}
                        className="w-24 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Blocks delivery if any brief is below the threshold.
                  </p>
                </div>

                {/* Scraper Toggles */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Scrapers
                  </label>
                  <div className="flex items-center space-x-4">
                    {[
                      { key: "reddit", label: "Reddit", checked: scraperReddit, set: setScraperReddit },
                      { key: "hn", label: "Hacker News", checked: scraperHN, set: setScraperHN },
                      { key: "github", label: "GitHub", checked: scraperGithub, set: setScraperGithub },
                    ].map((s) => (
                      <label key={s.key} className="flex items-center space-x-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <input
                          type="checkbox"
                          checked={s.checked}
                          onChange={(e) => s.set(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span>{s.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Threshold Controls */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Clustering Threshold
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.5"
                      max="0.95"
                      value={clusteringThreshold}
                      onChange={(e) => setClusteringThreshold(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    />
                    <span className="text-xs text-gray-400">0.5 - 0.95</span>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Min Priority Score
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="50"
                      value={minPriorityScore}
                      onChange={(e) => setMinPriorityScore(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    />
                    <span className="text-xs text-gray-400">1 - 50</span>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Min Frequency for Gap
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="10"
                      value={minFrequencyForGap}
                      onChange={(e) => setMinFrequencyForGap(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    />
                    <span className="text-xs text-gray-400">1 - 10</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleRun}
            disabled={running}
            className={`px-6 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              running
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-amber-500 hover:bg-amber-600"
            }`}
          >
            {running ? "Running..." : "Run Pipeline"}
          </button>

          {message && (
            <p className="text-sm text-amber-600 dark:text-amber-400">{message}</p>
          )}
        </div>
      </div>

      {/* Phase Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Pipeline Progress
          </h2>
          {status?.runId && (
            <span className="text-xs text-gray-400 font-mono">{status.runId}</span>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          </div>
        ) : !status || status.status === "no_runs" ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {status?.message || "No pipeline runs found"}
          </p>
        ) : (
          <div className="space-y-4">
            {/* Run metadata */}
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Started {status.startedAt ? new Date(status.startedAt).toLocaleString() : "N/A"}
              {status.updatedAt && (
                <span className="ml-3">
                  Updated {new Date(status.updatedAt).toLocaleString()}
                </span>
              )}
            </div>

            {/* 4-step progress bar */}
            <div className="relative">
              {/* Connector line */}
              <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200 dark:bg-gray-600" />
              <div
                className="absolute top-5 left-5 h-0.5 bg-amber-500 transition-all duration-500"
                style={{
                  width: `${
                    (PHASE_ORDER.filter(
                      (p) => status.phases?.[p] === "completed" || status.phases?.[p] === "blocked"
                    ).length /
                      PHASE_ORDER.length) *
                    100
                  }%`,
                  maxWidth: "calc(100% - 2.5rem)",
                }}
              />

              <div className="relative flex justify-between">
                {PHASE_ORDER.map((phase) => {
                  const state = getPhaseState(phase, status.phases, running);
                  const stat = formatPhaseStat(phase, status.phaseStats);
                  const meta = PHASE_META[phase];

                  return (
                    <div key={phase} className="flex flex-col items-center w-1/4">
                      {/* Icon circle */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                          state === "completed"
                            ? "bg-green-100 border-green-500 dark:bg-green-900 dark:border-green-400"
                            : state === "running"
                            ? "bg-amber-100 border-amber-500 dark:bg-amber-900 dark:border-amber-400"
                            : state === "failed"
                            ? "bg-red-100 border-red-500 dark:bg-red-900 dark:border-red-400"
                            : "bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-500"
                        }`}
                      >
                        {state === "running" ? (
                          <Spinner className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        ) : state === "completed" ? (
                          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : state === "failed" ? (
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={meta.icon} />
                          </svg>
                        )}
                      </div>

                      {/* Label */}
                      <span
                        className={`mt-2 text-xs font-medium ${
                          state === "completed"
                            ? "text-green-700 dark:text-green-300"
                            : state === "running"
                            ? "text-amber-700 dark:text-amber-300"
                            : state === "failed"
                            ? "text-red-700 dark:text-red-300"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {meta.label}
                      </span>

                      {/* Stat */}
                      {stat && state === "completed" && (
                        <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {stat}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* View Results button */}
            {(isComplete || isFailed) && currentRunId && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    if (autoNavTimerRef.current) {
                      clearTimeout(autoNavTimerRef.current);
                      autoNavTimerRef.current = null;
                    }
                    router.push(`/admin/runs/${currentRunId}`);
                  }}
                  className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 rounded-lg transition-colors"
                >
                  View Results
                </button>
              </div>
            )}

            {running && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Auto-refreshing every 3 seconds...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
