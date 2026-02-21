/**
 * TypeScript types for ZeroToShip Web Dashboard
 *
 * This file is self-contained so the web app can build independently
 * in deployment environments that only install the `web` workspace.
 */

export type EffortLevel = "weekend" | "week" | "month" | "quarter";
export type UserTier = "anonymous" | "free" | "pro" | "enterprise";
export type EmailFrequency = "daily" | "weekly" | "never";
export type SubscriptionStatus = "active" | "canceled" | "past_due";

export interface IdeaSource {
  platform: "reddit" | "hn" | "twitter" | "github";
  title: string;
  url: string;
  score: number;
  commentCount: number;
  postedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

type CustomerTier = Exclude<UserTier, "anonymous">;

// ─── Frontend-specific types ─────────────────────────────────────────────────
// IdeaBrief: The frontend assumes all fields are populated (fully-loaded brief).
// The backend schema marks many fields as optional to support partial creation,
// but the frontend only displays complete briefs.

export interface IdeaBrief {
  id: string;
  name: string;
  tagline: string;
  priorityScore: number;
  effortEstimate: EffortLevel;
  revenueEstimate: string;

  problemStatement: string;
  targetAudience: string;
  marketSize: string;

  existingSolutions: string;
  gaps: string;

  proposedSolution: string;
  keyFeatures: string[];
  mvpScope: string;

  technicalSpec: {
    stack: string[];
    architecture: string;
    estimatedEffort: string;
  };

  businessModel: {
    pricing: string;
    revenueProjection: string;
    monetizationPath: string;
  };

  goToMarket: {
    launchStrategy: string;
    channels: string[];
    firstCustomers: string;
  };

  risks: string[];
  sources?: IdeaSource[];
  generatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  tier: CustomerTier;
  isAdmin?: boolean;
  preferences: UserPreferences;
  createdAt: string;
}

export interface AdminStatsOverview {
  totalUsers: number;
  activeSubscribers: number;
  totalIdeas: number;
  ideasToday: number;
  pipeline: {
    lastRunId: string | null;
    lastRunAt: string | null;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  createdAt: string;
}

export interface PipelineRunResponse {
  status: string;
  message: string;
  runId: string;
  config: Record<string, unknown>;
}

export interface PhaseStatsMap {
  scrape?: { totalPosts: number; reddit: number; hn: number; github: number };
  analyze?: { clusterCount: number; scoredCount: number; gapAnalysisCount: number };
  generate?: { briefCount: number };
  deliver?: { sent: number; failed: number; subscriberCount: number };
}

export interface PipelineStatus {
  status: 'ok' | 'error' | 'no_runs';
  runId?: string;
  startedAt?: string;
  completedAt?: string;
  success?: boolean;
  generationMode?: GenerationMode | null;
  generationDiagnostics?: GenerationDiagnosticsSnapshot | null;
  phases?: Record<string, string>;
  phaseStats?: PhaseStatsMap;
  lastCompletedPhase?: string | null;
  updatedAt?: string;
  message?: string;
}

export interface UserPreferences {
  emailFrequency: EmailFrequency;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: CustomerTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface PipelineRunRow {
  id: number;
  runId: string;
  status?: "running" | "completed" | "failed" | string;
  startedAt: string;
  completedAt: string | null;
  config: Record<string, unknown>;
  phases: Record<string, string>;
  phaseStats?: PhaseStatsMap;
  updatedAt?: string;
  lastCompletedPhase?: string | null;
  phaseResults?: Record<string, unknown> | null;
  stats: {
    postsScraped: number;
    clustersCreated: number;
    ideasGenerated: number;
    emailsSent: number;
  };
  success: boolean;
  totalDuration: number | null;
  errors: Array<{
    phase: string;
    message: string;
    timestamp: string;
    recoverable: boolean;
    severity?: string;
  }>;
  apiMetrics: {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    estimatedCost: number;
    callsByModel: Record<string, number>;
  } | null;
  generationMode?: GenerationMode | null;
  generationDiagnostics?: GenerationDiagnosticsSnapshot | null;
  briefSummaries: Array<{
    id?: string;
    name: string;
    tagline: string;
    priorityScore: number;
    effortEstimate: string;
    generationMeta?: {
      isFallback: boolean;
      fallbackReason?: string;
      providerMode?: GenerationMode;
      graphAttemptCount?: number;
      graphModelsUsed?: string[];
      graphFailedSections?: string[];
      graphRetriedSections?: string[];
      graphTrace?: GraphAttemptTrace[];
      handoffMeta?: {
        provider: "mock" | "n8n";
        status: "ok" | "skipped" | "error";
        reason?: string;
        durationMs?: number;
        addedCompetitors?: number;
        addedGaps?: number;
        addedDifferentiators?: number;
      };
      publishDecision?: "auto" | "review";
      publishConfidence?: number;
    } | null;
  }> | null;
}

export type GenerationMode = "legacy" | "graph";

export interface GraphAttemptTrace {
  attempt: number;
  model: string | null;
  retrySections: string[];
  mergedSections: string[];
  passedQuality: boolean;
  reasons: string[];
  failedSections: string[];
  startedAt: string;
  finishedAt: string;
}

export type FallbackReasonCode =
  | "missing_gap_analysis"
  | "missing_api_key"
  | "single_call_failed"
  | "batch_call_failed"
  | "unknown";

export type QualityFailureReasonCode =
  | "placeholder_content"
  | "length_too_short"
  | "list_minimum_not_met"
  | "nested_content_incomplete"
  | "unknown";

export interface GenerationDiagnosticsSnapshot {
  taxonomyVersion: "v1";
  generatedBriefCount: number;
  qualityPassCount: number;
  qualityFailCount: number;
  qualityPassRate: number;
  fallbackCount: number;
  fallbackRate: number;
  fallbackReasonCounts: Record<FallbackReasonCode, number>;
  qualityFailureReasonCounts: Record<QualityFailureReasonCode, number>;
  publishGate?: {
    enabled: boolean;
    confidenceThreshold: number;
    autoPublishCount: number;
    needsReviewCount: number;
  };
  budgetStop?: {
    reason: "budget_usd_exceeded" | "budget_tokens_exceeded" | "unknown";
    requestedBriefCount: number;
    generatedBriefCount: number;
    runBudgetUsd?: number;
    runBudgetTokens?: number;
    spentUsd: number;
    spentTokens: number;
  };
  costPerBriefUsd: number | null;
  latencyPerBriefMs: number | null;
}

export interface EmailLogRow {
  id: number;
  runId: string | null;
  recipientEmail: string;
  subject: string;
  messageId: string | null;
  status: 'sent' | 'delivered' | 'opened' | 'bounced' | 'complained' | 'failed';
  error: string | null;
  sentAt: string;
  deliveredAt: string | null;
  openedAt: string | null;
}
