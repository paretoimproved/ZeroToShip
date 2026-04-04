/**
 * Redis Configuration for ZeroToShip
 *
 * Provides a lazy-initialized Redis client.
 * Falls back gracefully if Redis is unavailable.
 */

import Redis from 'ioredis';
import { config } from './env';

let _client: Redis | null = null;
let _connectionFailed = false;

/**
 * Get a shared Redis client instance.
 * Returns null if REDIS_URL is not configured or connection has failed.
 */
export function getRedisClient(): Redis | null {
  if (_connectionFailed) return null;
  if (_client) return _client;

  const url = config.REDIS_URL;
  if (!url) return null;

  try {
    _client = new Redis(url, {
      maxRetriesPerRequest: 1,
      retryStrategy(times: number) {
        if (times > 3) {
          _connectionFailed = true;
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    _client.on('error', (err: Error) => {
      console.warn('[Redis] Connection error:', err.message);
    });

    // Attempt connection — don't block startup
    _client.connect().catch((err: Error) => {
      console.warn('[Redis] Failed to connect, falling back to memory store:', err.message);
      _connectionFailed = true;
      _client?.disconnect();
      _client = null;
    });

    return _client;
  } catch (err) {
    console.warn('[Redis] Failed to create client:', (err as Error).message);
    _connectionFailed = true;
    return null;
  }
}

/**
 * Disconnect the Redis client. Call on shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
  }
}

/**
 * Reset Redis state. For testing only.
 */
export function _resetRedisForTesting(): void {
  _client = null;
  _connectionFailed = false;
}
