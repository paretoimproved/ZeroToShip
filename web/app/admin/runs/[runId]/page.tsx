"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { PipelineRunRow } from "@/lib/types";
import { MermaidDiagram } from "@/components/admin/MermaidDiagram";
import { Spinner } from "@/components/icons";
import {
  PHASE_ORDER,
  PHASE_META,
  getPhaseState,
  formatPhaseStat,
  formatPhaseStatDetailed,
} from "@/lib/pipeline-helpers";

// ─── Utility functions ───────────────────────────────────────────────────────

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
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
type PublishGateHistoryEntry = {
  action: "approve" | "reject";
  by: string | null;
  at: string;
  reason?: string | null;
  briefIds?: string[];
  delivered?: boolean;
  deliveredSent?: number;
};
type PhaseResults = {
  publishGateHistory?: PublishGateHistoryEntry[];
} & Record<string, unknown>;

// ─── Activity log types ──────────────────────────────────────────────────────

interface ActivityEvent {
  timestamp: string;
  phase: string | null;
  type: "phase_start" | "phase_complete" | "error" | "run_complete" | "run_failed";
  message: string;
}

const PHASE_BADGE_COLORS: Record<string, string> = {
  scrape: "text-blue-400",
  analyze: "text-purple-400",
  generate: "text-amber-400",
  deliver: "text-green-400",
};

// ─── Mermaid builders ────────────────────────────────────────────────────────

