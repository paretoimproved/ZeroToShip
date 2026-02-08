"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { PipelineStatus } from "@/lib/types";

export default function PipelinePage() {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form state
  const [dryRun, setDryRun] = useState(false);
  const [skipDelivery, setSkipDelivery] = useState(false);
  const [hoursBack, setHoursBack] = useState("");
  const [maxBriefs, setMaxBriefs] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getPipelineStatus();
      setStatus(data);
    } catch {
      // Status not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll while running
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [running, fetchStatus]);

  async function handleRun() {
    setRunning(true);
    setMessage(null);
    try {
      const options: Record<string, unknown> = {};
      if (dryRun) options.dryRun = true;
      if (skipDelivery) options.skipDelivery = true;
      if (hoursBack) options.hoursBack = Number(hoursBack);
      if (maxBriefs) options.maxBriefs = Number(maxBriefs);

      const result = await api.triggerPipeline(options as Parameters<typeof api.triggerPipeline>[0]);
      setMessage(result.message);

      // Poll for a while then stop
      setTimeout(() => setRunning(false), 60000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to trigger pipeline");
      setRunning(false);
    }
  }

  const phaseEntries = status?.phases ? Object.entries(status.phases) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Pipeline Control
      </h1>

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

          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Hours Back
              </label>
              <input
                type="number"
                value={hoursBack}
                onChange={(e) => setHoursBack(e.target.value)}
                placeholder="24"
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

      {/* Status Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Latest Run Status
        </h2>

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
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p>
                <span className="font-medium">Run ID:</span> {status.runId}
              </p>
              <p>
                <span className="font-medium">Started:</span>{" "}
                {status.startedAt
                  ? new Date(status.startedAt).toLocaleString()
                  : "N/A"}
              </p>
              <p>
                <span className="font-medium">Last Updated:</span>{" "}
                {status.updatedAt
                  ? new Date(status.updatedAt).toLocaleString()
                  : "N/A"}
              </p>
            </div>

            {phaseEntries.length > 0 && (
              <div className="flex items-center space-x-2 mt-2">
                {phaseEntries.map(([phase, phaseStatus]) => (
                  <span
                    key={phase}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      phaseStatus === "completed"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : phaseStatus === "failed"
                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {phase}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {running && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Auto-refreshing every 5 seconds...
          </p>
        )}
      </div>
    </div>
  );
}
