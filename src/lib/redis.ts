/**
 * Redis Client Singleton
 *
 * Provides a lazily-connected Redis client using REDIS_URL from env config.
 * Connection errors are logged but do not crash the process — Redis is
 * treated as an optional enhancement (e.g. distributed locking).
 */

import Redis from 'ioredis';
import { config } from '../config/env';

let client: Redis | null = null;
let connectionFailed = false;

/**
 * Get or create the shared Redis client.
 * Returns null if REDIS_URL is not configured or if a previous connection
 * attempt failed (avoids repeated reconnect storms).
 */
export function getRedisClient(): Redis | null {
  if (connectionFailed) return null;
  if (client) return client;

  const url = config.REDIS_URL;
  if (!url) return null;

  try {
    client = new Redis(url, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // don't auto-retry — callers handle fallback
      lazyConnect: true,
    });

    client.on('error', () => {
      // Suppress unhandled error events — callers catch per-command errors
    });

    return client;
  } catch {
    connectionFailed = true;
    return null;
  }
}

/**
 * Disconnect the Redis client. Safe to call even if not connected.
 */
export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => {});
    client = null;
  }
}

/**
 * Reset internal state. Only for use in tests.
 */
export function _resetRedisForTesting(): void {
  client = null;
  connectionFailed = false;
}
