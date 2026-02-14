/**
 * Scheduler Types for ZeroToShip Pipeline
 */

import type { RawPost } from '../scrapers/types';
import type { ProblemCluster, ScoredProblem, GapAnalysis } from '../analysis';
import type { IdeaBrief } from '../generation';
import type { ApiMetricsSummary } from './utils/api-metrics';

/** Generation execution mode for run-level diagnostics */
export type GenerationMode = 'legacy' | 'graph';

/** Normalized fallback reason taxonomy (v1) */
export type FallbackReasonCode =
  | 'missing_gap_analysis'
  | 'missing_api_key'
  | 'single_call_failed'
  | 'batch_call_failed'
  | 'unknown';

/** Normalized quality failure taxonomy (v1) */
export type QualityFailureReasonCode =
  | 'placeholder_content'
  | 'length_too_short'
  | 'list_minimum_not_met'
  | 'nested_content_incomplete'
  | 'unknown';

export type BudgetStopReason =
  | 'budget_usd_exceeded'
  | 'budget_tokens_exceeded'
  | 'unknown';

export interface BudgetStopSnapshot {
  reason: BudgetStopReason;
  requestedBriefCount: number;
  generatedBriefCount: number;
  runBudgetUsd?: number;
  runBudgetTokens?: number;
  spentUsd: number;
  spentTokens: number;
}

/**
 * Generate-phase diagnostics emitted before run-level enrichment.
 * Ratios are 0-1 decimals.
 */
export interface GeneratePhaseDiagnostics {
  taxonomyVersion: 'v1';
  generatedBriefCount: number;
  qualityPassCount: number;
  qualityFailCount: number;
  qualityPassRate: number;
  fallbackCount: number;
  fallbackRate: number;
  fallbackReasonCounts: Record<FallbackReasonCode, number>;
  qualityFailureReasonCounts: Record<QualityFailureReasonCode, number>;
  /**
   * Optional Phase 3 artifact: records when graph generation halts early due
   * to a configured run budget cap (USD or tokens).
   */
  budgetStop?: BudgetStopSnapshot;
}

/**
 * Persisted run-level diagnostics with cost/latency enrichment.
 */
export interface GenerationDiagnosticsSnapshot extends GeneratePhaseDiagnostics {
  costPerBriefUsd: number | null;
  latencyPerBriefMs: number | null;
}

/**
 * Phase names in the pipeline
 */
export type PhaseName = 'scrape' | 'analyze' | 'generate' | 'deliver';

/**
 * Result wrapper for each phase
 */
export interface PhaseResult<T = unknown> {
  success: boolean;
  data: T | null;
  error?: string;
  /** Error severity: 'fatal' stops the pipeline, 'degraded' logs and continues */
  severity?: 'fatal' | 'degraded';
  duration: number;
  phase: PhaseName;
  timestamp: Date;
  retries?: number;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Hours of content to look back (default: 24) */
  hoursBack: number;
  /** Which scrapers to run */
  scrapers: {
    reddit: boolean;
    hn: boolean;
    twitter: boolean;
    github: boolean;
  };
  /** Similarity threshold for clustering (default: 0.85) */
  clusteringThreshold: number;
  /** Minimum frequency for gap analysis (default: 2) */
  minFrequencyForGap: number;
  /** Maximum briefs to generate (default: 10) */
  maxBriefs: number;
  /** Minimum priority score for brief generation (default: 0.5) */
  minPriorityScore: number;
  /** Skip email delivery (default: false) */
  dryRun: boolean;
  /** Enable verbose logging */
  verbose: boolean;
  /** Resume a previous run from its last completed phase */
  resumeRunId?: string;
}

/**
 * Scrape phase output
 */
export interface ScrapePhaseOutput {
  reddit: { count: number; success: boolean; error?: string };
  hn: { count: number; success: boolean; error?: string };
  twitter: { count: number; success: boolean; error?: string };
  github: { count: number; success: boolean; error?: string };
  totalPosts: number;
  posts: RawPost[];
}

/**
 * Analyze phase output
 */
export interface AnalyzePhaseOutput {
  clusterCount: number;
  scoredCount: number;
  gapAnalysisCount: number;
  clusters: ProblemCluster[];
  scoredProblems: ScoredProblem[];
  gapAnalyses: Map<string, GapAnalysis>;
}

/**
 * Generate phase output
 */
export interface GeneratePhaseOutput {
  briefCount: number;
  briefs: IdeaBrief[];
  diagnostics?: GeneratePhaseDiagnostics;
  generationMode?: GenerationMode;
}

/**
 * Deliver phase output
 */
export interface DeliverPhaseOutput {
  subscriberCount: number;
  sent: number;
  failed: number;
  dryRun: boolean;
}

/**
 * Complete pipeline result
 */
export interface PipelineResult {
  runId: string;
  startedAt: Date;
  completedAt: Date;
  config: PipelineConfig;
  phases: {
    scrape: PhaseResult<ScrapePhaseOutput>;
    analyze: PhaseResult<AnalyzePhaseOutput>;
    generate: PhaseResult<GeneratePhaseOutput>;
    deliver: PhaseResult<DeliverPhaseOutput>;
  };
  stats: {
    postsScraped: number;
    clustersCreated: number;
    ideasGenerated: number;
    emailsSent: number;
  };
  success: boolean;
  totalDuration: number;
  errors: PipelineError[];
  /** API call metrics for cost validation */
  apiMetrics?: ApiMetricsSummary;
}

/**
 * Pipeline error with context
 */
export interface PipelineError {
  phase: PhaseName;
  message: string;
  timestamp: Date;
  recoverable: boolean;
  severity?: 'fatal' | 'degraded';
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  /** Cron expression (default: '0 6 * * *' - 6 AM daily) */
  cronExpression: string;
  /** Timezone (default: 'America/New_York') */
  timezone: string;
  /** Pipeline configuration overrides */
  pipelineConfig: Partial<PipelineConfig>;
  /** Enable the scheduler (default: true) */
  enabled: boolean;
}
