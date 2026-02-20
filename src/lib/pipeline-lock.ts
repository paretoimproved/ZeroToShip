/**
 * Pipeline Distributed Lock
 *
 * Uses Redis SET NX EX to prevent concurrent pipeline runs.
 * When Redis is unavailable, falls back to a PostgreSQL advisory lock
 * so concurrent runs are still prevented.
 */

import { sql } from 'drizzle-orm';
import { getRedisClient } from './redis';
import { db } from '../api/db/client';

const LOCK_KEY = 'pipeline:lock';
const DEFAULT_TTL_SECONDS = 600; // 10 minutes
export const PIPELINE_LOCK_TTL_SECONDS = DEFAULT_TTL_SECONDS;

/**
 * Fixed advisory lock key derived from the lock name.
 * pg_try_advisory_lock takes a bigint — we use a stable hash.
 */
const ADVISORY_LOCK_KEY = 2_891_347_651; // arbitrary stable constant for 'pipeline:lock'

// Lua script: DEL only when the stored value matches the caller's runId.
// Prevents one run from accidentally releasing another run's lock.
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

// Lua script: EXPIRE only when the stored value matches the caller's runId.
// Prevents one run from extending another run's lock.
const EXTEND_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("expire", KEYS[1], ARGV[2])
else
  return 0
end
`;

/**
 * Acquire a PostgreSQL session-level advisory lock.
 * Advisory locks are automatically released when the DB connection closes
 * (e.g. process crash), which makes them ideal for pipeline mutual exclusion.
 */
async function acquireDbAdvisoryLock(): Promise<boolean> {
  try {
    const rows = await db.execute(
      sql`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS locked`
    );
    const result = rows as unknown as { locked: boolean }[];
    return result[0]?.locked === true;
  } catch {
    // DB unreachable — cannot lock, allow run (same as old Redis-absent behavior)
    return true;
  }
}

/**
 * Release a PostgreSQL session-level advisory lock.
 */
async function releaseDbAdvisoryLock(): Promise<void> {
  try {
    await db.execute(
      sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`
    );
  } catch {
    // Best-effort — lock releases automatically when the session ends
  }
}

/**
 * Attempt to acquire the pipeline lock.
 *
 * @param runId   Unique value stored in the lock (used for safe release).
 * @param ttlSeconds  Lock auto-expiry in seconds. Defaults to 600 (10 min).
 * @returns `true` if the lock was acquired, `false` if already held.
 *          Falls back to a PostgreSQL advisory lock when Redis is unavailable.
 */
export async function acquirePipelineLock(
  runId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return acquireDbAdvisoryLock();

  try {
    const result = await redis.set(LOCK_KEY, runId, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch {
    // Redis unreachable — fall back to DB advisory lock
    return acquireDbAdvisoryLock();
  }
}

/**
 * Release the pipeline lock, but only if it was acquired by the given runId.
 */
export async function releasePipelineLock(runId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    await releaseDbAdvisoryLock();
    return;
  }

  try {
    await redis.eval(RELEASE_SCRIPT, 1, LOCK_KEY, runId);
  } catch {
    // Best-effort release — TTL will expire anyway
  }
}

/**
 * Extend the pipeline lock TTL, but only if it is still owned by runId.
 *
 * @returns `true` if extended or Redis is unavailable (graceful degradation),
 *          `false` if lock ownership is lost.
 */
export async function extendPipelineLock(
  runId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return true; // advisory locks don't expire — no extension needed

  try {
    const result = await redis.eval(
      EXTEND_SCRIPT,
      1,
      LOCK_KEY,
      runId,
      String(ttlSeconds),
    );
    return Number(result) === 1;
  } catch {
    // Redis unreachable — degrade gracefully
    return true;
  }
}

/**
 * Check current lock status (for admin / status endpoints).
 */
export async function getPipelineLockInfo(): Promise<{
  locked: boolean;
  runId?: string;
  ttl?: number;
}> {
  const redis = getRedisClient();
  if (!redis) return { locked: false };

  try {
    const [value, ttl] = await Promise.all([
      redis.get(LOCK_KEY),
      redis.ttl(LOCK_KEY),
    ]);

    if (value) {
      return { locked: true, runId: value, ttl: ttl >= 0 ? ttl : undefined };
    }
    return { locked: false };
  } catch {
    return { locked: false };
  }
}
