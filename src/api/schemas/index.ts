/**
 * Zod Schemas for IdeaForge API
 *
 * Request/response validation schemas for all endpoints
 */

import { z } from 'zod';

// Common types
export const EffortLevelSchema = z.enum(['weekend', 'week', 'month', 'quarter']);
export const UserTierSchema = z.enum(['anonymous', 'free', 'pro', 'enterprise']);
export const EmailFrequencySchema = z.enum(['daily', 'weekly', 'never']);
export const SubscriptionStatusSchema = z.enum(['active', 'canceled', 'past_due']);

// Technical spec schema
export const TechnicalSpecSchema = z.object({
  stack: z.array(z.string()),
  architecture: z.string(),
  estimatedEffort: z.string(),
});

// Business model schema
export const BusinessModelSchema = z.object({
  pricing: z.string(),
  revenueProjection: z.string(),
  monetizationPath: z.string(),
});

// Go to market schema
export const GoToMarketSchema = z.object({
  launchStrategy: z.string(),
  channels: z.array(z.string()),
  firstCustomers: z.string(),
});

// Full idea brief schema (matches IdeaBrief interface)
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

// Idea summary (for list views)
export const IdeaSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tagline: z.string(),
  priorityScore: z.number(),
  effortEstimate: EffortLevelSchema,
  category: z.string().optional(),
  generatedAt: z.string(),
  brief: IdeaBriefSchema.optional(), // Full brief only for pro+ tiers
});

// Paginated response
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    hasMore: z.boolean(),
  });

// Ideas list response
export const IdeaListResponseSchema = z.object({
  ideas: z.array(IdeaSummarySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  tier: UserTierSchema,
});

// Paginated ideas list response (limit/offset style)
export const PaginatedIdeasResponseSchema = z.object({
  data: z.array(IdeaSummarySchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

// User preferences schema
export const UserPreferencesSchema = z.object({
  categories: z.array(z.string()),
  maxEffort: EffortLevelSchema,
  emailFrequency: EmailFrequencySchema,
  minPriorityScore: z.number().min(0).max(100).optional(),
});

// Update preferences request
export const UpdatePreferencesRequestSchema = z.object({
  categories: z.array(z.string()).optional(),
  maxEffort: EffortLevelSchema.optional(),
  emailFrequency: EmailFrequencySchema.optional(),
  minPriorityScore: z.number().min(0).max(100).optional(),
});

// User history response
export const UserHistoryResponseSchema = z.object({
  viewed: z.array(
    z.object({
      ideaId: z.string().uuid(),
      viewedAt: z.string(),
    })
  ),
  saved: z.array(
    z.object({
      ideaId: z.string().uuid(),
      savedAt: z.string(),
    })
  ),
});

// Subscription response
export const SubscriptionResponseSchema = z.object({
  id: z.string().uuid(),
  plan: UserTierSchema,
  status: SubscriptionStatusSchema,
  currentPeriodEnd: z.string().optional(),
  cancelAtPeriodEnd: z.boolean(),
});

// Pagination query params (limit/offset)
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Archive query params
export const ArchiveQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  category: z.string().optional(),
  effort: EffortLevelSchema.optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// Search query params (Enterprise)
export const SearchQuerySchema = z.object({
  q: z.string().min(1),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  category: z.string().optional(),
  effort: EffortLevelSchema.optional(),
});

// Validation request (Enterprise)
export const ValidationRequestSchema = z.object({
  ideaId: z.string().uuid(),
  depth: z.enum(['basic', 'deep']).default('basic'),
});

// Export format
export const ExportFormatSchema = z.enum(['json', 'csv']);

// Export query params
export const ExportQuerySchema = z.object({
  format: ExportFormatSchema.default('json'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

// API error response
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

// Rate limit info response
export const RateLimitInfoSchema = z.object({
  limit: z.number(),
  remaining: z.number(),
  resetAt: z.string(),
});

// Type exports
export type EffortLevel = z.infer<typeof EffortLevelSchema>;
export type UserTier = z.infer<typeof UserTierSchema>;
export type IdeaBrief = z.infer<typeof IdeaBriefSchema>;
export type IdeaSummary = z.infer<typeof IdeaSummarySchema>;
export type IdeaListResponse = z.infer<typeof IdeaListResponseSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequestSchema>;
export type UserHistoryResponse = z.infer<typeof UserHistoryResponseSchema>;
export type SubscriptionResponse = z.infer<typeof SubscriptionResponseSchema>;
export type ArchiveQuery = z.infer<typeof ArchiveQuerySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type ValidationRequest = z.infer<typeof ValidationRequestSchema>;
export type ExportQuery = z.infer<typeof ExportQuerySchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;
