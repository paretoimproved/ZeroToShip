/**
 * Database Schema for ZeroToShip API
 *
 * Uses Drizzle ORM with PostgreSQL (Supabase)
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  serial,
  decimal,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  date,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * User tiers for subscription management
 */
export type UserTier = 'anonymous' | 'free' | 'pro' | 'enterprise';

/**
 * Effort levels for ideas
 */
export type EffortLevel = 'weekend' | 'week' | 'month' | 'quarter';

/**
 * Users table - managed by Supabase Auth
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }),
    tier: varchar('tier', { length: 20 }).notNull().default('free'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
  })
);

/**
 * User preferences for filtering ideas
 */
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  categories: jsonb('categories').$type<string[]>().default([]),
  maxEffort: varchar('max_effort', { length: 20 }).default('quarter'),
  emailFrequency: varchar('email_frequency', { length: 20 }).default('daily'),
  minPriorityScore: decimal('min_priority_score', { precision: 5, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * API keys for enterprise tier
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 64 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    lastUsedAt: timestamp('last_used_at'),
    expiresAt: timestamp('expires_at'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    keyIdx: index('api_keys_key_idx').on(table.key),
  })
);

/**
 * Ideas table - generated business briefs
 */
export const ideas = pgTable(
  'ideas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    tagline: text('tagline').notNull(),
    priorityScore: decimal('priority_score', { precision: 5, scale: 2 }).notNull(),
    effortEstimate: varchar('effort_estimate', { length: 20 }).notNull(),
    revenueEstimate: text('revenue_estimate'),
    category: varchar('category', { length: 100 }),

    // Problem section
    problemStatement: text('problem_statement').notNull(),
    targetAudience: text('target_audience'),
    marketSize: text('market_size'),

    // Solution section
    existingSolutions: text('existing_solutions'),
    gaps: text('gaps'),
    proposedSolution: text('proposed_solution'),
    keyFeatures: jsonb('key_features').$type<string[]>().default([]),
    mvpScope: text('mvp_scope'),

    // Technical spec
    technicalSpec: jsonb('technical_spec').$type<{
      stack: string[];
      architecture: string;
      estimatedEffort: string;
    }>(),

    // Business model
    businessModel: jsonb('business_model').$type<{
      pricing: string;
      revenueProjection: string;
      monetizationPath: string;
    }>(),

    // Go to market
    goToMarket: jsonb('go_to_market').$type<{
      launchStrategy: string;
      channels: string[];
      firstCustomers: string;
    }>(),

    risks: jsonb('risks').$type<string[]>().default([]),

    sources: jsonb('sources').$type<Array<{
      platform: string;
      title: string;
      url: string;
      score: number;
      commentCount: number;
      postedAt: string;
    }>>().default([]),

    generatedAt: timestamp('generated_at').notNull().defaultNow(),
    publishedAt: timestamp('published_at'),
    isPublished: boolean('is_published').notNull().default(false),
  },
  (table) => ({
    priorityIdx: index('ideas_priority_idx').on(table.priorityScore),
    publishedAtIdx: index('ideas_published_at_idx').on(table.publishedAt),
    categoryIdx: index('ideas_category_idx').on(table.category),
    effortIdx: index('ideas_effort_idx').on(table.effortEstimate),
  })
);

/**
 * User saved ideas (bookmarks)
 */
export const savedIdeas = pgTable(
  'saved_ideas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ideaId: uuid('idea_id')
      .notNull()
      .references(() => ideas.id, { onDelete: 'cascade' }),
    savedAt: timestamp('saved_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('saved_ideas_user_idx').on(table.userId),
    ideaIdx: index('saved_ideas_idea_idx').on(table.ideaId),
  })
);

/**
 * User viewed ideas (history)
 */
export const viewedIdeas = pgTable(
  'viewed_ideas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ideaId: uuid('idea_id')
      .notNull()
      .references(() => ideas.id, { onDelete: 'cascade' }),
    viewedAt: timestamp('viewed_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('viewed_ideas_user_idx').on(table.userId),
    ideaIdx: index('viewed_ideas_idea_idx').on(table.ideaId),
  })
);

