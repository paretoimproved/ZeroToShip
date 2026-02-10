/**
 * Tier-Based Rate Limiting Middleware for ZeroToShip API
 *
 * Enforces rate limits based on user tier:
 * - Anonymous: 10 requests/hour
 * - Free: 100 requests/hour
 * - Pro: 1000 requests/hour
 * - Enterprise: 10000 requests/hour
 *
 * Uses a store abstraction:
 * - RedisRateLimitStore for production (if REDIS_URL is configured)
 * - MemoryRateLimitStore as fallback
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/env';
import { getRedisClient } from '../../config/redis';
import type { UserTier } from '../schemas';
import {
  RATE_LIMITS,
  IDEAS_LIMIT,
} from '../config/tiers';

export { RATE_LIMITS, IDEAS_LIMIT };

/** Interval for cleaning up expired rate limit entries (10 minutes) */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

/** One hour in milliseconds */
const ONE_HOUR_MS = 60 * 60 * 1000;

// ─── Store Interface ─────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface RateLimitStore {
  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
  clear(key: string): void;
}

// ─── Memory Store ────────────────────────────────────────────────────────────

const memoryMap = new Map<string, { count: number; windowStart: number }>();

export class MemoryRateLimitStore implements RateLimitStore {
  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    let entry = memoryMap.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 0, windowStart: now };
      memoryMap.set(key, entry);
    }

    const remaining = limit - entry.count;
    const resetAt = new Date(entry.windowStart + windowMs);

    if (remaining <= 0) {
      return { allowed: false, remaining: 0, resetAt };
    }

    entry.count++;
    memoryMap.set(key, entry);

    return { allowed: true, remaining: remaining - 1, resetAt };
  }

  clear(key: string): void {
    memoryMap.delete(key);
  }
}

// ─── Redis Store ─────────────────────────────────────────────────────────────

export class RedisRateLimitStore implements RateLimitStore {
  private fallback = new MemoryRateLimitStore();

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const redis = getRedisClient();
    if (!redis) {
      return this.fallback.check(key, limit, windowMs);
    }

    const windowSec = Math.ceil(windowMs / 1000);
    const redisKey = `ratelimit:${key}`;

    try {
      const multi = redis.multi();
      multi.incr(redisKey);
      multi.pttl(redisKey);
      const results = await multi.exec();

      if (!results) {
        return this.fallback.check(key, limit, windowMs);
      }

      const [incrResult, pttlResult] = results;
      const count = incrResult[1] as number;
      const pttl = pttlResult[1] as number;

      // First request in window — set expiry
      if (count === 1 || pttl < 0) {
        await redis.expire(redisKey, windowSec);
      }

      const remaining = Math.max(0, limit - count);
      const resetMs = pttl > 0 ? pttl : windowMs;
      const resetAt = new Date(Date.now() + resetMs);

      return {
        allowed: count <= limit,
        remaining,
        resetAt,
      };
    } catch (err) {
      console.warn('[RateLimit] Redis error, falling back to memory:', (err as Error).message);
      return this.fallback.check(key, limit, windowMs);
    }
  }

  clear(key: string): void {
    const redis = getRedisClient();
    if (redis) {
      redis.del(`ratelimit:${key}`).catch(() => {});
    }
    this.fallback.clear(key);
  }
}

// ─── Store Selection ─────────────────────────────────────────────────────────

let _store: RateLimitStore | null = null;

function getStore(): RateLimitStore {
  if (_store) return _store;

  if (config.REDIS_URL) {
    _store = new RedisRateLimitStore();
  } else {
    _store = new MemoryRateLimitStore();
  }

  return _store;
}

/**
 * Override the rate limit store. For testing only.
 */
export function _setStoreForTesting(store: RateLimitStore | null): void {
  _store = store;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRateLimitKey(request: FastifyRequest): string {
  if (request.userId) {
    return `user:${request.userId}`;
  }
  return `ip:${request.ip}`;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const key = getRateLimitKey(request);
  const tier = request.userTier;
  const tierConfig = RATE_LIMITS[tier];

  const store = getStore();
  const result = await store.check(key, tierConfig.requests, tierConfig.windowMs);

  // Set rate limit headers
  reply.header('X-RateLimit-Limit', tierConfig.requests);
  reply.header('X-RateLimit-Remaining', result.remaining);
  reply.header('X-RateLimit-Reset', result.resetAt.toISOString());
  reply.header('X-RateLimit-Tier', tier);

  if (!result.allowed) {
    reply.status(429).send({
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded. Upgrade your plan for higher limits.`,
      details: {
        tier,
        limit: tierConfig.requests,
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
  const tierConfig = RATE_LIMITS[tier];
  const now = Date.now();

  const entry = memoryMap.get(key);
  if (!entry || now - entry.windowStart > tierConfig.windowMs) {
    return {
      limit: tierConfig.requests,
      remaining: tierConfig.requests,
      resetAt: new Date(now + tierConfig.windowMs),
    };
  }

  return {
    limit: tierConfig.requests,
    remaining: Math.max(0, tierConfig.requests - entry.count),
    resetAt: new Date(entry.windowStart + tierConfig.windowMs),
  };
}

/**
 * Clear rate limit for testing
 */
export function clearRateLimit(key: string): void {
  const store = getStore();
  store.clear(key);
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupExpiredRateLimits(): void {
  const now = Date.now();
  const oneHourAgo = now - ONE_HOUR_MS;

  for (const [key, entry] of memoryMap.entries()) {
    if (entry.windowStart < oneHourAgo) {
      memoryMap.delete(key);
    }
  }
}

// Clean up expired entries every 10 minutes
if (!config.isTest) {
  setInterval(cleanupExpiredRateLimits, CLEANUP_INTERVAL_MS);
}
