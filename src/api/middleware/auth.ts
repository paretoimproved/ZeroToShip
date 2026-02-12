/**
 * Authentication Middleware for ZeroToShip API
 *
 * Supports:
 * - JWT tokens (for web users via Supabase Auth)
 * - API keys (for Enterprise tier programmatic access)
 */

import { createHash, randomBytes } from 'crypto';
import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { config } from '../../config/env';
import { db, users, apiKeys, subscriptions } from '../db/client';
import type { UserTier } from '../schemas';

/**
 * Hash an API key with SHA-256 for secure storage and lookup
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// Supabase client for JWT verification
const supabaseUrl = config.SUPABASE_URL;
const supabaseServiceKey = config.SUPABASE_SERVICE_ROLE_KEY;

/**
 * TTL cache for user tier lookups
 * Tiers change ~once/month (subscription events), so 60s staleness is safe.
 */
const TIER_CACHE_TTL_MS = 60_000;
const tierCache = new Map<string, { tier: UserTier; expiresAt: number }>();

/**
 * Batch `lastUsedAt` writes for API keys
 * Instead of updating on every request, update at most once per minute per key.
 */
const LAST_USED_THROTTLE_MS = 60_000;
const lastUsedTimestamps = new Map<string, number>();

export const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

/**
 * Get user tier from subscription
 */
function getTierFromPlan(plan: string | null): UserTier {
  switch (plan) {
    case 'enterprise':
      return 'enterprise';
    case 'pro':
      return 'pro';
    case 'free':
      return 'free';
    default:
      return 'free';
  }
}

/**
 * Verify JWT token from Supabase Auth
 */