/**
 * Subscriptions - managed by Stripe webhooks
 */
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  plan: varchar('plan', { length: 20 }).notNull().default('free'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Rate limit tracking
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: varchar('identifier', { length: 255 }).notNull(), // user_id or IP
    endpoint: varchar('endpoint', { length: 100 }).notNull(),
    requestCount: integer('request_count').notNull().default(0),
    windowStart: timestamp('window_start').notNull().defaultNow(),
    windowEnd: timestamp('window_end').notNull(),
  },
  (table) => ({
    identifierIdx: index('rate_limits_identifier_idx').on(table.identifier),
    windowIdx: index('rate_limits_window_idx').on(table.windowEnd),
  })
);

/**
 * Validation requests (Enterprise feature)
 */
export const validationRequests = pgTable('validation_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  ideaId: uuid('idea_id')
    .notNull()
    .references(() => ideas.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  result: jsonb('result'),
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

/**
 * Usage tracking for daily limits (Enterprise rate limiting)
 *
 * Tracks daily usage of AI generation features to prevent abuse:
 * - Fresh brief generation counts
 * - Validation request counts
 * - Overage billing for Enterprise users
 */
export const usageTracking = pgTable(
  'usage_tracking',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    freshBriefsUsed: integer('fresh_briefs_used').notNull().default(0),
    validationRequestsUsed: integer('validation_requests_used').notNull().default(0),
    overageBriefs: integer('overage_briefs').notNull().default(0),
    overageAmountCents: integer('overage_amount_cents').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userDateUnique: uniqueIndex('usage_user_date_idx').on(table.userId, table.date),
    userIdx: index('usage_tracking_user_idx').on(table.userId),
  })
);

/**
 * Pipeline runs — persisted results of each scheduler run
 */
export const pipelineRuns = pgTable('pipeline_runs', {
  id: serial('id').primaryKey(),
  runId: text('run_id').notNull().unique(),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  config: jsonb('config').notNull(),
  phases: jsonb('phases').notNull(),
  stats: jsonb('stats').notNull(),
  success: boolean('success').notNull().default(false),
  totalDuration: integer('total_duration'),
  errors: jsonb('errors').default([]),
  apiMetrics: jsonb('api_metrics'),
  briefSummaries: jsonb('brief_summaries'),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  apiKeys: many(apiKeys),
  savedIdeas: many(savedIdeas),
  viewedIdeas: many(viewedIdeas),
  validationRequests: many(validationRequests),
  usageRecords: many(usageTracking),
}));

export const usageTrackingRelations = relations(usageTracking, ({ one }) => ({
  user: one(users, {
    fields: [usageTracking.userId],
    references: [users.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const ideasRelations = relations(ideas, ({ many }) => ({
  savedBy: many(savedIdeas),
  viewedBy: many(viewedIdeas),
  validationRequests: many(validationRequests),
}));

export const savedIdeasRelations = relations(savedIdeas, ({ one }) => ({
  user: one(users, {
    fields: [savedIdeas.userId],
    references: [users.id],
  }),
  idea: one(ideas, {
    fields: [savedIdeas.ideaId],
    references: [ideas.id],
  }),
}));

export const viewedIdeasRelations = relations(viewedIdeas, ({ one }) => ({
  user: one(users, {
    fields: [viewedIdeas.userId],
    references: [users.id],
  }),
  idea: one(ideas, {
    fields: [viewedIdeas.ideaId],
    references: [ideas.id],
  }),
}));

export const validationRequestsRelations = relations(validationRequests, ({ one }) => ({
  user: one(users, {
    fields: [validationRequests.userId],
    references: [users.id],
  }),
  idea: one(ideas, {
    fields: [validationRequests.ideaId],
    references: [ideas.id],
  }),
}));
