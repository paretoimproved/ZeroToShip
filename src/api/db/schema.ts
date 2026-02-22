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
    isAdmin: boolean('is_admin').notNull().default(false),
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
    keyHash: text('key_hash').notNull(),
    keyPrefix: varchar('key_prefix', { length: 12 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    lastUsedAt: timestamp('last_used_at'),
    expiresAt: timestamp('expires_at'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    keyHashIdx: uniqueIndex('api_keys_key_hash_idx').on(table.keyHash),
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
    userIdeaUnique: uniqueIndex('viewed_ideas_user_idea_idx').on(table.userId, table.ideaId),
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
 * Webhook events - idempotency tracking for Stripe webhooks
 */
export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  stripeEventId: varchar('stripe_event_id', { length: 255 }).notNull().unique(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  processedAt: timestamp('processed_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('processed'),
  error: text('error'),
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
  status: varchar('status', { length: 20 }).notNull().default('running'),
  generationMode: varchar('generation_mode', { length: 20 }).notNull().default('legacy'),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  config: jsonb('config').notNull(),
  phases: jsonb('phases').notNull(),
  stats: jsonb('stats').notNull(),
  phaseResults: jsonb('phase_results'),
  phaseStats: jsonb('phase_stats'),
  lastCompletedPhase: text('last_completed_phase'),
  success: boolean('success').notNull().default(false),
  totalDuration: integer('total_duration'),
  errors: jsonb('errors').default([]),
  apiMetrics: jsonb('api_metrics'),
  briefSummaries: jsonb('brief_summaries'),
  generationDiagnostics: jsonb('generation_diagnostics'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Onboarding email types
 */
export type OnboardingEmailType = 'welcome' | 'day1' | 'day3' | 'day7';

/**
 * Onboarding emails — tracks which drip emails have been sent to each user
 */
export const onboardingEmails = pgTable(
  'onboarding_emails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emailType: varchar('email_type', { length: 20 }).notNull(),
    sentAt: timestamp('sent_at').notNull().defaultNow(),
  },
  (table) => ({
    userEmailTypeUnique: uniqueIndex('onboarding_user_email_type_idx').on(
      table.userId,
      table.emailType
    ),
    userIdx: index('onboarding_emails_user_idx').on(table.userId),
  })
);

/**
 * Email delivery log status
 */
export type EmailLogStatus = 'sent' | 'delivered' | 'opened' | 'bounced' | 'complained' | 'failed';

/**
 * Email logs — tracks individual email deliveries and engagement
 */
export const emailLogs = pgTable(
  'email_logs',
  {
    id: serial('id').primaryKey(),
    runId: text('run_id'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 500 }).notNull(),
    messageId: varchar('message_id', { length: 255 }),
    status: varchar('status', { length: 20 }).notNull().default('sent'),
    error: text('error'),
    sentAt: timestamp('sent_at').notNull().defaultNow(),
    deliveredAt: timestamp('delivered_at'),
    openedAt: timestamp('opened_at'),
  },
  (table) => ({
    runIdIdx: index('email_logs_run_id_idx').on(table.runId),
    userIdIdx: index('email_logs_user_id_idx').on(table.userId),
    messageIdUniqueIdx: uniqueIndex('email_logs_message_id_unique_idx').on(table.messageId),
    statusIdx: index('email_logs_status_idx').on(table.status),
    sentAtIdx: index('email_logs_sent_at_idx').on(table.sentAt),
  })
);

/**
 * Spec generations — tracks per-user agent spec generation usage
 */
export const specGenerations = pgTable(
  'spec_generations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ideaId: uuid('idea_id')
      .notNull()
      .references(() => ideas.id, { onDelete: 'cascade' }),
    spec: jsonb('spec').notNull(), // The generated agent spec
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('spec_generations_user_idx').on(table.userId),
    ideaIdx: index('spec_generations_idea_idx').on(table.ideaId),
    createdAtIdx: index('spec_generations_created_at_idx').on(table.createdAt),
  })
);

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
  onboardingEmails: many(onboardingEmails),
  emailLogs: many(emailLogs),
  specGenerations: many(specGenerations),
}));

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  user: one(users, {
    fields: [emailLogs.userId],
    references: [users.id],
  }),
}));

export const onboardingEmailsRelations = relations(onboardingEmails, ({ one }) => ({
  user: one(users, {
    fields: [onboardingEmails.userId],
    references: [users.id],
  }),
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
  specGenerations: many(specGenerations),
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

export const specGenerationsRelations = relations(specGenerations, ({ one }) => ({
  user: one(users, {
    fields: [specGenerations.userId],
    references: [users.id],
  }),
  idea: one(ideas, {
    fields: [specGenerations.ideaId],
    references: [ideas.id],
  }),
}));