function escapeMermaidLabel(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/["\\[\]<>`]/g, "")
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function PhaseTimeline({
  phases,
  status,
  phaseStats,
  phaseDurations,
}: {
  phases: Record<string, string>;
  status?: string | null;
  phaseStats?: PipelineRunRow["phaseStats"];
  phaseDurations: Record<string, number>;
}) {
  const isRunning = status === "running";
  const completedCount = PHASE_ORDER.filter(
    (p) => phases[p] === "completed" || phases[p] === "blocked"
  ).length;

  return (
    <div className="relative">
      {/* Connector line */}
      <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200 dark:bg-gray-600" />
      <div
        className="absolute top-5 left-5 h-0.5 bg-amber-500 transition-all duration-500"
        style={{
          width: `${(completedCount / PHASE_ORDER.length) * 100}%`,
          maxWidth: "calc(100% - 2.5rem)",
        }}
      />

      <div className="relative flex justify-between">
        {PHASE_ORDER.map((phase) => {
          const state = getPhaseState(phase, phases, isRunning);
          const stat = formatPhaseStat(phase, phaseStats);
          const meta = PHASE_META[phase];
          const duration = phaseDurations[phase];

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

              {/* Stat + duration */}
              {state === "completed" && (stat || duration) && (
                <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {[stat, duration ? formatDuration(duration) : null].filter(Boolean).join(" \u00b7 ")}
                </span>
              )}
            </div>
          );
        })}
      </div>
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

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - new Date(startedAt).getTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - new Date(startedAt).getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <>{formatDuration(elapsed)}</>;
}

function ActivityLog({
  events,
  isRunning,
}: {
  events: ActivityEvent[];
  isRunning: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 p-6 pb-0">
        Pipeline Activity
      </h2>
      <div
        ref={scrollRef}
        className="mt-4 mx-6 mb-6 rounded-lg bg-gray-900 p-4 font-mono text-sm max-h-80 overflow-y-auto"
      >
        {events.length === 0 ? (
          <p className="text-gray-500">Waiting for activity...</p>
        ) : (
          <div className="space-y-1">
            {events.map((event, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-gray-500 flex-shrink-0">
                  {formatTime(event.timestamp)}
                </span>
                {event.phase ? (
                  <span
                    className={`flex-shrink-0 font-semibold ${
                      PHASE_BADGE_COLORS[event.phase] || "text-gray-400"
                    }`}
                  >
                    [{event.phase.toUpperCase()}]
                  </span>
                ) : (
                  <span className="flex-shrink-0 w-[4.5rem]" />
                )}
                <span
                  className={
                    event.type === "error"
                      ? "text-red-400"
                      : event.type === "run_failed"
                      ? "text-red-400"
                      : event.type === "run_complete"
                      ? "text-green-400"
                      : "text-gray-300"
                  }
                >
                  {event.message}
                </span>
              </div>
            ))}
          </div>
        )}
        {/* Pulsing cursor */}
        {isRunning && (
          <div className="mt-2 flex items-center gap-1">
            <span className="inline-block w-2 h-4 bg-green-500 animate-pulse rounded-sm" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Color helpers ───────────────────────────────────────────────────────────

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

// ─── Main page ───────────────────────────────────────────────────────────────

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<PipelineRunRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);

  // Phase timing — tracks when phases start/complete via polling diffs
  const [phaseDurations, setPhaseDurations] = useState<Record<string, number>>({});
  const phaseStartTimesRef = useRef<Record<string, number>>({});
  const prevPhasesRef = useRef<Record<string, string> | null>(null);

  // Activity log
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const prevErrorCountRef = useRef(0);
  const initializedRef = useRef(false);

  const addEvent = useCallback((event: ActivityEvent) => {
    setActivityEvents((prev) => [...prev, event]);
  }, []);

  // Prepopulate activity log from current state on first load
  const initializeFromState = useCallback(
    (run: PipelineRunRow) => {
      if (initializedRef.current) return;
      initializedRef.current = true;

      const events: ActivityEvent[] = [];
      const derivedStatus = run.status ?? (run.completedAt ? (run.success ? "completed" : "failed") : "running");

      // Add events for already-completed phases
      for (const phase of PHASE_ORDER) {
        const state = run.phases[phase];
        if (state === "completed" || state === "blocked") {
          const stat = formatPhaseStatDetailed(phase, run.phaseStats);
          events.push({
            timestamp: run.updatedAt || run.startedAt,
            phase,
            type: "phase_complete",
            message: `Phase completed${stat ? ` \u2014 ${stat}` : ""}`,
          });
        }
      }

      // Add events for existing errors
      for (const err of run.errors) {
        events.push({
          timestamp: err.timestamp,
          phase: err.phase,
          type: "error",
          message: `Error: ${err.message}${err.severity ? ` (severity: ${err.severity})` : ""}`,
        });
      }
      prevErrorCountRef.current = run.errors.length;

      // Add completion event if already done
      if (derivedStatus === "completed") {
        events.push({
          timestamp: run.completedAt || run.updatedAt || run.startedAt,
          phase: null,
          type: "run_complete",
          message: "Pipeline completed successfully",
        });
      } else if (derivedStatus === "failed") {
        events.push({
          timestamp: run.completedAt || run.updatedAt || run.startedAt,
          phase: null,
          type: "run_failed",
          message: "Pipeline failed",
        });
      }

      // Sort by timestamp
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setActivityEvents(events);

      // Initialize prev phases ref
      prevPhasesRef.current = { ...run.phases };
    },
    []
  );

  // Detect phase transitions from polling diffs
  const detectTransitions = useCallback(
    (run: PipelineRunRow) => {
      const prev = prevPhasesRef.current;
      if (!prev) {
        prevPhasesRef.current = { ...run.phases };
        return;
      }

      const now = new Date().toISOString();

      for (const phase of PHASE_ORDER) {
        const prevState = prev[phase];
        const currState = run.phases[phase];

        if (prevState === currState) continue;

        // Phase started running
        const prevPhaseState = getPhaseState(phase, prev, true);
        const currPhaseState = getPhaseState(phase, run.phases, true);

        if (prevPhaseState !== "running" && currPhaseState === "running") {
          phaseStartTimesRef.current[phase] = Date.now();
          addEvent({
            timestamp: now,
            phase,
            type: "phase_start",
            message: "Phase started",
          });
        }

        // Phase completed
        if (prevState !== "completed" && currState === "completed") {
          const startTime = phaseStartTimesRef.current[phase];
          if (startTime) {
            const duration = Date.now() - startTime;
            setPhaseDurations((d) => ({ ...d, [phase]: duration }));
          }

          const stat = formatPhaseStatDetailed(phase, run.phaseStats);
          addEvent({
            timestamp: now,
            phase,
            type: "phase_complete",
            message: `Phase completed${stat ? ` \u2014 ${stat}` : ""}`,
          });
        }

        // Phase failed
        if (prevState !== "failed" && currState === "failed") {
          addEvent({
            timestamp: now,
            phase,
            type: "error",
            message: "Phase failed",
          });
        }
      }

      // New errors
      if (run.errors.length > prevErrorCountRef.current) {
        const newErrors = run.errors.slice(prevErrorCountRef.current);
        for (const err of newErrors) {
          addEvent({
            timestamp: err.timestamp,
            phase: err.phase,
            type: "error",
            message: `Error: ${err.message}${err.severity ? ` (severity: ${err.severity})` : ""}`,
          });
        }
        prevErrorCountRef.current = run.errors.length;
      }

      // Run completion
      const prevDerived = prev
        ? PHASE_ORDER.every((p) => prev[p] === "completed" || prev[p] === "blocked")
        : false;
      const currCompleted = PHASE_ORDER.every(
        (p) => run.phases[p] === "completed" || run.phases[p] === "blocked"
      );
      const currFailed = PHASE_ORDER.some((p) => run.phases[p] === "failed");

      if (!prevDerived && currCompleted) {
        addEvent({
          timestamp: now,
          phase: null,
          type: "run_complete",
          message: "Pipeline completed successfully",
        });
      } else if (currFailed && !PHASE_ORDER.some((p) => prev[p] === "failed")) {
        addEvent({
          timestamp: now,
          phase: null,
          type: "run_failed",
          message: "Pipeline failed",
        });
      }

      prevPhasesRef.current = { ...run.phases };
    },
    [addEvent]
  );

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const data = await api.getRunDetail(runId);
        setRun(data.run);

        if (data.run) {
          if (!initializedRef.current) {
            initializeFromState(data.run);
          } else {
            detectTransitions(data.run);
          }
        }

        const status =
          data.run?.status ??
          (data.run?.completedAt ? (data.run?.success ? "completed" : "failed") : "running");
        if (status !== "running" && interval) {
          clearInterval(interval);
          interval = null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load run details");
      } finally {
        setLoading(false);
      }
    }

    load();
    interval = setInterval(load, 5000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [runId, initializeFromState, detectTransitions]);

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
  const publishGate = diagnostics?.publishGate ?? null;
  const briefSummaries = run.briefSummaries ?? [];
  const reviewBriefs = briefSummaries.filter((b) => b.generationMeta?.publishDecision === "review");
  const phaseResults = (run.phaseResults ?? null) as PhaseResults | null;
  const reviewHistory: PublishGateHistoryEntry[] = Array.isArray(phaseResults?.publishGateHistory)
    ? phaseResults!.publishGateHistory
    : [];
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

  // Live stats: read from phaseStats (updated per-phase) with fallback to final stats
  const postsScraped = run.phaseStats?.scrape?.totalPosts ?? run.stats.postsScraped;
  const clustersCreated = run.phaseStats?.analyze?.clusterCount ?? run.stats.clustersCreated;
  const ideasGenerated = run.phaseStats?.generate?.briefCount ?? run.stats.ideasGenerated;
  const emailsSent = run.phaseStats?.deliver?.sent ?? run.stats.emailsSent;

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
                <span className="font-medium">Duration:</span>{" "}
                {derivedStatus === "running" ? (
                  <ElapsedTimer startedAt={run.startedAt} />
                ) : typeof run.totalDuration === "number" ? (
                  formatDuration(run.totalDuration)
                ) : (
                  "N/A"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                derivedStatus === "running"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  : derivedStatus === "needs_review"
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200"
                  : derivedStatus === "completed"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : derivedStatus === "failed"
                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {derivedStatus === "running"
                ? "Running"
                : derivedStatus === "needs_review"
                  ? "Needs review"
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
        <PhaseTimeline
          phases={run.phases}
          status={derivedStatus}
          phaseStats={run.phaseStats}
          phaseDurations={phaseDurations}
        />
      </div>

      {/* Stats Grid — live from phaseStats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Posts Scraped" value={postsScraped} />
        <StatCard label="Clusters Created" value={clustersCreated} />
        <StatCard label="Ideas Generated" value={ideasGenerated} />
        <StatCard label="Emails Sent" value={emailsSent} />
      </div>

      {/* Pipeline Activity Log */}
      <ActivityLog events={activityEvents} isRunning={derivedStatus === "running"} />

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

      {/* Publish Gate (Phase 5) */}
      {(publishGate?.enabled || derivedStatus === "needs_review" || reviewBriefs.length > 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Publish Gate
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {publishGate?.enabled
                  ? `Enabled (threshold: ${publishGate.confidenceThreshold.toFixed(2)})`
                  : "Disabled"}
              </p>
            </div>

            {derivedStatus === "needs_review" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={reviewActionLoading}
                  onClick={async () => {
                    setReviewActionLoading(true);
                    setReviewActionError(null);
                    try {
                      await api.approvePublishGate(runId);
                      const data = await api.getRunDetail(runId);
                      setRun(data.run);
                    } catch (err) {
                      setReviewActionError(err instanceof Error ? err.message : "Failed to approve publish gate");
                    } finally {
                      setReviewActionLoading(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                    reviewActionLoading ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {reviewActionLoading ? "Approving..." : "Approve + Deliver"}
                </button>
                <button
                  type="button"
                  disabled={reviewActionLoading}
                  onClick={async () => {
                    setReviewActionLoading(true);
                    setReviewActionError(null);
                    try {
                      await api.rejectPublishGate(runId);
                      const data = await api.getRunDetail(runId);
                      setRun(data.run);
                    } catch (err) {
                      setReviewActionError(err instanceof Error ? err.message : "Failed to reject publish gate");
                    } finally {
                      setReviewActionLoading(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    reviewActionLoading
                      ? "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 cursor-not-allowed"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
                  }`}
                >
                  Reject
                </button>
              </div>
            )}
          </div>

          {reviewActionError && (
            <div className="mt-4 p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-300">
              {reviewActionError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Auto-publish</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {publishGate?.autoPublishCount ?? 0}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Needs review</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {publishGate?.needsReviewCount ?? reviewBriefs.length}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Run status</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {derivedStatus}
              </p>
            </div>
          </div>

          {reviewBriefs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Review Briefs
              </h3>
              <div className="space-y-2">
                {reviewBriefs.map((b) => (
                  <div
                    key={b.id ?? b.name}
                    className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {b.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {b.tagline}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
                        review
                      </span>
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        conf={typeof b.generationMeta?.publishConfidence === "number"
                          ? b.generationMeta.publishConfidence.toFixed(2)
                          : "n/a"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reviewHistory.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Review History
              </h3>
              <div className="space-y-2">
                {reviewHistory.slice().reverse().map((h, idx) => (
                  <div
                    key={`${h.at ?? idx}`}
                    className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <span className="font-mono">{h.action}</span>{" "}
                    <span className="text-gray-500 dark:text-gray-400">
                      {h.by ? `by ${h.by}` : ""} {h.at ? `at ${formatDate(h.at)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
              const handoff = meta?.handoffMeta ?? null;

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
                      {handoff && (
                        <p>
                          <span className="font-medium">Handoff:</span>{" "}
                          <span className="font-mono">
                            {handoff.provider}:{handoff.status}
                            {typeof handoff.durationMs === "number" ? ` ${formatNumber(handoff.durationMs)}ms` : ""}
                            {typeof handoff.addedCompetitors === "number" ? ` +c=${handoff.addedCompetitors}` : ""}
                            {typeof handoff.addedGaps === "number" ? ` +g=${handoff.addedGaps}` : ""}
                            {typeof handoff.addedDifferentiators === "number" ? ` +d=${handoff.addedDifferentiators}` : ""}
                            {handoff.reason ? ` (${handoff.reason})` : ""}
                          </span>
                        </p>
                      )}
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
