/**
 * Centralized Environment Configuration for IdeaForge
 *
 * Single source of truth for all environment variables.
 * Validates at startup using Zod and exports a typed config object.
 *
 * Usage:
 *   import { config } from '../config/env';
 *   config.port // number, validated
 */

import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';

// Load .env file before validation
loadDotenv();

// --- Schema ---

const envSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Server
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().optional(),
  SUPABASE_DB_URL: z.string().optional(),

  // Supabase Auth
  SUPABASE_URL: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),

  // AI Providers
  ANTHROPIC_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),

  // Email
  RESEND_API_KEY: z.string().default(''),

  // Scrapers
  GITHUB_TOKEN: z.string().optional(),
  TWITTER_BEARER_TOKEN: z.string().optional(),
  NITTER_INSTANCES: z.string().optional(),

  // Web Search
  SERPAPI_KEY: z.string().default(''),
  BRAVE_API_KEY: z.string().default(''),

  // Stripe
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_PRICE_PRO_MONTHLY: z.string().default(''),
  STRIPE_PRICE_PRO_YEARLY: z.string().default(''),
  STRIPE_PRICE_ENT_MONTHLY: z.string().default(''),
  STRIPE_PRICE_ENT_YEARLY: z.string().default(''),

  // Checkout URLs
  CHECKOUT_SUCCESS_URL: z
    .string()
    .default('http://localhost:3000/account?session_id={CHECKOUT_SESSION_ID}'),
  CHECKOUT_CANCEL_URL: z
    .string()
    .default('http://localhost:3000/pricing'),
  BILLING_PORTAL_RETURN_URL: z
    .string()
    .default('http://localhost:3000/account'),

  // Admin
  ADMIN_EMAILS: z.string().default(''),

  // Scheduler
  SCHEDULER_CRON: z.string().default('0 6 * * *'),
  SCHEDULER_TIMEZONE: z.string().default('America/New_York'),
  SCHEDULER_ENABLED: z
    .string()
    .default('true')
    .transform((val) => val !== 'false'),
});

// --- Typed config object ---

export type Env = z.infer<typeof envSchema>;

/**
 * Parsed and validated environment configuration.
 *
 * Derived helpers are provided alongside raw env values so that
 * consumer modules don't need to re-derive them.
 */
export interface AppConfig extends Env {
  /** Resolved database connection string (DATABASE_URL ?? SUPABASE_DB_URL ?? '') */
  databaseUrl: string;
  /** true when NODE_ENV === 'production' */
  isProduction: boolean;
  /** true when NODE_ENV === 'test' */
  isTest: boolean;
  /** Resolved log level — explicit LOG_LEVEL or 'debug' in dev, 'info' in prod */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** CORS_ORIGIN split into an array */
  corsOrigins: string[];
  /** NITTER_INSTANCES split into an array (if set) */
  nitterInstances: string[] | undefined;
  /** Set of lowercase admin email addresses */
  adminEmails: Set<string>;
}

// --- Validation ---

let _config: AppConfig | null = null;

/**
 * Validate process.env and return a typed config object.
 * Throws with a clear message listing every invalid field.
 */
export function validateEnv(): AppConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Environment validation failed:\n${formatted}\n\nCheck your .env file or environment variables.`
    );
  }

  const env = result.data;

  const isProduction = env.NODE_ENV === 'production';
  const isTest = env.NODE_ENV === 'test';

  return {
    ...env,
    databaseUrl: env.DATABASE_URL || env.SUPABASE_DB_URL || '',
    isProduction,
    isTest,
    logLevel: env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
    corsOrigins: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    nitterInstances: env.NITTER_INSTANCES
      ? env.NITTER_INSTANCES.split(',').map((s) => s.trim())
      : undefined,
    adminEmails: new Set(
      env.ADMIN_EMAILS
        ? env.ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
        : []
    ),
  };
}

/**
 * Reset cached config. Call this in tests after mutating process.env
 * so that subsequent config reads pick up the new values.
 */
export function _resetConfigForTesting(): void {
  _config = null;
}

/**
 * Lazily-initialized singleton config.
 * First access triggers validation; subsequent accesses return the cached result.
 */
export const config: AppConfig = new Proxy({} as AppConfig, {
  get(_target, prop, receiver) {
    if (!_config) {
      _config = validateEnv();
    }
    return Reflect.get(_config, prop, receiver);
  },
});
