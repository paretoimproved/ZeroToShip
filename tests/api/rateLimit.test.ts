/**
 * Rate Limiting Tests for ZeroToShip API
 *
 * Tests the store abstraction (Memory + Redis), tier configs, and middleware behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RATE_LIMITS,
  IDEAS_LIMIT,
} from '../../src/api/config/tiers';
import {
  MemoryRateLimitStore,
  RedisRateLimitStore,
  type RateLimitStore,
  type RateLimitResult,
} from '../../src/api/middleware/rateLimit';

// ─── Mock ioredis ────────────────────────────────────────────────────────────

const mockExec = vi.fn();
const mockIncr = vi.fn();
const mockPttl = vi.fn();
const mockExpire = vi.fn();
const mockDel = vi.fn();

const mockMulti = vi.fn(() => ({
  incr: mockIncr,
  pttl: mockPttl,
  exec: mockExec,
}));

const mockRedisInstance = {
  multi: mockMulti,
  expire: mockExpire,
  del: mockDel,
};

// Mock the redis config module
vi.mock('../../src/config/redis', () => ({
  getRedisClient: vi.fn(() => null),
  disconnectRedis: vi.fn(),
  _resetRedisForTesting: vi.fn(),
}));

// Mock env config to prevent dotenv loading
vi.mock('../../src/config/env', () => ({
  config: {
    isProduction: false,
    isTest: true,
    REDIS_URL: undefined,
  },
}));

import { getRedisClient } from '../../src/config/redis';
const mockedGetRedisClient = vi.mocked(getRedisClient);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Rate Limits', () => {
  describe('RATE_LIMITS configuration', () => {
    it('should have correct limits for anonymous tier', () => {
      expect(RATE_LIMITS.anonymous.requests).toBe(10);
      expect(RATE_LIMITS.anonymous.windowMs).toBe(60 * 60 * 1000); // 1 hour
    });

    it('should have correct limits for free tier', () => {
      expect(RATE_LIMITS.free.requests).toBe(100);
      expect(RATE_LIMITS.free.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have correct limits for pro tier', () => {
      expect(RATE_LIMITS.pro.requests).toBe(1000);
      expect(RATE_LIMITS.pro.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have correct limits for enterprise tier', () => {
      expect(RATE_LIMITS.enterprise.requests).toBe(10000);
      expect(RATE_LIMITS.enterprise.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have increasing limits as tier increases', () => {
      expect(RATE_LIMITS.anonymous.requests).toBeLessThan(RATE_LIMITS.free.requests);
      expect(RATE_LIMITS.free.requests).toBeLessThan(RATE_LIMITS.pro.requests);
      expect(RATE_LIMITS.pro.requests).toBeLessThan(RATE_LIMITS.enterprise.requests);
    });
  });

  describe('IDEAS_LIMIT configuration', () => {
    it('should have correct limits for each tier', () => {
      expect(IDEAS_LIMIT.anonymous).toBe(3);
      expect(IDEAS_LIMIT.free).toBe(3);
      expect(IDEAS_LIMIT.pro).toBe(10);
      expect(IDEAS_LIMIT.enterprise).toBe(Infinity);
    });

    it('should have same limit for anonymous and free', () => {
      expect(IDEAS_LIMIT.anonymous).toBe(IDEAS_LIMIT.free);
    });

    it('should have unlimited ideas for enterprise', () => {
      expect(IDEAS_LIMIT.enterprise).toBe(Infinity);
    });
  });
});

describe('MemoryRateLimitStore', () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
    // Clear the shared memoryMap via the clear method on known keys
  });

  it('should allow requests within the limit', async () => {
    const result = await store.check('test:mem1', 10, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.resetAt).toBeInstanceOf(Date);
  });

  it('should decrement remaining on each request', async () => {
    await store.check('test:mem2', 5, 60000);
    const result = await store.check('test:mem2', 5, 60000);
    expect(result.remaining).toBe(3);
  });

  it('should deny requests when limit is exceeded', async () => {
    for (let i = 0; i < 3; i++) {
      await store.check('test:mem3', 3, 60000);
    }
    const result = await store.check('test:mem3', 3, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should clear a key', async () => {
    await store.check('test:mem4', 5, 60000);
    store.clear('test:mem4');
    const result = await store.check('test:mem4', 5, 60000);
    expect(result.remaining).toBe(4);
  });

  it('should return a valid resetAt date in the future', async () => {
    const before = Date.now();
    const result = await store.check('test:mem5', 10, 60000);
    expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.resetAt.getTime()).toBeLessThanOrEqual(before + 60000 + 100);
  });
});

describe('RedisRateLimitStore', () => {
  let store: RedisRateLimitStore;

  beforeEach(() => {
    store = new RedisRateLimitStore();
    vi.clearAllMocks();
  });

  it('should fall back to memory when Redis client is null', async () => {
    mockedGetRedisClient.mockReturnValue(null);
    const result = await store.check('test:redis1', 10, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('should use Redis INCR+PTTL when connected', async () => {
    mockedGetRedisClient.mockReturnValue(mockRedisInstance as ReturnType<typeof getRedisClient>);
    mockExec.mockResolvedValue([
      [null, 1],  // INCR result: count = 1
      [null, -1], // PTTL result: no TTL yet
    ]);
    mockExpire.mockResolvedValue(1);

    const result = await store.check('test:redis2', 100, 3600000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
    expect(mockMulti).toHaveBeenCalled();
    expect(mockExpire).toHaveBeenCalledWith('ratelimit:test:redis2', 3600);
  });

  it('should not set expire when TTL already exists', async () => {
    mockedGetRedisClient.mockReturnValue(mockRedisInstance as ReturnType<typeof getRedisClient>);
    mockExec.mockResolvedValue([
      [null, 5],     // INCR result: count = 5
      [null, 30000], // PTTL result: 30 seconds remaining
    ]);

    const result = await store.check('test:redis3', 100, 3600000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(95);
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it('should deny when count exceeds limit', async () => {
    mockedGetRedisClient.mockReturnValue(mockRedisInstance as ReturnType<typeof getRedisClient>);
    mockExec.mockResolvedValue([
      [null, 101],   // INCR result: count = 101 (over limit of 100)
      [null, 10000], // PTTL result: 10 seconds remaining
    ]);

    const result = await store.check('test:redis4', 100, 3600000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should fall back to memory on Redis error', async () => {
    mockedGetRedisClient.mockReturnValue(mockRedisInstance as ReturnType<typeof getRedisClient>);
    mockExec.mockRejectedValue(new Error('Connection refused'));

    const result = await store.check('test:redis5', 10, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('should fall back to memory when exec returns null', async () => {
    mockedGetRedisClient.mockReturnValue(mockRedisInstance as ReturnType<typeof getRedisClient>);
    mockExec.mockResolvedValue(null);

    const result = await store.check('test:redis6', 10, 60000);
    expect(result.allowed).toBe(true);
  });

  it('should call redis.del on clear when connected', () => {
    mockedGetRedisClient.mockReturnValue(mockRedisInstance as ReturnType<typeof getRedisClient>);
    mockDel.mockResolvedValue(1);
    store.clear('test:redis7');
    expect(mockDel).toHaveBeenCalledWith('ratelimit:test:redis7');
  });
});

describe('Rate Limit Math', () => {
  it('should calculate correct hourly rate for anonymous (10/hour)', () => {
    const tierConfig = RATE_LIMITS.anonymous;
    const requestsPerMinute = tierConfig.requests / 60;
    expect(requestsPerMinute).toBeCloseTo(0.167, 2);
  });

  it('should calculate correct hourly rate for free (100/hour)', () => {
    const tierConfig = RATE_LIMITS.free;
    const requestsPerMinute = tierConfig.requests / 60;
    expect(requestsPerMinute).toBeCloseTo(1.67, 1);
  });

  it('should calculate correct hourly rate for pro (1000/hour)', () => {
    const tierConfig = RATE_LIMITS.pro;
    const requestsPerMinute = tierConfig.requests / 60;
    expect(requestsPerMinute).toBeCloseTo(16.67, 1);
  });

  it('should calculate correct hourly rate for enterprise (10000/hour)', () => {
    const tierConfig = RATE_LIMITS.enterprise;
    const requestsPerMinute = tierConfig.requests / 60;
    expect(requestsPerMinute).toBeCloseTo(166.67, 1);
  });
});

describe('Tier Upgrade Benefits', () => {
  it('should show 10x improvement from anonymous to free', () => {
    const improvement = RATE_LIMITS.free.requests / RATE_LIMITS.anonymous.requests;
    expect(improvement).toBe(10);
  });

  it('should show 10x improvement from free to pro', () => {
    const improvement = RATE_LIMITS.pro.requests / RATE_LIMITS.free.requests;
    expect(improvement).toBe(10);
  });

  it('should show 10x improvement from pro to enterprise', () => {
    const improvement = RATE_LIMITS.enterprise.requests / RATE_LIMITS.pro.requests;
    expect(improvement).toBe(10);
  });

  it('should show 1000x total improvement from anonymous to enterprise', () => {
    const improvement = RATE_LIMITS.enterprise.requests / RATE_LIMITS.anonymous.requests;
    expect(improvement).toBe(1000);
  });
});
