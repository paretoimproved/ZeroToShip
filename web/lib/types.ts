/**
 * TypeScript types for IdeaForge Web Dashboard
 *
 * Shared API contract types (enums, generic responses, error shapes)
 * are imported from @ideaforge/shared. Frontend-specific types that
 * differ from the backend (User, UserPreferences, Subscription, and
 * IdeaBrief with all fields required) are defined locally.
 */

import type { EffortLevel } from '@ideaforge/shared';

// Re-export shared types so existing imports from "@/lib/types" keep working
export type {
  EffortLevel,
  PaginatedResponse,
  ApiError,
} from '@ideaforge/shared';

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
  preferences: UserPreferences;
  createdAt: string;
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
