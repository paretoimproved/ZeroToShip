/**
 * Tier-Based Rate Limiting Middleware for ZeroToShip API
 *
 * Enforces rate limits based on user tier:
 * - Anonymous: 10 requests/hour
 * - Free: 100 requests/hour
 * - Pro: 1000 requests/hour
 * - Enterprise: 10000 requests/hour
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gt } from 'drizzle-orm';
import { config } from '../../config/env';
import { db, rateLimits } from '../db/client';
import type { UserTier } from '../schemas';
import {
  RATE_LIMITS,
  IDEAS_LIMIT,
} from '../config/tiers';

export { RATE_LIMITS, IDEAS_LIMIT };

/** One hour in milliseconds */
const ONE_HOUR_MS = 60 * 60 * 1000;

/** Interval for cleaning up expired rate limit entries (10 minutes) */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * In-memory rate limit tracking for performance
 * Falls back to database for persistence across instances
 */
const memoryStore = new Map<string, { count: number; windowStart: number }>();

/**
 * Get rate limit key for request
 */
function getRateLimitKey(request: FastifyRequest): string {
  if (request.userId) {
    return `user:${request.userId}`;
  }
  return `ip:${request.ip}`;
}

/**
 * Check and update rate limit (in-memory)
 */
function checkRateLimitMemory(
  key: string,
  tier: UserTier
): { allowed: boolean; remaining: number; resetAt: Date } {
  const config = RATE_LIMITS[tier];
  const now = Date.now();

  let entry = memoryStore.get(key);

  // Reset if window expired
  if (!entry || now - entry.windowStart > config.windowMs) {
    entry = { count: 0, windowStart: now };
    memoryStore.set(key, entry);
  }

  const remaining = config.requests - entry.count;
  const resetAt = new Date(entry.windowStart + config.windowMs);

  if (remaining <= 0) {
    return { allowed: false, remaining: 0, resetAt };
  }

  // Increment count
  entry.count++;
  memoryStore.set(key, entry);

  return { allowed: true, remaining: remaining - 1, resetAt };
}

/**
 * Check and update rate limit (database - for distributed deployments)
 */
async function checkRateLimitDb(
  key: string,
  tier: UserTier
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const config = RATE_LIMITS[tier];
  const now = new Date();
  const windowEnd = new Date(now.getTime() + config.windowMs);

  try {
    // Get current rate limit entry
    const result = await db
      .select()
      .from(rateLimits)
      .where(
        and(
          eq(rateLimits.identifier, key),
          eq(rateLimits.endpoint, 'global'),
          gt(rateLimits.windowEnd, now)
        )
      )
      .limit(1);

    let entry = result[0];

    if (!entry) {
      // Create new window
      const inserted = await db
        .insert(rateLimits)
        .values({
          identifier: key,
          endpoint: 'global',
          requestCount: 1,
          windowStart: now,
          windowEnd,
        })
        .returning();
      entry = inserted[0];

      return {
        allowed: true,
        remaining: config.requests - 1,
        resetAt: windowEnd,
      };
    }

    const remaining = config.requests - entry.requestCount;

    if (remaining <= 0) {
      return { allowed: false, remaining: 0, resetAt: entry.windowEnd };
    }

    // Increment count
    await db
      .update(rateLimits)
      .set({ requestCount: entry.requestCount + 1 })
      .where(eq(rateLimits.id, entry.id));

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt: entry.windowEnd,
    };
  } catch (err) {
    // On error, fall back to memory
    console.warn('Rate limit DB error, using memory:', err);
    return checkRateLimitMemory(key, tier);
  }
}

/**
 * Rate limiting middleware
 * Uses in-memory for single instance, DB for distributed
 */
export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const key = getRateLimitKey(request);
  const tier = request.userTier;

  // Use memory store for development, DB for production
  const result =
    config.isProduction
      ? await checkRateLimitDb(key, tier)
      : checkRateLimitMemory(key, tier);

  // Set rate limit headers
  reply.header('X-RateLimit-Limit', RATE_LIMITS[tier].requests);
  reply.header('X-RateLimit-Remaining', result.remaining);
  reply.header('X-RateLimit-Reset', result.resetAt.toISOString());
  reply.header('X-RateLimit-Tier', tier);

  if (!result.allowed) {
    reply.status(429).send({
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded. Upgrade your plan for higher limits.`,
      details: {
        tier,
        limit: RATE_LIMITS[tier].requests,
        resetAt: result.resetAt.toISOString(),
      },
    });
  }
}

/**
 * Get current rate limit status for a user/IP
 */
export function getRateLimitStatus(
  request: FastifyRequest
): { limit: number; remaining: number; resetAt: Date } {
  const key = getRateLimitKey(request);
  const tier = request.userTier;
  const config = RATE_LIMITS[tier];
  const now = Date.now();

  const entry = memoryStore.get(key);
  if (!entry || now - entry.windowStart > config.windowMs) {
    return {
      limit: config.requests,
      remaining: config.requests,
      resetAt: new Date(now + config.windowMs),
    };
  }

  return {
    limit: config.requests,
    remaining: Math.max(0, config.requests - entry.count),
    resetAt: new Date(entry.windowStart + config.windowMs),
  };
}

/**
 * Clear rate limit for testing
 */
export function clearRateLimit(key: string): void {
  memoryStore.delete(key);
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupExpiredRateLimits(): void {
  const now = Date.now();
  const oneHourAgo = now - ONE_HOUR_MS;

  for (const [key, entry] of memoryStore.entries()) {
    if (entry.windowStart < oneHourAgo) {
      memoryStore.delete(key);
    }
  }
}

// Clean up expired entries every 10 minutes
if (!config.isTest) {
  setInterval(cleanupExpiredRateLimits, CLEANUP_INTERVAL_MS);
}
