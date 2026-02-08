/**
 * Zod Schemas for ZeroToShip API
 *
 * Request/response validation schemas for all endpoints.
 * Core types are imported from @zerotoship/shared; this module adds
 * API-specific request/query schemas that are only used server-side.
 */

import { z } from 'zod';
import {
  EffortLevelSchema,
  UserTierSchema,
  EmailFrequencySchema,
  SubscriptionStatusSchema,
  TechnicalSpecSchema,
  BusinessModelSchema,
  GoToMarketSchema,
  IdeaBriefSchema,
  IdeaSummarySchema,
  PaginatedResponseSchema,
  ApiErrorSchema,
  SubscriptionResponseSchema,
} from '@zerotoship/shared';

// ─── Re-export shared types & schemas ────────────────────────────────────────
// These are the single source of truth, shared with the frontend.
export {
  EffortLevelSchema,
  UserTierSchema,
  EmailFrequencySchema,
  SubscriptionStatusSchema,
  TechnicalSpecSchema,
  BusinessModelSchema,
  GoToMarketSchema,
  IdeaBriefSchema,
  IdeaSummarySchema,
  PaginatedResponseSchema,
  ApiErrorSchema,
  SubscriptionResponseSchema,
};

export type {
  EffortLevel,
  UserTier,
  EmailFrequency,
  SubscriptionStatus,
  TechnicalSpec,
  BusinessModel,
  GoToMarket,
  IdeaBrief,
  IdeaSummary,
  PaginatedResponse,
  ApiError,
  SubscriptionResponse,
} from '@zerotoship/shared';

// ─── API-specific schemas (server-side only) ─────────────────────────────────

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

// Rate limit info response
export const RateLimitInfoSchema = z.object({
  limit: z.number(),
  remaining: z.number(),
  resetAt: z.string(),
});

// Type exports for API-specific schemas
export type IdeaListResponse = z.infer<typeof IdeaListResponseSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequestSchema>;
export type UserHistoryResponse = z.infer<typeof UserHistoryResponseSchema>;
export type ArchiveQuery = z.infer<typeof ArchiveQuerySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type ValidationRequest = z.infer<typeof ValidationRequestSchema>;
export type ExportQuery = z.infer<typeof ExportQuerySchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;
