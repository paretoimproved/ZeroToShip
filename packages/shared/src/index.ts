/**
 * @zerotoship/shared — Shared types and Zod schemas
 *
 * Single source of truth for API contract types used by both
 * the backend (src/) and frontend (web/).
 */

import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const EffortLevelSchema = z.enum(['weekend', 'week', 'month', 'quarter']);
export type EffortLevel = z.infer<typeof EffortLevelSchema>;

export const UserTierSchema = z.enum(['anonymous', 'free', 'pro', 'enterprise']);
export type UserTier = z.infer<typeof UserTierSchema>;

export const EmailFrequencySchema = z.enum(['daily', 'weekly', 'never']);
export type EmailFrequency = z.infer<typeof EmailFrequencySchema>;

export const SubscriptionStatusSchema = z.enum(['active', 'canceled', 'past_due']);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

// ─── Idea Sub-schemas ────────────────────────────────────────────────────────

export const TechnicalSpecSchema = z.object({
  stack: z.array(z.string()),
  architecture: z.string(),
  estimatedEffort: z.string(),
});
export type TechnicalSpec = z.infer<typeof TechnicalSpecSchema>;

export const BusinessModelSchema = z.object({
  pricing: z.string(),
  revenueProjection: z.string(),
  monetizationPath: z.string(),
});
export type BusinessModel = z.infer<typeof BusinessModelSchema>;

export const GoToMarketSchema = z.object({
  launchStrategy: z.string(),
  channels: z.array(z.string()),
  firstCustomers: z.string(),
});
export type GoToMarket = z.infer<typeof GoToMarketSchema>;

// ─── Idea Schemas ────────────────────────────────────────────────────────────

export const IdeaBriefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tagline: z.string(),
  priorityScore: z.number(),
  effortEstimate: EffortLevelSchema,
  revenueEstimate: z.string().optional(),

  problemStatement: z.string(),
  targetAudience: z.string().optional(),
  marketSize: z.string().optional(),

  existingSolutions: z.string().optional(),
  gaps: z.string().optional(),

  proposedSolution: z.string().optional(),
  keyFeatures: z.array(z.string()).optional(),
  mvpScope: z.string().optional(),

  technicalSpec: TechnicalSpecSchema.optional(),
  businessModel: BusinessModelSchema.optional(),
  goToMarket: GoToMarketSchema.optional(),

  risks: z.array(z.string()).optional(),
  generatedAt: z.string(),
  category: z.string().optional(),
});
export type IdeaBrief = z.infer<typeof IdeaBriefSchema>;

export const IdeaSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tagline: z.string(),
  priorityScore: z.number(),
  effortEstimate: EffortLevelSchema,
  category: z.string().optional(),
  generatedAt: z.string(),
  brief: IdeaBriefSchema.optional(),
});
export type IdeaSummary = z.infer<typeof IdeaSummarySchema>;

// ─── Response Schemas ────────────────────────────────────────────────────────

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    hasMore: z.boolean(),
  });

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ─── Subscription Schema ────────────────────────────────────────────────────

export const SubscriptionResponseSchema = z.object({
  id: z.string().uuid(),
  plan: UserTierSchema,
  status: SubscriptionStatusSchema,
  currentPeriodEnd: z.string().optional(),
  cancelAtPeriodEnd: z.boolean(),
});
export type SubscriptionResponse = z.infer<typeof SubscriptionResponseSchema>;
