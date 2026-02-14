"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { PipelineRunRow } from "@/lib/types";
import { MermaidDiagram } from "@/components/admin/MermaidDiagram";

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatPercent(value?: number | null): string {
  if (typeof value !== "number") return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value?: number | null): string {
  if (typeof value !== "number") return "N/A";
  return `$${value.toFixed(3)}`;
}

function formatLatencyMs(value?: number | null): string {
  if (typeof value !== "number") return "N/A";
  return `${formatNumber(Math.round(value))} ms`;
}

function formatBudgetStopReason(reason: string): string {
  if (reason === "budget_usd_exceeded") return "USD budget cap exceeded";
  if (reason === "budget_tokens_exceeded") return "Token budget cap exceeded";
  return "Budget cap reached";
}

type BriefSummary = NonNullable<PipelineRunRow["briefSummaries"]>[number];

function escapeMermaidLabel(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/["\\[\\]<>`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function formatModelLabel(model: string | null | undefined): string {
  if (!model) return "default";
  return model;
}

function safeGanttId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function buildAggregateTraceGantt(briefs: BriefSummary[]): string | null {
  const graphBriefs = briefs.filter((b) => b.generationMeta?.providerMode === "graph");
  const hasTrace = graphBriefs.some((b) => (b.generationMeta?.graphTrace?.length ?? 0) > 0);
  if (!hasTrace) return null;

  const lines: string[] = ["gantt"];
  lines.push(`  title Run Trace Timeline (per-brief attempts)`);
  lines.push(`  dateFormat  YYYY-MM-DDTHH:mm:ss.SSSZ`);
  lines.push(`  axisFormat  %H:%M:%S`);

  for (let i = 0; i < graphBriefs.length; i += 1) {
    const brief = graphBriefs[i];
    const trace = brief.generationMeta?.graphTrace ?? [];
    if (trace.length === 0) continue;

    const sectionTitle = escapeMermaidLabel(brief.name) || `Brief ${i + 1}`;
    lines.push(`  section ${sectionTitle}`);

    for (let j = 0; j < trace.length; j += 1) {
      const step = trace[j];
      const start = step.startedAt;
      const end = step.finishedAt;
      const startMs = Date.parse(start);
      const endMs = Date.parse(end);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;

      const durationSeconds = Math.max(1, Math.round((endMs - startMs) / 1000));
      const model = escapeMermaidLabel(formatModelLabel(step.model));
      const passFail = step.passedQuality ? "pass" : "fail";
      const taskLabel = `Attempt ${step.attempt} (${model}) ${passFail}`;
      const taskId = safeGanttId(`b${i + 1}_a${step.attempt}`);

      lines.push(`  ${taskLabel} :${taskId}, ${start}, ${durationSeconds}s`);
    }
  }

  return lines.join("\n");
}

function buildGraphTraceMermaid(brief: BriefSummary): string | null {
  const meta = brief.generationMeta ?? null;
  if (!meta || meta.providerMode !== "graph") return null;

  const trace = meta.graphTrace ?? null;
  if (trace && trace.length > 0) {
    const lines: string[] = ["flowchart TD"];
    lines.push(`  START["${escapeMermaidLabel(brief.name)}"]`);

    for (let i = 0; i < trace.length; i += 1) {
      const step = trace[i];
      const attemptId = `A${i + 1}`;
      const evalId = `E${i + 1}`;
      const model = escapeMermaidLabel(formatModelLabel(step.model));
      const retrySections = (step.retrySections ?? []).join(", ");
      const retrySuffix = retrySections ? ` (retry: ${escapeMermaidLabel(retrySections)})` : "";

      lines.push(`  ${attemptId}["Attempt ${step.attempt}: ${model}${retrySuffix}"]`);
      lines.push(`  ${evalId}{"Quality pass?"}`);

      if (i === 0) lines.push(`  START --> ${attemptId}`);
      else lines.push(`  ${`E${i}`} --> ${attemptId}`);

      lines.push(`  ${attemptId} --> ${evalId}`);

      if (step.passedQuality) {
        lines.push(`  ${evalId} -- "yes" --> DONE([Done])`);
      } else {
        const failed = (step.failedSections ?? []).join(", ");
        const reasonHint = step.reasons?.[0] ? `; ${escapeMermaidLabel(step.reasons[0])}` : "";
        const label = failed ? `${escapeMermaidLabel(failed)}${reasonHint}` : `fail${reasonHint}`;

        if (i < trace.length - 1) {
          lines.push(`  ${evalId} -- "${label}" --> ${`A${i + 2}`}`);
        } else {
          lines.push(`  ${evalId} -- "${label}" --> STOP([Stopped])`);
        }
      }
    }

    return lines.join("\n");
  }

  const attemptCount = meta.graphAttemptCount ?? (meta.graphModelsUsed?.length || 0);
  const models = meta.graphModelsUsed ?? [];
  if (!attemptCount || attemptCount <= 0) return null;

  const lines: string[] = ["flowchart TD"];
  lines.push(`  START["${escapeMermaidLabel(brief.name)}"]`);
  for (let i = 0; i < attemptCount; i += 1) {
    const attemptId = `A${i + 1}`;
    const evalId = `E${i + 1}`;
    const model = escapeMermaidLabel(formatModelLabel(models[i] ?? null));

    lines.push(`  ${attemptId}["Attempt ${i + 1}: ${model}"]`);
    lines.push(`  ${evalId}{"Quality pass?"}`);
    if (i === 0) lines.push(`  START --> ${attemptId}`);
    else lines.push(`  ${`E${i}`} --> ${attemptId}`);
    lines.push(`  ${attemptId} --> ${evalId}`);

    if (i === attemptCount - 1) {
      const failed = (meta.graphFailedSections ?? []).join(", ");
      lines.push(`  ${evalId} -- "${escapeMermaidLabel(failed || "unknown")}" --> DONE([End])`);
    } else {
      lines.push(`  ${evalId} -- "retry" --> ${`A${i + 2}`}`);
    }
  }

  return lines.join("\n");
}

const PHASE_ORDER = ["scrape", "analyze", "generate", "deliver"];
const PHASE_LABELS: Record<string, string> = {
  scrape: "Scrape",
  analyze: "Analyze",
  generate: "Generate",
  deliver: "Deliver",
};

function PhaseTimeline({
  phases,
  status,
}: {
  phases: Record<string, string>;
  status?: string | null;
}) {
  const isRunning = status === "running";
  const activePhase = isRunning ? PHASE_ORDER.find((p) => phases[p] === "pending") ?? null : null;

  return (
    <div className="flex items-center justify-between max-w-lg">
      {PHASE_ORDER.map((phase, i) => {
        const status = phases[phase];
        let circleColor = "bg-gray-300 dark:bg-gray-600 border-gray-400 dark:border-gray-500";
        if (status === "completed") circleColor = "bg-green-500 border-green-600";
        else if (status === "failed") circleColor = "bg-red-500 border-red-600";
        else if (activePhase === phase) circleColor = "bg-blue-500 border-blue-600";

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

function modeColor(mode?: string | null): string {
  if (mode === "graph") return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  if (mode === "legacy") return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
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

  const derivedStatus = run.status ?? (run.completedAt ? (run.success ? "completed" : "failed") : "running");
  const isDryRun = Boolean(run.config.dryRun);
  const diagnostics = run.generationDiagnostics || null;
  const qualityReasonRows = diagnostics
    ? Object.entries(diagnostics.qualityFailureReasonCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
    : [];
  const fallbackReasonRows = diagnostics
    ? Object.entries(diagnostics.fallbackReasonCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
    : [];

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
                derivedStatus === "running"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  : derivedStatus === "completed"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : derivedStatus === "failed"
                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {derivedStatus === "running"
                ? "Running"
                : derivedStatus === "completed"
                  ? "Success"
                  : derivedStatus === "failed"
                    ? "Failed"
                    : derivedStatus}
            </span>
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${modeColor(run.generationMode)}`}
            >
              Mode: {run.generationMode || "n/a"}
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
        <PhaseTimeline phases={run.phases} status={derivedStatus} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Posts Scraped" value={run.stats.postsScraped} />
        <StatCard label="Clusters Created" value={run.stats.clustersCreated} />
        <StatCard label="Ideas Generated" value={run.stats.ideasGenerated} />
        <StatCard label="Emails Sent" value={run.stats.emailsSent} />
      </div>

      {/* Generation Diagnostics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Generation Diagnostics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Quality Pass Rate</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatPercent(diagnostics?.qualityPassRate)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Fallback Rate</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatPercent(diagnostics?.fallbackRate)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Cost / Brief</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {diagnostics ? formatCurrency(diagnostics.costPerBriefUsd) : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Latency / Brief</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {diagnostics ? formatLatencyMs(diagnostics.latencyPerBriefMs) : "N/A"}
            </p>
          </div>
        </div>

        {diagnostics?.budgetStop && (
          <div className="mb-6 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                {formatBudgetStopReason(diagnostics.budgetStop.reason)}
              </p>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100">
                Generated {diagnostics.budgetStop.generatedBriefCount} of{" "}
                {diagnostics.budgetStop.requestedBriefCount}
              </span>
            </div>
            <p className="text-xs text-yellow-900/80 dark:text-yellow-100/80 mt-2 font-mono">
              spentUsd={formatCurrency(diagnostics.budgetStop.spentUsd)} spentTokens=
              {formatNumber(diagnostics.budgetStop.spentTokens)}
              {typeof diagnostics.budgetStop.runBudgetUsd === "number"
                ? ` capUsd=${formatCurrency(diagnostics.budgetStop.runBudgetUsd)}`
                : ""}
              {typeof diagnostics.budgetStop.runBudgetTokens === "number"
                ? ` capTokens=${formatNumber(diagnostics.budgetStop.runBudgetTokens)}`
                : ""}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quality Failure Taxonomy
            </h3>
            {qualityReasonRows.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">N/A</p>
            ) : (
              <div className="space-y-1">
                {qualityReasonRows.map(([reason, count]) => (
                  <div
                    key={reason}
                    className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400"
                  >
                    <span className="font-mono">{reason}</span>
                    <span>{formatNumber(count)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fallback Taxonomy
            </h3>
            {fallbackReasonRows.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">N/A</p>
            ) : (
              <div className="space-y-1">
                {fallbackReasonRows.map(([reason, count]) => (
                  <div
                    key={reason}
                    className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400"
                  >
                    <span className="font-mono">{reason}</span>
                    <span>{formatNumber(count)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
                className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
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
                className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
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

      {/* Run Trace (graph-mode debugging) */}
      {run.briefSummaries && run.briefSummaries.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Run Trace
            </h2>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${modeColor(run.generationMode)}`}>
              {run.generationMode || "n/a"}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Visualizes per-brief graph attempts (generate → evaluate → retry). Trace is only available for graph-mode briefs.
          </p>

          {(() => {
            const gantt = buildAggregateTraceGantt(run.briefSummaries);
            if (!gantt) return null;
            return (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                <MermaidDiagram chart={gantt} className="min-w-[720px]" />
              </div>
            );
          })()}

          <div className="space-y-3 mt-4">
            {run.briefSummaries.map((brief, i) => {
              const meta = brief.generationMeta ?? null;
              const chart = buildGraphTraceMermaid(brief);
              const attempts = meta?.graphAttemptCount ?? meta?.graphTrace?.length ?? null;
              const models = meta?.graphModelsUsed?.join(", ") || null;
              const retried = meta?.graphRetriedSections?.join(", ") || null;
              const failed = meta?.graphFailedSections?.join(", ") || null;

              return (
                <details
                  key={i}
                  className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <summary className="cursor-pointer select-none">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {brief.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {brief.tagline}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${modeColor(meta?.providerMode)}`}>
                          {meta?.providerMode || "n/a"}
                        </span>
                        {typeof attempts === "number" && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                            Attempts: {attempts}
                          </span>
                        )}
                        {meta?.isFallback && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Fallback
                          </span>
                        )}
                      </div>
                    </div>
                  </summary>

                  <div className="mt-4 space-y-3">
                    {chart ? (
                      <div className="overflow-x-auto">
                        <MermaidDiagram chart={chart} className="min-w-[520px]" />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No graph trace available for this brief.
                      </p>
                    )}

                    <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                      {models && <p><span className="font-medium">Models:</span> <span className="font-mono">{models}</span></p>}
                      {retried && <p><span className="font-medium">Retried sections:</span> <span className="font-mono">{retried}</span></p>}
                      {failed && <p><span className="font-medium">Failed sections:</span> <span className="font-mono">{failed}</span></p>}
                      {meta?.fallbackReason && <p><span className="font-medium">Fallback reason:</span> <span className="font-mono">{meta.fallbackReason}</span></p>}
                    </div>
                  </div>
                </details>
              );
            })}
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
