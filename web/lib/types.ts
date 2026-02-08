/**
 * TypeScript types for IdeaForge Web Dashboard
 *
 * Shared API contract types are inlined here to allow independent
 * Vercel deployment without the workspace dependency.
 * Canonical source: packages/shared/src/index.ts
 */

// ─── Shared types (inlined from @ideaforge/shared) ──────────────────────────

export type EffortLevel = 'weekend' | 'week' | 'month' | 'quarter';

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
  generatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  tier: "free" | "pro" | "enterprise";
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
  config: {
    hoursBack: number;
    maxBriefs: number;
    dryRun: boolean;
  };
}

export interface PipelineStatus {
  status: 'ok' | 'error' | 'no_runs';
  runId?: string;
  startedAt?: string;
  phases?: Record<string, string>;
  lastCompletedPhase?: string | null;
  updatedAt?: string;
  message?: string;
}

export interface UserPreferences {
  categories: string[];
  effortFilter: EffortLevel[];
  emailFrequency: "daily" | "weekly" | "none";
  minPriorityScore: number;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: "free" | "pro" | "enterprise";
  status: "active" | "canceled" | "past_due";
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}
