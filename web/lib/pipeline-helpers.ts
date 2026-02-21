import type { PhaseStatsMap } from "@/lib/types";

export const PHASE_ORDER = ["scrape", "analyze", "generate", "deliver"] as const;

export const PHASE_META: Record<string, { label: string; icon: string }> = {
  scrape: { label: "Scrape", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  analyze: { label: "Analyze", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  generate: { label: "Generate", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  deliver: { label: "Deliver", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
};

export const PHASE_LABELS: Record<string, string> = {
  scrape: "Scrape",
  analyze: "Analyze",
  generate: "Generate",
  deliver: "Deliver",
};

export function getPhaseState(
  phase: string,
  phases: Record<string, string> | undefined,
  isRunning: boolean
): "pending" | "running" | "completed" | "failed" {
  if (!phases) return "pending";
  const s = phases[phase];
  if (s === "completed") return "completed";
  if (s === "blocked") return "completed";
  if (s === "failed") return "failed";

  if (!isRunning) return "pending";

  const idx = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);
  if (idx === 0) {
    return "running";
  }
  const prevPhase = PHASE_ORDER[idx - 1];
  if (phases[prevPhase] === "completed" && s === "pending") return "running";
  return "pending";
}

export function formatPhaseStat(phase: string, stats: PhaseStatsMap | undefined): string | null {
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

export function formatPhaseStatDetailed(phase: string, stats: PhaseStatsMap | undefined): string | null {
  if (!stats) return null;
  switch (phase) {
    case "scrape":
      if (!stats.scrape) return null;
      return `${stats.scrape.totalPosts} posts (Reddit: ${stats.scrape.reddit}, HN: ${stats.scrape.hn}, GitHub: ${stats.scrape.github})`;
    case "analyze":
      if (!stats.analyze) return null;
      return `${stats.analyze.clusterCount} clusters, ${stats.analyze.scoredCount} scored, ${stats.analyze.gapAnalysisCount} gap analyses`;
    case "generate":
      if (!stats.generate) return null;
      return `${stats.generate.briefCount} briefs generated`;
    case "deliver":
      if (!stats.deliver) return null;
      return `${stats.deliver.sent} sent, ${stats.deliver.failed} failed (${stats.deliver.subscriberCount} subscribers)`;
    default:
      return null;
  }
}