async function verifyJWT(
  token: string
): Promise<{ userId: string; email: string; userMetadata?: Record<string, unknown> } | null> {
  if (!supabase) {
    console.warn('Supabase not configured - JWT verification disabled');
    return null;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email || '',
      userMetadata: user.user_metadata as Record<string, unknown> | undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Verify API key for Enterprise access
 */
async function verifyApiKey(
  key: string
): Promise<{ userId: string; keyId: string } | null> {
  try {
    const keyHash = hashApiKey(key);
    const result = await db
      .select({
        id: apiKeys.id,
        userId: apiKeys.userId,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    const apiKey = result[0];
    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Throttled last-used update: at most once per minute per key
    const lastUpdated = lastUsedTimestamps.get(apiKey.id);
    const now = Date.now();
    if (!lastUpdated || now - lastUpdated > LAST_USED_THROTTLE_MS) {
      lastUsedTimestamps.set(apiKey.id, now);
      db.update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, apiKey.id))
        .execute()
        .catch(() => {});
    }

    return {
      userId: apiKey.userId,
      keyId: apiKey.id,
    };
  } catch {
    return null;
  }
}

/**
 * Get user's subscription tier (with 60s TTL cache)
 *
 * Cache invalidation: Stripe webhooks (billing.ts) call updateSubscription()
 * which invalidates the cache. We accept up to 60s of staleness
 * because tier changes are rare (~once/month per user).
 */
async function getUserTier(userId: string): Promise<UserTier> {
  // Check cache first
  const cached = tierCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tier;
  }

  try {
    const result = await db
      .select({ plan: subscriptions.plan, status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    const sub = result[0];
    const tier = (!sub || sub.status !== 'active') ? 'free' : getTierFromPlan(sub.plan);

    // Cache the result
    tierCache.set(userId, { tier, expiresAt: Date.now() + TIER_CACHE_TTL_MS });

    return tier;
  } catch {
    return 'free';
  }
}

/**
 * Invalidate tier cache for a user (call from Stripe webhooks)
 */
export function invalidateTierCache(userId: string): void {
  tierCache.delete(userId);
}

/**
 * Optional authentication - sets user info if auth provided, otherwise continues as anonymous
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Default to anonymous
  request.userTier = 'anonymous';

  // Check for API key first (X-API-Key header)
  const apiKey = request.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    const keyData = await verifyApiKey(apiKey);
    if (keyData) {
      request.userId = keyData.userId;
      request.apiKeyId = keyData.keyId;
      // API key users are always enterprise tier
      request.userTier = 'enterprise';
      return;
    }
  }

  // Check for JWT token (Authorization: Bearer <token>)
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const userData = await verifyJWT(token);
    if (userData) {
      request.userId = userData.userId;
      request.userEmail = userData.email;
      request.userMetadata = userData.userMetadata;
      request.userTier = await getUserTier(userData.userId);

      // Admin tier override: if admin sends X-Tier-Override, apply it
      const tierOverride = request.headers['x-tier-override'] as string | undefined;
      if (tierOverride && await isAdmin(userData.userId, userData.email)) {
        const validTiers: UserTier[] = ['anonymous', 'free', 'pro', 'enterprise'];
        if (validTiers.includes(tierOverride as UserTier)) {
          request.userTier = tierOverride as UserTier;
        }
      }

      return;
    }
  }
}

/**
 * Required authentication - returns 401 if not authenticated
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await optionalAuth(request, reply);

  if (!request.userId) {
    reply.status(401).send({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }
}

/**
 * Require enterprise tier - returns 403 if not enterprise
 */
export async function requireEnterprise(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireAuth(request, reply);

  if (reply.sent) return;

  if (request.userTier !== 'enterprise') {
    reply.status(403).send({
      code: 'ENTERPRISE_REQUIRED',
      message: 'This endpoint requires an Enterprise subscription',
    });
  }
}

/**
 * Require pro or higher tier
 */
export async function requirePro(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireAuth(request, reply);

  if (reply.sent) return;

  if (request.userTier !== 'pro' && request.userTier !== 'enterprise') {
    reply.status(403).send({
      code: 'PRO_REQUIRED',
      message: 'This endpoint requires a Builder or Enterprise subscription',
    });
  }
}

/**
 * Check if an email address belongs to an admin via env allowlist.
 * Prefer checking user.isAdmin from the DB when possible.
 */
export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  return config.adminEmails.has(email.toLowerCase());
}

/**
 * Check if a user is an admin by querying the DB isAdmin column.
 * Falls back to email allowlist if the DB check fails.
 */
async function isAdmin(userId: string, email: string | undefined): Promise<boolean> {
  try {
    const result = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length > 0) {
      return result[0].isAdmin;
    }
  } catch {
    // Fall back to email allowlist
  }
  return isAdminEmail(email);
}

/**
 * Require admin access - returns 403 if not an admin
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireAuth(request, reply);

  if (reply.sent) return;

  const admin = await isAdmin(request.userId!, request.userEmail);
  if (!admin) {
    reply.status(403).send({
      code: 'ADMIN_REQUIRED',
      message: 'Admin access required',
    });
  }
}

/**
 * Auth plugin for route registration
 */
export const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Decorate request with auth properties
  fastify.decorateRequest('userId', undefined);
  fastify.decorateRequest('userEmail', undefined);
  fastify.decorateRequest('userTier', 'anonymous' as UserTier);
  fastify.decorateRequest('apiKeyId', undefined);
  fastify.decorateRequest('userMetadata', undefined);
};

/**
 * Generate a new API key
 */
export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'if_';
  const bytes = randomBytes(48);
  let key = prefix;
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(bytes[i] % chars.length);
  }
  return key;
}

/**
 * Create a new API key for a user
 */
export async function createApiKeyForUser(
  userId: string,
  name: string,
  expiresInDays?: number
): Promise<{ id: string; key: string } | null> {
  try {
    // Verify user is enterprise tier
    const tier = await getUserTier(userId);
    if (tier !== 'enterprise') {
      return null;
    }

    const key = generateApiKey();
    const keyHash = hashApiKey(key);
    const keyPrefix = key.slice(0, 4) + '...' + key.slice(-4);
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const result = await db
      .insert(apiKeys)
      .values({
        userId,
        keyHash,
        keyPrefix,
        name,
        expiresAt,
      })
      .returning({ id: apiKeys.id });

    return { id: result[0].id, key };
  } catch {
    return null;
  }
}
