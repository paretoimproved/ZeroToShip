/**
 * Pipeline Distributed Lock
 *
 * Uses Redis SET NX EX to prevent concurrent pipeline runs.
 * If Redis is unavailable the lock is skipped (graceful degradation).
 */

import { getRedisClient } from './redis';

const LOCK_KEY = 'pipeline:lock';
const DEFAULT_TTL_SECONDS = 600; // 10 minutes
export const PIPELINE_LOCK_TTL_SECONDS = DEFAULT_TTL_SECONDS;

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
 * Attempt to acquire the pipeline lock.
 *
 * @param runId   Unique value stored in the lock (used for safe release).
 * @param ttlSeconds  Lock auto-expiry in seconds. Defaults to 600 (10 min).
 * @returns `true` if the lock was acquired, `false` if already held.
 *          Returns `true` when Redis is unavailable (graceful degradation).
 */
export async function acquirePipelineLock(
  runId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return true; // no Redis — proceed without lock

  try {
    const result = await redis.set(LOCK_KEY, runId, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch {
    // Redis unreachable — degrade gracefully
    return true;
  }
}

/**
 * Release the pipeline lock, but only if it was acquired by the given runId.
 */
export async function releasePipelineLock(runId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

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
  if (!redis) return true;

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
